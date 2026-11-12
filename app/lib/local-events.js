import { calendarEventTimestamp } from "../event-calendar.js";
import { festivalOfLightsEvent, iitDelhiEvent } from "./official-regional-overlays.js";
import { stampRallyAnnouncements } from "./stamp-rally-announcements.js";
import { SAVE_THE_DATE_EVENTS } from "./save-the-date-events.js";
// ScrapedDuck intentionally focuses on the main event calendar and currently
// omits many venue and partnership events. Keep this small overlay sourced from
// official publisher pages. Times are absolute when the publisher or official
// sports schedule provides them; otherwise scheduleNote explicitly says that
// local venue hours apply.
const OFFICIAL_MLB_LINK = "https://pokemongo.com/news/mlb-2026?hl=en";
const MLB_IMAGE = "https://lh3.googleusercontent.com/2Hmv5tlQEdR5DYsWI1C7BoKSxSD39Kp2QRpdwzGmY9N_5UKfay2klJc8CY-hn7gGpU-DY5tpHOdymMKjLqqwIK0TUCib2t4WR18";
const CITY_SAFARI_IMAGE = "https://lh3.googleusercontent.com/dQN8gF9L7kvomaSj3r9TqFRTESmnZTQkKV0WNmL-PA3aDtj_wOU_ly4Ybq5PVxgQRBLqBh2pq0OgsZKR9aPp3gAntGL7ie_23Q";
const JAMSIL_MAGIKARP_IMAGE = "https://lh3.googleusercontent.com/Jci-Gj2imKnD-9Nz_sPmnSGIuAQZZSkPpKHq4AS2zvsJvzvWYA2w74vHqtujorJNM1juGPJy_Zq6VK44bfpSF2z7awylgwkZlVNMWID7cA";
const ANA_RED_IMAGE = "https://lh3.googleusercontent.com/lWZ2c25o8y_4pkaAwmlZbEhl1YHHGQOa7dEFpmozOnqmCcb-4zDMb4sIoHM0I6oJi7jqswaCflZjkDgbWoYbLmA3oBamglTiaI-uGui2ww=s0-e365";
const POKEMON_RUN_IMAGE = "https://lh3.googleusercontent.com/c7e36ASB48bmKd_kOL4e61NU9Y3EPaXd0xmQJldeDAa9zn-W9CSwx6Taf_ENgLcx8K7RE3yP62zaLqwkUSACC6GUcEua_kus5gsm_xoljQ=s0-e365";
const POKEXCITING_IMAGE = "https://lh3.googleusercontent.com/z8jVBHM25ge-k0ar7ldBnCi8ycnaRw6jJEoZ6SeTH2rgy_kdCO_U-NAFOKVcFAqr89tBVGYMRYl_3qqHtIS8-B7qfsNFqxI95o60OVX6pK8";
const WORLDS_2026_IMAGE = "https://cdn.leekduck.com/assets/img/events/article-images/2026/2026-08-25-pokemon-xp-2026-worlds/pokemon-xp-2026-worlds.jpg";
const ESA_ASTRONAUT_PIKACHU_LINK = "https://www.esa.int/Newsroom/Press_Releases/ESA_and_The_Pokemon_Company_International_reveal_Europe-wide_exhibition_and_astronaut_Pikachu_experience";
const ESA_ASTRONAUT_PIKACHU_IMAGE = "https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2026/09/pokemon_x_esa_collaboration_key_art/27530128-1-eng-GB/Pokemon_x_ESA_collaboration_key_art_pillars.jpg";
const JAPAN_STAMP_IMAGE = "https://lh3.googleusercontent.com/KnYzB05jOG1h4qCFKDlv6iKCjSu3yLbdTaq5fQdOz7vQg88GWIJGSTT8rj3E1qSBt5FQNQ9gsppZlkAbgmh1dsJxXevAxHZ71wBpJRKUKzg";
const NAGASAKI_STAMP_IMAGE = "https://lh3.googleusercontent.com/6tnAxzCE3_LxGNyyPGFCqx8OtYpUROumYbdHwIXq-IdoZJZ-HlsS8thDRU6MnWlR3z1AbmQ-3Gw47oWXmBJ6M5uBESMAMfREQ8M";
const DAAN_PARK_IMAGE = "https://lh3.googleusercontent.com/HAZsv_KcwrQxV2oFBKTb8JRvM-e-qm0HHZgnZNN-VYRUIYTbQ8QeSiTC82agoSirIYRaPJB34g-RCq1Dn_EB4g_s3F0l1TAdHirFHJ5e4Q";
const CLEFAIRY_SOURCE_URL = "https://pokemongo.com/news/dancing-in-the-moonlight-2026?hl=eng";
const CLEFAIRY_PLANNER_LOCATIONS = [
  { id: "tokyo", name: "Tokyo · regional routing point", region: "Japan", timeZone: "Asia/Tokyo", coordinates: "35.669590, 139.699690", provenance: "regional representative", sourceUrl: "https://www.openstreetmap.org/?mlat=35.669590&mlon=139.699690#map=16/35.669590/139.699690" },
  { id: "osaka", name: "Osaka · regional routing point", region: "Japan", timeZone: "Asia/Tokyo", coordinates: "34.693644, 135.502231", provenance: "regional representative", sourceUrl: "https://www.openstreetmap.org/?mlat=34.693644&mlon=135.502231#map=16/34.693644/135.502231" },
  { id: "seoul", name: "Seoul City Hall · regional routing point", region: "Korea", timeZone: "Asia/Seoul", coordinates: "37.5667893, 126.9784204", provenance: "regional representative", sourceUrl: "https://www.openstreetmap.org/way/198561926" },
  { id: "taipei", name: "Taipei · regional routing point", region: "Taiwan", timeZone: "Asia/Taipei", coordinates: "25.048331, 121.518533", provenance: "regional representative", sourceUrl: "https://www.openstreetmap.org/?mlat=25.048331&mlon=121.518533#map=16/25.048331/121.518533" },
  { id: "jakarta", name: "National Monument, Jakarta · regional routing point", region: "Indonesia", timeZone: "Asia/Jakarta", coordinates: "-6.1754024, 106.8271692", provenance: "regional representative", sourceUrl: "https://www.openstreetmap.org/way/1159084257" },
  { id: "makassar", name: "Lapangan Karebosi, Makassar · regional routing point", region: "Indonesia", timeZone: "Asia/Makassar", coordinates: "-5.1347706, 119.4122162", provenance: "regional representative", sourceUrl: "https://www.openstreetmap.org/way/818993772" },
  { id: "jayapura", name: "Base G Beach, Jayapura · regional routing point", region: "Indonesia", timeZone: "Asia/Jayapura", coordinates: "-2.5187878, 140.7403776", provenance: "regional representative", sourceUrl: "https://www.openstreetmap.org/relation/3920883" },
  { id: "singapore", name: "Merlion Park · regional routing point", region: "Singapore", timeZone: "Asia/Singapore", coordinates: "1.2856852, 103.8541592", provenance: "regional representative", sourceUrl: "https://www.openstreetmap.org/way/687917300" },
  { id: "hong-kong", name: "Victoria Park · regional routing point", region: "Hong Kong", timeZone: "Asia/Hong_Kong", coordinates: "22.2824022, 114.1887806", provenance: "regional representative", sourceUrl: "https://www.openstreetmap.org/way/4182605" },
  { id: "kuala-lumpur", name: "KLCC Park · regional routing point", region: "Malaysia", timeZone: "Asia/Kuala_Lumpur", coordinates: "3.1555803, 101.7147801", provenance: "regional representative", sourceUrl: "https://www.openstreetmap.org/way/10590000" }
].map(Object.freeze);
const CLEFAIRY_WINDOW_TIMES = ["12:00", "13:00", "19:00", "20:00"];
const CLEFAIRY_POSSIBLE_SPAWNS = ["Clefairy with a Special Background", "Jigglypuff", "Teddiursa", "Skitty", "Munna", "Bunnelby"];
const CLEFAIRY_SPAWN_WINDOWS = Array.from({ length: 6 }, (_, dayIndex) => {
  const date = new Date(Date.UTC(2026, 8, 23 + dayIndex)).toISOString().slice(0, 10);
  return CLEFAIRY_WINDOW_TIMES.map(start => {
    const [hour, minute] = start.split(":").map(Number);
    const endMinute = minute + 5;
    const end = `${date}T${String(hour + Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}:00`;
    return Object.freeze({
      label: `${start} local`,
      start: `${date}T${start}:00`,
      end,
      spawns: ["Clefairy"],
      possibleSpawns: CLEFAIRY_POSSIBLE_SPAWNS,
      locationIds: CLEFAIRY_PLANNER_LOCATIONS.map(location => location.id)
    });
  });
}).flat();
const MLB_BONUSES = [
  "Pikachu raids inside the ballpark, with a chance of Shiny Pikachu or a Location Background",
  "Club-cap avatar item from the participating ballpark PokéStop",
  "Official club-branded PokéStops, Gyms, and Routes",
  "One-hour Lure Modules at the ballpark",
  "Featured wild spawns, Timed Research, and Field Research"
];

// Venue names come from the official Pokémon GO National Trust announcement.
// Exact in-game coordinates are community-mapped and are labeled that way in
// the UI rather than being presented as publisher-supplied coordinates.
import { LEGO_STAMP_RALLY_VENUES } from "./lego-stamp-rally.js";
import { CITY_STAMP_RALLY_EVENTS } from "./city-stamp-rallies.js";
import {
  JAPAN_POKEMON_CENTER_STAMP_RALLY_VENUES,
  NAGASAKI_STAMP_RALLY_VENUES
} from "./japan-stamp-rallies.js";
import { WORLDS_2026_STAMP_RALLY_VENUES } from "./worlds-2026-stamp-rally.js";

const NATIONAL_TRUST_VENUES = [
  ["Killerton", "Devon", "50.791373, -3.453604", "Seedot raids · South West"],
  ["Kingston Lacy", "Dorset", "50.810905, -2.031706", "Seedot raids · South West"],
  ["Lacock", "Wiltshire", "51.414546, -2.119912", "Seedot raids · South West"],
  ["Stourhead", "Wiltshire", "51.105004, -2.321244", "Seedot raids · South West"],
  ["Trelissick", "Cornwall", "50.217163, -5.033812", "Seedot raids · South West"],
  ["Tyntesfield", "North Somerset", "51.441718, -2.718314", "Seedot raids · South West"],
  ["Chirk Castle and Garden", "Wrexham", "52.934659, -3.085656", "Seedot raids · Wales"],
  ["Tredegar House", "Newport", "51.561594, -3.028114", "Seedot raids · Wales"],
  ["Cliveden", "Buckinghamshire", "51.557183, -0.681231", "Hoppip raids · London and South East"],
  ["Mottisfont", "Hampshire", "51.041525, -1.5361419", "Hoppip raids · London and South East"],
  ["Nymans", "West Sussex", "51.050599, -0.198384", "Hoppip raids · London and South East"],
  ["Polesden Lacey", "Surrey", "51.257601, -0.37351", "Hoppip raids · London and South East"],
  ["Scotney Castle", "Kent", "51.093796, 0.406936", "Hoppip raids · London and South East"],
  ["Stowe Gardens", "Buckinghamshire", "52.022156, -1.007848", "Hoppip raids · London and South East"],
  ["Anglesey Abbey", "Cambridgeshire", "52.23721, 0.239504", "Sewaddle raids · Midlands and East"],
  ["Attingham Park", "Shropshire", "52.6849, -2.667045", "Sewaddle raids · Midlands and East"],
  ["Belton Estate", "Lincolnshire", "52.946383, -0.616848", "Sewaddle raids · Midlands and East"],
  ["Calke Abbey", "Derbyshire", "52.812741, -1.472758", "Sewaddle raids · Midlands and East"],
  ["Clumber Park", "Nottinghamshire", "53.269652, -1.062225", "Sewaddle raids · Midlands and East"],
  ["Hanbury Hall", "Worcestershire", "52.271808, -2.083218", "Sewaddle raids · Midlands and East"],
  ["Hardwick", "Derbyshire", "53.166997, -1.310023", "Sewaddle raids · Midlands and East"],
  ["Wimpole Estate", "Cambridgeshire", "52.141087, -0.049751", "Sewaddle raids · Midlands and East"],
  ["Dunham Massey", "Greater Manchester", "53.382629, -2.400306", "Pineco raids · North"],
  ["Fountains Abbey", "North Yorkshire", "54.11941, -1.578651", "Pineco raids · North"],
  ["Gibside", "Tyne & Wear", "54.920684, -1.732883", "Pineco raids · North"],
  ["Lyme", "Cheshire", "53.353815, -2.054405", "Pineco raids · North"],
  ["Mount Stewart", "County Down", "54.5688969, -5.6563385", "Pineco raids · Northern Ireland"]
].map(([name, location, coordinates, group], index) => ({
  id: `national-trust-${index + 1}`,
  name,
  location,
  coordinates,
  timeZone: "Europe/London",
  group
}));

