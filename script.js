console.log("JS connected");

const form = document.getElementById("userForm");

const workoutResult = document.getElementById("workoutResult");
const mealResult = document.getElementById("mealResult");
const scheduleResult = document.getElementById("scheduleResult"); 

console.log(form);

function calculateBMI(weightKg, heightCm) {
    const heightM = heightCm/100;
    return (weightKg / (heightM * heightM)).toFixed(1);
}

function getBMIMessage(bmi) {
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Normal";
    if (bmi < 30) return "Overweight";
    return "Obese";
}

function lbToKg(lb) {
  return lb * 0.453592;
}

function inToCm(inches) {
  return inches * 2.54;
}

const quotes = [
  "Consistency beats motivation.",
  "You showed up. That matters.",
  "Progress > perfection.",
  "Small steps every day.",
  "Discipline builds confidence."
];

function getDailyQuote() {
  const day = new Date().getDate();
  return quotes[day % quotes.length];
}

if (form) {
  console.log("Form page detected");
  form.reset();

    form.addEventListener("submit", function(event){
        event.preventDefault();
        console.log("Button Clicked");
        
        const age = document.getElementById("ageInput").value;
        const goal = document.getElementById("goalSelect").value;
        const wakeTime = document.getElementById("wakeTime").value;
        const sleepTime = document.getElementById("sleepTime").value;


        let weight = Number(document.getElementById("weightInput").value);
        let height = Number(document.getElementById("heightInput").value);

        const weightUnit = document.getElementById("weightUnit").value;
        const heightUnit = document.getElementById("heightUnit").value;

        if (weightUnit === "lb") {
            weight = lbToKg(weight);
        }

        if (heightUnit === "in") {
            height = inToCm(height);
        }

        console.log("Internal weight (kg):", weight);
        console.log("Internal height (cm):", height);

        if(!age || !weight || !height) {
            alert("Bro fill in all the field first")
            return;
        }
        
        if (!wakeTime || !sleepTime) {
            alert("Add your wake & sleep time too gng");
            return;
        }
        console.log (age, goal);

        let workoutTime = "6:00 PM";
        let workoutType = "Full Body";

        const weightLossWorkouts = [
            "Cardio + Core at 7:00 AM",
            "HIIT at 6:30 AM",
            "Jogging + Abs at 7:00 AM"
        ];

        function randomItem(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        }

        function generateWorkout(goal) {
            if (goal === "Weight Loss") {
                workoutType = "Cardio + Core";
            }

            if (goal === "Muscle Gain") {
                workoutType = "Strength Training";
            }

            workoutTime = wakeTime;
            return workoutType + " at " + workoutTime;
            return randomItem(weightLossWorkouts);

        }

        function generateWeeklyWorkouts(goal) {
            if (goal === "Weight Loss") {
                return {
                    mon: "Cardio",
                    tue: "HIIT",
                    wed: "Core",
                    thu: "Jogging",
                    fri: "Cycling",
                    sat: "Yoga",
                    sun: "Rest"
                };
            }

            if (goal === "Muscle Gain") {
                return {
                    mon: "Chest",
                    tue: "Back",
                    wed: "Legs",
                    thu: "Shoulders",
                    fri: "Arms",
                    sat: "Full Body",
                    sun: "Rest"
                };
            }

            return {};
        }
        
        function generateMeals(goal) {
            if (goal === "Weight Loss") {
                return "Oats, Grilled Chicken, Salad";
            }
            if (goal === "Muscle Gain") {
                return "Eggs, Rice & Chicken, Peanut Butter Toast";
            }

            return "Balanced Meals";
        }
    
        function generateSchedule(workout) {
            return "Wake Up, Eat, " + workout + ", Shower, Sleep";
        }

        const workout = generateWorkout(goal);
        const meals = generateMeals(goal);
        const schedule = generateSchedule(workout);
        const bmi = calculateBMI(weight, height);
        const bmiMsg = getBMIMessage(bmi);
        const weeklyWorkouts = generateWeeklyWorkouts(goal);
        localStorage.setItem("weeklyWorkouts", JSON.stringify(weeklyWorkouts));

        localStorage.setItem("workout", workout);
        localStorage.setItem("meals", meals);
        localStorage.setItem("schedule", schedule);
        localStorage.setItem("weight", Math.round(weight));
        localStorage.setItem("height", Math.round(height));
        localStorage.setItem("goal", goal);
        localStorage.setItem("age", age);
        localStorage.setItem("wakeTime", wakeTime);
        localStorage.setItem("sleepTime", sleepTime);
        localStorage.setItem("bmi", bmi);
        localStorage.setItem("bmiMsg", bmiMsg);

        const plans = JSON.parse(localStorage.getItem("plans")) || [];

        plans.push({
            date: new Date().toLocaleDateString(),
            goal,
            workout,
            meals,
            schedule,
            bmi
        });

        localStorage.setItem("plans", JSON.stringify(plans));


        window.location.href = "plan.html"
    });
}

