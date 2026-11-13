import { reviewedAutumnEventDetails } from "./reviewed-autumn-events.js";
import { raidScheduleFeaturedDetails } from "./event-raid-schedules.js";
import { JAPAN_POKEMON_CENTER_STAMP_RALLY_VENUES } from "./japan-stamp-rallies.js";

function miniorShowerDetails(label, firstDay, lastDay) {
  const sourceUrl = "https://pokemongo.com/en/news/minior-meteor-showers-2026";
  const target = "Minior (Meteor Form)";
  const windows = [];
  for (let day = Date.parse(`${firstDay}T00:00:00Z`); day <= Date.parse(`${lastDay}T00:00:00Z`); day += 86_400_000) {
    const date = new Date(day).toISOString().slice(0, 10);
    const nextDate = new Date(day + 86_400_000).toISOString().slice(0, 10);
    windows.push({ label: `${label} · Meteor Form wild encounters`,
      start: `${date}T${date === firstDay ? "17:00" : "00:00"}:00`,
      end: date === lastDay ? `${date}T23:59:00` : `${nextDate}T00:00:00`,
      localTime: true, spawns: [target], sourceUrl });
  }
  return {
    authoritativeSections: true,
    summary: `${label}: wild Meteor Form Minior is available from ${firstDay} at 5 PM through ${lastDay} at 11:59 PM local time. Its encounter chance increases from 5–9 PM each day. The source does not identify this shower's core color or announce Shiny availability.`,
    bonuses: ["Increased chance of wild Minior from 5–9 PM local time", "Extra Stardust for catching Minior"],
    details: {
      spawns: [{ name: target }],
      debutPokemon: [{ name: "Minior", target, methods: ["collector"] }],
      spawnSchedule: { sourceUrl, sourceKind: "official", verifiedDate: "2026-10-02", localTime: true,
        confirmedWildSpawns: [target], windows },
      manualOpportunities: [
        "The source does not identify which core color debuts during this shower. Choose Meteor Form for the wild encounter; do not substitute a specific core color."
      ]
    },
    sections: [{ title: "Meteor Form wild encounters", items: [
      `The ${label} shower has an increased chance of wild Meteor Form Minior from 5–9 PM local time every day.`,
      "Meteor Form wild encounters remain available outside the nightly boost during the complete published shower period.",
      "Minior's seven core colors are separate forms. No Shiny or Special Background opportunity is published for this event."
    ] }],
    sourceLinks: [{ label: "Official Minior meteor shower announcement", href: sourceUrl }]
  };
}

// Hour-by-hour habitat blocks for big rotating events (2026-11-13: GO Fest / Wild Area style), built from the
// reviewed official pools above so the event page and daily graphic show exactly what the publisher lists.
function wildAreaPokemonGroups({ steel, dragons, mightyByDay, mightyAllDays = [], dates, maxTargets, raidTarget, eggs, fiveStarByDay = [], sixStarMax = [] }) {
  const mon = (name, shiny = true) => ({ name, imageUrl: "", shiny });
  const dayKey = date => date.slice(5);
  const dayLabel = date => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  return [
    { section: "spawns", title: "Solid as Steel Hour", note: "10–11 AM · 12–1 PM · 2–3 PM · 4–5 PM local", parent: "Rotating habitat hours", day: "", dayLabel: "", pokemon: steel.map(name => mon(name)) },
    { section: "spawns", title: "Daring as Dragons Hour", note: "11 AM–12 PM · 1–2 PM · 3–4 PM · 5–6 PM local", parent: "Rotating habitat hours", day: "", dayLabel: "", pokemon: dragons.map(name => mon(name)) },
    ...(mightyAllDays.length ? [{ section: "spawns", title: "Mighty Pokémon", note: "Every hour, 10 AM–6 PM local", parent: "", day: "", dayLabel: "", pokemon: mightyAllDays.map(name => mon(name)) }] : []),
    // Mighty Pokémon are not tied to a habitat hour: each day's lineup spawns 10 AM–6 PM (LeekDuck mighty page, 2026-11-13).
    ...(mightyByDay || []).map((names, index) => ({ section: "spawns", title: "Mighty Pokémon", note: "Every hour, 10 AM–6 PM local", parent: "", day: dayKey(dates[index]), dayLabel: dayLabel(dates[index]), pokemon: names.map(name => mon(name)) })),
    ...(eggs?.length ? [{ section: "eggs", title: "10 km Eggs", note: "Eggs obtained during the event", parent: "", day: "", dayLabel: "", pokemon: eggs.map(name => mon(name, false)) }] : []),
    ...(raidTarget ? [{ section: "raids", title: "Three-Star Raids", note: "Every event day", parent: "", day: "", dayLabel: "", pokemon: [mon(raidTarget)] }] : []),
    ...fiveStarByDay.map((names, index) => dates[index] ? { section: "raids", title: "Five-Star Raids", note: "", parent: "", day: dayKey(dates[index]), dayLabel: dayLabel(dates[index]), pokemon: names.map(name => mon(name)) } : null).filter(Boolean),
    ...(sixStarMax.length ? [{ section: "max-battles", title: "Six-Star Max Battles", note: "Every event day", parent: "", day: "", dayLabel: "", pokemon: sixStarMax.map(name => mon(name)) }] : []),
    ...maxTargets.map((name, index) => dates[index] ? { section: "max-battles", title: "Max Battles", note: "", parent: "", day: dayKey(dates[index]), dayLabel: dayLabel(dates[index]), pokemon: [mon(name)] } : null).filter(Boolean)
  ];
}

function wildAreaGlobalDetails() {
  const sourceUrl = "https://pokemongo.com/en/gowildarea/global";
  const steel = ["Alolan Sandshrew", "Alolan Diglett", "Magnemite", "Shellder", "Onix", "Porygon", "Shuckle", "Skarmory",
    "Nosepass", "Aron", "Beldum", "Piplup", "Shieldon", "Bronzor", "Lucario", "Drilbur", "Ferroseed", "Klink",
    "Galarian Stunfisk", "Durant", "Rookidee", "Tinkatink"];
  const dragons = ["Charmander", "Magikarp", "Dratini", "Gligar", "Trapinch", "Swablu", "Barboach", "Bagon", "Gible",
    "Tynamo", "Axew", "Heatmor", "Deino", "Skrelp", "Tyrunt", "Amaura", "Goomy", "Noibat", "Turtonator", "Jangmo-o",
    "Sizzlipede", "Frigibax"];
  const mighty = [
    ["Alolan Exeggutor", "Scizor", "Flygon", "Walrein", "Metagross", "Empoleon", "Magnezone", "Conkeldurr", "Haxorus"],
    ["Azumarill", "Kingdra", "Aggron", "Ferrothorn", "Hydreigon", "Goodra", "Noivern", "Tinkaton", "Clodsire"]
  ];
  const dates = ["2026-11-14", "2026-11-15"];
  const maxTargets = ["Dynamax Dialga", "Dynamax Palkia"];
  const raidTarget = "Machamp wearing a modern jacket";
  const wildTargets = [...steel, ...dragons, ...mighty.flat()];
  const gameplayWindows = dates.map(date => ({ start: `${date}T10:00:00`, end: `${date}T18:00:00`, localTime: true, sourceUrl }));
  const spawnWindows = dates.flatMap((date, day) => Array.from({ length: 8 }, (_, hour) => ({
    label: hour % 2 === 0 ? "Solid as Steel Hour" : "Daring as Dragons Hour",
    start: `${date}T${10 + hour}:00:00`, end: `${date}T${11 + hour}:00:00`, localTime: true, sourceUrl,
    // Mighty wild encounters can occur throughout their published day, in
    // addition to the hourly habitat pool. Incense-only availability is separate.
    spawns: [...(hour % 2 === 0 ? steel : dragons), ...mighty[day]]
  })));
  return {
    authoritativeSections: true,
    eventOverrides: { ticketRequired: false },
    summary: "November 14–15, 10 AM–6 PM local time worldwide. Steel and Dragon wild habitats alternate hourly; rare mighty wild Pokémon differ by day. Dynamax Dialga appears Saturday and Dynamax Palkia Sunday. Modern-jacket Machamp appears in three-star raids both days. These encounters are available to all Trainers; an optional ticket adds separate benefits.",
    bonuses: ["Chance to get GO Safari Balls from PokéStops and Gyms during event hours", "Up to three free Raid Passes per day",
      "Daily Max Particle collection limit increased to 1,600", "Three GO Snapshot surprise event encounters per day"],
    details: {
      spawns: wildTargets.map(name => ({ name })),
      maxBattleBosses: maxTargets.map(name => ({ name })),
      raidBosses: [{ name: raidTarget, tier: 3 }, { name: "Zekrom", tier: 5 }, { name: "Kyurem (White)", tier: 5 }, { name: "Reshiram", tier: 5 }, { name: "Kyurem (Black)", tier: 5 }],
      pokemonGroups: wildAreaPokemonGroups({ steel, dragons, mightyByDay: mighty, dates, maxTargets, raidTarget,
        eggs: ["Honedge", "Klefki", "Drampa", "Duraludon"],
        // Official GO Wild Area Global page + LeekDuck day split, checked 2026-11-13.
        fiveStarByDay: [["Zekrom", "Kyurem (White)"], ["Reshiram", "Kyurem (Black)"]], sixStarMax: ["Gigantamax Duraludon"] }),
      shinies: [
        ...wildTargets.map(name => ({ name, methods: ["collector"] })),
        ...maxTargets.map(name => ({ name, methods: ["max"] })),
        { name: raidTarget, methods: ["raider"] },
        ...["Zekrom", "Kyurem (White)", "Reshiram", "Kyurem (Black)"].map(name => ({ name, methods: ["raider"] })),
        { name: "Gigantamax Duraludon", methods: ["max"] }
      ],
      gameplayWindows,
      spawnSchedule: { sourceUrl, sourceKind: "official", verifiedDate: "2026-10-02", localTime: true,
        confirmedWildSpawns: wildTargets, windows: spawnWindows },
      maxBattleSchedule: { sourceUrl, sourceKind: "official", verifiedDate: "2026-10-02", localTime: true,
        windows: gameplayWindows.map((window, day) => ({ ...window, label: `${maxTargets[day]} · Max Battles`, bosses: [{ name: maxTargets[day] }] })) },
      raidSchedule: { sourceUrl, sourceKind: "official", verifiedDate: "2026-10-02", localTime: true,
        windows: gameplayWindows.map(window => ({ ...window, label: "Modern-jacket Machamp · three-star raids", bosses: [{ name: raidTarget, tier: 3 }] })) },
      manualOpportunities: [
        "Incense (excluding Daily Adventure Incense) can attract a separate mighty encounter pool on both days. The wild hunt follows each day's wild pool; it does not activate Incense.",
        "An optional ticket adds Incense encounters with Unown D, I, L, W and mighty Latias/Latios, increased Shiny chances, Special Research, and extra bonuses. These paid Incense encounters are not wild Collector targets.",
        "10 km Eggs obtained during the event may hatch Honedge, Klefki, Drampa, or Duraludon; these are egg encounters, not wild targets.",
        "GO Safari Balls are usable only from 10 AM–6 PM on event days. Research, snapshots, Routes, featured attacks and ticket benefits are separate activities; the source publishes no Special Background encounter."
      ]
    },
    sections: [
      { title: "Wild habitat hours", items: [
        "Both days: Solid as Steel runs 10–11 AM, noon–1 PM, 2–3 PM and 4–5 PM. Daring as Dragons runs 11 AM–noon, 1–2 PM, 3–4 PM and 5–6 PM local time.",
        "Rare mighty wild encounters are available throughout each day's 10 AM–6 PM event hours; the Saturday and Sunday pools differ. Published wild encounters can be Shiny."
      ] },
      { title: "Raid and Max Battles", items: [
        "Dynamax Dialga: Saturday November 14. Dynamax Palkia: Sunday November 15. Each is a Max Battle encounter and can be Shiny.",
        "Machamp wearing a modern jacket appears in three-star raids on both event days and can be Shiny. Execution waits for its exact native costume identity."
      ] },
      { title: "Optional ticket", items: ["All Trainers can play the announced wild, raid and Max encounters. A paid ticket adds separate encounter methods and bonuses; it is not required for these plans."] }
    ],
    sourceLinks: [{ label: "Official GO Wild Area Global schedule and encounters", href: sourceUrl }]
  };
}

