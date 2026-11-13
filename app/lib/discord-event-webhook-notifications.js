import {
  claimDiscordEventWebhookDelivery,
  completeDiscordEventWebhookDelivery,
  failDiscordEventWebhookDelivery,
  listActiveDiscordEventWebhookSubscribersPage,
  pruneDiscordEventWebhookActionLimits,
  pruneDiscordEventWebhookDeliveries,
  readDiscordEventWebhookDeliveryCompletedBatches,
  readDiscordEventWebhookSubscriber,
  readDiscordEventWebhookTarget,
  recordDiscordEventWebhookDeliveryBatch,
  recoverStaleQueuedDiscordEventWebhookDeliveries,
  releaseQueuedDiscordEventWebhookDelivery,
  requeueDueFailedDiscordEventWebhookDeliveries,
  reserveDiscordEventWebhookDelivery
} from "./discord-event-webhook-subscribers.js";
import {
  discordEventDeliveryEvents,
  discordEventNotificationCandidates
} from "./event-delivery-candidates.js";
import {
  DiscordWebhookDeliveryError,
  sendEventDigestWebhook
} from "./discord-webhook.js";
import { dailyReviewParts, eventDigestMessages } from "./event-notifications.js";
import { fetchEventSpawns } from "./event-spawns.js";
import { EVENT_COORDINATE_LINK_PROVIDERS } from "./event-webhooks.js";
import { runtimeBinding } from "./runtime-context.js";

const ACTIVE_PAGE_SIZE = 250;
const QUEUE_SEND_BATCH_SIZE = 100;
const CLAIM_LEASE_MS = 5 * 60 * 1_000;
const STALE_QUEUE_RESERVATION_MS = 10 * 60 * 1_000;
const DELIVERY_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;
const DELIVERY_VARIANT = "server-webhook-v1";

function pageRows(page) {
  if (Array.isArray(page)) return page;
  return Array.isArray(page?.subscribers)
    ? page.subscribers
    : Array.isArray(page?.results) ? page.results : [];
}

function pageCursor(page, rows, previousCursor) {
  const explicit = String(page?.nextCursor || page?.nextDiscordId || "").trim();
  if (explicit && explicit !== previousCursor) return explicit;
  if (page?.hasMore === true && rows.length) {
    const last = String(rows.at(-1)?.discordId || "").trim();
    if (last && last !== previousCursor) return last;
  }
  return "";
}

async function reserveSubscriberCandidates(subscriber, eventPayload, now) {
  const reservations = [];
  for (const candidate of discordEventNotificationCandidates(subscriber, eventPayload, now)) {
    const result = await reserveDiscordEventWebhookDelivery({
      discordId: subscriber.discordId,
      deliveryKey: candidate.deliveryKey,
      variantHash: DELIVERY_VARIANT,
      kind: candidate.kind,
      scheduledFor: candidate.scheduledFor
    }, now);
    if (!result?.reserved || !result?.delivery?.id || !result?.queueToken) continue;
    reservations.push({
      deliveryId: String(result.delivery.id),
      queueToken: String(result.queueToken)
    });
  }
  return reservations;
}

async function releaseReservations(reservations) {
  await Promise.allSettled((Array.isArray(reservations) ? reservations : []).map(reference =>
    releaseQueuedDiscordEventWebhookDelivery(reference)
  ));
}

export async function enqueueDiscordEventWebhookReservations(queue, reservations, {
  release = releaseReservations
} = {}) {
  const rows = Array.isArray(reservations) ? reservations : [];
  let queuedMessages = 0;
  for (let offset = 0; offset < rows.length; offset += QUEUE_SEND_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + QUEUE_SEND_BATCH_SIZE);
    try {
      if (typeof queue?.sendBatch === "function") {
        await queue.sendBatch(batch.map(delivery => ({
          body: { type: "discord-event-webhook", delivery },
          contentType: "json"
        })));
      } else {
        for (const delivery of batch) {
          await queue.send(
            { type: "discord-event-webhook", delivery },
            { contentType: "json" }
          );
        }
      }
      queuedMessages += batch.length;
    } catch (error) {
      await release(rows.slice(offset));
      throw error;
    }
  }
  return queuedMessages;
}

