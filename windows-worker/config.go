package main

import (
	"bufio"
	"log"
	"os"
	"strings"
	"time"
)

type Config struct {
	LocalMongoURI   string
	LocalDatabase   string
	LocalCollection string
	AtlasMongoURI   string
	AtlasDatabase   string
	AtlasCollection string
	SyncInterval    time.Duration
	BatchSize       int
	WorkerCount     int
	LogFilePath     string
	IsProd          bool
}

// loadConfig reads from a .env file next to the binary, then falls back to
// environment variables. This keeps secrets out of the binary and off the
// command line while still working if env vars are set by the OS/SCM.
func loadConfig() Config {
	loadDotEnv(".env")

	mins := getEnvInt("SYNC_INTERVAL_MINUTES", 30)
	interval := time.Duration(mins) * time.Minute

	cfg := Config{
		LocalMongoURI:   requireEnv("LOCAL_MONGO_URI"),
		LocalDatabase:   requireEnv("LOCAL_DATABASE"),
		LocalCollection: getEnvOrDefault("LOCAL_COLLECTION", "users"),
		AtlasMongoURI:   requireEnv("ATLAS_MONGO_URI"),
		AtlasDatabase:   requireEnv("ATLAS_DATABASE"),
		AtlasCollection: getEnvOrDefault("ATLAS_COLLECTION", "recipients"),
		SyncInterval:    interval,
		BatchSize:       getEnvInt("BATCH_SIZE", 500),
		WorkerCount:     getEnvInt("WORKER_COUNT", 4),
		LogFilePath:     getEnvOrDefault("LOG_FILE_PATH", "C:\\fcm-sync\\fcm-sync.log"),
		IsProd:          getEnvOrDefault("APP_ENV", "dev") == "prod",
	}
	return cfg
}

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env var %s is not set", key)
	}
	return v
}

func getEnvOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// loadDotEnv parses a simple KEY=VALUE file and sets env vars if not already set.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return // .env is optional
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

func getEnvInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n := 0
	for _, c := range v {
		if c < '0' || c > '9' {
			log.Printf("WARNING: %s=%q is not a valid integer, using default %d", key, v, def)
			return def
		}
		n = n*10 + int(c-'0')
	}
	if n <= 0 {
		log.Printf("WARNING: %s must be > 0, using default %d", key, def)
		return def
	}
	return n
}

func parseIntEnv(s string, out *int) (string, error) {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return s, os.ErrInvalid
		}
		n = n*10 + int(c-'0')
	}
	*out = n
	return s, nil
}