function wildAreaInPersonDetails(slug) {
  const sendai = slug === "sendai";
  const sourceUrl = `https://pokemongo.com/en/gowildarea/${slug}/gameplay`;
  const dates = ["2026-11-06", "2026-11-07", "2026-11-08"];
  const timeZone = sendai ? "Asia/Tokyo" : "America/Mexico_City";
  const region = sendai ? "Miyagi Prefecture, Japan" : "Mexico City metropolitan area";
  const steel = ["Alolan Sandshrew", "Alolan Diglett", "Magnemite", "Shellder", "Onix", "Porygon", "Shuckle", "Skarmory",
    "Nosepass", "Aron", "Beldum", "Piplup", "Shieldon", "Bronzor", "Lucario", "Drilbur", "Ferroseed", "Klink",
    "Galarian Stunfisk", "Durant", "Hisuian Sliggoo", "Rookidee", "Tinkatink", "Orthworm"];
  const dragons = ["Charmander", "Magikarp", "Dratini", "Gligar", "Trapinch", "Swablu", "Barboach", "Bagon", "Gible",
    "Tynamo", "Axew", "Heatmor", "Deino", "Skrelp", "Tyrunt", "Amaura", "Goomy", "Hisuian Sliggoo", "Noibat",
    "Turtonator", "Jangmo-o", "Applin", "Sizzlipede", "Frigibax"];
  const raidTarget = "Machamp wearing a modern jacket";
  const mighty = [raidTarget, "Alolan Exeggutor", "Azumarill", "Scizor", "Kingdra", "Aggron", "Flygon", "Walrein", "Metagross",
    "Empoleon", "Bastiodon", "Magnezone", "Conkeldurr", "Ferrothorn", "Haxorus", "Hydreigon", "Goodra", "Noivern",
    "Kommo-o", "Tinkaton", "Clodsire", sendai ? "Lapras" : "Hawlucha"];
  const wildTargets = [...new Set([...steel, ...dragons, ...mighty])];
  const maxTargets = ["Dynamax Dialga", "Dynamax Palkia"];
  const gameplayWindows = dates.map(date => ({ start: `${date}T10:00:00`, end: `${date}T18:00:00`, localTime: true, sourceUrl }));
  const tohoku = JAPAN_POKEMON_CENTER_STAMP_RALLY_VENUES.find(venue => venue.id === "tohoku");
  // These are existing mapped/native host reference points inside the
  // publisher's whole-region gameplay area, not claimed event boundaries.
  const plannerLocation = sendai
    ? { id: "sendai-tohoku", name: "Sendai · Pokémon Center Tohoku reference", coordinates: tohoku.coordinates, timeZone,
      provenance: "Existing community-mapped Pokémon Center Tohoku reference inside Miyagi Prefecture" }
    : { id: "mexico-city", name: "Mexico City · centre reference", coordinates: "19.435453, -99.14157", timeZone, provenance: "Mexico City centre reference point, verified 2026-10-02" };
  return {
    authoritativeSections: true,
    eventOverrides: { scope: "regional", location: region, coordinates: "", timeZone, localTime: true,
      start: "2026-11-06T10:00:00", end: "2026-11-08T18:00:00", ticketRequired: true,
      venueNote: "Choose only ticket or Extra Day dates purchased for every selected account. The walking reference lies inside the published gameplay region; it is not a publisher-designated event boundary." },
    summary: `November 6–8, 10 AM–6 PM local time in ${region}. All gameplay requires a ticket for the selected day. Steel and Dragon habitats alternate hourly; both Dynamax Dialga and Dynamax Palkia appear on each ticketed day. Mighty wild encounters and modern-jacket Machamp raids remain separate from Incense, Eggs and Research.`,
    bonuses: ["Increased chance of Shiny encounters", "1/2 Hatch Distance during ticketed event hours", "Up to 10 daily Raid Passes from Gyms",
      "Daily Max Particle collection limit increased to 8,000", "Lure Modules and regular Incense last two hours", "2× catch Candy"],
    details: {
      requiresPurchasedEventDays: true,
      plannerLocations: [plannerLocation],
      spawns: wildTargets.map(name => ({ name })),
      raidBosses: [{ name: raidTarget, tier: 3 }],
      maxBattleBosses: maxTargets.map(name => ({ name })),
      shinies: [...wildTargets.map(name => ({ name, methods: name === raidTarget ? ["collector", "raider"] : ["collector"] })),
        ...maxTargets.map(name => ({ name, methods: ["max"] }))],
      gameplayWindows,
      spawnSchedule: { sourceUrl, sourceKind: "official", verifiedDate: "2026-10-02", localTime: true,
        confirmedWildSpawns: wildTargets,
        windows: dates.flatMap(date => Array.from({ length: 8 }, (_, hour) => ({
          label: hour % 2 === 0 ? "Solid as Steel Hour" : "Daring as Dragons Hour",
          start: `${date}T${10 + hour}:00:00`, end: `${date}T${11 + hour}:00:00`, localTime: true, sourceUrl,
          spawns: [...(hour % 2 === 0 ? steel : dragons), ...mighty]
        }))) },
      maxBattleSchedule: { sourceUrl, sourceKind: "official", verifiedDate: "2026-10-02", localTime: true,
        windows: gameplayWindows.map(window => ({ ...window, label: "Dynamax Dialga and Palkia · Max Battles",
          bosses: maxTargets.map(name => ({ name })) })) },
      raidSchedule: { sourceUrl, sourceKind: "official", verifiedDate: "2026-10-02", localTime: true,
        windows: gameplayWindows.map(window => ({ ...window, label: "Modern-jacket Machamp · three-star raids", bosses: [{ name: raidTarget, tier: 3 }] })) },
      incensePokemon: (sendai ? ["A", "D", "E", "I", "N", "S"] : ["C", "E", "I", "M", "O", "X"])
        .map(letter => `Unown ${letter}`).concat("Latias", "Latios"),
      eggs: ["Honedge", "Klefki", "Drampa", "Duraludon"].map(name => ({ name, distance: "10 km" })),
      manualOpportunities: [
        "Select only the main ticket and Extra Day dates already purchased for every selected account. The planner does not buy tickets or verify account ticket ownership.",
        "Incense (excluding Daily Adventure Incense) attracts the city-specific Unown letters, mighty Latias/Latios and a separate mighty pool. These are not additional wild Collector targets; Timed Routing does not activate Incense.",
        "Eggs, Special/Timed/Field Research, snapshots, Routes and ticket add-on bonuses remain separate activities. Hisuian Goodra is an evolution, not a published wild target.",
        "The citywide Stamp Rally runs 9 AM–8 PM only on the main ticket date; Extra Day add-ons do not grant another rally. Exact native rally and first-stop evidence are required separately.",
        "The source does not publish a Max battle level or Special Background for these encounters. Exact modern-jacket Machamp execution waits for a verified native costume identity."
      ]
    },
    sections: [
      { title: "Purchased gameplay dates", items: ["All gameplay is exclusive to ticket holders, 10 AM–6 PM on November 6, 7 or 8. Choose the purchased dates shared by all selected accounts; an Extra Day add-on extends gameplay only to that added date."] },
      { title: "Wild habitat and mighty encounters", items: ["Solid as Steel runs 10–11 AM, noon–1 PM, 2–3 PM and 4–5 PM. Daring as Dragons runs 11 AM–noon, 1–2 PM, 3–4 PM and 5–6 PM. Mighty wild Pokémon can appear during all event hours on every ticketed day."] },
      { title: "Raid and Max encounters", items: ["Both Dynamax Dialga and Dynamax Palkia appear each ticketed day. Machamp wearing a modern jacket appears in three-star raids. These and the published wild Pokémon may be Shiny."] },
      { title: "Stamp Rally and Research", items: ["The citywide Stamp Rally is active 9 AM–8 PM on the main ticket date only. Extra Day dates renew the Steel/Dragon Timed Research, which expires at 8 PM, but do not grant another rally."] }
    ],
    sourceLinks: [{ label: "Official in-person gameplay, encounters and hours", href: sourceUrl },
      { label: "Official ticket and Extra Day eligibility", href: `https://pokemongo.com/en/gowildarea/${slug}/tickets` }]
  };
}

