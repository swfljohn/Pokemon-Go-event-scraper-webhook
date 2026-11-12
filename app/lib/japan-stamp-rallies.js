// Community-mapped Pokémon GO Stamp Rally locations.
//
// The official announcements confirm the participating stops, but do not
// publish a machine-readable coordinate export. These coordinates are from
// public community maps/lists and must remain labeled as approximate so users
// verify the in-game stamp stop before routing to it.
function venue(id, name, coordinates, group) {
  return { id, name, location: name, coordinates, timeZone: "Asia/Tokyo", group };
}

export const NAGASAKI_STAMP_RALLY_VENUES = Object.freeze([
  ["nagasaki-01", "Nagasaki Rally Stop 01", "32.752413, 129.870713"],
  ["nagasaki-02", "Nagasaki Rally Stop 02", "32.749377, 129.868491"],
  ["nagasaki-03", "Nagasaki Rally Stop 03", "32.744810, 129.873480"],
  ["nagasaki-04", "Nagasaki Rally Stop 04", "32.742200, 129.875770"],
  ["nagasaki-05", "Nagasaki Rally Stop 05", "32.748900, 129.880730"],
  ["nagasaki-06", "Nagasaki Rally Stop 06", "32.752572, 129.879411"],
  ["nagasaki-07", "Nagasaki Rally Stop 07", "32.741243, 129.868746"],
  ["nagasaki-08", "Nagasaki Rally Stop 08", "32.759217, 129.864802"]
].map(([id, name, coordinates]) => venue(id, name, coordinates, "Nagasaki GO Stamp Rally")));

export const JAPAN_POKEMON_CENTER_STAMP_RALLY_VENUES = Object.freeze([
  ["fukuoka", "Pokémon Center Fukuoka", "33.588900, 130.419200"],
  ["hiroshima", "Pokémon Center Hiroshima", "34.397600, 132.476100"],
  ["mega-tokyo", "Pokémon Center Mega Tokyo", "35.728900, 139.719300"],
  ["kanazawa", "Pokémon Center Kanazawa", "36.579100, 136.649700"],
  ["kyoto", "Pokémon Center Kyoto", "35.003400, 135.758300"],
  ["nagoya", "Pokémon Center Nagoya", "35.163500, 136.908000"],
  ["okinawa", "Pokémon Center Okinawa", "26.313100, 127.796100"],
  ["osaka", "Pokémon Center Osaka", "34.701800, 135.496400"],
  ["osaka-dx", "Pokémon Center Osaka DX", "34.673100, 135.500700"],
  ["sapporo", "Pokémon Center Sapporo", "43.067400, 141.349200"],
  ["shibuya", "Pokémon Center Shibuya", "35.661900, 139.698400"],
  ["skytree-town", "Pokémon Center Skytree Town", "35.710300, 139.812600"],
  ["tohoku", "Pokémon Center Tohoku", "38.261900, 140.881600"],
  ["tokyo-bay", "Pokémon Center Tokyo Bay", "35.686600, 139.989000"],
  ["tokyo-dx", "Pokémon Center Tokyo DX", "35.680200, 139.774200"],
  ["yokohama", "Pokémon Center Yokohama", "35.464500, 139.624400"],
  ["kagawa", "Pokémon Center Kagawa", "34.342300, 134.050000"],
  ["go-lab", "Pokémon GO Lab.", "35.729100, 139.718700"]
].map(([id, name, coordinates]) => venue(id, name, coordinates, "Pokémon Center Stamp Rally 2026")));

export const NAGASAKI_STAMP_RALLY_VENUE_COUNT = NAGASAKI_STAMP_RALLY_VENUES.length;
export const JAPAN_POKEMON_CENTER_STAMP_RALLY_VENUE_COUNT = JAPAN_POKEMON_CENTER_STAMP_RALLY_VENUES.length;
