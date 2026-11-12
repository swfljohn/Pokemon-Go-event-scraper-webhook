const COORDINATE_LINKS = Object.freeze([
  ["velocity", "Velocity", ({ lat, lng }) => `https://pk.md/${lat},${lng}`],
  ["flymego", "FlyMeGo", ({ lat, lng }) => `https://fly.mg/coords?ll=${lat},${lng}`],
  ["google", "Google", ({ lat, lng }) => `https://maps.google.com/maps?q=${lat},${lng}`],
  ["ipogo", "iPogo", ({ lat, lng }) => `https://ipogo.app/?coords=${lat},${lng}`],
  ["spooferpro", "SpooferPro", ({ lat, lng }) => `https://spooferpro.com/?deeplink=${lat},${lng}`],
  ["itools", "iTools", ({ lat, lng }) => `https://api.cuno.bot/dl/itools1?type=itoolsbt&latlng=${lat},${lng}`]
]);

export function parseCoordinatePair(value) {
  const parts = String(value || "").split(",").map(part => Number(part.trim()));
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  if (Math.abs(parts[0]) > 90 || Math.abs(parts[1]) > 180) return null;
  return {
    lat: Number(parts[0].toFixed(7)),
    lng: Number(parts[1].toFixed(7)),
    text: `${Number(parts[0].toFixed(7))}, ${Number(parts[1].toFixed(7))}`
  };
}

function cleanText(value, maximum = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

export function eventVenues(event) {
  const candidates = Array.isArray(event?.venues) ? event.venues : [];
  const fallback = event?.coordinates ? [{
    name: event.location || event.name,
    location: event.location,
    coordinates: event.coordinates,
    timeZone: event.timeZone
  }] : [];
  const result = [];
  const seen = new Set();
  for (const [index, venue] of [...candidates, ...fallback].entries()) {
    const pair = parseCoordinatePair(venue?.coordinates);
    if (!pair) continue;
    const key = `${pair.lat},${pair.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: cleanText(venue?.id, 100) || `venue-${index + 1}`,
      name: cleanText(venue?.name || venue?.location, 140) || `Location ${result.length + 1}`,
      location: cleanText(venue?.location, 180),
      coordinates: pair.text,
      lat: pair.lat,
      lng: pair.lng,
      timeZone: cleanText(venue?.timeZone || event?.timeZone, 80),
      group: cleanText(venue?.group, 100)
    });
  }
  return result;
}

export function coordinateQuickLinks(value) {
  const pair = parseCoordinatePair(value);
  if (!pair) return [];
  return COORDINATE_LINKS.map(([id, label, build]) => ({ id, label, href: build(pair) }));
}

function xml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function eventGpxFilename(event) {
  const base = cleanText(event?.name, 120)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "pokemon-go-event";
  return `${base}.gpx`;
}

export function buildEventGpx(event) {
  const venues = eventVenues(event);
  if (!venues.length) return "";
  const name = cleanText(event?.name, 180) || "Pokémon GO event";
  const points = venues.map((venue, index) => {
    return [
      `  <wpt lat="${venue.lat}" lon="${venue.lng}">`,
      `    <name>${xml(`${index + 1}. ${venue.name}`)}</name>`,
      "  </wpt>"
    ].join("\n");
  }).join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Pokemon GO Event Webhook" xmlns="http://www.topografix.com/GPX/1/1">',
    "  <metadata>",
    `    <name>${xml(name)}</name>`,
    "  </metadata>",
    points,
    "</gpx>",
    ""
  ].join("\n");
}
