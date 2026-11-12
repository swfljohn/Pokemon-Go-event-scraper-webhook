import { randomUUID } from "node:crypto";
import { deleteJson, readJson, withRedisLock, writeJson } from "./storage.js";
import { defaultTimeZone } from "./site.js";

const EVENT_WORKSPACE_INDEX_KEY = "event:workspace-index";
const OWNER_SETTINGS_KEY = "event:workspace-settings";
const MAX_WORKSPACES = 250;
const DEFAULT_RADIUS_KM = 100;
const EVENT_SETTINGS_SCHEMA_VERSION = 8;
export const DEFAULT_EVENT_WEBHOOK_BOT_NAME = "Pokémon GO Events";

export const EVENT_CATEGORY_OPTIONS = Object.freeze([
  "season-pass",
  "raids",
  "max",
  "community",
  "spotlight",
  "research",
  "local",
  "other"
]);

export const EVENT_DIGEST_KINDS = Object.freeze(["today", "weekend", "week", "monthly"]);

export function normalizeEventWorkspaceOwnerId(value) {
  const ownerId = String(value || "").trim().toLowerCase();
  if (ownerId === "owner") return ownerId;
  if (/^discord:\d{15,22}$/.test(ownerId)) return ownerId;
  if (/^managed:[0-9a-f]{8}-[0-9a-f-]{27,36}$/.test(ownerId)) return ownerId;
  throw new TypeError("A valid event workspace owner is required.");
}

export function eventWorkspaceStorageSuffix(ownerId) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  if (cleanId === "owner") return "owner";
  return cleanId.replace(":", "-");
}

function settingsKey(ownerId) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  if (cleanId === "owner") return OWNER_SETTINGS_KEY;
  const legacyDiscordSuffix = cleanId.startsWith("discord:") ? cleanId.slice("discord:".length) : "";
  return legacyDiscordSuffix
    ? `event:workspace:${legacyDiscordSuffix}:settings`
    : `event:workspace:${eventWorkspaceStorageSuffix(cleanId)}:settings`;
}

function cleanManagedWorkspaceName(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!name) throw new TypeError("Enter a name for this webhook subuser.");
  return name;
}

function cleanWorkspaceIndex(value) {
  const ownerName = (() => {
    try { return cleanManagedWorkspaceName(value?.ownerName || "Mine"); }
    catch { return "Mine"; }
  })();
  const owners = [];
  for (const raw of Array.isArray(value?.owners) ? value.owners : []) {
    try {
      const ownerId = normalizeEventWorkspaceOwnerId(raw);
      if (ownerId !== "owner" && !owners.includes(ownerId)) owners.push(ownerId);
    } catch {}
    if (owners.length >= MAX_WORKSPACES - 1) break;
  }
  const managed = [];
  const seen = new Set();
  for (const row of Array.isArray(value?.managed) ? value.managed : []) {
    try {
      const id = normalizeEventWorkspaceOwnerId(row?.id);
      if (!id.startsWith("managed:") || seen.has(id)) continue;
      seen.add(id);
      managed.push({
        id,
        name: cleanManagedWorkspaceName(row?.name),
        createdAt: Math.max(0, Number(row?.createdAt) || 0),
        updatedAt: Math.max(0, Number(row?.updatedAt) || 0)
      });
      if (!owners.includes(id)) owners.push(id);
    } catch {}
  }
  return { schemaVersion: 3, ownerName, owners, managed, updatedAt: Math.max(0, Number(value?.updatedAt) || 0) };
}

async function readWorkspaceIndex() {
  return cleanWorkspaceIndex(await readJson(EVENT_WORKSPACE_INDEX_KEY));
}

export async function listManagedEventWorkspaces() {
  return (await readWorkspaceIndex()).managed;
}

function discordWorkspaceName(ownerId, users = []) {
  const discordId = ownerId.slice("discord:".length);
  const user = users.find(row => String(row?.discordId || "") === discordId);
  return String(user?.displayName || user?.username || "").trim() || `Discord ••••${discordId.slice(-4)}`;
}

