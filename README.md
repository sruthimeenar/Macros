# Macros

A personal training website that turns a few details about you — goal, training level, equipment, and diet — into a full workout and meal plan, then helps you track streaks, check-ins, and daily activity.

## Pages
- `index.html` — Landing page: a short summary of what Macros does, with a "Get started" link into the login page.
- `login.html` — Log in / sign up. Backed by the server in `/backend`: accounts, passwords (salted + hashed), plans, and progress all live in a real database, not just this browser.
- `plan-form.html` — "Make a plan": the intake form (age, weight, height, goal, training level, equipment, diet, wake/sleep times). Requires being logged in.
- `plan.html` — "My plan": your generated weekly workouts, weekly meals, progress tracking, and a smartwatch activity log. Requires being logged in.

## How personalization works
- **Calorie & macro targets** are calculated per user with a Mifflin-St Jeor style BMR estimate, adjusted for training level (activity multiplier) and goal (a calorie surplus for muscle gain, a deficit for weight loss), with protein set relative to body weight.
- **Workouts** are selected and worded based on goal (rep ranges, session split) and swap specific exercises based on available equipment (bodyweight / dumbbells / full gym), with volume and rest scaled by training level.
- **Meals** are selected based on goal and swapped entirely for vegetarian/vegan diets, with nutrition figures pulled from your calculated targets.

## Accounts & data
Everything — accounts, plans, progress check-ins, and activity logs — is stored server-side in Postgres by the backend in `/backend`, not in browser `localStorage`. The browser only holds a session token (like being logged into any normal website), so your data is there whenever you log back in, from any device. See `backend/README.md` for setup, including a free-hosting path (Render + Neon).

## Smartwatch tracking
The plan page can sync real activity from Fitbit and Google Fit, backed by the server in `/backend` (client secrets can't live in frontend code, so a real OAuth flow needs a backend — see `SMARTWATCH_INTEGRATION.md` for why). A manual log is still there as a fallback under "Log activity manually instead" for anyone who hasn't set up the backend, or whose device isn't supported. To turn on real syncing:
1. Set up and run the backend — see `backend/README.md`.
2. In `script.js`, set `API_BASE_URL` to wherever that backend is reachable.
3. Use the "Connect Fitbit" / "Connect Google Fit" buttons on the My Plan page.

## Running locally
This site now needs the backend running to do anything past the landing page — signup, login, plans, and progress all go through it. Set up `/backend` first (see `backend/README.md`), then serve this folder with any static file server (opening `index.html` directly via `file://` won't work correctly with the API calls). For example: `python3 -m http.server 5500`.
