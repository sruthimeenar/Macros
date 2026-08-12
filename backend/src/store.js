// Thin adapter over the SQLite layer, keyed by numeric user id. Kept as its own module so the
// provider files (fitbit.js / googleFit.js) can talk to "tokens for this user" without knowing
// they're backed by SQLite.
const db = require("./db");

function saveTokens(userId, provider, tokens) { db.saveDeviceTokens(userId, provider, tokens); }
function getTokens(userId, provider) { return db.getDeviceTokens(userId, provider); }
function deleteTokens(userId, provider) { db.deleteDeviceTokens(userId, provider); }
function listProviders(userId) { return db.listDeviceProviders(userId); }

module.exports = { saveTokens, getTokens, deleteTokens, listProviders };
