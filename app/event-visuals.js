import { eventCollectorIdentity } from "./event-pokemon-identity.js";
import { pokemonArtworkCandidates } from "./pokemon-form-artwork.js";
import { pokemonDexIdByName } from "./pokemon-search-metadata.js";

const CACHE_LIMIT = 256;
const identityCache = new Map();
const descriptorCache = new Map();

const DEX_KEYS = ["pokedex_id", "pokedexId", "dex_id", "dexId"];
const FORM_KEYS = ["form", "form_value", "formValue", "form_id", "formId", "pokemon_form", "pokemonForm"];
const COSTUME_KEYS = ["costume", "costume_id", "costumeId"];

function boundedGet(cache, key) {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function boundedSet(cache, key, value) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return value;
}

function firstNumeric(row, keys, minimum = 0) {
  for (const key of keys) {
    if (row?.[key] === null || row?.[key] === undefined || String(row[key]).trim() === "") continue;
    const value = Number(row?.[key]);
    if (Number.isInteger(value) && value >= minimum) return value;
  }
  return null;
}

function parseCollectorIdentity(value) {
  if (value && typeof value === "object") {
    const dex = firstNumeric(value, DEX_KEYS, 1);
    if (dex) {
      return {
        pokedex_id: dex,
        ...(firstNumeric(value, FORM_KEYS) !== null ? { form: firstNumeric(value, FORM_KEYS) } : {}),
        ...(firstNumeric(value, COSTUME_KEYS) !== null ? { costume: firstNumeric(value, COSTUME_KEYS) } : {}),
      };
    }
  }
  const match = String(value ?? "").trim().match(/^(\d+)(?::(\d+)|,costume(\d+))?$/i);
  if (!match || Number(match[1]) <= 0) return null;
  return {
    pokedex_id: Number(match[1]),
    ...(match[2] ? { form: Number(match[2]) } : {}),
    ...(match[3] ? { costume: Number(match[3]) } : {}),
  };
}