const ESA_ASTRONAUT_PIKACHU_VENUES = [
  ["esa-cite-de-lespace", "Cité de l'espace", "Cité de l'espace, Toulouse, France", "43.58664271359883, 1.4933352392078427", "Europe/Paris"],
  ["esa-ciudad-de-las-artes", "Ciudad de las Artes y las Ciencias", "Ciudad de las Artes y las Ciencias, Valencia, Spain", "39.45487507160424, -0.35050113215615", "Europe/Madrid"],
  ["esa-deutsches-museum", "Deutsches Museum", "Deutsches Museum, Nuremberg, Germany", "49.45370624348607, 11.074687897189365", "Europe/Berlin"],
  ["esa-euro-space-center", "Euro Space Center", "Euro Space Center, Libin, Belgium", "50.008822857063335, 5.219072497220227", "Europe/Brussels"],
  ["esa-science-museum", "Science Museum", "Science Museum, London, United Kingdom", "51.49722157181107, -0.17671757386002793", "Europe/London"],
  ["esa-space-expo", "Space Expo", "Space Expo, Noordwijk, Netherlands", "52.21532466606372, 4.420902755016792", "Europe/Amsterdam"]
].map(([id, name, location, coordinates, timeZone]) => ({ id, name, location, coordinates, timeZone }));

function localDateWindows(firstDate, lastDate, open, close) {
  const windows = [];
  for (let day = Date.parse(`${firstDate}T00:00:00Z`); day <= Date.parse(`${lastDate}T00:00:00Z`); day += 86_400_000) {
    const date = new Date(day).toISOString().slice(0, 10);
    windows.push({ start: `${date}T${open}:00`, end: `${date}T${close}:00`, localTime: true });
  }
  return windows;
}

const ESA_WILD = ["Pikachu", "Clefairy", "Magnemite", "Starmie", "Lunatone", "Solrock", "Elgyem", "Blipbug"];
const NATIONAL_TRUST_RAID_BOSSES = ["Hoppip", "Sewaddle", "Pineco", "Seedot"].map(name => ({
  name, tier: 1,
  locationIds: NATIONAL_TRUST_VENUES.filter(venue => venue.group.startsWith(`${name} raids`)).map(venue => venue.id)
}));
const FOSSIL_MUSEUM_SOURCE = "https://pokemongo.com/en/news/pgo-pokemon-fossil-musuem-chicago-2026";
const FOSSIL_MUSEUM_WILD_SOURCE = "https://leekduck.com/events/pokemon-fossil-museum-chicago-2026/";
// The publisher names the fossil encounter category; the existing enriched
// LeekDuck card identifies Omanyte and Kabuto. Exhibit species are not spawns.
const FOSSIL_MUSEUM_WILD = ["Omanyte", "Kabuto"];
const FOSSIL_MUSEUM_WINDOWS = localDateWindows("2026-05-22", "2027-04-11", "09:00", "21:00")
  .map(window => ({ ...window, sourceUrl: FOSSIL_MUSEUM_SOURCE }));

function mlbEvent(id, team, start, location, coordinates, timeZone) {
  return {
    id: `local-mlb-${id}`,
    name: `${team} Pokémon GO Theme Night`,
    heading: "MLB Theme Night",
    eventType: "local-partnership",
    start,
    end: new Date(Date.parse(start) + 4 * 60 * 60 * 1000).toISOString(),
    link: OFFICIAL_MLB_LINK,
    imageUrl: MLB_IMAGE,
    species: ["Pikachu"],
    summary: "One-star Pikachu raids at the ballpark, with a chance of a Shiny encounter or Location Background.",
    details: {
      raidBosses: [{ name: "Pikachu", tier: "1", shiny: true }],
      raidBackgroundPokemon: [{ name: "Pikachu" }],
      sections: [{ title: "One-star raids", items: ["Pikachu appears in raids at Gyms within the ballpark. Shiny Pikachu and a Location Background are possible, not guaranteed."] }],
      sourceLinks: [{ label: "Official Pokémon GO MLB announcement", href: OFFICIAL_MLB_LINK }]
    },
    bonuses: MLB_BONUSES,
    hasSpawns: false,
    location,
    coordinates,
    timeZone,
    scope: "venue",
    startingSoonAlert: true,
    sourceLabel: "Pokémon GO · MLB",
    scheduleNote: "Pokémon GO activation during the scheduled home game; end time is approximate. The in-game raids are location-based and do not require an event ticket.",
    ticketRequired: false,
    specialBackground: true,
    costumePokemon: true
  };
}

// Regional partnership events are not consistently published in the main
// ScrapedDuck calendar. Keep verified official stadium activations here so
// they are visible in the calendar and in local-event digests as soon as the
// announcement is published.
function japanBaseballFestaEvent(id, date) {
  const start = `${date}T10:00:00+09:00`;
  const end = `${date}T21:00:00+09:00`;
  return {
    id: `local-japan-baseball-festa-${id}-${date}`,
    name: "Pokémon Baseball Festa 2026 — Chunichi Dragons vs Tokyo Yakult Swallows",
    heading: "Japanese Baseball Festival",
    eventType: "local-partnership",
    start,
    end,
    link: "https://pokemongo.com/ja/news/dragonss_game",
    imageUrl: MLB_IMAGE,
    species: ["Pikachu"],
    bonuses: [
      "Special stadium Raid Battles featuring Pikachu wearing a baseball shirt",
      "Pikachu from the raids can be Shiny and may have a location background",
      "Visit the stadium area to receive Timed Research with a baseball-shirt Pikachu encounter",
      "Special Pokémon GO PokéStops with baseball imagery are active around the stadium during the 2026 season"
    ],
    hasSpawns: false,
    location: "Vantelin Dome Nagoya, Nagoya, Aichi, Japan",
    coordinates: "35.185980, 136.947493",
    timeZone: "Asia/Tokyo",
    scope: "venue",
    startingSoonAlert: true,
    sourceLabel: "Official Pokémon GO Japan",
    scheduleNote: "Official stadium gameplay window: 10:00 AM–9:00 PM JST on this game date. The activation is location-based around the stadium and does not require a game ticket to be marked as an in-game requirement.",
    venueNote: "The official announcement places the event at Vantelin Dome Nagoya and says the event gyms are installed around the stadium. The pin is the stadium center; verify the active gyms in-game.",
    ticketRequired: false,
    specialBackground: true,
    costumePokemon: true,
    details: {
      bonusWindows: [{
        label: "Stadium Raid Battles",
        start,
        end,
        timeZone: "Asia/Tokyo",
        bonuses: [
          "Baseball-shirt Pikachu raids",
          "Shiny chance",
          "Chance of a location background"
        ]
      }],
      sections: [
        {
          title: "Stadium Raid Battles",
          items: [
            "10:00 AM–9:00 PM JST at event gyms around Vantelin Dome Nagoya",
            "Baseball-shirt Pikachu is the featured encounter",
            "Shiny and location-background encounters are possible"
          ]
        },
        {
          title: "Timed Research",
          items: [
            "Visit the stadium area to receive event Timed Research",
            "Research rewards include a baseball-shirt Pikachu encounter",
            "Pikachu can be Shiny"
          ]
        },
        {
          title: "Stadium PokéStops",
          items: [
            "Special Pokémon GO PokéStops with baseball imagery are installed around the stadium for the 2026 season"
          ]
        }
      ],
      sourceLinks: [{
        label: "Official Pokémon GO Japan announcement",
        href: "https://pokemongo.com/ja/news/dragonss_game"
      }]
    }
  };
}

// Venue coordinates from each venue's Wikipedia page (2026-10-30). KLCC Plaza Petronas uses the Petronas Towers
// point (the plaza is at the towers' base). Venues without a verified point stay blank rather than guessed.
const POKEMON_RUN_VENUE_COORDINATES = Object.freeze({
  kaohsiung: "22.59500, 120.30694", // Dream Mall
  singapore: "1.3043, 103.8746", // The Kallang (Singapore Sports Hub, renamed 2025)
  malaysia: "3.1578, 101.7117", // Petronas Towers / KLCC
  jakarta: "-6.2185778, 106.8025111", // Gelora Bung Karno Sports Complex
  bangkok: "13.74694, 100.53972", // CentralWorld
  "hong-kong": "22.426565, 114.21124889" // Hong Kong Science Park
});
function pokemonRunEvent(id, location, start, end, timeZone) {
  const sourceUrl = "https://pokemongo.com/news/pokemon-run-30-2026";
  const philippinesFestivalUrl = "https://ph.portal-pokemon.com/30th/topics/20260603_02/";
  const philippinesFestival = id === "philippines";
  const wild = [
    "Bulbasaur", "Charmander", "Squirtle", "Pikachu", "Chikorita", "Cyndaquil", "Totodile",
    "Treecko", "Torchic", "Mudkip", "Turtwig", "Chimchar", "Piplup", "Snivy", "Tepig",
    "Oshawott", "Chespin", "Fennekin", "Froakie", "Rowlet", "Litten", "Popplio", "Grookey",
    "Scorbunny", "Sobble", "Sprigatito", "Fuecoco", "Quaxly"
  ];
  const incense = ["Unown N", "Unown R", "Unown U"];
  return {
    id: `local-pokemon-run-${id}`,
    name: `Pokémon RUN 30 — ${location.split(",")[0]}`,
    heading: "Pokémon RUN 30",
    eventType: "local-event",
    start,
    end,
    localTime: true,
    link: sourceUrl,
    imageUrl: POKEMON_RUN_IMAGE,
    species: [...wild, ...incense],
    bonuses: [
      "Two-times regular Incense duration",
      "10× XP for spinning new PokéStops and 2× XP for other PokéStop spins",
      "Half Egg Hatch Distance",
      "Free event-area Timed Research with encounters, Incense, XP, Stardust, and a Premium Battle Pass"
    ],
    hasSpawns: true,
    location,
    coordinates: philippinesFestival ? APAC_DISCOVERY_VENUES.manila.coordinates : POKEMON_RUN_VENUE_COORDINATES[id] || "",
    timeZone,
    scope: "venue",
    sourceLabel: "Official Pokémon GO",
    scheduleNote: philippinesFestival
      ? "Wild encounters are published for October 3–4. The planner uses destination-local 5 AM–9 PM operating hours, not the Festival Zone's separate 3 AM–7 PM opening hours. Daily Adventure Incense does not qualify."
      : "The official announcement gives the event dates and venue. A verified event-area reference point is still required. Incense encounters exclude Daily Adventure Incense.",
    venueNote: philippinesFestival ? "Uses the existing SM Mall of Asia discovery reference point; the publisher does not define an exact in-game boundary." : "No GPX is published until an exact in-game boundary or verified event PokéStop is available.",
    ticketRequired: false,
    specialBackground: false,
    costumePokemon: false,
    details: {
      spawns: wild,
      shinies: [...wild.filter(name => name !== "Sobble"), ...incense],
      incensePokemon: [...wild, ...incense],
      incenseExclusivePokemon: incense,
      spawnSchedule: { required: true, sourceUrl, sourceKind: "official", localTime: true,
        ...(philippinesFestival ? { confirmedWildSpawns: wild,
          windows: localDateWindows(start.slice(0, 10), end.slice(0, 10), "05:00", "21:00")
            .map(window => ({ ...window, spawns: wild, sourceUrl, operationalPolicy: "destination-local" })) } : {}) },
      manualOpportunities: [
        philippinesFestival
          ? "Wild starters and Pikachu use the published event dates and the planner's 5 AM–9 PM destination operating hours; verify the active in-game event area at the existing SM Mall of Asia reference point."
          : "Wild starter Pokémon and Pikachu are published, but a verified event-area reference point is still required before scheduling a Collector run.",
        "Shiny Unown N, R, and U are Incense-only. Use regular Incense within the event area; Daily Adventure Incense does not qualify.",
        "Spin new PokéStops for 10× XP and other stops for 2× XP; hatch distance is halved during the event.",
        "Complete and claim the two free event-area Timed Research paths by their separate deadlines."
      ],
      sections: [
        { title: "Wild and Incense encounters", items: [
          "Wild: first partner Pokémon and Pikachu; all listed wild species except Sobble can be Shiny.",
          "Regular Incense: the wild lineup plus Shiny-eligible Unown N, R, and U. Daily Adventure Incense is excluded."
        ] },
        { title: "Bonuses and Research", items: [
          "2× regular Incense duration; 10× XP for new PokéStops, 2× XP for other stops, and half Hatch Distance.",
          "Two free event-area Timed Research paths have different claim deadlines after the event."
        ] }
      ],
      sourceLinks: [{ label: "Official Pokémon GO announcement", href: sourceUrl },
        ...(philippinesFestival ? [{ label: "Official Philippines Festival Zone hours", href: philippinesFestivalUrl }] : [])],
      detailCheckedAt: "2026-09-29"
    }
  };
}

