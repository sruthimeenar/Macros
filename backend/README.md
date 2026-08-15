# Macros backend

An Express + Postgres server that stores accounts, plans, and progress, and handles the OAuth 2.0 flow for Fitbit and Google Fit so smartwatch data can sync automatically in the background. Client secrets and passwords live here, server-side — never in the frontend.

## What it does
- `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` — accounts, with salted+hashed passwords and a signed session token.
- `GET/PUT /api/profile`, `GET /api/plan`, `POST /api/plan/regenerate`, `POST /api/plan/complete` — your profile and generated plan, stored server-side.
- `GET/POST /api/progress` — check-in history.
- `GET /api/activity/today`, `POST /api/activity/manual`, `POST /api/activity/sync` — today's activity, either logged by hand or synced from a device.
- `GET /auth/devices/:provider/connect`, `GET /auth/devices/:provider/callback`, `GET /auth/devices/status`, `DELETE /auth/devices/:provider` — the Fitbit/Google Fit OAuth flow.
- `GET/POST /webhooks/fitbit` — optional push-notification receiver for near-real-time updates.
- A background scheduler (`src/scheduler.js`) automatically re-syncs every connected device on an interval, with zero action needed from the user.

## Setup
1. `npm install`
2. `cp .env.example .env` and fill it in:
   - `SERVER_SECRET` and `JWT_SECRET`: two different random strings. Generate each with:
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - `DATABASE_URL`: a Postgres connection string. For a free hosted database with no credit card, create a project at https://neon.tech and copy its connection string (`postgres://user:pass@host/db?sslmode=require`).
   - `FRONTEND_ORIGIN`: the URL your Macros site is served from.
   - **Fitbit** / **Google Fit**: see the comments in `.env.example` for how to register an app with each.
3. `npm start` — runs on `http://localhost:4000` by default. On first run it creates all the tables it needs automatically.

## Connecting it to the frontend
In `script.js`, set `API_BASE_URL` (near the top of the file) to wherever this server is reachable.

## Deploying for free
- **Database**: Neon's free tier (0.5 GB, scales to zero when idle) — see setup step 2 above.
- **Compute**: Render's free Web Service tier works well paired with Neon, since Neon holds your data independently of Render's ephemeral filesystem. The tradeoff: a free Render service sleeps after 15 minutes of inactivity, so the first request after a quiet period takes 30-50 seconds to wake up. Everything after that is normal speed.
- Push this repo to GitHub, create a Render Web Service pointed at the `backend` folder (Build: `npm install`, Start: `npm start`), and add all the `.env` variables under Render's Environment tab (not as a committed `.env` file).
- Update the Fitbit/Google redirect URIs and `FRONTEND_ORIGIN` to match your real URLs once deployed.
- Want no cold starts? Render's paid Starter tier (~$7/mo) keeps the service always-on — everything else about this setup stays the same either way.

## Known limitation
Google Fit sleep data requires the separate Sessions API and isn't wired up yet (`sleep` comes back `null` for Google Fit); Fitbit sleep works. Apple Health has no web API at all, so it isn't supported here — see `../SMARTWATCH_INTEGRATION.md`.
