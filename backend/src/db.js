const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon (and most managed Postgres) require SSL. Set PGSSL=false in .env for a local
  // Postgres install that doesn't have SSL configured.
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
});
pool.on("error", err => console.error("[db] unexpected error on idle client", err));

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      age INTEGER, weight REAL, height REAL, goal TEXT, level TEXT, equipment TEXT, diet TEXT,
      wake_time TEXT, sleep_time TEXT, bmi REAL, bmi_msg TEXT,
      calories INTEGER, protein INTEGER, carbs INTEGER, fat INTEGER,
      updated_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS plans (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      variation INTEGER DEFAULT 0,
      workouts_json TEXT,
      meals_json TEXT,
      updated_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS completed_workouts (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS progress_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      weight TEXT, waist TEXT, note TEXT,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      steps INTEGER, heart_rate INTEGER, calories INTEGER, sleep REAL, source TEXT,
      updated_at BIGINT,
      PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS device_tokens (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      access_token TEXT, refresh_token TEXT, expires_at BIGINT,
      provider_user_id TEXT, scope TEXT, updated_at BIGINT,
      PRIMARY KEY (user_id, provider)
    );
  `);
}

/* ---------- users ---------- */
async function createUser({ email, name, passwordHash, passwordSalt }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, password_hash, password_salt, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [email, name, passwordHash, passwordSalt, Date.now()]
  );
  return rows[0];
}
async function getUserByEmail(email) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE email = $1`, [email.trim().toLowerCase()]);
  return rows[0] || null;
}
async function getUserById(id) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

/* ---------- profile ---------- */
async function saveProfile(userId, profile) {
  await pool.query(`
    INSERT INTO profiles (user_id, age, weight, height, goal, level, equipment, diet, wake_time, sleep_time, bmi, bmi_msg, calories, protein, carbs, fat, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    ON CONFLICT (user_id) DO UPDATE SET age=EXCLUDED.age, weight=EXCLUDED.weight, height=EXCLUDED.height, goal=EXCLUDED.goal,
      level=EXCLUDED.level, equipment=EXCLUDED.equipment, diet=EXCLUDED.diet, wake_time=EXCLUDED.wake_time, sleep_time=EXCLUDED.sleep_time,
      bmi=EXCLUDED.bmi, bmi_msg=EXCLUDED.bmi_msg, calories=EXCLUDED.calories, protein=EXCLUDED.protein, carbs=EXCLUDED.carbs, fat=EXCLUDED.fat, updated_at=EXCLUDED.updated_at
  `, [userId, profile.age, profile.weight, profile.height, profile.goal, profile.level, profile.equipment, profile.diet,
      profile.wakeTime, profile.sleepTime, profile.bmi, profile.bmiMsg, profile.targets.calories, profile.targets.protein,
      profile.targets.carbs, profile.targets.fat, Date.now()]);
}
async function getProfile(userId) {
  const { rows } = await pool.query(`SELECT * FROM profiles WHERE user_id = $1`, [userId]);
  const row = rows[0]; if (!row) return null;
  return {
    age: row.age, weight: row.weight, height: row.height, goal: row.goal, level: row.level, equipment: row.equipment, diet: row.diet,
    wakeTime: row.wake_time, sleepTime: row.sleep_time, bmi: row.bmi, bmiMsg: row.bmi_msg,
    targets: { calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat },
  };
}

/* ---------- plan ---------- */
async function savePlan(userId, variation, workouts, meals) {
  await pool.query(`
    INSERT INTO plans (user_id, variation, workouts_json, meals_json, updated_at) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (user_id) DO UPDATE SET variation=EXCLUDED.variation, workouts_json=EXCLUDED.workouts_json, meals_json=EXCLUDED.meals_json, updated_at=EXCLUDED.updated_at
  `, [userId, variation, JSON.stringify(workouts), JSON.stringify(meals), Date.now()]);
}
async function getPlan(userId) {
  const { rows } = await pool.query(`SELECT * FROM plans WHERE user_id = $1`, [userId]);
  const row = rows[0]; if (!row) return null;
  return { variation: row.variation, workouts: JSON.parse(row.workouts_json), meals: JSON.parse(row.meals_json) };
}

