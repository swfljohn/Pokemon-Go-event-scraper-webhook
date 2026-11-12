import test from "node:test";
import assert from "node:assert/strict";
import {
  automaticDeliveryLedgerKey,
  automaticDigestKinds,
  automaticDigestRuns,
  eventsForLocalStartingSoon,
  eventCoordinateLinks,
  eventDigestBatches,
  eventDigestEmbed,
  eventDigestMessages,
  eventAvailabilityGuideEmbed,
  availabilityGuideMessages,
  preorderGuideMessages,
  preorderDestinationSentKey,
  eventsForPreorderGuide,
  EVENT_PREORDER_LEAD_MS,
  settingsForWebhookDestination,
  eventDigestWindow,
  eventsForDigest,
  eventTimeLines,
  localEventsForDigest,
  startingSoonEventSentKey
} from "../app/lib/event-notifications.js";
import { featuredEventDetails } from "../app/lib/featured-event-details.js";
import { curatedLocalEvents } from "../app/lib/local-events.js";

test("regional Clefairy availability and preorder cards name the five-minute local bursts", () => {
  const event = curatedLocalEvents(Date.parse("2026-09-22T00:00:00Z"))
    .find(row => row.id === "local-dancing-in-the-moonlight-2026");
  const guide = eventAvailabilityGuideEmbed(event, 0, 1, { viewerTimeZone: "America/New_York" });
  const preorder = preorderGuideMessages([event], { timeZone: "America/New_York" })[0][1];
  for (const embed of [guide, preorder]) {
    assert.match(embed.description, /Sep 23.*Sep 28/);
    assert.match(embed.description, /Clefairy windows: 12:00 PM, 1:00 PM, 7:00 PM, and 8:00 PM local time · 5 minutes each day/);
  }
});

test("digest windows use Eastern calendar days, next-week snapshots, and weekends", () => {
  const sunday = Date.parse("2026-08-16T12:05:00.000Z");
  const weekend = eventDigestWindow("weekend", sunday);
  const week = eventDigestWindow("week", sunday);
  assert.equal(new Date(weekend.startAt).toISOString(), "2026-08-14T04:00:00.000Z");
  assert.equal(new Date(weekend.endAt).toISOString(), "2026-08-17T04:00:00.000Z");
  assert.equal(new Date(week.startAt).toISOString(), "2026-08-17T04:00:00.000Z");
  assert.equal(new Date(week.endAt).toISOString(), "2026-08-24T04:00:00.000Z");
  const monthly = eventDigestWindow("monthly", sunday);
  assert.equal(monthly.localDate, "2026-08-16");
  assert.equal(new Date(monthly.startAt).toISOString(), "2026-08-17T04:00:00.000Z");
  assert.equal(new Date(monthly.endAt).toISOString(), "2026-08-18T04:00:00.000Z");
});

test("Discord DM digests reuse event embeds without webhook-only wording", () => {
  const now = Date.parse("2026-08-30T12:00:00.000Z");
  const messages = eventDigestMessages([{
    id: "community-day",
    name: "Community Day",
    eventType: "community-day",
    scope: "global",
    start: "2026-08-30T14:00:00.000Z",
    end: "2026-08-30T17:00:00.000Z"
  }], "today", {
    timeZone: "America/New_York"
  }, { type: "discord-dm", coordinateLinks: [] }, now);
  assert.equal(messages.length, 1);
  assert.match(messages[0][0].description, /saved event alert preferences/i);
  assert.doesNotMatch(messages[0][0].description, /this webhook/i);
  assert.equal(messages[0][1].title, "Community Day");
});

test("availability guide groups event Pokémon by how they are obtained", () => {
  const embed = eventAvailabilityGuideEmbed({
    id: "sample-event",
    name: "Sample Event",
    scope: "global",
    start: "2026-09-18T10:00:00.000Z",
    end: "2026-09-19T10:00:00.000Z",
    specialBackground: true,
    details: {
      raidBosses: [{ name: "Hamdok Pikachu" }, { name: "Charizard" }],
      research: [{ name: "Event Research", tasks: [{ text: "Catch 10 Pokémon", reward: "Pikachu encounter" }] }],
      sections: [{ title: "5 km Eggs", items: ["Riolu", "Togepi"] }],
      spawns: [{ name: "Pichu" }],
      shinies: [{ name: "Hamdok Pikachu" }],
      backgroundPokemon: [{ name: "Hamdok Pikachu", source: "Raids" }]
    }
  }, 0, 1, { viewerTimeZone: "America/New_York" });
  assert.match(embed.title, /Sample Event/);
  assert.match(embed.fields.find(field => /^⚔️ Raids/.test(field.name))?.value || "", /Hamdok Pikachu/);
  assert.match(embed.fields.find(field => /^🔎 Research/.test(field.name))?.value || "", /Catch 10 Pokémon.*Pikachu encounter/);
  assert.match(embed.fields.find(field => /^🥚 Hatches/.test(field.name))?.value || "", /Riolu/);
  assert.match(embed.fields.find(field => /^🐾 Wild/.test(field.name))?.value || "", /Pichu/);
  assert.ok((embed.fields.find(field => /^⚔️ Raids/.test(field.name))?.value || "")
    .includes("Hamdok Pikachu\\*\\*"));
  assert.equal(availabilityGuideMessages([{
    name: "Sample Event", start: "2026-09-18T10:00:00.000Z", end: "2026-09-19T10:00:00.000Z", scope: "global"
  }], { timeZone: "America/New_York" }, { coordinateLinks: [] }).length, 1);
});

test("preorder guide selects upcoming events within five days and uses a compact heading", () => {
  const now = Date.parse("2026-09-18T12:00:00.000Z");
  const events = eventsForPreorderGuide([
    {
      id: "autumn-picnic",
      name: "Autumn Picnic",
      eventType: "community",
      scope: "global",
      start: "2026-09-23T12:00:00.000Z",
      end: "2026-09-24T12:00:00.000Z",
      details: { raidBosses: [{ name: "Hamdok Pikachu" }] }
    },
    {
      id: "too-far",
      name: "Too Far Away",
      eventType: "community",
      scope: "global",
      start: "2026-09-24T12:01:00.000Z",
      end: "2026-09-25T12:00:00.000Z"
    },
    {
      id: "league",
      name: "GO Battle League",
      eventType: "go-battle-league",
      scope: "global",
      start: "2026-09-20T12:00:00.000Z",
      end: "2026-09-21T12:00:00.000Z"
    },
    {
      id: "city-safari-boston",
      name: "Pokémon GO City Safari: Boston",
      eventType: "city-safari",
      scope: "global",
      start: "2026-09-22T12:00:00.000Z",
      end: "2026-09-23T12:00:00.000Z"
    }
  ], now, { scopes: { global: true, local: false }, categories: ["community", "other"] });
  assert.equal(EVENT_PREORDER_LEAD_MS, 5 * 24 * 60 * 60 * 1_000);
  assert.deepEqual(events.map(event => event.id), ["autumn-picnic"]);
  const messages = preorderGuideMessages(events, { timeZone: "America/New_York" }, { coordinateLinks: [] }, now);
  assert.equal(messages.length, 1);
  assert.equal(messages[0][0].title, "Preorder Availability");
  assert.equal(messages[0][0].description, "**1 upcoming event**");
  assert.equal(messages[0][1].description.startsWith("**Dates available**"), true);
  assert.doesNotMatch(JSON.stringify(messages[0][1]), /Preorder window|sales availability|Bonuses|Example Events|example\.com/i);
});

test("preorder destination checkpoint treats timezone windows as one event and cards can share one message", () => {
  const url = "https://discord.com/api/webhooks/123456789012345678/delivery-checkpoint-token";
  const event = { id: "one", name: "Preview Raid Hour", scope: "global", start: "2026-09-24T18:00:00.000Z", end: "2026-09-24T19:00:00.000Z" };
  assert.equal(preorderDestinationSentKey(url, event), preorderDestinationSentKey(url, { ...event, start: "2026-09-25T18:05:00.000Z" }));
  assert.notEqual(preorderDestinationSentKey(url, event), preorderDestinationSentKey(url, { ...event, id: "another-event" }));
  const messages = preorderGuideMessages([event, { ...event, id: "two", name: "Preview Max Monday" }], { timeZone: "America/New_York" });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].length, 3);
});