export async function listEventWorkspaceProfiles(discordUsers = []) {
  const index = await readWorkspaceIndex();
  const managedIds = new Set(index.managed.map(row => row.id));
  const discord = index.owners
    .filter(id => id.startsWith("discord:") && !managedIds.has(id))
    .map(id => ({
      id,
      name: discordWorkspaceName(id, discordUsers),
      personal: false,
      workspaceKind: "discord",
      selfConfigured: true,
      deletable: true
    }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base"
    }));
  return [
    {
      id: "owner",
      name: index.ownerName,
      personal: true,
      workspaceKind: "owner",
      selfConfigured: false,
      deletable: false
    },
    ...index.managed.map(row => ({
      ...row,
      personal: false,
      workspaceKind: "managed",
      selfConfigured: false,
      deletable: true
    })),
    ...discord
  ];
}

export async function renameEventWorkspace(ownerId, name, now = Date.now()) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const cleanName = cleanManagedWorkspaceName(name);
  return withRedisLock("event-workspace-index", async () => {
    const index = await readWorkspaceIndex();
    if (cleanId === "owner") index.ownerName = cleanName;
    else {
      const workspace = index.managed.find(row => row.id === cleanId);
      if (!workspace) throw new TypeError("That webhook subuser no longer exists.");
      workspace.name = cleanName;
      workspace.updatedAt = now;
    }
    index.updatedAt = now;
    await writeJson(EVENT_WORKSPACE_INDEX_KEY, index);
    return cleanId === "owner"
      ? { id: "owner", name: cleanName, personal: true }
      : { ...index.managed.find(row => row.id === cleanId), personal: false };
  });
}

export async function createManagedEventWorkspace(name, now = Date.now()) {
  const cleanName = cleanManagedWorkspaceName(name);
  return withRedisLock("event-workspace-index", async () => {
    const index = await readWorkspaceIndex();
    if (index.owners.length + 1 >= MAX_WORKSPACES) throw new TypeError("The event workspace limit has been reached.");
    const workspace = { id: `managed:${randomUUID()}`, name: cleanName, createdAt: now, updatedAt: now };
    index.owners.push(workspace.id);
    index.managed.push(workspace);
    index.updatedAt = now;
    await writeJson(EVENT_WORKSPACE_INDEX_KEY, index);
    return workspace;
  });
}

export async function managedEventWorkspaceExists(ownerId) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  return cleanId.startsWith("managed:") && (await listManagedEventWorkspaces()).some(row => row.id === cleanId);
}

export async function eventWorkspaceExists(ownerId) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  if (cleanId === "owner") return true;
  return (await listEventWorkspaceOwners()).includes(cleanId);
}

export async function deleteEventWorkspace(ownerId, now = Date.now()) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  if (cleanId === "owner") throw new TypeError("The owner webhook workspace cannot be deleted.");
  return withRedisLock("event-workspace-index", async () => {
    const index = await readWorkspaceIndex();
    if (!index.owners.includes(cleanId)) throw new TypeError("That webhook user no longer exists.");
    index.owners = index.owners.filter(id => id !== cleanId);
    index.managed = index.managed.filter(row => row.id !== cleanId);
    index.updatedAt = now;
    await writeJson(EVENT_WORKSPACE_INDEX_KEY, index);
    await deleteJson(settingsKey(cleanId));
    return true;
  });
}

function cleanTimeZone(value) {
  const timeZone = String(value || defaultTimeZone()).trim().slice(0, 100);
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
  } catch {
    throw new TypeError("Choose a supported event timezone.");
  }
  return timeZone;
}

function cleanTime(value, fallback = "08:05") {
  const time = String(value || fallback).trim();
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new TypeError("Choose a valid event notification time.");
  }
  return time;
}

function cleanWeekday(value, fallback) {
  const weekday = Number(value);
  return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : fallback;
}

function finiteCoordinate(value, minimum, maximum, label) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new TypeError(`Enter a valid ${label}.`);
  }
  return Number(number.toFixed(6));
}

function normalizeLocation(value) {
  const latitude = finiteCoordinate(value?.latitude, -90, 90, "latitude");
  const longitude = finiteCoordinate(value?.longitude, -180, 180, "longitude");
  if ((latitude == null) !== (longitude == null)) {
    throw new TypeError("Enter both latitude and longitude, or leave both blank.");
  }
  const requestedRadius = Number(value?.radiusKm);
  const radiusKm = Number.isFinite(requestedRadius)
    ? Math.min(1_000, Math.max(1, Number(requestedRadius.toFixed(1))))
    : DEFAULT_RADIUS_KM;
  return { latitude, longitude, radiusKm };
}

