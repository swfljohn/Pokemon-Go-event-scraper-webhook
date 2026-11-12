import test from "node:test";
import assert from "node:assert/strict";
import { EVENT_RATING_VERSION, rateEvent } from "../app/event-rating.js";
import { normalizeEventSpawns } from "../app/lib/event-spawns.js";

test("published background, costume, shiny, and named reward become a top pick", () => {
  const rating = rateEvent({
    name: "Regional costume event",
    specialBackground: true,
    costumePokemon: true,
    details: {
      backgroundPokemon: [{ name: "Costume Pikachu" }],
      shinies: [{ name: "Costume Pikachu" }],
      spawns: [{ name: "Costume Pikachu" }]
    }
  });
  assert.equal(rating.grade, "A");
  assert.equal(rating.provisional, false);
  assert.ok(rating.reasons.some(reason => reason.includes("background")));
});

test("post-event wild costume does not inherit a separate event background", () => {
  const rating = rateEvent({
    name: "Costume Pikachu post-event wild",
    costumePokemon: true,
    specialBackground: false,
    details: { spawns: [{ name: "Costume Pikachu" }] }
  });
  assert.equal(rating.grade, "D");
  assert.ok(!rating.reasons.some(reason => reason.includes("background")));
});

test("a trade discount does not count as extra Stardust", () => {
  const rating = rateEvent({ bonuses: ["Trades require 50% less Stardust"] });
  assert.equal(rating.score, 15);
  assert.ok(!rating.reasons.some(reason => reason.includes("Stardust bonus")));
});

test("published Shiny debuts and Incense-exclusive Shiny forms earn rarity points without sold listings", () => {
  const base = { name: "Local event", details: {
    spawns: [{ name: "Applin" }], shinies: [{ name: "Applin" }, { name: "Unown N" }]
  } };
  const ordinary = rateEvent(base);
  const rare = rateEvent({ ...base, details: {
    ...base.details,
    debutPokemon: [{ name: "Shiny Applin", target: "Applin" }],
    incenseExclusivePokemon: [{ name: "Unown N" }]
  } });
  assert.equal(rare.score - ordinary.score, 52);
  assert.ok(rare.reasons.some(reason => /event Incense/.test(reason)));
  assert.ok(rare.reasons.some(reason => /First Shiny release/.test(reason)));
});

test("published community bonuses, shiny, and encounters outrank a sparse pass", () => {
  const community = rateEvent({
    name: "Zorua Community Day",
    eventType: "community-day",
    bonuses: ["3x Catch XP", "2x Catch Candy", "Increased Spawns"],
    details: {
      spawns: [{ name: "Zorua" }],
      shinies: [{ name: "Zorua" }],
      research: [{ name: "Field Research" }]
    }
  });
  const sparse = rateEvent({ name: "GO Pass: October", eventType: "go-pass" });
  assert.equal(community.grade, "A");
  assert.equal(sparse.grade, "—");
  assert.equal(sparse.provisional, true);
  assert.ok(community.score > sparse.score);
});

test("high-tier shiny raid scores above an unconfirmed Raid Hour", () => {
  const raid = rateEvent({
    name: "Xerneas in 5-star Raid Battles",
    details: { raidBosses: [{ name: "Xerneas" }], shinies: [{ name: "Xerneas" }] }
  });
  const hour = rateEvent({ name: "Xerneas Raid Hour", eventType: "raid-hour" });
  assert.equal(raid.grade, "A");
  assert.equal(hour.grade, "—");
  assert.equal(hour.provisional, true);
  assert.ok(raid.reasons.some(reason => reason.includes("raid attackers")));
  assert.ok(!hour.reasons.some(reason => reason.includes("raid attackers")));
});

test("battle names without a published boss do not create raid rarity", () => {
  const league = rateEvent({ name: "Master League: Mega Edition", eventType: "go-battle-league" });
  const unannounced = rateEvent({ name: "Super Mega Raid Day", eventType: "raid-day" });
  const mega = rateEvent({ name: "Mega Victreebel in Mega Raids", eventType: "mega-raids",
    details: { raidBosses: [{ name: "Mega Victreebel" }] } });
  assert.equal(league.grade, "");
  assert.equal(league.excluded, true);
  assert.equal(unannounced.grade, "—");
  assert.ok(!league.reasons.some(reason => reason.includes("Mega encounter")));
  assert.ok(!unannounced.reasons.some(reason => reason.includes("Mega encounter")));
  assert.ok(mega.reasons.some(reason => reason.includes("Mega encounter")));
});

