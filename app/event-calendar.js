const FEATURED_EVENT_TYPES = new Set(["season", "go-pass"]);

export function eventFeedUpdateLabel(payload, formatDate = date => date.toLocaleString()) {
  const timestamp = Number(payload?.sourceFetchedAt);
  if (!(timestamp > 0) || !Number.isFinite(new Date(timestamp).getTime())) {
    return "Source update time unavailable";
  }
  return `${payload?.stale ? "Last successful source update" : "Source checked"} ${formatDate(new Date(timestamp))}`;
}

function eventText(value) {
  return String(value || "").trim();
}

const ZONED_PARTS_FORMATTERS = new Map();

function unzonedRegionalSpawnEnvelope(event) {
  return event?.details?.spawnSchedule?.localTime === true &&
    String(event?.scope || "").toLocaleLowerCase() === "regional" &&
    !eventText(event?.timeZone);
}

function zonedPartsFormatter(timeZone) {
  if (ZONED_PARTS_FORMATTERS.has(timeZone)) return ZONED_PARTS_FORMATTERS.get(timeZone);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  ZONED_PARTS_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

export function eventDateYear(timestamp, timeZone, now = Date.now()) {
  if (!Number.isFinite(timestamp)) return undefined;
  const formatter = zonedPartsFormatter(timeZone);
  const year = value => formatter.formatToParts(value).find(part => part.type === "year")?.value;
  return year(timestamp) === year(now) ? undefined : "numeric";
}

export function formatEventCardDate(timestamp, timeZone, now = Date.now()) {
  if (!Number.isFinite(timestamp)) return "Date TBA";
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    month: "short",
    day: "numeric",
    year: eventDateYear(timestamp, timeZone, now)
  }).format(new Date(timestamp));
}

/** Convert a zone-less ISO wall clock into the matching IANA-zone instant. */
export function zonedWallClockTimestamp(value, timeZone) {
  const text = eventText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2})(?::(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?)?$/.exec(text);
  if (!match || !eventText(timeZone)) return null;
  const [, yearText, monthText, dayText, hourText = "0", minuteText = "0", secondText = "0", fractionText = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(fractionText.padEnd(3, "0") || 0);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  const validity = new Date(desired);
  if (validity.getUTCFullYear() !== year || validity.getUTCMonth() !== month - 1 || validity.getUTCDate() !== day) return null;
  let formatter;
  try {
    formatter = zonedPartsFormatter(String(timeZone));
  } catch {
    return null;
  }
  let guess = desired;
  for (let index = 0; index < 4; index += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess))
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]));
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const adjustment = desired - represented;
    guess += adjustment;
    if (adjustment === 0) return guess + millisecond;
  }
  const finalParts = Object.fromEntries(formatter.formatToParts(new Date(guess))
    .filter(part => part.type !== "literal")
    .map(part => [part.type, part.value]));
  const matchesWallClock = Number(finalParts.year) === year &&
    Number(finalParts.month) === month &&
    Number(finalParts.day) === day &&
    Number(finalParts.hour) === hour &&
    Number(finalParts.minute) === minute &&
    Number(finalParts.second) === second;
  return matchesWallClock ? guess + millisecond : null;
}

export function calendarEventTimestamp(event, field) {
  const text = eventText(event?.[field]);
  if (!text) return null;
  const hasZone = /[zZ]$|[+-]\d\d:\d\d$/.test(text);
  if (hasZone) {
    const absolute = Date.parse(text);
    return Number.isFinite(absolute) ? absolute : null;
  }
  const scope = eventText(event?.scope).toLocaleLowerCase();
  if (event?.localTime && scope !== "global" && eventText(event?.timeZone)) {
    return zonedWallClockTimestamp(text, event.timeZone);
  }
  if (unzonedRegionalSpawnEnvelope(event)) return null;
  const value = Date.parse(event?.localTime ? text : `${text}Z`);
  return Number.isFinite(value) ? value : null;
}

