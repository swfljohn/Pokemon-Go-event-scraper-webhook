import { randomUUID } from "node:crypto";
import { decryptEventWebhookUrl, encryptEventWebhookUrl } from "./event-webhook-secret.js";
import {
  normalizeEventWorkspaceOwnerId,
  eventWorkspaceStorageSuffix,
  registerEventWorkspaceOwner
} from "./event-settings.js";
import { deleteJson, readJson, withRedisLock, writeJson } from "./storage.js";

const EVENT_WEBHOOKS_KEY = "event:webhook-destinations";
const MAX_ADDITIONAL_WEBHOOKS = 8;
const PREORDER_WEBHOOK_ID = "preorder";
const DISCORD_WEBHOOK_HOSTS = new Set(["discord.com", "canary.discord.com", "ptb.discord.com", "discordapp.com"]);
export const EVENT_WEBHOOK_LOCATION_MODES = Object.freeze(["workspace", "custom", "global"]);
export const EVENT_WEBHOOK_CATEGORY_OPTIONS = Object.freeze([
  "season-pass", "raids", "max", "community", "spotlight", "research", "local", "other"
]);
export const EVENT_COORDINATE_LINK_PROVIDERS = Object.freeze([
  "velocity",
  "flymego",
  "google",
  "ipogo",
  "spooferpro",
  "itools"
]);
export const EVENT_WEBHOOK_DIGEST_KINDS = Object.freeze(["starting-soon", "today", "weekend", "week", "monthly"]);
const LEGACY_EVENT_WEBHOOK_DIGEST_KINDS = Object.freeze(["today", "weekend", "week"]);

// What a destination receives for the daily ("today") post:
//   both   the whole-day review, then the local-events-only post when a short local event is live (default)
//   daily  the whole-day review only
//   local  only the local-events-only post (live, location-bound events with coordinates)
export const EVENT_WEBHOOK_DAILY_POST_MODES = Object.freeze(["both", "daily", "local"]);
export function normalizeEventWebhookDailyPost(value) {
  const mode = String(value || "").trim().toLowerCase();
  return EVENT_WEBHOOK_DAILY_POST_MODES.includes(mode) ? mode : "both";
}

export function normalizeEventWebhookName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 60);
}

export function normalizeEventCoordinateLinks(value) {
  if (!Array.isArray(value)) return [...EVENT_COORDINATE_LINK_PROVIDERS];
  const requested = new Set(value.map(row => String(row || "").trim().toLowerCase()));
  return EVENT_COORDINATE_LINK_PROVIDERS.filter(provider => requested.has(provider));
}

export function normalizeEventWebhookDigestKinds(value) {
  if (!Array.isArray(value)) return [...LEGACY_EVENT_WEBHOOK_DIGEST_KINDS];
  const requested = new Set(value.map(row => String(row || "").trim().toLowerCase()));
  return EVENT_WEBHOOK_DIGEST_KINDS.filter(kind => requested.has(kind));
}

export function normalizeEventWebhookCategories(value) {
  if (!Array.isArray(value)) return null;
  const requested = new Set(value.map(row => String(row || "").trim().toLowerCase()));
  return EVENT_WEBHOOK_CATEGORY_OPTIONS.filter(category => requested.has(category));
}

export function normalizeEventWebhookTimeZone(value) {
  const text = String(value || "").trim().slice(0, 100);
  if (!text) return "";
  try {
    new Intl.DateTimeFormat("en", { timeZone: text }).format(0);
  } catch {
    throw new TypeError("Choose a supported webhook timezone, or use the workspace timezone.");
  }
  return text;
}

export function normalizeEventWebhookLocationMode(value) {
  const mode = String(value || "workspace").trim().toLowerCase();
  if (!EVENT_WEBHOOK_LOCATION_MODES.includes(mode)) {
    throw new TypeError("Choose a valid webhook location mode.");
  }
  return mode;
}

function finiteWebhookCoordinate(value, minimum, maximum, label) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new TypeError(`Enter a valid webhook ${label}.`);
  }
  return Number(number.toFixed(6));
}

export function normalizeEventWebhookLocation(value, mode = "workspace") {
  const cleanMode = normalizeEventWebhookLocationMode(mode);
  if (cleanMode !== "custom") return null;
  const latitude = finiteWebhookCoordinate(value?.latitude, -90, 90, "latitude");
  const longitude = finiteWebhookCoordinate(value?.longitude, -180, 180, "longitude");
  if ((latitude == null) !== (longitude == null)) {
    throw new TypeError("Enter both custom webhook coordinates, or leave both blank.");
  }
  if (latitude == null || longitude == null) {
    throw new TypeError("Enter custom webhook latitude and longitude.");
  }
  const requestedRadius = Number(value?.radiusKm);
  const radiusKm = Number.isFinite(requestedRadius)
    ? Math.min(1_000, Math.max(1, Number(requestedRadius.toFixed(1))))
    : 100;
  return { latitude, longitude, radiusKm };
}

