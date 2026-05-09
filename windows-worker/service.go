package main

import (
	"fmt"
	"log"
	"time"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

const serviceName = "FCMSyncWorker"
const serviceDesc = "Syncs FCM tokens from local MongoDB to Atlas every 30 minutes"

// --- Windows Service handler ---

type fcmService struct {
	cfg Config
}

func (s *fcmService) Execute(args []string, req <-chan svc.ChangeRequest, status chan<- svc.Status) (bool, uint32) {
	status <- svc.Status{State: svc.StartPending}

	// Signal that we're running and accept stop/shutdown.
	status <- svc.Status{
		State:   svc.Running,
		Accepts: svc.AcceptStop | svc.AcceptShutdown,
	}

	// Run the sync loop in a goroutine so we can listen for service signals.
	stopCh := make(chan struct{})
	go func() {
		runSyncLoopWithStop(s.cfg, stopCh)
	}()

	for c := range req {
		switch c.Cmd {
		case svc.Stop, svc.Shutdown:
			status <- svc.Status{State: svc.StopPending}
			close(stopCh)
			return false, 0
		}
	}
	return false, 0
}

// runService is called when the process is launched by the SCM.
func runService() {
	cfg := loadConfig()
	setupFileLogger(cfg.LogFilePath)

	log.Printf("Starting %s as Windows service", serviceName)
	if err := svc.Run(serviceName, &fcmService{cfg: cfg}); err != nil {
		log.Fatalf("service run failed: %v", err)
	}
}

// runSyncLoopWithStop is like runSyncLoop but honours a stop channel.
func runSyncLoopWithStop(cfg Config, stop <-chan struct{}) {
	runSync(cfg)

	ticker := time.NewTicker(cfg.SyncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			runSync(cfg)
		case <-stop:
			log.Println("Sync loop stopping")
			return
		}
	}
}

// --- Service management helpers (CLI) ---

func installService() error {
	exePath, err := exePath()
	if err != nil {
		return err
	}

	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connect to SCM: %w", err)
	}
	defer m.Disconnect()

	// Check if already installed.
	s, err := m.OpenService(serviceName)
	if err == nil {
		s.Close()
		return fmt.Errorf("service %s already exists", serviceName)
	}

	s, err = m.CreateService(
		serviceName,
		exePath,
		mgr.Config{
			DisplayName:      serviceName,
			Description:      serviceDesc,
			StartType:        mgr.StartAutomatic, // starts on boot
			DelayedAutoStart: true,               // gives network stack time to come up
		},
	)
	if err != nil {
		return fmt.Errorf("create service: %w", err)
	}
	defer s.Close()

	// Configure failure recovery: restart the service on failure.
	if err := s.SetRecoveryActions(
		[]mgr.RecoveryAction{
			{Type: mgr.ServiceRestart, Delay: 60 * time.Second},
			{Type: mgr.ServiceRestart, Delay: 120 * time.Second},
			{Type: mgr.ServiceRestart, Delay: 300 * time.Second},
		},
		86400, // reset period: 1 day
	); err != nil {
		log.Printf("WARNING: could not set recovery actions: %v", err)
	}

	return nil
}

func removeService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	s, err := m.OpenService(serviceName)
	if err != nil {
		return fmt.Errorf("service %s not found: %w", serviceName, err)
	}
	defer s.Close()

	return s.Delete()
}

func startService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	s, err := m.OpenService(serviceName)
	if err != nil {
		return fmt.Errorf("service %s not found: %w", serviceName, err)
	}
	defer s.Close()

	return s.Start()
}

func stopService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	s, err := m.OpenService(serviceName)
	if err != nil {
		return fmt.Errorf("service %s not found: %w", serviceName, err)
	}
	defer s.Close()

	_, err = s.Control(svc.Stop)
	return err
}
