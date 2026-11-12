// Source-checked event evidence used only by the rating projection.
// This module deliberately does not change playable targets or event schedules.
const SOURCES = {
  halloween1: "https://pokemongo.com/news/halloween-part-1-2026",
  halloween2: "https://pokemongo.com/news/halloween-part-2-2026",
  chandelure: "https://pokemongo.com/news/chandelure-super-mega-raid-day-2026",
  octoberPass: "https://pokemongo.com/news/go-pass-october-2026",
  novemberPass: "https://pokemongo.com/news/go-pass-november-2026",
  dynamax: "https://leekduck.com/events/dynamax-trails-2026/"
};

const rows = value => Array.isArray(value) ? value : [];
const names = value => rows(value).map(row => String(row?.name || row || "").trim()).filter(Boolean);
const canonical = value => String(value || "").toLowerCase().replace(/\bforme\b/g, "").replace(/[^a-z0-9]+/g, "");
const RATING_ONLY_DETAIL_KEYS = ["spawns", "raidBosses", "debutPokemon", "shinies", "boostedShinyPokemon", "freeBenefits", "paidBenefits"];

const evidence = (factSet, sources) => ({ factSet, verifiedAt: "2026-10-26", sources });
function canonicalRatingOnly(fact) {
  return Object.fromEntries(Object.entries(fact.data).map(([key, value]) => [key,
    Array.isArray(value) ? value.map(row => row && typeof row === "object" ? { ...row } : row) : value]));
}
function boundedValueMatches(actual, expected) {
  if (actual === expected) return true;
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((value, index) => boundedValueMatches(actual[index], value));
  if (!expected || typeof expected !== "object") return false;
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length && keys.every(key => Object.hasOwn(actual, key) && boundedValueMatches(actual[key], expected[key]));
}
function ratingEvidenceMatches(actual, id, fact) {
  if (!actual || actual.factSet !== id || actual.verifiedAt !== "2026-10-26" ||
      !Array.isArray(actual.sources) || actual.sources.length !== 1 + (fact.extraSources || []).length ||
      !actual.sources.every((source, index) => source === [fact.source, ...(fact.extraSources || [])][index])) return false;
  const expected = canonicalRatingOnly(fact);
  return boundedValueMatches(actual.ratingOnly, expected);
}
const facts = {
  "halloween-2026-part-1": {
    match: { name: /^Pokémon GO Halloween 2026 Part I$/i, start: "2026-10-27T10:00:00", end: "2026-11-01T10:00:00", source: SOURCES.halloween1, leekduck: "https://leekduck.com/events/halloween-2026-part-1/" },
    data: {
      spawns: ["Zubat wearing a top hat", "Duskull", "Piplup wearing a Halloween costume", "Drifblim wearing a Halloween costume"].map(name => ({ name })),
      raidBosses: ["Pikachu wearing a hat and capelet", "Sinistea wearing a bow"].map(name => ({ name, tier: 1 })),
      debutPokemon: ["Pikachu wearing a hat and capelet", "Zubat wearing a top hat", "Sinistea wearing a bow"].map(name => ({ name })),
      shinies: ["Pikachu wearing a hat and capelet", "Zubat wearing a top hat", "Sinistea wearing a bow"].map(name => ({ name })),
      summary: "Costumed Pokémon, new costume variants, and a free costumed Pikachu timed reward.",
      freeBenefits: ["Free timed research encounter with costumed Pikachu", "Halloween GO Pass milestone 2× catch Candy and 2× catch Stardust"],
      paidBenefits: ["Halloween GO Pass Deluxe: 3× catch Candy and 3× catch Stardust"],
      ticketPrice: "US$7.99",
      bonuses: ["2× catch Candy", "2× catch Stardust"]
    },
    source: SOURCES.halloween1, extraSources: [SOURCES.halloween2]
  },
  "halloween-2026-part-2": {
    match: { name: /^Pokémon GO Halloween 2026 Part II$/i, start: "2026-11-01T10:00:00", end: "2026-11-05T20:00:00", source: SOURCES.halloween2, leekduck: "https://leekduck.com/events/halloween-2026-part-2/" },
    data: {
      spawns: ["Greavard", "Litwick", "Rowlet wearing a Halloween costume", "Gengar wearing a Spooky Festival costume"].map(name => ({ name })),
      debutPokemon: [{ name: "Shiny Greavard", target: "Greavard" }],
      shinies: [{ name: "Greavard" }, { name: "Pikachu wearing a hat and capelet" }, { name: "Sinistea wearing a bow" }],
      raidBosses: ["Pikachu wearing a hat and capelet", "Sinistea wearing a bow"].map(name => ({ name, tier: 1 })),
      summary: "Shiny Greavard debuts and is available in the wild, Field Research, and GO Pass tasks.",
      freeBenefits: ["Halloween GO Pass milestone 2× catch Candy and 2× catch Stardust"],
      paidBenefits: ["Halloween GO Pass Deluxe: 3× catch Candy and 3× catch Stardust"],
      ticketPrice: "US$7.99",
      bonuses: ["2× catch Candy", "2× catch Stardust"]
    },
    source: SOURCES.halloween2, extraSources: [SOURCES.halloween1]
  },
  "halloween-go-pass-2026": {
    match: { name: /^Halloween GO Pass$/i, start: "2026-10-27T10:00:00", end: "2026-11-05T20:00:00", source: SOURCES.halloween1, leekduck: "https://leekduck.com/events/halloween-2026-part-1/" },
    data: {
      summary: "Halloween GO Pass milestone rewards include 2× catch Candy and 2× catch Stardust for free players.",
      freeBenefits: ["Milestone 2× catch Candy", "Milestone 2× catch Stardust"],
      paidBenefits: ["Deluxe milestone 3× catch Candy", "Deluxe milestone 3× catch Stardust"],
      ticketPrice: "US$7.99",
      bonuses: ["2× catch Candy", "2× catch Stardust"]
    },
    source: SOURCES.halloween1, extraSources: [SOURCES.halloween2]
  },
  "chandelure-super-mega-raid-day-2026": {
    match: { name: /^Chandelure Super Mega Raid Day$/i, start: "2026-10-31T14:00:00", end: "2026-10-31T17:00:00", source: SOURCES.chandelure, leekduck: "https://leekduck.com/events/chandelure-super-mega-raid-day-2026/" },
    data: {
      raidBosses: [{ name: "Mega Chandelure", tier: "Super Mega" }],
      debutPokemon: [{ name: "Mega Chandelure" }],
      shinies: [{ name: "Chandelure" }],
      boostedShinyPokemon: [{ name: "Chandelure" }],
      summary: "Mega Chandelure debuts in Super Mega Raids; Shiny Chandelure has an increased chance.",
      freeBenefits: ["Up to six free Raid Passes", "Mega Level 1 unlocked when Chandelure is caught"],
      paidBenefits: ["Optional event ticket benefits"],
      ticketPrice: "US$4.99",
      bonuses: ["Up to six free Raid Passes", "Increased chance to encounter Shiny Chandelure"]
    },
    source: SOURCES.chandelure
  },
  "go-pass-october-2026": {
    match: { name: /^GO Pass: October$/i, start: "2026-10-06T10:00:00.000", end: "2026-11-03T10:00:00.000", source: SOURCES.octoberPass, leekduck: "https://leekduck.com/events/go-pass-october-2026/" },
    data: {
      debutPokemon: [], shinies: [{ name: "Kyogre" }],
      summary: "Free GO Pass includes a Shiny-eligible Kyogre encounter and milestone rewards.",
      freeBenefits: ["Free Kyogre encounter, which can be Shiny", "Milestones add trade Candy, gifts, doubled Daily Adventure Incense, and increased hatch XP and Stardust"],
      paidBenefits: ["Optional GO Pass Deluxe rewards"], ticketPrice: "US$7.99",
      bonuses: ["Milestones add trade Candy", "Milestones add gifts", "2× Daily Adventure Incense duration", "Increased hatch XP and Stardust"]
    },
    source: SOURCES.octoberPass
  },
  "go-pass-november-2026": {
    match: { name: /^GO Pass: November$/i, start: "2026-11-03T10:00:00.000", end: "2026-12-01T10:00:00.000", source: SOURCES.novemberPass, leekduck: "https://leekduck.com/events/go-pass-november-2026/" },
    data: {
      debutPokemon: [], shinies: [{ name: "Groudon" }],
      summary: "Free GO Pass includes a Shiny-eligible Groudon encounter, 400 PokéCoins, and milestone rewards.",
      freeBenefits: ["Free Groudon encounter, which can be Shiny", "400 PokéCoins", "Milestones add trade Candy, gifts, doubled Daily Adventure Incense, and increased hatch XP and Stardust"],
      paidBenefits: ["Optional GO Pass Deluxe rewards"], ticketPrice: "US$7.99",
      bonuses: ["Milestones add trade Candy", "Milestones add gifts", "2× Daily Adventure Incense duration", "Increased hatch XP and Stardust"]
    },
    source: SOURCES.novemberPass
  }
};

