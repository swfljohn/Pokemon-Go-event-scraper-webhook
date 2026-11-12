import { FORM_NAMES } from "./pokemon-form-names.js";
import {
  POKEMON_COSTUME_EVENTS,
  POKEMON_DEFAULT_FORM_IDS,
  POKEMON_FORM_APPEARANCES,
  POKEMON_SPECIES_NAMES
} from "./pokemon-appearance-data.js";

const HOME_ARTWORK_ROOT = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home";
const POGO_SPRITE_ROOT = "https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Pokemon";
// Pin the artwork revision so an upstream main-branch update cannot silently
// change an inventory image after it has been verified.
// 2026-10-30: moved to 7927b7d (2026-10-28) for Halloween 2026 forms (Sinistea wearing a bow); checked that existing forms still load.
const UICONS_REVISION = "7927b7d7c00a92d420307515c98b5e5f230fe91d";
const UICONS_POKEMON_ROOT = `https://raw.githubusercontent.com/WatWowMap/wwm-uicons/${UICONS_REVISION}/pokemon`;

export {
  pokemonBelongsToMegaFamily,
  pokemonCanMegaEvolve,
  pokemonHasLegacyMove,
  pokemonLegacyMoveNames,
  pokemonMoveNames,
  pokemonTypeNames
} from "./pokemon-search-metadata.js";

// Pokémon GO reports a numeric Form enum. Regional forms use the larger
// Pokemon HOME artwork while the mined GO sprites cover additional form types.
const REGIONAL_FORMS = {
  46: [10091, "Alolan"], 48: [10092, "Alolan"], 50: [10100, "Alolan"],
  52: [10101, "Alolan"], 54: [10102, "Alolan"], 56: [10103, "Alolan"],
  58: [10104, "Alolan"], 60: [10105, "Alolan"], 62: [10106, "Alolan"],
  64: [10107, "Alolan"], 66: [10108, "Alolan"], 68: [10109, "Alolan"],
  70: [10110, "Alolan"], 72: [10111, "Alolan"], 74: [10112, "Alolan"],
  76: [10113, "Alolan"], 78: [10114, "Alolan"], 80: [10115, "Alolan"],
  944: [10167, "Galarian"], 946: [10174, "Galarian"], 948: [10175, "Galarian"],
  2335: [10161, "Galarian"], 2336: [10162, "Galarian"], 2337: [10163, "Galarian"],
  2338: [10166, "Galarian"], 2339: [10168, "Galarian"], 2340: [10173, "Galarian"],
  2341: [10176, "Galarian"], 2342: [10177, "Galarian"], 2343: [10178, "Galarian"],
  2344: [10179, "Galarian"], 2345: [10180, "Galarian"], 2582: [10164, "Galarian"],
  2583: [10165, "Galarian"], 2584: [10172, "Galarian"],
  2728: [10231, "Hisuian"], 2735: [10232, "Hisuian"], 2785: [10244, "Hisuian"],
  2786: [10233, "Hisuian"], 2787: [10236, "Hisuian"], 2788: [10234, "Hisuian"],
  2789: [10237, "Hisuian"], 2790: [10241, "Hisuian"], 2791: [10242, "Hisuian"],
  2792: [10229, "Hisuian"], 2793: [10230, "Hisuian"], 2794: [10235, "Hisuian"],
  2795: [10243, "Hisuian"], 2796: [10238, "Hisuian"], 2797: [10239, "Hisuian"],
  2798: [10240, "Hisuian"],
  2799: [10171, "Galarian"], 2800: [10170, "Galarian"], 2801: [10169, "Galarian"],
  3006: [10250, "Paldean"], 3007: [10251, "Paldean"], 3008: [10252, "Paldean"],
  3009: [10253, "Paldean"]
};

const SPECIAL_FORMS = {
  2718: [10155, "Dusk Mane"],
  2719: [10156, "Dawn Wings"],
  2829: [10245, "Origin Forme"],
  2830: [10246, "Origin Forme"]
};

