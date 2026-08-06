const express = require("express");
const { signState, verifyState } = require("../state");
const store = require("../store");
const fitbit = require("../providers/fitbit");
const googleFit = require("../providers/googleFit");

const providers = { fitbit, googleFit };
const router = express.Router();

// Kick off the OAuth flow for a given provider. The frontend links here with ?email=<the logged-in user's email>.
router.get("/:provider/connect", (req, res) => {
  const provider = providers[req.params.provider];
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!provider) return res.status(404).send("Unknown provider.");
  if (!email) return res.status(400).send("Missing email.");
  const state = signState({ email, ts: Date.now() }, process.env.SERVER_SECRET);
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
    store.saveTokens(payload.email, providerName, tokens);
    res.redirect(`${frontend}/plan.html?deviceConnected=${providerName}`);
  } catch (err) {
    console.error(err);
    res.redirect(`${frontend}/plan.html?deviceError=${encodeURIComponent(providerName)}`);
  }
});

// Which providers does this user currently have connected?
router.get("/status", (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Missing email." });
  res.json({ connected: store.listProviders(email) });
});

router.delete("/:provider", (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Missing email." });
  store.deleteTokens(email, req.params.provider);
  res.json({ ok: true });
});

module.exports = router;
