const express = require("express");
const store = require("../store");
const fitbit = require("../providers/fitbit");
const googleFit = require("../providers/googleFit");

const providers = { fitbit, googleFit };
const router = express.Router();

// Pulls today's activity from whichever connected provider(s) the user has, preferring
// the most recently updated connection if more than one is linked.
router.get("/today", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Missing email." });

  const connected = store.listProviders(email);
  if (connected.length === 0) return res.status(404).json({ error: "No device connected for this account." });

  try {
    const results = await Promise.all(
      connected.map(async name => ({ name, data: await providers[name].fetchTodayActivity(email) }))
    );
    const best = results.find(r => r.data) || results[0];
    res.json(best.data || { error: "No activity data returned yet." });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Could not reach the device provider. Try again shortly." });
  }
});

module.exports = router;
