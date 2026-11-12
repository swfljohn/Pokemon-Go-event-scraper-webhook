// Source-reviewed autumn event details that do not belong in the rotating
// parser catalog. Every call returns fresh nested metadata for safe callers.
const HALLOWEEN_1 = "https://pokemongo.com/news/halloween-part-1-2026";
const HALLOWEEN_2 = "https://pokemongo.com/news/halloween-part-2-2026";
const INTO_WILD = "https://pokemongo.com/en/news/into-the-wild-2026";
const NIGHT_OUT = "https://pokemongo.com/news/pokemon-night-out-irl-details2026";
const BOSTON = "https://pokemongo.com/news/city-safari-boston-rescheduled";
const MINIOR = "https://pokemongo.com/en/news/minior-meteor-showers-2026";
const DIA_DE_MUERTOS = "https://pokemongo.com/es-MX/news/dia-de-muertos-2026";
const FC_SEOUL = "https://pokemongo.com/ko/news/fc-seoul-2026";
const SINISTEA_BOW_AUTOMATION_RESTRICTION = {
  kind: "raider", target: "Sinistea wearing a bow",
  reason: "The exact native Sinistea form is unconfirmed; automatic Raider planning is unavailable."
};

const dayWindows = (dates, start, end, label, sourceUrl) => dates.map(date => ({
  label, start: `${date}T${start}:00`, end: `${date}T${end}:00`, localTime: true, sourceUrl
}));
const encounter = (name, methods) => ({ name, methods });
function halloweenPartOne() {
  const wild = ["Zubat wearing a top hat", "Duskull", "Piplup wearing a Halloween Mischief costume",
    "Drifblim wearing a Halloween Mischief costume"];
  const raids = ["Pikachu wearing a hat and capelet", "Sinistea wearing a bow"];
  const window = { label: "Halloween 2026 Part I", start: "2026-10-27T10:00:00", end: "2026-11-01T10:00:00", localTime: true, sourceUrl: HALLOWEEN_1 };
  return {
    authoritativeSections: true,
    eventOverrides: { costumePokemon: true },
    summary: "October 27 at 10 AM through November 1 at 10 AM local time. The published wild pool and one-star raid pool are separate; wild Drifblim is a rarer encounter. GO Pass catch bonuses require reaching Rank 10 or Rank 20.",
    bonuses: ["GO Pass Rank 10: 2× catch Candy (GO Pass Deluxe: 3×)", "GO Pass Rank 20: 2× catch Stardust (GO Pass Deluxe: 3×)"],
    details: {
      spawns: wild.map(name => ({ name })), raidBosses: raids.map(name => ({ name, tier: 1 })), maxBattleBosses: [],
      plannerTargetRestrictions: [{ ...SINISTEA_BOW_AUTOMATION_RESTRICTION }],
      shinies: [...wild.map(name => encounter(name, ["collector"])), ...raids.map(name => encounter(name, ["raider"]))],
      gameplayWindows: [window],
      spawnSchedule: { sourceUrl: HALLOWEEN_1, sourceKind: "official", verifiedDate: "2026-10-23", localTime: true,
        confirmedWildSpawns: wild, windows: [{ ...window, spawns: wild }] },
      raidSchedule: { sourceUrl: HALLOWEEN_1, sourceKind: "official", verifiedDate: "2026-10-23", localTime: true,
        windows: [{ ...window, label: "Halloween Part I · one-star raid availability", bosses: raids.map(name => ({ name, tier: 1 })) }] },
      bonusNotes: ["Catch bonuses unlock only after the corresponding GO Pass milestone: Rank 10 for Candy and Rank 20 for Stardust. Deluxe changes each reward from 2× to 3×."],
      manualOpportunities: ["The source says tapping spooky surprises may award event-themed encounters, but it does not publish their complete encounter pool; those rewards are not listed as ordinary wild targets.",
        "Free Timed Research and Field Research rewards are separate from wild and raid encounters. The official source does not publish the full Field Research encounter list."],
      sections: [
        { title: "Wild encounters", items: ["Zubat wearing a top hat, Duskull, and Piplup wearing a Halloween Mischief costume appear in the published wild pool. Drifblim wearing a Halloween Mischief costume is a rarer wild encounter. Each listed wild target can be Shiny."] },
        { title: "One-star raids", items: ["Pikachu wearing a hat and capelet and Sinistea wearing a bow appear in one-star raids; both can be Shiny."] },
        { title: "GO Pass milestones", items: ["Reach Rank 10 for 2× catch Candy, or 3× with Deluxe. Reach Rank 20 for 2× catch Stardust, or 3× with Deluxe. These bonuses are conditional, not automatic event-wide bonuses."] }
      ]
    },
    sections: [], sourceLinks: [{ label: "Official Halloween Part I announcement", href: HALLOWEEN_1 }]
  };
}