test("published evolution carries PvP relevance into its event grade", () => {
  const clefairy = rateEvent({ name: "Clefairy spawns", details: { spawns: [{ name: "Clefairy" }] } });
  const unknown = rateEvent({ name: "Unknown spawns", details: { spawns: [{ name: "Unknownmon" }] } });
  assert.ok(clefairy.score > unknown.score);
  assert.ok(clefairy.reasons.some(reason => reason.includes("Clefairy → Clefable") && reason.includes("PvP")));
  assert.match(clefairy.metaAsOf, /^\d{4}-\d{2}-\d{2}$/);
});

test("structured field research rewards count as research and meta evidence once", () => {
  const base = { name: "Field research event", details: { researchMethods: [{ type: "field", rewardSpecies: ["Beldum"] }] } };
  const rating = rateEvent(base);
  const duplicate = rateEvent({ ...base, details: { researchMethods: [
    ...base.details.researchMethods,
    { type: "field", rewardSpecies: ["Beldum", "Beldum"] }
  ] } });
  assert.equal(rating.version, EVENT_RATING_VERSION);
  assert.equal(rating.grade, "B");
  assert.equal(rating.score, 56);
  assert.ok(rating.reasons.some(reason => reason.includes("Research rewards")));
  assert.ok(rating.reasons.some(reason => reason.includes("Beldum → Metagross") && reason.includes("PvP")));
  assert.equal(duplicate.score, rating.score);
});

test("structured rewards accept nonempty names and ignore whitespace names", () => {
  const stringName = rateEvent({ details: { researchMethods: [{ rewardSpecies: [" Beldum "] }] } });
  const objectName = rateEvent({ details: { researchMethods: [{ rewardSpecies: [{ name: " Beldum " }] }] } });
  const invalid = rateEvent({ details: { researchMethods: [{ rewardSpecies: ["   ", {}, { name: "   " }] }] } });

  assert.equal(stringName.score, 56);
  assert.equal(objectName.score, 56);
  assert.equal(invalid.score, 15);
  assert.equal(invalid.provisional, true);
  assert.ok(!invalid.reasons.some(reason => reason.includes("Research rewards")));
  assert.ok(!invalid.reasons.some(reason => reason.includes("Beldum → Metagross")));
});

test("empty structured reward values do not count as published research", () => {
  const rating = rateEvent({ details: { researchMethods: [{ type: "field", rewardSpecies: [null, "", "   ", {}, { name: " " }] }] } });
  assert.equal(rating.score, 15);
  assert.equal(rating.provisional, true);
  assert.ok(!rating.reasons.some(reason => reason.includes("Research rewards")));
});

test("unpublished species does not acquire meta points from an event name", () => {
  const event = rateEvent({ name: "Xerneas Raid Hour", eventType: "raid-hour" });
  assert.equal(event.grade, "—");
  assert.ok(!event.reasons.some(reason => reason.includes("raid attackers") || reason.includes("PvP")));
});

test("normalized public calendar events carry automatic grades", () => {
  const result = normalizeEventSpawns([], Date.parse("2026-09-29T12:00:00Z"));
  assert.ok(result.calendarEvents.length > 0);
  assert.ok(result.calendarEvents.every(event => event.rating?.version === EVENT_RATING_VERSION && /^(?:[ABCDF]|—|Local only|)$/.test(event.rating.grade)));
});

test("missing substantive details remain ungraded instead of receiving F", () => {
  for (const event of [{}, { hasSpawns: true }, { name: "Raid Day" }]) {
    const rating = rateEvent(event);
    assert.equal(rating.grade, "—");
    assert.equal(rating.label, "Not graded yet — details pending");
    assert.equal(rating.provisional, true);
  }
});

test("league wrappers are excluded and local event kinds are local only", () => {
  assert.equal(rateEvent({ eventType: "go-battle-league" }).excluded, true);
  const local = rateEvent({ eventType: "stamp-rally", details: { spawns: [{ name: "Eevee" }] } });
  assert.equal(local.grade, "Local only");
  assert.equal(local.eventAccess, "in-person-local");
});

