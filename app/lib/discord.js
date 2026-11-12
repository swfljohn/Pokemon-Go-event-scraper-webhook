import { randomBytes } from "node:crypto";
import { readHeader } from "./auth.js";

const DISCORD_API = "https://discord.com/api/v10";

export function discordConfigured() {
  return Boolean(
    process.env.DISCORD_CLIENT_ID &&
    process.env.DISCORD_CLIENT_SECRET &&
    process.env.SESSION_SECRET
  );
}

export function requestOrigin(request) {
  const configuredUrl = process.env.SITE_URL || "";
  if (configuredUrl) return new URL(configuredUrl).origin;

  const protocol = readHeader(request, "x-forwarded-proto") || "https";
  const host = readHeader(request, "x-forwarded-host") || readHeader(request, "host");
  if (!host) throw new Error("Unable to determine the site hostname.");
  return `${protocol}://${host}`;
}

export function incomingRequestOrigin(request) {
  const protocol = readHeader(request, "x-forwarded-proto") || "https";
  const host = readHeader(request, "x-forwarded-host") || readHeader(request, "host");
  if (host) return `${protocol}://${host}`;
  try {
    return new URL(request?.url || "").origin;
  } catch {
    throw new Error("Unable to determine the incoming site hostname.");
  }
}

export function discordRedirectUri(request) {
  return `${requestOrigin(request)}/api/discord-callback`;
}

export function createOAuthState() {
  return randomBytes(32).toString("base64url");
}

export function discordAuthorizationUrl(request, state) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID || "");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", discordRedirectUri(request));
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export async function exchangeDiscordCode(request, code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || "",
    client_secret: process.env.DISCORD_CLIENT_SECRET || "",
    grant_type: "authorization_code",
    code,
    redirect_uri: discordRedirectUri(request)
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Discord token exchange failed.");
  }
  return payload;
}

export async function fetchDiscordUser(accessToken) {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8000)
  });
  const user = await response.json().catch(() => ({}));
  if (!response.ok || !user.id) {
    throw new Error(user.message || "Discord user lookup failed.");
  }
  return user;
}