function halloweenPartTwo() {
  const wild = ["Litwick", "Rowlet wearing a Pokémon Halloween costume", "Greavard", "Gengar wearing a Spooky Festival costume"];
  const raids = ["Pikachu wearing a hat and capelet", "Sinistea wearing a bow"];
  const window = { label: "Halloween 2026 Part II", start: "2026-11-01T10:00:00", end: "2026-11-05T20:00:00", localTime: true, sourceUrl: HALLOWEEN_2 };
  return {
    authoritativeSections: true,
    eventOverrides: { costumePokemon: true },
    summary: "November 1 at 10 AM through November 5 at 8 PM local time. The published wild pool and one-star raid pool are separate. Shiny Greavard is available in the wild and through GO Pass or Field Research; other research rewards remain separate.",
    bonuses: ["GO Pass Rank 10: 2× catch Candy (GO Pass Deluxe: 3×)", "GO Pass Rank 20: 2× catch Stardust (GO Pass Deluxe: 3×)"],
    details: {
      spawns: wild.map(name => ({ name })), raidBosses: raids.map(name => ({ name, tier: 1 })), maxBattleBosses: [],
      plannerTargetRestrictions: [{ ...SINISTEA_BOW_AUTOMATION_RESTRICTION }],
      shinies: [...wild.map(name => encounter(name, ["collector"])), ...raids.map(name => encounter(name, ["raider"]))],
      gameplayWindows: [window],
      spawnSchedule: { sourceUrl: HALLOWEEN_2, sourceKind: "official", verifiedDate: "2026-10-23", localTime: true,
        confirmedWildSpawns: wild, windows: [{ ...window, spawns: wild }] },
      raidSchedule: { sourceUrl: HALLOWEEN_2, sourceKind: "official", verifiedDate: "2026-10-23", localTime: true,
        windows: [{ ...window, label: "Halloween Part II · one-star raid availability", bosses: raids.map(name => ({ name, tier: 1 })) }] },
      bonusNotes: ["Catch bonuses unlock only after the corresponding GO Pass milestone: Rank 10 for Candy and Rank 20 for Stardust. Deluxe changes each reward from 2× to 3×."],
      manualOpportunities: ["Greavard is also available through GO Pass and Field Research; those reward encounters do not add research-only targets to the wild pool.",
        "Free Timed Research rewards Sinistea wearing a bow. Field Research and GO Pass can offer additional encounters; their full species lists are not published."],
      sections: [
        { title: "Wild encounters", items: ["Litwick, Rowlet wearing a Pokémon Halloween costume, and Greavard appear in the published wild pool. Gengar wearing a Spooky Festival costume is a rarer wild encounter. Each can be Shiny."] },
        { title: "One-star raids", items: ["Pikachu wearing a hat and capelet and Sinistea wearing a bow appear in one-star raids; both can be Shiny."] },
        { title: "GO Pass milestones", items: ["Reach Rank 10 for 2× catch Candy, or 3× with Deluxe. Reach Rank 20 for 2× catch Stardust, or 3× with Deluxe. These bonuses are conditional, not automatic event-wide bonuses."] }
      ]
    },
    sections: [], sourceLinks: [{ label: "Official Halloween Part II announcement", href: HALLOWEEN_2 }]
  };
}

