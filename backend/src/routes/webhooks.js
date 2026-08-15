const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const fitbit = require("../providers/fitbit");

const router = express.Router();

// Fitbit verifies ownership of this endpoint with a GET request carrying a verify code you
// generate in the dev dashboard's "Subscriber" settings. Respond 204 if it matches, 404 if not.
router.get("/fitbit", (req, res) => {
  const verify = req.query.verify;
  if (verify && process.env.FITBIT_VERIFY_CODE && verify === process.env.FITBIT_VERIFY_CODE) return res.sendStatus(204);
  res.sendStatus(404);
});

// Fitbit POSTs a JSON array of notifications here whenever a connected user's data changes.
// Each notification just says "something changed for this user" - the actual new values still
// have to be fetched via the normal API, which is what fitbit.fetchTodayActivity does.
router.post("/fitbit", express.json({
  verify: (req, res, buf) => { req.rawBody = buf; },
}), async (req, res) => {
  const signature = req.headers["x-fitbit-signature"];
  if (process.env.FITBIT_CLIENT_SECRET && signature) {
    const expected = crypto.createHmac("sha1", `${process.env.FITBIT_CLIENT_SECRET}&`).update(req.rawBody || Buffer.alloc(0)).digest("base64");
    if (signature !== expected) return res.sendStatus(401);
  }
  res.sendStatus(204); // ack immediately - Fitbit expects a fast response and retries otherwise

  const notifications = Array.isArray(req.body) ? req.body : [];
  for (const note of notifications) {
    const userId = await db.getUserIdByProviderUserId("fitbit", note.ownerId);
    if (!userId) continue;
    try {
      const data = await fitbit.fetchTodayActivity(userId);
      if (data) await db.saveActivity(userId, new Date().toISOString().slice(0, 10), data);
    } catch (err) {
      console.error(`[webhook] fitbit sync failed for user ${userId}:`, err.message);
    }
  }
});

module.exports = router;
