# FCM Sync Worker

A Windows service that syncs active user FCM tokens from a local MongoDB instance
to an Atlas MongoDB `recipients` collection every 30 minutes.

## What it does

1. Queries local `users` collection for users where:
   - `state = "Active"`
   - `registration_status = "Approved"`
   - `gcm_id` exists and is non-empty
2. Upserts each user into Atlas `recipients` (keyed by `user_id`):
   - Updates the token if it changed
   - Inserts new recipients if they don't exist
3. Deletes any Atlas recipient whose `user_id` is no longer in the active set

## Project structure

```
fcm-sync/
├── main.go       # Entry point, CLI dispatch
├── service.go    # Windows Service handler + install/remove/start/stop
├── sync.go       # Core sync logic (fetch → upsert → delete)
├── config.go     # .env loader + config struct
├── util.go       # File logger, exe path helper
├── go.mod
└── .env.example  # Copy to .env and fill in your values
```

## Install packages

```bash
go mod tidy
```

## Build (cross-compile from Linux/Mac, targeting Windows)

```bash
GOOS=windows GOARCH=amd64 go build -o fcm-sync.exe .
```

Or on Windows:

```powershell
go build -o fcm-sync.exe .
```

## Deployment on Windows Server

### 1. Prepare the directory

```powershell
New-Item -ItemType Directory -Path "C:\fcm-sync" -Force
```

Copy `fcm-sync.exe` and your filled-in `.env` file to `C:\fcm-sync\`.

### 2. Fill in config

```powershell
Copy-Item .env.example C:\fcm-sync\.env
notepad C:\fcm-sync\.env   # fill in your URIs
```

### 3. Install and start the service

Run PowerShell **as Administrator**:

```powershell
cd C:\fcm-sync
.\fcm-sync.exe install
.\fcm-sync.exe start
```

The service is registered as **auto-start with delayed start** — it will come up
automatically after every server reboot, after the network stack is ready.

Recovery actions are also configured: the SCM will restart the service after
60 s, 120 s, and 5 min on consecutive failures, resetting the counter daily.

### 4. Verify

```powershell
Get-Service FCMSyncWorker   # should show Running
Get-Content C:\fcm-sync\fcm-sync.log -Wait   # tail the log
```

### 5. Other management commands

```powershell
.\fcm-sync.exe stop     # graceful stop
.\fcm-sync.exe remove   # uninstall the service
.\fcm-sync.exe run      # run in foreground (for testing, reads .env from CWD)
```

## Two things to update in sync.go

Before building, update the two database names to match your actual DB names:

```go
// sync.go  ~line 57
localUsers := localClient.Database("your_local_db").Collection("users")
atlasRecipients := atlasClient.Database("your_atlas_db").Collection("recipients")
```

## Notes

- Logs rotate on each service start (append mode, never truncated). Rotate manually
  or add a scheduled task to archive old logs if needed.
- The `.env` file is read from the same directory as the executable. If you move
  the binary, move the `.env` alongside it.
- `SYNC_INTERVAL_MINUTES` defaults to 30 if not set.