function mallExplorationEvent(id, location, firstDay, lastDay, timeZone) {
  const sourceUrl = "https://pokemongo.com/ja/news/apac-mall-exploration-2026";
  const walkingReference = id === "sm-mall-of-asia" ? APAC_DISCOVERY_VENUES.manila : null;
  return {
    id: `local-mall-exploration-${id}`,
    name: `Pokémon 30th Anniversary Mall Exploration — ${location.split(",")[0]}`,
    heading: "Mall Exploration",
    eventType: "local-partnership",
    start: `${firstDay}T00:00:00.000`,
    end: `${lastDay}T23:59:59.000`,
    localTime: true,
    link: sourceUrl,
    species: [],
    bonuses: ["4-hour Lure Module effects in designated mall areas", "One free event-area Timed Research claim per Trainer across participating malls"],
    hasSpawns: false,
    location,
    coordinates: walkingReference?.coordinates || "",
    timeZone,
    scope: "venue",
    sourceLabel: "Official Pokémon GO",
    scheduleNote: walkingReference
      ? "Published mall dates support Timed Routing during the planner's destination-local 5 AM–9 PM operating hours. These are planner hours, separate from mall opening hours."
      : "Published mall dates only; daily in-game hours and exact designated play areas have not been announced.",
    venueNote: "Research may be claimed once per Trainer at any participating mall and expires 10 days after receipt. " +
      (walkingReference ? "Uses the existing SM Mall of Asia discovery reference point; verify the designated in-game Lure area after arriving."
        : "No venue GPX or automatic hunt is verified."),
    ticketRequired: false,
    specialBackground: false,
    costumePokemon: false,
    details: {
      research: ["One-time event-themed Pokémon encounters from Timed Research; exact species are not published"],
      ...(walkingReference ? { gameplayWindows: localDateWindows(firstDay, lastDay, "05:00", "21:00")
        .map(window => ({ ...window, label: "Mall Lure bonus · destination walking hours", sourceUrl,
          operationalPolicy: "destination-local" })) } : {}),
      manualOpportunities: [
        "Visit one participating mall's designated in-game area to receive the free Timed Research; this is a single claim across all participating malls.",
        "Complete and claim the Timed Research within 10 days after receiving it.",
        "Lure Modules last four hours only in designated areas. No particular wild or Lure Pokémon is confirmed by this announcement.",
        ...(walkingReference ? ["Timed Routing walks through the existing venue reference point; activate a Lure separately or use an active Lure. Routing does not claim the once-only Research."] : [])
      ],
      sourceLinks: [{ label: "Official Pokémon GO Mall Exploration announcement", href: sourceUrl }],
      detailCheckedAt: "2026-09-29"
    }
  };
}

// Discovery center from OSM way 10590000, not an exact in-game stamp stop.
const KLCC_DISCOVERY_VENUE = {
  id: "klcc-park-discovery", name: "KLCC Park · approximate discovery center",
  location: "KLCC Park, Kuala Lumpur, Malaysia", coordinates: "3.15562, 101.71479",
  timeZone: "Asia/Kuala_Lumpur"
};
const KLCC_RALLY_IDS = ["local-pokexciting-kuala-lumpur-stamp-rally-2026", "local-pokexciting-cross-region-stamp-rally-2026"];
// OSM venue/district centers, reviewed 2026-09-12. These seed native discovery;
// they are not claims about exact PokéStop positions or event boundaries.
const APAC_DISCOVERY_VENUES = {
  "kuala-lumpur": KLCC_DISCOVERY_VENUE,
  taipei: { id: "taipei", name: "Xinyi District discovery center · Taipei", location: "Xinyi District, Taipei, Taiwan", coordinates: "25.0333448, 121.5668963", timeZone: "Asia/Taipei" },
  singapore: { id: "singapore", name: "Changi Terminal 3 discovery center", location: "Changi Airport Terminal 3, Singapore", coordinates: "1.3545752, 103.9854051", timeZone: "Asia/Singapore" },
  manila: { id: "manila", name: "SM Mall of Asia discovery center", location: "SM Mall of Asia, Manila, Philippines", coordinates: "14.5351818, 120.9815994", timeZone: "Asia/Manila" }
};

function pokeXcitingEvent(id, city, start, end, timeZone) {
  const official = "https://pokemongo.com/en/news/event-apac-30th-anniversary-2026";
  const kl = id === "kuala-lumpur";
  const pikachu = { "kuala-lumpur": "PokéXciting! Pikachu (Turquoise)", taipei: "PokéXciting! Pikachu (Pink)",
    singapore: "PokéXciting! Pikachu (Singapore)", manila: "PokéXciting! Pikachu (Manila)" }[id] || "PokéXciting! Pikachu";
  const places = {
    "kuala-lumpur": "KLCC Park, Kuala Lumpur, Malaysia",
    taipei: "Xinyi District (excluding mountainous areas), Taipei, Taiwan",
    singapore: "Singapore · citywide",
    manila: "SM Mall of Asia surroundings, Manila, Philippines",
    bangkok: "Bangkok, Thailand · gameplay area TBA"
  };
  const wild = ["Bulbasaur wearing a party hat", "Charmander wearing a party hat", "Squirtle wearing a party hat",
    "Raticate wearing a party hat", pikachu,
    "Jigglypuff wearing a ribbon", "Meowth", "Psyduck", "Slowpoke", "Grimer wearing a party hat",
    "Eevee wearing a party hat", "Snorlax", "Dratini", "Chikorita", "Cyndaquil", "Totodile",
    "Togetic", "Treecko", "Torchic", "Mudkip", "Ralts", "Beldum", "Buneary", "Gible"];
  const maxBosses = ["Gigantamax Venusaur", "Gigantamax Charizard", "Gigantamax Blastoise"];
  const costumes = wild.filter(name => name === pikachu || /wearing (?:a party hat|a ribbon)/i.test(name));
  const unown = { "kuala-lumpur": "M, Y", taipei: "T, W", singapore: "S, G", manila: "P, H", bangkok: "T, H" }[id];
  const hasVerifiedEventArea = id !== "singapore" && id !== "bangkok";
  const eventScope = id === "singapore" ? "citywide" : "venue";
  const gameplayWindows = [start.slice(0, 10), end.slice(0, 10)].map((date, index) => ({
    label: `Day ${index + 1}`, start: `${date}T10:00:00`, end: `${date}T22:00:00`
  }));
  return {
    id: `local-pokexciting-${id}`,
    name: `PokéXciting! — ${city}`,
    heading: "Pokémon 30th Anniversary",
    eventType: "local-event",
    start: gameplayWindows[0].start,
    end: gameplayWindows[1].end,
    localTime: true,
    link: kl ? "https://pokemongo.com/news/event-kuala-lumpur-30th-anniversary-2026" : official,
    imageUrl: kl ? "https://lh3.googleusercontent.com/R5icuDPTQf1ppU6yMDRpgn0k96xPy1tlgKD6bvpY0n0wATMDX5rfHl1QA__e0SAIYOEpY0895EyLm--tIhmrSysuuIVg1vIUNYZqOsc-Yw" : POKEXCITING_IMAGE,
    species: wild,
    summary: "Two separate 10 AM–10 PM gameplay days, with regional costume Pikachu, research, encounters and Gigantamax battles. Stamp rewards can carry the local background.",
    bonuses: [
      ...(kl ? ["PokéStop spins award double XP", "Trading costs half the usual Stardust",
        "Two extra Special Trades", "Lures last one hour",
        "Nice, Great and Excellent catches award extra Candy", "Special map visuals and stamp-rally PokéStops"] : []),
      "Five daily GO Snapshot surprise encounters", "Hourly supply balloons"
    ],
    hasSpawns: true,
    location: places[id] || city,
    coordinates: "",
    ...(hasVerifiedEventArea && APAC_DISCOVERY_VENUES[id] ? { venues: [APAC_DISCOVERY_VENUES[id]] } : {}),
    timeZone,
    scope: eventScope,
    startingSoonAlert: id !== "bangkok",
    sourceLabel: "Official Pokémon GO",
    scheduleNote: "10 AM–10 PM at the destination on each event day. Gameplay closes overnight; the local dates may begin on the previous day in your timezone.",
    venueNote: id === "singapore"
      ? "The official two-day event is citywide. Changi Terminal 3 is the separate cross-region Stamp Rally stop, not a gameplay center or city boundary."
      : id === "bangkok"
        ? "The official source says the Bangkok gameplay area and event details are still to be announced. Keep execution pending until those are published."
        : "Mapped pins are approximate discovery centers, not exact stamp stops or event boundaries. After arrival, refresh the native stamp sheet and use its actual stop coordinates. The local five-stamp rally is listed separately only once its native identity is verified.",
    ticketRequired: false,
    specialBackground: true,
    costumePokemon: true,
    details: {
      backgroundPokemon: [{ name: pikachu, source: "Local Stamp Rally" }],
      gameplayWindows,
      ...(APAC_DISCOVERY_VENUES[id] ? { stampRallyEventIds: kl ? KLCC_RALLY_IDS : [KLCC_RALLY_IDS[1]] } : {}),
      ...(id === "singapore" ? {
        nativeHuntSearchPolicy: "global-no-venue",
        // This city representative is for timezone/planner preparation only;
        // it is not a native hunt center or radius.
        plannerLocations: [{ ...APAC_DISCOVERY_VENUES.singapore, name: "Singapore · timezone routing point" }]
      } : {}),
      ...(!kl ? { plannerNotes: ["A separate local five-stamp rally is announced. Its exact game identity is not verified yet, so it cannot be queued here. The cross-region rally is a different activity."] } : {}),
      manualOpportunities: [
        `For a Location Background ${pikachu}, collect five local Stamp Rally stamps and claim its encounter. The background is published for the Stamp Rally reward; it is not confirmed for this wild hunt.`,
        `Use Incense during event hours for the local Shiny-eligible Unown letters (${unown}); these are separate from the wild Collector target.`,
        "Complete the two free Timed Research tracks, take up to five GO Snapshots each day, and use Lure Modules for their separate encounter pool."
      ],
      verifiedDate: "2026-09-11",
      spawns: wild.map(name => ({ name })),
      // The official encounter lists mark every wild and Gigantamax entry as
      // Shiny-eligible. The Pink Pikachu is a distinct Taipei costume debut;
      // its background is a Stamp Rally reward, not a wild-catch trait.
      shinies: [...wild, ...maxBosses].map(name => ({ name })),
      costumePokemon: costumes.map(name => ({ name })),
      debutPokemon: [{ name: pikachu }],
      maxBattleBosses: maxBosses.map(name => ({ name, level: 6,
        sourceUrl: "https://www.pokemon.com/us/features/the-great-pokemon-go-guide-to-winning-max-battles-and-catching-gigantamax-pokemon" })),
      sections: [
        { title: "Research", items: ["Two free Timed Research tracks: costume Pikachu, a Premium Battle Pass, stickers and other rewards. Event Field Research is also available."] },
        { title: "Incense encounters", items: [`Local Unown letters: ${unown}. Turtwig, Chimchar, Piplup, Snivy, Tepig, Oshawott, Chespin, Fennekin and Froakie.`] },
        { title: "Lure encounters", items: ["Party-hat Gengar, Gyarados, Ampharos, Tyranitar, Gardevoir, Altaria, Garchomp, Rowlet, Litten, Popplio, Grookey, Scorbunny and Sobble; more may appear."] },
        { title: "Shiny availability", items: ["The announced wild, Lure, Incense and Gigantamax lineups are Shiny-eligible; encounters are not guaranteed Shiny."] },
        { title: "Costumes, backgrounds & stamp rallies", items: [
          "The city-specific costume Pikachu remains in local wild encounters for one month after the weekend.",
          "The local five-stamp rally rewards a background costume Pikachu and remains available for about a month; check its in-game deadline.",
          "The separate cross-region rally runs September 12, 2026–September 11, 2029 at the four announced venues. Bangkok timing remains unannounced."
        ] },
        ...(kl ? [{ title: "At KLCC Park", items: [
          "Local stamps: Bulbasaur, Charmander, Squirtle, Pikachu and Vileplume. The cross-region stamp is in front of Esplanade. Both reward Turquoise Pikachu with the Kuala Lumpur background.",
          "The booth offers stickers and photos; three of the six stamps unlock a photobooth photo. Stage activities and the drone show have separate venue schedules."
        ] }] : [])
      ],
      sourceLinks: [
        { label: "Official gameplay, encounters & hours", href: official },
        { label: "Official Gigantamax battle guide", href: "https://www.pokemon.com/us/features/the-great-pokemon-go-guide-to-winning-max-battles-and-catching-gigantamax-pokemon" },
        ...(kl ? [{ label: "Official Kuala Lumpur bonuses & venue guide", href: "https://pokemongo.com/news/event-kuala-lumpur-30th-anniversary-2026" },
          { label: "Community-mapped KLCC Park discovery center", href: "https://www.openstreetmap.org/way/10590000" }] : []),
        { label: "Official cross-region rally", href: "https://pokemongo.com/news/event-apac-stamp-rally-2026" },
        ...(id === "taipei" ? [{ label: "Taipei Xinyi district map", href: "https://www.openstreetmap.org/relation/2881027" }] : []),
        ...(id === "singapore" ? [{ label: "Changi Terminal 3 map", href: "https://www.openstreetmap.org/way/173010413" }] : []),
        ...(id === "manila" ? [{ label: "SM Mall of Asia map", href: "https://www.openstreetmap.org/way/4403683" }] : [])
      ]
    }
  };
}

