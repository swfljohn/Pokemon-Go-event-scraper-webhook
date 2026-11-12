const SCRAPED_DUCK_EVENTS_URL =
  "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json";
const OFFICIAL_NEWS_URL = "https://pokemongo.com/news?hl=en";
const G47IX_URL = "https://g47ix.pro/";
const OFFICIAL_REGIONAL_NEWS_URL = "https://pokemongo.com/ja/news?hl=ja";
const OFFICIAL_REGIONAL_NEWS_INDEXES = [
  { locale: "en", url: OFFICIAL_NEWS_URL },
  { locale: "ja", url: OFFICIAL_REGIONAL_NEWS_URL },
  { locale: "ko", url: "https://pokemongo.com/ko/news?hl=ko" },
  { locale: "zh-Hant", url: "https://pokemongo.com/zh-Hant/news?hl=zh-Hant" },
  { locale: "fr", url: "https://pokemongo.com/fr/news?hl=fr" },
  { locale: "de", url: "https://pokemongo.com/de/news?hl=de" },
  { locale: "it", url: "https://pokemongo.com/it/news?hl=it" },
  { locale: "es", url: "https://pokemongo.com/es/news?hl=es" },
  { locale: "es-MX", url: "https://pokemongo.com/es-MX/news?hl=es-MX" },
  { locale: "pt-BR", url: "https://pokemongo.com/pt-BR/news?hl=pt-BR" },
  { locale: "th", url: "https://pokemongo.com/th/news?hl=th" },
  { locale: "tr", url: "https://pokemongo.com/tr/news?hl=tr" },
  { locale: "hi", url: "https://pokemongo.com/hi/news?hl=hi" },
  { locale: "id", url: "https://pokemongo.com/id/news?hl=id" },
  { locale: "ru", url: "https://pokemongo.com/ru/news?hl=ru" },
  { locale: "pl", url: "https://pokemongo.com/pl/news?hl=pl" }
];
import { createHash } from "node:crypto";
import { correctOfficialRegionalEvents } from "./official-regional-corrections.js";
import { saveTheDateSuperseded } from "./save-the-date-events.js";
import { iitDelhiEvent, IIT_DELHI_VERIFIED_ARTICLE_SHA256 } from "./official-regional-overlays.js";
import { curatedLocalEvents } from "./local-events.js";
import { fetchChampionshipEvents } from "./championship-events.js";
import { featuredEventDetails } from "./featured-event-details.js";
import { detailPokemonAppearanceKey } from "../event-review-pokemon.js";
import { rateEvent } from "../event-rating.js";
import { attachRaidHourGradingEvidence, publishGradingEvidence } from "./event-grading-data.js";
import { buildFieldResearchIntelligence, eventDetailFreshnessMs, researchDiscoveryCandidates } from "./event-research-intelligence.js";
import { readJson, storageConfigured, withRedisLock, writeJson } from "./storage.js";
import { runtimeExecutionContext } from "./runtime-context.js";
const LOCAL_EVENT_GRACE_MS = 14 * 60 * 60 * 1000;
const CACHE_MS = 10 * 60 * 1000;
const SOURCE_SNAPSHOT_KEY = "event:scraped-duck:last-good";
const OFFICIAL_NEWS_SNAPSHOT_KEY = "event:official-news:last-good";
const SOURCE_TIMEOUT_MS = 10_000;
const SOURCE_MAX_BYTES = 2_000_000;
const OFFICIAL_NEWS_CACHE_MS = 30 * 60 * 1000;
const OFFICIAL_NEWS_MAX_BYTES = 1_000_000;
const OFFICIAL_REGIONAL_SNAPSHOT_KEY = "event:official-regional:last-good:compact-v1";
const OFFICIAL_REGIONAL_CACHE_MS = 30 * 60 * 1000;
const OFFICIAL_REGIONAL_MAX_BYTES = 750_000;
const OFFICIAL_REGIONAL_INDEX_ARTICLE_MAX = 200;
const OFFICIAL_REGIONAL_BACKLOG_MAX = 2_400;
const OFFICIAL_REGIONAL_BATCH_SIZE = 16;
const OFFICIAL_REGIONAL_PRIORITY_BATCH_SIZE = 4;
const OFFICIAL_REGIONAL_UNPARSED_MAX = 1_000;
const OFFICIAL_REGIONAL_FETCH_CONCURRENCY = 4;
const RESEARCH_DISCOVERY_BATCH_SIZE = 3;
// Bump this when parser output changes so an older sparse detail snapshot
// cannot mask the richer article fields after deployment.
const EVENT_DETAIL_CACHE_SCHEMA_VERSION = 3;
const EVENT_DETAIL_MAX_BYTES = 2_500_000;
const EVENT_DETAIL_SNAPSHOT_PREFIX = "event:detail:";
const EVENT_RESEARCH_TASK_SOURCE_SCHEMA_VERSION = 1;
const EVENT_RESEARCH_TASK_SOURCE_MAX_BYTES = 256_000;
const EVENT_RESEARCH_TASK_SOURCE_PREFIX = "event:research-task-source:";
const EVENT_RESEARCH_KNOWLEDGE_KEY = "event:research-knowledge:v1";
const EVENT_RESEARCH_KNOWLEDGE_MAX = 500;
const CURATED_SOURCE_ALIASES = new Set([
  "lego-pokemon-go-2026",
  "pokemongo-iitdelhi-2026",
  "festival-of-lights-2026",
  "apac-mall-exploration-2026",
  "jamsil-magikarp-2026",
  "event-apac-stamp-rally-2026",
  // ScrapedDuck currently publishes an empty San Francisco Worlds shell in
  // addition to our richer official venue record. Keep the record with the
  // published Pacific schedule, coordinates, and source links.
  "pokemon-world-championships-2026-san-francisco",
  // Regional discovery sees the same Taiwan article as the curated Daan Park
  // record. Keep the curated entry with its exact venue, coordinates, species,
  // and on-site schedule instead of rendering both cards.
  "2026daanpark"
]);

let cachedResult = null;
let cachedAt = 0;
const eventDetailRefreshes = new Map();
const eventResearchTaskSourceRefreshes = new Map();
const eventResearchKnowledge = new Map();

async function mapSettledWithConcurrency(values, maximum, callback) {
  const rows = Array.isArray(values) ? values : [];
  const results = new Array(rows.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < rows.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await callback(rows[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(rows.length, Math.max(1, Number(maximum) || 1)) },
    () => worker()
  ));
  return results;
}

function nameKey(value) {
  return String(value || "").toLocaleLowerCase().replace(/[^a-z0-9♀♂]+/g, "");
}

const DEX_BY_NAME = new Map(
  Object.entries(POKEMON_NAMES).map(([dex, name]) => [nameKey(name), Number(dex)])
);

function cleanName(value) {
  return decodeEntities(value?.name || value).replace(/\s+/g, " ").trim().slice(0, 100);
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&times;/gi, "×")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(x[0-9a-f]+|[0-9]+);?/gi, (match, raw) => {
      const codePoint = /^x/i.test(raw) ? Number.parseInt(raw.slice(1), 16) : Number.parseInt(raw, 10);
      if (!Number.isInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)) return "";
      try { return String.fromCodePoint(codePoint); } catch { return ""; }
    });
}

function eventBoundary(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(text) ? text : `${text}Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function eventIsCurrent(event, now) {
  const start = eventBoundary(event?.start);
  const end = eventBoundary(event?.end);
  const localTime = event?.start && !/[zZ]$|[+-]\d\d:\d\d$/.test(String(event.start));
  const grace = localTime ? LOCAL_EVENT_GRACE_MS : 0;
  return (start === null || now >= start - grace) &&
    (end === null || now <= end + grace);
}

function addNamedEntries(target, value) {
  for (const entry of Array.isArray(value) ? value : []) {
    const name = cleanName(entry);
    if (name) target.add(name);
  }
}

function explicitEventSpecies(event) {
  const names = new Set();
  const extra = event?.extraData;
  if (!extra || typeof extra !== "object") return [];

  addNamedEntries(names, extra?.communityday?.spawns);
  addNamedEntries(names, extra?.spotlight?.list);
  const spotlightName = cleanName(extra?.spotlight?.name);
  if (spotlightName) names.add(spotlightName);

  for (const detail of Object.values(extra)) {
    if (!detail || typeof detail !== "object") continue;
    addNamedEntries(names, detail.spawns);
  }
  return [...names];
}

function cleanText(value, maximum = 200) {
  return decodeEntities(value).replace(/\s+/g, " ").trim().slice(0, maximum);
}

function containsNonEnglishScript(value) {
  for (const character of String(value || "")) {
    if (/\p{Letter}/u.test(character) && !/\p{Script=Latin}/u.test(character)) return true;
  }
  return false;
}

function englishDisplayText(value, fallback = "", maximum = 400) {
  const text = cleanText(value, maximum);
  return text && !containsNonEnglishScript(text) ? text : cleanText(fallback, maximum);
}

function officialRegionalEnglishTitle({ articleTitle = "", slug = "", timeZone = "", isBaseball = false, isStampRally = false } = {}) {
  const source = cleanText(articleTitle, 220);
  const normalizedSlug = cleanText(slug, 120).toLocaleLowerCase();

  // These official localized headlines have stable article slugs. Keep the
  // translated event name beside the source URL instead of deleting the
  // headline or reducing it to an unhelpful generic regional label.
  if (normalizedSlug === "2026daanpark" || /台北捷運/.test(source)) {
    return "Taipei Metro × Pokémon GO 10th Anniversary Event";
  }
  if (normalizedSlug === "jleague_details" || /Jリーグ|Ｊリーグ/.test(source)) {
    return "Pokémon J.League Fest Collaboration Event";
  }
  if (normalizedSlug === "dragonss_game" || /中日ドラゴンズ/.test(source)) {
    return "Pokémon Baseball Festa 2026 — Chunichi Dragons";
  }
  if (normalizedSlug === "jamsil-magikarp-2026" || /잠실.*잉어킹/.test(source)) {
    return "2026 Jamsil Magikarp Event";
  }
  if (normalizedSlug === "taipei-local-event-2026" || /台北.*(?:現場|活動)/.test(source)) {
    return "Pokémon GO Taipei Local Event";
  }

  const englishSource = englishDisplayText(source, "", 180);
  if (englishSource) return englishSource.replace(/\s+[—-]\s+Pokémon GO$/i, "");

  const place = regionalEnglishPlace(timeZone);
  if (isBaseball) return `Pokémon Baseball Festa — ${place}`;
  if (isStampRally) return `Pokémon GO Stamp Rally — ${place}`;
  return `Official Pokémon GO Event — ${place}`;
}

function sanitizeEnglishDisplayValue(value) {
  if (typeof value === "string") {
    // URLs are transport metadata, not rendered copy. Preserve localized
    // official-source links while rejecting their untranslated display text.
    if (/^https:\/\//i.test(value)) return value;
    return containsNonEnglishScript(value) ? "" : value;
  }
  if (Array.isArray(value)) {
    return value
      .map(sanitizeEnglishDisplayValue)
      .filter(entry => entry !== "" && entry !== null && entry !== undefined);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeEnglishDisplayValue(entry)]));
  }
  return value;
}

/** Stable site-local identity for events that do not provide an upstream ID. */
export function eventDetailId(event) {
  const explicit = cleanText(event?.eventID || event?.id, 160);
  if (explicit) return explicit;
  const basis = [event?.name, event?.heading, event?.eventType, event?.start, event?.end, event?.link]
    .map(value => cleanText(value, 240))
    .join("|");
  return `event-${createHash("sha1").update(basis || "pokemon-go-event").digest("hex").slice(0, 20)}`;
}

function safeOfficialNewsLink(value) {
  try {
    const url = new URL(String(value || ""), OFFICIAL_NEWS_URL);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "pokemongo.com") return "";
    // Official Pokémon GO publishes regional announcements under locale
    // prefixes such as /ja/news and /ko/news as well as /news.
    if (!/^\/(?:[a-z]{2}(?:[-_][a-z]{2,4})?\/)?(?:news|post)\//i.test(url.pathname)) return "";
    return url.href.slice(0, 500);
  } catch {
    return "";
  }
}

/**
 * The official site does not publish a stable event JSON feed. Its news index
 * is still useful as a second, independent discovery signal, especially for
 * regional announcements that are absent from ScrapedDuck. Keep this parser
 * deliberately conservative: it discovers article links/titles only; dates,
 * bonuses, and locations are never invented from an index page.
 */
export function parseOfficialNewsIndex(html) {
  const rows = [];
  const seen = new Set();
  const source = String(html || "");
  const pattern = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(source))) {
    const link = safeOfficialNewsLink(match[2]);
    if (!link || seen.has(link)) continue;
    const title = cleanText(String(match[4] || "").replace(/<[^>]+>/g, " "), 180);
    if (!title || title.length < 8 || /^(?:read more|learn more|news|events?)$/i.test(title)) continue;
    seen.add(link);
    rows.push({ title, href: link });
    if (rows.length >= 120) break;
  }
  return rows;
}

// Follow only the publisher's exposed older-post link; never guess page offsets.
export function officialNewsOlderPage(html, baseUrl) {
  for (const match of String(html || "").matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/title=["']go to older posts["']/i.test(tag)) continue;
    try {
      const href = decodeEntities(tag.match(/href=["']([^"']+)/i)?.[1] || "");
      const url = new URL(href, baseUrl);
      if (url.origin === "https://pokemongo.com" && /^\/(?:[a-z_-]+\/)?news$/i.test(url.pathname)) return url.href;
    } catch {}
  }
  return "";
}

function htmlAttribute(tag, name) {
  const match = String(tag || "").match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function articleBlock(html) {
  const source = String(html || "");
  return source.match(/<article\b[\s\S]*?<\/article>/i)?.[0] || source;
}

function htmlText(html) {
  return decodeEntities(String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>(?=.)/gi, "\n")
    .replace(/<\/(?:p|li|h[1-6]|div|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function metaContent(html, key) {
  for (const tag of String(html || "").match(/<meta\b[^>]*>/gi) || []) {
    const property = htmlAttribute(tag, "property") || htmlAttribute(tag, "name");
    if (property.toLocaleLowerCase() === key.toLocaleLowerCase()) return htmlAttribute(tag, "content");
  }
  return "";
}

async function readBoundedText(response, maximumBytes, sizeError) {
  const declaredLength = Number(response?.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) throw new Error(sizeError);
  if (!response?.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maximumBytes) throw new Error(sizeError);
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value?.byteLength || 0;
      if (bytes > maximumBytes) {
        await reader.cancel(sizeError).catch(() => {});
        throw new Error(sizeError);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function likelyRegionalArticle(article) {
  const haystack = `${article?.title || ""} ${article?.href || ""}`;
  return /baseball|ベースボール|野球|stadium|球場|ドーム|スタジアム|festa|festival|partnership|partner|j[- ]?league|mlb|game day|stamp rally|mall|museum|airport|park|local event|스탬프|랠리|페스타|야구|경기장|잠실|코엑스|서울|부산|集章|會場|現場|球場|商場|機場|公園|台北|臺北/i.test(haystack);
}

function dateKey(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function regionalTimeZoneOffset(timeZone) {
  if (timeZone === "Asia/Tokyo" || timeZone === "Asia/Seoul") return "+09:00";
  if (timeZone === "Asia/Taipei") return "+08:00";
  return "";
}

function regionalTimeZoneLabel(timeZone) {
  if (timeZone === "Asia/Tokyo") return "JST";
  if (timeZone === "Asia/Seoul") return "KST";
  if (timeZone === "Asia/Taipei") return "Taiwan time";
  return "local time";
}

function regionalEnglishPlace(timeZone) {
  if (timeZone === "Asia/Tokyo") return "Japan";
  if (timeZone === "Asia/Seoul") return "South Korea";
  if (timeZone === "Asia/Taipei") return "Taiwan";
  return "the published regional venue";
}

function rangeWindow({ startDate, endDate = startDate, startTime = "00:00:00", endTime = "23:59:59", hasPublishedHours = false }) {
  return { date: startDate, endDate, startTime, endTime, hasPublishedHours };
}

function parseKoreanDateWindows(source) {
  const windows = [];
  const rangePattern = /(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(?:(\d{1,2}):(\d{2}))?\s*부터\s*(?:(20\d{2})년\s*)?(?:(\d{1,2})월\s*)?(\d{1,2})일\s*(?:(\d{1,2}):(\d{2}))?\s*까지/g;
  let match;
  while ((match = rangePattern.exec(source))) {
    const startDate = dateKey(match[1], match[2], match[3]);
    const endDate = dateKey(match[6] || match[1], match[7] || match[2], match[8]);
    windows.push(rangeWindow({
      startDate,
      endDate,
      startTime: match[4] ? `${String(match[4]).padStart(2, "0")}:${match[5]}:00` : "00:00:00",
      endTime: match[9] ? `${String(match[9]).padStart(2, "0")}:${match[10]}:00` : "23:59:59",
      hasPublishedHours: Boolean(match[4] || match[9])
    }));
  }
  const singleDayPattern = /(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2}):(\d{2})\s*부터\s*(\d{1,2}):(\d{2})\s*까지/g;
  while ((match = singleDayPattern.exec(source))) {
    const date = dateKey(match[1], match[2], match[3]);
    if (windows.some(window => window.date === date && window.endDate === date)) continue;
    windows.push(rangeWindow({
      startDate: date,
      startTime: `${String(match[4]).padStart(2, "0")}:${match[5]}:00`,
      endTime: `${String(match[6]).padStart(2, "0")}:${match[7]}:00`,
      hasPublishedHours: true
    }));
  }
  return windows;
}

function parseTraditionalChineseDateWindows(source) {
  const windows = [];
  const rangePattern = /(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日\s*(?:(\d{1,2}):(\d{2}))?\s*(?:～|~|至|到)\s*(?:(20\d{2})年\s*)?(?:(\d{1,2})月\s*)?(\d{1,2})日\s*(?:(\d{1,2}):(\d{2}))?/g;
  let match;
  while ((match = rangePattern.exec(source))) {
    windows.push(rangeWindow({
      startDate: dateKey(match[1], match[2], match[3]),
      endDate: dateKey(match[6] || match[1], match[7] || match[2], match[8]),
      startTime: match[4] ? `${String(match[4]).padStart(2, "0")}:${match[5]}:00` : "00:00:00",
      endTime: match[9] ? `${String(match[9]).padStart(2, "0")}:${match[10]}:00` : "23:59:59",
      hasPublishedHours: Boolean(match[4] || match[9])
    }));
  }
  return windows;
}

function finishRegionalDateWindows(windows, timeZone) {
  const offset = regionalTimeZoneOffset(timeZone);
  const seen = new Set();
  return windows
    .filter(window => {
      const key = `${window.date}|${window.endDate || window.date}|${window.startTime}|${window.endTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.date.localeCompare(right.date))
    .map(window => ({
      ...window,
      start: `${window.date}T${window.startTime}${offset}`,
      end: `${window.endDate || window.date}T${window.endTime}${offset}`
    }));
}

