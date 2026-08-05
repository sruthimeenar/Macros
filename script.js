const form = document.getElementById("userForm");
const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const quotes = ["Consistency beats motivation.", "You showed up. That matters.", "Progress over perfection.", "Small steps every day.", "Discipline builds confidence.", "Make the next choice a good one.", "A routine is self-respect in motion."];

function get(key, fallback = "") { return localStorage.getItem(key) || fallback; }
function calculateBMI(weight, height) { return (weight / Math.pow(height / 100, 2)).toFixed(1); }
function bmiMessage(bmi) { return bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese"; }
function mondayOfWeek() { const d = new Date(); const offset = d.getDay() === 0 ? -6 : 1 - d.getDay(); d.setDate(d.getDate() + offset); d.setHours(0, 0, 0, 0); return d; }
function dateForDay(index) { const d = mondayOfWeek(); d.setDate(d.getDate() + index); return d.toISOString().slice(0, 10); }
function formatDate(date) { return date.toISOString().replace(/[-:]/g, "").split(".")[0]; }

function workoutLibrary(goal, variation, equipment, level) {
  const volume = level === "Beginner" ? "2 sets" : level === "Advanced" ? "4 sets" : "3 sets";
  const rest = level === "Advanced" ? "75 sec rest" : "60 sec rest";
  const gym = equipment === "Gym";
  const dumbbells = equipment === "Dumbbells" || gym;
  const presses = gym ? "Barbell bench press" : dumbbells ? "Dumbbell floor press" : "Push-ups";
  const pulls = gym ? "Lat pulldown" : dumbbells ? "Dumbbell row" : "Towel rows";
  const squats = gym ? "Back squat" : dumbbells ? "Goblet squat" : "Bodyweight squat";
  const hinges = gym ? "Romanian deadlift" : dumbbells ? "Dumbbell deadlift" : "Glute bridge";
  const make = (session, exercises) => ({ session, exercises: exercises.map(([name, cue]) => `${name}: ${volume} x 8-12, ${rest}. ${cue}`).join(" ") });
  const gain = [
    ["Upper push", [[presses, "Keep your ribs down and lower with control."], ["Incline press", "Drive through the palms without locking out hard."], ["Tricep extensions", "Keep elbows pointed forward."]]],
    ["Upper pull", [[pulls, "Pull elbows toward your hips."], ["Seated row", "Pause and squeeze your shoulder blades."], ["Bicep curls", "Avoid swinging the weight."]]],
    ["Lower body", [[squats, "Keep knees tracking over your toes."], [hinges, "Send your hips back and keep a neutral spine."], ["Reverse lunge", "Step back softly and stay tall."]]],
    ["Shoulders + core", [["Overhead press", "Brace your core before every press."], ["Lateral raise", "Lift with control, not momentum."], ["Plank", "Squeeze glutes and breathe steadily."]]],
    ["Full body", [[squats, "Move smoothly through a comfortable range."], [presses, "Keep your body in one strong line."], [pulls, "Finish each rep with a strong back squeeze."]]],
    ["Conditioning", [["Brisk walk or bike", "Keep a pace at which you can still speak."], ["Farmer carry", "Stand tall and take short, steady steps."], ["Mobility flow", "Move gently through hips and shoulders."]]],
    ["Recovery", [["Easy walk", "Keep it truly easy for 20-30 minutes."], ["Stretching", "Hold each comfortable position for 30 seconds."]]]
  ];
  const loss = [
    ["Cardio + core", [["Brisk walk or jog", "Maintain an easy, repeatable pace for 20 minutes."], ["Mountain climbers", "Keep shoulders above wrists."], ["Dead bug", "Keep your lower back gently pressed down."]]],
    ["Strength circuit", [[squats, "Push through your whole foot."], [presses, "Move under control."], [pulls, "Pull shoulder blades back."]]],
    ["Low-impact cardio", [["Cycling or incline walk", "Stay at a conversational pace for 25 minutes."], ["Glute bridge", "Pause and squeeze at the top."], ["Bird dog", "Reach long without twisting."]]],
    ["HIIT", [["High knees", "Land softly."], ["Bodyweight squat", "Keep your chest lifted."], ["Push-ups", "Use an elevated surface if needed."]]],
    ["Lower body + core", [["Reverse lunge", "Step back gently."], ["Glute bridge", "Drive heels into the floor."], ["Plank", "Keep hips level."]]],
    ["Yoga + walk", [["Sun salutations", "Move with your breath."], ["Easy walk", "Finish with 20 relaxed minutes."]]],
    ["Recovery", [["Mobility flow", "Move slowly through the hips and upper back."], ["Easy walk", "Optional 20-minute stroll."]]]
  ];
  const library = goal === "Muscle Gain" ? gain : loss;
  const rotations = variation % 3;
  const ordered = rotations === 0 ? library : rotations === 1 ? [...library.slice(2, 6), ...library.slice(0, 2), library[6]] : [...library.slice(1, 6), library[0], library[6]];
  return ordered.map(([session, exercises]) => make(session, exercises));
}

function mealLibrary(goal, diet, allergies, variation) {
  const gain = ["Oats with berries; chicken rice bowl; Greek yogurt", "Eggs on toast; turkey wrap; salmon, potatoes and greens", "Overnight oats; beef rice bowl; cottage cheese and fruit", "Egg scramble; chicken pasta; yogurt and nuts", "Protein smoothie; tuna sandwich; tofu stir-fry", "Pancakes with fruit; burrito bowl; homemade burger", "Oats; roast chicken; rice and vegetables"];
  const loss = ["Oats with berries; grilled chicken salad; vegetable soup", "Eggs on toast; tuna salad wrap; salmon with greens", "Greek yogurt; lentil bowl; chicken and roasted vegetables", "Smoothie; turkey salad; tofu stir-fry", "Egg scramble; quinoa bowl; baked fish and greens", "Overnight oats; chicken wrap; vegetable curry", "Yogurt and fruit; lentil soup; grilled protein with salad"];
  const vegetarian = ["Oats with berries; tofu scramble; lentil bowl", "Eggs on toast; chickpea wrap; paneer with greens", "Greek yogurt; bean rice bowl; cottage cheese and fruit", "Overnight oats; tofu pasta; yogurt and seeds", "Protein smoothie; hummus wrap; vegetable stir-fry", "Pancakes with fruit; burrito bowl; bean burger", "Oats; lentil curry; rice and vegetables"];
  const vegan = ["Oats with berries; tofu scramble; lentil bowl", "Peanut butter toast; chickpea wrap; tofu with greens", "Overnight oats; bean rice bowl; fruit and seeds", "Smoothie with soy milk; tofu pasta; roasted vegetables", "Protein smoothie; hummus wrap; vegetable stir-fry", "Pancakes with fruit; burrito bowl; bean burger", "Oats; lentil curry; rice and vegetables"];
  let meals = diet === "Vegan" ? vegan : diet === "Vegetarian" ? vegetarian : goal === "Muscle Gain" ? gain : loss;
  const avoided = allergies.toLowerCase().split(",").map(x => x.trim()).filter(Boolean);
  meals = meals.map((meal, index) => {
    let safeMeal = meal.replace(/nuts/gi, "seeds").replace(/yogurt/gi, avoided.includes("dairy") ? "soy yogurt" : "yogurt");
    if (avoided.includes("eggs")) safeMeal = safeMeal.replace(/Eggs on toast|Egg scramble/gi, "Tofu scramble");
    if (variation % 3 === 1) safeMeal += "; apple with peanut-free seed butter";
    if (variation % 3 === 2) safeMeal += "; extra colourful vegetables";
    return { meal: safeMeal, macros: goal === "Muscle Gain" ? `${2450 + index * 20} kcal | 155g protein | 285g carbs | 75g fats` : `${1850 + index * 15} kcal | 125g protein | 190g carbs | 60g fats` };
  });
  return meals;
}

function savePlan(variation = 0) {
  const profile = JSON.parse(get("profile", "{}"));
  const workouts = workoutLibrary(profile.goal, variation, profile.equipment, profile.level);
  const meals = mealLibrary(profile.goal, profile.diet, profile.allergies || "", variation);
  const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  localStorage.setItem("weeklyWorkouts", JSON.stringify(workouts)); localStorage.setItem("weeklyMeals", JSON.stringify(meals)); localStorage.setItem("planVariation", String(variation));
  localStorage.setItem("workout", `${workouts[today].session} at ${profile.wakeTime}`); localStorage.setItem("meals", meals[today].meal); localStorage.setItem("schedule", `Wake at ${profile.wakeTime}; train with intention; fuel for your goal; sleep at ${profile.sleepTime}.`);
}

function renderRows() {
  const workouts = JSON.parse(get("weeklyWorkouts", "[]")); const meals = JSON.parse(get("weeklyMeals", "[]")); const done = JSON.parse(get("completedWorkouts", "[]"));
  document.getElementById("workoutRows").innerHTML = workouts.map((item, i) => `<tr><td><input class="workout-check" type="checkbox" aria-label="Mark ${dayNames[i]} complete" data-date="${dateForDay(i)}" ${done.includes(dateForDay(i)) ? "checked" : ""}></td><td>${dayNames[i]}</td><td>${item.session}</td><td>${item.exercises}</td></tr>`).join("");
  document.getElementById("mealRows").innerHTML = meals.map((item, i) => `<tr><td>${dayNames[i]}</td><td>${item.meal}</td><td>${item.macros}</td></tr>`).join("");
  document.querySelectorAll(".workout-check").forEach(input => input.addEventListener("change", updateCompletion));
}

function updateCompletion(event) {
  const date = event.target.dataset.date; let done = JSON.parse(get("completedWorkouts", "[]"));
  done = event.target.checked ? [...new Set([...done, date])] : done.filter(item => item !== date); localStorage.setItem("completedWorkouts", JSON.stringify(done)); renderProgress();
}
function renderProgress() {
  const done = new Set(JSON.parse(get("completedWorkouts", "[]"))); let streak = 0; const d = new Date(); d.setHours(0,0,0,0);
  while (done.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  document.getElementById("streakCount").innerText = streak; document.getElementById("completionText").innerText = streak ? `You have kept a ${streak}-day promise to yourself.` : "Complete today's session to begin your streak.";
  const history = JSON.parse(get("progressHistory", "[]")); const latest = history[0]; document.getElementById("latestProgress").innerText = latest ? `${latest.date}: ${latest.weight || "-"} kg, waist ${latest.waist || "-"} cm. ${latest.note || ""}` : "No check-ins yet.";
}
function renderPlan() {
  const profile = JSON.parse(get("profile", "{}"));
  if (!profile.goal) { window.location.replace("index.html"); return; }
  if (!Array.isArray(JSON.parse(get("weeklyWorkouts", "[]")))) savePlan(0);
  const variation = Number(get("planVariation", "0")); const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  document.getElementById("stats").innerText = `Goal: ${profile.goal} | ${profile.level}`; document.getElementById("quoteText").innerText = quotes[variation % quotes.length];
  document.getElementById("bmiResult").innerText = `BMI: ${profile.bmi} (${profile.bmiMsg})`; document.getElementById("workoutResult").innerText = get("workout"); document.getElementById("mealsResult").innerText = get("meals"); document.getElementById("scheduleResult").innerText = get("schedule");
  renderRows(); renderProgress();
}

function setupProfile() {
  if (!form) return;
  form.addEventListener("submit", event => { event.preventDefault(); const age = document.getElementById("ageInput").value; let weight = Number(document.getElementById("weightInput").value); let height = Number(document.getElementById("heightInput").value); if (document.getElementById("weightUnit").value === "lb") weight *= .453592; if (document.getElementById("heightUnit").value === "in") height *= 2.54; if (!age || !weight || !height) return; const bmi = calculateBMI(weight, height); const profile = { age, weight: Math.round(weight), height: Math.round(height), goal: document.getElementById("goalSelect").value, level: document.getElementById("levelSelect").value, equipment: document.getElementById("equipmentSelect").value, diet: document.getElementById("dietSelect").value, allergies: document.getElementById("allergyInput").value, wakeTime: document.getElementById("wakeTime").value, sleepTime: document.getElementById("sleepTime").value, bmi, bmiMsg: bmiMessage(bmi) }; localStorage.setItem("profile", JSON.stringify(profile)); savePlan(0); window.location.href = "plan.html"; });
}
function setupProgressForm() { const progressForm = document.getElementById("progressForm"); if (!progressForm) return; progressForm.addEventListener("submit", event => { event.preventDefault(); const history = JSON.parse(get("progressHistory", "[]")); history.unshift({ date: new Date().toLocaleDateString(), weight: document.getElementById("progressWeight").value, waist: document.getElementById("progressWaist").value, note: document.getElementById("progressNote").value }); localStorage.setItem("progressHistory", JSON.stringify(history.slice(0, 12))); progressForm.reset(); renderProgress(); }); }

window.goBack = () => { window.location.href = "index.html"; };
window.regenerate = () => { savePlan((Number(get("planVariation", "0")) + 1) % 3); renderPlan(); };
let restTimer;
window.startRestTimer = () => { clearInterval(restTimer); let seconds = 60; const display = document.getElementById("timerDisplay"); const tick = () => { display.innerText = seconds ? `Rest: ${seconds}s` : "Rest complete - go again!"; seconds--; if (seconds < 0) clearInterval(restTimer); }; tick(); restTimer = setInterval(tick, 1000); };
window.addToGoogleCalendar = () => { const profile = JSON.parse(get("profile", "{}")); const start = new Date(); const [hours, minutes] = (profile.wakeTime || "18:00").split(":").map(Number); start.setHours(hours, minutes, 0, 0); const end = new Date(start); end.setHours(end.getHours() + 1); const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(get("workout"))}&details=${encodeURIComponent("Project Macros workout. Complete the session and mark it done in your plan.")}&dates=${formatDate(start)}/${formatDate(end)}`; window.open(url, "_blank", "noopener"); };
window.toggleTheme = () => { document.body.classList.toggle("dark-mode"); localStorage.setItem("theme", document.body.classList.contains("dark-mode") ? "dark" : "light"); };
function guardPlanLinks() { document.querySelectorAll("[data-plan-link]").forEach(link => link.addEventListener("click", event => { if (!get("profile")) { event.preventDefault(); alert("Please fill in Make a plan before viewing My plan."); } })); }
if (get("theme") === "dark") document.body.classList.add("dark-mode"); guardPlanLinks(); setupProfile(); setupProgressForm(); if (window.location.pathname.includes("plan.html")) renderPlan();
