// Plain-text event announcement for Discord (2026-10-29). One post per event, sectioned like a community
// event-info channel, with no emoji or custom symbols: some servers strip or forbid them. Uses only Discord
// markdown (**bold**, "- " lists) and the event data already on the calendar.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_POST = 1900;

const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
const list = value => (Array.isArray(value) ? value : []).filter(Boolean);
const unique = values => [...new Map(values.filter(Boolean).map(value => [value.toLocaleLowerCase(), value])).values()];

// "2026-11-21T14:00:00.000" as written (event-local wall clock) or with an offset (absolute).
function wallClock(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(value || ""));
  if (!match) return null;
  const [, year, month, day, hour = "0", minute = "0"] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute));
  return { date, year: +year, month: +month - 1, day: +day, hour: +hour, minute: +minute };
}
const dayLabel = t => `${DAYS[t.date.getUTCDay()]}, ${MONTHS[t.month]} ${t.day}`;
function timeLabel(t, withPeriod = true) {
  const period = t.hour < 12 ? "AM" : "PM";
  const hour = t.hour % 12 || 12;
  return `${hour}${t.minute ? `:${String(t.minute).padStart(2, "0")}` : ""}${withPeriod ? ` ${period}` : ""}`;
}

export function announcementWhen(event) {
  const start = wallClock(event?.start), end = wallClock(event?.end);
  if (!start) return "";
  const suffix = event?.localTime === false ? "" : " local time";
  const sameDay = end && start.year === end.year && start.month === end.month && start.day === end.day;
  if (sameDay) {
    const samePeriod = (start.hour < 12) === (end.hour < 12);
    return `${dayLabel(start)} · ${timeLabel(start, !samePeriod)}–${timeLabel(end)}${suffix}`;
  }
  if (!end) return `${dayLabel(start)} at ${timeLabel(start)}${suffix}`;
  return `${dayLabel(start)} at ${timeLabel(start)} to ${dayLabel(end)} at ${timeLabel(end)}${suffix}`;
}

const names = rows => unique(list(rows).map(row => clean(typeof row === "string" ? row : row?.name)));

function sectionLines(title, lines) {
  const body = list(lines).map(clean).filter(Boolean);
  return body.length ? [`**${title}**`, ...body.map(line => `- ${line}`), ""] : [];
}

// Event facts, preferring the published details and falling back to the reviewed announcement summary.
export function eventFacts(event) {
  const details = event?.details || {};
  const reviewed = details.ratingEvidence?.ratingOnly || {};
  const parent = details.ratingParentEvent?.details || {};
  const raidTier = details.raidTier || parent.raidTier;
  const raidBosses = list(details.raidBosses).length ? details.raidBosses
    : list(parent.raidBosses).length ? parent.raidBosses.map(row => ({ ...row, tier: row.tier || raidTier }))
    : reviewed.raidBosses;
  return {
    spawns: list(details.spawns).length ? details.spawns : reviewed.spawns,
    shinies: unique([...names(details.shinies), ...names(parent.shinies), ...names(reviewed.shinies)]),
    debuts: names(reviewed.debutPokemon),
    raids: list(raidBosses).map(row => ({ name: clean(row?.name), tier: row?.tier || raidTier || null })).filter(row => row.name),
    maxBattles: names(details.maxBattleBosses),
    spotlight: details.spotlight,
    research: list(details.research),
    bonuses: unique([...list(event?.bonuses), ...list(reviewed.bonuses)].map(clean)),
    notes: list(details.bonusNotes).map(note => clean(note).replace(/^\*\s*/, "")),
    free: list(reviewed.freeBenefits).map(clean),
    paid: list(reviewed.paidBenefits).map(clean),
    ticketPrice: clean(reviewed.ticketPrice || "")
  };
}

function shinyMark(name, shinies) {
  return shinies.some(value => value.toLocaleLowerCase() === name.toLocaleLowerCase()) ? `${name} (shiny)` : name;
}

// The post links to the event's own page on the site (2026-10-29), never to the source feed.
export function eventAnnouncementUrl(event, siteUrl = defaultSiteUrl()) {
  const base = String(siteUrl || defaultSiteUrl()).replace(/\/+$/, "");
  const id = clean(event?.calendarAliasOf || event?.id);
  return id ? `${base}/events?event=${encodeURIComponent(id)}` : `${base}/events`;
}