test("preorder embeds contain only dates, availability groups, the event image, and a bottom background marker", () => {
  const now = Date.parse("2026-09-18T12:00:00.000Z");
  const messages = preorderGuideMessages([{
    id: "compact-preorder-event",
    name: "Compact Preorder Event",
    eventType: "community",
    scope: "global",
    start: "2026-09-23T12:00:00.000Z",
    end: "2026-09-24T12:00:00.000Z",
    imageUrl: "https://cdn.leekduck.com/assets/img/events/water-festival-2026.jpg",
    specialBackground: true,
    species: ["Raid Boss"],
    bonuses: ["2× Stardust"],
    details: {
      raidBosses: [{ name: "Raid Boss" }, { name: "Second Raid Boss" }],
      spawns: [{ name: "Wild Pokémon" }],
      hatches: [{ name: "Hatch Pokémon" }],
      research: [{ name: "Research task", tasks: [{ text: "Catch 10 Pokémon", reward: "Research reward" }] }]
    }
  }], { timeZone: "America/New_York" }, { coordinateLinks: [] }, now);
  const embed = messages[0][1];
  assert.equal(embed.title, "Compact Preorder Event");
  assert.match(embed.description, /^\*\*Dates available\*\*/);
  assert.doesNotMatch(embed.description, /Global event|Location-specific event|Preorder window|Example Events/i);
  assert.equal(embed.image?.url, "https://cdn.leekduck.com/assets/img/events/water-festival-2026.jpg");
  assert.deepEqual(embed.fields.map(field => field.name), [
    "Raids",
    "Wild",
    "Hatch",
    "Research",
    "Background eligible\\*\\*"
  ]);
  assert.ok((embed.fields.find(field => field.name === "Raids")?.value || "")
    .includes("- Raid Boss\\*\\*"));
  assert.match(embed.fields.find(field => field.name === "Wild")?.value || "", /- Wild Pokémon/);
  assert.match(embed.fields.find(field => field.name === "Hatch")?.value || "", /- Hatch Pokémon/);
  assert.match(embed.fields.find(field => field.name === "Research")?.value || "", /Catch 10 Pokémon.*Research reward/);
  assert.equal(embed.fields.at(-1).name, "Background eligible\\*\\*");
  assert.equal(embed.fields.at(-1).value, "\u200b");
  assert.doesNotMatch(JSON.stringify(embed), /2× Stardust|bonus|sales availability|Open full details|example\.com/i);
});

test("raid-only species stay in Raids and never appear in Wild", () => {
  const now = Date.parse("2026-09-18T12:00:00.000Z");
  const messages = preorderGuideMessages([{
    id: "regional-raid-rotation",
    name: "Regional Ultra Beasts in 5-star Raid Battles",
    eventType: "raid-battles",
    scope: "global",
    start: "2026-09-23T10:00:00.000Z",
    end: "2026-09-29T22:00:00.000Z",
    species: ["Buzzwole", "Pheromosa", "Xurkitree"],
    details: {
      raidBosses: ["Buzzwole", "Pheromosa", "Xurkitree"],
      shinies: ["Buzzwole", "Pheromosa", "Xurkitree"]
    }
  }], { timeZone: "America/New_York" }, { coordinateLinks: [] }, now);
  const embed = messages[0][1];
  assert.deepEqual(embed.fields.map(field => field.name), ["Raids"]);
  assert.match(embed.fields[0].value, /Buzzwole/);
  assert.doesNotMatch(JSON.stringify(embed), /Wild/);
});

test("preorder cards do not copy mixed raid and research prose into the raid list", () => {
  const now = Date.parse("2026-09-19T12:00:00.000Z");
  const messages = preorderGuideMessages([{
    id: "local-korea-outing-2026",
    name: "Pikachu’s Korea Outing 2026",
    eventType: "regional-event",
    scope: "regional",
    start: "2026-09-24T01:00:00.000Z",
    end: "2026-09-26T11:00:00.000Z",
    species: ["Pikachu (Orange Hanbok)"],
    details: {
      raidBosses: [{ name: "Pikachu (Orange Hanbok)" }],
      sections: [{
        title: "Raids and research",
        items: [
          "Orange Hanbok Pikachu appears in one-star raids nationwide.",
          "Free Timed Research includes 4,500 XP, 5,500 Stardust, a Premium Battle Pass and a costume encounter.",
          "The research claim deadline is October 11, 20:00 KST."
        ]
      }]
    }
  }], { timeZone: "America/New_York" }, { coordinateLinks: [] }, now);
  const embed = messages[0][1];
  assert.deepEqual(embed.fields.map(field => field.name), ["Raids"]);
  assert.deepEqual(embed.fields[0].value, "- Pikachu (Orange Hanbok)");
  assert.doesNotMatch(JSON.stringify(embed), /one-star raids nationwide|Timed Research|deadline/i);
});

test("preorder cards identify the background Pokémon and keep Korea Pikachu in research", () => {
  const now = Date.parse("2026-09-19T12:00:00.000Z");
  const messages = preorderGuideMessages([{
    id: "dancing-in-the-moonlight",
    name: "Dancing in the Moonlight 2026 — Clefairy",
    eventType: "regional-event",
    scope: "regional",
    start: "2026-09-23T10:00:00.000Z",
    end: "2026-09-27T23:59:00.000Z",
    species: ["Clefairy", "Jigglypuff", "Teddiursa"],
    specialBackground: true,
    details: {
      research: [{ name: "Clefairy", source: "Timed Research" }, { name: "Teddiursa", source: "Timed Research" }],
      backgroundPokemon: [{ name: "Clefairy", source: "Moonlight O'Clock + Timed Research" }]
    }
  }, {
    id: "korea-outing",
    name: "Pikachu’s Korea Outing 2026",
    eventType: "regional-event",
    scope: "regional",
    start: "2026-09-24T01:00:00.000Z",
    end: "2026-09-26T11:00:00.000Z",
    species: ["Pikachu (Orange Hanbok)"],
    specialBackground: false,
    details: {
      raidBosses: [{ name: "Pikachu (Orange Hanbok)" }],
      research: [{ name: "Pikachu (Orange Hanbok)", source: "Timed Research" }]
    }
  }], { timeZone: "America/New_York" }, { coordinateLinks: [] }, now);
  const clefairy = messages[0].slice(1).find(embed => /Dancing in the Moonlight/.test(embed.title));
  const korea = messages[0].slice(1).find(embed => /Korea Outing/.test(embed.title));
  assert.equal(clefairy.fields.find(field => field.name === "Background eligible\\*\\*")?.value, "\u200b");
  assert.ok((clefairy.fields.find(field => field.name === "Featured")?.value || "")
    .includes("- Clefairy\\*\\*"));
  assert.ok((clefairy.fields.find(field => field.name === "Research")?.value || "")
    .includes("Clefairy\\*\\* — via Timed Research"));
  assert.equal(korea.fields.find(field => field.name === "Research")?.value,
    "- Pikachu (Orange Hanbok) — via Timed Research");
  assert.equal(korea.fields.some(field => field.name === "Background"), false);
});

test("unclassified summary species stay visible as Featured instead of being called Wild", () => {
  const now = Date.parse("2026-09-18T12:00:00.000Z");
  const messages = preorderGuideMessages([{
    id: "unclassified-event",
    name: "Event with a Featured Encounter",
    eventType: "local-partnership",
    scope: "venue",
    start: "2026-09-23T10:00:00.000Z",
    end: "2026-09-24T10:00:00.000Z",
    species: ["Featured Pokémon"]
  }], { timeZone: "America/New_York" }, { coordinateLinks: [] }, now);
  const embed = messages[0][1];
  assert.deepEqual(embed.fields.map(field => field.name), ["Featured"]);
  assert.match(embed.fields[0].value, /Featured Pokémon/);
  assert.doesNotMatch(JSON.stringify(embed), /Wild/);
});

test("preorder background eligibility requires an explicit true flag", () => {
  const now = Date.parse("2026-09-18T12:00:00.000Z");
  const messages = preorderGuideMessages([{
    id: "background-reference-only",
    name: "Background Reference Only",
    eventType: "community",
    scope: "global",
    start: "2026-09-23T12:00:00.000Z",
    end: "2026-09-24T12:00:00.000Z",
    specialBackground: false,
    background: false,
    summary: "The source includes background information for context, not a background reward.",
    details: {
      backgroundEligible: false,
      sections: [{
        title: "Published event details",
        items: ["The background article is linked for reference only."]
      }],
      sourceLinks: [{ label: "Background reference", href: "https://example.com/background" }],
      spawns: [{ name: "Wild Pokémon" }]
    }
  }], { timeZone: "America/New_York" }, { coordinateLinks: [] }, now);
  const embed = messages[0][1];
  assert.equal(embed.fields.some(field => /background eligible/i.test(field.name)), false);
  assert.doesNotMatch(JSON.stringify(embed), /background eligible/i);
});

test("preorder cards omit an unnamed background marker for multi-Pokémon events", () => {
  const now = Date.parse("2026-09-18T12:00:00.000Z");
  const messages = preorderGuideMessages([{
    id: "unnamed-background-event",
    name: "Unnamed Background Event",
    eventType: "regional-event",
    scope: "regional",
    start: "2026-09-23T10:00:00.000Z",
    end: "2026-09-24T10:00:00.000Z",
    specialBackground: true,
    species: ["First Pokémon", "Second Pokémon"],
    details: { spawns: [{ name: "First Pokémon" }, { name: "Second Pokémon" }] }
  }], { timeZone: "America/New_York" }, { coordinateLinks: [] }, now);
  const embed = messages[0][1];
  assert.equal(embed.fields.some(field => field.name === "Background eligible\\*\\*"), false);
  assert.doesNotMatch(JSON.stringify(embed), /\*\*First Pokémon\*\*|\*\*Second Pokémon\*\*/);
});

