import test from "node:test";
import assert from "node:assert/strict";
import {
  appendEventBonusIcon,
  appendEventPokemonArtwork,
  eventBonusIconHtml,
  eventPokemonArtworkHtml
} from "../app/event-visuals.js";

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.parentNode = null;
    this.className = "";
    this.width = 0;
    this.height = 0;
    this._src = "";
  }
  set src(value) { this._src = String(value); }
  get src() { return this._src; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener, options = {}) {
    const rows = this.listeners.get(type) || [];
    rows.push({ listener, once: options?.once === true });
    this.listeners.set(type, rows);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(row => row.listener !== listener));
  }
  dispatch(type) {
    for (const row of [...(this.listeners.get(type) || [])]) {
      row.listener({ type, target: this });
      if (row.once) this.removeEventListener(type, row.listener);
    }
  }
  prepend(child) {
    child.parentNode?.remove(child);
    child.parentNode = this;
    this.children.unshift(child);
  }
  append(child) {
    child.parentNode?.remove(child);
    child.parentNode = this;
    this.children.push(child);
  }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    this.parentNode = null;
  }
}

class FakeDocument {
  createElement(tagName) { return new FakeElement(tagName, this); }
  createElementNS(_namespace, tagName) { return new FakeElement(tagName, this); }
}

test("exact costume, shiny, and Max labels keep their form identity in artwork candidates", () => {
  assert.match(eventPokemonArtworkHtml({ name: "Bulbasaur wearing a party hat" }), /pokemon\/1_c11\.png/);
  assert.match(eventPokemonArtworkHtml({ name: "PokéXciting! Pikachu (Pink)" }, { shiny: true }), /pokemon\/25_f3360_s\.png/);
  assert.match(eventPokemonArtworkHtml({ name: "Jigglypuff wearing a ribbon" }), /pokemon\/39_c74\.png/);
  assert.match(eventPokemonArtworkHtml({ name: "Gigantamax Charizard" }), /pokemon\/6_b2\.png/);
  assert.match(eventPokemonArtworkHtml({ name: "Dynamax Blastoise" }), /pokemon\/9_b1\.png/);
});

test("dex-only rows inherit a matching label appearance but never a mismatched identity", () => {
  assert.match(
    eventPokemonArtworkHtml({ name: "PokéXciting! Pikachu (Pink)", pokedex_id: 25 }),
    /pokemon\/25_f3360\.png/
  );
  assert.match(
    eventPokemonArtworkHtml({ name: "Bulbasaur wearing a party hat", pokedex_id: 1 }),
    /pokemon\/1_c11\.png/
  );
  assert.match(
    eventPokemonArtworkHtml({ name: "Bulbasaur wearing a party hat", pokedex_id: 25 }),
    /other\/home\/25\.png/
  );
});

test("explicit zero appearance and Max fields stay authoritative over label enrichment", () => {
  assert.match(
    eventPokemonArtworkHtml({ name: "PokéXciting! Pikachu (Pink)", pokedex_id: 25, form: 0 }),
    /other\/home\/25\.png/
  );
  assert.match(
    eventPokemonArtworkHtml({ name: "Bulbasaur wearing a party hat", pokedex_id: 1, costume: 0 }),
    /other\/home\/1\.png/
  );
  const dynamax = eventPokemonArtworkHtml({ name: "Gigantamax Charizard", pokedex_id: 6, is_dynamax: true });
  assert.match(dynamax, /pokemon\/6_b1\.png/);
  assert.doesNotMatch(dynamax, /pokemon\/6_b2\.png/);
});

test("unknown labels stay text-only and trusted numeric form data outranks the label and image URL", () => {
  assert.equal(eventPokemonArtworkHtml({ name: "Unmapped creature" }), "");
  assert.equal(eventPokemonArtworkHtml(""), "");
  assert.equal(eventPokemonArtworkHtml({ name: "Unmapped creature", imageUrl: "//events.example/untrusted.png" }), "");

  const html = eventPokemonArtworkHtml({
    name: "Bulbasaur wearing a party hat",
    pokedex_id: 25,
    form: 3360,
    imageUrl: "https://events.example/supplied.png"
  });
  assert.match(html, /pokemon\/25_f3360\.png/);
  assert.doesNotMatch(html, /pokemon\/1_c11\.png|events\.example/);
  assert.match(eventPokemonArtworkHtml({ name: "Unmapped creature", pokedex_id: 25, form: 3360 }), /pokemon\/25_f3360\.png/);
  assert.match(eventPokemonArtworkHtml({ name: "", pokedex_id: 25 }), /other\/home\/25\.png/);
});

test("DOM sprite fallback advances candidates, remains decorative, and removes an exhausted image", () => {
  const document = new FakeDocument();
  const parent = document.createElement("div");
  const image = appendEventPokemonArtwork(parent, { name: "Bulbasaur wearing a party hat" });
  assert.equal(parent.children[0], image);
  assert.equal(image.className, "event-pokemon-sprite");
  assert.equal(image.loading, "lazy");
  assert.equal(image.decoding, "async");
  assert.equal(image.referrerPolicy, "no-referrer");
  assert.equal(image.alt, "");
  assert.equal(image.getAttribute("aria-hidden"), "true");
  const first = image.src;
  image.dispatch("error");
  assert.notEqual(image.src, first);

  let attempts = 1;
  while (parent.children.includes(image) && attempts < 12) {
    image.dispatch("error");
    attempts += 1;
  }
  assert.equal(parent.children.includes(image), false);
});

test("bonus icons are authored SVG, keep category-neutral copy, and do not interpolate input", () => {
  const html = eventBonusIconHtml("3× Stardust");
  assert.match(html, /class="event-bonus-icon event-bonus-icon--stardust"/);
  assert.match(html, /aria-hidden="true" focusable="false"/);
  assert.doesNotMatch(html, /onerror|3× Stardust/);
  assert.match(eventBonusIconHtml("Unclassified reward"), /event-bonus-icon--general/);

  const document = new FakeDocument();
  const parent = document.createElement("div");
  const icon = appendEventBonusIcon(parent, "Field Research encounters");
  assert.equal(icon.tagName, "svg");
  assert.match(icon.getAttribute("class"), /event-bonus-icon--research/);
  assert.ok(icon.children.length > 0);
  assert.equal(icon.getAttribute("aria-hidden"), "true");
});

test("SSR artwork uses escaped fixed markup and never emits inline event handlers", () => {
  const sprite = eventPokemonArtworkHtml({ name: "Pikachu", imageUrl: "javascript:alert(1)" });
  assert.match(sprite, /class="event-pokemon-sprite"/);
  assert.match(sprite, /loading="lazy" decoding="async" referrerpolicy="no-referrer"/);
  assert.doesNotMatch(sprite, /javascript:|onerror|onload/);
  const icon = eventBonusIconHtml('<img src=x onerror="alert(1)">');
  assert.match(icon, /event-bonus-icon--general/);
  assert.doesNotMatch(icon, /onerror|<img/);
});
