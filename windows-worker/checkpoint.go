package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"time"
)

type Checkpoint struct {
	LastSyncedAt time.Time `json:"last_synced_at"`
}

func checkpointPath() string {
	exe, _ := os.Executable()
	return filepath.Join(filepath.Dir(exe), "checkpoint.json")
}

// loadCheckpoint returns the last successful sync time.
// Returns zero time if no checkpoint exists — triggers a full sync on first run.
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

// saveCheckpoint persists atomically (write temp, then rename).
// Prevents a corrupt checkpoint if the process crashes mid-write.
func saveCheckpoint(t time.Time) {
	data, _ := json.Marshal(Checkpoint{LastSyncedAt: t})
	tmp := checkpointPath() + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		log.Printf("ERROR: could not write checkpoint: %v", err)
		return
	}
	if err := os.Rename(tmp, checkpointPath()); err != nil {
		log.Printf("ERROR: could not save checkpoint: %v", err)
	}
}