test("permissioned white-label digests omit Example Events text and site-owned links", () => {
  const messages = eventDigestMessages([{
    id: "raid-hour",
    name: "Raid Hour",
    eventType: "raid-hour",
    scope: "global",
    start: "2026-08-30T18:00:00.000Z",
    end: "2026-08-30T19:00:00.000Z"
  }], "today", {
    timeZone: "America/New_York"
  }, { type: "webhook", coordinateLinks: [], hideSiteBranding: true }, Date.parse("2026-08-30T12:00:00.000Z"));
  const serialized = JSON.stringify(messages);
  assert.doesNotMatch(serialized, /Example Events/i);
  assert.doesNotMatch(serialized, /example\.com/i);
  assert.equal("url" in messages[0][0], false);
  assert.equal("url" in messages[0][1], false);
  assert.match(messages[0][1].footer.text, /Event alert/);
});

test("local starting-soon alerts are exact-time, one-time candidates and never include stamp rallies", () => {
  const start = Date.parse("2026-08-30T16:15:00.000Z");
  const event = {
    id: "local-mlb-washington-nationals",
    name: "Washington Nationals Pokémon GO Theme Night",
    eventType: "local-partnership",
    scope: "venue",
    startingSoonAlert: true,
    start: new Date(start).toISOString(),
    end: new Date(start + 4 * 60 * 60 * 1_000).toISOString(),
    location: "Nationals Park, Washington, DC",
    coordinates: "38.8730, -77.0074",
    timeZone: "America/New_York"
  };
  const settings = {
    schedules: { startingSoon: { enabled: true } },
    scopes: { global: false, local: true },
    categories: ["local"],
    location: { latitude: 38.873, longitude: -77.0074, radiusKm: 25 }
  };
  const dueAt = start - 135 * 60 * 1_000;
  assert.deepEqual(eventsForLocalStartingSoon([event], dueAt - 1, settings), []);
  assert.deepEqual(eventsForLocalStartingSoon([event], dueAt, settings).map(row => row.id), [event.id]);
  assert.deepEqual(eventsForLocalStartingSoon([event], start - 1, settings).map(row => row.id), [event.id], "a delayed cron catches up before the event starts");
  assert.deepEqual(eventsForLocalStartingSoon([event], start, settings), []);
  assert.deepEqual(eventsForLocalStartingSoon([{ ...event, scope: "global" }], dueAt, settings), []);
  assert.deepEqual(eventsForLocalStartingSoon([{ ...event, startingSoonAlert: false }], dueAt, settings), []);
  assert.deepEqual(eventsForLocalStartingSoon([{
    ...event,
    id: "worlds-stamp-rally",
    name: "Worlds GO Stamp Rally",
    eventType: "stamp-rally"
  }], dueAt, settings), [], "stamp rallies never receive this alert");
  assert.deepEqual(eventsForLocalStartingSoon([{
    ...event,
    id: "long-partnership",
    end: new Date(start + 9 * 24 * 60 * 60 * 1_000).toISOString()
  }], dueAt, settings), []);
  assert.deepEqual(eventsForLocalStartingSoon([event], dueAt, {
    ...settings,
    location: { latitude: 47.6062, longitude: -122.3321, radiusKm: 25 }
  }), [], "the destination's location radius is enforced");
  assert.deepEqual(eventsForLocalStartingSoon([{ ...event, coordinates: "" }], dueAt, settings), [], "an unmapped event cannot bypass a configured radius");
  assert.deepEqual(eventsForLocalStartingSoon([event], dueAt, { ...settings, categories: ["raids"] }), []);
  assert.match(startingSoonEventSentKey(event), /^starting-soon:[a-f0-9]{32}$/);
  assert.notEqual(startingSoonEventSentKey(event), startingSoonEventSentKey({
    ...event,
    start: new Date(start + 60 * 60 * 1_000).toISOString()
  }), "a rescheduled event receives a new one-time identity");

  const worldsAlertAt = Date.parse("2026-08-28T13:45:00.000Z");
  const worlds = eventsForLocalStartingSoon(curatedLocalEvents(worldsAlertAt), worldsAlertAt, {
    ...settings,
    location: { latitude: 37.784167, longitude: -122.401389, radiusKm: 25 }
  });
  assert.ok(worlds.some(row => row.id === "local-pokemon-xp-worlds-san-francisco-2026"));
  assert.ok(worlds.every(row => row.eventType !== "stamp-rally"));
});

test("This Weekend includes every overlapping Friday-through-Sunday event, including global Community Day", () => {
  const friday = Date.parse("2026-08-14T12:05:00.000Z");
  const events = eventsForDigest([
    { id: "friday", name: "Friday Event", eventType: "generic", scope: "global", start: "2026-08-14T09:00:00.000", end: "2026-08-14T10:00:00.000" },
    { id: "nickit", name: "Nickit Community Day", eventType: "community-day", scope: "global", start: "2026-08-16T14:00:00.000", end: "2026-08-16T17:00:00.000" },
    { id: "sunday-local", name: "Sunday Local Event", eventType: "local", scope: "venue", start: "2026-08-16T20:00:00.000", end: "2026-08-16T22:00:00.000" },
    { id: "monday", name: "Monday Event", eventType: "generic", scope: "global", start: "2026-08-17T00:00:00.000", end: "2026-08-17T01:00:00.000" }
  ], "weekend", friday);
  assert.deepEqual(events.map(event => event.id), ["friday", "nickit", "sunday-local"]);
});

test("webhooks follow calendar day order and use event priority within each day", () => {
  const sunday = Date.parse("2026-08-16T12:05:00.000Z");
  const events = eventsForDigest([
    { id: "boss", name: "Groudon in 5-star Raid Battles", eventType: "raid-battles", scope: "global", start: "2026-08-17T06:00:00.000", end: "2026-08-23T22:00:00.000" },
    { id: "venue", name: "Museum Collaboration", eventType: "local-partnership", scope: "venue", start: "2026-08-17T09:00:00.000", end: "2026-09-17T17:00:00.000" },
    { id: "daily", name: "Limited Research Day", eventType: "research", scope: "global", start: "2026-08-20T08:00:00.000", end: "2026-08-20T18:00:00.000" },
    { id: "spotlight", name: "Pikachu Spotlight Hour", eventType: "spotlight-hour", scope: "global", start: "2026-08-18T18:00:00.000", end: "2026-08-18T19:00:00.000" },
    { id: "raid-hour", name: "Groudon Raid Hour", eventType: "raid-hour", scope: "global", start: "2026-08-19T18:00:00.000", end: "2026-08-19T19:00:00.000" },
    { id: "community", name: "Nickit Community Day", eventType: "community-day", scope: "global", start: "2026-08-23T14:00:00.000", end: "2026-08-23T17:00:00.000" }
  ], "week", sunday);
  assert.deepEqual(events.map(event => event.id), [
    "venue", "boss", "spotlight", "raid-hour", "daily", "community"
  ]);
});

test("Today leads with an active global multi-day event, then applies short-event priority", () => {
  const now = Date.parse("2026-08-20T12:05:00.000Z");
  const events = eventsForDigest([
    {
      id: "spotlight", name: "Pikachu Spotlight Hour", eventType: "spotlight-hour", scope: "global",
      start: "2026-08-20T18:00:00.000", end: "2026-08-20T19:00:00.000"
    },
    {
      id: "water", name: "Ultra Unlock: Water Festival", eventType: "event", scope: "global",
      start: "2026-08-18T10:00:00.000", end: "2026-08-24T20:00:00.000",
      bonuses: ["3× Catch XP"]
    },
    {
      id: "raid-hour", name: "Lunala Raid Hour", eventType: "raid-hour", scope: "global",
      start: "2026-08-20T18:00:00.000", end: "2026-08-20T19:00:00.000"
    },
    {
      id: "community", name: "Nickit Community Day", eventType: "community-day", scope: "global",
      start: "2026-08-20T14:00:00.000", end: "2026-08-20T17:00:00.000"
    }
  ], "today", now);
  assert.deepEqual(events.map(event => event.id), ["water", "community", "raid-hour", "spotlight"]);
});

test("automatic delivery dedupe preserves customized feeds while canonicalizing URL variants", () => {
  const first = automaticDeliveryLedgerKey(
    "https://discord.com/api/webhooks/123456789012345678/token-value?wait=true#one",
    "today:2026-08-20",
    [{ id: "workspace-one-event" }],
    { roleId: "223456789012345678" },
    { timeZone: "America/New_York" }
  );
  const second = automaticDeliveryLedgerKey(
    "https://canary.discord.com/api/webhooks/123456789012345678/token-value/#two",
    "today:2026-08-20",
    [{ id: "completely-different-event" }],
    { roleId: "323456789012345678" },
    { timeZone: "Asia/Tokyo" }
  );
  assert.notEqual(first, second, "different role, timezone, and event variants must not silence one another");
  assert.equal(first, automaticDeliveryLedgerKey(
    "https://ptb.discord.com/api/webhooks/123456789012345678/token-value/",
    "today:2026-08-20",
    [{ id: "workspace-one-event" }],
    { roleId: "223456789012345678" },
    { timeZone: "America/New_York" }
  ), "equivalent customized feeds still share one canonical delivery identity");
  assert.notEqual(first, automaticDeliveryLedgerKey(
    "https://discord.com/api/webhooks/123456789012345678/token-value",
    "week:2026-08-20"
  ));
});

