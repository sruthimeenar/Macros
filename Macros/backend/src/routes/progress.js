const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  res.json({ history: db.getProgressHistory(req.user.id) });
});

router.post("/", requireAuth, (req, res) => {
  const { weight, waist, note } = req.body || {};
  db.addProgressEntry(req.user.id, { date: new Date().toLocaleDateString(), weight: weight || "", waist: waist || "", note: note || "" });
  res.status(201).json({ history: db.getProgressHistory(req.user.id) });
});

module.exports = router;
