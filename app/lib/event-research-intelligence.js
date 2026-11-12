import { eventCollectorIdentity } from "../event-pokemon-identity.js";
import { POKEMON_DEFAULT_FORM_IDS } from "../pokemon-appearance-data.js";
import { POKEMON_NAMES, pokemonDexIdByName } from "../pokemon-search-metadata.js";

const MONTHS = new Map([
  ["jan", 1], ["january", 1], ["feb", 2], ["february", 2], ["mar", 3], ["march", 3],
  ["apr", 4], ["april", 4], ["may", 5], ["jun", 6], ["june", 6], ["jul", 7], ["july", 7],
  ["aug", 8], ["august", 8], ["sep", 9], ["sept", 9], ["september", 9], ["oct", 10], ["october", 10],
  ["nov", 11], ["november", 11], ["dec", 12], ["december", 12]
]);

export const EVENT_DETAIL_CACHE_MS = 6 * 60 * 60 * 1000;
export const ACTIVE_EVENT_DETAIL_CACHE_MS = 15 * 60 * 1000;

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const unique = values => [...new Set(values.filter(Boolean))];

export function eventDetailFreshnessMs(event, now = Date.now()) {
  const type = String(event?.eventType || event?.id || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const title = String(event?.name || event?.title || "").trim().replace(/\s+/g, " ");
  const nonPlayable = /^(?:stamp-rall(?:y|ies)|seasons?|go-battle-league|battle-league|gbl|pvp|go-pass|news|announcements?|updates?|showcases?|pokestop-showcases?|research-breakthrough)(?:-|$)/.test(type) ||
    /^(?:Mystery|Unknown|Unannounced|TBA) Pok[eé]mon (?:Spotlight Hour|Raid Hour|Raid Day|Max Monday)$/i.test(title);
  const start = Date.parse(String(event?.start || ""));
  const end = Date.parse(String(event?.end || ""));
  return !nonPlayable && Number.isFinite(start) && Number.isFinite(end) && end >= now
    ? ACTIVE_EVENT_DETAIL_CACHE_MS : EVENT_DETAIL_CACHE_MS;
}

/** Research routes need explicit current, timestamp-bounded detail evidence. */
export function researchSourceIsFresh(event, method, now = Date.now()) {
  const fetchedAt = Number(method?.taskSourceFetchedAt) || 0;
  if (method?.taskSourceFreshness !== "current" || !Number.isSafeInteger(fetchedAt) || fetchedAt <= 0 ||
      fetchedAt > now || now - fetchedAt >= eventDetailFreshnessMs(event, now)) return false;
  return true;
}

/** Controller-side check of source evidence copied into the derived route settings. */
export function researchAutomationIsFresh(research, now = Date.now()) {
  const fetchedAt = Number(research?.sourceFetchedAt) || 0;
  const freshnessMs = Number(research?.sourceFreshnessMs) || 0;
  const sourceExpiresAt = Number(research?.sourceExpiresAt) || 0;
  return research?.sourceStatus === "current" && Number.isSafeInteger(fetchedAt) && fetchedAt > 0 &&
    Number.isSafeInteger(freshnessMs) && freshnessMs > 0 && freshnessMs <= EVENT_DETAIL_CACHE_MS &&
    Number.isSafeInteger(sourceExpiresAt) && sourceExpiresAt === fetchedAt + freshnessMs &&
    fetchedAt <= now && now < sourceExpiresAt;
}

function safeSourceUrl(value) {
  const source = text(value);
  if (!source || source.length > 2_048) return "";
  try {
    const url = new URL(source);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

function isFieldResearchGroup(group) {
  const name = text(group?.name);
  return /(?:^|[·:—–-]\s*)field research(?:\b|$)/i.test(name);
}

function taskCategory(value) {
  const task = text(value).replace(/[’]/g, "'");
  let match = task.match(/^catch\s+(\d{1,3})\s+pok[eé]mon\.?$/i);
  if (match) return { category: "catch", quantity: Number(match[1]) };
  match = task.match(/^spin\s+(\d{1,3})\s+pok[eé]stops?\.?$/i);
  if (match) return { category: "spin", quantity: Number(match[1]) };
  return null;
}

function unsupportedTaskReason(value) {
  const task = text(value);
  if (/\bbuddy\b|\bhearts?\b/i.test(task)) return "Buddy-heart tasks need Buddy Manager or manual completion.";
  return "Only plain-count Pokémon catch and PokéStop spin tasks are auto-routed.";
}

function exactBaseSpeciesDex(value) {
  const name = text(value);
  const dex = pokemonDexIdByName(name);
  if (!Number.isInteger(dex) || dex < 1 || text(POKEMON_NAMES[dex]) !== name) return 0;
  try {
    const identity = eventCollectorIdentity(name);
    const match = /^(\d+)(?::(\d+))?$/.exec(identity);
    if (!match || Number(match[1]) !== dex) return 0;
    const defaultForm = Number(POKEMON_DEFAULT_FORM_IDS[dex] || 0);
    if (defaultForm ? Number(match[2]) !== defaultForm : Boolean(match[2])) return 0;
    return dex;
  } catch {
    return 0;
  }
}

function rewardNames(value) {
  const reward = text(value);
  const possible = reward.match(/^possible rewards:\s*(.+)$/i)?.[1];
  return unique((possible || reward).split(/\s*\/\s*/).map(text));
}

function sourceDateParts(value) {
  const match = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\s*(?:–|—|-|\bto\b)\s*(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?/i.exec(text(value));
  if (!match) return null;
  const startMonth = MONTHS.get(match[1].toLocaleLowerCase());
  const endMonth = match[4] ? MONTHS.get(match[4].toLocaleLowerCase()) : startMonth;
  if (!startMonth || !endMonth) return null;
  return {
    startMonth, startDay: Number(match[2]), startYear: Number(match[3]) || 0,
    endMonth, endDay: Number(match[5]), endYear: Number(match[6]) || 0
  };
}

function isoDay(year, month, day) {
  const value = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : "";
}

function dateRangeForGroup(group, event = {}) {
  const parts = sourceDateParts(group?.name);
  if (!parts) return null;
  const eventStart = Date.parse(String(event?.start || ""));
  const eventEnd = Date.parse(String(event?.end || ""));
  if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd)) return null;
  const startYear = parts.startYear || new Date(eventStart).getUTCFullYear();
  let endYear = parts.endYear || startYear;
  if (!parts.endYear && parts.endMonth < parts.startMonth) endYear += 1;
  const startDate = isoDay(startYear, parts.startMonth, parts.startDay);
  const endDate = isoDay(endYear, parts.endMonth, parts.endDay);
  if (!startDate || !endDate || endDate < startDate) return null;
  const eventStartDate = text(event?.start).slice(0, 10);
  const eventEndDate = text(event?.end).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(eventEndDate) ||
      startDate < eventStartDate || endDate > eventEndDate) return null;
  return { startDate, endDate };
}

function destinationIds(event = {}) {
  if (event.scope === "global" || event.details?.nativeHuntSearchPolicy === "global-no-venue") {
    return ["nyc", "tokyo"];
  }
  const ids = [];
  for (const row of Array.isArray(event.details?.plannerLocations) ? event.details.plannerLocations : []) {
    if (typeof row?.id === "string" && row.id.trim()) ids.push(row.id.trim());
  }
  for (const [index, venue] of (Array.isArray(event.venues) ? event.venues : []).entries()) {
    if (!venue || typeof venue !== "object") continue;
    const id = text(venue.id) || `venue-${index + 1}`;
    if (text(venue.coordinates)) ids.push(id);
  }
  if (text(event.coordinates)) ids.push(text(event.id) ? `venue-${(event.venues || []).length + 1}` : "venue-1");
  return unique(ids);
}

function exactScheduleWindows(event, startDate, endDate) {
  const details = event?.details || {};
  const locations = destinationIds(event);
  if (!locations.length) return [];
  const sourceRows = [
    ...(Array.isArray(details.gameplayWindows) ? details.gameplayWindows : []),
    ...(Array.isArray(details.spawnSchedule?.windows) ? details.spawnSchedule.windows : [])
  ];
  const rows = [];
  for (const row of sourceRows) {
    const start = text(row?.start), end = text(row?.end);
    const sourceUrl = safeSourceUrl(row?.sourceUrl || details.spawnSchedule?.sourceUrl || event?.link);
    if (row?.localTime !== true || !sourceUrl ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(start) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(end) || end <= start ||
        start.slice(0, 10) < startDate || end.slice(0, 10) > endDate) continue;
    const explicitIds = Array.isArray(row.locationIds) ? row.locationIds : [];
    if (explicitIds.some(id => !locations.includes(id))) continue;
    const locationIds = explicitIds.length ? unique(explicitIds) : locations;
    if (!locationIds.length) continue;
    const startAt = Date.parse(`${start}Z`), endAt = Date.parse(`${end}Z`);
    // Short wild-burst rows and raid-only hours are not a usable walking schedule.
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt - startAt < 30 * 60_000) continue;
    rows.push({ ...row, start, end, localTime: true, sourceUrl, locationIds });
  }
  return rows;
}

