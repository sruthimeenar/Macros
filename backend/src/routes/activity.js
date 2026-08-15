const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const fitbit = require("../providers/fitbit");
const googleFit = require("../providers/googleFit");

const providers = { fitbit, googleFit };
const router = express.Router();

function today() { return new Date().toISOString().slice(0, 10); }

router.get("/today", requireAuth, async (req, res) => {
  res.json({ activity: await db.getActivity(req.user.id, today()) });
});

// Manual log entry (fallback for when no device is connected, or an unsupported device).
// Merges with today's existing entry rather than overwriting it, so filling in just one
// field (e.g. sleep) doesn't blank out values a device already synced for the others.
router.post("/manual", requireAuth, async (req, res) => {
  const { steps, heartRate, calories, sleep } = req.body || {};
  const clean = v => (v === "" || v === undefined || v === null) ? null : v;
  const existing = (await db.getActivity(req.user.id, today())) || {};
  const merged = {
    steps: clean(steps) ?? existing.steps ?? null,
    heartRate: clean(heartRate) ?? existing.heartRate ?? null,
    calories: clean(calories) ?? existing.calories ?? null,
    sleep: clean(sleep) ?? existing.sleep ?? null,
    source: "manual",
  };
  await db.saveActivity(req.user.id, today(), merged);
  res.json({ activity: await db.getActivity(req.user.id, today()) });
});

// On-demand sync, still available for an immediate refresh even though the background
// scheduler (see scheduler.js) keeps this up to date automatically for connected accounts.
router.post("/sync", requireAuth, async (req, res) => {
  const connected = await db.listDeviceProviders(req.user.id);
  if (connected.length === 0) return res.status(404).json({ error: "No device connected for this account." });
  try {
    const results = await Promise.all(connected.map(async name => ({ name, data: await providers[name].fetchTodayActivity(req.user.id) })));
    const best = results.find(r => r.data) || results[0];
    if (!best.data) return res.status(502).json({ error: "No activity data returned yet." });
    await db.saveActivity(req.user.id, today(), best.data);
    res.json({ activity: await db.getActivity(req.user.id, today()) });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Could not reach the device provider. Try again shortly." });
  }
});

module.exports = router;
