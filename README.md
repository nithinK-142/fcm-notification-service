# B2R Push Notification Platform — System Documentation

## Overview

A four-component platform that manages and delivers push notifications to registered B2B buyers (retailers) based on product availability and priority.

---

## System Components

### 1. `client` — React Admin Console
**Stack:** React 18, Vite, Tailwind CSS, shadcn/ui, Xior (HTTP client)

The web-based admin interface. Desktop-only (enforced via `useDesktopOnly` hook). Protected behind JWT authentication.

**Pages:**
- `/login` — JWT auth via `POST /api/auth/login`
- `/` — Dashboard with live stats (products, notifications, recipients)
- `/products` — Browse active products, compose and queue notifications
- `/notifications` — Monitor, edit, send, and delete notifications

**Key patterns:**
- `AuthContext` — decodes JWT via `jwt-decode`, stores in `localStorage`, attaches as `Bearer` token on every request
- `ThemeContext` — light/dark mode, drives `AppToaster` and `ConfirmToast` styling
- `ProtectedRoute` — redirects to `/login` if no valid token
- All API calls via `src/lib/api.js` (Xior instance); 401 responses auto-redirect to login

---

### 2. `server` — Express API
**Stack:** Node.js, Express, Mongoose, JWT (`jsonwebtoken`)

The central API. Connects to **two MongoDB instances** simultaneously:
- `LOCAL_DB` — on-premise MongoDB (products, team members, categories, price logs)
- `ATLAS_DB` — MongoDB Atlas (notifications, recipients)

**Startup sequence:**
1. `connectDBs()` — establishes both connections in parallel
2. `initModels()` — registers all Mongoose models against their respective connections
3. Routes are loaded **after** models are ready (avoids `getModels()` being called before init)

**Routes:**

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticate team member, return JWT (7d expiry) |
| `POST` | `/api/worker/check-and-create-body` | Public | Called by linux-worker to validate product status and generate notification body |
| `GET` | `/api/dashboard/stats` | JWT | Aggregated stats + 5 most recent notifications and products |
| `POST` | `/api/products` | JWT | Paginated product list with category lookup |
| `GET` | `/api/notifications` | JWT | Paginated notifications with search and status filter |
| `POST` | `/api/notifications` | JWT | Create one or more notifications (deduped by product ID) |
| `PATCH` | `/api/notifications/:id` | JWT | Edit body of a pending notification |
| `DELETE` | `/api/notifications/:id` | JWT | Delete (blocked if locked/processing) |
| `POST` | `/api/notifications/:id/send` | JWT | Mark as execute_now=true, priority_rank=0 (blocked if another is already queued) |

**Authentication:**
- `POST /api/auth/login` queries `TeamMember` by `{department: "CMT", user_hierarachy: "Checker", email, password}`
- JWT payload: `{ id, email, name, role, profile }`
- `authenticate` middleware validates Bearer token on all protected routes

---

### 3. `linux-worker` — Notification Processor
**Stack:** Node.js, node-cron, Firebase Admin SDK, Mongoose, Xior

Runs on a Linux server. Picks up pending notifications and sends them via Firebase Cloud Messaging (FCM).

**Startup:**
1. Connects to Atlas MongoDB (`MONGO_URI` / `DB_NAME`)
2. Initialises Firebase from `config/firebase.json` service account
3. Schedules `processNotification()` via cron: `*/1 * * * *` (every minute)

**Processing loop (`processNotification`):**

```
1. findOneAndUpdate({ status: "pending" }) → { status: "locked" }
   Sort: priority_rank ASC, created_at ASC
   (priority_rank 0 = execute_now, 1 = high, 2 = normal, 3 = low)

2. POST /api/worker/check-and-create-body
   → validates product: active? in stock?
   → generates body if empty: "Now LIVE ₹{price}[! New Arrival | Back in Stock | Flash Deal | Exclusive Deal]"
   → if not available: set status = not_found | no_stock | deactive

3. getTokens(notification)
   → query Atlas recipients by registration_category
   → filter by state if notification.product.state ≠ ["All"]

4. No tokens → status = "done", total_recipients = 0

5. chunk(tokens, 200) → batches
   Set status = "processing", total_recipients, batch_count, started_at

6. For each batch:
   → sendMulticastNotification() via FCM sendEachForMulticast
   → 3 retries on network errors (ECONNRESET, ETIMEDOUT, GOAWAY, etc.)
   → 60s timeout per attempt
   → resetFirebase() on GOAWAY/ping_timeout (HTTP/2 session recovery)
   → Update: sent_count, failed_count, current_batch, push batch stats

7. Final update: status = "done", duration_ms, completed_at
```

**FCM message structure:**
- `notification`: title (product name), body, image
- `data`: title, body, image, moreTitle (link), sku_uic
- `android`: custom icon `ic_stat_notify`
- `apns`: priority 10, sound default, category GENERAL

---