export function eventAnnouncementText(event, { includeLink = true, siteUrl } = {}) {
  const f = eventFacts(event);
  const lines = [`**${clean(event?.name)}**`];
  const when = announcementWhen(event);
  if (when) lines.push(when);
  if (event?.scope && event.scope !== "global" && event.location) lines.push(clean(event.location));
  if (event?.ticketRequired) lines.push(`Ticket required${f.ticketPrice ? `: ${f.ticketPrice}` : ""}`);
  lines.push("");

  if (f.spotlight?.name) {
    lines.push(...sectionLines("Spotlight", [
      `${shinyMark(clean(f.spotlight.name), f.shinies)}${f.spotlight.bonus ? ` · ${clean(f.spotlight.bonus)}` : ""}`
    ]));
  } else {
    lines.push(...sectionLines("Wild", names(f.spawns).map(name => shinyMark(name, f.shinies))));
  }
  const tiers = new Map();
  for (const raid of f.raids) {
    const key = raid.tier ? `Tier ${raid.tier}` : "Raids";
    tiers.set(key, [...(tiers.get(key) || []), shinyMark(raid.name, f.shinies)]);
  }
  for (const [tier, bosses] of tiers) lines.push(...sectionLines(tier === "Raids" ? "Raids" : `${tier} Raids`, unique(bosses)));
  lines.push(...sectionLines("Max Battles", f.maxBattles.map(name => `Dynamax ${name.replace(/^Dynamax\s+/i, "")}`)));
  const shownShinies = new Set([...names(f.spawns), ...f.raids.map(row => row.name), ...(f.spotlight?.name ? [f.spotlight.name] : [])]
    .map(name => name.toLocaleLowerCase()));
  const extraShinies = f.shinies.filter(name => !shownShinies.has(name.toLocaleLowerCase()));
  if (extraShinies.length) lines.push(...sectionLines("Shiny", extraShinies));
  if (f.debuts.length) lines.push(...sectionLines("Debuts", f.debuts));
  if (!f.spotlight?.bonus) lines.push(...sectionLines("Bonuses", f.bonuses));
  if (f.notes.length) lines.push(...sectionLines("Notes", f.notes));
  if (f.research.length) {
    // Encounters only; item rewards ("Ultra Ball ×20") are left to the linked details.
    const encounters = unique(f.research.flatMap(step => list(step.tasks).map(task => clean(task.reward))))
      .filter(reward => reward && !/×|\d/.test(reward));
    lines.push(...sectionLines(`Timed Research (${f.research.length} step${f.research.length === 1 ? "" : "s"})`,
      encounters.length ? [`Encounters: ${encounters.join(", ")}`] : []));
  }
  if (f.free.length) lines.push(...sectionLines("Free", f.free));
  if (f.paid.length) lines.push(...sectionLines(`Paid${!event?.ticketRequired && f.ticketPrice ? ` (${f.ticketPrice})` : ""}`, f.paid));
  if (includeLink) lines.push(`Details: <${eventAnnouncementUrl(event, siteUrl)}>`);
  let text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length > MAX_POST) text = `${text.slice(0, MAX_POST - 1).replace(/\n[^\n]*$/, "")}\n…`;
  return text;
}

// Discord embed form (bot DMs must be embeds): the event name is the title, linked to the site page.
export function eventAnnouncementEmbed(event, { siteUrl, color = 0x7d3cff } = {}) {
  const text = eventAnnouncementText(event, { includeLink: false, siteUrl });
  const body = text.split("\n").slice(1).join("\n").trim();
  return {
    title: clean(event?.name).slice(0, 256),
    url: eventAnnouncementUrl(event, siteUrl),
    description: `${body}\n\n[Event page](${eventAnnouncementUrl(event, siteUrl)})`.slice(0, 4000),
    color,
    footer: { text: siteName() }
  };
}

// Next global events by start time (for previews and first-appearance announcements).
export function upcomingAnnouncementEvents(calendarEvents, now = Date.now(), { limit = 3, horizonDays = 21 } = {}) {
  const startAt = event => {
    const t = wallClock(event?.start);
    return t ? t.date.getTime() : NaN;
  };
  return list(calendarEvents)
    .filter(event => event?.scope === "global" && Number.isFinite(startAt(event)))
    .filter(event => startAt(event) > now - 12 * 3600e3 && startAt(event) < now + horizonDays * 86400e3)
    .sort((a, b) => startAt(a) - startAt(b))
    .slice(0, limit);
}