/* ---------- workout completion ---------- */
async function setWorkoutDone(userId, date, done) {
  if (done) await pool.query(`INSERT INTO completed_workouts (user_id, date) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [userId, date]);
  else await pool.query(`DELETE FROM completed_workouts WHERE user_id = $1 AND date = $2`, [userId, date]);
}
async function getCompletedWorkouts(userId) {
  const { rows } = await pool.query(`SELECT date FROM completed_workouts WHERE user_id = $1 ORDER BY date DESC`, [userId]);
  return rows.map(r => r.date);
}

/* ---------- progress ---------- */
async function addProgressEntry(userId, entry) {
  await pool.query(`INSERT INTO progress_history (user_id, date, weight, waist, note, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, entry.date, entry.weight, entry.waist, entry.note, Date.now()]);
}
async function getProgressHistory(userId) {
  const { rows } = await pool.query(`SELECT date, weight, waist, note FROM progress_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 12`, [userId]);
  return rows;
}

/* ---------- activity ---------- */
async function saveActivity(userId, date, activity) {
  await pool.query(`
    INSERT INTO activity_log (user_id, date, steps, heart_rate, calories, sleep, source, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (user_id, date) DO UPDATE SET steps=EXCLUDED.steps, heart_rate=EXCLUDED.heart_rate, calories=EXCLUDED.calories, sleep=EXCLUDED.sleep, source=EXCLUDED.source, updated_at=EXCLUDED.updated_at
  `, [userId, date, activity.steps ?? null, activity.heartRate ?? null, activity.calories ?? null, activity.sleep ?? null, activity.source || "manual", Date.now()]);
}
async function getActivity(userId, date) {
  const { rows } = await pool.query(`SELECT * FROM activity_log WHERE user_id = $1 AND date = $2`, [userId, date]);
  const row = rows[0]; if (!row) return null;
  return { steps: row.steps, heartRate: row.heart_rate, calories: row.calories, sleep: row.sleep, source: row.source };
}

/* ---------- device tokens ---------- */
async function saveDeviceTokens(userId, provider, tokens) {
  await pool.query(`
    INSERT INTO device_tokens (user_id, provider, access_token, refresh_token, expires_at, provider_user_id, scope, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (user_id, provider) DO UPDATE SET access_token=EXCLUDED.access_token, refresh_token=EXCLUDED.refresh_token,
      expires_at=EXCLUDED.expires_at, provider_user_id=EXCLUDED.provider_user_id, scope=EXCLUDED.scope, updated_at=EXCLUDED.updated_at
  `, [userId, provider, tokens.accessToken, tokens.refreshToken, tokens.expiresAt, tokens.providerUserId || null, tokens.scope || null, Date.now()]);
}
async function getDeviceTokens(userId, provider) {
  const { rows } = await pool.query(`SELECT * FROM device_tokens WHERE user_id = $1 AND provider = $2`, [userId, provider]);
  const row = rows[0]; if (!row) return null;
  return { accessToken: row.access_token, refreshToken: row.refresh_token, expiresAt: Number(row.expires_at), providerUserId: row.provider_user_id, scope: row.scope };
}
async function deleteDeviceTokens(userId, provider) { await pool.query(`DELETE FROM device_tokens WHERE user_id = $1 AND provider = $2`, [userId, provider]); }
async function listDeviceProviders(userId) {
  const { rows } = await pool.query(`SELECT provider FROM device_tokens WHERE user_id = $1`, [userId]);
  return rows.map(r => r.provider);
}
async function listAllDeviceTokens() {
  const { rows } = await pool.query(`SELECT user_id, provider FROM device_tokens`);
  return rows;
}
async function getUserIdByProviderUserId(provider, providerUserId) {
  const { rows } = await pool.query(`SELECT user_id FROM device_tokens WHERE provider = $1 AND provider_user_id = $2`, [provider, providerUserId]);
  return rows[0] ? rows[0].user_id : null;
}

module.exports = {
  init,
  createUser, getUserByEmail, getUserById,
  saveProfile, getProfile, savePlan, getPlan,
  setWorkoutDone, getCompletedWorkouts, addProgressEntry, getProgressHistory,
  saveActivity, getActivity,
  saveDeviceTokens, getDeviceTokens, deleteDeviceTokens, listDeviceProviders, listAllDeviceTokens, getUserIdByProviderUserId,
};
