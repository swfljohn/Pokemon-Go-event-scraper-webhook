// Branding for your deployment. Set SITE_NAME and SITE_URL in wrangler.jsonc vars.
export function siteName() {
  return String(process.env.SITE_NAME || "Pokémon GO Event Webhook").trim();
}

export function siteUrl() {
  const value = String(process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  return value || "http://localhost:8787";
}

/** Absolute link to a page on this site. */
export function siteLink(path = "/") {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Host shown in graphics footers, e.g. "example.com". */
export function siteHost() {
  try { return new URL(siteUrl()).host; } catch { return siteUrl(); }
}

/** Time zone the admin ("owner") posts use unless changed in /admin. IANA name, e.g. "Europe/London". */
export function defaultTimeZone() {
  const zone = String(process.env.DEFAULT_TIME_ZONE || "").trim();
  try {
    if (zone) { new Intl.DateTimeFormat("en-US", { timeZone: zone }); return zone; }
  } catch { /* fall through */ }
  return "America/New_York";
}
