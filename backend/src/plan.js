function calculateBMI(weight, height) { return Number((weight / Math.pow(height / 100, 2)).toFixed(1)); }
function bmiMessage(bmi) { return bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese"; }

function calculateTargets({ age, weight, height, goal, level }) {
  const bmr = 10 * weight + 6.25 * height - 5 * age - 78;
  const activityMultiplier = level === "Beginner" ? 1.4 : level === "Advanced" ? 1.65 : 1.55;
  let calories = bmr * activityMultiplier;
  calories = goal === "Muscle Gain" ? calories * 1.12 : calories * 0.82;
  const proteinPerKg = goal === "Muscle Gain" ? 2.0 : 2.2;
  const protein = Math.round(proteinPerKg * weight);
  const fatCalories = calories * 0.27;
  const fat = Math.round(fatCalories / 9);
  const carbCalories = Math.max(calories - protein * 4 - fatCalories, 0);
  const carbs = Math.round(carbCalories / 4);
  return { calories: Math.round(calories), protein, carbs, fat };
}

function workoutLibrary(goal, variation, equipment, level) {
  const volume = level === "Beginner" ? "2 sets" : level === "Advanced" ? "4 sets" : "3 sets";
  const rest = level === "Advanced" ? "75 sec rest" : "60 sec rest";
  const repRange = goal === "Muscle Gain" ? "8-12" : "12-15";
  const gym = equipment === "Gym";
  const dumbbells = equipment === "Dumbbells" || gym;
  const presses = gym ? "Barbell bench press" : dumbbells ? "Dumbbell floor press" : "Push-ups";
  const pulls = gym ? "Lat pulldown" : dumbbells ? "Dumbbell row" : "Towel rows";
  const squats = gym ? "Back squat" : dumbbells ? "Goblet squat" : "Bodyweight squat";
  const hinges = gym ? "Romanian deadlift" : dumbbells ? "Dumbbell deadlift" : "Glute bridge";
  const cardioMove = gym ? "Rowing machine intervals" : dumbbells ? "Brisk walk with a light carry" : "Brisk walk or jog";
  const lowImpactCardio = gym ? "Incline treadmill walk" : "Cycling or incline walk";
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
  return (diet === "Vegan" ? vegan : diet === "Vegetarian" ? vegetarian : goal === "Muscle Gain" ? gain : loss).map(meal => {
    let dayMeal = meal;
    if (variation % 3 === 1) dayMeal += "; a small side of fruit or nuts";
    if (variation % 3 === 2) dayMeal += "; extra colourful vegetables";
    return { meal: dayMeal, macros: `${targets.calories} kcal | ${targets.protein}g protein | ${targets.carbs}g carbs | ${targets.fat}g fats` };
  });
}

function buildProfile(input) {
  const bmi = calculateBMI(input.weight, input.height);
  const profile = { ...input, bmi, bmiMsg: bmiMessage(bmi) };
  profile.targets = calculateTargets(profile);
  return profile;
}

function buildPlan(profile, variation = 0) {
  const workouts = workoutLibrary(profile.goal, variation, profile.equipment, profile.level);
  const meals = mealLibrary(profile.goal, profile.diet, profile.targets, variation);
  return { workouts, meals };
}

module.exports = { calculateBMI, bmiMessage, calculateTargets, workoutLibrary, mealLibrary, buildProfile, buildPlan };