const GO_FORM_ASSETS = {
  1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16, 7: 17, 8: 18, 9: 19, 10: 20,
  11: 21, 12: 22, 13: 23, 14: 24, 15: 25, 16: 26, 17: 27, 18: 28, 19: 29,
  20: 30, 21: 31, 22: 32, 23: 33, 24: 34, 25: 35, 26: 36, 27: 37, 28: 38,
  29: 11, 30: 12, 31: 13, 32: 14, 33: 11, 34: 12, 35: 13, 36: 14,
  46: 61, 48: 61, 50: 61, 52: 61, 54: 61, 56: 61, 58: 61, 60: 61,
  62: 61, 64: 61, 66: 61, 68: 61, 70: 61, 72: 61, 74: 61, 76: 61,
  78: 61, 80: 61, 81: 11, 82: 14, 83: 15, 84: 16, 85: 13, 86: 12,
  87: 11, 88: 12, 89: 13, 90: 11, 91: 12, 92: 12, 93: 11, 94: 11,
  95: 12, 96: 11, 97: 12, 98: 11, 99: 12, 100: 11, 101: 12, 102: 13,
  103: 14, 104: 15, 105: 16, 106: 17, 107: 18, 108: 19, 109: 20,
  110: 21, 111: 22, 112: 23, 113: 24, 114: 25, 115: 26, 116: 27,
  117: 28, 118: 11, 119: 12, 120: 13, 136: 11, 137: 12, 138: 11,
  139: 12, 140: 11, 141: 12, 142: 11, 143: 12, 144: 11, 145: 12,
  146: 11, 147: 13, 148: 12, 149: 11, 150: 12, 151: 11, 152: 12,
  585: 11, 586: 12, 587: 13, 588: 14, 589: 11, 590: 12, 591: 13,
  592: 14, 593: 11, 594: 13, 595: 14, 596: 15, 597: 12,
  944: 31, 946: 31, 948: 31, 1856: 11, 1859: 11, 2330: 1, 2331: 1,
  2335: 31, 2336: 31, 2337: 31, 2338: 31, 2339: 31, 2341: 31,
  2342: 31, 2343: 32, 2344: 31, 2345: 31, 2501: 31, 2504: 31,
  2510: 31, 2513: 31, 2516: 31, 2582: 31, 2583: 31, 2584: 31,
  2588: 1, 2590: 1, 2592: 1, 2593: 2, 2629: 11, 2630: 12, 2631: 13,
  2632: 14, 2633: 15, 2634: 16, 2635: 17, 2636: 18, 2637: 19,
  2638: 20, 2642: 1, 2643: 2, 2644: 3, 2646: 1, 2647: 2, 2648: 3,
  2652: 1, 2689: 11, 2690: 17, 2691: 27, 2692: 26, 2693: 23,
  2694: 28, 2695: 12, 2696: 20, 2697: 13, 2698: 18, 2699: 22,
  2700: 15, 2701: 25, 2702: 14, 2703: 24, 2704: 16, 2705: 19,
  2706: 21, 2799: 31, 2800: 31, 2801: 31, 2824: 1, 2829: 12, 2830: 12
};

function pokemonHomeUrl(id, shiny = false) {
  return `${HOME_ARTWORK_ROOT}/${shiny ? "shiny/" : ""}${id}.png`;
}

function pokemonGoFormUrl(dexId, assetValue, shiny = false, costume = 0) {
  const dex = String(dexId).padStart(3, "0");
  const asset = String(assetValue).padStart(2, "0");
  const costumeSuffix = costume > 0 ? `_${String(costume).padStart(2, "0")}` : "";
  return `${POGO_SPRITE_ROOT}/pokemon_icon_${dex}_${asset}${costumeSuffix}${shiny ? "_shiny" : ""}.png`;
}

