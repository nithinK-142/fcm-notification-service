# Express API Server

The central API for the B2R Push Notification Platform. Connects to two MongoDB instances simultaneously and serves the admin console, the Linux worker, and the Windows worker sync trigger.

## Stack

- **Node.js** with **Express 5**
- **Mongoose 9** (two separate connections — Local + Atlas)
- **jsonwebtoken** for JWT auth (7-day expiry)

## Project structure

```
server/
├── index.js           # App entry — connectDBs(), initModels(), route mounting
├── routes/
│   ├── auth.js        # POST /api/auth/login
│   ├── worker.js      # POST /api/worker/check-and-create-body, POST /api/worker/sync/trigger
│   ├── products.js    # POST /api/products (paginated)
│   ├── notifications.js  # CRUD + send-now for notifications
│   ├── recipients.js  # GET /api/recipients (paginated)
│   └── dashboard.js   # GET /api/dashboard/stats
├── middleware/
│   └── authenticate.js  # JWT Bearer middleware
└── .env.example
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Required env vars:

| Variable | Description |
|---|---|
| `PORT` | Port to listen on (default `3000`) |
| `ALLOWED_URLS` | Comma-separated CORS origins (e.g. `http://localhost:5173`) |
| `MONGO_URI_LOCAL` | Connection string for on-premise MongoDB |
| `DB_NAME_LOCAL` | Database name on local MongoDB |
| `LOCAL_DB_LABEL` | Label used in logs (e.g. `LOCAL`) |
| `MONGO_URI_ATLAS` | Connection string for Atlas MongoDB |
| `DB_NAME_ATLAS` | Database name on Atlas |
| `ATLAS_DB_LABEL` | Label used in logs (e.g. `ATLAS`) |
| `JWT_SECRET` | Secret for signing JWTs |
| `GO_SYNC_URL` | URL of the Go Windows worker's `/sync` endpoint (e.g. `http://<host>:9573/sync`) |
| `GO_SYNC_SECRET` | Shared HMAC secret for signing sync trigger requests to the Go worker |
| `SERVER_SECRET` | Shared HMAC secret for verifying signed requests from the Linux worker |

### 3. Generate secrets

```bash
npm run gen-secrets
# Prints random hex values for GO_SYNC_SECRET and SERVER_SECRET
```

---

## Running

### Development

```bash
npm run dev
# node --watch index.js
```

### Production

```bash
npm start
```

---

## Startup sequence

The server must establish both DB connections and register all Mongoose models **before** mounting routes. This prevents `getModels()` being called before initialization:

```
1. connectDBs()  — connects LOCAL_DB and ATLAS_DB in parallel
2. initModels()  — registers all Mongoose models against the correct connection
3. app.listen()  — routes are mounted after models are ready
```

---

## API reference

### Public routes (no auth)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate a CMT Checker, return a 7-day JWT |
| `POST` | `/api/worker/check-and-create-body` | Called by Linux worker — validate product status and generate notification body |
| `POST` | `/api/worker/sync/trigger` | Called by admin console — trigger an immediate full sync on the Go Windows worker |

### Protected routes (JWT Bearer)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dashboard/stats` | Aggregated stats + 5 most recent notifications and products |
| `POST` | `/api/products` | Paginated product list with category lookup |
| `GET` | `/api/notifications` | Paginated notifications with search and status filter |
| `POST` | `/api/notifications` | Create one or more notifications (deduped by product ID) |
| `PATCH` | `/api/notifications/:id` | Edit body/priority of a pending notification |
| `DELETE` | `/api/notifications/:id` | Delete a notification (blocked if locked/processing) |
| `POST` | `/api/notifications/:id/send` | Mark as execute_now (priority_rank = 0); blocked if another is already queued |
| `GET` | `/api/recipients` | Paginated recipients list |

---

## Authentication

- `POST /api/auth/login` queries `TeamMember` by `{ department: "CMT", user_hierarachy: "Checker", email, password }`
- JWT payload: `{ id, email, name, role, profile }`
- `authenticate` middleware validates the `Authorization: Bearer <token>` header on all protected routes

---

## Worker request verification

Requests from the Linux worker to `/api/worker/check-and-create-body` are HMAC-signed. The server verifies:
- `x-timestamp` header — current Unix time in milliseconds; rejects if older than 5 minutes
- `x-signature` header — `HMAC-SHA256(JSON.stringify(payload) + timestamp, SERVER_SECRET)`

The sync trigger to the Go Windows worker (`POST /api/worker/sync/trigger`) signs outgoing requests the same way using `GO_SYNC_SECRET`.

---

## MongoDB collections

| Collection | DB | Description |
|---|---|---|
| `users` | Local | Buyer accounts with `gcm_id` (FCM token) |
| `productscmts` | Local | Product catalog (CMT approved) |
| `categories` | Local | Registration / main / sub categories |
| `productpricelogs` | Local | Price and stock change history |
| `teammembers` | Local | Admin/checker accounts |
| `notifications` | Atlas | Notification queue and delivery results |
| `recipients` | Atlas | Synced FCM tokens with state and category |

---

## Security notes

- CORS is restricted to `ALLOWED_URLS` (comma-separated list)
- JWT expiry: 7 days