// Administrator API behind /admin. Signed-in Discord users listed in ADMIN_DISCORD_IDS, or scripts sending
// `Authorization: Bearer <ADMIN_API_TOKEN>`.
//
// GET  /api/admin                         overview (owner settings, owner webhooks, users, subscribers, source health)
// GET  /api/admin?preview=today|local|week|monthly[&format=html|text|png]   post preview (graphic page, text, or PNG)
// POST /api/admin?action=...              see ACTIONS below
import { adminTokenMatches, browserMutationIsTrusted } from "../lib/auth.js";
import { readAccessConfig, signupMode, updateAccessUser } from "../lib/access.js";
import {
  buildDailyReview, buildEventListReview, buildLocalReview, dailyReviewHtml, dailyReviewText,
  eventListReviewHtml, eventListReviewText, localReviewHtml, localReviewText, renderReviewPng, reviewAheadDays
} from "../lib/daily-review.js";
import { sendEventDigestWebhook } from "../lib/discord-webhook.js";
import {
  deleteDiscordEventWebhookSubscriber, listAllDiscordEventWebhookSubscribers, pauseDiscordEventWebhookSubscriber
} from "../lib/discord-event-webhook-subscribers.js";
import { eventDigestWindow, eventsForDigest, sendEventDigest } from "../lib/event-notifications.js";
import {
  EVENT_CATEGORY_OPTIONS, eventWorkspaceSettingsPublicValue, readEventWorkspaceSettings, writeEventWorkspaceSettings
} from "../lib/event-settings.js";
import { fetchEventSpawns } from "../lib/event-spawns.js";
import {
  addEventWebhookDestinations, eventWebhookTarget, listEventWebhookDestinations, recordEventWebhookDelivery,
  removeEventWebhookDestination, updateEventWebhookDestination
} from "../lib/event-webhooks.js";
import { sendApiFailure, sendJson } from "../lib/http.js";
import { parseRequestBody } from "../lib/request-body.js";
import { readAuthorizedSession } from "../lib/session.js";
import { siteName } from "../lib/site.js";
import { DAILY_TIME_ZONE_OPTIONS } from "../lib/time-zones.js";

const OWNER = "owner";
const PREVIEW_CSP = "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

async function requireAdmin(request) {
  if (adminTokenMatches(request)) return { discordId: "api-token", isAdmin: true, token: true };
  const session = await readAuthorizedSession(request);
  return session?.isAdmin ? session : null;
}

function sourceHealth(result) {
  return (Array.isArray(result?.sourceHealth) ? result.sourceHealth : []).map(row => ({
    id: String(row?.id || "").slice(0, 80),
    label: String(row?.label || "").slice(0, 160),
    status: String(row?.status || "unknown").slice(0, 40),
    fetchedAt: Math.max(0, Number(row?.fetchedAt) || 0),
    discoveredCount: Math.max(0, Number(row?.discoveredCount) || 0),
    note: String(row?.note || "").slice(0, 300),
    error: String(row?.error || "").slice(0, 240)
  }));
}

async function overview() {
  const [settings, webhooks, access, subscribers, events] = await Promise.all([
    readEventWorkspaceSettings(OWNER),
    listEventWebhookDestinations(OWNER),
    readAccessConfig(),
    listAllDiscordEventWebhookSubscribers({ limit: 500 }).catch(() => []),
    fetchEventSpawns().catch(error => ({ error: String(error?.message || error) }))
  ]);
  return {
    ok: true,
    siteName: siteName(),
    signupMode: signupMode(),
    settings: eventWorkspaceSettingsPublicValue(settings, OWNER, { brandingAllowed: true }),
    webhooks,
    users: access.users,
    subscribers,
    timeZones: DAILY_TIME_ZONE_OPTIONS,
    categories: EVENT_CATEGORY_OPTIONS,
    events: {
      count: Array.isArray(events?.calendarEvents) ? events.calendarEvents.length : 0,
      fetchedAt: Math.max(0, Number(events?.fetchedAt) || 0),
      stale: Boolean(events?.stale),
      error: String(events?.error || events?.sourceError || "").slice(0, 240),
      sourceHealth: sourceHealth(events)
    }
  };
}

/** Build one of the four review posts (the graphic page + copyable text) from the current event snapshot. */
export async function buildPreview(kind, { now = Date.now(), timeZone } = {}) {
  const settings = await readEventWorkspaceSettings(OWNER);
  const zone = timeZone || settings.timeZone;
  const payload = await fetchEventSpawns({ now });
  const events = payload?.calendarEvents || [];
  if (kind === "week" || kind === "monthly") {
    const list = buildEventListReview(eventsForDigest(events, kind, now, settings), kind, {
      now, timeZone: zone, windowStart: eventDigestWindow(kind, now, zone).startAt
    });
    return { html: list ? eventListReviewHtml(list) : "", text: list ? eventListReviewText(list) : "", height: 1350 };
  }
  const aheadDays = reviewAheadDays(now, zone);
  if (kind === "local") {
    const review = buildLocalReview(events, { now, timeZone: zone, aheadDays });
    return { html: review ? localReviewHtml(review) : "", text: review ? localReviewText(review) : "", height: 700 };
  }
  const review = buildDailyReview(events, { now, timeZone: zone, aheadDays });
  return { html: dailyReviewHtml(review), text: dailyReviewText(review), height: 1350 };
}

