// Which digests a webhook subscriber is due for, and which events each delivery carries.
// Shared by the subscriber webhook queue (discord-event-webhook-notifications.js).
import {
  automaticDigestRuns,
  eventsForDigest,
  eventsForLocalStartingSoon,
  startingSoonEventSentKey
} from "./event-notifications.js";
import { normalizeEventWorkspaceSettings } from "./event-settings.js";

function cleanDiscordId(value) {
  const text = String(value || "").trim();
  if (!/^\d{15,22}$/.test(text)) throw new TypeError("Unknown Discord event subscriber.");
  return text;
}

function normalizedSubscriberSettings(subscriber, now) {
  const discordId = cleanDiscordId(subscriber?.discordId);
  return normalizeEventWorkspaceSettings({
    ...(subscriber?.settings || {}),
    ownerId: `discord:${discordId}`
  }, `discord:${discordId}`, now);
}

export function discordEventNotificationCandidates(subscriber, eventPayload, now = Date.now()) {
  if (!subscriber?.enabled || subscriber?.paused) return [];
  const settings = normalizedSubscriberSettings(subscriber, now);
  const candidates = [];
  for (const run of automaticDigestRuns(now, settings)) {
    candidates.push({
      kind: run.kind,
      deliveryKey: `${run.kind}:${run.localDate}`,
      scheduledFor: run.scheduledAt
    });
  }
  if (settings.schedules?.startingSoon?.enabled === true) {
    const events = eventsForLocalStartingSoon(eventPayload?.calendarEvents, now, settings);
    for (const event of events) {
      const deliveryKey = startingSoonEventSentKey(event);
      if (!deliveryKey) continue;
      candidates.push({ kind: "starting-soon", deliveryKey, scheduledFor: now });
    }
  }
  return [...new Map(candidates.map(row => [row.deliveryKey, row])).values()];
}


export function discordEventDeliveryEvents(delivery, subscriber, payload, now = Date.now()) {
  const settings = normalizedSubscriberSettings(subscriber, now);
  const kind = String(delivery?.kind || "").trim().toLowerCase();
  if (kind === "starting-soon") {
    return {
      kind,
      settings,
      // Re-check at consumption time so delayed retries never announce an
      // event after its starting-soon window has already passed.
      events: eventsForLocalStartingSoon(payload?.calendarEvents, now, settings)
        .filter(event => startingSoonEventSentKey(event) === delivery.deliveryKey)
    };
  }
  return {
    kind,
    settings,
    events: eventsForDigest(payload?.calendarEvents, kind, Number(delivery?.scheduledFor) || now, settings)
  };
}

