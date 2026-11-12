// End-to-end: Discord login, the signup flow, the admin panel, and a scheduled run that posts to both an admin webhook
// and a subscriber webhook. Discord and the event sources are faked; D1 is node:sqlite with the real migrations.
import assert from "node:assert/strict";
import test from "node:test";
import { createD1 } from "./helpers/d1.mjs";

const ADMIN_ID = "100000000000000001";
const USER_ID = "100000000000000002";
const SUBSCRIBER_HOOK = "https://discord.com/api/webhooks/200000000000000001/subscriber-token";
const ADMIN_HOOK = "https://discord.com/api/webhooks/200000000000000002/admin-token";
const LOCAL_HOOK = "https://discord.com/api/webhooks/200000000000000003/local-token";

// A Friday evening in New York: the daily post (6:05 PM) for Saturday is due.
const NOW = Date.parse("2026-11-13T23:06:00.000Z");
const EVENTS = [
  { eventID: "test-community-day", name: "Test Community Day", eventType: "community-day", heading: "Community Day",
    link: "https://leekduck.com/events/test-community-day/", image: "https://cdn.leekduck.com/assets/img/events/test.jpg",
    start: "2026-11-14T14:00:00.000", end: "2026-11-14T17:00:00.000", extraData: {} },
  { eventID: "test-raid-hour", name: "Test Raid Hour", eventType: "raid-hour", heading: "Raid Hour",
    link: "https://leekduck.com/events/test-raid-hour/", image: "https://cdn.leekduck.com/assets/img/events/raid.jpg",
    start: "2026-11-18T18:00:00.000", end: "2026-11-18T19:00:00.000", extraData: {} }
];

const posts = [];
let discordUserId = USER_ID;

function fakeFetch(input, init = {}) {
  const url = String(input?.url || input);
  if (url.startsWith("https://raw.githubusercontent.com/bigfoott/ScrapedDuck/")) {
    return Promise.resolve(new Response(JSON.stringify(EVENTS), { headers: { "content-type": "application/json" } }));
  }
  if (url === "https://discord.com/api/v10/oauth2/token") {
    return Promise.resolve(Response.json({ access_token: "token", token_type: "Bearer" }));
  }
  if (url === "https://discord.com/api/v10/users/@me") {
    return Promise.resolve(Response.json({ id: discordUserId, username: `user${discordUserId.slice(-1)}`, global_name: "Tester" }));
  }
  if (url.startsWith("https://discord.com/api/webhooks/")) {
    posts.push({ url: url.split("?")[0], body: init.body });
    return Promise.resolve(Response.json({ id: "300000000000000001" }));
  }
  return Promise.resolve(new Response("not found", { status: 404 }));
}

const queued = [];
const env = {
  DB: createD1(),
  SITE_URL: "https://example.com",
  SITE_NAME: "Example Events",
  DEFAULT_TIME_ZONE: "America/New_York",
  SIGNUP_MODE: "open",
  ADMIN_DISCORD_IDS: ADMIN_ID,
  DISCORD_CLIENT_ID: "client",
  DISCORD_CLIENT_SECRET: "secret",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  EVENT_WEBHOOK_ENCRYPTION_KEY: "test-encryption-key-0123456789abcdef",
  EVENT_NOTIFICATION_QUEUE: {
    send: async body => { queued.push(body); },
    sendBatch: async rows => { for (const row of rows) queued.push(row.body); }
  }
};
const ctx = { waitUntil() {}, passThroughOnException() {} };

globalThis.fetch = fakeFetch;
const { default: worker } = await import("../src/worker.js");

