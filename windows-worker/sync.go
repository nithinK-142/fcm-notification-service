package main

import (
	"context"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// LocalUser represents only the fields we need from the local users collection.
type LocalUser struct {
	ID                     primitive.ObjectID   `bson:"_id"`
	GcmID                  string               `bson:"gcm_id"`
	UpdatedAt              time.Time            `bson:"updatedAt"`
	Category               []primitive.ObjectID `bson:"category"`
	BusinessBillingAddress struct {
		State string `bson:"business_billing_address_state"`
	} `bson:"business_billing_address"`
}

func runSyncLoop(cfg Config) {
	if cfg.IsProd {
		setupFileLogger(cfg.LogFilePath)
	}
	log.Printf("Starting sync loop, interval: %s", cfg.SyncInterval)

	if shouldSkipInitialSync(loadCheckpoint(), cfg.SyncInterval) {
		log.Println("Recent checkpoint found — skipping sync on boot, waiting for next interval")
	} else {
		runSync(cfg)
	}

	ticker := time.NewTicker(cfg.SyncInterval)
	defer ticker.Stop()
	for range ticker.C {
		runSync(cfg)
	}
}

func runSync(cfg Config) {
	start := time.Now()
	since := loadCheckpoint()
	fullSync := since.IsZero()

	if fullSync {
		log.Println("Sync started — no checkpoint, running full sync")
	} else {
		log.Printf("Sync started — incremental since %s", since.Format(time.RFC3339))
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	localClient, err := connectMongo(ctx, cfg.LocalMongoURI)
	if err != nil {
		log.Printf("ERROR: local mongo connect: %v", err)
		return
	}
	defer localClient.Disconnect(context.Background())

	atlasClient, err := connectMongo(ctx, cfg.AtlasMongoURI)
	if err != nil {
		log.Printf("ERROR: atlas mongo connect: %v", err)
		return
	}
	defer atlasClient.Disconnect(context.Background())

	localColl := localClient.Database(cfg.LocalDatabase).Collection(cfg.LocalCollection)
	atlasColl := atlasClient.Database(cfg.AtlasDatabase).Collection(cfg.AtlasCollection)

	// Count is not known upfront with cursor streaming — log will appear after sync.
	inserted, updated, deleted, errs := syncRecipients(ctx, localColl, atlasColl, fullSync, since, cfg)

	if inserted+updated == 0 && errs == 0 {
		log.Println("No changes since last sync, skipping")
		saveCheckpoint(start)
		return
	}

	// Only advance checkpoint if no errors — failed syncs retry the same window.
	if errs == 0 {
		saveCheckpoint(start)
	} else {
		log.Println("Sync had errors — checkpoint not advanced, will retry next cycle")
	}

	log.Printf(
		"Sync done in %s — inserted: %d, updated: %d, deleted: %d, errors: %d",
		time.Since(start).Round(time.Millisecond),
		inserted, updated, deleted, errs,
	)
}

// streamUsers opens a cursor over qualifying users and streams each decoded
// document into the provided channel. The caller owns closing the channel.
// Using a cursor instead of cursor.All() means we never hold the full user
// list in memory — only one document at a time is decoded.
func streamUsers(ctx context.Context, coll *mongo.Collection, since time.Time, out chan<- LocalUser) error {
	filter := bson.M{
		"gcm_id":              bson.M{"$exists": true, "$ne": ""},
		"state":               "Active",
		"registration_status": "Approved",
	}
	if !since.IsZero() {
		filter["updatedAt"] = bson.M{"$gt": since}
	}
	projection := bson.M{
		"_id":       1,
		"gcm_id":    1,
		"updatedAt": 1,
		"category":  1,
		"business_billing_address.business_billing_address_state": 1,
	}

	cursor, err := coll.Find(ctx, filter,
		options.Find().
			SetProjection(projection).
			SetBatchSize(1000), // fetch 1000 docs per network round-trip
	)
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)

	for cursor.Next(ctx) {
		var u LocalUser
		if err := cursor.Decode(&u); err != nil {
			log.Printf("WARNING: skipping user decode error: %v", err)
			continue
		}
		out <- u
	}
	return cursor.Err()
}

// syncRecipients is the core sync engine.
//
// Upsert phase:
//   - Streams users from local MongoDB via cursor (constant memory regardless of scale).
//   - Deduplicates by gcm_id on the fly (keeps latest updatedAt per token).
//   - Sends BulkWrite batches to workerCount goroutines via a channel.
//
// Delete phase (full sync only):
//   - Streams Atlas recipients cursor, diffs against active token set.
//   - Batched DeleteMany — never loads all recipient IDs into RAM.
func syncRecipients(
	ctx context.Context,
	localColl *mongo.Collection,
	atlasColl *mongo.Collection,
	fullSync bool,
	since time.Time,
	cfg Config,
) (inserted, updated, deleted, errs int) {

	// ── Upsert phase ────────────────────────────────────────────────────────

	var (
		atomicInserted int64
		atomicUpdated  int64
		atomicErrs     int64
	)

	batchCh := make(chan []mongo.WriteModel, cfg.WorkerCount*2)

	var wg sync.WaitGroup
	for i := 0; i < cfg.WorkerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for batch := range batchCh {
				ins, upd, e := executeBulkUpsert(ctx, atlasColl, batch)
				atomic.AddInt64(&atomicInserted, int64(ins))
				atomic.AddInt64(&atomicUpdated, int64(upd))
				atomic.AddInt64(&atomicErrs, int64(e))
			}
		}()
	}

	// Stream users, deduplicate on the fly, feed batches to workers.
	// deduped holds only the winning LocalUser per token — still bounded
	// by the number of unique tokens, but built incrementally, never all at once.
	deduped := make(map[string]LocalUser)
	userCh := make(chan LocalUser, 500)
	streamErr := make(chan error, 1)

	go func() {
		streamErr <- streamUsers(ctx, localColl, since, userCh)
		close(userCh)
	}()

	now := time.Now()
	batch := make([]mongo.WriteModel, 0, cfg.BatchSize)

	for u := range userCh {
		// Dedup: if same token seen before, keep the newer one.
		if existing, seen := deduped[u.GcmID]; seen && !u.UpdatedAt.After(existing.UpdatedAt) {
			continue
		}
		deduped[u.GcmID] = u

		category := primitive.NilObjectID
		if len(u.Category) > 0 {
			category = u.Category[0]
		}
		model := mongo.NewUpdateOneModel().
			SetFilter(bson.M{"fcm_token": u.GcmID}).
			SetUpdate(bson.M{
				"$set": bson.M{
					"user_id":               u.ID,
					"fcm_token":             u.GcmID,
					"state":                 u.BusinessBillingAddress.State,
					"registration_category": category,
					"updated_at":            now,
				},
				"$setOnInsert": bson.M{
					"created_at": now,
				},
			}).
			SetUpsert(true)

		batch = append(batch, model)
		if len(batch) == cfg.BatchSize {
			batchCh <- batch
			batch = make([]mongo.WriteModel, 0, cfg.BatchSize)
		}
	}
	if len(batch) > 0 {
		batchCh <- batch
	}

	close(batchCh)
	wg.Wait()

	if err := <-streamErr; err != nil {
		log.Printf("ERROR: user cursor stream: %v", err)
		errs++
	}

	inserted = int(atomic.LoadInt64(&atomicInserted))
	updated = int(atomic.LoadInt64(&atomicUpdated))
	errs += int(atomic.LoadInt64(&atomicErrs))

	// ── Delete phase — full sync only ────────────────────────────────────────
	// Incremental runs only have a subset of users. Diffing against all Atlas
	// recipients would incorrectly mark the rest as stale.
	if !fullSync {
		return
	}

	// Build active token set from the deduped map (already in memory).
	activeTokens := make(map[string]struct{}, len(deduped))
	for token := range deduped {
		activeTokens[token] = struct{}{}
	}

	recipCursor, err := atlasColl.Find(ctx, bson.M{},
		options.Find().
			SetProjection(bson.M{"_id": 1, "fcm_token": 1}).
			SetBatchSize(1000),
	)
	if err != nil {
		log.Printf("ERROR: listing atlas recipients for delete phase: %v", err)
		errs++
		return
	}
	defer recipCursor.Close(ctx)

	stale := make([]primitive.ObjectID, 0, cfg.BatchSize)
	for recipCursor.Next(ctx) {
		var rec struct {
			ID       primitive.ObjectID `bson:"_id"`
			FcmToken string             `bson:"fcm_token"`
		}
		if err := recipCursor.Decode(&rec); err != nil {
			continue
		}
		if _, active := activeTokens[rec.FcmToken]; !active {
			stale = append(stale, rec.ID)
		}
		if len(stale) == cfg.BatchSize {
			d, e := executeDeleteBatch(ctx, atlasColl, stale)
			deleted += d
			errs += e
			stale = stale[:0]
		}
	}
	if len(stale) > 0 {
		d, e := executeDeleteBatch(ctx, atlasColl, stale)
		deleted += d
		errs += e
	}

	return inserted, updated, deleted, errs
}

