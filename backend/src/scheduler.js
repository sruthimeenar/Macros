const db = require("./db");
const fitbit = require("./providers/fitbit");
const googleFit = require("./providers/googleFit");

const providers = { fitbit, googleFit };
function today() { return new Date().toISOString().slice(0, 10); }

async function syncOne(userId, providerName) {
  try {
    const data = await providers[providerName].fetchTodayActivity(userId);
    if (data) await db.saveActivity(userId, today(), data);
  } catch (err) {
    console.error(`[scheduler] sync failed for user ${userId} / ${providerName}:`, err.message);
  }
}

async function runSyncPass() {
  const tokens = await db.listAllDeviceTokens();
  if (tokens.length === 0) return;
  console.log(`[scheduler] syncing ${tokens.length} connected device(s)...`);
  await Promise.all(tokens.map(t => syncOne(t.user_id, t.provider)));
}

function startScheduler() {
  const minutes = Number(process.env.SYNC_INTERVAL_MINUTES || 15);
  const intervalMs = Math.max(minutes, 1) * 60 * 1000;
  console.log(`[scheduler] automatic device sync every ${minutes} minute(s).`);
  runSyncPass();
  return setInterval(runSyncPass, intervalMs);
}

module.exports = { startScheduler, runSyncPass };