async function preview(request, response, url) {
  const kind = String(url.searchParams.get("preview") || "today").toLowerCase();
  if (!["today", "local", "week", "monthly"].includes(kind)) {
    return sendJson(response, 400, { ok: false, error: "preview must be today, local, week or monthly." });
  }
  const format = String(url.searchParams.get("format") || "html").toLowerCase();
  // ?at=<ISO time> previews the post as it would go out at that moment (default: now).
  const at = Date.parse(String(url.searchParams.get("at") || ""));
  const { html, text, height } = await buildPreview(kind, { now: Number.isFinite(at) ? at : Date.now() });
  if (format === "text") return sendJson(response, 200, { ok: true, kind, text });
  if (format === "png") {
    const png = html ? await renderReviewPng(html, { env: process.env, height }) : null;
    if (!png) {
      return sendJson(response, 409, {
        ok: false,
        error: html
          ? "PNG rendering needs BROWSER_RENDERING_TOKEN and CLOUDFLARE_ACCOUNT_ID (see README → Daily graphics)."
          : "Nothing would be posted for this preview right now."
      });
    }
    response.setHeader("Content-Type", "image/png");
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).end(png);
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", PREVIEW_CSP);
  return response.status(200).end(html || "<p style=\"font-family:sans-serif\">Nothing would be posted for this preview right now.</p>");
}

const ACTIONS = {
  // Re-scrape every source now (normally the cron does this every minute from the cached snapshot).
  async "refresh-sources"() {
    const result = await fetchEventSpawns({ now: Date.now(), refreshDiscovery: true, force: true });
    return { refreshed: true, count: (result?.calendarEvents || []).length, sourceHealth: sourceHealth(result) };
  },
  async "save-settings"(body) {
    const safe = eventWorkspaceSettingsPublicValue(body.settings || body, OWNER, { brandingAllowed: true });
    const settings = await writeEventWorkspaceSettings(OWNER, safe);
    return { settings: eventWorkspaceSettingsPublicValue(settings, OWNER, { brandingAllowed: true }) };
  },
  async "add-webhooks"(body) {
    await addEventWebhookDestinations(body.destinations || body.urls, Date.now(), OWNER);
    return { webhooks: await listEventWebhookDestinations(OWNER) };
  },
  async "update-webhook"(body) {
    return { webhooks: await updateEventWebhookDestination(body.id, body, Date.now(), OWNER) };
  },
  async "remove-webhook"(body) {
    await removeEventWebhookDestination(body.id, Date.now(), OWNER);
    return { webhooks: await listEventWebhookDestinations(OWNER) };
  },
  async "test-webhook"(body) {
    const target = await eventWebhookTarget(OWNER, body.id);
    try {
      await sendEventDigestWebhook([{
        title: `${siteName()} webhook test`,
        description: "This Discord channel is connected and ready for scheduled Pokémon GO event posts.",
        color: 0x7d3cff,
        timestamp: new Date().toISOString()
      }], target.url);
      await recordEventWebhookDelivery(OWNER, target.id, { success: true, tested: true });
    } catch (error) {
      await recordEventWebhookDelivery(OWNER, target.id, { success: false, tested: true, error: String(error?.message || error) }).catch(() => {});
      throw error;
    }
    return { tested: true, webhooks: await listEventWebhookDestinations(OWNER) };
  },
  // Post a digest to the admin webhooks right now (kind: today | week | monthly | weekend).
  async "send-digest"(body) {
    const kind = String(body.kind || "").trim().toLowerCase();
    const result = await sendEventDigest(kind, { automatic: false, ownerId: OWNER });
    return { ...result, message: !result.sent && !result.eventCount ? "No events match the saved filters for that period." : "" };
  },
  async "update-user"(body) {
    const user = await updateAccessUser(body.discordId, {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      customWebhookBranding: typeof body.customWebhookBranding === "boolean" ? body.customWebhookBranding : undefined,
      remove: body.remove === true
    });
    if (body.remove === true) await deleteDiscordEventWebhookSubscriber(body.discordId).catch(() => false);
    // Disabling a user also stops their posts; they can resume from the signup page once re-enabled.
    if (body.enabled === false) {
      await pauseDiscordEventWebhookSubscriber(body.discordId, { paused: true, reason: "Paused by an administrator." }).catch(() => null);
    }
    return { user, users: (await readAccessConfig()).users };
  },
  async "pause-subscriber"(body) {
    const subscriber = await pauseDiscordEventWebhookSubscriber(body.discordId, {
      paused: body.paused !== false, reason: body.paused === false ? "" : "Paused by an administrator."
    });
    return { subscriber };
  },
  async "delete-subscriber"(body) {
    return { deleted: await deleteDiscordEventWebhookSubscriber(body.discordId) };
  }
};

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { ok: false, error: "Method not allowed." });
  }
  const admin = await requireAdmin(request);
  if (!admin) return sendJson(response, 403, { ok: false, error: "Administrator access is required." });
  const url = new URL(request.url, "http://localhost");
  try {
    if (request.method === "GET") {
      if (url.searchParams.has("preview")) return await preview(request, response, url);
      return sendJson(response, 200, await overview());
    }
    if (!admin.token && !browserMutationIsTrusted(request)) {
      return sendJson(response, 403, { ok: false, error: "Invalid request origin." });
    }
    const action = ACTIONS[url.searchParams.get("action") || ""];
    if (!action) return sendJson(response, 400, { ok: false, error: "Unknown admin action." });
    return sendJson(response, 200, { ok: true, ...await action(parseRequestBody(request.body)) });
  } catch (error) {
    return sendApiFailure(response, error, { event: "admin-request-failed" });
  }
}