test("Week Ahead keeps active multi-stop events available while Daily omits them", () => {
  const sunday = Date.parse("2026-08-16T12:05:00.000Z");
  const events = eventsForDigest([
    {
      id: "lego-stamp-rally",
      name: "LEGO Stores × Pokémon GO Stamp Rally",
      eventType: "stamp-rally",
      scope: "regional",
      start: "2026-08-03T00:00:00.000Z",
      end: "2026-09-30T23:59:59.000Z",
      bonuses: ["Special Background Pikachu encounters"]
    },
    {
      id: "national-trust",
      name: "Pokémon GO × National Trust",
      eventType: "local-partnership",
      scope: "regional",
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-30T23:59:59.000Z",
      venues: [
        { name: "Trust Stop A", coordinates: "51.5007, -0.1246" },
        { name: "Trust Stop B", coordinates: "51.5010, -0.1250" }
      ]
    },
    {
      id: "old-raid-rotation",
      name: "Lunala in 5-star Raid Battles",
      eventType: "raid-battles",
      scope: "global",
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-30T23:59:59.000Z"
    }
  ], "week", sunday);
  assert.deepEqual(events.map(event => event.id), ["national-trust", "lego-stamp-rally", "old-raid-rotation"]);
  const today = eventsForDigest([
    {
      id: "lego-stamp-rally",
      name: "LEGO Stores × Pokémon GO Stamp Rally",
      eventType: "stamp-rally",
      scope: "regional",
      start: "2026-08-03T00:00:00.000Z",
      end: "2026-09-30T23:59:59.000Z"
    },
    {
      id: "national-trust",
      name: "Pokémon GO × National Trust",
      eventType: "local-partnership",
      scope: "regional",
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-30T23:59:59.000Z",
      venues: [
        { name: "Trust Stop A", coordinates: "51.5007, -0.1246" },
        { name: "Trust Stop B", coordinates: "51.5010, -0.1250" }
      ]
    }
  ], "today", sunday);
  assert.deepEqual(today, []);
  const weekend = eventsForDigest([
    {
      id: "lego-stamp-rally",
      name: "LEGO Stores × Pokémon GO Stamp Rally",
      eventType: "stamp-rally",
      scope: "regional",
      start: "2026-08-03T00:00:00.000Z",
      end: "2026-09-30T23:59:59.000Z"
    }
  ], "weekend", sunday);
  assert.deepEqual(weekend, []);
});

test("Daily includes Legendary, Mega, and Shadow rotations without mixing in Max listings", () => {
  const now = Date.parse("2026-08-18T12:05:00.000Z");
  const events = eventsForDigest([
    { id: "mega", name: "Mega Garchomp in Mega Raids", eventType: "raid-battles", scope: "global", start: "2026-08-12T06:00:00.000", end: "2026-08-18T22:00:00.000" },
    { id: "shadow", name: "Shadow Giratina in Shadow Raids", eventType: "shadow-raids", scope: "global", start: "2026-08-05T06:00:00.000", end: "2026-09-08T22:00:00.000" },
    { id: "legendary", name: "Groudon in 5-star Raid Battles", eventType: "raid-battles", scope: "global", start: "2026-08-12T06:00:00.000", end: "2026-08-25T22:00:00.000" },
    { id: "tier-three", name: "Machamp in Tier 3 Raids", eventType: "raid-battles", scope: "global", start: "2026-08-12T06:00:00.000", end: "2026-08-25T22:00:00.000" },
    { id: "max", name: "Dynamax Duraludon", eventType: "max-battles", scope: "global", start: "2026-08-01T06:00:00.000", end: "2026-09-01T21:00:00.000" }
  ], "today", now);
  assert.equal(events.find(event => event.id === "mega").scheduleNote, "Last day — this event ends today.");
  assert.equal(events.find(event => event.id === "shadow").scheduleNote, "Available in raids today.");
  assert.equal(events.find(event => event.id === "legendary").scheduleNote, "Available in raids today.");
  assert.equal(events.some(event => event.id === "tier-three"), false, "Daily stays focused on headline raid rotations");
  assert.equal(events.find(event => event.id === "max"), undefined, "a month-long Max listing belongs in Week Ahead rather than every Daily post");
  assert.ok(events.every(event => !/raids or Max Battles/i.test(event.scheduleNote)));
});

test("Daily keeps active event-specific details such as a multi-day Magikarp festival", () => {
  const now = Date.parse("2026-08-19T12:05:00.000Z");
  const events = eventsForDigest([
    {
      id: "magikarp-festival",
      name: "Magikarp Festival",
      eventType: "local-event",
      scope: "venue",
      start: "2026-08-16T01:00:00.000Z",
      end: "2026-08-31T11:00:00.000Z",
      bonuses: ["Magikarp mass outbreaks and event Timed Research"],
      details: { sections: [{ title: "Wild encounters", items: ["Magikarp"] }] }
    },
    {
      id: "ongoing-boss",
      name: "Lunala in 5-star Raid Battles",
      eventType: "raid-battles",
      scope: "global",
      start: "2026-08-17T06:00:00.000Z",
      end: "2026-08-25T22:00:00.000Z"
    }
  ], "today", now);
  assert.deepEqual(events.map(event => event.id), ["magikarp-festival", "ongoing-boss"]);
  assert.match(events[0].scheduleNote, /schedule|active|limited-time|hours/i);
  assert.equal(events[1].scheduleNote, "Available in raids today.");
});

test("Today omits Season information while Week keeps weekday-specific notes and neither includes GO Pass", () => {
  const events = [
    {
      id: "season", name: "Forever Forward Season", eventType: "season", scope: "global",
      start: "2026-08-01T00:00:00.000", end: "2026-09-01T00:00:00.000",
      bonuses: [
        "Showcase Tuesday allows up to five PokéStop Showcase entries.",
        "Saturday brings an extra special trade.",
        "More Mega-Evolved Pokémon appear throughout the Season."
      ]
    },
    {
      id: "pass", name: "August GO Pass", eventType: "go-pass", scope: "global",
      start: "2026-08-01T00:00:00.000", end: "2026-09-01T00:00:00.000",
      bonuses: ["Earn points throughout the month."]
    },
    {
      id: "max-monday", name: "Max Monday", eventType: "max-battles", scope: "global",
      start: "2026-08-17T18:00:00.000", end: "2026-08-17T19:00:00.000"
    }
  ];
  const tuesday = eventsForDigest(events, "today", Date.parse("2026-08-18T12:05:00.000Z"));
  assert.deepEqual(tuesday, []);

  const monday = eventsForDigest(events, "today", Date.parse("2026-08-17T12:05:00.000Z"));
  assert.deepEqual(monday.map(event => event.id), ["max-monday"]);

  const week = eventsForDigest(events, "week", Date.parse("2026-08-17T12:05:00.000Z"));
  assert.deepEqual(week.map(event => event.id), ["max-monday", "season"]);
  assert.deepEqual(week[1].bonuses, [
    "Showcase Tuesday allows up to five PokéStop Showcase entries.",
    "Saturday brings an extra special trade."
  ]);
  assert.match(week[1].scheduleNote, /specific days this week/i);
});

test("Weekend omits Season and Pass while the opt-in alert sends only starts tomorrow", () => {
  const friday = Date.parse("2026-08-14T12:05:00.000Z");
  const events = [
    {
      id: "season", name: "Forever Forward Season", eventType: "season", scope: "global",
      start: "2026-08-15T10:00:00.000", end: "2026-11-15T10:00:00.000",
      bonuses: ["Showcase Tuesday allows five entries.", "More Mega-Evolved Pokémon appear."]
    },
    {
      id: "pass", name: "August GO Pass", eventType: "go-pass", scope: "global",
      start: "2026-08-15T10:00:00.000", end: "2026-09-15T10:00:00.000",
      bonuses: ["Earn points throughout the month."]
    },
    {
      id: "active-pass", name: "Already Active GO Pass", eventType: "go-pass", scope: "global",
      start: "2026-08-01T10:00:00.000", end: "2026-09-01T10:00:00.000"
    },
    {
      id: "later-season", name: "Later Season", eventType: "season", scope: "global",
      start: "2026-08-16T10:00:00.000", end: "2026-11-16T10:00:00.000"
    },
    {
      id: "nickit", name: "Nickit Community Day", eventType: "community-day", scope: "global",
      start: "2026-08-16T14:00:00.000", end: "2026-08-16T17:00:00.000"
    }
  ];
  assert.deepEqual(eventsForDigest(events, "weekend", friday).map(event => event.id), ["nickit"]);
  const monthly = eventsForDigest(events, "monthly", friday);
  assert.deepEqual(monthly.map(event => event.id), ["season", "pass"]);
  assert.deepEqual(monthly[0].bonuses, events[0].bonuses);
  assert.deepEqual(monthly[1].bonuses, events[1].bonuses);
});

