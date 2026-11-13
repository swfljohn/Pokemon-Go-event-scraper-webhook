// Pokémon groups kept from the source article (2026-11-13): habitats, Mighty by day, incense, eggs, raids, Max by day.
import test from "node:test";
import assert from "node:assert/strict";
import { parseLeekDuckEventDetail, pokemonGroupDay } from "../app/lib/event-spawns.js";
import { buildDailyReview, dailyReviewText } from "../app/lib/daily-review.js";

const mon = name => `<li class="pkmn-list-item"><div class="pkmn-list-img"><img src="https://cdn.leekduck.com/assets/img/pokemon_icons/pm1.icon.png"></div><div class="pkmn-name">${name}</div><img class="shiny-icon" src="x"></li>`;
const ul = names => `<ul class="pkmn-list-flex">${names.map(mon).join("")}</ul>`;
const h2 = (id, title) => `<h2 class="event-section-header ${id}" id="${id}">${title}</h2>`;
const html = `<article class="event-page">
${h2("spawns", "Spawns")}<h3>Rotating Habitat Hours</h3><p>Habitats rotate every hour.</p><h4>Solid as Steel Hour</h4>${ul(["Magnemite"])}
<h3>Mighty Pokémon</h3><h4>Saturday, November 14</h4>${ul(["Scizor"])}<h4>Sunday, November 15</h4>${ul(["Kingdra"])}
${h2("eggs", "Eggs")}<h3>10 km Eggs</h3>${ul(["Honedge"])}
${h2("raids", "Raids")}<h3>Five-Star Raids</h3><h4>Saturday, November 14</h4>${ul(["Zekrom"])}<h4>Sunday, November 15</h4>${ul(["Reshiram"])}
${h2("max-battles", "Max Battles")}<h3>Saturday, November 14</h3>${ul(["Dialga"])}<h3>Sunday, November 15</h3>${ul(["Palkia"])}
</article>`;

test("article groups keep their headings and days", () => {
  assert.equal(pokemonGroupDay("Saturday, November 14"), "11-14");
  assert.equal(pokemonGroupDay("Mighty Pokémon"), "");
  const detail = parseLeekDuckEventDetail(html, { url: "https://leekduck.com/events/wild-area/" });
  const view = detail.pokemonGroups.map(group => `${group.section}|${group.title}|${group.day}|${group.pokemon.map(row => row.name).join(",")}`);
  assert.deepEqual(view, [
    "spawns|Solid as Steel Hour||Magnemite", "spawns|Mighty Pokémon|11-14|Scizor", "spawns|Mighty Pokémon|11-15|Kingdra",
    "eggs|10 km Eggs||Honedge", "raids|Five-Star Raids|11-14|Zekrom", "raids|Five-Star Raids|11-15|Reshiram",
    "max-battles|Max Battles|11-14|Dialga", "max-battles|Max Battles|11-15|Palkia"
  ]);
});

test("the daily post shows only the review day's groups", () => {
  const detail = parseLeekDuckEventDetail(html, { url: "https://leekduck.com/events/wild-area/" });
  const event = { id: "wa", scope: "global", eventType: "event", name: "Wild Area 2026: Global", start: "2026-11-14T10:00:00", end: "2026-11-15T18:00:00", localTime: true, details: detail };
  const text = dailyReviewText(buildDailyReview([event], { now: Date.parse("2026-11-13T23:00:00Z"), aheadDays: 1 }));
  for (const expected of ["Solid as Steel Hour:", "Mighty Pokémon:", "Scizor", "10 km Eggs:", "Zekrom", "Dialga"]) assert.ok(text.includes(expected), expected);
  for (const other of ["Kingdra", "Reshiram", "Palkia"]) assert.ok(!text.includes(other), other);
});
