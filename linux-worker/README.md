# Linux Worker — Notification Processor

A Node.js service that runs on a Linux server. It picks pending notifications from the queue every minute and sends them to eligible buyers via Firebase Cloud Messaging (FCM).

## What it does

Every minute (7 AM – 10 PM):
1. Atomically claims the next pending notification (sorted by priority, then age)
2. Calls the API server to validate the product and generate a notification body if one wasn't provided
3. Fetches matching FCM tokens from Atlas (filtered by state and registration category), with a 30-minute in-memory cache
4. Sends to buyers in batches of 200 via Firebase `sendEachForMulticast`
5. Retries each batch up to 3 times on network errors (ECONNRESET, ETIMEDOUT, HTTP/2 GOAWAY, etc.)
6. Records sent count, failed count, and per-batch stats on the notification document

At 2 AM daily: purges old records from the local SQLite database of failed tokens.

On startup: recovers any notifications stuck in `locked` or `processing` state (resets them to `pending`).

## Project structure

```
linux-worker/
├── index.js                          # Entry point — DB connect, Firebase init, cron schedule, recovery
├── ecosystem.config.js               # PM2 config
├── config/
│   ├── firebase.json                 # Firebase service account 
│   └── multicast-notification.js     # FCM sendEachForMulticast wrapper with retry + HTTP/2 recovery
├── models/
│   ├── notification.model.js         # Mongoose Notification schema
│   └── recipient.model.js            # Mongoose Recipient schema
├── util/
│   ├── worker.js                     # processNotification(), getTokens(), checkAndCreateBody()
│   └── helper.js                     # logWithTimestamp(), chunk(), createWorkerSignature()
├── db/
│   ├── db.js                         # MongoDB connect
│   └── failed-tokens-db.js           # SQLite (better-sqlite3) for failed FCM tokens
└── .env
```

---

## Prerequisites

- Node.js 18+
- A Firebase project with a service account key (`config/firebase.json`)
- Network access to Atlas MongoDB and the API server

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env
```

Required env vars:

| Variable | Description |
|---|---|
| `MONGO_URI` | Atlas MongoDB connection string |
| `DB_NAME` | Atlas database name |
| `SERVER_URL` | Base URL of the Express API server (e.g. `http://localhost:3000/api`) |
| `SERVER_SECRET` | Shared HMAC secret for signing `/api/worker/*` requests |
| `CONCURRENT_BATCHES` | (optional, default `3`) FCM batches to send in parallel |

### 3. Add Firebase service account

Place your Firebase service account JSON at `config/firebase.json`. Download it from the Firebase console → Project settings → Service accounts.

---

## Running

### Development

```bash
npm run dev
# or
node --watch index.js
```

### Production (PM2)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # follow the printed command to enable auto-start on boot
```

---

## Cron schedule

| Schedule | Task |
|---|---|
| Every minute, 7 AM – 10 PM | `processNotification()` — pick and send one pending notification |
| 2 AM daily | `purgeOldRecords()` — clean up old failed-token records from SQLite |

The `processNotification` cron is guarded by an `isRunning` flag — if a previous tick is still in progress (e.g. a large batch is mid-send), the new tick is skipped rather than queued.

---

## Notification processing flow

```
1. findOneAndUpdate({ status: "pending" }) → { status: "locked" }
   Sort: priority_rank ASC, created_at ASC
   (0 = execute_now, 1 = high, 2 = normal, 3 = low)

2. POST /api/worker/check-and-create-body  [HMAC signed]
   → validates product: active? in stock?
   → generates body if empty:
       "Now LIVE ₹{price}[! New Arrival | Back in Stock | Flash Deal | Exclusive Deal]"
   → if unavailable: status = not_found | no_stock | deactive → stop

3. getTokens(notification)
   → query Atlas recipients by registration_category
   → filter by state if product.state ≠ ["All"]
   → cached in memory for 30 minutes per query

4. No tokens → status = "done", total_recipients = 0 → stop

5. chunk(tokens, 200) → batches
   status = "processing", total_recipients, batch_count, started_at

6. For each batch (up to CONCURRENT_BATCHES in parallel):
   → sendEachForMulticast via Firebase Admin SDK
   → 3 retries on network errors, 60 s timeout per attempt
   → resetFirebase() on HTTP/2 GOAWAY / ping_timeout
   → Update: sent_count, failed_count, current_batch, batch stats
   → Failed tokens stored in local SQLite (failed_tokens.db)

7. status = "done", duration_ms, completed_at
```

---

## Notification statuses

| Status | Meaning |
|---|---|
| `pending` | In queue, not yet picked |
| `locked` | Atomically claimed, pre-flight checks in progress |
| `processing` | FCM batches actively being sent |
| `done` | All batches sent (sent_count may be 0) |
| `not_found` | Product not found in DB |
| `no_stock` | `avl_stock <= 0` at send time |
| `deactive` | `product_status = "Deactive"` at send time |
| `server_error` | Unhandled error during processing |

---

## Worker request signing

Calls to `/api/worker/check-and-create-body` are HMAC-signed using `SERVER_SECRET`:

```
x-timestamp: <unix ms>
x-signature: HMAC-SHA256(JSON.stringify(payload) + timestamp, SERVER_SECRET)
```

The server rejects requests with a timestamp older than 5 minutes.