function intoTheWild() {
  const wild = ["Magnemite", "Noibat", "Togedemaru"];
  const raids = ["Druddigon", "Orthworm", "Zacian (Crowned Sword)", "Zamazenta (Crowned Shield)"];
  const max = ["Ralts", "Machop", "Registeel", "Regidrago", "Latias", "Latios"];
  const raidTiers = new Map([["Druddigon", 3], ["Orthworm", 3],
    ["Zacian (Crowned Sword)", 5], ["Zamazenta (Crowned Shield)", 5]]);
  const maxLevels = new Map([["Ralts", 1], ["Machop", 2], ["Registeel", 5],
    ["Regidrago", 5], ["Latias", 5], ["Latios", 5]]);
  const dates = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
  const gameplay = [{ label: "Into the Wild · event hours", start: "2026-11-09T10:00:00", end: "2026-11-13T20:00:00", localTime: true, sourceUrl: INTO_WILD }];
  const maxSchedule = [
    { ...gameplay[0], label: "One-star Max Battles · event availability", bosses: [{ name: "Ralts", level: maxLevels.get("Ralts") }] },
    { ...gameplay[0], label: "Two-star Max Battles · event availability", bosses: [{ name: "Machop", level: maxLevels.get("Machop") }] },
    ...dates.slice(2).map((date, index) => {
      const bosses = [["Registeel"], ["Regidrago"], ["Latias", "Latios"]][index];
      const nextDate = dates[index + 3] || "2026-11-14";
      return { label: `Five-star Max Battles · ${bosses.join(" and ")} · date availability`,
        start: `${date}T00:00:00`, end: date === "2026-11-13" ? gameplay[0].end : `${nextDate}T00:00:00`,
        localTime: true, bosses: bosses.map(name => ({ name, level: maxLevels.get(name) })), sourceUrl: INTO_WILD };
    })
  ];
  const raidSchedule = [
    { ...gameplay[0], label: "Three-star raid availability · event window", bosses: raids.slice(0, 2).map(name => ({ name, tier: raidTiers.get(name) })) },
    { ...gameplay[0], label: "Five-star raid availability · event window", bosses: raids.slice(2).map(name => ({ name, tier: raidTiers.get(name) })) }
  ];
  const bonusWindows = [
    { label: "Raid Hour · Crowned Sword Zacian", start: "2026-11-09T18:00:00", end: "2026-11-09T19:00:00", localTime: true,
      bonus: "Crowned Sword Zacian is additionally featured during Raid Hour.", sourceUrl: INTO_WILD },
    { label: "Raid Hour · Crowned Shield Zamazenta", start: "2026-11-10T18:00:00", end: "2026-11-10T19:00:00", localTime: true,
      bonus: "Crowned Shield Zamazenta is additionally featured during Raid Hour.", sourceUrl: INTO_WILD },
    ...dates.slice(2).map((date, index) => {
      const bosses = [["Registeel"], ["Regidrago"], ["Latias", "Latios"]][index];
      return { label: `Five-star Max Battle Hour · ${bosses.join(" and ")}`, start: `${date}T18:00:00`, end: `${date}T19:00:00`,
        localTime: true, bonus: `${bosses.join(" and ")} are additionally featured during Max Battle Hour.`, sourceUrl: INTO_WILD };
    })
  ];
  return {
    authoritativeSections: true,
    summary: "November 9 at 10 AM through November 13 at 8 PM local time. The published wild, ordinary raid, and Dynamax Max Battle pools are separate. Dynamax Meltan comes from GO Pass rewards; it is not a wild spawn, raid boss, or Max Battle boss in this event.",
    bonuses: ["Shiny Gimmighoul chance when using a Coin Bag", "Shiny Meltan chance and shorter Mystery Box cooldown"],
    details: {
      spawns: wild.map(name => ({ name })),
      raidBosses: raids.map(name => ({ name, tier: raidTiers.get(name) })),
      maxBattleBosses: max.map(name => ({ name, level: maxLevels.get(name) })),
      shinies: [...wild, ...raids, ...max].map(name => encounter(name, [wild.includes(name) ? "collector" : raids.includes(name) ? "raider" : "max"])),
      gameplayWindows: gameplay,
      spawnSchedule: { sourceUrl: INTO_WILD, sourceKind: "official", verifiedDate: "2026-10-23", localTime: true,
        confirmedWildSpawns: wild, windows: [{ ...gameplay[0], spawns: wild }] },
      raidSchedule: { sourceUrl: INTO_WILD, sourceKind: "official", verifiedDate: "2026-10-23", localTime: true, windows: raidSchedule },
      maxBattleSchedule: { sourceUrl: INTO_WILD, sourceKind: "official", verifiedDate: "2026-10-23", localTime: true, windows: maxSchedule },
      bonusWindows,
      manualOpportunities: ["Dynamax Meltan is a GO Pass reward. Ordinary Meltan encounters use the Mystery Box; neither is an ordinary wild Collector target or a Max Battle boss.",
        "Shiny Gimmighoul is tied to using the Coin Bag. Shiny Meltan is tied to using the Mystery Box, with a shorter cooldown. These item-based encounters are separate from wild encounters.",
        "Field Research, GO Pass rewards, and the global challenge are separate activities. The official announcement names only Magnemite, Noibat, and Togedemaru as wild examples; the source says other event-themed Pokémon may also appear."],
      sections: [
        { title: "Wild encounters", items: ["Magnemite, Noibat, and Togedemaru are the wild encounters named by the official announcement. The source also says other event-themed Pokémon may appear; their complete pool is not published."] },
        { title: "Raids", items: ["Three-star: Druddigon and Orthworm. Five-star: Crowned Sword Zacian and Crowned Shield Zamazenta. Raid Hours: Zacian November 9 and Zamazenta November 10, 6–7 PM local time."] },
        { title: "Max Battles", items: ["One-star Ralts and two-star Machop. Five-star: Registeel November 11, Regidrago November 12, and Latias plus Latios November 13. Each five-star Max boss has a 6–7 PM local Max Battle Hour on its scheduled day."] }
      ]
    },
    sections: [], sourceLinks: [{ label: "Official Into the Wild announcement", href: INTO_WILD }]
  };
}

