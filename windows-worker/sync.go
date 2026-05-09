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
	Category               []primitive.ObjectID `bson:"category"`
	BusinessBillingAddress struct {
		State string `bson:"business_billing_address_state"`
	} `bson:"business_billing_address"`
}

func runSyncLoop(cfg Config) {
	setupFileLogger(cfg.LogFilePath) // applies in both service and `run` mode
	log.Printf("Starting sync loop, interval: %s", cfg.SyncInterval)
	runSync(cfg)

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

	users, err := fetchUsers(ctx, localColl, since)
	if err != nil {
		log.Printf("ERROR: fetching users: %v", err)
		return
	}
	log.Printf("Fetched %d users from local DB", len(users))

	if len(users) == 0 {
		log.Println("No changes since last sync, skipping")
		saveCheckpoint(start)
		return
	}

	inserted, updated, deleted, errs := syncRecipients(ctx, atlasColl, users, fullSync, cfg)

	// Only advance the checkpoint if the sync completed without errors.
	// On failure the same window is retried next cycle.
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

// fetchUsers fetches qualifying users from local MongoDB.
// If since is zero (full sync) it fetches all active users.
// Otherwise only users modified after since.
func fetchUsers(ctx context.Context, coll *mongo.Collection, since time.Time) ([]LocalUser, error) {
	filter := bson.M{
		"gcm_id":              bson.M{"$exists": true, "$ne": ""},
		"state":               "Active",
		"registration_status": "Approved",
	}
	if !since.IsZero() {
		filter["updatedAt"] = bson.M{"$gt": since}
	}

	projection := bson.M{
		"_id":      1,
		"gcm_id":   1,
		"category": 1,
		"business_billing_address.business_billing_address_state": 1,
	}

	cursor, err := coll.Find(ctx, filter, options.Find().SetProjection(projection))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var users []LocalUser
	if err := cursor.All(ctx, &users); err != nil {
		return nil, err
	}
	return users, nil
}

// syncRecipients upserts changed users and — on full sync only — deletes stale recipients.
//
// Delete runs only when fullSync=true because incremental runs only have a subset
// of users. Diffing a subset against all Atlas recipients would incorrectly mark
// the rest as stale and delete them (exactly the bug this fixes).
//
// Deactivated / token-removed users will be cleaned up on the next full sync,
// which happens automatically whenever the checkpoint file is missing or reset.
func syncRecipients(
	ctx context.Context,
	coll *mongo.Collection,
	users []LocalUser,
	fullSync bool,
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
				ins, upd, e := executeBulkUpsert(ctx, coll, batch)
				atomic.AddInt64(&atomicInserted, int64(ins))
				atomic.AddInt64(&atomicUpdated, int64(upd))
				atomic.AddInt64(&atomicErrs, int64(e))
			}
		}()
	}

	// Build active token set (needed for delete phase if fullSync).
	activeTokens := make(map[string]struct{}, len(users))

	now := time.Now()
	batch := make([]mongo.WriteModel, 0, cfg.BatchSize)
	for _, u := range users {
		activeTokens[u.GcmID] = struct{}{}

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

	inserted = int(atomic.LoadInt64(&atomicInserted))
	updated = int(atomic.LoadInt64(&atomicUpdated))
	errs = int(atomic.LoadInt64(&atomicErrs))

	// ── Delete phase — full sync only ────────────────────────────────────────

	if !fullSync {
		return
	}

	cursor, err := coll.Find(ctx, bson.M{},
		options.Find().SetProjection(bson.M{"_id": 1, "fcm_token": 1}),
	)
	if err != nil {
		log.Printf("ERROR: listing atlas recipients for delete phase: %v", err)
		errs++
		return
	}
	defer cursor.Close(ctx)

	stale := make([]primitive.ObjectID, 0, cfg.BatchSize)
	for cursor.Next(ctx) {
		var rec struct {
			ID       primitive.ObjectID `bson:"_id"`
			FcmToken string             `bson:"fcm_token"`
		}
		if err := cursor.Decode(&rec); err != nil {
			continue
		}
		if _, active := activeTokens[rec.FcmToken]; !active {
			stale = append(stale, rec.ID)
		}
		if len(stale) == cfg.BatchSize {
			d, e := executeDeleteBatch(ctx, coll, stale)
			deleted += d
			errs += e
			stale = stale[:0]
		}
	}
	if len(stale) > 0 {
		d, e := executeDeleteBatch(ctx, coll, stale)
		deleted += d
		errs += e
	}

	return inserted, updated, deleted, errs
}

// executeBulkUpsert sends one BulkWrite to Atlas and returns counts.
// Ordered=false lets MongoDB continue past individual failures.
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