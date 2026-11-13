import { createHash } from "node:crypto";
import { defaultTimeZone, siteName, siteUrl } from "./site.js";
import { buildDailyReview, buildEventListReview, buildLocalReview, dailyReviewHtml, dailyReviewText, eventListReviewHtml, eventListReviewText, localReviewHtml, localReviewText, reviewAheadDays, reviewDiscordMessages } from "./daily-review.js";
import { eventGameplayOccurrences } from "../event-calendar.js";
import { regionalLocalSpawnScheduleCardLine } from "../event-card-schedule.js";
import { eventVenues } from "../event-gpx.js";
import { eventWebhookBrandingAllowed, readAccessConfig } from "./access.js";
import { sendEventDigestWebhook } from "./discord-webhook.js";
import { eventDetailId, fetchEventSpawns, safeEventImage } from "./event-spawns.js";
import { eventGpxFilename } from "../event-gpx.js";
import {
  EVENT_DIGEST_KINDS,
  eventWorkspaceStorageSuffix,
  listEventWorkspaceOwners,
  normalizeEventWorkspaceOwnerId,
  normalizeEventWebhookBranding,
  normalizeEventWorkspaceSettings,
  readEventWorkspaceSettings
} from "./event-settings.js";
import {
  EVENT_COORDINATE_LINK_PROVIDERS,
  eventWebhookAvailabilityTargets,
  eventWebhookPreorderTargets,
  eventWebhookTargets,
  normalizeDiscordWebhookUrl,
  normalizeEventCoordinateLinks,
  recordEventWebhookDelivery
} from "./event-webhooks.js";
import { runtimeBinding } from "./runtime-context.js";
import { deleteJson, readJson, withRedisLock, writeJson } from "./storage.js";

const EVENT_DIGEST_STATE_KEY = "event:digest-notifications";
const STARTING_SOON_KIND = "starting-soon";
export const LOCAL_EVENT_STARTING_SOON_LEAD_MS = 135 * 60 * 1_000;
export const EVENT_PREORDER_LEAD_MS = 5 * 24 * 60 * 60 * 1_000;
const STARTING_SOON_QUEUE_LEASE_MS = 15 * 60 * 1_000;
const KINDS = new Set(EVENT_DIGEST_KINDS);
const TITLES = {
  [STARTING_SOON_KIND]: "Local Event Starting Soon",
  today: "Today in Pokémon GO",
  weekend: "This Weekend in Pokémon GO",
  week: "This Week in Pokémon GO",
  monthly: "Season & GO Pass Preview",
  "availability-guide": "Event Availability Guide",
  "preorder-guide": "Preorder Availability"
};
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DISCORD_MAX_EMBEDS = 10;
const DISCORD_MAX_EMBED_CHARACTERS = 6_000;
const SHORT_EVENT_DURATION_MS = 8 * 24 * 60 * 60 * 1_000;
// Long-running local partnerships and attractions (for example a museum
// collaboration) should be a weekly reference, not repeated in every daily
// or weekend reminder. Keep the boundary explicit: “over a month” means more
// than 31 calendar days of runtime.
const LONG_EVENT_DURATION_MS = 31 * 24 * 60 * 60 * 1_000;
const DAY_OF_EVENT_LOCATIONS = Object.freeze([
  { name: "Auckland, New Zealand", coordinates: "-36.8427, 174.7655", timeZone: "Pacific/Auckland" },
  { name: "Wellington, New Zealand", coordinates: "-41.282388, 174.773127", timeZone: "Pacific/Auckland" },
  { name: "Sydney, Australia", coordinates: "-33.864527, 151.210373", timeZone: "Australia/Sydney" },
  { name: "Toshima Station, Japan", coordinates: "35.730424, 139.710778", timeZone: "Asia/Tokyo" },
  { name: "Tokyo, Japan", coordinates: "35.669590, 139.699690", timeZone: "Asia/Tokyo" },
  { name: "Osaka, Japan", coordinates: "34.693644, 135.502231", timeZone: "Asia/Tokyo" },
  { name: "Taipei, Taiwan", coordinates: "25.048331, 121.518533", timeZone: "Asia/Taipei" },
  { name: "Dubai, UAE", coordinates: "25.262210, 55.296802", timeZone: "Asia/Dubai" },
  { name: "Zaragoza, Spain", coordinates: "41.661130, -0.893750", timeZone: "Europe/Madrid" },
  { name: "Ibirapuera Park Area, Sao Paulo, Brazil", coordinates: "-23.58740, -46.65760", timeZone: "America/Sao_Paulo" },
  { name: "New York, USA", coordinates: "40.755931, -73.984606", timeZone: "America/New_York" },
  { name: "San Francisco, Pier 39, USA", coordinates: "37.808864, -122.409786", timeZone: "America/Los_Angeles" },
  { name: "Honolulu, USA", coordinates: "21.306894, -157.858527", timeZone: "Pacific/Honolulu" },
  { name: "Pago Pago, American Samoa", coordinates: "-14.27794, -170.68820", timeZone: "Pacific/Pago_Pago" }
]);

export function automaticDeliveryLedgerKey(url, sentKey, events = [], target = {}, settings = {}) {
  const canonicalUrl = normalizeDiscordWebhookUrl(url);
  // The same Discord URL can intentionally host several independently
  // customized feeds. Only suppress byte-equivalent delivery variants; never
  // let the first timezone/location/role configuration silence another one.
  const variant = {
    events: (Array.isArray(events) ? events : []).map(event => cleanText(event?.id || event?.name, 200)),
    roleId: cleanText(target?.roleId, 40),
    roleMentionKinds: [...(Array.isArray(target?.roleMentionKinds) ? target.roleMentionKinds : [])].sort(),
    coordinateLinks: [...normalizeEventCoordinateLinks(target?.coordinateLinks)].sort(),
    timeZone: cleanText(settings?.timeZone, 100),
    scopes: settings?.scopes || {},
    categories: [...(Array.isArray(settings?.categories) ? settings.categories : [])].sort(),
    location: settings?.location || null,
    availabilityGuide: target?.availabilityGuide === true,
    preorderGuide: target?.preorderGuide === true,
    hideSiteBranding: target?.hideSiteBranding === true,
    botName: cleanText(target?.botName, 80)
  };
  const digest = createHash("sha256")
    .update(JSON.stringify({
      url: canonicalUrl,
      sentKey: String(sentKey || ""),
      variant
    }))
    .digest("hex")
    .slice(0, 40);
  return `event:delivery:${digest}`;
}

export function settingsForWebhookDestination(workspaceSettings, target, ownerId, now) {
  const locationMode = target?.locationMode || "workspace";
  const location = locationMode === "custom" ? target.location : workspaceSettings.location;
  const hasLocation = location?.latitude != null && location?.longitude != null &&
    Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude));
  const scopes = locationMode === "global"
    ? { global: true, local: false }
    : hasLocation
      // A location narrows regional/in-person events; it must never replace
      // the global feed. This is the shared rule for workspace and per-webhook
      // coordinates so adding a radius always means “global + nearby.”
      ? { global: true, local: true }
      : { ...(workspaceSettings.scopes || {}) };
  const normalized = normalizeEventWorkspaceSettings({
    ...workspaceSettings,
    ownerId,
    timeZone: target?.timeZone || workspaceSettings.timeZone,
    location,
    scopes,
    categories: Array.isArray(target?.categories) ? target.categories : workspaceSettings.categories
  }, ownerId, now);
  return {
    ...normalized,
    webhookLocationLabel: locationMode === "custom" ? "this webhook's location" : "your saved location"
  };
}

function cleanText(value, maximum = 1_000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

async function eventWebhookDeliveryTargets(ownerId, kind, settings) {
  const [targets, brandingAllowed] = await Promise.all([
    eventWebhookTargets(ownerId, kind),
    eventWebhookBrandingAllowed(ownerId)
  ]);
  const branding = brandingAllowed
    ? normalizeEventWebhookBranding(settings?.branding)
    : normalizeEventWebhookBranding();
  return targets.map(target => ({
    ...target,
    hideSiteBranding: branding.hideSiteBranding,
    botName: branding.botName
  }));
}

async function eventWebhookAvailabilityDeliveryTargets(ownerId, settings) {
  const [targets, brandingAllowed] = await Promise.all([
    eventWebhookAvailabilityTargets(ownerId),
    eventWebhookBrandingAllowed(ownerId)
  ]);
  const branding = brandingAllowed
    ? normalizeEventWebhookBranding(settings?.branding)
    : normalizeEventWebhookBranding();
  return targets.map(target => ({
    ...target,
    hideSiteBranding: branding.hideSiteBranding,
    botName: branding.botName
  }));
}

async function eventWebhookPreorderDeliveryTargets(ownerId, settings) {
  const [targets, brandingAllowed] = await Promise.all([
    eventWebhookPreorderTargets(ownerId),
    eventWebhookBrandingAllowed(ownerId)
  ]);
  const branding = brandingAllowed
    ? normalizeEventWebhookBranding(settings?.branding)
    : normalizeEventWebhookBranding();
  return targets.map(target => ({
    ...target,
    hideSiteBranding: branding.hideSiteBranding,
    botName: branding.botName
  }));
}

// Building an Intl.DateTimeFormat is far more expensive than formatting with
// one. The every-minute cron calls dateParts thousands of times (zonedDateTime
// iterates it), so reuse one formatter per time zone. Output is unchanged.
const DATE_PARTS_FORMATTERS = new Map();

function datePartsFormatter(timeZone) {
  const cacheKey = String(timeZone);
  let formatter = DATE_PARTS_FORMATTERS.get(cacheKey);
  if (formatter) return formatter;
  formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  if (DATE_PARTS_FORMATTERS.size >= 64) DATE_PARTS_FORMATTERS.clear();
  DATE_PARTS_FORMATTERS.set(cacheKey, formatter);
  return formatter;
}

function dateParts(at, timeZone = defaultTimeZone()) {
  const fields = Object.fromEntries(datePartsFormatter(timeZone).formatToParts(new Date(at))
    .filter(part => part.type !== "literal")
    .map(part => [part.type, part.value]));
  return {
    year: Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    weekday: fields.weekday,
    weekdayIndex: WEEKDAYS.indexOf(fields.weekday),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
    date: `${fields.year}-${fields.month}-${fields.day}`
  };
}

function addCalendarDays(parts, amount) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function zonedDateTime(parts, timeZone = defaultTimeZone()) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0);
  let guess = target;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const actual = dateParts(guess, timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    guess += target - represented;
  }
  return guess;
}

export function eventDigestWindow(kind, now = Date.now(), timeZone = defaultTimeZone()) {
  if (!KINDS.has(kind)) throw new TypeError("Unknown event digest kind.");
  const local = dateParts(now, timeZone);
  const todayParts = { year: local.year, month: local.month, day: local.day };
  const weekdayIndex = local.weekdayIndex;
  let startOffset = 0;
  let days = 1;
  // 2026-10-30: a daily sent from noon on is for the next day; its window and dedupe date are that day,
  // so a morning send and an evening send on the same date are two different posts.
  if (kind === "today" && local.hour >= 12) startOffset = 1;
  if (kind === "week") {
    // The automatic weekly snapshot is sent Sunday and previews the next
    // Monday through Sunday. Manual sends during a week preview the next
    // upcoming Monday so the window never reaches backward into stale days.
    startOffset = (8 - weekdayIndex) % 7;
    days = 7;
  } else if (kind === "weekend") {
    startOffset = weekdayIndex === 6 ? -1 : weekdayIndex === 0 ? -2 : 5 - weekdayIndex;
    days = 3;
  } else if (kind === "monthly") {
    const startParts = addCalendarDays(todayParts, 1);
    const endParts = addCalendarDays(todayParts, 2);
    return {
      kind,
      localDate: local.date,
      startAt: zonedDateTime(startParts, timeZone),
      endAt: zonedDateTime(endParts, timeZone),
      timeZone
    };
  }
  const startParts = addCalendarDays(todayParts, startOffset);
  const endParts = addCalendarDays(startParts, days);
  return {
    kind,
    localDate: kind === "today" && startOffset ? dateParts(zonedDateTime(startParts, timeZone), timeZone).date : local.date,
    startAt: zonedDateTime(startParts, timeZone),
    endAt: zonedDateTime(endParts, timeZone),
    timeZone
  };
}

function eventBoundary(value, event, viewerTimeZone) {
  const text = String(value || "").trim();
  if (!text) return NaN;
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(text)) return Date.parse(text);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return Date.parse(text);
  const zone = cleanText(event?.timeZone, 100) || viewerTimeZone;
  return zonedDateTime({
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4]) || 0, minute: Number(match[5]) || 0, second: Number(match[6]) || 0
  }, zone);
}

function eventInterval(event, viewerTimeZone = defaultTimeZone()) {
  const startAt = eventBoundary(event?.start, event, viewerTimeZone);
  const endAt = eventBoundary(event?.end, event, viewerTimeZone);
  if (!Number.isFinite(startAt) && !Number.isFinite(endAt)) return null;
  return {
    startAt: Number.isFinite(startAt) ? startAt : endAt,
    // A published start with no end means “ongoing”, not a zero-length event.
    // Keeping that distinction prevents open-ended stamp rallies from falling
    // out of every future weekly digest.
    endAt: Number.isFinite(endAt) ? endAt : Number.POSITIVE_INFINITY,
    openEnded: Number.isFinite(startAt) && !Number.isFinite(endAt)
  };
}

function eventCategory(event) {
  const text = `${event?.eventType || ""} ${event?.heading || ""} ${event?.name || ""}`.toLowerCase();
  if (/season|go[ -]?pass|monthly pass/.test(text)) return "season-pass";
  if (/dynamax|gigantamax|max battle|max monday|max finale|max day/.test(text)) return "max";
  if (/raid/.test(text)) return "raids";
  if (/community day|go fest|city safari|safari zone|tour/.test(text)) return "community";
  if (/spotlight/.test(text)) return "spotlight";
  if (/research/.test(text)) return "research";
  if (event?.scope && event.scope !== "global") return "local";
  return "other";
}

function featuredEventKind(event) {
  const text = `${event?.eventType || ""} ${event?.heading || ""} ${event?.name || ""}`.toLowerCase();
  if (/go[ -]?pass|monthly pass/.test(text)) return "pass";
  if (/\bseason\b/.test(text)) return "season";
  return "";
}

function eventIdentity(event) {
  return `${event?.eventType || ""} ${event?.heading || ""} ${event?.name || ""}`.toLowerCase();
}

function eventDuration(interval) {
  if (!interval) return Number.POSITIVE_INFINITY;
  return Math.max(0, interval.endAt - interval.startAt);
}

function digestEventDuration(event, interval) {
  if (event?.scope !== "global" || event?.localTime !== true) return eventDuration(interval);
  const floatingBoundary = value => String(value || "").replace(/(?:[zZ]|[+-]\d{2}:\d{2})$/, "");
  const nominalInterval = eventInterval({
    ...event,
    start: floatingBoundary(event?.start),
    end: floatingBoundary(event?.end),
    timeZone: "Pacific/Kiritimati"
  }, "Pacific/Kiritimati");
  return eventDuration(nominalInterval);
}

function digestWindowInterval(event, timeZone) {
  return event?.scope === "global" && event?.localTime === true
    ? discordEventInterval(event, timeZone)
    : eventInterval(event, timeZone);
}

function hasPublishedEventLocation(event) {
  if (cleanText(event?.coordinates, 100)) return true;
  if (eventVenues(event).length) return true;
  return event?.scope && event.scope !== "global";
}

function hasExactStartingSoonTimestamp(event) {
  if (event?.startingSoonAlert !== true) return false;
  const start = String(event?.start || "").trim();
  if (!start) return false;
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(start)) return true;
  return event?.localTime === true && Boolean(cleanText(event?.timeZone, 100));
}

export function startingSoonEventSentKey(event) {
  if (!hasExactStartingSoonTimestamp(event)) return "";
  const interval = eventInterval(event, event?.timeZone || defaultTimeZone());
  if (!interval || !Number.isFinite(interval.startAt) || !Number.isFinite(interval.endAt)) return "";
  const digest = createHash("sha256")
    .update(`${eventDetailId(event)}|${interval.startAt}`)
    .digest("hex")
    .slice(0, 32);
  return `${STARTING_SOON_KIND}:${digest}`;
}

function isDaySpecificGlobalEvent(event, viewerTimeZone, now) {
  if (event?.scope !== "global" || hasPublishedEventLocation(event)) return false;
  const interval = eventInterval(event, viewerTimeZone);
  if (!interval) return false;
  const identity = eventIdentity(event);
  const namedDayEvent = /raid[ -]?hour|spotlight[ -]?hour|max monday|raid[ -]?day|community[ -]?day|research[ -]?day|hatch[ -]?day|incense[ -]?day|battle[ -]?day|limited research|special event/.test(identity);
  if (!namedDayEvent && eventDuration(interval) > 12 * 60 * 60 * 1_000) return false;
  const local = dateParts(now, viewerTimeZone);
  const dayStart = zonedDateTime({ year: local.year, month: local.month, day: local.day }, viewerTimeZone);
  const dayEnd = zonedDateTime(addCalendarDays(local, 1), viewerTimeZone);
  return interval.startAt < dayEnd && interval.endAt >= dayStart;
}

