# Macros

A personal training website that turns a few details about you such as goal, training level, equipment, and diet into a full workout and meal plan, then helps you track streaks, check-ins, and daily activity.

## Pages
- `index.html`: Landing page: a short summary of what Macros does, with a "Get started" link into the login page.
- `login.html`: Local account log in / sign up. No backend: accounts and plans are stored only in the browser's `localStorage`.
- `plan-form.html`: "Make a plan": the intake form (age, weight, height, goal, training level, equipment, diet, wake/sleep times). Requires being logged in.
- `plan.html`: "My plan": your generated weekly workouts, weekly meals, progress tracking, and a smartwatch activity log. Requires being logged in.

## How personalization works
- **Calorie & macro targets** are calculated per user with a Mifflin-St Jeor style BMR estimate, adjusted for training level (activity multiplier) and goal (a calorie surplus for muscle gain, a deficit for weight loss), with protein set relative to body weight.
- **Workouts** are selected and worded based on goal (rep ranges, session split) and swap specific exercises based on available equipment (bodyweight / dumbbells / full gym), with volume and rest scaled by training level.
- **Meals** are selected based on goal and swapped entirely for vegetarian/vegan diets, with nutrition figures pulled from your calculated targets.

## Accounts & data
This is a static site with no server. Signing up creates a local account (name, email, a salted password hash) stored in this browser only — there's no real authentication across devices, and clearing browser data removes it. This was a deliberate simplification; see `SMARTWATCH_INTEGRATION.md` for what moving to a real backend would involve, since the same backend would also enable real cross-device accounts.

## Smartwatch tracking
The plan page includes a manual activity log (steps, heart rate, active calories, sleep) styled as a device sync panel. It's not connected to a real smartwatch yet — see `SMARTWATCH_INTEGRATION.md` for what that would take.

## Running locally
Go to https://sruthimeenar.github.io/Macros/