export function activeEventExclusion(event, now = Date.now()) {
  return (Array.isArray(event?.details?.availabilityExclusions) ? event.details.availabilityExclusions : []).find(window => {
    const range = { ...event, start: window.start, end: window.end };
    const start = calendarEventTimestamp(range, "start");
    const end = calendarEventTimestamp(range, "end");
    return start !== null && end !== null && now >= start && now < end;
  }) || null;
}

function hasInvalidBoundary(event, field) {
  return Boolean(eventText(event?.[field])) && calendarEventTimestamp(event, field) === null;
}

export function sourceBackedOngoingEvent(event) {
  if (event?.ongoing !== true || String(event?.eventType || "").toLowerCase() !== "stamp-rally" ||
      eventText(event?.end) || event?.details?.sourceReviewRequired === true) return false;
  const hasVerifiedDate = /^\d{4}-\d{2}-\d{2}$/.test(event?.details?.verifiedDate || "");
  const hasPublishedStart = calendarEventTimestamp(event, "start") !== null;
  if (!hasVerifiedDate && !hasPublishedStart) return false;
  try { const source = new URL(event.link); return source.protocol === "https:" && source.hostname === "pokemongo.com"; }
  catch { return false; }
}

export function isCurrentCalendarEvent(event, now = Date.now()) {
  return eventAvailabilityOccurrences(event).some(row => {
    if (hasInvalidBoundary(row, "start") || hasInvalidBoundary(row, "end")) return false;
    const start = calendarEventTimestamp(row, "start");
    const end = calendarEventTimestamp(row, "end");
    const hasKnownBoundary = start !== null || end !== null;
    return (hasKnownBoundary || sourceBackedOngoingEvent(row)) && (start === null || now >= start) && (end === null || now < end);
  }) && !activeEventExclusion(event, now);
}

export function calendarAvailabilityLabel(event, now = Date.now()) {
  if (sourceBackedOngoingEvent(event)) return activeEventExclusion(event, now) ? "ON BREAK" : "LIVE NOW";
  if (!eventAvailabilityOccurrences(event).some(row =>
    calendarEventTimestamp(row, "start") !== null || calendarEventTimestamp(row, "end") !== null)) return "TIME TBA";
  if (activeEventExclusion(event, now)) return "ON BREAK";
  if (isCurrentCalendarEvent(event, now)) return "LIVE NOW";
  const next = eventAvailabilityOccurrences(event).map(row => calendarEventTimestamp(row, "start"))
    .filter(start => start !== null && start > now).sort((a, b) => a - b)[0];
  if (next !== undefined) {
    const today = localDayWindow(now);
    return next < today.end ? "LATER TODAY" : "UPCOMING";
  }
  return "FINISHED";
}

/** The broad published event dates describe research/bonuses, not target spawn moments. */
export function eventAvailabilityOccurrences(event) {
  const regionalLocalSchedule = event?.details?.spawnSchedule?.localTime === true &&
    String(event?.scope || "").toLocaleLowerCase() === "regional";
  if (!regionalLocalSchedule) return eventGameplayOccurrences(event);
  const locations = Array.isArray(event?.details?.plannerLocations) ? event.details.plannerLocations : [];
  if (!locations.length || (!eventText(event?.start) && !eventText(event?.end))) return eventGameplayOccurrences(event);
  return locations.map(location => ({
    ...event,
    timeZone: location.timeZone || location.zone || "",
    availabilityLocationId: location.id || ""
  }));
}

