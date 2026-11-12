// The two interactive pages: "/" (anyone signs in with Discord and connects their server's webhook) and "/admin".
// Plain HTML + a small inline script each; no build step.
import { PAGE_STYLE } from "./theme.js";

const SHARED_SCRIPT = String.raw`
const $ = (sel, root = document) => root.querySelector(sel);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CATEGORY_LABELS = { "season-pass": "Seasons & GO Pass", raids: "Raids & raid hours", max: "Max Battles", community: "Community Day",
  spotlight: "Spotlight hours", research: "Research", local: "Local / in-person events", other: "Everything else" };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(path, { method, credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({ ok: false, error: "Unexpected response (HTTP " + response.status + ")." }));
  if (!response.ok && data.ok !== false) data.ok = false;
  data.status = response.status;
  return data;
}
function flash(text, kind = "") {
  const box = $("#status"); box.className = "status " + kind; box.textContent = text; box.hidden = !text;
  if (text) box.scrollIntoView({ block: "nearest" });
}
function authMessage() {
  const auth = new URLSearchParams(location.search).get("auth");
  return ({ denied: ["Sign-ups are closed. Ask the site owner to add your Discord account.", "error"],
    pending: ["Thanks for signing up. An administrator needs to approve your account before you can add a webhook.", ""],
    failed: ["Discord sign-in failed. Try again.", "error"], "invalid-state": ["That sign-in link expired. Try again.", "error"],
    "not-configured": ["Discord sign-in is not configured on this deployment yet.", "error"] })[auth] || null;
}
// Settings form shared by the signup page and the admin page.
function settingsForm(settings, timeZones, categories) {
  const s = settings.schedules || {};
  const tz = timeZones.map(z => '<option value="' + esc(z.value) + '"' + (z.value === settings.timeZone ? " selected" : "") + ">" + esc(z.label) + "</option>").join("");
  const day = (name, value) => '<select name="' + name + '">' + DAYS.map((d, i) => '<option value="' + i + '"' + (Number(value) === i ? " selected" : "") + ">" + d + "</option>").join("") + "</select>";
  const loc = settings.location || {};
  return '<div class="row"><div><label>Time zone (posts go out on this clock)</label><select name="timeZone">' + tz + "</select></div></div>" +
    '<label>Which events</label>' +
    '<label class="check"><input type="checkbox" name="scopeGlobal"' + (settings.scopes?.global ? " checked" : "") + "> Global events (Community Days, raids, seasons…)</label>" +
    '<label class="check"><input type="checkbox" name="scopeLocal"' + (settings.scopes?.local ? " checked" : "") + "> Local / in-person events (GO Fest, city events, stamp rallies…)</label>" +
    '<label>Categories</label><div class="row">' + categories.map(c => '<label class="check"><input type="checkbox" name="category" value="' + c + '"' +
      ((settings.categories || []).includes(c) ? " checked" : "") + "> " + esc(CATEGORY_LABELS[c] || c) + "</label>").join("") + "</div>" +
    '<label>Posts</label>' +
    '<div class="row"><label class="check"><input type="checkbox" name="todayEnabled"' + (s.today?.enabled ? " checked" : "") + '> Daily post (the evening before, covers the next day) at</label><input type="time" name="todayTime" value="' + esc(s.today?.time || "18:05") + '"></div>' +
    '<div class="row"><label class="check"><input type="checkbox" name="weekEnabled"' + (s.week?.enabled ? " checked" : "") + "> Week ahead on</label>" + day("weekWeekday", s.week?.weekday ?? 0) + '<input type="time" name="weekTime" value="' + esc(s.week?.time || "08:05") + '"></div>' +
    '<div class="row"><label class="check"><input type="checkbox" name="monthlyEnabled"' + (s.monthly?.enabled ? " checked" : "") + '> Season & GO Pass update (when a new one starts) at</label><input type="time" name="monthlyTime" value="' + esc(s.monthly?.time || "08:05") + '"></div>' +
    '<div class="row"><label class="check"><input type="checkbox" name="weekendEnabled"' + (s.weekend?.enabled ? " checked" : "") + "> This weekend on</label>" + day("weekendWeekday", s.weekend?.weekday ?? 5) + '<input type="time" name="weekendTime" value="' + esc(s.weekend?.time || "08:05") + '"></div>' +
    '<label class="check"><input type="checkbox" name="startingSoon"' + (s.startingSoon?.enabled ? " checked" : "") + "> One-time alert about 2 hours before a nearby local event starts (needs a location below)</label>" +
    '<label>Your location (optional, only used to pick nearby local events)</label><div class="row">' +
    '<input type="text" name="latitude" placeholder="Latitude" value="' + esc(loc.latitude ?? "") + '"><input type="text" name="longitude" placeholder="Longitude" value="' + esc(loc.longitude ?? "") + '">' +
    '<input type="text" name="radiusKm" placeholder="Radius km" value="' + esc(loc.radiusKm ?? "") + '"></div>';
}
function readSettings(form, previous = {}) {
  const v = name => form.elements[name]?.value ?? "";
  const on = name => form.elements[name]?.checked === true;
  const num = name => v(name).trim() === "" ? null : Number(v(name));
  return { ...previous, timeZone: v("timeZone"),
    scopes: { global: on("scopeGlobal"), local: on("scopeLocal") },
    categories: [...form.querySelectorAll('input[name="category"]:checked')].map(i => i.value),
    location: { latitude: num("latitude"), longitude: num("longitude"), radiusKm: num("radiusKm") ?? undefined },
    schedules: {
      startingSoon: { enabled: on("startingSoon") },
      today: { enabled: on("todayEnabled"), time: v("todayTime") },
      week: { enabled: on("weekEnabled"), weekday: Number(v("weekWeekday")), time: v("weekTime") },
      weekend: { enabled: on("weekendEnabled"), weekday: Number(v("weekendWeekday")), time: v("weekendTime") },
      monthly: { enabled: on("monthlyEnabled"), time: v("monthlyTime") } } };
}
async function logout() { await api("/api/logout", { method: "POST" }); location.href = "/"; }
`;