test("ticket gated main value carries a price reason and paid benefits stay separate", () => {
  const rating = rateEvent({ mainValueRequiresTicket: true, ticketPrice: "$4.99", details: {
    spawns: [{ name: "Eevee" }], freeBenefits: ["Free research"], paidBenefits: ["Bonus XP"]
  } });
  assert.ok(rating.reasons.some(reason => reason.includes("$4.99")));
  assert.deepEqual(rating.freePaidBreakdown, { free: ["Free research"], paid: ["Bonus XP"] });
});

test("raid ending penalty needs explicit time and avoids debut or boosted shiny events", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  const base = { name: "Xerneas Raid Battles", end: "2026-10-27T00:00:00Z", details: { raidBosses: [{ name: "Xerneas" }] } };
  const ordinary = rateEvent(base, now);
  const debut = rateEvent({ ...base, details: { ...base.details, debutPokemon: [{ name: "Xerneas" }] } }, now);
  const notEnding = rateEvent({ ...base, end: "2026-10-29T00:00:00Z" }, now);
  assert.equal(notEnding.score - ordinary.score, 8);
  assert.ok(debut.score > ordinary.score);
  const floating = rateEvent({ ...base, end: "2026-10-27T00:00:00", timeZone: "" }, now);
  assert.equal(floating.timezoneUncertain, true);
});

test("grading projection does not mutate event planning targets or count paid bonuses", () => {
  const event = { name: "Test", bonuses: ["1.5x XP"], details: {
    spawns: [{ name: "Eevee" }], plannerTargets: [{ name: "Mewtwo" }]
  } };
  const before = structuredClone(event);
  const baseline = rateEvent({ ...event, bonuses: [] });
  const paidOnly = rateEvent({ ...event, bonuses: [], details: { ...event.details, paidBenefits: ["3x Catch XP"] } });
  assert.deepEqual(event, before);
  assert.equal(baseline.score, paidOnly.score);
});

test("Mega species debut bonus excludes Super Max unlocks", () => {
  const debut = rateEvent({ name: "Mega Chandelure Raid Day", summary: "Mega-evolved Chandelure debuts", details: { raidBosses: [{ name: "Mega Chandelure" }] } });
  const unlock = rateEvent({ name: "Mega Sableye Super Max", summary: "Mega Sableye gains Super Max capability", details: { raidBosses: [{ name: "Mega Sableye" }] } });
  assert.ok(debut.reasons.includes("New Mega species debut published"));
  assert.ok(!unlock.reasons.includes("New Mega species debut published"));
});

test("access classification honors explicit scope and keeps global Wild Area global", () => {
  const local = rateEvent({ eventType: "local-event", details: { spawns: [{ name: "Eevee" }] } });
  const venue = rateEvent({ scope: "venue", details: { spawns: [{ name: "Eevee" }] } });
  const rich = { specialBackground: true, costumePokemon: true, details: { backgroundPokemon: [{ name: "Pikachu" }], shinies: [{ name: "Pikachu" }], spawns: [{ name: "Pikachu" }] } };
  const regional = rateEvent({ ...rich, eventAccess: "regional" });
  const global = rateEvent({ name: "Pokémon GO Wild Area", eventType: "wild-area", details: { spawns: [{ name: "Eevee" }] } });
  const sendaiBase = { eventType: "wild-area", scope: "regional", location: "Miyagi Prefecture, Japan", details: { spawns: [{ name: "Eevee" }] } };
  const sendai = rateEvent({ ...sendaiBase, name: "Pokémon GO Wild Area 2026: Sendai • Tohoku" });
  const sendaiNoSubtitle = rateEvent({ ...sendaiBase, name: "Pokémon GO Wild Area 2026: Sendai" });
  const mexicoCity = rateEvent({ ...sendaiBase, name: "Pokémon GO Wild Area 2026: Mexico City" });
  const globalWildArea = rateEvent({ ...sendaiBase, scope: "global", location: "Global", name: "Pokémon GO Wild Area 2026: Global" });
  const ordinaryRegional = rateEvent({ name: "Regional event", eventType: "event", scope: "regional", location: "Japan", details: { spawns: [{ name: "Eevee" }] } });
  const indiaRegional = rateEvent({ name: "Pokémon GO Wild Area: India", eventType: "event", scope: "regional", location: "India", details: { spawns: [{ name: "Eevee" }] } });
  const esa = rateEvent({ name: "ESA", details: { spawns: [{ name: "Eevee" }] } });
  const notEsa = rateEvent({ name: "Research bonus", summary: "Separate reward data", details: { spawns: [{ name: "Eevee" }] } });
  assert.equal(local.eventAccess, "in-person-local");
  assert.equal(venue.grade, "Local only");
  assert.equal(regional.eventAccess, "regional");
  assert.equal(regional.grade, "B");
  assert.equal(global.eventAccess, "global");
  assert.equal(sendai.eventAccess, "in-person-local");
  assert.equal(sendai.grade, "Local only");
  assert.equal(sendaiNoSubtitle.eventAccess, "in-person-local");
  assert.equal(mexicoCity.eventAccess, "in-person-local");
  assert.equal(globalWildArea.eventAccess, "global");
  assert.equal(ordinaryRegional.eventAccess, "regional");
  assert.notEqual(ordinaryRegional.grade, "A");
  assert.equal(indiaRegional.eventAccess, "regional");
  assert.equal(esa.eventAccess, "in-person-local");
  assert.notEqual(notEsa.eventAccess, "in-person-local");
});

