// Dates Pokémon GO has announced before the event itself has a page (official "Save the dates" posts).
// Each row is a placeholder: it leaves the calendar as soon as the structured source lists an event of the
// same kind on that date.
const SOURCE = "https://pokemongo.com/news/save-the-date-s25";
const KINDS = {
  "community-day": ["Community Day", "Community Day"],
  "community-day-classic": ["Community Day Classic", "Community Day"],
  "max-battles": ["Max Battle Day", "Max Battles"],
  "raid-day": ["Raid Day", "Raid Day"],
  "super-mega-raid-day": ["Super Mega Raid Day", "Raid Day"],
  "hatch-day": ["Hatch Day", "Event"]
};
const EVENT_TYPE = { "community-day-classic": "community-day", "super-mega-raid-day": "raid-day", "hatch-day": "event" };
const DATES = [
  ["max-battles", "2026-12-05"], ["community-day", "2026-12-12", "2026-12-13"], ["raid-day", "2026-12-19"],
  ["hatch-day", "2026-12-26"], ["community-day-classic", "2027-01-02"], ["super-mega-raid-day", "2027-01-09"],
  ["community-day", "2027-01-16"], ["max-battles", "2027-01-23"], ["super-mega-raid-day", "2027-01-30"],
  ["community-day", "2027-02-06"], ["raid-day", "2027-02-13"]
];
const label = date => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

export const SAVE_THE_DATE_EVENTS = DATES.map(([kind, first, last = first]) => {
  const [name, heading] = KINDS[kind];
  const when = first === last ? label(first) : `${label(first)}–${label(last).split(" ")[1]}`;
  return {
    id: `local-save-the-date-${kind}-${first}`,
    name: `${name} — ${when} (details to be announced)`,
    heading, eventType: EVENT_TYPE[kind] || kind,
    start: `${first}T00:00:00`, end: `${last}T23:59:59`, localTime: true,
    link: SOURCE, imageUrl: "", species: [], bonuses: [],
    summary: "Date announced by Pokémon GO. Featured Pokémon, bonuses and hours are not published yet.",
    hasSpawns: false, location: "Global", coordinates: "", timeZone: "", scope: "global",
    sourceLabel: "Official Pokémon GO save-the-date",
    scheduleNote: "Only the date is announced so far; hours are not published.",
    venueNote: "", ticketRequired: false, specialBackground: false, costumePokemon: false, startingSoonAlert: false,
    saveTheDate: { eventType: EVENT_TYPE[kind] || kind, first, last },
    details: { sections: [{ title: "What is announced", items: [`${name} on ${when}.`, "This card is replaced when the full event details are published."] }],
      sourceLinks: [{ label: "Official Pokémon GO announcement", href: SOURCE }], detailCheckedAt: "2026-11-09" }
  };
});

// True when the structured source already lists an event of the same kind overlapping the placeholder's dates.
const SAME_KIND = {
  "community-day": event => event.eventType === "community-day",
  "raid-day": event => event.eventType === "raid-day" || /raid day/i.test(event.name),
  "max-battles": event => event.eventType === "max-battles" || /max battle (?:day|weekend)/i.test(event.name),
  "event": event => /hatch day/i.test(event.name)
};
export function saveTheDateSuperseded(placeholder, sourceEvents) {
  const mark = placeholder?.saveTheDate;
  const sameKind = mark && SAME_KIND[mark.eventType];
  if (!sameKind) return false;
  return (Array.isArray(sourceEvents) ? sourceEvents : []).some(event => {
    if (!event || String(event.id || "").startsWith("local-save-the-date-")) return false;
    if (!sameKind({ eventType: String(event.eventType || ""), name: String(event.name || "") })) return false;
    const start = String(event.start || "").slice(0, 10);
    const end = String(event.end || event.start || "").slice(0, 10);
    return Boolean(start) && start <= mark.last && end >= mark.first;
  });
}
