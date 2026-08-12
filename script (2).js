/* ---------- backend ----------
   The backend in /backend handles real accounts (so a plan can follow you across devices),
   OAuth client secrets for Fitbit/Google Fit, and smartwatch syncing. Point this at wherever
   that backend is running. localhost only works while you're developing on your own machine;
   set it to your deployed backend's URL for anyone else to use it.
   Everything here is a *progressive enhancement*: if the backend is unreachable, the app keeps
   working exactly as before, entirely out of this browser's localStorage. */
const BACKEND_URL = get("deviceBackendUrl", "http://localhost:4000");

/* ---------- shared helpers ---------- */
const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const quotes = ["Consistency beats motivation.", "You showed up. That matters.", "Progress over perfection.", "Small steps every day.", "Discipline builds confidence.", "Make the next choice a good one.", "A routine is self-respect in motion."];

function get(key, fallback = "") { return localStorage.getItem(key) || fallback; }
function set(key, value) { localStorage.setItem(key, value); }
function calculateBMI(weight, height) { return (weight / Math.pow(height / 100, 2)).toFixed(1); }
function bmiMessage(bmi) { return bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese"; }
function mondayOfWeek() { const d = new Date(); const offset = d.getDay() === 0 ? -6 : 1 - d.getDay(); d.setDate(d.getDate() + offset); d.setHours(0, 0, 0, 0); return d; }
function dateForDay(index) { const d = mondayOfWeek(); d.setDate(d.getDate() + index); return d.toISOString().slice(0, 10); }
function formatDate(date) { return date.toISOString().replace(/[-:]/g, "").split(".")[0]; }

/* ---------- account system (local-only: no server, data lives in this browser) ---------- */
function currentUser() { return get("currentUser", ""); }
function getUsers() { return JSON.parse(get("macrosUsers", "{}")); }
function saveUsers(users) { set("macrosUsers", JSON.stringify(users)); }
function genSalt() { return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join(""); }
async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(salt + password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function signUp(name, email, password) {
  const users = getUsers(); const key = email.trim().toLowerCase();
  if (users[key]) return { ok: false, message: "An account with this email already exists." };
  const salt = genSalt(); const hash = await hashPassword(password, salt);
  users[key] = { name: name.trim(), salt, hash };
  saveUsers(users); set("currentUser", key);
  await backendSignUp(name, key, password); // best-effort; local account already works if this fails
  return { ok: true };
}
async function logIn(email, password) {
  const users = getUsers(); const key = email.trim().toLowerCase(); const user = users[key];
  if (!user) return { ok: false, message: "No account found with this email." };
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.hash) return { ok: false, message: "Incorrect password." };
  set("currentUser", key);
  await backendLogIn(key, password); // best-effort sign-in to the backend for cross-device sync
  return { ok: true };
}
window.logOut = () => { localStorage.removeItem("currentUser"); window.location.href = "login.html"; };

/* ---------- backend account sync (best-effort; local account is always the source of truth) ----------
   The local password hash above is separate from this. The backend keeps its own bcrypt hash and
   issues a JWT, used only to authenticate profile/plan/device-sync requests to /backend. */
function authHeaders() {
  const token = uGet("authToken", "");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function backendSignUp(name, email, password) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/signup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (res.ok) { const data = await res.json(); uSet("authToken", data.token); return; }
    if (res.status === 409) await backendLogIn(email, password); // account already exists server-side; log in instead
  } catch { /* backend unreachable - local account still works */ }
}
async function backendLogIn(email, password) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) { const data = await res.json(); uSet("authToken", data.token); }
  } catch { /* backend unreachable - local account still works */ }
}
async function backendSaveProfile(profile, weeklyWorkouts, weeklyMeals, planVariation) {
  try {
    await fetch(`${BACKEND_URL}/api/profile`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ profile, weeklyWorkouts, weeklyMeals, planVariation }),
    });
  } catch { /* offline - local plan is unaffected */ }
}
async function backendSaveProgress(entry) {
  try {
    await fetch(`${BACKEND_URL}/api/progress`, {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(entry),
    });
  } catch { /* offline - local history is unaffected */ }
}
async function backendSaveActivity(entry) {
  try {
    await fetch(`${BACKEND_URL}/api/activity`, {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(entry),
    });
  } catch { /* offline - local activity log is unaffected */ }
}
function requireAuth() {
  if (!currentUser()) { set("redirectAfterLogin", window.location.pathname.split("/").pop()); window.location.replace("login.html"); return false; }
  return true;
}

