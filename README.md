# Macros device-sync backend

A small Express server that handles the OAuth 2.0 flow for Fitbit and Google Fit and exposes a simple API for the static Macros frontend to pull today's activity from. Client secrets live here, server-side, and are never sent to the browser.

## What it does
- `GET /auth/:provider/connect?email=...` — redirects the user to Fitbit/Google to approve access.
- `GET /auth/:provider/callback` — the provider redirects back here; exchanges the code for tokens and stores them (keyed by the user's email) in `data/tokens.json`.
- `GET /auth/status?email=...` — which providers this user has connected.
- `DELETE /auth/:provider?email=...` — disconnect/forget a provider.
- `GET /api/activity/today?email=...` — fetches today's steps, heart rate, active calories, and (Fitbit only) sleep from whichever provider is connected, refreshing the access token first if it's expired.

## Setup
1. `npm install`
2. `cp .env.example .env` and fill it in:
   - `SERVER_SECRET`: any random string. Generate one with:
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - `FRONTEND_ORIGIN`: the URL your Macros site is served from (e.g. `http://localhost:5500` if you use VS Code's Live Server, or your GitHub Pages URL).
   - **Fitbit**: register an app at https://dev.fitbit.com/apps/new (OAuth 2.0 Application Type: **Server**). Set its Redirect URL to match `FITBIT_REDIRECT_URI`.
   - **Google Fit**: create a project at https://console.cloud.google.com, enable the "Fitness API", configure the OAuth consent screen, then create an OAuth Client ID (type: Web application) and add `GOOGLE_FIT_REDIRECT_URI` to its authorized redirect URIs.
3. `npm start` — runs on `http://localhost:4000` by default.

## Connecting it to the frontend
In `script.js`, set `DEVICE_BACKEND_URL` (near the top of the file) to wherever this server is reachable — `http://localhost:4000` for local development, or your deployed backend's URL in production. The "Connect Fitbit" / "Connect Google Fit" buttons on the My Plan page will then work.

## Deploying for real use
`localhost` only works while you're developing on your own machine — for the buttons to work for anyone else, this needs to run somewhere with a public HTTPS URL (Render, Fly.io, Railway, a VPS, etc.), and the OAuth redirect URIs registered with Fitbit/Google need to point at that public URL instead of localhost.

## Storage
Tokens are stored in `data/tokens.json`, a plain JSON file — fine for a personal project, but swap in a real database (Postgres, SQLite, etc.) before this handles more than a handful of users, since concurrent writes to a single JSON file aren't safe at scale.

## Known limitation
Google Fit sleep data requires the separate Sessions API and isn't wired up yet (`sleep` comes back `null` for Google Fit); Fitbit sleep works. Apple Health has no web API at all, so it isn't supported here — see `../SMARTWATCH_INTEGRATION.md`.