function digestEventDay(interval, window) {
  if (!interval || !window) return "9999-99-99";
  // An event already in progress belongs to the first day of this digest.
  // This keeps the webhook readable as a calendar sequence instead of letting
  // an old, long-running event sort ahead of the next dated item.
  return dateParts(Math.max(interval.startAt, window.startAt), window.timeZone).date;
}

function digestEventPriority(event, interval) {
  const identity = eventIdentity(event);
  if (/community[ -]?day/.test(identity)) return 0;
  if (/raid[ -]?hour/.test(identity)) return 1;
  if (/spotlight[ -]?hour/.test(identity)) return 2;
  if (eventDuration(interval) <= 24 * 60 * 60 * 1_000) return 3;
  if (event?.scope && event.scope !== "global") return 4;
  return 5;
}

function activeGlobalMultiDayEvent(event, interval, window) {
  return event?.scope === "global" &&
    !isRaidRotationEvent(event) &&
    interval?.startAt < window?.startAt &&
    interval?.endAt > window?.startAt &&
    eventDuration(interval) > 24 * 60 * 60 * 1_000;
}

function eventTransition(interval, window) {
  return {
    starts: interval.startAt >= window.startAt && interval.startAt < window.endAt,
    ends: interval.endAt > window.startAt && interval.endAt <= window.endAt
  };
}

function isBattleLeague(event) {
  return /battle league|go-battle-league/.test(eventIdentity(event));
}

function isRaidOrMaxEvent(event) {
  return ["raids", "max"].includes(eventCategory(event));
}

function isRaidRotationEvent(event) {
  if (eventCategory(event) !== "raids") return false;
  // Raid Hours/Days are dated activities and should remain daily reminders.
  // The longer boss listings are rotations: announce them in Week Ahead and
  // again only on the day their boss lineup changes.
  return !/raid[ -]?(?:hour|day|week|weekend|night)|battle day/.test(eventIdentity(event));
}

function isFeaturedDailyRaidRotation(event) {
  if (!isRaidRotationEvent(event)) return false;
  // Daily should carry the headline weekly raid lineup without expanding into
  // every Tier 1/Tier 3 boss listing. Five-star/Legendary, Mega, and Shadow
  // rotations are the three persistent raid groups users need at a glance.
  return /\b(?:5[ -]?star|legendary|mega|shadow)\b/.test(eventIdentity(event));
}

function isStampRallyEvent(event) {
  return /stamp[\s-]*rally/i.test(eventIdentity(event));
}

function isSafariEvent(event) {
  return /\b(?:city\s+safari|safari\s+zone|safari)\b/i.test(eventIdentity(event));
}

// Multi-stop partnership and stamp-rally events are useful route references,
// but they are not useful as daily reminders. Keep them in the weekly digest
// where the complete GPX/detail-page link can be shared once without flooding
// Discord with one notification per mapped venue.
function isMappedMultiStopEvent(event) {
  return isStampRallyEvent(event) || eventVenues(event).length > 1;
}

function hasDailyEventInformation(event) {
  const details = event?.details || {};
  return Boolean(
    (Array.isArray(event?.bonuses) && event.bonuses.length) ||
    (Array.isArray(details?.sections) && details.sections.length) ||
    (Array.isArray(details?.bonusWindows) && details.bonusWindows.length) ||
    (Array.isArray(details?.spawns) && details.spawns.length) ||
    (Array.isArray(details?.raidBosses) && details.raidBosses.length)
  );
}

function battleAvailabilityLabel(event, { newRotation = false, today = false } = {}) {
  if (eventCategory(event) === "max") {
    return newRotation
      ? `A new Max Battle rotation begins ${today ? "today" : "this week"}.`
      : "Available in Max Battles today.";
  }
  return newRotation
    ? `A new raid rotation begins ${today ? "today" : "this week"}.`
    : "Available in raids today.";
}

function digestRelevant(event, kind, interval, window) {
  const featuredKind = featuredEventKind(event);
  if (kind === "monthly") return eventCategory(event) === "season-pass";
  if (featuredKind === "pass") return false;
  if (kind === "weekend" && featuredKind === "season") return false;
  if (featuredKind === "season") return true;
  const duration = eventDuration(interval);
  const transition = eventTransition(interval, window);
  if (isBattleLeague(event)) return false;
  const isLongRunningEvent = duration > LONG_EVENT_DURATION_MS;
  if (kind === "today") {
    if (isMappedMultiStopEvent(event)) return false;
    if (isFeaturedDailyRaidRotation(event)) return true;
    if (isLongRunningEvent) return false;
    if (isRaidRotationEvent(event)) return transition.starts || transition.ends;
    if (eventCategory(event) === "max") return true;
    return duration <= SHORT_EVENT_DURATION_MS || hasDailyEventInformation(event) || transition.starts || transition.ends;
  }
  if (kind === "weekend") {
    if (isLongRunningEvent) return false;
    if (isMappedMultiStopEvent(event)) return false;
    return duration <= SHORT_EVENT_DURATION_MS || isRaidOrMaxEvent(event) || transition.starts || transition.ends;
  }
  if (kind === "week") {
    // The week-ahead view favors bounded events and changes. Long-running
    // events are intentionally included here once per weekly digest so users
    // still get a reminder without daily/weekend repetition. Stamp rallies
    // remain included even when shorter because their mapped stops and GPX
    // route are useful throughout the week.
    return isLongRunningEvent || isMappedMultiStopEvent(event) || duration <= SHORT_EVENT_DURATION_MS || transition.starts || transition.ends;
  }
  return true;
}

function digestReason(event, kind, interval, window) {
  const { starts, ends } = eventTransition(interval, window);
  const duration = eventDuration(interval);
  if (kind === "today") {
    if (isRaidRotationEvent(event)) {
      if (starts) return battleAvailabilityLabel(event, { newRotation: true, today: true });
      if (ends) return "Last day — this event ends today.";
    }
    if (starts && ends) return "Included because this event happens today.";
    if (starts) return "Starts today.";
    if (ends) return "Last day — this event ends today.";
    if (isRaidOrMaxEvent(event)) return battleAvailabilityLabel(event);
    if (event?.scheduleNote) return event.scheduleNote;
    return "Active today as a limited-time event.";
  }
  if (event?.scheduleNote) return event.scheduleNote;
  if (kind === "weekend") return "Happening during this Friday–Sunday weekend.";
  if (kind === "week") {
    if (starts && ends) return "A short event happening during the week ahead.";
    if (starts && isRaidOrMaxEvent(event)) return battleAvailabilityLabel(event, { newRotation: true });
    if (starts) return "Begins during the week ahead.";
    if (ends) return "Ends during the week ahead.";
    if (duration <= 24 * 60 * 60 * 1_000) return "A one-day event in the week ahead.";
    return "Active during the Monday–Sunday week ahead.";
  }
  return "";
}

function contextualSeasonEvent(event, kind, window) {
  const featuredKind = featuredEventKind(event);
  if (!featuredKind) return event;
  if (kind === "monthly") return event;
  // Daily should stay focused on actionable events happening today. Season
  // notes remain available in the Week Ahead and monthly previews without
  // repeating an evergreen Season card every morning.
  if (featuredKind === "pass" || kind === "weekend" ||
      (featuredKind === "season" && kind === "today")) return null;
  const weekdayIndexes = kind === "week"
    ? new Set([0, 1, 2, 3, 4, 5, 6])
    : new Set([dateParts(window.startAt, window.timeZone).weekdayIndex]);
  const bonuses = (Array.isArray(event?.bonuses) ? event.bonuses : []).filter(bonus =>
    WEEKDAY_NAMES.some((weekday, index) => weekdayIndexes.has(index) && new RegExp(`\\b${weekday}\\b`, "i").test(String(bonus || ""))));
  if (!bonuses.length) return null;
  const dayLabel = kind === "today"
    ? WEEKDAY_NAMES[[...weekdayIndexes][0]]
    : "this week";
  return {
    ...event,
    name: kind === "today" ? `${event.name} — ${dayLabel} Season Note` : `${event.name} — This Week's Season Notes`,
    heading: "Season timing",
    bonuses,
    summary: "",
    scheduleNote: kind === "today"
      ? `Included because this Season bonus applies on ${dayLabel}.`
      : "Included because these Season bonuses apply on specific days this week."
  };
}

function haversineKm(left, right) {
  const toRadians = value => value * Math.PI / 180;
  const latitudeDelta = toRadians(right.lat - left.lat);
  const longitudeDelta = toRadians(right.lng - left.lng);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(left.lat)) * Math.cos(toRadians(right.lat)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function eventForLocation(event, settings) {
  if (event?.scope === "global") return event;
  const { latitude, longitude, radiusKm } = settings.location;
  if (latitude == null || longitude == null) return event;
  const center = { lat: latitude, lng: longitude };
  const publishedVenues = eventVenues(event);
  // Some official regional events publish countries/venues but no usable
  // coordinates. A location preference must not silently hide those events;
  // retain them as region-wide notices and make the lack of distance filtering
  // explicit in the resulting card/embed.
  if (!publishedVenues.length) {
    return {
      ...event,
      locationFilterUnavailable: true,
      locationLabel: settings.webhookLocationLabel || "your saved location"
    };
  }
  const nearby = publishedVenues
    .map(venue => ({ ...venue, distanceKm: haversineKm(center, venue) }))
    .filter(venue => venue.distanceKm <= radiusKm)
    .sort((left, right) => left.distanceKm - right.distanceKm);
  if (!nearby.length) return null;
  const closest = nearby[0];
  return {
    ...event,
    venues: nearby,
    venueCount: nearby.length,
    location: closest.name || closest.location || event.location,
    coordinates: closest.coordinates,
    timeZone: closest.timeZone || event.timeZone,
    distanceKm: Number(closest.distanceKm.toFixed(1)),
    locationLabel: settings.webhookLocationLabel || "your saved location"
  };
}

export function eventsForDigest(events, kind, now = Date.now(), rawSettings = {}) {
  const settings = {
    ...normalizeEventWorkspaceSettings(rawSettings, rawSettings?.ownerId || "owner", now),
    webhookLocationLabel: rawSettings?.webhookLocationLabel || "your saved location"
  };
  const window = eventDigestWindow(kind, now, settings.timeZone);
  const categories = new Set(settings.categories);
  return (Array.isArray(events) ? events : [])
    .filter(event => kind !== "monthly" || eventCategory(event) === "season-pass")
    .filter(event => event?.scope === "global" ? settings.scopes.global : settings.scopes.local)
    .filter(event => categories.has(eventCategory(event)))
    .filter(event => eventGameplayOccurrences(event).some(row => {
      const interval = eventInterval(row, settings.timeZone);
      return interval && interval.startAt < window.endAt && interval.endAt > window.startAt;
    }))
    .map(event => ({ event, interval: eventInterval(event, settings.timeZone) }))
    .filter(({ interval }) => interval && (kind === "monthly"
      ? interval.startAt >= window.startAt && interval.startAt < window.endAt
      : interval.startAt < window.endAt && interval.endAt >= window.startAt))
    .map(({ event, interval }) => ({ event: contextualSeasonEvent(event, kind, window), interval }))
    .filter(({ event }) => Boolean(event))
    .filter(({ event, interval }) => digestRelevant(event, kind, interval, window))
    .map(({ event, interval }) => ({
      event: {
        ...event,
        scheduleNote: digestReason(event, kind, interval, window)
      },
      interval
    }))
    .map(({ event, interval }) => ({ event: eventForLocation(event, settings), interval }))
    .filter(({ event }) => Boolean(event))
    .sort((left, right) => {
      if (kind === "monthly") {
        const featuredDelta = (featuredEventKind(left.event) === "season" ? 0 : 1) -
          (featuredEventKind(right.event) === "season" ? 0 : 1);
        if (featuredDelta) return featuredDelta;
      } else {
        // Season/pass context is evergreen rather than a dated event. Keep it
        // as a closing note while the actual events remain in day order.
        const evergreenDelta = (featuredEventKind(left.event) ? 1 : 0) -
          (featuredEventKind(right.event) ? 1 : 0);
        if (evergreenDelta) return evergreenDelta;
      }
      if (kind === "today") {
        // The active global event explains the day's changing bonuses and
        // spawns, so lead Today with it before the one-hour reminders. Other
        // rows still follow calendar day order and the established short-event
        // priority within that day.
        const activeGlobalDelta = (activeGlobalMultiDayEvent(left.event, left.interval, window) ? 0 : 1) -
          (activeGlobalMultiDayEvent(right.event, right.interval, window) ? 0 : 1);
        if (activeGlobalDelta) return activeGlobalDelta;
      }
      const dayDelta = digestEventDay(left.interval, window).localeCompare(
        digestEventDay(right.interval, window)
      );
      if (dayDelta) return dayDelta;
      // Preserve the existing short-window/type ranking for events on the
      // same day (Community Day, raid hour, spotlight hour, etc.).
      const priorityDelta = digestEventPriority(left.event, left.interval) -
        digestEventPriority(right.event, right.interval);
      if (priorityDelta) return priorityDelta;
      const startDelta = left.interval.startAt - right.interval.startAt;
      if (startDelta) return startDelta;
      const durationDelta = eventDuration(left.interval) - eventDuration(right.interval);
      if (Number.isFinite(durationDelta) && durationDelta) return durationDelta;
      return cleanText(left.event?.id || left.event?.name, 300).localeCompare(
        cleanText(right.event?.id || right.event?.name, 300)
      );
    })
    .map(({ event }) => event);
}

/**
 * Select future event occurrences whose published start is within the
 * five-day preorder window. Unlike Today/Week digests this intentionally
 * looks ahead from the event start, so a sales channel can prepare listings
 * before the event is live. The same scope, category, timezone, and location
 * rules as the normal event feed still apply.
 */
export function eventsForPreorderGuide(events, now = Date.now(), rawSettings = {}) {
  const settings = {
    ...normalizeEventWorkspaceSettings(rawSettings, rawSettings?.ownerId || "owner", now),
    webhookLocationLabel: rawSettings?.webhookLocationLabel || "your saved location"
  };
  const categories = new Set(settings.categories);
  const rows = (Array.isArray(events) ? events : [])
    .flatMap(eventGameplayOccurrences)
    .filter(event => !isSafariEvent(event))
    .filter(event => event?.scope === "global" ? settings.scopes.global : settings.scopes.local)
    .filter(event => categories.has(eventCategory(event)))
    .filter(event => !isBattleLeague(event) && !["season", "pass"].includes(featuredEventKind(event)))
    .map(event => ({ event, interval: eventInterval(event, settings.timeZone) }))
    .filter(({ interval }) => interval && Number.isFinite(interval.startAt) &&
      interval.startAt > now && interval.startAt <= now + EVENT_PREORDER_LEAD_MS)
    .map(({ event, interval }) => ({ event: eventForLocation(event, settings), interval }))
    .filter(({ event }) => Boolean(event))
    .sort((left, right) => left.interval.startAt - right.interval.startAt ||
      cleanText(left.event?.id || left.event?.name, 300).localeCompare(cleanText(right.event?.id || right.event?.name, 300)));
  const seen = new Set();
  return rows.filter(({ event }) => {
    const key = eventDetailId(event) || cleanText(event?.name, 300);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(({ event }) => event);
}

export function localEventsForDigest(events, kind, now = Date.now()) {
  return eventsForDigest(events, kind, now, {
    ...normalizeEventWorkspaceSettings({}, "owner", now),
    scopes: { global: false, local: true }
  });
}

/**
 * Select exact-time, bounded local events whose one-time 2h15 alert is due.
 * Eligibility is explicit so a date-only partnership or stamp-rally window is
 * never mistaken for a published event start time.
 */
export function eventsForLocalStartingSoon(events, now = Date.now(), rawSettings = {}) {
  const settings = {
    ...normalizeEventWorkspaceSettings(rawSettings, rawSettings?.ownerId || "owner", now),
    webhookLocationLabel: rawSettings?.webhookLocationLabel || "your saved location"
  };
  if (settings.schedules?.startingSoon?.enabled !== true || settings.scopes?.local !== true) return [];
  const categories = new Set(settings.categories);
  const radiusConfigured = settings.location?.latitude != null && settings.location?.longitude != null;
  return (Array.isArray(events) ? events : [])
    .flatMap(eventGameplayOccurrences)
    .filter(event => !isStampRallyEvent(event))
    .filter(event => event?.scope !== "global" && hasPublishedEventLocation(event))
    .filter(event => !radiusConfigured || eventVenues(event).length > 0)
    .filter(event => categories.has(eventCategory(event)))
    .map(event => ({ event, interval: eventInterval(event, settings.timeZone) }))
    .filter(({ event, interval }) => {
      if (!startingSoonEventSentKey(event) || !interval) return false;
      const duration = eventDuration(interval);
      const alertAt = interval.startAt - LOCAL_EVENT_STARTING_SOON_LEAD_MS;
      return duration <= SHORT_EVENT_DURATION_MS && alertAt <= now && now < interval.startAt;
    })
    .map(({ event, interval }) => ({ event: eventForLocation(event, settings), interval }))
    .filter(({ event }) => Boolean(event))
    .sort((left, right) => left.interval.startAt - right.interval.startAt ||
      cleanText(left.event?.id || left.event?.name, 300).localeCompare(cleanText(right.event?.id || right.event?.name, 300)))
    .map(({ event }) => event);
}

function timeRange(event, timeZone) {
  const start = new Date(eventBoundary(event.start, event, timeZone));
  const end = new Date(eventBoundary(event.end, event, timeZone));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short"
  });
  if (Number.isFinite(start.getTime()) && !Number.isFinite(end.getTime())) {
    return `${formatter.format(start)} – Ongoing (no end published)`;
  }
  if (!Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
    return `Ends ${formatter.format(end)}`;
  }
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return "Time not published";
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function floatingLocalRange(event) {
  const parse = value => {
    const text = String(value || "").trim();
    if (!text) return null;
    const date = new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(text) ? text : `${text}Z`);
    return Number.isFinite(date.getTime()) ? date : null;
  };
  const start = parse(event?.start);
  const end = parse(event?.end);
  if (!start && !end) return "Time not published";
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", weekday: "short", month: "short", day: "numeric"
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", hour: "numeric", minute: "2-digit"
  });
  const first = start || end;
  const last = end || start;
  const firstDate = dateFormatter.format(first);
  const lastDate = dateFormatter.format(last);
  if (start && !end) {
    return `${firstDate}, ${timeFormatter.format(first)} – ongoing local time (no end published)`;
  }
  if (!start && end) {
    return `Ends ${lastDate}, ${timeFormatter.format(last)} local time`;
  }
  return firstDate === lastDate
    ? `${firstDate}, ${timeFormatter.format(first)} – ${timeFormatter.format(last)} local time`
    : `${firstDate}, ${timeFormatter.format(first)} – ${lastDate}, ${timeFormatter.format(last)} local time`;
}