function shadowRotationDetails(id, target, firstDay, lastDay) {
  const sourceUrl = `https://leekduck.com/events/${id}/`;
  const gameplayWindows = [];
  for (let day = Date.parse(`${firstDay}T00:00:00Z`); day <= Date.parse(`${lastDay}T00:00:00Z`); day += 86_400_000) {
    if (![0, 6].includes(new Date(day).getUTCDay())) continue;
    const date = new Date(day).toISOString().slice(0, 10);
    const nextDate = new Date(day + 86_400_000).toISOString().slice(0, 10);
    gameplayWindows.push({ start: `${date}T00:00:00`, end: `${nextDate}T00:00:00`, localTime: true, sourceUrl });
  }
  return {
    authoritativeSections: true,
    summary: `Shadow ${target} appears in five-star Shadow Raids on weekends within ${firstDay}–${lastDay}, and may be Shiny. Automatic searches require a fresh exact native raid observation inside a published destination-local weekend; live counts cannot extend availability to weekdays.`,
    bonuses: [],
    details: { raidKind: "shadow", raidTier: 5, raidBosses: [{ name: target, tier: 5 }],
      shinies: [{ name: target, methods: ["raider"] }], gameplayWindows,
      raidSchedule: { required: true, sourceKind: "reviewed", sourceUrl },
      manualOpportunities: ["The calendar publisher explicitly restricts this rotation to weekends. Its Wednesday–Tuesday parent period does not authorize weekday raids; the automatic search also retains the destination-local 5 AM–9 PM policy."] },
    sections: [{ title: "Published weekend Shadow raids", items: [
      "Five-star Shadow Raids are available on Saturdays and Sundays within this rotation's published date envelope.",
      "Accounts start only after the current boss is verified and a fresh raid sighting is available."
    ] }],
    sourceLinks: [{ label: "Published rotation dates, five-star difficulty and weekend restriction", href: sourceUrl }]
  };
}

