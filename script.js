/* ---------- backend API ----------
   All account, plan, progress, and activity data now lives on the server in /backend
   (Postgres), not just in this browser. Point this at wherever that backend is running -
   localhost only works while you're developing on your own machine. */
const API_BASE_URL = get("apiBaseUrl", "http://localhost:4000");

/* ---------- shared helpers ---------- */
const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const quotes = ["Consistency beats motivation.", "You showed up. That matters.", "Progress over perfection.", "Small steps every day.", "Discipline builds confidence.", "Make the next choice a good one.", "A routine is self-respect in motion."];

function get(key, fallback = "") { return localStorage.getItem(key) || fallback; }
function set(key, value) { localStorage.setItem(key, value); }
function mondayOfWeek() { const d = new Date(); const offset = d.getDay() === 0 ? -6 : 1 - d.getDay(); d.setDate(d.getDate() + offset); d.setHours(0, 0, 0, 0); return d; }
function dateForDay(index) { const d = mondayOfWeek(); d.setDate(d.getDate() + index); return d.toISOString().slice(0, 10); }
function formatDate(date) { return date.toISOString().replace(/[-:]/g, "").split(".")[0]; }

/* ---------- API client ---------- */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    return { ok: false, offline: true, error: `Could not reach the backend at ${API_BASE_URL}. Is it running?` };
  }
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) return { ok: false, status: res.status, error: (data && data.error) || "Something went wrong." };
  return { ok: true, data };
}

/* ---------- account session ---------- */
function getToken() { return get("authToken", ""); }
function getCachedUser() { try { return JSON.parse(get("cachedUser", "null")); } catch { return null; } }
function setSession(token, user) { set("authToken", token); set("cachedUser", JSON.stringify(user)); }
function clearSession() { localStorage.removeItem("authToken"); localStorage.removeItem("cachedUser"); }