export function eventTimeLines(event, viewerTimeZone = defaultTimeZone()) {
  if (event?.scope === "global") {
    // Global event feeds belong to the destination profile, not Kiribati.
    // Floating “local time” dates are interpreted in the configured timezone;
    // absolute dates are simply formatted in it.
    const floatingBoundary = value => event?.localTime === true
      ? String(value || "").replace(/(?:[zZ]|[+-]\d{2}:\d{2})$/, "")
      : value;
    const viewerEvent = {
      ...event,
      start: floatingBoundary(event?.start),
      end: floatingBoundary(event?.end),
      timeZone: viewerTimeZone
    };
    if (event?.localTime === true) {
      return [
        `Configured time (${viewerTimeZone}): ${timeRange(viewerEvent, viewerTimeZone)}`,
        `Occurs at these local hours: ${floatingLocalRange(event)}`
      ];
    }
    return [
      `Configured time (${viewerTimeZone}): ${timeRange(viewerEvent, viewerTimeZone)}`
    ];
  }
  const venueZones = [...new Set(eventVenues(event).map(venue => cleanText(venue?.timeZone, 100)).filter(Boolean))];
  const localZone = String(event?.timeZone || (venueZones.length === 1 ? venueZones[0] : "")).trim();
  if (!localZone) {
    const interval = eventInterval(event, viewerTimeZone);
    const configuredLine = interval && event?.localTime !== true
      ? `Configured time (${viewerTimeZone}): ${timeRange(event, viewerTimeZone)}`
      : `Configured time (${viewerTimeZone}): unavailable until the venue timezone is published`;
    return [
      `Event local time: ${event?.localTime === true ? floatingLocalRange(event) : "Venue timezone not published"}`,
      configuredLine
    ];
  }
  return [
    `Event local time (${localZone}): ${timeRange(event, localZone)}`,
    `Configured time (${viewerTimeZone}): ${timeRange(event, viewerTimeZone)}`
  ];
}

function discordTimestampRange(interval) {
  if (!interval || !Number.isFinite(interval.startAt)) return "";
  const start = Math.floor(interval.startAt / 1_000);
  if (interval.openEnded || !Number.isFinite(interval.endAt)) {
    return `<t:${start}:F> – ongoing (no end published)`;
  }
  const end = Math.floor(interval.endAt / 1_000);
  return start === end ? `<t:${start}:F>` : `<t:${start}:F> – <t:${end}:F>`;
}

function gameplayOccurrenceHeading(value) {
  const parts = cleanText(value, 240).split(/\s+·\s+/);
  const primary = parts.shift() || "";
  const isoDateOrTime = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
  if (isoDateOrTime.test(primary)) return parts.join(" · ");
  return [primary, ...parts].filter(Boolean).join(" · ");
}

function discordEventInterval(event, viewerTimeZone) {
  // Rolling global events span the first local start (UTC+14) through the
  // last local finish (UTC-12), independent of the webhook's timezone.
  if (event?.scope === "global" && event?.localTime === true) {
    const floatingBoundary = value => String(value || "")
      .replace(/(?:[zZ]|[+-]\d{2}:\d{2})$/, "");
    const floating = {
      ...event,
      start: floatingBoundary(event?.start),
      end: floatingBoundary(event?.end)
    };
    const first = eventInterval({ ...floating, timeZone: "Pacific/Kiritimati" }, "Pacific/Kiritimati");
    const last = eventInterval({ ...floating, timeZone: "Etc/GMT+12" }, "Etc/GMT+12");
    return first && last ? { ...first, endAt: last.endAt } : null;
  }
  if (event?.scope !== "global") {
    const venueZones = [...new Set(eventVenues(event).map(venue => cleanText(venue?.timeZone, 100)).filter(Boolean))];
    const localZone = cleanText(event?.timeZone || (venueZones.length === 1 ? venueZones[0] : ""), 100);
    // A floating venue time without a published venue zone has no absolute
    // instant. Keep it unresolved instead of borrowing the viewer's zone.
    if (localZone) return eventInterval(event, localZone);
    return event?.localTime === true ? null : eventInterval(event, viewerTimeZone);
  }
  return eventInterval(event, viewerTimeZone);
}

function discordTimeLines(event, viewerTimeZone) {
  if ((event.details?.gameplayWindows?.length || event.details?.raidSchedule?.windows?.length) && !event.gameplayOccurrence) {
    return eventGameplayOccurrences(event).flatMap(row =>
      discordTimeLines(row, viewerTimeZone).map(line => `**${row.gameplayOccurrence}** · ${line}`));
  }
  // The configured destination timezone is useful for resolving floating
  // local-time events, but it should never be shown as the reader's time.
  // Discord timestamp tags render in each reader's own device timezone.
  const lines = eventTimeLines(event, viewerTimeZone)
    .filter(line => !/^Configured time \(/.test(line));
  let interval = null;
  // Rolling global events span the first local start (UTC+14) through the
  // last local finish (UTC-12), independent of the webhook's timezone.
  if (event?.scope === "global" && event?.localTime === true) {
    const floatingBoundary = value => String(value || "")
      .replace(/(?:[zZ]|[+-]\d{2}:\d{2})$/, "");
    const floating = {
      ...event,
      start: floatingBoundary(event?.start),
      end: floatingBoundary(event?.end)
    };
    const first = eventInterval({ ...floating, timeZone: "Pacific/Kiritimati" }, "Pacific/Kiritimati");
    const last = eventInterval({ ...floating, timeZone: "Etc/GMT+12" }, "Etc/GMT+12");
    interval = first && last ? { ...first, endAt: last.endAt } : null;
  } else if (event?.scope !== "global") {
    const venueZones = [...new Set(eventVenues(event).map(venue => cleanText(venue?.timeZone, 100)).filter(Boolean))];
    const localZone = cleanText(event?.timeZone || (venueZones.length === 1 ? venueZones[0] : ""), 100);
    // A cross-region floating-time event has no single exact instant. Do not
    // invent one from the viewer's timezone; the native wording is safer and
    // remains correct for every participating country.
    if (localZone) interval = eventInterval(event, localZone);
    else if (event?.localTime !== true) interval = eventInterval(event, viewerTimeZone);
  } else {
    interval = eventInterval(event, viewerTimeZone);
  }
  const readerRange = discordTimestampRange(interval);
  return [
    ...lines.map(emphasizeDiscordLine),
    ...(readerRange ? [emphasizeDiscordLine(`${event?.scope === "global" && event?.localTime === true ? "Full global window (your time, UTC+14 to UTC−12)" : "Your time"}: ${readerRange}`)] : [])
  ];
}

function emphasizeDiscordLine(line) {
  const text = cleanText(line, 1_000);
  const separator = text.indexOf(": ");
  return separator > 0
    ? `**${text.slice(0, separator)}:** **${text.slice(separator + 2)}**`
    : `**${text}**`;
}

function wallClockKey(timestamp, timeZone) {
  const date = new Date(Number(timestamp));
  if (!Number.isFinite(date.getTime())) return null;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || defaultTimeZone(),
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  } catch {
    return date.getTime();
  }
}

function bonusWindowKey(date, time = "00:00") {
  const match = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const clock = String(time || "00:00").match(/^(\d{1,2}):(\d{2})$/);
  if (!match || !clock) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(clock[1]), Number(clock[2]));
}

function activeBonusWindow(event, now, viewerTimeZone) {
  if (event?.localTime !== true) return null;
  const windows = Array.isArray(event?.details?.bonusWindows) ? event.details.bonusWindows : [];
  const current = wallClockKey(now, viewerTimeZone);
  if (!Number.isFinite(current)) return null;
  return windows.find(window => {
    const start = bonusWindowKey(window?.startDate, window?.startTime);
    const end = bonusWindowKey(window?.endDate, window?.endTime);
    return Number.isFinite(start) && Number.isFinite(end) && current >= start && current < end;
  }) || null;
}

function itoolsOnlyDestination(providers) {
  const selected = normalizeEventCoordinateLinks(providers);
  return selected.length === 1 && selected[0] === "itools";
}

function compactEventItem(value, { itoolsOnly = false, maximum = 500 } = {}) {
  let text = cleanText(value?.name || value?.text || value, maximum);
  if (!text || !itoolsOnly) return text;
  // Raw Pokédex/form identifiers and internal form constants are useful to
  // bots, not to a person using an iTools-only destination. Keep readable
  // form names (for example “Cramorant (Gulping)”) while removing codes such
  // as “(845:3349)” and standalone “PSYDUCK_SWIM_2025” rows.
  text = text.replace(/\(\s*\d{1,4}(?::\d{1,6})?\s*\)\s*/g, "").trim();
  if (/^[A-Z][A-Z0-9_]{4,}$/.test(text)) return "";
  return text;
}

function detailNames(value, maximum = 24, options = {}) {
  const rows = Array.isArray(value) ? value : [];
  const names = [];
  const seen = new Set();
  for (const row of rows) {
    const name = compactEventItem(row, { ...options, maximum: 120 });
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= maximum) break;
  }
  return names;
}

function fieldChunks(name, lines, { continuation = "More", maximumFields = 4 } = {}) {
  const values = (Array.isArray(lines) ? lines : []).map(value => cleanText(value, 1_000)).filter(Boolean);
  const fields = [];
  let batch = [];
  let length = 0;
  for (const line of values) {
    const safeLine = line.slice(0, 1_000);
    if (batch.length && length + safeLine.length + 1 > 1_000) {
      fields.push({
        name: fields.length ? `${continuation} ${name}`.slice(0, 256) : name.slice(0, 256),
        value: batch.join("\n").slice(0, 1_024),
        inline: false
      });
      batch = [];
      length = 0;
      if (fields.length >= maximumFields) break;
    }
    batch.push(safeLine);
    length += safeLine.length + 1;
  }
  if (batch.length && fields.length < maximumFields) {
    fields.push({
      name: fields.length ? `${continuation} ${name}`.slice(0, 256) : name.slice(0, 256),
      value: batch.join("\n").slice(0, 1_024),
      inline: false
    });
  }
  return fields;
}

function blockFieldChunks(name, blocks, { continuation = "More", maximumFields = 4 } = {}) {
  const values = (Array.isArray(blocks) ? blocks : []).map(value =>
    String(value || "").split("\n").map(line => cleanText(line, 1_000)).filter(Boolean).join("\n")
  ).filter(Boolean);
  const fields = [];
  let batch = [];
  let length = 0;
  for (const block of values) {
    const safeBlock = block.slice(0, 1_000);
    const separatorLength = batch.length ? 2 : 0;
    if (batch.length && length + separatorLength + safeBlock.length > 1_024) {
      fields.push({
        name: fields.length ? `${continuation} ${name}`.slice(0, 256) : name.slice(0, 256),
        value: batch.join("\n\n").slice(0, 1_024),
        inline: false
      });
      batch = [];
      length = 0;
      if (fields.length >= maximumFields) break;
    }
    batch.push(safeBlock);
    length += separatorLength + safeBlock.length;
  }
  if (batch.length && fields.length < maximumFields) {
    fields.push({
      name: fields.length ? `${continuation} ${name}`.slice(0, 256) : name.slice(0, 256),
      value: batch.join("\n\n").slice(0, 1_024),
      inline: false
    });
  }
  return fields;
}

function compactNameFields(name, values) {
  const lines = [];
  let row = "";
  for (const value of values) {
    const next = row ? `${row} · ${value}` : value;
    if (row && next.length > 900) {
      lines.push(row);
      row = value;
    } else {
      row = next;
    }
  }
  if (row) lines.push(row);
  return fieldChunks(name, lines, { maximumFields: 2 });
}

function normalizedComparison(value) {
  return cleanText(value, 1_000).toLocaleLowerCase()
    .replace(/[^a-z0-9×]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bonusMatchesWindow(value, window) {
  const haystack = normalizedComparison(value);
  const multipliers = String(window?.label || "").match(/\d+×\s*catch\s+(?:xp|stardust)/gi) || [];
  return multipliers.length > 0 && multipliers.every(multiplier => haystack.includes(normalizedComparison(multiplier)));
}

function compactWallClock(date, time = "00:00") {
  const key = bonusWindowKey(date, time);
  if (!Number.isFinite(key)) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(key));
}

function compactBonusFields(event, now = Date.now(), viewerTimeZone = defaultTimeZone(), { includePass = false, itoolsOnly = false } = {}) {
  const windows = Array.isArray(event?.details?.bonusWindows) ? event.details.bonusWindows : [];
  const active = activeBonusWindow(event, now, viewerTimeZone);
  const fields = [];
  const values = (Array.isArray(event?.bonuses) ? event.bonuses : [])
    .filter(value => !isRecurringBreakoutText(value))
    .map(value => compactEventItem(localizeEventText(event, value, viewerTimeZone), { itoolsOnly, maximum: 500 }))
    .filter(Boolean)
    .filter(value => !windows.some(window => bonusMatchesWindow(value, window)))
    .filter(value => includePass || !/\bgo pass\b/i.test(value));
  if (values.length) {
    fields.push(...fieldChunks("🎁 Bonuses", values.map(value => `• **${value}**`), { maximumFields: 2 }));
  }
  if (windows.length) {
    const lines = windows.map(window => {
      const start = compactWallClock(window?.startDate, window?.startTime);
      const end = compactWallClock(window?.endDate, window?.endTime);
      const label = compactEventItem(window?.label, { itoolsOnly, maximum: 400 });
      if (!start || !end || !label) return "";
      const marker = window === active ? "NOW · " : "";
      return `• **${marker}${start} – ${end}:** ${label}`;
    }).filter(Boolean);
    if (lines.length) fields.push(...fieldChunks("📈 Catch bonus schedule · local time", lines, { maximumFields: 2 }));
  }
  return fields;
}

const EVENT_TIME_ZONE_ALIASES = Object.freeze({
  KST: "Asia/Seoul",
  JST: "Asia/Tokyo",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  EST: "America/New_York",
  EDT: "America/New_York",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles"
});
const RECURRING_CLOCK_RANGE_PATTERN = /\b(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s+([A-Z]{2,5})\b/i;

function isRecurringBreakoutText(value) {
  const text = String(value || "");
  return /magikarp|outbreak/i.test(text) && new RegExp(RECURRING_CLOCK_RANGE_PATTERN.source, "i").test(text);
}

function withoutRecurringBreakoutSentence(value) {
  const text = cleanText(value, 1_500);
  if (!text || !isRecurringBreakoutText(text)) return text;
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(sentence => !isRecurringBreakoutText(sentence))
    .join(" ")
    .trim();
}

function twelveHour(hour, period) {
  const numeric = Number(hour);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 12) return NaN;
  const base = numeric % 12;
  return String(period || "").toUpperCase() === "PM" ? base + 12 : base;
}

function localizedRecurringWindow(event, text, viewerTimeZone, occurrenceAt = Date.now()) {
  const match = String(text || "").match(RECURRING_CLOCK_RANGE_PATTERN);
  if (!match) return null;
  const sourceZone = EVENT_TIME_ZONE_ALIASES[String(match[6]).toUpperCase()] || cleanText(event?.timeZone, 100);
  if (!sourceZone) return null;
  const interval = eventInterval(event, sourceZone);
  const requestedAt = Number(occurrenceAt);
  const requestedAnchor = interval
    ? Math.max(interval.startAt, Number.isFinite(requestedAt) ? requestedAt : interval.startAt)
    : eventBoundary(event?.start || event?.end, event, sourceZone);
  const anchorAt = interval && Number.isFinite(interval.endAt)
    ? Math.min(requestedAnchor, Math.max(interval.startAt, interval.endAt - 1))
    : requestedAnchor;
  if (!Number.isFinite(anchorAt)) return null;
  const anchor = dateParts(anchorAt, sourceZone);
  const endHour = twelveHour(match[3], match[5]);
  if (!Number.isFinite(endHour)) return null;
  // The source usually omits AM/PM on the first clock. Choose the latest
  // same-day interpretation that still ends at the stated clock (e.g.
  // 11:00–1:00 PM means 11 AM, while 12:00–12:03 PM means noon).
  const startCandidates = [twelveHour(match[1], "AM"), twelveHour(match[1], "PM")]
    .filter(hour => Number.isFinite(hour) && hour <= endHour);
  const startHour = startCandidates.length ? Math.max(...startCandidates) : twelveHour(match[1], match[5]);
  if (!Number.isFinite(startHour)) return null;
  const startAt = zonedDateTime({ ...anchor, hour: startHour, minute: Number(match[2]) }, sourceZone);
  let endDay = anchor;
  if (endHour < startHour || (endHour === startHour && Number(match[4]) < Number(match[2]))) {
    endDay = addCalendarDays(anchor, 1);
  }
  const endAt = zonedDateTime({ ...endDay, hour: endHour, minute: Number(match[4]) }, sourceZone);
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) return null;
  const format = timestamp => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: viewerTimeZone || defaultTimeZone(),
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
      }).format(new Date(timestamp));
    } catch {
      return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
    }
  };
  const label = cleanText(text.slice(match[0].length).replace(/^\s*[—-]\s*/, ""), 300) || "Magikarp mass outbreak";
  return {
    source: match[0],
    range: `${format(startAt)} – ${format(endAt)}`,
    discordRange: `<t:${Math.floor(startAt / 1_000)}:t> – <t:${Math.floor(endAt / 1_000)}:t>`,
    value: `• ${format(startAt)} – ${format(endAt)} — ${label}`
  };
}