/** One source of playable windows for calendar, details and notifications. */
export function eventGameplayOccurrences(event) {
  const spawnSchedule = event?.details?.spawnSchedule;
  // The target-specific schedule is the encounter contract when both it and
  // broad gameplay windows exist; broader dates continue to drive event status.
  let windows = spawnSchedule?.windows?.length ? spawnSchedule.windows : event?.details?.gameplayWindows;
  const regionalSpawnSchedule = spawnSchedule?.windows?.length &&
    spawnSchedule.localTime === true && String(event?.scope || "").toLocaleLowerCase() === "regional";
  if (!windows?.length && event?.details?.raidSchedule?.windows?.length) {
    windows = [];
    for (const row of [...event.details.raidSchedule.windows].sort((a, b) => a.start.localeCompare(b.start))) {
      const last = windows.at(-1);
      if (last && last.start.slice(0, 10) === row.start.slice(0, 10) && row.start <= last.end) {
        if (row.end > last.end) last.end = row.end;
      } else windows.push({ start: row.start, end: row.end, label: row.start.slice(0, 10) });
    }
  }
  if (!Array.isArray(windows) || !windows.length || event?.gameplayOccurrence) return [event];
  const locations = regionalSpawnSchedule && Array.isArray(event?.details?.plannerLocations)
    ? event.details.plannerLocations : [null];
  const occurrences = windows.flatMap(window => {
    const eligible = regionalSpawnSchedule
      ? locations.filter(location => !Array.isArray(window.locationIds) || window.locationIds.includes(location?.id))
      : [null];
    return eligible.map(location => ({
      ...event,
      start: window.start,
      end: window.end,
      ...(location ? { timeZone: location.timeZone || location.zone, spawnLocationId: location.id } : {}),
      gameplayOccurrence: `${window.label || window.start}${location ? ` · ${location.id}` : ""}`
    }));
  });
  return occurrences.filter(row => {
    const start = calendarEventTimestamp(row, "start"), end = calendarEventTimestamp(row, "end");
    return start !== null && end !== null && end > start;
  });
}

/** Calendar bars use a regional event's broad envelope, not every target burst. */
export function eventCalendarOccurrences(event) {
  const regionalLocalSchedule = event?.details?.spawnSchedule?.localTime === true &&
    String(event?.scope || "").toLocaleLowerCase() === "regional";
  return regionalLocalSchedule ? [event] : eventGameplayOccurrences(event);
}

/** Venue dates follow the viewer's calendar; floating global dates stay local. */
export function calendarEventDateKey(event, field, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const text = eventText(event?.[field]);
  if (!text) return "";
  if (unzonedRegionalSpawnEnvelope(event) && /^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(text)) {
    return text.slice(0, 10);
  }
  const floating = event?.localTime && event?.scope === "global";
  const timestamp = floating ? Date.parse(text.replace(/[zZ]$/, "") + "Z") : calendarEventTimestamp(event, field);
  if (timestamp === null || !Number.isFinite(timestamp)) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: floating ? "UTC" : timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(timestamp - (field === "end" ? 1 : 0)))
    .filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const LONG_GLOBAL_EVENT_MIN_MS = 5 * 24 * 60 * 60 * 1_000;
const LONG_GLOBAL_EVENT_MAX_MS = 14 * 24 * 60 * 60 * 1_000;

/**
 * A current, week-scale global event deserves the first card in the public
 * “What's happening today” section. Keep evergreen season/pass cards and
 * battle rotations in their existing groups instead of treating every long
 * event as a hero event.
 */
export function isLongRunningGlobalEvent(event) {
  if (String(event?.scope || "").toLowerCase() !== "global") return false;
  const duration = calendarEventDurationMs(event);
  if (duration < LONG_GLOBAL_EVENT_MIN_MS || duration > LONG_GLOBAL_EVENT_MAX_MS) return false;
  const identity = `${event?.eventType || ""} ${event?.heading || ""} ${event?.name || ""}`.toLocaleLowerCase();
  return !/season|go[ -]?pass|monthly pass|raid|shadow|mega|max battle|dynamax|gigantamax|battle league|spotlight|community day|raid day|showcase|stamp[ -]?rally/.test(identity);
}

export function isFeaturedCalendarEvent(event, now = Date.now()) {
  return FEATURED_EVENT_TYPES.has(String(event?.eventType || "").toLowerCase()) &&
    isCurrentCalendarEvent(event, now);
}

export function localDayWindow(now = Date.now()) {
  const date = new Date(now);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  return { start, end };
}

