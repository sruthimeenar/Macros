const { verifySession } = require("../session");
const userStore = require("../userStore");

// Reads the session token from the Authorization header (Bearer <token>) for normal
// fetch() calls. No endpoint currently needs it via query string, unlike the OAuth
// `connect` links in auth.js, since nothing under /api navigates the whole page.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const email = token && verifySession(token);
  if (!email) return res.status(401).json({ error: "Not signed in." });

  const user = userStore.getUser(email);
  if (!user) return res.status(401).json({ error: "Account no longer exists." });

  req.user = { email: user.email, name: user.name };
  next();
}

module.exports = requireAuth;
