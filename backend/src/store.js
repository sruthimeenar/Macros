// Thin async adapter over the Postgres layer, keyed by numeric user id. Kept as its own
// module so the provider files (fitbit.js / googleFit.js) can talk to "tokens for this
// user" without needing to know they're backed by Postgres.
const db = require("./db");

async function saveTokens(userId, provider, tokens) { await db.saveDeviceTokens(userId, provider, tokens); }
async function getTokens(userId, provider) { return db.getDeviceTokens(userId, provider); }
async function deleteTokens(userId, provider) { await db.deleteDeviceTokens(userId, provider); }
async function listProviders(userId) { return db.listDeviceProviders(userId); }

module.exports = { saveTokens, getTokens, deleteTokens, listProviders };
