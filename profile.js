const express = require("express");
const profileStore = require("../profileStore");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

// ---- profile + generated plan ----
router.get("/profile", (req, res) => {
  const record = profileStore.getProfile(req.user.email);
  res.json(record || { profile: null });
});

router.put("/profile", (req, res) => {
  const { profile, weeklyWorkouts, weeklyMeals, planVariation } = req.body || {};
  if (!profile) return res.status(400).json({ error: "profile is required." });
  profileStore.saveProfile(req.user.email, { profile, weeklyWorkouts, weeklyMeals, planVariation });
  res.json({ ok: true });
});

// ---- completed workout dates (for streaks) ----
router.get("/workouts/completed", (req, res) => {
  res.json({ dates: profileStore.getCompletedWorkouts(req.user.email) });
});

router.post("/workouts/complete", (req, res) => {
  const { date, completed } = req.body || {};
  if (!date) return res.status(400).json({ error: "date is required." });
  profileStore.setWorkoutComplete(req.user.email, date, !!completed);
  res.json({ ok: true });
});

// ---- progress check-ins ----
router.get("/progress", (req, res) => {
  res.json({ history: profileStore.getProgressHistory(req.user.email) });
});

router.post("/progress", (req, res) => {
  const { date, weight, waist, note } = req.body || {};
  profileStore.addProgress(req.user.email, {
    date: date || new Date().toLocaleDateString(),
    weight: weight || null,
    waist: waist || null,
    note: note || null,
  });
  res.status(201).json({ ok: true });
});

// ---- manual activity log (fallback when no device is connected - see routes/activity.js
//      for the device-synced version at GET /api/activity/today) ----
router.post("/activity", (req, res) => {
  const { date, steps, heartRate, calories, sleep, source } = req.body || {};
  const day = date || new Date().toISOString().slice(0, 10);
  profileStore.saveActivity(req.user.email, day, {
    steps: steps ?? null,
    heartRate: heartRate ?? null,
    calories: calories ?? null,
    sleep: sleep ?? null,
    source: source || "manual",
  });
  res.json({ ok: true });
});

router.get("/activity/:date", (req, res) => {
  res.json({ entry: profileStore.getActivity(req.user.email, req.params.date) });
});

module.exports = router;
