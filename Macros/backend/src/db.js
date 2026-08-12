const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "macros.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER, weight REAL, height REAL, goal TEXT, level TEXT, equipment TEXT, diet TEXT,
  wake_time TEXT, sleep_time TEXT, bmi REAL, bmi_msg TEXT,
  calories INTEGER, protein INTEGER, carbs INTEGER, fat INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS plans (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  variation INTEGER DEFAULT 0,
  workouts_json TEXT,
  meals_json TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS completed_workouts (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS progress_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  weight TEXT, waist TEXT, note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  steps INTEGER, heart_rate INTEGER, calories INTEGER, sleep REAL, source TEXT,
  updated_at INTEGER,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS device_tokens (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT, refresh_token TEXT, expires_at INTEGER,
  provider_user_id TEXT, scope TEXT, updated_at INTEGER,
  PRIMARY KEY (user_id, provider)
);
`);

/* ---------- users ---------- */
const stmt = {
  insertUser: db.prepare("INSERT INTO users (email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)"),
  getUserByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
  getUserById: db.prepare("SELECT * FROM users WHERE id = ?"),

  upsertProfile: db.prepare(`
    INSERT INTO profiles (user_id, age, weight, height, goal, level, equipment, diet, wake_time, sleep_time, bmi, bmi_msg, calories, protein, carbs, fat, updated_at)
    VALUES (@user_id, @age, @weight, @height, @goal, @level, @equipment, @diet, @wake_time, @sleep_time, @bmi, @bmi_msg, @calories, @protein, @carbs, @fat, @updated_at)
    ON CONFLICT(user_id) DO UPDATE SET age=excluded.age, weight=excluded.weight, height=excluded.height, goal=excluded.goal,
      level=excluded.level, equipment=excluded.equipment, diet=excluded.diet, wake_time=excluded.wake_time, sleep_time=excluded.sleep_time,
      bmi=excluded.bmi, bmi_msg=excluded.bmi_msg, calories=excluded.calories, protein=excluded.protein, carbs=excluded.carbs, fat=excluded.fat, updated_at=excluded.updated_at
  `),
  getProfile: db.prepare("SELECT * FROM profiles WHERE user_id = ?"),

  upsertPlan: db.prepare(`
    INSERT INTO plans (user_id, variation, workouts_json, meals_json, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET variation=excluded.variation, workouts_json=excluded.workouts_json, meals_json=excluded.meals_json, updated_at=excluded.updated_at
  `),
  getPlan: db.prepare("SELECT * FROM plans WHERE user_id = ?"),

  markWorkoutDone: db.prepare("INSERT OR IGNORE INTO completed_workouts (user_id, date) VALUES (?, ?)"),
  unmarkWorkoutDone: db.prepare("DELETE FROM completed_workouts WHERE user_id = ? AND date = ?"),
  getCompletedWorkouts: db.prepare("SELECT date FROM completed_workouts WHERE user_id = ? ORDER BY date DESC"),

  insertProgress: db.prepare("INSERT INTO progress_history (user_id, date, weight, waist, note, created_at) VALUES (?, ?, ?, ?, ?, ?)"),
  getProgressHistory: db.prepare("SELECT * FROM progress_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 12"),

  upsertActivity: db.prepare(`
    INSERT INTO activity_log (user_id, date, steps, heart_rate, calories, sleep, source, updated_at) VALUES (@user_id, @date, @steps, @heart_rate, @calories, @sleep, @source, @updated_at)
    ON CONFLICT(user_id, date) DO UPDATE SET steps=excluded.steps, heart_rate=excluded.heart_rate, calories=excluded.calories, sleep=excluded.sleep, source=excluded.source, updated_at=excluded.updated_at
  `),
  getActivity: db.prepare("SELECT * FROM activity_log WHERE user_id = ? AND date = ?"),

  upsertDeviceTokens: db.prepare(`
    INSERT INTO device_tokens (user_id, provider, access_token, refresh_token, expires_at, provider_user_id, scope, updated_at)
    VALUES (@user_id, @provider, @access_token, @refresh_token, @expires_at, @provider_user_id, @scope, @updated_at)
    ON CONFLICT(user_id, provider) DO UPDATE SET access_token=excluded.access_token, refresh_token=excluded.refresh_token,
      expires_at=excluded.expires_at, provider_user_id=excluded.provider_user_id, scope=excluded.scope, updated_at=excluded.updated_at
  `),
  getDeviceTokens: db.prepare("SELECT * FROM device_tokens WHERE user_id = ? AND provider = ?"),
  deleteDeviceTokens: db.prepare("DELETE FROM device_tokens WHERE user_id = ? AND provider = ?"),
  listDeviceProviders: db.prepare("SELECT provider FROM device_tokens WHERE user_id = ?"),
  listAllDeviceTokens: db.prepare("SELECT * FROM device_tokens"),
  getUserIdByProviderUserId: db.prepare("SELECT user_id FROM device_tokens WHERE provider = ? AND provider_user_id = ?"),
};

function createUser({ email, name, passwordHash, passwordSalt }) {
  const info = stmt.insertUser.run(email, name, passwordHash, passwordSalt, Date.now());
  return stmt.getUserById.get(info.lastInsertRowid);
}
function getUserByEmail(email) { return stmt.getUserByEmail.get(email.trim().toLowerCase()); }
function getUserById(id) { return stmt.getUserById.get(id); }

function saveProfile(userId, profile) {
  stmt.upsertProfile.run({
    user_id: userId, age: profile.age, weight: profile.weight, height: profile.height, goal: profile.goal,
    level: profile.level, equipment: profile.equipment, diet: profile.diet, wake_time: profile.wakeTime, sleep_time: profile.sleepTime,
    bmi: profile.bmi, bmi_msg: profile.bmiMsg, calories: profile.targets.calories, protein: profile.targets.protein,
    carbs: profile.targets.carbs, fat: profile.targets.fat, updated_at: Date.now(),
  });
}
function getProfile(userId) {
  const row = stmt.getProfile.get(userId);
  if (!row) return null;
  return {
    age: row.age, weight: row.weight, height: row.height, goal: row.goal, level: row.level, equipment: row.equipment, diet: row.diet,
    wakeTime: row.wake_time, sleepTime: row.sleep_time, bmi: row.bmi, bmiMsg: row.bmi_msg,
    targets: { calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat },
  };
}

function savePlan(userId, variation, workouts, meals) {
  stmt.upsertPlan.run(userId, variation, JSON.stringify(workouts), JSON.stringify(meals), Date.now());
}
function getPlan(userId) {
  const row = stmt.getPlan.get(userId);
  if (!row) return null;
  return { variation: row.variation, workouts: JSON.parse(row.workouts_json), meals: JSON.parse(row.meals_json) };
}

function setWorkoutDone(userId, date, done) {
  if (done) stmt.markWorkoutDone.run(userId, date); else stmt.unmarkWorkoutDone.run(userId, date);
}
function getCompletedWorkouts(userId) { return stmt.getCompletedWorkouts.all(userId).map(r => r.date); }

function addProgressEntry(userId, entry) {
  stmt.insertProgress.run(userId, entry.date, entry.weight, entry.waist, entry.note, Date.now());
}
function getProgressHistory(userId) { return stmt.getProgressHistory.all(userId); }

function saveActivity(userId, date, activity) {
  stmt.upsertActivity.run({
    user_id: userId, date, steps: activity.steps ?? null, heart_rate: activity.heartRate ?? null,
    calories: activity.calories ?? null, sleep: activity.sleep ?? null, source: activity.source || "manual", updated_at: Date.now(),
  });
}
function getActivity(userId, date) {
  const row = stmt.getActivity.get(userId, date);
  if (!row) return null;
  return { steps: row.steps, heartRate: row.heart_rate, calories: row.calories, sleep: row.sleep, source: row.source };
}

function saveDeviceTokens(userId, provider, tokens) {
  stmt.upsertDeviceTokens.run({
    user_id: userId, provider, access_token: tokens.accessToken, refresh_token: tokens.refreshToken,
    expires_at: tokens.expiresAt, provider_user_id: tokens.providerUserId || null, scope: tokens.scope || null, updated_at: Date.now(),
  });
}
function getDeviceTokens(userId, provider) {
  const row = stmt.getDeviceTokens.get(userId, provider);
  if (!row) return null;
  return { accessToken: row.access_token, refreshToken: row.refresh_token, expiresAt: row.expires_at, providerUserId: row.provider_user_id, scope: row.scope };
}
function deleteDeviceTokens(userId, provider) { stmt.deleteDeviceTokens.run(userId, provider); }
function listDeviceProviders(userId) { return stmt.listDeviceProviders.all(userId).map(r => r.provider); }
function listAllDeviceTokens() { return stmt.listAllDeviceTokens.all(); }
function getUserIdByProviderUserId(provider, providerUserId) {
  const row = stmt.getUserIdByProviderUserId.get(provider, providerUserId);
  return row ? row.user_id : null;
}

module.exports = {
  createUser, getUserByEmail, getUserById,
  saveProfile, getProfile, savePlan, getPlan,
  setWorkoutDone, getCompletedWorkouts, addProgressEntry, getProgressHistory,
  saveActivity, getActivity,
  saveDeviceTokens, getDeviceTokens, deleteDeviceTokens, listDeviceProviders, listAllDeviceTokens, getUserIdByProviderUserId,
};
