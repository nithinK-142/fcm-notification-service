package main

import (
	"log"
	"os"

	"golang.org/x/sys/windows/svc"
)

func main() {
	isService, err := svc.IsWindowsService()
	if err != nil {
		log.Fatalf("failed to determine if running as service: %v", err)
	}

	if isService {
		runService()
		return
	}

	// CLI mode for install/remove/start/stop/run-once
	if len(os.Args) < 2 {
		log.Println("Usage: fcm-sync.exe [install|remove|start|stop|run]")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "install":
		if err := installService(); err != nil {
			log.Fatalf("install failed: %v", err)
		}
		log.Println("Service installed and set to auto-start.")
	case "remove":
		if err := removeService(); err != nil {
			log.Fatalf("remove failed: %v", err)
		}
		log.Println("Service removed.")
	case "start":
		if err := startService(); err != nil {
			log.Fatalf("start failed: %v", err)
		}
		log.Println("Service started.")
	case "stop":
		if err := stopService(); err != nil {
			log.Fatalf("stop failed: %v", err)
		}
		log.Println("Service stopped.")
	case "run":
		// Foreground mode for testing
		cfg := loadConfig()
		go startHealthServer(cfg)
		runSyncLoop(cfg)
	default:
		log.Fatalf("unknown command: %s", os.Args[1])
	}
}
