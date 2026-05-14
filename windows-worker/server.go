package main

import (
	"log"
	"net/http"
	"os"
)

func startHealthServer(cfg Config) {
	http.HandleFunc("/sync", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		// Delete checkpoint to force full sync
		os.Remove(checkpointPath())
		// Run sync immediately
		go runSync(cfg)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Sync triggered"))
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	log.Println("Go server listening on :9573")
	http.ListenAndServe(":9573", nil)
}