function localizeEventText(event, text, viewerTimeZone, occurrenceAt = Date.now()) {
  const original = String(text || "");
  if (!original) return original;
  const pattern = new RegExp(RECURRING_CLOCK_RANGE_PATTERN.source, "gi");
  return original.replace(pattern, match => localizedRecurringWindow(event, match, viewerTimeZone, occurrenceAt)?.range || match);
}

function recurringBreakoutFields(event, details, viewerTimeZone, occurrenceAt = Date.now()) {
  const rows = [];
  const sections = Array.isArray(details?.sections) ? details.sections : [];
  for (const section of sections) {
    if (!/magikarp|outbreak/i.test(String(section?.title || ""))) continue;
    for (const item of Array.isArray(section?.items) ? section.items : []) rows.push(item);
  }
  if (!rows.length) {
    for (const bonus of Array.isArray(event?.bonuses) ? event.bonuses : []) {
      if (/magikarp|outbreak/i.test(String(bonus || ""))) rows.push(bonus);
    }
  }
  const localized = [];
  const seen = new Set();
  const pattern = new RegExp(RECURRING_CLOCK_RANGE_PATTERN.source, "gi");
  for (const row of rows) {
    const matches = [...String(row || "").matchAll(pattern)];
    for (const match of matches) {
      // A summary sentence can contain all four windows but only publish the
      // first AM/PM + timezone suffix at the end. Parse each clock range as a
      // standalone breakout so the original source wording is never echoed.
      const parsed = localizedRecurringWindow(event, `${match[0]} — Magikarp mass outbreak`, viewerTimeZone, occurrenceAt);
      const key = parsed ? `${parsed.source}|${parsed.discordRange}`.toLowerCase() : "";
      if (parsed && !seen.has(key)) {
        seen.add(key);
        localized.push(parsed);
      }
    }
  }
  if (!localized.length) return [];
  return [{
    name: "Magikarp breakouts — your time",
    value: [
      `Repeats daily during the event in your configured timezone (${viewerTimeZone || defaultTimeZone()}).`,
      ...localized.flatMap(row => [row.value, `  Your time on Discord: ${row.discordRange}`])
    ].join("\n"),
    inline: false
  }];
}

function eventSectionPriority(title) {
  const text = String(title || "").toLowerCase();
  if (/wild|spawn/.test(text)) return 0;
  if (/lure/.test(text)) return 1;
  if (/research/.test(text)) return 2;
  if (/egg|hatch/.test(text)) return 3;
  if (/tier\s*1|one.star/.test(text)) return 4;
  if (/tier\s*3|three.star/.test(text)) return 5;
  if (/raid/.test(text)) return 6;
  if (/battle league|gbl/.test(text)) return 7;
  if (/debut|feature/.test(text)) return 8;
  if (/bonus/.test(text)) return 9;
  if (/go pass|event pass/.test(text)) return 11;
  return 10;
}

function eventSectionIcon(title) {
  const text = String(title || "").toLowerCase();
  if (/wild|spawn/.test(text)) return "🐾";
  if (/lure/.test(text)) return "🌧️";
  if (/research/.test(text)) return "🔎";
  if (/egg|hatch/.test(text)) return "🥚";
  if (/raid|tier\s*[13]/.test(text)) return "⚔️";
  if (/battle league|gbl/.test(text)) return "🏆";
  if (/debut|feature/.test(text)) return "🆕";
  if (/go pass|event pass/.test(text)) return "🎫";
  if (/bonus/.test(text)) return "🎁";
  return "📌";
}

function sectionCovers(details, pattern) {
  return (Array.isArray(details?.sections) ? details.sections : [])
    .some(section => pattern.test(String(section?.title || "")));
}

function eventInformationFields(event, details, viewerTimeZone, { includePass = false, itoolsOnly = false, occurrenceAt = Date.now() } = {}) {
  const recurringBreakouts = recurringBreakoutFields(event, details, viewerTimeZone, occurrenceAt);
  const fields = [...recurringBreakouts];
  const sections = (Array.isArray(details?.sections) ? details.sections : [])
    .map((section, index) => ({ ...section, index }))
    .filter(section => includePass || !/\b(?:go|event) pass\b/i.test(String(section?.title || "")))
    .sort((left, right) => eventSectionPriority(left.title) - eventSectionPriority(right.title) || left.index - right.index);
  const sectionItems = new Set();
  for (const section of sections) {
    const title = cleanText(section?.title, 160);
    if (!title) continue;
    if (recurringBreakouts.length && /magikarp.*outbreak|outbreak.*magikarp/i.test(title)) continue;
    const items = [];
    const seen = new Set();
    for (const item of Array.isArray(section?.items) ? section.items : []) {
      const text = compactEventItem(localizeEventText(event, item, viewerTimeZone, occurrenceAt), { itoolsOnly, maximum: 500 });
      const key = normalizedComparison(text);
      if (!text || !key || seen.has(key)) continue;
      seen.add(key);
      sectionItems.add(key);
      items.push(`• ${text}`);
    }
    if (items.length) fields.push(...fieldChunks(`${eventSectionIcon(title)} ${title}`, items, { maximumFields: 2 }));
  }
  const notes = [];
  const seenNotes = new Set();
  for (const note of Array.isArray(details?.bonusNotes) ? details.bonusNotes : []) {
    const text = compactEventItem(localizeEventText(event, note, viewerTimeZone, occurrenceAt), { itoolsOnly, maximum: 500 });
    const key = normalizedComparison(text);
    if (!text || !key || seenNotes.has(key) || sectionItems.has(key)) continue;
    if (recurringBreakouts.length && /(?:outbreak.*repeat daily|repeat daily.*outbreak)/i.test(text)) continue;
    // A dedicated catch-bonus schedule already states that each window is in
    // local time, so repeating the same note only adds noise.
    if (Array.isArray(details?.bonusWindows) && details.bonusWindows.length && /all .*windows?.*local time/i.test(text)) continue;
    seenNotes.add(key);
    notes.push(`• ${text}`);
  }
  if (notes.length) fields.push(...fieldChunks("ℹ️ Good to know", notes, { maximumFields: 1 }));
  return fields;
}

export function eventCoordinateLinks(value, providers = EVENT_COORDINATE_LINK_PROVIDERS) {
  const match = String(value || "").trim().match(/^([+-]?\d{1,2}(?:\.\d+)?),\s*([+-]?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return "";
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return "";
  const coordinates = `${latitude},${longitude}`;
  const links = {
    velocity: `[Velocity](<https://pk.md/${coordinates}>)`,
    flymego: `[FlyMeGo](<https://fly.mg/coords?ll=${coordinates}>)`,
    google: `[Google](<https://maps.google.com/maps?q=${coordinates}>)`,
    ipogo: `[iPogo](<https://ipogo.app/?coords=${coordinates}>)`,
    spooferpro: `[SpooferPro](<https://spooferpro.com/?deeplink=${coordinates}>)`,
    itools: `[iTools](<https://api.cuno.bot/dl/itools1?type=itoolsbt&latlng=${coordinates}>)`
  };
  const selected = normalizeEventCoordinateLinks(providers).map(provider => links[provider]).filter(Boolean);
  const coordinateLine = `:round_pushpin:\`${latitude}, ${longitude}\``;
  return selected.length ? `${coordinateLine}\n-# ${selected.join(" • ")}` : coordinateLine;
}

function compactElapsed(milliseconds) {
  const totalMinutes = Math.max(0, Math.ceil(Math.abs(Number(milliseconds) || 0) / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return [
    days ? `${days}d` : "",
    hours ? `${hours}h` : "",
    minutes || (!days && !hours) ? `${minutes}m` : ""
  ].filter(Boolean).join(" ");
}

function dayOfLocationInterval(event, timeZone) {
  // Global local-time events use the same wall clock in every region. Force
  // each city through its own IANA zone so DST is calculated by Intl instead
  // of relying on a fixed UTC label copied from a static list. Some upstream
  // feeds append Z or an offset even though `localTime` means the clock value
  // floats from region to region; strip only that suffix for this rollout so
  // Max Monday does not become one simultaneous worldwide instant.
  const floatingBoundary = value => event?.localTime === true
    ? String(value || "").replace(/(?:[zZ]|[+-]\d{2}:\d{2})$/, "")
    : value;
  return eventInterval({
    ...event,
    start: floatingBoundary(event?.start),
    end: floatingBoundary(event?.end),
    timeZone
  }, timeZone);
}

function dayOfLocationTimeLine(event, timeZone, now) {
  const interval = dayOfLocationInterval(event, timeZone);
  if (!interval) return "Time not published";
  const rangeIn = (zone, zoneName) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: zoneName
    });
    const start = formatter.format(new Date(interval.startAt));
    const end = formatter.format(new Date(interval.endAt));
    return start === end ? start : `${start} – ${end}`;
  };
  const start = Math.floor(interval.startAt / 1_000);
  const end = Math.floor(interval.endAt / 1_000);
  const state = now < interval.startAt
    ? `Starts <t:${start}:R>`
    : now < interval.endAt
      ? `Live now; ends <t:${end}:R>`
      : `Ended <t:${end}:R>`;
  return [
    `Local: ${rangeIn(timeZone, "shortOffset")}`,
    `Your time: <t:${start}:F> – <t:${end}:F> · ${state}`
  ].join("\n");
}

function dayOfLocationFields(event, kind, viewerTimeZone, now) {
  if (kind !== "today" || !isDaySpecificGlobalEvent(event, viewerTimeZone, now)) return [];
  const blocks = [];
  if (event?.localTime === true) {
    blocks.push(
      `**First worldwide — London, Kiribati**\n${dayOfLocationTimeLine(event, "Pacific/Kiritimati", now)}`
    );
  }
  for (const location of DAY_OF_EVENT_LOCATIONS) {
    blocks.push(
      `**${location.name}** — \`${location.coordinates}\`\n${dayOfLocationTimeLine(event, location.timeZone, now)}`
    );
  }
  return blockFieldChunks("Day-of location rollout", blocks, {
    continuation: "More",
    // Each row includes native wall-clock time and Discord timestamps that
    // automatically render in each reader's timezone.
    maximumFields: 4
  });
}

function stampRallyGpxFields(event, siteOrigin, { hideSiteBranding = false } = {}) {
  if (hideSiteBranding) return [];
  if (!isMappedMultiStopEvent(event)) return [];
  const venues = eventVenues(event);
  if (!venues.length) return [];
  const eventId = eventDetailId(event);
  const gpxUrl = `${siteOrigin}/api/event-spawns?public=1&format=gpx&id=${encodeURIComponent(eventId)}`;
  const detailUrl = `${siteOrigin}/events?event=${encodeURIComponent(eventId)}`;
  const filename = eventGpxFilename(event);
  return [{
    name: "Mapped stops · iTools-compatible GPX",
    value: [
      `**[Download ${filename} · ${venues.length} stops](${gpxUrl})**`,
      "On iPhone/iPad: download the file, then use **Share / Open In → iToolsGeneral** to import the route.",
      `**[Open the route page · all tools per stop](<${detailUrl}>)**`,
      "Per-stop links: **Velocity · FlyMeGo · Google · iPogo · SpooferPro · iTools**.",
      "The GPX contains only the numbered stop names and coordinates; event details stay on ${siteName()}.",
      /community|unverified|verify/i.test(String(event?.venueNote || ""))
        ? "⚠️ Community-mapped coordinates — verify the in-game stamp stop before traveling or starting a route."
        : ""
    ].filter(Boolean).join("\n"),
    inline: false
  }];
}

function eventFieldCharacters(field) {
  return cleanText(field?.name, 10_000).length + cleanText(field?.value, 10_000).length;
}

function fitEventFields(candidates, essential, fixedCharacters, maximumCharacters = 5_150) {
  const required = (Array.isArray(essential) ? essential : []).filter(Boolean).slice(0, 4);
  const selected = [];
  let characters = fixedCharacters + required.reduce((total, field) => total + eventFieldCharacters(field), 0);
  for (const field of Array.isArray(candidates) ? candidates : []) {
    if (!field || selected.length + required.length >= 24) break;
    const fieldCharacters = eventFieldCharacters(field);
    if (characters + fieldCharacters > maximumCharacters) continue;
    selected.push({
      name: cleanText(field.name, 256),
      value: String(field.value || "").slice(0, 1_024),
      inline: field.inline === true
    });
    characters += fieldCharacters;
  }
  return [...selected, ...required.map(field => ({
    name: cleanText(field.name, 256),
    value: String(field.value || "").slice(0, 1_024),
    inline: field.inline === true
  }))];
}

const AVAILABILITY_SECTIONS = Object.freeze([
  ["raids", "⚔️ Raids"],
  ["research", "🔎 Research"],
  ["hatches", "🥚 Hatches"],
  ["wild", "🐾 Wild encounters"],
  ["featured", "⭐ Featured Pokémon"],
  ["shiny", "✨ Shiny highlights"],
  ["bonuses", "🎁 Bonuses"]
]);

function availabilityItemText(value, maximum = 300) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return cleanText(value, maximum);
  if (typeof value !== "object") return "";
  const name = cleanText(value.name || value.title || value.label || value.text || value.species, 180);
  const source = cleanText(value.source || value.method || value.availability || value.from, 160);
  const reward = cleanText(value.reward, 160);
  const tasks = Array.isArray(value.tasks)
    ? value.tasks.map(task => {
        const taskText = cleanText(task?.text || task?.name || task, 150);
        const taskReward = cleanText(task?.reward, 100);
        return taskText ? `${taskText}${taskReward ? ` → ${taskReward}` : ""}` : "";
      }).filter(Boolean).slice(0, 3)
    : [];
  const rewards = Array.isArray(value.rewards)
    ? value.rewards.map(row => cleanText(row?.text || row, 100)).filter(Boolean).slice(0, 3)
    : [];
  const suffix = [
    source ? `via ${source}` : "",
    reward ? `→ ${reward}` : "",
    tasks.length ? tasks.join(" · ") : "",
    rewards.length ? `Rewards: ${rewards.join(" · ")}` : ""
  ].filter(Boolean).join(" · ");
  return cleanText([name, suffix].filter(Boolean).join(" — "), maximum);
}

function researchAvailabilityRows(details) {
  const research = Array.isArray(details?.research)
    ? details.research
    : details?.research == null ? [] : [details.research];
  const methods = (Array.isArray(details?.researchMethods) ? details.researchMethods : [])
    .map(method => ({
      name: method?.label || method?.type,
      source: method?.label && method?.type ? method.type : "",
      reward: Array.isArray(method?.rewardSpecies)
        ? method.rewardSpecies.map(name => cleanText(name, 100)).filter(Boolean).join(", ")
        : "",
      claimDeadline: typeof method?.claimDeadline === "string" ? method.claimDeadline : "",
      claimDeadlineTimeZone: method?.claimDeadlineTimeZone,
      tasks: method?.tasks,
      instructions: method?.instructions
    }));
  return [...research, ...methods];
}

function explicitBackgroundEligible(event) {
  const details = event?.details && typeof event.details === "object" ? event.details : {};
  return event?.specialBackground === true ||
    event?.background === true ||
    details?.specialBackground === true ||
    details?.backgroundEligible === true;
}

