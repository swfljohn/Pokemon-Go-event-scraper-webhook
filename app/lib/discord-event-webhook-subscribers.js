import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID
} from "node:crypto";
import {
  eventWorkspaceSettingsPublicValue,
  normalizeEventWorkspaceSettings
} from "./event-settings.js";
import { normalizeDiscordWebhookUrl } from "./event-webhooks.js";
import { runtimeBinding } from "./runtime-context.js";

const DISCORD_ID_PATTERN = /^\d{15,22}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENVELOPE_VERSION = 1;
const ENCRYPTION_CONTEXT = "pokemon-go-event-webhook/subscriber-webhook/v1";
const FINGERPRINT_CONTEXT = "pokemon-go-event-webhook/subscriber-webhook-fingerprint/v1";
const DEFAULT_CONSENT_VERSION = "server-webhook-v1";
const MAX_ACTIVE_PAGE_SIZE = 200;
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const MAX_LEASE_MS = 15 * 60 * 1000;
const MAX_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TEST_COOLDOWN_MS = 60 * 1000;
const DEFAULT_TEST_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_TEST_WINDOW_LIMIT = 5;
const MAX_DELIVERY_ATTEMPTS = 8;

function cleanText(value, maximumLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function cleanDiagnostic(value, fallback = "") {
  const message = cleanText(value, 800)
    .replace(/(?:https?:\/\/[^\s]+)?\/api\/webhooks\/\d+\/[^\s]+/gi, "[discord-webhook]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b(password|secret|token|authorization)(\s*[=:]\s*)[^\s,;]+/gi, "$1$2[redacted]");
  return (message || fallback).slice(0, 240);
}

function cleanErrorCode(value) {
  const code = cleanText(value, 64);
  if (/^\d{1,12}$/.test(code)) return code;
  if (/^DISCORD_[A-Z0-9_.:-]{1,39}$/.test(code)) return code;
  if (/^HTTP_[1-5]\d\d$/.test(code)) return code;
  return "";
}

function safeFailureDiagnostic(error, fallback) {
  const status = Number(error?.status ?? error?.statusCode);
  const discordCode = Number(error?.discordCode ?? error?.code);
  if (error?.permanentDestinationFailure === true || error?.permanentRecipientFailure === true) {
    return "Discord webhook is unavailable.";
  }
  if (status === 429 || discordCode === 429) return "Discord rate limited the webhook.";
  if (status >= 500 || error?.retryable === true) {
    return "Discord webhook delivery is temporarily unavailable.";
  }
  return fallback;
}

function timestamp(value, label = "timestamp") {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new TypeError(`A valid ${label} is required.`);
  }
  return number;
}

function currentTimestamp(value) {
  return timestamp(value == null ? Date.now() : value, "current timestamp");
}

function positiveInteger(value, fallback, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(number)));
}

function normalizeUuid(value, label) {
  const id = cleanText(value, 64);
  if (!UUID_PATTERN.test(id)) throw new TypeError(`A valid ${label} is required.`);
  return id.toLowerCase();
}

export function normalizeDiscordEventWebhookSubscriberId(value) {
  const id = cleanText(value, 24);
  if (!DISCORD_ID_PATTERN.test(id)) throw new TypeError("A valid Discord user ID is required.");
  return id;
}

function normalizeConsentVersion(value) {
  const version = cleanText(value || DEFAULT_CONSENT_VERSION, 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._:-]{0,63}$/.test(version)) {
    throw new TypeError("A valid webhook consent version is required.");
  }
  return version;
}

function normalizeDestinationName(value) {
  return cleanText(value, 60) || "Discord server";
}

function parseObject(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseMessageIds(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed
      .map(item => cleanText(item, 24))
      .filter(item => DISCORD_ID_PATTERN.test(item)))];
  } catch {
    return [];
  }
}

function parseBatchIndexes(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed
      .map(Number)
      .filter(index => Number.isInteger(index) && index >= 0 && index <= 999))]
      .sort((left, right) => left - right);
  } catch {
    return [];
  }
}

function encryptionSecret() {
  const secret = String(process.env.EVENT_WEBHOOK_ENCRYPTION_KEY || "").trim();
  if (secret.length < 24) {
    throw new Error("Event webhook encryption is not configured.");
  }
  return secret;
}

function derivedKey(context) {
  return createHash("sha256")
    .update(`${context}:${encryptionSecret()}`)
    .digest();
}

function ownerAad(discordId) {
  return Buffer.from(`${ENCRYPTION_CONTEXT}:owner:${normalizeDiscordEventWebhookSubscriberId(discordId)}`, "utf8");
}

function encryptWebhookUrl(url, discordId) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey(ENCRYPTION_CONTEXT), iv);
  cipher.setAAD(ownerAad(discordId));
  const data = Buffer.concat([cipher.update(String(url), "utf8"), cipher.final()]);
  return {
    version: ENVELOPE_VERSION,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: data.toString("base64url")
  };
}

function decryptWebhookUrl(value, discordId) {
  if (Number(value?.version) !== ENVELOPE_VERSION || !value?.iv || !value?.tag || !value?.data) {
    throw new Error("Saved Discord webhook is unavailable.");
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      derivedKey(ENCRYPTION_CONTEXT),
      Buffer.from(String(value.iv), "base64url")
    );
    decipher.setAAD(ownerAad(discordId));
    decipher.setAuthTag(Buffer.from(String(value.tag), "base64url"));
    return normalizeDiscordWebhookUrl(Buffer.concat([
      decipher.update(Buffer.from(String(value.data), "base64url")),
      decipher.final()
    ]).toString("utf8"));
  } catch {
    throw new Error("Saved Discord webhook is unavailable.");
  }
}

function webhookFingerprint(url) {
  return createHmac("sha256", derivedKey(FINGERPRINT_CONTEXT))
    .update(String(url), "utf8")
    .digest("hex");
}

function webhookIdHint(url) {
  const webhookId = new URL(url).pathname.split("/")[3] || "";
  return webhookId.slice(-4);
}

