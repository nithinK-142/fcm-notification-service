package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
)

func verifySignature(timestamp, signature string, cfg Config) bool {
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		log.Printf("verifySignature: bad timestamp: %v", err)
		return false
	}
	if time.Since(time.UnixMilli(ts)) > 5*time.Minute {
		log.Printf("verifySignature: timestamp too old: %v", time.Since(time.UnixMilli(ts)))
		return false
	}

	mac := hmac.New(sha256.New, []byte(cfg.SyncSecret))
	mac.Write([]byte(timestamp))
	expected := hex.EncodeToString(mac.Sum(nil))
	// log.Printf("verifySignature: got=%s expected=%s", signature, expected) // debug
	return hmac.Equal([]byte(expected), []byte(signature))
}

func startHealthServer(cfg Config) {
	http.HandleFunc("/sync", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		timestamp := r.Header.Get("x-timestamp")
		signature := r.Header.Get("x-signature")

		if timestamp == "" || signature == "" {
			http.Error(w, "Missing timestamp or signature", http.StatusUnauthorized)
			return
		}

		if !verifySignature(timestamp, signature, cfg) {
			http.Error(w, "Invalid signature", http.StatusUnauthorized)
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
