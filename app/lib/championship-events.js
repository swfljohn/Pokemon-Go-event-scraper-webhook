import { readJson, writeJson } from "./storage.js";

export const CHAMPIONSHIP_INDEX_URL = "https://rk9.gg/events/pokemon";
const SNAPSHOT_KEY = "event:championships:last-good:v1";
const CACHE_MS = 30 * 60_000;
const MAX_BYTES = 750_000;
const MONTHS = "January February March April May June July August September October November December".split(" ");
const UPCOMING_TABLE = /<table\b[^>]*\bid=["']dtUpcomingEvents["'][^>]*>/i;
const plain = value => String(value || "").replace(/<[^>]*>/g, " ")
  .replace(/&(?:nbsp|amp|ndash|mdash);/gi, entity => ({ "&nbsp;": " ", "&amp;": "&", "&ndash;": "–", "&mdash;": "—" })[entity.toLowerCase()])
  .replace(/\s+/g, " ").trim();

function dateText(year, month, day) {
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().startsWith(value) ? value : "";
}

export function championshipDates(value) {
  const match = /^([A-Za-z]+)\s+(\d{1,2})(?:\s*[-–—]\s*(?:([A-Za-z]+)\s+)?(\d{1,2}))?,\s*(\d{4})$/.exec(plain(value));
  if (!match) return null;
  const firstMonth = MONTHS.indexOf(match[1]) + 1;
  const lastMonth = match[3] ? MONTHS.indexOf(match[3]) + 1 : firstMonth;
  if (!firstMonth || !lastMonth) return null;
  const year = Number(match[5]);
  const start = dateText(lastMonth < firstMonth ? year - 1 : year, firstMonth, Number(match[2]));
  const end = dateText(year, lastMonth, Number(match[4] || match[2]));
  if (!start || !end || end < start || Date.parse(end) - Date.parse(start) > 7 * 86_400_000) return null;
  return { start: `${start}T00:00:00.000`, end: `${end}T23:59:59.000` };
}

export function parseChampionshipIndex(html) {
  const source = String(html || "");
  const opening = UPCOMING_TABLE.exec(source);
  const close = opening ? source.indexOf("</table>", opening.index) : -1;
  if (!opening || close < 0) throw new Error("Championship upcoming-event table is missing or incomplete.");
  const table = source.slice(opening.index, close);
  const events = [], sourceReviewRequired = [];
  const seen = new Set();
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => match[1]);
    if (cells.length < 5 || !/<a\b[^>]*href=["']\/tournament\/[^"']+["'][^>]*>[\s\S]*?\bGO\s*<\/a>/i.test(cells[4])) continue;
    const anchor = /<a\b[^>]*href=["'](\/event\/pokemon-[a-z0-9-]+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(cells[2]);
    const dates = championshipDates(cells[0]);
    if (!anchor || !dates || !plain(cells[3])) {
      sourceReviewRequired.push(plain(cells[2]).slice(0, 160) || "Unparsed Pokémon GO championship");
      continue;
    }
    const id = `local-championship-${anchor[1].split("/").at(-1)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    events.push({ id, name: plain(anchor[2]).slice(0, 160), heading: "Regional / International Championships",
      eventType: "local-event", ...dates, localTime: true, scope: "venue",
      location: plain(cells[3]).slice(0, 180), coordinates: "", species: [], bonuses: [], hasSpawns: false,
      link: new URL(anchor[1], CHAMPIONSHIP_INDEX_URL).href, sourceLabel: "RK9 Pokémon tournament registration index",
      summary: "Pokémon GO competition. Calendar dates only; tournament participation and local gameplay are separate.",
      scheduleNote: "Dates are published by the tournament index. Venue opening and gameplay hours require confirmation.",
      plannerUnavailableReason: "Tournament listing only. No automatic encounter or battle activity is confirmed.",
      details: { sourceLinks: [{ label: "Tournament registration and event dates", href: CHAMPIONSHIP_INDEX_URL }],
        manualOpportunities: ["Check the organizer's venue schedule and entry requirements. No local spawns or research rewards are inferred from this tournament listing."] }
    });
    if (events.length >= 100) break;
  }
  return { events, sourceReviewRequired: sourceReviewRequired.slice(0, 30) };
}

// Stop after the upcoming table: the much larger past-event history is unused.
async function readUpcomingTable(response) {
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_BYTES) throw new Error("Championship index exceeds size limit.");
    return text;
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let text = "", bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error("Championship index exceeds size limit.");
      text += decoder.decode(value, { stream: true });
      const opening = UPCOMING_TABLE.exec(text);
      if (opening && text.indexOf("</table>", opening.index) >= 0) break;
    }
    return text;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function fetchChampionshipEvents({ now = Date.now(), allowNetwork = false,
  fetcher = globalThis.fetch, read = readJson, write = writeJson } = {}) {
  const stored = await read(SNAPSHOT_KEY).catch(() => null);
  const valid = stored?.schemaVersion === 1 && Array.isArray(stored.events);
  const result = (snapshot, status, error = "") => ({
    id: "championships", source: "Pokémon GO championships · RK9", url: CHAMPIONSHIP_INDEX_URL,
    status, fetchedAt: Number(snapshot?.fetchedAt) || 0, events: snapshot?.events || [],
    sourceReviewRequired: snapshot?.sourceReviewRequired || [], error
  });
  if (valid && now - Number(stored.checkedAt || 0) < CACHE_MS) return result(stored, stored.status || "ok", stored.error || "");
  if (!allowNetwork) return result(valid ? stored : null, valid ? "stale" : "pending");
  try {
    const response = await fetcher(CHAMPIONSHIP_INDEX_URL, {
      headers: { Accept: "text/html", "User-Agent": "PokemonGoEventWebhook/1.0" },
      signal: AbortSignal.timeout(10_000), redirect: "error"
    });
    if (!response.ok) throw new Error(`Championship index returned HTTP ${response.status}.`);
    const contentType = response.headers?.get?.("content-type") || "";
    if (!/text\/html/i.test(contentType)) throw new Error("Championship index returned an unexpected content type.");
    const parsed = parseChampionshipIndex(await readUpcomingTable(response));
    const snapshot = { schemaVersion: 1, ...parsed, fetchedAt: now, checkedAt: now,
      status: parsed.sourceReviewRequired.length ? "partial" : "ok" };
    await write(SNAPSHOT_KEY, snapshot).catch(() => {});
    return result(snapshot, snapshot.status);
  } catch (error) {
    const snapshot = { schemaVersion: 1, events: valid ? stored.events : [],
      sourceReviewRequired: valid ? stored.sourceReviewRequired || [] : [],
      fetchedAt: valid ? stored.fetchedAt : 0, checkedAt: now, status: "stale", error: String(error.message || error).slice(0, 240) };
    await write(SNAPSHOT_KEY, snapshot).catch(() => {});
    return result(snapshot, "stale", snapshot.error);
  }
}