/* per-user namespaced storage, so multiple accounts on the same browser keep separate plans */
function uKey(base) { return `${base}::${currentUser()}`; }
function uGet(base, fallback = "") { return get(uKey(base), fallback); }
function uSet(base, value) { set(uKey(base), value); }

function renderNavAuth() {
  const email = currentUser(); const users = getUsers();
  document.querySelectorAll("[data-auth-guest]").forEach(el => el.style.display = email ? "none" : "");
  document.querySelectorAll("[data-auth-user]").forEach(el => el.style.display = email ? "" : "none");
  const nameEl = document.querySelector("[data-user-name]");
  if (nameEl && email && users[email]) nameEl.textContent = users[email].name.split(" ")[0];
}

/* ---------- plan personalization: calorie & macro targets ---------- */
function calculateTargets(profile) {
  const { age, weight, height, goal, level } = profile;
  // Mifflin-St Jeor BMR, using a gender-neutral midpoint offset since the form doesn't collect sex.
  const bmr = 10 * weight + 6.25 * height - 5 * age - 78;
  const activityMultiplier = level === "Beginner" ? 1.4 : level === "Advanced" ? 1.65 : 1.55;
  let calories = bmr * activityMultiplier;
  calories = goal === "Muscle Gain" ? calories * 1.12 : calories * 0.82;
  const proteinPerKg = goal === "Muscle Gain" ? 2.0 : 2.2; // higher relative protein on a cut protects muscle & satiety
  const protein = Math.round(proteinPerKg * weight);
  const fatCalories = calories * 0.27;
  const fat = Math.round(fatCalories / 9);
  const carbCalories = Math.max(calories - protein * 4 - fatCalories, 0);
  const carbs = Math.round(carbCalories / 4);
  return { calories: Math.round(calories), protein, carbs, fat };
}

