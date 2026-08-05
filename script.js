const form = document.getElementById("userForm");
const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const quotes = ["Consistency beats motivation.", "You showed up. That matters.", "Progress over perfection.", "Small steps every day.", "Discipline builds confidence."];

function calculateBMI(weightKg, heightCm) { return (weightKg / Math.pow(heightCm / 100, 2)).toFixed(1); }
function getBMIMessage(bmi) { if (bmi < 18.5) return "Underweight"; if (bmi < 25) return "Normal"; if (bmi < 30) return "Overweight"; return "Obese"; }
function getDailyQuote() { return quotes[new Date().getDate() % quotes.length]; }

function getWeeklyWorkouts(goal, variation = 0) {
  const plans = {
    "Muscle Gain": [["Chest + triceps", "Bench press, incline dumbbell press, cable flyes, tricep pushdowns"], ["Back + biceps", "Lat pulldowns, seated rows, dumbbell curls, hammer curls"], ["Legs", "Squats, Romanian deadlifts, lunges, calf raises"], ["Shoulders + core", "Overhead press, lateral raises, planks, dead bugs"], ["Arms + conditioning", "Close-grip presses, curls, rope extensions, easy bike ride"], ["Full body", "Goblet squats, push-ups, rows, farmer carries"], ["Recovery", "Gentle walk, mobility flow, light stretching"]],
    "Weight Loss": [["Cardio + core", "Brisk walk or jog, mountain climbers, planks, bicycle crunches"], ["HIIT", "Bodyweight squats, jumping jacks, high knees, push-ups"], ["Low-impact cardio", "Cycling or incline walk, bird dogs, glute bridges"], ["Jogging + strength", "Easy jog, reverse lunges, rows, shoulder taps"], ["Circuit training", "Step-ups, squats, push-ups, plank holds"], ["Yoga + walk", "Sun salutations, hip openers, relaxed walk"], ["Recovery", "Mobility flow, gentle stretching, optional easy walk"]]
  };
  return plans[goal].map(([session, exercises]) => ({ session, exercises: variation % 2 && session !== "Recovery" ? `${exercises}. Finish with 5–10 minutes of stretching.` : exercises }));
}

function getWeeklyMeals(goal, variation = 0) {
  const plans = {
    "Muscle Gain": ["Eggs, oats, chicken rice bowl, Greek yogurt", "Peanut butter toast, turkey wrap, salmon and potatoes", "Overnight oats, beef rice bowl, cottage cheese and fruit", "Egg scramble, chicken pasta, yogurt with nuts", "Protein smoothie, tuna sandwich, tofu stir-fry", "Pancakes with fruit, burrito bowl, homemade burger", "Oats, roast chicken, rice and vegetables"],
    "Weight Loss": ["Oats with berries, grilled chicken salad, vegetable soup", "Eggs on toast, tuna salad wrap, salmon with greens", "Greek yogurt, lentil bowl, chicken and roasted vegetables", "Smoothie, turkey salad, tofu stir-fry", "Egg scramble, quinoa bowl, baked fish and greens", "Overnight oats, chicken wrap, vegetable curry", "Yogurt and fruit, lentil soup, grilled protein with salad"]
  };
  return plans[goal].map((meal, index) => variation % 2 && index < 6 ? `${meal}, plus a piece of fruit` : meal);
}

function savePlan(goal, wakeTime, variation = 0) {
  const weeklyWorkouts = getWeeklyWorkouts(goal, variation);
  const weeklyMeals = getWeeklyMeals(goal, variation);
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  localStorage.setItem("weeklyWorkouts", JSON.stringify(weeklyWorkouts));
  localStorage.setItem("weeklyMeals", JSON.stringify(weeklyMeals));
  localStorage.setItem("workout", `${weeklyWorkouts[todayIndex].session} at ${wakeTime}`);
  localStorage.setItem("meals", weeklyMeals[todayIndex]);
  localStorage.setItem("schedule", `Wake up at ${wakeTime}, move with intention, fuel well, and recharge.`);
  localStorage.setItem("planVariation", String(variation));
}

if (form) {
  form.reset();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const age = document.getElementById("ageInput").value;
    const goal = document.getElementById("goalSelect").value;
    const wakeTime = document.getElementById("wakeTime").value;
    const sleepTime = document.getElementById("sleepTime").value;
    let weight = Number(document.getElementById("weightInput").value);
    let height = Number(document.getElementById("heightInput").value);
    if (document.getElementById("weightUnit").value === "lb") weight *= 0.453592;
    if (document.getElementById("heightUnit").value === "in") height *= 2.54;
    if (!age || !weight || !height || !wakeTime || !sleepTime) { alert("Please complete every field before generating your plan."); return; }
    const bmi = calculateBMI(weight, height);
    savePlan(goal, wakeTime);
    localStorage.setItem("goal", goal); localStorage.setItem("age", age); localStorage.setItem("wakeTime", wakeTime); localStorage.setItem("sleepTime", sleepTime); localStorage.setItem("bmi", bmi); localStorage.setItem("bmiMsg", getBMIMessage(bmi));
    window.location.href = "plan.html";
  });
}

function renderPlan() {
  const goal = localStorage.getItem("goal");
  const weeklyWorkouts = JSON.parse(localStorage.getItem("weeklyWorkouts") || "null");
  const weeklyMeals = JSON.parse(localStorage.getItem("weeklyMeals") || "null");
  document.getElementById("stats").innerText = `Goal: ${goal || "—"}`;
  document.getElementById("quoteText").innerText = getDailyQuote();
  document.getElementById("bmiResult").innerText = localStorage.getItem("bmi") ? `BMI: ${localStorage.getItem("bmi")} (${localStorage.getItem("bmiMsg")})` : "Create a plan to get started.";
  document.getElementById("workoutResult").innerText = localStorage.getItem("workout") || "Create a plan to get started.";
  document.getElementById("mealsResult").innerText = localStorage.getItem("meals") || "Your weekly meals will appear here.";
  document.getElementById("scheduleResult").innerText = localStorage.getItem("schedule") || "Your daily rhythm will appear here.";
  if (Array.isArray(weeklyWorkouts)) dayKeys.forEach((key, index) => { document.getElementById(key).innerText = weeklyWorkouts[index].session; document.getElementById(`${key}Exercises`).innerText = weeklyWorkouts[index].exercises; });
  if (Array.isArray(weeklyMeals)) dayKeys.forEach((key, index) => { document.getElementById(`${key}Meal`).innerText = weeklyMeals[index]; });
}

window.goBack = () => { window.location.href = "index.html"; };
window.regenerate = () => { const goal = localStorage.getItem("goal"); const wakeTime = localStorage.getItem("wakeTime"); if (!goal || !wakeTime) { window.location.href = "index.html"; return; } savePlan(goal, wakeTime, Number(localStorage.getItem("planVariation") || 0) + 1); renderPlan(); };
window.exportToCalendar = () => { const start = new Date(); start.setHours(18, 0, 0, 0); const end = new Date(start); end.setHours(end.getHours() + 1); const format = (date) => date.toISOString().replace(/[-:]/g, "").split(".")[0]; const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:${localStorage.getItem("workout") || "Workout"}\r\nDTSTART:${format(start)}\r\nDTEND:${format(end)}\r\nEND:VEVENT\r\nEND:VCALENDAR`; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); link.download = "workout.ics"; link.click(); URL.revokeObjectURL(link.href); };

if (window.location.pathname.includes("plan.html")) renderPlan();
