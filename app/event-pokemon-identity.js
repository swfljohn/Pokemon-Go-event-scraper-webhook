import { pokemonDexIdByName } from "./pokemon-search-metadata.js";
import { POKEMON_SPECIES_NAMES, POKEMON_DEFAULT_FORM_IDS, POKEMON_FORM_APPEARANCES, POKEMON_COSTUME_EVENTS } from "./pokemon-appearance-data.js";
import { FORM_NAMES } from "./pokemon-form-names.js";
import { pokemonAppearanceMarketProfile } from "./pokemon-form-artwork.js";

// Shared by the chooser and server. Never broaden an unresolved costume to
// plain species, or infer a numeric costume's meaning across species.
const nameKey = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/\b(?:wearing|with) (?:a |an )?/g, " ")
  .replace(/\balolan\b/g, "alola").replace(/\bgalarian\b/g, "galar")
  .replace(/\bhisuian\b/g, "hisui").replace(/\bpaldean\b/g, "paldea")
  .replace(/\b(?:form|forme)\b/g, " ").replace(/[^a-z0-9♀♂]+/g, " ").trim()
  .split(/\s+/).sort().join(" ");

export function eventCollectorIdentity(target) {
  const dex = pokemonDexIdByName(target);
  if (dex) return `${dex}${POKEMON_DEFAULT_FORM_IDS[dex] ? `:${POKEMON_DEFAULT_FORM_IDS[dex]}` : ""}`;
  const wanted = nameKey(target);
  const matches = new Set();
  // The appearance table omits ordinary/default forms. Their explicit native
  // aliases still distinguish forms such as Incarnate from Therian; match the
  // existing form-name catalog exactly instead of dropping the form suffix.
  for (const [dexId, form] of Object.entries(POKEMON_DEFAULT_FORM_IDS)) {
    const species = POKEMON_SPECIES_NAMES[dexId];
    if (species && (FORM_NAMES[form] || []).some(alias =>
      nameKey(alias).includes(nameKey(species)) && nameKey(alias) === wanted)) matches.add(`${dexId}:${form}`);
  }
  for (const [identity, [species, formName]] of Object.entries(POKEMON_FORM_APPEARANCES)) {
    const [dexId, form] = identity.split(":").map(Number);
    const appearance = pokemonAppearanceMarketProfile({ pokedex_id: dexId, form });
    const aliases = [formName, appearance.label, ...appearance.aliases,
      ...(FORM_NAMES[form] || []).filter(label => nameKey(label).includes(nameKey(species)))];
    if (aliases.some(alias => [alias, `${species} ${alias}`].some(value => nameKey(value) === wanted))) matches.add(identity);
  }
  for (const [dexId, species] of Object.entries(POKEMON_SPECIES_NAMES)) {
    if (!` ${wanted} `.includes(` ${nameKey(species)} `)) continue;
    for (const costume of Object.keys(POKEMON_COSTUME_EVENTS)) {
      const appearance = pokemonAppearanceMarketProfile({ pokedex_id: dexId, costume });
      if (!appearance.autoPriceSafe) continue;
      const exactAliases = [appearance.label, ...appearance.aliases];
      // Generic party hats are usable only when this species has one match.
      const aliases = [...exactAliases, ...exactAliases.map(label => label.replace(/\b(?:red|purple) party hat\b/i, "Party Hat"))];
      if (aliases.some(alias => nameKey(`${species} ${alias}`) === wanted)) matches.add(`${dexId},costume${costume}`);
    }
  }
  if (matches.size !== 1) throw new TypeError(`${target}: ${matches.size ? "ambiguous" : "unmapped"} native form/costume. No broader species will be substituted.`);
  return [...matches][0];
}
