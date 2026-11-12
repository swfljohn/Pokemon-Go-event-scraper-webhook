// Community-mapped PokémonXP & 2026 Worlds GO Stamp Rally stops.
//
// The live community map currently contains 33 distinct markers. These are
// waypoint coordinates for GPX planning, not an official Pokémon GO export,
// so the event UI tells Trainers to confirm the highlighted stamp in-game.
function venue(id, name, coordinates) {
  return {
    id,
    name,
    location: name,
    coordinates,
    timeZone: "America/Los_Angeles",
    group: "PokémonXP & 2026 Worlds GO Stamp Rally"
  };
}

export const WORLDS_2026_STAMP_RALLY_VENUES = Object.freeze([
  ["golden-gate-beach", "Golden Gate Beach", "37.8056245, -122.4653907"],
  ["marina-green", "Marina Green", "37.8066961, -122.4390160"],
  ["childrens-creativity-museum", "Children's Creativity Museum", "37.7833063, -122.4023469"],
  ["wave-organ", "The Wave Organ", "37.8082265, -122.4405655"],
  ["lovers-lane", "Lovers' Lane", "37.7954049, -122.4516851"],
  ["japantown-peace-plaza", "Japantown Peace Plaza", "37.7852549, -122.4297573"],
  ["chinatown-dragon-gate", "Chinatown Dragon Gate", "37.7908235, -122.4056349"],
  ["sutro-baths", "Sutro Baths", "37.7804413, -122.5131106"],
  ["lands-end-labyrinth", "Land's End Labyrinth", "37.7877539, -122.5058905"],
  ["ocean-beach", "Ocean Beach", "37.7602632, -122.5098447"],
  ["sf-moma", "SF MoMA", "37.7856427, -122.4011519"],
  ["cupids-span", "Cupid's Span", "37.7916850, -122.3898412"],
  ["willie-mays-statue", "Willie Mays Statue", "37.7781799, -122.3911996"],
  ["union-square", "Union Square", "37.7876774, -122.4079227"],
  ["bison-paddock", "Bison Paddock", "37.7696864, -122.4982325"],
  ["transamerica-pyramid", "Transamerica Pyramid", "37.7947321, -122.4028054"],
  ["ghirardelli-square", "Ghirardelli Square", "37.8058861, -122.4227747"],
  ["lincoln-park-steps", "Lincoln Park Steps", "37.7834913, -122.4933638"],
  ["blue-heron-boathouse", "Blue Heron Boathouse", "37.7706141, -122.4771641"],
  ["music-concourse", "Music Concourse", "37.7698834, -122.4685673"],
  ["salesforce-central-lawn", "Salesforce Central Lawn", "37.7887373, -122.3972886"],
  ["fortune-cookie-factory", "Golden Gate Fortune Cookie Factory", "37.7957217, -122.4074138"],
  ["city-hall", "City Hall", "37.7793773, -122.4186161"],
  ["washington-square-park", "Washington Square Park", "37.8009745, -122.4101914"],
  ["musee-mecanique", "Musée Mécanique", "37.8091709, -122.4158149"],
  ["palace-of-fine-arts", "Palace of Fine Arts", "37.8030156, -122.4484345"],
  ["presidio-tunnel-tops", "Presidio Tunnel Tops", "37.8034013, -122.4569878"],
  ["painted-ladies", "Painted Ladies", "37.7764598, -122.4329490"],
  ["chase-center-muni", "Chase Center/MUNI Station", "37.7683634, -122.3892608"],
  ["fort-point", "Fort Point Historic Site (Golden Gate Bridge)", "37.8106117, -122.4770900"],
  ["coit-tower", "Coit Tower", "37.8022716, -122.4058140"],
  ["wood-line", "Wood Line", "37.7930968, -122.4484915"],
  ["ferry-building", "Ferry Building", "37.7953273, -122.3937802"]
].map(row => venue(...row)));

export const WORLDS_2026_STAMP_RALLY_VENUE_COUNT = WORLDS_2026_STAMP_RALLY_VENUES.length;
