# Real smartwatch/device integration — how it works here

Macros includes a real backend (`/backend`) that handles Google Health API OAuth and syncing. A **manual activity log** is still available on the My Plan page as a fallback for anyone who hasn't set up the backend.

## Why Google Health API
This started out targeting the legacy Fitbit Web API and the old Google Fit REST API separately. Both have since been merged into one unified **Google Health API** by Google, and the legacy Fitbit Web API is being shut down entirely in September 2026 — so building against it now would only work for a few weeks. Google Health API covers both Fitbit devices (once a user migrates their Fitbit login to a Google Account) and Pixel Watch / Wear OS devices through a single OAuth flow.

Because this API was very new (pre-GA, still evolving) at the time this was built, treat `backend/src/providers/googleHealth.js` as a best-current-understanding implementation, not a guarantee — if something doesn't match reality once tested against a real account, check the current docs:
- https://developers.google.com/health/data-types
- https://developers.google.com/health/endpoints
- https://developers.google.com/health/release-notes (things have been changing roughly monthly)

## What's built
- `/auth/devices/googleHealth/connect` and `/auth/devices/googleHealth/callback` run the OAuth 2.0 Authorization Code flow, with a signed `state` parameter so callbacks can't be forged.
- Tokens are stored server-side in Postgres and refreshed automatically when expired.
- `/api/activity/sync` and the background scheduler fetch steps, calories, resting heart rate, and sleep for the day and write them into the same `activity_log` structure the manual log uses — the frontend doesn't need to know whether a number came from a device or was typed in.
- The frontend (`plan.html` / `script.js`) has a single "Connect" button under Google Health that redirects into this flow, plus "Sync now" for an immediate refresh (though syncing already happens automatically in the background).

## To turn it on
1. Follow `backend/README.md` to install dependencies and get a Google Health API OAuth client.
2. Run the backend (`npm start` inside `/backend`).
3. Set `API_BASE_URL` near the top of `script.js` to wherever that backend is reachable.
4. `localhost` only works while you're testing on your own machine — deploy the backend somewhere with a public HTTPS URL for it to work for anyone else, and update the redirect URI registered with Google Cloud to match.

## Still true
Apple Health has no public web API — HealthKit data is only accessible from a native iOS app, so it isn't supported here regardless of backend work.
