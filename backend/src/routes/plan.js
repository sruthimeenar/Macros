const express = require("express");
const db = require("../db");
const plan = require("../plan");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.get("/profile", requireAuth, async (req, res) => {
  res.json({ profile: await db.getProfile(req.user.id) });
});

// Saving a profile also (re)generates the plan from scratch, matching the original
// "fill in the form -> get a plan" flow.
router.put("/profile", requireAuth, async (req, res) => {
  const input = req.body || {};
  const required = ["age", "weight", "height", "goal", "level", "equipment", "diet", "wakeTime", "sleepTime"];
  const missing = required.filter(key => input[key] === undefined || input[key] === "");
  if (missing.length) return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });

  const profile = plan.buildProfile({
    age: Number(input.age), weight: Number(input.weight), height: Number(input.height),
    goal: input.goal, level: input.level, equipment: input.equipment, diet: input.diet,
    wakeTime: input.wakeTime, sleepTime: input.sleepTime,
  });
  await db.saveProfile(req.user.id, profile);
  const { workouts, meals } = plan.buildPlan(profile, 0);
  await db.savePlan(req.user.id, 0, workouts, meals);
  res.json({ profile });
});

router.get("/plan", requireAuth, async (req, res) => {
  const profile = await db.getProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: "No plan yet - fill in your details first." });
  let saved = await db.getPlan(req.user.id);
  if (!saved) {
    const built = plan.buildPlan(profile, 0);
    await db.savePlan(req.user.id, 0, built.workouts, built.meals);
    saved = { variation: 0, ...built };
  }
  res.json({ profile, variation: saved.variation, workouts: saved.workouts, meals: saved.meals, completedWorkouts: await db.getCompletedWorkouts(req.user.id) });
});

router.post("/plan/regenerate", requireAuth, async (req, res) => {
  const profile = await db.getProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: "No plan yet - fill in your details first." });
  const current = await db.getPlan(req.user.id);
  const variation = ((current?.variation ?? 0) + 1) % 3;
  const { workouts, meals } = plan.buildPlan(profile, variation);
  await db.savePlan(req.user.id, variation, workouts, meals);
  res.json({ variation, workouts, meals });
});

router.post("/plan/complete", requireAuth, async (req, res) => {
  const { date, done } = req.body || {};
  if (!date) return res.status(400).json({ error: "Missing date." });
  await db.setWorkoutDone(req.user.id, date, !!done);
  res.json({ completedWorkouts: await db.getCompletedWorkouts(req.user.id) });
});

module.exports = router;