function addOneCalendarMonthLocalTime(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})$/);
  if (!match) return "";
  const [, yearText, monthText, dayText, time] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const pad = value => String(value).padStart(2, "0");
  return `${nextMonth.getUTCFullYear()}-${pad(nextMonth.getUTCMonth() + 1)}-${pad(Math.min(day, lastDay))}T${time}`;
}

function pokeXcitingPostEventWild(event) {
  const windows = Array.isArray(event.details?.gameplayWindows) ? event.details.gameplayWindows : [];
  const lastWindow = windows.at(-1);
  const pikachu = event.species?.find(name => /^Pok[eé]Xciting! Pikachu/i.test(name));
  if (!lastWindow?.end || !pikachu) return null;
  const start = lastWindow.end;
  const end = addOneCalendarMonthLocalTime(start);
  if (!end) return null;
  const city = event.name.split("—").at(-1).trim();
  const citywideSearch = /^local-pokexciting-(?:kuala-lumpur|taipei|singapore|manila)$/.test(event.id);
  const plannerPoint = APAC_DISCOVERY_VENUES[event.id.replace("local-pokexciting-", "")];
  return {
    id: `${event.id}-pikachu-wild`,
    name: `${pikachu} · ${city} post-event wild`,
    heading: "One-month post-event wild appearance",
    eventType: "local-event",
    start,
    end,
    localTime: true,
    link: event.link,
    imageUrl: event.imageUrl,
    species: [pikachu],
    summary: `Only ${pikachu} continues in local wild encounters after the two-day event. A Location Background is published for the separate Stamp Rally reward; one is not confirmed for this wild hunt.`,
    bonuses: [],
    hasSpawns: true,
    location: citywideSearch ? city : event.location,
    coordinates: event.coordinates,
    ...(!citywideSearch && event.venues ? { venues: event.venues.map(venue => ({ ...venue })) } : {}),
    timeZone: event.timeZone,
    scope: citywideSearch ? "citywide" : event.scope,
    sourceLabel: "Official Pokémon GO",
    scheduleNote: `Only ${pikachu} is announced to remain in the wild for one month after the local weekend. The other event spawns, Lure and Incense encounters, and Gigantamax lineup are not included in this continuation. The calendar uses the event close as its start and the one-month anniversary as an estimated cutoff; verify the exact cutoff in game.`,
    venueNote: citywideSearch
      ? `The official continuation is in ${city}. No point or radius is published for the post-event wild spawn; mapped centers for Stamp Rally discovery must not constrain this citywide hunt.`
      : event.venueNote,
    ticketRequired: false,
    specialBackground: false,
    costumePokemon: true,
    details: {
      postEventWild: true,
      ...(citywideSearch ? { nativeHuntSearchPolicy: "global-no-venue" } : {}),
      ...(citywideSearch && plannerPoint ? {
        // Retained only so local-time planner slots can be rendered. Native
        // citywide search must not use this representative as a hunt radius.
        plannerLocations: [{ ...plannerPoint, name: `${city} · timezone routing point` }]
      } : {}),
      gameplayWindows: [{ label: "Post-event Pikachu wild encounters", start, end }],
      spawns: [{ name: pikachu }],
      // The same regional variant continues in the published wild pool.
      // Retain its Wild Encounters Shiny eligibility, not stamp-only rewards.
      shinies: (event.details?.shinies || []).filter(row => row?.name === pikachu &&
        (!Array.isArray(row.methods) || row.methods.includes("collector")))
        .map(row => ({ ...row, methods: ["collector"] })),
      backgroundPokemon: [],
      wildBackgroundPokemon: [],
      sections: [
        { title: "What remains after the weekend", items: [`Only ${pikachu} remains in the local wild encounter pool for one month after this city's event. The rest of the event lineup ends with the two gameplay days.`] },
        { title: "Location Backgrounds", items: ["A Location Background is published for the separate GO Stamp Rally encounter reward; one is not confirmed for this post-event wild hunt."] }
      ],
      sourceLinks: [
        { label: "Official PokéXciting! gameplay and encounters", href: event.link },
        { label: "Official cross-region Stamp Rally", href: "https://pokemongo.com/news/event-apac-stamp-rally-2026" }
      ]
    }
  };
}