function bostonRescheduled() {
  const wild = ["Jigglypuff", "Abra", "Slowpoke", "Totodile", "Mareep", "Marill", "Hoppip", "Unown B", "Unown L", "Unown M", "Unown R",
    "Stantler", "Miltank", "Wingull", "Baltoy", "Buizel", "Lillipup", "Petilil", "Yamask", "Gothita", "Orange Flower Flabébé",
    "Binacle", "Clauncher", "Hawlucha", "Mudbray", "Oranguru", "Komala", "Flamigo"];
  const dates = ["2026-10-24", "2026-10-25"];
  const windows = dayWindows(dates, "10:00", "18:00", "Boston City Safari · ticket-holder global wild encounters", BOSTON)
    .map((window, index) => ({ ...window, ticketDay: dates[index], spawns: wild }));
  return {
    authoritativeSections: true,
    eventOverrides: { scope: "global", location: "Worldwide · original Boston ticket holders", localTime: true, ticketRequired: true,
      start: "2026-10-24T10:00:00", end: "2026-10-25T18:00:00", venueNote: "Global gameplay is for existing Boston City Safari ticket holders on the specific purchased event day. No new tickets are sold. Boston-only Special Research is separate; there is no Boston GO Stamp Rally." },
    summary: "Rescheduled to October 24–25, 10 AM–6 PM local time worldwide for existing ticket holders only. Select only event days purchased for every account. The 28 listed Pokémon are the wild pool; Boston-only Special Research and Egg encounters are separate.",
    bonuses: ["Increased Shiny chance", "Four-hour Lure Modules (excluding Golden Lure Modules)", "Up to five Special Trades", "Half Stardust cost for trades", "Eight-hour Party Play"],
    details: {
      requiresPurchasedEventDays: true, spawns: wild.map(name => ({ name })), raidBosses: [], maxBattleBosses: [],
      shinies: wild.filter(name => name !== "Flamigo").map(name => encounter(name, ["collector"])),
      gameplayWindows: windows.map(({ ticketDay, spawns, ...window }) => window),
      spawnSchedule: { sourceUrl: BOSTON, sourceKind: "official", verifiedDate: "2026-10-23", localTime: true, confirmedWildSpawns: wild, windows },
      research: [
        { name: "Global Timed Research", source: "Timed Research",
          tasks: [{ text: "Rewards", reward: "Orange Flower Flabébé, Hawlucha, Mudbray, and Komala" }] },
        { name: "Boston-only Special Research",
          instructions: "Current ticket holders only; no new tickets. Available anywhere Oct 24, 2026–Oct 23, 2028; obtain-by window, not completion deadline. One opportunity per ticketed day.",
          tasks: [{ text: "Spin Boston PokéStops", reward: "Up to 9 Explorer-hat Eevee with a Boston Location Background" }] }
      ],
      manualOpportunities: ["Only existing ticket holders can use these global event benefits. The planner cannot verify ticket ownership; choose only dates already purchased for each selected account.",
        "Explorer-hat Eevee is a Boston-only Special Research encounter that requires spinning Boston PokéStops. Do not treat it as a wild target or global encounter.",
        "The four listed 7 km Egg species are hatch encounters, not wild targets. There is no Boston GO Stamp Rally."],
      sections: [{ title: "Published wild pool", items: wild },
        { title: "Ticket days and separate activities", items: ["October 24 and 25, 10 AM–6 PM local time worldwide, for existing ticket holders on each purchased day.",
          "Boston-only research awards Explorer-hat Eevee after spinning Boston PokéStops. The event has no Boston GO Stamp Rally. Egg species are hatch encounters, not wild targets."] }]
    }, sections: [], sourceLinks: [{ label: "Official Boston reschedule announcement", href: BOSTON }]
  };
}

