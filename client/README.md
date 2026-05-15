# Admin Console — React Client

The web-based admin interface for the B2R Push Notification Platform. Desktop-only (mobile and tablet are blocked by a `useDesktopOnly` hook). Protected behind JWT authentication.

## Stack

- **React 18** + **Vite**
- **Tailwind CSS** + **shadcn/ui**
- **Xior** (Axios-compatible HTTP client)
- **jwt-decode** for reading JWT claims on the client

## Project structure

```
client/
├── src/
│   ├── main.jsx
│   ├── App.jsx              # Route definitions, ProtectedRoute wrapper
│   ├── context/
│   │   ├── AuthContext.jsx  # JWT storage, decode, logout, Bearer header injection
│   │   └── ThemeContext.jsx # Light/dark mode, drives AppToaster + ConfirmToast
│   ├── lib/
│   │   └── api.js           # Xior instance — base URL from VITE_API_URL, 401 → redirect to /login
│   └── pages/
│       ├── Login.jsx
│       ├── Dashboard.jsx    # Live stats: product count, notification count, recipient count
│       ├── Products.jsx     # Browse active products, compose and queue notifications
│       └── Notifications.jsx  # Monitor, edit, send-now, and delete notifications
└── .env
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

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the Express API server (e.g. `http://localhost:3000/api`) |

---

## Running

### Development

```bash
npm run dev
```

### Production build

```bash
npm run build
```

---

## Key patterns

**Authentication**
- JWT is stored in `localStorage` and decoded by `jwt-decode` on load
- `AuthContext` attaches the token as an `Authorization: Bearer` header on every Xior request
- `ProtectedRoute` redirects to `/login` if no valid token is found
- Any `401` response from the API auto-redirects to `/login`

**Theme**
- `ThemeContext` provides light/dark mode toggling
- The active theme drives `AppToaster` and `ConfirmToast` styling

**API calls**
- All requests go through the shared Xior instance in `src/lib/api.js`
- The base URL is set from `VITE_API_URL` at build time

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/login` | Login | Authenticates via `POST /api/auth/login`, stores JWT |
| `/` | Dashboard | Shows live counts and the 5 most recent notifications and products |
| `/products` | Products | Paginated product list; select one or more to compose and queue notifications |
| `/notifications` | Notifications | Paginated notification list with status filter and search; supports edit, send-now, and delete |