function shell(title, body, script) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${PAGE_STYLE}</style></head><body>
<header class="bar"><a class="brand" href="/" id="brand">Pokémon GO Event Webhook</a><nav><a href="/events">Events</a><a href="/">Get alerts</a><a href="/admin">Admin</a></nav></header>
<main>${body}</main><script>${SHARED_SCRIPT}${script}</script></body></html>`;
}

export const SIGNUP_PAGE = shell("Pokémon GO event alerts for your Discord", `
<h1>Pokémon GO event alerts for your Discord server</h1>
<p class="muted">Sign in with Discord, paste a webhook for one of your server's channels, and pick what to get: a daily post with
the day's events, raids and Max Battles (as a graphic plus copyable text), a week-ahead post, season and GO Pass updates, and
alerts for local events.</p>
<div id="status" class="status" hidden></div>
<div id="signin" class="panel" hidden>
  <p>Sign in so we can tie the webhook to you. We only ask Discord for your username (the <code>identify</code> scope).</p>
  <a class="button" href="/api/discord-login?returnTo=signup">Sign in with Discord</a>
</div>
<form id="form" class="panel" hidden>
  <p id="who" class="muted"></p>
  <label>Discord webhook URL (Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL)</label>
  <input type="url" name="webhookUrl" placeholder="https://discord.com/api/webhooks/…" autocomplete="off">
  <p class="muted" id="saved-hook"></p>
  <label>Name for this destination (only you see it)</label><input type="text" name="name" maxlength="80">
  <div id="settings"></div>
  <label class="check"><input type="checkbox" name="consent"> I want event posts sent to this channel and I can stop them here at any time.</label>
  <label class="check"><input type="checkbox" name="serverPermission"> I'm allowed to add webhooks to this server.</label>
  <div class="actions">
    <button type="submit">Save and send a test</button>
    <button type="button" class="ghost" id="test">Send test</button>
    <button type="button" class="ghost" id="pause">Pause</button>
    <button type="button" class="danger" id="delete">Remove</button>
    <button type="button" class="ghost" onclick="logout()">Sign out</button>
  </div>