function parseRegionalDateWindows(text, timeZone = "") {
  const windows = new Map();
  const source = String(text || "");
  if (timeZone === "Asia/Seoul") {
    const korean = parseKoreanDateWindows(source);
    if (korean.length) return finishRegionalDateWindows(korean, timeZone);
  }
  if (timeZone === "Asia/Taipei") {
    const traditionalChinese = parseTraditionalChineseDateWindows(source);
    if (traditionalChinese.length) return finishRegionalDateWindows(traditionalChinese, timeZone);
  }
  const jpDate = /(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/g;
  let match;
  while ((match = jpDate.exec(source))) {
    const date = dateKey(match[1], match[2], match[3]);
    const lineStart = source.lastIndexOf("\n", match.index) + 1;
    const lineEnd = source.indexOf("\n", match.index);
    const line = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd);
    const time = line.match(/(\d{1,2}):(\d{2})\s*(?:-|–|—|〜|~)\s*(\d{1,2}):(\d{2})/);
    const existing = windows.get(date);
    if (!existing || time) {
      windows.set(date, {
        date,
        startTime: time ? `${String(time[1]).padStart(2, "0")}:${time[2]}:00` : "00:00:00",
        endTime: time ? `${String(time[3]).padStart(2, "0")}:${time[4]}:00` : "23:59:59",
        hasPublishedHours: Boolean(time)
      });
    }
    // Japanese announcements commonly write the year/month once followed by
    // a comma-separated list of days (e.g. 21日、22日、23日).
    const list = source.slice(match.index, match.index + 80);
    for (const dayMatch of list.matchAll(/[、,]\s*(\d{1,2})日/g)) {
      const listedDate = dateKey(match[1], match[2], dayMatch[1]);
      if (!windows.has(listedDate)) windows.set(listedDate, {
        date: listedDate,
        startTime: "00:00:00",
        endTime: "23:59:59",
        hasPublishedHours: false
      });
    }
  }

  const englishDate = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?,?\s*(20\d{2})/gi;
  const months = new Map([
    ["january", 1], ["february", 2], ["march", 3], ["april", 4], ["may", 5], ["june", 6],
    ["july", 7], ["august", 8], ["september", 9], ["october", 10], ["november", 11], ["december", 12]
  ]);
  while ((match = englishDate.exec(source))) {
    const month = months.get(String(match[1]).toLocaleLowerCase());
    const first = Number(match[2]);
    const last = Number(match[3] || first);
    for (let day = first; day <= last && day < first + 32; day += 1) {
      const date = dateKey(match[4], month, day);
      if (!windows.has(date)) windows.set(date, {
        date,
        startTime: "00:00:00",
        endTime: "23:59:59",
        hasPublishedHours: false
      });
    }
  }

  return finishRegionalDateWindows([...windows.values()], timeZone);
}

function officialVenueCoordinates(location) {
  const value = String(location || "").toLocaleLowerCase();
  if (value.includes("バンテリンドーム") || value.includes("vantelin dome")) return "35.185980, 136.947493";
  return "";
}

function translatedRegionalLocation(source, timeZone) {
  if (/대한민국\s*전역/.test(source)) return "South Korea (nationwide)";
  if (/全台新光三越/.test(source)) return "Participating Shin Kong Mitsukoshi stores across Taiwan";
  if (/香堤大道/.test(source)) return /新光三越/.test(source)
    ? "Xiangti Avenue Plaza and Shin Kong Mitsukoshi Taipei Xinyi Place, Taipei"
    : "Xiangti Avenue, Taipei";
  if (/롯데월드타워.*아레나/.test(source)) return "Lotte World Tower and Mall Arena Square, Seoul";
  return englishDisplayText(source, `Published location in ${regionalEnglishPlace(timeZone)} (see official source)`, 260);
}

function officialRegionalLocation(text) {
  const source = String(text || "");
  const labeled = source.match(/(?:場所|会場|장소|위치|행사장|location|venue|地點|地点|活動地點|活動會場)\s*[:：]\s*([^\n]+)/i);
  if (labeled?.[1]) return cleanText(labeled[1], 260);
  // Korean and Traditional Chinese regional announcements often publish the
  // venue on the same structured schedule line after a slash instead of under
  // a translated "Location" heading.
  const scheduleLine = source.split("\n").find(line =>
    /(?:한국시간|台灣時間|臺灣時間|20\d{2}[年년])/.test(line) && /[\/／]/.test(line)
  );
  if (!scheduleLine) return "";
  return cleanText(scheduleLine.split(/[\/／]/).slice(1).join(" / "), 260);
}

function officialRegionalTimeZone(link, text) {
  if (/\/ko\/news\//i.test(link) || /한국시간/.test(text)) return "Asia/Seoul";
  if (/\/zh(?:[-_]hant)?\/news\//i.test(link) || /(?:台灣|臺灣)時間/.test(text)) return "Asia/Taipei";
  if (/\/(?:ja|jp)\/news\//i.test(link) || /日本時間|ベースボール|野球|球場|ドーム|スタジアム/.test(text)) return "Asia/Tokyo";
  return "";
}

function articleListItems(block) {
  return [...String(block || "").matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(match => cleanText(htmlText(match[1]), 360))
    .filter(item => item.length >= 4)
    .slice(0, 12);
}

/**
 * Promote official regional announcements only when the article itself
 * publishes both a venue and structured dates. This deliberately remains
 * fail-closed: widening locale discovery must never turn ordinary news posts
 * into guessed calendar events.
 */
export function parseOfficialRegionalArticle(html, { url = "", title = "", splitLocations = true, selectedLocation = null } = {}) {
  const link = safeOfficialNewsLink(url);
  if (!link) return [];
  const block = articleBlock(html);
  const text = htmlText(block);
  if (new URL(link).pathname.endsWith("/pokemongo-iitdelhi-2026")) {
    if (createHash("sha256").update(block).digest("hex") !== IIT_DELHI_VERIFIED_ARTICLE_SHA256) {
      throw new Error("Source content changed: IIT Delhi curated details require review against the updated official announcement.");
    }
    return [iitDelhiEvent()];
  }
  const articleTitle = cleanText(title || metaContent(html, "og:title") || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1], 180);
  const pairedLocations = [...text.matchAll(/活動時間[：:]([^\n]+)\s*活動地點[：:]([^\n]+)/g)];
  if (splitLocations && pairedLocations.length > 1) return pairedLocations.flatMap((pair, index) =>
    parseOfficialRegionalArticle(html, { url, title: articleTitle, splitLocations: false, selectedLocation: { text: pair[0], location: pair[2] } })
      .map(event => ({ ...event, id: `${event.id}-location-${index + 1}` })));
  const sourceLocation = selectedLocation?.location || officialRegionalLocation(text);
  if (!sourceLocation) return [];
  const timeZone = officialRegionalTimeZone(link, text);
  const windows = parseRegionalDateWindows(selectedLocation?.text || text, timeZone);
  if (!windows.length) return [];
  const slug = new URL(link).pathname.split("/").filter(Boolean).pop() || "regional-event";
  const baseId = slug === "dragonss_game"
    ? "local-japan-baseball-festa-chunichi-dragons"
    : `local-official-${slug}`;
  const image = safeEventImage(metaContent(html, "og:image"));
  const isBaseball = /baseball|ベースボール|野球|야구|棒球/i.test(`${articleTitle} ${text}`);
  const isStampRally = /stamp rally|スタンプラリー|스탬프\s*랠리|集章/i.test(`${articleTitle} ${text}`);
  const isPikachu = /ピカチュウ|피카츄|皮卡丘|pikachu/i.test(text);
  const displayTitle = slug === "hangul-nal-2026" ? "Hangul Day 2026 — South Korea" : slug === "2026oct-skmtw" ? "Shin Kong Mitsukoshi Pokémon GO Postcards — Taiwan" : officialRegionalEnglishTitle({
    articleTitle,
    slug,
    timeZone,
    isBaseball,
    isStampRally
  });
  const displayLocation = translatedRegionalLocation(sourceLocation, timeZone);
  const regionalScope = /대한민국\s*전역|全台/.test(sourceLocation);
  const bonuses = [];
  if (/レイド|레이드|團體戰|团体战|raid/i.test(text)) bonuses.push("Special Raid Battles are published in the official announcement.");
  if (isPikachu) bonuses.push("Pikachu is featured in the official regional activation.");
  if (/色違い|색이 다른|異色|shiny/i.test(text)) bonuses.push("A Shiny encounter chance is mentioned in the official announcement.");
  if (/ロケーション背景|스페셜 배경|로케이션 배경|地點背卡|特殊背景|location background/i.test(text)) bonuses.push("A location-background encounter chance is mentioned in the official announcement.");
  if (/タイムチャレンジ|タイムドリサーチ|시간제한 리서치|限時調查|限时调查|timed research/i.test(text)) bonuses.push("Timed Research is available at the venue according to the official announcement.");
  if (/ポケストップ|포켓스톱|寶可補給站|宝可补给站|pokéstop|pokestop/i.test(text)) bonuses.push("Special PokéStops are mentioned for the venue.");
  if (/大量発生|대량발생|大量出現|mass outbreak/i.test(text)) bonuses.push("A Pokémon mass outbreak is published for this regional event.");
  const summary = englishDisplayText((block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || text), "", 800);
  const listItems = articleListItems(block).filter(item => !containsNonEnglishScript(item));
  const publishedDetails = listItems.length
    ? listItems
    : summary ? [summary] : bonuses.length ? bonuses : ["See the official announcement for complete venue details."];
  const sourceLinks = [{ label: "Official Pokémon GO regional announcement", href: link }];
  const translatedSections = slug === "hangul-nal-2026" ? [
    { title: "Lure and Incense encounters", items: ["Gabite, Gligar, Rapidash, Growlithe, Aron, Meowth, Swirlix, Furret, Audino, Raichu, and Lapras are attracted to regular Lure Modules and Incense. Daily Adventure Incense is excluded.", "These featured encounters have an increased Shiny chance."] },
    { title: "Event bonuses", items: ["Lure Modules last one hour. Incense lasts two hours; Daily Adventure Incense is excluded."] },
    { title: "Collection Challenge", items: ["Complete event-themed Collection Challenges across South Korea for 5,000 XP, 5,000 Stardust, and an Unown (H) encounter, with a possible Shiny encounter."] }
  ] : slug === "2026oct-skmtw" ? [
    { title: regionalScope ? "Taiwan store postcards" : "Taipei in-person celebration", items: regionalScope ? ["October 1–December 31: spin nearby PokéStops at participating Shin Kong Mitsukoshi stores to collect anniversary postcards.", "Six postcard designs represent Taipei, Taoyuan, Taichung, Chiayi, Tainan, and Kaohsiung."] : ["October 10–11: the activation covers Xiangti Avenue Plaza and neighboring Shin Kong Mitsukoshi Taipei Xinyi Place.", "The announcement links the PokéXciting! Taipei celebration, including PokéXciting! Pikachu (Pink) at the Taipei venue; it does not publish separate gameplay hours for this store activation."] },
    { title: "Related anniversary celebration", items: ["The announcement celebrates Pokémon’s 30th anniversary and links participating store information and the dedicated PokéXciting! Taipei event page."] }
  ] : [{ title: "Official announcement details", items: publishedDetails }];
  return windows.map(window => ({
    id: `${baseId}-${window.date}`,
    name: displayTitle,
    heading: isBaseball ? "Official Regional Baseball Partnership" : isStampRally ? "Official Regional Stamp Rally" : "Official Regional Event",
    eventType: isStampRally ? "stamp-rally" : "local-partnership",
    start: window.start,
    end: window.end,
    link,
    imageUrl: image,
    species: isPikachu ? ["Pikachu"] : [],
    bonuses: bonuses.length ? bonuses : ["See the official regional announcement for the published event details."],
    hasSpawns: false,
    location: displayLocation,
    coordinates: officialVenueCoordinates(sourceLocation),
    timeZone,
    scope: regionalScope ? "regional" : "venue",
    startingSoonAlert: window.hasPublishedHours === true && !isStampRally,
    sourceLabel: "Official Pokémon GO regional discovery",
    scheduleNote: window.hasPublishedHours
      ? `Published regional activation window: ${window.date} ${window.startTime.slice(0, 5)}–${window.endDate || window.date} ${window.endTime.slice(0, 5)} ${regionalTimeZoneLabel(timeZone)}.`
      : `The official regional announcement publishes ${window.date}${window.endDate && window.endDate !== window.date ? `–${window.endDate}` : ""} but does not publish gameplay hours; check the source before traveling.`,
    venueNote: "Location is taken from the official regional announcement. Coordinates are shown only when the venue is in the verified venue map.",
    ticketRequired: false,
    specialBackground: /ロケーション背景|스페셜 배경|로케이션 배경|地點背卡|特殊背景|location background/i.test(text),
    costumePokemon: /シャツ|コスチューム|의상|코스튬|扮裝|服裝|costume|shirt/i.test(text),
    details: {
      sections: translatedSections,
      sourceLinks
    }
  }));
}

function regionalEventStillCurrent(event, now) {
  const end = Date.parse(String(event?.end || ""));
  return !Number.isFinite(end) || end >= now;
}

function compactOfficialRegionalIndexRecord(record) {
  return {
    ...record,
    articles: Array.isArray(record?.articles)
      ? record.articles.slice(0, OFFICIAL_REGIONAL_INDEX_ARTICLE_MAX)
      : []
  };
}

function regionalSnapshotResult(status, stored, now, error = "") {
  return {
    status,
    source: "Official regional Pokémon GO announcements",
    url: OFFICIAL_REGIONAL_NEWS_URL,
    fetchedAt: Number(stored?.fetchedAt) || 0,
    indexFetchedAt: Number(stored?.indexFetchedAt) || 0,
    discoveredCount: Number(stored?.discoveredCount) || 0,
    candidateCount: Number(stored?.candidateCount) || 0,
    processedCount: Array.isArray(stored?.processedHrefs) ? stored.processedHrefs.length : 0,
    promotedArticleCount: Number(stored?.promotedArticleCount) || 0,
    queuedCount: Array.isArray(stored?.backlog) ? stored.backlog.length : 0,
    queueCursor: stored?.backlog?.[0]?.href || "",
    sourceReviewRequired: [...(stored?.backlog || []), ...(stored?.overflow || [])].filter(row => row.needsReview).map(row => ({ href: row.href, reason: row.lastError })),
    unparsedCount: Array.isArray(stored?.unparsed) ? stored.unparsed.length : 0,
    unparsedArticles: (Array.isArray(stored?.unparsed) ? stored.unparsed : []).slice(-8),
    backlogOverflowCount: Number(stored?.backlogOverflowCount) || 0,
    indexHealth: Array.isArray(stored?.indexRecords) ? stored.indexRecords.map(row => ({
      locale: row.locale, status: row.status, fetchedAt: Number(row.fetchedAt) || 0,
      discoveredCount: Array.isArray(row.articles) ? row.articles.length : 0, error: row.error || ""
    })) : [],
    events: Array.isArray(stored?.events) ? stored.events : [],
    ...(error ? { error: String(error).slice(0, 240) } : {})
  };
}

/**
 * Scan each currently exposed official language index and drain a persistent
 * article backlog in bounded batches. Every discovered link is either pending,
 * promoted, or retained in the explicit unparsed queue.
 */
export async function fetchOfficialRegionalEvents({
  force = false, now = Date.now(), allowNetwork = true,
  fetcher = globalThis.fetch, read = readJson, write = writeJson
} = {}) {
  const stored = await read(OFFICIAL_REGIONAL_SNAPSHOT_KEY).catch(() => null);
  const validSnapshot = stored?.schemaVersion >= 4 && Array.isArray(stored?.events) && Array.isArray(stored?.backlog);
  const indexRecords = Array.isArray(stored?.indexRecords) ? stored.indexRecords.map(compactOfficialRegionalIndexRecord) : [];
  const freshIndexes = validSnapshot && indexRecords.length === OFFICIAL_REGIONAL_NEWS_INDEXES.length &&
    // "partial" = the current index parsed; only its older-page history failed. Retrying that every minute
    // refetched all 16 locales each cron run (2026-10: stuck since 09-23), so it waits for the normal cadence.
    indexRecords.every(row => (row.status === "ok" || row.status === "partial") && Number(row.fetchedAt) > 0 &&
      now - Number(row.fetchedAt) < OFFICIAL_REGIONAL_CACHE_MS);
  const cacheFresh = validSnapshot && now - Number(stored.fetchedAt || 0) < OFFICIAL_REGIONAL_CACHE_MS;
  // A stale snapshot keeps fetchedAt from its last fully healthy run, so also honor the last attempt: one
  // refresh per cache window, plus whenever a backlogged article's own retry time has come.
  const recentAttempt = validSnapshot && now - Number(stored.lastAttemptAt || 0) < OFFICIAL_REGIONAL_CACHE_MS;
  const backlogDue = validSnapshot && stored.backlog.some(row => Number(row?.retryAt || 0) <= now);
  if (!force && !allowNetwork) {
    return validSnapshot
      ? regionalSnapshotResult(cacheFresh && stored.status !== "stale" ? "ok" : "stale", stored, now, stored.error || (cacheFresh ? "" : "Using persisted official regional discovery while scheduled refresh runs."))
      : { ...regionalSnapshotResult("pending", null, now), events: [] };
  }
  if (!force && cacheFresh && !(allowNetwork && stored.backlog.length)) {
    return regionalSnapshotResult(stored.status === "stale" ? "stale" : "ok", stored, now, stored.error || "");
  }
  if (!force && recentAttempt && !backlogDue) {
    return regionalSnapshotResult(stored.status === "stale" ? "stale" : "ok", stored, now, stored.error || "");
  }

  const shouldFetchIndexes = force || !freshIndexes;
  let records;
  let pages = [];
  if (shouldFetchIndexes) {
    pages = await Promise.allSettled(OFFICIAL_REGIONAL_NEWS_INDEXES.map(async index => {
      const response = await fetcher(index.url, {
        headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "PokemonGoEventWebhook/1.0" },
        signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS)
      });
      if (!response.ok) throw new Error(`Official ${index.locale} news index returned HTTP ${response.status}.`);
      const contentType = String(response.headers.get("content-type") || "").toLocaleLowerCase();
      if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        throw new Error(`Official ${index.locale} news index returned an unexpected content type.`);
      }
      const text = await readBoundedText(response, OFFICIAL_NEWS_MAX_BYTES, "Official regional index exceeded the source size limit.");
      const currentArticles = parseOfficialNewsIndex(text);
      if (!currentArticles.length) throw new Error(`Official ${index.locale} news index returned no parseable article links.`);
      let articles = currentArticles.slice(0, OFFICIAL_REGIONAL_INDEX_ARTICLE_MAX);
      const previous = indexRecords.find(row => row.locale === index.locale);
      const olderUrl = previous?.nextPage || officialNewsOlderPage(text, index.url);
      let nextPage = "";
      let historyError = "";
      if (olderUrl) {
        try {
          const olderResponse = await fetcher(olderUrl, {
            headers: { Accept: "text/html", "User-Agent": "PokemonGoEventWebhook/1.0" },
            signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS)
          });
          if (!olderResponse.ok) throw new Error(`Official ${index.locale} older index returned HTTP ${olderResponse.status}.`);
          const olderText = await readBoundedText(olderResponse, OFFICIAL_NEWS_MAX_BYTES, "Official older index exceeded the source size limit.");
          const olderArticles = parseOfficialNewsIndex(olderText);
          if (!olderArticles.length) throw new Error(`Official ${index.locale} older index returned no parseable links.`);
          articles = [
            ...articles,
            ...olderArticles.slice(0, Math.max(0, OFFICIAL_REGIONAL_INDEX_ARTICLE_MAX - articles.length))
          ];
          nextPage = officialNewsOlderPage(olderText, olderUrl);
        } catch (error) {
          // Keep today's authoritative index even if pagination history is
          // temporarily unavailable, and retry the exact failed page later.
          historyError = String(error?.message || error).slice(0, 240);
          nextPage = olderUrl;
          const previousArticles = Array.isArray(previous?.articles)
            ? previous.articles.slice(0, Math.max(0, OFFICIAL_REGIONAL_INDEX_ARTICLE_MAX - articles.length))
            : [];
          articles = [...articles, ...previousArticles];
        }
      }
      if (!articles.length) throw new Error(`Official ${index.locale} news index returned no parseable article links.`);
      return { ...index, articles, currentArticles, nextPage, historyError };
    }));
    const previousByLocale = new Map(indexRecords.map(row => [row.locale, row]));
    records = pages.map((page, index) => {
      const descriptor = OFFICIAL_REGIONAL_NEWS_INDEXES[index];
      if (page.status === "fulfilled") return {
        ...descriptor, status: page.value.historyError ? "partial" : "ok", fetchedAt: now,
        articles: page.value.articles.slice(0, OFFICIAL_REGIONAL_INDEX_ARTICLE_MAX),
        nextPage: page.value.nextPage, error: page.value.historyError || ""
      };
      const previous = previousByLocale.get(descriptor.locale);
      return {
        ...descriptor, status: previous?.articles?.length ? "stale" : "error",
        fetchedAt: Number(previous?.fetchedAt) || 0,
        articles: Array.isArray(previous?.articles)
          ? previous.articles.slice(0, OFFICIAL_REGIONAL_INDEX_ARTICLE_MAX)
          : [],
        nextPage: previous?.nextPage || "",
        error: String(page.reason?.message || page.reason).slice(0, 240)
      };
    });
    if (pages.every(page => page.status === "rejected") && !indexRecords.some(row => Array.isArray(row.articles) && row.articles.length)) {
      const error = String(pages[0]?.reason?.message || "All official regional language indexes failed.");
      return stored?.events?.length
        ? regionalSnapshotResult("stale", { ...stored, indexRecords: records }, now, error)
        : { ...regionalSnapshotResult("error", { indexRecords: records }, now, error), events: [] };
    }
  } else {
    records = indexRecords;
  }

  const articleByHref = new Map();
  for (const record of records) for (const article of Array.isArray(record.articles) ? record.articles : []) {
    const href = safeOfficialNewsLink(article?.href);
    if (href && !articleByHref.has(href)) articleByHref.set(href, {
      title: cleanText(article.title, 180), href, locale: record.locale
    });
  }
  const articles = [...articleByHref.values()];
  const savedQueue = [...(stored?.backlog || []), ...(stored?.overflow || [])];
  const backlogByHref = new Map();
  for (const row of savedQueue.map(row => ({
    title: cleanText(row.title, 180), href: safeOfficialNewsLink(row.href),
    locale: cleanText(row.locale, 20), attempts: Math.max(0, Number(row.attempts) || 0),
    retryAt: Math.max(0, Number(row.retryAt) || 0),
    needsReview: row.needsReview === true, lastError: cleanText(row.lastError, 240), priority: row.priority === true
  })).filter(row => row.href)) {
    const prior = backlogByHref.get(row.href);
    if (!prior) {
      backlogByHref.set(row.href, row);
      continue;
    }
    // Old snapshots may contain the same URL in both queue partitions. Merge
    // retry/review metadata before keeping one pending record for that URL.
    prior.attempts = Math.max(prior.attempts, row.attempts);
    prior.retryAt = Math.max(prior.retryAt, row.retryAt);
    prior.needsReview ||= row.needsReview;
    prior.priority ||= row.priority;
    if (row.lastError && (!prior.lastError || row.needsReview)) prior.lastError = row.lastError;
  }
  const backlog = [...backlogByHref.values()];
  const unparsed = Array.isArray(stored?.unparsed) ? stored.unparsed.filter(row => safeOfficialNewsLink(row?.href)) : [];
  const promotedHrefs = new Set((Array.isArray(stored?.events) ? stored.events : []).map(event => safeOfficialNewsLink(event?.link)).filter(Boolean));
  const processedHrefs = Array.isArray(stored?.processedHrefs) ? stored.processedHrefs.map(safeOfficialNewsLink).filter(Boolean) : [];
  const processedSet = new Set([...processedHrefs, ...promotedHrefs, ...unparsed.map(row => safeOfficialNewsLink(row.href))]);
  const queuedSet = new Set(backlog.map(row => row.href));
  const currentIndexPendingHrefs = new Set();
  if (shouldFetchIndexes) for (const page of pages) {
    if (page.status !== "fulfilled") continue;
    for (const article of page.value.currentArticles || []) {
      const href = safeOfficialNewsLink(article?.href);
      if (href && !processedSet.has(href)) currentIndexPendingHrefs.add(href);
    }
  }
  // A URL can already be pending from an older snapshot and still appear on
  // today's current index. Promote only that exact fresh/current evidence,
  // changing no retry, review, or error metadata on the queued row.
  for (const article of backlog) {
    if (currentIndexPendingHrefs.has(article.href)) article.priority = true;
  }
  const revalidate = stored?.parserVersion !== 5 || now - Number(stored?.revalidatedAt || 0) >= 24 * 60 * 60 * 1000;
  const candidates = revalidate ? [...articles,
    ...(stored?.events || []).map(event => ({ href: event.link, title: event.name })),
    ...unparsed] : articles;
  const candidateSeen = new Set();
  const newArticles = candidates.filter(article => {
    if (!article.href || candidateSeen.has(article.href) || queuedSet.has(article.href)) return false;
    candidateSeen.add(article.href);
    return revalidate || !processedSet.has(article.href);
  });
  const normalizedNewArticles = newArticles.map(article => ({
    ...article, attempts: 0, retryAt: 0, priority: currentIndexPendingHrefs.has(safeOfficialNewsLink(article.href))
  }));
  const priorityNewArticles = normalizedNewArticles.filter(article => article.priority)
    .sort((left, right) => Number(likelyRegionalArticle(right)) - Number(likelyRegionalArticle(left)));
  const priorityBacklog = backlog.filter(article => article.priority)
    .sort((left, right) => Number(likelyRegionalArticle(right)) - Number(likelyRegionalArticle(left)));
  const ordinaryNewArticles = normalizedNewArticles.filter(article => !article.priority)
    .sort((left, right) => Number(likelyRegionalArticle(right)) - Number(likelyRegionalArticle(left)));
  let queue = [...priorityNewArticles, ...priorityBacklog, ...backlog.filter(article => !article.priority), ...ordinaryNewArticles];
  let backlogOverflowCount = 0;
  let overflow = [];
  const readyQueue = queue.filter(article => Number(article.retryAt) <= now);
  const priorityDue = readyQueue.filter(article => article.priority);
  const ordinaryDue = readyQueue.filter(article => !article.priority);
  const firstPriority = priorityDue.slice(0, OFFICIAL_REGIONAL_PRIORITY_BATCH_SIZE);
  const ordinary = ordinaryDue.slice(0, OFFICIAL_REGIONAL_BATCH_SIZE - firstPriority.length);
  const extraPriority = priorityDue.slice(firstPriority.length, OFFICIAL_REGIONAL_BATCH_SIZE - ordinary.length);
  const due = [...firstPriority, ...ordinary, ...extraPriority];
  const dueByHref = new Map(due.map(article => [article.href, article]));
  const articlePages = await mapSettledWithConcurrency(due, OFFICIAL_REGIONAL_FETCH_CONCURRENCY, async article => {
    const response = await fetcher(article.href, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "PokemonGoEventWebhook/1.0" },
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`Official regional article returned HTTP ${response.status}.`);
    const contentType = String(response.headers.get("content-type") || "").toLocaleLowerCase();
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) throw new Error("Official regional article returned an unexpected content type.");
    const text = await readBoundedText(response, OFFICIAL_REGIONAL_MAX_BYTES, "Official regional article exceeded the source size limit.");
    return parseOfficialRegionalArticle(text, { url: article.href, title: article.title });
  });
  const newEvents = [];
  const replacedSources = new Set();
  const newUnparsed = [];
  const completedHrefs = [];
  let goneArticles = 0;
  const failureMessages = records.filter(row => row.status !== "ok").map(row => `${row.locale}: ${row.error}`);
  for (let index = 0; index < due.length; index += 1) {
    const article = due[index];
    const result = articlePages[index];
    if (result?.status === "fulfilled") {
      completedHrefs.push(article.href);
      if (result.value.length) {
        newEvents.push(...result.value);
        replacedSources.add(article.href);
      }
      else newUnparsed.push({
        href: article.href, title: article.title, locale: article.locale,
        reason: "No structured regional date/location was promoted by the current parser.",
        checkedAt: now
      });
    } else {
      const attempts = (Number(article.attempts) || 0) + 1;
      const message = String(result?.reason?.message || result?.reason || "Official article fetch failed.").slice(0, 240);
      // A deleted article never comes back. After three consecutive 404/410 answers stop retrying it; on
      // 2026-11-09, 130 removed articles had been retried 192 times each and kept this source marked stale.
      if (attempts >= 3 && /returned HTTP (?:404|410)\./.test(message)) {
        completedHrefs.push(article.href);
        goneArticles += 1;
        newUnparsed.push({ href: article.href, title: article.title, locale: article.locale,
          reason: "The official article no longer exists (HTTP 404/410).", checkedAt: now });
        continue;
      }
      failureMessages.push(`${article.locale || "article"}: ${message}`);
      article.needsReview = /Source content changed:/.test(message);
      article.lastError = message;
      article.attempts = attempts;
      article.retryAt = now + Math.min(6 * 60 * 60 * 1000, 30_000 * 2 ** Math.min(attempts, 9));
    }
  }
  queue = queue.filter(article => !dueByHref.has(article.href) || !completedHrefs.includes(article.href));
  if (queue.length > OFFICIAL_REGIONAL_BACKLOG_MAX) {
    overflow = queue.slice(OFFICIAL_REGIONAL_BACKLOG_MAX);
    backlogOverflowCount = overflow.length;
    queue = queue.slice(0, OFFICIAL_REGIONAL_BACKLOG_MAX);
  }
  const mergedEventsById = new Map((Array.isArray(stored?.events) ? stored.events : [])
    .filter(event => regionalEventStillCurrent(event, now) && !replacedSources.has(safeOfficialNewsLink(event?.link)))
    .map(event => [String(event?.id || `${event?.link}|${event?.start}`), event]));
  for (const event of newEvents) mergedEventsById.set(String(event?.id || `${event?.link}|${event?.start}`), event);
  const events = [...mergedEventsById.values()];
  const mergedUnparsed = [...newUnparsed, ...unparsed].filter(row => !replacedSources.has(safeOfficialNewsLink(row.href))).reduce((rows, row) => {
    const href = safeOfficialNewsLink(row.href);
    if (href && !rows.some(existing => existing.href === href)) rows.push({
      href, title: cleanText(row.title, 180), locale: cleanText(row.locale, 20),
      reason: cleanText(row.reason, 240), checkedAt: Number(row.checkedAt) || now
    });
    return rows;
  }, []).slice(-OFFICIAL_REGIONAL_UNPARSED_MAX);
  const allIndexOk = records.length === OFFICIAL_REGIONAL_NEWS_INDEXES.length && records.every(row => row.status === "ok");
  // "partial" = today's index parsed and only the older-history page failed. That is a healthy crawl of current
  // news: it does not refresh indexFetchedAt (history is incomplete), but counting it as a failure left this
  // source marked stale from 2026-09-23 while it kept promoting new articles.
  const currentIndexOk = records.length === OFFICIAL_REGIONAL_NEWS_INDEXES.length &&
    records.every(row => row.status === "ok" || row.status === "partial");
  const failedArticles = articlePages.filter(page => page.status === "rejected").length - goneArticles;
  const unresolvedPreviouslyPromoted = newUnparsed.some(row => promotedHrefs.has(row.href));
  if (unresolvedPreviouslyPromoted) failureMessages.push("A previously promoted article could not be parsed; keeping its last verified event data.");
  const pendingFailedArticles = [...queue, ...overflow].filter(article => article.attempts > 0);
  if (!failureMessages.length && pendingFailedArticles.length) failureMessages.push(pendingFailedArticles[0].lastError || "An official article is waiting for a retry.");
  const failed = !currentIndexOk || failedArticles > 0 || unresolvedPreviouslyPromoted || pendingFailedArticles.length > 0;
  const snapshot = {
    schemaVersion: 4,
    parserVersion: 5,
    revalidatedAt: revalidate ? now : Number(stored?.revalidatedAt) || now,
    overflow,
    status: failed ? "stale" : "ok",
    error: failureMessages.slice(0, 3).join("; "),
    fetchedAt: failed ? Number(stored?.fetchedAt) || 0 : now,
    indexFetchedAt: allIndexOk && shouldFetchIndexes ? now : Number(stored?.indexFetchedAt) || 0,
    lastAttemptAt: now,
    discoveredCount: articles.length,
    candidateCount: articles.length,
    processedHrefs: [...new Set([...processedHrefs, ...completedHrefs])].slice(-4_096),
    promotedArticleCount: new Set(events.map(event => safeOfficialNewsLink(event?.link)).filter(Boolean)).size,
    backlog: queue,
    unparsed: mergedUnparsed,
    backlogOverflowCount,
    indexRecords: records.map(compactOfficialRegionalIndexRecord),
    events
  };
  let persistenceError = "";
  try {
    await write(OFFICIAL_REGIONAL_SNAPSHOT_KEY, snapshot);
    if (!failed) snapshot.fetchedAt = now;
  } catch (error) {
    persistenceError = `Regional snapshot could not be saved: ${String(error?.message || error).slice(0, 160)}`;
    snapshot.status = "stale";
    snapshot.fetchedAt = Number(stored?.fetchedAt) || 0;
  }
  if (snapshot.fetchedAt === 0 && !failed && !persistenceError) snapshot.fetchedAt = now;
  const result = regionalSnapshotResult(snapshot.status, snapshot, now,
    persistenceError || failureMessages.slice(0, 3).join("; "));
  result.batchProcessedCount = completedHrefs.length + failedArticles;
  return result;
}