function normalizedFormText(value) {
  return String(value || "").toLocaleLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const FORM_MARKET_APPEARANCES = Object.freeze({
  "669:2616": ["Orange", ["Orange Flower Flabebe", "Orange Flower Flabébé"]],
  "150:133": ["Armored", ["Armored", "Armoured"]],
  "25:949": ["Clone", ["Clone Pikachu", "Copy Pikachu"]],
  "3:950": ["Clone", ["Clone Venusaur"]],
  "6:951": ["Clone", ["Clone Charizard"]],
  "9:952": ["Clone", ["Clone Blastoise"]],
  "25:894": ["Mimikyu Costume", ["Mimikyu Costume", "Mimikyu Pikachu"]],
  "7:895": ["Yamask Costume", ["Yamask Costume"]],
  "4:896": ["Cubone Costume", ["Cubone Costume"]],
  "1:897": ["Shedinja Costume", ["Shedinja Costume"]],
  "25:901": ["Pikachu Libre", ["Pikachu Libre", "Libre Pikachu"]],
  "25:2332": ["Flying Pikachu 2020", ["Flying Pikachu 2020", "Balloon Pikachu 2020"]],
  "131:2585": ["Scarf", ["Scarf Lapras", "Blue Bow Lapras", "Bow Tie Lapras"]],
  "94:2586": ["Banette Costume", ["Banette Costume", "Mega Banette Costume"]],
  "302:2668": ["Litwick Hat", ["Litwick Hat", "Litwick Costume"]],
  "79:2673": ["2020 Glasses", ["2020 Glasses", "2020 Slowpoke"]],
  "80:2674": ["2021 Glasses", ["2021 Glasses", "2021 Slowbro"]],
  "613:2672": ["Holiday Ribbon", ["Holiday Ribbon"]],
  "614:2820": ["Holiday Ribbon", ["Holiday Ribbon"]],
  "199:2734": ["2022 Glasses", ["2022 Glasses", "2022 Slowking"]],
  // Leek Duck's event asset is pm25.fTSHIRT_03.icon.png; the native enum is 2832.
  // Do not conflate the established Batik shirt with Anniversary 2026 Indonesia 01.
  "25:2832": ["Batik Shirt", ["Batik Shirt", "Batik Shirt Pikachu", "Pikachu wearing a batik shirt"]],
  "196:2847": ["Sun Scarf", ["Sun Scarf", "Day Scarf"]],
  "197:2848": ["Moon Scarf", ["Moon Scarf", "Night Scarf"]],
  "143:2849": ["Studded Jacket", ["Studded Jacket", "Wild Area Jacket"]],
  // Official Horizons names and Leek Duck labels refer to these catalog forms.
  "25:2842": ["Captain Pikachu", ["Captain Pikachu", "Captain Hat", "Captain's Cap", "Cap's Hat"]],
  // The 2024 Diwali debut was officially named Pikachu wearing a saree; the
  // native form catalog calls that appearance PIKACHU_DIWALI_2024.
  // https://pokemongo.com/news/festival-of-lights-2024
  "25:2850": ["Saree", ["Saree Pikachu", "Pikachu wearing a saree", "Diwali 2024"]],
  "25:2863": ["Kurta", ["Kurta Pikachu", "Pikachu wearing a kurta"]],
  // Published Pogo Costume and Form Guide gives descriptive names for these existing native forms.
  // This supports identity matching only; it does not establish availability, shiny, or background behavior.
  // Source: https://docs.google.com/spreadsheets/d/e/2PACX-1vSgA2CpShyw2Ta_5XwCKmkmbMAp_qwEu6S2Cvc9SPshp8HS-Yrl-ZqTJR45-5FrSl5EEdcFMdLw_mzj/pubhtml?gid=1433584911&single=true
  "25:3352": ["PXP 2026", ["Cosmog-themed spacesuit Pikachu"]],
  "25:3357": ["Astronaut", ["Astronaut Pikachu"]],
  // Official PokéXciting names; numeric forms are species-qualified in pogo-data-api.
  "25:3358": ["PokéXciting! Turquoise", ["PokéXciting! Pikachu (Turquoise)", "PokéXciting! Pikachu (Malaysia)", "Turquoise Afro", "Malaysia 30th Anniversary"]],
  "25:3359": ["PokéXciting! Singapore", ["PokéXciting! Pikachu (Singapore)", "Singapore 30th Anniversary"]],
  "25:3360": ["PokéXciting! Pink", ["PokéXciting! Pikachu (Pink)", "PokéXciting! Pikachu (Taipei)", "Pink Afro", "Taiwan 30th Anniversary"]],
  "25:3361": ["Orange Hanbok", ["Orange Hanbok Pikachu"]],
  "25:3379": ["Halloween 2026", ["Pikachu wearing a hat and capelet", "Hat and Capelet Pikachu"]],
  "41:3362": ["Halloween 2026 Top Hat", ["Zubat wearing a top hat", "Top Hat Zubat"]],
  "68:3369": ["Modern Jacket", ["Modern Jacket", "Modern Jacket Machamp", "Machamp wearing a modern jacket"]],
  "25:3375": ["PokéXciting! Manila", ["PokéXciting! Pikachu (Manila)", "Philippines 30th Anniversary"]],
  "4:3354": ["Friede's Goggles", ["Friede's Goggles", "Goggles 2026"]],
  "5:3355": ["Friede's Goggles", ["Friede's Goggles", "Goggles 2026"]],
  "6:3356": ["Friede's Goggles", ["Friede's Goggles", "Goggles 2026"]],
  "142:3001": ["Satchel", ["Satchel Aerodactyl", "Bag Aerodactyl"]],
  "870:2870": ["Train Conductor", ["Train Conductor", "Train-ing Falinks"]],
  "760:3021": ["Wilderness Cape", ["Wilderness Cape"]],
  "54:3019": ["Swim Ring", ["Swim Ring", "Swim Ring Psyduck"]],
  "185:3315": ["Holiday Attire", ["Holiday Attire"]],
  "737:3316": ["Holiday Attire", ["Holiday Attire"]],
  "738:3317": ["Holiday Attire", ["Holiday Attire"]],
  "132:3337": ["Pokopia Cap", ["Pokopia Cap"]],
  "132:3338": ["Pokopia Hat", ["Pokopia Hat"]],
  "222:3339": ["Pink Sunglasses", ["Pink Sunglasses"]],
  "10:3346": ["Poke Ball Hat", ["Poke Ball Hat", "Pokeball Hat"]],
  "999:3018": ["9th Anniversary Coin", ["9th Anniversary Coin", "9th Coin"]],
  "999:3351": ["10th Anniversary Coin", ["10th Anniversary Coin", "10th Coin"]]
});

// Numeric costume IDs predate form-enum costumes. Their meaning is qualified
// by species; never interpret a costume ID globally.
const NUMERIC_COSTUME_MARKET_APPEARANCES = Object.freeze({
  "25:1": ["Santa Hat", ["Santa Hat", "Holiday 2016"]],
  "172:1": ["Santa Hat", ["Santa Hat", "Holiday 2016"]],
  "25:2": ["Party Hat", ["Purple Party Hat"]],
  "172:2": ["Party Hat", ["Purple Party Hat"]],
  "25:4": ["Witch Hat", ["Witch Hat", "Halloween 2017"]],
  "25:5": ["Summer Hat", ["Summer Hat", "Straw Hat", "Summer-style"]],
  "26:5": ["Summer Hat", ["Summer Hat", "Straw Hat", "Summer-style"]],
  "7:5": ["Squirtle Squad Sunglasses", ["Squirtle Squad", "Sunglasses Squirtle"]],
  "25:7": ["Flower Crown", ["Flower Crown"]],
  "26:7": ["Flower Crown", ["Flower Crown"]],
  "133:7": ["Flower Crown", ["Flower Crown"]],
  "172:7": ["Flower Crown", ["Flower Crown"]],
  "440:7": ["Flower Crown", ["Flower Crown"]],
  "25:8": ["Beanie Hat", ["Beanie Hat", "Winter Beanie"]],
  "234:8": ["Holiday Bells", ["Holiday Bells", "Christmas Bells"]],
  "1:11": ["Red Party Hat", ["Red Party Hat", "Party Hat Red"]],
  "3:11": ["Red Party Hat", ["Red Party Hat", "Party Hat Red"]],
  "4:11": ["Red Party Hat", ["Red Party Hat", "Party Hat Red"]],
  "6:11": ["Red Party Hat", ["Red Party Hat", "Party Hat Red"]],
  "7:11": ["Red Party Hat", ["Red Party Hat", "Party Hat Red"]],
  "9:11": ["Red Party Hat", ["Red Party Hat", "Party Hat Red"]],
  "20:11": ["Party Hat", ["Party Hat", "Hatchathon Party Hat"]],
  "25:11": ["Red Party Hat", ["Red Party Hat", "Party Hat Red"]],
  "133:11": ["Red Party Hat", ["Red Party Hat", "Party Hat Red"]],
  "202:11": ["Party Hat", ["Party Hat"]],
  "265:11": ["Party Hat", ["Party Hat"]],
  "25:12": ["Flower Hat", ["Flower Hat", "Spring Flower Hat"]],
  "175:12": ["Flower Crown", ["Flower Crown"]],
  "427:12": ["Flower Crown", ["Flower Crown"]],
  "1:14": ["Pikachu Visor", ["Pikachu Visor"]],
  "4:14": ["Pikachu Visor", ["Pikachu Visor"]],
  "6:14": ["Pikachu Visor", ["Pikachu Visor"]],
  "7:14": ["Pikachu Visor", ["Pikachu Visor"]],
  "25:28": ["Party Top Hat", ["Party Top Hat", "Purple Top Hat"]],
  "25:47": ["Meloetta Hat", ["Meloetta Hat"]],
  "522:48": ["Fashion Collar", ["Fashion Collar", "Fashionable Blitzle"]],
  "25:49": ["Halloween Mischief", ["Halloween Mischief", "Mischief Hat"]],
  "393:49": ["Halloween Mischief Costume", ["Halloween Costume", "Halloween Mischief Costume", "Halloween Mischief", "Pumpkin Piplup"]],
  "426:49": ["Halloween Mischief Costume", ["Halloween Costume", "Halloween Mischief Costume", "Halloween Mischief"]],
  "363:52": ["Holiday Scarf", ["Holiday Scarf"]],
  "163:54": ["New Year Hat", ["New Year Hat", "New Years Hat"]],
  "164:54": ["New Year Hat", ["New Year Hat", "New Years Hat"]],
  "25:55": ["Gracidea Flower", ["Gracidea Flower", "Shaymin Flower"]],
  "143:55": ["Cowboy Hat", ["Cowboy Hat"]],
  "25:56": ["Cake Costume", ["Cake Costume", "Anniversary Cake"]],
  "37:57": ["Spooky Festival", ["Spooky Festival", "Halloween Festival"]],
  "94:57": ["Spooky Festival Costume", ["Spooky Festival Costume", "Spooky Festival"]],
  "710:57": ["Spooky Festival", ["Spooky Festival", "Halloween Festival"]],
  "94:58": ["Banette Costume", ["Banette Costume", "Mega Banette Costume"]],
  "355:58": ["Flower Crown", ["Flower Crown", "Dia de Muertos", "Cempasuchil Crown", "Duskull wearing a cempasúchil crown"]],
  "359:58": ["Flower Crown", ["Flower Crown", "Dia de Muertos"]],
  "25:60": ["New Year Hat", ["New Year Hat", "Star Top Hat"]],
  "25:61": ["Brendan Hat", ["Brendan Hat", "Hoenn Bandana"]],
  "25:63": ["Cherry Blossoms", ["Cherry Blossoms", "Cherry Blossom Crown"]],
  "133:63": ["Cherry Blossoms", ["Cherry Blossoms", "Cherry Blossom Crown"]],
  "131:64": ["Blanche Accessory", ["Blanche Accessory", "Blanche Bow"]],
  "77:65": ["Candela Accessory", ["Candela Accessory", "Candela Ponyta"]],
  "239:66": ["Spark Accessory", ["Spark Accessory", "Spark Elekid"]],
  "143:67": ["Nightcap", ["Nightcap", "Sleeping Cap"]],
  "133:68": ["Cherry Blossoms", ["Cherry Blossoms", "Cherry Blossom Crown"]],
  "700:68": ["Cherry Blossoms", ["Cherry Blossoms", "Cherry Blossom Crown"]],
  "25:69": ["Detective Pikachu", ["Detective Pikachu", "Detective Hat"]],
  "104:70": ["Flower Crown", ["Flower Crown", "Dia de Muertos", "Cempasuchil Crown", "Cubone wearing a cempasúchil crown"]],
  "105:70": ["Flower Crown", ["Flower Crown", "Dia de Muertos"]],
  "149:70": ["Fashionable Costume", ["Fashionable Dragonite", "Fashion Costume"]],
  "25:71": ["Tricks and Treats", ["Tricks and Treats", "Tricks & Treats"]],
  "79:72": ["Detective Hat", ["Detective Hat", "Detective Slowpoke"]],
  "25:73": ["Holiday Outfit", ["Holiday Outfit", "Holiday 2023"]],
  "54:73": ["Holiday Outfit", ["Holiday Outfit", "Holiday Psyduck"]],
  "39:74": ["Ribbon", ["Ribbon", "New Year Ribbon", "Pink Bow"]],
  "40:74": ["Ribbon", ["Ribbon", "New Year Ribbon", "Pink Bow"]],
  "546:75": ["Flower Crown", ["Flower Crown"]],
  "88:78": ["Party Hat", ["Party Hat", "Anniversary Hat"]],
  "656:79": ["Halloween Costume", ["Halloween Costume"]],
  "722:79": ["Pokémon Halloween Costume", ["Pokémon Halloween Costume", "Halloween Costume"]],
  "702:80": ["Holiday Attire", ["Holiday Attire"]],
  "831:80": ["Holiday Attire", ["Holiday Attire"]],
  "31:83": ["Royal Crown", ["Royal Crown", "Crowned Nidoqueen"]],
  "34:83": ["Royal Crown", ["Royal Crown", "Crowned Nidoking"]],
  "714:85": ["Headband", ["Headband"]],
  "216:85": ["Witch Hat", ["Witch Hat"]],
  "907:82": ["Liko Pin Hat", ["Liko Pin", "Liko Hat"]]
});

function firstDefined(row, names) {
  for (const name of names) {
    if (row?.[name] !== undefined && row?.[name] !== null && row?.[name] !== "") return row[name];
  }
  return undefined;
}

function integerField(row, names) {
  const value = Number(firstDefined(row, names));
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function pokemonGenderLabel(row) {
  const raw = firstDefined(row, ["gender", "pokemon_gender", "pokemonGender"]) ??
    firstDefined(row?.pokemon_display, ["gender", "pokemon_gender", "pokemonGender"]) ??
    firstDefined(row?.pokemonDisplay, ["gender", "pokemon_gender", "pokemonGender"]);
  const numeric = Number(raw);
  if (raw !== undefined && raw !== null && raw !== "" && Number.isFinite(numeric)) {
    if (Math.trunc(numeric) === 1) return "Male ♂";
    if (Math.trunc(numeric) === 2) return "Female ♀";
    if (Math.trunc(numeric) === 3) return "Genderless";
    return "";
  }
  const normalized = String(raw || "").trim().toLocaleLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "male" || normalized === "m" || normalized === "♂") return "Male ♂";
  if (normalized === "female" || normalized === "f" || normalized === "♀") return "Female ♀";
  if (normalized === "genderless" || normalized === "nogender") return "Genderless";
  return "";
}

function booleanField(row, names) {
  const value = firstDefined(row, names);
  if (typeof value === "string") return /^(?:1|true|yes|on)$/i.test(value.trim());
  return value === true || value === 1;
}

function pokemonAppearanceNumbers(row) {
  const dexId = Math.max(1, integerField(row, ["pokedex_id", "pokedexId", "dex_id", "dexId"]));
  return {
    dexId,
    form: integerField(row, ["form", "form_value", "formValue", "form_id", "formId", "pokemon_form", "pokemonForm"]),
    costume: integerField(row, ["costume", "costume_id", "costumeId"])
  };
}

function structuredFormAppearance(row) {
  const { dexId, form } = pokemonAppearanceNumbers(row);
  const value = POKEMON_FORM_APPEARANCES[`${dexId}:${form}`];
  return value ? {
    dexId,
    form,
    species: value[0],
    name: value[1],
    proto: value[2],
    isCostume: value[3] === 1
  } : null;
}

function readableAppearanceName(value) {
  return String(value || "")
    .replace(/\bGofest\b/ig, "GO Fest")
    .replace(/\bGotour\b/ig, "GO Tour")
    .replace(/\bWildarea\b/ig, "Wild Area")
    .replace(/\bPxp\b/ig, "PXP")
    .replace(/\bWcs\b/ig, "WCS")
    .replace(/\bTshirt\b/ig, "T-shirt")
    .replace(/\bSscarf\b/ig, "Sun Scarf")
    .replace(/\bMscarf\b/ig, "Moon Scarf")
    .replace(/\bStiara\b/ig, "Sun Tiara")
    .replace(/\bMtiara\b/ig, "Moon Tiara")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueLabels(values) {
  return [...new Map(values
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .map(value => [normalizedFormText(value), value])).values()];
}

export function pokemonAppearanceMarketProfile(row) {
  const { dexId, form, costume } = pokemonAppearanceNumbers(row);
  if (costume > 0) {
    const known = NUMERIC_COSTUME_MARKET_APPEARANCES[`${dexId}:${costume}`];
    const event = POKEMON_COSTUME_EVENTS[costume] || [];
    return Object.freeze({
      label: known?.[0] || readableAppearanceName(event[0]) || `Costume ${costume}`,
      aliases: Object.freeze(uniqueLabels(known?.[1] || [])),
      autoPriceSafe: Boolean(known?.[1]?.length),
      isCostume: true
    });
  }
  const appearance = structuredFormAppearance(row);
  if (!appearance) return Object.freeze({ label: "", aliases: Object.freeze([]), autoPriceSafe: true, isCostume: false });
  const known = FORM_MARKET_APPEARANCES[`${dexId}:${form}`];
  const readable = readableAppearanceName(appearance.name);
  const ambiguous = /^(?:[a-z]|20\d{2}|costume(?: 20\d{2})?|fall 2019|vs 2019)$/i.test(readable) ||
    /(?:^|\s)(?:a|b|c|01|02)(?:\s|$)/i.test(readable);
  const aliases = uniqueLabels(known?.[1] || (!ambiguous && readable ? [readable] : []));
  return Object.freeze({
    label: known?.[0] || readable,
    aliases: Object.freeze(aliases),
    autoPriceSafe: !appearance.isCostume || aliases.length > 0,
    isCostume: appearance.isCostume
  });
}

function pokemonUiconsUrl(row, { shiny = false, gender = true, alignment = true } = {}) {
  const { dexId, form, costume } = pokemonAppearanceNumbers(row);
  const defaultForm = Number(POKEMON_DEFAULT_FORM_IDS[dexId]) || 0;
  const explicitForm = form > 0 && form !== defaultForm ? form : 0;
  const breadMode = integerField(row, ["bread_mode", "breadMode", "max_mode", "maxMode"]);
  const gigantamax = booleanField(row, ["is_gigantamax", "isGigantamax", "gigantamax"]) || breadMode === 2;
  const dynamax = !gigantamax && (
    booleanField(row, ["is_dynamax", "isDynamax", "dynamax", "is_max", "isMax"]) || breadMode === 1
  );
  let file = String(dexId);
  if (gigantamax) file += "_b2";
  else if (dynamax) file += "_b1";
  if (explicitForm) file += `_f${explicitForm}`;
  if (costume) file += `_c${costume}`;
  if (gender && integerField(row, ["gender", "pokemon_gender", "pokemonGender"]) === 2) file += "_g2";
  if (alignment && booleanField(row, ["is_shadow", "isShadow", "shadow"])) file += "_a1";
  if (shiny) file += "_s";
  return `${UICONS_POKEMON_ROOT}/${file}.png`;
}

export function pokemonGameFormNames(row) {
  const { dexId, form } = pokemonAppearanceNumbers(row);
  const structured = structuredFormAppearance(row);
  if (structured) return [`${structured.species} (${readableAppearanceName(structured.name)})`];
  // Default form IDs are species-specific base identities. Falling back to a
  // family-wide hand list here previously marked ordinary Eevee as costumed.
  if (form > 0 && form === Number(POKEMON_DEFAULT_FORM_IDS[dexId])) return [];
  const names = FORM_NAMES[form] || [];
  const species = normalizedFormText(firstDefined(row, ["pokemon_name", "pokemonName", "name"]));
  if (!species) return [];
  const baseName = label => normalizedFormText(String(label).replace(/\s*\([^)]*\)\s*$/, ""));
  const exact = names.filter(label => baseName(label) === species);
  if (exact.length) return exact;
  return names.filter(label => baseName(label).endsWith(` ${species}`));
}

export function pokemonCostumeSearchLabels(species) {
  const normalizedSpecies = normalizedFormText(species);
  if (!normalizedSpecies) return [];
  const labels = [];
  for (const [key, appearance] of Object.entries(POKEMON_FORM_APPEARANCES)) {
    if (!appearance[3] || normalizedFormText(appearance[0]) !== normalizedSpecies) continue;
    const [dexId, form] = key.split(":").map(Number);
    const profile = pokemonAppearanceMarketProfile({ pokedex_id: dexId, form });
    labels.push(profile.label, ...profile.aliases);
  }
  for (const [key, appearance] of Object.entries(NUMERIC_COSTUME_MARKET_APPEARANCES)) {
    const [dexId, costume] = key.split(":").map(Number);
    if (normalizedFormText(POKEMON_SPECIES_NAMES[dexId]) !== normalizedSpecies) continue;
    const profile = pokemonAppearanceMarketProfile({ pokedex_id: dexId, costume });
    labels.push(profile.label, ...appearance[1]);
  }
  return uniqueLabels(labels);
}

export function pokemonGameFormSearchTerms(row) {
  const form = Number(row?.form ?? row?.form_value ?? row?.form_id ?? row?.formId ?? row?.pokemon_form);
  const names = pokemonGameFormNames(row);
  return [
    ...names,
    ...names.flatMap(label => [...label.matchAll(/\(([^)]+)\)/g)].map(match => match[1])),
    ...(form > 0 ? [`form${form}`, `form ${form}`] : [])
  ];
}