</form>`, String.raw`
let state = null;
function render(data) {
  state = data;
  const form = $("#form");
  const sub = data.subscription;
  $("#who").textContent = "Signed in as " + (data.displayName || data.username) + ".";
  $("#saved-hook").textContent = sub ? "Saved: " + sub.webhookLabel + (sub.paused ? " (paused" + (sub.pauseReason ? ": " + sub.pauseReason : "") + ")" : "") +
    (sub.lastError ? " · Last error: " + sub.lastError : "") + ". Leave the URL blank to keep it." : "";
  form.elements.name.value = sub?.name || "";
  const settings = sub?.settings || { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, scopes: { global: true, local: true },
    categories: data.categories, schedules: { today: { enabled: true, time: "18:05" }, week: { enabled: true, weekday: 0, time: "08:05" },
    monthly: { enabled: true, time: "08:05" }, weekend: { enabled: false, weekday: 5, time: "08:05" } } };
  $("#settings").innerHTML = settingsForm(settings, data.timeZones, data.categories);
  for (const id of ["test", "pause", "delete"]) $("#" + id).hidden = !sub;
  $("#pause").textContent = sub?.paused ? "Resume" : "Pause";
  form.hidden = false;
}
async function load() {
  const auth = authMessage(); if (auth) flash(...auth);
  const session = await api("/api/session");
  if (!session.ok) { $("#signin").hidden = false; return; }
  if (session.user.pending) { flash("Your sign-up is waiting for an administrator to approve it."); return; }
  const data = await api("/api/server-alerts");
  if (!data.ok) return flash(data.error, "error");
  render(data);
}
async function act(action, body = {}) {
  flash("Working…");
  const data = await api("/api/server-alerts?action=" + action, { method: "POST", body });
  if (!data.ok) return flash(data.error || "That did not work.", "error");
  render(data); flash(data.message || "Done.", "ok");
}
$("#form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.target;
  act("save", { webhookUrl: form.elements.webhookUrl.value.trim(), name: form.elements.name.value,
    settings: readSettings(form, state?.subscription?.settings), consent: form.elements.consent.checked,
    serverPermission: form.elements.serverPermission.checked }).then(() => { form.elements.webhookUrl.value = ""; });
});
$("#test").onclick = () => act("test");
$("#pause").onclick = () => act("pause", { paused: !state?.subscription?.paused });
$("#delete").onclick = () => confirm("Remove the saved webhook and stop all posts?") && act("delete");
load();
`);

export const ADMIN_PAGE = shell("Admin · Pokémon GO Event Webhook", `
<h1>Admin</h1>
<div id="status" class="status" hidden></div>
<div id="signin" class="panel" hidden>
  <p>Sign in with a Discord account listed in <code>ADMIN_DISCORD_IDS</code>.</p>
  <a class="button" href="/api/discord-login?returnTo=admin">Sign in with Discord</a>
</div>
<div id="app" hidden>
  <section class="panel"><h2>Event sources</h2><div id="sources"></div>
    <div class="actions"><button id="refresh" class="ghost">Scrape now</button></div></section>

  <section class="panel"><h2>Post previews</h2>
    <p class="muted">Exactly what the next post would contain, built from the current event data. PNG needs Browser Rendering (see README).</p>
    <div class="actions">
      <select id="preview-kind"><option value="today">Daily</option><option value="local">Local events only</option><option value="week">Week ahead</option><option value="monthly">Season & GO Pass</option></select>
      <button id="preview-html" class="ghost">Show graphic</button><button id="preview-text" class="ghost">Show text</button><button id="preview-png" class="ghost">Render PNG</button>
    </div>
    <pre id="preview-out" style="white-space:pre-wrap" hidden></pre><iframe id="preview-frame" hidden></iframe><img id="preview-img" hidden style="max-width:100%"></section>

  <section class="panel"><h2>Your webhooks</h2>
    <p class="muted">Channels you post to with the settings below. Use "Daily post" to send a separate local-events-only channel.</p>
    <div id="webhooks"></div>
    <div class="row"><input type="url" id="new-url" placeholder="https://discord.com/api/webhooks/…"><input type="text" id="new-name" placeholder="Name">
      <select id="new-daily"><option value="both">Daily + local</option><option value="daily">Daily only</option><option value="local">Local events only</option></select></div>
    <div class="actions"><button id="add-webhook">Add webhook</button></div></section>

  <section class="panel"><h2>Your post settings</h2><form id="owner-form"><div id="owner-settings"></div>
    <label>Bot name shown in Discord</label><input type="text" name="botName" maxlength="80">
    <div class="actions"><button type="submit">Save settings</button>
      <select id="send-kind"><option value="today">Daily</option><option value="week">Week ahead</option><option value="monthly">Season & GO Pass</option><option value="weekend">Weekend</option></select>
      <button type="button" class="ghost" id="send-now">Post now</button></div></form></section>

  <section class="panel"><h2>Users</h2><p class="muted" id="signup-mode"></p><div id="users"></div>
    <div class="row"><input type="text" id="add-user" placeholder="Discord user ID to pre-approve"></div>
    <div class="actions"><button class="ghost" id="add-user-btn">Approve ID</button></div></section>

  <section class="panel"><h2>Subscriber webhooks</h2><div id="subscribers"></div></section>
  <div class="actions"><button class="ghost" onclick="logout()">Sign out</button></div>
