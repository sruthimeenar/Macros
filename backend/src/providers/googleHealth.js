const store = require("../store");

// Google Health API - the unified successor to both the legacy Fitbit Web API and the old
// Google Fit REST API (they merged into one API in 2026). Legacy Fitbit Web API shuts down
// entirely in September 2026, so this is the only forward-compatible option as of when this
// was written. Docs: https://developers.google.com/health
//
// Note: this API was very new (pre-GA / actively evolving) at the time this was built.
// Endpoint IDs, filter syntax, and scope names may have shifted since - if a request 404s
// or comes back empty, check https://developers.google.com/health/data-types and
// https://developers.google.com/health/endpoints for the current shape before assuming
// something in this file is wrong.

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://health.googleapis.com/v4";

const SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
].join(" ");

function getAuthorizeUrl(state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.GOOGLE_HEALTH_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_HEALTH_REDIRECT_URI,
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.GOOGLE_HEALTH_CLIENT_ID,
    client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_HEALTH_REDIRECT_URI,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Google Health token exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  let providerUserId = null;
  try {
    const profileRes = await fetch(`${API_BASE}/users/me/profile`, { headers: { Authorization: `Bearer ${json.access_token}` } });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      providerUserId = profile.googleUserId || profile.fitbitUserId || null;
    }
  } catch { /* identity is a nice-to-have for webhook mapping later, not required to connect */ }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    providerUserId,
    scope: json.scope,
  };
}

async function refreshTokens(refreshToken) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.GOOGLE_HEALTH_CLIENT_ID,
    client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Google Health token refresh failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  // Google doesn't always return a new refresh_token on refresh - keep the old one if absent.
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

async function getValidAccessToken(userId) {
  let tokens = await store.getTokens(userId, "googleHealth");
  if (!tokens) return null;
  if (Date.now() > tokens.expiresAt - 60 * 1000) {
    const refreshed = await refreshTokens(tokens.refreshToken);
    tokens = { ...tokens, ...refreshed };
    await store.saveTokens(userId, "googleHealth", tokens);
  }
  return tokens.accessToken;
}

function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

// Steps and Total Calories both support :dailyRollUp, which gives a single summed value for
// the day without us needing to page through intraday points and sum them ourselves.
async function dailyRollUp(accessToken, dataTypeId) {
  const { start, end } = todayRange();
  const res = await fetch(`${API_BASE}/users/me/dataTypes/${dataTypeId}/dataPoints:dailyRollUp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ range: { startTime: start, endTime: end } }),
  });
  if (!res.ok) return null;
  return res.json();
}

// Sleep is a "Session" type (start/end interval), not a rollup type - list sessions that
// overlap with the last ~18 hours and sum their duration to approximate "last night's sleep".
async function fetchSleepHours(accessToken) {
  const end = new Date();
  const start = new Date(end.getTime() - 18 * 60 * 60 * 1000);
  const filter = encodeURIComponent(`sleep.interval.end_time >= "${start.toISOString()}"`);
  const res = await fetch(`${API_BASE}/users/me/dataTypes/sleep/dataPoints?page_size=10&filter=${filter}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const points = json.dataPoints || [];
  const totalMs = points.reduce((sum, point) => {
    const summary = point.sleep?.summary;
    if (summary?.totalMinutesAsleep) return sum + summary.totalMinutesAsleep * 60 * 1000;
    const startTime = point.sleep?.interval?.startTime;
    const endTime = point.sleep?.interval?.endTime;
    if (startTime && endTime) return sum + (new Date(endTime) - new Date(startTime));
    return sum;
  }, 0);
  return totalMs > 0 ? Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10 : null;
}

async function fetchTodayActivity(userId) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  const [steps, calories, restingHeartRate, sleep] = await Promise.all([
    dailyRollUp(accessToken, "steps"),
    dailyRollUp(accessToken, "total-calories"),
    dailyRollUp(accessToken, "daily-resting-heart-rate"),
    fetchSleepHours(accessToken),
  ]);

  return {
    steps: steps?.value ?? steps?.rollUp?.value ?? null,
    heartRate: restingHeartRate?.value ?? restingHeartRate?.rollUp?.value ?? null,
    calories: calories?.value ?? calories?.rollUp?.value ?? null,
    sleep,
    source: "googleHealth",
  };
}

module.exports = { getAuthorizeUrl, exchangeCodeForTokens, fetchTodayActivity };
