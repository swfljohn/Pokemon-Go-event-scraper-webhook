// Public event stops and private discovery destinations share these coordinates.
// Official announcements confirm the rallies; coordinate lists are community mapped.
const TOKYO_OFFICIAL = "https://pokemongo.com/gofest/tokyo/in-person-experiences?hl=fr";
const TOKYO_COORDS = "https://www.reddit.com/r/PokemonGoSpoofing/comments/1tmyg6g/new_go_stamp_rally_coordinates/";
const SUITA_OFFICIAL = "https://pokemongo.com/ja/post/suita_rally";
const SUITA_COORDS = "https://tomchun.tw/tomchun/2025/09/25/stamp-collection-activity-japan-osaka-suita/";
const SOURCE_REVIEWED_AT = Date.parse("2026-09-23T00:04:51Z");

const CITIES = [
  ["tokyo-minato", "Minato", [
    "35.6671448, 139.7574141", "35.6669716, 139.7454765",
    "35.665661, 139.7461202", "35.6586, 139.7454", "35.6560133, 139.7490935"
  ]],
  ["tokyo-koto", "Koto", [
    "35.6796307, 139.8074057", "35.676180, 139.812740",
    "35.6748, 139.81523", "35.6730499, 139.8164348"
  ]],
  ["tokyo-shinagawa", "Shinagawa", [
    "35.623578, 139.748265", "35.619162, 139.74419",
    "35.615484, 139.744176", "35.603301, 139.743942"
  ]],
  ["suita", "Suita", [
    "34.806199, 135.532156", "34.796367, 135.507646", "34.759325, 135.500172",
    "34.756838, 135.527407", "34.825285, 135.509523"
  ]]
];

export const CITY_STAMP_RALLY_EVENTS = CITIES.map(([id, city, coordinates]) => {
  const suita = id === "suita";
  const location = suita ? "Suita, Osaka, Japan" : `${city}, Tokyo, Japan`;
  const link = suita ? SUITA_OFFICIAL : TOKYO_OFFICIAL;
  const plannedFirstStop = suita ? {
    id: "suita-1", name: "Banpaku-kinen-koen station exit area · participating stamp stop",
    coordinates: "34.806199, 135.532156", timeZone: "Asia/Tokyo",
    participatingStop: true, sourceVerified: true, nativeVerified: false,
    orderSource: "Website planned first stop; official rules allow starting at any participating stop",
    coordinateSource: SUITA_COORDS, participationSource: SUITA_OFFICIAL,
    verifiedDate: "2026-09-23", verifiedAt: SOURCE_REVIEWED_AT,
    provenance: "Published community PokéStop coordinate; official participating area"
  } : null;
  return {
    id: `local-${id}-stamp-rally`,
    name: `${city} GO Stamp Rally`,
    heading: "City Stamp Rally",
    eventType: "stamp-rally",
    // Ongoing, without an exact published start/end timestamp for this listing.
    start: "", end: "", localTime: true, ongoing: true,
    link, imageUrl: "", species: [],
    bonuses: [
      `${coordinates.length} community-mapped discovery points in ${city}; confirm participating stops in-game`,
      "Visit the area to receive its stamp sheet, then follow the in-game map for stamps and rewards"
    ],
    summary: `Visit ${city}'s mapped locations to reveal its GO Stamp Rally, collect stamps and check the rewards in your stamp sheet.`,
    hasSpawns: false, location, coordinates: "", timeZone: "Asia/Tokyo",
    scope: "citywide", ticketRequired: false,
    ...(plannedFirstStop ? { plannedFirstStop } : {}),
    venues: coordinates.map((point, index) => ({
      id: `${id}-${index + 1}`, name: `${city} Rally Discovery Point ${index + 1}`,
      location, coordinates: point, timeZone: "Asia/Tokyo", group: `${city} GO Stamp Rally`,
      sourceVerified: false, nativeVerified: false, coordinateSource: suita ? SUITA_COORDS : TOKYO_COORDS,
      ...(plannedFirstStop && index === 0 ? plannedFirstStop : {})
    })),
    sourceLabel: "Official Pokémon GO · community-mapped coordinates",
    scheduleNote: suita
      ? "Ongoing: the official announcement specifies no end-date restriction. Individual stop availability is checked in-game in Japan local time."
      : "Previously listed as ongoing. The official source now redirects to an unrelated event and needs review; confirm current availability in the native stamp sheet.",
    venueNote: "Approximate community coordinates, not an official coordinate export. Copy a stop below or download the GPX, visit the area, then open the in-game stamp sheet. A missing rally before arrival does not mean it has ended.",
    details: {
      ...(!suita ? { sourceReviewRequired: true, sourceReview: {
        checkedAt: SOURCE_REVIEWED_AT, sourceUrl: TOKYO_OFFICIAL,
        resolvedUrl: "https://pokemongo.com/gofest/megafinale?hl=fr",
        reason: "Official Tokyo page redirects to unrelated Mega Finale content; current rally availability is not reverified."
      } } : {}),
      ...(plannedFirstStop ? { stampRally: { firstStop: {
        verified: true, sourceVerified: true, nativeVerified: false, plannedFirst: true,
        nativeRallyId: "admin_suita", coordinates: [34.806199, 135.532156],
        sourceUrl: SUITA_COORDS, officialSourceUrl: "https://pokemongo.com/ja/news/suita_rally",
        name: plannedFirstStop.name, orderSource: plannedFirstStop.orderSource,
        verifiedAt: SOURCE_REVIEWED_AT
      } } } : {}),
      verifiedDate: "2026-09-11",
      sections: [{
        title: "Finding the rally",
        items: [
          ...(!suita ? ["Official Tokyo provenance needs review: its link now redirects to Mega Finale. Retained community points are discovery leads, not current native stop verification."] : []),
          ...(id === "tokyo-koto" ? ["The community source reports two of these four points are gyms without identifying which. None is verified here as a participating stamp PokéStop."] : []),
          ...(id === "tokyo-shinagawa" ? ["A later community report describes a fifth stamp; this four-point discovery list is not a verified complete route."] : []),
          "Start with a mapped location below. The stamp sheet may only appear after you enter the area or approach a participating stop.",
          "Refresh the in-game map after arrival and check the stamp sheet before continuing through its stops.",
          "If a stop is closed or the rally is unavailable now, check again during its local availability window. Coordinates do not guarantee that a stop is currently open."
        ]
      }],
      sourceLinks: [
        { label: "Official rally announcement", href: link },
        { label: "Community coordinate source", href: suita ? SUITA_COORDS : TOKYO_COORDS }
      ]
    }
  };
});
