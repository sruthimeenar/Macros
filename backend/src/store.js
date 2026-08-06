const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "tokens.json");

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

// key: `${email}::${provider}` -> { accessToken, refreshToken, expiresAt, providerUserId, scope }
function saveTokens(email, provider, tokens) {
  const data = readAll();
  data[`${email}::${provider}`] = { ...tokens, updatedAt: Date.now() };
  writeAll(data);
}

function getTokens(email, provider) {
  const data = readAll();
  return data[`${email}::${provider}`] || null;
}

function deleteTokens(email, provider) {
  const data = readAll();
  delete data[`${email}::${provider}`];
  writeAll(data);
}

function listProviders(email) {
  const data = readAll();
  const prefix = `${email}::`;
  return Object.keys(data)
    .filter(key => key.startsWith(prefix))
    .map(key => key.slice(prefix.length));
}

module.exports = { saveTokens, getTokens, deleteTokens, listProviders };