const LOCAL_EVENTS = [
  ...[
    { id: "autumn-picnic", name: "Pikachu’s Autumn Picnic 2026", start: "2026-09-18T01:00:00.000Z", end: "2026-10-11T11:00:00.000Z",
      location: "Selected areas of Jongno-gu and Jung-gu, Seoul; Incheon International Airport HiKR Station", scope: "venue",
      bonuses: ["Two-hour Lure Modules", "Increased Shiny chance for featured encounters"],
      raidBosses: [{ name: "Pikachu (Orange Hanbok)", value: "25:3361-1", label: "Pikachu (Orange Hanbok) T1", tier: "1", shiny: true, pokedex_id: 25, form: 3361 }],
      research: [{ name: "Pikachu (Orange Hanbok)", source: "Timed Research + Field Research" }],
      notes: ["Orange Hanbok Pikachu: one-star raids at 15 designated Gyms; once per Gym per day; Remote Raid Passes cannot be used.", "Free Timed Research: 2,026 XP, a Premium Battle Pass, costume encounter and stickers. Claim by October 11, 20:00 KST.", "Event-area Field Research also awards encounters and Stardust."] },
    { id: "korea-outing", name: "Pikachu’s Korea Outing 2026", start: "2026-09-24T01:00:00.000Z", end: "2026-09-26T11:00:00.000Z",
      location: "Throughout South Korea", scope: "regional",
      bonuses: ["Double transfer Candy", "Double raid Stardust", "Increased Shiny chance for featured encounters"],
      raidBosses: [{ name: "Pikachu (Orange Hanbok)", value: "25:3377-1", label: "Pikachu (Orange Hanbok) T1", tier: "1", shiny: true, pokedex_id: 25, form: 3377 }],
      research: [{ name: "Pikachu (Orange Hanbok)", source: "Timed Research" }],
      notes: ["Orange Hanbok Pikachu appears in one-star raids nationwide.", "Free Timed Research includes 4,500 XP, 5,500 Stardust, a Premium Battle Pass and a costume encounter.", "The announcement lists October 11, 20:00 KST as the research claim deadline, separate from the September 26 event end."] }
  ].map(event => ({
    ...event, id: `local-${event.id}-2026`, heading: "South Korea Event", eventType: "regional-event",
    link: "https://pokemongo.com/news/pikachu-autumn-picnic-korea-2026",
    imageUrl: "https://lh3.googleusercontent.com/yZgyb4bT3ECDInztWuKr2ugZHNJNruyn1F5fFrVQLzFLm8t145C6ptiRN3iLdtaAs87ptKmB3mkdaZ9qAi_Eoe3C4h_Wy0zES6UKMQE8oBY=s0-e365",
    timeZone: "Asia/Seoul", sourceLabel: "Official Pokémon GO Korea · G47IX community coverage",
    species: ["Pikachu (Orange Hanbok)"], costumePokemon: true, specialBackground: false, hasSpawns: false,
    scheduleNote: "Times are fixed to Korea Standard Time (Asia/Seoul), not worldwide local time. Raid availability must be confirmed in-game; the published overall event window does not guarantee raids overnight.",
    venueNote: "No exact eligible Gym coordinates or costume ID are assumed. Selected-area eligibility must be verified in-game.",
    details: {
      raidBosses: event.raidBosses || [],
      research: event.research || [{ name: "Pikachu (Orange Hanbok)", source: "Timed Research" }],
      sections: [{title: "Raids and research", items: event.notes}],
      sourceLinks: [
        { label: "Official Pokémon GO Korea announcement", href: "https://pokemongo.com/news/pikachu-autumn-picnic-korea-2026" },
        { label: "G47IX — community infographics and coverage", href: "https://g47ix.pro/" }
      ] }
  })),
  ...CITY_STAMP_RALLY_EVENTS,
  {
    id: "local-jamsil-magikarp-2026",
    name: "2026 Jamsil Magikarp Event",
    heading: "Seoul Local Event",
    eventType: "local-partnership",
    start: "2026-08-16T01:00:00.000Z",
    end: "2026-08-31T11:00:00.000Z",
    link: "https://pokemongo.com/news/jamsil-magikarp-2026",
    imageUrl: JAMSIL_MAGIKARP_IMAGE,
    species: ["Magikarp", "Gyarados"],
    bonuses: [
      "Four daily Magikarp mass-outbreak windows: 12:00–12:03 PM KST, 12:30–12:33 PM KST, 1:00–1:03 PM KST, and 1:30–1:33 PM KST. These repeat every day during the event.",
      "Increased chance of encountering XXS and XXL Magikarp",
      "One additional Special Trade during the event",
      "Lure Modules last for three hours",
      "Event-themed flower petals appear on the map",
      "Two free event-area Timed Research stories: Magikarp Mass Outbreak research rewards 4,000 XP, 5,000 Stardust, and a Magikarp encounter; The Road to Gyarados rewards a Magikarp encounter, 400 Magikarp Candy, and 10,000 Stardust"
    ],
    hasSpawns: true,
    location: "Lotte World Tower & Mall vicinity, Jamsil, Seoul, South Korea",
    coordinates: "37.513130, 127.101463",
    timeZone: "Asia/Seoul",
    scope: "venue",
    sourceLabel: "Official Pokémon GO Korea",
    scheduleNote: "Event bonuses run August 16 at 10:00 AM through August 31 at 8:00 PM KST. Magikarp mass outbreaks occur daily at 12:00–12:03 PM KST, 12:30–12:33 PM KST, 1:00–1:03 PM KST, and 1:30–1:33 PM KST. Free Timed Research must be completed by September 20 at 8:00 PM KST.",
    venueNote: "The official announcement describes the event area around Lotte World Tower & Mall but does not publish an exact boundary pin. This community reference pin marks Lotte World Mall; confirm the active in-game event boundary after arriving.",
    ticketRequired: false,
    specialBackground: false,
    costumePokemon: false,
      details: {
      bonusNotes: [
        "All four outbreak windows repeat daily from August 16 through August 31, 2026, in Korea Standard Time (KST). The event-area bonuses are active from August 16 at 10:00 AM through August 31 at 8:00 PM KST.",
        "The event gameplay and wild encounters are tied to the Lotte World Tower & Mall vicinity in Jamsil, Seoul; being elsewhere in Seoul does not guarantee the event spawns."
      ],
      sections: [
        {
          title: "Daily Magikarp mass outbreaks",
          items: [
            "12:00–12:03 PM KST — Magikarp mass outbreak",
            "12:30–12:33 PM KST — Magikarp mass outbreak",
            "1:00–1:03 PM KST — Magikarp mass outbreak",
            "1:30–1:33 PM KST — Magikarp mass outbreak",
            "These four three-minute windows repeat every day from August 16 through August 31. Be inside the event area before each start time."
          ]
        },
        {
          title: "Wild encounters",
          items: [
            "Magikarp appears in the wild throughout the event area, with a chance to encounter Shiny Magikarp.",
            "Gyarados can also appear in the wild, with a chance to encounter Shiny Gyarados.",
            "During each listed three-minute window, Magikarp appears in especially large numbers."
          ]
        },
        {
          title: "Free Timed Research rewards",
          items: [
            "Magikarp Mass Outbreak Timed Research: 4,000 XP, 5,000 Stardust, and a Magikarp encounter (Shiny possible).",
            "The Road to Gyarados Timed Research: 400 Magikarp Candy, 10,000 Stardust, and a Magikarp encounter (Shiny possible).",
            "Both research stories are free, must be claimed in the event area, and their rewards must be claimed by September 20 at 8:00 PM KST."
          ]
        },
        {
          title: "Event extras",
          items: [
            "Event-themed stickers are available by spinning PokéStops or Gyms and by opening Gifts in the event area.",
            "Event-themed flower petals appear on the map.",
            "The additional Special Trade, three-hour Lure Modules, XXS/XXL chance increase, and other event bonuses are active only during the published event dates and hours."
          ]
        }
      ],
      sourceLinks: [{
        label: "Official Pokémon GO announcement",
        href: "https://pokemongo.com/news/jamsil-magikarp-2026"
      }]
    }
  },
  {
    id: "local-dancing-in-the-moonlight-2026",
    name: "Dancing in the Moonlight 2026 — Clefairy",
    heading: "Asia-Pacific Regional Event",
    eventType: "regional-event",
    start: "2026-09-23T10:00:00",
    end: "2026-09-28T23:59:00",
    localTime: true,
    link: CLEFAIRY_SOURCE_URL,
    imageUrl: "",
    species: ["Clefairy", "Jigglypuff", "Teddiursa", "Skitty", "Munna", "Bunnelby"],
    bonuses: [
      "Clefairy appears in large numbers for five minutes at 12:00 PM, 1:00 PM, 7:00 PM, and 8:00 PM each day",
      "Clefairy with a Special Background, Jigglypuff, Teddiursa, Skitty, Munna, and Bunnelby may also appear in large numbers during those windows",
      "Double Catch XP throughout the event",
      "Two free Timed Research paths with Clefairy, Teddiursa, Skitty, Lunatone, and Bunnelby encounters",
      "Clefairy and the other featured Pokémon can be Shiny"
    ],
    hasSpawns: true,
    location: "Japan, South Korea, Taiwan, Indonesia, Singapore, Hong Kong, and Malaysia",
    coordinates: "",
    timeZone: "",
    scope: "regional",
    sourceLabel: "Official Pokémon GO",
    scheduleNote: "September 23 at 10:00 AM through September 28 at 11:59 PM local time in each listed region. The short burst windows are local-time windows, not a single worldwide timestamp.",
    venueNote: "The event has no publisher-designated single venue or official event boundary. Listed locations are regional routing points selected from the existing destination catalog and OpenStreetMap; they do not guarantee spawns at those coordinates.",
    ticketRequired: false,
    specialBackground: true,
    costumePokemon: false,
    details: {
      nativeHuntSearchPolicy: "global-no-venue",
      research: [
        { name: "Clefairy", source: "Timed Research" },
        { name: "Teddiursa", source: "Timed Research" },
        { name: "Skitty", source: "Timed Research" },
        { name: "Lunatone", source: "Timed Research" },
        { name: "Bunnelby", source: "Timed Research" }
      ],
      backgroundPokemon: [{ name: "Clefairy", source: "Moonlight O'Clock + Timed Research" }],
      wildBackgroundPokemon: [{ name: "Clefairy", methods: ["collector"] }],
      shinies: [{ name: "Clefairy", methods: ["collector"] }],
      plannerLocations: CLEFAIRY_PLANNER_LOCATIONS,
      spawnSchedule: {
        required: true,
        localTime: true,
        sourceUrl: CLEFAIRY_SOURCE_URL,
        windowMinutes: 5,
        windows: CLEFAIRY_SPAWN_WINDOWS
      },
      sections: [
        {
          title: "Five-minute burst windows",
          items: [
            "Clefairy mass appearances: 12:00 PM, 1:00 PM, 7:00 PM, and 8:00 PM local time, for five minutes each day.",
            "During those same windows, Clefairy with a Special Background, Jigglypuff, Teddiursa, Skitty, Munna, and Bunnelby might appear in large numbers."
          ]
        },
        {
          title: "Research deadline",
          items: [
            "The first Timed Research path expires September 29, 2026.",
            "Claim the second path's rewards within three days of receiving them."
          ]
        }
      ],
      sourceLinks: [
        {
          label: "Official Pokémon GO announcement",
          href: CLEFAIRY_SOURCE_URL
        },
        {
          label: "Pokémon GO Hub event guide",
          href: "https://pokemongohub.net/post/event/dancing-in-the-moonlight-2026/"
        },
        {
          label: "The Silph Road discussion",
          href: "https://www.reddit.com/r/TheSilphRoad/comments/1vnuvm0/dance_under_the_moon_with_clefairy/"
        }
      ]
    }
  },
  {
    id: "local-esa-astronaut-pikachu-2026",
    name: "ESA Astronaut Pikachu",
    heading: "ESA × Pokémon Europe-wide collaboration",
    eventType: "local-partnership",
    start: "2026-10-04T00:00:00",
    end: "2027-04-30T23:59:59",
    localTime: true,
    link: "https://pokemongo.com/en/news/european-space-agency-event",
    imageUrl: ESA_ASTRONAUT_PIKACHU_IMAGE,
    species: ["Astronaut Pikachu"],
    summary: "At six participating European museums, one-star Astronaut Pikachu raids can yield the Shiny costume with a special Location Background. Museum Timed Research runs October 4–April 30; Field Research and extra wild encounters run October 4–10. For research backgrounds, choose Field Research: routing completes catch and spin tasks while Researcher claims their encounters. Seven other listed ESA sites offer no Location Background.",
    bonuses: [
      "One-Star Raids featuring Astronaut Pikachu at participating museums",
      "Field Research can reward event-themed Pokémon with a Location Background; wild encounters have no published Location Background",
      "In-person museum raids can award Astronaut Pikachu with a special Location Background",
      "World Space Week (October 4–10): event Field Research and increased wild Pokémon spawns at participating museum locations"
    ],
    hasSpawns: true,
    location: "Participating science and space museums across Europe",
    coordinates: "",
    scope: "regional",
    venues: ESA_ASTRONAUT_PIKACHU_VENUES,
    sourceLabel: "Official ESA × The Pokémon Company International",
    scheduleNote: "October 4, 2026–April 30, 2027 is the published museum gameplay date range; exact daily raid hours are not announced. The planner uses 05:00–21:00 local destination operating hours to bound raids and requires an active in-game raid. Extra wild encounters and Field Research run October 4–10 only.",
    venueNote: "Six museum reference points match the official Pokémon GO gameplay list. The planner's 05:00–21:00 local destination operating hours are a planning bound, not a published raid timetable; confirm the museum is open and an active in-game raid exists. Lucca Comics appears in ESA's exhibition list but not the Pokémon GO museum list.",
    ticketRequired: false,
    specialBackground: true,
    costumePokemon: true,
    details: {
      raidBosses: [{ name: "Astronaut Pikachu", tier: "1" }],
        researchMethods: [
          { type: "timed", label: "Museum Timed Research", startDate: "2026-10-04", endDate: "2027-04-30",
            locationScope: "selected-museum", instructions: "Visit a participating museum to access Timed Research. It may include an event-themed encounter with a Location Background; the exact reward list is not published.",
            rewardSpecies: null, rewardSpeciesStatus: "not-published", possibleBackground: true,
            sourceUrl: "https://pokemongo.com/en/news/european-space-agency-event" },
          { type: "field", label: "Museum Field Research", startDate: "2026-10-04", endDate: "2026-10-10",
            locationScope: "selected-museum", instructions: "Reported tasks: catch 10 Pokémon, spin 10 PokéStops, or earn 3 buddy hearts. Their reported encounter pool is Pikachu (normal), Clefairy, Magnemite, Starmie, Lunatone, Solrock, Elgyem and Blipbug, with possible Location Backgrounds. Field Research routing completes catch/spin tasks and claims encounters. Buddy-heart tasks need Buddy Manager or manual completion; Researcher does not create hearts itself. Exact task-to-species probabilities are not published.",
            rewardSpecies: ESA_WILD, rewardSpeciesStatus: "reported", possibleBackground: true,
            tasks: [
              { label: "Catch 10 Pokémon", category: "catch", quantity: 10, rewardSpecies: ESA_WILD, status: "reported" },
              { label: "Spin 10 PokéStops", category: "spin", quantity: 10, rewardSpecies: ESA_WILD, status: "reported" },
              { label: "Earn 3 buddy hearts", category: "buddy", quantity: 3, rewardSpecies: ESA_WILD, status: "reported", manualCompletion: true }
            ],
            automation: { questCategories: ["catch", "spin"], rewardPokemon: ["25", "35", "81", "121", "337", "338", "605", "824"] },
            windows: localDateWindows("2026-10-04", "2026-10-10", "05:00", "21:00").map(window => ({ ...window,
              locationIds: ESA_ASTRONAUT_PIKACHU_VENUES.map(venue => venue.id), operationalPolicy: "destination-local" })),
            taskSourceUrl: "https://www.reddit.com/r/TheSilphRoad/comments/1wxbkrf/pokemon_go_esa_event_spawns_can_have_location/",
            sourceUrl: "https://pokemongo.com/en/news/european-space-agency-event" }
        ],
      shinies: [{ name: "Astronaut Pikachu", methods: ["raider"] },
        ...ESA_WILD.filter(name => name !== "Blipbug").map(name => ({ name, methods: ["collector"] }))],
      costumePokemon: [{ name: "Astronaut Pikachu" }],
      backgroundPokemon: [{ name: "Astronaut Pikachu", source: "In-person raids at six participating museums" }],
      raidBackgroundPokemon: [{ name: "Astronaut Pikachu" }],
      spawns: ESA_WILD.map(name => ({ name })),
      spawnSchedule: { required: true, sourceKind: "official", localTime: true,
        sourceUrl: "https://pokemongo.com/en/news/european-space-agency-event", confirmedWildSpawns: ESA_WILD,
        windows: localDateWindows("2026-10-04", "2026-10-10", "05:00", "21:00").map(window => ({ ...window,
          spawns: ESA_WILD, locationIds: ESA_ASTRONAUT_PIKACHU_VENUES.map(venue => venue.id), operationalPolicy: "destination-local" })) },
      raidSchedule: { required: true, sourceKind: "official", sourceUrl: "https://pokemongo.com/en/news/european-space-agency-event",
        availableThroughoutEvent: true, dailyOperationalHours: { policy: "destination-local", start: "05:00", end: "21:00" } },
      manualOpportunities: [
        "At one of the six participating museums, find an active one-star Astronaut Pikachu raid for a possible Shiny costume with its special Location Background. Exact daily raid hours and in-game boundaries are not published.",
        "Museum Timed Research runs October 4, 2026–April 30, 2027. It may offer an event-themed encounter with a Location Background; its exact reward list is not published.",
        "Museum Field Research runs October 4–10. Field Research routing automates catch/spin task completion and reward claims; buddy-heart tasks require separate completion. Reported research encounters can have Location Backgrounds; wild encounters have no published background.",
        "Seven other listed ESA sites offer wild encounters and Field Research from October 4–10 without Location Backgrounds."
      ],
      sections: [
        {
          title: "Participating museum gameplay",
          items: [
            "October 4, 2026–April 30, 2027: One-Star Raids featuring Shiny-eligible Astronaut Pikachu and separate Timed Research at six participating museums.",
            "Museum Timed Research may offer event-themed encounters with a Location Background; the exact reward list is not published.",
            "Astronaut Pikachu caught through an in-person museum raid can have the special Location Background. Daily raid hours are not published."
          ]
        },
        {
          title: "World Space Week · October 4–10",
          items: [
            "Field Research and increased wild encounters around participating museum locations run October 4–10 only; Field Research may offer event-themed encounters with a Location Background.",
            "Seven other listed ESA sites also offer wild encounters and Field Research October 4–10, without Location Backgrounds."
          ]
        },
        {
          title: "Participating venues",
          items: ESA_ASTRONAUT_PIKACHU_VENUES.map(venue => `${venue.name} — ${venue.location} · ${venue.coordinates}`)
        }
      ],
      sourceLinks: [
        { label: "Official Pokémon GO museum gameplay announcement", href: "https://pokemongo.com/en/news/european-space-agency-event" },
        { label: "ESA exhibition announcement", href: ESA_ASTRONAUT_PIKACHU_LINK },
        { label: "Reported museum Field Research tasks and rewards", href: "https://www.reddit.com/r/TheSilphRoad/comments/1wxbkrf/pokemon_go_esa_event_spawns_can_have_location/" }
      ]
    }
  },
  {
    id: "local-taipei-daan-park-10th-anniversary-2026",
    name: "Pokémon GO 10th Anniversary Exhibition — Taipei",
    heading: "Taipei Local Celebration",
    eventType: "local-event",
    start: "2026-08-15T00:00:00.000",
    end: "2026-09-13T23:59:59.000",
    localTime: true,
    link: "https://pokemongo.com/zh-Hant/news/2026daanpark",
    imageUrl: DAAN_PARK_IMAGE,
    species: [],
    bonuses: [
      "Pokémon GO 10th Anniversary exhibition in Daan Forest Park MRT Station's Sunlight Hall",
      "Pikachu and Eevee appearances plus anniversary gifts on August 15–16",
      "Community Ambassador activities alongside in-game events on exhibition weekends"
    ],
    hasSpawns: false,
    location: "Sunlight Hall, Daan Park MRT Station, Taipei, Taiwan",
    coordinates: "25.0333, 121.5357",
    timeZone: "Asia/Taipei",
    scope: "venue",
    sourceLabel: "Official Pokémon GO Taiwan",
    scheduleNote: "Exhibition runs through September 13 during MRT operating hours. The opening celebration is August 15–16 from 10:00 AM to 6:00 PM; additional on-site programming is September 5–6.",
    ticketRequired: false,
    specialBackground: false,
    costumePokemon: false,
    details: {
      verifiedDate: "2026-09-13",
      summary: "A physical anniversary exhibition at Daan Park MRT Station, not an announced Pikachu or Eevee spawn event.",
      sections: [
        { title: "Exhibition", items: ["August 15–September 13, during MRT operating hours. Venue: Sunlight Hall, Daan Park MRT Station. All listed times are Taipei local time."] },
        { title: "In-game postcards", items: ["Event-themed PokéStop postcard images at selected Taipei Metro stations from July 20. Save postcards or share them through gifts."] },
        { title: "Opening-weekend celebration", items: [
          "August 15–16, 10:00–18:00. Pikachu and Eevee mascot photo sessions: 11:00, 12:30, 14:00, 15:30 and 17:00.",
          "On-site activities offer anniversary souvenirs while supplies last. Mascot appearances are physical meet-and-greets, not catchable Pokémon."
        ] },
        { title: "Additional on-site activities", items: [
          "Trading Card Game beginner sessions: August 15–16 and September 5–6, 10:00–18:00.",
          "Poké Ball EasyCards go on sale September 5 while supplies last. Weekend Community Ambassador activities accompany in-game events."
        ] }
      ],
      sourceLinks: [{ label: "Official Pokémon GO Taiwan announcement", href: "https://pokemongo.com/zh-Hant/news/2026daanpark" }]
    }
  },
  {
    id: "local-ana-red-pokemon-jet-2026",
    plannerUnavailableReason: "Exact participating airport Gym coordinates are not yet verified.",
    name: "ANA Red Pokémon Jet Collaboration",
    heading: "Japan Airport Collaboration",
    eventType: "local-partnership",
    start: "2026-07-28T16:00:00.000",
    end: "2027-08-31T20:00:00.000",
    localTime: true,
    link: "https://pokemongo.com/news/2026_ana_red",
    imageUrl: ANA_RED_IMAGE,
    species: ["Charmander"],
    bonuses: [
      "One Charmander raid per day at each participating airport Gym",
      "Charmander can be Shiny and has a Red Pokémon Jet Location Background",
      "One free airport Timed Research per event phase; research expires three days after receipt"
    ],
    hasSpawns: false,
    location: "Phase 1: New Chitose, Hakodate, Akita, Sendai, Haneda T2/T3, and Narita T1 airports, Japan",
    coordinates: "",
    timeZone: "Asia/Tokyo",
    scope: "regional",
    sourceLabel: "Official Pokémon GO Japan",
    scheduleNote: "After opening day, raids follow normal raid hours; the announcement does not specify one fixed daily start time. One participation per trainer per Gym per day.",
    details: {
      raidBosses: [{ name: "Charmander", shiny: true }],
      summary: "Charmander raids at participating airport Gyms award the Red Pokémon Jet Location Background. Each trainer can participate once per Gym per day. Exact Gym coordinates must be verified before this promotion can be used in Event Planner.",
      sourceLinks: [{ label: "Official Pokémon GO announcement", url: "https://pokemongo.com/ja/news/2026_ana_red" }]
    },
    venueNote: "Airport terminal and Gym placement matters; no combined GPX is offered until the official in-game locations are verified.",
    ticketRequired: false,
    specialBackground: true,
    costumePokemon: false
  },
  {
    id: "local-ana-green-pokemon-jet-2026",
    plannerUnavailableReason: "Exact participating Phase 2 airport Gym coordinates are not yet verified.",
    name: "ANA Green Pokémon Jet Collaboration",
    heading: "Japan Airport Collaboration · Phase 2",
    eventType: "local-partnership",
    start: "2026-09-18T14:00:00", end: "2027-08-31T20:00:00", localTime: true,
    link: "https://pokemongo.com/news/2026_ana_green?hl=en",
    species: ["Bulbasaur"], hasSpawns: false,
    bonuses: ["Bulbasaur raids award the Green Pokémon Jet Location Background; Shiny encounters are possible",
      "One Raid Battle per trainer per participating Gym per day",
      "One free Timed Research in Phase 2, even if Phase 1 research was claimed; expires three days after receipt"],
    location: "Phase 2: Kochi, Matsuyama, Takamatsu, Tokushima, Fukuoka, Saga, Miyazaki, Kumamoto, Kagoshima, Nagasaki, Oita, Ishigaki, Miyako and Naha airports, Japan",
    coordinates: "", timeZone: "Asia/Tokyo", scope: "regional",
    sourceLabel: "Official Pokémon GO",
    scheduleNote: "Opens September 18 at 2 PM Japan time. Subsequent raids follow the regular raid schedule, not a continuous overnight window. Exact event Gym locations must be verified before automated planning.",
    venueNote: "Phase 2 uses different airports from the Red Jet promotion. No Red Jet pins or airport-center coordinates are substituted for its event Gyms.",
    details: {
      verifiedDate: "2026-09-12", raidBosses: [{ name: "Bulbasaur", shiny: true }],
      summary: "Bulbasaur raids, not wild encounters or Max Battles. Phase 2 research is claimable once across participating airports. Phase 3 airports are not yet announced.",
      sourceLinks: [{ label: "Official Green Pokémon Jet announcement", href: "https://pokemongo.com/news/2026_ana_green?hl=en" }]
    },
    ticketRequired: false, specialBackground: true, costumePokemon: false
  },
  {
    id: "local-pokemon-xp-worlds-san-francisco-2026",
    name: "PokémonXP & 2026 World Championships — San Francisco",
    heading: "San Francisco In-Person Event",
    eventType: "local-event",
    start: "2026-08-28T09:00:00-07:00",
    end: "2026-08-30T20:00:00-07:00",
    link: "https://worlds.pokemon.com/",
    imageUrl: WORLDS_2026_IMAGE,
    species: ["Pikachu"],
    bonuses: [
      "PokémonXP and the 2026 Pokémon World Championships at Moscone Center",
      "Official venue and broadcast programming begins at 9:00 AM Pacific on Friday"
    ],
    hasSpawns: false,
    location: "Moscone Center, San Francisco, California",
    coordinates: "37.784167, -122.401389",
    timeZone: "America/Los_Angeles",
    scope: "venue",
    startingSoonAlert: true,
    sourceLabel: "Official Pokémon Worlds schedule",
    scheduleNote: "The official San Francisco Worlds and PokémonXP schedule begins at 9:00 AM PDT on Friday, August 28. This venue event is separate from the GO Stamp Rally.",
    venueNote: "Moscone Center coordinates use the City and County of San Francisco's published project location.",
    ticketRequired: true,
    specialBackground: false,
    costumePokemon: false,
    details: {
      sections: [{
        title: "Published opening time",
        items: [
          "Friday, August 28: PokémonXP and Worlds programming begins at 9:00 AM PDT.",
          "The one-time Starting Soon alert uses this published venue opening, not the separate Stamp Rally date placeholder."
        ]
      }],
      sourceLinks: [
        { label: "Official 2026 Pokémon World Championships site", href: "https://worlds.pokemon.com/" },
        { label: "Official Pokémon broadcast schedule", href: "https://championships.pokemon.com/en-us/broadcasts/pxp" }
      ]
    }
  },
  {
    id: "local-pokemon-xp-worlds-stamp-rally-2026",
    name: "PokémonXP & 2026 Worlds GO Stamp Rally",
    heading: "Worlds Stamp Rally",
    eventType: "stamp-rally",
    start: "2026-08-28T00:00:00.000",
    end: "2026-08-30T23:59:59.000",
    localTime: true,
    link: "https://www.pokemon.com/us/play-pokemon/pokemon-events/pokemon-tournaments/pokemon-world-championships/",
    imageUrl: WORLDS_2026_IMAGE,
    species: ["Pikachu"],
    bonuses: [
      "Collect stamps from 33 community-mapped PokéStops around San Francisco",
      "Complete the Worlds Stamp Rally to receive a Pikachu encounter",
      "Collect 16 disclosed event-exclusive stamp designs featuring PokémonXP, Worlds, Pokémon, and San Francisco"
    ],
    hasSpawns: false,
    location: "San Francisco, California",
    coordinates: "",
    timeZone: "America/Los_Angeles",
    scope: "citywide",
    venues: WORLDS_2026_STAMP_RALLY_VENUES,
    sourceLabel: "Pokémon Worlds · community-mapped stops",
    scheduleNote: "Available August 28–30, 2026, at designated PokéStops around San Francisco. The live community map currently contains 33 distinct stops; exact daily activation hours have not been published.",
    venueNote: "33 community-mapped rally waypoints are included for GPX planning. This is not an official Pokémon GO coordinate export; confirm the highlighted in-game stamp before starting each stop.",
    ticketRequired: false,
    specialBackground: false,
    costumePokemon: false,
    details: {
      sections: [
        {
          title: "How the Worlds Stamp Rally works",
          items: [
            "Visit designated Stamp Rally PokéStops around San Francisco during the Worlds weekend.",
            "Spin a marked stop and add its event-exclusive stamp to the in-game Stamp Card.",
            "The current community map contains 33 distinct Stamp Rally PokéStops around the city.",
            "Completing the rally awards a Pikachu encounter."
          ]
        },
        {
          title: "Published event-exclusive stamps",
          items: [
            "Amoonguss", "Charizard", "Drifloon", "Elekid", "Ferrothorn & Meltan", "Greninja",
            "Incineroar", "Kirlia", "Lunatone", "Numel", "Pikachu (two designs)", "Spheal",
            "Umbreon", "PokémonXP Logo", "Cable Car"
          ]
        },
        {
          title: "Downloadable GPX route",
          items: [
            "Use the GPX download on this event card to import all 33 community-mapped waypoints.",
            "Confirm that the in-game Stamp Rally icon is active at each location because the route is community-mapped rather than an official Pokémon GO export."
          ]
        }
      ],
      sourceLinks: [
        { label: "Official 2026 Pokémon World Championships page", href: "https://www.pokemon.com/us/play-pokemon/pokemon-events/pokemon-tournaments/pokemon-world-championships/" },
        { label: "LeekDuck PokémonXP & 2026 Worlds guide", href: "https://leekduck.com/events/pokemon-xp-2026-worlds/" }
      ]
    }
  },
  {
    id: "local-japan-pokemon-center-stamp-rally-2026",
    name: "Pokémon Center Stamp Rally 2026",
    heading: "Japan Stamp Rally",
    eventType: "stamp-rally",
    start: "2026-07-01T00:00:00.000",
    end: "2027-08-31T23:59:59.000",
    localTime: true,
    link: "https://pokemongo.com/news/assistant_pikachu",
    imageUrl: JAPAN_STAMP_IMAGE,
    species: ["Pikachu"],
    bonuses: [
      "GO Stamp Rally available at Pokémon Center locations across Japan",
      "Pikachu encounters carry the visited Pokémon Center's Location Background"
    ],
    hasSpawns: false,
    location: "Pokémon Center locations across Japan",
    coordinates: "",
    timeZone: "Asia/Tokyo",
    scope: "regional",
    venues: JAPAN_POKEMON_CENTER_STAMP_RALLY_VENUES,
    sourceLabel: "Official Pokémon GO Japan",
    scheduleNote: "Available through the end of August 2027 during each Pokémon Center's local operating hours.",
    venueNote: "18 community-mapped Pokémon Center and Pokémon GO Lab coordinates are included for GPX planning. They are not an official Niantic/Scopely coordinate export; verify each in-game stamp stop before routing.",
    ticketRequired: false,
    specialBackground: true,
    costumePokemon: false
  },
  {
    id: "local-nagasaki-stamp-rally",
    name: "Nagasaki GO Stamp Rally",
    heading: "City Stamp Rally",
    eventType: "stamp-rally",
    start: "2025-11-10T00:00:00.000",
    end: "",
    ongoing: true,
    localTime: true,
    link: "https://pokemongo.com/news/stamp-rally-nagasaki",
    imageUrl: NAGASAKI_STAMP_IMAGE,
    species: ["Ampharos"],
    bonuses: [
      "Eight-stop citywide GO Stamp Rally",
      "Ampharos encounter with a Nagasaki Location Background after all eight stamps",
      "Participating stops include Nagasaki Station, Chinatown, Seaside Park, Stadium City, and city museums"
    ],
    hasSpawns: false,
    location: "Nagasaki, Japan",
    coordinates: "",
    timeZone: "Asia/Tokyo",
    scope: "citywide",
    venues: NAGASAKI_STAMP_RALLY_VENUES,
    details: {
      verifiedDate: "2026-09-23",
      stampRally: { firstStop: {
        verified: true, sourceVerified: true, nativeVerified: false, plannedFirst: true,
        nativeRallyId: "admin_nagasaki", coordinates: [32.752413, 129.870713],
        name: "Nagasaki · community-listed participating stamp stop",
        sourceUrl: "https://www.reddit.com/r/PokemonGoSpoofing/comments/1ou44ax/nagasaki_city_stamp_rally_all_coordinates/",
        officialSourceUrl: "https://pokemongo.com/news/stamp-rally-nagasaki",
        verifiedAt: Date.parse("2026-09-23T00:04:51Z"),
        orderSource: "Website planned first stop; official rules allow starting at any participating stop",
        provenance: "Exact community-listed rally coordinate; official announcement confirms participation begins November 10, 2025 with no stated end. Current native availability remains unverified."
      } },
      sourceLinks: [
        { label: "Official Nagasaki participation and start rules", href: "https://pokemongo.com/news/stamp-rally-nagasaki" },
        { label: "Community participating-stop coordinates", href: "https://www.reddit.com/r/PokemonGoSpoofing/comments/1ou44ax/nagasaki_city_stamp_rally_all_coordinates/" }
      ]
    },
    sourceLabel: "Official Pokémon GO",
    scheduleNote: "The official announcement gives a November 10, 2025 start date and no end date; this remains listed as ongoing until an official end is published.",
    venueNote: "Eight community-mapped coordinates are included for GPX planning. They are not an official Niantic/Scopely coordinate export; verify each in-game stamp stop before routing.",
    ticketRequired: false,
    specialBackground: true,
    costumePokemon: false
  },
  {
    id: "local-pokexciting-kuala-lumpur-stamp-rally-2026",
    name: "PokéXciting! KLCC Park Regional Stamp Rally",
    heading: "Kuala Lumpur · Five-Stamp Rally",
    eventType: "stamp-rally",
    // Exact expires_at_ms=1791950399000 from the native rally sheet, checked
    // 2026-09-12; do not approximate the announcement's 'one month' wording.
    start: "2026-09-12T10:00:00", end: "2026-10-14T11:59:59", localTime: true,
    link: "https://pokemongo.com/news/event-kuala-lumpur-30th-anniversary-2026",
    imageUrl: POKEXCITING_IMAGE,
    species: ["PokéXciting! Pikachu (Turquoise)"],
    bonuses: ["Collect the Bulbasaur, Charmander, Squirtle, Pikachu and Vileplume stamps at KLCC Park",
      "Completing all five stamps rewards Turquoise PokéXciting! Pikachu with the Kuala Lumpur Location Background"],
    hasSpawns: false, location: "KLCC Park, Kuala Lumpur, Malaysia", coordinates: "",
    venues: [KLCC_DISCOVERY_VENUE], timeZone: "Asia/Kuala_Lumpur", scope: "venue",
    sourceLabel: "Official Pokémon GO · community-mapped discovery center",
    scheduleNote: "The in-game rally sheet expires October 14, 2026 at 11:59:59 AM Kuala Lumpur time (verified September 12). The standalone rally remains available after the event weekend; an Event plan stops at its selected event's final close. Check the game for later schedule changes.",
    venueNote: "Approximate park discovery center only, not five verified stamp coordinates. Visit the park, refresh the stamp sheet, and use its in-game stops. This is separate from the cross-region rally.",
    ticketRequired: false, specialBackground: true, costumePokemon: true,
    details: { verifiedDate: "2026-09-12", sourceLinks: [
      { label: "Official Kuala Lumpur rally and rewards", href: "https://pokemongo.com/news/event-kuala-lumpur-30th-anniversary-2026" },
      { label: "Community-mapped KLCC Park discovery center", href: "https://www.openstreetmap.org/way/10590000" }
    ] }
  },
  {
    id: "local-pokexciting-cross-region-stamp-rally-2026",
    name: "PokéXciting! Cross-Region GO Stamp Rally",
    heading: "APAC Cross-Region Stamp Rally",
    eventType: "stamp-rally",
    start: "2026-09-12T00:00:00.000",
    end: "2029-09-11T23:59:59.000",
    localTime: true,
    link: "https://pokemongo.com/news/event-apac-stamp-rally-2026",
    imageUrl: POKEXCITING_IMAGE,
    species: ["Pikachu"],
    bonuses: [
      "Collect one unique PokéXciting! stamp in each participating Asia-Pacific city",
      "Each city stamp rewards an encounter with a locally colored PokéXciting! Pikachu",
      "Each rewarded Pikachu has that city's Location Background"
    ],
    hasSpawns: false,
    location: "Kuala Lumpur, Taipei, Singapore, and Manila",
    coordinates: "",
    venues: Object.values(APAC_DISCOVERY_VENUES),
    timeZone: "Asia/Kuala_Lumpur",
    scope: "regional",
    sourceLabel: "Official Pokémon GO",
    scheduleNote: "The first four official locations are available September 12, 2026 through September 11, 2029. Bangkok's location and dates remain to be announced.",
    venueNote: "Four approximate discovery centers are mapped, not exact stamp stops: KLCC Park, Xinyi District near the Taipei event area, Changi Terminal 3, and SM Mall of Asia. Refresh the native stamp sheet after arrival and use its actual stop coordinates. Collecting one city stamp does not complete the entire cross-region rally.",
    ticketRequired: false,
    specialBackground: true,
    costumePokemon: true,
    details: {
      sections: [
        {
          title: "Verified cross-region stamp locations",
          items: [
            "Kuala Lumpur, Malaysia — KLCC Park, in front of Esplanade",
            "Taipei, Taiwan — Xiangti Boulevard",
            "Singapore — Changi Airport, Terminal 3 Departure Hall",
            "Manila, Philippines — SM Mall of Asia, MOA Sky",
            "Bangkok, Thailand — location and dates will be announced in a future official update"
          ]
        },
        {
          title: "How the cross-region rally works",
          items: [
            "Spin the PokéXciting! PokéStop in a participating city to collect its region-exclusive digital stamp.",
            "Each city stamp grants a PokéXciting! Pikachu encounter with a costume color inspired by that city.",
            "The rewarded Pikachu carries the corresponding local Location Background.",
            "This long-running cross-region rally is separate from the limited local Stamp Rally offered during each city's main PokéXciting! tour weekend."
          ]
        }
      ],
      sourceLinks: [{ label: "Community-mapped KLCC Park discovery center", href: "https://www.openstreetmap.org/way/10590000" }, {
        label: "Official PokéXciting! cross-region GO Stamp Rally announcement",
        href: "https://pokemongo.com/news/event-apac-stamp-rally-2026"
      }]
    }
  },
  ...[
    ["ombak-klcc", "Ombak KLCC, Kuala Lumpur, Malaysia", "2026-10-01", "2026-12-31", "Asia/Kuala_Lumpur"],
    ["sm-mall-of-asia", "SM Mall of Asia, Manila, Philippines", "2026-10-01", "2027-01-31", "Asia/Manila"],
    ["sm-east-ortigas", "SM East Ortigas, Philippines", "2026-10-23", "2026-11-08", "Asia/Manila"],
    ["sm-southmall", "SM Southmall, Philippines", "2026-11-20", "2026-11-30", "Asia/Manila"],
    ["sm-north-edsa", "SM North EDSA, Philippines", "2026-12-10", "2027-01-03", "Asia/Manila"],
    ["sm-marikina", "SM Marikina, Philippines", "2027-01-15", "2027-01-31", "Asia/Manila"],
    ["sm-seaside-cebu", "SM Seaside Cebu, Philippines", "2027-02-05", "2027-02-14", "Asia/Manila"],
    ["sm-davao", "SM Davao, Philippines", "2027-02-20", "2027-03-07", "Asia/Manila"],
    ["sm-cdo-downtown", "SM CDO Downtown, Philippines", "2027-03-13", "2027-03-28", "Asia/Manila"],
    ["changi-airport", "Changi Airport, Singapore", "2026-11-07", "2027-02-28", "Asia/Singapore"],
    ["jewel", "Jewel, Singapore", "2026-11-07", "2027-01-31", "Asia/Singapore"]
  ].map(row => mallExplorationEvent(...row)),
  ...[
    ["philippines", "SM Mall of Asia, Manila, Philippines", "2026-10-03T00:00:00.000", "2026-10-04T23:59:59.000", "Asia/Manila"],
    ["taichung", "Taichung Central Park, Taichung, Taiwan", "2026-10-17T00:00:00.000", "2026-10-18T23:59:59.000", "Asia/Taipei"],
    ["kaohsiung", "Dream Mall, Kaohsiung, Taiwan", "2026-10-31T00:00:00.000", "2026-11-01T23:59:59.000", "Asia/Taipei"],
    ["singapore", "The Kallang, Singapore", "2026-11-07T00:00:00.000", "2026-11-08T23:59:59.000", "Asia/Singapore"],
    ["new-taipei", "New Taipei Metropolitan Park, New Taipei, Taiwan", "2026-11-14T00:00:00.000", "2026-11-15T23:59:59.000", "Asia/Taipei"],
    ["malaysia", "KLCC Plaza Petronas, Kuala Lumpur, Malaysia", "2026-11-21T00:00:00.000", "2026-11-22T23:59:59.000", "Asia/Kuala_Lumpur"],
    ["jakarta", "GBK, Jakarta, Indonesia", "2026-12-12T00:00:00.000", "2026-12-13T23:59:59.000", "Asia/Jakarta"],
    ["bangkok", "CentralWorld outdoor plaza, Bangkok, Thailand", "2027-01-09T00:00:00.000", "2027-01-10T23:59:59.000", "Asia/Bangkok"],
    ["hong-kong", "Hong Kong Science Park, Hong Kong", "2027-01-23T00:00:00.000", "2027-01-24T23:59:59.000", "Asia/Hong_Kong"]
  ].map(row => pokemonRunEvent(...row)),
  ...[
    ["kuala-lumpur", "Kuala Lumpur, Malaysia", "2026-09-12T00:00:00.000", "2026-09-13T23:59:59.000", "Asia/Kuala_Lumpur"],
    ["taipei", "Taipei, Taiwan", "2026-10-10T00:00:00.000", "2026-10-11T23:59:59.000", "Asia/Taipei"],
    ["singapore", "Singapore", "2026-11-07T00:00:00.000", "2026-11-08T23:59:59.000", "Asia/Singapore"],
    ["manila", "Manila, Philippines", "2027-01-23T00:00:00.000", "2027-01-24T23:59:59.000", "Asia/Manila"],
    ["bangkok", "Bangkok, Thailand", "2027-02-13T00:00:00.000", "2027-02-14T23:59:59.000", "Asia/Bangkok"]
  ].map(row => pokeXcitingEvent(...row)),
  {
    id: "local-fossil-museum-chicago-2026",
    name: "Pokémon Fossil Museum — Chicago",
    heading: "Museum Collaboration",
    eventType: "local-partnership",
    start: "2026-05-22T09:00:00",
    end: "2027-04-11T21:00:00",
    localTime: true,
    link: "https://leekduck.com/events/pokemon-fossil-museum-chicago-2026/",
    imageUrl: "https://cdn.leekduck.com/assets/img/events/article-images/2026/2026-05-22-pokemon-fossil-museum-chicago-2026/pokemon-fossil-museum-chicago-2026.jpg",
    species: ["Excavator Pikachu", "Omanyte", "Kabuto", "Aerodactyl"],
    bonuses: [
      "Excavator Pikachu from Timed Research, Field Research, and one-star raids",
      "Mega Aerodactyl raids and Fossil Pokémon wild spawns",
      "Event research, stickers, Collection Challenge, and snapshot encounters"
    ],
    hasSpawns: true,
    location: "Field Museum, Chicago, Illinois",
    coordinates: "41.8663, -87.6170",
    timeZone: "America/Chicago",
    scope: "venue",
    sourceLabel: "Official Pokémon GO · LeekDuck wild lineup",
    scheduleNote: "Published museum-area Pokémon GO gameplay runs daily 9 AM–9 PM, May 22, 2026–April 11, 2027. These are gameplay hours, separate from museum admission hours.",
    ticketRequired: false,
    specialBackground: false,
    costumePokemon: true,
    details: {
      spawns: FOSSIL_MUSEUM_WILD.map(name => ({ name, sourceUrl: FOSSIL_MUSEUM_WILD_SOURCE })),
      raidBosses: [{ name: "Excavator Pikachu", tier: "1" }, { name: "Mega Aerodactyl", raidKind: "mega" }],
      shinies: [...FOSSIL_MUSEUM_WILD.map(name => ({ name, methods: ["collector"] })),
        ...["Excavator Pikachu", "Mega Aerodactyl"].map(name => ({ name, methods: ["raider"] }))],
      spawnSchedule: { required: true, localTime: true, sourceKind: "official", sourceUrl: FOSSIL_MUSEUM_SOURCE,
        confirmedWildSpawns: FOSSIL_MUSEUM_WILD, targetSourceUrl: FOSSIL_MUSEUM_WILD_SOURCE,
        windows: FOSSIL_MUSEUM_WINDOWS.map(window => ({ ...window, spawns: FOSSIL_MUSEUM_WILD })) },
      raidSchedule: { required: true, localTime: true, sourceKind: "official", sourceUrl: FOSSIL_MUSEUM_SOURCE,
        windows: FOSSIL_MUSEUM_WINDOWS.map(window => ({ ...window, bosses: [{ name: "Excavator Pikachu", tier: 1 }, { name: "Mega Aerodactyl", raidKind: "mega" }] })) },
      manualOpportunities: ["Museum admission hours do not limit the published 9 AM–9 PM game schedule; confirm the active in-game museum area.",
        "Excavator Pikachu also comes from separate Timed Research and Field Research; it is not a published wild target."],
      sourceLinks: [{ label: "Official Pokémon GO gameplay hours and methods", href: FOSSIL_MUSEUM_SOURCE },
        { label: "LeekDuck fossil wild lineup", href: FOSSIL_MUSEUM_WILD_SOURCE }]
    }
  },
  {
    id: "local-national-trust-2026",
    name: "Pokémon GO × National Trust",
    heading: "Regional Collaboration",
    eventType: "local-partnership",
    start: "2026-07-17T23:00:00.000Z",
    end: "2026-12-31T23:59:59.000Z",
    link: "https://pokemongo.com/en/news/nationaltrust-2026",
    imageUrl: "https://lh3.googleusercontent.com/ifoRa_VQ7CEBRn4mZRiD3dtRmWFPQ0AUbSdxQSJtIl_jNGbHf0uqnBCDs91L9nknsUNlpe-rTqL6yqeKdLZdMzj2eGbLcYGQLBUrwB2eNQ",
    species: ["Hoppip", "Sewaddle", "Pineco", "Seedot", "Treecko", "Grovyle", "Sceptile"],
    bonuses: [
      "Regional one-star raids at 27 participating National Trust places",
      "Timed Research encounters can have each site's Location Background",
      "PokéStops, Gyms, and Routes at 140 sites across the UK"
    ],
    hasSpawns: false,
    location: "Participating National Trust sites in England, Wales, and Northern Ireland",
    coordinates: "",
    timeZone: "Europe/London",
    scope: "regional",
    venues: NATIONAL_TRUST_VENUES,
    venueNote: "27 official background sites. Exact coordinates are community-mapped; verify the in-game stop before traveling or starting a route.",
    sourceLabel: "Official Pokémon GO",
    scheduleNote: "The July 31 official update extends site raids and local Timed Research through December 31, 2026. Fixed daily raid hours are not published; automatic raids require exact active-site evidence.",
    ticketRequired: false,
    specialBackground: true,
    costumePokemon: false,
    details: {
      raidBosses: NATIONAL_TRUST_RAID_BOSSES,
      raidBackgroundPokemon: NATIONAL_TRUST_RAID_BOSSES.map(({ name }) => ({ name })),
      raidSchedule: { required: true, sourceKind: "official", sourceUrl: "https://pokemongo.com/en/news/nationaltrust-2026" },
      research: ["Treecko", "Grovyle", "Sceptile"].map(name => ({ name, source: "Local Timed Research" })),
      sections: [{ title: "Regional site raids", items: [
        "London and South East: one-star Hoppip raids. Midlands and East of England: one-star Sewaddle raids.",
        "North and Northern Ireland: one-star Pineco raids. South West and Wales: one-star Seedot raids.",
        "The featured Pokémon caught from a participating site's raids will have that site's Location Background.",
        "Local Timed Research separately awards Treecko, Grovyle and Sceptile with the site's Location Background."
      ] }],
      sourceLinks: [{ label: "Official National Trust announcement and July 31 extension", href: "https://pokemongo.com/en/news/nationaltrust-2026" }],
      backgroundPokemon: [
        { name: "Hoppip", source: "Site Raids" },
        { name: "Sewaddle", source: "Site Raids" },
        { name: "Pineco", source: "Site Raids" },
        { name: "Seedot", source: "Site Raids" },
        { name: "Treecko", source: "Local Timed Research" },
        { name: "Grovyle", source: "Local Timed Research" },
        { name: "Sceptile", source: "Local Timed Research" }
      ]
    }
  },
  {
    id: "local-lego-stores-2026",
    name: "LEGO Stores × Pokémon GO",
    heading: "LEGO Stamp Rally",
    eventType: "stamp-rally",
    start: "2026-08-03T00:00:00.000",
    end: "2026-09-30T23:59:59.000",
    localTime: true,
    link: "https://pokemongo.com/news/lego-pokemon-go-2026",
    imageUrl: "https://lh3.googleusercontent.com/PgCet1MyaPH36KMcm6JPYooraBcm2pXrQtSELUWEH_D9zVr81V7oD_XrxNHbLqF5EZXuWX9wqP5B4sCzMN6l9lYFKdLF3Fs09ou3Xvd5lQk",
    species: ["Pikachu"],
    bonuses: [
      "LEGO-themed Stamp Rally with Special Background Pikachu encounters",
      "Pikachu raids with Shiny or Special Background chances",
      "Event Timed Research, stickers, and in-store Trainer Centers"
    ],
    hasSpawns: false,
    location: "Participating LEGO Stores in the US, UK, Poland, France, Germany, and Australia",
    coordinates: "",
    timeZone: "",
    scope: "regional",
    venues: LEGO_STAMP_RALLY_VENUES,
    details: {
      sections: [
        {
          title: "LEGO Stamp Rally",
          items: [
            "Visit a participating LEGO Store and find the designated event PokéStop or Gym to collect a stamp.",
            "Collect the stamps available at a location to receive a Pikachu encounter with a LEGO Special Background.",
            "Pikachu encounters can be Shiny.",
            "Stamp Rally availability follows each store's local event hours and may vary by market."
          ]
        },
        {
          title: "Participating markets",
          items: ["United States", "United Kingdom", "Poland", "France", "Germany", "Australia"]
        },
        {
          title: "Other LEGO × Pokémon GO bonuses",
          items: [
            "Pikachu appears in one-star raids at participating LEGO Store locations.",
            "Pikachu raids can feature a Shiny or LEGO Special Background encounter.",
            "Event Timed Research and event-themed stickers are available while the collaboration is active."
          ]
        }
      ],
      sourceLinks: [
        { label: "Official LEGO × Pokémon GO announcement", href: "https://pokemongo.com/news/lego-pokemon-go-2026" },
        { label: "LEGO Store locator", href: "https://www.lego.com/stores" },
        { label: "Community coordinate source (unverified)", href: "https://www.reddit.com/r/PoGoAndroidSpoofing/s/94KeRSNVso" }
      ]
    },
    venueNote: "220 community-mapped LEGO Store locations are included for GPX planning. Coordinates are not an official Niantic/LEGO stop export; some stops may be missing or offset, so verify the in-game stamp before traveling or starting a route.",
    sourceLabel: "Official Pokémon GO",
    scheduleNote: "During participating LEGO Store hours; local availability varies by store.",
    ticketRequired: false,
    specialBackground: true,
    costumePokemon: false
  },
  mlbEvent("texas-rangers", "Texas Rangers", "2026-08-22T23:05:00.000Z", "Globe Life Field, Arlington, Texas", "32.7473, -97.0847", "America/Chicago"),
  mlbEvent("new-york-mets", "New York Mets", "2026-08-25T23:10:00.000Z", "Citi Field, Queens, New York", "40.7571, -73.8458", "America/New_York"),
  mlbEvent("san-francisco-giants", "San Francisco Giants", "2026-08-28T01:45:00.000Z", "Oracle Park, San Francisco, California", "37.7786, -122.3893", "America/Los_Angeles"),
  mlbEvent("washington-nationals", "Washington Nationals", "2026-08-30T16:15:00.000Z", "Nationals Park, Washington, DC", "38.8730, -77.0074", "America/New_York"),
  mlbEvent("tampa-bay-rays", "Tampa Bay Rays", "2026-09-13T17:40:00.000Z", "Tropicana Field, St. Petersburg, Florida", "27.7682, -82.6534", "America/New_York"),
  mlbEvent("seattle-mariners", "Seattle Mariners", "2026-09-23T01:40:00.000Z", "T-Mobile Park, Seattle, Washington", "47.5914, -122.3325", "America/Los_Angeles"),
  mlbEvent("boston-red-sox", "Boston Red Sox", "2026-09-25T23:10:00.000Z", "Fenway Park, Boston, Massachusetts", "42.3467, -71.0972", "America/New_York"),
  japanBaseballFestaEvent("chunichi-dragons", "2026-08-21"),
  japanBaseballFestaEvent("chunichi-dragons", "2026-08-22"),
  japanBaseballFestaEvent("chunichi-dragons", "2026-08-23"),
  ...[
    ["boston", "Boston, USA", "42.3601, -71.0589", "2026-09-26T04:00:00.000Z", "2026-09-28T03:59:59.000Z", "America/New_York"],
    ["brisbane", "Brisbane, Australia", "-27.4698, 153.0251", "2026-09-25T14:00:00.000Z", "2026-09-27T13:59:59.000Z", "Australia/Brisbane"],
    ["lisbon", "Lisbon, Portugal", "38.7223, -9.1393", "2026-09-25T23:00:00.000Z", "2026-09-27T22:59:59.000Z", "Europe/Lisbon"],
    ["marseille", "Marseille, France", "43.2965, 5.3698", "2026-09-25T22:00:00.000Z", "2026-09-27T21:59:59.000Z", "Europe/Paris"],
    ["munich", "Munich, Germany", "48.1351, 11.5820", "2026-09-25T22:00:00.000Z", "2026-09-27T21:59:59.000Z", "Europe/Berlin"],
    ["rio", "Rio de Janeiro, Brazil", "-22.9068, -43.1729", "2026-09-26T03:00:00.000Z", "2026-09-28T02:59:59.000Z", "America/Sao_Paulo"]
  ].map(([id, location, coordinates, start, end, timeZone]) => ({
    id: `local-city-safari-${id}-2026`,
    name: `Pokémon GO City Safari: ${location.split(",")[0]}`,
    heading: "City Safari",
    eventType: "city-safari",
    start,
    end,
    link: "https://pokemongo.com/featured-in-person-events/citysafari",
    imageUrl: CITY_SAFARI_IMAGE,
    species: [],
    bonuses: [
      "Location-themed wild Pokémon encounters",
      "Event-exclusive Special Research and citywide gameplay"
    ],
    hasSpawns: true,
    location,
    coordinates,
    timeZone,
    scope: "citywide",
    sourceLabel: "Official Pokémon GO",
    scheduleNote: "September 26–27; use the ticket or official event page for exact local gameplay hours.",
    ticketRequired: true,
    specialBackground: false,
    costumePokemon: false
  }))
];