function normalizeCategories(value) {
  if (!Array.isArray(value)) return [...EVENT_CATEGORY_OPTIONS];
  const selected = new Set(value.map(row => String(row || "").trim().toLowerCase()));
  return EVENT_CATEGORY_OPTIONS.filter(category => selected.has(category));
}

export function normalizeEventWebhookBranding(value) {
  const botName = String(value?.botName || DEFAULT_EVENT_WEBHOOK_BOT_NAME)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const identity = botName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const compactIdentity = identity.replace(/[^a-z0-9]+/g, "");
  const protectedBrand = /\b(?:pokemon(?:\s+go)?|scopely(?:\s+explore)?|niantic|nintendo|game\s*freak|the\s+pokemon\s+company|discord|tiktok)\b/.test(identity);
  const deceptiveRole = /\b(?:official|verified|support|admin(?:istrator)?|moderator|staff|security)\b/.test(identity);
  const exactProtectedIdentity = /^(?:pokemon\s+go|scopely(?:\s+explore)?|niantic|nintendo|game\s*freak|the\s+pokemon\s+company|discord|tiktok)$/i.test(identity);
  const compactProtectedBrand = /(?:pokemon(?:go)?|scopely(?:explore)?|niantic|nintendo|gamefreak|thepokemoncompany|discord|tiktok)/.test(compactIdentity);
  const compactDeceptiveRole = /(?:official|verified|support|helpdesk|admin(?:istrator)?|moderator|staff|security)/.test(compactIdentity);
  if (/[#@:`]/.test(botName) || /(?:clyde|discord)/i.test(botName) || /^(?:everyone|here)$/i.test(botName) ||
      exactProtectedIdentity || (protectedBrand && deceptiveRole) || (compactProtectedBrand && compactDeceptiveRole)) {
    throw new TypeError("Choose a sender name that does not use reserved Discord words or impersonate an official, support, staff, or verified identity.");
  }
  return {
    hideSiteBranding: value?.hideSiteBranding === true,
    botName: botName || DEFAULT_EVENT_WEBHOOK_BOT_NAME
  };
}

function defaultSchedules(ownerId) {
  const legacyOwner = normalizeEventWorkspaceOwnerId(ownerId) === "owner";
  return {
    startingSoon: { enabled: false },
    // 2026-10-30: the daily goes out the evening before and covers the next day.
    today: { enabled: legacyOwner, weekday: null, time: "18:05" },
    // The weekend post is retired by default; daily, week ahead and season/GO Pass remain.
    weekend: { enabled: false, weekday: 5, time: "08:05" },
    week: { enabled: legacyOwner, weekday: 0, time: "08:05" },
    monthly: { enabled: legacyOwner, time: "08:05" }
  };
}

function normalizeSchedules(value, ownerId) {
  const defaults = defaultSchedules(ownerId);
  return {
    startingSoon: { enabled: value?.startingSoon?.enabled === true },
    ...Object.fromEntries(EVENT_DIGEST_KINDS.map(kind => {
    const row = value?.[kind] || {};
    const fallback = defaults[kind];
    const enabled = row.enabled == null ? fallback.enabled : row.enabled === true;
    if (kind === "monthly") return [kind, { enabled, time: cleanTime(row.time, fallback.time) }];
    const time = cleanTime(row.time, fallback.time);
    return [kind, { enabled, weekday: kind === "today" ? null : cleanWeekday(row.weekday, fallback.weekday), time }];
    }))
  };
}

export function defaultEventWorkspaceSettings(ownerId = "owner") {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  return {
    schemaVersion: EVENT_SETTINGS_SCHEMA_VERSION,
    ownerId: cleanId,
    timeZone: defaultTimeZone(),
    location: { latitude: null, longitude: null, radiusKm: DEFAULT_RADIUS_KM },
    scopes: { global: true, local: true },
    categories: [...EVENT_CATEGORY_OPTIONS],
    branding: normalizeEventWebhookBranding(),
    schedules: defaultSchedules(cleanId),
    updatedAt: 0
  };
}

export function normalizeEventWorkspaceSettings(value, ownerId = "owner", now = Date.now()) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId || value?.ownerId);
  const fallback = defaultEventWorkspaceSettings(cleanId);
  const inputSchemaVersion = Math.max(0, Number(value?.schemaVersion) || 0);
  // The original owner workspace defaulted to local-only. Migrate that legacy
  // default once so broad Today/Weekend/Week digests do not silently omit
  // global events such as Community Days. A schema-v2 user choice remains
  // authoritative, including intentionally turning global events back off.
  const migrateLegacyOwnerGlobal = cleanId === "owner" &&
    inputSchemaVersion < 2;
  // The original owner schedule sent This Week on Monday, after part of its
  // window had already begun. Move only that legacy owner default to Sunday;
  // explicit member schedules and later owner choices remain authoritative.
  const migrateLegacyOwnerWeek = cleanId === "owner" && inputSchemaVersion < 4 &&
    Number(value?.schedules?.week?.weekday) === 1;
  const scheduleInput = migrateLegacyOwnerWeek
    ? {
        ...(value?.schedules || {}),
        week: { ...(value?.schedules?.week || {}), weekday: 0 }
      }
    : value?.schedules;
  return {
    schemaVersion: EVENT_SETTINGS_SCHEMA_VERSION,
    ownerId: cleanId,
    timeZone: cleanTimeZone(value?.timeZone || fallback.timeZone),
    location: normalizeLocation(value?.location || fallback.location),
    scopes: {
      global: migrateLegacyOwnerGlobal
        ? true
        : value?.scopes?.global == null ? fallback.scopes.global : value.scopes.global === true,
      local: value?.scopes?.local == null ? fallback.scopes.local : value.scopes.local === true
    },
    categories: normalizeCategories(value?.categories),
    branding: normalizeEventWebhookBranding(value?.branding),
    schedules: normalizeSchedules(scheduleInput, cleanId),
    updatedAt: Math.max(0, Number(value?.updatedAt) || now)
  };
}