// executeBulkUpsert sends one BulkWrite to Atlas and returns counts.
// Ordered=false lets MongoDB parallelise the ops server-side and continue
// past individual failures rather than aborting the whole batch.
func executeBulkUpsert(ctx context.Context, coll *mongo.Collection, models []mongo.WriteModel) (inserted, updated, errCount int) {
	opts := options.BulkWrite().SetOrdered(false)
	result, err := coll.BulkWrite(ctx, models, opts)
	if err != nil {
		log.Printf("ERROR: bulk upsert batch (%d ops): %v", len(models), err)
		return 0, 0, 1
	}
	return int(result.UpsertedCount), int(result.ModifiedCount), 0
}

// executeDeleteBatch issues a single DeleteMany for a slice of _ids.
func executeDeleteBatch(ctx context.Context, coll *mongo.Collection, ids []primitive.ObjectID) (deleted, errCount int) {
	res, err := coll.DeleteMany(ctx, bson.M{"_id": bson.M{"$in": ids}})
	if err != nil {
		log.Printf("ERROR: delete batch (%d ids): %v", len(ids), err)
		return 0, 1
	}
	return int(res.DeletedCount), 0
}

func connectMongo(ctx context.Context, uri string) (*mongo.Client, error) {
	opts := options.Client().ApplyURI(uri).
		SetConnectTimeout(15 * time.Second).
		SetServerSelectionTimeout(15 * time.Second)

	client, err := mongo.Connect(ctx, opts)
	if err != nil {
		return nil, err
	}
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}
	return client, nil
}
