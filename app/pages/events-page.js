// Server-rendered public event list. Discord posts link here (/events?event=<id>), so every event has an anchor.
import { calendarEventTimestamp, isCurrentCalendarEvent } from "../event-calendar.js";
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
<title>Events · ${escapeHtml(siteName())}</title><style>${PAGE_STYLE}</style></head><body>
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
