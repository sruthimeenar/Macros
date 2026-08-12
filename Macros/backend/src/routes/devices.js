const express = require("express");
const { signState, verifyState } = require("../state");
const { verifyToken } = require("../auth");
const db = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const fitbit = require("../providers/fitbit");
const googleFit = require("../providers/googleFit");

const providers = { fitbit, googleFit };
const router = express.Router();

// Kick off the OAuth flow for a given provider. The browser navigates here directly (it's a
// redirect, not a fetch), so auth comes via ?token=<session token> rather than a header.
router.get("/:provider/connect", (req, res) => {
  const provider = providers[req.params.provider];
  if (!provider) return res.status(404).send("Unknown provider.");
  const payload = verifyToken(req.query.token, process.env.JWT_SECRET);
  if (!payload) return res.status(401).send("Not authenticated. Log in and try again.");
  const state = signState({ userId: payload.sub, ts: Date.now() }, process.env.SERVER_SECRET);
  res.redirect(provider.getAuthorizeUrl(state));
});

// OAuth redirects back here with a code + our signed state.
router.get("/:provider/callback", async (req, res) => {
  const providerName = req.params.provider;
  const provider = providers[providerName];
  if (!provider) return res.status(404).send("Unknown provider.");
  const { code, state, error } = req.query;
  const frontend = process.env.FRONTEND_ORIGIN || "http://localhost:5500";

  if (error) return res.redirect(`${frontend}/plan.html?deviceError=${encodeURIComponent(String(error))}`);

  const payload = verifyState(state, process.env.SERVER_SECRET);
  if (!payload) return res.status(400).send("Invalid or expired state.");

  try {
    const tokens = await provider.exchangeCodeForTokens(code);
    db.saveDeviceTokens(payload.userId, providerName, tokens);
    res.redirect(`${frontend}/plan.html?deviceConnected=${providerName}`);
  } catch (err) {
    console.error(err);
    res.redirect(`${frontend}/plan.html?deviceError=${encodeURIComponent(providerName)}`);
  }
});

// Which providers does the authenticated user currently have connected?
router.get("/status", requireAuth, (req, res) => {
  res.json({ connected: db.listDeviceProviders(req.user.id) });
});

router.delete("/:provider", requireAuth, (req, res) => {
  db.deleteDeviceTokens(req.user.id, req.params.provider);
  res.json({ ok: true });
});

module.exports = router;