function miniorShower(label, firstDay, lastDay) {
  const target = "Minior (Meteor Form)";
  const windows = [];
  for (let date = Date.parse(`${firstDay}T00:00:00Z`); date <= Date.parse(`${lastDay}T00:00:00Z`); date += 86_400_000) {
    const day = new Date(date).toISOString().slice(0, 10);
    const next = new Date(date + 86_400_000).toISOString().slice(0, 10);
    windows.push({ label: `${label} · Meteor Form wild encounters`, start: `${day}T${day === firstDay ? "17:00" : "00:00"}:00`,
      end: day === lastDay ? `${day}T23:59:00` : `${next}T00:00:00`, localTime: true, spawns: [target], sourceUrl: MINIOR });
  }
  return {
    authoritativeSections: true,
    summary: `${label}: wild Meteor Form Minior is available from ${firstDay} at 5 PM through ${lastDay} at 11:59 PM local time. The encounter chance increases from 5–9 PM each day; no core color or Shiny availability is announced for this shower.`,
    bonuses: ["Increased chance of wild Minior from 5–9 PM local time", "1,000 Stardust for catching Minior"],
    details: {
      spawns: [{ name: target }], raidBosses: [], maxBattleBosses: [], shinies: [],
      gameplayWindows: windows.map(({ spawns, ...window }) => window),
      debutPokemon: [{ name: "Minior", target, methods: ["collector"] }],
      spawnSchedule: { sourceUrl: MINIOR, sourceKind: "official", verifiedDate: "2026-10-23", localTime: true, confirmedWildSpawns: [target], windows },
      manualOpportunities: ["The announcement does not identify this shower's core color. Choose Meteor Form for wild encounters; do not substitute a specific core color.",
        "The 5–9 PM increase is a boost within the longer published shower window. No Shiny availability is announced."],
      sections: [{ title: "Meteor Form wild encounters", items: [
        `Meteor Form Minior is available from ${firstDay} at 5 PM through ${lastDay} at 11:59 PM local time. Encounters are more likely from 5–9 PM each day.`,
        "The source does not announce a core color or Shiny availability for this shower."
      ] }]
    }, sections: [], sourceLinks: [{ label: "Official Minior meteor shower announcement", href: MINIOR }]
  };
}

function nightOut(eventId) {
  const losAngeles = eventId === "pokemon-night-out-los-angeles-2026";
  const venue = losAngeles ? {
    id: "pokemon-night-out-intuit-dome", name: "Intuit Dome · event venue", location: "Intuit Dome, 3930 W Century Blvd, Inglewood, CA 90303",
    coordinates: "33.944195, -118.343087", timeZone: "America/Los_Angeles", date: "2026-10-24", publishedDoorTime: "18:00",
    venueUrl: "https://www.intuitdome.com/events/event-schedule/3674", addressUrl: "https://www.intuitdome.com/plan-your-visit/how-to-get-here",
    coordinatesUrl: "https://www.google.com/maps/place/Intuit+Dome/@33.944195,-118.343087,17z"
  } : {
    id: "pokemon-night-out-the-o2", name: "The O2 arena · event venue", location: "The O2, Peninsula Square, London SE10 0DX",
    coordinates: "51.5029, 0.0032", timeZone: "Europe/London", date: "2026-11-10", publishedDoorTime: "18:00",
    venueUrl: "https://www.theo2.co.uk/events/detail/pokemon-night-out", addressUrl: "https://www.theo2.co.uk/m/visit-us/maps",
    coordinatesUrl: "https://www.openstreetmap.org/way/161559801"
  };
  const wild = ["Gastly", "Voltorb", "Alolan Marowak", "Hoothoot", "Murkrow", "Houndour", "Electrike", "Carvanha", "Shinx", "Zorua",
    "Joltik", "Froakie", "Dedenne", "Rookidee", "Unown P", "Unown N", "Unown O"];
  const raids = [{ name: "Pikachu", tier: 1 }, { name: "Gengar", tier: 3 }];
  const sourceNote = "The Pokémon GO announcement limits these encounters and raids to the event venue. The venue publishes its address and door time, but Pokémon GO gameplay start/end hours and an in-game venue perimeter are not published; automatic routing remains pending a verified gameplay window and boundary.";
  return {
    authoritativeSections: true,
    eventOverrides: { scope: "venue", location: venue.location, coordinates: venue.coordinates, timeZone: venue.timeZone, localTime: true,
      ticketRequired: true, venues: [{ ...venue }], venueNote: sourceNote },
    summary: `Pokémon Night Out gameplay is venue-only at ${venue.location} on ${venue.date}. The venue's published doors-open time is 6 PM ${losAngeles ? "PDT" : "GMT"}; the Pokémon GO announcement does not publish gameplay hours or an in-game perimeter.`,
    bonuses: ["Lure Modules activated during the event last one hour, excluding Golden Lure Modules"],
    details: {
      spawns: wild.map(name => ({ name })), raidBosses: raids, maxBattleBosses: [], sourceReviewRequired: true,
      shinies: [...wild.map(name => encounter(name, ["collector"])), ...raids.map(({ name }) => encounter(name, ["raider"]))],
      plannerLocations: [{ id: venue.id, name: venue.name, coordinates: venue.coordinates, timeZone: venue.timeZone,
      provenance: `Official venue address and hours: ${venue.addressUrl}; map reference: ${venue.coordinatesUrl || venue.addressUrl}. Coordinates identify the arena point only and do not define an event radius.` }],
      publishedGameplayPeriod: { date: venue.date, localTime: true, venueOnly: true, sourceUrl: NIGHT_OUT,
        venueOpenFrom: venue.publishedDoorTime, venueSourceUrl: venue.venueUrl },
      manualOpportunities: ["All listed wild encounters, raids, and Timed Research require being at the event venue. No event-wide or citywide search is authorized by the announcement.",
        "The venue's door time does not establish Pokémon GO gameplay start or end times. Do not route automatically until the publisher provides gameplay hours and a verified venue boundary.",
        "Timed Research can award Toxtricity encounters and an avatar item. These research rewards are separate from wild and raid targets."],
      sections: [{ title: "Venue-only wild encounters", items: wild },
        { title: "Venue raids", items: ["One-star Pikachu and three-star Gengar raids can be Shiny and award a location background for the event city."] },
        { title: "Venue hours and boundary", items: [sourceNote] }]
    }, sections: [], sourceLinks: [
      { label: "Official Pokémon GO Night Out gameplay details", href: NIGHT_OUT },
      { label: losAngeles ? "Official Intuit Dome event and doors time" : "Official The O2 event and doors time", href: venue.venueUrl },
      { label: losAngeles ? "Official Intuit Dome address" : "Official The O2 map and address", href: venue.addressUrl },
      ...(venue.coordinatesUrl ? [{ label: "Official Intuit Dome map pin", href: venue.coordinatesUrl }] : [])
    ]
  };
}