if (window.location.pathname.includes("plan.html")) {
    console.log("Plan page detected");
    
    document.getElementById("stats").innerText =
        "Goal: " + localStorage.getItem("goal");

        const workout = localStorage.getItem("workout");
        const meals = localStorage.getItem("meals");
        const schedule = localStorage.getItem("schedule");
        const wakeTime = localStorage.getItem("wakeTime");
        const sleepTime = localStorage.getItem("sleepTime");
        const bmi = localStorage.getItem("bmi");
        const bmiMsg = localStorage.getItem("bmiMsg");
        
        const weeklyWorkouts = JSON.parse(localStorage.getItem("weeklyWorkouts"));

        const mealBox = document.getElementById("mealsResult");
        const scheduleBox = document.getElementById("scheduleResult");
        const quoteBox = document.getElementById("quoteText");
        const bmiBox = document.getElementById("bmiResult");
        
        if (weeklyWorkouts) {
            const mon = document.getElementById("mon");
            const tue = document.getElementById("tue");
            const wed = document.getElementById("wed");
            const thu = document.getElementById("thu");
            const fri = document.getElementById("fri");
            const sat = document.getElementById("sat");
            const sun = document.getElementById("sun");

            if (mon) mon.innerText = weeklyWorkouts.mon;
            if (tue) tue.innerText = weeklyWorkouts.tue;
            if (wed) wed.innerText = weeklyWorkouts.wed;
            if (thu) thu.innerText = weeklyWorkouts.thu;
            if (fri) fri.innerText = weeklyWorkouts.fri;
            if (sat) sat.innerText = weeklyWorkouts.sat;
            if (sun) sun.innerText = weeklyWorkouts.sun;
        }

        if (mealBox) mealBox.innerText = meals;
        if (scheduleBox) {
            scheduleBox.innerText = `Wake up at ${wakeTime}, Workout, Eat, Chill, Sleep at ${sleepTime}`;
        }
        if (quoteBox) quoteBox.innerText = getDailyQuote();
        if (bmiBox) {
            bmiBox.innerText = `BMI: ${bmi} (${bmiMsg})`;
        }

        document.getElementById("workoutResult").innerText = workout || "Create a plan to get started.";
        document.getElementById("mealsResult").innerText = meals || "Your meal guidance will appear here.";
        document.getElementById("scheduleResult").innerText = schedule
            ? `Wake up at ${wakeTime}, workout, eat, recharge, sleep at ${sleepTime}.`
            : "Your daily rhythm will appear here.";
        document.getElementById("quoteText").innerText = getDailyQuote();

    function goBack () {
        window.location.href = "index.html";
    }
    function regenerate() {
        const goal = localStorage.getItem("goal");

        const workout =
        goal === "Muscle Gain"
        ? "Strength Training at 6:30 PM"
        : "Cardio + Core at 7:00 AM";

        const meals =
        goal === "Muscle Gain"
        ? "Eggs, Rice & Chicken, Peanut Butter Toast"
        : "Oats, Grilled Chicken, Salad";

        const schedule = "\nWake Up\n Eat \n Workout \n Shower \n Sleep";

        localStorage.setItem("workout", workout);
        localStorage.setItem("meals", meals);
        localStorage.setItem("schedule", schedule);

        location.reload();
    }
    function exportToCalendar() {
        const workout = localStorage.getItem("workout");

        const start = new Date();
        start.setHours(18, 0, 0);

        const end = new Date (start);
        end.setHours(start.getHours() + 1);

        const format = d => d.toISOString().replace(/[-:]/g, "").split(".")[0];

        const ics =
    `BEGIN:VCALENDAR
    VERSION:2.0
    BEGIN:VEVENT
    SUMMARY:${workout}
    DTSTART:${format(start)}
    DTEND:${format(end)}
    END:VEVENT
    END:VCALENDAR`;
        
        const blob = new Blob ([ics], { type: "text/calendar"});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "workout.ics";
        link.click();
    }
}
