const express = require("express");
const db = require("../db");
const { genSalt, hashPassword, verifyPassword, signToken } = require("../auth");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password are required." });
  if (String(password).length < 6) return res.status(400).json({ error: "Password should be at least 6 characters." });
  const normalizedEmail = String(email).trim().toLowerCase();
  if (await db.getUserByEmail(normalizedEmail)) return res.status(409).json({ error: "An account with this email already exists." });

  const salt = genSalt();
  const hash = hashPassword(password, salt);
  const user = await db.createUser({ email: normalizedEmail, name: String(name).trim(), passwordHash: hash, passwordSalt: salt });
  const token = signToken({ sub: user.id }, process.env.JWT_SECRET);
  res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  const user = await db.getUserByEmail(String(email));
  if (!user) return res.status(401).json({ error: "No account found with this email." });
  if (!verifyPassword(password, user.password_salt, user.password_hash)) return res.status(401).json({ error: "Incorrect password." });
  const token = signToken({ sub: user.id }, process.env.JWT_SECRET);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } });
});

module.exports = router;