function diaDeMuertosMexico() {
  const incenseTarget = "Cubone wearing a cempasúchil crown";
  return {
    id: "dia-de-muertos-2026-mexico", name: "Día de Muertos 2026 · Mexico", heading: "Official Regional Event",
    eventType: "event", start: "2026-10-27T10:00:00", end: "2026-11-05T20:00:00", localTime: true,
    scope: "regional", location: "Mexico", coordinates: "", link: DIA_DE_MUERTOS,
    sourceLabel: "Official Pokémon GO Mexico", sourceVerification: { sourceUrl: DIA_DE_MUERTOS, verifiedDate: "2026-10-23" },
    species: [], hasSpawns: true, ticketRequired: false, specialBackground: true, costumePokemon: true,
    bonuses: ["Poké Ball duration doubled", "Incense duration doubled", "Event stickers from PokéStops and Gyms"],
    scheduleNote: "October 27 at 10:00 through November 5 at 20:00 local Mexico time.",
    details: {
      incensePokemon: [incenseTarget], spawns: [], raidBosses: [], maxBattleBosses: [],
      gameplayWindows: [{ label: "Día de Muertos · Mexico-wide Incense period", start: "2026-10-27T10:00:00",
        end: "2026-11-05T20:00:00", localTime: true, sourceUrl: DIA_DE_MUERTOS }],
      shinies: [{ name: incenseTarget, methods: ["incense", "research", "party"] }],
      backgroundPokemon: [{ name: incenseTarget, source: "Incense, Timed Research and Party Challenges" }],
      research: [{ name: incenseTarget, method: "Timed Research", background: true }],
      manualOpportunities: ["Cempasúchil-crown Cubone is attracted by Incense; it is not a published wild spawn. Timed Research and Party Challenges award separate encounters.",
        "This national Mexico event does not include the Paseo de la Reforma Stamp Rally or local Gigantamax Gengar activity."],
      sections: [{ title: "Mexico-wide Incense encounter", items: ["Cubone wearing a cempasúchil crown is attracted by Incense and may be Shiny or have a Special Background. This is an Incense encounter, not a wild Collector target."] },
        { title: "Separate research and Party Challenges", items: ["Timed Research and Party Challenges can also award cempasúchil-crown Cubone. Those encounters are separate from the Incense method."] }],
      sourceLinks: [{ label: "Official Pokémon GO Mexico Día de Muertos announcement", href: DIA_DE_MUERTOS }]
    }
  };
}