function exactIdentityForLabel(label) {
  const normalized = String(label ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
  if (!normalized) return null;
  const cached = boundedGet(identityCache, normalized);
  if (cached !== undefined) return cached;

  const maxMatch = normalized.match(/^(gigantamax|dynamax)\s+(.+)$/i);
  if (maxMatch) {
    const baseName = String(label).trim().replace(/^(gigantamax|dynamax)\s+/i, "");
    const dex = pokemonDexIdByName(baseName);
    const identity = Number.isInteger(Number(dex)) && Number(dex) > 0
      ? { pokedex_id: Number(dex), ...(maxMatch[1].toLowerCase() === "gigantamax" ? { is_gigantamax: true } : { is_dynamax: true }) }
      : null;
    return boundedSet(identityCache, normalized, identity);
  }

  let identity = null;
  try {
    identity = parseCollectorIdentity(eventCollectorIdentity(String(label ?? "").trim()));
  } catch {
    // Unmapped event names are allowed to render without artwork.
  }
  return boundedSet(identityCache, normalized, identity);
}

function booleanAlias(row, keys) {
  return keys.some(key => {
    const value = row?.[key];
    return value === true || value === 1 || (typeof value === "string" && /^(?:1|true|yes|on)$/i.test(value.trim()));
  });
}

function hasExplicitMaxMode(row) {
  return ["is_gigantamax", "isGigantamax", "gigantamax", "is_dynamax", "isDynamax", "dynamax",
    "is_max", "isMax", "bread_mode", "breadMode", "max_mode", "maxMode"]
    .some(key => row?.[key] !== null && row?.[key] !== undefined && String(row[key]).trim() !== "");
}

function safeImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (!/^https:\/\//i.test(value)) return null;
  try {
    const url = new URL(value, "https://dashboard.invalid/");
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function artworkDescriptor(row, shiny) {
  const label = typeof row === "string" ? row : row?.name ?? row?.pokemon_name ?? row?.pokemonName ?? "";
  const source = typeof row === "object" && row ? row : {};
  const explicitDex = firstNumeric(source, DEX_KEYS, 1);
  const explicitForm = firstNumeric(source, FORM_KEYS);
  const explicitCostume = firstNumeric(source, COSTUME_KEYS);
  const identity = explicitDex === null || (explicitForm === null && explicitCostume === null)
    ? exactIdentityForLabel(label)
    : null;
  const explicitMaxMode = hasExplicitMaxMode(source);

  const artworkRow = { ...source };
  if (explicitDex !== null) {
    artworkRow.pokedex_id = explicitDex;
    if (explicitForm !== null) artworkRow.form = explicitForm;
    if (explicitCostume !== null) artworkRow.costume = explicitCostume;
    // Explicit numeric appearance fields are authoritative; labels may only fill
    // missing appearance fields after the label resolves to this same dex.
    if (explicitForm !== null || explicitCostume !== null) {
      delete artworkRow.is_gigantamax;
      delete artworkRow.is_dynamax;
      if (source.is_gigantamax === true) artworkRow.is_gigantamax = true;
      if (source.is_dynamax === true) artworkRow.is_dynamax = true;
    } else if (identity?.pokedex_id === explicitDex) {
      if (identity.form !== undefined) artworkRow.form = identity.form;
      if (identity.costume !== undefined) artworkRow.costume = identity.costume;
      if (!explicitMaxMode && identity.is_gigantamax) artworkRow.is_gigantamax = true;
      if (!explicitMaxMode && identity.is_dynamax) artworkRow.is_dynamax = true;
    }
  } else if (identity) {
    artworkRow.pokedex_id = identity.pokedex_id;
    if (explicitForm !== null) artworkRow.form = explicitForm;
    else if (identity.form !== undefined) artworkRow.form = identity.form;
    if (explicitCostume !== null) artworkRow.costume = explicitCostume;
    else if (identity.costume !== undefined) artworkRow.costume = identity.costume;
    if (!explicitMaxMode && identity.is_gigantamax) artworkRow.is_gigantamax = true;
    if (!explicitMaxMode && identity.is_dynamax) artworkRow.is_dynamax = true;
  }

  const useShiny = shiny === true || booleanAlias(source, ["is_shiny", "isShiny", "shiny"]);
  const key = JSON.stringify([
    firstNumeric(artworkRow, DEX_KEYS, 1),
    firstNumeric(artworkRow, FORM_KEYS),
    firstNumeric(artworkRow, COSTUME_KEYS),
    booleanAlias(artworkRow, ["is_gigantamax", "isGigantamax", "gigantamax"]),
    booleanAlias(artworkRow, ["is_dynamax", "isDynamax", "dynamax", "is_max", "isMax"]),
    firstNumeric(artworkRow, ["gender", "pokemon_gender", "pokemonGender"]),
    booleanAlias(artworkRow, ["is_shadow", "isShadow", "shadow"]),
    firstNumeric(artworkRow, ["bread_mode", "breadMode", "max_mode", "maxMode"]),
    useShiny,
    safeImageUrl(source.imageUrl ?? source.image_url),
  ]);
  const cached = boundedGet(descriptorCache, key);
  if (cached) return cached;

  const candidates = [];
  const hasExactDex = firstNumeric(artworkRow, DEX_KEYS, 1) !== null;
  if (useShiny) {
    artworkRow.is_shiny = true;
  }
  try {
    if (hasExactDex) {
      for (const candidate of pokemonArtworkCandidates(artworkRow)) {
        if (typeof candidate === "string" && candidate.startsWith("https://") && !candidates.includes(candidate)) candidates.push(candidate);
      }
    }
  } catch {
    // Unknown event labels intentionally remain text-only.
  }
  const imageUrl = safeImageUrl(source.imageUrl ?? source.image_url);
  if (imageUrl && !candidates.includes(imageUrl)) candidates.push(imageUrl);
  return boundedSet(descriptorCache, key, Object.freeze(candidates));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function spriteMarkup(candidates) {
  const src = candidates[0];
  if (!src) return "";
  return `<img class="event-pokemon-sprite" src="${escapeHtml(src)}" width="40" height="40" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="" aria-hidden="true">`;
}

const BONUS_CATEGORY = [
  ["xp", /\b(?:xp|experience)\b/i],
  ["stardust", /stardust/i],
  ["candy", /candy|candies/i],
  ["egg", /egg|hatch/i],
  ["raid", /raid|boss/i],
  ["incense", /incense|lure/i],
  ["research", /research|field task|quest/i],
  ["catch", /catch|encounter|pok[eé]mon/i],
  ["social", /friend|snapshot|photo/i],
];

const BONUS_PATHS = {
  xp: '<path d="M5 18V9m7 9V5m7 13v-6"/><path d="M3 21h18"/>',
  stardust: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  candy: '<path d="M7.5 7.5 5 5 3 7l2.5 2.5M16.5 16.5 19 19l2-2-2.5-2.5"/><path d="M8 6.5a4 4 0 0 1 5.5 0l4 4a4 4 0 0 1-5.5 5.5l-4-4A4 4 0 0 1 8 6.5Z"/>',
  egg: '<path d="M19 14c0 4-3.1 7-7 7s-7-3-7-7 3.2-12 7-12 7 8 7 12Z"/><path d="m11 9 2 2-2 2 2 2"/>',
  raid: '<path d="M4 20h16M6 20V9h12v11M4 9h16l-8-6-8 6Z"/><path d="M10 13h4v7h-4z"/>',
  incense: '<path d="M12 21c4 0 7-2.7 7-6.4 0-2.6-1.5-4.7-4-6.6.1 2.4-1 3.7-2.2 4.5C12.7 8.8 10.7 5.8 8 3c.2 4.2-3 6.5-3 11.2C5 18.3 7.8 21 12 21Z"/><path d="M12 21c-1.7 0-3-1.3-3-3 0-1.3.7-2.2 2-3.4.1 1.4 1.1 2 2 2.4"/>',
  research: '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 0 5 22V4.5Z"/><path d="M5 5h14M9 9h6m-6 4h5"/>',
  catch: '<circle cx="12" cy="12" r="9"/><path d="M3.5 10h17M12 10v11"/><circle cx="12" cy="10" r="2"/>',
  social: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 11a3 3 0 1 0-1-5.8M17 14.5h1a3 3 0 0 1 3 3V20"/>',
  general: '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
};

function bonusCategory(text) {
  const value = String(text ?? "");
  return BONUS_CATEGORY.find(([, pattern]) => pattern.test(value))?.[0] ?? "general";
}

function bonusIconMarkup(text) {
  const category = bonusCategory(text);
  return `<svg class="event-bonus-icon event-bonus-icon--${category}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${BONUS_PATHS[category]}</svg>`;
}

function appendAuthoredSvgShapes(svg, doc, markup) {
  for (const tagMatch of String(markup).matchAll(/<(path|circle)\s+([^>]+)\/>/g)) {
    const shape = doc.createElementNS("http://www.w3.org/2000/svg", tagMatch[1]);
    for (const attribute of tagMatch[2].matchAll(/([a-z-]+)="([^"]*)"/g)) {
      shape.setAttribute(attribute[1], attribute[2]);
    }
    svg.append(shape);
  }
}

export function eventPokemonArtworkHtml(row, { shiny = false } = {}) {
  return spriteMarkup(artworkDescriptor(row, shiny));
}

export function eventBonusIconHtml(text) {
  return bonusIconMarkup(text);
}

export function appendEventPokemonArtwork(parent, row, { shiny = false } = {}) {
  const candidates = artworkDescriptor(row, shiny);
  if (!parent || !candidates.length) return null;
  const doc = parent.ownerDocument ?? globalThis.document;
  if (!doc?.createElement) return null;
  const image = doc.createElement("img");
  image.className = "event-pokemon-sprite";
  image.width = 40;
  image.height = 40;
  image.loading = "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.alt = "";
  image.setAttribute("aria-hidden", "true");

  let candidateIndex = 0;
  const onError = () => {
    candidateIndex += 1;
    if (candidateIndex < candidates.length) {
      image.src = candidates[candidateIndex];
      return;
    }
    image.removeEventListener?.("error", onError);
    image.remove();
  };
  const onLoad = () => image.removeEventListener?.("error", onError);
  image.addEventListener?.("error", onError);
  image.addEventListener?.("load", onLoad, { once: true });
  image.src = candidates[0];
  if (typeof parent.prepend === "function") parent.prepend(image);
  else parent.append(image);
  return image;
}

export function appendEventBonusIcon(parent, text) {
  if (!parent) return null;
  const doc = parent.ownerDocument ?? globalThis.document;
  if (!doc?.createElementNS) return null;
  const category = bonusCategory(text);
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", `event-bonus-icon event-bonus-icon--${category}`);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  // All shapes are authored constants selected from a closed category table.
  appendAuthoredSvgShapes(svg, doc, BONUS_PATHS[category]);
  if (typeof parent.prepend === "function") parent.prepend(svg);
  else parent.append(svg);
  return svg;
}

// Ordered artwork URLs for a Pokémon label or row (forms, costumes, Mega/Shadow resolved like the event pages).
// Resolved {pokedex_id, form?, costume?} for a Pokémon label, or null when the label is unknown or ambiguous.
export function eventPokemonIdentity(label) {
  const identity = exactIdentityForLabel(label);
  return identity ? { ...identity } : null;
}

export function eventPokemonArtworkCandidates(row, { shiny = false } = {}) {
  return artworkDescriptor(row, shiny);
}
