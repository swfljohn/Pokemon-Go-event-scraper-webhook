// Whole-day review for Discord (2026-10-30): today's events first, today's raid line-up, then tomorrow and
// location-only events. One source of truth for both the plain-text webhook post and the 1080x1350 graphic. No emoji
// (some servers strip them); only data that is on the calendar; links point to this site, never to the source feed.
import { eventFacts } from "./event-announcement.js";
import { defaultTimeZone, siteHost, siteName, siteUrl as defaultSiteUrl } from "./site.js";
import { eventPokemonArtworkCandidates, eventPokemonIdentity } from "../event-visuals.js";
import { POKEMON_DEFAULT_FORM_IDS, POKEMON_SPECIES_NAMES } from "../pokemon-appearance-data.js";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HOUR = 3_600_000;

const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
const escapeHtml = value => clean(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

// Wall-clock milliseconds in the review time zone. Event-local times ("10:00 local", no offset) are already wall
// clock everywhere; absolute times (with Z/offset) are converted into the review zone.
function zoneWall(ms, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  }).formatToParts(new Date(ms)).filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}
function eventWall(value, timeZone) {
  const text = clean(value);
  if (!text) return NaN;
  if (/(?:Z|[+-]\d\d:\d\d)$/.test(text)) return zoneWall(Date.parse(text), timeZone);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(text);
  return match ? Date.UTC(+match[1], +match[2] - 1, +match[3], +(match[4] || 0), +(match[5] || 0)) : NaN;
}
const wallDate = ms => new Date(ms);
const timeText = ms => {
  const d = wallDate(ms), h = d.getUTCHours(), m = d.getUTCMinutes();
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
};
const dayText = ms => `${SHORT_DAYS[wallDate(ms).getUTCDay()]} ${SHORT_MONTHS[wallDate(ms).getUTCMonth()]} ${wallDate(ms).getUTCDate()}`;
function whenText(ms, todayStart, relative = true) {
  const days = Math.floor((ms - todayStart) / (24 * HOUR));
  const label = relative && days === 0 ? "today" : relative && days === 1 ? "tomorrow" : dayText(ms);
  return `${label}${label === "today" || label === "tomorrow" ? "" : ","} ${timeText(ms)}`;
}

// Sprite URLs. Order: the Pokémon GO icon the event source lists for that exact Pokémon; the same artwork sources as
// the event pages (forms and costumes resolved by name); Mega icons by dex; a Shadow Pokémon's base sprite with a
// shadow glow. Anything still unresolved gets no sprite and is left out of the graphic (never a stand-in picture).
const SPECIES_DEX = new Map(Object.entries(POKEMON_SPECIES_NAMES).map(([dex, name]) => [String(name).toLocaleLowerCase(), Number(dex)]));
const MEGA_ICON_ROOT = "https://raw.githubusercontent.com/WatWowMap/wwm-uicons/7927b7d7c00a92d420307515c98b5e5f230fe91d/pokemon";
// Display-only art for labels the shared identity table keeps ambiguous on purpose (automation must not pick a form):
// Phony and Antique Sinistea wearing a bow look the same in a picture.
const DISPLAY_ONLY_ART = new Map([["sinistea wearing a bow", `${MEGA_ICON_ROOT}/854_f3365.png`]]);
const EVENT_ICON = /^https:\/\/cdn\.leekduck\.com\/assets\/img\/pokemon_icons\/[\w.-]+\.png$/;
export function reviewSprite(name, { imageUrl = "" } = {}) {
  const label = clean(name);
  const listed = EVENT_ICON.test(clean(imageUrl)) && !/_shiny\.png$/.test(imageUrl) ? [clean(imageUrl)] : [];
  const exact = eventPokemonArtworkCandidates(label);
  const mega = /^Mega\s+(.+?)(?:\s+([XY]))?$/i.exec(label);
  const megaDex = mega ? SPECIES_DEX.get(mega[1].toLocaleLowerCase()) : null;
  const megaIcon = megaDex ? [`${MEGA_ICON_ROOT}/${megaDex}_e${mega[2]?.toUpperCase() === "X" ? 2 : mega[2]?.toUpperCase() === "Y" ? 3 : 1}.png`] : [];
  const display = DISPLAY_ONLY_ART.get(label.toLocaleLowerCase());
  // Plain species: the in-game style icon first so every sprite on the card matches (HOME art stays as a fallback).
  const plainDex = SPECIES_DEX.get(label.toLocaleLowerCase());
  const plainIcon = plainDex ? [`${MEGA_ICON_ROOT}/${plainDex}.png`] : [];
  const urls = [...new Set([...megaIcon, ...listed, ...plainIcon, ...exact, ...(display ? [display] : [])])];
  if (urls.length) return { url: urls[0], fallbacks: urls.slice(1), shadow: false };
  const shadowBase = label.replace(/^Shadow\s+/i, "");
  if (shadowBase !== label) {
    const base = reviewSprite(shadowBase, { imageUrl });
    if (base) return { ...base, shadow: true };
  }
  return null;
}

// name -> GO icon URL for every Pokémon entry the event source lists with an image.
function eventIcons(event) {
  const icons = new Map();
  const walk = (value, depth) => {
    if (!value || typeof value !== "object" || depth > 5) return;
    if (Array.isArray(value)) { for (const item of value) walk(item, depth + 1); return; }
    if (typeof value.name === "string" && typeof value.imageUrl === "string" && EVENT_ICON.test(value.imageUrl) && !/_shiny\.png$/.test(value.imageUrl)) {
      const key = clean(value.name).toLocaleLowerCase();
      if (!icons.has(key)) icons.set(key, value.imageUrl);
    }
    for (const item of Object.values(value)) walk(item, depth + 1);
  };
  walk(event?.details, 0);
  return icons;
}