export function eventWorkspaceSettingsPublicValue(
  value,
  ownerId = value?.ownerId || "owner",
  { brandingAllowed = false } = {}
) {
  const normalized = normalizeEventWorkspaceSettings(value, ownerId);
  const { ownerId: _ownerId, ...publicValue } = normalized;
  return {
    ...publicValue,
    branding: brandingAllowed
      ? publicValue.branding
      : normalizeEventWebhookBranding()
  };
}

export async function listEventWorkspaceOwners() {
  const value = await readWorkspaceIndex();
  const owners = ["owner"];
  for (const raw of Array.isArray(value?.owners) ? value.owners : []) {
    try {
      const ownerId = normalizeEventWorkspaceOwnerId(raw);
      if (!owners.includes(ownerId)) owners.push(ownerId);
    } catch {
      // Ignore invalid legacy rows.
    }
    if (owners.length >= MAX_WORKSPACES) break;
  }
  return owners;
}

export async function registerEventWorkspaceOwner(ownerId, now = Date.now()) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  if (cleanId === "owner") return [cleanId];
  return withRedisLock("event-workspace-index", async () => {
    const index = await readWorkspaceIndex();
    const owners = ["owner", ...index.owners];
    if (!owners.includes(cleanId)) owners.push(cleanId);
    if (owners.length > MAX_WORKSPACES) throw new TypeError("The event workspace limit has been reached.");
    await writeJson(EVENT_WORKSPACE_INDEX_KEY, {
      schemaVersion: 3,
      ownerName: index.ownerName,
      owners: owners.filter(value => value !== "owner"),
      managed: index.managed,
      updatedAt: now
    });
    return owners;
  });
}

export async function readEventWorkspaceSettings(ownerId = "owner") {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const stored = await readJson(settingsKey(cleanId));
  return stored
    ? normalizeEventWorkspaceSettings(stored, cleanId)
    : defaultEventWorkspaceSettings(cleanId);
}

export async function writeEventWorkspaceSettings(ownerId, value, now = Date.now()) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const normalized = normalizeEventWorkspaceSettings({ ...value, updatedAt: now }, cleanId, now);
  await registerEventWorkspaceOwner(cleanId, now);
  await writeJson(settingsKey(cleanId), normalized);
  return normalized;
}