/* ---------- workout & meal engines: driven by goal, training level, equipment & diet ---------- */
function workoutLibrary(goal, variation, equipment, level) {
  const volume = level === "Beginner" ? "2 sets" : level === "Advanced" ? "4 sets" : "3 sets";
  const rest = level === "Advanced" ? "75 sec rest" : "60 sec rest";
  const repRange = goal === "Muscle Gain" ? "8-12" : "12-15"; // hypertrophy range vs. metabolic/endurance range
  const gym = equipment === "Gym";
  const dumbbells = equipment === "Dumbbells" || gym;
  const presses = gym ? "Barbell bench press" : dumbbells ? "Dumbbell floor press" : "Push-ups";
  const pulls = gym ? "Lat pulldown" : dumbbells ? "Dumbbell row" : "Towel rows";
  const squats = gym ? "Back squat" : dumbbells ? "Goblet squat" : "Bodyweight squat";
  const hinges = gym ? "Romanian deadlift" : dumbbells ? "Dumbbell deadlift" : "Glute bridge";
  const cardioMove = gym ? "Rowing machine intervals" : dumbbells ? "Brisk walk with a light carry" : "Brisk walk or jog";
  const lowImpactCardio = gym ? "Incline treadmill walk" : dumbbells ? "Cycling or incline walk" : "Cycling or incline walk";
  const carry = gym ? "Farmer carry with dumbbells" : dumbbells ? "Farmer carry" : "Suitcase carry with a filled bag";
  const hiitMove = gym ? "Assault bike sprints" : dumbbells ? "Dumbbell thrusters" : "High knees";
  const make = (session, exercises) => ({ session, exercises: exercises.map(([name, cue]) => `${name}: ${volume} x ${repRange}, ${rest}. ${cue}`).join(" ") });
  const gain = [
    ["Upper push", [[presses, "Keep your ribs down and lower with control."], ["Incline press", "Drive through the palms without locking out hard."], ["Tricep extensions", "Keep elbows pointed forward."]]],
    ["Upper pull", [[pulls, "Pull elbows toward your hips."], ["Seated row", "Pause and squeeze your shoulder blades."], ["Bicep curls", "Avoid swinging the weight."]]],
    ["Lower body", [[squats, "Keep knees tracking over your toes."], [hinges, "Send your hips back and keep a neutral spine."], ["Reverse lunge", "Step back softly and stay tall."]]],
    ["Shoulders + core", [["Overhead press", "Brace your core before every press."], ["Lateral raise", "Lift with control, not momentum."], ["Plank", "Squeeze glutes and breathe steadily."]]],
    ["Full body", [[squats, "Move smoothly through a comfortable range."], [presses, "Keep your body in one strong line."], [pulls, "Finish each rep with a strong back squeeze."]]],
    ["Conditioning", [[cardioMove, "Keep a pace at which you can still speak."], [carry, "Stand tall and take short, steady steps."], ["Mobility flow", "Move gently through hips and shoulders."]]],
    ["Recovery", [["Easy walk", "Keep it truly easy for 20-30 minutes."], ["Stretching", "Hold each comfortable position for 30 seconds."]]]
  ];
  const loss = [
    ["Cardio + core", [[cardioMove, "Maintain an easy, repeatable pace for 20 minutes."], ["Mountain climbers", "Keep shoulders above wrists."], ["Dead bug", "Keep your lower back gently pressed down."]]],
    ["Strength circuit", [[squats, "Push through your whole foot."], [presses, "Move under control."], [pulls, "Pull shoulder blades back."]]],
    ["Low-impact cardio", [[lowImpactCardio, "Stay at a conversational pace for 25 minutes."], ["Glute bridge", "Pause and squeeze at the top."], ["Bird dog", "Reach long without twisting."]]],
    ["HIIT", [[hiitMove, "Land softly and keep the effort honest."], [squats, "Keep your chest lifted."], [presses, "Use an elevated surface if needed."]]],
    ["Lower body + core", [["Reverse lunge", "Step back gently."], ["Glute bridge", "Drive heels into the floor."], ["Plank", "Keep hips level."]]],
    ["Yoga + walk", [["Sun salutations", "Move with your breath."], ["Easy walk", "Finish with 20 relaxed minutes."]]],
    ["Recovery", [["Mobility flow", "Move slowly through the hips and upper back."], ["Easy walk", "Optional 20-minute stroll."]]]
  ];
  const library = goal === "Muscle Gain" ? gain : loss;
  const rotations = variation % 3;
  const ordered = rotations === 0 ? library : rotations === 1 ? [...library.slice(2, 6), ...library.slice(0, 2), library[6]] : [...library.slice(1, 6), library[0], library[6]];
  return ordered.map(([session, exercises]) => make(session, exercises));
}

