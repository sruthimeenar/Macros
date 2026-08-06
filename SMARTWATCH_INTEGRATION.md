# Real smartwatch/device integration — what it takes

Macros currently ships a **manual activity log** on the My Plan page (steps, heart rate, active calories, sleep), stored locally per account. That's a practical stand-in, not real device syncing. Here's what actually connecting to devices would require, if you want to build it later.

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

## Suggested path
1. Stand up a small backend (even a single serverless function per provider is enough to start).
2. Start with one provider — Fitbit's API and developer onboarding are the most straightforward — before adding Google Fit.
3. Once tokens are held server-side, replace the manual log form's submit handler with a "Sync now" button that calls your backend instead.

The manual log already in `script.js` (`setupActivityForm` / `renderActivity`, keyed by `activityLog::<user>`) is written so a real sync could write into the same `activityLog` structure — the rendering code wouldn't need to change, only where the numbers come from.
