const store = require("../store");

const AUTHORIZE_URL = "https://www.fitbit.com/oauth2/authorize";
const TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const SCOPES = "activity heartrate sleep profile";

function basicAuthHeader() {
  const creds = `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(creds).toString("base64")}`;
}

function getAuthorizeUrl(state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.FITBIT_CLIENT_ID,
    redirect_uri: process.env.FITBIT_REDIRECT_URI,
    scope: SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.FITBIT_REDIRECT_URI,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuthHeader(), "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Fitbit token exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    providerUserId: json.user_id,
    scope: json.scope,
  };
}

async function refreshTokens(refreshToken) {
  const params = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuthHeader(), "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Fitbit token refresh failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

async function getValidAccessToken(userId) {
  let tokens = store.getTokens(userId, "fitbit");
  if (!tokens) return null;
  if (Date.now() > tokens.expiresAt - 60 * 1000) {
    const refreshed = await refreshTokens(tokens.refreshToken);
    tokens = { ...tokens, ...refreshed };
    store.saveTokens(userId, "fitbit", tokens);
  }
  return tokens.accessToken;
}

async function fetchTodayActivity(userId) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;
  const today = new Date().toISOString().slice(0, 10);
  const headers = { Authorization: `Bearer ${accessToken}` };

  const [summaryRes, heartRes, sleepRes] = await Promise.all([
    fetch(`https://api.fitbit.com/1/user/-/activities/date/${today}.json`, { headers }),
    fetch(`https://api.fitbit.com/1/user/-/activities/heart/date/${today}/1d.json`, { headers }),
    fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${today}.json`, { headers }),
  ]);
  if (!summaryRes.ok) throw new Error(`Fitbit activity fetch failed: ${summaryRes.status}`);
  const summary = await summaryRes.json();
  const heart = heartRes.ok ? await heartRes.json() : null;
  const sleep = sleepRes.ok ? await sleepRes.json() : null;

  const restingHeartRate = heart?.["activities-heart"]?.[0]?.value?.restingHeartRate ?? null;
  const sleepMinutes = sleep?.summary?.totalMinutesAsleep ?? null;

  return {
    steps: summary?.summary?.steps ?? null,
    heartRate: restingHeartRate,
    calories: summary?.summary?.caloriesOut ?? null,
    sleep: sleepMinutes != null ? Math.round((sleepMinutes / 60) * 10) / 10 : null,
    source: "fitbit",
  };
}

module.exports = { getAuthorizeUrl, exchangeCodeForTokens, fetchTodayActivity };