export async function enqueueAutomaticDiscordEventWebhooks(now = Date.now(), { eventPayload = null } = {}) {
  const payload = eventPayload || await fetchEventSpawns({ now });
  if (payload?.stale === true) {
    throw new Error("Event sources are degraded; Discord server-channel scheduling will retry on the next refresh.");
  }
  await pruneDiscordEventWebhookDeliveries({
    before: Math.max(0, now - DELIVERY_RETENTION_MS),
    limit: ACTIVE_PAGE_SIZE
  });
  await pruneDiscordEventWebhookActionLimits({
    before: now,
    limit: ACTIVE_PAGE_SIZE
  });
  const reservations = await recoverStaleQueuedDiscordEventWebhookDeliveries({
    staleBefore: Math.max(0, now - STALE_QUEUE_RESERVATION_MS),
    limit: ACTIVE_PAGE_SIZE,
    now
  });
  reservations.push(...await requeueDueFailedDiscordEventWebhookDeliveries({
    limit: ACTIVE_PAGE_SIZE,
    now
  }));

  let cursor = "";
  let subscriberCount = 0;
  do {
    const page = await listActiveDiscordEventWebhookSubscribersPage({
      afterDiscordId: cursor,
      cursor,
      limit: ACTIVE_PAGE_SIZE
    });
    const subscribers = pageRows(page);
    for (const subscriber of subscribers) {
      subscriberCount += 1;
      reservations.push(...await reserveSubscriberCandidates(subscriber, payload, now));
    }
    cursor = pageCursor(page, subscribers, cursor);
  } while (cursor);

  if (!reservations.length) {
    return { subscriberCount, deliveryCount: 0, queuedMessages: 0 };
  }
  const queue = runtimeBinding("DISCORD_EVENT_WEBHOOK_QUEUE") ?? runtimeBinding("EVENT_NOTIFICATION_QUEUE");
  if (!queue?.send) {
    const context = { payload };
    for (const delivery of reservations) {
      await processDiscordEventWebhookQueue({ type: "discord-event-webhook", delivery }, now, context);
    }
    return {
      subscriberCount,
      deliveryCount: reservations.length,
      queuedMessages: 0,
      deliveredInline: true
    };
  }
  return {
    subscriberCount,
    deliveryCount: reservations.length,
    queuedMessages: await enqueueDiscordEventWebhookReservations(queue, reservations)
  };
}

function retryError(message, retryAfterMs = 0) {
  const error = new Error(message || "Discord server-channel delivery should be retried.");
  error.retryAfterMs = Math.max(0, Number(retryAfterMs) || 0);
  return error;
}

export function discordEventWebhookFailureDisposition(error) {
  if (error instanceof DiscordWebhookDeliveryError) {
    const permanentDestinationFailure = error.permanentDestinationFailure === true;
    return {
      permanentDestinationFailure,
      retryable: error.retryable === true,
      terminal: permanentDestinationFailure || error.retryable !== true,
      retryAfterMs: Math.max(0, Number(error.retryAfterMs) || 0)
    };
  }
  return {
    permanentDestinationFailure: false,
    retryable: true,
    terminal: false,
    retryAfterMs: Math.max(0, Number(error?.retryAfterMs) || 0)
  };
}

