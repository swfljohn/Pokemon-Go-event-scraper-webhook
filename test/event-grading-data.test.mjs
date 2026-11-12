import test from "node:test";
import assert from "node:assert/strict";
import { attachRaidHourGradingEvidence, gradingEventView, publishGradingEvidence } from "../app/lib/event-grading-data.js";
import { rateEvent } from "../app/event-rating.js";

const empty = (id, name, start, end, eventType = "event") => ({
  id, name, start, end, eventType, bonuses: [], details: { spawns: [], raidBosses: [], shinies: [], maxBattleBosses: [] }
});

test("official source evidence enriches only exact event identities and is detached", () => {
  const event = empty("halloween-2026-part-1", "Pokémon GO Halloween 2026 Part I", "2026-10-27T10:00:00", "2026-11-01T10:00:00");
  event.link = "https://leekduck.com/events/halloween-2026-part-1/";
  event.ticketRequired = true;
  const before = structuredClone(event);
  const view = gradingEventView(event);
  assert.deepEqual(event, before);
  assert.notEqual(view, event);
  assert.ok(view.details.spawns.length);
  assert.ok(view.details.debutPokemon.length);
  assert.deepEqual(view.details.raidBosses.map(row => row.name), ["Pikachu wearing a hat and capelet", "Sinistea wearing a bow"]);
  assert.ok(view.details.shinies.some(row => row.name === "Zubat wearing a top hat"));
  assert.equal(view.ticketRequired, false);
  assert.equal(view.mainValueRequiresTicket, false);
  assert.ok(view.details.ratingEvidence.sources.includes("https://pokemongo.com/news/halloween-part-1-2026"));
  assert.equal(view.details.ratingEvidence.verifiedAt, "2026-10-26");
  assert.deepEqual(view.bonuses, ["2× catch Candy", "2× catch Stardust"]);
  assert.deepEqual(view.details.bonuses, view.bonuses, "the grader merges root and detail bonuses, so both rating inputs must be free-only");
  assert.ok(!view.details.bonuses.some(row => /3×|3x/.test(row)));
  assert.ok(view.details.paidBenefits.some(item => item.includes("3×")));
});

test("GO Pass bonus facts stay scoped to the matching free pass", () => {
  const octoberEvent = empty("go-pass-october-2026", "GO Pass: October", "2026-10-06T10:00:00.000", "2026-11-03T10:00:00.000", "go-pass");
  octoberEvent.link = "https://leekduck.com/events/go-pass-october-2026/";
  const novemberEvent = empty("go-pass-november-2026", "GO Pass: November", "2026-11-03T10:00:00.000", "2026-12-01T10:00:00.000", "go-pass");
  novemberEvent.link = "https://pokemongo.com/news/go-pass-november-2026";
  const october = gradingEventView(octoberEvent);
  const november = gradingEventView(novemberEvent);
  assert.ok(october.details.shinies.some(row => row.name === "Kyogre"));
  assert.ok(november.details.shinies.some(row => row.name === "Groudon"));
  assert.ok(october.bonuses.every(row => !/catch candy|catch stardust/i.test(row)));
  assert.ok(november.details.freeBenefits.some(row => row.includes("400 PokéCoins")));
  assert.equal(october.ticketRequired, false);
  assert.equal(october.mainValueRequiresTicket, false);
  assert.equal(october.ticketPrice, "US$7.99");
  assert.deepEqual(october.freeBenefits, october.details.freeBenefits);
});

test("Halloween Part II source fixture keeps Shiny Greavard, costumes, and free versus paid benefits distinct", () => {
  const event = empty("halloween-2026-part-2", "Pokémon GO Halloween 2026 Part II", "2026-11-01T10:00:00.000", "2026-11-05T20:00:00.000");
  event.link = "https://leekduck.com/events/halloween-2026-part-2/";
  const before = structuredClone(event);
  const view = gradingEventView(event);
  assert.deepEqual(event, before);
  assert.equal(view.details.debutPokemon[0].name, "Shiny Greavard");
  assert.equal(view.details.debutPokemon[0].target, "Greavard");
  assert.ok(view.details.shinies.some(row => row.name === "Greavard"));
  assert.ok(view.details.spawns.some(row => row.name === "Rowlet wearing a Halloween costume"));
  assert.deepEqual(view.details.raidBosses.map(row => row.name), ["Pikachu wearing a hat and capelet", "Sinistea wearing a bow"]);
  assert.deepEqual(view.bonuses, ["2× catch Candy", "2× catch Stardust"]);
  assert.ok(view.freeBenefits.some(row => row.includes("2× catch Candy")));
  assert.ok(view.paidBenefits.some(row => row.includes("3× catch Candy")));
  assert.ok(view.details.ratingEvidence.sources.includes("https://pokemongo.com/news/halloween-part-2-2026"));
});