test("Daily, Weekend, and Week Ahead remove evergreen noise and order dated events chronologically", () => {
  const events = [
    {
      id: "season", name: "Forever Forward", eventType: "season", scope: "global",
      start: "2026-08-01T00:00:00.000", end: "2026-09-01T00:00:00.000",
      bonuses: ["Showcase Tuesday allows up to five entries.", "More Mega-Evolved Pokémon appear."]
    },
    { id: "museum", name: "Year-long Museum Partnership", eventType: "local-partnership", scope: "venue", start: "2026-05-01T00:00:00.000", end: "2027-05-01T00:00:00.000" },
    { id: "battle", name: "Great League Rotation", eventType: "go-battle-league", scope: "global", start: "2026-08-18T20:00:00.000", end: "2026-08-25T20:00:00.000" },
    { id: "long-raid", name: "Shadow Boss in Shadow Raids", eventType: "raid-battles", scope: "global", start: "2026-08-01T06:00:00.000", end: "2026-09-01T22:00:00.000" },
    { id: "max", name: "Dynamax Magikarp during Max Monday", eventType: "max-mondays", scope: "global", start: "2026-08-17T06:00:00.000", end: "2026-08-17T21:00:00.000" },
    { id: "water", name: "Ultra Unlock: Water Festival", eventType: "event", scope: "global", start: "2026-08-18T10:00:00.000", end: "2026-08-24T20:00:00.000" },
    { id: "raid", name: "Lunala in 5-star Raid Battles", eventType: "raid-battles", scope: "global", start: "2026-08-19T06:00:00.000", end: "2026-08-25T22:00:00.000" },
    { id: "hour", name: "Lunala Raid Hour", eventType: "raid-hour", scope: "global", start: "2026-08-19T18:00:00.000", end: "2026-08-19T19:00:00.000" },
    { id: "raid-day", name: "Starmie Super Mega Raid Day", eventType: "raid-day", scope: "global", start: "2026-08-22T11:00:00.000", end: "2026-08-22T17:00:00.000" }
  ];

  const week = eventsForDigest(events, "week", Date.parse("2026-08-16T12:05:00.000Z"));
  assert.deepEqual(week.map(event => event.id), ["max", "museum", "long-raid", "water", "hour", "raid", "raid-day", "season"]);
  assert.match(week[0].scheduleNote, /short event/i);
  assert.match(week.find(event => event.id === "raid").scheduleNote, /new raid/i);
  assert.match(week.at(-1).scheduleNote, /specific days this week/i);
  assert.equal(week.some(event => ["museum", "long-raid"].includes(event.id)), true);
  assert.equal(week.some(event => event.id === "battle"), false);

  const tuesday = eventsForDigest(events, "today", Date.parse("2026-08-18T12:05:00.000Z"));
  assert.deepEqual(new Set(tuesday.map(event => event.id)), new Set(["water", "long-raid"]));
  assert.equal(tuesday.some(event => ["museum", "battle"].includes(event.id)), false);
  assert.match(tuesday.find(event => event.id === "water").scheduleNote, /starts today/i);
  assert.equal(tuesday.find(event => event.id === "long-raid").scheduleNote, "Available in raids today.");

  const weekend = eventsForDigest(events, "weekend", Date.parse("2026-08-21T12:05:00.000Z"));
  assert.deepEqual(weekend.map(event => event.id), ["water", "raid", "raid-day"]);
  assert.ok(weekend.every(event => /Friday–Sunday/.test(event.scheduleNote)));
});

test("automatic event digests: daily the evening before (6:05 PM Eastern), week ahead Sunday morning, no weekend post", () => {
  const NO_SEASON = { schedules: { monthly: { enabled: false } } };
  assert.deepEqual(automaticDigestKinds(Date.parse("2026-08-14T12:05:00.000Z"), NO_SEASON), [], "the weekend post is retired (2026-10-30)");
  assert.deepEqual(automaticDigestKinds(Date.parse("2026-08-14T22:05:00.000Z"), NO_SEASON), ["today"], "Friday evening sends Saturday's daily");
  assert.deepEqual(automaticDigestKinds(Date.parse("2026-08-16T12:05:00.000Z"), NO_SEASON), ["week"]);
  assert.deepEqual(automaticDigestKinds(Date.parse("2026-08-16T22:05:00.000Z"), NO_SEASON), ["today", "week"]);
  assert.deepEqual(automaticDigestKinds(Date.parse("2026-08-18T22:04:00.000Z"), NO_SEASON), []);
  assert.deepEqual(automaticDigestKinds(Date.parse("2026-08-18T22:06:00.000Z"), NO_SEASON), ["today"]);
});


test("digests include only overlapping local or in-person events", () => {
  const now = Date.parse("2026-08-14T12:05:00.000Z");
  const events = localEventsForDigest([
    { id: "venue", scope: "venue", start: "2026-08-14T11:00:00.000Z", end: "2026-08-14T15:00:00.000Z" },
    { id: "global", scope: "global", start: "2026-08-14T11:00:00.000Z", end: "2026-08-14T15:00:00.000Z" },
    { id: "future", scope: "regional", start: "2026-08-20T11:00:00.000Z", end: "2026-08-20T15:00:00.000Z" }
  ], "today", now);
  assert.deepEqual(events.map(event => event.id), ["venue"]);
});

test("workspace filters include global, nearby, and unmapped regional notices without including distant mapped venues", () => {
  const now = Date.parse("2026-08-14T12:05:00.000Z");
  const rows = eventsForDigest([
    { id: "global-raid", name: "Global Raid Hour", eventType: "raid-hour", scope: "global", start: "2026-08-14T11:00:00.000Z", end: "2026-08-14T15:00:00.000Z" },
    { id: "near", name: "Nearby Local Event", scope: "venue", coordinates: "39.7392, -104.9903", start: "2026-08-14T11:00:00.000Z", end: "2026-08-14T15:00:00.000Z" },
    { id: "far", name: "Far Local Event", scope: "venue", coordinates: "35.6762, 139.6503", start: "2026-08-14T11:00:00.000Z", end: "2026-08-14T15:00:00.000Z" },
    { id: "missing", name: "No Coordinates", scope: "venue", start: "2026-08-14T11:00:00.000Z", end: "2026-08-14T15:00:00.000Z" }
  ], "today", now, {
    ownerId: "discord:123456789012345678",
    timeZone: "America/New_York",
    location: { latitude: 39.7392, longitude: -104.9903, radiusKm: 25 },
    scopes: { global: true, local: true },
    categories: ["raids", "local"]
  });
  assert.deepEqual(rows.map(row => row.id), ["global-raid", "missing", "near"]);
  assert.equal(rows.find(row => row.id === "near").distanceKm, 0);
  assert.equal(rows.find(row => row.id === "missing").locationFilterUnavailable, true);
});

test("webhook locations always combine global events with nearby regional events", () => {
  const now = Date.parse("2026-08-14T12:05:00.000Z");
  const workspace = {
    ownerId: "discord:123456789012345678",
    timeZone: "America/New_York",
    location: { latitude: null, longitude: null, radiusKm: 100 },
    scopes: { global: false, local: false }
  };
  const custom = settingsForWebhookDestination(workspace, {
    locationMode: "custom",
    location: { latitude: 39.7392, longitude: -104.9903, radiusKm: 50 },
    timeZone: "America/Chicago"
  }, workspace.ownerId, now);
  assert.deepEqual(custom.scopes, { global: true, local: true });
  assert.equal(custom.timeZone, "America/Chicago");
  assert.deepEqual(custom.location, { latitude: 39.7392, longitude: -104.9903, radiusKm: 50 });

  const globalOnly = settingsForWebhookDestination(workspace, {
    locationMode: "global",
    timeZone: "Europe/London"
  }, workspace.ownerId, now);
  assert.deepEqual(globalOnly.scopes, { global: true, local: false });
  assert.equal(globalOnly.timeZone, "Europe/London");
});

test("custom workspace schedules honor their timezone and weekday while catching up after a missed cron slot", () => {
  const settings = {
    ownerId: "discord:123456789012345678",
    timeZone: "Asia/Tokyo",
    schedules: {
      today: { enabled: true, time: "09:30" },
      weekend: { enabled: false, weekday: 5, time: "08:05" },
      week: { enabled: true, weekday: 1, time: "09:30" },
      monthly: { enabled: true, time: "09:30" }
    }
  };
  assert.deepEqual(automaticDigestKinds(Date.parse("2026-08-17T00:32:00.000Z"), settings), ["today", "week", "monthly"]);
  assert.deepEqual(automaticDigestKinds(Date.parse("2026-08-17T00:35:00.000Z"), settings), ["today", "week", "monthly"]);
  assert.deepEqual(automaticDigestKinds(Date.parse("2026-08-16T23:07:00.000Z"), settings), []);
});