async function processClaimedDelivery(claim, payload, now) {
  const delivery = claim.delivery;
  const subscriber = await readDiscordEventWebhookSubscriber(delivery.discordId);
  const target = subscriber?.enabled && !subscriber?.paused
    ? await readDiscordEventWebhookTarget(delivery.discordId, {
        destinationRevision: delivery.destinationRevision
      })
    : null;
  if (!subscriber || !subscriber.enabled || subscriber.paused || !target?.webhookUrl) {
    await completeDiscordEventWebhookDelivery({
      deliveryId: delivery.id,
      claimToken: claim.claimToken,
      messageIds: []
    }, now);
    return { deliveryId: delivery.id, skipped: true, reason: "destination-inactive" };
  }

  const plan = discordEventDeliveryEvents(delivery, subscriber, payload, now);
  if (!plan.events.length) {
    await completeDiscordEventWebhookDelivery({
      deliveryId: delivery.id,
      claimToken: claim.claimToken,
      messageIds: []
    }, now);
    return { deliveryId: delivery.id, sent: false, eventCount: 0 };
  }

  const messageTime = plan.kind === "starting-soon"
    ? now
    : Number(delivery.scheduledFor) || now;
  // Subscribers get the same daily graphic + text as admin webhooks, in their own time zone.
  const messages = plan.kind === "today" && Array.isArray(payload?.calendarEvents)
    ? await dailyReviewParts(payload.calendarEvents, plan.settings?.timeZone || undefined, messageTime).then(parts => [...parts.daily, ...parts.local])
    : eventDigestMessages(plan.events, plan.kind, plan.settings, {
    type: "webhook",
    coordinateLinks: EVENT_COORDINATE_LINK_PROVIDERS
  }, messageTime);
  const completed = new Set(await readDiscordEventWebhookDeliveryCompletedBatches(delivery.id));
  for (let index = 0; index < messages.length; index += 1) {
    if (completed.has(index)) continue;
    const sent = await sendEventDigestWebhook(messages[index], target.webhookUrl);
    if (!sent) throw new Error("Discord did not confirm the server-channel event alert.");
    await recordDiscordEventWebhookDeliveryBatch({
      deliveryId: delivery.id,
      claimToken: claim.claimToken,
      batchIndex: index
    }, now);
  }
  const completedResult = await completeDiscordEventWebhookDelivery({
    deliveryId: delivery.id,
    claimToken: claim.claimToken,
    messageIds: []
  }, now);
  if (!completedResult?.completed) {
    throw retryError("The server-channel delivery checkpoint could not be completed.");
  }
  return {
    deliveryId: delivery.id,
    sent: true,
    eventCount: plan.events.length,
    messageCount: messages.length
  };
}

export async function processDiscordEventWebhookQueue(message, now = Date.now(), context = {}) {
  if (message?.type !== "discord-event-webhook") return { processed: 0, results: [] };
  const reference = message?.delivery;
  if (!reference?.deliveryId || !reference?.queueToken) return { processed: 0, results: [] };
  context.payload ||= await fetchEventSpawns({ now });
  if (context.payload?.stale === true) {
    throw retryError("Event sources are degraded; Discord server-channel delivery will retry on the next refresh.");
  }
  const claim = await claimDiscordEventWebhookDelivery({
    deliveryId: String(reference.deliveryId),
    queueToken: String(reference.queueToken),
    leaseMs: CLAIM_LEASE_MS
  }, now);
  if (!claim?.claimed) {
    const nextAttemptAt = Number(claim?.delivery?.nextAttemptAt) || 0;
    if (claim?.delivery?.status === "failed" && nextAttemptAt > now) {
      throw retryError("Discord asked this server-channel delivery to wait before retrying.", nextAttemptAt - now);
    }
    return { processed: 0, results: [] };
  }

  try {
    const result = await processClaimedDelivery(claim, context.payload, now);
    return { processed: 1, results: [result] };
  } catch (error) {
    const {
      permanentDestinationFailure,
      retryable,
      terminal,
      retryAfterMs
    } = discordEventWebhookFailureDisposition(error);
    await failDiscordEventWebhookDelivery({
      deliveryId: claim.delivery.id,
      claimToken: claim.claimToken,
      error,
      errorCode: String(error?.discordCode || error?.status || error?.code || ""),
      retryAfterMs,
      permanent: terminal,
      pauseSubscriber: permanentDestinationFailure
    }, now);
    if (retryable) throw error;
    return {
      processed: 1,
      results: [{
        deliveryId: claim.delivery.id,
        sent: false,
        permanent: terminal,
        destinationPaused: permanentDestinationFailure
      }]
    };
  }
}