test("monthly GO Pass source evidence clears stale rating-only debut rows", () => {
  const event = empty("go-pass-october-2026", "GO Pass: October", "2026-10-06T10:00:00.000", "2026-11-03T10:00:00.000", "go-pass");
  event.link = "https://leekduck.com/events/go-pass-october-2026/";
  event.details.debutPokemon = [{ name: "Stale unverified debut" }];
  const view = gradingEventView(event);
  assert.deepEqual(view.details.debutPokemon, []);
  assert.deepEqual(event.details.debutPokemon, [{ name: "Stale unverified debut" }]);
});

test("publication replaces forged or stale ratingOnly facts and is idempotent for canonical metadata", () => {
  const event = empty("go-pass-october-2026", "GO Pass: October", "2026-10-06T10:00:00.000", "2026-11-03T10:00:00.000", "go-pass");
  event.link = "https://leekduck.com/events/go-pass-october-2026/";
  event.details.debutPokemon = [{ name: "Stale debut" }];
  event.details.bonuses = ["3x catch Candy", "3x catch Stardust"];
  event.details.ratingEvidence = {
    factSet: event.id, verifiedAt: "2026-10-26",
    sources: ["https://pokemongo.com/news/go-pass-october-2026"],
    ratingOnly: { bonuses: ["3x catch Candy", "3x catch Stardust"], debutPokemon: [{ name: "Stale debut" }] }
  };
  const before = structuredClone(event);
  const published = publishGradingEvidence(event);
  assert.deepEqual(event, before);
  assert.deepEqual(published.details.ratingEvidence.ratingOnly.bonuses, ["Milestones add trade Candy", "Milestones add gifts", "2× Daily Adventure Incense duration", "Increased hatch XP and Stardust"]);
  assert.deepEqual(published.details.ratingEvidence.ratingOnly.debutPokemon, []);
  assert.equal(publishGradingEvidence(published), published);
  assert.deepEqual(gradingEventView(published).details.debutPokemon, []);
});

test("optional Chandelure ticket is disclosed without gating the main raid value", () => {
  const sourceEvent = empty("chandelure-super-mega-raid-day-2026", "Chandelure Super Mega Raid Day", "2026-10-31T14:00:00", "2026-10-31T17:00:00", "raid-day");
  sourceEvent.link = "https://leekduck.com/events/chandelure-super-mega-raid-day-2026/";
  const event = gradingEventView(sourceEvent);
  assert.equal(event.ticketPrice, "US$4.99");
  assert.equal(event.ticketRequired, false);
  assert.deepEqual(event.details.raidBosses, [{ name: "Mega Chandelure", tier: "Super Mega" }]);
  assert.ok(event.details.freeBenefits.some(row => /six free Raid Passes/.test(row)));
});

test("Halloween GO Pass has a separate exact source-backed rating fixture", () => {
  const event = empty("halloween-go-pass-2026", "Halloween GO Pass", "2026-10-27T10:00:00", "2026-11-05T20:00:00", "go-pass");
  event.link = "https://pokemongo.com/news/halloween-part-1-2026";
  const view = gradingEventView(event);
  assert.equal(view.details.ratingEvidence.factSet, event.id);
  assert.deepEqual(view.bonuses, ["2× catch Candy", "2× catch Stardust"]);
  assert.ok(view.paidBenefits.some(row => row.includes("3×")));
});

test("Dynamax Trails dates remain deliberately ungraded without rewards", () => {
  const event = empty("dynamax-trails-2026", "Dynamax Trails", "2026-11-16T10:00:00", "2026-11-23T20:00:00");
  const view = gradingEventView(event);
  assert.equal(view, event);
  assert.equal(rateEvent(view).grade, "—");
  assert.deepEqual(view.details.raidBosses, []);
  assert.equal(view.details.ratingEvidence, undefined);
});