function mealLibrary(goal, diet, targets, variation) {
  const gain = ["Oats with berries; chicken rice bowl; Greek yogurt", "Eggs on toast; turkey wrap; salmon, potatoes and greens", "Overnight oats; beef rice bowl; cottage cheese and fruit", "Egg scramble; chicken pasta; yogurt and nuts", "Protein smoothie; tuna sandwich; tofu stir-fry", "Pancakes with fruit; burrito bowl; homemade burger", "Oats; roast chicken; rice and vegetables"];
  const loss = ["Oats with berries; grilled chicken salad; vegetable soup", "Eggs on toast; tuna salad wrap; salmon with greens", "Greek yogurt; lentil bowl; chicken and roasted vegetables", "Smoothie; turkey salad; tofu stir-fry", "Egg scramble; quinoa bowl; baked fish and greens", "Overnight oats; chicken wrap; vegetable curry", "Yogurt and fruit; lentil soup; grilled protein with salad"];
  const vegetarian = ["Oats with berries; tofu scramble; lentil bowl", "Eggs on toast; chickpea wrap; paneer with greens", "Greek yogurt; bean rice bowl; cottage cheese and fruit", "Overnight oats; tofu pasta; yogurt and seeds", "Protein smoothie; hummus wrap; vegetable stir-fry", "Pancakes with fruit; burrito bowl; bean burger", "Oats; lentil curry; rice and vegetables"];
  const vegan = ["Oats with berries; tofu scramble; lentil bowl", "Peanut butter toast; chickpea wrap; tofu with greens", "Overnight oats; bean rice bowl; fruit and seeds", "Smoothie with soy milk; tofu pasta; roasted vegetables", "Protein smoothie; hummus wrap; vegetable stir-fry", "Pancakes with fruit; burrito bowl; bean burger", "Oats; lentil curry; rice and vegetables"];
  const meals = (diet === "Vegan" ? vegan : diet === "Vegetarian" ? vegetarian : goal === "Muscle Gain" ? gain : loss).map(meal => {
    let dayMeal = meal;
    if (variation % 3 === 1) dayMeal += "; a small side of fruit or nuts";
    if (variation % 3 === 2) dayMeal += "; extra colourful vegetables";
    return { meal: dayMeal, macros: `${targets.calories} kcal | ${targets.protein}g protein | ${targets.carbs}g carbs | ${targets.fat}g fats` };
  });
  return meals;
}

function savePlan(variation = 0) {
  const profile = JSON.parse(uGet("profile", "{}"));
  const targets = profile.targets || calculateTargets(profile);
  const workouts = workoutLibrary(profile.goal, variation, profile.equipment, profile.level);
  const meals = mealLibrary(profile.goal, profile.diet, targets, variation);
  const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  uSet("weeklyWorkouts", JSON.stringify(workouts)); uSet("weeklyMeals", JSON.stringify(meals)); uSet("planVariation", String(variation));
  uSet("workout", `${workouts[today].session} at ${profile.wakeTime}`); uSet("meals", meals[today].meal); uSet("schedule", `Wake at ${profile.wakeTime}; train with intention; fuel for your goal; sleep at ${profile.sleepTime}.`);
}

