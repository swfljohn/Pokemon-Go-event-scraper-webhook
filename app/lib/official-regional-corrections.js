// Reviewed corrections for rows promoted from official regional news articles (2026-11-09 calendar audit).
// The article parser is deliberately generic; these rules fix what it cannot know: a date range that was
// advertising rather than gameplay, a zh-Hant article that is about Hong Kong rather than Taiwan, the same
// article promoted once per language, and a range stored as one card per day. They run on the stored rows at
// merge time, so rows already in the discovery cache are corrected without a re-crawl.

const SOURCE_LABEL = "Official Pokémon GO regional announcement · reviewed";
const sourceLinks = href => [{ label: "Official Pokémon GO regional announcement", href }];

function slugOf(event) {
  try { return new URL(String(event?.link || "")).pathname.split("/").filter(Boolean).pop() || ""; } catch { return ""; }
}

function englishLink(event) {
  try { return /^\/(?:en\/)?(?:news|post)\//.test(new URL(String(event?.link || "")).pathname); } catch { return false; }
}

// Articles that publish dates but no upcoming gameplay of their own.
export const OFFICIAL_REGIONAL_SKIPPED_SLUGS = new Map([
  // In-person extras ran November 6–8, 2026; "November 1–23" is citywide advertising, not a rally.
  ["gowa_cdmx_additional_info", "Activities ended November 8, 2026; the later range is advertising."],
  // The Kaohsiung and Los Angeles Tour cards already come from the structured source.
  ["save-the-date-go-tour-2027", "Covered by the Pokémon GO Tour: Alola cards."]
]);

const APAC_MEETUP_VENUES = [
  "South Korea — Suwon: Time Villas Suwon · 10:00–18:00",
  "Taiwan — Taipei: Shin Kong Mitsukoshi Taipei Xinyi Place A11, 1F south entrance · 11:00–22:00",
  "Hong Kong — Kowloon: Festival Walk · 11:00–21:00",
  "India — Bengaluru: Freedom Park · 10:00–18:00",
  "India — Kolkata: City Center 1, Salt Lake · 10:00–18:00",
  "India — Mumbai: Carter Road, Bandra West · 10:00–18:00",
  "Australia — Melbourne: Westfield Fountain Gate · 10:00–17:00",
  "Indonesia — Jakarta: Agora Mall L2 Atrium · 10:00–18:00",
  "Indonesia: Taman Ismail Marzuki Promenade · 10:00–18:00",
  "Thailand — Bangkok: Chamchuri Square · 10:00–18:00",
  "Malaysia — Kuala Lumpur: Ombak KLCC · 10:00–18:00",
  "Philippines — Pasay City: Amphitheatre, MOA Sky, Mall of Asia · 10:00–18:00"
];

function reviewed(sample, fields) {
  return {
    heading: "Official Regional Event", eventType: "local-partnership", species: [], hasSpawns: false,
    coordinates: "", scope: "venue", startingSoonAlert: false, ticketRequired: false,
    specialBackground: false, costumePokemon: false,
    imageUrl: sample?.imageUrl || "",
    venueNote: "Venue and hours are taken from the official announcement. No coordinates are published until the venue is in the verified venue map.",
    sourceLabel: SOURCE_LABEL,
    ...fields,
    details: { ...(fields.details || {}), sourceLinks: sourceLinks(fields.link), detailCheckedAt: "2026-11-09" }
  };
}

// slug -> one reviewed card replacing every parsed row for that article, in any language.
const REVIEWED = new Map([
  ["2026hk-fw", sample => reviewed(sample, {
    id: "local-official-2026hk-fw",
    name: "Pokémon GO at Festival Walk — Hong Kong",
    start: "2026-11-09T10:00:00+08:00", end: "2027-01-03T23:59:00+08:00",
    link: "https://pokemongo.com/zh_Hant/news/2026hk-fw",
    location: "Festival Walk, 80 Tat Chee Avenue, Kowloon Tong, Hong Kong", timeZone: "Asia/Hong_Kong",
    bonuses: [
      "Venue Timed Research with event-themed encounters; claim once, expires 10 days after claiming.",
      "Lure Modules last four hours in the designated area.",
      "10th anniversary postcard at the Pokémon GO booth from November 11, daily 11:00–19:00, while supplies last."
    ],
    scheduleNote: "November 9, 2026 10:00 to January 3, 2027 23:59 Hong Kong time. Postcard booth daily 11:00–19:00 from November 11; Wild Area weekend booth November 14–15, 11:00–21:00.",
    details: { sections: [{ title: "Official announcement details", items: [
      "Timed Research is available at the venue from November 9, 10:00 to January 3, 23:59 Hong Kong time.",
      "Postcard: show the game at the booth, November 11–January 3, daily 11:00–19:00, while supplies last.",
      "Pokémon GO Wild Area: Global weekend at the venue: November 14–15, 11:00–21:00 (in-game event hours 10:00–18:00)."
    ] }] }
  })],
  ["gowildtw-2026skm", sample => reviewed(sample, {
    id: "local-official-gowildtw-2026skm",
    name: "Pokémon GO Wild Area: Global — Shin Kong Mitsukoshi Taipei",
    start: "2026-11-14T11:00:00+08:00", end: "2026-11-15T22:00:00+08:00",
    link: "https://pokemongo.com/zh_Hant/news/gowildtw-2026skm",
    location: "Shin Kong Mitsukoshi Taipei Xinyi Place A11 (1F south gate), Taipei, Taiwan", timeZone: "Asia/Taipei",
    bonuses: [
      "Event postcard for showing the game at the booth, while supplies last.",
      "Event folder at the main venue for sharing an event post, while supplies last."
    ],
    scheduleNote: "November 14–15, 2026. Booth open 11:00–22:00 Taiwan time; in-game event hours are 10:00–18:00.",
    details: { sections: [{ title: "Official announcement details", items: [
      "Main venue: Pokémon GO booth, 1F south gate, Shin Kong Mitsukoshi Taipei Xinyi Place A11, 11:00–22:00 both days.",
      "Other Shin Kong Mitsukoshi stores across Taiwan and SKM Park Outlets Kaohsiung hand out the postcard during store hours.",
      "Local Community Ambassadors are at the main venue."
    ] }] }
  })],
  ["community-meetups-go-wild-area-2026-details-asia-pacific", sample => reviewed(sample, {
    id: "local-official-community-meetups-go-wild-area-2026-apac",
    name: "Pokémon GO Wild Area: Global Community Meetups — Asia-Pacific",
    start: "2026-11-14T10:00:00", end: "2026-11-15T22:00:00", localTime: true,
    link: "https://pokemongo.com/news/community-meetups-go-wild-area-2026-details-asia-pacific",
    location: "12 venues across Asia-Pacific (listed below)", timeZone: "", scope: "regional",
    bonuses: ["Official community meetups at 12 Asia-Pacific venues on both days of Pokémon GO Wild Area: Global."],
    scheduleNote: "November 14 and 15, 2026. Hours are each venue's local time and differ by venue.",
    details: { sections: [{ title: "Venues and hours (local time, both days)", items: APAC_MEETUP_VENUES }] }
  })]
]);

const DAY_MS = 86_400_000;
const allDay = event => {
  const start = String(event?.start || "").match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?(.*)$/);
  const end = String(event?.end || "").match(/^(\d{4}-\d{2}-\d{2})T23:59:59(?:\.\d+)?(.*)$/);
  return start && end && start[1] === end[1] && start[2] === end[2] ? { date: start[1], suffix: start[2] } : null;
};