export function isTodayCalendarEvent(event, now = Date.now()) {
  const window = localDayWindow(now);
  return eventAvailabilityOccurrences(event).some(row => {
    if (hasInvalidBoundary(row, "start") || hasInvalidBoundary(row, "end")) return false;
    const start = calendarEventTimestamp(row, "start");
    const end = calendarEventTimestamp(row, "end");
    const hasKnownBoundary = start !== null || end !== null;
    return hasKnownBoundary && (start === null || start < window.end) && (end === null || end > window.start);
  });
}

/**
 * Put short, time-sensitive windows ahead of ordinary events. Current
 * week-scale global events are lifted into the page's featured section by
 * isFeaturedCalendarEvent; duration remains the tie-breaker everywhere else.
 */
export function calendarEventPriority(event) {
  const identity = `${event?.eventType || ""} ${event?.heading || ""} ${event?.name || ""}`.toLocaleLowerCase();
  if (/spotlight|raid[ -]?hour|baseball|local partnership|in[ -]?person/.test(identity)) return 0;
  if (/community day|raid day|elite raid|max monday|showcase/.test(identity)) return 1;
  if (/raid|shadow|mega|max battle|dynamax|gigantamax/.test(identity)) return 2;
  if (/\bseason\b/.test(identity)) return 5;
  if (/go[ -]?pass|monthly pass/.test(identity)) return 6;
  return 3;
}

export function calendarEventDurationMs(event) {
  const start = calendarEventTimestamp(event, "start");
  const end = calendarEventTimestamp(event, "end");
  if (start === null && end === null && unzonedRegionalSpawnEnvelope(event)) {
    const date = value => {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(eventText(value));
      return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
    };
    const wallStart = date(event?.start), wallEnd = date(event?.end);
    if (wallStart !== null && wallEnd !== null && wallEnd >= wallStart) return wallEnd - wallStart;
  }
  if (start === null || end === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, end - start);
}

export function compareCalendarEvents(left, right) {
  const priority = calendarEventPriority(left) - calendarEventPriority(right);
  if (priority) return priority;
  const duration = calendarEventDurationMs(left) - calendarEventDurationMs(right);
  if (duration) return duration;
  const startLeft = calendarEventTimestamp(left, "start") ?? Number.POSITIVE_INFINITY;
  const startRight = calendarEventTimestamp(right, "start") ?? Number.POSITIVE_INFINITY;
  if (startLeft !== startRight) return startLeft - startRight;
  return String(left?.name || "").localeCompare(String(right?.name || ""));
}

/**
 * Event lists should read like an agenda, not like the month-grid lane
 * allocator. Start date/time is authoritative; duration and event priority
 * are used only when two entries begin at the same moment.
 */
export function compareChronologicalCalendarEvents(left, right) {
  const startLeft = calendarEventTimestamp(left, "start") ?? calendarEventTimestamp(left, "end") ?? Number.POSITIVE_INFINITY;
  const startRight = calendarEventTimestamp(right, "start") ?? calendarEventTimestamp(right, "end") ?? Number.POSITIVE_INFINITY;
  if (startLeft !== startRight) return startLeft - startRight;
  const duration = calendarEventDurationMs(left) - calendarEventDurationMs(right);
  if (duration) return duration;
  const priority = calendarEventPriority(left) - calendarEventPriority(right);
  if (priority) return priority;
  return String(left?.name || "").localeCompare(String(right?.name || ""));
}

export function compareTodayCalendarEvents(left, right) {
  const longGlobalDelta = Number(isLongRunningGlobalEvent(right)) - Number(isLongRunningGlobalEvent(left));
  if (longGlobalDelta) return longGlobalDelta;
  return compareCalendarEvents(left, right);
}