function backgroundPokemonRows(event, backgroundEligible = explicitBackgroundEligible(event)) {
  const details = event?.details && typeof event.details === "object" ? event.details : {};
  const rawRows = [
    event?.backgroundPokemon,
    event?.backgroundSpecies,
    event?.backgroundEligibleSpecies,
    details?.backgroundPokemon,
    details?.backgroundSpecies,
    details?.backgroundEligibleSpecies
  ].flatMap(value => Array.isArray(value) ? value : value == null ? [] : [value]);
  const rows = [];
  const seen = new Set();
  for (const value of rawRows) {
    const name = cleanText(typeof value === "object"
      ? value?.name || value?.species || value?.pokemon || value?.label
      : value, 180);
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      name,
      source: cleanText(typeof value === "object"
        ? value?.source || value?.method || value?.availability || value?.from
        : "", 180)
    });
  }
  // A single named event species is safe to associate with an explicit
  // background flag. Never spread that inference across a multi-Pokémon event.
  if (!rows.length && backgroundEligible && Array.isArray(event?.species) && event.species.length === 1) {
    const name = cleanText(event.species[0], 180);
    if (name) rows.push({ name, source: "event source" });
  }
  return rows.slice(0, 40);
}

function backgroundRowText(row, { bold = false } = {}) {
  const name = cleanText(row?.name, 180);
  const source = cleanText(row?.source, 180);
  const markedName = bold && name ? `${name}\\*\\*` : name;
  return cleanText([markedName, source].filter(Boolean).join(" — "), 300);
}

function backgroundMatchForAvailabilityRow(row, backgroundRows) {
  const text = String(row || "").toLocaleLowerCase();
  return (Array.isArray(backgroundRows) ? backgroundRows : []).find(background => {
    const name = String(background?.name || "").toLocaleLowerCase();
    return name && (text === name || text.startsWith(`${name} —`) || text.startsWith(`${name} `));
  });
}

function boldBackgroundAvailabilityRow(row, backgroundRows) {
  const match = backgroundMatchForAvailabilityRow(row, backgroundRows);
  if (!match) return row;
  const name = String(match.name || "");
  return `${String(row).slice(0, name.length)}\\*\\*${String(row).slice(name.length)}`;
}

function availabilityGuideData(event, { compact = false } = {}) {
  const details = event?.details && typeof event.details === "object" ? event.details : {};
  const rows = new Map(AVAILABILITY_SECTIONS.map(([key]) => [key, []]));
  const seen = new Map(AVAILABILITY_SECTIONS.map(([key]) => [key, new Set()]));
  const add = (key, values) => {
    if (!rows.has(key)) return;
    for (const value of Array.isArray(values) ? values : [values]) {
      const text = availabilityItemText(value);
      const normalized = text.toLocaleLowerCase();
      if (!text || seen.get(key).has(normalized)) continue;
      seen.get(key).add(normalized);
      rows.get(key).push(text);
      if (rows.get(key).length >= 40) break;
    }
  };
  add("raids", details.raidBosses);
  add("research", details.research);
  add("hatches", details.hatches || details.eggs || details.eggHatches || details.hatchPools);
  add("featured", details.featuredPokemon);
  add("wild", details.spawns);
  add("shiny", details.shinies);
  if (!compact) {
    const sectionRows = Array.isArray(details.sections) ? details.sections : [];
    for (const section of sectionRows) {
      const title = String(section?.title || "");
      const text = title.toLocaleLowerCase();
      const items = Array.isArray(section?.items) ? section.items : [];
      if (/raid|max battle|tier\s*[1-6]|mega/.test(text)) add("raids", items);
      else if (/research|quest|task/.test(text)) add("research", items);
      else if (/egg|hatch/.test(text)) add("hatches", items);
      else if (/wild|spawn|incense|lure/.test(text)) add("wild", items);
      else if (/shiny/.test(text)) add("shiny", items);
      else if (/encounter|featured/.test(text)) add("featured", items);
    }
  }
  const category = eventCategory(event);
  if (!rows.get("raids").length && category === "raids") {
    // A raid event's summary species are raid bosses unless the source gave
    // us a more specific typed list above. Never mirror them into Wild.
    add("raids", event?.species);
  } else if (!rows.get("raids").length && !rows.get("wild").length &&
    ["community", "spotlight"].includes(category)) {
    // Community Day and Spotlight Hour are published wild encounter formats;
    // retain their species fallback when the scrape has no spawn rows yet.
    add("wild", event?.species);
  } else if (!["raids", "wild", "hatches", "featured"].some(key => rows.get(key).length)) {
    // A summary species list without a typed source section is useful, but it
    // is not evidence of a wild encounter. Keep it visible without guessing.
    add("featured", event?.species);
  }
  add("bonuses", event?.bonuses);
  add("bonuses", details.bonusNotes);
  add("bonuses", (details.bonusWindows || []).map(row => row?.label || row));
  // Background eligibility is a source assertion, not a text-search result.
  // Every normalized event has a `specialBackground` property (including
  // `false`), so scanning the serialized payload would turn that property
  // name into a false positive for every event. Accept only explicit boolean
  // flags from the event or its structured details, then keep the named
  // Pokémon separate so a background does not appear to apply to every row.
  const backgroundFlag = explicitBackgroundEligible(event);
  const backgroundRows = backgroundPokemonRows(event, backgroundFlag);
  // A background marker is useful only when the source identifies the
  // eligible encounter. Never show a bare marker for a multi-Pokémon event.
  const backgroundEligible = backgroundFlag && backgroundRows.length > 0;
  const displayRows = rows => rows.map(row => boldBackgroundAvailabilityRow(row, backgroundRows));
  return {
    backgroundEligible,
    backgroundRows,
    sections: AVAILABILITY_SECTIONS.map(([key, label]) => ({
      key,
      label,
      rows: displayRows(rows.get(key))
    })).filter(section => section.rows.length)
  };
}

function digestResearchFields(event, details, viewerTimeZone, occurrenceAt) {
  const covered = (Array.isArray(details?.sections) ? details.sections : [])
    .filter(section => /research|quest|task/i.test(String(section?.title || "")))
    .flatMap(section => Array.isArray(section?.items) ? section.items : [])
    .map(item => normalizedComparison(compactEventItem(
      localizeEventText(event, item, viewerTimeZone, occurrenceAt),
      { maximum: 500 }
    )))
    .filter(Boolean);
  const seen = new Set();
  const rows = researchAvailabilityRows(details)
    .map(item => ({
      text: availabilityItemText(item, 800),
      payload: item && typeof item === "object"
        ? availabilityItemText({ ...item, name: "", title: "", label: "", text: "", species: "" }, 800)
        : ""
    }))
    .filter(({ text, payload }) => {
      const key = normalizedComparison(text);
      const payloadKey = normalizedComparison(payload);
      if (!key || seen.has(key) || covered.some(sectionItem =>
        key === sectionItem || (payloadKey && sectionItem.includes(payloadKey))
      )) return false;
      seen.add(key);
      return true;
    })
    .map(({ text }) => `• ${text}`);
  return rows.length ? fieldChunks("🔎 Research", rows, { maximumFields: 2 }) : [];
}

const PREORDER_SECTION_ORDER = Object.freeze(["raids", "wild", "featured", "hatches", "research"]);
const PREORDER_SECTION_LABELS = Object.freeze({
  raids: "Raids",
  wild: "Wild",
  featured: "Featured",
  hatches: "Hatch",
  research: "Research"
});

function preorderEventEmbed(event, {
  viewerTimeZone = defaultTimeZone(),
  now = Date.now()
} = {}) {
  const guide = availabilityGuideData(event, { compact: true });
  const title = cleanText(event?.name, 256);
  const dateLines = discordTimeLines(event, viewerTimeZone);
  const burstLine = regionalLocalSpawnScheduleCardLine(event);
  const description = [
    "**Dates available**",
    ...(dateLines.length ? dateLines : ["Not published"]),
    ...(burstLine ? [`⏱️ ${burstLine}`] : [])
  ].join("\n").slice(0, 4_096);
  const fields = [];
  for (const key of PREORDER_SECTION_ORDER) {
    const section = guide.sections.find(row => row.key === key);
    if (!section?.rows?.length) continue;
    fields.push({
      name: PREORDER_SECTION_LABELS[key],
      value: section.rows.map(row => "- " + row).join("\n").slice(0, 1_024),
      inline: false
    });
  }
  if (guide.backgroundEligible) {
    fields.push({
      name: "Background eligible\\*\\*",
      value: "\u200b",
      inline: false
    });
  }
  const imageUrl = safeEventImage(event?.imageUrl);
  return {
    title,
    description,
    color: guide.backgroundEligible ? 0xf59e0b : 0x22a6b3,
    ...(imageUrl ? { image: { url: imageUrl } } : {}),
    fields: fitEventFields(fields, [], title.length + description.length)
  };
}

export function eventAvailabilityGuideEmbed(event, index, total, {
  coordinateLinks: allowedCoordinateLinks,
  viewerTimeZone = defaultTimeZone(),
  now = Date.now(),
  hideSiteBranding = false,
  preorder = false
} = {}) {
  if (preorder) return preorderEventEmbed(event, { viewerTimeZone, now });
  const detailLink = `${siteUrl()}/events?event=${encodeURIComponent(eventDetailId(event))}`;
  const guide = availabilityGuideData(event);
  const timeLines = discordTimeLines(event, viewerTimeZone);
  const burstLine = regionalLocalSpawnScheduleCardLine(event);
  const description = [
    event?.scope === "global" ? "🌍 **Global event**" : `📍 **${cleanText(event?.location, 240) || "Location-specific event"}**`,
    ...timeLines,
    ...(burstLine ? [`⏱️ ${burstLine}`] : []),
    preorder ? "🛍️ **Preorder window: approximately 5 days before the event starts.**" : "",
    guide.backgroundEligible
      ? `🎨 **Background Pokémon:** ${guide.backgroundRows.length
        ? guide.backgroundRows.map(row => backgroundRowText(row, { bold: true })).join(", ")
        : "the eligible encounter is not named in the source"}`
      : "",
    hideSiteBranding ? "" : `**[Open full event details on ${siteName()}](<${detailLink}>)**`
  ].filter(Boolean).join("\n").slice(0, 4_096);
  const fields = guide.sections.flatMap(section => fieldChunks(section.label, section.rows.map(row => `• ${row}`), { maximumFields: 2 }));
  const coordinates = eventCoordinateLinks(event?.coordinates, allowedCoordinateLinks);
  if (coordinates) fields.push({ name: "📍 Coordinates & tools", value: coordinates, inline: false });
  const footer = hideSiteBranding
    ? `Availability guide · ${index + 1} of ${total}`
    : `${siteName()} Event Availability · ${index + 1} of ${total}`;
  return {
    title: cleanText(event?.name, 256),
    ...(hideSiteBranding ? {} : { url: detailLink }),
    description,
    color: guide.backgroundEligible ? 0xf59e0b : 0x22a6b3,
    ...(safeEventImage(event?.imageUrl) ? { image: { url: safeEventImage(event.imageUrl) } } : {}),
    fields: fitEventFields(fields, [], cleanText(event?.name, 256).length + description.length + footer.length),
    footer: { text: footer },
    timestamp: new Date(now).toISOString()
  };
}

export function availabilityGuideMessages(events, settings, target = {}, now = Date.now()) {
  const rows = Array.isArray(events) ? events : [];
  const embeds = rows.map((event, index) => eventAvailabilityGuideEmbed(event, index, rows.length, {
    coordinateLinks: target.coordinateLinks,
    viewerTimeZone: settings?.timeZone,
    now,
    hideSiteBranding: target.hideSiteBranding === true
  }));
  const batches = eventDigestBatches(embeds, "availability-guide", rows.length, now, {
    deliveryType: target.type,
    hideSiteBranding: target.hideSiteBranding === true
  });
  return batches.map((batch, index) => [
    digestHeading("availability-guide", rows.length, now, index, batches.length, target.type, target.hideSiteBranding === true),
    ...batch
  ]);
}

export function preorderGuideMessages(events, settings, target = {}, now = Date.now()) {
  const rows = Array.isArray(events) ? events : [];
  const embeds = rows.map((event, index) => eventAvailabilityGuideEmbed(event, index, rows.length, {
    coordinateLinks: target.coordinateLinks,
    viewerTimeZone: settings?.timeZone,
    now,
    hideSiteBranding: target.hideSiteBranding === true,
    preorder: true
  }));
  const batches = eventDigestBatches(embeds, "preorder-guide", rows.length, now, {
    deliveryType: target.type,
    hideSiteBranding: target.hideSiteBranding === true
  });
  return batches.map((batch, index) => [
    digestHeading("preorder-guide", rows.length, now, index, batches.length, target.type, target.hideSiteBranding === true),
    ...batch
  ]);
}

function usefulScheduleNote(value) {
  const text = cleanText(value, 500);
  if (!text || /^included because|^active today as/i.test(text)) return "";
  return text;
}

export function eventDigestEmbed(event, index, total, {
  coordinateLinks: allowedCoordinateLinks,
  viewerTimeZone = defaultTimeZone(),
  now = Date.now(),
  kind = "today",
  hideSiteBranding = false
} = {}) {
  const itoolsOnly = itoolsOnlyDestination(allowedCoordinateLinks);
  const includePass = kind === "monthly" || featuredEventKind(event) === "pass";
  const species = (Array.isArray(event?.species) ? event.species : [])
    .map(value => compactEventItem(value, { itoolsOnly, maximum: 80 })).filter(Boolean);
  const imageUrl = safeEventImage(event?.imageUrl);
  const siteOrigin = siteUrl();
  const detailLink = `${siteOrigin}/events?event=${encodeURIComponent(eventDetailId(event))}`;
  const coordinateLinks = eventCoordinateLinks(event?.coordinates, allowedCoordinateLinks);
  const stampRallyGpx = stampRallyGpxFields(event, siteOrigin, { hideSiteBranding });
  const backgroundRows = backgroundPokemonRows(event);
  const featureFlags = [
    backgroundRows.length
      ? `background: ${backgroundRows.map(row => backgroundRowText(row, { bold: true })).join(", ")}`
      : event.specialBackground ? "special/location background" : "",
    event.costumePokemon ? "costume Pokémon" : ""
  ].filter(Boolean);
  const details = event?.details || {};
  const recurringBreakouts = recurringBreakoutFields(event, details, viewerTimeZone, now);
  const rawScheduleNote = recurringBreakouts.length
    ? withoutRecurringBreakoutSentence(event?.scheduleNote)
    : event?.scheduleNote;
  const scheduleNote = usefulScheduleNote(localizeEventText(event, rawScheduleNote, viewerTimeZone, now));
  const battleCategory = eventCategory(event);
  const bossLabel = battleCategory === "max"
    ? "⚡ Max Battle bosses"
    : battleCategory === "raids"
      ? "⚔️ Raid bosses"
      : "⚔️ Featured battles";
  const spawnNames = detailNames(details.spawns, 30, { itoolsOnly });
  const shinyNames = detailNames(details.shinies, 24, { itoolsOnly });
  const bossNames = detailNames(details.raidBosses, 24, { itoolsOnly });
  const gameplayFields = [
    ...(!sectionCovers(details, /wild|spawn/i) && spawnNames.length
      ? compactNameFields("🐾 Wild & featured Pokémon", spawnNames)
      : []),
    ...(!sectionCovers(details, /shiny/i) && shinyNames.length
      ? compactNameFields("✨ Shiny highlights", shinyNames)
      : []),
    ...(!sectionCovers(details, /raid|tier\s*[13]|max battle/i) && bossNames.length
      ? compactNameFields(bossLabel, bossNames)
      : []),
    ...(!spawnNames.length && !bossNames.length && species.length
      ? compactNameFields("🐾 Featured Pokémon", species.slice(0, 30))
      : []),
    ...eventInformationFields(event, details, viewerTimeZone, { includePass, itoolsOnly, occurrenceAt: now }),
    ...compactBonusFields(event, now, viewerTimeZone, { includePass, itoolsOnly })
  ];
  const localLocation = event?.scope === "global" ? "" : [
    cleanText(event.location, 300) || "Location-specific event",
    Number.isFinite(event.distanceKm) ? `${event.distanceKm} km from ${event.locationLabel || "your saved location"}` : "",
    Number(event.venueCount) > 1 ? `${event.venueCount} matching locations` : "",
    event.locationFilterUnavailable ? "regional applicability · no precise distance pin published" : ""
  ].filter(Boolean).join(" · ");
  const description = [
    event?.scope === "global" ? "🌍 **Global event**" : `📍 **${localLocation}**`,
    ...discordTimeLines(event, viewerTimeZone),
    scheduleNote ? `📣 ${scheduleNote}` : "",
    event.ticketRequired ? "🎟️ **Ticket required**" : "",
    featureFlags.length ? `✨ **Highlights:** ${featureFlags.join(" · ")}` : "",
    hideSiteBranding ? "" : `**[Open full details on ${siteName()}](<${detailLink}>)**`
  ].filter(Boolean).join("\n").slice(0, 4_096);
  const footer = {
    text: hideSiteBranding
      ? `Event alert · ${index + 1} of ${total}`
      : `${siteName()} · ${index + 1} of ${total}`
  };
  const essentialFields = [
    ...dayOfLocationFields(event, kind, viewerTimeZone, now),
    ...stampRallyGpx,
    ...(coordinateLinks ? [{ name: "📍 Coordinates & tools", value: coordinateLinks, inline: false }] : [])
  ];
  const fields = fitEventFields(
    gameplayFields,
    essentialFields,
    cleanText(event.name, 256).length + description.length + footer.text.length
  );
  return {
    title: cleanText(event.name, 256),
    // White-label workspaces omit site-owned links as well as visible brand
    // text. Branded event titles continue to open this site's detail page.
    ...(hideSiteBranding ? {} : { url: detailLink }),
    description,
    color: event.specialBackground ? 0x9b59b6 : 0x5865f2,
    ...(imageUrl ? { image: { url: imageUrl } } : {}),
    fields,
    footer
  };
}

