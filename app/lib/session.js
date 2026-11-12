// Signed session cookies for Discord OAuth logins (HMAC-SHA256 with SESSION_SECRET).
import { createHmac, timingSafeEqual } from "node:crypto";
import { userAccess } from "./access.js";

export const SESSION_COOKIE = "pgew_session";
export const OAUTH_STATE_COOKIE = "pgew_oauth_state";
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

export function adminDiscordIds() {
  return new Set(String(process.env.ADMIN_DISCORD_IDS || "")
    .split(",")
    .map(value => value.trim())
    .filter(value => /^\d{15,22}$/.test(value)));
}

export function isAdminDiscordId(discordId) {
  return adminDiscordIds().has(String(discordId || "").trim());
}

const encode = value => Buffer.from(value).toString("base64url");
const decode = value => Buffer.from(value, "base64url").toString("utf8");
const signature = (value, secret) => createHmac("sha256", secret).update(value).digest("base64url");

export function parseCookies(request) {
  const header = String(request.headers?.get?.("cookie") || request.headers?.cookie || "");
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try { cookies[name] = decodeURIComponent(value); } catch { cookies[name] = value; }
  }
  return cookies;
}

export function cookieValue(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || "/"}`];
  if (Number.isFinite(options.maxAge)) parts.push(`Max-Age=${Math.max(0, options.maxAge)}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.secure !== false) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  return parts.join("; ");
}

export function createSessionToken(user, secret, now = Date.now()) {
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  const payload = encode(JSON.stringify({
    discordId: String(user.id),
    username: String(user.username || ""),
    displayName: String(user.global_name || user.username || ""),
    avatar: String(user.avatar || ""),
    issuedAt: now,
    expiresAt: now + SESSION_DURATION_SECONDS * 1000
  }));
  return `${payload}.${signature(payload, secret)}`;
}

export function verifySessionToken(token, secret, now = Date.now()) {
  if (!token || !secret) return null;
  const [payload, candidateSignature, extra] = String(token).split(".");
  if (!payload || !candidateSignature || extra) return null;
  const candidate = Buffer.from(candidateSignature);
  const expected = Buffer.from(signature(payload, secret));
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return null;
  try {
    const value = JSON.parse(decode(payload));
    if (!/^\d{15,22}$/.test(String(value.discordId || ""))) return null;
    if (!Number.isFinite(value.expiresAt) || value.expiresAt <= now) return null;
    return value;
  } catch {
    return null;
  }
}

/** Signed-in Discord identity (no access check). */
export function readDiscordIdentitySession(request, now = Date.now()) {
  const session = verifySessionToken(parseCookies(request)[SESSION_COOKIE], process.env.SESSION_SECRET, now);
  if (!session) return null;
  return {
    discordId: String(session.discordId),
    username: String(session.username || ""),
    displayName: String(session.displayName || session.username || ""),
    avatar: String(session.avatar || ""),
    isAdmin: isAdminDiscordId(session.discordId)
  };
}

/** Signed-in identity plus current access (re-read every request so disabling a user takes effect at once). */
export async function readAuthorizedSession(request) {
  const identity = readDiscordIdentitySession(request);
  if (!identity) return null;
  if (identity.isAdmin) return { ...identity, enabled: true, customWebhookBranding: true, pending: false };
  const access = await userAccess(identity.discordId);
  if (!access) return null;
  return {
    ...identity,
    enabled: access.enabled,
    pending: !access.enabled,
    customWebhookBranding: access.enabled && access.customWebhookBranding === true
  };
}

// The webhook signup API uses this name.
export const readEffectiveDiscordIdentity = readDiscordIdentitySession;