function diaDeMuertosPaseo() {
  const duskull = "Duskull wearing a cempasúchil crown";
  const gengar = "Gigantamax Gengar";
  const start = "2026-10-31T10:00:00";
  const end = "2026-11-05T20:00:00";
  return {
    id: "dia-de-muertos-2026-paseo-de-la-reforma", name: "Día de Muertos GO Stamp Hunt · Paseo de la Reforma", heading: "Official Venue Event",
    eventType: "local-event", start, end, localTime: true, timeZone: "America/Mexico_City", scope: "venue",
    location: "Avenida Paseo de la Reforma, Mexico City, Mexico", coordinates: "", link: DIA_DE_MUERTOS,
    sourceLabel: "Official Pokémon GO Mexico", sourceVerification: { sourceUrl: DIA_DE_MUERTOS, verifiedDate: "2026-10-23" },
    species: [], hasSpawns: false, ticketRequired: false, specialBackground: true, costumePokemon: true,
    bonuses: ["1/2 Stardust trade cost", "Three-hour Lure Modules", "Increased catch assist from Great Buddy or higher"],
    scheduleNote: "October 31 at 10:00 through November 5 at 20:00 local time in the Paseo de la Reforma event area. The official page names selected PokéStops and Gyms but publishes no exact pins or event boundary.",
    venueNote: "The official announcement identifies Paseo de la Reforma, Mexico City, but provides no exact stamp-stop pins or gameplay boundary. Do not route against an invented citywide or venue radius.",
    details: {
      spawns: [], raidBosses: [], maxBattleBosses: [{ name: gengar, tier: 6, level: 6, nativeTargetLevel: 6 }], sourceReviewRequired: true,
      shinies: [{ name: duskull, methods: ["stamp-rally", "research"] }, { name: gengar, methods: ["max"] }],
      backgroundPokemon: [{ name: duskull, source: "GO Stamp Hunt and local Timed Research" }, { name: gengar, source: "Gigantamax Max Battle" }],
      research: ["Cubone wearing a cempasúchil crown", "Sunflora", duskull, "Drifloon", "Litwick", "Flabébé", "Phantump", "Fuecoco", "Fidough"]
        .map(name => ({ name, method: "Local Timed Research" })),
      stampRally: { name: "GO Stamp Hunt · Paseo de la Reforma", stops: [], rewards: [{ name: duskull, background: true }, { item: "Duskull Candy" }], sourceUrl: DIA_DE_MUERTOS },
      maxBattleSchedule: { sourceUrl: DIA_DE_MUERTOS, sourceKind: "official", verifiedDate: "2026-10-23", localTime: true,
        windows: [{ label: "Six-star Gigantamax Gengar Max Battles · Paseo de la Reforma event area", start, end,
          localTime: true, bosses: [{ name: gengar, tier: 6, level: 6, nativeTargetLevel: 6 }], sourceUrl: DIA_DE_MUERTOS }] },
      manualOpportunities: ["Selected PokéStops and Gyms on Paseo de la Reforma award GO Stamp Hunt stamps. The source does not publish exact stop pins; no route is generated until verified pins are available.",
        "Local Timed Research rewards include cempasúchil-crown Duskull with a Location Background, among other listed encounters. Research rewards are not wild targets.",
        "Gigantamax Gengar appears in six-star Max Battles only in the published local event area. It is not a global or wild target; the exact gameplay boundary is not published."],
      sections: [{ title: "Local GO Stamp Hunt", items: ["Visit selected PokéStops and Gyms on Paseo de la Reforma. Completing the Stamp Hunt can award Duskull wearing a cempasúchil crown with a Location Background and Duskull Candy. Exact stamp-stop pins are not published."] },
        { title: "Local Timed Research", items: ["The local research encounter list includes cempasúchil-crown Cubone, Sunflora, cempasúchil-crown Duskull with a Location Background, Drifloon, Litwick, Flabébé, Phantump, Fuecoco, and Fidough. These are research rewards, not wild targets."] },
        { title: "Six-star Max Battles", items: ["Gigantamax Gengar can be Shiny or have a Location Background. The source limits these Max Battles to the local event area and does not publish its boundary."] }],
      sourceLinks: [{ label: "Official Pokémon GO Mexico Día de Muertos announcement", href: DIA_DE_MUERTOS }]
    }
  };
}