function taskRows(groups, ranges = []) {
  const rows = [];
  for (const [groupIndex, group] of groups.entries()) {
    for (const task of Array.isArray(group?.tasks) ? group.tasks : []) {
      const label = text(task?.text);
      if (!label) continue;
      const classification = taskCategory(label);
      const rewards = rewardNames(task?.reward);
      const rewardSpecies = rewards.filter(name => exactBaseSpeciesDex(name));
      const unsupportedRewards = rewards.filter(name => !exactBaseSpeciesDex(name));
      rows.push({
        label,
        fieldGroup: text(group?.name),
        ...(ranges[groupIndex] ? { fieldPeriod: { ...ranges[groupIndex] } } : {}),
        ...(classification || { category: "unsupported", quantity: null }),
        rewardSpecies,
        rewardSpeciesStatus: rewardSpecies.length ? "reported" : "not-published-or-unresolved",
        status: "reported",
        automationStatus: classification && rewardSpecies.length ? "eligible" : "unsupported",
        ...(!classification ? { automationReason: unsupportedTaskReason(label) }
          : !rewardSpecies.length ? { automationReason: "The task has no unambiguous ordinary Pokémon reward name." } : {}),
        ...(unsupportedRewards.length ? { unresolvedRewards: unsupportedRewards } : {}),
        resolutionConfidence: rewardSpecies.length ? "exact-canonical-species-name" : "unresolved"
      });
    }
  }
  return rows;
}

