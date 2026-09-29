# 🍽️ Bite & Feast Mug — Backend Server & API

Cloud backend server for **Bite & Feast Mug** self-service food ordering kiosk, tablet customer app, kitchen order display (KOT), and Supabase cloud database.

Designed for seamless deployment on **Vercel Serverless Functions** or as a standalone Node.js Express server.

---

## ⚡ Features

- **Supabase Server Integration (`@supabase/server` & `@supabase/supabase-js`)**:
  - Secure credential handling using Supabase Publishable & Secret keys.
  - Automated connectivity health check.
- **Server Health & Monitoring Route (`/api/ping`)**:
  - Real-time uptime monitoring for UptimeRobot, BetterUptime, Pingdom, and Vercel Cron.
  - Live Supabase connection status & response latency.
- **Customer Food & Beverage Ordering**:
  - Order token generation (e.g. `BFM-101`).
  - Validation & persistence for orders with Dine-In & Takeaway modes.
- **Live Kitchen Order Tickets (KOT)**:
  - Real-time order status tracking: `placed` ➔ `preparing` ➔ `ready` ➔ `completed`.
  - WebSocket support (Socket.io) when running as persistent Node.js server.
- **Store Open / Closed Timings**:
  - Operating Hours: **Morning 8:00 AM – 10:00 PM**.
  - Master toggle endpoint (`/api/store/status`) to pause orders when kitchen is closed.

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ping` or `/ping` | **Server Monitoring Ping**: Returns uptime, timestamp, Supabase connection, & store status |
| `GET` | `/api/health` | Standard health check returning `{ ok: true, uptime: ... }` |
| `GET` | `/api/menu` | Retrieves menu items from Supabase or fallback catalog |
| `GET` | `/api/orders` | Retrieves recent active orders for Kitchen KOT |
| `POST` | `/api/orders` | Submits a new customer food order |
| `PATCH` | `/api/orders/:id/status` | Updates order preparation status (`preparing`, `ready`, `completed`) |
| `GET` | `/api/store/status` | Returns store open/closed state & operating hours (8:00 AM – 10:00 PM) |
| `POST` | `/api/store/status` | Updates store open/closed state (`{ "isOpen": true/false }`) |

---

## 🚀 Monitoring Ping Route (`GET /api/ping`)

Example response from `/api/ping`:

```json
{
  "status": "ok",
  "message": "pong",
  "service": "Bite & Feast Mug API",
  "timestamp": "2026-09-29T17:48:34.697Z",
  "uptimeSeconds": 420,
  "runtime": "Vercel Serverless",
  "environment": "production",
  "supabase": {
    "connected": true,
    "configured": true,
    "url": "https://utabaevwryavresmdnek.supabase.co",
    "latencyMs": 140,
    "hasSecretKey": true,
    "hasPublishableKey": true
  },
  "storeStatus": {
    "isOpen": true,
    "operatingHours": "8:00 AM – 10:00 PM"
  }
}
```

---

## 🔑 Environment Variables (`.env`)

```env
PORT=5000
NODE_ENV=production

# Supabase Credentials
SUPABASE_URL=https://utabaevwryavresmdnek.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_ZOKgw9tNae0zimMCuYUxOQ_Ed1FGRFQ
SUPABASE_SECRET_KEY=sb_secret_your_unmasked_secret_key_here
SUPABASE_JWKS_URL=https://utabaevwryavresmdnek.supabase.co/auth/v1/.well-known/jwks.json

# CORS Allowed Origins (* or specific frontend domain)
CLIENT_ORIGIN=*
```

---

## ☁️ Deploying to Vercel

1. **Push to GitHub**:
   Ensure this repository is pushed to `https://github.com/awielabs/-BITE-FEAST-MUG.git`.

2. **Import into Vercel**:
   - Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
   - Select the `awielabs/-BITE-FEAST-MUG` repository.
   - Framework Preset: **Other**.
   - Root Directory: `./` (or leave default).

3. **Add Environment Variables in Vercel**:
   Add the following in your Vercel Project Settings ➔ **Environment Variables**:
   - `SUPABASE_URL` = `https://utabaevwryavresmdnek.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_ZOKgw9tNae0zimMCuYUxOQ_Ed1FGRFQ`
   - `SUPABASE_SECRET_KEY` = `<your_supabase_secret_key>`
   - `SUPABASE_JWKS_URL` = `https://utabaevwryavresmdnek.supabase.co/auth/v1/.well-known/jwks.json`
   - `CLIENT_ORIGIN` = `*`

4. **Click Deploy**:
   Vercel will build and deploy your API instantly. Your live endpoints will be available at:
   - `https://your-vercel-domain.vercel.app/api/ping`
   - `https://your-vercel-domain.vercel.app/api/health`
   - `https://your-vercel-domain.vercel.app/api/menu`
   - `https://your-vercel-domain.vercel.app/api/orders`