/* ---------- plan page rendering ---------- */
function renderRows() {
  const workouts = JSON.parse(uGet("weeklyWorkouts", "[]")); const meals = JSON.parse(uGet("weeklyMeals", "[]")); const done = JSON.parse(uGet("completedWorkouts", "[]"));
  document.getElementById("workoutRows").innerHTML = workouts.map((item, i) => `<tr><td><input class="workout-check" type="checkbox" aria-label="Mark ${dayNames[i]} complete" data-date="${dateForDay(i)}" ${done.includes(dateForDay(i)) ? "checked" : ""}></td><td>${dayNames[i]}</td><td>${item.session}</td><td>${item.exercises}</td></tr>`).join("");
  document.getElementById("mealRows").innerHTML = meals.map((item, i) => `<tr><td>${dayNames[i]}</td><td>${item.meal}</td><td>${item.macros}</td></tr>`).join("");
  document.querySelectorAll(".workout-check").forEach(input => input.addEventListener("change", updateCompletion));
}
function updateCompletion(event) {
  const date = event.target.dataset.date; let done = JSON.parse(uGet("completedWorkouts", "[]"));
  done = event.target.checked ? [...new Set([...done, date])] : done.filter(item => item !== date); uSet("completedWorkouts", JSON.stringify(done)); renderProgress();
}
function renderProgress() {
  const done = new Set(JSON.parse(uGet("completedWorkouts", "[]"))); let streak = 0; const d = new Date(); d.setHours(0, 0, 0, 0);
  while (done.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  document.getElementById("streakCount").innerText = streak; document.getElementById("completionText").innerText = streak ? `You have kept a ${streak}-day promise to yourself.` : "Complete today's session to begin your streak.";
  const history = JSON.parse(uGet("progressHistory", "[]")); const latest = history[0]; document.getElementById("latestProgress").innerText = latest ? `${latest.date}: ${latest.weight || "-"} kg, waist ${latest.waist || "-"} cm. ${latest.note || ""}` : "No check-ins yet.";
}
function renderPlan() {
  const profile = JSON.parse(uGet("profile", "{}"));
  if (!profile.goal || uGet("planReady") !== "true") { window.location.replace("plan-form.html"); return; }
  if (!Array.isArray(JSON.parse(uGet("weeklyWorkouts", "[]")))) savePlan(0);
  const variation = Number(uGet("planVariation", "0")); const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  document.getElementById("stats").innerText = `Goal: ${profile.goal} | ${profile.level}`; document.getElementById("quoteText").innerText = quotes[variation % quotes.length];
  document.getElementById("bmiResult").innerText = `BMI: ${profile.bmi} (${profile.bmiMsg})`; document.getElementById("workoutResult").innerText = uGet("workout"); document.getElementById("scheduleResult").innerText = uGet("schedule");
  renderRows(); renderProgress(); renderActivity();
}

/* ---------- smartwatch: real device sync via the backend in /backend ---------- */
async function fetchDeviceStatus() {
  const email = currentUser(); if (!email) return { connected: [] };
  try {
    const res = await fetch(`${BACKEND_URL}/auth/status?email=${encodeURIComponent(email)}`);
    if (!res.ok) throw new Error("status request failed");
    return await res.json();
  } catch {
    return { connected: [], offline: true };
  }
}
async function renderDeviceStatus() {
  const box = document.getElementById("deviceStatus"); if (!box) return;
  const status = await fetchDeviceStatus();
  if (status.offline) { box.innerText = "Backend not reachable. Start the server in /backend to connect a real device."; return; }
  const labels = { fitbit: "Fitbit", googleFit: "Google Fit" };
  document.querySelectorAll("[data-provider]").forEach(row => {
    const provider = row.dataset.provider; const isConnected = status.connected.includes(provider);
    row.querySelector("[data-status-text]").innerText = isConnected ? "Connected" : "Not connected";
    row.querySelector("[data-connect-btn]").style.display = isConnected ? "none" : "";
    row.querySelector("[data-sync-btn]").style.display = isConnected ? "" : "none";
    row.querySelector("[data-disconnect-btn]").style.display = isConnected ? "" : "none";
  });
  box.innerText = status.connected.length ? `Connected: ${status.connected.map(p => labels[p] || p).join(", ")}` : "No device connected yet.";
}
window.connectDevice = provider => {
  const email = currentUser(); if (!email) return;
  window.location.href = `${BACKEND_URL}/auth/${provider}/connect?email=${encodeURIComponent(email)}`;
};
window.disconnectDevice = async provider => {
  const email = currentUser(); if (!email) return;
  try { await fetch(`${BACKEND_URL}/auth/${provider}?email=${encodeURIComponent(email)}`, { method: "DELETE" }); } catch {}
  renderDeviceStatus();
};
window.syncDevice = async provider => {
  const email = currentUser(); if (!email) return;
  const summaryEl = document.getElementById("activitySummary");
  if (summaryEl) summaryEl.innerText = "Syncing...";
  try {
    const res = await fetch(`${BACKEND_URL}/api/activity/today?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!res.ok || data.error) { if (summaryEl) summaryEl.innerText = data.error || "Sync failed."; return; }
    const log = JSON.parse(uGet("activityLog", "{}"));
    log[new Date().toISOString().slice(0, 10)] = { steps: data.steps, heartRate: data.heartRate, calories: data.calories, sleep: data.sleep, source: data.source };
    uSet("activityLog", JSON.stringify(log));
    renderActivity();
  } catch {
    if (summaryEl) summaryEl.innerText = "Could not reach the backend. Is it running?";
  }
};
function showDeviceRedirectNotice() {
  const params = new URLSearchParams(window.location.search);
  const notice = document.getElementById("deviceStatus"); if (!notice) return;
  if (params.get("deviceConnected")) notice.innerText = `Connected to ${params.get("deviceConnected")}. Syncing...`;
  if (params.get("deviceError")) notice.innerText = `Couldn't connect (${params.get("deviceError")}). Please try again.`;
}

/* ---------- smartwatch (manual log fallback - see SMARTWATCH_INTEGRATION.md) ---------- */
function setupActivityForm() {
  const activityForm = document.getElementById("activityForm"); if (!activityForm) return;
  activityForm.addEventListener("submit", event => {
    event.preventDefault();
    const today = new Date().toISOString().slice(0, 10);
    const entry = { steps: document.getElementById("activitySteps").value, heartRate: document.getElementById("activityHeartRate").value, calories: document.getElementById("activityCalories").value, sleep: document.getElementById("activitySleep").value };
    const log = JSON.parse(uGet("activityLog", "{}"));
    log[today] = entry;
    uSet("activityLog", JSON.stringify(log)); backendSaveActivity({ date: today, ...entry, source: "manual" }); activityForm.reset(); renderActivity();
  });
}
function renderActivity() {
  const summaryEl = document.getElementById("activitySummary"); if (!summaryEl) return;
  const log = JSON.parse(uGet("activityLog", "{}")); const entry = log[new Date().toISOString().slice(0, 10)];
  const sourceLabel = entry?.source === "fitbit" ? " (synced from Fitbit)" : entry?.source === "googleFit" ? " (synced from Google Fit)" : entry ? " (manual)" : "";
  summaryEl.innerText = entry ? `Today: ${entry.steps ?? "-"} steps, ${entry.heartRate ?? "-"} bpm avg, ${entry.calories ?? "-"} kcal active, ${entry.sleep ?? "-"} hr sleep.${sourceLabel}` : "No activity logged yet today.";
}

/* ---------- forms ---------- */
function setupProfile() {
  const form = document.getElementById("userForm"); if (!form) return;
  form.addEventListener("submit", event => {
    event.preventDefault();
    const age = Number(document.getElementById("ageInput").value);
    let weight = Number(document.getElementById("weightInput").value); let height = Number(document.getElementById("heightInput").value);
    if (document.getElementById("weightUnit").value === "lb") weight *= .453592; if (document.getElementById("heightUnit").value === "in") height *= 2.54;
    if (!age || !weight || !height) return;
    const bmi = calculateBMI(weight, height);
    const profile = { age, weight: Math.round(weight), height: Math.round(height), goal: document.getElementById("goalSelect").value, level: document.getElementById("levelSelect").value, equipment: document.getElementById("equipmentSelect").value, diet: document.getElementById("dietSelect").value, wakeTime: document.getElementById("wakeTime").value, sleepTime: document.getElementById("sleepTime").value, bmi, bmiMsg: bmiMessage(bmi) };
    profile.targets = calculateTargets(profile);
    uSet("profile", JSON.stringify(profile)); uSet("planReady", "true"); savePlan(0);
    backendSaveProfile(profile, JSON.parse(uGet("weeklyWorkouts", "[]")), JSON.parse(uGet("weeklyMeals", "[]")), 0);
    window.location.href = "plan.html";
  });
}
function setupProgressForm() {
  const progressForm = document.getElementById("progressForm"); if (!progressForm) return;
  progressForm.addEventListener("submit", event => { event.preventDefault(); const entry = { date: new Date().toLocaleDateString(), weight: document.getElementById("progressWeight").value, waist: document.getElementById("progressWaist").value, note: document.getElementById("progressNote").value }; const history = JSON.parse(uGet("progressHistory", "[]")); history.unshift(entry); uSet("progressHistory", JSON.stringify(history.slice(0, 12))); backendSaveProgress(entry); progressForm.reset(); renderProgress(); });
}
function setupAuthForms() {
  const signupForm = document.getElementById("signupForm"); const loginForm = document.getElementById("loginForm"); const errorEl = document.getElementById("authError");
  const showError = msg => { if (errorEl) { errorEl.textContent = msg; errorEl.style.display = "block"; } };
  const afterAuth = () => { const redirect = get("redirectAfterLogin", ""); localStorage.removeItem("redirectAfterLogin"); window.location.href = redirect || (uGet("planReady") === "true" ? "plan.html" : "plan-form.html"); };
  if (signupForm) signupForm.addEventListener("submit", async event => {
    event.preventDefault();
    const name = document.getElementById("signupName").value.trim(); const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value; const confirm = document.getElementById("signupConfirm").value;
    if (!name || !email || !password) return showError("Please fill in all fields.");
    if (password.length < 6) return showError("Password should be at least 6 characters.");
    if (password !== confirm) return showError("Passwords do not match.");
    const result = await signUp(name, email, password); if (!result.ok) return showError(result.message); afterAuth();
  });
  if (loginForm) loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim(); const password = document.getElementById("loginPassword").value;
    const result = await logIn(email, password); if (!result.ok) return showError(result.message); afterAuth();
  });
}
window.showSignup = () => { document.getElementById("signupPanel").style.display = ""; document.getElementById("loginPanel").style.display = "none"; document.getElementById("tabLogin").classList.remove("active"); document.getElementById("tabSignup").classList.add("active"); };
window.showLogin = () => { document.getElementById("loginPanel").style.display = ""; document.getElementById("signupPanel").style.display = "none"; document.getElementById("tabSignup").classList.remove("active"); document.getElementById("tabLogin").classList.add("active"); };

/* ---------- misc UI ---------- */
window.goBack = () => { window.location.href = "plan-form.html"; };
window.regenerate = () => { savePlan((Number(uGet("planVariation", "0")) + 1) % 3); renderPlan(); };
let restTimer;
window.startRestTimer = () => { clearInterval(restTimer); let seconds = 60; const display = document.getElementById("timerDisplay"); const tick = () => { display.innerText = seconds ? `Rest: ${seconds}s` : "Rest complete - go again!"; seconds--; if (seconds < 0) clearInterval(restTimer); }; tick(); restTimer = setInterval(tick, 1000); };
window.addToGoogleCalendar = () => { const profile = JSON.parse(uGet("profile", "{}")); const workouts = JSON.parse(uGet("weeklyWorkouts", "[]")); const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; const exerciseDetails = workouts[today]?.exercises || "Complete the session and mark it done in your plan."; const start = new Date(); const [hours, minutes] = (profile.wakeTime || "18:00").split(":").map(Number); start.setHours(hours, minutes, 0, 0); const end = new Date(start); end.setHours(end.getHours() + 1); const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(uGet("workout"))}&details=${encodeURIComponent(`Macros workout\n\n${exerciseDetails}`)}&dates=${formatDate(start)}/${formatDate(end)}`; window.open(url, "_blank", "noopener"); };
window.toggleTheme = () => { document.body.classList.toggle("dark-mode"); const isDark = document.body.classList.contains("dark-mode"); set("theme", isDark ? "dark" : "light"); document.querySelectorAll(".theme-toggle").forEach(button => { button.innerText = isDark ? "Light" : "Dark"; }); };
function guardPlanLinks() {
  document.querySelectorAll("[data-plan-link]").forEach(link => link.addEventListener("click", event => {
    if (!currentUser()) { event.preventDefault(); set("redirectAfterLogin", link.getAttribute("href")); window.location.href = "login.html"; return; }
    if (link.getAttribute("href") === "plan.html" && uGet("planReady") !== "true") { event.preventDefault(); alert("Please fill in Make a plan before viewing My plan."); }
  }));
}

/* ---------- page driver ---------- */
if (get("theme") === "dark") document.body.classList.add("dark-mode");
document.querySelectorAll(".theme-toggle").forEach(button => { button.innerText = document.body.classList.contains("dark-mode") ? "Light" : "Dark"; });
renderNavAuth(); guardPlanLinks();
const currentPath = window.location.pathname;
if (currentPath.includes("login.html")) {
  if (currentUser()) window.location.replace(uGet("planReady") === "true" ? "plan.html" : "plan-form.html"); else setupAuthForms();
}
if (currentPath.includes("plan-form.html")) { if (requireAuth()) setupProfile(); }
if (currentPath.includes("plan.html")) {
  if (requireAuth()) {
    setupProgressForm(); setupActivityForm(); renderPlan(); showDeviceRedirectNotice(); renderDeviceStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("deviceConnected")) { window.syncDevice(params.get("deviceConnected")); window.history.replaceState({}, "", "plan.html"); }
  }
}
