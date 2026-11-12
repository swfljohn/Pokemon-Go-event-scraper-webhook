// Whole-day review (2026-10-30): today first, raids, pass/season only on launch day, tomorrow, local events; no emoji.
import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyReview, dailyReviewText, dailyReviewHtml } from "../app/lib/daily-review.js";

const now = Date.parse("2026-10-30T19:00:00Z"); // 3 PM New York
const events = [
  { id: "hw1", scope: "global", eventType: "event", name: "Pokémon GO Halloween 2026 Part I", start: "2026-10-27T10:00:00.000", end: "2026-11-01T10:00:00.000", localTime: true, rating: { grade: "A" } },
  { id: "gira", scope: "global", eventType: "raid-battles", name: "Giratina (Origin Forme) in 5-star Raid Battles", start: "2026-10-28T06:00:00.000", end: "2026-11-03T22:00:00.000", localTime: true, details: { raidBosses: [{ name: "Giratina (Origin)" }] } },
  { id: "sl", scope: "global", eventType: "raid-battles", name: "Shadow Landorus (Incarnate Forme) in Shadow Raids", start: "2026-10-07T06:00:00.000", end: "2026-11-03T22:00:00.000", localTime: true, details: { raidBosses: [{ name: "Landorus (Incarnate)", tier: 5 }] } },
  { id: "rd", scope: "global", eventType: "raid-day", name: "Chandelure Super Mega Raid Day", start: "2026-10-31T14:00:00.000", end: "2026-10-31T17:00:00.000", localTime: true, rating: { grade: "A" } },
  { id: "far", scope: "global", eventType: "event", name: "Later Event", start: "2026-11-10T10:00:00.000", end: "2026-11-12T10:00:00.000", localTime: true },
  { id: "local", scope: "local", eventType: "event", name: "Venue Meetup", start: "2026-10-30T10:00:00.000", end: "2026-10-30T20:00:00.000", localTime: true }
];

test("sorts the day into live, raids and coming up, with tier labels and site links", () => {
  const review = buildDailyReview(events, { now });
  assert.equal(review.dateLabel, "Friday, October 30");
  assert.deepEqual(review.live.map(row => row.name), ["Halloween 2026 Part I"]);
  assert.equal(review.launch, null);
  assert.match(review.live[0].status, /^ends Sun Nov 1, 10 AM$/);
  assert.deepEqual(review.raids.map(row => [row.tier, row.bosses.map(boss => boss.name)]),
    [["5-star", ["Giratina (Origin)"]], ["Shadow 5-star", ["Shadow Landorus (Incarnate)"]]]);
  assert.equal(review.raids[1].bosses[0].sprite?.shadow, true, "Shadow boss uses its base sprite with the shadow treatment");
  assert.deepEqual(review.next.map(row => [row.name, row.starts]), [["Chandelure Super Mega Raid Day", "tomorrow 2 PM"]]);
  assert.deepEqual(review.local.map(row => [row.name, row.when]), [["Venue Meetup", "last day, ends 8 PM"]]);
  assert.equal(review.next.some(row => row.name === "Later Event"), false, "look-ahead is tomorrow only");
  assert.equal("grade" in review.live[0], false, "grades are not shown");
  assert.match(review.next[0].url, /^https:\/\/example\.com\/events\?event=rd$/);
});

test("text and graphic carry no emoji and link to the site", () => {
  const review = buildDailyReview(events, { now });
  const text = dailyReviewText(review);
  const html = dailyReviewHtml(review);
  assert.doesNotMatch(text + html, /\p{Extended_Pictographic}/u);
  assert.match(text, /example\.com\/events/);
  assert.match(html, /example\.com\/events/);
  assert.doesNotMatch(text + html, /leekduck/i);
});