function normalizedSource(value) {
  try { const url = new URL(value); return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}/`; }
  catch { return ""; }
}
function trustedSource(event, match) {
  const candidates = [event.link, event.sourceUrl, ...rows(event.sourceLinks).map(item => item?.href || item?.url), ...rows(event.sources).map(item => typeof item === "string" ? item : item?.url || item?.href)];
  const allowed = [match.source, match.leekduck].map(normalizedSource);
  return candidates.some(candidate => allowed.includes(normalizedSource(candidate)));
}
function exactTimestamp(value, expected) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)?$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  // Validate calendar components (Date.parse normalizes some invalid dates).
  const date = value.slice(0, 10);
  const [year, month, day] = date.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return false;
  // Source-confirmed event endpoints are floating local times or explicit UTC timestamps.
  return date === expected.slice(0, 10) && value.slice(11, 19) === expected.slice(11, 19);
}
function exactMatch(event, match) {
  return Boolean(event && match.name.test(String(event.name || ""))
    && exactTimestamp(event.start, match.start) && exactTimestamp(event.end, match.end)
    && trustedSource(event, match));
}

export function gradingEventView(event) {
  if (!event || typeof event !== "object") return event;
  const id = String(event.id || "");
  const fact = facts[id];
  if (!fact || !exactMatch(event, fact.match)) return event;
  const view = { ...event };
  view.details = event.details && typeof event.details === "object" ? { ...event.details } : {};
  for (const [key, value] of Object.entries(fact.data)) {
    if (key === "bonuses") {
      const freeBonuses = value.map(row => typeof row === "object" ? { ...row } : row);
      view.bonuses = freeBonuses;
      view.details.bonuses = freeBonuses.map(row => row && typeof row === "object" ? { ...row } : row);
    }
    else if (key === "summary") view.summary = value;
    else if (key === "ticketPrice") view.ticketPrice = value;
    else if (key === "paidBenefits" || key === "freeBenefits") {
      view[key] = value.slice();
      view.details[key] = value.slice();
    }
    else if (Array.isArray(value)) view.details[key] = value.map(row => typeof row === "object" ? { ...row } : row);
  }
  view.ticketRequired = false;
  view.mainValueRequiresTicket = false;
  view.details.ratingEvidence = evidence(id, [fact.source, ...(fact.extraSources || [])]);
  return view;
}

// Publish verified facts separately from gameplay targets. The output is a
// shallow event/details projection; all fact arrays are bounded to this table.
export function publishGradingEvidence(event) {
  if (!event || typeof event !== "object") return event;
  const id = String(event.id || ""), fact = facts[id];
  if (!fact || !exactMatch(event, fact.match)) return event;
  const ratingView = gradingEventView(event);
  if (ratingView === event) return event;
  const nextEvidence = { ...ratingView.details.ratingEvidence, ratingOnly: canonicalRatingOnly(fact) };
  const existing = event.details?.ratingEvidence;
  if (ratingEvidenceMatches(existing, id, fact)) {
    return event;
  }
  const published = {
    ...event,
    details: {
      ...(event.details || {}),
      ratingEvidence: nextEvidence
    }
  };
  return published;
}

function timestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)?$/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const hour = Number(value.slice(11, 13)), minute = Number(value.slice(14, 16)), second = Number(value.slice(17, 19));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null;
  const explicit = /(?:Z|[+-]\d\d:\d\d)$/.test(value);
  const epoch = Date.parse(explicit ? value : `${value}Z`);
  return Number.isFinite(epoch) ? { epoch, explicit } : null;
}
function compatibleEvents(a, b) {
  const scope = event => String(event.scope || "").trim().toLowerCase();
  if (!scope(a) || scope(a) !== scope(b)) return false;
  if (scope(a) === "regional" && String(a.location || "").trim().toLowerCase() !== String(b.location || "").trim().toLowerCase()) return false;
  const localA = a.localTime === true, localB = b.localTime === true;
  if (localA !== localB) return false;
  if (localA && String(a.timeZone || "") !== String(b.timeZone || "")) return false;
  return true;
}
function ratingParentProjection(parent) {
  const detailKeys = ["spawns", "raidBosses", "maxBattleBosses", "shinies", "debutPokemon", "research", "researchMethods", "boostedShinyPokemon", "backgroundPokemon", "freeBenefits", "paidBenefits", "bonuses", "ticketPrice", "raidTier", "spotlight"];
  const details = {};
  for (const key of detailKeys) {
    const value = parent.details?.[key];
    if (Array.isArray(value)) details[key] = value.map(row => row && typeof row === "object" ? { ...row } : row);
    else if (value !== undefined) details[key] = value;
  }
  if (details.raidTier === undefined && /in 5-star raid battles/i.test(String(parent.name || ""))) details.raidTier = 5;
  return { id: parent.id, name: parent.name, heading: parent.heading, summary: parent.summary, eventType: parent.eventType,
    start: parent.start, end: parent.end, timeZone: parent.timeZone, localTime: parent.localTime, scope: parent.scope,
    location: parent.location, eventAccess: parent.eventAccess, specialBackground: parent.specialBackground, costumePokemon: parent.costumePokemon,
    ticketRequired: parent.ticketRequired, mainValueRequiresTicket: parent.mainValueRequiresTicket, ticketPrice: parent.ticketPrice,
    bonuses: rows(parent.bonuses).slice(), details };
}
function raidHourBossNames(event) {
  const explicit = names(event.details?.raidBosses);
  if (explicit.length) return explicit;
  // The Raid Hour title is a fallback identity only when it names the whole rotation.
  const title = String(event.name || "").replace(/\s+Raid Hour$/i, "").trim();
  const groupedFormes = /^(.*?)\s+\(([^()]+)\s+Formes\)$/i.exec(title);
  if (groupedFormes) {
    const forms = groupedFormes[2].replace(/,\s*and\s+/i, ", ").split(/\s*,\s*|\s+and\s+/i).map(form => form.trim()).filter(Boolean);
    const unique = new Set(forms.map(canonical));
    if (forms.length < 2 || unique.size !== forms.length || forms.some(form => /\b(?:and|forme|formes)\b/i.test(form))) return [];
    return forms.map(form => `${groupedFormes[1].trim()} (${form})`);
  }
  return title.split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean);
}
function matchingRotation(hour, events) {
  if (!/^raid-hour$/i.test(String(hour.eventType || ""))) return null;
  const start = timestamp(hour.start), end = timestamp(hour.end);
  if (!start || !end || start.explicit !== end.explicit || end.epoch <= start.epoch) return null;
  const requested = raidHourBossNames(hour).map(canonical).filter(Boolean);
  if (!requested.length) return null;
  const candidates = events.filter(parent => {
    if (parent === hour || String(parent.eventType || "").toLowerCase() !== "raid-battles" ||
        !/in 5-star raid battles/i.test(String(parent.name || ""))) return false;
    if (!compatibleEvents(hour, parent)) return false;
    const ps = timestamp(parent.start), pe = timestamp(parent.end);
    if (!ps || !pe || ps.explicit !== pe.explicit || ps.explicit !== start.explicit || ps.epoch > start.epoch || pe.epoch < end.epoch) return false;
    const bosses = names(parent.details?.raidBosses).map(canonical).filter(Boolean);
    const matched = requested.filter(name => bosses.includes(name));
    return matched.length > 0 && matched.length === bosses.length && matched.length === requested.length;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

export function attachRaidHourGradingEvidence(events) {
  if (!Array.isArray(events)) return events;
  return events.map(event => {
    const parent = matchingRotation(event, events);
    if (!parent) return event;
    const view = { ...event };
    view.details = { ...(event.details || {}), ratingParentEvent: ratingParentProjection(parent) };
    return view;
  });
}
