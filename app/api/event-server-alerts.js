import { browserMutationIsTrusted, readHeader } from "../lib/auth.js";
import { DAILY_TIME_ZONE_OPTIONS } from "../lib/time-zones.js";
import {
  claimDiscordEventWebhookSubscriberTest,
  deleteDiscordEventWebhookSubscriber,
  discordEventWebhookSubscriberPublicValue,
  pauseDiscordEventWebhookSubscriber,
  readDiscordEventWebhookSubscriber,
  readDiscordEventWebhookTarget,
  recordDiscordEventWebhookSubscriberTestResult,
  saveVerifiedDiscordEventWebhookSubscriber,
  updateDiscordEventWebhookSubscriberPreferences
} from "../lib/discord-event-webhook-subscribers.js";
import {
  DiscordWebhookDeliveryError,
  sendEventDigestWebhook
} from "../lib/discord-webhook.js";
import { EVENT_CATEGORY_OPTIONS, normalizeEventWorkspaceSettings } from "../lib/event-settings.js";
import { normalizeDiscordWebhookUrl, normalizeEventWebhookName } from "../lib/event-webhooks.js";
import { sendApiFailure, sendJson } from "../lib/http.js";
import { parseRequestBody } from "../lib/request-body.js";
import { readAuthorizedSession } from "../lib/session.js";
import { siteName, siteUrl } from "../lib/site.js";

const TEST_COOLDOWN_MS = 60 * 1_000;
const CONSENT_VERSION = "server-webhook-v1";

function publicSubscription(value) {
  return value ? discordEventWebhookSubscriberPublicValue(value) : null;
}

function basePayload(identity, subscription = null) {
  return {
    ok: true,
    signedIn: Boolean(identity),
    username: identity?.username || "",
    displayName: identity?.displayName || identity?.username || "",
    subscription: publicSubscription(subscription),
    timeZones: DAILY_TIME_ZONE_OPTIONS,
    categories: EVENT_CATEGORY_OPTIONS
  };
}

async function requireIdentity(request, response) {
  const identity = await readAuthorizedSession(request);
  if (!identity) {
    sendJson(response, 401, {
      ...basePayload(null),
      ok: false,
      error: "Sign in with Discord to manage a server-channel event destination."
    });
    return null;
  }
  return identity;
}

function strictBrowserMutationIsTrusted(request) {
  return Boolean(readHeader(request, "origin").trim()) && browserMutationIsTrusted(request);
}

function subscriptionSettings(body, discordId, now) {
  const source = body?.settings && typeof body.settings === "object" ? body.settings : body;
  const settings = normalizeEventWorkspaceSettings(
    { ...source, updatedAt: now },
    `discord:${discordId}`,
    now
  );
  if (!settings.categories.length) throw new TypeError("Choose at least one event category.");
  if (!settings.scopes.global && !settings.scopes.local) {
    throw new TypeError("Choose global events, local events, or both.");
  }
  if (!Object.values(settings.schedules || {}).some(schedule => schedule?.enabled === true)) {
    throw new TypeError("Choose at least one alert schedule.");
  }
  return settings;
}

function requireDestinationConsent(body) {
  if (body?.consent !== true) {
    throw new TypeError("Confirm server-channel notification consent before saving.");
  }
  if (body?.serverPermission !== true) {
    throw new TypeError("Confirm that you are allowed to use this Discord webhook.");
  }
}

function publicDeliveryError(error) {
  if (!(error instanceof DiscordWebhookDeliveryError)) return error;
  const mapped = new Error(error.permanentDestinationFailure
    ? "Discord rejected that webhook. Create a new webhook for the channel and try again."
    : error.retryable
      ? "Discord is temporarily unavailable or rate limiting this webhook. Try again shortly."
      : "Discord could not confirm a message in that webhook channel.");
  mapped.statusCode = error.retryable ? 503 : 409;
  mapped.retryAfterMs = error.retryAfterMs;
  mapped.cause = error;
  return mapped;
}

async function claimTest(discordId, now) {
  const claim = await claimDiscordEventWebhookSubscriberTest(discordId, {
    cooldownMs: TEST_COOLDOWN_MS
  }, now);
  if (claim?.allowed) return;
  const error = new Error("Wait a moment before sending another server-channel test.");
  error.statusCode = 429;
  error.retryAfterMs = Math.max(0, Number(claim?.retryAfterMs) || TEST_COOLDOWN_MS);
  throw error;
}

function testEmbed(now) {
  return [{
    title: `${siteName()} event alerts are connected`,
    description: `This Discord server channel is ready. Future messages will follow the event types, schedules, time zone and location filters you chose at ${siteUrl()}.`,
    url: siteUrl(),
    color: 0x7d3cff,
    timestamp: new Date(now).toISOString(),
    footer: { text: `${siteName()} · Server channel test` }
  }];
}

async function sendTestToUrl(url, now) {
  try {
    const sent = await sendEventDigestWebhook(testEmbed(now), url);
    if (!sent) throw new Error("Discord did not confirm the server-channel test.");
    return true;
  } catch (error) {
    throw publicDeliveryError(error);
  }
}

