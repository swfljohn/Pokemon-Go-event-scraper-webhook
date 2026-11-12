// Cloudflare Worker entry: HTTP routes, the every-minute cron (scrape + scheduled posts) and the delivery queue.
import admin from "../app/api/admin.js";
import discordCallback from "../app/api/discord-callback.js";
import discordLogin from "../app/api/discord-login.js";
import events from "../app/api/events.js";
import logout from "../app/api/logout.js";
import serverAlerts from "../app/api/event-server-alerts.js";
import session from "../app/api/session.js";
import {
  enqueueAutomaticDiscordEventWebhooks,
  processDiscordEventWebhookQueue
} from "../app/lib/discord-event-webhook-notifications.js";
import { processEventNotificationQueue, runAutomaticEventDigests } from "../app/lib/event-notifications.js";
import { fetchEventSpawns } from "../app/lib/event-spawns.js";
import { runWithRuntime } from "../app/lib/runtime-context.js";
import { renderEventsPage } from "../app/pages/events-page.js";
import { siteName } from "../app/lib/site.js";
import { ADMIN_PAGE, SIGNUP_PAGE } from "../app/pages/static-pages.js";
import { PayloadTooLargeError, runLegacyHandler } from "./legacy-adapter.js";

const API_ROUTES = new Map([
  ["/api/admin", admin],
  ["/api/discord-callback", discordCallback],
  ["/api/discord-login", discordLogin],
  ["/api/events", events],
  ["/api/logout", logout],
  ["/api/server-alerts", serverAlerts],
  ["/api/session", session]
]);

const PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY"
};

// Cloudflare bindings and string vars arrive on `env`; the shared library reads configuration from process.env
// (nodejs_compat), so mirror string values there for each invocation.
function exposeEnv(env) {
  if (typeof process === "undefined" || !process.env) return;
  for (const [key, value] of Object.entries(env || {})) {
    if (typeof value === "string") process.env[key] = value;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

// The static pages are written with the default name; swap in SITE_NAME (HTML-escaped).
function branded(html) {
  const name = siteName().replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  return html.replaceAll("Pokémon GO Event Webhook", name);
}

function page(html, { cache = "no-store" } = {}) {
  return new Response(html, { headers: { ...PAGE_HEADERS, "Cache-Control": cache } });
}

export default {
  async fetch(request, env, ctx) {
    exposeEnv(env);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      const handler = API_ROUTES.get(path);
      if (handler) {
        return await runWithRuntime(env, ctx, () => runLegacyHandler(handler, request, { maxBodyBytes: 256_000 }));
      }
      if (request.method !== "GET" && request.method !== "HEAD") return json({ ok: false, error: "Not found." }, 404);
      if (path === "/") return page(branded(SIGNUP_PAGE));
      if (path === "/admin") return page(branded(ADMIN_PAGE));
      if (path === "/events") {
        const result = await runWithRuntime(env, ctx, () => fetchEventSpawns());
        return page(renderEventsPage(result, url.searchParams.get("event") || ""), {
          cache: "public, max-age=300, stale-while-revalidate=900"
        });
      }
      if (path === "/healthz") return json({ ok: true });
      if (path === "/favicon.ico") return new Response(null, { status: 204 });
      return json({ ok: false, error: "Not found." }, 404);
    } catch (error) {
      if (error instanceof PayloadTooLargeError || Number(error?.status) === 413) {
        return json({ ok: false, error: "Request body is too large." }, 413);
      }
      console.error(JSON.stringify({ event: "request-failed", path, error: String(error?.message || error).slice(0, 240) }));
      return json({ ok: false, error: "Internal server error." }, 500);
    }
  },

  async scheduled(controller, env, ctx) {
    exposeEnv(env);
    const now = Number(controller?.scheduledTime) || Date.now();
    await runWithRuntime(env, ctx, async () => {
      // Scraping happens here, never on a visitor's request: pages and the API read the stored snapshot.
      const eventSnapshot = fetchEventSpawns({ now, refreshDiscovery: true });
      const results = await Promise.allSettled([
        eventSnapshot,
        eventSnapshot.then(eventPayload => runAutomaticEventDigests(now, { eventPayload })),
        eventSnapshot.then(eventPayload => enqueueAutomaticDiscordEventWebhooks(now, { eventPayload }))
      ]);
      for (const result of results) {
        if (result.status === "rejected") {
          console.error(JSON.stringify({
            event: "scheduled-run-failed",
            error: String(result.reason?.message || result.reason).slice(0, 300)
          }));
        }
      }
    });
  },

  async queue(batch, env, ctx) {
    exposeEnv(env);
    await runWithRuntime(env, ctx, async () => {
      for (const message of batch.messages || []) {
        try {
          const body = message.body;
          if (body?.type === "discord-event-webhook") await processDiscordEventWebhookQueue(body);
          else await processEventNotificationQueue([body]);
          message.ack();
        } catch (error) {
          console.error(JSON.stringify({
            event: "event-queue-message-failed",
            attempts: Number(message.attempts) || 0,
            error: String(error?.message || error).slice(0, 300)
          }));
          message.retry({ delaySeconds: Math.min(900, 60 * Math.max(1, Number(message.attempts) || 1)) });
        }
      }
    });
  }
};