function normalizeSubscriberSettings(value, discordId, now) {
  const settings = normalizeEventWorkspaceSettings(
    { ...(value || {}), updatedAt: now },
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

function subscriberFromRow(row) {
  if (!row) return null;
  const discordId = normalizeDiscordEventWebhookSubscriberId(row.discord_id);
  const updatedAt = Math.max(0, Number(row.updated_at) || 0);
  let settings;
  try {
    settings = normalizeEventWorkspaceSettings(
      parseObject(row.settings_json),
      `discord:${discordId}`,
      updatedAt
    );
  } catch {
    settings = normalizeEventWorkspaceSettings({}, `discord:${discordId}`, updatedAt);
  }
  const hint = /^\d{1,4}$/.test(String(row.webhook_id_hint || ""))
    ? String(row.webhook_id_hint)
    : "";
  return {
    discordId,
    name: normalizeDestinationName(row.destination_name),
    destinationRevision: Math.max(1, Number(row.destination_revision) || 1),
    settings,
    webhookConfigured: true,
    webhookHint: hint,
    webhookLabel: `Discord webhook ••••${hint || "saved"}`,
    enabled: Number(row.enabled) === 1,
    paused: Number(row.paused) === 1,
    pauseReason: cleanDiagnostic(row.pause_reason),
    startingSoonEnabled: Number(row.starting_soon_enabled) === 1,
    consentVersion: normalizeConsentVersion(row.consent_version),
    consentedAt: Math.max(0, Number(row.consented_at) || 0),
    verifiedAt: Math.max(0, Number(row.verified_at) || 0),
    pausedAt: Math.max(0, Number(row.paused_at) || 0),
    lastTestAt: Math.max(0, Number(row.last_test_at) || 0),
    lastDeliveryAt: Math.max(0, Number(row.last_delivery_at) || 0),
    lastDeliveryStatus: cleanText(row.last_delivery_status, 24),
    consecutiveFailures: Math.max(0, Number(row.consecutive_failures) || 0),
    lastSuccessAt: Math.max(0, Number(row.last_success_at) || 0),
    lastFailureAt: Math.max(0, Number(row.last_failure_at) || 0),
    lastErrorCode: cleanErrorCode(row.last_error_code),
    lastError: cleanDiagnostic(row.last_error),
    createdAt: Math.max(0, Number(row.created_at) || 0),
    updatedAt
  };
}

function deliveryFromRow(row) {
  if (!row) return null;
  return {
    id: cleanText(row.id, 64),
    discordId: normalizeDiscordEventWebhookSubscriberId(row.discord_id),
    destinationRevision: Math.max(1, Number(row.destination_revision) || 1),
    deliveryKey: cleanText(row.delivery_key, 200),
    variantHash: cleanText(row.variant_hash, 128),
    kind: cleanText(row.kind, 64),
    scheduledFor: Math.max(0, Number(row.scheduled_for) || 0),
    status: cleanText(row.status, 24),
    attempts: Math.max(0, Number(row.attempts) || 0),
    claimExpiresAt: Math.max(0, Number(row.claim_expires_at) || 0),
    messageIds: parseMessageIds(row.message_ids_json),
    completedBatchIndexes: parseBatchIndexes(row.completed_batches_json),
    lastErrorCode: cleanErrorCode(row.last_error_code),
    lastError: cleanDiagnostic(row.last_error),
    permanentFailure: Number(row.permanent_failure) === 1,
    nextAttemptAt: Math.max(0, Number(row.next_attempt_at) || 0),
    queuedAt: Math.max(0, Number(row.queued_at) || 0),
    claimedAt: Math.max(0, Number(row.claimed_at) || 0),
    completedAt: Math.max(0, Number(row.completed_at) || 0),
    failedAt: Math.max(0, Number(row.failed_at) || 0),
    createdAt: Math.max(0, Number(row.created_at) || 0),
    updatedAt: Math.max(0, Number(row.updated_at) || 0)
  };
}

export function discordEventWebhookSubscriberPublicValue(value) {
  if (!value) return null;
  return {
    discordId: normalizeDiscordEventWebhookSubscriberId(value.discordId),
    name: normalizeDestinationName(value.name),
    settings: eventWorkspaceSettingsPublicValue(value.settings, `discord:${value.discordId}`),
    webhookConfigured: value.webhookConfigured === true,
    webhookHint: /^\d{1,4}$/.test(String(value.webhookHint || "")) ? String(value.webhookHint) : "",
    webhookLabel: cleanText(value.webhookLabel, 80),
    enabled: value.enabled === true,
    paused: value.paused === true,
    pauseReason: cleanDiagnostic(value.pauseReason),
    startingSoonEnabled: value.startingSoonEnabled === true,
    consentVersion: normalizeConsentVersion(value.consentVersion),
    consentedAt: Math.max(0, Number(value.consentedAt) || 0),
    verifiedAt: Math.max(0, Number(value.verifiedAt) || 0),
    pausedAt: Math.max(0, Number(value.pausedAt) || 0),
    lastTestAt: Math.max(0, Number(value.lastTestAt) || 0),
    lastDeliveryAt: Math.max(0, Number(value.lastDeliveryAt) || 0),
    lastDeliveryStatus: cleanText(value.lastDeliveryStatus, 24),
    consecutiveFailures: Math.max(0, Number(value.consecutiveFailures) || 0),
    lastSuccessAt: Math.max(0, Number(value.lastSuccessAt) || 0),
    lastFailureAt: Math.max(0, Number(value.lastFailureAt) || 0),
    lastErrorCode: cleanErrorCode(value.lastErrorCode),
    lastError: cleanDiagnostic(value.lastError),
    createdAt: Math.max(0, Number(value.createdAt) || 0),
    updatedAt: Math.max(0, Number(value.updatedAt) || 0)
  };
}

export function discordEventWebhookDeliveryPublicValue(value) {
  if (!value) return null;
  return {
    id: cleanText(value.id, 64),
    discordId: normalizeDiscordEventWebhookSubscriberId(value.discordId),
    deliveryKey: cleanText(value.deliveryKey, 200),
    kind: cleanText(value.kind, 64),
    scheduledFor: Math.max(0, Number(value.scheduledFor) || 0),
    status: cleanText(value.status, 24),
    attempts: Math.max(0, Number(value.attempts) || 0),
    messageCount: Array.isArray(value.messageIds) ? value.messageIds.length : 0,
    completedBatchIndexes: parseBatchIndexes(JSON.stringify(value.completedBatchIndexes || [])),
    lastErrorCode: cleanErrorCode(value.lastErrorCode),
    lastError: cleanDiagnostic(value.lastError),
    permanentFailure: value.permanentFailure === true,
    nextAttemptAt: Math.max(0, Number(value.nextAttemptAt) || 0),
    queuedAt: Math.max(0, Number(value.queuedAt) || 0),
    claimedAt: Math.max(0, Number(value.claimedAt) || 0),
    completedAt: Math.max(0, Number(value.completedAt) || 0),
    failedAt: Math.max(0, Number(value.failedAt) || 0),
    createdAt: Math.max(0, Number(value.createdAt) || 0),
    updatedAt: Math.max(0, Number(value.updatedAt) || 0)
  };
}

function changes(result) {
  return Math.max(0, Number(result?.meta?.changes ?? result?.changes) || 0);
}

function normalizedDatabase(database) {
  if (!database?.prepare) throw new Error("Discord event webhook storage is unavailable.");
  return database.withSession ? database.withSession("first-primary") : database;
}

function runtimeDatabase() {
  return normalizedDatabase(runtimeBinding("DB"));
}

function deliveryKey(value) {
  const key = cleanText(value, 200);
  if (!key) throw new TypeError("A delivery key is required.");
  return key;
}

function deliveryKind(value) {
  const kind = cleanText(value, 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9:_-]{0,63}$/.test(kind)) {
    throw new TypeError("A valid delivery kind is required.");
  }
  return kind;
}

function variantHash(value) {
  return cleanText(value, 128);
}

function messageIdList(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError("Discord message IDs must be an array.");
  const ids = [...new Set(value.map(item => cleanText(item, 24)).filter(item => DISCORD_ID_PATTERN.test(item)))];
  if (ids.length > 100) throw new TypeError("Too many Discord message IDs were supplied.");
  return ids;
}

function duplicateWebhookError(error) {
  if (!/unique constraint failed:[^\n]*webhook_fingerprint/i.test(String(error?.message || error))) return error;
  const duplicate = new TypeError("That Discord webhook is already connected.");
  duplicate.statusCode = 409;
  return duplicate;
}

export function createStore(database) {
  const db = normalizedDatabase(database);

  async function read(discordId) {
    const cleanId = normalizeDiscordEventWebhookSubscriberId(discordId);
    return subscriberFromRow(await db.prepare(`
      SELECT discord_id, destination_name, destination_revision, settings_json, webhook_id_hint, enabled, paused,
        pause_reason, starting_soon_enabled, consent_version, consented_at,
        verified_at, paused_at, last_test_at, last_delivery_at,
        last_delivery_status, consecutive_failures, last_success_at,
        last_failure_at, last_error_code, last_error, created_at, updated_at
      FROM discord_event_webhook_subscribers
      WHERE discord_id = ?
    `).bind(cleanId).first());
  }

  async function saveVerified(input, now = input?.now ?? Date.now()) {
    if (input?.consent !== true) throw new TypeError("Confirm Discord server-webhook consent before saving.");
    if (input?.verified !== true) throw new TypeError("Verify the Discord webhook before saving it.");
    const current = currentTimestamp(now);
    const discordId = normalizeDiscordEventWebhookSubscriberId(input?.discordId);
    const url = normalizeDiscordWebhookUrl(input?.url);
    const name = normalizeDestinationName(input?.name);
    const settings = normalizeSubscriberSettings(input?.settings, discordId, current);
    const consentVersion = normalizeConsentVersion(input?.consentVersion);
    const encrypted = JSON.stringify(encryptWebhookUrl(url, discordId));
    const fingerprint = webhookFingerprint(url);
    const hint = webhookIdHint(url);
    const startingSoonEnabled = settings.schedules.startingSoon.enabled ? 1 : 0;
    try {
      await db.prepare(`
        INSERT INTO discord_event_webhook_subscribers (
          discord_id, settings_json, destination_name, webhook_secret_json, webhook_fingerprint,
          webhook_id_hint, destination_revision, enabled, paused, pause_reason,
          starting_soon_enabled, consent_version, consented_at, verified_at,
          paused_at, last_test_at, last_delivery_at, last_delivery_status,
          consecutive_failures, last_success_at, last_failure_at,
          last_error_code, last_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, '', ?, ?, ?, ?, 0, ?, ?, 'sent', 0, ?, 0, '', '', ?, ?)
        ON CONFLICT(discord_id) DO UPDATE SET
          settings_json = excluded.settings_json,
          destination_name = excluded.destination_name,
          webhook_secret_json = excluded.webhook_secret_json,
          destination_revision = CASE
            WHEN discord_event_webhook_subscribers.webhook_fingerprint <> excluded.webhook_fingerprint
            THEN discord_event_webhook_subscribers.destination_revision + 1
            ELSE discord_event_webhook_subscribers.destination_revision
          END,
          webhook_fingerprint = excluded.webhook_fingerprint,
          webhook_id_hint = excluded.webhook_id_hint,
          enabled = 1,
          paused = 0,
          pause_reason = '',
          starting_soon_enabled = excluded.starting_soon_enabled,
          consent_version = excluded.consent_version,
          consented_at = excluded.consented_at,
          verified_at = excluded.verified_at,
          paused_at = 0,
          last_test_at = excluded.last_test_at,
          last_delivery_at = excluded.last_delivery_at,
          last_delivery_status = 'sent',
          consecutive_failures = 0,
          last_success_at = excluded.last_success_at,
          last_error_code = '',
          last_error = '',
          updated_at = excluded.updated_at
      `).bind(
        discordId,
        JSON.stringify(settings),
        name,
        encrypted,
        fingerprint,
        hint,
        startingSoonEnabled,
        consentVersion,
        current,
        current,
        current,
        current,
        current,
        current,
        current
      ).run();
    } catch (error) {
      throw duplicateWebhookError(error);
    }
    return read(discordId);
  }

  async function updatePreferences(input, now = input?.now ?? Date.now()) {
    if (input?.consent !== true) throw new TypeError("Confirm Discord server-webhook consent before saving.");
    const current = currentTimestamp(now);
    const discordId = normalizeDiscordEventWebhookSubscriberId(input?.discordId);
    const name = normalizeDestinationName(input?.name);
    const settings = normalizeSubscriberSettings(input?.settings, discordId, current);
    const consentVersion = normalizeConsentVersion(input?.consentVersion);
    const startingSoonEnabled = settings.schedules.startingSoon.enabled ? 1 : 0;
    const result = await db.prepare(`
      UPDATE discord_event_webhook_subscribers
      SET settings_json = ?, destination_name = ?, starting_soon_enabled = ?,
        consent_version = ?, consented_at = ?, updated_at = ?
      WHERE discord_id = ?
    `).bind(
      JSON.stringify(settings),
      name,
      startingSoonEnabled,
      consentVersion,
      current,
      current,
      discordId
    ).run();
    if (!changes(result)) throw new TypeError("Save a Discord server webhook before updating its preferences.");
    return read(discordId);
  }

  async function readTarget(discordId, options = {}) {
    const cleanId = normalizeDiscordEventWebhookSubscriberId(discordId);
    const requestedRevision = options?.destinationRevision == null
      ? 0
      : positiveInteger(options.destinationRevision, 1, Number.MAX_SAFE_INTEGER);
    const row = await db.prepare(`
      SELECT discord_id, destination_name, destination_revision, settings_json,
        webhook_secret_json, webhook_id_hint, updated_at
      FROM discord_event_webhook_subscribers
      WHERE discord_id = ?
        AND (? = 0 OR destination_revision = ?)
        ${options?.includeInactive === true ? "" : "AND enabled = 1 AND paused = 0"}
    `).bind(cleanId, requestedRevision, requestedRevision).first();
    if (!row) return null;
    const url = decryptWebhookUrl(parseObject(row.webhook_secret_json), cleanId);
    return {
      discordId: cleanId,
      name: normalizeDestinationName(row.destination_name),
      destinationRevision: Math.max(1, Number(row.destination_revision) || 1),
      webhookUrl: url,
      webhookHint: /^\d{1,4}$/.test(String(row.webhook_id_hint || "")) ? String(row.webhook_id_hint) : "",
      settings: normalizeEventWorkspaceSettings(
        parseObject(row.settings_json),
        `discord:${cleanId}`,
        Math.max(0, Number(row.updated_at) || 0)
      )
    };
  }

  async function pause(discordId, options = {}, now = Date.now()) {
    const cleanId = normalizeDiscordEventWebhookSubscriberId(discordId);
    const current = currentTimestamp(now);
    const paused = options?.paused !== false;
    const existing = await read(cleanId);
    if (!existing) return null;
    if (!paused && !existing.enabled) return existing;
    const reason = paused ? cleanDiagnostic(options?.reason, "Paused by subscriber.") : "";
    await db.prepare(`
      UPDATE discord_event_webhook_subscribers
      SET paused = ?, pause_reason = ?, paused_at = ?, updated_at = ?
      WHERE discord_id = ?
    `).bind(paused ? 1 : 0, reason, paused ? current : 0, current, cleanId).run();
    return read(cleanId);
  }

  async function deleteSubscriber(discordId) {
    const cleanId = normalizeDiscordEventWebhookSubscriberId(discordId);
    const result = await db.prepare(`
      DELETE FROM discord_event_webhook_subscribers WHERE discord_id = ?
    `).bind(cleanId).run();
    return changes(result) > 0;
  }

  async function listActivePage(options = {}) {
    const limit = positiveInteger(options?.limit, 100, MAX_ACTIVE_PAGE_SIZE);
    const cursor = options?.cursor || options?.afterDiscordId
      ? normalizeDiscordEventWebhookSubscriberId(options.cursor || options.afterDiscordId)
      : "";
    const startingSoonOnly = options?.startingSoonOnly === true;
    const result = await db.prepare(`
      SELECT discord_id, destination_name, destination_revision, settings_json, webhook_id_hint, enabled, paused,
        pause_reason, starting_soon_enabled, consent_version, consented_at,
        verified_at, paused_at, last_test_at, last_delivery_at,
        last_delivery_status, consecutive_failures, last_success_at,
        last_failure_at, last_error_code, last_error, created_at, updated_at
      FROM discord_event_webhook_subscribers
      WHERE enabled = 1 AND paused = 0 AND discord_id > ?
        ${startingSoonOnly ? "AND starting_soon_enabled = 1" : ""}
      ORDER BY discord_id ASC
      LIMIT ?
    `).bind(cursor, limit + 1).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const subscribers = rows.slice(0, limit).map(subscriberFromRow).filter(Boolean);
    return {
      subscribers,
      nextCursor: rows.length > limit ? subscribers.at(-1)?.discordId || "" : ""
    };
  }

  // Admin panel: every subscriber (active, paused or disabled), newest first.
  async function listAll(options = {}) {
    const limit = positiveInteger(options?.limit, 200, 1000);
    const result = await db.prepare(`
      SELECT discord_id, destination_name, destination_revision, settings_json, webhook_id_hint, enabled, paused,
        pause_reason, starting_soon_enabled, consent_version, consented_at,
        verified_at, paused_at, last_test_at, last_delivery_at,
        last_delivery_status, consecutive_failures, last_success_at,
        last_failure_at, last_error_code, last_error, created_at, updated_at
      FROM discord_event_webhook_subscribers
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all();
    return (Array.isArray(result?.results) ? result.results : []).map(subscriberFromRow).filter(Boolean);
  }

  async function claimTest(discordId, options = {}, now = Date.now()) {
    const cleanId = normalizeDiscordEventWebhookSubscriberId(discordId);
    const current = currentTimestamp(now);
    const cooldownMs = Math.min(
      MAX_RETRY_AFTER_MS,
      Math.max(1_000, positiveInteger(options?.cooldownMs, DEFAULT_TEST_COOLDOWN_MS, MAX_RETRY_AFTER_MS))
    );
    const windowMs = Math.min(
      MAX_RETRY_AFTER_MS,
      Math.max(cooldownMs, positiveInteger(options?.windowMs, DEFAULT_TEST_WINDOW_MS, MAX_RETRY_AFTER_MS))
    );
    const windowLimit = positiveInteger(options?.windowLimit, DEFAULT_TEST_WINDOW_LIMIT, 100);
    const expiresAt = current + windowMs;
    const result = await db.prepare(`
      INSERT INTO discord_event_webhook_action_limits (
        discord_id, action, last_claim_at, window_started_at,
        window_expires_at, action_count, expires_at, updated_at
      ) VALUES (?, 'test', ?, ?, ?, 1, ?, ?)
      ON CONFLICT(discord_id, action) DO UPDATE SET
        last_claim_at = excluded.last_claim_at,
        window_started_at = CASE
          WHEN discord_event_webhook_action_limits.window_expires_at <= ?
          THEN excluded.window_started_at ELSE discord_event_webhook_action_limits.window_started_at END,
        window_expires_at = CASE
          WHEN discord_event_webhook_action_limits.window_expires_at <= ?
          THEN excluded.window_expires_at ELSE discord_event_webhook_action_limits.window_expires_at END,
        action_count = CASE
          WHEN discord_event_webhook_action_limits.window_expires_at <= ?
          THEN 1 ELSE discord_event_webhook_action_limits.action_count + 1 END,
        expires_at = CASE
          WHEN discord_event_webhook_action_limits.window_expires_at <= ?
          THEN excluded.expires_at ELSE discord_event_webhook_action_limits.expires_at END,
        updated_at = excluded.updated_at
      WHERE discord_event_webhook_action_limits.last_claim_at <= ?
        AND (
          discord_event_webhook_action_limits.window_expires_at <= ?
          OR discord_event_webhook_action_limits.action_count < ?
        )
    `).bind(
      cleanId,
      current,
      current,
      expiresAt,
      expiresAt,
      current,
      current,
      current,
      current,
      current,
      current - cooldownMs,
      current,
      windowLimit
    ).run();
    const row = await db.prepare(`
      SELECT last_claim_at, window_expires_at, action_count
      FROM discord_event_webhook_action_limits
      WHERE discord_id = ? AND action = 'test'
    `).bind(cleanId).first();
    const allowed = changes(result) > 0;
    const cooldownRetry = row ? Math.max(0, Number(row.last_claim_at) + cooldownMs - current) : 0;
    const windowRetry = row && Number(row.window_expires_at) > current && Number(row.action_count) >= windowLimit
      ? Number(row.window_expires_at) - current
      : 0;
    return {
      allowed,
      retryAfterMs: allowed ? 0 : Math.max(cooldownRetry, windowRetry),
      remaining: Math.max(0, windowLimit - Math.max(0, Number(row?.action_count) || 0)),
      subscriber: await read(cleanId)
    };
  }

  async function recordTestResult(discordId, options = {}, now = Date.now()) {
    const cleanId = normalizeDiscordEventWebhookSubscriberId(discordId);
    const current = currentTimestamp(now);
    if (options?.success !== true && options?.success !== false) {
      throw new TypeError("A Discord webhook test result is required.");
    }
    if (options.success === true) {
      const result = await db.prepare(`
        UPDATE discord_event_webhook_subscribers
        SET enabled = 1, paused = 0, pause_reason = '', paused_at = 0,
          verified_at = ?, last_test_at = ?, last_delivery_at = ?,
          last_delivery_status = 'sent', consecutive_failures = 0,
          last_success_at = ?, last_error_code = '', last_error = '', updated_at = ?
        WHERE discord_id = ?
      `).bind(current, current, current, current, current, cleanId).run();
      return changes(result) > 0 ? read(cleanId) : null;
    }
    const error = options?.error;
    const errorCode = cleanErrorCode(options?.errorCode ?? error?.discordCode ?? error?.code);
    const permanent = options?.permanent == null
      ? error?.permanentDestinationFailure === true || error?.permanentRecipientFailure === true
      : options.permanent === true;
    const errorMessage = permanent
      ? "Discord webhook is unavailable."
      : safeFailureDiagnostic(error, "Discord webhook test failed.");
    const result = await db.prepare(`
      UPDATE discord_event_webhook_subscribers
      SET enabled = CASE WHEN ? = 1 THEN 0 ELSE enabled END,
        paused = CASE WHEN ? = 1 THEN 1 ELSE paused END,
        pause_reason = CASE WHEN ? = 1 THEN 'Discord webhook is unavailable.' ELSE pause_reason END,
        paused_at = CASE WHEN ? = 1 THEN ? ELSE paused_at END,
        last_test_at = ?, last_delivery_at = ?,
        last_delivery_status = CASE WHEN ? = 1 THEN 'dead' ELSE 'failed' END,
        consecutive_failures = consecutive_failures + 1,
        last_failure_at = ?, last_error_code = ?, last_error = ?, updated_at = ?
      WHERE discord_id = ?
    `).bind(
      permanent ? 1 : 0,
      permanent ? 1 : 0,
      permanent ? 1 : 0,
      permanent ? 1 : 0,
      current,
      current,
      current,
      permanent ? 1 : 0,
      current,
      errorCode,
      errorMessage,
      current,
      cleanId
    ).run();
    return changes(result) > 0 ? read(cleanId) : null;
  }

  // Delivery lifecycle methods are defined below. They intentionally operate
  // only on opaque subscriber/delivery IDs; webhook credentials are resolved
  // separately through readTarget after an active claim is established.

  async function readDelivery(deliveryId) {
    const cleanId = normalizeUuid(deliveryId, "delivery ID");
    return deliveryFromRow(await db.prepare(`
      SELECT id, discord_id, destination_revision, delivery_key, variant_hash, kind, scheduled_for,
        status, claim_expires_at, attempts, message_ids_json,
        completed_batches_json, last_error_code, last_error,
        permanent_failure, next_attempt_at, queued_at, claimed_at,
        completed_at, failed_at, created_at, updated_at
      FROM discord_event_webhook_deliveries
      WHERE id = ?
    `).bind(cleanId).first());
  }

  async function readDeliveryByIdentity(discordId, key, hash) {
    return deliveryFromRow(await db.prepare(`
      SELECT delivery.id, delivery.discord_id, delivery.destination_revision,
        delivery.delivery_key, delivery.variant_hash, delivery.kind,
        delivery.scheduled_for, delivery.status, delivery.claim_expires_at,
        delivery.attempts, delivery.message_ids_json,
        delivery.completed_batches_json, delivery.last_error_code,
        delivery.last_error, delivery.permanent_failure,
        delivery.next_attempt_at, delivery.queued_at, delivery.claimed_at,
        delivery.completed_at, delivery.failed_at, delivery.created_at,
        delivery.updated_at
      FROM discord_event_webhook_deliveries delivery
      JOIN discord_event_webhook_subscribers subscriber
        ON subscriber.discord_id = delivery.discord_id
        AND subscriber.destination_revision = delivery.destination_revision
      WHERE delivery.discord_id = ? AND delivery.delivery_key = ? AND delivery.variant_hash = ?
    `).bind(discordId, key, hash).first());
  }

  async function reserveDelivery(input, now = input?.now ?? Date.now()) {
    const current = currentTimestamp(now);
    const discordId = normalizeDiscordEventWebhookSubscriberId(input?.discordId);
    const key = deliveryKey(input?.deliveryKey);
    const hash = variantHash(input?.variantHash);
    const kind = deliveryKind(input?.kind);
    const scheduledFor = timestamp(input?.scheduledFor, "scheduled delivery timestamp");
    const id = randomUUID();
    const queueToken = randomUUID();
    const result = await db.prepare(`
      INSERT INTO discord_event_webhook_deliveries (
        id, discord_id, destination_revision, delivery_key, variant_hash, kind, scheduled_for,
        status, queue_token, next_attempt_at, queued_at, created_at, updated_at
      )
      SELECT ?, discord_id, destination_revision, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?
      FROM discord_event_webhook_subscribers
      WHERE discord_id = ? AND enabled = 1 AND paused = 0
      ON CONFLICT(discord_id, destination_revision, delivery_key, variant_hash) DO NOTHING
    `).bind(
      id,
      key,
      hash,
      kind,
      scheduledFor,
      queueToken,
      current,
      current,
      current,
      current,
      discordId
    ).run();
    const reserved = changes(result) > 0;
    const delivery = reserved
      ? await readDelivery(id)
      : await readDeliveryByIdentity(discordId, key, hash);
    return {
      reserved,
      queueToken: reserved ? queueToken : "",
      reason: reserved ? "reserved" : delivery ? "duplicate" : "inactive",
      delivery
    };
  }

  async function releaseQueuedDelivery(input, now = input?.now ?? Date.now()) {
    const deliveryId = normalizeUuid(input?.deliveryId, "delivery ID");
    const queueToken = normalizeUuid(input?.queueToken, "queue token");
    const current = currentTimestamp(now);
    const restored = await db.prepare(`
      UPDATE discord_event_webhook_deliveries
      SET status = 'failed', next_attempt_at = 0, updated_at = ?
      WHERE id = ? AND status = 'queued' AND queue_token = ?
        AND (attempts > 0 OR completed_batches_json <> '[]')
    `).bind(current, deliveryId, queueToken).run();
    if (changes(restored) > 0) return true;
    const removed = await db.prepare(`
      DELETE FROM discord_event_webhook_deliveries
      WHERE id = ? AND status = 'queued' AND queue_token = ?
    `).bind(deliveryId, queueToken).run();
    return changes(removed) > 0;
  }

  async function recoverStaleQueued(options = {}) {
    const current = currentTimestamp(options?.now ?? Date.now());
    const staleBefore = timestamp(
      options?.staleBefore ?? current - 10 * 60 * 1000,
      "stale queue timestamp"
    );
    const limit = positiveInteger(options?.limit, 100, 500);
    const result = await db.prepare(`
      UPDATE discord_event_webhook_deliveries
      SET queued_at = ?, updated_at = ?
      WHERE id IN (
        SELECT delivery.id
        FROM discord_event_webhook_deliveries delivery
        JOIN discord_event_webhook_subscribers subscriber
          ON subscriber.discord_id = delivery.discord_id
          AND subscriber.destination_revision = delivery.destination_revision
        WHERE delivery.status = 'queued'
          AND delivery.queue_token <> ''
          AND delivery.queued_at <= ?
          AND subscriber.enabled = 1
          AND subscriber.paused = 0
        ORDER BY delivery.queued_at ASC, delivery.id ASC
        LIMIT ?
      )
        AND status = 'queued'
      RETURNING id AS delivery_id, queue_token
    `).bind(current, current, staleBefore, limit).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    return rows.map(row => ({
      deliveryId: normalizeUuid(row.delivery_id, "delivery ID"),
      queueToken: normalizeUuid(row.queue_token, "queue token")
    }));
  }

  async function requeueDueFailed(options = {}) {
    const current = currentTimestamp(options?.now ?? Date.now());
    const limit = positiveInteger(options?.limit, 100, 500);
    const result = await db.prepare(`
      UPDATE discord_event_webhook_deliveries
      SET status = 'queued', claim_token = '', claim_expires_at = 0,
        next_attempt_at = 0, queued_at = ?, updated_at = ?
      WHERE id IN (
        SELECT delivery.id
        FROM discord_event_webhook_deliveries delivery
        JOIN discord_event_webhook_subscribers subscriber
          ON subscriber.discord_id = delivery.discord_id
          AND subscriber.destination_revision = delivery.destination_revision
        WHERE delivery.status = 'failed'
          AND delivery.permanent_failure = 0
          AND delivery.queue_token <> ''
          AND delivery.next_attempt_at <= ?
          AND subscriber.enabled = 1
          AND subscriber.paused = 0
        ORDER BY delivery.next_attempt_at ASC, delivery.id ASC
        LIMIT ?
      )
        AND status = 'failed' AND permanent_failure = 0
      RETURNING id AS delivery_id, queue_token
    `).bind(current, current, current, limit).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    return rows.map(row => ({
      deliveryId: normalizeUuid(row.delivery_id, "delivery ID"),
      queueToken: normalizeUuid(row.queue_token, "queue token")
    }));
  }

  async function pruneActionLimits(options = {}) {
    const before = timestamp(options?.before ?? Date.now(), "action-limit retention timestamp");
    const limit = positiveInteger(options?.limit, 100, 500);
    const result = await db.prepare(`
      DELETE FROM discord_event_webhook_action_limits
      WHERE (discord_id, action) IN (
        SELECT discord_id, action
        FROM discord_event_webhook_action_limits
        WHERE expires_at <= ?
        ORDER BY expires_at ASC, discord_id ASC, action ASC
        LIMIT ?
      )
    `).bind(before, limit).run();
    return changes(result);
  }

  async function pruneDeliveries(options = {}) {
    const before = timestamp(options?.before, "delivery retention timestamp");
    const limit = positiveInteger(options?.limit, 100, 500);
    const result = await db.prepare(`
      DELETE FROM discord_event_webhook_deliveries
      WHERE id IN (
        SELECT id FROM discord_event_webhook_deliveries
        WHERE status IN ('sent', 'dead') AND updated_at < ?
        ORDER BY updated_at ASC, id ASC
        LIMIT ?
      )
    `).bind(before, limit).run();
    return changes(result);
  }

  async function claimDelivery(input, now = input?.now ?? Date.now()) {
    const current = currentTimestamp(now);
    const deliveryId = normalizeUuid(input?.deliveryId, "delivery ID");
    const queueToken = normalizeUuid(input?.queueToken, "queue token");
    const leaseMs = Math.min(
      MAX_LEASE_MS,
      Math.max(30_000, positiveInteger(input?.leaseMs, DEFAULT_LEASE_MS, MAX_LEASE_MS))
    );
    const claimToken = randomUUID();
    const result = await db.prepare(`
      UPDATE discord_event_webhook_deliveries
      SET status = 'processing', claim_token = ?, claim_expires_at = ?,
        attempts = attempts + 1, claimed_at = ?, updated_at = ?,
        last_error_code = '', last_error = ''
      WHERE id = ? AND queue_token = ? AND permanent_failure = 0
        AND EXISTS (
          SELECT 1 FROM discord_event_webhook_subscribers subscriber
          WHERE subscriber.discord_id = discord_event_webhook_deliveries.discord_id
            AND subscriber.destination_revision = discord_event_webhook_deliveries.destination_revision
            AND subscriber.enabled = 1 AND subscriber.paused = 0
        )
        AND (
          status = 'queued'
          OR (status = 'failed' AND next_attempt_at <= ?)
          OR (status = 'processing' AND claim_expires_at <= ?)
        )
    `).bind(
      claimToken,
      current + leaseMs,
      current,
      current,
      deliveryId,
      queueToken,
      current,
      current
    ).run();
    const claimed = changes(result) > 0;
    return {
      claimed,
      claimToken: claimed ? claimToken : "",
      delivery: await readDelivery(deliveryId)
    };
  }

  async function recordCompletedBatch(input, now = input?.now ?? Date.now()) {
    const current = currentTimestamp(now);
    const deliveryId = normalizeUuid(input?.deliveryId, "delivery ID");
    const claimToken = normalizeUuid(input?.claimToken, "claim token");
    const batchIndex = Number(input?.batchIndex);
    if (!Number.isInteger(batchIndex) || batchIndex < 0 || batchIndex > 999) {
      throw new TypeError("A valid Discord message batch index is required.");
    }
    const messageId = input?.messageId == null || String(input.messageId).trim() === ""
      ? ""
      : cleanText(input.messageId, 24);
    if (messageId && !DISCORD_ID_PATTERN.test(messageId)) {
      throw new TypeError("A valid Discord message ID is required.");
    }
    const result = await db.prepare(`
      UPDATE discord_event_webhook_deliveries
      SET completed_batches_json = CASE
          WHEN EXISTS (
            SELECT 1 FROM json_each(completed_batches_json)
            WHERE CAST(value AS INTEGER) = ?
          ) THEN completed_batches_json
          ELSE json_insert(completed_batches_json, '$[#]', ?)
        END,
        message_ids_json = CASE
          WHEN ? = '' OR EXISTS (
            SELECT 1 FROM json_each(message_ids_json) WHERE value = ?
          ) THEN message_ids_json
          ELSE json_insert(message_ids_json, '$[#]', ?)
        END,
        updated_at = ?
      WHERE id = ? AND status = 'processing' AND claim_token = ?
    `).bind(
      batchIndex,
      batchIndex,
      messageId,
      messageId,
      messageId,
      current,
      deliveryId,
      claimToken
    ).run();
    const delivery = await readDelivery(deliveryId);
    return {
      recorded: changes(result) > 0,
      completedBatchIndexes: delivery?.completedBatchIndexes || [],
      messageIds: delivery?.messageIds || []
    };
  }

  async function readCompletedBatches(deliveryId) {
    return (await readDelivery(deliveryId))?.completedBatchIndexes || [];
  }

  async function completeDelivery(input, now = input?.now ?? Date.now()) {
    const current = currentTimestamp(now);
    const deliveryId = normalizeUuid(input?.deliveryId, "delivery ID");
    const claimToken = normalizeUuid(input?.claimToken, "claim token");
    const existing = await readDelivery(deliveryId);
    if (!existing) return { completed: false, delivery: null };
    if (existing.status === "sent") {
      return { completed: true, alreadyCompleted: true, delivery: existing };
    }
    const messageIds = [...new Set([...existing.messageIds, ...messageIdList(input?.messageIds)])];
    const result = await db.prepare(`
      UPDATE discord_event_webhook_deliveries
      SET status = 'sent', claim_token = '', claim_expires_at = 0,
        queue_token = '', message_ids_json = ?, last_error_code = '',
        last_error = '', permanent_failure = 0, next_attempt_at = 0,
        completed_at = ?, updated_at = ?
      WHERE id = ? AND status = 'processing' AND claim_token = ?
    `).bind(
      JSON.stringify(messageIds),
      current,
      current,
      deliveryId,
      claimToken
    ).run();
    const completed = changes(result) > 0;
    if (completed) {
      await db.prepare(`
        UPDATE discord_event_webhook_subscribers
        SET consecutive_failures = 0, last_success_at = ?,
          last_delivery_at = ?, last_delivery_status = 'sent',
          last_error_code = '', last_error = '', updated_at = ?
        WHERE discord_id = ? AND destination_revision = ?
      `).bind(
        current,
        current,
        current,
        existing.discordId,
        existing.destinationRevision
      ).run();
    }
    return { completed, delivery: await readDelivery(deliveryId) };
  }

  async function failDelivery(input, now = input?.now ?? Date.now()) {
    const current = currentTimestamp(now);
    const deliveryId = normalizeUuid(input?.deliveryId, "delivery ID");
    const claimToken = normalizeUuid(input?.claimToken, "claim token");
    const existing = await readDelivery(deliveryId);
    if (!existing || existing.status !== "processing") {
      return { failed: false, delivery: existing };
    }
    const error = input?.error;
    const errorCode = cleanErrorCode(input?.errorCode ?? error?.discordCode ?? error?.code);
    const requestedPermanent = input?.permanent == null
      ? error?.permanentDestinationFailure === true || error?.permanentRecipientFailure === true
      : input.permanent === true;
    const errorMessage = requestedPermanent
      ? "Discord webhook is unavailable."
      : safeFailureDiagnostic(error, "Discord webhook delivery failed.");
    const terminal = requestedPermanent || existing.attempts >= MAX_DELIVERY_ATTEMPTS;
    const pauseSubscriber = requestedPermanent && (input?.pauseSubscriber == null
      ? true
      : input.pauseSubscriber === true);
    const fallbackRetryMs = Math.min(
      60 * 60 * 1000,
      30_000 * (2 ** Math.min(6, Math.max(0, existing.attempts - 1)))
    );
    const requestedRetryMs = Number(input?.retryAfterMs ?? error?.retryAfterMs);
    const retryAfterMs = Number.isFinite(requestedRetryMs) && requestedRetryMs > 0
      ? Math.min(MAX_RETRY_AFTER_MS, Math.max(1_000, Math.floor(requestedRetryMs)))
      : fallbackRetryMs;
    const result = await db.prepare(`
      UPDATE discord_event_webhook_deliveries
      SET status = CASE WHEN ? = 1 THEN 'dead' ELSE 'failed' END,
        queue_token = CASE WHEN ? = 1 THEN '' ELSE queue_token END,
        claim_token = '', claim_expires_at = 0,
        last_error_code = ?, last_error = ?, permanent_failure = ?,
        next_attempt_at = CASE WHEN ? = 1 THEN 0 ELSE ? END,
        failed_at = ?, updated_at = ?
      WHERE id = ? AND status = 'processing' AND claim_token = ?
    `).bind(
      terminal ? 1 : 0,
      terminal ? 1 : 0,
      errorCode,
      errorMessage,
      terminal ? 1 : 0,
      terminal ? 1 : 0,
      current + retryAfterMs,
      current,
      current,
      deliveryId,
      claimToken
    ).run();
    const failed = changes(result) > 0;
    if (failed) {
      await db.prepare(`
        UPDATE discord_event_webhook_subscribers
        SET enabled = CASE WHEN ? = 1 THEN 0 ELSE enabled END,
          paused = CASE WHEN ? = 1 THEN 1 ELSE paused END,
          pause_reason = CASE WHEN ? = 1 THEN 'Discord webhook is unavailable.' ELSE pause_reason END,
          paused_at = CASE WHEN ? = 1 THEN ? ELSE paused_at END,
          consecutive_failures = consecutive_failures + 1,
          last_failure_at = ?, last_delivery_at = ?,
          last_delivery_status = CASE WHEN ? = 1 THEN 'dead' ELSE 'failed' END,
          last_error_code = ?, last_error = ?, updated_at = ?
        WHERE discord_id = ? AND destination_revision = ?
      `).bind(
        pauseSubscriber ? 1 : 0,
        pauseSubscriber ? 1 : 0,
        pauseSubscriber ? 1 : 0,
        pauseSubscriber ? 1 : 0,
        current,
        current,
        current,
        terminal ? 1 : 0,
        errorCode,
        errorMessage,
        current,
        existing.discordId,
        existing.destinationRevision
      ).run();
    }
    return {
      failed,
      retryable: failed && !terminal,
      retryAfterMs: failed && !terminal ? retryAfterMs : 0,
      delivery: await readDelivery(deliveryId)
    };
  }

  return {
    read,
    saveVerified,
    updatePreferences,
    readTarget,
    pause,
    delete: deleteSubscriber,
    claimTest,
    recordTestResult,
    listActivePage,
    listAll,
    reserveDelivery,
    releaseQueuedDelivery,
    recoverStaleQueued,
    requeueDueFailed,
    pruneActionLimits,
    pruneDeliveries,
    claimDelivery,
    recordCompletedBatch,
    readCompletedBatches,
    completeDelivery,
    failDelivery
  };
}

export const createDiscordEventWebhookSubscriberStore = createStore;

export function saveVerifiedDiscordEventWebhookSubscriber(input, now) {
  return createStore(runtimeDatabase()).saveVerified(input, now);
}

export function updateDiscordEventWebhookSubscriberPreferences(input, now) {
  return createStore(runtimeDatabase()).updatePreferences(input, now);
}

export function readDiscordEventWebhookSubscriber(discordId) {
  return createStore(runtimeDatabase()).read(discordId);
}

export function readDiscordEventWebhookTarget(discordId, options) {
  return createStore(runtimeDatabase()).readTarget(discordId, options);
}

export function pauseDiscordEventWebhookSubscriber(discordId, options, now) {
  return createStore(runtimeDatabase()).pause(discordId, options, now);
}

export function deleteDiscordEventWebhookSubscriber(discordId) {
  return createStore(runtimeDatabase()).delete(discordId);
}

export function claimDiscordEventWebhookSubscriberTest(discordId, options, now) {
  return createStore(runtimeDatabase()).claimTest(discordId, options, now);
}

export function recordDiscordEventWebhookSubscriberTestResult(discordId, options, now) {
  return createStore(runtimeDatabase()).recordTestResult(discordId, options, now);
}

export function listActiveDiscordEventWebhookSubscribersPage(options) {
  return createStore(runtimeDatabase()).listActivePage(options);
}

export function reserveDiscordEventWebhookDelivery(input, now) {
  return createStore(runtimeDatabase()).reserveDelivery(input, now);
}

export function releaseQueuedDiscordEventWebhookDelivery(input, now) {
  return createStore(runtimeDatabase()).releaseQueuedDelivery(input, now);
}

export function recoverStaleQueuedDiscordEventWebhookDeliveries(options) {
  return createStore(runtimeDatabase()).recoverStaleQueued(options);
}

export function requeueDueFailedDiscordEventWebhookDeliveries(options) {
  return createStore(runtimeDatabase()).requeueDueFailed(options);
}

export function pruneDiscordEventWebhookActionLimits(options) {
  return createStore(runtimeDatabase()).pruneActionLimits(options);
}

export function pruneDiscordEventWebhookDeliveries(options) {
  return createStore(runtimeDatabase()).pruneDeliveries(options);
}

export function claimDiscordEventWebhookDelivery(input, now) {
  return createStore(runtimeDatabase()).claimDelivery(input, now);
}

export function recordDiscordEventWebhookDeliveryBatch(input, now) {
  return createStore(runtimeDatabase()).recordCompletedBatch(input, now);
}

export function readDiscordEventWebhookDeliveryCompletedBatches(deliveryId) {
  return createStore(runtimeDatabase()).readCompletedBatches(deliveryId);
}

export function completeDiscordEventWebhookDelivery(input, now) {
  return createStore(runtimeDatabase()).completeDelivery(input, now);
}

export function failDiscordEventWebhookDelivery(input, now) {
  return createStore(runtimeDatabase()).failDelivery(input, now);
}

export function listAllDiscordEventWebhookSubscribers(options) {
  return createStore(runtimeDatabase()).listAll(options);
}
