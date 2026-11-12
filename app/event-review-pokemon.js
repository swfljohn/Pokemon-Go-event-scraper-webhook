import { eventCollectorIdentity } from "./event-pokemon-identity.js";
import { POKEMON_DEFAULT_FORM_IDS } from "./pokemon-appearance-data.js";

const DETAIL_POKEMON_DEX_KEYS = ["pokedex_id", "pokedexId", "dex_id", "dexId"];
const DETAIL_POKEMON_FORM_KEYS = ["form", "form_value", "formValue", "form_id", "formId", "pokemon_form", "pokemonForm"];
const DETAIL_POKEMON_COSTUME_KEYS = ["costume", "costume_id", "costumeId"];

function detailPokemonNumber(row, keys, minimum = 0) {
  for (const key of keys) {
    if (row?.[key] === null || row?.[key] === undefined || String(row[key]).trim() === "") continue;
    const value = Number(row[key]);
    if (Number.isInteger(value) && value >= minimum) return value;
  }
  return null;
}

function detailPokemonBoolean(row, keys) {
  return keys.some(key => {
    const value = row?.[key];
    return value === true || value === 1 || (typeof value === "string" && /^(?:1|true|yes|on)$/i.test(value.trim()));
  });
}

function detailPokemonHasMaxMode(row) {
  return ["is_gigantamax", "isGigantamax", "gigantamax", "is_dynamax", "isDynamax", "dynamax",
    "is_max", "isMax", "bread_mode", "breadMode", "max_mode", "maxMode"]
    .some(key => row?.[key] !== null && row?.[key] !== undefined && String(row[key]).trim() !== "");
}

export function detailPokemonLabel(row) {
  return String(typeof row === "string" ? row : row?.name ?? row?.pokemon_name ?? row?.pokemonName ?? "").trim();
}

function detailPokemonLabelIdentity(label) {
  const maxMatch = label.match(/^(gigantamax|dynamax)\s+(.+)$/i);
  const target = maxMatch ? maxMatch[2] : label;
  try {
    const identity = eventCollectorIdentity(target);
    const match = String(identity).match(/^(\d+)(?::(\d+)|,costume(\d+))?$/i);
    if (!match) return null;
    return {
      pokedex_id: Number(match[1]),
      ...(match[2] ? { form: Number(match[2]) } : {}),
      ...(match[3] ? { costume: Number(match[3]) } : {}),
      ...(maxMatch?.[1].toLocaleLowerCase("en-US") === "gigantamax" ? { is_gigantamax: true } : {}),
      ...(maxMatch?.[1].toLocaleLowerCase("en-US") === "dynamax" ? { is_dynamax: true } : {})
    };
  } catch {
    return null;
  }
}

export function detailPokemonAppearanceKey(row) {
  const label = detailPokemonLabel(row);
  if (!label) return "";
  const source = row && typeof row === "object" ? row : {};
  const explicitDex = detailPokemonNumber(source, DETAIL_POKEMON_DEX_KEYS, 1);
  const explicitForm = detailPokemonNumber(source, DETAIL_POKEMON_FORM_KEYS);
  const explicitCostume = detailPokemonNumber(source, DETAIL_POKEMON_COSTUME_KEYS);
  const hasExplicitAppearance = explicitForm !== null || explicitCostume !== null;
  const identity = explicitDex === null || !hasExplicitAppearance ? detailPokemonLabelIdentity(label) : null;
  const dex = explicitDex ?? identity?.pokedex_id ?? null;
  const matchingIdentity = identity && (explicitDex === null || identity.pokedex_id === explicitDex) ? identity : null;
  const form = explicitForm ?? matchingIdentity?.form ?? null;
  const defaultForm = dex === null ? 0 : Number(POKEMON_DEFAULT_FORM_IDS[dex]) || 0;
  const canonicalForm = form === 0 || (defaultForm > 0 && form === defaultForm) ? null : form;
  const costume = explicitCostume ?? matchingIdentity?.costume ?? null;
  const canonicalCostume = costume === 0 ? null : costume;
  const explicitMaxMode = detailPokemonHasMaxMode(source);
  const gigantamax = detailPokemonBoolean(source, ["is_gigantamax", "isGigantamax", "gigantamax"])
    || (!explicitMaxMode && matchingIdentity?.is_gigantamax === true);
  const dynamax = detailPokemonBoolean(source, ["is_dynamax", "isDynamax", "dynamax", "is_max", "isMax"])
    || (!explicitMaxMode && matchingIdentity?.is_dynamax === true);
  const gender = detailPokemonNumber(source, ["gender", "pokemon_gender", "pokemonGender"]);
  const shadow = detailPokemonBoolean(source, ["is_shadow", "isShadow", "shadow"]);
  const maxMode = detailPokemonNumber(source, ["bread_mode", "breadMode", "max_mode", "maxMode"]);
  const appearance = [dex, canonicalForm, canonicalCostume, gigantamax, dynamax, gender, shadow, maxMode];
  if (dex !== null) return `native:${JSON.stringify(appearance)}`;
  const normalizedSource = label.normalize("NFC").toLocaleLowerCase("en-US").trim();
  const normalizedLabel = normalizedSource.replace(/[^\p{L}\p{M}\p{N}♀♂]+/gu, " ").trim().replace(/\s+/g, " ")
    || normalizedSource.replace(/\s+/g, " ");
  return `label:${JSON.stringify([normalizedLabel, ...appearance.slice(1)])}`;
}

export function mergeDetailPokemonRows(featuredRows, shinyRows, eligibilityRows = shinyRows) {
  const featured = Array.isArray(featuredRows) ? featuredRows : [];
  const shinies = Array.isArray(shinyRows) ? shinyRows : [];
  const eligibility = Array.isArray(eligibilityRows) ? eligibilityRows : [];
  const shinyKeys = new Set(eligibility.map(detailPokemonAppearanceKey).filter(Boolean));
  const seen = new Set();
  const merged = [];
  for (const row of [...featured, ...shinies]) {
    const key = detailPokemonAppearanceKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({ row, shinyEligible: shinyKeys.has(key) });
  }
  return merged;
}

export function ordinaryPokemonArtworkRow(row) {
  return row && typeof row === "object"
    ? { ...row, shiny: false, is_shiny: false, isShiny: false }
    : row;
}