test("season and populated GBL wrappers are excluded", () => {
  for (const event of [
    { name: "GO Battle League: Season 26", eventType: "season", details: { spawns: [{ name: "Eevee" }], bonuses: ["3x XP"] } },
    { name: "GO Battle League: Mega Edition", eventType: "go-battle-league", details: { raidBosses: [{ name: "Mewtwo" }], shinies: [{ name: "Mewtwo" }] } }
  ]) {
    const rating = rateEvent(event);
    assert.equal(rating.grade, "");
    assert.equal(rating.excluded, true);
  }
});

test("only non-RaidHour parents are inherited, with child access caps and one ending penalty", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  const parent = { name: "Xerneas in 5-star Raid Battles", eventType: "raid-day", end: "2026-10-27T12:00:00Z", details: { raidBosses: [{ name: "Xerneas" }] } };
  const child = { name: "Xerneas Raid Hour", eventType: "raid-hour", end: "2026-10-27T12:00:00Z", details: { ratingParentEvent: parent } };
  const inherited = rateEvent(child, now);
  assert.ok(inherited.reasons.includes("Raid Hour inherits its published parent rotation (−5 points)"));
  assert.ok(inherited.reasons.includes("Raid ending within 36 hours (−8 points)"));
  assert.equal(inherited.reasons.filter(reason => reason.includes("ending within 36 hours")).length, 1);
  const regional = rateEvent({ ...child, eventAccess: "regional" }, now);
  assert.notEqual(regional.grade, "A");
  const local = rateEvent({ ...child, eventType: "local-event", details: child.details }, now);
  assert.equal(local.grade, "Local only");
  const hourParent = { ...parent, eventType: "raid-hour" };
  const noHourInheritance = rateEvent({ ...child, details: { ratingParentEvent: hourParent } }, now);
  assert.ok(!noHourInheritance.reasons.some(reason => reason.includes("inherits its published parent")));
});

test("floating invalid and DST-gap end times are uncertain and never trigger a penalty", () => {
  const now = Date.parse("2026-03-08T06:00:00Z");
  const base = { name: "Xerneas Raid Battles", details: { raidBosses: [{ name: "Xerneas" }] } };
  const gap = rateEvent({ ...base, end: "2026-03-08T02:30:00", timeZone: "America/New_York" }, now);
  const impossible = rateEvent({ ...base, end: "2026-02-31T12:00:00", timeZone: "UTC" }, now);
  assert.equal(gap.timezoneUncertain, true);
  assert.equal(impossible.timezoneUncertain, true);
  assert.equal(gap.endingSoonPenalty, false);
  assert.ok(!gap.reasons.some(reason => reason.includes("ending within 36 hours")));
});