async function testSavedSubscription(discordId, now) {
  const existing = await readDiscordEventWebhookSubscriber(discordId);
  if (!existing) throw new TypeError("Save a Discord server webhook before sending a test.");
  await claimTest(discordId, now);
  const target = await readDiscordEventWebhookTarget(discordId, { includeInactive: true });
  if (!target?.webhookUrl) throw new TypeError("The saved Discord webhook is unavailable. Replace it and try again.");
  try {
    await sendTestToUrl(target.webhookUrl, now);
    await recordDiscordEventWebhookSubscriberTestResult(discordId, { success: true }, now);
  } catch (error) {
    const source = error instanceof DiscordWebhookDeliveryError ? error : error?.cause;
    await recordDiscordEventWebhookSubscriberTestResult(discordId, {
      success: false,
      error,
      errorCode: source?.discordCode || source?.status || "",
      permanent: source?.permanentDestinationFailure === true
    }, now).catch(() => {});
    throw error;
  }
}

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { ok: false, error: "Method not allowed." });
  }
  const identity = await requireIdentity(request, response);
  if (!identity) return response;

  if (request.method === "GET") {
    if (!identity.enabled) {
      return sendJson(response, 403, { ok: false, error: "Your sign-up is waiting for an administrator to approve it." });
    }
    try {
      return sendJson(response, 200, basePayload(
        identity,
        await readDiscordEventWebhookSubscriber(identity.discordId)
      ));
    } catch (error) {
      return sendApiFailure(response, error, { event: "discord-event-server-alert-read-failed" });
    }
  }

  if (!strictBrowserMutationIsTrusted(request)) {
    return sendJson(response, 403, { ok: false, error: "Invalid request origin." });
  }
  if (!identity.enabled) {
    return sendJson(response, 403, { ok: false, error: "Your sign-up is waiting for an administrator to approve it." });
  }
  const action = new URL(request.url, "http://localhost").searchParams.get("action") || "";
  const body = parseRequestBody(request.body);
  const now = Date.now();
  try {
    if (action === "save") {
      requireDestinationConsent(body);
      const settings = subscriptionSettings(body, identity.discordId, now);
      const existing = await readDiscordEventWebhookSubscriber(identity.discordId);
      const requestedUrl = String(body?.webhookUrl || "").trim();
      let existingTarget = null;
      if (existing) {
        try {
          existingTarget = await readDiscordEventWebhookTarget(identity.discordId, { includeInactive: true });
        } catch (error) {
          if (!requestedUrl) throw error;
        }
      }
      let webhookUrl = "";
      let tested = false;
      if (requestedUrl) {
        webhookUrl = normalizeDiscordWebhookUrl(requestedUrl);
        if (!existingTarget || webhookUrl !== existingTarget.webhookUrl) {
          await claimTest(identity.discordId, now);
          await sendTestToUrl(webhookUrl, now);
          tested = true;
        }
      } else {
        if (!existing) throw new TypeError("Enter a Discord webhook URL for the server channel.");
        webhookUrl = String(existingTarget?.webhookUrl || "");
        if (!webhookUrl) throw new TypeError("The saved Discord webhook is unavailable. Paste a replacement URL.");
      }
      const input = {
        discordId: identity.discordId,
        name: normalizeEventWebhookName(body?.name),
        settings,
        consent: true,
        consentVersion: CONSENT_VERSION
      };
      let subscription = tested || !existing
        ? await saveVerifiedDiscordEventWebhookSubscriber({
            ...input,
            url: webhookUrl,
            verified: true
          }, now)
        : await updateDiscordEventWebhookSubscriberPreferences(input, now);
      if (tested) {
        subscription = await recordDiscordEventWebhookSubscriberTestResult(
          identity.discordId,
          { success: true },
          now
        ) || subscription;
      }
      return sendJson(response, 200, {
        ...basePayload(identity, subscription),
        saved: true,
        tested,
        message: tested
          ? "Server channel tested, saved, and enabled."
          : subscription?.paused
            ? "Server-channel preferences saved. Delivery remains paused."
            : "Server-channel preferences saved."
      });
    }
    if (action === "test") {
      await testSavedSubscription(identity.discordId, now);
      return sendJson(response, 200, {
        ...basePayload(identity, await readDiscordEventWebhookSubscriber(identity.discordId)),
        tested: true,
        message: "Server-channel test sent. Check the Discord channel."
      });
    }
    if (action === "pause") {
      const existing = await readDiscordEventWebhookSubscriber(identity.discordId);
      if (!existing) throw new TypeError("Save a Discord server webhook before changing its status.");
      if (body?.paused === false && (!existing.enabled || existing.lastSuccessAt <= 0)) {
        throw new TypeError("Send a successful server-channel test before resuming delivery.");
      }
      const subscription = await pauseDiscordEventWebhookSubscriber(identity.discordId, {
        paused: body?.paused !== false,
        reason: "Paused by subscriber."
      }, now);
      return sendJson(response, 200, {
        ...basePayload(identity, subscription),
        paused: subscription?.paused === true,
        message: subscription?.paused ? "Server-channel alerts paused." : "Server-channel alerts resumed."
      });
    }
    if (action === "delete") {
      const removed = await deleteDiscordEventWebhookSubscriber(identity.discordId);
      return sendJson(response, 200, {
        ...basePayload(identity, null),
        deleted: true,
        removed,
        message: "Saved server webhook and its event-alert preferences were removed."
      });
    }
    return sendJson(response, 400, { ok: false, error: "Unknown server alert action." });
  } catch (error) {
    return sendApiFailure(response, error, {
      event: "discord-event-server-alert-action-failed",
      fallbackStatus: 502
    });
  }
}
