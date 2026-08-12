const { verifyToken } = require("../auth");
const db = require("../db");

// Accepts the token via an Authorization: Bearer header (normal API calls) or a ?token=
// query param (needed for the OAuth "connect" redirect, which the browser navigates to
// directly and so can't attach a header to).
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer || req.query.token;
  const payload = token && verifyToken(token, process.env.JWT_SECRET);
  if (!payload) return res.status(401).json({ error: "Not authenticated." });
  const user = db.getUserById(payload.sub);
  if (!user) return res.status(401).json({ error: "Not authenticated." });
  req.user = user;
  next();
}

module.exports = { requireAuth };