test("wrong event slug, title, or dates cannot receive saved evidence", () => {
  const halloween = empty("halloween-2026-part-1", "Halloween Celebration", "2026-10-27T10:00:00", "2026-11-01T10:00:00");
  halloween.link = "https://leekduck.com/events/halloween-2026-part-1/";
  const noSource = empty("halloween-2026-part-1", "Pokémon GO Halloween 2026 Part I", "2026-10-27T10:00:00", "2026-11-01T10:00:00");
  const badSource = { ...noSource, link: "https://example.invalid/halloween-2026-part-1" };
  const badTime = { ...noSource, start: "2026-10-27T11:00:00", link: "https://pokemongo.com/news/halloween-part-1-2026" };
  const october = empty("go-pass-october-2026", "GO Pass: October", "2026-10-06T10:00:00.000", "2026-11-04T10:00:00.000", "go-pass");
  october.link = "https://leekduck.com/events/go-pass-october-2026/";
  assert.equal(gradingEventView(halloween), halloween);
  assert.equal(gradingEventView(noSource), noSource);
  assert.equal(gradingEventView(badSource), badSource);
  assert.equal(gradingEventView(badTime), badTime);
  assert.equal(gradingEventView(october), october);
});

test("Raid Hour inherits only a unique exact all-boss rotation with overlapping dates", () => {
  const origin = empty("giratina-origin-forme-in-5-star-raid-battles-october-2026", "Giratina (Origin Forme) in 5-star Raid Battles", "2026-10-28T06:00:00Z", "2026-11-03T22:00:00Z", "raid-battles");
  origin.scope = "global";
  origin.details.raidBosses = [{ name: "Giratina (Origin)" }];
  const originHour = empty("raidhour20261028", "Giratina (Origin Forme) Raid Hour", "2026-10-28T18:00:00Z", "2026-10-28T19:00:00Z", "raid-hour");
  originHour.scope = "global";
  const altered = empty("giratina-altered-forme-in-5-star-raid-battles-november-2026", "Giratina (Altered Forme) in 5-star Raid Battles", "2026-11-04T06:00:00Z", "2026-11-08T22:00:00Z", "raid-battles");
  altered.scope = "global";
  altered.details.raidBosses = [{ name: "Giratina (Altered)" }];
  const alteredHour = empty("raidhour20261104", "Giratina (Altered Forme) Raid Hour", "2026-11-04T18:00:00Z", "2026-11-04T19:00:00Z", "raid-hour");
  alteredHour.scope = "global";
  const cresselia = empty("cresselia-darkrai-in-5-star-raid-battles-november-2026", "Cresselia and Darkrai in 5-star Raid Battles", "2026-11-16T06:00:00Z", "2026-11-24T22:00:00Z", "raid-battles");
  cresselia.scope = "global";
  cresselia.details.raidBosses = [{ name: "Cresselia" }, { name: "Darkrai" }];
  cresselia.details.bonuses = ["2× catch XP"];
  cresselia.ticketRequired = true;
  cresselia.mainValueRequiresTicket = true;
  cresselia.ticketPrice = "US$4.99";
  cresselia.eventAccess = "regional";
  const doubleHour = empty("raidhour20261118", "Cresselia and Darkrai Raid Hour", "2026-11-18T18:00:00Z", "2026-11-18T19:00:00Z", "raid-hour");
  doubleHour.scope = "global";
  const events = [origin, originHour, altered, alteredHour, cresselia, doubleHour];
  const before = structuredClone(events);
  const views = attachRaidHourGradingEvidence(events);
  assert.deepEqual(events, before);
  assert.equal(views[1].details.ratingParentEvent.id, origin.id);
  assert.equal(views[3].details.ratingParentEvent.id, altered.id);
  assert.equal(views[5].details.ratingParentEvent.id, cresselia.id);
  assert.equal(views[5].details.ratingParentEvent.details.raidBosses.length, 2);
  assert.deepEqual(views[5].details.ratingParentEvent.details.bonuses, ["2× catch XP"]);
  assert.equal(views[5].details.ratingParentEvent.ticketRequired, true);
  assert.equal(views[5].details.ratingParentEvent.mainValueRequiresTicket, true);
  assert.equal(views[5].details.ratingParentEvent.ticketPrice, "US$4.99");
  assert.equal(views[5].details.ratingParentEvent.eventAccess, "regional");
  assert.ok(rateEvent(views[5]).reasons.some(reason => /Main event value requires a paid ticket \(US\$4\.99\)/.test(reason)));
});

