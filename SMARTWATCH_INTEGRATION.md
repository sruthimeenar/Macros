# Real smartwatch/device integration — how it works here

Macros now includes a real backend (`/backend`) that handles Fitbit and Google Fit OAuth and syncing — this doc explains how it's built and what you need to do to turn it on. A **manual activity log** is still available on the My Plan page as a fallback for anyone who hasn't set up the backend.

## Why it needs a backend
Every major fitness API (Fitbit, Google Fit) uses OAuth 2.0. The client secret used to exchange an authorization code for an access token must never be exposed in frontend JavaScript — anyone could read it from the page source and impersonate your app. That means this site would need a real server component, which it doesn't have today (it's 100% static HTML/CSS/JS hosted from GitHub).

## Per-platform notes
- **Fitbit**: Register an app at dev.fitbit.com, get a client ID/secret, implement the OAuth 2.0 Authorization Code flow, then call the Fitbit Web API (steps, heart rate, sleep) with the user's access token. Tokens expire and need refreshing.
- **Google Fit**: Create a project in Google Cloud Console, enable the Fitness API, configure an OAuth consent screen, and implement the same Authorization Code flow. Google Fit is also in the process of being wound down in favor of Health Connect on Android, so check current API status before building against it.
- **Apple Health**: There is no public web API. HealthKit data is only accessible from a native iOS app, so this path isn't available for a website at all — you'd need a companion iOS app to bridge the data elsewhere.

## Minimum architecture for real sync
1. A backend server (Node/Express, Python/FastAPI, etc.) to hold client secrets and handle the OAuth token exchange and refresh.
2. A database to store, per user, the provider, access token, refresh token, and expiry.
3. HTTPS hosting with a stable domain, since OAuth redirect URLs must be pre-registered with each provider and can't be `localhost` or `file://`.
4. Scheduled or on-demand jobs to pull new activity data and reconcile it with what's shown on the plan page.
5. A privacy policy and consent flow, since you'd be handling real health data from a third party.

## What's built
The backend in `/backend` implements the architecture above for Fitbit and Google Fit:
- `/auth/:provider/connect` and `/auth/:provider/callback` run the OAuth 2.0 Authorization Code flow, with a signed `state` parameter so callbacks can't be forged.
- Tokens are stored server-side in Postgres (see `backend/src/db.js`) and refreshed automatically when expired.
- `/api/activity/today` fetches steps, heart rate, and active calories from whichever provider is connected (plus sleep for Fitbit; Google Fit's sleep needs its separate Sessions API and isn't wired up yet).
- The frontend (`plan.html` / `script.js`) has "Connect Fitbit" / "Connect Google Fit" buttons that redirect into this flow, and a "Sync now" button that calls `/api/activity/today` and writes the result into the same `activityLog` structure the manual log uses — so the rest of the page doesn't need to know whether a number came from a device or was typed in.

## To turn it on
1. Follow `backend/README.md` to install dependencies, get Fitbit/Google API credentials, and fill in `.env`.
2. Run the backend (`npm start` inside `/backend`).
3. Set `API_BASE_URL` near the top of `script.js` to wherever that backend is reachable.
4. `localhost` only works while you're testing on your own machine — deploy the backend somewhere with a public HTTPS URL (Render, Fly.io, Railway, etc.) for it to work for anyone else, and update the redirect URIs registered with Fitbit/Google to match.

## Still true
Apple Health has no public web API — HealthKit data is only accessible from a native iOS app, so it isn't supported here regardless of backend work.
