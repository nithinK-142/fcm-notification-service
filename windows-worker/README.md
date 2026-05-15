# FCM Sync Worker

A Windows service that syncs active user FCM tokens (`gcm_id`) from a local MongoDB instance to the Atlas MongoDB `recipients` collection on a configurable interval (default 30 minutes).

## What it does

1. Queries the local `users` collection for users where:
   - `gcm_id` exists and is non-empty
   - `state = "Active"`
   - `registration_status = "Approved"`
2. Deduplicates by `gcm_id` (keeps the record with the latest `updatedAt` — handles the same token shared across two accounts)
3. Upserts each user into Atlas `recipients` (keyed by `fcm_token`):
   - Updates `state`, `registration_category`, and `updated_at` if the token already exists
   - Inserts the recipient with `created_at` if the token is new
4. On **full sync only**: deletes any Atlas recipient whose token is no longer in the active set
5. All writes use batched `BulkWrite` with concurrent goroutines — no single round-trip per document

Checkpoints are saved after every successful sync. On restart, the service skips the initial sync if the last one was recent enough (within 90% of the configured interval).

## Project structure

```
windows-worker/
├── main.go         # Entry point, CLI dispatch (install/remove/start/stop/run)
├── service.go      # Windows Service Control Manager handler
├── sync.go         # Core sync logic (fetch → deduplicate → upsert → delete)
├── server.go       # Local HTTP server (:9573) — /sync trigger + /health
├── config.go       # .env loader + Config struct
├── checkpoint.go   # checkpoint.json read/write (atomic rename)
├── util.go         # File logger, exe path helper
├── go.mod
└── .env.example    # Copy to .env and fill in your values
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
# Edit .env and fill in your MongoDB URIs, DB names, and SYNC_SECRET
```

### 3. Run in foreground

```bash
go run . run
```

This runs the sync loop in your terminal — first sync fires immediately (unless a recent checkpoint exists), then repeats on the configured interval. `Ctrl+C` to stop. Logs go to stdout in this mode.

---

## Deployment on Windows Server

Open PowerShell as Administrator and navigate to the project folder.

### 1. Build

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
- **Recovery actions** — SCM restarts the service after 60 s, 120 s, and 5 min on consecutive failures

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

## Service removal

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
Remove-Item .\fcm-sync.log    -Force -ErrorAction SilentlyContinue
Remove-Item .\checkpoint.json -Force -ErrorAction SilentlyContinue
Remove-Item .\fcm-sync.exe    -Force
Remove-Item .\.env            -Force
```

---

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

## Local HTTP server

While running (both as a Windows service and in `run` mode), the binary listens on `127.0.0.1:9573` and exposes two endpoints:

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | `GET` | None | Returns `200 OK` if the service is up |
| `/sync` | `POST` | HMAC signature | Deletes the checkpoint and triggers an immediate full sync |

### Triggering a sync remotely

The `/sync` endpoint is called by the Express API server (`POST /api/worker/sync/trigger`) when an admin action requires an immediate token sync. Requests must include:

- `x-timestamp` — current Unix time in milliseconds
- `x-signature` — `HMAC-SHA256(timestamp, SYNC_SECRET)` as a hex string

Requests with a timestamp older than 5 minutes are rejected.

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
| `SYNC_SECRET` | yes | — | Shared secret for HMAC-signed `/sync` trigger requests |
| `SYNC_INTERVAL_MINUTES` | no | `30` | How often to run the sync |
| `BATCH_SIZE` | no | `500` | Ops per BulkWrite / DeleteMany batch |
| `WORKER_COUNT` | no | `4` | Concurrent goroutines writing to Atlas |
| `LOG_FILE_PATH` | no | `<exe dir>\fcm-sync.log` | Where to write logs when `APP_ENV=prod` |
| `APP_ENV` | no | `dev` | Set to `prod` to write logs to `LOG_FILE_PATH` instead of stdout |

> **Tuning tip:** If Atlas returns rate-limit errors, lower `WORKER_COUNT`. If syncs finish well within the interval, raise `BATCH_SIZE` before increasing `WORKER_COUNT`.

---

## Notes

- The checkpoint file (`checkpoint.json`) lives next to the binary. When `go run` is used (dev mode), it is written to the working directory instead, so checkpoints persist across dev restarts.
- Checkpoints are written atomically (tmp file → rename) — a crash mid-write leaves the previous checkpoint intact.
- If a sync cycle has any errors, the checkpoint is **not** advanced; the next cycle retries the same time window.
- Logs are opened in append mode — they survive service restarts. Archive or truncate manually if needed.
- Running `.\fcm-sync.exe run` in foreground mode always logs to stdout, regardless of `APP_ENV`.