test("live season wrapper, null inputs, and empty rows remain safe and ungraded", () => {
  const season = rateEvent({ id: "season-24-twilight-trails", name: "Twilight Trails", eventType: "season", heading: "Season", scope: "global", details: { spawns: [{ name: "Eevee" }], bonuses: ["3x XP"] } });
  assert.equal(season.excluded, true);
  assert.equal(season.grade, "");
  assert.equal(rateEvent(null).grade, "—");
  for (const event of [{ details: { spawns: [null, {}, "   "] } }, { details: { shinies: [{}], research: [null] } }]) {
    assert.equal(rateEvent(event).grade, "—");
  }
});

test("details bonuses count as free evidence and are deduplicated with root bonuses", () => {
  const rootOnly = rateEvent({ bonuses: ["2x Catch XP"] });
  const detailOnly = rateEvent({ details: { bonuses: ["2x Catch XP"] } });
  const both = rateEvent({ bonuses: ["2x Catch XP"], details: { bonuses: ["2x Catch XP"] } });
  assert.equal(detailOnly.score, rootOnly.score);
  assert.equal(both.score, rootOnly.score);
});

test("Mega debut bonus requires raid-day context and supports structured debut with Super Max copy", () => {
  const ordinary = rateEvent({ name: "Mega Chandelure appears", summary: "Mega Chandelure debuts", details: { raidBosses: [{ name: "Mega Chandelure" }] } });
  const realDebut = rateEvent({ name: "Mega Chandelure Raid Day", summary: "Mega Chandelure gains Super Max capability", details: {
    raidBosses: [{ name: "Mega Chandelure" }], debutPokemon: [{ name: "Mega Chandelure" }]
  } });
  assert.ok(!ordinary.reasons.includes("New Mega species debut published"));
  assert.ok(realDebut.reasons.includes("New Mega species debut published"));
});

test("regional A cap label describes the displayed B grade and optional ticket price remains visible", () => {
  const rich = { eventAccess: "regional", specialBackground: true, costumePokemon: true, details: {
    backgroundPokemon: [{ name: "Pikachu" }], shinies: [{ name: "Pikachu" }], spawns: [{ name: "Pikachu" }]
  } };
  const capped = rateEvent(rich);
  const optional = rateEvent({ ticketPrice: "$4.99", details: { spawns: [{ name: "Eevee" }], paidBenefits: ["Bonus XP"] } });
  assert.equal(capped.grade, "B");
  assert.equal(capped.label, "Worth planning");
  assert.ok(optional.reasons.some(reason => reason.includes("$4.99")));
  assert.equal(optional.score, rateEvent({ details: { spawns: [{ name: "Eevee" }] } }).score);
});

test("paid bonus objects do not enter free score and explicit optional status overrides stale ticketRequired", () => {
  const free = rateEvent({ details: { spawns: [{ name: "Eevee" }] } });
  const paidRoot = rateEvent({ bonuses: [{ text: "3x Catch XP", paid: true }], details: { spawns: [{ name: "Eevee" }] } });
  const paidDetails = rateEvent({ details: { spawns: [{ name: "Eevee" }], bonuses: [{ text: "3x Catch XP", paid: true }] } });
  const optional = rateEvent({ ticketRequired: true, mainValueRequiresTicket: false, ticketPrice: "$4.99", details: { spawns: [{ name: "Eevee" }] } });
  assert.equal(paidRoot.score, free.score);
  assert.equal(paidDetails.score, free.score);
  assert.equal(optional.score, free.score);
  assert.ok(optional.reasons.some(reason => reason.includes("$4.99")));
  assert.ok(!optional.reasons.some(reason => reason.includes("requires a paid ticket")));
});

test("regional Raid Hour inheritance keeps the capped grade label in sync", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  const parent = { name: "Xerneas in 5-star Raid Battles", eventType: "raid-day", details: {
    specialBackground: true, backgroundPokemon: [{ name: "Xerneas" }], costumePokemon: true,
    shinies: [{ name: "Xerneas" }], spawns: [{ name: "Xerneas" }], raidBosses: [{ name: "Xerneas" }]
  } };
  const inherited = rateEvent({ name: "Xerneas Raid Hour", eventType: "raid-hour", eventAccess: "regional", details: { ratingParentEvent: parent } }, now);
  assert.equal(inherited.grade, "B");
  assert.equal(inherited.label, "Worth planning");
});