function mergeTasks(existing, parsed) {
  const byLabel = new Map();
  for (const row of [...(Array.isArray(existing) ? existing : []), ...parsed]) {
    const label = text(row?.label || row?.text);
    if (!label) continue;
    const key = label.toLocaleLowerCase();
    const current = byLabel.get(key);
    if (!current) {
      byLabel.set(key, { ...row, label });
      continue;
    }
    if (row.status === "reported" && row.rewardSpecies?.length) {
      byLabel.set(key, { ...current, ...row, label });
    }
  }
  return [...byLabel.values()];
}

function derivedAutomation(tasks) {
  const pools = new Map();
  for (const task of tasks) {
    if (task.automationStatus !== "eligible" || !["catch", "spin"].includes(task.category)) continue;
    const rewards = unique((task.rewardSpecies || []).map(name => {
      const dex = exactBaseSpeciesDex(name);
      return dex ? String(dex) : "";
    }));
    if (!rewards.length) continue;
    const pool = pools.get(task.category) || new Set();
    for (const reward of rewards) pool.add(reward);
    pools.set(task.category, pool);
  }
  const categories = [...pools.keys()];
  if (!categories.length) return { automation: null,
    reason: "No supported catch/spin task has an unambiguous ordinary Pokémon reward." };

  // Compare the exact base-dex IDs sent to native Researcher. Non-default or
  // unresolved forms have already been rejected by exactBaseSpeciesDex.
  const sharedPool = pools.get(categories[0]);
  if (categories.slice(1).some(category => {
    const pool = pools.get(category);
    return pool.size !== sharedPool.size || [...sharedPool].some(reward => !pool.has(reward));
  })) return { automation: null,
    reason: "Catch and spin tasks report different Pokémon reward pools, so they cannot share one Researcher filter." };

  return { automation: { questCategories: categories, rewardPokemon: [...sharedPool] }, reason: "" };
}