</div>`, String.raw`
let data = null;
const when = ms => ms ? new Date(ms).toLocaleString() : "—";
const DAILY_LABEL = { both: "Daily + local", daily: "Daily only", local: "Local events only" };
function render() {
  $("#sources").innerHTML = "<p>" + data.events.count + " events · updated " + when(data.events.fetchedAt) + (data.events.stale ? " · <span class='pill warn'>stale</span>" : "") +
    (data.events.error ? " · <span class='pill bad'>" + esc(data.events.error) + "</span>" : "") + "</p><table><tr><th>Source</th><th>Status</th><th>Checked</th><th>Note</th></tr>" +
    data.events.sourceHealth.map(s => "<tr><td>" + esc(s.label || s.id) + "</td><td><span class='pill " + (s.status === "ok" ? "ok" : s.status === "error" ? "bad" : "warn") + "'>" + esc(s.status) +
      "</span></td><td>" + when(s.fetchedAt) + "</td><td>" + esc(s.error || s.note) + "</td></tr>").join("") + "</table>";
  $("#webhooks").innerHTML = data.webhooks.length ? "<table><tr><th>Webhook</th><th>Posts</th><th>Daily post</th><th>Health</th><th></th></tr>" + data.webhooks.map(w =>
    "<tr><td>" + esc(w.label) + "</td><td>" + esc((w.digestKinds || []).join(", ")) + "</td><td>" + esc(DAILY_LABEL[w.dailyPost] || "Daily + local") + "</td><td>" +
    (w.lastError ? "<span class='pill bad'>" + esc(w.lastError) + "</span>" : w.lastSuccessAt ? "<span class='pill ok'>ok " + when(w.lastSuccessAt) + "</span>" : "—") +
    "</td><td><button class='ghost' data-test='" + esc(w.id) + "'>Test</button> <button class='danger' data-remove='" + esc(w.id) + "'>Remove</button></td></tr>").join("") + "</table>" : "<p class='muted'>No webhooks yet.</p>";
  $("#owner-settings").innerHTML = settingsForm(data.settings, data.timeZones, data.categories);
  $("#owner-form").elements.botName.value = data.settings.branding?.botName || "";
  $("#signup-mode").textContent = "SIGNUP_MODE is " + data.signupMode + ".";
  $("#users").innerHTML = data.users.length ? "<table><tr><th>User</th><th>ID</th><th>Status</th><th>Last login</th><th></th></tr>" + data.users.map(u =>
    "<tr><td>" + esc(u.displayName || u.username || "—") + "</td><td><code>" + esc(u.discordId) + "</code></td><td>" + (u.enabled ? "<span class='pill ok'>enabled</span>" : "<span class='pill warn'>waiting</span>") +
    "</td><td>" + when(u.lastLoginAt) + "</td><td>" +
    "<button class='ghost' data-user='" + u.discordId + "' data-enabled='" + (!u.enabled) + "'>" + (u.enabled ? "Disable" : "Approve") + "</button> " +
    "<button class='danger' data-remove-user='" + u.discordId + "'>Remove</button></td></tr>").join("") + "</table>" : "<p class='muted'>Nobody has signed in yet.</p>";
  $("#subscribers").innerHTML = data.subscribers.length ? "<table><tr><th>Discord ID</th><th>Name</th><th>Webhook</th><th>Status</th><th>Last delivery</th><th></th></tr>" + data.subscribers.map(s =>
    "<tr><td><code>" + esc(s.discordId) + "</code></td><td>" + esc(s.name) + "</td><td>" + esc(s.webhookLabel) + "</td><td>" +
    (s.paused ? "<span class='pill warn'>paused</span> " + esc(s.pauseReason) : "<span class='pill ok'>active</span>") + (s.lastError ? "<br><span class='pill bad'>" + esc(s.lastError) + "</span>" : "") +
    "</td><td>" + when(s.lastDeliveryAt) + "</td><td><button class='ghost' data-pause='" + s.discordId + "' data-paused='" + (!s.paused) + "'>" + (s.paused ? "Resume" : "Pause") + "</button> " +
    "<button class='danger' data-del-sub='" + s.discordId + "'>Delete</button></td></tr>").join("") + "</table>" : "<p class='muted'>No subscriber webhooks yet.</p>";
}
async function load() {
  const auth = authMessage(); if (auth) flash(...auth);
  const session = await api("/api/session");
  if (!session.ok) { $("#signin").hidden = false; return; }
  if (!session.user.isAdmin) return flash("This Discord account is not an administrator.", "error");
  data = await api("/api/admin");
  if (!data.ok) return flash(data.error, "error");
  $("#brand").textContent = data.siteName; $("#app").hidden = false; render();
}
async function act(action, body = {}, message = "Done.") {
  flash("Working…");
  const result = await api("/api/admin?action=" + action, { method: "POST", body });
  if (!result.ok) return flash(result.error || "That did not work.", "error");
  data = await api("/api/admin"); render(); flash(result.message || message, "ok");
}
document.addEventListener("click", event => {
  const b = event.target.closest("button"); if (!b) return;
  if (b.dataset.test) act("test-webhook", { id: b.dataset.test }, "Test sent.");
  else if (b.dataset.remove) confirm("Remove this webhook?") && act("remove-webhook", { id: b.dataset.remove });
  else if (b.dataset.user) act("update-user", { discordId: b.dataset.user, enabled: b.dataset.enabled === "true" });
  else if (b.dataset.removeUser) confirm("Remove this user and their webhook?") && act("update-user", { discordId: b.dataset.removeUser, remove: true });
  else if (b.dataset.pause) act("pause-subscriber", { discordId: b.dataset.pause, paused: b.dataset.paused === "true" });
  else if (b.dataset.delSub) confirm("Delete this subscriber's webhook?") && act("delete-subscriber", { discordId: b.dataset.delSub });
});
$("#refresh").onclick = () => act("refresh-sources", {}, "Sources scraped.");
$("#add-webhook").onclick = () => act("add-webhooks", { destinations: [{ url: $("#new-url").value.trim(), name: $("#new-name").value,
  dailyPost: $("#new-daily").value, digestKinds: $("#new-daily").value === "local" ? ["today"] : ["today", "week", "monthly"] }] }, "Webhook added.");
