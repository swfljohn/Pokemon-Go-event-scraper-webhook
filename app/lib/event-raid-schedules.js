// Reviewed against the official Mega Finale schedule on 2026-09-04.
// Keep each repeat separate: flattening bosses loses their availability.
export const MEGA_FINALE_SOURCE = "https://pokemongo.com/gofest/megafinale";
export const MEGA_FINALE_ID = "pokemon-go-fest-2026-mega-finale";
export const FINALE_HABITATS = [
  ["Verdant Overgrowth", ["Mega Beedrill", "Mega Victreebel", "Mega Pinsir", "Mega Abomasnow"]],
  ["Mindworks Canal", ["Mega Alakazam", "Mega Slowbro", "Mega Starmie", "Mega Medicham"]],
  ["Eerie Alley", ["Mega Gengar", "Mega Houndoom", "Mega Banette", "Mega Malamar"]],
  ["Circuit Plaza", ["Mega Raichu X", "Mega Ampharos", "Mega Manectric"]],
  ["Iron Frostworks", ["Mega Steelix", "Mega Skarmory", "Mega Aggron", "Mega Glalie"]],
  ["Battle District", ["Mega Sharpedo", "Mega Camerupt", "Mega Lopunny", "Mega Falinks"]],
  ["Skyline Roosts", ["Mega Gyarados", "Mega Aerodactyl", "Mega Dragonite", "Mega Altaria"]],
  ["Prism Promenade", ["Mega Raichu Y", "Mega Sableye", "Mega Mawile", "Mega Audino"]]
];

export function reviewedRaidSchedule(eventId) {
  if (eventId !== MEGA_FINALE_ID) return null;
  return {
    sourceUrl: MEGA_FINALE_SOURCE,
    verifiedDate: "2026-09-04",
    sourceKind: "reviewed",
    localTime: true,
    note: "These are the announced habitat raid windows, not live Gym sightings. Each habitat repeats twice. Mega Mewtwo X is Saturday only; Mega Mewtwo Y is Sunday only. Raids outside these windows are not covered by this timetable.",
    windows: FINALE_HABITATS.flatMap(([label, names], index) => {
      const date = index < 4 ? "2026-09-05" : "2026-09-06";
      return [10 + index % 4, 14 + index % 4].map(hour => ({
        label,
        start: `${date}T${hour}:00:00`, end: `${date}T${hour + 1}:00:00`,
        bosses: names.map(name => ({ name })),
        superBosses: [{ name: index < 4 ? "Mega Mewtwo X" : "Mega Mewtwo Y" }]
      }));
    }).sort((a, b) => a.start.localeCompare(b.start))
  };
}

const plain = html => String(html || "").replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** Fail closed when the publisher's tab structure no longer identifies all eight habitats. */
export function parseMegaFinaleSchedule(html) {
  const source = String(html || "");
  if (source.length > 1_000_000 || !/September 5 and 6, 2026/.test(plain(source))) return null;
  const tabs = [...source.matchAll(/class="[^"]*_tabLabel_[^"]*"[^>]*>\s*<b>([^<]+)<\/b>/g)]
    .map(match => plain(match[1]));
  if (FINALE_HABITATS.some(([label], index) => tabs[index] !== label)) return null;
  const callouts = [...source.matchAll(/class="[^"]*_groupCallout_[^"]*"[^>]*>([\s\S]*?)<\/div>/g)];
  const timed = callouts.filter(match => /\d+:\d+\s*[ap]\.m\./.test(plain(match[1])));
  if (timed.length !== 8) return null;
  const windows = [];
  for (const [index, match] of timed.entries()) {
    const times = [...plain(match[1]).matchAll(/(\d{1,2}):(\d{2})\s*([ap])\.m\./g)].map(time => {
      const hour = Number(time[1]), minute = Number(time[2]);
      return hour >= 1 && hour <= 12 && minute <= 59 ? `${String(hour % 12 + (time[3] === "p" ? 12 : 0)).padStart(2, "0")}:${time[2]}:00` : null;
    });
    if (times.length !== 4 || times.some(time => !time) || times[0] >= times[1] || times[1] > times[2] || times[2] >= times[3]) return null;
    const next = callouts.find(row => row.index > match.index);
    const block = source.slice(match.index, next?.index ?? source.length);
    const headings = [...block.matchAll(/class="[^"]*_groupHeadingWrapper_[^"]*"[\s\S]*?class="[^"]*_size:subheading_[^"]*"[^>]*>(.*?)<\/div>/g)];
    const groups = {};
    for (const [i, heading] of headings.entries()) {
      const body = block.slice(heading.index, headings[i + 1]?.index ?? block.length);
      const names = [...body.matchAll(/class="[^"]*_groupLabelWrapper_[^"]*"[^>]*>\s*<div>([\s\S]*?)<\/div>/g)]
        .map(row => plain(row[1])).filter(name => name && name.length <= 100);
      groups[plain(heading[1])] = [...new Set(names)].slice(0, 30).map(name => ({ name }));
    }
    const bosses = groups["Mega Raids"], superBosses = groups["Super Mega Raids"];
    if (!bosses?.length || !superBosses?.length || bosses.some(row => !row.name.startsWith("Mega "))) return null;
    const expectedSuper = index < 4 ? "Mega Mewtwo X" : "Mega Mewtwo Y";
    if (superBosses.length !== 1 || superBosses[0].name !== expectedSuper) return null;
    const date = index < 4 ? "2026-09-05" : "2026-09-06";
    for (const offset of [0, 2]) windows.push({
      label: tabs[index], start: `${date}T${times[offset]}`, end: `${date}T${times[offset + 1]}`,
      bosses, superBosses, spawns: groups["Wild Encounters"] || []
    });
  }
  return { ...reviewedRaidSchedule(MEGA_FINALE_ID), sourceKind: "scraped", windows: windows.sort((a, b) => a.start.localeCompare(b.start)) };
}

export function raidScheduleFeaturedDetails(eventId) {
  const schedule = reviewedRaidSchedule(eventId);
  if (!schedule) return null;
  return {
    summary: "September 5 and 6, 10 AM–6 PM each day in the event location. Eight habitats have separate raid lineups, with two one-hour appearances each. See the schedule for exact bosses and timezone conversions.",
    bonuses: [], sections: [],
    details: { raidSchedule: schedule, raidBosses: [...new Set(schedule.windows.flatMap(row => [...row.bosses, ...row.superBosses].map(boss => boss.name)))].map(name => ({ name })) },
    sourceLinks: [{ label: "Official Mega Finale schedule", href: MEGA_FINALE_SOURCE }, { label: "LeekDuck schedule", href: "https://leekduck.com/gofest/schedule/" }]
  };
}