export function pokemonIsCostume(row) {
  if (pokemonAppearanceNumbers(row).costume > 0) return true;
  return Boolean(structuredFormAppearance(row)?.isCostume);
}

function pokemonGameFormLabel(row) {
  const profile = pokemonAppearanceMarketProfile(row);
  if (profile.label) return profile.label;
  const species = normalizedFormText(firstDefined(row, ["pokemon_name", "pokemonName", "name"]));
  const label = pokemonGameFormNames(row)[0] || "";
  const parenthetical = label.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (parenthetical) return parenthetical;
  const normalized = normalizedFormText(label);
  if (!normalized || normalized === species) return "";
  if (normalized.startsWith("alola ")) return "Alolan";
  if (normalized.startsWith("galarian ")) return "Galarian";
  if (normalized.startsWith("hisuian ")) return "Hisuian";
  if (normalized.startsWith("paldean ")) return "Paldean";
  return label;
}

export function pokemonFormLabel(row) {
  const form = Number(row?.form ?? row?.form_value ?? row?.form_id ?? row?.formId ?? row?.pokemon_form);
  const specialLabel = SPECIAL_FORMS[form]?.[1];
  if (specialLabel) return specialLabel;
  const numericLabel = REGIONAL_FORMS[form]?.[1];
  if (numericLabel) return numericLabel;
  const reported = String(
    row?.form_name ?? row?.formName ?? row?.regional_form ?? row?.regionalForm ?? ""
  ).trim().toLocaleLowerCase();
  if (reported.includes("alola")) return "Alolan";
  if (reported.includes("galar")) return "Galarian";
  if (reported.includes("hisui")) return "Hisuian";
  if (reported.includes("paldea")) return "Paldean";
  return pokemonGameFormLabel(row);
}