const gradeOf = event => {
  const grade = typeof event?.rating === "object" ? event.rating?.grade : event?.rating;
  return /^[A-F]$/.test(String(grade || "")) ? String(grade) : "";
};
const TYPE_LABELS = {
  "raid-battles": "Raids", "raid-day": "Raid Day", "go-pass": "GO Pass", event: "Event", "community-day": "Community Day",
  "spotlight-hour": "Spotlight Hour", "max-mondays": "Max Monday", "go-battle-league": "GO Battle League",
  season: "Season", research: "Research", "pokemon-go-fest": "GO Fest", "raid-hour": "Raid Hour"
};
const typeLabel = event => TYPE_LABELS[event?.eventType] || clean(event?.heading) || "Event";

const shinySet = facts => new Set(facts.shinies.map(name => name.toLocaleLowerCase()));
// Copy-friendly ID next to each name, the format spoofing tools take: dex, dex:form, or dex:form:costume.
export function pokemonCode(name) {
  const label = clean(name);
  const base = label.replace(/^(Shadow|Mega|Primal)\s+/i, "").replace(/\s+[XY]$/, "");
  const identity = eventPokemonIdentity(label) || (base !== label ? eventPokemonIdentity(base) : null);
  let dex = identity?.pokedex_id;
  if (!dex) {
    const plain = SPECIES_DEX.get(base.replace(/\s+wearing\s+.+$/i, "").replace(/\s*\(.*\)$/, "").toLocaleLowerCase());
    if (plain) return String(plain);
    return "";
  }
  const rawForm = Number(identity.form) || 0, costume = Number(identity.costume) || 0;
  const form = rawForm === Number(POKEMON_DEFAULT_FORM_IDS[dex]) ? 0 : rawForm; // the species' normal form is just its dex
  return costume ? `${dex}:${form}:${costume}` : form ? `${dex}:${form}` : String(dex);
}
const pokemonLine = row => `${row.code ? `\`${row.code}\` ` : ""}${row.name}${row.shiny ? " · shiny" : ""}`;
const pokemonRow = (name, shinies, icons = new Map()) => ({
  name: clean(name), code: pokemonCode(name), sprite: reviewSprite(name, { imageUrl: icons.get(clean(name).toLocaleLowerCase()) }), shiny: shinies.has(clean(name).toLocaleLowerCase()),
  // Short caption for the graphic: "Pikachu wearing a hat and capelet" -> "Pikachu (costume)".
  caption: clean(name).replace(/\s+wearing\s+.+$/i, " (costume)").replace(/\s*\((Origin|Altered|Incarnate|Therian)\)$/i, " ($1)")
});
const firstSentence = text => clean(text).split(/(?<=\.)\s/)[0];

/**
 * Build the day review (2026-10-30): today's events are the main focus; a GO Pass or season banner only
 * on the day a new one starts; GO Battle League only on the day its cup starts; then a short look ahead (tomorrow only)
 * and in-person / location-only events that start today or tomorrow or have their last day today.
 */
// Posts sent from noon on cover the next day (2026-10-30: Friday's post is for Saturday, so people can
// plan); a morning send covers the same day.
export function reviewAheadDays(now = Date.now(), timeZone = defaultTimeZone()) {
  return wallDate(zoneWall(now, timeZone)).getUTCHours() >= 12 ? 1 : 0;
}

export function buildDailyReview(calendarEvents, { now = Date.now(), timeZone = defaultTimeZone(), siteUrl = defaultSiteUrl(), aheadDays = 0 } = {}) {
  const realWall = zoneWall(now, timeZone);
  // For a day-ahead post the review is taken as of the start of that day, so everything during it counts.
  const nowWall = aheadDays > 0 ? Math.floor(realWall / (24 * HOUR)) * 24 * HOUR + aheadDays * 24 * HOUR : realWall;
  const relative = !(aheadDays > 0);
  const todayStart = Math.floor(nowWall / (24 * HOUR)) * 24 * HOUR;
  const tomorrowStart = todayStart + 24 * HOUR;
  const horizon = tomorrowStart + 24 * HOUR; // look ahead: tomorrow only
  const base = siteUrl.replace(/\/+$/, "");
  const allRows = (Array.isArray(calendarEvents) ? calendarEvents : [])
    .filter(event => event?.eventType !== "research")
    .map(event => ({ event, start: eventWall(event.start, timeZone), end: eventWall(event.end || event.start, timeZone) }))
    .filter(row => Number.isFinite(row.start) && Number.isFinite(row.end));
  const isGlobal = row => row.event.scope === "global";
  const startsToday = row => row.start >= todayStart && row.start < tomorrowStart;
  const type = row => row.event.eventType;
  const rows = allRows.filter(isGlobal);
  const today = rows.filter(row => row.start < tomorrowStart && row.end > nowWall);
  const name = row => clean(row.event.name).split(" | ")[0].replace(/^Pokémon GO (?!× )/, "");
  const url = row => `${base}/events?event=${encodeURIComponent(row.event.calendarAliasOf || row.event.id || "")}`;
  const status = row => row.start > nowWall ? `starts ${timeText(row.start)}`
    : row.end < tomorrowStart + 3 * 24 * HOUR ? `ends ${whenText(row.end, todayStart, relative)}` : `until ${dayText(row.end)}`;

  // New GO Pass or new season: banner on its first day only.
  const launchRow = today.filter(row => ["go-pass", "season"].includes(type(row)) && startsToday(row))
    .sort((a, b) => (type(a) === "season" ? 0 : 1) - (type(b) === "season" ? 0 : 1))[0];
  let launch = null;
  if (launchRow) {
    const facts = eventFacts(launchRow.event);
    const shinies = shinySet(facts);
    const summary = firstSentence(launchRow.event.details?.ratingEvidence?.ratingOnly?.summary || launchRow.event.description || "");
    launch = {
      name: name(launchRow), kind: type(launchRow) === "season" ? "New season" : "New GO Pass", url: url(launchRow),
      image: clean(launchRow.event.imageUrl), status: status(launchRow),
      highlights: (facts.free.length ? facts.free : summary ? [summary] : []).slice(0, 2),
      pokemon: facts.shinies.slice(0, 3).map(value => pokemonRow(value, shinies, eventIcons(launchRow.event)))
    };
  }

  const liveRows = today
    .filter(row => !["raid-battles", "go-pass", "season"].includes(type(row)))
    .filter(row => type(row) !== "go-battle-league")
    .sort((a, b) => a.end - b.end)
    .slice(0, 5)
    .map(row => {
      const facts = eventFacts(row.event);
      const shinies = shinySet(facts);
      const wild = facts.spotlight?.name ? [facts.spotlight.name] : (Array.isArray(facts.spawns) ? facts.spawns : []).map(spawn => typeof spawn === "string" ? spawn : spawn?.name);
      return {
        name: name(row), type: typeLabel(row.event), url: url(row), image: clean(row.event.imageUrl), status: status(row),
        wild: wild.filter(Boolean).slice(0, 8).map(value => pokemonRow(value, shinies, eventIcons(row.event))),
        // Max Battle bosses up on the review day (a dated schedule wins over the whole-event list).
        max: (() => {
          const windows = Array.isArray(row.event.details?.maxBattleSchedule?.windows) ? row.event.details.maxBattleSchedule.windows : [];
          const names = windows.length ? windows.filter(window => eventWall(window.start, timeZone) < tomorrowStart && eventWall(window.end, timeZone) > todayStart)
            .flatMap(window => (window.bosses || []).map(boss => clean(boss?.name))) : facts.maxBattles;
          return [...new Set(names.filter(Boolean))].slice(0, 8).map(value => pokemonRow(value, shinies, eventIcons(row.event)));
        })(),
        // Raid Hours, Max Battle Hours and similar windows that fall on the review day.
        hours: (Array.isArray(row.event.details?.bonusWindows) ? row.event.details.bonusWindows : [])
          .map(window => ({ label: clean(window.label), start: eventWall(window.start, timeZone), end: eventWall(window.end, timeZone) }))
          .filter(window => window.label && window.start >= todayStart && window.start < tomorrowStart && window.end > nowWall)
          .slice(0, 3).map(window => `${window.label} · ${timeText(window.start)}–${timeText(window.end)}`),
        bonuses: facts.bonuses.slice(0, 2)
      };
    });

  // Raid line-up from the raid events running today (tiered), deduplicated by name.
  const tiers = new Map();
  for (const row of today) {
    const eventName = clean(row.event.name);
    const namedTier = /(\d)-star/i.exec(eventName)?.[1];
    const shadow = /shadow raid/i.test(eventName);
    const mega = /mega raid/i.test(eventName);
    const facts = eventFacts(row.event);
    const shinies = shinySet(facts);
    const icons = eventIcons(row.event);
    for (const raid of facts.raids) {
      const stars = raid.tier || namedTier;
      const tier = shadow ? `Shadow ${stars ? `${stars}-star` : ""}`.trim() : mega ? "Mega" : stars ? `${stars}-star` : "Raids";
      let label = raid.name;
      if (mega && !/^mega/i.test(label)) label = `Mega ${label}`;
      if (shadow && !/^shadow/i.test(label)) label = `Shadow ${label}`;
      const bucket = tiers.get(tier) || new Map();
      if (!bucket.has(label.toLocaleLowerCase())) bucket.set(label.toLocaleLowerCase(), { ...pokemonRow(label, shinies, new Map([[label.toLocaleLowerCase(), icons.get(label.toLocaleLowerCase()) || icons.get(clean(raid.name).toLocaleLowerCase())]])), shiny: shinies.has(raid.name.toLocaleLowerCase()) });
      tiers.set(tier, bucket);
    }
  }
  const tierOrder = ["5-star", "Mega", "Shadow 5-star", "Shadow 3-star", "Shadow 1-star", "Shadow", "3-star", "1-star", "Raids"];
  const rank = tier => { const index = tierOrder.indexOf(tier); return index < 0 ? 99 : index; };
  const raids = [...tiers.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([tier, bosses]) => ({ tier, bosses: [...bosses.values()] }));

  // PvP changes: GO Battle League cups that start today (2026-10-30: PvP only on the day it changes).
  const pvp = today.filter(row => type(row) === "go-battle-league" && startsToday(row))
    .sort((a, b) => a.start - b.start)
    .map(row => ({ name: name(row), url: url(row), image: clean(row.event.imageUrl), status: status(row) }));

  // Tomorrow, short: global events starting tomorrow (a pass, season or cup gets its own day-of mention).
  const nextRows = rows.filter(row => row.start >= tomorrowStart && row.start < horizon && !["go-pass", "season", "go-battle-league", "raid-battles"].includes(type(row)))
    .sort((a, b) => a.start - b.start).slice(0, 3).map(row => ({
      name: name(row), type: typeLabel(row.event), url: url(row), image: clean(row.event.imageUrl),
      starts: whenText(row.start, todayStart, relative), highlight: firstSentence(row.event.details?.ratingEvidence?.ratingOnly?.summary || "")
    }));

  // Location-only events (venue, city, regional): starting today or tomorrow, or on their last day today.
  const local = allRows.filter(row => !isGlobal(row))
    .filter(row => (row.start >= todayStart && row.start < horizon) || (row.start <= nowWall && row.end > nowWall && row.end < tomorrowStart))
    .sort((a, b) => a.start - b.start).slice(0, 3).map(row => ({
      name: name(row), url: url(row), image: clean(row.event.imageUrl), where: clean(row.event.location || row.event.city || row.event.region || ""),
      // Date-only venue events (no published time) start at local midnight: show the day, not "12 AM".
      when: row.start > nowWall ? `starts ${whenText(row.start, todayStart, relative).replace(/,? 12 AM$/, "")}` : `last day, ends ${timeText(row.end)}`,
      localTime: Boolean(row.event.localTime)
    }));

  const d = wallDate(nowWall);
  return {
    dateLabel: `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
    heading: relative ? "Today in Pokémon GO" : `${DAYS[d.getUTCDay()]} in Pokémon GO`,
    todayLabel: relative ? "Today" : DAYS[d.getUTCDay()], nextLabel: relative ? "Tomorrow" : DAYS[(d.getUTCDay() + 1) % 7],
    timeZone, siteUrl: base, launch, live: liveRows, pvp, raids, next: nextRows, local
  };
}