test("automatic digest windows cross midnight without changing the scheduled dedupe day", () => {
  const lateSettings = {
    ownerId: "discord:123456789012345678",
    timeZone: "UTC",
    schedules: {
      today: { enabled: true, time: "23:58" },
      weekend: { enabled: false, weekday: 5, time: "23:56" },
      week: { enabled: true, weekday: 5, time: "23:56" },
      monthly: { enabled: false, time: "08:00" }
    }
  };
  const fridayBeforeMidnight = automaticDigestRuns(
    Date.parse("2026-08-14T23:59:00.000Z"),
    lateSettings
  );
  const saturdayMidnight = automaticDigestRuns(
    Date.parse("2026-08-15T00:00:00.000Z"),
    lateSettings
  );
  assert.deepEqual(fridayBeforeMidnight.map(run => run.kind), ["today", "week"]);
  assert.deepEqual(saturdayMidnight.map(run => run.kind), ["today", "week"]);
  assert.deepEqual(fridayBeforeMidnight.map(run => [run.kind, run.localDate]), [["today", "2026-08-15"], ["week", "2026-08-14"]], "an evening daily is the next day's post");
  assert.deepEqual(
    saturdayMidnight.map(run => [run.kind, run.localDate, run.scheduledAt]),
    fridayBeforeMidnight.map(run => [run.kind, run.localDate, run.scheduledAt]),
    "both cron observations resolve to the same claim key inputs instead of creating a midnight duplicate"
  );

  const exactMidnight = {
    ...lateSettings,
    schedules: {
      ...lateSettings.schedules,
      today: { enabled: true, time: "00:00" },
      weekend: { enabled: false, weekday: 5, time: "23:56" },
      week: { enabled: false, weekday: 5, time: "23:56" }
    }
  };
  assert.deepEqual(
    automaticDigestRuns(Date.parse("2026-08-15T00:00:00.000Z"), exactMidnight)
      .map(run => [run.kind, run.localDate]),
    [["today", "2026-08-15"]]
  );
  assert.deepEqual(
    automaticDigestKinds(Date.parse("2026-08-15T12:32:00.000Z"), {
      ...lateSettings,
      schedules: {
        ...lateSettings.schedules,
        today: { enabled: true, time: "12:30" },
        weekend: { enabled: false, weekday: 5, time: "23:56" },
        week: { enabled: false, weekday: 5, time: "23:56" }
      }
    }),
    ["today"]
  );
  assert.deepEqual(automaticDigestKinds(Date.parse("2026-08-15T00:03:00.000Z"), lateSettings), ["today", "week"]);
});

test("an open-ended stamp rally remains in Week Ahead and is labeled ongoing", () => {
  const now = Date.parse("2026-08-23T12:00:00.000Z");
  const nagasaki = curatedLocalEvents(now).find(event => event.id === "local-nagasaki-stamp-rally");
  assert.ok(nagasaki, "the ongoing curated rally is available");
  assert.deepEqual(eventsForDigest([nagasaki], "week", now).map(event => event.id), [nagasaki.id]);
  assert.deepEqual(eventsForDigest([nagasaki], "today", now), []);
  assert.deepEqual(eventsForDigest([nagasaki], "weekend", now), []);
  const embed = eventDigestEmbed(nagasaki, 0, 1, { now, kind: "week", viewerTimeZone: "America/New_York" });
  assert.match(embed.description, /ongoing \(no end published\)/i);
  assert.doesNotMatch(embed.description, /<t:Infinity|NaN/);
});

test("in-person event time lists venue time before viewer time", () => {
  const lines = eventTimeLines({
    start: "2026-08-22T23:05:00.000Z",
    end: "2026-08-23T03:05:00.000Z",
    timeZone: "America/Chicago"
  }, "America/New_York");
  assert.match(lines[0], /^Event local time .*6:05 PM CDT/);
  assert.match(lines[1], /^Configured time \(America\/New_York\):.*7:05 PM EDT/);
});

test("venue webhook embeds show native time and Discord viewer-local time", () => {
  const embed = eventDigestEmbed({
    id: "seoul-local-event",
    name: "Seoul Local Event",
    scope: "venue",
    location: "Seoul, South Korea",
    timeZone: "Asia/Seoul",
    start: "2026-08-23T10:00:00+09:00",
    end: "2026-08-23T13:00:00+09:00"
  }, 0, 1, { viewerTimeZone: "America/New_York" });

  assert.match(embed.description, /\*\*Event local time \(Asia\/Seoul\):\*\* \*\*Sun, Aug 23, 10:00 AM GMT\+9 – Sun, Aug 23, 1:00 PM GMT\+9\*\*/);
  assert.match(embed.description, /\*\*Your time:\*\* \*\*<t:1787446800:F> – <t:1787457600:F>\*\*/);
  assert.doesNotMatch(embed.description, /Configured time/);
});

test("absolute local events without a published venue timezone still show Discord viewer-local time", () => {
  const embed = eventDigestEmbed({
    id: "unmapped-local-event",
    name: "Unmapped Local Event",
    scope: "regional",
    location: "Regional venue",
    start: "2026-08-23T14:00:00Z",
    end: "2026-08-23T16:00:00Z"
  }, 0, 1, { viewerTimeZone: "America/Los_Angeles" });

  assert.match(embed.description, /Event local time:\*\* \*\*Venue timezone not published/);
  assert.match(embed.description, /\*\*Your time:\*\* \*\*<t:1787493600:F> – <t:1787500800:F>\*\*/);
  assert.doesNotMatch(embed.description, /Configured time/);
});

test("global rolling events use the configured destination timezone and preserve local event hours", () => {
  const lines = eventTimeLines({
    scope: "global",
    localTime: true,
    start: "2026-08-16T14:00:00.000",
    end: "2026-08-16T17:00:00.000"
  }, "America/New_York");
  assert.match(lines[0], /^Configured time \(America\/New_York\):/);
  assert.match(lines[0], /2:00 PM/);
  assert.match(lines[0], /EDT/);
  assert.equal(lines[1], "Occurs at these local hours: Sun, Aug 16, 2:00 PM – 5:00 PM local time");
});

test("fixed worldwide events are never extended into a local-time rollout", () => {
  const event = { name: "Worldwide event", scope: "global", localTime: false, start: "2026-08-19T18:00:00Z", end: "2026-08-19T19:00:00Z" };
  for (const viewerTimeZone of ["Asia/Tokyo", "America/New_York"]) {
    const embed = eventDigestEmbed(event, 0, 1, { viewerTimeZone });
    assert.ok(embed.description.includes(`<t:${Date.parse(event.start)/1000}:F> – <t:${Date.parse(event.end)/1000}:F>`));
    assert.doesNotMatch(embed.description, /Full global window/);
  }
});

test("global rolling webhooks expose Discord viewer-local timestamps without configured-time text", () => {
  const embed = eventDigestEmbed({
    id: "local-event",
    id: "community-day",
    name: "Community Day",
    scope: "global",
    localTime: true,
    start: "2026-08-16T14:00:00.000",
    end: "2026-08-16T17:00:00.000"
  }, 0, 1, { viewerTimeZone: "America/New_York" });
  assert.match(embed.description, /\*\*Occurs at these local hours:\*\* \*\*Sun, Aug 16, 2:00 PM – 5:00 PM local time\*\*/);
  assert.match(embed.description, /\*\*Full global window[^:]*:\*\* \*\*<t:1786838400:F> – <t:1786942800:F>\*\*/);
  assert.doesNotMatch(embed.description, /Configured time/);
  assert.doesNotMatch(embed.description, /Kiribati/);
  assert.match(embed.description, /Open full details on Example Events/);
  assert.doesNotMatch(embed.description, /Ticket:.*None listed/);
});

test("global local-time webhook timestamps span the same complete rollout for every destination", () => {
  const event = {
    id: "lunala-raid-hour",
    name: "Lunala Raid Hour",
    eventType: "raid-hour",
    scope: "global",
    localTime: true,
    start: "2026-08-19T18:00:00.000",
    end: "2026-08-19T19:00:00.000"
  };
  const tokyo = eventDigestEmbed(event, 0, 1, { viewerTimeZone: "Asia/Tokyo" });
  const newYork = eventDigestEmbed(event, 0, 1, { viewerTimeZone: "America/New_York" });
  const tokyoStart = Math.floor(Date.parse("2026-08-19T04:00:00.000Z") / 1_000);
  const tokyoEnd = Math.floor(Date.parse("2026-08-20T07:00:00.000Z") / 1_000);
  const newYorkStart = Math.floor(Date.parse("2026-08-19T04:00:00.000Z") / 1_000);
  const newYorkEnd = Math.floor(Date.parse("2026-08-20T07:00:00.000Z") / 1_000);

  assert.match(tokyo.description, new RegExp(`Full global window[^:]*:\\*\\* \\*\\*<t:${tokyoStart}:F> – <t:${tokyoEnd}:F>`));
  assert.match(newYork.description, new RegExp(`Full global window[^:]*:\\*\\* \\*\\*<t:${newYorkStart}:F> – <t:${newYorkEnd}:F>`));
  assert.doesNotMatch(`${tokyo.description}\n${newYork.description}`, /Configured time/);
  assert.equal(tokyoStart, newYorkStart, "full rollout is independent of the destination timezone");
});

test("every global local-time event type receives a Discord-local timestamp", () => {
  const events = [
    { id: "max-monday", name: "Dynamax Hitmontop during Max Monday", eventType: "max-mondays", start: "2026-08-24T06:00:00.000Z", end: "2026-08-24T21:00:00.000Z" },
    { id: "raid-hour", name: "Lunala Raid Hour", eventType: "raid-hour", start: "2026-08-19T18:00:00.000", end: "2026-08-19T19:00:00.000" },
    { id: "raid-day", name: "Special Saturday Raid Day", eventType: "raid-day", start: "2026-08-22T14:00:00.000", end: "2026-08-22T17:00:00.000" },
    { id: "community-day", name: "Community Day", eventType: "community-day", start: "2026-08-16T14:00:00.000", end: "2026-08-16T17:00:00.000" }
  ];

  for (const event of events) {
    const embed = eventDigestEmbed({ ...event, scope: "global", localTime: true }, 0, 1, {
      viewerTimeZone: "America/New_York"
    });
    assert.match(embed.description, /\*\*Full global window[^:]*:\*\* \*\*<t:\d+:F> – <t:\d+:F>\*\*/, `${event.name} should include Discord timestamps`);
  }
});