// One card per run of consecutive all-day rows from the same article, name and place.
function mergeDailyRuns(events) {
  const output = [];
  const open = new Map();
  for (const event of events) {
    const day = allDay(event);
    if (!day) { output.push(event); continue; }
    const key = `${slugOf(event)}|${event.name}|${event.location}|${day.suffix}`;
    const run = open.get(key);
    if (run && Date.parse(`${day.date}T00:00:00Z`) - Date.parse(`${run.lastDate}T00:00:00Z`) === DAY_MS) {
      run.event.end = event.end;
      run.lastDate = day.date;
      run.event.scheduleNote = `The official regional announcement publishes ${run.firstDate}–${day.date} but does not publish gameplay hours; check the source before traveling.`;
      continue;
    }
    const copy = { ...event };
    output.push(copy);
    open.set(key, { event: copy, firstDate: day.date, lastDate: day.date });
  }
  return output;
}

export function correctOfficialRegionalEvents(events, now = Date.now()) {
  const rows = (Array.isArray(events) ? events : []).filter(event => event && typeof event === "object");
  const bySlug = new Map();
  for (const event of rows) {
    const slug = slugOf(event);
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(event);
  }
  const corrected = [];
  for (const [slug, group] of bySlug) {
    if (slug && OFFICIAL_REGIONAL_SKIPPED_SLUGS.has(slug)) continue;
    const build = slug ? REVIEWED.get(slug) : null;
    if (build) {
      const card = build(group.find(englishLink) || group[0]);
      const end = Date.parse(card.end);
      // Local-time cards have no offset; keep them until a full day after the stated end anywhere on Earth.
      if (!Number.isFinite(end) || end + (card.localTime ? DAY_MS : 0) >= now) corrected.push(card);
      continue;
    }
    // The same article promoted from several languages: the English one carries the English title.
    const english = group.filter(englishLink);
    const kept = english.length && english.length < group.length ? english : group;
    corrected.push(...mergeDailyRuns([...kept].sort((left, right) => String(left.start).localeCompare(String(right.start)))));
  }
  return corrected;
}