/** Plain-text Discord post (no emoji, Discord markdown only). */
export function dailyReviewText(review) {
  const lines = [`**${review.heading || "Today in Pokémon GO"} · ${review.dateLabel}**`, ""];
  if (review.live.length) {
    lines.push(`**${review.todayLabel || "Today"}**`);
    for (const row of review.live) {
      lines.push(`**${row.name}** · ${row.status}`);
      for (const hour of row.hours || []) lines.push(hour);
      if (row.wild.length) lines.push("Wild:", ...row.wild.map(pokemonLine));
      if (row.max?.length) lines.push("Max Battles:", ...row.max.map(pokemonLine));
      if (row.bonuses.length) lines.push(`Bonuses: ${row.bonuses.join("; ")}`);
      lines.push("");
    }
  }
  if (review.pvp?.length) {
    lines.push("**PvP changes**");
    for (const row of review.pvp) lines.push(`${row.name} · ${row.status}`);
    lines.push("");
  }
  if (review.raids.length) {
    lines.push("**Raids**");
    for (const row of review.raids) lines.push(`${row.tier}:`, ...row.bosses.map(pokemonLine));
    lines.push("");
  }
  if (review.launch) {
    lines.push(`**${review.launch.kind}: ${review.launch.name}** · ${review.launch.status}`);
    for (const highlight of review.launch.highlights) lines.push(`- ${highlight}`);
    lines.push("");
  }
  if (review.next.length) {
    lines.push(`**${review.nextLabel || "Tomorrow"}**`);
    for (const row of review.next) lines.push(`- **${row.name}** · ${row.starts}${row.highlight ? ` · ${row.highlight}` : ""}`);
    lines.push("");
  }
  lines.push(`Times are local unless noted. Full calendar: <${review.siteUrl}/events>`);
  return lines.join("\n").trim();
}