function discordEmbedCharacters(embed) {
  return cleanText(embed?.title, 10_000).length +
    cleanText(embed?.description, 10_000).length +
    cleanText(embed?.author?.name, 10_000).length +
    cleanText(embed?.footer?.text, 10_000).length +
    (Array.isArray(embed?.fields) ? embed.fields : []).reduce((total, field) =>
      total + cleanText(field?.name, 10_000).length + cleanText(field?.value, 10_000).length, 0);
}

function digestHeading(
  kind,
  eventCount,
  now,
  batchIndex = 0,
  batchCount = 1,
  deliveryType = "webhook",
  hideSiteBranding = false
) {
  const startingSoon = kind === STARTING_SOON_KIND;
  const preorder = kind === "preorder-guide";
  const matchLabel = deliveryType === "discord-dm"
    ? "match your saved event alert preferences"
    : "match this webhook";
  return {
   title: TITLES[kind],
    ...(hideSiteBranding || preorder ? {} : { url: `${siteUrl()}/events` }),
   description: startingSoon
     ? `**One-time alert** for ${eventCount} short, location-specific event${eventCount === 1 ? "" : "s"}. Scheduled **2 hours 15 minutes before the published start**.${hideSiteBranding ? "" : ` **[Open the full calendar on ${siteName()}](<${siteUrl()}/events>)**`}`
   : preorder
      ? `**${eventCount} upcoming event${eventCount === 1 ? "" : "s"}**`
     : `**${eventCount} event${eventCount === 1 ? "" : "s"}** ${matchLabel}.${hideSiteBranding ? "" : ` **[Open the full calendar on ${siteName()}](<${siteUrl()}/events>)**`}`,
   color: 0x7d3cff,
   ...(preorder ? {} : { timestamp: new Date(now).toISOString() }),
    ...(preorder ? {} : { footer: { text: startingSoon
      ? hideSiteBranding ? "Event alert · One-time alert" : `${siteName()} · One-time alert`
      : batchCount > 1 ? `Digest ${batchIndex + 1} of ${batchCount}`   : hideSiteBranding ? "Event alerts" : siteName() } }),
 };
}

export function eventDigestBatches(embeds, kind, eventCount, now = Date.now(), {
  deliveryType = "webhook",
  hideSiteBranding = false
} = {}) {
  const rows = Array.isArray(embeds) ? embeds.filter(Boolean) : [];
  // Reserve enough heading space before the final batch count is known.
  const headingBudget = discordEmbedCharacters({
    ...digestHeading(kind, eventCount, now, 0, 1, deliveryType, hideSiteBranding),
    footer: { text: "Digest 999 of 999" }
  });
  const batches = [];
  let batch = [];
  let characters = headingBudget;
  for (const embed of rows) {
    const embedCharacters = discordEmbedCharacters(embed);
    const fullByCount = batch.length >= DISCORD_MAX_EMBEDS - 1;
    const fullByCharacters = batch.length > 0 && characters + embedCharacters > DISCORD_MAX_EMBED_CHARACTERS;
    if (fullByCount || fullByCharacters) {
      batches.push(batch);
      batch = [];
      characters = headingBudget;
    }
    batch.push(embed);
    characters += embedCharacters;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export function eventDigestMessages(events, kind, settings, target = {}, now = Date.now()) {
  const rows = Array.isArray(events) ? events : [];
  const embeds = rows.map((event, index) => eventDigestEmbed(event, index, rows.length, {
    coordinateLinks: target.coordinateLinks,
    viewerTimeZone: settings?.timeZone,
    now,
    kind,
    hideSiteBranding: target.hideSiteBranding === true
  }));
  const batches = eventDigestBatches(embeds, kind, rows.length, now, {
    deliveryType: target.type,
    hideSiteBranding: target.hideSiteBranding === true
  });
  return batches.map((batch, index) => [
    digestHeading(kind, rows.length, now, index, batches.length, target.type, target.hideSiteBranding === true),
    ...batch
  ]);
}

// One render per time zone (and event set) per delivery run, shared by every destination.
// The daily post for one destination. `dailyPost` (per webhook, see event-webhooks.js) picks the whole-day review,
// the local-events-only post, or both, so a server can run a separate local-only channel.
// The daily post (graphic + text, and the local-events post) for one time zone. Shared by admin webhooks and
// subscriber webhooks, so everyone gets the same graphic in their own time zone.
export async function dailyReviewParts(calendarEvents, timeZone = defaultTimeZone(), now = Date.now()) {
  const aheadDays = reviewAheadDays(now, timeZone);
  const review = buildDailyReview(calendarEvents, { now, timeZone, aheadDays });
  const daily = await reviewDiscordMessages(dailyReviewText(review), dailyReviewHtml(review), { env: process.env });
  const local = buildLocalReview(calendarEvents, { now, timeZone, aheadDays });
  const localMessages = local
    ? await reviewDiscordMessages(localReviewText(local), localReviewHtml(local), { env: process.env, imageName: "local-events.png", height: 700 })
    : [];
  return { daily, local: localMessages };
}

async function dailyReviewMessagesFor(progress, timeZone, now, dailyPost = "both") {
  progress.dailyReviewCache ||= new Map();
  if (!progress.dailyReviewCache.has(timeZone)) {
    progress.dailyReviewCache.set(timeZone, dailyReviewParts(progress.calendarEvents, timeZone, now));
  }
  const { daily, local } = await progress.dailyReviewCache.get(timeZone);
  if (dailyPost === "daily") return daily;
  if (dailyPost === "local") return local;
  return [...daily, ...local];
}

async function listReviewMessagesFor(progress, kind, events, timeZone, now) {
  progress.listReviewCache ||= new Map();
  const key = `${kind}|${timeZone}|${(events || []).map(event => event?.id || event?.name || "").join(",")}`;
  if (!progress.listReviewCache.has(key)) {
    const window = eventDigestWindow(kind, now, timeZone);
    const review = buildEventListReview(events, kind, { now, timeZone, windowStart: window.startAt });
    progress.listReviewCache.set(key, reviewDiscordMessages(eventListReviewText(review), eventListReviewHtml(review),
      { env: process.env, imageName: kind === "week" ? "week-ahead.png" : "season-go-pass.png", height: 900 }));
  }
  return progress.listReviewCache.get(key);
}

async function deliverDigest(kind, plans, now, progress = {}) {
  const deliveredTargetIds = [];
  const failedDestinations = [];
  let messageCount = 0;
  for (const plan of plans) {
    const target = plan.target;
    const events = plan.events;
    const settings = plan.settings;
    const deliverTarget = async () => {
      try {
        // Discord permits ten embeds and 6,000 combined embed characters per
        // message. Reserve one embed for the heading and split on either limit.
        const messages = progress.messageFactory
          ? progress.messageFactory(events, settings, target, now)
          : kind === "today" && Array.isArray(progress.calendarEvents)
            // 2026-10-30: the daily post is the whole-day review (graphic, then copyable text with dex
            // codes), followed by the Local events only post when a short local event is live. It replaces the
            // per-event cards and the availability guide for Today.
            ? await dailyReviewMessagesFor(progress, settings?.timeZone || defaultTimeZone(), now, target?.dailyPost)
            : (kind === "week" || kind === "monthly") && Array.isArray(progress.calendarEvents)
              // Week ahead and Season & GO Pass in the same style, over the events the digest selected.
              ? await listReviewMessagesFor(progress, kind, events, settings?.timeZone || defaultTimeZone(), now)
              : [
              ...eventDigestMessages(events, kind, settings, target, now),
              // Availability is intentionally a separate Discord message so
              // the existing calendar card stays readable. It is attached to
              // Today only; Week/Weekend/Season digests do not multiply it.
              ...(kind === "today" && target.availabilityGuide
                ? availabilityGuideMessages(events, settings, target, now)
                : [])
            ];
        for (let index = 0; index < messages.length; index += 1) {
          // Batch checkpoints are only an automatic-delivery retry aid. A
          // manual “send now” must always produce a complete fresh digest,
          // even if the same window was already delivered automatically.
          if (progress.automatic && progress.completedBatches?.[target.id]?.[index]) continue;
          const roleId = target.roleMentionKinds?.includes(kind) ? target.roleId : "";
          const sent = await sendEventDigestWebhook(messages[index], target.url, {
            roleId,
            username: target.botName
          });
          if (!sent) throw new Error("Discord webhook URL is unavailable.");
          messageCount += 1;
          if (progress.automatic && progress.stateKey && progress.sentKey) {
            const targetBatches = {
              ...(progress.state.completedBatches?.[progress.sentKey]?.[target.id] || {}),
              [index]: now
            };
            progress.state.completedBatches = {
              ...(progress.state.completedBatches || {}),
              [progress.sentKey]: {
                ...(progress.state.completedBatches?.[progress.sentKey] || {}),
                [target.id]: targetBatches
              }
            };
            await writeJson(progress.stateKey, progress.state);
          }
        }
        deliveredTargetIds.push(target.id);
        await recordEventWebhookDelivery(progress.ownerId || "owner", target.id, { success: true, now });
      } catch (error) {
        failedDestinations.push({ id: target.id, label: target.label, error: String(error?.message || error).slice(0, 200) });
        await recordEventWebhookDelivery(progress.ownerId || "owner", target.id, {
          success: false,
          error: String(error?.message || error),
          now
        }).catch(() => {});
      }
    };

    if (!progress.automatic || !progress.sentKey) {
      await deliverTarget();
      continue;
    }

    // A shared Discord URL can be configured in more than one workspace (or
    // by both the primary and event-webhook settings). Keep one automatic
    // delivery ledger per URL/window so those independent queue jobs cannot
    // post the same digest twice.
    const ledgerKey = automaticDeliveryLedgerKey(target.url, progress.sentKey, events, target, settings);
    try {
      await withRedisLock(`event-digest-target-${ledgerKey.slice(-40)}`, async () => {
        const alreadyDelivered = await readJson(ledgerKey).catch(() => null);
        if (alreadyDelivered?.sentAt) {
          deliveredTargetIds.push(target.id);
          return;
        }
        const deliveredBefore = deliveredTargetIds.length;
        await deliverTarget();
        if (deliveredTargetIds.length > deliveredBefore) {
          await writeJson(ledgerKey, { sentAt: now }).catch(error => {
            console.warn(JSON.stringify({
              event: "event-digest-ledger-write-failed",
              error: String(error?.message || error).slice(0, 200)
            }));
          });
        }
      }, { timeoutMs: 45_000, leaseMs: 10 * 60 * 1_000 });
    } catch (error) {
      failedDestinations.push({ id: target.id, label: target.label, error: String(error?.message || error).slice(0, 200) });
    }
  }
  return { deliveredTargetIds, failedDestinations, messageCount };
}

function digestStateKey(ownerId) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  return cleanId === "owner"
    ? EVENT_DIGEST_STATE_KEY
    : `event:workspace:${cleanId.startsWith("discord:") ? cleanId.slice("discord:".length) : eventWorkspaceStorageSuffix(cleanId)}:digest-notifications`;
}

function digestOwnerLockKey(ownerId) {
  return `event-digest-owner-${normalizeEventWorkspaceOwnerId(ownerId).replace(/[^a-z0-9_-]+/gi, "-")}`;
}

export async function deleteEventNotificationWorkspace(ownerId) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  if (cleanId === "owner") throw new TypeError("The owner webhook workspace cannot be deleted.");
  return deleteJson(digestStateKey(cleanId));
}

function automaticDigestQueueClaimKey(ownerId, kind, localDate) {
  return `${normalizeEventWorkspaceOwnerId(ownerId)}:${String(kind || "").trim().toLowerCase()}:${String(localDate || "").trim()}`;
}

function normalizeStartingSoonSentKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!/^starting-soon:[a-f0-9]{32}$/.test(key)) throw new TypeError("Unknown starting-soon event key.");
  return key;
}

function automaticStartingSoonQueueClaimKey(ownerId, sentKey) {
  return `${normalizeEventWorkspaceOwnerId(ownerId)}:${normalizeStartingSoonSentKey(sentKey)}`;
}

async function releaseAutomaticDigestQueueClaim(ownerId, claimKey, claimedAt) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const cleanClaimKey = String(claimKey || "").trim();
  const expectedPrefix = `${cleanId}:`;
  const expectedClaimedAt = Math.max(0, Number(claimedAt) || 0);
  if (!cleanClaimKey.startsWith(expectedPrefix)) return false;
  return withRedisLock(digestOwnerLockKey(cleanId), async () => {
    const stateKey = digestStateKey(cleanId);
    const state = await readJson(stateKey) || {};
    const queued = { ...(state.queued || {}) };
    if (!Object.prototype.hasOwnProperty.call(queued, cleanClaimKey)) return false;
    // Never let an old/retried queue message clear a newer claim for the same
    // owner/window. New messages carry claimedAt; legacy messages used `now`
    // as that exact persisted value, so both paths remain ownership-safe.
    if (expectedClaimedAt && Number(queued[cleanClaimKey]) !== expectedClaimedAt) return false;
    delete queued[cleanClaimKey];
    await writeJson(stateKey, { ...state, queued, updatedAt: Date.now() });
    return true;
  });
}

async function queuedDigestClaim(message, ownerId, kind) {
  const claimedAt = Math.max(0, Number(message?.claimedAt ?? message?.now) || 0);
  const supplied = String(message?.claimKey || "").trim();
  if (supplied.startsWith(`${ownerId}:${kind}:`)) {
    return { claimKey: supplied, claimedAt };
  }
  const settings = await readEventWorkspaceSettings(ownerId);
  const window = eventDigestWindow(kind, Number(message?.now) || Date.now(), settings.timeZone);
  return { claimKey: automaticDigestQueueClaimKey(ownerId, kind, window.localDate), claimedAt };
}

function queuedStartingSoonClaim(message, ownerId) {
  const sentKey = normalizeStartingSoonSentKey(message?.eventKey);
  const claimedAt = Math.max(0, Number(message?.claimedAt ?? message?.now) || 0);
  const expected = automaticStartingSoonQueueClaimKey(ownerId, sentKey);
  const supplied = String(message?.claimKey || "").trim();
  return { sentKey, claimKey: supplied === expected ? supplied : expected, claimedAt };
}

export async function sendEventDigest(kind, options = {}) {
  if (!KINDS.has(kind)) throw new TypeError("Unknown event digest kind.");
  const automatic = options?.automatic === true;
  if (!automatic) return sendEventDigestOnce(kind, options);
  const ownerId = normalizeEventWorkspaceOwnerId(options?.ownerId || "owner");
  // Cloudflare Queues are at-least-once: a message can be delivered to two
  // consumers, or retried after Discord accepted it but before the ack. Keep
  // automatic delivery for an owner/kind serialized so the second attempt
  // observes the persisted sent/delivered checkpoint instead of posting again.
  return withRedisLock(
    digestOwnerLockKey(ownerId),
    () => sendEventDigestOnce(kind, { ...options, ownerId }),
    { timeoutMs: 45_000, leaseMs: 10 * 60 * 1_000 }
  );
}

export async function sendEventAvailabilityGuide(options = {}) {
  const automatic = options?.automatic === true;
  const ownerId = normalizeEventWorkspaceOwnerId(options?.ownerId || "owner");
  const run = () => sendEventAvailabilityGuideOnce({
    ...options,
    ownerId,
    automatic
  });
  return automatic
    ? withRedisLock(digestOwnerLockKey(ownerId), run, { timeoutMs: 45_000, leaseMs: 10 * 60 * 1_000 })
    : run();
}

function preorderGuideSentKey(event, settings) {
  const identity = cleanText(eventDetailId(event) || event?.id || event?.name, 240) || "event";
  const timeZone = cleanText(settings?.timeZone || defaultTimeZone(), 100);
  return `preorder-guide:${identity}:${timeZone}`;
}

// One preorder card belongs to one event, even when its gameplay occurs in
// several timezones or on several days. An event's published ID is the stable
// identity; eventDetailId supplies a fallback when no ID is available.
export function preorderDestinationSentKey(url, event) {
  const destination = normalizeDiscordWebhookUrl(url);
  const identity = cleanText(eventDetailId(event), 240).toLowerCase();
  return `event:preorder-delivery:${createHash("sha256").update(`${destination}|${identity}`).digest("hex")}`;
}

export async function sendEventPreorderGuide(options = {}) {
  const automatic = options?.automatic === true;
  const ownerId = normalizeEventWorkspaceOwnerId(options?.ownerId || "owner");
  const run = () => sendEventPreorderGuideOnce({
    ...options,
    ownerId,
    automatic
  });
  return withRedisLock(digestOwnerLockKey(ownerId), run, { timeoutMs: 45_000, leaseMs: 10 * 60 * 1_000 });
}

