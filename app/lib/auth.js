import { timingSafeEqual } from "node:crypto";

export function readHeader(request, name) {
  if (typeof request.headers?.get === "function") return String(request.headers.get(name) || "");
  const value = request.headers?.[name.toLowerCase()] ?? request.headers?.[name];
  return Array.isArray(value) ? value[0] : String(value || "");
}

export function bearerToken(request) {
  const match = readHeader(request, "authorization").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export function secretsMatch(candidate, expected) {
  if (!candidate || !expected) return false;
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Optional machine token (ADMIN_API_TOKEN) for scripts calling admin endpoints with `Authorization: Bearer`. */
export function adminTokenMatches(request) {
  return secretsMatch(bearerToken(request), process.env.ADMIN_API_TOKEN);
}

// Cookie-authenticated mutations must originate from this site.
export function browserMutationIsTrusted(request) {
  const requestOrigin = new URL(String(request?.url || "http://localhost"), "http://localhost").origin;
  let allowedOrigin = requestOrigin;
  try {
    if (process.env.SITE_URL) allowedOrigin = new URL(process.env.SITE_URL).origin;
  } catch {}
  const origin = readHeader(request, "origin").trim();
  if (origin) {
    try {
      if (new URL(origin).origin !== allowedOrigin) return false;
    } catch {
      return false;
    }
  }
  const fetchSite = readHeader(request, "sec-fetch-site").trim().toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  return Boolean(origin || fetchSite) || requestOrigin === allowedOrigin;
}