const attr = value => escapeHtml(value);
function spriteHtml(row, size = 84) {
  const ring = row.shiny ? " shiny" : "";
  if (!row.sprite) return ""; // no stand-in pictures: a Pokémon without exact art is listed in the text post only
  const art = `<img src="${attr(row.sprite.url)}" width="${size}" height="${size}" alt="" class="${row.sprite.shadow ? "shadow-art" : ""}" data-fallbacks="${attr((row.sprite.fallbacks || []).join(" "))}">`;
  return `<figure class="mon${ring}"><div class="art">${art}</div><figcaption>${escapeHtml(row.caption || row.name)}</figcaption></figure>`;
}

/** Self-contained HTML (1080 wide) for the daily graphic, rendered to PNG by a headless browser. */
export function dailyReviewHtml(review) {
  const thumb = (image, cls = "thumb") => image ? `<img class="${cls}" src="${attr(image)}" alt="">` : `<span class="${cls} blank"></span>`;
  const pictured = list => list.filter(item => item.sprite);
  const launch = review.launch ? `
  <section class="pass"><h2>${escapeHtml(review.launch.kind)}</h2><div class="pass-body">${thumb(review.launch.image, "pass-art")}
    <div class="pass-copy"><h3>${escapeHtml(review.launch.name)}</h3><span class="key">${escapeHtml(review.launch.status)}</span>
      <ul>${review.launch.highlights.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul></div>
    <div class="pass-mons">${review.launch.pokemon.filter(row => row.sprite).map(row => spriteHtml(row, 96)).join("")}</div></div>
  </section>` : "";
  const live = review.live.map(row => `
    <article class="event">${thumb(row.image)}
      <div class="event-copy"><div class="event-head"><h3>${escapeHtml(row.name)}</h3><span class="key">${escapeHtml(row.status)}</span></div>
        ${pictured(row.wild).length ? `<div class="label">Wild</div><div class="mons">${pictured(row.wild).map(item => spriteHtml(item)).join("")}</div>` : ""}
        ${row.bonuses.length ? `<p class="bonus">${row.bonuses.map(escapeHtml).join(" · ")}</p>` : ""}
      </div></article>`).join("");
  const raidCards = review.raids.flatMap(row => pictured(row.bosses).map(item => ({ tier: row.tier, item })));
  const raids = raidCards.length ? `<div class="raid-grid">${raidCards.map(({ tier, item }) =>
    `<div class="raid-card"><span class="tier">${escapeHtml(tier)}</span>${spriteHtml(item, 96)}</div>`).join("")}</div>` : "";
  const next = review.next.map(row => `
    <article class="next">${thumb(row.image, "thumb small")}<div><h3>${escapeHtml(row.name)}</h3>
      <span class="key">${escapeHtml(row.starts)}</span>${row.highlight ? `<p>${escapeHtml(row.highlight)}</p>` : ""}</div></article>`).join("");
  const local = review.local.map(row => `
    <article class="next">${thumb(row.image, "thumb small")}<div><h3>${escapeHtml(row.name)}</h3>
      <span class="key">${escapeHtml(row.when)}${row.localTime && /\d/.test(row.when) ? " local time" : ""}</span>${row.where ? `<p>${escapeHtml(row.where)}</p>` : ""}</div></article>`).join("");
  const block = (title, body, cls = "") => body ? `<section class="${cls}"><h2>${title}</h2>${body}</section>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1080"><title>Today in Pokémon GO</title><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;background:#0b0612}
body{font-family:"Inter","Segoe UI",system-ui,-apple-system,sans-serif;color:#fff}
.frame{position:relative;width:1080px;min-height:1350px;padding:56px 56px 48px;display:flex;flex-direction:column;gap:22px;
 background:radial-gradient(900px 700px at 0% 0%,rgba(140,82,255,.38),transparent 60%),radial-gradient(700px 600px at 100% 100%,rgba(93,226,170,.14),transparent 60%),#0b0612}
.frame:before{content:"";position:absolute;inset:16px;border:2px solid rgba(189,154,255,.35);border-radius:34px;pointer-events:none}
header .top{display:flex;justify-content:space-between;align-items:baseline;gap:24px}
.brand{font-size:24px;font-weight:900;letter-spacing:.32em;color:#c9a8ff}
h1{font-size:64px;white-space:nowrap;line-height:1;font-weight:900;letter-spacing:-.02em;margin-top:12px}
.date{font-size:30px;font-weight:800;color:#ffd84d;white-space:nowrap}
section{background:rgba(22,14,36,.8);border:1px solid rgba(189,154,255,.28);border-radius:26px;padding:22px 26px}
section>h2{font-size:21px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:#b98cff;margin-bottom:14px}
.key{color:#ffd84d;font-weight:800;font-size:24px;white-space:nowrap}
.pass{border-color:rgba(255,216,77,.45);background:linear-gradient(120deg,rgba(255,216,77,.12),rgba(22,14,36,.85) 55%)}
.pass-body{display:grid;grid-template-columns:220px 1fr auto;gap:22px;align-items:center}
.pass-art{width:220px;height:124px;object-fit:cover;border-radius:16px;background:#1f1530}
.pass h3{font-size:32px;font-weight:900;margin-bottom:4px}
.pass ul{list-style:none;margin-top:8px;display:grid;gap:4px}
.pass li{font-size:21px;color:#e6dcf4;font-weight:600}
.pass-mons{display:flex;gap:6px}
.event{display:grid;grid-template-columns:150px 1fr;gap:20px;padding:14px 0;border-top:1px solid rgba(189,154,255,.18)}
.event:first-of-type{border-top:0;padding-top:0}
.thumb{width:150px;height:96px;object-fit:cover;border-radius:14px;background:#1f1530}
.thumb.small{width:120px;height:76px}
.event-head{display:flex;justify-content:space-between;gap:16px;align-items:baseline}
h3{font-size:30px;font-weight:850;line-height:1.12}
.label{margin-top:8px;font-size:17px;font-weight:900;letter-spacing:.18em;color:#8fd3ff;text-transform:uppercase}
.mons{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px}
.mon{width:112px;display:grid;justify-items:center;gap:2px;text-align:center}
.mon .art{width:92px;height:92px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.05)}
.mon.shiny .art{box-shadow:0 0 0 3px #ffd84d,0 0 18px rgba(255,216,77,.45)}
.mon img{width:84px;height:84px;object-fit:contain}
.mon img.shadow-art{filter:drop-shadow(0 0 6px #8a2be2) drop-shadow(0 0 12px #5b1a9a)}
figcaption{font-size:16px;line-height:1.15;font-weight:700;color:#e6dcf4;max-height:38px;overflow:hidden}
.bonus{margin-top:8px;font-size:20px;color:#cfc3e3;font-weight:600}
.raid-grid{display:flex;flex-wrap:wrap;gap:14px 18px}
.raid-card{display:grid;justify-items:center;gap:6px;width:150px}
.raid-card .mon{width:150px}
.tier{font-size:16px;font-weight:900;color:#ffd84d;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap}
.next{display:grid;grid-template-columns:120px 1fr;gap:18px;align-items:center;padding:10px 0}
.next h3{font-size:27px}.next p{font-size:19px;color:#cfc3e3;margin-top:4px}
.legend{display:flex;gap:10px;align-items:center;font-size:20px;color:#c9a8ff;font-weight:700}
.legend i{width:22px;height:22px;border-radius:50%;box-shadow:0 0 0 3px #ffd84d;display:inline-block}
footer{margin-top:auto;display:flex;justify-content:space-between;align-items:center;padding-top:6px}
footer .url{color:#fff;font-size:32px;font-weight:900}
</style></head><body><div class="frame">
<header><div class="top"><span class="brand">${escapeHtml(siteName())}</span><span class="date">${escapeHtml(review.dateLabel)}</span></div><h1>${escapeHtml(review.heading || "Today in Pokémon GO")}</h1></header>
${block(escapeHtml(review.todayLabel || "Today"), live)}
${block("PvP changes", (review.pvp || []).map(row => `
    <article class="next">${thumb(row.image, "thumb small")}<div><h3>${escapeHtml(row.name)}</h3><span class="key">${escapeHtml(row.status)}</span></div></article>`).join(""))}
${block("Raids", raids)}
${launch}
${block(escapeHtml(review.nextLabel || "Tomorrow"), next)}
<footer><span class="legend"><i></i>Gold ring: shiny possible · local times</span><span class="url">${escapeHtml(siteHost())}/events</span></footer>
</div><script>
for (const img of document.querySelectorAll("img[data-fallbacks]")) img.addEventListener("error", () => {
  const next = (img.dataset.fallbacks || "").split(" ").filter(Boolean);
  if (next.length) { img.dataset.fallbacks = next.slice(1).join(" "); img.src = next[0]; } else (img.closest(".raid-card") || img.closest(".mon") || img).remove();
});
</script></body></html>`;
}