function sameDateRange(method, range) {
  return Boolean(range && text(method?.startDate) === range.startDate && text(method?.endDate) === range.endDate);
}

/**
 * Convert exact LeekDuck Field Research task rows into reported method metadata.
 * This never reads group/page completion rewards and never promotes secondary
 * task data to official status because a related official article was found.
 */
export function buildFieldResearchIntelligence({ event = {}, researchGroups = [], sourceUrl = "",
  sourceFetchedAt = 0, sourceFreshness = "current" } = {}) {
  const source = safeSourceUrl(sourceUrl);
  const fieldGroups = (Array.isArray(researchGroups) ? researchGroups : []).filter(isFieldResearchGroup);
  if (!source || !fieldGroups.length) return null;
  const ranges = fieldGroups.map(group => dateRangeForGroup(group, event));
  const tasks = taskRows(fieldGroups, ranges);
  if (!tasks.length) return null;
  const uniqueRanges = new Set(ranges.filter(Boolean).map(range => `${range.startDate}/${range.endDate}`));
  const range = ranges.length && ranges.every(Boolean) && uniqueRanges.size === 1 ? ranges[0] : null;
  const methods = Array.isArray(event?.details?.researchMethods) ? event.details.researchMethods : [];
  const existingFields = methods.filter(method => method?.type === "field");
  const curated = existingFields.length === 1 ? existingFields[0] : null;
  const exactMatch = Boolean(curated && (range ? sameDateRange(curated, range) : false));
  const canMergeCurated = Boolean(exactMatch && sourceFreshness === "current");
  const taskRowsForMethod = canMergeCurated ? mergeTasks(curated.tasks, tasks) : tasks;
  const taskAutomationResult = derivedAutomation(tasks);
  const taskAutomation = taskAutomationResult.automation;
  const existingReportedPool = curated?.rewardSpeciesStatus === "reported" &&
    Array.isArray(curated?.tasks) && curated.tasks.some(task => task?.status === "reported");
  const freshRewardPairs = Boolean(canMergeCurated && taskAutomation && existingReportedPool);
  const automation = canMergeCurated
    ? taskAutomation ? { ...curated?.automation, ...taskAutomation } : null
    : curated?.automation || taskAutomation;

  let method = null;
  if (canMergeCurated) {
    method = {
      ...curated,
      tasks: taskRowsForMethod,
      taskSourceUrl: source,
      taskSourceKind: "reported",
      taskSourceStatus: "reported",
      taskSourceFreshness: sourceFreshness,
      taskSourceFetchedAt: Number(sourceFetchedAt) || 0,
      taskResolutionConfidence: "exact-task-and-attached-reward-rows",
      ...(freshRewardPairs ? { rewardSpecies: unique(tasks.flatMap(task => task.rewardSpecies || [])), rewardSpeciesStatus: "reported" } : {}),
      ...(canMergeCurated ? { automation: automation || undefined } : automation ? { automation } : {})
    };
  } else if (!existingFields.length && range && sourceFreshness === "current") {
    const windows = exactScheduleWindows(event, range.startDate, range.endDate);
    const scheduleSource = safeSourceUrl(windows[0]?.sourceUrl || event?.details?.spawnSchedule?.sourceUrl || source);
    method = {
      type: "field",
      label: "Field Research · reported tasks",
      startDate: range.startDate,
      endDate: range.endDate,
      sourceUrl: scheduleSource,
      taskSourceUrl: source,
      taskSourceKind: "reported",
      taskSourceStatus: "reported",
      taskSourceFreshness: sourceFreshness,
      taskSourceFetchedAt: Number(sourceFetchedAt) || 0,
      taskResolutionConfidence: "exact-task-and-attached-reward-rows",
      rewardSpecies: unique(tasks.flatMap(task => task.rewardSpecies || [])),
      rewardSpeciesStatus: "reported",
      tasks: taskRowsForMethod,
      ...(windows.length ? { windows } : {}),
      ...(automation && windows.length ? { automation } : {})
    };
  }

  const unsupportedTasks = taskRowsForMethod.filter(task => task.automationStatus !== "eligible")
    .map(task => ({ label: task.label, reason: task.automationReason || "This task family is not auto-routed." }));
  const automatic = Boolean(method?.automation && method.windows?.length);
  return {
    ...(method ? { method } : {}),
    fieldGroups: fieldGroups.map(group => ({ name: text(group.name), step: Number(group.step) || 0 })),
    tasks: taskRowsForMethod,
    unsupportedTasks,
    sourceUrl: source,
    sourceStatus: sourceFreshness,
    sourceFetchedAt: Number(sourceFetchedAt) || 0,
    taskDataStatus: "reported",
    taskResolutionConfidence: "exact-task-and-attached-reward-rows",
    ...(range ? { sourceDateRange: range } : {}),
    exactCuratedPeriodMatch: exactMatch,
    automatic,
    ...(!automatic ? { automationUnavailableReason: !range
      ? "Field Research dates are missing, ambiguous, or split across different periods."
      : existingFields.length > 1
        ? "Multiple curated Field Research methods prevent a source-safe merge."
        : !method?.windows?.length
          ? "No same-period source-backed local gameplay window and designated routing location are available."
          : taskAutomationResult.reason || "No supported catch/spin task has an unambiguous ordinary Pokémon reward." } : {}),
    note: "Field task and per-task reward rows are reported source data. Only plain-count Pokémon catch and PokéStop spin tasks qualify for routing; other task families remain informational. Unsupported tasks can still share a reward pool with selected tasks in the native Researcher.",
    ...(unsupportedTasks.length ? { unsupportedTasks } : {})
  };
}