test("GO Pass shows only on its first day; wild spawns carry shiny marks", () => {
  const passFacts = { details: { ratingEvidence: { ratingOnly: { shinies: [{ name: "Kyogre" }], freeBenefits: ["Free Kyogre encounter, which can be Shiny"] } } } };
  const running = { id: "gp", scope: "global", eventType: "go-pass", name: "GO Pass: October", start: "2026-10-06T10:00:00.000", end: "2026-11-03T10:00:00.000", localTime: true, ...passFacts };
  const fresh = { ...running, id: "gp2", name: "GO Pass: November", start: "2026-10-30T10:00:00.000", end: "2026-12-01T10:00:00.000" };
  const hw = { ...events[0], details: { ratingEvidence: { ratingOnly: { spawns: [{ name: "Duskull" }, { name: "Zubat wearing a top hat" }], shinies: [{ name: "Zubat wearing a top hat" }] } } } };
  assert.equal(buildDailyReview([running, hw], { now }).launch, null, "a pass already running is left out");
  const review = buildDailyReview([fresh, hw], { now });
  assert.equal(review.launch.kind, "New GO Pass");
  assert.deepEqual(review.launch.highlights, ["Free Kyogre encounter, which can be Shiny"]);
  assert.deepEqual(review.live[0].wild.map(row => [row.name, row.shiny]), [["Duskull", false], ["Zubat wearing a top hat", true]]);
  const text = dailyReviewText(review);
  assert.match(text, /^\*\*Today in Pokémon GO · Friday, October 30\*\*\n\n\*\*Today\*\*/);
  assert.match(text, /\*\*New GO Pass: GO Pass: November\*\*/);
  assert.match(text, /Wild:\n`355` Duskull\n`41:3362` Zubat wearing a top hat · shiny/);
});

test("GO Battle League shows under PvP changes only on the day its cup starts", () => {
  const cup = { id: "gbl", scope: "global", eventType: "go-battle-league", name: "Master League", start: "2026-10-27T16:00:00.000", end: "2026-11-03T16:00:00.000", localTime: true };
  const running = buildDailyReview([cup], { now });
  assert.equal(running.live.length + running.pvp.length, 0);
  const fresh = buildDailyReview([{ ...cup, start: "2026-10-30T16:00:00.000" }], { now });
  assert.deepEqual(fresh.pvp.map(row => row.name), ["Master League"]);
  assert.match(dailyReviewText(fresh), /\*\*PvP changes\*\*\nMaster League · starts 4 PM/);
});

test("Discord messages: picture first on its own, then text split at sections under the 2,000 limit", async () => {
  const { reviewDiscordMessages, splitDiscordText } = await import("../app/lib/daily-review.js");
  const long = Array.from({ length: 60 }, (_, i) => `**Section ${i}**\n${"x".repeat(60)}`).join("\n\n");
  const parts = splitDiscordText(long);
  assert.ok(parts.length > 1 && parts.every(part => part.length <= 1_900));
  assert.equal(parts.join("\n\n"), long, "nothing is cut off");
  const png = new Uint8Array([137, 80, 78, 71]);
  const fetchImpl = async () => new Response(png, { status: 200, headers: { "content-type": "image/png" } });
  const env = { BROWSER_RENDERING_TOKEN: "t", CLOUDFLARE_ACCOUNT_ID: "0".repeat(32) };
  const messages = await reviewDiscordMessages("hello", "<html></html>", { env, fetchImpl });
  assert.equal(messages.length, 2);
  assert.equal(messages[0].content, "");
  assert.deepEqual([...messages[0].image.data], [...png]);
  assert.equal(messages[1].content, "hello");
  const textOnly = await reviewDiscordMessages("hello", "<html></html>", { env: {}, fetchImpl });
  assert.deepEqual(textOnly, [{ content: "hello" }], "no token: text only");
});