$("#add-user-btn").onclick = () => act("update-user", { discordId: $("#add-user").value.trim(), enabled: true }, "User approved.");
$("#owner-form").addEventListener("submit", event => {
  event.preventDefault();
  const settings = readSettings(event.target, data.settings);
  settings.branding = { ...(data.settings.branding || {}), botName: event.target.elements.botName.value };
  act("save-settings", { settings }, "Settings saved.");
});
$("#send-now").onclick = () => confirm("Post now to every webhook that takes this post?") && act("send-digest", { kind: $("#send-kind").value }, "Posted.");
function previewUrl(format) { return "/api/admin?preview=" + $("#preview-kind").value + "&format=" + format; }
for (const el of ["#preview-out", "#preview-frame", "#preview-img"]) $(el).hidden = true;
$("#preview-html").onclick = () => { hidePreviews(); $("#preview-frame").src = previewUrl("html"); $("#preview-frame").hidden = false; };
$("#preview-text").onclick = async () => { hidePreviews(); const r = await api(previewUrl("text")); $("#preview-out").textContent = r.ok ? (r.text || "(nothing would be posted)") : r.error; $("#preview-out").hidden = false; };
$("#preview-png").onclick = async () => {
  hidePreviews(); flash("Rendering…");
  const response = await fetch(previewUrl("png"), { credentials: "same-origin" });
  if (!response.ok) { const r = await response.json().catch(() => ({})); return flash(r.error || "Rendering failed.", "error"); }
  $("#preview-img").src = URL.createObjectURL(await response.blob()); $("#preview-img").hidden = false; flash("");
};
function hidePreviews() { for (const el of ["#preview-out", "#preview-frame", "#preview-img"]) $(el).hidden = true; }
load();
`);
