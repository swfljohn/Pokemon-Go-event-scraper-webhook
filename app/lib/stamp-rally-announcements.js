import { calendarEventTimestamp } from "../event-calendar.js";
// Official announcement discovery is independent of authenticated native rally
// IDs and verified first stops. Never turn a city centroid into a start stop.
const source = href => [{ label: "Official Pokémon GO announcement", href }];
const safariCities = [
  ["boston", "Boston, USA", "America/New_York"],
  ["brisbane", "Brisbane, Australia", "Australia/Brisbane"],
  ["lisbon", "Lisbon, Portugal", "Europe/Lisbon"],
  ["marseille", "Marseille, France", "Europe/Paris"],
  ["munich", "Munich, Germany", "Europe/Berlin"],
  ["rio-de-janeiro", "Rio de Janeiro, Brazil", "America/Sao_Paulo"]
];
const mappingNote = "Official rally announced; native rally ID, participating stop coordinates, and first-stop order are not yet verified.";
const common = {
  eventType: "stamp-rally", heading: "GO Stamp Rally", localTime: true,
  hasSpawns: false, coordinates: "", venues: [], startingSoonAlert: false,
  ongoing: true,
  sourceLabel: "Official Pokémon GO rally announcement", venueNote: mappingNote,
  mappingStatus: "announced", firstStopVerified: false,
  specialBackground: false, costumePokemon: false
};
const announcements = [
  {
    ...common, id: "local-poke-lid-kyushu-okinawa-stamp-rally", name: "Poké Lid Stamp Rally — Japan Nationwide",
    start: "2025-11-07T09:00:00", end: "", timeZone: "Asia/Tokyo", scope: "national",
    location: "Japan (nationwide)", link: "https://pokemongo.com/ja/news/pokelid_full",
    venueNote: "Official Pokémon GO confirms nationwide eligibility. The Ibusuki coordinates below are official physical Poké Lid locations; native-game stamp participation, current in-game GPS acceptance, and first-stop order remain unverified.",
    species: ["Pikachu"], ticketRequired: false, specialBackground: true,
    bonuses: [
      "Collect two Poké Lid stamps in person in one prefecture for a Location Background Pikachu encounter.",
      "Gifted stamps do not count."
    ],
    scheduleNote: "The rally began in Kyushu and Okinawa on November 7, 2025. A phased nationwide rollout was planned for January 28–30, 2026; full availability to all Trainers was confirmed by Pokémon GO on February 13. No end date is announced.",
    details: {
      verifiedDate: "2026-02-13",
      nationwideCoverage: {
        confirmedAllTrainersAt: "2026-02-13",
        scheduledRolloutCompleteAt: "2026-01-30",
        addedRegions: ["Hokkaido and Tohoku", "Kanto", "Chubu", "Kinki", "Chugoku and Shikoku"]
      },
      physicalLidCandidates: [
        {
          name: "Ibusuki Eevee Poké Lid", pokemon: "Eevee", location: "Ibusuki, Kagoshima, Japan",
          coordinates: "31.237194, 130.642861", sourceUrl: "https://local.pokemon.jp/en/manhole/desc/1/?is_modal=1",
          physicalLocationVerified: true, stampParticipationVerified: false, nativeVerified: false, firstStopVerified: false
        },
        {
          name: "Ibusuki Vaporeon Poké Lid", pokemon: "Vaporeon", location: "Ibusuki, Kagoshima, Japan",
          coordinates: "31.228, 130.653028", sourceUrl: "https://local.pokemon.jp/en/manhole/desc/2/?is_modal=1",
          physicalLocationVerified: true, stampParticipationVerified: false, nativeVerified: false, firstStopVerified: false
        }
      ],
      sections: [
        { title: "Nationwide participation and rewards", items: [
          "Pokémon GO confirmed that the Japan-wide expansion is available to all Trainers as of February 13, 2026; the added regions are Hokkaido and Tohoku, Kanto, Chubu, Kinki, and Chugoku and Shikoku.",
          "Open Pokémon GO in Japan to receive the stamp sheet automatically. Trainer level 5 or higher is required.",
          "Two stamps collected in person in the same prefecture can award a Pikachu encounter with that prefecture’s Location Background. Gifted stamps do not count; personally collecting a stamp that was previously gifted does count."
        ] },
        { title: "Official physical Poké Lid locations — in-game participation unverified", items: [
          "Ibusuki Eevee Poké Lid — 31.237194, 130.642861; official Pokémon Local Acts location. Confirm its presence on the current in-game stamp sheet before treating it as a participating stop.",
          "Ibusuki Vaporeon Poké Lid — 31.228, 130.653028; official Pokémon Local Acts location. Confirm its presence on the current in-game stamp sheet before treating it as a participating stop."
        ] }
      ],
      sourceLinks: [
        ...source("https://pokemongo.com/ja/news/pokelid_full"),
        { label: "Official Ibusuki Eevee Poké Lid location", href: "https://local.pokemon.jp/en/manhole/desc/1/?is_modal=1" },
        { label: "Official Ibusuki Vaporeon Poké Lid location", href: "https://local.pokemon.jp/en/manhole/desc/2/?is_modal=1" }
      ]
    }
  },
  ...safariCities.map(([slug, city, timeZone]) => {
    const link = `https://pokemongo.com/featured-in-person-events/citysafari/${slug}`;
    return { ...common, id: `local-city-safari-${slug}-stamp-rally-2026`, name: `City Safari Stamp Rally — ${city.split(',')[0]}`,
      start: "2026-09-26T10:00:00", end: "2026-09-27T18:00:00", timeZone, scope: "citywide", location: city, link,
      ticketRequired: true, costumePokemon: true, species: ["Eevee"],
      bonuses: ["Collect up to eight stamps per day; each awards an encounter with Eevee wearing an explorer hat, with a Shiny chance."],
      scheduleNote: "September 26–27, 2026, 10:00–18:00 local time on the date covered by your ticket; once daily.",
      details: { gameplayWindows: [26,27].map(day => ({ label: `September ${day}`, start: `2026-09-${day}T10:00:00`, end: `2026-09-${day}T18:00:00` })), sections: [{ title: "Starting and completing the rally", items: [
        "All event gameplay requires a ticket. Enter the citywide gameplay area and approach a participating PokéStop to receive a stamp sheet.",
        "Participating PokéStops appear on Campfire and the dedicated official map. Spin their Photo Discs to collect stamps.",
        "Collect up to eight stamps and complete the rally once each ticketed event day. A city representative coordinate is not a verified first stop."
      ] }], sourceLinks: source(link) }
    };
  }),
  {
    ...common, id: "local-sendai-wild-area-stamp-rally-2026", name: "GO Wild Area Sendai — Citywide Stamp Rally",
    start: "2026-11-06T09:00:00", end: "2026-11-08T20:00:00", timeZone: "Asia/Tokyo", scope: "citywide",
    location: "Sendai, Japan", link: "https://pokemongo.com/gowildarea/sendai/gameplay", ticketRequired: true, species: [],
    bonuses: ["Explore city landmarks and collect stamps at in-game PokéStops for event-themed Pokémon encounters."],
    scheduleNote: "November 6–8, 2026, 09:00–20:00 local time on your main ticketed event day only.",
    details: { requiresMainTicketEventDay: true,
      gameplayWindows: [6,7,8].map(day => ({ label: `November ${day}`, start: `2026-11-0${day}T09:00:00`, end: `2026-11-0${day}T20:00:00`, localTime: true })), sections: [{ title: "Ticket eligibility", items: [
      "Available only on your main ticketed event day. The Extra Day gameplay add-on does not grant another stamp rally.",
      "Decorated PokéStops and related Timed Research can guide exploration; no first-stop order is published in this catalog."
    ] }], sourceLinks: source("https://pokemongo.com/gowildarea/sendai/gameplay") }
  },
  // Permanent rallies opened with GO Wild Area 2026 (official post: forever-stamp-rally-go-wild-area-2026).
  // Start is November 2, 2026, 4:00 p.m. PST, written here in each city's local time.
  ...[
    ["sendai-tohoku", "Sendai • Tohoku GO Stamp Rally — Lapras", "2026-11-03T09:00:00", "Asia/Tokyo", "Sendai and the Tohoku region, Japan", "Lapras",
      ["Site of Sendai Castle (Aoba Castle)", "Sendai Mediatheque", "Sendai Asaichi (Morning Market)", "Akiu Onsen", "Tagajo Castle Ruins", "Kadonowaki Elementary School Ruins", "Shiroishi Castle", "Matsushima Park"], "Sendai • Tohoku"],
    ["mexico-city", "Mexico City GO Stamp Rally — Hawlucha", "2026-11-02T18:00:00", "America/Mexico_City", "Mexico City, Mexico", "Hawlucha",
      ["Palacio de Bellas Artes", "Palacio Nacional", "Columna \"El Paraguas\"", "Diana Cazadora", "Fuente de los Coyotes Coyoacán", "Aztlán 360", "Reloj y Fuente de Parque Hundido", "Museo Soumaya"], "Mexico City"]
  ].map(([slug, name, start, timeZone, location, reward, stops, background]) => {
    const link = "https://pokemongo.com/news/forever-stamp-rally-go-wild-area-2026";
    return { ...common, id: `local-${slug}-forever-stamp-rally`, name, start, end: "", timeZone, scope: "citywide", location, link,
      ticketRequired: false, specialBackground: true, species: [reward],
      bonuses: [`Collect the stamps for a ${reward} encounter with a ${background} Location Background; it may be Shiny.`],
      scheduleNote: "Open to all Trainers since November 2, 2026, 4:00 p.m. PST, with no planned end date.",
      details: { sections: [
        { title: "How it works", items: [
          "Approach any participating PokéStop to receive the stamp sheet, then spin Photo Discs to collect stamps.",
          "Stops can be visited in any order; collect up to eight stamps. A stamp cannot be pressed twice."
        ] },
        { title: "Stamp locations named in the official announcement", items: stops }
      ], sourceLinks: source(link), detailCheckedAt: "2026-11-09" } };
  })
];
export function stampRallyAnnouncements(now = Date.now()) {
  return announcements.filter(event => !event.end || calendarEventTimestamp(event, "end") >= now).map(event => structuredClone(event));
}
