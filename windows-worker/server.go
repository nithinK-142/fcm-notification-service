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

	server := &http.Server{
		Addr:         "127.0.0.1:9573",
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		Handler:      nil,
	}
	log.Println("Go server listening on 127.0.0.1:9573")
	log.Fatal(server.ListenAndServe())
}