// Local events only (2026-10-30): a second post for location-bound events that are live right now, with the
// published coordinates. Long-running partnerships (stamp rallies, museum and mall runs, jets) are left out.
const LOCAL_MAX_DAYS = 4;
const shortDate = ms => `${dayText(ms)}, ${timeText(ms)}`;
// Venue wall clock (as UTC-shaped ms) back to the real instant, checked twice so a DST change in between is handled.
function wallToInstant(wall, timeZone) {
  let instant = wall;
  for (let pass = 0; pass < 2; pass += 1) instant = wall - (zoneWall(instant, timeZone) - Math.floor(instant / 60_000) * 60_000);
  return instant;
}
function coordinatesOf(event) {
  const points = [];
  const add = (label, value) => {
    const match = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(String(value || ""));
    if (match && !points.some(point => point.value === `${match[1]}, ${match[2]}`)) points.push({ label: clean(label), value: `${match[1]}, ${match[2]}` });
  };
  add(event.location, event.coordinates);
  for (const venue of Array.isArray(event.venues) ? event.venues : []) add(venue.name || venue.location, venue.coordinates);
  return points.slice(0, 4);
}
export function buildLocalReview(calendarEvents, { now = Date.now(), siteUrl = defaultSiteUrl(), aheadDays = 0, timeZone = defaultTimeZone() } = {}) {
  // Day-ahead: events running at any point on that calendar date in the venue's own time.
  const targetDay = aheadDays > 0 ? Math.floor(zoneWall(now, timeZone) / (24 * HOUR)) * 24 * HOUR + aheadDays * 24 * HOUR : null;
  const base = siteUrl.replace(/\/+$/, "");
  const live = [];
  for (const event of Array.isArray(calendarEvents) ? calendarEvents : []) {
    if (!event || event.scope === "global" || event.eventType === "stamp-rally" || event.eventType === "research") continue;
    const zone = clean(event.timeZone) || "UTC";
    let nowWall;
    try { nowWall = zoneWall(now, zone); } catch { continue; }
    const start = eventWall(event.start, zone), end = eventWall(event.end, zone);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start > LOCAL_MAX_DAYS * 24 * HOUR) continue;
    if (targetDay === null ? !(start <= nowWall && end > nowWall) : !(start < targetDay + 24 * HOUR && end > targetDay)) continue;
    const facts = eventFacts(event);
    const shinies = shinySet(facts);
    const icons = eventIcons(event);
    const names = [...facts.raids.map(raid => raid.name), ...(Array.isArray(facts.spawns) ? facts.spawns.map(spawn => typeof spawn === "string" ? spawn : spawn?.name) : []),
      ...(Array.isArray(event.species) ? event.species : [])].map(clean).filter(Boolean);
    const all = [...new Map(names.map(value => [value.toLocaleLowerCase(), value])).values()].map(value => pokemonRow(value, shinies, icons));
    const pokemon = all.filter(row => row.sprite).slice(0, 8);
    const list = all.slice(0, 15);
    live.push({
      name: clean(event.name).split(" | ")[0].replace(/^Pokémon GO (?!× )/, ""), url: `${base}/events?event=${encodeURIComponent(event.calendarAliasOf || event.id || "")}`,
      image: clean(event.imageUrl), where: clean(event.location || ""), coordinates: coordinatesOf(event),
      ends: `until ${shortDate(end)} local`, endsAt: end - nowWall,
      // Discord renders <t:unix> in each reader's own time zone.
      endsUnix: Math.round(wallToInstant(end, zone) / 1000),
      pokemon, list, bonuses: (facts.bonuses.length ? facts.bonuses : Array.isArray(event.bonuses) ? event.bonuses : []).slice(0, 2)
    });
  }
  live.sort((a, b) => a.endsAt - b.endsAt);
  const dayLabel = targetDay === null ? "" : `${DAYS[wallDate(targetDay).getUTCDay()]}, ${MONTHS[wallDate(targetDay).getUTCMonth()]} ${wallDate(targetDay).getUTCDate()}`;
  return live.length ? { siteUrl: base, dayLabel, events: live.slice(0, 4) } : null;
}

