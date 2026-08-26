const crypto = require("crypto");

// Signs { email, nonce, ts } so callbacks can't be forged with an arbitrary email,
// and so a state value can't be replayed after it's stale.
function signState(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyState(state, secret, maxAgeMs = 10 * 60 * 1000) {
  if (!state || !state.includes(".")) return null;
  const [body, sig] = state.split(".");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig || "");
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (Date.now() - payload.ts > maxAgeMs) return null;
  return payload;
}

module.exports = { signState, verifyState };
