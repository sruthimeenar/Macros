const express = require("express");
const bcrypt = require("bcryptjs");
const userStore = require("../userStore");
const { signSession } = require("../session");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.post("/signup", async (req, res) => {
  const { name, email: rawEmail, password } = req.body || {};
  if (!name || !rawEmail || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password should be at least 6 characters." });
  }
  const email = String(rawEmail).trim().toLowerCase();

  if (userStore.getUser(email)) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = userStore.createUser({ name: String(name).trim(), email, passwordHash });
  res.status(201).json({ token: signSession(email), user: { name: user.name, email: user.email } });
});

router.post("/login", async (req, res) => {
  const { email: rawEmail, password } = req.body || {};
  if (!rawEmail || !password) return res.status(400).json({ error: "Email and password are required." });
  const email = String(rawEmail).trim().toLowerCase();

  const user = userStore.getUser(email);
  if (!user) return res.status(401).json({ error: "No account found with this email." });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Incorrect password." });

  res.json({ token: signSession(email), user: { name: user.name, email: user.email } });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

module.exports = router;