async function fetchOfficialNewsDiscovery({ force = false, now = Date.now(), allowNetwork = true } = {}) {
  const stored = await readJson(OFFICIAL_NEWS_SNAPSHOT_KEY).catch(() => null);
  if (!force && Array.isArray(stored?.articles) && now - Number(stored.fetchedAt || 0) < OFFICIAL_NEWS_CACHE_MS) {
    return {
      status: "ok",
      source: "Official Pokémon GO News",
      url: OFFICIAL_NEWS_URL,
      fetchedAt: Number(stored.fetchedAt) || now,
      articles: stored.articles.slice(0, 120)
    };
  }
  if (!force && !allowNetwork) {
    if (Array.isArray(stored?.articles)) {
      return {
        status: "stale",
        source: "Official Pokémon GO News",
        url: OFFICIAL_NEWS_URL,
        fetchedAt: Number(stored.fetchedAt) || 0,
        articles: stored.articles.slice(0, 120)
      };
    }
    return {
      status: "pending",
      source: "Official Pokémon GO News",
      url: OFFICIAL_NEWS_URL,
      fetchedAt: 0,
      articles: []
    };
  }
  try {
    const response = await fetch(OFFICIAL_NEWS_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "PokemonGoEventWebhook/1.0"
      },
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`Official Pokémon GO News returned HTTP ${response.status}.`);
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error("Official Pokémon GO News returned an unexpected content type.");
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > OFFICIAL_NEWS_MAX_BYTES) {
      throw new Error("Official Pokémon GO News exceeded the source size limit.");
    }
    const text = await readBoundedText(response, OFFICIAL_NEWS_MAX_BYTES, "Official Pokémon GO News exceeded the source size limit.");
    const articles = parseOfficialNewsIndex(text);
    if (!articles.length) throw new Error("Official Pokémon GO News returned no article links.");
    await writeJson(OFFICIAL_NEWS_SNAPSHOT_KEY, {
      schemaVersion: 1,
      fetchedAt: now,
      contentHash: createHash("sha256").update(text).digest("hex"),
      articles
    }).catch(() => {});
    return { status: "ok", source: "Official Pokémon GO News", url: OFFICIAL_NEWS_URL, fetchedAt: now, articles };
  } catch (error) {
    if (Array.isArray(stored?.articles) && stored.articles.length) {
      return {
        status: "stale",
        source: "Official Pokémon GO News",
        url: OFFICIAL_NEWS_URL,
        fetchedAt: Number(stored.fetchedAt) || 0,
        articles: stored.articles.slice(0, 120),
        error: String(error?.message || error).slice(0, 240)
      };
    }
    return {
      status: "error",
      source: "Official Pokémon GO News",
      url: OFFICIAL_NEWS_URL,
      fetchedAt: 0,
      articles: [],
      error: String(error?.message || error).slice(0, 240)
    };
  }
}

function sourceHealth(primaryStatus, officialNews, officialRegional) {
  const currentStampRallies = curatedLocalEvents(Date.now())
    .filter(event => String(event?.eventType || "").toLocaleLowerCase() === "stamp-rally");
  return [
    {
      id: "scraped-duck",
      label: "ScrapedDuck / LeekDuck",
      url: SCRAPED_DUCK_EVENTS_URL,
      status: primaryStatus
    },
    {
      id: "official-news",
      label: officialNews?.source || "Official Pokémon GO News",
      url: officialNews?.url || OFFICIAL_NEWS_URL,
      status: officialNews?.status || "error",
      fetchedAt: Number(officialNews?.fetchedAt) || 0,
      discoveredCount: Array.isArray(officialNews?.articles) ? officialNews.articles.length : 0,
      recentArticles: (Array.isArray(officialNews?.articles) ? officialNews.articles : []).slice(0, 12),
      error: officialNews?.error || ""
    },
    {
      id: "official-regional",
      label: officialRegional?.source || "Official regional Pokémon GO announcements",
      url: officialRegional?.url || OFFICIAL_REGIONAL_NEWS_URL,
      status: officialRegional?.status || "error",
      fetchedAt: Number(officialRegional?.fetchedAt) || 0,
      indexCount: OFFICIAL_REGIONAL_NEWS_INDEXES.length,
      locales: OFFICIAL_REGIONAL_NEWS_INDEXES.map(row => row.locale),
      queuedCount: Number(officialRegional?.queuedCount) || 0,
      queueCursor: officialRegional?.queueCursor || "",
      sourceReviewRequired: officialRegional?.sourceReviewRequired || [],
      processedCount: Number(officialRegional?.processedCount) || 0,
      unparsedCount: Number(officialRegional?.unparsedCount) || 0,
      unparsedArticles: officialRegional?.unparsedArticles || [],
      backlogOverflowCount: Number(officialRegional?.backlogOverflowCount) || 0,
      indexHealth: officialRegional?.indexHealth || [],
      discoveredCount: Number(officialRegional?.discoveredCount) || 0,
      candidateCount: Number(officialRegional?.candidateCount) || 0,
      promotedArticleCount: Number(officialRegional?.promotedArticleCount) || 0,
      promotedEventCount: Array.isArray(officialRegional?.events) ? officialRegional.events.length : 0,
      error: officialRegional?.error || ""
    },
    {
      id: "curated-regional",
      label: "Curated official/regional overlays",
      url: "https://pokemongo.com/news",
      status: "ok"
    },
    {
      id: "stamp-rally-tracker",
      label: "Stamp Rally tracker · official announcements and discovery locations",
      url: "https://pokemongo.com/news",
      status: "discovery",
      discoveredCount: currentStampRallies.length,
      announcedCount: currentStampRallies.filter(event => event.mappingStatus === "announced").length,
      discoveryLocationCount: currentStampRallies.filter(event => event.coordinates || event.venues?.some(venue => venue.coordinates)).length,
      nativeFirstStopVerifiedCount: currentStampRallies.filter(event => event.firstStopVerified === true).length,
      note: "Official announcements and mapped discovery locations are tracked separately. A mapped venue is not a verified native first stop."
    },
    {
      id: "community-review",
      label: "Community review watchlist",
      url: "https://www.reddit.com/r/TheSilphRoad/",
      status: "manual-review"
    },
    {
      id: "g47ix-community",
      label: "G47IX community guide (advisory)",
      url: G47IX_URL,
      status: "advisory",
      note: "Used as a cross-check for event announcements; dates and coordinates are not promoted without a structured or official match."
    }
  ];
}

