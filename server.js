require("dotenv").config();
const express = require("express");
const cors = require("cors");
const authRoutes = require("./src/routes/auth");
const activityRoutes = require("./src/routes/activity");
const usersRoutes = require("./src/routes/users");
const profileRoutes = require("./src/routes/profile");

const REQUIRED = ["SERVER_SECRET"];
const missing = REQUIRED.filter(key => !process.env[key]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}. Copy .env.example to .env and fill it in.`);
  process.exit(1);
}

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5500" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/auth", usersRoutes); // signup / login / me - real accounts, separate from the OAuth /auth above
app.use("/api", profileRoutes); // profile, plan, progress, manual activity - all session-protected

app.use((req, res) => res.status(404).json({ error: "Not found." }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: "Server error." }); });

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Macros device-sync backend listening on http://localhost:${port}`));