test("event webhook descriptions emphasize the scan-first information", () => {
  const embed = eventDigestEmbed({
    name: "Spotlight Hour",
    start: "2026-08-22T23:05:00.000Z",
    end: "2026-08-23T00:05:00.000Z",
    timeZone: "America/Chicago",
    scope: "venue",
    location: "Chicago",
    scheduleNote: "Starts this evening.",
    bonuses: ["2× Stardust"],
    specialBackground: true
  }, 0, 1, { viewerTimeZone: "America/New_York" });
  assert.match(embed.description, /\*\*Event local time/);
  assert.match(embed.description, /\*\*Your time:\*\* \*\*<t:\d+:F> – <t:\d+:F>\*\*/);
  assert.doesNotMatch(embed.description, /Kiribati/);
  assert.match(embed.description, /📣 Starts this evening\./);
  assert.match(embed.description, /\*\*Highlights:\*\* special\/location background/);
  assert.equal(embed.fields.find(field => field.name === "🎁 Bonuses")?.value, "• **2× Stardust**");
});

test("event embeds label raid and Max Battle boss fields precisely", () => {
  const base = {
    start: "2026-08-20T10:00:00.000Z",
    end: "2026-08-20T20:00:00.000Z",
    scope: "global",
    details: { raidBosses: [{ name: "Example boss" }] }
  };
  const raid = eventDigestEmbed({ ...base, name: "Example Raid Day", eventType: "raid-battles" }, 0, 1);
  const max = eventDigestEmbed({ ...base, name: "Example Max Battle Day", eventType: "max-battles" }, 0, 1);
  assert.equal(raid.fields.some(field => field.name === "⚔️ Raid bosses"), true);
  assert.equal(max.fields.some(field => field.name === "⚡ Max Battle bosses"), true);
  assert.equal([...raid.fields, ...max.fields].some(field => /Raid \/ Max|Featured battles/.test(field.name)), false);
});

test("event webhooks call out the active local catch multiplier", () => {
  const embed = eventDigestEmbed({
    id: "water-festival-2026",
    name: "Ultra Unlock: Water Festival",
    start: "2026-08-18T10:00:00.000",
    end: "2026-08-24T20:00:00.000",
    localTime: true,
    scope: "global",
    bonuses: ["Rainy Lure Modules attract Arrokuda."],
    details: {
      bonusWindows: [
        { startDate: "2026-08-18", startTime: "10:00", endDate: "2026-08-20", endTime: "10:00", label: "2× Catch XP · 3× Catch Stardust" },
        { startDate: "2026-08-20", startTime: "10:00", endDate: "2026-08-22", endTime: "10:00", label: "3× Catch XP · 4× Catch Stardust" }
      ]
    }
  }, 0, 1, {
    viewerTimeZone: "America/New_York",
    now: Date.parse("2026-08-19T15:00:00.000Z")
  });
  assert.doesNotMatch(embed.description, /Today’s active catch bonus/, "the active bonus must be rendered once, not in both the description and fields");
  const schedule = embed.fields.find(field => field.name === "📈 Catch bonus schedule · local time");
  assert.match(schedule?.value || "", /\*\*NOW · Aug 18, 10:00 AM – Aug 20, 10:00 AM:\*\* 2× Catch XP · 3× Catch Stardust/);
  assert.equal(embed.fields.filter(field => field.name === "📈 Catch bonus schedule · local time").length, 1);
  assert.doesNotMatch(embed.description, /3× Catch XP · 4× Catch Stardust/);
});

test("Water Festival webhooks use compact grouped sections and only link back to Example Events", () => {
  const details = featuredEventDetails("water-festival-2026");
  const embed = eventDigestEmbed({
    id: "water-festival-2026",
    name: "Ultra Unlock: Water Festival",
    start: "2026-08-18T10:00:00.000",
    end: "2026-08-24T20:00:00.000",
    localTime: true,
    scope: "global",
    ...details
  }, 0, 1, {
    kind: "today",
    viewerTimeZone: "America/New_York",
    coordinateLinks: ["itools"],
    now: Date.parse("2026-08-20T15:00:00.000Z")
  });
  assert.deepEqual(embed.fields.slice(0, 8).map(field => field.name), [
    "🐾 Wild & featured Pokémon",
    "✨ Shiny highlights",
    "🌧️ Rainy Lure encounters",
    "🔎 Field Research",
    "🥚 5 km Eggs",
    "⚔️ 1-Star Raids",
    "⚔️ 3-Star Raids",
    "🏆 GO Battle League · Rank 16+"
  ]);
  assert.match(embed.fields.find(field => field.name === "📈 Catch bonus schedule · local time")?.value || "", /NOW · Aug 20/);
  assert.equal(embed.fields.some(field => /GO Pass milestones/.test(field.name)), false, "pass detail stays off daily/weekend digests");
  const serialized = JSON.stringify(embed);
  assert.match(serialized, /https:\/\/example\.com\/events\?event=water-festival-2026/);
  assert.doesNotMatch(serialized, /pokemongo\.com|leekduck\.com|pokemongohub\.net/);
  assert.doesNotMatch(embed.description, /Summary:|Why it’s listed:|Ticket:.*None listed/);
  assert.equal((serialized.match(/3× Catch XP/g) || []).length, 1, "a staged multiplier is not repeated in general bonuses");
});

