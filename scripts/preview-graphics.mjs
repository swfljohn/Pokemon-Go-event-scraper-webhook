#!/usr/bin/env node
// Build the four post graphics (Daily, Local events only, Week ahead, Season & GO Pass) as HTML files you can open
// in a browser, plus the copyable text that goes under each picture. With --png, also screenshot them with a local
// Chrome/Chromium (set CHROME=/path/to/chrome if it is not on PATH).
//
//   node scripts/preview-graphics.mjs                         # examples/sample-events.json at its sample date
//   node scripts/preview-graphics.mjs --events my.json --at 2026-11-20T23:00:00Z --tz Europe/London --png
//   node scripts/preview-graphics.mjs --live --png            # scrape the real sources first (needs network)
//
// Output goes to out/graphics/ (git-ignored).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith("--") ? args[index + 1] : fallback;
};
const flag = name => args.includes(`--${name}`);

process.env.SITE_URL ||= option("site", "https://example.com");
process.env.SITE_NAME ||= option("name", "Pokémon GO Events");

const {
  buildDailyReview, buildEventListReview, buildLocalReview, dailyReviewHtml, dailyReviewText,
  eventListReviewHtml, eventListReviewText, localReviewHtml, localReviewText, reviewAheadDays
} = await import("../app/lib/daily-review.js");
const { eventDigestWindow, eventsForDigest } = await import("../app/lib/event-notifications.js");

const timeZone = option("tz", process.env.DEFAULT_TIME_ZONE || "America/New_York");
let events;
let now;
if (flag("live")) {
  const { fetchEventSpawns } = await import("../app/lib/event-spawns.js");
  now = Date.parse(option("at")) || Date.now();
  events = (await fetchEventSpawns({ now, force: true })).calendarEvents;
} else {
  events = JSON.parse(readFileSync(option("events", "examples/sample-events.json"), "utf8"));
  // The sample file is a snapshot from late October 2026; preview it on a day it covers.
  now = Date.parse(option("at", "2026-10-30T19:00:00Z"));
}

const outDir = option("out", "out/graphics");
mkdirSync(outDir, { recursive: true });
const settings = { timeZone };
const aheadDays = reviewAheadDays(now, timeZone);
const posts = [];
const daily = buildDailyReview(events, { now, timeZone, aheadDays });
posts.push(["daily", dailyReviewHtml(daily), dailyReviewText(daily), 1350]);
const local = buildLocalReview(events, { now, timeZone, aheadDays });
if (local) posts.push(["local", localReviewHtml(local), localReviewText(local), 700]);
for (const kind of ["week", "monthly"]) {
  const review = buildEventListReview(eventsForDigest(events, kind, now, settings), kind, {
    now, timeZone, windowStart: eventDigestWindow(kind, now, timeZone).startAt
  });
  const html = review ? eventListReviewHtml(review) : "";
  if (html) posts.push([kind === "week" ? "week-ahead" : "season-go-pass", html, eventListReviewText(review), 900]);
}

const chrome = process.env.CHROME || ["google-chrome", "chromium", "chromium-browser", "chrome"].find(name => {
  try { execFileSync("which", [name], { stdio: "ignore" }); return true; } catch { return false; }
});
for (const [name, html, text, height] of posts) {
  const htmlPath = join(outDir, `${name}.html`);
  writeFileSync(htmlPath, html);
  writeFileSync(join(outDir, `${name}.txt`), text);
  let note = "";
  if (flag("png")) {
    if (!chrome) note = " (no Chrome found for --png)";
    else {
      execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=1080,${height}`,
        `--screenshot=${join(outDir, `${name}.png`)}`, `file://${join(process.cwd(), htmlPath)}`], { stdio: "ignore" });
      note = ` + ${name}.png`;
    }
  }
  console.log(`${htmlPath} + ${name}.txt${note}`);
}
if (!local) console.log("(no local-only post: no short location-bound event is live at that time)");