test("sprites: the event's own GO icon first, Mega icons by dex, costume forms, and no stand-ins", async () => {
  const { reviewSprite } = await import("../app/lib/daily-review.js");
  const icon = "https://cdn.leekduck.com/assets/img/pokemon_icons/pokemon_icon_302_51.png";
  assert.ok(reviewSprite("Mega Sableye", { imageUrl: icon }).fallbacks.includes(icon), "the event icon stays as a fallback");
  assert.match(reviewSprite("Mega Sableye").url, /wwm-uicons\/[0-9a-f]{40}\/pokemon\/302_e1\.png$/);
  assert.match(reviewSprite("Mega Charizard Y").url, /\/6_e3\.png$/);
  assert.match(reviewSprite("Sinistea wearing a bow").url, /\/854_f3365\.png$/);
  assert.match(reviewSprite("Drifblim wearing a Halloween costume").url, /\/426_c49\.png$/);
  assert.equal(reviewSprite("Shadow Landorus (Incarnate)").shadow, true);
  assert.equal(reviewSprite("Nonexistentmon wearing a hat"), null);
  const review = buildDailyReview([{ ...events[0], details: { ratingEvidence: { ratingOnly: { spawns: [{ name: "Duskull" }, { name: "Nonexistentmon" }] } } } }], { now });
  const html = dailyReviewHtml(review);
  assert.doesNotMatch(html, /Nonexistentmon|no-art/);
  assert.match(dailyReviewText(review), /Nonexistentmon/, "the text post still lists it");
});

test("plain species use the in-game style icon first", async () => {
  const { reviewSprite } = await import("../app/lib/daily-review.js");
  assert.match(reviewSprite("Duskull").url, /wwm-uicons\/[0-9a-f]{40}\/pokemon\/355\.png$/);
  assert.match(reviewSprite("Duskull").fallbacks.join(" "), /home\/355\.png/);
});

test("local-only post: live short events with coordinates; long runs and stamp rallies left out", async () => {
  const { buildLocalReview, localReviewText, localReviewHtml } = await import("../app/lib/daily-review.js");
  const run = { id: "run", scope: "venue", eventType: "local-event", name: "Pokémon RUN 30 — Dream Mall", start: "2026-10-31T00:00:00.000", end: "2026-11-01T23:59:59.000",
    localTime: true, timeZone: "Asia/Taipei", location: "Dream Mall, Kaohsiung, Taiwan", coordinates: "22.59500, 120.30694", species: ["Pikachu", "Nonexistentmon"] };
  const museum = { ...run, id: "museum", name: "Fossil Museum", start: "2026-05-22T09:00:00", end: "2027-04-11T21:00:00", timeZone: "America/Chicago" };
  const rally = { ...run, id: "rally", eventType: "stamp-rally", name: "Stamp Rally" };
  const global = { ...run, id: "g", scope: "global", name: "Global" };
  const later = Date.parse("2026-10-30T17:00:00Z"); // 1 AM Oct 31 in Taipei
  const review = buildLocalReview([run, museum, rally, global], { now: later });
  assert.deepEqual(review.events.map(row => row.name), ["Pokémon RUN 30 — Dream Mall"]);
  assert.deepEqual(review.events[0].coordinates.map(point => point.value), ["22.59500, 120.30694"]);
  assert.deepEqual(review.events[0].pokemon.map(row => row.name), ["Pikachu"], "no stand-in sprites");
  assert.match(review.events[0].ends, /^until Sun Nov 1, 11:59 PM local$/);
  const text = localReviewText(review);
  assert.match(text, /^\*\*Local events only · live now\*\*/);
  assert.match(text, /`22\.59500, 120\.30694`/);
  // 11:59 PM Nov 1 in Taipei (UTC+8) = 15:59 UTC Nov 1; Discord shows it in each reader's zone.
  const endUnix = Date.parse("2026-11-01T15:59:00Z") / 1000;
  assert.ok(text.includes(`until <t:${endUnix}:f> (<t:${endUnix}:R>)`));
  assert.match(text, /End times show in your own time zone/);
  assert.doesNotMatch(text + localReviewHtml(review), /\p{Extended_Pictographic}|leekduck\.com\/events/u);
  assert.equal(buildLocalReview([run], { now: Date.parse("2026-10-30T12:00:00Z") }), null, "nothing live, nothing posted");
});