async function sendEventPreorderGuideOnce({
  now = Date.now(),
  automatic = false,
  ownerId = "owner",
  eventPayload = null
} = {}) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const settings = await readEventWorkspaceSettings(cleanId);
  const payload = eventPayload || await fetchEventSpawns({ now });
  if (automatic && payload?.stale === true) {
    throw new Error("Event sources are degraded; the preorder card will retry.");
  }
  const targets = await eventWebhookPreorderDeliveryTargets(cleanId, settings);
  if (!targets.length) {
    return { kind: "preorder-guide", automatic, sent: false, skipped: true, reason: "no-destinations", eventCount: 0, destinationCount: 0, messageCount: 0, failedDestinations: [] };
  }
  const targetPlans = targets.map(target => ({
    target,
    settings: settingsForWebhookDestination(settings, target, cleanId, now)
  })).map(plan => ({
    ...plan,
    events: eventsForPreorderGuide(payload?.calendarEvents, now, plan.settings)
  }));
  const eventIds = new Set(targetPlans.flatMap(plan => plan.events.map(event => eventDetailId(event) || event?.id || event?.name || "")));
  const eventCount = eventIds.size;
  const plansWithEvents = targetPlans.filter(plan => plan.events.length);
  if (!plansWithEvents.length) {
    return { kind: "preorder-guide", automatic, sent: false, alreadySent: false, eventCount: 0, destinationCount: 0, messageCount: 0, failedDestinations: [] };
  }

  const stateKey = digestStateKey(cleanId);
  const state = await readJson(stateKey) || {};
  const deliveredTargetIds = new Set();
  const failedDestinations = [];
  let messageCount = 0;
  let pendingCount = 0;
  let sentEventCount = 0;
  for (const plan of plansWithEvents) {
    // Hold a URL-level lock across the pending check and post. This prevents
    // the same dedicated webhook in another workspace from posting the card.
    const urlHash = createHash("sha256").update(normalizeDiscordWebhookUrl(plan.target.url)).digest("hex").slice(0, 40);
    await withRedisLock(`event-preorder-target-${urlHash}`, async () => {
      const pending = [];
      for (const event of plan.events) {
        const ownerKey = preorderGuideSentKey(event, plan.settings);
        const destinationKey = preorderDestinationSentKey(plan.target.url, event);
        const legacyPrefix = `preorder-guide:${cleanText(eventDetailId(event), 240)}:`;
        const previouslySent = state.delivered?.[ownerKey]?.[plan.target.id] ||
          Object.entries(state.delivered || {}).some(([key, targets]) => key.startsWith(legacyPrefix) && targets?.[plan.target.id]);
        if (previouslySent) {
          // Preserve an older successful owner's checkpoint when upgrading to
          // the shared destination ledger.
          if (!await readJson(destinationKey)) await writeJson(destinationKey, { sentAt: now });
          continue;
        }
        if (await readJson(destinationKey)) continue;
        pending.push({ event, ownerKey, destinationKey });
      }
      if (!pending.length) return;
      pendingCount += pending.length;
      const sentKey = `preorder-guide:batch:${createHash("sha256")
        .update(pending.map(row => row.destinationKey).join("|"))
        .digest("hex")}`;
      const delivery = await deliverDigest("preorder-guide", [{ ...plan, events: pending.map(row => row.event) }], now, {
        automatic: true,
        ownerId: cleanId,
        stateKey,
        sentKey,
        state,
        completedBatches: state.completedBatches?.[sentKey] || {},
        messageFactory: preorderGuideMessages
      });
      if (delivery.deliveredTargetIds.includes(plan.target.id)) {
        deliveredTargetIds.add(plan.target.id);
        messageCount += delivery.messageCount;
        sentEventCount += pending.length;
        for (const row of pending) {
          await writeJson(row.destinationKey, { sentAt: now });
          state.delivered = {
            ...(state.delivered || {}),
            [row.ownerKey]: { ...(state.delivered?.[row.ownerKey] || {}), [plan.target.id]: now }
          };
        }
        state.delivered = Object.fromEntries(Object.entries(state.delivered).slice(-240));
        state.lastKind = "preorder-guide";
        state.lastSentAt = now;
        state.updatedAt = now;
        await writeJson(stateKey, state);
      }
      failedDestinations.push(...delivery.failedDestinations);
    }, { timeoutMs: 45_000, leaseMs: 10 * 60 * 1_000 });
  }
  if (!deliveredTargetIds.size && failedDestinations.length) {
    const reason = failedDestinations.map(row => `${row.label}: ${row.error}`).join("; ");
    throw new Error(reason || "Discord rejected every preorder card delivery.");
  }
  if (failedDestinations.length) {
    const reason = failedDestinations.map(row => `${row.label}: ${row.error}`).join("; ");
    throw new Error(`Preorder card partially delivered; retrying failed destinations. ${reason}`.trim());
  }
  return {
    kind: "preorder-guide",
    automatic,
    sent: deliveredTargetIds.size > 0,
    alreadySent: pendingCount === 0,
    eventCount,
    sentEventCount,
    destinationCount: deliveredTargetIds.size,
    messageCount,
    failedDestinations
  };
}

async function sendEventAvailabilityGuideOnce({
  now = Date.now(),
  automatic = false,
  ownerId = "owner",
  eventPayload = null
} = {}) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const settings = await readEventWorkspaceSettings(cleanId);
  const payload = eventPayload || await fetchEventSpawns({ now });
  if (automatic && payload?.stale === true) {
    throw new Error("Event sources are degraded; the availability guide will retry.");
  }
  const targets = (await eventWebhookAvailabilityDeliveryTargets(cleanId, settings))
    // A Today digest already carries the guide for that same destination.
    // Automatic standalone delivery is only for guide-only destinations.
    .filter(target => !automatic || !target.digestKinds.includes("today"));
  if (!targets.length) {
    return { kind: "availability-guide", automatic, sent: false, skipped: true, reason: "no-destinations", eventCount: 0, destinationCount: 0, messageCount: 0, failedDestinations: [] };
  }
  const targetPlans = targets.map(target => ({
    target,
    settings: settingsForWebhookDestination(settings, target, cleanId, now)
  })).map(plan => ({
    ...plan,
    events: eventsForDigest(payload?.calendarEvents, "today", now, plan.settings)
  }));
  const eventIds = new Set(targetPlans.flatMap(plan => plan.events.map(event => event?.id || event?.name || "")));
  const eventCount = eventIds.size;
  const window = eventDigestWindow("today", now, settings.timeZone);
  const stateKey = digestStateKey(cleanId);
  const state = await readJson(stateKey) || {};
  const sentKey = `availability-guide:${window.localDate}`;
  const previouslyDelivered = new Set(Object.keys(state.delivered?.[sentKey] || {}));
  const plansWithEvents = targetPlans.filter(plan => plan.events.length);
  const pendingPlans = automatic
    ? plansWithEvents.filter(plan => !previouslyDelivered.has(plan.target.id))
    : plansWithEvents;
  if (automatic && !pendingPlans.length) {
    return { kind: "availability-guide", automatic, sent: false, alreadySent: true, eventCount, destinationCount: 0, messageCount: 0, failedDestinations: [] };
  }
  if (!plansWithEvents.length) {
    if (automatic) {
      const delivered = { ...(state.delivered || {}), [sentKey]: Object.fromEntries(targets.map(target => [target.id, now])) };
      await writeJson(stateKey, { ...state, delivered, sent: { ...(state.sent || {}), [sentKey]: now }, lastKind: "availability-guide", lastSentAt: now, updatedAt: now });
    }
    return { kind: "availability-guide", automatic, sent: false, alreadySent: false, eventCount: 0, destinationCount: 0, messageCount: 0, failedDestinations: [] };
  }
  const completedBatches = state.completedBatches?.[sentKey] || {};
  const delivery = await deliverDigest("availability-guide", pendingPlans, now, {
    automatic,
    ownerId: cleanId,
    stateKey,
    sentKey,
    state,
    completedBatches,
    messageFactory: availabilityGuideMessages
  });
  if (!delivery.deliveredTargetIds.length) {
    const reason = delivery.failedDestinations.map(row => `${row.label}: ${row.error}`).join("; ");
    throw new Error(reason || "Discord rejected every event availability guide delivery.");
  }
  if (automatic) {
    const sentForWindow = { ...(state.delivered?.[sentKey] || {}) };
    for (const plan of targetPlans.filter(plan => !plan.events.length)) sentForWindow[plan.target.id] = now;
    for (const targetId of delivery.deliveredTargetIds) sentForWindow[targetId] = now;
    const delivered = { ...(state.delivered || {}), [sentKey]: sentForWindow };
    const allDelivered = targets.every(target => sentForWindow[target.id]);
    const sent = { ...(state.sent || {}) };
    if (allDelivered) sent[sentKey] = now;
    await writeJson(stateKey, {
      ...state,
      sent: Object.fromEntries(Object.entries(sent).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 120)),
      delivered: Object.fromEntries(Object.entries(delivered).slice(-120)),
      completedBatches: Object.fromEntries(Object.entries(state.completedBatches || {}).slice(-120)),
      lastKind: "availability-guide",
      lastSentAt: now,
      updatedAt: now
    });
    if (delivery.failedDestinations.length) {
      const reason = delivery.failedDestinations.map(row => `${row.label}: ${row.error}`).join("; ");
      throw new Error(`Availability guide partially delivered; retrying failed destinations. ${reason}`.trim());
    }
  }
  return {
    kind: "availability-guide",
    automatic,
    sent: true,
    alreadySent: false,
    eventCount,
    destinationCount: delivery.deliveredTargetIds.length,
    messageCount: delivery.messageCount,
    failedDestinations: delivery.failedDestinations
  };
}

async function sendEventDigestOnce(kind, { now = Date.now(), automatic = false, ownerId = "owner" } = {}) {
  if (!KINDS.has(kind)) throw new TypeError("Unknown event digest kind.");
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const settings = await readEventWorkspaceSettings(cleanId);
  // Manual delivery should be fast and deterministic: use the same prepared
  // event snapshot shown on the site. Upstream discovery is refreshed by the
  // scheduled collector or the explicit administrator refresh action instead
  // of making every button press fan out to all event sources.
  const payload = await fetchEventSpawns({ now, refreshResearchDetails: automatic });
  if (automatic && payload?.stale === true) {
    const age = Number(payload.sourceFetchedAt) > 0
      ? Math.max(0, now - Number(payload.sourceFetchedAt))
      : null;
    const ageLabel = age == null ? "no last-good primary snapshot" : `last-good snapshot is ${compactElapsed(age)} old`;
    // Do not permanently checkpoint a partial/curated-only automatic digest.
    // Queue retry will deliver the complete snapshot once discovery recovers;
    // manual sends remain available for an administrator who chooses to send
    // the visibly prepared fallback.
    throw new Error(`Event sources are degraded (${ageLabel}); automatic digest will retry.`);
  }
  const targets = await eventWebhookDeliveryTargets(cleanId, kind, settings);
  if (!targets.length) throw new Error("No Discord webhook is assigned to this digest in this workspace.");
  const targetPlans = targets.map(target => ({
    target,
    settings: settingsForWebhookDestination(settings, target, cleanId, now)
  })).map(plan => ({
    ...plan,
    events: eventsForDigest(payload.calendarEvents, kind, now, plan.settings)
  }));
  const eventIds = new Set(targetPlans.flatMap(plan => plan.events.map(event => event?.id || event?.name || "")));
  const eventCount = eventIds.size;
  const window = eventDigestWindow(kind, now, settings.timeZone);
  const stateKey = digestStateKey(cleanId);
  const state = await readJson(stateKey) || {};
  const sentKey = `${kind}:${window.localDate}`;
  const previouslyDelivered = new Set(Object.keys(state.delivered?.[sentKey] || {}));
  const plansWithEvents = targetPlans.filter(plan => plan.events.length);
  const pendingPlans = automatic
    ? plansWithEvents.filter(plan => !previouslyDelivered.has(plan.target.id))
    : plansWithEvents;
  if (automatic && !pendingPlans.length) {
    return { kind, automatic, sent: false, alreadySent: true, eventCount, destinationCount: 0, messageCount: 0, failedDestinations: [] };
  }
  if (!plansWithEvents.length) {
    if (automatic) {
      const delivered = { ...(state.delivered || {}), [sentKey]: Object.fromEntries(targets.map(target => [target.id, now])) };
      await writeJson(stateKey, { ...state, delivered, sent: { ...(state.sent || {}), [sentKey]: now }, lastKind: kind, lastSentAt: now, updatedAt: now });
    }
    return { kind, automatic, sent: false, alreadySent: false, eventCount: 0, destinationCount: 0, messageCount: 0, failedDestinations: [] };
  }
  const completedBatches = state.completedBatches?.[sentKey] || {};
  const delivery = await deliverDigest(kind, pendingPlans, now, {
    automatic,
    calendarEvents: payload.calendarEvents,
    ownerId: cleanId,
    stateKey,
    sentKey,
    state,
    completedBatches
  });
  if (!delivery.deliveredTargetIds.length) {
    const reason = delivery.failedDestinations.map(row => `${row.label}: ${row.error}`).join("; ");
    throw new Error(reason || "Discord rejected every event digest delivery.");
  }
  if (automatic) {
    const sentForWindow = { ...(state.delivered?.[sentKey] || {}) };
    for (const plan of targetPlans.filter(plan => !plan.events.length)) sentForWindow[plan.target.id] = now;
    for (const targetId of delivery.deliveredTargetIds) sentForWindow[targetId] = now;
    const delivered = { ...(state.delivered || {}), [sentKey]: sentForWindow };
    const allDelivered = targets.every(target => sentForWindow[target.id]);
    const sent = { ...(state.sent || {}) };
    if (allDelivered) sent[sentKey] = now;
    const recentSent = Object.fromEntries(Object.entries(sent).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 120));
    await writeJson(stateKey, {
      // Preserve the Queue lease and unrelated digest state. A partial
      // destination failure intentionally throws after this checkpoint; if
      // `queued` were omitted here the failed attempt would silently release
      // its own claim before Cloudflare retries it.
      ...state,
      sent: recentSent,
      delivered: Object.fromEntries(Object.entries(delivered).slice(-120)),
      completedBatches: Object.fromEntries(Object.entries(state.completedBatches || {}).slice(-120)),
      lastKind: kind,
      lastSentAt: now,
      updatedAt: now
    });
    if (delivery.failedDestinations.length) {
      const reason = delivery.failedDestinations.map(row => `${row.label}: ${row.error}`).join("; ");
      // Successful destinations are checkpointed above. Fail the queue item
      // after that write so its retry targets only the missing destinations;
      // the consumer will retain the queue claim until all targets complete.
      throw new Error(`Event digest partially delivered; retrying failed destinations. ${reason}`.trim());
    }
  }
  return {
    kind,
    automatic,
    sent: true,
    alreadySent: false,
    eventCount,
    destinationCount: delivery.deliveredTargetIds.length,
    messageCount: delivery.messageCount,
    failedDestinations: delivery.failedDestinations
  };
}