export function localReviewText(review) {
  if (!review) return "";
  const lines = [`**Local events only · ${review.dayLabel || "live now"}**`, ""];
  for (const row of review.events) {
    lines.push(`**${row.name}** · ${Number.isFinite(row.endsUnix) ? `until <t:${row.endsUnix}:f> (<t:${row.endsUnix}:R>)` : row.ends}`);
    if (row.where) lines.push(row.where);
    for (const point of row.coordinates) lines.push(`\`${point.value}\`${row.coordinates.length > 1 && point.label ? ` ${point.label}` : ""}`);
    if (!row.coordinates.length) lines.push("Coordinates not published");
    if (row.list.length) lines.push(...row.list.map(pokemonLine));
    if (row.bonuses.length) lines.push(`Bonuses: ${row.bonuses.join("; ")}`);
    lines.push("");
  }
  lines.push(`End times show in your own time zone. Details: <${review.siteUrl}/events>`);
  return lines.join("\n").trim();
}

// Shared list page for the Local, Week ahead and Season & GO Pass graphics: header, one card per event (picture,
// when, where, coordinates, sprites), footer. The daily review keeps its own sectioned layout.
function eventListHtml({ siteUrl, badge, title, section, events, coordinates = false, legend = "Gold ring: shiny possible · local times" }) {
  const page = dailyReviewHtml({ dateLabel: "", siteUrl, launch: null, live: [], pvp: [], raids: [], next: [], local: [] });
  const cards = events.map(row => `
    <article class="event">${row.image ? `<img class="thumb" src="${attr(row.image)}" alt="">` : `<span class="thumb"></span>`}
      <div class="event-copy"><div class="event-head"><h3>${escapeHtml(row.name)}</h3></div>
        <span class="key">${escapeHtml(row.when)}</span>
        ${row.where ? `<p class="where">${escapeHtml(row.where)}</p>` : ""}
        ${coordinates ? (row.coordinates?.length ? row.coordinates.map(point => `<p class="coords">${escapeHtml(point.value)}${row.coordinates.length > 1 && point.label ? ` <span>${escapeHtml(point.label)}</span>` : ""}</p>`).join("") : `<p class="coords none">Coordinates not published</p>`) : ""}
        ${row.pokemon?.length ? `<div class="mons">${row.pokemon.map(item => spriteHtml(item)).join("")}</div>` : ""}
      </div></article>`).join("");
  return page
    .replace(/<header>[\s\S]*?<\/header>/, `<header><div class="top"><span class="brand">${escapeHtml(siteName())}</span><span class="date">${escapeHtml(badge)}</span></div><h1>${escapeHtml(title)}</h1></header>`)
    .replace(/(<header>[\s\S]*?<\/header>)/, `$1\n<section><h2>${escapeHtml(section)}</h2>${cards}</section>`)
    .replace("</style>", ".where{font-size:21px;color:#cfc3e3;margin-top:6px}.coords{font:800 26px ui-monospace,Menlo,Consolas,monospace;color:#8fd3ff;margin-top:6px}.coords span{font:600 18px Inter,system-ui,sans-serif;color:#cfc3e3}.coords.none{color:#b9aecb;font-size:20px}.event-copy .mons{margin-top:10px}.event-copy .key{display:block;white-space:normal}.event+.event{margin-top:6px}.frame{min-height:0}footer{margin-top:12px}\n</style>")
    .replace("Gold ring: shiny possible · local times", legend);
}

