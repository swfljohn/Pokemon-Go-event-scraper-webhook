// Who may use the signup page. Admins come from ADMIN_DISCORD_IDS; everyone else gets a row here the first time they
// sign in with Discord. SIGNUP_MODE decides whether that row starts enabled:
//   open     (default) anyone who signs in can add a webhook
//   approval new users wait until an admin enables them in /admin
//   closed   only users an admin already enabled can sign in
import { readJson, withRedisLock, writeJson } from "./storage.js";

const ACCESS_KEY = "access:config";
const MAX_USERS = 5000;

export function signupMode() {
  const mode = String(process.env.SIGNUP_MODE || "open").trim().toLowerCase();
  return ["open", "approval", "closed"].includes(mode) ? mode : "open";
}

function cleanText(value, limit = 100) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function cleanUser(value, now) {
  const discordId = String(value?.discordId || "").trim();
  if (!/^\d{15,22}$/.test(discordId)) return null;
  return {
    discordId,
    username: cleanText(value?.username, 64),
    displayName: cleanText(value?.displayName, 64),
    enabled: value?.enabled === true,
    // Lets this user set a custom bot name/avatar on their webhook posts.
    customWebhookBranding: value?.customWebhookBranding === true,
    createdAt: Number(value?.createdAt) || now,
    lastLoginAt: Number(value?.lastLoginAt) || 0,
    updatedAt: Number(value?.updatedAt) || now
  };
}

export function normalizeAccessConfig(value, now = Date.now()) {
  const seen = new Set();
  const users = [];
  for (const raw of Array.isArray(value?.users) ? value.users : []) {
    const user = cleanUser(raw, now);
    if (!user || seen.has(user.discordId)) continue;
    seen.add(user.discordId);
    users.push(user);
    if (users.length >= MAX_USERS) break;
  }
  users.sort((a, b) => (a.displayName || a.username || a.discordId)
    .localeCompare(b.displayName || b.username || b.discordId, undefined, { numeric: true, sensitivity: "base" }));
  return { schemaVersion: 1, users, updatedAt: now };
}

export async function readAccessConfig() {
  return normalizeAccessConfig(await readJson(ACCESS_KEY));
}

export async function writeAccessConfig(value) {
  return withRedisLock("access-config", () => writeJson(ACCESS_KEY, normalizeAccessConfig(value)));
}

/** Record a Discord login; returns the user's access row (null when SIGNUP_MODE=closed and they are not listed). */
export async function recordDiscordLogin(discordUser, now = Date.now()) {
  const discordId = String(discordUser?.id || "").trim();
  if (!/^\d{15,22}$/.test(discordId)) return null;
  return withRedisLock("access-config", async () => {
    const config = normalizeAccessConfig(await readJson(ACCESS_KEY), now);
    let user = config.users.find(row => row.discordId === discordId);
    if (!user) {
      if (signupMode() === "closed") return null;
      user = cleanUser({ discordId, enabled: signupMode() === "open", createdAt: now }, now);
      config.users.push(user);
    }
    user.username = cleanText(discordUser.username, 64);
    user.displayName = cleanText(discordUser.global_name || discordUser.username, 64);
    user.lastLoginAt = now;
    await writeJson(ACCESS_KEY, normalizeAccessConfig(config, now));
    return { ...user };
  });
}

export async function userAccess(discordId) {
  const id = String(discordId || "").trim();
  const config = await readAccessConfig();
  return config.users.find(user => user.discordId === id) || null;
}

export async function eventWebhookBrandingAllowed(ownerId) {
  const match = /^discord:(\d{15,22})$/.exec(String(ownerId || "").trim().toLowerCase());
  if (!match) return String(ownerId || "") === "owner";
  const user = await userAccess(match[1]);
  return Boolean(user?.enabled && user.customWebhookBranding === true);
}

/** Admin edits: enable/disable a user, toggle branding, or remove them. */
export async function updateAccessUser(discordId, changes = {}, now = Date.now()) {
  const id = String(discordId || "").trim();
  return withRedisLock("access-config", async () => {
    const config = normalizeAccessConfig(await readJson(ACCESS_KEY), now);
    const index = config.users.findIndex(row => row.discordId === id);
    if (index < 0) {
      if (changes.remove) return null;
      if (!/^\d{15,22}$/.test(id)) throw new TypeError("Enter a Discord user ID (15-22 digits).");
      config.users.push(cleanUser({ discordId: id, createdAt: now }, now));
    }
    const at = index < 0 ? config.users.length - 1 : index;
    if (changes.remove) {
      config.users.splice(at, 1);
    } else {
      const user = config.users[at];
      if (typeof changes.enabled === "boolean") user.enabled = changes.enabled;
      if (typeof changes.customWebhookBranding === "boolean") user.customWebhookBranding = changes.customWebhookBranding;
      user.updatedAt = now;
    }
    await writeJson(ACCESS_KEY, normalizeAccessConfig(config, now));
    return changes.remove ? null : config.users[at];
  });
}
