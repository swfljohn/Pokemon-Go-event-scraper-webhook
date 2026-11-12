import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEventGpx,
  coordinateQuickLinks,
  eventGpxFilename,
  eventVenues,
  parseCoordinatePair
} from "../app/event-gpx.js";

test("builds a multi-waypoint GPX without duplicating the event fallback", () => {
  const event = {
    name: "National Trust & Friends",
    link: "https://pokemongo.com/en/news/example",
    location: "Regional",
    coordinates: "51.5, -0.1",
    venues: [
      { name: "First <Place>", location: "London & South", coordinates: "51.5, -0.1" },
      { name: "Second Place", coordinates: "52.1, -1.2", group: "Pineco" }
    ]
  };

  assert.equal(eventVenues(event).length, 2);
  const gpx = buildEventGpx(event);
  assert.match(gpx, /<gpx version="1\.1"/);
  assert.match(gpx, /<wpt lat="51\.5" lon="-0\.1">/);
  assert.match(gpx, /<wpt lat="52\.1" lon="-1\.2">/);
  assert.match(gpx, /First &lt;Place&gt;/);
  assert.doesNotMatch(gpx, /London &amp; South/);
  assert.doesNotMatch(gpx, /https:\/\/pokemongo\.com/);
  assert.doesNotMatch(gpx, /<desc>|<sym>/);
  assert.equal((gpx.match(/<wpt /g) || []).length, 2);
  assert.equal(eventGpxFilename(event), "national-trust-friends.gpx");
});

test("rejects invalid coordinates and builds all supported quick links", () => {
  assert.equal(parseCoordinatePair("91, 10"), null);
  assert.equal(parseCoordinatePair("10, 181"), null);
  assert.equal(buildEventGpx({ name: "Unknown location" }), "");
  const links = coordinateQuickLinks("35.772782, 140.388296");
  assert.deepEqual(links.map(link => link.label), ["Velocity", "FlyMeGo", "Google", "iPogo", "SpooferPro", "iTools"]);
  assert.match(links.at(-1).href, /latlng=35\.772782,140\.388296/);
});