export function eventRangeTone(event) {
  const identity = `${event?.eventType || ""} ${event?.heading || ""} ${event?.name || ""}`.toLocaleLowerCase();
  if (/spotlight|raid[ -]?hour|baseball|local partnership|in[ -]?person/.test(identity)) return "gold";
  if (/community day|raid day|elite raid|max monday|showcase/.test(identity)) return "mint";
  if (/raid|shadow|mega|max battle|dynamax|gigantamax/.test(identity)) return "blue";
  if (/season|go[ -]?pass|monthly pass/.test(identity)) return "pink";
  return "purple";
}

export const EVENT_CALENDAR_CATEGORIES = Object.freeze([
  { id: "local", label: "Local & regional", color: "#8b5cf6" },
  { id: "raid-day", label: "Raid days", color: "#f9735b" },
  { id: "raids", label: "Raids & raid hours", color: "#dc3d4b" },
  { id: "community-day", label: "Community Days", color: "#27845b" },
  { id: "max-battles", label: "Max Battles", color: "#3478c8" },
  { id: "research", label: "Research", color: "#0891b2" },
  { id: "spotlight-hour", label: "Spotlight Hours", color: "#c17b12" },
  { id: "stamp-rally", label: "Stamp rallies", color: "#be4b83" },
  { id: "other", label: "Other events", color: "#687386" }
].map(category => Object.freeze(category)));

const CALENDAR_CATEGORY_IDS = new Set(EVENT_CALENDAR_CATEGORIES.map(category => category.id));
const LOCAL_CALENDAR_EVENT_TYPES = new Set([
  "local", "local-event", "local-partnership", "local-citywide-wild",
  "regional-event", "regional-raid-event", "city-safari"
]);
const CALENDAR_EVENT_TYPE_CATEGORIES = new Map([
  ["raid-day", "raid-day"], ["raid-days", "raid-day"], ["elite-raid", "raid-day"], ["elite-raids", "raid-day"],
  ["raid", "raids"], ["raid-battles", "raids"], ["raid-hour", "raids"], ["raid-hours", "raids"],
  ["mega-raids", "raids"], ["shadow-raids", "raids"],
  ["community-day", "community-day"], ["regional-community-day", "community-day"], ["community-days", "community-day"],
  ["max-battle", "max-battles"], ["max-battles", "max-battles"], ["max-monday", "max-battles"], ["max-mondays", "max-battles"],
  ["research", "research"], ["field-research", "research"], ["timed-research", "research"], ["special-research", "research"],
  ["pokemon-spotlight-hour", "spotlight-hour"], ["spotlight-hour", "spotlight-hour"],
  ["stamp-rally", "stamp-rally"], ["stamp-rallies", "stamp-rally"]
]);

function normalizedCalendarEventType(event) {
  return eventText(event?.eventType).toLocaleLowerCase().replace(/[\s_]+/g, "-");
}

export function eventCalendarCategory(event) {
  const type = normalizedCalendarEventType(event);
  const typedCategory = CALENDAR_EVENT_TYPE_CATEGORIES.get(type);
  if (typedCategory) return typedCategory;
  const scope = eventText(event?.scope).toLocaleLowerCase();
  if ((scope && scope !== "global") || (!scope && LOCAL_CALENDAR_EVENT_TYPES.has(type))) return "local";
  return "other";
}

export function eventMatchesCalendarCategory(event, id) {
  if (id === "all") return true;
  if (!CALENDAR_CATEGORY_IDS.has(id)) return false;
  if (id === "local") {
    const scope = eventText(event?.scope).toLocaleLowerCase();
    return (scope && scope !== "global") || (!scope && LOCAL_CALENDAR_EVENT_TYPES.has(normalizedCalendarEventType(event)));
  }
  return eventCalendarCategory(event) === id;
}

export function eventCalendarCategoryClass(event) {
  return `event-category-${eventCalendarCategory(event)}`;
}

/**
 * Stamp rallies are kept separate from the general daily feed while they are
 * active so their mapped stops and GPX download are easy to find.
 */
export function isStampRallyEvent(event) {
  const identity = `${event?.eventType || ""} ${event?.heading || ""} ${event?.name || ""}`;
  return /stamp[\s-]*rally/i.test(identity);
}

