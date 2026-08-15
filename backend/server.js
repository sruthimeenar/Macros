require("dotenv").config();
const express = require("express");
const cors = require("cors");

const REQUIRED = ["SERVER_SECRET", "JWT_SECRET", "DATABASE_URL"];
const missing = REQUIRED.filter(key => !process.env[key]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}. Copy .env.example to .env and fill it in.`);
  process.exit(1);
}

const db = require("./src/db");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5500" }));

// Mounted before the global JSON parser below: the Fitbit webhook needs the raw request body
// to verify its signature, so it parses JSON itself with a `verify` hook.
app.use("/webhooks", require("./src/routes/webhooks"));

app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", require("./src/routes/auth"));
app.use("/api", require("./src/routes/plan"));
app.use("/api/progress", require("./src/routes/progress"));
app.use("/api/activity", require("./src/routes/activity"));
app.use("/auth/devices", require("./src/routes/devices"));

app.use((req, res) => res.status(404).json({ error: "Not found." }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: "Server error." }); });

const port = process.env.PORT || 4000;
db.init()
  .then(() => {
    app.listen(port, () => {
      console.log(`Macros backend listening on http://localhost:${port}`);
      require("./src/scheduler").startScheduler();
    });
  })
  .catch(err => {
    console.error("Failed to connect to the database:", err.message);
    process.exit(1);
  });
