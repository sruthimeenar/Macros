const { signState, verifyState } = require("./state");

// Reuses the same HMAC signing already used for OAuth `state` params, just with a
// longer lifetime, so logging in doesn't need a whole extra JWT dependency.
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function signSession(email) {
  return signState({ email, ts: Date.now() }, process.env.SERVER_SECRET);
}

function verifySession(token) {
  const payload = verifyState(token, process.env.SERVER_SECRET, SESSION_MAX_AGE_MS);
  return payload ? payload.email : null;
}

module.exports = { signSession, verifySession };
