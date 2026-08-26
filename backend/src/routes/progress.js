const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  res.json({ history: await db.getProgressHistory(req.user.id) });
});

router.post("/", requireAuth, async (req, res) => {
  const { weight, waist, note } = req.body || {};
  await db.addProgressEntry(req.user.id, { date: new Date().toLocaleDateString(), weight: weight || "", waist: waist || "", note: note || "" });
  res.status(201).json({ history: await db.getProgressHistory(req.user.id) });
});

module.exports = router;
