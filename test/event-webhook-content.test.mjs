import test from "node:test";
import assert from "node:assert/strict";
import {
  eventAvailabilityGuideEmbed,
  eventDigestEmbed
} from "../app/lib/event-notifications.js";
import { featuredEventDetails } from "../app/lib/featured-event-details.js";

const baseEvent = {
  id: "ticketed-event",
  name: "Ticketed Event",
  scope: "global",
  start: "2026-10-25T10:00:00.000Z",
  end: "2026-10-26T10:00:00.000Z"
};

function cardDescriptions(event, options = {}) {
  return [
    eventAvailabilityGuideEmbed(event, 0, 1, options).description,
    eventAvailabilityGuideEmbed(event, 0, 1, { ...options, preorder: true }).description,
    eventDigestEmbed(event, 0, 1, { ...options, kind: options.kind || "week" }).description
  ];
}

test("compact preorder dedupes equivalent research task and reward shapes", () => {
  const embed = eventAvailabilityGuideEmbed({
    ...baseEvent,
    details: {
      research: [{ name: "Field Research", tasks: [{ text: "Catch 10 Pokémon", reward: "Pikachu" }] }],
      sections: [{ title: "Research", items: ["Catch 10 Pokémon → Pikachu"] }]
    }
  }, 0, 1, { preorder: true });
  const text = embed.fields.map(field => field.value).join("\n");
  assert.equal([...text.matchAll(/Catch 10 Pokémon → Pikachu/g)].length, 1);
});

test("compact preorder keeps distinct similar research tasks", () => {
  const embed = eventAvailabilityGuideEmbed({
    ...baseEvent,
    details: {
      research: [{ name: "Field Research", tasks: [
        { text: "Catch 10 Pokémon", reward: "Pikachu" },
        { text: "Catch 100 Pokémon", reward: "Pikachu" }
      ] }]
    }
  }, 0, 1, { preorder: true });
  const text = embed.fields.map(field => field.value).join("\n");
  assert.match(text, /Catch 10 Pokémon/);
  assert.match(text, /Catch 100 Pokémon/);
});

test("event digests skip research already represented by a research section", () => {
  const embed = eventDigestEmbed({
    ...baseEvent,
    details: {
      research: [{ name: "Field Research", tasks: [{ text: "Catch 10 Pokémon", reward: "Pikachu encounter" }] }],
      sections: [{ title: "Research", items: ["Catch 10 Pokémon → Pikachu encounter"] }]
    }
  }, 0, 1);
  const research = embed.fields.filter(field => /Research/.test(field.name));
  assert.equal(research.length, 1);
  assert.match(research[0].value, /Catch 10 Pokémon → Pikachu encounter/);
});

test("event digests omit empty structured research fields", () => {
  const embed = eventDigestEmbed({
    ...baseEvent,
    details: {
      research: [null, "", {}, { tasks: [] }],
      researchMethods: [{ label: "", type: "", instructions: "", rewardSpecies: [], claimDeadline: "" }]
    }
  }, 0, 1);
  assert.equal(embed.fields.some(field => /Research/.test(field.name)), false);
});