export async function sendLocalStartingSoonAlert({ now = Date.now(), ownerId = "owner", eventKey = "" } = {}) {
  const cleanId = normalizeEventWorkspaceOwnerId(ownerId);
  const sentKey = normalizeStartingSoonSentKey(eventKey);
  return withRedisLock(
    digestOwnerLockKey(cleanId),
    async () => {
      const settings = await readEventWorkspaceSettings(cleanId);
      if (settings.schedules?.startingSoon?.enabled !== true) {
        return { kind: STARTING_SOON_KIND, automatic: true, sent: false, skipped: true, reason: "disabled" };
      }
      const payload = await fetchEventSpawns({ now });
      if (payload?.stale === true) throw new Error("Event sources are degraded; the starting-soon alert will retry.");
      const event = (Array.isArray(payload?.calendarEvents) ? payload.calendarEvents : [])
        .flatMap(eventGameplayOccurrences)
        .find(row => startingSoonEventSentKey(row) === sentKey);
      if (!event) {
        return { kind: STARTING_SOON_KIND, automatic: true, sent: false, skipped: true, reason: "event-removed-or-rescheduled" };
      }
      const targets = await eventWebhookDeliveryTargets(cleanId, STARTING_SOON_KIND, settings);
      if (!targets.length) {
        return { kind: STARTING_SOON_KIND, automatic: true, sent: false, skipped: true, reason: "no-destinations" };
      }
      const targetPlans = targets.map(target => ({
        target,
        settings: settingsForWebhookDestination(settings, target, cleanId, now)
      })).map(plan => ({
        ...plan,
        events: eventsForLocalStartingSoon([event], now, plan.settings)
      }));
      const stateKey = digestStateKey(cleanId);
      const state = await readJson(stateKey) || {};
      const previouslyDelivered = new Set(Object.keys(state.delivered?.[sentKey] || {}));
      const plansWithEvents = targetPlans.filter(plan => plan.events.length);
      const pendingPlans = plansWithEvents.filter(plan => !previouslyDelivered.has(plan.target.id));
      if (!pendingPlans.length && plansWithEvents.length) {
        return {
          kind: STARTING_SOON_KIND, automatic: true, sent: false, alreadySent: true,
          eventCount: 1, destinationCount: 0, messageCount: 0, failedDestinations: []
        };
      }
      if (!plansWithEvents.length) {
        const sentAt = Date.now();
        const delivered = { ...(state.delivered || {}), [sentKey]: Object.fromEntries(targets.map(target => [target.id, sentAt])) };
        await writeJson(stateKey, {
          ...state,
          delivered,
          sent: { ...(state.sent || {}), [sentKey]: sentAt },
          lastKind: STARTING_SOON_KIND,
          lastSentAt: sentAt,
          updatedAt: sentAt
        });
        return {
          kind: STARTING_SOON_KIND, automatic: true, sent: false, alreadySent: false,
          eventCount: 0, destinationCount: 0, messageCount: 0, failedDestinations: []
        };
      }
      const completedBatches = state.completedBatches?.[sentKey] || {};
      const delivery = await deliverDigest(STARTING_SOON_KIND, pendingPlans, now, {
        automatic: true,
        ownerId: cleanId,
        stateKey,
        sentKey,
        state,
        completedBatches
      });
      if (!delivery.deliveredTargetIds.length) {
        const reason = delivery.failedDestinations.map(row => `${row.label}: ${row.error}`).join("; ");
        throw new Error(reason || "Discord rejected every starting-soon delivery.");
      }
      const sentAt = Date.now();
      const sentForEvent = { ...(state.delivered?.[sentKey] || {}) };
      for (const plan of targetPlans.filter(plan => !plan.events.length)) sentForEvent[plan.target.id] = sentAt;
      for (const targetId of delivery.deliveredTargetIds) sentForEvent[targetId] = sentAt;
      const delivered = { ...(state.delivered || {}), [sentKey]: sentForEvent };
      const allDelivered = targets.every(target => sentForEvent[target.id]);
      const sent = { ...(state.sent || {}) };
      if (allDelivered) sent[sentKey] = sentAt;
      await writeJson(stateKey, {
        ...state,
        sent: Object.fromEntries(Object.entries(sent).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 120)),
        delivered: Object.fromEntries(Object.entries(delivered).slice(-120)),
        completedBatches: Object.fromEntries(Object.entries(state.completedBatches || {}).slice(-120)),
        lastKind: STARTING_SOON_KIND,
        lastSentAt: sentAt,
        updatedAt: sentAt
      });
      if (delivery.failedDestinations.length) {
        const reason = delivery.failedDestinations.map(row => `${row.label}: ${row.error}`).join("; ");
        throw new Error(`Starting-soon alert partially delivered; retrying failed destinations. ${reason}`.trim());
      }
      return {
        kind: STARTING_SOON_KIND,
        automatic: true,
        sent: true,
        alreadySent: false,
        eventCount: 1,
        destinationCount: delivery.deliveredTargetIds.length,
        messageCount: delivery.messageCount,
        failedDestinations: delivery.failedDestinations
      };
    },
    { timeoutMs: 45_000, leaseMs: 10 * 60 * 1_000 }
  );
}

export function automaticDigestRuns(now = Date.now(), rawSettings = {}) {
  const settings = normalizeEventWorkspaceSettings(rawSettings, rawSettings?.ownerId || "owner", now);
  const local = dateParts(now, settings.timeZone);
  const localMinute = local.hour * 60 + local.minute;
  const runs = [];
  for (const kind of EVENT_DIGEST_KINDS) {
    const schedule = settings.schedules[kind];
    if (!schedule.enabled) continue;
    // 2026-10-30: the weekend post is retired; daily, week ahead and season/GO Pass remain.
    if (kind === "weekend") continue;
    const [hour, minute] = schedule.time.split(":").map(Number);
    const scheduledMinute = hour * 60 + minute;
    // Once today's requested wall time has passed, keep the run eligible for
    // the rest of that calendar day. Persisted owner/window claims make this
    // idempotent, while a delayed cron or a DST spring-forward gap can still
    // catch up instead of losing the notification forever.
    let crossedMidnight = false;
    if (localMinute < scheduledMinute) {
      // Preserve the intended previous-day claim for settings in the final
      // five minutes of a day when the five-minute cron observes them just
      // after midnight.
      crossedMidnight = scheduledMinute >= 24 * 60 - 5 && localMinute < 5;
      if (!crossedMidnight) continue;
    }
    const scheduledWeekday = crossedMidnight ? (local.weekdayIndex + 6) % 7 : local.weekdayIndex;
    if (kind !== "today" && kind !== "monthly" && schedule.weekday !== scheduledWeekday) continue;
    const scheduledDate = crossedMidnight
      ? addCalendarDays({ year: local.year, month: local.month, day: local.day }, -1)
      : { year: local.year, month: local.month, day: local.day };
    const scheduledAt = zonedDateTime({ ...scheduledDate, hour, minute }, settings.timeZone);
    runs.push({
      kind,
      scheduledAt,
      // An afternoon/evening daily is the next day's post (see eventDigestWindow).
      localDate: kind === "today" && hour >= 12
        ? dateParts(zonedDateTime(addCalendarDays(scheduledDate, 1), settings.timeZone), settings.timeZone).date
        : dateParts(scheduledAt, settings.timeZone).date
    });
  }
  return runs;
}

export function automaticDigestKinds(now = Date.now(), rawSettings = {}) {
  return automaticDigestRuns(now, rawSettings).map(run => run.kind);
}

export async function eligibleAutomaticEventWorkspaceOwners() {
  const [registered, access] = await Promise.all([listEventWorkspaceOwners(), readAccessConfig()]);
  // Enabling a whitelist row is not an Events grant. Respect revocation here
  // so a user retaining Automation/Daily or Live Battles cannot keep scheduled
  // webhook work alive after Events is turned off.
  const enabled = new Set(access.users
    .filter(user => user.enabled && user.events !== false)
    .map(user => `discord:${user.discordId}`));
  return registered.filter(ownerId => ownerId === "owner" || ownerId.startsWith("managed:") || enabled.has(ownerId));
}

async function runAutomaticStartingSoonAlerts(now, workspaces, queue, eventPayload = null) {
  const enabled = workspaces.filter(row => row.settings.schedules?.startingSoon?.enabled === true);
  if (!enabled.length) return [];
  const payload = eventPayload || await fetchEventSpawns({ now });
  const calendarEvents = Array.isArray(payload?.calendarEvents) ? payload.calendarEvents : [];
  const results = [];
  for (const { ownerId, settings } of enabled) {
    try {
      const targets = await eventWebhookTargets(ownerId, STARTING_SOON_KIND);
      if (!targets.length) continue;
      const dueEvents = new Map();
      for (const target of targets) {
        const targetSettings = settingsForWebhookDestination(settings, target, ownerId, now);
        for (const event of eventsForLocalStartingSoon(calendarEvents, now, targetSettings)) {
          const sentKey = startingSoonEventSentKey(event);
          if (sentKey) dueEvents.set(sentKey, event);
        }
      }
      for (const [sentKey, event] of dueEvents) {
        try {
          const interval = eventInterval(event, event?.timeZone || settings.timeZone);
          const eventStartAt = interval?.startAt;
          if (!Number.isFinite(eventStartAt) || now >= eventStartAt) continue;
          if (queue?.send) {
            const claimKey = automaticStartingSoonQueueClaimKey(ownerId, sentKey);
            const claimed = await withRedisLock(digestOwnerLockKey(ownerId), async () => {
              const state = await readJson(digestStateKey(ownerId)) || {};
              const queuedAt = Number(state.queued?.[claimKey]) || 0;
              if (state.sent?.[sentKey] || (queuedAt && now - queuedAt < STARTING_SOON_QUEUE_LEASE_MS)) return false;
              state.queued = {
                ...Object.fromEntries(Object.entries(state.queued || {}).filter(([key, at]) => {
                  const maximumAge = key.includes(`:${STARTING_SOON_KIND}:`)
                    ? STARTING_SOON_QUEUE_LEASE_MS
                    : 24 * 60 * 60 * 1_000;
                  return now - Number(at) < maximumAge;
                })),
                [claimKey]: now
              };
              state.updatedAt = now;
              await writeJson(digestStateKey(ownerId), state);
              return true;
            });
            if (!claimed) {
              results.push({ ownerId, kind: STARTING_SOON_KIND, eventKey: sentKey, automatic: true, queued: false, alreadyQueued: true });
              continue;
            }
            try {
              await queue.send({
                type: "event-starting-soon",
                ownerId,
                eventKey: sentKey,
                eventStartAt,
                now,
                claimKey,
                claimedAt: now
              });
            } catch (error) {
              await releaseAutomaticDigestQueueClaim(ownerId, claimKey, now).catch(() => {});
              throw error;
            }
            results.push({ ownerId, kind: STARTING_SOON_KIND, eventKey: sentKey, automatic: true, queued: true });
          } else {
            results.push({ ownerId, ...(await sendLocalStartingSoonAlert({ now, ownerId, eventKey: sentKey })) });
          }
        } catch (error) {
          console.error(JSON.stringify({
            event: "automatic-local-starting-soon-failed",
            owner: ownerId === "owner" ? "owner" : "discord-workspace",
            error: String(error?.message || error).slice(0, 300)
          }));
          results.push({ ownerId, kind: STARTING_SOON_KIND, automatic: true, sent: false, error: String(error?.message || error) });
        }
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: "automatic-local-starting-soon-workspace-failed",
        owner: ownerId === "owner" ? "owner" : "discord-workspace",
        error: String(error?.message || error).slice(0, 300)
      }));
      results.push({ ownerId, kind: STARTING_SOON_KIND, automatic: true, sent: false, error: String(error?.message || error) });
    }
  }
  return results;
}

export async function runAutomaticEventDigests(now = Date.now(), { eventPayload = null } = {}) {
  const results = [];
  const owners = await eligibleAutomaticEventWorkspaceOwners();
  const queue = runtimeBinding("EVENT_NOTIFICATION_QUEUE");
  const workspaces = [];
  for (const ownerId of owners) {
    let settings;
    try {
      settings = await readEventWorkspaceSettings(ownerId);
    } catch (error) {
      console.error(JSON.stringify({
        event: "automatic-event-settings-failed",
        owner: ownerId === "owner" ? "owner" : "discord-workspace",
        error: String(error?.message || error).slice(0, 300)
      }));
      continue;
    }
    workspaces.push({ ownerId, settings });
    const scheduledRuns = automaticDigestRuns(now, settings);
    for (const run of scheduledRuns) {
      const { kind, scheduledAt } = run;
      try {
        if (queue?.send) {
          const window = eventDigestWindow(kind, scheduledAt, settings.timeZone);
          const claimKey = automaticDigestQueueClaimKey(ownerId, kind, window.localDate);
          const claimed = await withRedisLock(digestOwnerLockKey(ownerId), async () => {
            const state = await readJson(digestStateKey(ownerId)) || {};
            if (state.sent?.[`${kind}:${window.localDate}`] || state.queued?.[claimKey]) return false;
            state.queued = {
              ...Object.fromEntries(Object.entries(state.queued || {}).filter(([, at]) => now - Number(at) < 24 * 60 * 60 * 1000)),
              [claimKey]: now
            };
            state.updatedAt = now;
            await writeJson(digestStateKey(ownerId), state);
            return true;
          });
          if (claimed) {
            try {
              await queue.send({ type: "event-digest", ownerId, kind, now: scheduledAt, claimKey, claimedAt: now });
            } catch (error) {
              // The queue marker is a lease, not a 24-hour sent checkpoint. If
              // enqueue itself failed, roll it back immediately so the next
              // cron can retry instead of silently suppressing the digest.
              await releaseAutomaticDigestQueueClaim(ownerId, claimKey, now).catch(releaseError => {
                console.error(JSON.stringify({
                  event: "automatic-event-queue-claim-release-failed",
                  owner: ownerId === "owner" ? "owner" : "discord-workspace",
                  kind,
                  error: String(releaseError?.message || releaseError).slice(0, 300)
                }));
              });
              throw error;
            }
            results.push({ ownerId, kind, automatic: true, queued: true });
          } else {
            results.push({ ownerId, kind, automatic: true, queued: false, alreadyQueued: true });
          }
        } else {
          results.push({ ownerId, ...(await sendEventDigest(kind, { now: scheduledAt, automatic: true, ownerId })) });
        }
      } catch (error) {
        console.error(JSON.stringify({
          event: "automatic-event-digest-failed",
          owner: ownerId === "owner" ? "owner" : "discord-workspace",
          kind,
          error: String(error?.message || error).slice(0, 300)
        }));
        results.push({ ownerId, kind, automatic: true, sent: false, error: String(error?.message || error) });
      }
    }
    const todayRun = scheduledRuns.find(run => run.kind === "today");
    if (todayRun) {
      try {
        // A destination that also receives the normal Today digest gets its
        // guide in that same delivery. Guide-only destinations need this
        // standalone path so they still receive the daily availability card.
        const availability = await sendEventAvailabilityGuide({
          now: todayRun.scheduledAt,
          automatic: true,
          ownerId,
          eventPayload
        });
        if (availability.sent || availability.alreadySent || availability.skipped !== true) {
          results.push({ ownerId, ...availability });
        }
      } catch (error) {
        console.error(JSON.stringify({
          event: "automatic-event-availability-guide-failed",
          owner: ownerId === "owner" ? "owner" : "discord-workspace",
          error: String(error?.message || error).slice(0, 300)
        }));
        results.push({ ownerId, kind: "availability-guide", automatic: true, sent: false, error: String(error?.message || error) });
      }
    }
    try {
      // Preorder delivery is event-relative rather than a daily schedule: each
      // event gets one sales guide once its start is within five days.
      const preorder = await sendEventPreorderGuide({
        now,
        automatic: true,
        ownerId,
        eventPayload
      });
      if (preorder.sent || preorder.alreadySent || preorder.skipped !== true) {
        results.push({ ownerId, ...preorder });
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: "automatic-event-preorder-guide-failed",
        owner: ownerId === "owner" ? "owner" : "discord-workspace",
        error: String(error?.message || error).slice(0, 300)
      }));
      results.push({ ownerId, kind: "preorder-guide", automatic: true, sent: false, error: String(error?.message || error) });
    }
  }
  try {
    results.push(...await runAutomaticStartingSoonAlerts(now, workspaces, queue, eventPayload));
  } catch (error) {
    console.error(JSON.stringify({
      event: "automatic-local-starting-soon-scan-failed",
      error: String(error?.message || error).slice(0, 300)
    }));
    results.push({ kind: STARTING_SOON_KIND, automatic: true, sent: false, error: String(error?.message || error) });
  }
  return results;
}

export async function processEventNotificationQueue(messages = []) {
  const results = [];
  // Queue delivery is delayed and at-least-once. Re-read authorization at
  // consumption time so revoking Events takes effect even for work that was
  // already enqueued.
  const eligibleOwners = new Set(await eligibleAutomaticEventWorkspaceOwners());
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message?.type === "event-starting-soon") {
      const ownerId = normalizeEventWorkspaceOwnerId(message.ownerId || "owner");
      const claim = queuedStartingSoonClaim(message, ownerId);
      if (!eligibleOwners.has(ownerId)) {
        await releaseAutomaticDigestQueueClaim(ownerId, claim.claimKey, claim.claimedAt);
        results.push({
          ownerId,
          kind: STARTING_SOON_KIND,
          automatic: true,
          sent: false,
          skipped: true,
          reason: "events-access-revoked"
        });
        continue;
      }
      const eventStartAt = Number(message.eventStartAt);
      if (Number.isFinite(eventStartAt) && Date.now() >= eventStartAt) {
        await releaseAutomaticDigestQueueClaim(ownerId, claim.claimKey, claim.claimedAt);
        results.push({
          ownerId,
          kind: STARTING_SOON_KIND,
          automatic: true,
          sent: false,
          skipped: true,
          reason: "event-already-started"
        });
        continue;
      }
      const result = await sendLocalStartingSoonAlert({
        now: Number(message.now) || Date.now(),
        ownerId,
        eventKey: claim.sentKey
      });
      await releaseAutomaticDigestQueueClaim(ownerId, claim.claimKey, claim.claimedAt);
      results.push(result);
      continue;
    }
    if (message?.type !== "event-digest") continue;
    const ownerId = normalizeEventWorkspaceOwnerId(message.ownerId || "owner");
    const kind = String(message.kind || "").trim().toLowerCase();
    if (!KINDS.has(kind)) throw new TypeError("Unknown event digest kind.");
    const claim = await queuedDigestClaim(message, ownerId, kind);
    if (!eligibleOwners.has(ownerId)) {
      await releaseAutomaticDigestQueueClaim(ownerId, claim.claimKey, claim.claimedAt);
      results.push({
        ownerId,
        kind,
        automatic: true,
        sent: false,
        skipped: true,
        reason: "events-access-revoked"
      });
      continue;
    }
    const result = await sendEventDigest(kind, {
      now: Number(message.now) || Date.now(),
      automatic: true,
      ownerId
    });
    await releaseAutomaticDigestQueueClaim(ownerId, claim.claimKey, claim.claimedAt);
    results.push(result);
  }
  return results;
}