function fcSeoul() {
  const wild = ["Growlithe", "Flareon", "Torchic", "Houndour", "Litleo", "Litten"];
  const raid = "Charmander";
  const research = "Charizard";
  const start = "2026-10-24T09:00:00";
  const end = "2026-10-24T20:00:00";
  const coordinates = "37.56825, 126.8972264";
  const locationSource = "https://www.sisul.or.kr/open_content/worldcup/introduce/location.jsp";
  const window = { label: "2026 FC Seoul event · published stadium-area gameplay", start, end, localTime: true, sourceUrl: FC_SEOUL };
  return {
    authoritativeSections: true,
    eventOverrides: { scope: "venue", location: "Seoul World Cup Stadium area, Seoul, South Korea", coordinates, timeZone: "Asia/Seoul",
      localTime: true, start, end, ticketRequired: false, venueNote: "The stadium reference point is verified from the venue operator's official map. It identifies the stadium only; no Pokémon GO event perimeter is published, so manually confirm the destination and eligible area before planning." },
    summary: "October 24, 9 AM–8 PM KST in the Seoul World Cup Stadium area. Wild Fire-type targets and one-star Charmander raids are separate. The physical event booth closes at 2 PM, but gameplay continues until 8 PM. Timed Research Charizard is a separate Location Background reward.",
    bonuses: ["Two-hour Lure Modules", "More Candy for Nice-or-better throws", "Event flowers appear on the map"],
    details: {
      spawns: wild.map(name => ({ name })), raidBosses: [{ name: raid, tier: 1 }], maxBattleBosses: [],
      shinies: [...wild.map(name => encounter(name, ["collector"])), encounter(raid, ["raider"])],
      gameplayWindows: [window],
      spawnSchedule: { sourceUrl: FC_SEOUL, sourceKind: "official", verifiedDate: "2026-10-23", localTime: true,
        confirmedWildSpawns: wild, windows: [{ ...window, spawns: wild }] },
      plannerLocations: [{ id: "fc-seoul-world-cup-stadium", name: "Seoul World Cup Stadium · official map reference", coordinates,
        timeZone: "Asia/Seoul", sourceUrl: locationSource,
        provenance: `Stadium map pin (37.56825, 126.8972264) from the official venue operator map: ${locationSource}. Point reference only; no gameplay perimeter is published.` }],
      backgroundPokemon: [{ name: raid, source: "One-star raids" }, { name: research, source: "Timed Research" }],
      research: [{ name: research, method: "Timed Research", background: true }],
      manualOpportunities: ["Charmander raids do not allow Remote Raid Passes. The event's 9 AM–2 PM physical booth time does not shorten the published 9 AM–8 PM gameplay window.",
        "The stadium operator verifies a reference map point at 37.56825, 126.8972264. That point is not an event perimeter; manually confirm the selected destination and eligible stadium area.",
        "Timed Research awards Charizard with an event Location Background. This is a research reward, not a wild or raid target; claim all research rewards by November 7 at 8 PM KST.",
        "The FC Seoul announcement publishes gameplay hours but no precise Pokémon GO event boundary. Do not interpret the stadium reference point as a radius."],
      sections: [{ title: "Wild encounters", items: ["Growlithe, Torchic, Houndour, Litleo, and Litten have an increased Shiny chance. Flareon may be Shiny."] },
        { title: "One-star raids", items: ["Charmander has an increased Shiny chance and may have an event Location Background. Remote Raid Passes cannot be used."] },
        { title: "Timed Research", items: ["Research can award Charizard with an event Location Background, plus XP, Stardust, Charmander Candy, and a Premium Battle Pass. Claim by November 7 at 8 PM KST."] },
        { title: "Gameplay and physical booth hours", items: ["Gameplay: October 24, 9 AM–8 PM KST in the Seoul World Cup Stadium area. Physical Pokémon GO booth: 9 AM–2 PM only. The booth window does not limit gameplay."] }]
    }, sections: [], sourceLinks: [{ label: "Official FC Seoul event announcement", href: FC_SEOUL }]
  };
}

export function reviewedAutumnEventDetails(eventId) {
  const id = String(eventId || "").trim();
  if (id === "halloween-2026-part-1") return halloweenPartOne();
  if (id === "halloween-2026-part-2") return halloweenPartTwo();
  if (id === "into-the-wild-2026") return intoTheWild();
  if (id === "pokemon-go-city-safari-boston-2026-rescheduled") return bostonRescheduled();
  if (id === "pokemon-night-out-los-angeles-2026" || id === "pokemon-night-out-london-2026") return nightOut(id);
  if (id === "local-official-fc-seoul-2026-2026-10-24") return fcSeoul();
  const showers = {
    "minior-showers-geminids-2026": ["Geminids", "2026-12-11", "2026-12-16"],
    "minior-showers-eta-aquariids-2027": ["Eta Aquariids", "2027-05-03", "2027-05-08"],
    "minior-showers-southern-delta-aquariids-2027": ["Southern Delta Aquariids", "2027-07-28", "2027-08-02"],
    "minior-showers-perseids-2027": ["Perseids", "2027-08-10", "2027-08-15"]
  };
  return showers[id] ? miniorShower(...showers[id]) : null;
}

export function reviewedAutumnLocalEvents() {
  return [diaDeMuertosMexico(), diaDeMuertosPaseo()];
}