test("copy codes: dex for normal forms, dex:form for forms, dex:form:costume for costumes", async () => {
  const { pokemonCode } = await import("../app/lib/daily-review.js");
  assert.equal(pokemonCode("Duskull"), "355");
  assert.equal(pokemonCode("Charmander"), "4");
  assert.equal(pokemonCode("Giratina (Origin)"), "487:91");
  assert.equal(pokemonCode("Unown M"), "201:13");
  assert.equal(pokemonCode("Piplup wearing a Halloween costume"), "393:0:49");
  assert.equal(pokemonCode("Mega Sableye"), "302");
  assert.equal(pokemonCode("Shadow Landorus (Incarnate)"), "645");
  assert.equal(pokemonCode("Nonexistentmon"), "");
});

test("webhook sender posts a text message with the PNG as a file", async () => {
  const { sendEventDigestWebhook } = await import("../app/lib/discord-webhook.js");
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ id: "123456789012345678" }), { status: 200 }); };
  try {
    const url = "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz";
    assert.equal(await sendEventDigestWebhook({ content: "", image: { name: "today.png", data: new Uint8Array([1, 2]) } }, url), true);
    assert.equal(await sendEventDigestWebhook({ content: "`355` Duskull" }, url), true);
  } finally { globalThis.fetch = original; }
  assert.ok(calls[0].init.body instanceof FormData);
  assert.equal(JSON.parse(calls[0].init.body.get("payload_json")).attachments[0].filename, "today.png");
  assert.equal(JSON.parse(calls[1].init.body).content, "`355` Duskull");
  assert.equal(JSON.parse(calls[1].init.body).embeds, undefined);
});

test("Week ahead and Season & GO Pass use the same picture-and-text style", async () => {
  const { buildEventListReview, eventListReviewText, eventListReviewHtml } = await import("../app/lib/daily-review.js");
  const cd = { id: "cd", scope: "global", eventType: "community-day", name: "Pokémon GO Community Day: Litwick", start: "2026-11-07T14:00:00.000", end: "2026-11-07T17:00:00.000", localTime: true,
    details: { spotlight: { name: "Litwick" } }, bonuses: ["3× catch Stardust"] };
  const run = { id: "run", scope: "venue", eventType: "local-event", name: "Pokémon RUN 30 — The Kallang", start: "2026-11-07T00:00:00.000", end: "2026-11-08T23:59:59.000", localTime: true, location: "The Kallang, Singapore" };
  const review = buildEventListReview([run, cd], "week", { windowStart: Date.parse("2026-11-02T05:00:00Z") });
  assert.equal(review.dateLabel, "Week of Nov 2");
  assert.deepEqual(review.events.map(row => [row.name, row.when]), [
    ["RUN 30 — The Kallang".replace(/^/, "Pokémon "), "Sat Nov 7 – Sun Nov 8"],
    ["Community Day: Litwick", "Sat Nov 7, 2 PM – 5 PM"]
  ]);
  const text = eventListReviewText(review);
  assert.match(text, /^\*\*Week ahead · Week of Nov 2\*\*/);
  assert.match(text, /`607` Litwick/);
  assert.match(text, /The Kallang, Singapore/);
  const html = eventListReviewHtml(review);
  assert.match(html, /<h1>Week ahead<\/h1>/);
  assert.doesNotMatch(text + html, /\p{Extended_Pictographic}/u);
  assert.equal(buildEventListReview([cd], "monthly", { windowStart: Date.parse("2026-11-01T05:00:00Z") }).dateLabel, "November 2026");
  assert.equal(eventListReviewText(buildEventListReview([], "week")), "", "nothing selected, nothing posted");
});