// Official Europe community meetups for Pokémon GO Wild Area 2026: Global. Only the two venues the announcement
// names are listed; it points to the "Find your community" page for the rest.
const EUROPE_MEETUP_LINK = "https://pokemongo.com/news/gowa-global-europe-2026";
const WILD_AREA_GLOBAL_EUROPE_MEETUPS = [
  ["karlsruhe", "Karlsruhe", "Ettlinger Tor, Karl-Friedrich-Straße 26, 76133 Karlsruhe, Germany", "2026-11-14T10:00:00", "2026-11-14T20:00:00", "Europe/Berlin", "Saturday, November 14, 2026, 10:00–20:00 local time."],
  ["stockholm", "Stockholm", "Kulturhuset Stadsteatern, Sergels Torg, 111 57 Stockholm, Sweden", "2026-11-15T10:00:00", "2026-11-15T18:00:00", "Europe/Stockholm", "Sunday, November 15, 2026, 10:00–18:00 local time."]
].map(([id, city, location, start, end, timeZone, scheduleNote]) => ({
  id: `local-wild-area-global-2026-meetup-${id}`,
  name: `Pokémon GO Wild Area: Global Community Meetup — ${city}`,
  heading: "Official Community Meetup", eventType: "local-partnership",
  start, end, localTime: true, link: EUROPE_MEETUP_LINK, imageUrl: "",
  species: [], bonuses: ["Official in-person community meetup during Pokémon GO Wild Area 2026: Global."],
  hasSpawns: false, location, coordinates: "", timeZone, scope: "venue",
  sourceLabel: "Official Pokémon GO", scheduleNote,
  venueNote: "Venue and hours are taken from the official announcement. No coordinates are published until the venue is in the verified venue map.",
  ticketRequired: false, specialBackground: false, costumePokemon: false, startingSoonAlert: false,
  details: { sections: [{ title: "Official announcement details", items: [scheduleNote, `Venue: ${location}.`,
    "More European meetups are listed on the official Find your community page."] }],
    sourceLinks: [{ label: "Official Pokémon GO announcement", href: EUROPE_MEETUP_LINK }], detailCheckedAt: "2026-11-09" }
}));

export function curatedLocalEvents(now = Date.now()) {
  const postEventWildEvents = LOCAL_EVENTS
    .filter(event => /^local-pokexciting-(?:kuala-lumpur|taipei|singapore|manila)$/.test(event.id))
    .map(pokeXcitingPostEventWild)
    .filter(Boolean);
  return [...LOCAL_EVENTS, ...postEventWildEvents, iitDelhiEvent(), festivalOfLightsEvent(), ...stampRallyAnnouncements(now),
    ...WILD_AREA_GLOBAL_EUROPE_MEETUPS, ...SAVE_THE_DATE_EVENTS]
    .filter(event => {
      const end = event.localTime && event.timeZone ? calendarEventTimestamp(event, "end") : Date.parse(event.end);
      return end === null || !Number.isFinite(end) || end >= now;
    })
    .map(event => ({
      ...event,
      bonuses: [...event.bonuses],
      species: [...event.species],
      venues: Array.isArray(event.venues) ? event.venues.map(venue => ({ ...venue })) : undefined
    }));
}