async function call(path, { method = "GET", cookie = "", body, headers = {} } = {}) {
  const request = new Request(`https://example.com${path}`, {
    method,
    headers: {
      host: "example.com",
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json", origin: "https://example.com" } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  return worker.fetch(request, env, ctx);
}

async function signIn(id) {
  discordUserId = id;
  const login = await call("/api/discord-login?returnTo=signup");
  assert.equal(login.status, 302);
  const stateCookie = login.headers.get("set-cookie").split(";")[0];
  const state = decodeURIComponent(stateCookie.split("=")[1]);
  const callback = await call(`/api/discord-callback?code=abc&state=${encodeURIComponent(state)}`, { cookie: stateCookie });
  assert.equal(callback.status, 302);
  assert.match(callback.headers.get("location"), /auth=success/);
  const sessionCookie = callback.headers.getSetCookie().find(row => row.startsWith("pgew_session="));
  assert.ok(sessionCookie, "session cookie set");
  return sessionCookie.split(";")[0];
}

test("pages render and the session endpoint reports signed-out visitors", async () => {
  for (const path of ["/", "/admin", "/healthz"]) assert.equal((await call(path)).status, 200, path);
  const session = await call("/api/session");
  assert.equal(session.status, 401);
  assert.equal((await session.json()).discordConfigured, true);
});

test("a user signs in with Discord, connects a webhook (tested on save), then pauses and resumes it", async () => {
  const cookie = await signIn(USER_ID);
  const me = await (await call("/api/session", { cookie })).json();
  assert.equal(me.user.discordId, USER_ID);
  assert.equal(me.user.isAdmin, false);

  const empty = await (await call("/api/server-alerts", { cookie })).json();
  assert.equal(empty.subscription, null);

  const before = posts.length;
  const save = await call("/api/server-alerts?action=save", { method: "POST", cookie, body: {
    webhookUrl: SUBSCRIBER_HOOK, name: "My server", consent: true, serverPermission: true,
    settings: { timeZone: "America/New_York", scopes: { global: true, local: true },
      categories: ["season-pass", "raids", "max", "community", "spotlight", "research", "local", "other"],
      schedules: { today: { enabled: true, time: "18:05" }, week: { enabled: true, weekday: 0, time: "08:05" } } }
  } });
  const saved = await save.json();
  assert.equal(save.status, 200, JSON.stringify(saved));
  assert.equal(saved.tested, true);
  assert.equal(posts.length, before + 1, "a test message went to the webhook");
  assert.equal(posts.at(-1).url, SUBSCRIBER_HOOK);
  assert.match(saved.subscription.webhookLabel, /0001/);
  assert.doesNotMatch(JSON.stringify(saved), /subscriber-token/, "the webhook token is never sent back");

  const stored = env.DB.sqlite.prepare("SELECT webhook_secret_json FROM discord_event_webhook_subscribers").get();
  assert.doesNotMatch(stored.webhook_secret_json, /subscriber-token/, "the webhook is encrypted at rest");

  const paused = await (await call("/api/server-alerts?action=pause", { method: "POST", cookie, body: { paused: true } })).json();
  assert.equal(paused.subscription.paused, true);
  const resumed = await (await call("/api/server-alerts?action=pause", { method: "POST", cookie, body: { paused: false } })).json();
  assert.equal(resumed.subscription.paused, false);
});

test("cross-site POSTs are refused", async () => {
  const cookie = await signIn(USER_ID);
  const response = await call("/api/server-alerts?action=delete", { method: "POST", cookie, body: {}, headers: { origin: "https://evil.example" } });
  assert.equal(response.status, 403);
});

test("non-admins cannot use the admin API; admins see users, subscribers and previews", async () => {
  const userCookie = await signIn(USER_ID);
  assert.equal((await call("/api/admin", { cookie: userCookie })).status, 403);

  const cookie = await signIn(ADMIN_ID);
  const overview = await (await call("/api/admin", { cookie })).json();
  assert.equal(overview.ok, true, JSON.stringify(overview));
  assert.ok(overview.users.some(user => user.discordId === USER_ID && user.enabled));
  assert.equal(overview.subscribers.length, 1);
  assert.ok(overview.events.count >= 1);

  const added = await (await call("/api/admin?action=add-webhooks", { method: "POST", cookie, body: { destinations: [
    { url: ADMIN_HOOK, name: "Main", digestKinds: ["today", "week", "monthly"], dailyPost: "daily" },
    { url: LOCAL_HOOK, name: "Local only", digestKinds: ["today"], dailyPost: "local" }
  ] } })).json();
  assert.equal(added.ok, true, JSON.stringify(added));
  assert.deepEqual(added.webhooks.map(row => row.dailyPost).sort(), ["daily", "local"]);

  const html = await call(`/api/admin?preview=today&at=${new Date(NOW).toISOString()}`, { cookie });
  assert.equal(html.status, 200);
  const page = await html.text();
  assert.match(page, /Example Events/);
  assert.match(page, /Test Community Day/);
  const text = await (await call(`/api/admin?preview=today&format=text&at=${new Date(NOW).toISOString()}`, { cookie })).json();
  assert.match(text.text, /Test Community Day/);
  assert.match(text.text, /https:\/\/example\.com\/events/);
  const png = await call("/api/admin?preview=today&format=png", { cookie });
  assert.equal(png.status, 409, "PNG needs Browser Rendering credentials");
});

test("the scheduled run queues the daily post and the queue delivers it to admin and subscriber webhooks", async () => {
  posts.length = 0;
  queued.length = 0;
  await worker.scheduled({ scheduledTime: NOW }, env, ctx);
  assert.ok(queued.length >= 2, `queued: ${JSON.stringify(queued)}`);
  await worker.queue({ messages: queued.map((body, index) => ({ id: String(index), body, attempts: 1, ack() {}, retry() {} })) }, env, ctx);
  const byUrl = url => posts.filter(post => post.url === url);
  assert.ok(byUrl(ADMIN_HOOK).length >= 1, "admin daily webhook received the daily post");
  assert.ok(byUrl(SUBSCRIBER_HOOK).length >= 1, "subscriber received a post");
  const adminText = byUrl(ADMIN_HOOK).map(post => String(post.body)).join("\n");
  assert.match(adminText, /Test Community Day/);
  // "Daily only" leaves out the local post; the "Local events only" channel gets nothing else (the built-in
  // curated local events include in-person meetups that are live on this date).
  assert.doesNotMatch(adminText, /Local events only/);
  const localText = byUrl(LOCAL_HOOK).map(post => String(post.body)).join("\n");
  assert.match(localText, /Local events only/);
  assert.doesNotMatch(localText, /Test Community Day/);

  // Running the same minute again sends nothing new.
  posts.length = 0;
  queued.length = 0;
  await worker.scheduled({ scheduledTime: NOW + 60_000 }, env, ctx);
  await worker.queue({ messages: queued.map((body, index) => ({ id: String(index), body, attempts: 1, ack() {}, retry() {} })) }, env, ctx);
  assert.equal(posts.filter(post => post.url === ADMIN_HOOK).length, 0, "no duplicate daily post");
});

test("disabling a user blocks their API access and pauses their posts", async () => {
  const admin = await signIn(ADMIN_ID);
  const user = await signIn(USER_ID);
  const result = await (await call("/api/admin?action=update-user", { method: "POST", cookie: admin, body: { discordId: USER_ID, enabled: false } })).json();
  assert.equal(result.user.enabled, false);
  assert.equal((await call("/api/server-alerts", { cookie: user })).status, 403);
  const row = env.DB.sqlite.prepare("SELECT paused FROM discord_event_webhook_subscribers WHERE discord_id = ?").get(USER_ID);
  assert.equal(row.paused, 1);
});

test("public events page and API list scraped events", async () => {
  const page = await (await call("/events")).text();
  assert.match(page, /Test Community Day/);
  const api = await (await call("/api/events")).json();
  assert.ok(api.calendarEvents.some(event => event.name === "Test Community Day"));
});