const FEATURED_EVENT_DETAILS = Object.freeze({
  "local-official-hangul-nal-2026-2026-10-06": {
    eventOverrides: { scope: "regional", location: "South Korea · nationwide", timeZone: "Asia/Seoul", localTime: true,
      start: "2026-10-06T10:00:00", end: "2026-10-09T20:00:00", coordinates: "", venues: [] },
    summary: "October 6 at 10 AM–October 9 at 8 PM KST, nationwide in South Korea: featured Shiny encounters come from regular Lure Modules and Incense. Choose a Korean walking destination for Timed Routing; no wild Collector target is published.",
    bonuses: ["Regular Lure Modules last one hour", "Regular Incense lasts two hours; Daily Adventure Incense is excluded"],
    details: {
      spawns: [], raidBosses: [], maxBattleBosses: [],
      incensePokemon: ["Gabite", "Gligar", "Rapidash", "Growlithe", "Aron", "Meowth", "Swirlix", "Furret", "Audino", "Raichu", "Lapras"],
      plannerLocations: [{ id: "seoul-jamsil", name: "Seoul · Jamsil walking reference", coordinates: "37.513130, 127.101463", timeZone: "Asia/Seoul",
        provenance: "Existing Jamsil community reference point; nationwide Korean walking choice" }],
      gameplayWindows: [6, 7, 8, 9].map(day => ({ label: "Hangul Day · destination walking hours",
        start: `2026-10-${String(day).padStart(2, "0")}T${day === 6 ? "10" : "05"}:00:00`,
        end: `2026-10-${String(day).padStart(2, "0")}T${day === 9 ? "20" : "21"}:00:00`,
        localTime: true, operationalPolicy: "destination-local", sourceUrl: "https://pokemongo.com/news/hangul-nal-2026" })),
      manualOpportunities: ["Activate regular Incense or use an active regular Lure Module while walking. Timed Routing does not activate either item.",
        "Complete the separate Collection Challenge for Unown H; this reward is not a wild target."],
      sections: [{ title: "Lure and Incense encounters", items: ["Gabite, Gligar, Rapidash, Growlithe, Aron, Meowth, Swirlix, Furret, Audino, Raichu, and Lapras are attracted to regular Lure Modules and Incense, with an increased Shiny chance. Daily Adventure Incense is excluded."] }]
    },
    sourceLinks: [{ label: "Official Pokémon GO Korea announcement", href: "https://pokemongo.com/news/hangul-nal-2026" }]
  },
  "pokemon-go-wild-area-2026-global": wildAreaGlobalDetails(),
  "pokemon-go-wild-area-2026-sendai-japan": wildAreaInPersonDetails("sendai"),
  "pokemon-go-wild-area-2026-mexico-city": wildAreaInPersonDetails("mexico-city"),
  "shadow-thundurus-incarnate-forme-in-shadow-raids-september-2026": shadowRotationDetails(
    "shadow-thundurus-incarnate-forme-in-shadow-raids-september-2026", "Thundurus (Incarnate)", "2026-09-09", "2026-10-06"),
  "shadow-landorus-incarnate-forme-in-shadow-raids-october-2026": shadowRotationDetails(
    "shadow-landorus-incarnate-forme-in-shadow-raids-october-2026", "Landorus (Incarnate)", "2026-10-07", "2026-11-03"),
  "minior-showers-orionids-2026": miniorShowerDetails("Orionids", "2026-10-19", "2026-10-24"),
  "minior-showers-leonids-2026": miniorShowerDetails("Leonids", "2026-11-14", "2026-11-19"),
  "october-communityday2026": {
    eventOverrides: { specialBackground: true },
    summary: "October 10, 2–5 PM local time: Zorua appears more often in the wild and may be Shiny or have a Special Background. Regular Lure Modules can attract Zorua until 9 PM; that is a separate method after the main event hours.",
    bonuses: ["3× catch XP", "2× catch Candy", "Regular Lure Modules may attract Zorua until 9 PM local time"],
    details: {
      spawns: [{ name: "Zorua" }],
      shinies: [{ name: "Zorua", methods: ["collector"] }],
      backgroundPokemon: [{ name: "Zorua", source: "Wild encounters, regular Lure Modules, and research" }],
      wildBackgroundPokemon: [{ name: "Zorua" }],
      manualOpportunities: [
        "From 2–9 PM local time, activate a regular Lure Module at a PokéStop for extra Zorua encounters; the automatic wild hunt does not place Lure Modules or extend past 5 PM.",
        "Complete Field Research or optional paid Special Research for additional Zorua encounters. These rewards are separate from wild encounters.",
        "Take event snapshots and evolve Zorua by 9 PM local time for the announced Zoroark attack; these steps are not performed by the wild hunt."
      ],
      spawnSchedule: {
        sourceUrl: "https://pokemongo.com/news/communityday-october-2026-zorua?hl=en",
        sourceKind: "official", verifiedDate: "2026-09-29", localTime: true,
        confirmedWildSpawns: ["Zorua"],
        windows: [{ label: "Zorua Community Day · wild encounters", start: "2026-10-10T14:00:00",
          end: "2026-10-10T17:00:00", spawns: ["Zorua"] }]
      }
    },
    sections: [
      { title: "Best opportunity", items: [
        "Wild Zorua may be Shiny and may have a Special Background during the published 2–5 PM event hours; neither outcome is guaranteed.",
        "Regular Lure Modules can attract more Zorua from 2–9 PM, including after the main event. Lure activation is a separate manual step."
      ] }
    ],
    sourceLinks: [{ label: "Official Zorua Community Day announcement", href: "https://pokemongo.com/news/communityday-october-2026-zorua?hl=en" }]
  },
  "harvest-festival-2026": {
    summary: "Shiny Applin debuts September 29–October 5, 10 AM on the first day through 8 PM on the last day, local time. Applin, Smoliv, Skwovet, and Lechonk are published wild encounters; apple rewards, research, and GO Pass milestones are separate activities.",
    bonuses: ["Increased chance to encounter Shiny Smoliv", "GO Pass Rank 10: Mossy Lure Modules last one hour"],
    details: {
      spawns: ["Skwovet", "Lechonk", "Smoliv", "Applin"].map(name => ({ name })),
      shinies: ["Skwovet", "Lechonk", "Smoliv", "Applin"].map(name => ({ name })),
      boostedShinyPokemon: [{ name: "Smoliv" }],
      debutPokemon: [{ name: "Shiny Applin", target: "Applin" }],
      manualOpportunities: [
        "Tap apples from Mossy Lure Modules for possible Applin or flower-crown Cottonee encounters; a wild Collector task does not tap apples.",
        "Choose a Timed Research branch and claim its rewards by October 5 at 8 PM local time.",
        "Claim GO Pass rewards by October 7 at 8 PM local time."
      ],
      spawnSchedule: {
        sourceUrl: "https://pokemongo.com/news/harvest-festival-2026?hl=eng", sourceKind: "official",
        verifiedDate: "2026-09-29", localTime: true,
        // The publisher gives the full event range, not daily opening hours.
        // Event Mode intersects it with the user's destination-local 5 AM–9 PM policy.
        dailyOperationalHours: { start: "05:00", end: "21:00", policy: "destination-local" },
        confirmedWildSpawns: ["Skwovet", "Lechonk", "Smoliv", "Applin"],
        availableThroughoutEvent: true
      }
    },
    sections: [
      { title: "Best opportunities", items: [
        "Shiny Applin is making its debut. Applin is a published wild encounter; the official announcement does not give a boosted Shiny Applin rate.",
        "Smoliv has an increased Shiny chance. Skwovet and Lechonk are also wild encounters."
      ] },
      { title: "Manual event steps", items: [
        "Tap apples attracted by Mossy Lure Modules for items or an event encounter, including possible flower-crown Cottonee or Applin. This is not a normal wild-spawn hunt.",
        "Choose one branching Timed Research path and claim rewards by October 5 at 8 PM local time. GO Pass progress and rewards have separate deadlines."
      ] }
    ],
    sourceLinks: [{ label: "Official Harvest Festival announcement", href: "https://pokemongo.com/news/harvest-festival-2026?hl=eng" }]
  },
  "harvest-festival-taken-over-2026": {
    summary: "October 2–5: Shiny Shroodle makes its Egg-hatch debut, while wild Slugma has an increased Shiny chance. Shadow Zekrom requires a GO Pass Super Rocket Radar and a Giovanni encounter at a PokéStop; it is not a wild or raid target.",
    bonuses: ["Increased chance to encounter Shiny Slugma", "More Team GO Rocket encounters at PokéStops and in balloons"],
    details: {
      spawns: ["Koffing", "Slugma", "Numel", "Magmar"].map(name => ({ name })),
      shinies: ["Koffing", "Slugma", "Numel", "Magmar", "Shroodle", "Shadow Zekrom"].map(name => ({ name })),
      boostedShinyPokemon: [{ name: "Slugma" }],
      debutPokemon: [{ name: "Shiny Shroodle", target: "Shroodle" }],
      manualOpportunities: [
        "Shiny Shroodle debuts from Eggs. Before using an Incubator, tap an Egg to check its possible hatches for Shroodle. The announcement does not identify an Egg distance or acquisition pool; do not assume a specific Egg source or hunt it as a wild target.",
        "Earn a Super Rocket Radar through GO Pass: Harvest Festival, then find Giovanni at a PokéStop for Shadow Zekrom. This is a separate, limited encounter, not a repeatable wild or raid hunt.",
        "Claim GO Pass rewards by October 7 at 8 PM local time. Event Field Research awards TMs and Mysterious Components; its exact tasks are not published."
      ],
      spawnSchedule: {
        sourceUrl: "https://pokemongo.com/news/harvest-festival-tgr-2026?hl=eng", sourceKind: "official",
        verifiedDate: "2026-09-29", localTime: true,
        dailyOperationalHours: { start: "05:00", end: "21:00", policy: "destination-local" },
        confirmedWildSpawns: ["Koffing", "Slugma", "Numel", "Magmar"],
        availableThroughoutEvent: true
      }
    },
    sections: [
      { title: "Best opportunities", items: [
        "Shiny Shroodle is available to hatch for the first time. The announcement does not specify which Eggs contain it.",
        "Wild Slugma has an increased Shiny chance. Koffing, Numel, and possibly Magmar are also published wild encounters."
      ] },
      { title: "Separate methods and deadlines", items: [
        "A GO Pass Super Rocket Radar leads to Giovanni at PokéStops and a Shadow Zekrom encounter. This cannot be fulfilled by the wild Collector or Raider task.",
        "GO Pass rewards can be claimed through October 7 at 8 PM local time. Field Research awards TMs and Mysterious Components."
      ] }
    ],
    sourceLinks: [{ label: "Official Harvest Festival: Taken Over announcement", href: "https://pokemongo.com/news/harvest-festival-tgr-2026?hl=eng" },
      { label: "Pokémon GO Help Center · check possible Egg hatches", href: "https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/2358-incubators-hatching-pokemon-eggs/" }]
  },
  "world-space-week-2026": {
    eventOverrides: { costumePokemon: true },
    summary: "October 4–10: Astronaut Pikachu debuts worldwide in one-star raids and free Timed Research, with a chance to be Shiny. The separate ESA museum collaboration has its own location-specific Background opportunity; this worldwide event does not announce one.",
    bonuses: [],
    details: {
      raidBosses: [{ name: "Astronaut Pikachu", tier: "1" }],
      raidSchedule: { required: true, sourceKind: "official", verifiedDate: "2026-09-29",
        sourceUrl: "https://pokemongo.com/en/news/world-space-week-2026", availableThroughoutEvent: true,
        dailyOperationalHours: { start: "05:00", end: "21:00", policy: "destination-local" } },
      researchMethods: [{ type: "timed", label: "Free Timed Research", startDate: "2026-10-04", endDate: "2026-10-10",
        rewardSpecies: ["Astronaut Pikachu"], claimDeadline: "2026-10-12T23:59:00", claimDeadlineTimeZone: "local",
        otherRewardsUnspecified: true, locationScope: "worldwide",
        instructions: "Complete the free Timed Research during World Space Week for an Astronaut Pikachu encounter and more. Finish the tasks and claim rewards by October 12 at 11:59 PM local time.",
        possibleShiny: true, possibleBackground: false, sourceUrl: "https://pokemongo.com/en/news/world-space-week-2026" }],
      shinies: [{ name: "Astronaut Pikachu" }],
      costumePokemon: [{ name: "Astronaut Pikachu" }],
      debutPokemon: [{ name: "Astronaut Pikachu", target: "Astronaut Pikachu" }],
      manualOpportunities: [
        "Find an active one-star Astronaut Pikachu raid during October 4–10. The announcement does not publish daily raid hours; planner windows use 05:00–21:00 destination-local operating hours as a planning bound, not a published raid timetable. A short automatic search still requires a fresh matching native raid sighting and cannot guarantee a battle.",
        "Complete the free Timed Research for an Astronaut Pikachu encounter and claim it by October 12 at 11:59 PM local time.",
        "The ESA museum event is separate: only its participating museum raids announce a possible Location Background. Do not expect that Background from worldwide World Space Week raids."
      ]
    },
    sections: [
      { title: "Astronaut Pikachu debut", items: [
        "Astronaut Pikachu appears in one-star raids and as a free Timed Research reward. Either encounter may be Shiny; no wild Astronaut Pikachu encounter is announced.",
        "The worldwide announcement does not promise a Location Background. That opportunity belongs to the separate ESA museum collaboration."
      ] },
      { title: "Research deadline", items: ["Finish and claim the free Timed Research by October 12 at 11:59 PM local time."] }
    ],
    sourceLinks: [{ label: "Official World Space Week announcement", href: "https://pokemongo.com/en/news/world-space-week-2026" },
      { label: "Separate ESA museum collaboration", href: "https://pokemongo.com/en/news/european-space-agency-event" }]
  },
  "fall-marathon-buddy-trek-2026": {
    summary: "October 13–19: Bramblin debuts through Incense and GO Pass tasks, while Ponyta, Doduo, Electrike, Blitzle, and Skarmory are published wild encounters. The two Incense lineups change October 16 at 10 AM local time.",
    bonuses: ["Increased chance to encounter Shiny Electrike", "GO Pass Rank 10: regular Incense lasts two hours", "GO Pass Rank 20: extra Mega Energy while exploring with Electrike or Manectric after Mega Evolving Manectric"],
    details: {
      spawns: ["Ponyta", "Doduo", "Electrike", "Blitzle", "Skarmory"].map(name => ({ name })),
      shinies: ["Ponyta", "Doduo", "Electrike", "Blitzle", "Skarmory", "Galarian Ponyta", "Hoppip", "Dwebble", "Hisuian Growlithe", "Nincada", "Helioptile"].map(name => ({ name })),
      boostedShinyPokemon: [{ name: "Electrike" }],
      debutPokemon: [{ name: "Bramblin" }],
      manualOpportunities: [
        "Use regular Incense for Bramblin. Its Incense companions change October 16 at 10 AM local time; Bramblin is not in the published ordinary wild-spawn list, and an automatic wild Collector does not activate Incense.",
        "Complete GO Pass tasks or event Field Research for additional Bramblin encounters. The optional Deluxe upgrade is separate and is not purchased automatically.",
        "Complete free Timed Research for a marathon-visor Pikachu and claim it by October 19 at 8 PM local time; claim GO Pass rewards by October 21 at 8 PM."
      ],
      spawnSchedule: {
        sourceUrl: "https://pokemongo.com/news/fall-marathon-buddy-trek-2026", sourceKind: "official",
        verifiedDate: "2026-09-29", localTime: true,
        // The publisher gives the full event span, not daily opening hours.
        // Event Mode intersects it with the destination-local 5 AM–9 PM rule.
        dailyOperationalHours: { start: "05:00", end: "21:00", policy: "destination-local" },
        confirmedWildSpawns: ["Ponyta", "Doduo", "Electrike", "Blitzle", "Skarmory"],
        availableThroughoutEvent: true
      }
    },
    sections: [
      { title: "Wild encounters", items: ["Ponyta, Doduo, Electrike, Blitzle, and possibly Skarmory appear in the wild and can be Shiny. Electrike has an increased Shiny chance."] },
      { title: "Bramblin and other methods", items: ["Bramblin debuts through regular Incense and GO Pass tasks, not the published ordinary wild-spawn list. Incense lineups change October 16 at 10 AM local time. Field Research can also award Bramblin.", "Free Timed Research rewards a marathon-visor Pikachu; its October 19 claim deadline differs from the GO Pass reward deadline on October 21."] }
    ],
    sourceLinks: [{ label: "Official Fall Marathon announcement", href: "https://pokemongo.com/news/fall-marathon-buddy-trek-2026" }]
  },
  "sandile-hatch-day-2026": {
    summary: "October 17, 11 AM–5 PM local time: Sandile hatches more often from 2 km Eggs, with an increased chance of Shiny Sandile. Spin PokéStops for more 2 km Eggs, incubate them, then walk to hatch them.",
    bonuses: ["2× Candy from hatching Eggs", "1/2 Egg Hatch Distance", "Increased chance of Shiny Sandile from 2 km Eggs", "Increased chance of 2 km Eggs from PokéStops"],
    details: {
      shinies: [{ name: "Sandile" }],
      boostedShinyPokemon: [{ name: "Sandile" }],
      gameplayWindows: [{ label: "Sandile Hatch Day · 2 km Eggs", start: "2026-10-17T11:00:00",
        end: "2026-10-17T17:00:00", localTime: true,
        sourceUrl: "https://pokemongo.com/news/sandile-hatch-day-2026?hl=en" }],
      manualOpportunities: [
        "Spin PokéStops for 2 km Eggs, incubate them with Nursery or manually, and walk to hatch them. Timed routing alone spins and walks; it does not place Eggs in Incubators.",
        "Claim the free Timed Research Incubator and XP by October 17 at 5 PM local time. The optional paid ticket and its 1/4-distance bonus are not purchased automatically."
      ]
    },
    sections: [
      { title: "Best method", items: ["Sandile is an Egg hatch, not a wild spawn. During 11 AM–5 PM local time, collect 2 km Eggs, incubate them, and walk; Shiny Sandile has an increased hatch chance.", "Automatic grade planning pairs walking and spinning with Nursery's free Unlimited incubator. If you make a manual Timed Routing plan, add Nursery support or incubate Eggs yourself."] }
    ],
    sourceLinks: [{ label: "Official Sandile Hatch Day announcement", href: "https://pokemongo.com/news/sandile-hatch-day-2026?hl=en" }]
  },
  "pokemon-tcg-30th-celebration": {
    authoritativeSections: true,
    eventOverrides: {
      eventType: "local-partnership", scope: "regional",
      location: "Select participating U.S. retail stores",
      venueNote: "The announcement does not identify every participating store or a raid timetable.",
      scheduleNote: "September 27–October 20, 10 AM on the first day through 10 PM on the last day, local time at participating stores."
    },
    summary: "Select U.S. retail stores host more Mega Gengar raids and offer event Timed Research through October 20. Research rewards must be claimed by November 20. Store participation and exact raid hours are not published; gift-card rewards require a separate purchase.",
    bonuses: [],
    details: {
      raidBosses: [{ name: "Mega Gengar" }],
      shinies: [{ name: "Gengar" }],
      raidSchedule: { required: true, sourceKind: "official", verifiedDate: "2026-09-29",
        sourceUrl: "https://pokemongo.com/en/news/tcg-30th-celebration-event" },
      manualOpportunities: [
        "Visit a participating U.S. retail store and open Pokémon GO to receive event Timed Research by October 20 at 10 PM local time. By November 20 at 10 PM local time, complete the research and claim its rewards.",
        "Mega Gengar raids are more frequent only at participating retail locations. Confirm the store and a live raid in-game; the broad event dates do not verify a joinable raid or safe automatic battle hours.",
        "The Gengar Knit Cap avatar item requires a separate Pokémon GO gift card purchase and redemption from a qualifying retailer; no purchase is part of Event automation."
      ]
    },
    sections: [
      { title: "At participating U.S. stores", items: [
        "Mega Gengar appears more often in Mega Raids at participating retail locations. The caught Gengar may be Shiny; no Special Background is announced.",
        "Open the game at a participating store to receive Timed Research by October 20 at 10 PM local time. Finish and claim it by November 20 at 10 PM local time."
      ] },
      { title: "Purchase offer", items: [
        "A Gengar Knit Cap avatar item is offered with qualifying Pokémon GO gift card redemptions through October 31. This purchase offer is separate from event gameplay."
      ] }
    ],
    sourceLinks: [{ label: "Official Pokémon TCG 30th Celebration announcement",
      href: "https://pokemongo.com/en/news/tcg-30th-celebration-event" }]
  },
  "patterns-of-the-wild-2026": {
    authoritativeSections: true,
    eventOverrides: { scope: "regional", location: "Indonesia", specialBackground: true, costumePokemon: true },
    summary: "October 2, 10 AM–8 PM in Indonesia. Pikachu wearing a batik shirt can be Shiny and can have a Special Background in the wild; Timed Research and snapshots offer additional encounters.",
    bonuses: ["Incense lasts two hours", "Incense increases the chance of batik-shirt Pikachu and other event-themed encounters"],
    details: {
      nativeHuntSearchPolicy: "global-no-venue",
      spawns: ["Caterpie", "Pikachu wearing a batik shirt", "Oddish", "Gloom", "Bellsprout", "Ledyba", "Ledian", "Hoppip", "Skiploom", "Sunkern", "Wurmple"].map(name => ({ name })),
      shinies: ["Caterpie", "Pikachu wearing a batik shirt", "Oddish", "Gloom", "Bellsprout", "Ledyba", "Ledian", "Hoppip", "Skiploom", "Sunkern", "Wurmple"].map(name => ({ name, methods: ["collector"] })),
      backgroundPokemon: [{ name: "Pikachu wearing a batik shirt", source: "Wild encounters, Timed Research, and snapshots" }],
      wildBackgroundPokemon: [{ name: "Pikachu wearing a batik shirt" }],
      costumePokemon: [{ name: "Pikachu wearing a batik shirt" }],
      manualOpportunities: [
        "Activate Incense for a higher chance of event-themed encounters; the automatic wild hunt does not activate Incense.",
        "Complete the separate Timed Research, published for September 28 at 6 AM through October 10 at 11:59 PM, for additional batik-shirt Pikachu encounters.",
        "Take snapshots of your own Pokémon during the October 2 event for additional batik-shirt Pikachu encounters; snapshots of wild Pokémon do not count."
      ],
      plannerLocations: [
        { id: "jakarta", name: "Jakarta · regional routing point", timeZone: "Asia/Jakarta", coordinates: "-6.1754024, 106.8271692" },
        { id: "makassar", name: "Makassar · regional routing point", timeZone: "Asia/Makassar", coordinates: "-5.1347706, 119.4122162" },
        { id: "jayapura", name: "Jayapura · regional routing point", timeZone: "Asia/Jayapura", coordinates: "-2.5187878, 140.7403776" }
      ],
      spawnSchedule: {
        sourceUrl: "https://pokemongo.com/news/patterns-of-the-wild-2026?hl=eng", sourceKind: "official",
        verifiedDate: "2026-09-29", localTime: true,
        confirmedWildSpawns: ["Caterpie", "Pikachu wearing a batik shirt", "Oddish", "Gloom", "Bellsprout", "Ledyba", "Ledian", "Hoppip", "Skiploom", "Sunkern", "Wurmple"],
        windows: [{ label: "Indonesia wild encounters · 10 AM–8 PM", start: "2026-10-02T10:00:00", end: "2026-10-02T20:00:00",
          spawns: ["Caterpie", "Pikachu wearing a batik shirt", "Oddish", "Gloom", "Bellsprout", "Ledyba", "Ledian", "Hoppip", "Skiploom", "Sunkern", "Wurmple"] }]
      }
    },
    sections: [
      { title: "Best opportunities", items: [
        "Wild batik-shirt Pikachu has a chance to be both Shiny and Special Background on the same encounter; neither outcome is guaranteed.",
        "Use Incense for more event-themed encounters. Timed Research and snapshots can provide additional batik-shirt Pikachu encounters."
      ] },
      { title: "Regional limits", items: [
        "This event is published for Indonesia only. The three routing points represent its three local timezones, not guaranteed spawn clusters."
      ] },
      { title: "Other encounter methods", items: [
        "Timed Research is available September 28 at 6 AM through October 10 at 11:59 PM; claim its separate batik-shirt Pikachu encounter by that deadline.",
        "During the October 2 event, take a snapshot of one of your own Pokémon for a possible surprise batik-shirt Pikachu encounter. A snapshot of a wild Pokémon does not count."
      ] }
    ],
    sourceLinks: [{ label: "Official Patterns of the Wild announcement", href: "https://pokemongo.com/news/patterns-of-the-wild-2026?hl=eng" }]
  },
  "gigantamax-cinderace-max-battle-day-2026": {
    summary: "October 3, 2–5 PM local time. Six-star Gigantamax Cinderace Max Battles feature the first chance to encounter Shiny Gigantamax Cinderace. Power Spot and particle bonuses have separate preparation hours.",
    bonuses: ["All Power Spots host Gigantamax Battles during the event", "8× Max Particles from Power Spots", "Max Particle collection limit increased to 1,600"],
    details: {
      maxBattleBosses: [{ name: "Gigantamax Cinderace", level: 6 }],
      shinies: [{ name: "Gigantamax Cinderace" }],
      debutPokemon: [{ name: "Shiny Gigantamax Cinderace", target: "Gigantamax Cinderace" }],
      manualOpportunities: [
        "Prepare a capable Max Battle team and enough other Trainers; six-star Gigantamax Battles require teamwork.",
        "Collect Max Particles before the 2–5 PM battle window. Separate exploration bonuses run October 3 from midnight to 5 PM local time.",
        "An optional paid ticket adds Timed Research and battle XP. The automatic plan does not buy tickets or use paid boosts."
      ],
      maxBattleSchedule: {
        sourceUrl: "https://pokemongo.com/news/gigantamax-cinderace-max-battle-day-2026?hl=eng",
        sourceKind: "official", verifiedDate: "2026-09-29", localTime: true,
        windows: [{ label: "Gigantamax Cinderace · six-star Max Battles", start: "2026-10-03T14:00:00",
          end: "2026-10-03T17:00:00", bosses: [{ name: "Gigantamax Cinderace", level: 6 }] }]
      }
    },
    sections: [{ title: "Best method", items: [
      "Battle Gigantamax Cinderace at an active Power Spot from 2–5 PM local time. A Shiny encounter is possible, not guaranteed.",
      "The separate midnight–5 PM particle bonuses help with preparation; they do not extend the Max Battle window."
    ] }],
    sourceLinks: [{ label: "Official Gigantamax Cinderace announcement", href: "https://pokemongo.com/news/gigantamax-cinderace-max-battle-day-2026?hl=eng" }]
  },
  "dynamax-uxie-mesprit-azelf-max-battle-day-2026": {
    authoritativeSections: true,
    summary: "October 24, 2–5 PM local time: Dynamax Uxie debuts in Asia-Pacific, Dynamax Mesprit in Europe, the Middle East, Africa, and India, and Dynamax Azelf in the Americas and Greenland. Each can be Shiny after its five-star Max Battle.",
    bonuses: ["All Power Spots host Dynamax Battles during event hours", "8× Max Particles from Power Spots", "Max Particle collection limit increased to 1,600"],
    details: {
      maxBattleBosses: ["Dynamax Uxie", "Dynamax Mesprit", "Dynamax Azelf"].map(name => ({ name, level: 5 })),
      shinies: ["Dynamax Uxie", "Dynamax Mesprit", "Dynamax Azelf"].map(name => ({ name, methods: ["max"] })),
      debutPokemon: ["Dynamax Uxie", "Dynamax Mesprit", "Dynamax Azelf"].map(name => ({ name, methods: ["max"] })),
      maxBattleSchedule: {
        sourceUrl: "https://pokemongo.com/news/dynamax-uxie-mesprit-azelf-max-battle-day-2026",
        sourceKind: "official", verifiedDate: "2026-10-02", required: true, localTime: true,
        // The publisher names regions, not exact border polygons. Use existing
        // points unambiguously inside them; Pacific boundary stops await proof.
        windows: [
          { label: "Dynamax Uxie · Asia-Pacific", start: "2026-10-24T14:00:00", end: "2026-10-24T17:00:00",
            bosses: [{ name: "Dynamax Uxie", level: 5 }], locationIds: ["auckland", "sydney", "tokyo", "taipei"] },
          { label: "Dynamax Mesprit · Europe, Middle East, Africa, and India", start: "2026-10-24T14:00:00", end: "2026-10-24T17:00:00",
            bosses: [{ name: "Dynamax Mesprit", level: 5 }], locationIds: ["dubai", "zaragoza"] },
          { label: "Dynamax Azelf · Americas and Greenland", start: "2026-10-24T14:00:00", end: "2026-10-24T17:00:00",
            bosses: [{ name: "Dynamax Azelf", level: 5 }], locationIds: ["sao-paulo", "nyc", "san-francisco"] }
        ]
      },
      manualOpportunities: [
        "Find a matching active Power Spot and prepare a capable team for a five-star Max Battle. The regional boss and its battle must be available within the local 2–5 PM event window.",
        "Separate exploration particle bonuses run October 24 from midnight to 5 PM local time. These preparation hours do not extend the Max Battle window.",
        "The optional paid ticket adds Timed Research, Max Particles, a Max Mushroom, and XP bonuses. Event planning does not purchase the ticket."
      ]
    },
    sections: [{ title: "Regional Max Battles", items: [
      "Asia-Pacific: Dynamax Uxie. Europe, the Middle East, Africa, and India: Dynamax Mesprit. Americas and Greenland: Dynamax Azelf.",
      "Each regional boss appears in five-star Max Battles from 2–5 PM local time on October 24 and can be Shiny. The source does not publish a Special Background for these encounters."
    ] }],
    sourceLinks: [{ label: "Official Dynamax Uxie, Mesprit, and Azelf announcement",
      href: "https://pokemongo.com/news/dynamax-uxie-mesprit-azelf-max-battle-day-2026" }]
  },
  "staraptor-super-mega-raid-day-2026": {
    summary: "Mega Staraptor debuts in Super Mega Raids on September 19, 2–5 PM local time. An optional ticket adds bonuses; it is not required for the event.",
    bonuses: [],
    details: { raidBosses: [{ name: "Mega Staraptor" }] },
    sourceLinks: [{ label: "Official Staraptor Super Mega Raid Day announcement", href: "https://pokemongo.com/news/staraptor-super-mega-raid-day-2026" }]
  },
  "mega-squads": {
    summary: "Wild encounters change September 11 at 10 AM local time. Weedle and Flamigo remain available throughout; Spotlight Hours have separate evolution encounters.",
    bonuses: [],
    details: {
      raidBosses: [{name:"Mega Beedrill"},{name:"Mega Houndoom"}],
      spawnSchedule: {
        sourceUrl:"https://leekduck.com/events/mega-squads/",sourceKind:"reviewed",verifiedDate:"2026-09-13",localTime:true,
        windows:[
          {label:"Throughout the event",start:"2026-09-08T10:00:00",end:"2026-09-14T20:00:00",spawns:["Weedle","Flamigo"]},
          {label:"First encounter rotation",start:"2026-09-08T10:00:00",end:"2026-09-11T10:00:00",spawns:["Pidgey","Emolga","Fletchling","Noibat","Rookidee"]},
          {label:"Second encounter rotation",start:"2026-09-11T10:00:00",end:"2026-09-14T20:00:00",spawns:["Houndour","Carvanha","Purrloin","Nickit"]},
          {label:"Weedle Spotlight Hour · possible evolutions",start:"2026-09-10T18:00:00",end:"2026-09-10T19:00:00",spawns:["Kakuna","Beedrill"]},
          {label:"Houndour Spotlight Hour · possible evolution",start:"2026-09-13T18:00:00",end:"2026-09-13T19:00:00",spawns:["Houndoom"]}
        ]
      }
    },
    sections:[{title:"Wild encounter hours",items:[
      "Throughout: Weedle and Flamigo.",
      "September 8, 10 AM–September 11, 10 AM: Pidgey, Emolga, Fletchling, Noibat, and Rookidee.",
      "September 11, 10 AM–September 14, 8 PM: Houndour, Carvanha, Purrloin, and Nickit. All times are local to the encounter location.",
      "Spotlight Hours run 6–7 PM local time: Weedle on September 10, Houndour on September 13. Their evolutions are possible encounters during those hours."
    ]}],
    sourceLinks:[{label:"Reviewed Mega Squads encounter schedule",href:"https://leekduck.com/events/mega-squads/"}]
  },
  "pokemon-horizons-the-series-celebration-event-2026": {
    summary: "September 16 at 10 AM–September 22 at 8 PM local time. Featured costumes appear throughout the event; the other announced wild encounters rotate at 5 AM and 5 PM each day.",
    bonuses: [],
    details: {
      spawnSchedule: {
        sourceUrl: "https://pokemongo.com/news/pokemon-horizons-celebration-event-2026?hl=en",
        sourceKind: "reviewed", verifiedDate: "2026-09-12", localTime: true,
        windows: [
          { label: "Throughout the event", start: "2026-09-16T10:00:00", end: "2026-09-22T20:00:00",
            spawns: [{ name: "Charmander wearing Friede's goggles" }, { name: "Captain's Cap Pikachu" }] },
          ...Array.from({ length: 7 }, (_, index) => {
            const day = 16 + index;
            return [
              { label: "Daytime wild encounters · 5 AM–5 PM", start: `2026-09-${day}T${index ? "05" : "10"}:00:00`,
                end: `2026-09-${day}T17:00:00`, spawns: ["Fidough", "Wattrel", "Chansey"].map(name => ({ name })) },
              { label: "Nighttime wild encounters · 5 PM–5 AM", start: `2026-09-${day}T17:00:00`,
                end: index === 6 ? "2026-09-22T20:00:00" : `2026-09-${day + 1}T05:00:00`,
                spawns: ["Eevee", "Hatenna", "Rockruff"].map(name => ({ name })) }
            ];
          }).flat()
        ]
      }
    },
    sections: [
      { title: "Wild encounters · local-time rotation", items: [
        "5 AM–5 PM: Fidough, Wattrel, and Chansey are among the announced daytime encounters.",
        "5 PM–5 AM: Eevee, Hatenna, and Rockruff are among the announced nighttime encounters.",
        "Charmander wearing Friede's goggles and Captain's Cap Pikachu may appear throughout the event.",
        "The first day starts at 10 AM and the final day ends at 8 PM. Event Mode applies these boundaries in each location's timezone."
      ] }
    ],
    sourceLinks: [{ label: "Official Horizons encounter schedule", href: "https://pokemongo.com/news/pokemon-horizons-celebration-event-2026?hl=en" }]
  },
  "mega-gyarados-in-mega-raids-august-2026": {
    summary: "Mega Gyarados is scheduled August 26–September 8, 2026, but is unavailable August 31–September 4 during Mega Ascension. It returns September 5–6 for Mega Finale.",
    bonuses: [],
    details: {
      availabilityExclusions: [{ start: "2026-08-31T00:00:00", end: "2026-09-05T00:00:00", label: "Unavailable during Mega Ascension (August 31–September 4)" }],
      raidBosses: [{ name: "Mega Gyarados" }]
    },
    sections: [{ title: "Schedule exception", items: ["Mega Gyarados is not available August 31–September 4, despite the overall event date range."] }],
    sourceLinks: [{ label: "LeekDuck raid schedule", href: "https://leekduck.com/events/mega-gyarados-in-mega-raids-august-2026/" }]
  },
  "pokemon-xp-2026-worlds": Object.freeze({
    summary: "PokémonXP and the 2026 Pokémon World Championships run August 25–30 globally, with the in-person Worlds weekend and a downloadable 33-stop community-mapped GO Stamp Rally in San Francisco from August 28–30.",
    bonuses: Object.freeze([
      "San Francisco hosts a 33-stop community-mapped Worlds Stamp Rally from August 28 through August 30.",
      "Completing the Worlds Stamp Rally awards a Pikachu encounter.",
      "The rally includes 16 disclosed event-exclusive stamp designs tied to PokémonXP, Worlds, and San Francisco."
    ]),
    sections: Object.freeze([
      Object.freeze({
        title: "PokémonXP & 2026 Worlds GO Stamp Rally",
        items: Object.freeze([
          "Available in San Francisco from August 28 through August 30, 2026.",
          "Collect stamps from 33 community-mapped PokéStops around San Francisco.",
          "The published stamp set includes Amoonguss, Charizard, Drifloon, Elekid, Ferrothorn & Meltan, Greninja, Incineroar, Kirlia, Lunatone, Numel, two Pikachu designs, Spheal, Umbreon, the PokémonXP logo, and a Cable Car.",
          "Completing the rally awards a Pikachu encounter.",
          "The separate Stamp Rally card includes a downloadable GPX with all 33 currently mapped waypoints."
        ])
      })
    ]),
    sourceLinks: Object.freeze([
      Object.freeze({ label: "Official 2026 Pokémon World Championships page", href: "https://www.pokemon.com/us/play-pokemon/pokemon-events/pokemon-tournaments/pokemon-world-championships/" }),
      Object.freeze({ label: "LeekDuck PokémonXP & 2026 Worlds guide", href: "https://leekduck.com/events/pokemon-xp-2026-worlds/" })
    ])
  }),
  "season-23-forever-forward": Object.freeze({
    summary: "Forever Forward runs June 2 through September 8, 2026, with new Mega debuts, rotating Max Battles, seasonal encounters, Eggs, Research Breakthroughs, and expanded Tuesday Showcases.",
    bonuses: Object.freeze([
      "Showcase Tuesday allows up to five PokéStop Showcase entries.",
      "Max Battles rotate through different Dynamax Pokémon and normally run from 6:00 AM to 9:00 PM local time.",
      "More Mega-Evolved Pokémon debut throughout the Season during Mega Raid Days.",
      "GO Pass milestone bonuses remain active after they are unlocked until that monthly pass ends."
    ]),
    sections: Object.freeze([
      Object.freeze({
        title: "Season highlights",
        items: Object.freeze([
          "Pokémon GO Fest 2026: Global featured Mewtwo and Zeraora and was free for logged-in Trainers.",
          "Mega Mewtwo X and Mega Mewtwo Y made their Pokémon GO debuts during GO Fest 2026.",
          "Community Days were scheduled for June 20, July 4, and August 16.",
          "Daily Discoveries are unavailable during weeks containing global GO Fest, GO Wild Area, or GO Tour events."
        ])
      }),
      Object.freeze({
        title: "Research Breakthrough encounters",
        items: Object.freeze(["Dragonite", "Axew", "Honedge", "Jangmo-o", "Indeedee", "Klawf"])
      }),
      Object.freeze({
        title: "Seasonal Eggs",
        items: Object.freeze([
          "2 km: Exeggcute, Corphish, Wynaut, and more",
          "5 km: Riolu, Mantyke, Flittle, and more",
          "Adventure Sync: Tyrogue, Sableye, Budew, and more",
          "7 km: Alolan Diglett, Galarian Corsola, Galarian Darumaka, and more",
          "Mateo Gift Exchange: Hisuian Growlithe, Hisuian Sneasel, White-Striped Basculin, and more",
          "10 km: Mawile, Absol, Frigibax, and more"
        ])
      })
    ]),
    sourceLinks: Object.freeze([
      Object.freeze({ label: "Official Forever Forward Season page", href: "https://pokemongo.com/en/seasons/forever-forward" })
    ])
  }),
  "go-pass-august-2026": Object.freeze({
    summary: "Earn GO Points from August 4 through September 8 to unlock free rewards and milestone bonuses. Deluxe adds faster progression, upgraded rewards, and a Lucky Trinket.",
    bonuses: Object.freeze([
      "Rank 1: one additional Candy from trades; level 31+ Trainers receive one guaranteed Candy XL from trades.",
      "Rank 25: open up to 40 Gifts daily, receive up to 125 Gifts from stops and Gyms, and hold 10 additional Gifts.",
      "Rank 50: double Daily Adventure Incense duration.",
      "Rank 75: increased XP and Stardust from hatching Eggs."
    ]),
    sections: Object.freeze([
      Object.freeze({
        title: "Free GO Pass rewards",
        items: Object.freeze([
          "Latias encounter with a chance to be Shiny",
          "Stardust",
          "XP",
          "Max Particles",
          "Additional progression rewards"
        ])
      }),
      Object.freeze({
        title: "GO Pass Deluxe",
        items: Object.freeze([
          "US$7.99 or regional equivalent for Deluxe; US$9.99 for Deluxe + 10 Ranks, subject to regional availability.",
          "Includes all free-track rewards plus upgraded rewards and additional Pokémon encounters.",
          "The final Deluxe reward is a single-use Lucky Trinket.",
          "Deluxe Rank 1 awards one Incubator on the first PokéStop or Gym spin of each day.",
          "Deluxe Rank 25 raises Gift limits to 50 opened, 150 received from stops/Gyms, and 20 additional held."
        ])
      }),
      Object.freeze({
        title: "Important deadlines",
        items: Object.freeze([
          "No daily GO Point earning limit from September 5 at 12:00 AM through September 6 at 11:59 PM local time.",
          "Pass rewards expire September 10, 2026, at 10:00 AM local time.",
          "The Deluxe Lucky Trinket expires September 13, 2026, at 11:59 PM local time."
        ])
      }),
      Object.freeze({
        title: "Lucky Trinket rules",
        items: Object.freeze([
          "Turns one eligible friend into a Lucky Friend for the next trade.",
          "The selected Trainer must be at least a Great Friend and cannot already be a Lucky Friend.",
          "It does not change the distance allowed for trading."
        ])
      })
    ]),
    sourceLinks: Object.freeze([
      Object.freeze({ label: "Official GO Pass: August announcement", href: "https://pokemongo.com/en/news/go-pass-august-2026" })
    ])
  }),
  "water-festival-2026": Object.freeze({
    summary: "Arrokuda and Cramorant debut during Ultra Unlock: Water Festival, with local catch-XP and Catch Stardust bonuses that increase in three stages.",
    bonuses: Object.freeze([
      "Rainy Lure Modules attract Arrokuda.",
      "Increased chance to encounter Shiny Ducklett and Shiny Dewpider.",
      "Aug 18 10:00 AM–Aug 20 10:00 AM local: 2× Catch XP and 3× Catch Stardust.",
      "Aug 20 10:00 AM–Aug 22 10:00 AM local: 3× Catch XP and 4× Catch Stardust.",
      "Aug 22 10:00 AM–Aug 24 8:00 PM local: 4× Catch XP and 5× Catch Stardust.",
      "GO Pass Rank 10: 2× Candy for catching Pokémon; Rank 20: 1/2 Egg Hatch Distance during the event."
    ]),
    details: Object.freeze({
      spawns: Object.freeze([
        "Psyduck", "Tentacool", "Goldeen", "Magikarp", "Marill", "Wailmer", "Corphish",
        "Ducklett", "Frillish", "Mareanie", "Dewpider", "Wimpod", "Arrokuda", "Barraskewda", "Gyarados", "Feebas",
        "Clamperl", "Wiglett"
      ].map(name => Object.freeze({ name }))),
      shinies: Object.freeze([
        "Ducklett", "Swanna", "Dewpider", "Araquanid", "Psyduck (Swim Ring)",
        "Tatsugiri", "Scarf Lapras", "Hisuian Samurott", "Dondozo"
      ].map(name => Object.freeze({ name }))),
      raidBosses: Object.freeze([
        "Psyduck (Swim Ring)", "Tatsugiri (Curly Form — Europe/Middle East/Africa)",
        "Tatsugiri (Droopy Form — Americas)", "Tatsugiri (Stretchy Form — Asia-Pacific)",
        "Scarf Lapras", "Hisuian Samurott", "Dondozo"
      ].map(name => Object.freeze({ name }))),
      bonusNotes: Object.freeze([
        "All bonus windows use each Trainer’s local time.",
        "Cramorant debuts in 5 km Eggs, GO Pass rewards, GO Battle League rewards from Rank 16, and GO Snapshots.",
        "Arrokuda and Barraskewda debut through Field Research, GO Pass rewards, and Rainy Lure Modules.",
        "The Water Festival GO Pass rewards expire Aug 26, 2026 at 8:00 PM local time."
      ]),
      bonusWindows: Object.freeze([
        Object.freeze({ startDate: "2026-08-18", startTime: "10:00", endDate: "2026-08-20", endTime: "10:00", label: "2× Catch XP · 3× Catch Stardust" }),
        Object.freeze({ startDate: "2026-08-20", startTime: "10:00", endDate: "2026-08-22", endTime: "10:00", label: "3× Catch XP · 4× Catch Stardust" }),
        Object.freeze({ startDate: "2026-08-22", startTime: "10:00", endDate: "2026-08-24", endTime: "20:00", label: "4× Catch XP · 5× Catch Stardust" })
      ]),
      sections: Object.freeze([
        Object.freeze({ title: "Pokémon debuts & features", items: Object.freeze([
          "Cramorant debuts in 5 km Eggs, GO Pass rewards, GO Battle League rewards from Rank 16, and GO Snapshots.",
          "Arrokuda and Barraskewda debut through Field Research, GO Pass rewards, and Rainy Lure Modules.",
          "Psyduck wearing a swim ring returns in the wild and 1-Star Raids."
        ]) }),
        Object.freeze({ title: "Rainy Lure encounters", items: Object.freeze([
          "Arrokuda"
        ]) }),
        Object.freeze({ title: "Field Research", items: Object.freeze([
          "Catch 5 Water-type Pokémon: Poké Balls, Great Balls, Ultra Balls, or Pinap Berries.",
          "Catch 10 Water-type Pokémon: Dewpider or Ducklett encounters.",
          "Catch 15 Water-type Pokémon: Arrokuda, Clamperl, or Feebas encounters."
        ]) }),
        Object.freeze({ title: "5 km Eggs", items: Object.freeze([
          "Cramorant (Normal)",
          "Cramorant (Gulping)",
          "Cramorant (Gorging)"
        ]) }),
        Object.freeze({ title: "1-Star Raids", items: Object.freeze([
          "Psyduck (Swim Ring)",
          "Tatsugiri (Curly Form — Europe, Middle East, and Africa)",
          "Tatsugiri (Droopy Form — Americas)",
          "Tatsugiri (Stretchy Form — Asia-Pacific)"
        ]) }),
        Object.freeze({ title: "3-Star Raids", items: Object.freeze([
          "Scarf Lapras",
          "Hisuian Samurott",
          "Dondozo"
        ]) }),
        Object.freeze({ title: "GO Battle League · Rank 16+", items: Object.freeze([
          "Cramorant (Normal)",
          "Cramorant (Gulping)",
          "Cramorant (Gorging)"
        ]) }),
        Object.freeze({ title: "GO Pass milestones", items: Object.freeze([
          "Rank 10: 2× Candy for catching Pokémon.",
          "Rank 20: 1/2 Egg Hatch Distance when Eggs are placed in an Incubator during the event.",
          "Earn up to 500 extra GO Points daily: raid win 100, hatch 40, catch 5, or catch 10 Water-type Pokémon 100."
        ]) })
      ])
    }),
    sourceLinks: Object.freeze([
      Object.freeze({ label: "Official Water Festival announcement", href: "https://pokemongo.com/en/news/water-festival-2026" }),
      Object.freeze({ label: "LeekDuck Water Festival guide", href: "https://leekduck.com/events/water-festival-2026/" }),
      Object.freeze({ label: "Pokémon GO Hub event guide", href: "https://pokemongohub.net/post/event/water-festival-2026/" })
    ])
  })
});

function copyRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => ({
    title: String(row?.title || "").trim(),
    items: (Array.isArray(row?.items) ? row.items : []).map(String)
  })).filter(row => row.title && row.items.length);
}

export function featuredEventDetails(eventId) {
  // Night Out venue hotfix (production since 2026-10-24).
  const nightOutHotfix = {"pokemon-night-out-los-angeles-2026":{"authoritativeSections":true,"eventOverrides":{"scope":"venue","location":"Intuit Dome, 3930 W Century Blvd, Inglewood, CA 90303","coordinates":"33.944195, -118.343087","timeZone":"America/Los_Angeles","localTime":true,"ticketRequired":true,"venues":[{"id":"pokemon-night-out-intuit-dome","name":"Intuit Dome · event venue","location":"Intuit Dome, 3930 W Century Blvd, Inglewood, CA 90303","coordinates":"33.944195, -118.343087","timeZone":"America/Los_Angeles","date":"2026-10-24","publishedDoorTime":"18:00","venueUrl":"https://www.intuitdome.com/events/event-schedule/3674","addressUrl":"https://www.intuitdome.com/plan-your-visit/how-to-get-here","coordinatesUrl":"https://www.google.com/maps/place/Intuit+Dome/@33.944195,-118.343087,17z"}],"venueNote":"The Pokémon GO announcement limits these encounters and raids to the event venue. The venue publishes its address and door time, but Pokémon GO gameplay start/end hours and an in-game venue perimeter are not published; automatic routing remains pending a verified gameplay window and boundary."},"summary":"Pokémon Night Out gameplay is venue-only at Intuit Dome, 3930 W Century Blvd, Inglewood, CA 90303 on 2026-10-24. The venue's published doors-open time is 6 PM PDT; the Pokémon GO announcement does not publish gameplay hours or an in-game perimeter.","bonuses":["Lure Modules activated during the event last one hour, excluding Golden Lure Modules"],"details":{"spawns":[{"name":"Gastly"},{"name":"Voltorb"},{"name":"Alolan Marowak"},{"name":"Hoothoot"},{"name":"Murkrow"},{"name":"Houndour"},{"name":"Electrike"},{"name":"Carvanha"},{"name":"Shinx"},{"name":"Zorua"},{"name":"Joltik"},{"name":"Froakie"},{"name":"Dedenne"},{"name":"Rookidee"},{"name":"Unown P"},{"name":"Unown N"},{"name":"Unown O"}],"raidBosses":[{"name":"Pikachu","tier":1},{"name":"Gengar","tier":3}],"maxBattleBosses":[],"sourceReviewRequired":true,"shinies":[{"name":"Gastly","methods":["collector"]},{"name":"Voltorb","methods":["collector"]},{"name":"Alolan Marowak","methods":["collector"]},{"name":"Hoothoot","methods":["collector"]},{"name":"Murkrow","methods":["collector"]},{"name":"Houndour","methods":["collector"]},{"name":"Electrike","methods":["collector"]},{"name":"Carvanha","methods":["collector"]},{"name":"Shinx","methods":["collector"]},{"name":"Zorua","methods":["collector"]},{"name":"Joltik","methods":["collector"]},{"name":"Froakie","methods":["collector"]},{"name":"Dedenne","methods":["collector"]},{"name":"Rookidee","methods":["collector"]},{"name":"Unown P","methods":["collector"]},{"name":"Unown N","methods":["collector"]},{"name":"Unown O","methods":["collector"]},{"name":"Pikachu","methods":["raider"]},{"name":"Gengar","methods":["raider"]}],"plannerLocations":[{"id":"pokemon-night-out-intuit-dome","name":"Intuit Dome · event venue","coordinates":"33.944195, -118.343087","timeZone":"America/Los_Angeles","provenance":"Official venue address and hours: https://www.intuitdome.com/plan-your-visit/how-to-get-here; map reference: https://www.google.com/maps/place/Intuit+Dome/@33.944195,-118.343087,17z. Coordinates identify the arena point only and do not define an event radius."}],"publishedGameplayPeriod":{"date":"2026-10-24","localTime":true,"venueOnly":true,"sourceUrl":"https://pokemongo.com/news/pokemon-night-out-irl-details2026","venueOpenFrom":"18:00","venueSourceUrl":"https://www.intuitdome.com/events/event-schedule/3674"},"manualOpportunities":["All listed wild encounters, raids, and Timed Research require being at the event venue. No event-wide or citywide search is authorized by the announcement.","The venue's door time does not establish Pokémon GO gameplay start or end times. Do not route automatically until the publisher provides gameplay hours and a verified venue boundary.","Timed Research can award Toxtricity encounters and an avatar item. These research rewards are separate from wild and raid targets."],"sections":[{"title":"Venue-only wild encounters","items":["Gastly","Voltorb","Alolan Marowak","Hoothoot","Murkrow","Houndour","Electrike","Carvanha","Shinx","Zorua","Joltik","Froakie","Dedenne","Rookidee","Unown P","Unown N","Unown O"]},{"title":"Venue raids","items":["One-star Pikachu and three-star Gengar raids can be Shiny and award a location background for the event city."]},{"title":"Venue hours and boundary","items":["The Pokémon GO announcement limits these encounters and raids to the event venue. The venue publishes its address and door time, but Pokémon GO gameplay start/end hours and an in-game venue perimeter are not published; automatic routing remains pending a verified gameplay window and boundary."]}]},"sections":[],"sourceLinks":[{"label":"Official Pokémon GO Night Out gameplay details","href":"https://pokemongo.com/news/pokemon-night-out-irl-details2026"},{"label":"Official Intuit Dome event and doors time","href":"https://www.intuitdome.com/events/event-schedule/3674"},{"label":"Official Intuit Dome address","href":"https://www.intuitdome.com/plan-your-visit/how-to-get-here"},{"label":"Official Intuit Dome map pin","href":"https://www.google.com/maps/place/Intuit+Dome/@33.944195,-118.343087,17z"}]},"pokemon-night-out-london-2026":{"authoritativeSections":true,"eventOverrides":{"scope":"venue","location":"The O2, Peninsula Square, London SE10 0DX","coordinates":"51.5029, 0.0032","timeZone":"Europe/London","localTime":true,"ticketRequired":true,"venues":[{"id":"pokemon-night-out-the-o2","name":"The O2 arena · event venue","location":"The O2, Peninsula Square, London SE10 0DX","coordinates":"51.5029, 0.0032","timeZone":"Europe/London","date":"2026-11-10","publishedDoorTime":"18:00","venueUrl":"https://www.theo2.co.uk/events/detail/pokemon-night-out","addressUrl":"https://www.theo2.co.uk/m/visit-us/maps","coordinatesUrl":"https://www.openstreetmap.org/way/161559801"}],"venueNote":"The Pokémon GO announcement limits these encounters and raids to the event venue. The venue publishes its address and door time, but Pokémon GO gameplay start/end hours and an in-game venue perimeter are not published; automatic routing remains pending a verified gameplay window and boundary."},"summary":"Pokémon Night Out gameplay is venue-only at The O2, Peninsula Square, London SE10 0DX on 2026-11-10. The venue's published doors-open time is 6 PM GMT; the Pokémon GO announcement does not publish gameplay hours or an in-game perimeter.","bonuses":["Lure Modules activated during the event last one hour, excluding Golden Lure Modules"],"details":{"spawns":[{"name":"Gastly"},{"name":"Voltorb"},{"name":"Alolan Marowak"},{"name":"Hoothoot"},{"name":"Murkrow"},{"name":"Houndour"},{"name":"Electrike"},{"name":"Carvanha"},{"name":"Shinx"},{"name":"Zorua"},{"name":"Joltik"},{"name":"Froakie"},{"name":"Dedenne"},{"name":"Rookidee"},{"name":"Unown P"},{"name":"Unown N"},{"name":"Unown O"}],"raidBosses":[{"name":"Pikachu","tier":1},{"name":"Gengar","tier":3}],"maxBattleBosses":[],"sourceReviewRequired":true,"shinies":[{"name":"Gastly","methods":["collector"]},{"name":"Voltorb","methods":["collector"]},{"name":"Alolan Marowak","methods":["collector"]},{"name":"Hoothoot","methods":["collector"]},{"name":"Murkrow","methods":["collector"]},{"name":"Houndour","methods":["collector"]},{"name":"Electrike","methods":["collector"]},{"name":"Carvanha","methods":["collector"]},{"name":"Shinx","methods":["collector"]},{"name":"Zorua","methods":["collector"]},{"name":"Joltik","methods":["collector"]},{"name":"Froakie","methods":["collector"]},{"name":"Dedenne","methods":["collector"]},{"name":"Rookidee","methods":["collector"]},{"name":"Unown P","methods":["collector"]},{"name":"Unown N","methods":["collector"]},{"name":"Unown O","methods":["collector"]},{"name":"Pikachu","methods":["raider"]},{"name":"Gengar","methods":["raider"]}],"plannerLocations":[{"id":"pokemon-night-out-the-o2","name":"The O2 arena · event venue","coordinates":"51.5029, 0.0032","timeZone":"Europe/London","provenance":"Official venue address and hours: https://www.theo2.co.uk/m/visit-us/maps; map reference: https://www.openstreetmap.org/way/161559801. Coordinates identify the arena point only and do not define an event radius."}],"publishedGameplayPeriod":{"date":"2026-11-10","localTime":true,"venueOnly":true,"sourceUrl":"https://pokemongo.com/news/pokemon-night-out-irl-details2026","venueOpenFrom":"18:00","venueSourceUrl":"https://www.theo2.co.uk/events/detail/pokemon-night-out"},"manualOpportunities":["All listed wild encounters, raids, and Timed Research require being at the event venue. No event-wide or citywide search is authorized by the announcement.","The venue's door time does not establish Pokémon GO gameplay start or end times. Do not route automatically until the publisher provides gameplay hours and a verified venue boundary.","Timed Research can award Toxtricity encounters and an avatar item. These research rewards are separate from wild and raid targets."],"sections":[{"title":"Venue-only wild encounters","items":["Gastly","Voltorb","Alolan Marowak","Hoothoot","Murkrow","Houndour","Electrike","Carvanha","Shinx","Zorua","Joltik","Froakie","Dedenne","Rookidee","Unown P","Unown N","Unown O"]},{"title":"Venue raids","items":["One-star Pikachu and three-star Gengar raids can be Shiny and award a location background for the event city."]},{"title":"Venue hours and boundary","items":["The Pokémon GO announcement limits these encounters and raids to the event venue. The venue publishes its address and door time, but Pokémon GO gameplay start/end hours and an in-game venue perimeter are not published; automatic routing remains pending a verified gameplay window and boundary."]}]},"sections":[],"sourceLinks":[{"label":"Official Pokémon GO Night Out gameplay details","href":"https://pokemongo.com/news/pokemon-night-out-irl-details2026"},{"label":"Official The O2 event and doors time","href":"https://www.theo2.co.uk/events/detail/pokemon-night-out"},{"label":"Official The O2 map and address","href":"https://www.theo2.co.uk/m/visit-us/maps"},{"label":"Official Intuit Dome map pin","href":"https://www.openstreetmap.org/way/161559801"}]}};
  if (Object.hasOwn(nightOutHotfix, String(eventId || "").trim())) return nightOutHotfix[String(eventId || "").trim()];
  const schedule = raidScheduleFeaturedDetails(String(eventId || "").trim());
  if (schedule) return schedule;
  const row = FEATURED_EVENT_DETAILS[String(eventId || "").trim()];
  // Into the Wild 2026 (Nov 9–13): the source-reviewed pools, raids, Max Battles and hours. The rest of the autumn
  // batch is not wired in yet (see docs/HANDOFF.md, "Unfinished").
  if (!row && String(eventId || "").trim() === "into-the-wild-2026") return reviewedAutumnEventDetails("into-the-wild-2026");
  if (!row) return null;
  return {
    authoritativeSections: row.authoritativeSections === true,
    eventOverrides: row.eventOverrides ? { ...row.eventOverrides } : null,
    summary: row.summary,
    bonuses: [...row.bonuses],
    details: row.details ? {
      ...row.details,
      spawns: Array.isArray(row.details.spawns) ? row.details.spawns.map(item => ({ ...item })) : [],
      shinies: Array.isArray(row.details.shinies) ? row.details.shinies.map(item => ({ ...item })) : [],
      raidBosses: Array.isArray(row.details.raidBosses) ? row.details.raidBosses.map(item => ({ ...item })) : [],
      researchMethods: Array.isArray(row.details.researchMethods) ? row.details.researchMethods.map(item => ({ ...item,
        ...(Array.isArray(item.rewardSpecies) ? { rewardSpecies: [...item.rewardSpecies] } : {}),
        ...(item.claimDeadline && typeof item.claimDeadline === "object" ? { claimDeadline: { ...item.claimDeadline } } : {}) })) : [],
      bonusNotes: Array.isArray(row.details.bonusNotes) ? [...row.details.bonusNotes] : [],
      bonusWindows: Array.isArray(row.details.bonusWindows) ? row.details.bonusWindows.map(item => ({ ...item })) : [],
      sections: copyRows(row.details.sections)
    } : null,
    sections: copyRows(row.sections || row.details?.sections),
    sourceLinks: row.sourceLinks.map(link => ({ ...link }))
  };
}