test("evening posts cover the next day: Friday's daily is Saturday's", async () => {
  const { reviewAheadDays, buildLocalReview, localReviewText } = await import("../app/lib/daily-review.js");
  const friday6pm = Date.parse("2026-10-30T22:05:00Z");
  assert.equal(reviewAheadDays(friday6pm), 1);
  assert.equal(reviewAheadDays(Date.parse("2026-10-30T12:05:00Z")), 0, "an 8 AM send still covers the same day");
  const review = buildDailyReview(events, { now: friday6pm, aheadDays: 1 });
  assert.equal(review.dateLabel, "Saturday, October 31");
  assert.equal(review.heading, "Saturday in Pokémon GO");
  assert.deepEqual(review.live.map(row => row.name), ["Chandelure Super Mega Raid Day", "Halloween 2026 Part I"]);
  assert.equal(review.live[0].status, "starts 2 PM");
  const text = dailyReviewText(review);
  assert.match(text, /^\*\*Saturday in Pokémon GO · Saturday, October 31\*\*\n\n\*\*Saturday\*\*/);
  assert.doesNotMatch(text, /\btoday\b|\btomorrow\b/i, "no relative day words in a post read the next day");
  const run = { id: "run", scope: "venue", eventType: "local-event", name: "Pokémon RUN 30 — Dream Mall", start: "2026-10-31T00:00:00.000", end: "2026-11-01T23:59:59.000",
    localTime: true, timeZone: "Asia/Taipei", location: "Dream Mall, Kaohsiung, Taiwan", coordinates: "22.59500, 120.30694" };
  const sunday = { ...run, id: "sun", name: "Sunday only", start: "2026-11-01T10:00:00.000", end: "2026-11-01T18:00:00.000" };
  const local = buildLocalReview([run, sunday], { now: Date.parse("2026-10-30T15:05:00Z"), aheadDays: 1 });
  assert.deepEqual(local.events.map(row => row.name), ["Pokémon RUN 30 — Dream Mall"]);
  assert.match(localReviewText(local), /^\*\*Local events only · Saturday, October 31\*\*/);
});

test("Week ahead leaves out stamp rallies, long partnerships and global events that neither start nor end that week", async () => {
  const { buildEventListReview } = await import("../app/lib/daily-review.js");
  const windowStart = Date.parse("2026-11-02T05:00:00Z");
  const g = (id, start, end, extra = {}) => ({ id, name: id, scope: "global", eventType: "event", start, end, localTime: true, ...extra });
  const names = buildEventListReview([
    g("starts", "2026-11-04T10:00:00.000", "2026-11-12T20:00:00.000"),
    g("ends", "2026-10-20T10:00:00.000", "2026-11-03T20:00:00.000"),
    g("spans", "2026-10-01T10:00:00.000", "2026-12-01T20:00:00.000"),
    g("museum", "2026-05-22T09:00:00", "2027-04-11T21:00:00", { scope: "venue", eventType: "local-partnership" }),
    g("rally", "2026-11-07T09:00:00", "2026-11-08T20:00:00", { scope: "citywide", eventType: "stamp-rally" }),
    g("run", "2026-11-07T00:00:00.000", "2026-11-08T23:59:59.000", { scope: "venue", eventType: "local-event" }),
    g("Pokémon GO × National Trust", "2026-11-03T10:00:00.000", "2026-11-04T10:00:00.000")
  ], "week", { windowStart }).events.map(row => [row.name, row.when]);
  assert.deepEqual(names, [["ends", "until Tue Nov 3, 8 PM"], ["Pokémon GO × National Trust", "Tue Nov 3, 10 AM – Wed Nov 4, 10 AM"], ["starts", "Wed Nov 4, 10 AM – Thu Nov 12, 8 PM"], ["run", "Sat Nov 7 – Sun Nov 8"]]);
});
