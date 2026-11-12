export const IIT_DELHI_VERIFIED_ARTICLE_SHA256 = "5d5cf71cb3cc2d7e4ff6a0e27802088f1a1f9d0403cb50401bc177b8ffc9d0ef";
const link = "https://pokemongo.com/news/pokemongo-iitdelhi-2026?hl=eng";
// Extracted from the official announcement on 2026-09-22. Coordinates remain
// blank until a named campus location has independent geographic evidence.
export function iitDelhiEvent() {
  return {
    sourceVerification: { lastVerified: "2026-09-22", articleSha256: IIT_DELHI_VERIFIED_ARTICLE_SHA256, mode: "curated-source-fingerprint" },
    id: "local-iit-delhi-rendezvous-2026", name: "Pokémon GO at IIT Delhi — Rendezvous 2026", heading: "Official Regional Event",
    eventType: "local-partnership", start: "2026-09-28T10:00:00+05:30", end: "2026-10-01T20:00:00+05:30",
    timeZone: "Asia/Kolkata", scope: "venue", link, location: "IIT Delhi campus, New Delhi, India", coordinates: "",
    species: ["Bulbasaur", "Charmander", "Squirtle", "Pikachu", "Eevee", "Nidoran♀", "Nidoran♂", "Lapras", "Snorlax"],
    bonuses: ["Event wild encounters, daily featured raids, Collection Challenges, and Timed Research."], hasSpawns: true,
    sourceLabel: "Official Pokémon GO", startingSoonAlert: false, ticketRequired: false,
    venueNote: "The official source identifies the IIT Delhi campus and booth; exact gameplay boundaries and booth coordinates are not published here.",
    scheduleNote: "September 28 at 10:00 through October 1 at 20:00 local India time. The article specifies raid dates but does not publish separate daily raid hours or tiers.",
    details: {
      // The source gives one continuous in-game period, but no verified
      // gameplay point within the campus. Display this fact without making
      // the parent window eligible for automatic Collector admission.
      publishedGameplayPeriod: { start: "2026-09-28T10:00:00+05:30", end: "2026-10-01T20:00:00+05:30", sourceUrl: link },
      spawns: ["Bulbasaur", "Charmander", "Squirtle", "Pikachu", "Eevee", "Nidoran♀", "Nidoran♂", "Lapras", "Snorlax"].map(name => ({ name, shiny: true })),
      research: ["Venusaur", "Charizard", "Blastoise"].map(name => ({ name, shiny: true, source: "Timed Research" })),
      sections: [
        { title: "Daily featured raids", items: ["September 28: Meowth", "September 29: Psyduck", "September 30: Snorlax", "October 1: Lapras", "Each featured raid species can be Shiny. Separate daily hours and raid tiers are not published."] },
        { title: "Collection Challenges", items: ["Catch event-themed Pokémon for an Incense, Poké Balls, and XP."] },
        { title: "Timed Research", items: ["Rewards include XP, Poké Balls, a Premium Battle Pass, an Incense, Rare Candy, and event-themed encounters including Venusaur, Charizard, and Blastoise."] }
      ], sourceLinks: [{ label: "Official IIT Delhi announcement", href: link }]
    }
  };
}

export function festivalOfLightsEvent() {
  const sourceUrl = "https://pokemongo.com/en/news/festival-of-lights-2026";
  const saree = "Pikachu wearing a saree";
  const kurta = "Pikachu wearing a kurta";
  const wild = ["Charmander", saree, kurta, "Chinchou", "Mareep", "Camerupt", "Litwick", "Lampent", "Morelull", "Tadbulb"];
  const windows = ["2026-11-06", "2026-11-07", "2026-11-08"].flatMap(date =>
    [["18:00", "18:05"], ["18:30", "18:35"], ["19:00", "19:05"], ["19:30", "19:35"]].map(([start, end]) => ({
      label: `Sparkle O'Clock · ${start} India time`,
      start: `${date}T${start}:00`,
      end: `${date}T${end}:00`,
      localTime: true, spawns: wild, sourceUrl
    })));
  return {
    id: "local-festival-of-lights-india-2026", name: "Festival of Lights 2026 · India",
    heading: "India Regional Event", eventType: "regional-event",
    start: "2026-11-06T10:00:00", end: "2026-11-08T20:00:00", localTime: true,
    timeZone: "Asia/Kolkata", scope: "regional", link: sourceUrl, location: "India",
    // Geographic discovery point only; the official event applies across India.
    coordinates: "", sourceLabel: "Official Pokémon GO", startingSoonAlert: true,
    species: wild, hasSpawns: true, costumePokemon: true, specialBackground: true,
    bonuses: ["3× Lure Module duration", "Event stickers from PokéStops"],
    scheduleNote: "November 6–8, 10 AM–8 PM India time. Sparkle O'Clock wild bursts occur for five minutes at 6:00, 6:30, 7:00, and 7:30 PM each day. Ordinary event raids and Timed Research are separate methods.",
    venueNote: "New Delhi is a representative India search point, not an event boundary or guaranteed spawn cluster.",
    details: {
      nativeHuntSearchPolicy: "global-no-venue",
      plannerLocations: [{ id: "india-new-delhi", name: "New Delhi · India regional starting point",
        coordinates: "28.6139, 77.2090", timeZone: "Asia/Kolkata" }],
      spawns: wild.map(name => ({ name })),
      shinies: wild.map(name => ({ name, methods: name === saree || name === kurta
        ? ["collector", "raider"] : ["collector"] })),
      costumePokemon: [{ name: saree }, { name: kurta }],
      backgroundPokemon: [{ name: saree, source: "Wild bursts, raids, or Timed Research" },
        { name: kurta, source: "Wild bursts, raids, or Timed Research" }],
      wildBackgroundPokemon: [{ name: saree }, { name: kurta }],
      raidBackgroundPokemon: [{ name: saree }, { name: kurta }],
      raidBosses: [{ name: saree }, { name: kurta }],
      spawnSchedule: { sourceUrl, sourceKind: "official", verifiedDate: "2026-09-29",
        localTime: true, confirmedWildSpawns: wild, windows },
      manualOpportunities: [
        "India-only raids feature saree and kurta Pikachu with possible Shiny and Special Background outcomes. Daily raid hours and tiers are not published, so do not treat the whole weekend as a guaranteed raid window.",
        "Choose one branch of Timed Research, available from November 1 at 6 AM, for a Special Background saree or kurta Pikachu encounter. This is separate from the five-minute wild bursts.",
        "Regular Lure Modules have triple duration and can attract other event Pokémon; the automatic wild hunt does not activate Lures."
      ],
      sections: [
        { title: "Sparkle O'Clock", items: ["Each day, wild spawns surge for five minutes at 6:00, 6:30, 7:00, and 7:30 PM India time. Saree and kurta Pikachu can each be Shiny and can have a Special Background on the same encounter."] },
        { title: "Other methods", items: ["Saree and kurta Pikachu also appear in raids, but exact daily raid hours are not published. Branching Timed Research provides one of the two background costume encounters; Lures attract a different lineup."] }
      ],
      sourceLinks: [{ label: "Official Festival of Lights announcement", href: sourceUrl },
        { label: "New Delhi geographic discovery point", href: "https://www.openstreetmap.org/node/16173236" }]
    }
  };
}