async function signUp(name, email, password) {
  const res = await apiFetch("/api/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });
  if (!res.ok) return { ok: false, message: res.error };
  setSession(res.data.token, res.data.user);
  return { ok: true };
}
async function logIn(email, password) {
  const res = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  if (!res.ok) return { ok: false, message: res.error };
  setSession(res.data.token, res.data.user);
  return { ok: true };
}
window.logOut = () => { clearSession(); window.location.href = "login.html"; };
function requireAuth() {
  if (!getToken()) { set("redirectAfterLogin", window.location.pathname.split("/").pop()); window.location.replace("login.html"); return false; }
  return true;
}

function renderNavAuth() {
  const user = getCachedUser();
  document.querySelectorAll("[data-auth-guest]").forEach(el => el.style.display = user ? "none" : "");
  document.querySelectorAll("[data-auth-user]").forEach(el => el.style.display = user ? "" : "none");
  const nameEl = document.querySelector("[data-user-name]");
  if (nameEl && user) nameEl.textContent = user.name.split(" ")[0];
}
function guardPlanLinks() {
  document.querySelectorAll("[data-plan-link]").forEach(link => link.addEventListener("click", event => {
    if (!getToken()) { event.preventDefault(); set("redirectAfterLogin", link.getAttribute("href")); window.location.href = "login.html"; }
  }));
}

/* ---------- plan page rendering ---------- */
function renderRows(workouts, meals, completedWorkouts) {
  const done = new Set(completedWorkouts);
  document.getElementById("workoutRows").innerHTML = workouts.map((item, i) => `<tr><td><input class="workout-check" type="checkbox" aria-label="Mark ${dayNames[i]} complete" data-date="${dateForDay(i)}" ${done.has(dateForDay(i)) ? "checked" : ""}></td><td>${dayNames[i]}</td><td>${item.session}</td><td>${item.exercises}</td></tr>`).join("");
  document.getElementById("mealRows").innerHTML = meals.map((item, i) => `<tr><td>${dayNames[i]}</td><td>${item.meal}</td><td>${item.macros}</td></tr>`).join("");
  document.querySelectorAll(".workout-check").forEach(input => input.addEventListener("change", updateCompletion));
}
async function updateCompletion(event) {
  const date = event.target.dataset.date; const done = event.target.checked;
  const res = await apiFetch("/api/plan/complete", { method: "POST", body: JSON.stringify({ date, done }) });
  if (res.ok) renderStreak(res.data.completedWorkouts);
}
function renderStreak(completedWorkouts) {
  const done = new Set(completedWorkouts); let streak = 0; const d = new Date(); d.setHours(0, 0, 0, 0);
  while (done.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  document.getElementById("streakCount").innerText = streak;
  document.getElementById("completionText").innerText = streak ? `You have kept a ${streak}-day promise to yourself.` : "Complete today's session to begin your streak.";
}
async function renderLatestProgress() {
  const res = await apiFetch("/api/progress");
  const latest = res.ok ? res.data.history[0] : null;
  document.getElementById("latestProgress").innerText = latest ? `${latest.date}: ${latest.weight || "-"} kg, waist ${latest.waist || "-"} cm. ${latest.note || ""}` : "No check-ins yet.";
}
async function renderPlan() {
  const res = await apiFetch("/api/plan");
  if (!res.ok) {
    if (res.status === 404) { window.location.replace("plan-form.html"); return; }
    if (res.offline) { document.getElementById("planContent").insertAdjacentHTML("afterbegin", `<p class="card-result">${res.error}</p>`); return; }
    if (res.status === 401) { requireAuth(); return; }
    alert(res.error); return;
  }
  const { profile, workouts, meals, variation, completedWorkouts } = res.data;
  const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  document.getElementById("stats").innerText = `Goal: ${profile.goal} | ${profile.level}`;
  document.getElementById("quoteText").innerText = quotes[variation % quotes.length];
  document.getElementById("bmiResult").innerText = `BMI: ${profile.bmi} (${profile.bmiMsg})`;
  document.getElementById("workoutResult").innerText = `${workouts[today].session} at ${profile.wakeTime}`;
  document.getElementById("scheduleResult").innerText = `Wake at ${profile.wakeTime}; train with intention; fuel for your goal; sleep at ${profile.sleepTime}.`;
  renderRows(workouts, meals, completedWorkouts);
  renderStreak(completedWorkouts);
  renderLatestProgress();
  renderActivity();
}

/* ---------- smartwatch: real device sync via the backend in /backend ----------
   Syncing itself is automatic once connected - the backend polls connected devices on its
   own schedule (see backend/src/scheduler.js), and can also react instantly to Fitbit
   webhooks if that's configured. "Sync now" and page-load below just pull the latest
   already-synced value in rather than triggering the sync themselves. */
async function fetchDeviceStatus() {
  const res = await apiFetch("/auth/devices/status");
  if (!res.ok) return { connected: [], offline: !!res.offline };
  return res.data;
}
async function renderDeviceStatus() {
  const box = document.getElementById("deviceStatus"); if (!box) return;
  const status = await fetchDeviceStatus();
  if (status.offline) { box.innerText = "Backend not reachable — start the server in /backend to connect a real device."; return; }
  const labels = { fitbit: "Fitbit", googleFit: "Google Fit" };
  document.querySelectorAll("[data-provider]").forEach(row => {
    const provider = row.dataset.provider; const isConnected = status.connected.includes(provider);
    row.querySelector("[data-status-text]").innerText = isConnected ? "Connected" : "Not connected";
    row.querySelector("[data-connect-btn]").style.display = isConnected ? "none" : "";
    row.querySelector("[data-sync-btn]").style.display = isConnected ? "" : "none";
    row.querySelector("[data-disconnect-btn]").style.display = isConnected ? "" : "none";
  });
  box.innerText = status.connected.length ? `Connected: ${status.connected.map(p => labels[p] || p).join(", ")} — syncs automatically in the background.` : "No device connected yet.";
}
window.connectDevice = provider => {
  const token = getToken(); if (!token) return;
  window.location.href = `${API_BASE_URL}/auth/devices/${provider}/connect?token=${encodeURIComponent(token)}`;
};
window.disconnectDevice = async provider => { await apiFetch(`/auth/devices/${provider}`, { method: "DELETE" }); renderDeviceStatus(); };
window.syncDevice = async () => {
  const summaryEl = document.getElementById("activitySummary"); if (summaryEl) summaryEl.innerText = "Syncing...";
  const res = await apiFetch("/api/activity/sync", { method: "POST" });
  if (!res.ok) { if (summaryEl) summaryEl.innerText = res.error || "Sync failed."; return; }
  renderActivity();
};
function showDeviceRedirectNotice() {
  const params = new URLSearchParams(window.location.search);
  const notice = document.getElementById("deviceStatus"); if (!notice) return;
  if (params.get("deviceConnected")) notice.innerText = `Connected to ${params.get("deviceConnected")}. Syncing...`;
  if (params.get("deviceError")) notice.innerText = `Couldn't connect (${params.get("deviceError")}). Please try again.`;
}

/* ---------- smartwatch (manual log fallback — see SMARTWATCH_INTEGRATION.md) ---------- */
function setupActivityForm() {
  const activityForm = document.getElementById("activityForm"); if (!activityForm) return;
  activityForm.addEventListener("submit", async event => {
    event.preventDefault();
    await apiFetch("/api/activity/manual", { method: "POST", body: JSON.stringify({
      steps: document.getElementById("activitySteps").value, heartRate: document.getElementById("activityHeartRate").value,
      calories: document.getElementById("activityCalories").value, sleep: document.getElementById("activitySleep").value,
    }) });
    activityForm.reset(); renderActivity();
  });
}
async function renderActivity() {
  const summaryEl = document.getElementById("activitySummary"); if (!summaryEl) return;
  const res = await apiFetch("/api/activity/today");
  const entry = res.ok ? res.data.activity : null;
  const val = v => (v === null || v === undefined || v === "") ? "-" : v;
  const sourceLabel = entry?.source === "fitbit" ? " (synced from Fitbit)" : entry?.source === "googleFit" ? " (synced from Google Fit)" : entry ? " (manual)" : "";
  summaryEl.innerText = entry ? `Today: ${val(entry.steps)} steps, ${val(entry.heartRate)} bpm avg, ${val(entry.calories)} kcal active, ${val(entry.sleep)} hr sleep.${sourceLabel}` : "No activity logged yet today.";
}

/* ---------- forms ---------- */
function setupProfile() {
  const form = document.getElementById("userForm"); if (!form) return;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const submitBtn = form.querySelector("button[type=submit]"); const originalLabel = submitBtn ? submitBtn.innerHTML : "";
    let weight = Number(document.getElementById("weightInput").value); let height = Number(document.getElementById("heightInput").value);
    if (document.getElementById("weightUnit").value === "lb") weight *= .453592; if (document.getElementById("heightUnit").value === "in") height *= 2.54;
    const payload = {
      age: Number(document.getElementById("ageInput").value), weight: Math.round(weight), height: Math.round(height),
      goal: document.getElementById("goalSelect").value, level: document.getElementById("levelSelect").value,
      equipment: document.getElementById("equipmentSelect").value, diet: document.getElementById("dietSelect").value,
      wakeTime: document.getElementById("wakeTime").value, sleepTime: document.getElementById("sleepTime").value,
    };
    if (!payload.age || !payload.weight || !payload.height) return;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "Generating..."; }
    const res = await apiFetch("/api/profile", { method: "PUT", body: JSON.stringify(payload) });
    if (!res.ok) {
      alert(res.error);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalLabel; }
      return;
    }
    window.location.href = "plan.html";
  });
}
function setupProgressForm() {
  const progressForm = document.getElementById("progressForm"); if (!progressForm) return;
  progressForm.addEventListener("submit", async event => {
    event.preventDefault();
    const res = await apiFetch("/api/progress", { method: "POST", body: JSON.stringify({
      weight: document.getElementById("progressWeight").value, waist: document.getElementById("progressWaist").value, note: document.getElementById("progressNote").value,
    }) });
    if (res.ok) { progressForm.reset(); renderLatestProgress(); }
  });
}
function setupAuthForms() {
  const signupForm = document.getElementById("signupForm"); const loginForm = document.getElementById("loginForm"); const errorEl = document.getElementById("authError");
  const showError = msg => { if (errorEl) { errorEl.textContent = msg; errorEl.style.display = "block"; } };
  const afterAuth = () => { const redirect = get("redirectAfterLogin", ""); localStorage.removeItem("redirectAfterLogin"); window.location.href = redirect || "plan.html"; };
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
window.regenerate = async () => { const res = await apiFetch("/api/plan/regenerate", { method: "POST" }); if (res.ok) renderPlan(); };
let restTimer;
window.startRestTimer = () => { clearInterval(restTimer); let seconds = 60; const display = document.getElementById("timerDisplay"); const tick = () => { display.innerText = seconds ? `Rest: ${seconds}s` : "Rest complete - go again!"; seconds--; if (seconds < 0) clearInterval(restTimer); }; tick(); restTimer = setInterval(tick, 1000); };
window.addToGoogleCalendar = async () => {
  const res = await apiFetch("/api/plan"); if (!res.ok) return;
  const { profile, workouts } = res.data; const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const exerciseDetails = workouts[today]?.exercises || "Complete the session and mark it done in your plan.";
  const start = new Date(); const [hours, minutes] = (profile.wakeTime || "18:00").split(":").map(Number); start.setHours(hours, minutes, 0, 0);
  const end = new Date(start); end.setHours(end.getHours() + 1);
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${workouts[today].session} at ${profile.wakeTime}`)}&details=${encodeURIComponent(`Macros workout\n\n${exerciseDetails}`)}&dates=${formatDate(start)}/${formatDate(end)}`;
  window.open(url, "_blank", "noopener");
};
window.toggleTheme = () => { document.body.classList.toggle("dark-mode"); const isDark = document.body.classList.contains("dark-mode"); set("theme", isDark ? "dark" : "light"); document.querySelectorAll(".theme-toggle").forEach(button => { button.innerText = isDark ? "Light" : "Dark"; }); };

/* ---------- page driver ---------- */
if (get("theme") === "dark") document.body.classList.add("dark-mode");
document.querySelectorAll(".theme-toggle").forEach(button => { button.innerText = document.body.classList.contains("dark-mode") ? "Light" : "Dark"; });
renderNavAuth(); guardPlanLinks();
const currentPath = window.location.pathname;
if (currentPath.includes("login.html")) {
  if (getToken()) window.location.replace("plan.html"); else setupAuthForms();
}
if (currentPath.includes("plan-form.html")) { if (requireAuth()) setupProfile(); }
if (currentPath.includes("plan.html")) {
  if (requireAuth()) {
    setupProgressForm(); setupActivityForm(); renderPlan(); showDeviceRedirectNotice(); renderDeviceStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("deviceConnected")) { window.syncDevice(); window.history.replaceState({}, "", "plan.html"); }
  }
}