/** The combined public filter includes mapped GPX events and every stamp rally. */
export function isGpxOrStampRallyEvent(event, venues = []) {
  const venueCount = Array.isArray(venues) ? venues.length : Math.max(0, Number(venues) || 0);
  return venueCount > 0 || isStampRallyEvent(event);
}

const ONGOING_LOCAL_EVENT_MIN_MS = 7 * 24 * 60 * 60 * 1_000;

/**
 * Long-running regional attractions are useful, but repeating them in
 * “What's happening today” every day hides the short events that need action.
 * Keep them visible in a dedicated ongoing section instead. Stamp rallies
 * already have their own route-focused section and are intentionally omitted.
 */
export function isOngoingLocalCalendarEvent(event, now = Date.now()) {
  if (String(event?.scope || "").toLowerCase() === "global") return false;
  if (isStampRallyEvent(event) || !isCurrentCalendarEvent(event, now)) return false;
  const end = calendarEventTimestamp(event, "end");
  return end === null || calendarEventDurationMs(event) >= ONGOING_LOCAL_EVENT_MIN_MS;
}

/**
 * Keep the month readable by leaving evergreen regional attractions in their
 * dedicated cards/GPX sections instead of painting the same bar through every
 * week. Seasons and passes have their own featured cards, so they do not
 * repeat on every calendar day. Raid rotations and ordinary events remain on
 * the calendar. Regional events longer than 45 days and open-ended stamp
 * rallies remain searchable below the month grid.
 */
export function isCalendarGridEvent(event) {
  const type = String(event?.eventType || "").toLocaleLowerCase();
  const identity = `${type} ${event?.heading || ""} ${event?.name || ""}`.toLocaleLowerCase();
  if (FEATURED_EVENT_TYPES.has(type) || /\bseason\b|\bgo[ -]?pass\b|\bmonthly pass\b/.test(identity)) return false;
  const duration = calendarEventDurationMs(event);
  const openEnded = calendarEventTimestamp(event, "end") === null &&
    !(unzonedRegionalSpawnEnvelope(event) && /^\d{4}-\d{2}-\d{2}/.test(eventText(event?.end)));
  if (isStampRallyEvent(event) && (openEnded || duration > 31 * 24 * 60 * 60 * 1_000)) return false;
  const raidSchedule = event?.details?.raidSchedule || {};
  const operatingHours = raidSchedule.dailyOperationalHours || {};
  const operationalMinute = value => {
    const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const operatingStart = operationalMinute(operatingHours.start);
  const operatingEnd = operationalMinute(operatingHours.end);
  const sourceBackedVenueRaidCampaign = type.startsWith("local-") &&
    Array.isArray(event?.venues) && event.venues.length > 0 &&
    Array.isArray(event?.details?.raidBosses) && event.details.raidBosses.length > 0 &&
    raidSchedule.availableThroughoutEvent === true &&
    typeof raidSchedule.sourceUrl === "string" && raidSchedule.sourceUrl.trim() !== "" &&
    operatingHours.policy === "destination-local" && operatingStart !== null && operatingEnd > operatingStart;
  if (String(event?.scope || "").toLowerCase() !== "global" &&
      (openEnded || duration > 45 * 24 * 60 * 60 * 1_000 && !sourceBackedVenueRaidCampaign)) return false;
  return true;
}

export function partitionCalendarEvents(events, now = Date.now()) {
  const featured = [];
  const today = [];
  const upcoming = [];
  const window = localDayWindow(now);

  for (const event of [...(Array.isArray(events) ? events : [])].sort(compareChronologicalCalendarEvents)) {
    if (isFeaturedCalendarEvent(event, now)) {
      featured.push(event);
      continue;
    }
    if (isTodayCalendarEvent(event, now)) {
      today.push(event);
      continue;
    }
    const start = calendarEventTimestamp(event, "start");
    if (start !== null && start >= window.end) upcoming.push(event);
  }

  today.sort(compareTodayCalendarEvents);
  return { featured, today, upcoming };
}