test("iTools-only webhooks remove raw form identifiers but keep readable form names", () => {
  const embed = eventDigestEmbed({
    id: "form-cleanup",
    name: "Form Test",
    start: "2026-08-20T10:00:00.000Z",
    end: "2026-08-20T11:00:00.000Z",
    scope: "venue",
    details: {
      spawns: [{ name: "(845:3182) Cramorant (Normal)" }, { name: "CRAMORANT_GULPING" }],
      sections: [{ title: "5 km Eggs", items: ["(845:3349) Cramorant (Gulping)", "PSYDUCK_SWIM_2025"] }]
    }
  }, 0, 1, { coordinateLinks: ["itools"] });
  const serialized = JSON.stringify(embed);
  assert.match(serialized, /Cramorant \(Normal\)/);
  assert.match(serialized, /Cramorant \(Gulping\)/);
  assert.doesNotMatch(serialized, /\(845:|CRAMORANT_GULPING|PSYDUCK_SWIM_2025/);
});

test("a single rich event embed stays inside Discord field and character limits", () => {
  const longRows = Array.from({ length: 80 }, (_, index) => ({ name: `Pokémon ${index + 1} ${"detail ".repeat(8)}` }));
  const embed = eventDigestEmbed({
    id: "large-event",
    name: "Large Event",
    start: "2026-08-20T10:00:00.000Z",
    end: "2026-08-21T10:00:00.000Z",
    scope: "global",
    bonuses: longRows.map(row => row.name),
    details: {
      spawns: longRows,
      shinies: longRows,
      raidBosses: longRows,
      sections: Array.from({ length: 20 }, (_, index) => ({
        title: `Section ${index + 1}`,
        items: longRows.map(row => row.name)
      }))
    }
  }, 0, 1);
  const characters = String(embed.title || "").length + String(embed.description || "").length +
    String(embed.footer?.text || "").length + embed.fields.reduce((total, field) =>
      total + String(field.name || "").length + String(field.value || "").length, 0);
  assert.ok(embed.fields.length <= 24);
  assert.ok(embed.fields.every(field => field.name.length <= 256 && field.value.length <= 1_024));
  assert.ok(characters <= 5_150, `single event embed had ${characters} characters`);
});

test("event digest embeds include the trusted event information graphic", () => {
  const imageUrl = "https://cdn.leekduck.com/assets/img/events/event.jpg";
  const link = "https://leekduck.com/events/local-event/";
  const embed = eventDigestEmbed({
    id: "local-event",
    name: "Local Event",
    start: "2026-08-22T23:05:00.000Z",
    end: "2026-08-23T03:05:00.000Z",
    timeZone: "America/Chicago",
    imageUrl,
    link,
    coordinates: "35.772782, 140.388296",
    scope: "venue"
  }, 0, 1);
  assert.deepEqual(embed.image, { url: imageUrl });
  assert.equal(embed.url, "https://example.com/events?event=local-event");
  assert.deepEqual(embed.fields.find(field => field.name === "📍 Coordinates & tools"), {
    name: "📍 Coordinates & tools",
    value: ":round_pushpin:`35.772782, 140.388296`\n-# [Velocity](<https://pk.md/35.772782,140.388296>) • [FlyMeGo](<https://fly.mg/coords?ll=35.772782,140.388296>) • [Google](<https://maps.google.com/maps?q=35.772782,140.388296>) • [iPogo](<https://ipogo.app/?coords=35.772782,140.388296>) • [SpooferPro](<https://spooferpro.com/?deeplink=35.772782,140.388296>) • [iTools](<https://api.cuno.bot/dl/itools1?type=itoolsbt&latlng=35.772782,140.388296>)",
    inline: false
  });
  assert.match(embed.description, /Open full details on Example Events.*example\.com\/events\?event=local-event/);
});

test("rich event embeds retain both coordinates and the Example Events page link", () => {
  const embed = eventDigestEmbed({
    id: "water-festival-2026",
    name: "Ultra Unlock: Water Festival",
    start: "2026-08-18T10:00:00.000",
    end: "2026-08-24T20:00:00.000",
    localTime: true,
    scope: "global",
    coordinates: "25.7617, -80.1918",
    species: ["Arrokuda", "Barraskewda"],
    bonuses: ["2× Catch XP", "3× Catch Stardust", "Rainy Lure Modules attract Arrokuda."],
    details: {
      spawns: [{ name: "Arrokuda" }],
      raidBosses: [{ name: "Tatsugiri (Droopy Form — Americas)" }],
      shinies: [{ name: "Dewpider" }]
    }
  }, 0, 1, { coordinateLinks: ["google"] });
  assert.equal(embed.fields.at(-1)?.name, "📍 Coordinates & tools");
  assert.match(embed.description, /example\.com\/events\?event=water-festival-2026/);
});

test("multi-stop webhooks stay compact and link to the complete GPX/detail page", () => {
  const embed = eventDigestEmbed({
    id: "lego-stamp-rally",
    name: "LEGO Stores × Pokémon GO Stamp Rally",
    eventType: "stamp-rally",
    scope: "regional",
    start: "2026-08-03T00:00:00.000Z",
    end: "2026-09-30T23:59:59.000Z",
    venues: [
      { name: "LEGO Store A", coordinates: "35.772782, 140.388296" },
      { name: "LEGO Store B", coordinates: "35.779000, 140.390000" }
    ]
  }, 0, 1, { coordinateLinks: ["itools"] });
  const field = embed.fields.find(row => row.name === "Mapped stops · iTools-compatible GPX");
  assert.ok(field);
  assert.match(field.value, /Download lego-stores-poke-mon-go-stamp-rally\.gpx · 2 stops/);
  assert.match(field.value, /example\.com\/api\/event-spawns\?public=1&format=gpx&id=lego-stamp-rally/);
  assert.match(field.value, /Share \/ Open In → iToolsGeneral/);
  assert.match(field.value, /only the numbered stop names and coordinates/);
  assert.match(field.value, /Open the route page · all tools per stop/);
  assert.match(field.value, /example\.com\/events\?event=lego-stamp-rally/);
  assert.match(field.value, /Velocity · FlyMeGo · Google · iPogo · SpooferPro · iTools/);
  assert.equal(embed.fields.some(row => /^Stamp Rally stops/.test(row.name)), false);
  assert.doesNotMatch(field.value, /pk\.md|fly\.mg|maps\.google|ipogo\.app|spooferpro\.com|api\.cuno\.bot/);
});

test("Magikarp event webhooks include the exact daily windows and research details", () => {
  const now = Date.parse("2026-08-23T12:00:00.000Z");
  const embed = eventDigestEmbed({
    id: "local-jamsil-magikarp-2026",
    name: "2026 Jamsil Magikarp Event",
    start: "2026-08-16T01:00:00.000Z",
    end: "2026-08-31T11:00:00.000Z",
    scope: "venue",
    location: "Arena Square, Jamsil, Seoul",
    timeZone: "Asia/Seoul",
    scheduleNote: "Event bonuses run August 16 at 10:00 AM through August 31 at 8:00 PM KST.",
    bonuses: [
      "Four daily Magikarp mass-outbreak windows: 12:00–12:03 PM KST, 12:30–12:33 PM KST, 1:00–1:03 PM KST, and 1:30–1:33 PM KST.",
      "One additional Special Trade during the event"
    ],
    details: {
      bonusNotes: ["All four outbreak windows repeat daily from August 16 through August 31, 2026, in KST."],
      sections: [{
        title: "Free Timed Research rewards",
        items: ["Magikarp Mass Outbreak Timed Research: 4,000 XP, 5,000 Stardust, and a Magikarp encounter."]
      }]
    }
  }, 0, 1, { viewerTimeZone: "America/New_York", now });
  const localBreakouts = embed.fields.find(field => field.name === "Magikarp breakouts — your time");
  assert.match(localBreakouts?.value || "", /configured timezone \(America\/New_York\)/);
  assert.match(localBreakouts?.value || "", /11:00 PM EDT – 11:03 PM EDT/);
  assert.match(localBreakouts?.value || "", /11:30 PM EDT – 11:33 PM EDT/);
  assert.doesNotMatch(embed.description, /12:00–12:03 PM KST|12:30–12:33 PM KST|1:00–1:03 PM KST|1:30–1:33 PM KST/);
  assert.doesNotMatch(embed.fields.map(field => field.value).join("\n"), /12:00–12:03 PM KST|12:30–12:33 PM KST|1:00–1:03 PM KST|1:30–1:33 PM KST/);
  const info = embed.fields.find(field => field.name === "🔎 Free Timed Research rewards");
  assert.match(localBreakouts?.value || "", /Repeats daily/);
  assert.doesNotMatch(embed.fields.map(field => field.value).join("\n"), /in KST/);
  assert.match(info?.value || "", /4,000 XP, 5,000 Stardust/);
  const epoch = Number((localBreakouts?.value || "").match(/<t:(\d+):t>/)?.[1]);
  assert.equal(new Date(epoch * 1_000).toISOString().slice(0, 10), "2026-08-23");
  assert.equal((localBreakouts?.value.match(/Magikarp mass outbreak/g) || []).length, 4);
  const allFields = embed.fields.map(field => `${field.name}\n${field.value}`).join("\n");
  assert.equal((allFields.match(/12:00–12:03 PM KST/g) || []).length, 0);
  assert.equal((`${embed.description}\n${allFields}`.match(/11:00 PM EDT – 11:03 PM EDT/g) || []).length, 1,
    "the recurring schedule is emitted once instead of being repeated in the description, section, and bonuses");
});

test("event digest batching respects Discord's embed count and 6,000-character limits", () => {
  const embeds = Array.from({ length: 12 }, (_, index) => ({
    title: `Event ${index + 1}`,
    description: "x".repeat(index < 9 ? 640 : 120),
    fields: [{ name: "Bonuses", value: "y".repeat(index < 9 ? 80 : 20) }],
    footer: { text: `${index + 1} of 12` }
  }));
  const batches = eventDigestBatches(embeds, "weekend", embeds.length, Date.parse("2026-08-14T12:05:00.000Z"));
  assert.ok(batches.length >= 2);
  assert.equal(batches.flat().length, embeds.length);
  assert.ok(batches.every(batch => batch.length <= 9));
  for (const [index, batch] of batches.entries()) {
    const heading = {
      title: "What’s Going On This Weekend",
      description: "12 events match your saved filters. Global rolling events show Kiribati first, then the hours that apply in each local timezone.",
      footer: { text: `Digest ${index + 1} of ${batches.length}` }
    };
    const characters = [heading, ...batch].reduce((total, embed) => total +
      String(embed.title || "").length + String(embed.description || "").length +
      String(embed.footer?.text || "").length +
      (embed.fields || []).reduce((subtotal, field) => subtotal + String(field.name || "").length + String(field.value || "").length, 0), 0);
    assert.ok(characters <= 6_000, `batch ${index + 1} had ${characters} characters`);
  }
});

test("coordinate links require one valid latitude and longitude", () => {
  assert.match(eventCoordinateLinks("-27.4698, 153.0251"), /pk\.md\/-27\.4698,153\.0251/);
  assert.equal(
    eventCoordinateLinks("35.772782,140.388296", ["itools"]),
    ":round_pushpin:`35.772782, 140.388296`\n-# [iTools](<https://api.cuno.bot/dl/itools1?type=itoolsbt&latlng=35.772782,140.388296>)"
  );
  assert.equal(eventCoordinateLinks("35.772782,140.388296", []), ":round_pushpin:`35.772782, 140.388296`");
  assert.equal(eventCoordinateLinks("Global"), "");
  assert.equal(eventCoordinateLinks("91, 10"), "");
  assert.equal(eventCoordinateLinks("10, 181"), "");
  assert.equal(eventCoordinateLinks("10,20) malicious markdown"), "");
});

test("event embeds apply each Discord destination's coordinate-link selection", () => {
  const embed = eventDigestEmbed({
    name: "Local Event",
    start: "2026-08-22T23:05:00.000Z",
    end: "2026-08-23T03:05:00.000Z",
    coordinates: "35.772782,140.388296",
    scope: "venue"
  }, 0, 1, { coordinateLinks: ["itools"] });
  const field = embed.fields.find(row => row.name === "📍 Coordinates & tools");
  assert.match(field.value, /^:round_pushpin:`35\.772782, 140\.388296`\n-# \[iTools\]/);
  assert.doesNotMatch(field.value, /Velocity|FlyMeGo|Google|iPogo|SpooferPro/);
});

test("event digest embeds reject untrusted event links", () => {
  const embed = eventDigestEmbed({
    id: "untrusted-event",
    name: "Untrusted Event",
    start: "2026-08-22T23:05:00.000Z",
    end: "2026-08-23T03:05:00.000Z",
    link: "https://example.com/redirect",
    scope: "venue"
  }, 0, 1);
  assert.equal(embed.url, "https://example.com/events?event=untrusted-event");
  assert.match(embed.description, /Open full details on Example Events.*example\.com\/events\?event=untrusted-event/);
  assert.doesNotMatch(JSON.stringify(embed), /example\.com\/redirect/);
});