/** Candidate selection is capped and rotates each source-feed freshness bucket. */
export function researchDiscoveryCandidates(events, now = Date.now(), maximum = 3, rotationMs = 10 * 60 * 1000) {
  const rows = (Array.isArray(events) ? events : []).filter(event => {
    if (!event) return false;
    let hasLeekDuckDetail = false;
    try { hasLeekDuckDetail = /(^|\.)leekduck\.com$/i.test(new URL(event.link).hostname); } catch {}
    const hasRedditTaskSource = (Array.isArray(event?.details?.researchMethods) ? event.details.researchMethods : [])
      .some(method => {
        if (method?.type !== "field") return false;
        try {
          const source = new URL(String(method.taskSourceUrl || ""));
          return source.protocol === "https:" && source.hostname.toLocaleLowerCase() === "www.reddit.com" &&
            !source.username && !source.password && !source.search && !source.hash &&
            /^\/r\/[a-z0-9_]+\/comments\/[a-z0-9]+\/[a-z0-9_-]+$/i.test(source.pathname.replace(/\/+$/, ""));
        } catch { return false; }
      });
    if (!hasLeekDuckDetail && !hasRedditTaskSource) return false;
    const start = Date.parse(String(event.start || "")), end = Date.parse(String(event.end || ""));
    return Number.isFinite(start) && Number.isFinite(end) && end >= now &&
      !/^(?:season|go-battle-league|battle-league|gbl|news|announcements?)(?:-|$)/i.test(text(event.eventType || event.id));
  }).sort((left, right) => Date.parse(left.start) - Date.parse(right.start) || text(left.id).localeCompare(text(right.id)));
  if (!rows.length) return [];
  const cap = Math.max(1, Math.min(3, Number(maximum) || 3));
  const offset = Math.floor(Math.max(0, Number(now) || 0) / Math.max(1, Number(rotationMs) || 1)) % rows.length;
  return Array.from({ length: Math.min(cap, rows.length) }, (_, index) => rows[(offset + index) % rows.length]);
}
