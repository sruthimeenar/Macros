const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "users.json");

function ensureFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "{}");
}

function readAll() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// key: email -> { name, email, passwordHash, createdAt }
function createUser({ name, email, passwordHash }) {
  const data = readAll();
  data[email] = { name, email, passwordHash, createdAt: Date.now() };
  writeAll(data);
  return data[email];
}

function getUser(email) {
  const data = readAll();
  return data[email] || null;
}

module.exports = { createUser, getUser };
