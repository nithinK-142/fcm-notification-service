package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Checkpoint struct {
	LastSyncedAt time.Time `json:"last_synced_at"`
}

// checkpointPath returns the path to checkpoint.json.
//
// go run puts the binary in a OS temp dir, so using exe dir would create a
// fresh checkpoint on every run. Instead we detect that case and fall back to
// the working directory so the checkpoint persists across dev restarts too.
// A compiled .exe always uses the directory it lives in (e.g. C:\fcm-sync\).
func checkpointPath() string {
	exe, _ := os.Executable()
	exe, _ = filepath.EvalSymlinks(exe)

	// go run temp path contains "go-build" on all platforms.
	if strings.Contains(exe, "go-build") {
		cwd, _ := os.Getwd()
		return filepath.Join(cwd, "checkpoint.json")
	}
	return filepath.Join(filepath.Dir(exe), "checkpoint.json")
}

// loadCheckpoint returns the last successful sync time.
// Returns zero time if no checkpoint exists — triggers a full sync.
func loadCheckpoint() time.Time {
	data, err := os.ReadFile(checkpointPath())
	if err != nil {
		return time.Time{}
	}
	var cp Checkpoint
	if err := json.Unmarshal(data, &cp); err != nil {
		log.Printf("WARNING: corrupt checkpoint file, will do full sync: %v", err)
		return time.Time{}
	}
	return cp.LastSyncedAt
}

// saveCheckpoint persists atomically (write temp file, then rename).
// Prevents a corrupt checkpoint if the process crashes mid-write.
func saveCheckpoint(t time.Time) {
	path := checkpointPath()
	data, _ := json.Marshal(Checkpoint{LastSyncedAt: t})
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		log.Printf("ERROR: could not write checkpoint: %v", err)
		return
	}
	if err := os.Rename(tmp, path); err != nil {
		log.Printf("ERROR: could not save checkpoint: %v", err)
	}
}
// shouldSkipInitialSync returns true if the last sync was recent enough that
// running again immediately on boot would be redundant.
// Threshold: if last sync was within 90% of the sync interval, skip.
func shouldSkipInitialSync(since time.Time, interval time.Duration) bool {
	if since.IsZero() {
		return false // no checkpoint — must do full sync
	}
	age := time.Since(since)
	threshold := time.Duration(float64(interval) * 0.9)
	return age < threshold
}