export function safeEventLink(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && /(^|\.)(leekduck\.com|pokemongo\.com|pokemon\.com|mlb\.com|g47ix\.pro|esa\.int)$/i.test(url.hostname)
      ? url.href.slice(0, 500)
      : "";
  } catch {
    return "";
  }
}

export function eventSourceLinkLabel(value) {
  const link = safeEventLink(value);
  if (!link) return "";
  const hostname = new URL(link).hostname.toLowerCase();
  if (hostname === "leekduck.com" || hostname.endsWith(".leekduck.com")) return "Open on LeekDuck";
  if (hostname === "pokemongo.com" || hostname.endsWith(".pokemongo.com")) return "Open official Pokémon GO page";
  if (hostname === "pokemon.com" || hostname.endsWith(".pokemon.com")) return "Open official Pokémon page";
  if (hostname === "mlb.com" || hostname.endsWith(".mlb.com")) return "Open official MLB page";
  if (hostname === "g47ix.pro" || hostname.endsWith(".g47ix.pro")) return "Open G47IX community guide";
  if (hostname === "esa.int" || hostname.endsWith(".esa.int")) return "Open official ESA press release";
  return "Open event source";
}

export function safeEventImage(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && (["cdn.leekduck.com", "lh3.googleusercontent.com"].includes(url.hostname.toLowerCase()) || /(^|\.)esa\.int$/i.test(url.hostname))
      ? url.href.slice(0, 1_000)
      : "";
  } catch {
    return "";
  }
}

function tagsWithClass(html, tagName, className) {
  const rows = [];
  const safeTag = String(tagName || "").replace(/[^A-Za-z0-9]/g, "");
  const safeClass = String(className || "").replace(/[^A-Za-z0-9_-]/g, "");
  const pattern = new RegExp(`<${safeTag}\\b([^>]*class=["'][^"']*\\b${safeClass}\\b[^"']*["'][^>]*)>([\\s\\S]*?)<\\/${safeTag}>`, "gi");
  let match;
  while ((match = pattern.exec(String(html || "")))) {
    rows.push({ attributes: match[1], html: match[2], source: match[0], index: match.index });
  }
  return rows;
}

