// Server-rendered public event list. Discord posts link here (/events?event=<id>), so every event has an anchor.
import { calendarEventTimestamp, isCurrentCalendarEvent } from "../event-calendar.js";
import { reviewSprite } from "../lib/daily-review.js";
import { siteName } from "../lib/site.js";
import { PAGE_STYLE } from "./theme.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

function when(event) {
  const start = calendarEventTimestamp(event, "start");
  const end = calendarEventTimestamp(event, "end");
  const fmt = ms => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const local = /T\d\d:\d\d(?::\d\d)?(?:\.\d+)?$/.test(String(event?.start || "")) ? " local time" : " UTC";
  if (!Number.isFinite(start)) return "";
  return `${fmt(start)}${Number.isFinite(end) ? ` – ${fmt(end)}` : ""}${local}`;
}

// Pokémon as the source groups them: featured, habitat hours, Mighty by day, incense, eggs, raid tiers, Max by day.
const GROUP_SECTIONS = [["features", "Featured"], ["spawns", "Wild spawns"], ["incense", "Incense"], ["eggs", "Eggs"], ["raids", "Raids"], ["max-battles", "Max Battles"]];
function groupDay(group) {
  const match = /^(\d{2})-(\d{2})$/.exec(String(group?.day || ""));
  if (!match) return String(group?.dayLabel || "");
  const date = new Date(Date.UTC(new Date().getUTCFullYear(), Number(match[1]) - 1, Number(match[2])));
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
function pokemonGroups(event) {
  const groups = (Array.isArray(event?.details?.pokemonGroups) ? event.details.pokemonGroups : []).filter(group => group?.pokemon?.length);
  if (!groups.length) return "";
  return GROUP_SECTIONS.map(([id, heading]) => {
    const inSection = groups.filter(group => group.section === id);
    if (!inSection.length) return "";
    return `<h3 class="group-section">${heading}</h3>${inSection.map(group => {
      const title = String(group.title || "");
      const showTitle = title && title.toLowerCase() !== heading.toLowerCase() && !/^spawns$/i.test(title);
      const day = groupDay(group);
      const mons = group.pokemon.map(row => {
        const sprite = reviewSprite(row.name, { imageUrl: row.imageUrl });
        if (!sprite?.url) return ""; // no stand-in art: Pokémon without an exact sprite are left out of the picture grid
        return `<figure class="mon${row.shiny ? " shiny" : ""}"><img src="${escapeHtml(sprite.url)}" alt="" loading="lazy">${row.shiny ? '<i class="star" title="Shiny possible"></i>' : ""}<figcaption>${escapeHtml(row.name)}</figcaption></figure>`;
      }).join("");
      return `<div class="group group-${id}">${showTitle || day ? `<p class="group-head">${showTitle ? `<b>${escapeHtml(title)}</b>` : ""}${day ? `<span class="day">${escapeHtml(day)}</span>` : ""}</p>` : ""}${group.note ? `<p class="group-note">${escapeHtml(group.note)}</p>` : ""}<div class="mons">${mons}</div></div>`;
    }).join("")}`;
  }).join("");
}

const GROUP_STYLE = `.group-section{margin:18px 0 8px;font-size:1rem}.group{margin:8px 0;padding:12px;border-radius:14px;background:rgba(255,255,255,.04)}
.group-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 6px}.group-head .day{padding:2px 10px;border-radius:999px;background:#ffd23f;color:#1b1030;font-size:.78rem;font-weight:800}
.group-note{margin:0 0 8px;color:#ffd23f;font-size:.8rem;font-weight:700}.mons{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:10px 6px}
.mon{position:relative;margin:0;text-align:center}.mon img{width:56px;height:56px;object-fit:contain}.mon figcaption{font-size:.72rem;line-height:1.2;overflow-wrap:anywhere}
.mon .star{position:absolute;top:0;right:8px;width:13px;height:13px;background:#ffd23f;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)}`;

function card(event, selected) {
  const bonuses = Array.isArray(event?.details?.bonuses) ? event.details.bonuses.slice(0, 8) : [];
  const coords = String(event?.coordinates || "").trim();
  return `<article class="card${selected ? " selected" : ""}" id="${escapeHtml(event.id)}">
  ${event.imageUrl ? `<img src="${escapeHtml(event.imageUrl)}" alt="" loading="lazy">` : ""}
  <div>
    <h2><a href="/events?event=${encodeURIComponent(event.id)}#${encodeURIComponent(event.id)}">${escapeHtml(event.name)}</a></h2>
    <p class="meta">${escapeHtml(when(event))}${event.location && event.location !== "Global" ? ` · ${escapeHtml(event.location)}` : ""}${coords ? ` · <code>${escapeHtml(coords)}</code>` : ""}</p>
    ${event.summary ? `<p>${escapeHtml(event.summary)}</p>` : ""}
    ${bonuses.length ? `<ul>${bonuses.map(row => `<li>${escapeHtml(row)}</li>`).join("")}</ul>` : ""}
    ${selected ? pokemonGroups(event) : ""}
    ${event.link ? `<p class="source">Source: <a href="${escapeHtml(event.link)}" rel="noopener nofollow">${escapeHtml(event.linkLabel || "event page")}</a></p>` : ""}
  </div>
</article>`;
}

export function renderEventsPage(result, selectedId = "", now = Date.now()) {
  const events = Array.isArray(result?.calendarEvents) ? result.calendarEvents : [];
  const live = events.filter(event => isCurrentCalendarEvent(event, now));
  const upcoming = events.filter(event => !live.includes(event) && calendarEventTimestamp(event, "start") > now)
    .sort((a, b) => calendarEventTimestamp(a, "start") - calendarEventTimestamp(b, "start"));
  const section = (title, rows) => rows.length
    ? `<h2 class="section">${title} <span>${rows.length}</span></h2>${rows.map(event => card(event, event.id === selectedId)).join("")}`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Events · ${escapeHtml(siteName())}</title><style>${PAGE_STYLE}${GROUP_STYLE}</style></head><body>
<header class="bar"><a class="brand" href="/">${escapeHtml(siteName())}</a><nav><a href="/events">Events</a><a href="/">Get alerts</a></nav></header>
<main>
<h1>Pokémon GO events</h1>
<p class="muted">Updated ${result?.fetchedAt ? new Date(result.fetchedAt).toUTCString() : "—"}${result?.stale ? " (sources are stale; showing the last good copy)" : ""}.
Data from ScrapedDuck/LeekDuck and official Pokémon GO news. Not affiliated with Niantic, Scopely or The Pokémon Company.</p>
${section("Live now", live)}
${section("Upcoming", upcoming)}
${!live.length && !upcoming.length ? "<p>No events yet. The first scrape runs within a minute of deploying.</p>" : ""}
</main></body></html>`;
}
