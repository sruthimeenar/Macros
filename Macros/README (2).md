# Macros backend

An Express server for the [Macros](../README.md) frontend: real user accounts
and cross-device plan storage, plus the OAuth 2.0 flow for Fitbit and Google
Fit device sync. Client secrets and password hashes live here, server-side,
and are never sent to the browser.

## What it does

**Accounts** (new — this is what makes plans follow you across devices instead
of living only in one browser's `localStorage`):
- `POST /api/auth/signup`, `POST /api/auth/login`: bcrypt-hashed passwords,
  returns a signed session token.
- `GET /api/auth/me`: who am I, given a session token.

**Profile & plan storage** (new, session-protected — send
`Authorization: Bearer <token>`):
- `GET/PUT /api/profile`: intake profile + the currently generated weekly
  workouts/meals.
- `GET/POST /api/workouts/complete`: completed-workout dates, for streaks.
- `GET/POST /api/progress`: weight/waist check-ins.
- `POST /api/activity`, `GET /api/activity/:date`: manual activity log
  (fallback when no device is connected).

**Smartwatch sync** (unchanged from before):
- `GET /auth/:provider/connect?email=...`: redirects the user to Fitbit/Google
  to approve access.
- `GET /auth/:provider/callback`: the provider redirects back here; exchanges
  the code for tokens and stores them (keyed by the user's email) in
  `data/tokens.json`.
- `GET /auth/status?email=...`: which providers this user has connected.
- `DELETE /auth/:provider?email=...`: disconnect/forget a provider.
- `GET /api/activity/today?email=...`: fetches today's steps, heart rate,
  active calories, and (Fitbit only) sleep from whichever provider is
  connected, refreshing the access token first if it's expired.

## Setup
1. `npm install`
2. `cp .env.example .env` and fill it in:
   - `SERVER_SECRET`: any random string. Generate one with:
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
     This now signs both OAuth `state` params **and** login session tokens.
   - `FRONTEND_ORIGIN`: the URL your Macros site is served from (e.g. `http://localhost:5500` if you use VS Code's Live Server, or your GitHub Pages URL).
   - **Fitbit**: register an app at https://dev.fitbit.com/apps/new (OAuth 2.0 Application Type: **Server**). Set its Redirect URL to match `FITBIT_REDIRECT_URI`.
   - **Google Fit**: create a project at https://console.cloud.google.com, enable the "Fitness API", configure the OAuth consent screen, then create an OAuth Client ID (type: Web application) and add `GOOGLE_FIT_REDIRECT_URI` to its authorized redirect URIs.
3. `npm start`: runs on `http://localhost:4000` by default.

## Connecting it to the frontend
In `script.js`, set `BACKEND_URL` (near the top of the file) to wherever this
server is reachable — `http://localhost:4000` for local development, or your
deployed backend's URL in production. Sign-up/log-in, plan saves, and the
"Connect Fitbit" / "Connect Google Fit" buttons on the My Plan page will then
work.

## Deploying for real use
`localhost` only works while you're developing on your own machine. For the
buttons to work for anyone else, this needs to run somewhere with a public
HTTPS URL (Render, Fly.io, Railway, a VPS, etc.), and the OAuth redirect URIs
registered with Fitbit/Google need to point at that public URL instead of
localhost.

## Storage
Everything is stored in flat JSON files under `data/` (gitignored):
`tokens.json` (device tokens), `users.json` (accounts, with bcrypt password
hashes — never plaintext), and `profiles.json` (plan/progress/activity data).
This is fine for a personal project, but swap in a real database (Postgres,
SQLite, etc.) before this handles more than a handful of users, since
concurrent writes to a plain JSON file aren't safe at scale.

## Known limitations
- Google Fit sleep data requires the separate Sessions API and isn't wired up yet (`sleep` comes back `null` for Google Fit); Fitbit sleep works. Apple Health has no web API at all, so it isn't supported here. See `../SMARTWATCH_INTEGRATION.md`.
- The device-sync endpoints (`/auth/...`, `/api/activity/today`) still identify a user by the `email` query param alone, with no session check — this was a deliberate simplification from before accounts existed. Anyone who knows an email can currently query someone else's connection status or read a fake `today` sync. Fine for solo/personal use; worth locking down (require the new session token here too) before sharing this with other people.