const POKEDEX_REGIONS = [
  [1, 151, "Kanto"],
  [152, 251, "Johto"],
  [252, 386, "Hoenn"],
  [387, 493, "Sinnoh"],
  [494, 649, "Unova"],
  [650, 721, "Kalos"],
  [722, 809, "Alola"],
  [810, 898, "Galar"],
  [899, 905, "Hisui"],
  [906, 1025, "Paldea"]
];

export function pokemonRegionLabel(row) {
  const regionalForm = pokemonFormLabel(row);
  if (regionalForm) return regionalForm;
  const dexId = Number(row?.pokedex_id ?? row?.pokedexId ?? row?.dex_id ?? row?.dexId);
  return POKEDEX_REGIONS.find(([minimum, maximum]) => dexId >= minimum && dexId <= maximum)?.[2] || "";
}

export function pokemonArtworkCandidates(row) {
  const { dexId, form, costume } = pokemonAppearanceNumbers(row);
  const shiny = booleanField(row, ["is_shiny", "isShiny", "shiny"]);
  const shadow = booleanField(row, ["is_shadow", "isShadow", "shadow"]);
  const female = integerField(row, ["gender", "pokemon_gender", "pokemonGender"]) === 2;
  const breadMode = integerField(row, ["bread_mode", "breadMode", "max_mode", "maxMode"]);
  const gigantamax = booleanField(row, ["is_gigantamax", "isGigantamax", "gigantamax"]) || breadMode === 2;
  const dynamax = !gigantamax && (
    booleanField(row, ["is_dynamax", "isDynamax", "dynamax", "is_max", "isMax"]) || breadMode === 1
  );
  const regional = REGIONAL_FORMS[form];
  const special = SPECIAL_FORMS[form];
  const assetValue = GO_FORM_ASSETS[form];
  const appearance = structuredFormAppearance(row);
  const exactFormIdentity = appearance && !regional && !special && !assetValue &&
    form !== Number(POKEMON_DEFAULT_FORM_IDS[dexId]);
  const needsExactUicon = costume > 0 || exactFormIdentity || dynamax || gigantamax;
  const candidates = [];

  // Every candidate in this block preserves shiny, form/costume, and Max
  // identity. Gender and the Shadow art layer may be relaxed only when that
  // exact optional sprite file is absent.
  if (needsExactUicon) {
    candidates.push(pokemonUiconsUrl(row, { shiny }));
    if (shadow) candidates.push(pokemonUiconsUrl(row, { shiny, alignment: false }));
    if (female) candidates.push(pokemonUiconsUrl(row, { shiny, gender: false }));
    if (shadow && female) {
      candidates.push(pokemonUiconsUrl(row, { shiny, gender: false, alignment: false }));
    }
  }

  if (costume > 0 && assetValue) candidates.push(pokemonGoFormUrl(dexId, assetValue, shiny, costume));
  if (special) candidates.push(pokemonHomeUrl(special[0], shiny));
  if (regional) candidates.push(pokemonHomeUrl(regional[0], shiny));
  if (assetValue) candidates.push(pokemonGoFormUrl(dexId, assetValue, shiny));
  candidates.push(pokemonHomeUrl(dexId, shiny));
  return [...new Set(candidates)];
}