### 4. `windows-worker` — FCM Token Sync
**Stack:** Go 1.21+, MongoDB Go Driver, Windows Service Control Manager

Runs as a Windows Service on the on-premise server. Syncs active user FCM tokens (`gcm_id`) from local MongoDB into Atlas `recipients` collection.

**Startup:**
- Reads config from `.env` next to the binary (exe-relative path, fixes SCM `System32` cwd issue)
- Registered with SCM as auto-start with delayed start + recovery actions
- Skips initial sync on boot if last checkpoint is within 90% of the interval

**Sync cycle (default: 30 min):**

```
1. loadCheckpoint() → since (zero = full sync)

2. fetchUsers(since)
   Filter: gcm_id exists, state="Active", registration_status="Approved"
   Incremental: + updatedAt > since
   Projects: _id, gcm_id, updatedAt, category[0], business_billing_address_state

3. Deduplicate by gcm_id → keep latest updatedAt
   (handles recycled device tokens shared across two user accounts)

4. Upsert phase (batched BulkWrite, parallel workers)
   Filter: fcm_token = gcm_id
   $set: user_id, fcm_token, state, registration_category, updated_at
   $setOnInsert: created_at
   Batch size: configurable (default 500)
   Workers: configurable (default 4)

5. Delete phase — FULL SYNC ONLY
   Stream Atlas recipients cursor → diff against active token set
   Batched DeleteMany for stale tokens

6. saveCheckpoint(start) if errs == 0
```

**Checkpoint:** `checkpoint.json` next to binary. Written atomically (tmp → rename). Dev mode (`go run`) writes to CWD instead of temp dir.

---

## Data Flow

```
User (retailer) app ──installs──► Local MongoDB (users.gcm_id)
                                        │
                            windows-worker (every 30min)
                                        │ incremental sync
                                        ▼
                               Atlas MongoDB (recipients)
                                        │
Admin console ──creates──► Atlas MongoDB (notifications)
                                        │
                            linux-worker (every 1min)
                                        │ pick by priority_rank
                                        ▼
                                  FCM (Firebase)
                                        │
                                        ▼
                              User devices (push notification)
```

---

## MongoDB Collections

| Collection | DB | Description |
|---|---|---|
| `users` | Local | Buyer accounts with `gcm_id` (FCM token) |
| `productscmts` | Local | Product catalog (CMT approved) |
| `categories` | Local | Registration / main / sub categories |
| `productpricelogs` | Local | Price and stock change history |
| `teammembers` | Local | Admin/checker accounts |
| `notifications` | Atlas | Notification queue and results |
| `recipients` | Atlas | Synced FCM tokens with state and category |

---

## Notification Lifecycle

```
pending → locked → processing → done
                             └→ not_found
                             └→ no_stock
                             └→ deactive
                             └→ server_error
```

| Status | Description |
|---|---|
| `pending` | Queued, waiting to be picked |
| `locked` | Atomically claimed by linux-worker |
| `processing` | FCM batches in progress |
| `done` | All batches sent (sent_count may be 0 if no recipients) |
| `not_found` | Product not found in DB |
| `no_stock` | `avl_stock <= 0` at send time |
| `deactive` | `product_status = "Deactive"` at send time |
| `server_error` | Unhandled error during processing |

---

## Priority System

| `priority_rank` | Meaning | Set when |
|---|---|---|
| `0` | Execute now | Admin clicks "Send Now" (`POST /:id/send`) |
| `1` | High | Created with `priority: "high"` |
| `2` | Normal | Default |
| `3` | Low | Created with `priority: "low"` |

Worker sorts: `priority_rank ASC, created_at ASC` — execute_now always goes first, then oldest-first within each priority tier.

Only one `execute_now` notification can be pending at a time (enforced in the send route).

---

## Environment Variables

### server
```
PORT, ALLOWED_URLS
MONGO_URI_LOCAL, DB_NAME_LOCAL, LOCAL_DB_LABEL
MONGO_URI_ATLAS, DB_NAME_ATLAS, ATLAS_DB_LABEL
JWT_SECRET
```

### linux-worker
```
MONGO_URI, DB_NAME
SERVER_URL  (for /api/worker/check-and-create-body)
```
Plus `config/firebase.json` (Firebase service account)

### windows-worker
```
LOCAL_MONGO_URI, LOCAL_DATABASE, LOCAL_COLLECTION (default: users)
ATLAS_MONGO_URI, ATLAS_DATABASE, ATLAS_COLLECTION (default: recipients)
SYNC_INTERVAL_MINUTES (default: 30)
BATCH_SIZE (default: 500)
WORKER_COUNT (default: 4)
LOG_FILE_PATH (default: C:\fcm-sync\fcm-sync.log)
APP_ENV (dev|prod — prod writes to log file)
```

### client
```
VITE_API_URL  (Express server base URL)
```

---

## Security Notes

- JWT expiry: 7 days
- CORS restricted to `ALLOWED_URLS` env var (comma-separated)
