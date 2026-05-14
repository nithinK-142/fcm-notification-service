# FCM Sync Worker

A Windows service that syncs active user FCM tokens from a local MongoDB instance to an Atlas MongoDB `recipients` collection on a configurable interval (default 30 minutes).

## What it does

1. Queries local `users` collection for users where:
   - `state = "Active"`
   - `registration_status = "Approved"`
   - `gcm_id` exists and is non-empty
2. Upserts each user into Atlas `recipients` (keyed by `user_id`):
   - Updates the token if it changed
   - Inserts new recipients if they don't exist
3. Deletes any Atlas recipient whose `user_id` is no longer in the active set
4. All writes use batched `BulkWrite` with concurrent workers — no single round-trip per document

## Project structure

```
fcm-sync/
├── main.go       # Entry point, CLI dispatch
├── service.go    # Windows Service handler + install/remove/start/stop
├── sync.go       # Core sync logic (fetch → upsert → delete)
├── config.go     # .env loader + Config struct
├── util.go       # File logger, exe path helper
├── go.mod
└── .env.example  # Copy to .env and fill in your values
```

---

## Prerequisites

- [Go 1.21+](https://go.dev/dl/) installed on the machine you build on
- Network access from the Windows server to both MongoDB instances
- PowerShell running as Administrator for service commands

---

## Local development (foreground mode)

Use this to test without installing a Windows service.

### 1. Install dependencies

```bash
go mod tidy
```

### 2. Set up config

```bash
cp .env.example .env
# Edit .env and fill in your MongoDB URIs and DB names
```

### 3. Run in foreground

```bash
go run . run
```

This runs the sync loop in your terminal — first sync fires immediately, then repeats on the configured interval. `Ctrl+C` to stop. Logs go to stdout in this mode.

---

## Deployment on Windows Server
Open PowerShell as Administrator and navigate to the project folder:

### 1. Build

Run in PowerShell as Administrator:

```powershell
go build -o build\fcm-sync.exe .
```

### 2. Set up config

```powershell
Copy-Item .env build\.env
```

### 3. Install the service

```powershell
cd build
.\fcm-sync.exe install
```

This registers `FCMSyncWorker` with the Windows Service Control Manager as:
- **Auto-start with delayed start** — starts automatically on every boot, after the network stack is ready
- **Recovery actions** — SCM will restart the service after 60 s, 120 s, and 5 min on consecutive failures

### 4. Start the service

```powershell
.\fcm-sync.exe start
```

### 5. Verify it is running

```powershell
Get-Service FCMSyncWorker
```

Tail the log file:

```powershell
Get-Content .\fcm-sync.log -Wait
```

---

## Service Removal

### Stop the service
```powershell
.\fcm-sync.exe stop
```

### Remove the service from SCM
```powershell
.\fcm-sync.exe remove
```

### Delete all generated files
```powershell
Remove-Item .\fcm-sync.log -Force -ErrorAction SilentlyContinue
Remove-Item .\checkpoint.json -Force -ErrorAction SilentlyContinue
Remove-Item .\fcm-sync.exe -Force
Remove-Item .\.env -Force
```

## Service management

All commands must be run from the directory containing `fcm-sync.exe`, in PowerShell as Administrator.

| Command | Effect |
|---|---|
| `.\fcm-sync.exe install` | Register service with SCM (run once) |
| `.\fcm-sync.exe start` | Start the service |
| `.\fcm-sync.exe stop` | Gracefully stop the service |
| `.\fcm-sync.exe remove` | Uninstall the service |
| `.\fcm-sync.exe run` | Run in foreground without SCM (dev/debug) |

---

## Configuration reference

All config is via `.env` (or environment variables — env vars take precedence over `.env`).

| Variable | Required | Default | Description |
|---|---|---|---|
| `LOCAL_MONGO_URI` | yes | — | Connection string for local MongoDB |
| `LOCAL_DATABASE` | yes | — | Database name on local MongoDB |
| `LOCAL_COLLECTION` | no | `users` | Collection name on local MongoDB |
| `ATLAS_MONGO_URI` | yes | — | Connection string for Atlas MongoDB |
| `ATLAS_DATABASE` | yes | — | Database name on Atlas |
| `ATLAS_COLLECTION` | no | `recipients` | Collection name on Atlas |
| `SYNC_INTERVAL_MINUTES` | no | `30` | How often to run the sync |
| `BATCH_SIZE` | no | `500` | Ops per BulkWrite / DeleteMany batch |
| `WORKER_COUNT` | no | `4` | Concurrent goroutines writing to Atlas |
| `LOG_FILE_PATH` | no | `C:\fcm-sync\fcm-sync.log` | Where to write logs when running as a service |

> **Tuning tip:** If Atlas starts returning rate limit errors, lower `WORKER_COUNT`. If syncs are completing well within the interval and you want faster throughput, raise `BATCH_SIZE` first before touching `WORKER_COUNT`.

---

## Notes

- Logs are opened in append mode — they survive service restarts and accumulate over time. Archive or truncate manually if needed, or set up a scheduled task to rotate them.
- Running `.\fcm-sync.exe run` in foreground mode logs to stdout, not the log file.