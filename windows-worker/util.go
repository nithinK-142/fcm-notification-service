package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
)

// exePath returns the absolute path of the running executable.
// Used by the installer to register the correct binary with SCM.
func exePath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("could not determine executable path: %w", err)
	}
	return filepath.Abs(exe)
}

// setupFileLogger redirects the standard logger to a file.
// The file is opened in append mode so logs survive restarts.
func setupFileLogger(path string) {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		// Can't do much here; fall back to stdout.
		log.Printf("WARNING: could not create log dir: %v", err)
		return
	}

	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Printf("WARNING: could not open log file %s: %v", path, err)
		return
	}

	log.SetOutput(f)
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
}