export function localReviewHtml(review) {
  if (!review) return "";
  return eventListHtml({ siteUrl: review.siteUrl, badge: review.dayLabel || "Live now", title: "Local events only", section: "In-person and location-only",
    events: review.events.map(row => ({ ...row, when: row.ends })), coordinates: true, legend: "Gold ring: shiny possible · venue local times" });
}

// Week ahead and Season & GO Pass (2026-10-30: every post in the new style). Takes the events the existing
// digest already selected for that window, so what is covered does not change, only how it looks.
const LIST_KINDS = {
  week: { title: "Week ahead", section: "Coming up this week" },
  monthly: { title: "Season & GO Pass", section: "Season, GO Pass and month ahead" }
};
export function buildEventListReview(events, kind, { now = Date.now(), timeZone = defaultTimeZone(), siteUrl = defaultSiteUrl(), windowStart = now } = {}) {
  const meta = LIST_KINDS[kind];
  if (!meta) throw new TypeError("Unknown list review kind.");
  const base = siteUrl.replace(/\/+$/, "");
  const startWall = zoneWall(windowStart, timeZone);
  const weekEnd = startWall + 7 * 24 * HOUR;
  // Week ahead covers what changes that week (2026-10-30): global events that start or end in it, and short
  // location events (4 days or less) in it. No stamp rallies or long-running partnerships.
  const inScope = event => {
    if (kind !== "week") return true;
    if (event?.eventType === "stamp-rally") return false;
    const start = eventWall(event.start, timeZone), end = eventWall(event.end || event.start, timeZone);
    if (!Number.isFinite(start)) return false;
    if (event.scope !== "global") return Number.isFinite(end) && end - start <= LOCAL_MAX_DAYS * 24 * HOUR && start < weekEnd && end > startWall;
    return (start >= startWall && start < weekEnd) || (Number.isFinite(end) && end >= startWall && end < weekEnd);
  };
  const rows = (Array.isArray(events) ? events : []).filter(inScope).map(event => {
    const start = eventWall(event.start, timeZone), end = event.end ? eventWall(event.end, timeZone) : NaN;
    const facts = eventFacts(event);
    const shinies = shinySet(facts);
    const icons = eventIcons(event);
    const shadowRaids = /shadow raid/i.test(clean(event.name));
    const names = [facts.spotlight?.name, ...facts.raids.map(raid => shadowRaids && !/^shadow/i.test(raid.name) ? `Shadow ${raid.name}` : raid.name), ...facts.maxBattles,
      ...(Array.isArray(facts.spawns) ? facts.spawns.map(spawn => typeof spawn === "string" ? spawn : spawn?.name) : []),
      ...(facts.shinies || [])].map(clean).filter(Boolean);
    const all = [...new Map(names.map(value => [value.toLocaleLowerCase(), value])).values()].map(value => pokemonRow(value, shinies, icons));
    const when = Number.isFinite(start) && !Number.isFinite(end) ? shortDate(start)
      : Number.isFinite(start) && Number.isFinite(end)
      ? (end - start <= 24 * HOUR && wallDate(start).getUTCDate() === wallDate(end).getUTCDate()
        ? `${shortDate(start)} – ${timeText(end)}`
        : start < startWall ? `until ${shortDate(end)}` : `${shortDate(start)} – ${shortDate(end)}`)
      : "";
    return {
      name: clean(event.name).split(" | ")[0].replace(/^Pokémon GO (?!× )/, ""), url: `${base}/events?event=${encodeURIComponent(event.calendarAliasOf || event.id || "")}`,
      // Date-only events (midnight to 11:59 PM) read as days.
      image: clean(event.imageUrl), when: when.replace(/, 12 AM(?= –|$)/g, "").replace(/, 11:59 PM$/, ""), start,
      where: event.scope && event.scope !== "global" ? clean(event.location || "") : "",
      pokemon: all.filter(row => row.sprite).slice(0, 8), list: all.slice(0, 12),
      bonuses: (facts.bonuses.length ? facts.bonuses : facts.free).slice(0, 2)
    };
  }).sort((a, b) => (a.start || 0) - (b.start || 0));
  const d = wallDate(startWall);
  return { kind, title: meta.title, section: meta.section, siteUrl: base, events: rows,
    dateLabel: kind === "week" ? `Week of ${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
}

export function eventListReviewText(review) {
  if (!review?.events?.length) return "";
  const lines = [`**${review.title} · ${review.dateLabel}**`, ""];
  for (const row of review.events) {
    lines.push(`**${row.name}**${row.when ? ` · ${row.when}` : ""}`);
    if (row.where) lines.push(row.where);
    if (row.list.length) lines.push(...row.list.map(pokemonLine));
    if (row.bonuses.length) lines.push(`Bonuses: ${row.bonuses.join("; ")}`);
    lines.push("");
  }
  lines.push(`Times are local unless noted. Full calendar: <${review.siteUrl}/events>`);
  return lines.join("\n").trim();
}

export function eventListReviewHtml(review) {
  if (!review?.events?.length) return "";
  return eventListHtml({ siteUrl: review.siteUrl, badge: review.dateLabel, title: review.title, section: review.section, events: review.events.slice(0, 8) });
}

// Discord allows 2,000 characters per message: split the post at blank lines (whole sections stay together), then at
// line breaks for a section that is longer on its own. Nothing is cut off.
export function splitDiscordText(text, limit = 1_900) {
  const parts = [];
  let current = "";
  const push = piece => {
    if (!current) current = piece;
    else if (current.length + 2 + piece.length <= limit) current += `\n\n${piece}`;
    else { parts.push(current); current = piece; }
  };
  for (const block of String(text || "").split(/\n{2,}/)) {
    if (block.length <= limit) { push(block); continue; }
    let chunk = "";
    for (const line of block.split("\n")) {
      if (chunk && chunk.length + 1 + line.length > limit) { push(chunk); chunk = line.slice(0, limit); }
      else chunk = chunk ? `${chunk}\n${line}` : line.slice(0, limit);
    }
    if (chunk) push(chunk);
  }
  if (current) parts.push(current);
  return parts;
}

// PNG of a review page via Cloudflare Browser Rendering (REST). Needs BROWSER_RENDERING_TOKEN (Browser Rendering
// Edit) and CLOUDFLARE_ACCOUNT_ID; without them the post goes out as text only.
export async function renderReviewPng(html, { env = {}, fetchImpl = fetch, height = 1350 } = {}) {
  const token = String(env.BROWSER_RENDERING_TOKEN || "").trim();
  const account = String(env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  if (!html || !token || !/^[0-9a-f]{32}$/i.test(account)) return null;
  try {
    const response = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${account}/browser-rendering/screenshot`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ html, viewport: { width: 1080, height, deviceScaleFactor: 1 },
        gotoOptions: { waitUntil: "networkidle0", timeout: 30_000 }, screenshotOptions: { type: "png", fullPage: true } }),
      signal: AbortSignal.timeout(45_000)
    });
    if (!response.ok || !/image\/png/i.test(response.headers.get("content-type") || "")) {
      console.warn(JSON.stringify({ event: "review-render-failed", status: response.status }));
      return null;
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.warn(JSON.stringify({ event: "review-render-failed", error: String(error?.message || error).slice(0, 160) }));
    return null;
  }
}

/** Discord messages for a review: the graphic first as its own message (Discord shows attachments under a message's
 * text, so a separate message keeps the picture on top), then the copyable text. */
export async function reviewDiscordMessages(text, html, { env = {}, fetchImpl = fetch, imageName = "today-in-pokemon-go.png", height } = {}) {
  const parts = splitDiscordText(text);
  if (!parts.length) return [];
  const png = await renderReviewPng(html, { env, fetchImpl, height });
  return [...(png ? [{ content: "", image: { name: imageName, data: png } }] : []), ...parts.map(content => ({ content }))];
}