test("Raid Hour refuses partial, out-of-window, malformed, and ambiguous matches", () => {
  const parent = empty("rotation", "Cresselia and Darkrai in 5-star Raid Battles", "2026-11-16T06:00:00Z", "2026-11-24T22:00:00Z", "raid-battles");
  parent.scope = "global";
  parent.details.raidBosses = [{ name: "Cresselia" }, { name: "Darkrai" }];
  const partial = empty("h", "Cresselia Raid Hour", "2026-11-18T18:00:00Z", "2026-11-18T19:00:00Z", "raid-hour");
  partial.scope = "global";
  const outOfWindow = empty("late", "Cresselia and Darkrai Raid Hour", "2026-11-24T22:00:00Z", "2026-11-24T23:00:00Z", "raid-hour");
  outOfWindow.scope = "global";
  const malformed = empty("bad", "Cresselia and Darkrai Raid Hour", "Nov 18", "Nov 18", "raid-hour");
  malformed.scope = "global";
  assert.equal(attachRaidHourGradingEvidence([parent, partial])[1].details.ratingParentEvent, undefined);
  assert.equal(attachRaidHourGradingEvidence([parent, outOfWindow])[1].details.ratingParentEvent, undefined);
  assert.equal(attachRaidHourGradingEvidence([parent, malformed])[1].details.ratingParentEvent, undefined);
  const second = { ...structuredClone(parent), id: "rotation-2" };
  const ambiguousHour = empty("all", "Cresselia and Darkrai Raid Hour", "2026-11-18T18:00:00Z", "2026-11-18T19:00:00Z", "raid-hour");
  ambiguousHour.scope = "global";
  assert.equal(attachRaidHourGradingEvidence([parent, second, ambiguousHour])[2].details.ratingParentEvent, undefined);
  const mixedBasisHour = { ...partial, start: "2026-11-18T18:00:00", end: "2026-11-18T19:00:00" };
  assert.equal(attachRaidHourGradingEvidence([parent, mixedBasisHour])[1].details.ratingParentEvent, undefined);
  const mixedScopeHour = { ...partial, scope: "regional" };
  assert.equal(attachRaidHourGradingEvidence([parent, mixedScopeHour])[1].details.ratingParentEvent, undefined);
});

test("Raid Hour expands grouped Deoxys Formes and rejects duplicate form names", () => {
  const parent = empty("deoxys", "Deoxys in 5-star Raid Battles", "2026-11-25T06:00:00.000", "2026-12-01T22:00:00.000", "raid-battles");
  parent.scope = "global";
  parent.details.raidBosses = ["Normal", "Defense", "Attack", "Speed"].map(form => ({ name: `Deoxys (${form})` }));
  const hour = empty("deoxys-hour", "Deoxys (Normal, Defense, Attack, and Speed Formes) Raid Hour", "2026-11-25T18:00:00.000", "2026-11-25T19:00:00.000", "raid-hour");
  hour.scope = "global";
  const view = attachRaidHourGradingEvidence([parent, hour])[1];
  assert.equal(view.details.ratingParentEvent.id, parent.id);
  assert.deepEqual(view.details.ratingParentEvent.details.raidBosses, parent.details.raidBosses);
  assert.equal(view.details.ratingParentEvent.details.raidBosses.length, 4);
  assert.equal(rateEvent(view).score, rateEvent(parent).score - 5);
  assert.ok(rateEvent(view).reasons.some(reason => /High-tier raid/.test(reason)));
  const ambiguous = { ...hour, name: "Deoxys (Normal, Defense, Attack, and Speed, Speed Formes) Raid Hour" };
  assert.equal(attachRaidHourGradingEvidence([parent, ambiguous])[1].details.ratingParentEvent, undefined);
  const partial = { ...hour, name: "Deoxys (Normal, Defense, and Attack Formes) Raid Hour" };
  assert.equal(attachRaidHourGradingEvidence([parent, partial])[1].details.ratingParentEvent, undefined);
  const secondParent = { ...parent, id: "deoxys-duplicate" };
  assert.equal(attachRaidHourGradingEvidence([parent, secondParent, hour])[2].details.ratingParentEvent, undefined);
});
