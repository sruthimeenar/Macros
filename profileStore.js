const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "profiles.json");

function ensureFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "{}");
}

function readAll() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function defaultRecord() {
  return {
    profile: null,
    weeklyWorkouts: [],
    weeklyMeals: [],
    planVariation: 0,
    completedWorkouts: [],
    progressHistory: [],
    activityLog: {},
  };
}

// key: email -> { profile, weeklyWorkouts, weeklyMeals, planVariation,
//                  completedWorkouts: [dates], progressHistory: [entries], activityLog: { date: entry } }
function getProfile(email) {
  const data = readAll();
  return data[email] || null;
}

function saveProfile(email, { profile, weeklyWorkouts, weeklyMeals, planVariation }) {
  const data = readAll();
  const rec = data[email] || defaultRecord();
  data[email] = {
    ...rec,
    profile,
    weeklyWorkouts: weeklyWorkouts || [],
    weeklyMeals: weeklyMeals || [],
    planVariation: planVariation || 0,
  };
  writeAll(data);
}

function getCompletedWorkouts(email) {
  const data = readAll();
  return data[email]?.completedWorkouts || [];
}

function setWorkoutComplete(email, date, completed) {
  const data = readAll();
  const rec = data[email] || defaultRecord();
  const set = new Set(rec.completedWorkouts || []);
  if (completed) set.add(date);
  else set.delete(date);
  rec.completedWorkouts = [...set];
  data[email] = rec;
  writeAll(data);
}

function getProgressHistory(email) {
  const data = readAll();
  return data[email]?.progressHistory || [];
}

function addProgress(email, entry) {
  const data = readAll();
  const rec = data[email] || defaultRecord();
  rec.progressHistory = [entry, ...(rec.progressHistory || [])].slice(0, 12);
  data[email] = rec;
  writeAll(data);
}

function saveActivity(email, date, entry) {
  const data = readAll();
  const rec = data[email] || defaultRecord();
  rec.activityLog = { ...(rec.activityLog || {}), [date]: entry };
  data[email] = rec;
  writeAll(data);
}

function getActivity(email, date) {
  const data = readAll();
  return data[email]?.activityLog?.[date] || null;
}

module.exports = {
  getProfile,
  saveProfile,
  getCompletedWorkouts,
  setWorkoutComplete,
  getProgressHistory,
  addProgress,
  saveActivity,
  getActivity,
};