export function normalizeEventWebhookCategoryOverride(value) {
  const categories = normalizeEventWebhookCategories(value);
  if (Array.isArray(categories) && !categories.length) {
    throw new TypeError("Choose at least one event type, or use the workspace event types.");
  }
  return categories;
}

export function normalizeDiscordRoleId(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^\d{15,22}$/.test(text)) throw new TypeError("Enter a valid Discord role ID, or leave it blank.");
  return text;
}

export function normalizeDiscordWebhookUrl(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 600) throw new TypeError("Enter a Discord webhook URL.");
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new TypeError("Enter a valid Discord webhook URL.");
  }
  const match = url.pathname.match(/^\/api\/webhooks\/(\d+)\/([^/]+)\/?$/i);
  if (url.protocol !== "https:" || !DISCORD_WEBHOOK_HOSTS.has(url.hostname.toLowerCase()) ||
      url.username || url.password || !match) {
    throw new TypeError("Only Discord HTTPS webhook URLs are supported.");
  }
  // Discord's canary/PTB/legacy hosts and client-only query/hash decorations
  // all address the same webhook credential. Store and compare one canonical
  // endpoint so a cosmetic URL variant cannot bypass destination deduplication
  // and cause the same channel to receive a digest twice.
  url.hostname = "discord.com";
  url.port = "";
  url.pathname = `/api/webhooks/${match[1]}/${match[2]}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function isDiscordWebhookUrl(value) {
  try {
    normalizeDiscordWebhookUrl(value);
    return true;
  } catch {
    return false;
  }
}

function eventWebhooksKey(ownerId) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  return cleanId === "owner"
    ? EVENT_WEBHOOKS_KEY
    : `event:workspace:${cleanId.startsWith("discord:") ? cleanId.slice("discord:".length) : eventWorkspaceStorageSuffix(cleanId)}:webhook-destinations`;
}

function eventWebhooksLock(ownerId) {
  return `event-webhooks-${normalizeEventWorkspaceOwnerId(ownerId).replace(":", "-")}`;
}

function cleanStore(value) {
  const destinations = [];
  const seen = new Set();
  for (const row of Array.isArray(value?.destinations) ? value.destinations : []) {
    const id = String(row?.id || "").trim().slice(0, 80);
    if (!id || seen.has(id) || !row?.secret || typeof row.secret !== "object") continue;
    seen.add(id);
    destinations.push({
      id,
      secret: row.secret,
      name: normalizeEventWebhookName(row.name),
        coordinateLinks: normalizeEventCoordinateLinks(row.coordinateLinks),
        digestKinds: normalizeEventWebhookDigestKinds(row.digestKinds),
        timeZone: normalizeEventWebhookTimeZone(row.timeZone),
      locationMode: normalizeEventWebhookLocationMode(row.locationMode),
      location: normalizeEventWebhookLocation(row.location, row.locationMode),
        categories: normalizeEventWebhookCategories(row.categories),
      availabilityGuide: row.availabilityGuide === true,
      dailyPost: normalizeEventWebhookDailyPost(row.dailyPost),
      preorderGuide: row.preorderGuide === true,
      roleId: normalizeDiscordRoleId(row.roleId),
      roleMentionKinds: normalizeEventWebhookDigestKinds(row.roleMentionKinds || []),
      createdAt: Math.max(0, Number(row.createdAt) || 0),
      lastTestedAt: Math.max(0, Number(row.lastTestedAt) || 0),
      lastSuccessAt: Math.max(0, Number(row.lastSuccessAt) || 0),
      lastFailureAt: Math.max(0, Number(row.lastFailureAt) || 0),
      lastError: String(row.lastError || "").replace(/https:\/\/[^\s]+/g, "[redacted]").slice(0, 180),
      consecutiveFailures: Math.max(0, Math.min(1000, Number(row.consecutiveFailures) || 0)),
      paused: row.paused === true
    });
    if (destinations.length >= MAX_ADDITIONAL_WEBHOOKS) break;
  }
  const preorder = value?.preorder?.secret && typeof value.preorder.secret === "object"
    ? {
      id: PREORDER_WEBHOOK_ID,
      secret: value.preorder.secret,
      name: normalizeEventWebhookName(value.preorder.name) || "Preorder webhook",
      createdAt: Math.max(0, Number(value.preorder.createdAt) || 0),
      lastTestedAt: Math.max(0, Number(value.preorder.lastTestedAt) || 0),
      lastSuccessAt: Math.max(0, Number(value.preorder.lastSuccessAt) || 0),
      lastFailureAt: Math.max(0, Number(value.preorder.lastFailureAt) || 0),
      lastError: String(value.preorder.lastError || "").replace(/https:\/\/[^\s]+/g, "[redacted]").slice(0, 180),
      consecutiveFailures: Math.max(0, Math.min(1000, Number(value.preorder.consecutiveFailures) || 0)),
      paused: value.preorder.paused === true
    }
    : null;
  return {
    schemaVersion: 12,
    primary: {
      secret: value?.primary?.secret && typeof value.primary.secret === "object"
        ? value.primary.secret
        : null,
      name: normalizeEventWebhookName(value?.primary?.name) || "Primary dashboard",
      coordinateLinks: normalizeEventCoordinateLinks(value?.primary?.coordinateLinks),
      digestKinds: normalizeEventWebhookDigestKinds(value?.primary?.digestKinds),
      timeZone: normalizeEventWebhookTimeZone(value?.primary?.timeZone),
      locationMode: normalizeEventWebhookLocationMode(value?.primary?.locationMode),
      location: normalizeEventWebhookLocation(value?.primary?.location, value?.primary?.locationMode),
      categories: normalizeEventWebhookCategories(value?.primary?.categories),
      availabilityGuide: value?.primary?.availabilityGuide === true,
      dailyPost: normalizeEventWebhookDailyPost(value?.primary?.dailyPost),
      preorderGuide: value?.primary?.preorderGuide === true,
      roleId: normalizeDiscordRoleId(value?.primary?.roleId),
      roleMentionKinds: normalizeEventWebhookDigestKinds(value?.primary?.roleMentionKinds || []),
      lastTestedAt: Math.max(0, Number(value?.primary?.lastTestedAt) || 0),
      lastSuccessAt: Math.max(0, Number(value?.primary?.lastSuccessAt) || 0),
      lastFailureAt: Math.max(0, Number(value?.primary?.lastFailureAt) || 0),
      lastError: String(value?.primary?.lastError || "").replace(/https:\/\/[^\s]+/g, "[redacted]").slice(0, 180),
      consecutiveFailures: Math.max(0, Math.min(1000, Number(value?.primary?.consecutiveFailures) || 0)),
      paused: value?.primary?.paused === true
    },
    destinations,
    preorder,
    updatedAt: Math.max(0, Number(value?.updatedAt) || 0)
  };
}

function publicDestination(row, url, { primary = false } = {}) {
  const webhookId = new URL(url).pathname.split("/")[3] || "";
  const maskedLabel = `Discord webhook ••••${webhookId.slice(-4) || "saved"}`;
  const name = normalizeEventWebhookName(row.name) || (primary ? "Primary dashboard" : "");
  return {
    id: row.id,
    name,
    label: name ? `${name} · ${maskedLabel}` : maskedLabel,
    maskedLabel,
    coordinateLinks: normalizeEventCoordinateLinks(row.coordinateLinks),
    digestKinds: normalizeEventWebhookDigestKinds(row.digestKinds),
    timeZone: normalizeEventWebhookTimeZone(row.timeZone),
    locationMode: normalizeEventWebhookLocationMode(row.locationMode),
    location: normalizeEventWebhookLocation(row.location, row.locationMode),
    categories: normalizeEventWebhookCategories(row.categories),
    availabilityGuide: row.availabilityGuide === true,
    dailyPost: normalizeEventWebhookDailyPost(row.dailyPost),
    preorderGuide: row.preorderGuide === true,
    roleId: normalizeDiscordRoleId(row.roleId),
    roleMentionKinds: normalizeEventWebhookDigestKinds(row.roleMentionKinds || []),
    primary,
    createdAt: row.createdAt,
    lastTestedAt: Math.max(0, Number(row.lastTestedAt) || 0),
    lastSuccessAt: Math.max(0, Number(row.lastSuccessAt) || 0),
    lastFailureAt: Math.max(0, Number(row.lastFailureAt) || 0),
    lastError: String(row.lastError || "").slice(0, 180),
    consecutiveFailures: Math.max(0, Number(row.consecutiveFailures) || 0),
    paused: row.paused === true
  };
}

function publicPreorderDestination(row, url) {
  if (!row?.secret || !url) {
    return {
      id: PREORDER_WEBHOOK_ID,
      name: "Preorder webhook",
      label: "No preorder webhook saved",
      maskedLabel: "No preorder webhook saved",
      configured: false,
      preorderOnly: true,
      lastTestedAt: 0,
      lastSuccessAt: 0,
      lastFailureAt: 0,
      lastError: "",
      consecutiveFailures: 0,
      paused: false
    };
  }
  const destination = publicDestination({
    ...row,
    id: PREORDER_WEBHOOK_ID,
    digestKinds: [],
    availabilityGuide: false,
    preorderGuide: true,
    coordinateLinks: [],
    timeZone: "",
    locationMode: "workspace",
    location: null,
    categories: null,
    roleId: "",
    roleMentionKinds: []
  }, url);
  return { ...destination, id: PREORDER_WEBHOOK_ID, configured: true, preorderOnly: true };
}

async function readStore(ownerId = "owner") {
  return cleanStore(await readJson(eventWebhooksKey(ownerId)));
}

function primaryWebhookUrl(store, ownerId = "owner") {
  if (normalizeEventWorkspaceOwnerId(ownerId) !== "owner") return "";
  if (store?.primary?.secret) {
    try {
      return normalizeDiscordWebhookUrl(decryptEventWebhookUrl(store.primary.secret));
    } catch (error) {
      console.warn(JSON.stringify({
        event: "event-primary-webhook-unavailable",
        error: String(error?.message || error).slice(0, 160)
      }));
    }
  }
  const configured = String(process.env.ADMIN_WEBHOOK_URL || "").trim();
  return isDiscordWebhookUrl(configured) ? normalizeDiscordWebhookUrl(configured) : "";
}

function resetWebhookDeliveryHealth(row) {
  row.lastTestedAt = 0;
  row.lastSuccessAt = 0;
  row.lastFailureAt = 0;
  row.lastError = "";
  row.consecutiveFailures = 0;
}

function decryptedRows(store) {
  const rows = [];
  for (const row of store.destinations) {
    try {
      const url = normalizeDiscordWebhookUrl(decryptEventWebhookUrl(row.secret));
      rows.push({ ...row, url });
    } catch (error) {
      console.warn(JSON.stringify({
        event: "event-webhook-unavailable",
        destinationId: row.id,
        error: String(error?.message || error).slice(0, 160)
      }));
    }
  }
  return rows;
}

function decryptedPreorder(store) {
  if (!store?.preorder?.secret) return null;
  try {
    const url = normalizeDiscordWebhookUrl(decryptEventWebhookUrl(store.preorder.secret));
    return { ...store.preorder, url };
  } catch (error) {
    console.warn(JSON.stringify({
      event: "event-preorder-webhook-unavailable",
      error: String(error?.message || error).slice(0, 160)
    }));
    return null;
  }
}

function publicStoredRows(store) {
  return store.destinations.map(row => {
    try {
      const url = normalizeDiscordWebhookUrl(decryptEventWebhookUrl(row.secret));
      return publicDestination(row, url);
    } catch {
      return {
        id: row.id,
        name: normalizeEventWebhookName(row.name),
        label: "Unavailable saved Discord webhook",
        maskedLabel: "Unavailable saved Discord webhook",
        coordinateLinks: normalizeEventCoordinateLinks(row.coordinateLinks),
        digestKinds: normalizeEventWebhookDigestKinds(row.digestKinds),
        roleId: normalizeDiscordRoleId(row.roleId),
        roleMentionKinds: normalizeEventWebhookDigestKinds(row.roleMentionKinds || []),
        timeZone: normalizeEventWebhookTimeZone(row.timeZone),
        locationMode: normalizeEventWebhookLocationMode(row.locationMode),
        location: normalizeEventWebhookLocation(row.location, row.locationMode),
        categories: normalizeEventWebhookCategories(row.categories),
        availabilityGuide: row.availabilityGuide === true,
        dailyPost: normalizeEventWebhookDailyPost(row.dailyPost),
        preorderGuide: row.preorderGuide === true,
        primary: false,
        createdAt: row.createdAt,
        lastTestedAt: row.lastTestedAt,
        lastSuccessAt: row.lastSuccessAt,
        lastFailureAt: row.lastFailureAt,
        lastError: row.lastError,
        consecutiveFailures: row.consecutiveFailures,
        paused: row.paused,
        unavailable: true
      };
    }
  });
}

export async function listEventWebhookDestinations(ownerId = "owner") {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const store = await readStore(cleanId);
  const rows = [];
  const primary = primaryWebhookUrl(store, cleanId);
  if (primary) {
    rows.push(publicDestination({ id: "primary", ...store.primary, createdAt: 0 }, primary, { primary: true }));
  }
  rows.push(...publicStoredRows(store));
  return rows;
}

export async function eventWebhookPreorderDestination(ownerId = "owner") {
  const store = await readStore(ownerId);
  const row = decryptedPreorder(store);
  return row ? publicPreorderDestination(row, row.url) : publicPreorderDestination(null, "");
}

export async function eventWebhookPreorderTarget(ownerId = "owner") {
  const store = await readStore(ownerId);
  const row = decryptedPreorder(store);
  if (!row || row.paused) throw new TypeError("The preorder webhook is not configured.");
  return {
    id: PREORDER_WEBHOOK_ID,
    label: row.name || "Preorder webhook",
    coordinateLinks: [],
    digestKinds: [],
    availabilityGuide: false,
    preorderGuide: true,
    timeZone: "",
    locationMode: "workspace",
    location: null,
    categories: null,
    roleId: "",
    roleMentionKinds: [],
    paused: false,
    url: row.url
  };
}

export async function saveEventWebhookPreorderDestination(url, name = "", now = Date.now(), ownerId = "owner") {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const normalizedUrl = normalizeDiscordWebhookUrl(url);
  const normalizedName = normalizeEventWebhookName(name) || "Preorder webhook";
  return withRedisLock(eventWebhooksLock(cleanId), async () => {
    const store = await readStore(cleanId);
    const previous = decryptedPreorder(store);
    store.preorder = {
      id: PREORDER_WEBHOOK_ID,
      secret: encryptEventWebhookUrl(normalizedUrl),
      name: normalizedName,
      createdAt: previous?.createdAt || now,
      lastTestedAt: previous?.url === normalizedUrl ? previous.lastTestedAt : 0,
      lastSuccessAt: previous?.url === normalizedUrl ? previous.lastSuccessAt : 0,
      lastFailureAt: previous?.url === normalizedUrl ? previous.lastFailureAt : 0,
      lastError: previous?.url === normalizedUrl ? previous.lastError : "",
      consecutiveFailures: previous?.url === normalizedUrl ? previous.consecutiveFailures : 0,
      paused: false
    };
    store.updatedAt = now;
    await registerEventWorkspaceOwner(cleanId, now);
    await writeJson(eventWebhooksKey(cleanId), store);
    return publicPreorderDestination(store.preorder, normalizedUrl);
  });
}

export async function removeEventWebhookPreorderDestination(now = Date.now(), ownerId = "owner") {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  return withRedisLock(eventWebhooksLock(cleanId), async () => {
    const store = await readStore(cleanId);
    store.preorder = null;
    store.updatedAt = now;
    await writeJson(eventWebhooksKey(cleanId), store);
    return publicPreorderDestination(null, "");
  });
}

export async function eventWebhookTargets(ownerId = "owner", digestKind = "") {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const kind = String(digestKind || "").trim().toLowerCase();
  if (kind && !EVENT_WEBHOOK_DIGEST_KINDS.includes(kind)) throw new TypeError("Choose a valid event digest.");
  const store = await readStore(cleanId);
  const targets = [];
  const seenUrls = new Set();
  const addTarget = target => {
    // The primary command webhook may also have been entered as an additional
    // event destination. Discord sees those as the same channel, so send it
    // only once per digest even if two saved destination IDs share the URL.
    if (seenUrls.has(target.url)) return;
    seenUrls.add(target.url);
    targets.push(target);
  };
  const primary = primaryWebhookUrl(store, cleanId);
  if (primary) {
    addTarget({
      id: "primary",
      label: store.primary.name || "Primary dashboard",
      coordinateLinks: normalizeEventCoordinateLinks(store.primary.coordinateLinks),
      digestKinds: normalizeEventWebhookDigestKinds(store.primary.digestKinds),
      timeZone: normalizeEventWebhookTimeZone(store.primary.timeZone),
      locationMode: normalizeEventWebhookLocationMode(store.primary.locationMode),
      location: normalizeEventWebhookLocation(store.primary.location, store.primary.locationMode),
      categories: normalizeEventWebhookCategories(store.primary.categories),
      availabilityGuide: store.primary.availabilityGuide === true,
      dailyPost: normalizeEventWebhookDailyPost(store.primary.dailyPost),
      preorderGuide: store.primary.preorderGuide === true,
      roleId: normalizeDiscordRoleId(store.primary.roleId),
      roleMentionKinds: normalizeEventWebhookDigestKinds(store.primary.roleMentionKinds || []),
      paused: store.primary.paused === true,
      url: primary
    });
  }
  for (const row of decryptedRows(store)) {
    const destination = publicDestination(row, row.url);
    if (row.paused) continue;
    addTarget({
      id: row.id,
      label: destination.name || destination.maskedLabel,
      coordinateLinks: destination.coordinateLinks,
      digestKinds: destination.digestKinds,
      timeZone: destination.timeZone,
      locationMode: destination.locationMode,
      location: destination.location,
      categories: destination.categories,
      availabilityGuide: destination.availabilityGuide,
      dailyPost: normalizeEventWebhookDailyPost(destination.dailyPost),
      preorderGuide: destination.preorderGuide,
      roleId: destination.roleId,
      roleMentionKinds: destination.roleMentionKinds,
      url: row.url
    });
  }
  const activeTargets = targets.filter(target => !target.paused);
  return kind ? activeTargets.filter(target => target.digestKinds.includes(kind)) : activeTargets;
}

export async function addEventWebhookDestinations(values, now = Date.now(), ownerId = "owner") {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const requested = (Array.isArray(values) ? values : []).map(value => {
    const row = typeof value === "string" ? { url: value } : value || {};
    return {
      url: normalizeDiscordWebhookUrl(row.url),
      name: normalizeEventWebhookName(row.name),
      coordinateLinks: normalizeEventCoordinateLinks(row.coordinateLinks),
      digestKinds: normalizeEventWebhookDigestKinds(row.digestKinds),
      timeZone: normalizeEventWebhookTimeZone(row.timeZone),
      locationMode: normalizeEventWebhookLocationMode(row.locationMode),
      location: normalizeEventWebhookLocation(row.location, row.locationMode),
      categories: normalizeEventWebhookCategoryOverride(row.categories),
      availabilityGuide: row.availabilityGuide === true,
      dailyPost: normalizeEventWebhookDailyPost(row.dailyPost),
      preorderGuide: row.preorderGuide === true,
      roleId: normalizeDiscordRoleId(row.roleId),
      roleMentionKinds: normalizeEventWebhookDigestKinds(row.roleMentionKinds || [])
    };
  });
  if (!requested.length) throw new TypeError("Enter at least one Discord webhook URL.");
  if (requested.some(row => !row.digestKinds.length && !row.availabilityGuide)) {
    throw new TypeError("Choose at least one digest or enable availability delivery for every event destination.");
  }
  if (new Set(requested.map(row => row.url)).size !== requested.length) throw new TypeError("The same webhook was entered more than once.");
  return withRedisLock(eventWebhooksLock(cleanId), async () => {
    const store = await readStore(cleanId);
    const existing = decryptedRows(store);
    const existingUrls = new Set(existing.map(row => row.url));
    const primary = primaryWebhookUrl(store, cleanId);
    if (primary) existingUrls.add(primary);
    const additions = requested.filter(row => !existingUrls.has(row.url));
    if (store.destinations.length + additions.length > MAX_ADDITIONAL_WEBHOOKS) {
      throw new TypeError(`You can save up to ${MAX_ADDITIONAL_WEBHOOKS} additional event webhooks.`);
    }
    for (const row of additions) {
      store.destinations.push({
        id: randomUUID(),
        secret: encryptEventWebhookUrl(row.url),
        name: row.name,
        coordinateLinks: row.coordinateLinks,
        digestKinds: row.digestKinds,
        timeZone: row.timeZone,
        locationMode: row.locationMode,
        location: row.location,
        categories: row.categories,
        availabilityGuide: row.availabilityGuide,
        dailyPost: row.dailyPost,
        preorderGuide: row.preorderGuide,
        roleId: row.roleId,
        roleMentionKinds: row.roleMentionKinds,
        createdAt: now,
        lastTestedAt: 0,
        lastSuccessAt: 0,
        lastFailureAt: 0,
        lastError: "",
        consecutiveFailures: 0,
        paused: false
      });
    }
    store.updatedAt = now;
    await registerEventWorkspaceOwner(cleanId, now);
    await writeJson(eventWebhooksKey(cleanId), store);
    return publicStoredRows(store);
  });
}

export async function updateEventWebhookDestination(id, settings, now = Date.now(), ownerId = "owner") {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const destinationId = String(id || "").trim();
  if (!destinationId) throw new TypeError("Choose a Discord destination to update.");
  const name = normalizeEventWebhookName(settings?.name);
  const coordinateLinks = normalizeEventCoordinateLinks(settings?.coordinateLinks);
  const digestKinds = normalizeEventWebhookDigestKinds(settings?.digestKinds);
  const has = key => Object.prototype.hasOwnProperty.call(settings || {}, key);
  const roleId = normalizeDiscordRoleId(settings?.roleId);
  const roleMentionKinds = roleId ? normalizeEventWebhookDigestKinds(settings?.roleMentionKinds || []) : [];
  const availabilityGuide = settings?.availabilityGuide === true;
  const dailyPost = normalizeEventWebhookDailyPost(settings?.dailyPost);
  const preorderGuide = settings?.preorderGuide === true;
  const paused = settings?.paused === true;
  const requestedUrl = has("url") ? normalizeDiscordWebhookUrl(settings.url) : "";
  if (!digestKinds.length && !availabilityGuide) {
    throw new TypeError("Choose at least one digest or enable availability delivery for this event destination.");
  }
  return withRedisLock(eventWebhooksLock(cleanId), async () => {
    const store = await readStore(cleanId);
    if (destinationId === "primary") {
      if (cleanId !== "owner") throw new TypeError("That event webhook does not belong to this workspace.");
      if (!primaryWebhookUrl(store, cleanId)) {
        throw new TypeError("The primary dashboard webhook is not configured.");
      }
      if (requestedUrl) {
        const duplicate = decryptedRows(store).some(destination => destination.url === requestedUrl);
        if (duplicate) throw new TypeError("That Discord webhook is already saved in this workspace.");
        const previousUrl = primaryWebhookUrl(store, cleanId);
        store.primary.secret = encryptEventWebhookUrl(requestedUrl);
        if (previousUrl !== requestedUrl) resetWebhookDeliveryHealth(store.primary);
      }
      store.primary = { ...store.primary, name: name || "Primary dashboard", coordinateLinks, digestKinds, availabilityGuide, dailyPost, preorderGuide, roleId, roleMentionKinds, paused };
      if (has("timeZone")) store.primary.timeZone = normalizeEventWebhookTimeZone(settings.timeZone);
      if (has("locationMode")) store.primary.locationMode = normalizeEventWebhookLocationMode(settings.locationMode);
      if (has("location") || has("locationMode")) {
        store.primary.location = normalizeEventWebhookLocation(
          has("location") ? settings.location : store.primary.location,
          store.primary.locationMode
        );
      }
      if (has("categories")) store.primary.categories = normalizeEventWebhookCategoryOverride(settings.categories);
    } else {
      const row = store.destinations.find(destination => destination.id === destinationId);
      if (!row) throw new TypeError("That event webhook no longer exists.");
      if (requestedUrl) {
        const duplicateAdditional = decryptedRows(store)
          .some(destination => destination.id !== destinationId && destination.url === requestedUrl);
        const duplicatePrimary = primaryWebhookUrl(store, cleanId) === requestedUrl;
        if (duplicateAdditional || duplicatePrimary) {
          throw new TypeError("That Discord webhook is already saved in this workspace.");
        }
        let previousUrl = "";
        try { previousUrl = normalizeDiscordWebhookUrl(decryptEventWebhookUrl(row.secret)); } catch {}
        row.secret = encryptEventWebhookUrl(requestedUrl);
        if (previousUrl !== requestedUrl) resetWebhookDeliveryHealth(row);
      }
      row.name = name;
      row.coordinateLinks = coordinateLinks;
      row.digestKinds = digestKinds;
      row.availabilityGuide = availabilityGuide;
      row.dailyPost = dailyPost;
      row.preorderGuide = preorderGuide;
      row.roleId = roleId;
      row.roleMentionKinds = roleMentionKinds;
      row.paused = paused;
      if (has("timeZone")) row.timeZone = normalizeEventWebhookTimeZone(settings.timeZone);
      if (has("locationMode")) row.locationMode = normalizeEventWebhookLocationMode(settings.locationMode);
      if (has("location") || has("locationMode")) {
        row.location = normalizeEventWebhookLocation(
          has("location") ? settings.location : row.location,
          row.locationMode
        );
      }
      if (has("categories")) row.categories = normalizeEventWebhookCategoryOverride(settings.categories);
    }
    store.updatedAt = now;
    await registerEventWorkspaceOwner(cleanId, now);
    await writeJson(eventWebhooksKey(cleanId), store);
    return listEventWebhookDestinations(cleanId);
  });
}

export async function eventWebhookTarget(ownerId, id) {
  const destinationId = String(id || "").trim();
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const store = await readStore(cleanId);
  const targets = [];
  const preorder = decryptedPreorder(store);
  if (preorder && !preorder.paused) {
    targets.push({ id: PREORDER_WEBHOOK_ID, label: preorder.name || "Preorder webhook", url: preorder.url });
  }
  const primary = primaryWebhookUrl(store, cleanId);
  if (primary) {
    targets.push({ id: "primary", label: store.primary.name || "Primary dashboard", url: primary });
  }
  for (const row of decryptedRows(store)) targets.push({ id: row.id, label: row.name || "Discord destination", url: row.url });
  const target = targets.find(row => row.id === destinationId);
  if (!target) throw new TypeError("That Discord destination is unavailable.");
  return target;
}

/**
 * Return active destinations that opted into the event availability guide.
 * This is deliberately separate from digest-kind routing so a channel can
 * receive the Pokémon/how-to-get guide without subscribing to calendar alerts.
 */
export async function eventWebhookAvailabilityTargets(ownerId = "owner") {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const store = await readStore(cleanId);
  const targets = [];
  const seenUrls = new Set();
  const addTarget = target => {
    if (!target.availabilityGuide || target.paused || seenUrls.has(target.url)) return;
    seenUrls.add(target.url);
    targets.push(target);
  };
  const primary = primaryWebhookUrl(store, cleanId);
  if (primary) {
    addTarget({
      id: "primary",
      label: store.primary.name || "Primary dashboard",
      coordinateLinks: normalizeEventCoordinateLinks(store.primary.coordinateLinks),
      digestKinds: normalizeEventWebhookDigestKinds(store.primary.digestKinds),
      availabilityGuide: store.primary.availabilityGuide === true,
      dailyPost: normalizeEventWebhookDailyPost(store.primary.dailyPost),
      timeZone: normalizeEventWebhookTimeZone(store.primary.timeZone),
      locationMode: normalizeEventWebhookLocationMode(store.primary.locationMode),
      location: normalizeEventWebhookLocation(store.primary.location, store.primary.locationMode),
      categories: normalizeEventWebhookCategories(store.primary.categories),
      roleId: normalizeDiscordRoleId(store.primary.roleId),
      roleMentionKinds: normalizeEventWebhookDigestKinds(store.primary.roleMentionKinds || []),
      paused: store.primary.paused === true,
      url: primary
    });
  }
  for (const row of decryptedRows(store)) {
    const destination = publicDestination(row, row.url);
    addTarget({
      id: row.id,
      label: destination.name || destination.maskedLabel,
      coordinateLinks: destination.coordinateLinks,
      digestKinds: destination.digestKinds,
      availabilityGuide: destination.availabilityGuide === true,
      dailyPost: normalizeEventWebhookDailyPost(destination.dailyPost),
      timeZone: destination.timeZone,
      locationMode: destination.locationMode,
      location: destination.location,
      categories: destination.categories,
      roleId: destination.roleId,
      roleMentionKinds: destination.roleMentionKinds,
      paused: row.paused === true,
      url: row.url
    });
  }
  return targets;
}

/**
 * Return the dedicated five-day preorder destination only.
 * Preorder cards are a separate sales channel and must never fan out to the
 * regular event digest destinations, even if an older destination still has
 * the legacy preorderGuide flag stored on it.
 */
export async function eventWebhookPreorderTargets(ownerId = "owner") {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const store = await readStore(cleanId);
  const targets = [];
  const seenUrls = new Set();
  const addTarget = target => {
    if (!target.preorderGuide || target.paused || seenUrls.has(target.url)) return;
    seenUrls.add(target.url);
    targets.push(target);
  };
  const dedicated = decryptedPreorder(store);
  if (dedicated) {
    addTarget({
      id: PREORDER_WEBHOOK_ID,
      label: dedicated.name || "Preorder webhook",
      coordinateLinks: [],
      digestKinds: [],
      availabilityGuide: false,
      preorderGuide: true,
      timeZone: "",
      locationMode: "workspace",
      location: null,
      categories: null,
      roleId: "",
      roleMentionKinds: [],
      paused: dedicated.paused === true,
      url: dedicated.url
    });
  }
  return targets;
}

export async function recordEventWebhookDelivery(ownerId, id, {
  success = false,
  tested = false,
  error = "",
  now = Date.now()
} = {}) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const destinationId = String(id || "").trim();
  if (!destinationId) return listEventWebhookDestinations(cleanId);
  return withRedisLock(eventWebhooksLock(cleanId), async () => {
    const store = await readStore(cleanId);
    const row = destinationId === PREORDER_WEBHOOK_ID
      ? store.preorder
      : destinationId === "primary" && cleanId === "owner"
        ? store.primary
        : store.destinations.find(destination => destination.id === destinationId);
    if (!row) return publicStoredRows(store);
    if (tested) row.lastTestedAt = now;
    if (success) {
      row.lastSuccessAt = now;
      row.lastError = "";
      row.consecutiveFailures = 0;
    } else {
      row.lastFailureAt = now;
      row.lastError = String(error || "Discord delivery failed.").replace(/https:\/\/[^\s]+/g, "[redacted]").slice(0, 180);
      row.consecutiveFailures = Math.min(1000, (Number(row.consecutiveFailures) || 0) + 1);
    }
    store.updatedAt = now;
    await writeJson(eventWebhooksKey(cleanId), store);
    return publicStoredRows(store);
  });
}

export async function removeEventWebhookDestination(id, now = Date.now(), ownerId = "owner") {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const destinationId = String(id || "").trim();
  if (!destinationId || destinationId === "primary") throw new TypeError("Choose an additional webhook to remove.");
  return withRedisLock(eventWebhooksLock(cleanId), async () => {
    const store = await readStore(cleanId);
    const before = store.destinations.length;
    store.destinations = store.destinations.filter(row => row.id !== destinationId);
    if (store.destinations.length === before) throw new TypeError("That event webhook no longer exists.");
    store.updatedAt = now;
    await writeJson(eventWebhooksKey(cleanId), store);
    return publicStoredRows(store);
  });
}

export async function deleteEventWebhookWorkspace(ownerId) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  if (cleanId === "owner") throw new TypeError("The owner webhook workspace cannot be deleted.");
  return deleteJson(eventWebhooksKey(cleanId));
}
