const store = require("../store");

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AGGREGATE_URL = "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate";
const SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
].join(" ");

function getAuthorizeUrl(state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.GOOGLE_FIT_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_FIT_REDIRECT_URI,
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
    client_id: process.env.GOOGLE_FIT_CLIENT_ID,
    client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_FIT_REDIRECT_URI,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope,
  };
}

async function refreshTokens(refreshToken) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_FIT_CLIENT_ID,
    client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  // Google doesn't always return a new refresh_token on refresh - keep the old one if absent.
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

async function getValidAccessToken(email) {
  let tokens = store.getTokens(email, "googleFit");
  if (!tokens) return null;
  if (Date.now() > tokens.expiresAt - 60 * 1000) {
    const refreshed = await refreshTokens(tokens.refreshToken);
    tokens = { ...tokens, ...refreshed };
    store.saveTokens(email, "googleFit", tokens);
  }
  return tokens.accessToken;
}

function startEndOfTodayMillis() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return { startTimeMillis: start.getTime(), endTimeMillis: end.getTime() };
}

async function aggregate(accessToken, aggregateBy) {
  const { startTimeMillis, endTimeMillis } = startEndOfTodayMillis();
  const res = await fetch(AGGREGATE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ aggregateBy, bucketByTime: { durationMillis: endTimeMillis - startTimeMillis }, startTimeMillis, endTimeMillis }),
  });
  if (!res.ok) throw new Error(`Google Fit aggregate failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function extractValue(json, valueKey) {
  const point = json?.bucket?.[0]?.dataset?.[0]?.point?.[0];
  const value = point?.value?.[0];
  if (!value) return null;
  return value[valueKey] ?? null;
}

async function fetchTodayActivity(email) {
  const accessToken = await getValidAccessToken(email);
  if (!accessToken) return null;

  const [steps, calories, heart] = await Promise.all([
    aggregate(accessToken, [{ dataTypeName: "com.google.step_count.delta" }]),
    aggregate(accessToken, [{ dataTypeName: "com.google.calories.expended" }]),
    aggregate(accessToken, [{ dataTypeName: "com.google.heart_rate.bpm" }]),
  ]);

  return {
    steps: extractValue(steps, "intVal"),
    heartRate: extractValue(heart, "fpVal") ? Math.round(extractValue(heart, "fpVal")) : null,
    calories: extractValue(calories, "fpVal") ? Math.round(extractValue(calories, "fpVal")) : null,
    sleep: null, // Google Fit sleep data requires the separate Sessions API; left as a follow-up.
    source: "googleFit",
  };
}

module.exports = { getAuthorizeUrl, exchangeCodeForTokens, fetchTodayActivity };