function sectionBlocks(html) {
  const source = articleBlock(html);
  const headers = [];
  const pattern = /<h2\b([^>]*)class=["'][^"']*\bevent-section-header\b[^"']*["']([^>]*)>([\s\S]*?)<\/h2>/gi;
  let match;
  while ((match = pattern.exec(source))) {
    headers.push({
      id: cleanText(htmlAttribute(`${match[1]} ${match[2]}`, "id"), 80).toLocaleLowerCase(),
      title: cleanText(htmlText(match[3]), 100),
      index: match.index,
      start: match.index + match[0].length
    });
  }
  return headers.map((header, index) => ({
    ...header,
    end: headers[index + 1]?.index ?? source.length,
    html: source.slice(header.start, headers[index + 1]?.index ?? source.length)
  }));
}

function detailPokemonRows(html, maximum = 200, includeSourceIndex = false) {
  const rows = [];
  const seen = new Set();
  for (const row of tagsWithClass(html, "li", "pkmn-list-item")) {
    const nameBlock = tagsWithClass(row.html, "div", "pkmn-name")[0];
    const name = cleanText(htmlText(nameBlock?.html), 120);
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const shiny = /class=["'][^"']*\bshiny-icon\b/i.test(row.html);
    const imageTag = row.html.match(/<div\b[^>]*class=["'][^"']*\bpkmn-list-img\b[^"']*["'][^>]*>[\s\S]*?<img\b[^>]*>/i)?.[0] || "";
    const imageUrl = safeEventImage(htmlAttribute(imageTag, "src"));
    const existing = rows.find(item => item.name.toLocaleLowerCase() === key);
    if (existing) {
      if (includeSourceIndex) existing.sourceIndices.push(row.index);
      if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
      if (shiny) existing.shiny = true;
      continue;
    }
    seen.add(key);
    rows.push({ name, imageUrl, shiny, ...(includeSourceIndex ? { sourceIndices: [row.index] } : {}) });
    if (rows.length >= maximum) break;
  }
  return rows;
}

function detailTextItems(html, maximum = 80) {
  const rows = [];
  const seen = new Set();
  const pattern = /<(h[2-5]|p|li)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = pattern.exec(String(html || "")))) {
    const attributes = match[2] || "";
    if (/\btask-reward\b|\bpage-reward\b/i.test(attributes)) continue;
    const pkmn = /\bpkmn-list-item\b/i.test(attributes)
      ? tagsWithClass(match[3], "div", "pkmn-name")[0]
      : null;
    const text = cleanText(pkmn ? htmlText(pkmn.html) : htmlText(match[3]), 2_000);
    if (!text || /^(?:advertisement|step|rewards?)$/i.test(text)) continue;
    rows.push(text);
    if (rows.length >= maximum) break;
  }
  return rows;
}

function detailResearch(sectionHtml) {
  const source = String(sectionHtml || "");
  const taskMatches = [...source.matchAll(/<span\b[^>]*class=["'][^"']*\b(?:task-text|task)\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)];
  if (!taskMatches.length) return [];

  const markerPattern = /<(h2|h3)\b([^>]*)>([\s\S]*?)<\/\1>|<div\b[^>]*class=["'][^"']*\bstep-name\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  const markers = [];
  for (const match of source.matchAll(markerPattern)) {
    const tag = match[1] || "step-name";
    const text = cleanText(htmlText(match[3] ?? match[4]), 180);
    if (!text || /^(?:research|step|rewards?)$/i.test(text)) continue;
    markers.push({ index: match.index || 0, kind: tag, text });
  }
  const rewardPattern = /<(span|div)\b[^>]*class=["'][^"']*\breward-label\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  const imagePattern = /<img\b[^>]*class=["'][^"']*\breward-image\b[^"']*["'][^>]*>/gi;
  const rewardText = value => {
    const text = /<img\b/i.test(String(value || ""))
      ? cleanText(htmlAttribute(value, "alt"), 1_000)
      : cleanText(htmlText(value), 1_000);
    if (text) return text;
    const src = htmlAttribute(value, "src");
    let file = String(src || "").split(/[/?#]/).pop()?.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ");
    try { file = decodeURIComponent(file || ""); } catch {}
    return cleanText(file, 180);
  };
  const pageRewards = fragment => {
    const rows = [];
    const html = String(fragment || "");
    for (const match of html.matchAll(rewardPattern)) {
      const before = html.slice(0, match.index || 0);
      if (before.lastIndexOf("page-reward") <= before.lastIndexOf("task-reward")) continue;
      rows.push(cleanText(htmlText(match[2]), 1_000));
    }
    for (const match of html.matchAll(imagePattern)) {
      const before = html.slice(0, match.index || 0);
      if (before.lastIndexOf("page-reward") <= before.lastIndexOf("task-reward")) continue;
      rows.push(rewardText(match[0]));
    }
    return [...new Set(rows.filter(Boolean))];
  };
  const groups = [];
  const byName = new Map();
  for (const [index, match] of taskMatches.slice(0, 120).entries()) {
    const taskStart = match.index || 0;
    const nextTaskStart = taskMatches[index + 1]?.index ?? source.length;
    const preceding = markers.filter(marker => marker.index < taskStart);
    const root = [...preceding].reverse().find(marker => marker.kind === "h2")?.text || "Event Research";
    const subgroup = [...preceding].reverse().find(marker => marker.kind === "h3" || marker.kind === "step-name")?.text || "";
    const name = subgroup && subgroup.toLocaleLowerCase() !== root.toLocaleLowerCase()
      ? `${root} · ${subgroup}`
      : root;
    let group = byName.get(name);
    if (!group) {
      group = { name, step: groups.length + 1, tasks: [], start: preceding.at(-1)?.index ?? 0 };
      byName.set(name, group);
      groups.push(group);
    }
    const tail = source.slice(taskStart + match[0].length, nextTaskStart);
    const nextTaskContainer = tail.search(/<[^>]*class=["'][^"']*\btask-reward\b[^"']*["'][^>]*>/i);
    const taskTail = nextTaskContainer >= 0 ? tail.slice(0, nextTaskContainer) : tail;
    const rewardValues = [...taskTail.matchAll(rewardPattern)]
      .filter(row => {
        const before = taskTail.slice(0, row.index || 0);
        return before.lastIndexOf("page-reward") <= before.lastIndexOf("task-reward");
      })
      .map(row => cleanText(htmlText(row[2]), 1_000)).filter(Boolean);
    const reward = rewardValues.length > 1 || /possible rewards/i.test(taskTail)
      ? `Possible rewards: ${[...new Set(rewardValues)].join(" / ")}`
      : rewardValues[0] || "";
    group.tasks.push({ text: cleanText(htmlText(match[1]), 180), reward: cleanText(reward, 1_000) });
  }
  for (const [index, group] of groups.entries()) {
    const end = groups[index + 1]?.start ?? source.length;
    group.rewards = pageRewards(source.slice(group.start, end));
    delete group.start;
  }
  return groups.filter(group => group.tasks.some(task => task.text));
}

function detailDescription(html) {
  const block = tagsWithClass(html, "div", "event-description")[0];
  const paragraphs = block
    ? [...block.html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match => cleanText(htmlText(match[1]), 500)).filter(Boolean)
    : [];
  return cleanText(paragraphs.join(" ") || metaContent(html, "description") || metaContent(html, "og:description"), 800);
}

function detailImageRows(html, className) {
  const rows = [];
  const safeClass = String(className || "").replace(/[^A-Za-z0-9_-]/g, "");
  const pattern = new RegExp(`<img\\b[^>]*class=["'][^"']*\\b${safeClass}\\b[^"']*["'][^>]*>`, "gi");
  for (const match of String(html || "").matchAll(pattern)) rows.push(match[0]);
  return rows;
}

function detailTicketBonuses(html) {
  const source = articleBlock(html);
  const heading = source.match(/<h2\b[^>]*id=["']event-ticket["'][^>]*>[\s\S]*?(?=<h2\b|<\/article>)/i)?.[0] ||
    source.match(/<h2\b[^>]*>\s*Event Ticket\b[\s\S]*?(?=<h2\b|<\/article>)/i)?.[0] || "";
  if (!heading) return [];
  return tagsWithClass(heading, "div", "bonus-text")
    .map(row => cleanText(htmlText(row.html), 2_000))
    .filter(Boolean)
    .map(value => `Event Ticket: ${value}`);
}

function detailBonusRows(html) {
  const source = String(html || "");
  const ticketStart = source.search(/<h2\b[^>]*(?:id=["']event-ticket["'][^>]*>|>\s*Event Ticket\b)/i);
  const main = ticketStart >= 0 ? source.slice(0, ticketStart) : source;
  const cards = tagsWithClass(main, "div", "bonus-text")
    .map(row => cleanText(htmlText(row.html), 2_000))
    .filter(Boolean);
  const listItems = [...main.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(match => cleanText(htmlText(match[1]), 2_000))
    .filter(Boolean);
  return [...new Set([...cards, ...listItems])];
}

function detailTicketRequired(searchableText) {
  const source = String(searchableText || "");
  if (!/\bticket(?:ed)?\b|\bpaid research\b/i.test(source)) return false;
  if (/\b(?:optional|not required|can purchase|purchase(?:s|d)? (?:an? )?ticket|ticket (?:adds?|grants?|includes?) (?:bonus|benefit)|ticket benefits?)\b/i.test(source)) return false;
  return /\b(?:ticket(?:ed)? event|ticket (?:is )?required|required ticket|requires? (?:an? )?ticket|paid research)\b/i.test(source);
}

const DETAIL_SECTION_TITLES = Object.freeze({
  features: "Features and important details",
  research: "Research details",
  "go-pass": "GO Pass",
  gopass: "GO Pass",
  moves: "Featured attacks",
  shiny: "Shiny releases",
  sales: "Tickets and shop",
  eggs: "Eggs",
  showcases: "Showcases"
});

function sectionMatches(row, id) {
  return row?.id === id || row?.title?.toLocaleLowerCase() === id.replace(/-/g, " ");
}

function publicPokemonRows(rows) {
  return rows.map(({ shiny: _shiny, sourceIndex: _sourceIndex, sourceIndices: _sourceIndices, ...row }) => row);
}

/** Parse a LeekDuck event article into the bounded fields rendered by the native event page. */
export function parseLeekDuckEventDetail(html, { url = "" } = {}) {
  const link = safeEventLink(url);
  if (!link || !/(^|\.)leekduck\.com$/i.test(new URL(link).hostname)) return null;
  const blocks = sectionBlocks(html);
  const block = id => blocks.find(row => sectionMatches(row, id))?.html || "";
  const articleHtml = articleBlock(html);
  const allPokemon = detailPokemonRows(articleHtml, 200, true);
  const featureRows = detailPokemonRows(block("features"));
  const spawnRows = detailPokemonRows(block("spawns"));
  const explicitRaidRows = detailPokemonRows(block("raids"));
  const explicitMaxRows = detailPokemonRows(block("max-battles"));
  const hasRaidSection = blocks.some(row => sectionMatches(row, "raids"));
  const hasMaxSection = blocks.some(row => sectionMatches(row, "max-battles"));
  const featureSections = blocks.filter(row => sectionMatches(row, "features"));
  const featureRowsWithoutRaidTargets = featureRows.filter(row =>
    !explicitRaidRows.some(raidRow => raidRow.name.toLocaleLowerCase() === row.name.toLocaleLowerCase()));
  const battleFallbackRows = allPokemon.filter(row => row.sourceIndices.some(index => {
    const section = blocks.find(candidate => index >= candidate.start && index < candidate.end);
    return !section || featureSections.includes(section);
  }));
  const maxRows = hasMaxSection ? explicitMaxRows
    : isMaxBattleEventSlug(url) && featureRows.length
      ? featureRowsWithoutRaidTargets
      : isMaxBattleEventSlug(url) && !hasRaidSection ? battleFallbackRows : [];
  const raidRows = hasRaidSection ? explicitRaidRows
    : isBattleEventSlug(url) && !isMaxBattleEventSlug(url) && !hasMaxSection
      ? battleFallbackRows
      : [];
  const shinyRows = uniqueNamedRows([
    ...detailPokemonRows(block("shiny")).map(row => ({ ...row, shiny: true })),
    ...publicPokemonRows(allPokemon.filter(row => row.shiny))
  ].map(({ shiny: _shiny, ...row }) => row));
  const bonuses = [
    ...blocks
    .filter(row => row.id === "bonuses" || /bonuses/i.test(row.title))
    .flatMap(row => detailBonusRows(row.html)),
    ...detailTicketBonuses(html)
  ].filter(Boolean);
  const bonusNotes = [...new Set(blocks
    .filter(row => row.id === "bonuses" || /bonuses/i.test(row.title))
    .flatMap(row => [...String(row.html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(match => cleanText(htmlText(match[1]), 2_000)))
    .filter(Boolean))];
  const researchBlock = blocks.find(row => row.id === "research" || /research/i.test(row.title));
  const sections = [];
  for (const row of blocks) {
    if (row.id === "bonuses") {
      const bonusDetails = detailTextItems(row.html, 120)
        .filter(item => item.toLocaleLowerCase() !== "event ticket")
        .filter(item => !bonuses.some(bonus => bonus.toLocaleLowerCase() === item.toLocaleLowerCase()))
        .filter(item => !/^only during event hours\.?$/i.test(item));
      if (bonusDetails.length) sections.push({ title: "Bonuses and ticket details", items: bonusDetails });
      continue;
    }
    const items = detailTextItems(row.html, row.id === "research" ? 120 : 80);
    if (!items.length) continue;
    sections.push({
      title: DETAIL_SECTION_TITLES[row.id] || cleanText(row.title, 100) || "Event details",
      items
    });
    if (sections.length >= 100) break;
  }
  if (!sections.length) {
    const fallbackItems = detailTextItems(articleBlock(html), 120);
    if (fallbackItems.length) {
      sections.push({
        title: isBattleEventSlug(url)
          ? "Features and important details"
          : "Published information",
        items: fallbackItems
      });
    }
  }
  const searchableText = cleanText(htmlText(articleBlock(html)), 20_000);
  const detail = {
    summary: detailDescription(html),
    imageUrl: safeEventImage(metaContent(html, "og:image")),
    bonuses: [...new Set(bonuses)],
    bonusNotes,
    featuredPokemon: publicPokemonRows(featureRows),
    spawns: publicPokemonRows(spawnRows),
    shinies: shinyRows,
    raidBosses: publicPokemonRows(raidRows),
    maxBattleBosses: publicPokemonRows(maxRows),
    research: detailResearch(researchBlock?.html),
    sections,
    specialBackground: /\b(?:special|location) background\b/i.test(searchableText),
    costumePokemon: /\b(?:costume|costumed|wearing a|wearing an)\b/i.test(searchableText),
    ticketRequired: detailTicketRequired(searchableText)
  };
  if (!detail.summary && !detail.bonuses.length &&
    !detail.featuredPokemon.length && !detail.spawns.length && !detail.shinies.length &&
    !detail.raidBosses.length && !detail.maxBattleBosses.length && !detail.research.length && !detail.sections.length) return null;
  return detail;
}

function uniqueTextRows(...groups) {
  const rows = [];
  const seen = new Set();
  for (const value of groups.flat()) {
    const text = cleanText(value?.text || value, 2_000);
    const key = text.toLocaleLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    rows.push(text);
  }
  return rows;
}

function uniqueNamedRows(...groups) {
  const rows = [];
  const byAppearance = new Map();
  const sourceMetadata = value => {
    const metadata = {};
    const level = Number(value?.level);
    if (Number.isInteger(level) && level >= 1 && level <= 20) metadata.level = level;
    if (Array.isArray(value?.locationIds)) {
      metadata.locationIds = [...new Set(value.locationIds.slice(0, 500)
        .map(id => cleanText(id, 120)).filter(Boolean))];
    }
    return metadata;
  };
  for (const value of groups.flat()) {
    const name = cleanText(value?.name || value, 120);
    if (!name) continue;
    const imageUrl = safeEventImage(value?.imageUrl || value?.image);
    const identity = calendarEventAppearanceMetadata(value);
    const key = detailPokemonAppearanceKey({ name, ...identity });
    if (byAppearance.has(key)) {
      const existing = byAppearance.get(key);
      if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
      // Curated events can carry an exact Pokédex/form identity alongside the
      // display name. Preserve that metadata when a parsed source later
      // merges into the same row; otherwise the exact
      // form is lost from posts and graphics.
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const field of ["value", "label", "tier", "pokedex_id", "form", "costume", "gender", "max_mode"]) {
          if (existing[field] == null && value[field] != null) existing[field] = value[field];
        }
        for (const [field, metadata] of Object.entries(identity)) {
          if (existing[field] == null) existing[field] = metadata;
        }
        for (const [field, metadata] of Object.entries(sourceMetadata(value))) {
          // Keep the first trusted publisher restriction. Parsed artwork
          // must not widen a curated boss's regional location allowlist.
          if (existing[field] == null) existing[field] = metadata;
        }
        if (Array.isArray(value.methods)) existing.methods = [...new Set([...(existing.methods || []), ...value.methods])];
        if (existing.shiny == null && value.shiny === true) existing.shiny = true;
      }
      continue;
    }
    const row = { name, imageUrl, ...identity };
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nativeValue = cleanText(value.value, 100);
      const label = cleanText(value.label || value.displayLabel, 120);
      const tier = cleanText(value.tier, 20);
      const pokedexId = Number(value.pokedex_id ?? value.pokedexId);
      const form = Number(value.form ?? value.form_id);
      if (nativeValue) row.value = nativeValue;
      if (label) row.label = label;
      if (tier) row.tier = tier;
      if (Number.isInteger(pokedexId) && pokedexId > 0) row.pokedex_id = pokedexId;
      if (Number.isInteger(form) && form >= 0) row.form = form;
      if (value.shiny === true) row.shiny = true;
      if (Array.isArray(value.methods)) row.methods = [...new Set(value.methods)];
      Object.assign(row, sourceMetadata(value));
    }
    byAppearance.set(key, row);
    rows.push(row);
  }
  return rows;
}

function uniqueSections(...groups) {
  const rows = [];
  const byTitle = new Map();
  for (const section of groups.flat()) {
    const title = cleanText(section?.title, 100);
    const items = uniqueTextRows(Array.isArray(section?.items) ? section.items : []).slice(0, 120);
    if (!title || !items.length) continue;
    const key = title.toLocaleLowerCase();
    if (byTitle.has(key)) {
      const existing = byTitle.get(key);
      existing.items = uniqueTextRows(existing.items, items).slice(0, 120);
      continue;
    }
    const row = { title, items };
    byTitle.set(key, row);
    rows.push(row);
  }
  return rows.slice(0, 40);
}

function uniqueSourceLinks(...groups) {
  const rows = [];
  const seen = new Set();
  for (const row of groups.flat()) {
    let href = "";
    try {
      const url = new URL(String(row?.href || ""));
      if (url.protocol !== "https:") continue;
      href = url.href.slice(0, 700);
    } catch {
      continue;
    }
    if (seen.has(href)) continue;
    seen.add(href);
    rows.push({ label: cleanText(row?.label, 120) || "Open source", href });
  }
  return rows.slice(0, 8);
}

function sourceSlug(value) {
  try {
    return new URL(String(value || "")).pathname.split("/").filter(Boolean).pop()?.toLocaleLowerCase() || "";
  } catch {
    return "";
  }
}

function isBattleEventSlug(value) {
  const slug = sourceSlug(value);
  return isMaxBattleEventSlug(value) || /(?:raid[-_]?(?:hour|day)|raids?)/i.test(slug);
}

function isMaxBattleEventSlug(value) {
  return /max[-_](?:mondays?|battles?|days?)/i.test(sourceSlug(value));
}

const ARTICLE_MATCH_STOPWORDS = new Set([
  "pokemon", "go", "event", "events", "the", "and", "with", "for", "from", "during", "in", "of", "a", "an",
  "get", "ready", "celebrate", "celebration", "2026", "2027", "new", "special"
]);

function matchTokens(value) {
  return new Set(cleanText(value, 500).toLocaleLowerCase()
    .replace(/pok[eé]mon/g, "pokemon")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map(token => token.replace(/(?:ships|ship|ies|s)$/i, match => match === "ies" ? "y" : ""))
    .filter(token => token.length >= 3 && !ARTICLE_MATCH_STOPWORDS.has(token)));
}

function eventArticleIdentityConflict(eventText, articleText) {
  const years = value => new Set(String(value || "").match(/\b20\d{2}\b/g) || []);
  const phases = value => {
    const match = String(value || "").toLocaleLowerCase().match(/\bpart[-_\s]*(1|2|3|i{1,3}|first|second|third)\b/);
    if (!match) return "";
    return ({ i: "1", ii: "2", iii: "3", first: "1", second: "2", third: "3" })[match[1]] || match[1];
  };
  const eventYears = years(eventText);
  const articleYears = years(articleText);
  if (eventYears.size && articleYears.size && ![...eventYears].some(year => articleYears.has(year))) return true;
  const eventPhase = phases(eventText);
  const articlePhase = phases(articleText);
  return Boolean(eventPhase && articlePhase && eventPhase !== articlePhase);
}

function eventArticleTypeMismatch(event, articleText) {
  const eventType = `${event?.eventType || ""} ${event?.heading || ""} ${event?.name || ""}`.toLocaleLowerCase();
  const article = String(articleText || "").toLocaleLowerCase();
  if (/\b(?:go-battle-league|battle league|gbl)\b/.test(eventType)) {
    return !/\b(?:go battle league|battle league|gbl|cup|league)\b/.test(article);
  }
  return false;
}

/** Conservatively pair a calendar row with its official Pokémon GO article. */
export function matchOfficialArticleForEvent(event, articles) {
  const eventSlug = sourceSlug(event?.link) || cleanText(event?.id, 160).toLocaleLowerCase();
  const eventTokens = matchTokens(`${event?.name || ""} ${event?.id || ""} ${eventSlug.replace(/-/g, " ")}`);
  let best = null;
  for (const article of Array.isArray(articles) ? articles : []) {
    const href = safeOfficialNewsLink(article?.href);
    if (!href) continue;
    const articleSlug = sourceSlug(href);
    if (eventSlug && (articleSlug === eventSlug || articleSlug.includes(eventSlug) || eventSlug.includes(articleSlug))) {
      return { title: cleanText(article?.title, 180), href };
    }
    const articleTokens = matchTokens(`${article?.title || ""} ${articleSlug.replace(/-/g, " ")}`);
    const overlap = [...eventTokens].filter(token => articleTokens.has(token));
    const score = overlap.length + (overlap.some(token => token.length >= 8) ? 1 : 0);
    if (score >= 2 && (!best || score > best.score)) best = { score, title: cleanText(article?.title, 180), href };
  }
  return best ? { title: best.title, href: best.href } : null;
}

function eventResearchFallback(event) {
  const type = `${event?.eventType || ""} ${event?.heading || ""} ${event?.name || ""}`.toLocaleLowerCase();
  if (/raid hour/.test(type)) return "Five-star raids appear more frequently during the published local Raid Hour. The source page below has the featured boss and any last-minute changes.";
  if (/max monday/.test(type)) return "The featured Dynamax Pokémon appears more frequently at Power Spots during the published local Max Monday window.";
  if (/spotlight/.test(type)) return "The featured Pokémon appears more frequently during the published local Spotlight Hour, with the announced weekly bonus.";
  if (/research/.test(type)) return "This event centers on published Pokémon GO research. Open the source links below for tasks, rewards, and expiration changes.";
  return "Complete bonuses and featured Pokémon have not been published in the available sources yet. The source links below are ready for the latest announcement.";
}

function genericSummary(event) {
  const summary = cleanText(event?.summary, 800);
  const genericValues = new Set(["event", "raid hour", "research", "max monday", "community day", "pokemon go event", "see the event details, bonuses, and schedule below."]);
  return !summary || summary.length < 20 || genericValues.has(summary.toLocaleLowerCase());
}

function placeholderDetailItem(value) {
  const text = cleanText(value, 800);
  return !text || /\bis listed on the event calendar\. Check the credited source for published updates\.?$/i.test(text) ||
    /^(?:published )?(?:event )?details?\.?$/i.test(text) ||
    /^complete bonuses and featured Pokémon have not been published in the available sources yet\./i.test(text) ||
    /\bdetails have not been published in the available sources yet\.?$/i.test(text);
}

function eventSummaryFallback(event) {
  const name = cleanText(event?.name, 160) || "This Pokémon GO event";
  const details = event?.details && typeof event.details === "object" ? event.details : {};
  const parts = [];
  const location = cleanText(event?.location, 180);
  const schedule = cleanText(event?.scheduleNote, 360);
  const species = [...new Set([
    ...(Array.isArray(event?.species) ? event.species : []),
    ...(Array.isArray(details.featuredPokemon) ? details.featuredPokemon : []),
    ...(Array.isArray(details.spawns) ? details.spawns : []),
    ...(Array.isArray(details.raidBosses) ? details.raidBosses : [])
  ].map(row => cleanText(row?.name || row, 120)).filter(Boolean))].slice(0, 8);
  const bonuses = (Array.isArray(event?.bonuses) ? event.bonuses : [])
    .map(value => cleanText(value, 220))
    .filter(Boolean)
    .slice(0, 2);
  const sectionItems = (Array.isArray(details.sections) ? details.sections : [])
    .flatMap(section => Array.isArray(section?.items) ? section.items : [])
    .map(value => cleanText(value, 360))
    .filter(value => value && value !== schedule &&
      !/^(?:Featured Pok[eé]mon:|Published bonuses:|Published location:)/i.test(value))
    .slice(0, 2);
  if (location) parts.push("Location: " + location + ".");
  if (schedule) parts.push(schedule);
  if (species.length) parts.push("Featured Pokémon: " + species.join(", ") + ".");
  if (bonuses.length) parts.push("Published bonuses include " + bonuses.join(" · ") + ".");
  if (sectionItems.length) parts.push(sectionItems.join(" "));
  if (event?.ticketRequired === true) parts.push("A ticket is required for this event.");
  if (!parts.length) {
    return name + " is listed on the event calendar. Check the credited source for published updates.";
  }
  return parts.join(" ").slice(0, 2_000);
}

function eventFallbackSections(event) {
  const details = event?.details && typeof event.details === "object" ? event.details : {};
  if (Array.isArray(details.sections) &&
    details.sections.some(section => Array.isArray(section?.items) && section.items.length)) return [];
  const items = [];
  const location = cleanText(event?.location, 180);
  const schedule = cleanText(event?.scheduleNote, 500);
  const venueNote = cleanText(event?.venueNote, 500);
  const venues = Array.isArray(event?.venues) ? event.venues.length : Number(event?.venueCount) || 0;
  const species = [...new Set([
    ...(Array.isArray(event?.species) ? event.species : []),
    ...(Array.isArray(details.featuredPokemon) ? details.featuredPokemon : []),
    ...(Array.isArray(details.spawns) ? details.spawns : []),
    ...(Array.isArray(details.raidBosses) ? details.raidBosses : [])
  ].map(row => cleanText(row?.name || row, 120)).filter(Boolean))].slice(0, 20);
  const bonuses = (Array.isArray(event?.bonuses) ? event.bonuses : [])
    .map(value => cleanText(value, 260))
    .filter(Boolean)
    .slice(0, 8);
  if (schedule) items.push(schedule);
  if (location) items.push("Published location: " + location + ".");
  if (venues) items.push(venues + " mapped location" + (venues === 1 ? "" : "s") + " are available on this event page.");
  if (venueNote) items.push(venueNote);
  if (species.length) items.push("Featured Pokémon: " + species.join(", ") + ".");
  if (bonuses.length) items.push("Published bonuses: " + bonuses.join(" · ") + ".");
  if (event?.ticketRequired === true) items.push("A ticket is required for the published event activity.");
  if (!items.length) {
    const summary = cleanText(event?.summary, 2_000);
    if (summary && !genericSummary(event)) items.push(summary);
  }
  if (!items.length) items.push(eventSummaryFallback(event));
  return items.length ? [{ title: "Published event details", items: [...new Set(items)] }] : [];
}

function g47ixResearchLink(event) {
  const query = `from:g47ix \"${cleanText(event?.name, 100).replace(/[\"\\]/g, "")}\"`;
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query`;
}

function redditResearchTaskFeedUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.hostname.toLocaleLowerCase() !== "www.reddit.com" ||
        url.username || url.password || url.search || url.hash) return "";
    const path = url.pathname.replace(/\/+$/, "");
    if (!/^\/r\/[a-z0-9_]+\/comments\/[a-z0-9]+\/[a-z0-9_-]+$/i.test(path)) return "";
    url.pathname = `${path}.rss`;
    return url.href;
  } catch {
    return "";
  }
}

function xmlElementValue(source, element) {
  const escaped = element.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(source || "").match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  let value = String(match?.[1] || "").trim();
  const cdata = value.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/i);
  if (cdata) value = cdata[1];
  return decodeEntities(value);
}

function researchEvidenceKey(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function verifiedRedditResearchPost(xml, method) {
  const entries = ["entry", "item"].flatMap(element => {
    const pattern = new RegExp(`<${element}\\b[^>]*>([\\s\\S]*?)<\\/${element}>`, "gi");
    return [...String(xml || "").matchAll(pattern)].map(match => match[1]);
  });
  const expectedRewards = new Set((Array.isArray(method?.rewardSpecies) ? method.rewardSpecies : [])
    .map(row => researchEvidenceKey(row?.name || row)).filter(Boolean));
  const expectedTasks = new Set((Array.isArray(method?.tasks) ? method.tasks : [])
    .map(row => researchEvidenceKey(row?.label || row?.text)).filter(Boolean));
  if (!expectedRewards.size || !expectedTasks.size) return false;

  for (const entry of entries) {
    const title = xmlElementValue(entry, "title");
    if (!/\besa\b/i.test(title) || !/field research/i.test(title)) continue;
    const content = xmlElementValue(entry, "content:encoded") ||
      xmlElementValue(entry, "content") || xmlElementValue(entry, "description");
    const lines = htmlText(content.replace(/\r/g, "\n")).split(/\n+/)
      .map(line => line.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean);
    const rewardsHeading = lines.findIndex(line =>
      /^(?:they include:?|.*[.!?]\s+they include:?)$/i.test(line));
    const tasksHeading = lines.findIndex(line => /^field researches that give any of the above pokemon\b/i.test(line));
    if (rewardsHeading < 0 || tasksHeading <= rewardsHeading) continue;

    const observedRewards = new Set();
    for (const line of lines.slice(rewardsHeading + 1, tasksHeading)) {
      if (/astronaut|costume|from local raid/i.test(line)) continue;
      const name = researchEvidenceKey(line.replace(/\s*\(normal\)\s*/i, " "));
      if (name) observedRewards.add(name);
    }
    const editLine = lines.findIndex((line, index) => index > tasksHeading && /^edit:/i.test(line));
    const taskLines = lines.slice(tasksHeading + 1, editLine < 0 ? undefined : editLine);
    const observedTasks = taskLines.map(researchEvidenceKey).filter(Boolean);
    if (observedRewards.size !== expectedRewards.size ||
        [...expectedRewards].some(name => !observedRewards.has(name)) ||
        observedTasks.length !== expectedTasks.size ||
        [...expectedTasks].some(label => !observedTasks.includes(label))) continue;
    return true;
  }
  return false;
}

async function cachedRedditResearchTaskSource(event, method, { force = false, now = Date.now(),
  cacheRead = readJson, cacheWrite = writeJson, cacheLock = withRedisLock, fetchImpl = fetch } = {}) {
  const feedUrl = redditResearchTaskFeedUrl(method?.taskSourceUrl);
  if (!feedUrl) return null;
  const freshnessMs = eventDetailFreshnessMs(event, now);
  const configSignature = createHash("sha256").update(JSON.stringify({
    tasks: (method.tasks || []).map(row => row?.label || row?.text || ""),
    rewards: (method.rewardSpecies || []).map(row => row?.name || row)
  })).digest("hex");
  const cacheKey = `${EVENT_RESEARCH_TASK_SOURCE_PREFIX}${createHash("sha1").update(feedUrl).digest("hex").slice(0, 24)}`;
  const readStored = async () => cacheRead(cacheKey).catch(() => null);
  const isFresh = stored => stored?.schemaVersion === EVENT_RESEARCH_TASK_SOURCE_SCHEMA_VERSION &&
    stored?.configSignature === configSignature && Number.isSafeInteger(Number(stored?.fetchedAt)) &&
    Number(stored.fetchedAt) > 0 && Number(stored.fetchedAt) <= now && now - Number(stored.fetchedAt) < freshnessMs;
  const result = (stored, status) => ({ status,
    fetchedAt: stored?.configSignature === configSignature ? Number(stored.fetchedAt) || 0 : 0 });
  const initial = await readStored();
  if (!force && isFresh(initial)) return result(initial, "current");

  const inFlightKey = cacheKey;
  if (eventResearchTaskSourceRefreshes.has(inFlightKey)) return eventResearchTaskSourceRefreshes.get(inFlightKey);
  const refresh = async () => {
    const latest = await readStored();
    if (!force && isFresh(latest)) return result(latest, "current");
    let contentMismatch = false;
    try {
      const response = await fetchImpl(feedUrl, {
        headers: { Accept: "application/atom+xml,application/rss+xml,application/xml;q=0.9", "User-Agent": "PokemonGoEventWebhook/1.0" },
        signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS)
      });
      if (!response.ok) throw new Error(`Reddit task source returned HTTP ${response.status}.`);
      const contentType = String(response.headers?.get?.("content-type") || "").toLocaleLowerCase();
      if (!/(?:atom\+xml|rss\+xml|application\/xml|text\/xml)/.test(contentType)) {
        throw new Error("Reddit task source returned an unexpected content type.");
      }
      const finalUrl = new URL(String(response.url || feedUrl));
      if (finalUrl.origin !== "https://www.reddit.com") throw new Error("Reddit task source redirected outside its verified host.");
      const xml = await readBoundedText(response, EVENT_RESEARCH_TASK_SOURCE_MAX_BYTES,
        "Reddit task source exceeded the source size limit.");
      if (!verifiedRedditResearchPost(xml, method)) {
        contentMismatch = true;
        throw new Error("Reddit task source no longer matches the curated task and reward rows.");
      }
      const snapshot = { schemaVersion: EVENT_RESEARCH_TASK_SOURCE_SCHEMA_VERSION,
        configSignature, fetchedAt: now };
      await cacheWrite(cacheKey, snapshot).catch(() => {});
      return result(snapshot, "current");
    } catch {
      if (contentMismatch) {
        const invalidated = { schemaVersion: EVENT_RESEARCH_TASK_SOURCE_SCHEMA_VERSION,
          configSignature, fetchedAt: 0, invalidatedAt: now, invalidated: true };
        await cacheWrite(cacheKey, invalidated).catch(() => {});
        return result(invalidated, "stale");
      }
      const lastGood = latest?.configSignature === configSignature ? latest
        : initial?.configSignature === configSignature ? initial : null;
      if (isFresh(lastGood)) return result(lastGood, "current");
      return result(lastGood, lastGood ? "stale" : "unavailable");
    }
  };
  const run = async () => {
    if (cacheLock === withRedisLock && !storageConfigured()) return refresh();
    try {
      return await cacheLock(`event-research-task-source:${cacheKey.slice(-24)}`, refresh, { leaseMs: 20_000 });
    } catch {
      const latest = await readStored();
      const lastGood = latest?.configSignature === configSignature ? latest
        : initial?.configSignature === configSignature ? initial : null;
      if (isFresh(lastGood)) return result(lastGood, "current");
      return result(lastGood, lastGood ? "stale" : "unavailable");
    }
  };
  const promise = run().finally(() => eventResearchTaskSourceRefreshes.delete(inFlightKey));
  eventResearchTaskSourceRefreshes.set(inFlightKey, promise);
  return promise;
}

async function cachedLeekDuckDetail(event, { force = false, now = Date.now(),
  cacheRead = readJson, cacheWrite = writeJson, cacheLock = withRedisLock } = {}) {
  const link = safeEventLink(event?.link);
  if (!link || !/(^|\.)leekduck\.com$/i.test(new URL(link).hostname)) return null;
  const cacheKey = `${EVENT_DETAIL_SNAPSHOT_PREFIX}${createHash("sha1").update(link).digest("hex").slice(0, 24)}`;
  const freshnessMs = eventDetailFreshnessMs(event, now);
  const readStored = async () => cacheRead(cacheKey).catch(() => null);
  const cachedResult = (stored, status) => stored?.schemaVersion === EVENT_DETAIL_CACHE_SCHEMA_VERSION && stored?.detail ? {
    detail: stored.detail,
    fetchedAt: Number(stored.fetchedAt) || 0,
    status,
    freshnessMs
  } : null;
  const isFresh = stored => stored?.schemaVersion === EVENT_DETAIL_CACHE_SCHEMA_VERSION &&
    stored?.detail && now - Number(stored.fetchedAt || 0) < freshnessMs;
  const initial = await readStored();
  if (!force && isFresh(initial)) return cachedResult(initial, "current");

  const inFlightKey = cacheKey;
  if (eventDetailRefreshes.has(inFlightKey)) return eventDetailRefreshes.get(inFlightKey);
  const refresh = async () => {
    // A worker may have waited for another refresh; never refetch without first
    // checking whether that request populated a fresh last-good snapshot.
    const latest = await readStored();
    if (!force && isFresh(latest)) return cachedResult(latest, "current");
    try {
      const response = await fetch(link, {
        headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "PokemonGoEventWebhook/1.0" },
        signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS)
      });
      if (!response.ok) throw new Error(`LeekDuck event page returned HTTP ${response.status}.`);
      const contentType = String(response.headers?.get?.("content-type") || "").toLocaleLowerCase();
      if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) throw new Error("LeekDuck event page returned an unexpected content type.");
      const html = await readBoundedText(response, EVENT_DETAIL_MAX_BYTES, "LeekDuck event page exceeded the detail size limit.");
      const detail = parseLeekDuckEventDetail(html, { url: link });
      if (!detail) throw new Error("LeekDuck event detail could not be parsed.");
      const snapshot = { schemaVersion: EVENT_DETAIL_CACHE_SCHEMA_VERSION, fetchedAt: now, detail };
      await cacheWrite(cacheKey, snapshot).catch(() => {});
      return cachedResult(snapshot, "current");
    } catch {
      return cachedResult(latest, "stale") || cachedResult(initial, "stale");
    }
  };
  const run = async () => {
    if (cacheLock === withRedisLock && !storageConfigured()) return refresh();
    try {
      return await cacheLock(`event-detail-refresh:${cacheKey.slice(-24)}`, refresh, { leaseMs: 20_000 });
    } catch {
      // If storage locking is unavailable, one in-process refresh is still
      // safe. With configured storage, a lock timeout uses last-good data and
      // leaves the next scheduled read to retry instead of duplicating fetches.
      const latest = await readStored();
      if (isFresh(latest)) return cachedResult(latest, "current");
      if (cacheLock === withRedisLock && storageConfigured()) {
        return cachedResult(latest, "stale") || cachedResult(initial, "stale");
      }
      return refresh();
    }
  };
  const promise = run().finally(() => eventDetailRefreshes.delete(inFlightKey));
  eventDetailRefreshes.set(inFlightKey, promise);
  return promise;
}

function mergeResearchGroups(...groups) {
  const rows = new Map();
  for (const group of groups.flat()) {
    const name = cleanText(group?.name, 180);
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (!rows.has(key)) rows.set(key, { ...group, name, tasks: [], rewards: [] });
    const target = rows.get(key);
    for (const task of Array.isArray(group?.tasks) ? group.tasks : []) {
      const text = cleanText(task?.text, 180);
      if (!text) continue;
      const taskKey = `${text.toLocaleLowerCase()}|${cleanText(task?.reward, 1_000).toLocaleLowerCase()}`;
      if (!target.tasks.some(value => `${value.text.toLocaleLowerCase()}|${cleanText(value.reward, 1_000).toLocaleLowerCase()}` === taskKey)) {
        target.tasks.push({ text, reward: cleanText(task?.reward, 1_000) });
      }
    }
    target.rewards = uniqueTextRows(target.rewards, group?.rewards || []);
  }
  return [...rows.values()];
}

function mergeResearchMethod(baseDetails, intelligence) {
  const existing = Array.isArray(baseDetails?.researchMethods) ? baseDetails.researchMethods : [];
  if (!intelligence?.method) return existing;
  const fields = existing.filter(method => method?.type === "field");
  if (!fields.length) return [...existing, intelligence.method];
  if (fields.length !== 1) return existing;
  return existing.map(method => method === fields[0] ? intelligence.method : method);
}

function researchKnowledgeKeys(event) {
  const keys = [];
  const id = cleanText(event?.id, 180).toLocaleLowerCase();
  if (id) keys.push(`id:${id}`);
  const link = safeEventLink(event?.link);
  if (link) {
    try {
      const url = new URL(link);
      keys.push(`link:${url.hostname.toLocaleLowerCase()}${url.pathname.replace(/\/+$/, "")}`);
    } catch {}
  }
  return [...new Set(keys)];
}

function mergeResearchMethodTaskRows(current, cached) {
  const rows = new Map();
  for (const task of [...(Array.isArray(current) ? current : []), ...(Array.isArray(cached) ? cached : [])]) {
    const label = cleanText(task?.label || task?.text, 180);
    if (!label) continue;
    const period = `${task?.fieldPeriod?.startDate || ""}/${task?.fieldPeriod?.endDate || ""}`;
    const key = `${label.toLocaleLowerCase()}|${period}`;
    const previous = rows.get(key);
    if (!previous || (task?.status === "reported" && task?.rewardSpecies?.length)) rows.set(key, { ...previous, ...task, label });
  }
  return [...rows.values()];
}

function overlayResearchMethod(currentMethods, cachedMethod) {
  const methods = Array.isArray(currentMethods) ? currentMethods : [];
  const fields = methods.filter(method => method?.type === "field");
  if (fields.length !== 1) return fields.length ? methods : [...methods, cachedMethod];
  const current = fields[0];
  if (current.startDate !== cachedMethod.startDate || current.endDate !== cachedMethod.endDate) return methods;
  const currentPoolReported = current.rewardSpeciesStatus === "reported" &&
    Array.isArray(current.tasks) && current.tasks.some(task => task?.status === "reported");
  const cachedPoolExact = cachedMethod.taskResolutionConfidence === "exact-task-and-attached-reward-rows" &&
    Array.isArray(cachedMethod.tasks) && cachedMethod.tasks.some(task => task?.rewardSpecies?.length);
  const merged = {
    ...cachedMethod,
    ...current,
    sourceUrl: current.sourceUrl || cachedMethod.sourceUrl,
    startDate: current.startDate,
    endDate: current.endDate,
    windows: Array.isArray(current.windows) && current.windows.length ? current.windows : cachedMethod.windows,
    tasks: mergeResearchMethodTaskRows(current.tasks, cachedMethod.tasks),
    ...(cachedMethod.taskSourceUrl ? { taskSourceUrl: cachedMethod.taskSourceUrl } : {}),
    ...(cachedMethod.taskSourceKind ? { taskSourceKind: cachedMethod.taskSourceKind } : {}),
    ...(cachedMethod.taskSourceStatus ? { taskSourceStatus: cachedMethod.taskSourceStatus } : {}),
    ...(currentPoolReported && cachedPoolExact ? {
      rewardSpecies: cachedMethod.rewardSpecies,
      rewardSpeciesStatus: cachedMethod.rewardSpeciesStatus,
      automation: cachedMethod.automation || current.automation
    } : { automation: current.automation || cachedMethod.automation })
  };
  return methods.map(method => method === current ? merged : method);
}

async function rememberResearchKnowledge(event, details, intelligence, now) {
  const method = intelligence?.method;
  const keys = researchKnowledgeKeys(event);
  if (!method || !keys.length || intelligence.sourceStatus !== "current") return;
  const record = {
    keys,
    method,
    research: Array.isArray(details?.research) ? details.research : [],
    researchDiscovery: intelligence,
    fetchedAt: Number(intelligence.sourceFetchedAt) || now,
    updatedAt: now,
    expiresAt: Date.parse(`${method.endDate}T23:59:59Z`) + 30 * 86_400_000
  };
  for (const [key, value] of eventResearchKnowledge) {
    if (!(Number(value?.expiresAt) > now)) eventResearchKnowledge.delete(key);
  }
  for (const key of keys) eventResearchKnowledge.set(key, record);
  if (eventResearchKnowledge.size > EVENT_RESEARCH_KNOWLEDGE_MAX * 2) {
    const stale = [...eventResearchKnowledge.entries()].sort((left, right) =>
      Number(left[1]?.updatedAt) - Number(right[1]?.updatedAt));
    for (const [key] of stale.slice(0, eventResearchKnowledge.size - EVENT_RESEARCH_KNOWLEDGE_MAX * 2)) {
      eventResearchKnowledge.delete(key);
    }
  }
  if (!storageConfigured()) return;
  const persist = async () => {
    const stored = await readJson(EVENT_RESEARCH_KNOWLEDGE_KEY).catch(() => null);
    const records = Array.isArray(stored?.records) ? stored.records : [];
    const merged = records.filter(row => row?.expiresAt > now &&
      !(Array.isArray(row?.keys) && row.keys.some(key => keys.includes(key))));
    merged.push(record);
    merged.sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt));
    await writeJson(EVENT_RESEARCH_KNOWLEDGE_KEY, { schemaVersion: 1, records: merged.slice(0, EVENT_RESEARCH_KNOWLEDGE_MAX) });
  };
  await withRedisLock("event-research-knowledge", persist, { leaseMs: 20_000 }).catch(() => {});
}

async function overlayCachedResearchKnowledge(result, now) {
  const knowledge = new Map(eventResearchKnowledge);
  if (storageConfigured()) {
    const stored = await readJson(EVENT_RESEARCH_KNOWLEDGE_KEY).catch(() => null);
    for (const record of Array.isArray(stored?.records) ? stored.records : []) {
      if (!(Number(record?.expiresAt) > now) || !Array.isArray(record?.keys)) continue;
      for (const key of record.keys) if (typeof key === "string") knowledge.set(key, record);
    }
  }
  const update = event => {
    const record = researchKnowledgeKeys(event).map(key => knowledge.get(key)).find(Boolean);
    if (!record?.method || !(Number(record.expiresAt) > now)) return event;
    const details = event.details && typeof event.details === "object" ? event.details : {};
    const freshnessMs = eventDetailFreshnessMs(event, now);
    const age = Math.max(0, now - Number(record.fetchedAt || 0));
    const sourceStatus = age < freshnessMs ? "current" : "stale";
    const cachedMethod = { ...record.method, taskSourceFreshness: sourceStatus,
      taskSourceFetchedAt: Number(record.fetchedAt) || 0 };
    return {
      ...event,
      details: {
        ...details,
        research: mergeResearchGroups(details.research || [], record.research || []),
        researchMethods: overlayResearchMethod(details.researchMethods, cachedMethod),
        researchDiscovery: { ...record.researchDiscovery, sourceStatus, sourceFetchedAt: Number(record.fetchedAt) || 0 },
        detailSourceFetchedAt: Number(record.fetchedAt) || 0,
        detailSourceFreshness: sourceStatus
      }
    };
  };
  return {
    ...result,
    calendarEvents: (result.calendarEvents || []).map(update),
    sourceCalendarEvents: (result.sourceCalendarEvents || []).map(update)
  };
}

/** Enrich one event; source-feed refresh invokes this for a rotating, capped candidate set. */
export async function enrichCalendarEventDetail(event, { force = false, now = Date.now(),
  detailCacheRead = readJson, detailCacheWrite = writeJson, detailCacheLock = withRedisLock,
  researchTaskCacheRead = readJson, researchTaskCacheWrite = writeJson,
  researchTaskCacheLock = withRedisLock, researchTaskFetch = fetch } = {}) {
  const original = event && typeof event === "object" ? event : null;
  if (!original) return original;
  const restored = await overlayCachedResearchKnowledge({ calendarEvents: [original], sourceCalendarEvents: [] }, now);
  const base = restored.calendarEvents[0] || original;
  const parsedResult = await cachedLeekDuckDetail(base, { force, now,
    cacheRead: detailCacheRead, cacheWrite: detailCacheWrite, cacheLock: detailCacheLock });
  const parsed = parsedResult?.detail || null;
  const officialNews = await fetchOfficialNewsDiscovery({ force: false, now, allowNetwork: false }).catch(() => ({ articles: [] }));
  const official = matchOfficialArticleForEvent(base, officialNews?.articles);
  const baseDetails = base.details && typeof base.details === "object" ? base.details : {};
  const parsedDetails = parsed || {};
  const fieldResearch = buildFieldResearchIntelligence({
    event: { ...base, details: baseDetails },
    researchGroups: parsedDetails.research || [],
    sourceUrl: base.link,
    sourceFetchedAt: parsedResult?.fetchedAt,
    sourceFreshness: parsedResult?.status || "unavailable"
  });
  let researchMethods = mergeResearchMethod(baseDetails, fieldResearch);
  const fieldMethod = researchMethods.find(method => method?.type === "field");
  const taskSource = await cachedRedditResearchTaskSource(base, fieldMethod, { force, now,
    cacheRead: researchTaskCacheRead, cacheWrite: researchTaskCacheWrite,
    cacheLock: researchTaskCacheLock, fetchImpl: researchTaskFetch });
  if (fieldMethod && taskSource) {
    researchMethods = researchMethods.map(method => method === fieldMethod ? {
      ...method,
      taskSourceFreshness: taskSource.status,
      taskSourceFetchedAt: taskSource.fetchedAt
    } : method);
  }
  const reviewedOverrides = featuredEventDetails(base.id)?.eventOverrides;
  // A reviewed official overlay can supersede scraped detail prose when the
  // latter publishes a conflicting deadline. Still merge safe images/targets.
  const sections = uniqueSections(baseDetails.sections || [],
    featuredEventDetails(base.id)?.authoritativeSections ? [] : parsedDetails.sections || []);
  const hasPublishedDetails = Boolean(
    uniqueTextRows(base.bonuses || [], parsedDetails.bonuses || []).length ||
    uniqueNamedRows(baseDetails.spawns || [], parsedDetails.spawns || []).length ||
    uniqueNamedRows(baseDetails.raidBosses || [], parsedDetails.raidBosses || []).length ||
    uniqueNamedRows(baseDetails.maxBattleBosses || [], parsedDetails.maxBattleBosses || []).length ||
    (Array.isArray(baseDetails.research) && baseDetails.research.length) ||
    (Array.isArray(parsedDetails.research) && parsedDetails.research.length) || sections.length
  );
  if (!hasPublishedDetails) sections.push({ title: "Published information", items: [eventResearchFallback(base)] });
  if (!sections.length) {
    sections.push(...eventFallbackSections({
      ...base,
      details: { ...baseDetails, ...parsedDetails, sections }
    }));
  }
  const sourceLinks = uniqueSourceLinks(
    baseDetails.sourceLinks || [],
    official ? [{ label: "Official Pokémon GO announcement", href: official.href }] : [],
    [{ label: "Search G47IX coverage on X", href: g47ixResearchLink(base) }]
  );
  const featuredPokemon = uniqueNamedRows(baseDetails.featuredPokemon || [], parsedDetails.featuredPokemon || []).slice(0, 200);
  const confirmedWild = Array.isArray(baseDetails.spawnSchedule?.confirmedWildSpawns)
    ? new Set(baseDetails.spawnSchedule.confirmedWildSpawns.map(name => cleanText(name, 160).toLowerCase()))
    : null;
  const spawns = uniqueNamedRows(baseDetails.spawns || [], parsedDetails.spawns || [])
    .filter(row => !confirmedWild || confirmedWild.has(cleanText(row.name || row, 160).toLowerCase()))
    .slice(0, 200);
  const confirmedMax = baseDetails.maxBattleSchedule?.sourceKind === "official" &&
    Array.isArray(baseDetails.maxBattleSchedule?.windows)
    ? new Set(baseDetails.maxBattleSchedule.windows.flatMap(window =>
      [...(window.bosses || []), ...(window.superBosses || [])]).map(row => cleanText(row?.name || row, 160).toLowerCase()))
    : null;
  const maxBattleBosses = uniqueNamedRows(baseDetails.maxBattleBosses || [], parsedDetails.maxBattleBosses || [])
    .filter(row => !confirmedMax || confirmedMax.has(cleanText(row.name || row, 160).toLowerCase()))
    .slice(0, 200);
  const dedicatedMaxEvent = /max-(?:mondays?|battles?|days?)|gigantamax/i.test(String(base.eventType || ""));
  const maxNames = new Set(maxBattleBosses.map(row => cleanText(row.name || row, 160).toLowerCase()));
  const confirmedRaid = baseDetails.raidSchedule?.sourceKind === "official" &&
    Array.isArray(baseDetails.raidSchedule?.windows)
    ? new Set(baseDetails.raidSchedule.windows.flatMap(window =>
      [...(window.bosses || []), ...(window.superBosses || [])]).map(row => cleanText(row?.name || row, 160).toLowerCase()))
    : null;
  // Older cached detail articles stored a Max boss in raidBosses. Keep any
  // distinct published raid, but do not display one Max encounter twice.
  const raidBosses = uniqueNamedRows(baseDetails.raidBosses || [], parsedDetails.raidBosses || [])
    .filter(row => !confirmedRaid || confirmedRaid.has(cleanText(row.name || row, 160).toLowerCase()))
    .filter(row => !dedicatedMaxEvent || !maxNames.has(cleanText(row.name || row, 160).toLowerCase()))
    .slice(0, 200);
  const shinies = uniqueNamedRows(baseDetails.shinies || [], parsedDetails.shinies || []).slice(0, 200);
  const speciesRows = uniqueNamedRows(
    (base.species || []).map(name => ({ name })),
    base.speciesImages || [],
    featuredPokemon,
    spawns,
    raidBosses,
    maxBattleBosses
  ).slice(0, 200);
  const enriched = {
    ...base,
    summary: genericSummary(base)
      ? (parsedDetails.summary && !genericSummary(parsedDetails)
        ? parsedDetails.summary
        : eventSummaryFallback({
          ...base,
          ...parsedDetails,
          details: { ...baseDetails, ...parsedDetails, sections }
        }))
      : base.summary,
    imageUrl: base.imageUrl || parsedDetails.imageUrl || "",
    // A reviewed free-event overlay separates ticket benefits in its source
    // notes. Do not reintroduce paid-only bonuses as general event benefits.
    bonuses: uniqueTextRows(base.bonuses || [], reviewedOverrides?.ticketRequired === false
      ? [] : parsedDetails.bonuses || []).slice(0, 100),
    species: speciesRows.map(row => row.name),
    speciesImages: speciesRows.filter(row => row.imageUrl),
    specialBackground: Boolean(base.specialBackground || parsedDetails.specialBackground),
    costumePokemon: Boolean(base.costumePokemon || parsedDetails.costumePokemon),
    ticketRequired: typeof reviewedOverrides?.ticketRequired === "boolean"
      ? reviewedOverrides.ticketRequired : Boolean(base.ticketRequired || parsedDetails.ticketRequired),
    sourceLabel: parsed && official
      ? "LeekDuck event detail + official Pokémon GO news"
      : parsed ? "LeekDuck event detail" : base.sourceLabel,
    details: {
      ...baseDetails,
      featuredPokemon,
      spawns,
      shinies,
      raidBosses,
      maxBattleBosses,
      research: mergeResearchGroups(baseDetails.research || [], parsedDetails.research || []),
      researchMethods,
      ...(fieldResearch ? { researchDiscovery: fieldResearch } : baseDetails.researchDiscovery
        ? { researchDiscovery: baseDetails.researchDiscovery } : {}),
      sections,
      sourceLinks,
      detailCheckedAt: now,
      detailSourceFetchedAt: Number(parsedResult?.fetchedAt) || Number(baseDetails.detailSourceFetchedAt) || 0,
      detailSourceFreshness: parsedResult?.status || baseDetails.detailSourceFreshness || "unavailable",
      detailStatus: parsed ? "enriched" : hasPublishedDetails ? "published" : "awaiting-publisher-details"
    }
  };
  if (fieldResearch?.method && parsedResult?.status === "current") {
    await rememberResearchKnowledge(base, enriched.details, fieldResearch, now);
  }
  // The calendar grade is the stable published score users and grade automation see.
  // On-demand detail scraping may add research/lure rewards that cannot safely
  // be interpreted as extra wild opportunities or silently change that grade.
  const published = publishGradingEvidence(enriched);
  return { ...published, rating: rateEvent(published, now) };
}

async function enrichResearchDiscoveryCards(result, now, { refreshDetails = true } = {}) {
  const withKnowledge = await overlayCachedResearchKnowledge(result, now);
  const ratings = new WeakMap();
  const ratingFor = event => {
    if (!ratings.has(event)) ratings.set(event, rateEvent(event, now));
    return ratings.get(event);
  };
  const publish = (base, detailsById = new Map()) => {
    const regradeChangedRows = events => (events || []).map(event => {
      const enriched = detailsById.get(String(event.id)) || event;
      const published = publishGradingEvidence(enriched);
      return { ...published, rating: ratingFor(published) };
    });
    return {
      ...base,
      calendarEvents: regradeChangedRows(base.calendarEvents),
      sourceCalendarEvents: regradeChangedRows(base.sourceCalendarEvents)
    };
  };
  if (!refreshDetails) return publish(withKnowledge);
  const candidates = researchDiscoveryCandidates(withKnowledge?.calendarEvents, now, RESEARCH_DISCOVERY_BATCH_SIZE, CACHE_MS);
  if (!candidates.length) return publish(withKnowledge);
  const enrichedRows = await Promise.all(candidates.map(event => enrichCalendarEventDetail(event, { now })));
  const byId = new Map(enrichedRows.filter(Boolean).map(event => [String(event.id), event]));
  return publish({
    ...withKnowledge,
    calendarEvents: (withKnowledge.calendarEvents || []).map(event => byId.get(String(event.id)) || event),
    sourceCalendarEvents: (withKnowledge.sourceCalendarEvents || []).map(event => byId.get(String(event.id)) || event)
  }, byId);
}

function calendarEventBonuses(event) {
  const bonuses = new Set();
  const add = value => {
    for (const bonus of Array.isArray(value) ? value : [value]) {
      const text = cleanText(bonus?.text || bonus, 400);
      if (text) bonuses.add(text);
    }
  };
  add(event?.bonus);
  add(event?.bonuses);
  add(event?.extraData?.spotlight?.bonus);
  for (const detail of Object.values(event?.extraData || {})) {
    if (!detail || typeof detail !== "object") continue;
    add(detail.bonus);
    add(detail.bonuses);
  }
  return [...bonuses].slice(0, 100);
}

function calendarEventAppearanceMetadata(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return {};
  const metadata = {};
  const copyInteger = (destination, keys, minimum = 0) => {
    for (const key of keys) {
      const raw = entry[key];
      if (raw === null || raw === undefined || typeof raw !== "number" && typeof raw !== "string") continue;
      const valueText = String(raw).trim();
      if (!/^\d+$/.test(valueText)) continue;
      const value = Number(valueText);
      if (Number.isSafeInteger(value) && value >= minimum) {
        metadata[destination] = value;
        return;
      }
    }
  };
  copyInteger("pokedex_id", ["pokedex_id", "pokedexId", "dex_id", "dexId"], 1);
  copyInteger("form", ["form", "form_value", "formValue", "form_id", "formId", "pokemon_form", "pokemonForm"]);
  copyInteger("costume", ["costume", "costume_id", "costumeId"]);
  copyInteger("gender", ["gender", "pokemon_gender", "pokemonGender"]);
  copyInteger("max_mode", ["bread_mode", "breadMode", "max_mode", "maxMode"]);
  return metadata;
}

function calendarEventNamedRows(value, maximum = 200) {
  const rows = [];
  const seen = new Set();
  for (const entry of Array.isArray(value) ? value : []) {
    const name = cleanText(entry?.name || entry?.text || entry, 120);
    if (!name) continue;
    const row = {
      name,
      imageUrl: safeEventImage(entry?.image),
      ...calendarEventAppearanceMetadata(entry)
    };
    const key = detailPokemonAppearanceKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
    if (rows.length >= maximum) break;
  }
  return rows;
}

function calendarEventResearch(value) {
  return (Array.isArray(value) ? value : []).slice(0, 120).map((step, index) => ({
    name: cleanText(step?.name, 160) || `Research step ${index + 1}`,
    step: Number.isFinite(Number(step?.step)) ? Number(step.step) : index + 1,
    tasks: (Array.isArray(step?.tasks) ? step.tasks : []).slice(0, 120).map(task => ({
      text: cleanText(task?.text, 180),
      reward: cleanText(task?.reward?.text || task?.reward, 1_000)
    })).filter(task => task.text),
    rewards: (Array.isArray(step?.rewards) ? step.rewards : []).slice(0, 100)
      .map(reward => cleanText(reward?.text || reward, 1_000))
      .filter(Boolean)
  })).filter(step => step.tasks.length || step.rewards.length);
}

function calendarEventTitleBattleRows(event) {
  const identity = `${event?.name || ""} ${event?.heading || ""}`;
  if (!/max\s+monday/i.test(identity)) return [];
  const match = String(event?.name || "").match(/\bDynamax\s+(.+?)\s+during\s+Max\s+Monday\b/i);
  if (!match) return [];
  return match[1]
    .replace(/,\s+and\s+/gi, ", ")
    .replace(/\s+and\s+/gi, ", ")
    .split(",")
    .map(name => ({ name: cleanText(name, 120) }))
    .filter(row => row.name);
}

function calendarEventDetails(event) {
  const community = event?.extraData?.communityday || {};
  const raids = event?.extraData?.raidbattles || {};
  const maxEvent = /max-(?:mondays?|battles?|days?)|gigantamax/i.test(String(event?.eventType || ""));
  const titleBattleRows = calendarEventTitleBattleRows(event);
  const seasonMaxDebuts = new Set(["rhyhorn", "sneasel", "sizzlipede"]);
  const maxDebuts = maxEvent ? titleBattleRows.filter(row =>
    seasonMaxDebuts.has(String(row.name || "").toLowerCase())) : [];
  const spotlight = event?.extraData?.spotlight || {};
  const raidKind = event?.eventType === "raid-battles"
    ? /\bin (Mega|Shadow) Raids\b/i.exec(String(event.name || ""))?.[1]?.toLowerCase() : "";
  const bonusNotes = (Array.isArray(community?.bonusDisclaimers) ? community.bonusDisclaimers : [])
    .map(note => cleanText(note, 400))
    .filter(Boolean)
    .slice(0, 100);
  const spotlightName = cleanText(spotlight?.name, 120);
  const spotlightBonus = cleanText(spotlight?.bonus, 200);
  return {
    ...(["mega", "shadow"].includes(raidKind) ? { raidKind } : {}),
    spawns: calendarEventNamedRows([
      ...(Array.isArray(community?.spawns) ? community.spawns : []),
      ...(Array.isArray(spotlight?.list) ? spotlight.list : [])
    ]),
    shinies: uniqueNamedRows(
      calendarEventNamedRows(community?.shinies).map(row => ({ ...row, methods: ["collector"] })),
      calendarEventNamedRows(raids?.shinies).map(row => ({ ...row, methods: ["raider"] })),
      spotlightName && spotlight?.canBeShiny === true
        ? [{ name: spotlightName, imageUrl: safeEventImage(spotlight?.image), methods: ["collector"] }] : []
    ),
    raidBosses: calendarEventNamedRows([
      ...(Array.isArray(raids?.bosses) ? raids.bosses : []),
      ...(!maxEvent ? titleBattleRows : [])
    ]),
    maxBattleBosses: calendarEventNamedRows(maxEvent ? titleBattleRows : []),
    ...(maxDebuts.length ? {
      debutPokemon: maxDebuts.map(row => ({ name: row.name, form: "Dynamax", methods: ["max"] })),
      sourceLinks: [{ label: "Official Twilight Trails Max Pokémon debuts",
        href: "https://pokemongo.com/seasons/twilight-trails" }],
      sections: [{ title: "Dynamax form debut", items: [
        `The official Twilight Trails season announcement lists Dynamax ${maxDebuts.map(row => row.name).join(", Dynamax ")} among this season's new Max Pokémon. This Max Monday features the listed form.`
      ] }]
    } : {}),
    bonusNotes,
    research: calendarEventResearch(community?.specialresearch),
    spotlight: spotlightName || spotlightBonus
      ? {
          name: spotlightName,
          bonus: spotlightBonus,
          ...(typeof spotlight?.canBeShiny === "boolean" ? { canBeShiny: spotlight.canBeShiny } : {}),
          imageUrl: safeEventImage(spotlight?.image),
          ...calendarEventAppearanceMetadata(spotlight)
        }
      : null
  };
}

function calendarEventSpecies(event, details) {
  const rows = [];
  const seen = new Set();
  const add = row => {
    const name = cleanText(row?.name || row, 120);
    if (!name) return;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) {
      const existing = rows.find(item => item.name.toLocaleLowerCase() === key);
      if (existing && !existing.imageUrl) existing.imageUrl = safeEventImage(row?.imageUrl || row?.image);
      return;
    }
    seen.add(key);
    rows.push({ name, imageUrl: safeEventImage(row?.imageUrl || row?.image) });
  };
  for (const name of explicitEventSpecies(event)) add(name);
  for (const row of [...(details?.spawns || []), ...(details?.raidBosses || []), ...(details?.maxBattleBosses || [])]) add(row);
  return rows.slice(0, 200);
}

function calendarEventLocation(event) {
  const raw = event?.location ?? event?.venue ?? event?.extraData?.location ?? event?.extraData?.venue;
  const location = cleanText(typeof raw === "object" ? raw?.name || raw?.label : raw, 120);
  const coordinateText = typeof event?.coordinates === "string"
    ? event.coordinates
    : typeof raw?.coordinates === "string" ? raw.coordinates : "";
  const coordinateParts = coordinateText.split(",").map(value => Number(String(value).trim()));
  const latitude = Number(
    event?.latitude ?? event?.lat ?? raw?.latitude ?? raw?.lat ?? coordinateParts[0]
  );
  const longitude = Number(
    event?.longitude ?? event?.lng ?? event?.lon ?? raw?.longitude ?? raw?.lng ?? raw?.lon ?? coordinateParts[1]
  );
  return {
    location,
    coordinates: Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
      Number.isFinite(longitude) && Math.abs(longitude) <= 180
      ? (coordinateText.trim() || `${latitude}, ${longitude}`)
      : ""
  };
}

function calendarEventVenues(event) {
  const rows = [];
  const seen = new Set();
  for (const [index, venue] of (Array.isArray(event?.venues) ? event.venues : []).entries()) {
    const latitude = Number(venue?.latitude ?? venue?.lat ?? String(venue?.coordinates || "").split(",")[0]);
    const longitude = Number(venue?.longitude ?? venue?.lng ?? venue?.lon ?? String(venue?.coordinates || "").split(",")[1]);
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180) continue;
    const coordinates = `${latitude}, ${longitude}`;
    const key = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: cleanText(venue?.id, 100) || `venue-${index + 1}`,
      name: cleanText(venue?.name || venue?.location, 140) || `Location ${rows.length + 1}`,
      location: cleanText(venue?.location, 180),
      coordinates,
      timeZone: cleanText(venue?.timeZone || event?.timeZone, 80),
      group: cleanText(venue?.group, 100)
    });
  }
  return rows.slice(0, 300);
}

// ScrapedDuck currently labels these future in-person events "Global". These
// exact source-linked cards must remain location-scoped until gameplay detail
// and approved coordinates are published; event cities are not hunt centers.
const VERIFIED_IN_PERSON_EVENT_SCOPES = Object.freeze({
  "pokemon-go-wild-area-2026-sendai-japan": {
    sourceUrl: "https://leekduck.com/events/pokemon-go-wild-area-2026-sendai-japan/",
    officialUrl: "https://pokemongo.com/gowildarea/sendai",
    ticketRequired: true,
    location: "Sendai, Miyagi Prefecture, Japan · gameplay throughout Miyagi Prefecture",
    venueNote: "The official event is centered in Sendai, with ticketed gameplay throughout Miyagi Prefecture. No approved hunt center or coordinates are published here."
  },
  "pokemon-go-wild-area-2026-mexico-city": {
    sourceUrl: "https://leekduck.com/events/pokemon-go-wild-area-2026-mexico-city/",
    officialUrl: "https://pokemongo.com/gowildarea/mexico-city",
    ticketRequired: true,
    location: "Mexico City metropolitan area",
    venueNote: "The official event publishes gameplay throughout the Mexico City metropolitan area. No approved hunt center or coordinates are published here."
  },
  "pokemon-go-tour-alola-kaohsiung-2027": {
    sourceUrl: "https://leekduck.com/events/pokemon-go-tour-alola-kaohsiung-2027/",
    officialUrl: "https://pokemongo.com/en/news/save-the-date-go-tour-2027",
    ticketRequired: true,
    location: "Kaohsiung, Taiwan · in-person event; gameplay venue TBA",
    venueNote: "The official save-the-date confirms an in-person event in Kaohsiung; gameplay venue, boundaries, targets, and hours are not published yet."
  },
  "pokemon-go-tour-alola-los-angeles-2027": {
    sourceUrl: "https://leekduck.com/events/pokemon-go-tour-alola-los-angeles-2027/",
    officialUrl: "https://pokemongo.com/en/news/save-the-date-go-tour-2027",
    ticketRequired: true,
    location: "Los Angeles, California · in-person event; gameplay venue TBA",
    venueNote: "The official save-the-date confirms an in-person event in Los Angeles; gameplay venue, boundaries, targets, and hours are not published yet."
  }
});

function calendarEventRow(event, now) {
  const eventId = eventDetailId(event);
  const startAt = eventBoundary(event?.start);
  const endAt = eventBoundary(event?.end);
  if (startAt === null && endAt === null) return null;
  const localTime = Boolean((event?.start || event?.end) &&
    !/[zZ]$|[+-]\d\d:\d\d$/.test(String(event?.start || event?.end)));
  const grace = localTime ? LOCAL_EVENT_GRACE_MS : 0;
  if ((endAt ?? startAt) < now - grace) return null;
  const place = calendarEventLocation(event);
  const parsedDetails = event?.details && typeof event.details === "object" ? event.details : {};
  const generatedDetails = calendarEventDetails(event);
  const preserveSuppliedRows = Object.fromEntries([
    "spawns", "shinies", "raidBosses", "maxBattleBosses", "research", "bonusNotes"
  ].filter(key => Array.isArray(generatedDetails[key]) && generatedDetails[key].length === 0 &&
    Array.isArray(parsedDetails[key]) && parsedDetails[key].length > 0)
    .map(key => [key, parsedDetails[key]]));
  const details = {
    ...parsedDetails,
    ...generatedDetails,
    ...preserveSuppliedRows,
    ...(Array.isArray(parsedDetails.sections) && parsedDetails.sections.length
      ? { sections: parsedDetails.sections }
      : {}),
    ...(Array.isArray(parsedDetails.sourceLinks) && parsedDetails.sourceLinks.length
      ? { sourceLinks: parsedDetails.sourceLinks }
      : {})
  };
  const inPersonScope = VERIFIED_IN_PERSON_EVENT_SCOPES[eventId];
  const verifiedInPersonScope = inPersonScope && event?.link === inPersonScope.sourceUrl
    ? inPersonScope : null;
  if (verifiedInPersonScope) {
    details.sourceLinks = [
      ...(Array.isArray(details.sourceLinks) ? details.sourceLinks : []),
      { label: "Official event location and details", href: verifiedInPersonScope.officialUrl },
      { label: "Leek Duck event listing", href: verifiedInPersonScope.sourceUrl }
    ];
  }
  const speciesRows = calendarEventSpecies(event, details);
  const generic = event?.extraData?.generic || {};
  return {
    id: eventId,
    name: cleanText(event?.name, 160) || "Pokémon GO event",
    heading: cleanText(event?.heading, 100),
    summary: cleanText(event?.summary || event?.description || event?.heading, 800),
    eventType: cleanText(event?.eventType, 80),
    start: String(event?.start || "").slice(0, 40),
    end: String(event?.end || "").slice(0, 40),
    localTime,
    link: safeEventLink(event?.link),
    imageUrl: safeEventImage(event?.image || event?.imageUrl),
    species: speciesRows.map(row => row.name),
    speciesImages: speciesRows.filter(row => row.imageUrl).slice(0, 200),
    bonuses: calendarEventBonuses(event),
    hasSpawns: Boolean(event?.extraData?.generic?.hasSpawns),
    location: verifiedInPersonScope?.location || place.location,
    coordinates: verifiedInPersonScope ? "" : place.coordinates,
    timeZone: cleanText(event?.timeZone, 80),
    scope: verifiedInPersonScope ? "regional" : place.location ? "venue" : "global",
    startingSoonAlert: event?.startingSoonAlert === true,
    sourceLabel: cleanText(event?.sourceLabel, 120) || "ScrapedDuck",
    scheduleNote: cleanText(event?.scheduleNote, 300),
    plannerUnavailableReason: cleanText(event?.plannerUnavailableReason, 300),
    ticketRequired: Boolean(verifiedInPersonScope?.ticketRequired || event?.ticketRequired || event?.ticket_required || generic?.ticketRequired),
    specialBackground: Boolean(event?.specialBackground || event?.background),
    costumePokemon: Boolean(event?.costumePokemon || event?.costume),
    venueNote: verifiedInPersonScope?.venueNote || "",
    details
  };
}

function hasCuratedSourceAlias(event) {
  const id = String(event?.id || "").toLocaleLowerCase();
  return [...CURATED_SOURCE_ALIASES].some(alias => id === alias || id.includes(alias));
}

function normalizedCalendarIdentity(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sameCitySafariDateRange(source, curated) {
  const sourceStart = eventBoundary(source?.start), sourceEnd = eventBoundary(source?.end);
  const curatedStart = eventBoundary(curated?.start), curatedEnd = eventBoundary(curated?.end);
  return sourceStart !== null && sourceEnd !== null && curatedStart !== null && curatedEnd !== null &&
    sourceStart < curatedEnd && curatedStart < sourceEnd;
}

function unlocatedCuratedCitySafariAlias(event, curatedCitySafaris) {
  if (event?.scope !== "global" || event?.timeZone || event?.coordinates || event?.location ||
      /stamp[\s-]*rally/i.test(`${event?.eventType || ""} ${event?.name || ""}`)) return null;
  if (!/city[\s-]*safari/i.test(`${event?.eventType || ""} ${event?.name || ""}`)) return null;
  const sourceIdentity = normalizedCalendarIdentity(`${event?.id || ""} ${event?.name || ""}`);
  return curatedCitySafaris.find(curated => {
    const city = String(curated?.name || "").split(":").at(-1)?.trim();
    const normalizedCity = normalizedCalendarIdentity(city);
    const hasCity = normalizedCity && ` ${sourceIdentity} `.includes(` ${normalizedCity} `);
    return hasCity && sameCitySafariDateRange(event, curated);
  }) || null;
}

// A sparse Raid Hour card can inherit its boss and Shiny eligibility only
// from one matching, published rotation that covers that exact local hour.
// This is a source join, not a guess from a title or a broad raid season.
function enrichRaidHoursFromRotations(events) {
  const rows = Array.isArray(events) ? events : [];
  const leekDuck = row => /^https:\/\/leekduck\.com\/events\//i.test(String(row?.link || ""));
  // The hour title says "Giratina (Origin Forme)" while its published raid
  // rotation lists "Giratina (Origin)". Keep the form distinct from Altered.
  const raidBossKey = value => nameKey(value).replace(/^giratinaoriginforme$/, "giratinaorigin");
  const rotations = rows.filter(row => row.localTime === true && row.scope === "global" &&
    /raid/i.test(String(row.eventType || "")) && !/raid.hour/i.test(String(row.eventType || "")) &&
    leekDuck(row) && (row.details?.raidBosses || []).length === 1);
  return rows.map(hour => {
    if (hour.localTime !== true || hour.scope !== "global" ||
      !/raid.hour/i.test(String(hour.eventType || "")) || !leekDuck(hour) ||
      (hour.details?.raidBosses || []).length || hour.details?.raidSchedule) return hour;
    const bossName = String(hour.name || "").match(/^(.+?) Raid Hour$/i)?.[1]?.trim();
    const startAt = eventBoundary(hour.start), endAt = eventBoundary(hour.end);
    if (!bossName || startAt === null || endAt === null || endAt <= startAt || endAt - startAt > 2 * 3_600_000) return hour;
    const matches = rotations.filter(rotation => {
      const boss = rotation.details.raidBosses[0];
      const rotationStart = eventBoundary(rotation.start), rotationEnd = eventBoundary(rotation.end);
      return raidBossKey(boss?.name || boss) === raidBossKey(bossName) &&
        rotationStart !== null && rotationEnd !== null && rotationStart <= startAt && rotationEnd >= endAt;
    });
    if (matches.length !== 1) return hour;
    const rotation = matches[0];
    const boss = rotation.details.raidBosses[0];
    const shiny = (rotation.details.shinies || []).find(row => raidBossKey(row?.name || row) === raidBossKey(bossName));
    const tier = /\b(?:five.star|5.star)\b/i.test(String(rotation.name || "")) ? 5 : null;
    return { ...hour, details: {
      ...hour.details,
      raidBosses: [boss],
      shinies: shiny ? [shiny] : hour.details?.shinies || [],
      ...(tier ? { raidTier: tier } : {}),
      raidSchedule: { sourceUrl: hour.link, sourceKind: "published-rotation-join", localTime: true,
        windows: [{ label: `${bossName} Raid Hour`, start: hour.start, end: hour.end, bosses: [boss] }] },
      sourceLinks: [
        ...(Array.isArray(hour.details?.sourceLinks) ? hour.details.sourceLinks : []),
        { label: "Raid Hour schedule", href: hour.link },
        { label: "Matching raid rotation", href: rotation.link }
      ]
    } };
  });
}

export function normalizeEventSpawns(events, now = Date.now()) {
  const activeEvents = [];
  const species = new Set();
  let eventsMissingSpecies = 0;

  for (const event of Array.isArray(events) ? events : []) {
    if (!eventIsCurrent(event, now)) continue;
    const names = explicitEventSpecies(event);
    const hasSpawns = Boolean(event?.extraData?.generic?.hasSpawns);
    if (!names.length && !hasSpawns) continue;
    if (!names.length) eventsMissingSpecies += 1;
    names.forEach(name => species.add(name));
    activeEvents.push({
      id: eventDetailId(event),
      name: cleanName(event?.name),
      start: String(event?.start || ""),
      end: String(event?.end || ""),
      species: names
    });
  }

  const sortedSpecies = [...species].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
  );
  const targets = sortedSpecies.map(name => ({ name, dex: DEX_BY_NAME.get(nameKey(name)) || 0 }));
  const scrapedCalendarEvents = (Array.isArray(events) ? events : [])
    .map(event => calendarEventRow(event, now))
    .filter(Boolean);
  const seen = new Set();
  const curatedEvents = curatedLocalEvents(now);
  // Prefer reviewed APAC cards over normalized cached copies; this preserves
  // native Global policy for APAC.
  const currentCuratedPokexcitingIds = new Set(curatedEvents
    .filter(event => String(event.id || "").startsWith("local-pokexciting-"))
    .map(event => event.id));
  const curatedCitySafaris = curatedEvents.filter(event => event.eventType === "city-safari");
  const aliasesByCuratedId = new Map();
  const verifiedDelhi = iitDelhiEvent();
  const sourceCalendarEvents = scrapedCalendarEvents
    .filter(sourceEvent => !currentCuratedPokexcitingIds.has(sourceEvent.id))
    .map(sourceEvent => {
      // Regional article rows can remain in the discovery cache after a code
      // release. Attach only the reviewed display fact when the cached source
      // still has the same official URL and exact published boundaries.
      const event = sourceEvent.id === verifiedDelhi.id && sourceEvent.link === verifiedDelhi.link &&
        sourceEvent.start === verifiedDelhi.start && sourceEvent.end === verifiedDelhi.end
        ? { ...sourceEvent, details: { ...sourceEvent.details,
          publishedGameplayPeriod: verifiedDelhi.details.publishedGameplayPeriod } }
        : sourceEvent;
      const alias = unlocatedCuratedCitySafariAlias(event, curatedCitySafaris);
      if (!alias) return event;
      const aliases = aliasesByCuratedId.get(alias.id) || [];
      aliases.push(event.id);
      aliasesByCuratedId.set(alias.id, aliases);
      return { ...event, calendarAliasOf: alias.id };
    });
  const curatedCalendarEvents = curatedEvents.filter(event => !saveTheDateSuperseded(event, scrapedCalendarEvents)).map(event => {
    const sourceAliases = aliasesByCuratedId.get(event.id);
    return sourceAliases?.length ? { ...event, sourceAliases: [...new Set(sourceAliases)] } : event;
  });
  const calendarEvents = attachRaidHourGradingEvidence([
    ...enrichRaidHoursFromRotations(sourceCalendarEvents).filter(event => !hasCuratedSourceAlias(event) && !event.calendarAliasOf),
    ...curatedCalendarEvents
  ]
    .map(event => {
      const link = safeEventLink(event?.link);
      const verifiedInPersonScope = VERIFIED_IN_PERSON_EVENT_SCOPES[eventDetailId(event)];
      const venues = verifiedInPersonScope && event?.link === verifiedInPersonScope.sourceUrl
        ? [] : calendarEventVenues(event);
      const featured = featuredEventDetails(event?.id);
      const details = {
        ...(event.details || {}),
        ...(featured?.details || {}),
        ...(featured ? {
          sections: featured.sections,
          sourceLinks: featured.sourceLinks
        } : {})
      };
      const enrichedSpecies = [...new Set([
        ...(Array.isArray(event.species) ? event.species : []),
        ...(Array.isArray(details.spawns) ? details.spawns : []).map(row => cleanText(row?.name || row, 120)),
        ...(Array.isArray(details.raidBosses) ? details.raidBosses : []).map(row => cleanText(row?.name || row, 120))
      ].filter(Boolean))].slice(0, 200);
      return {
        ...event,
        ...(featured?.eventOverrides || {}),
        ...(featured ? {
          summary: featured.summary,
          bonuses: [...new Set([...(event.bonuses || []), ...featured.bonuses])],
          details
        } : {}),
        ...(featured && enrichedSpecies.length ? { species: enrichedSpecies } : {}),
        link,
        linkLabel: eventSourceLinkLabel(link),
        imageUrl: safeEventImage(event?.imageUrl),
        venues,
        venueCount: venues.length || (event?.coordinates ? 1 : 0),
        venueNote: cleanText(featured?.eventOverrides?.venueNote || event?.venueNote, 300)
      };
    })
    .map(event => {
      const sanitized = sanitizeEnglishDisplayValue(event);
      const fallbackSections = eventFallbackSections(sanitized);
      const details = {
        ...(sanitized.details && typeof sanitized.details === "object" ? sanitized.details : {}),
        ...(fallbackSections.length
          ? {
            sections: [
              ...(Array.isArray(sanitized.details?.sections) ? sanitized.details.sections : []),
              ...fallbackSections
            ]
          }
          : {})
      };
      const displayEvent = { ...sanitized, details };
      const summary = genericSummary(displayEvent)
        ? eventSummaryFallback(displayEvent)
        : displayEvent.summary;
      return {
        ...displayEvent,
        language: "en",
        name: englishDisplayText(displayEvent?.name, "Pokémon GO event", 160),
        heading: englishDisplayText(displayEvent?.heading, "Pokémon GO Event", 100),
        summary: englishDisplayText(summary, eventSummaryFallback(displayEvent), 800),
        location: englishDisplayText(displayEvent?.location, displayEvent?.scope === "venue" ? "Published event venue" : "Global", 180)
      };
    })
    .filter(event => {
      const key = String(event?.id || `${event?.name}|${event?.start}`).toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const startDelta = (eventBoundary(left.start) ?? eventBoundary(left.end) ?? 0) -
        (eventBoundary(right.start) ?? eventBoundary(right.end) ?? 0);
      if (startDelta) return startDelta;
      return String(left?.id || left?.name || "").localeCompare(String(right?.id || right?.name || ""));
    })
    .slice(0, 300), now);
  const publishedCalendarEvents = calendarEvents.map(publishGradingEvidence);
  for (const event of publishedCalendarEvents) event.rating = rateEvent(event, now);
  const result = {
    source: "ScrapedDuck / LeekDuck + official Pokémon GO News discovery + official regional overlays + Stamp Rally tracker",
    sourceUrl: SCRAPED_DUCK_EVENTS_URL,
    species: sortedSpecies,
    targets: targets.filter(target => target.dex > 0).map(target => ({
      value: String(target.dex),
      label: `${target.name} (#${target.dex})`
    })),
    unresolvedSpecies: targets.filter(target => !target.dex).map(target => target.name),
    events: activeEvents,
    calendarEvents: publishedCalendarEvents,
    sourceCalendarEvents: [...sourceCalendarEvents, ...curatedCalendarEvents],
    eventsMissingSpecies,
    fetchedAt: now
  };
  // Keep suppressed City Safari source rows available to saved-plan resolution
  // without returning duplicate cards or notification targets to clients.
  return result;
}

// Computed-result cache shared across isolates (2026-10-29). Recomputing the event payload costs ~2 s CPU, and
// cold isolates did it on controller polls, /events and /api/event-spawns. The in-isolate cache already allowed
// a 10-minute-old result, so a stored result of the same age is equivalent. Bump the version whenever the shape
// or meaning of the computed result changes.
const COMPUTED_RESULT_KEY = "event:computed-result";
export const COMPUTED_RESULT_VERSION = 1;

async function readStoredEventResult(now, read = readJson) {
  try {
    const stored = await read(COMPUTED_RESULT_KEY);
    const computedAt = Number(stored?.computedAt) || 0;
    if (stored?.version !== COMPUTED_RESULT_VERSION || !stored.result || computedAt > now || now - computedAt >= CACHE_MS) return null;
    return { result: stored.result, computedAt };
  } catch {
    return null;
  }
}

function storeEventResult(result, computedAt, write = writeJson) {
  const work = write(COMPUTED_RESULT_KEY, { version: COMPUTED_RESULT_VERSION, computedAt, result }).catch(error => {
    console.warn(JSON.stringify({ event: "event-result-store-failed", error: String(error?.message || error).slice(0, 200) }));
  });
  try { runtimeExecutionContext()?.waitUntil?.(work); } catch { /* the write still settles on its own */ }
  return work;
}

export async function fetchEventSpawns(options = {}) {
  const { force = false, now = Date.now() } = options;
  if (!force && cachedResult && now - cachedAt < CACHE_MS) return cachedResult;
  if (!force && storageConfigured()) {
    const stored = await readStoredEventResult(now);
    if (stored) {
      cachedResult = stored.result;
      cachedAt = stored.computedAt;
      return cachedResult;
    }
  }
  const result = await computeEventSpawns(options);
  if (result && cachedAt === now && storageConfigured()) storeEventResult(result, now);
  return result;
}

async function computeEventSpawns({ force = false, now = Date.now(), refreshDiscovery = force,
  refreshResearchDetails = true } = {}) {
  if (!force && cachedResult && now - cachedAt < CACHE_MS) return cachedResult;
  const stored = await readJson(SOURCE_SNAPSHOT_KEY).catch(() => null);
  // Start the independent official-news discovery in parallel with the main
  // JSON source. It is intentionally advisory: a news-page outage must never
  // prevent the curated calendar or ScrapedDuck data from loading.
  const sourceDiscoveryPromise = Promise.all([
    fetchOfficialNewsDiscovery({ force, now, allowNetwork: force || refreshDiscovery }),
    fetchOfficialRegionalEvents({ force, now, allowNetwork: force || refreshDiscovery })
  ]).then(([officialNews, officialRegional]) => ({ officialNews, officialRegional }));
  const withRegionalEvents = (events, officialRegional) => [
    ...(Array.isArray(events) ? events : []),
    ...correctOfficialRegionalEvents(officialRegional?.events, now)
  ];
  if (!force && Array.isArray(stored?.events) && now - Number(stored.sourceFetchedAt || 0) < CACHE_MS) {
    const { officialNews, officialRegional } = await sourceDiscoveryPromise;
    cachedResult = await enrichResearchDiscoveryCards({
      ...normalizeEventSpawns(withRegionalEvents(stored.events, officialRegional), now),
      sourceFetchedAt: Number(stored.sourceFetchedAt) || now,
      sourceChangedAt: Number(stored.sourceChangedAt) || Number(stored.sourceFetchedAt) || now,
      sourceHealth: sourceHealth("cached", officialNews, officialRegional),
      stale: false
    }, now, { refreshDetails: refreshResearchDetails });
    cachedAt = now;
    return cachedResult;
  }
  try {
    const headers = {
      Accept: "application/json",
      "User-Agent": "PokemonGoEventWebhook/1.0"
    };
    if (stored?.etag) headers["If-None-Match"] = String(stored.etag).slice(0, 300);
    const response = await fetch(SCRAPED_DUCK_EVENTS_URL, {
      headers,
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS)
    });
    if (response.status === 304 && Array.isArray(stored?.events)) {
      const { officialNews, officialRegional } = await sourceDiscoveryPromise;
      cachedResult = await enrichResearchDiscoveryCards({
        ...normalizeEventSpawns(withRegionalEvents(stored.events, officialRegional), now),
        sourceFetchedAt: now,
        sourceChangedAt: Number(stored.sourceChangedAt) || Number(stored.sourceFetchedAt) || now,
        sourceHealth: sourceHealth("ok", officialNews, officialRegional),
        stale: false
      }, now, { refreshDetails: refreshResearchDetails });
      cachedAt = now;
      await writeJson(SOURCE_SNAPSHOT_KEY, { ...stored, sourceFetchedAt: now }).catch(() => {});
      return cachedResult;
    }
    if (!response.ok) throw new Error(`ScrapedDuck returned HTTP ${response.status}.`);
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("json") && !contentType.includes("text/plain")) {
      throw new Error("ScrapedDuck returned an unexpected content type.");
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > SOURCE_MAX_BYTES) {
      throw new Error("ScrapedDuck response exceeded the source size limit.");
    }
    const text = await readBoundedText(response, SOURCE_MAX_BYTES, "ScrapedDuck response exceeded the source size limit.");
    const events = JSON.parse(text);
    if (!Array.isArray(events)) throw new Error("ScrapedDuck returned an invalid event list.");
    const contentHash = createHash("sha256").update(text).digest("hex");
    const sourceChangedAt = contentHash === stored?.contentHash
      ? Number(stored?.sourceChangedAt) || now
      : now;
    const snapshot = {
      schemaVersion: 1,
      etag: String(response.headers.get("etag") || "").slice(0, 300),
      contentHash,
      sourceFetchedAt: now,
      sourceChangedAt,
      events
    };
    await writeJson(SOURCE_SNAPSHOT_KEY, snapshot);
    const { officialNews, officialRegional } = await sourceDiscoveryPromise;
    cachedResult = await enrichResearchDiscoveryCards({
      ...normalizeEventSpawns(withRegionalEvents(events, officialRegional), now),
      sourceFetchedAt: now,
      sourceChangedAt,
      sourceHealth: sourceHealth("ok", officialNews, officialRegional),
      stale: false
    }, now, { refreshDetails: refreshResearchDetails });
    cachedAt = now;
    return cachedResult;
  } catch (error) {
    const fallbackEvents = Array.isArray(stored?.events) ? stored.events : null;
    const { officialNews, officialRegional } = await sourceDiscoveryPromise;
    if (fallbackEvents) {
      cachedResult = await enrichResearchDiscoveryCards({
        ...normalizeEventSpawns(withRegionalEvents(fallbackEvents, officialRegional), now),
        sourceFetchedAt: Number(stored.sourceFetchedAt) || 0,
        sourceChangedAt: Number(stored.sourceChangedAt) || 0,
        sourceHealth: sourceHealth("stale", officialNews, officialRegional),
        sourceError: String(error?.message || error).slice(0, 240),
        stale: true
      }, now, { refreshDetails: refreshResearchDetails });
      cachedAt = now;
      return cachedResult;
    }
    // Curated local events remain available even during a first-run upstream
    // outage, so the public calendar never becomes an all-or-nothing proxy.
    cachedResult = await enrichResearchDiscoveryCards({
      ...normalizeEventSpawns(withRegionalEvents([], officialRegional), now),
      sourceFetchedAt: 0,
      sourceChangedAt: 0,
      sourceHealth: sourceHealth("error", officialNews, officialRegional),
      sourceError: String(error?.message || error).slice(0, 240),
      stale: true
    }, now, { refreshDetails: refreshResearchDetails });
    cachedAt = now;
    return cachedResult;
  }
}
import { POKEMON_NAMES } from "../pokemon-search-metadata.js";
