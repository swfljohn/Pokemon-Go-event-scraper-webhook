import test from 'node:test';
import assert from 'node:assert/strict';
import { correctOfficialRegionalEvents } from '../app/lib/official-regional-corrections.js';
import { SAVE_THE_DATE_EVENTS, saveTheDateSuperseded } from '../app/lib/save-the-date-events.js';
import { normalizeEventSpawns } from '../app/lib/event-spawns.js';

const NOW = Date.parse('2026-11-10T01:30:00Z');
const day = (slug, date, extra = {}) => ({
  id: `local-official-${slug}-${date}`, name: 'Some regional event', start: `${date}T00:00:00`, end: `${date}T23:59:59`,
  link: `https://pokemongo.com/news/${slug}`, location: 'A venue', eventType: 'local-partnership', bonuses: [], species: [],
  scheduleNote: `The official regional announcement publishes ${date} but does not publish gameplay hours; check the source before traveling.`, ...extra
});

// Rows as they sat in the live discovery cache on 2026-11-09.
const cached = [
  ...Array.from({ length: 14 }, (_, i) => day('gowa_cdmx_additional_info', `2026-11-${10 + i}`, { name: 'Discover more of the city during Pokémon GO Wild Area: Mexico City', eventType: 'stamp-rally' })),
  { ...day('2026hk-fw', '2026-11-09'), name: 'Official Pokémon GO Event — Taiwan', start: '2026-11-09T10:00:00+08:00', end: '2027-01-03T23:59:00+08:00', link: 'https://pokemongo.com/zh_Hant/news/2026hk-fw', imageUrl: 'https://lh3.googleusercontent.com/x' },
  { ...day('2026hk-fw', '2026-11-11'), name: 'Official Pokémon GO Event — Taiwan', start: '2026-11-11T00:00:00+08:00', end: '2027-01-03T23:59:59+08:00', link: 'https://pokemongo.com/zh_Hant/news/2026hk-fw' },
  { ...day('gowildtw-2026skm', '2026-11-14'), name: 'Official Pokémon GO Event — Taiwan', start: '2026-11-14T00:00:00+08:00', end: '2026-11-14T23:59:59+08:00', link: 'https://pokemongo.com/zh_Hant/news/gowildtw-2026skm' },
  { ...day('community-meetups-go-wild-area-2026-details-asia-pacific', '2026-11-15'), name: 'Get ready for Pokémon GO Wild Area 2026: Global Community meetups in the Asia-Pacific region!' },
  { ...day('community-meetups-go-wild-area-2026-details-asia-pacific', '2026-11-14'), name: 'Official Pokémon GO Event — Taiwan', start: '2026-11-14T00:00:00+08:00', end: '2026-11-15T23:59:59+08:00', link: 'https://pokemongo.com/zh_Hant/news/community-meetups-go-wild-area-2026-details-asia-pacific' },
  { ...day('save-the-date-go-tour-2027', '2027-02-19'), name: 'Official Pokémon GO Event — Taiwan', link: 'https://pokemongo.com/zh_Hant/news/save-the-date-go-tour-2027' },
  { ...day('jleague_details', '2027-06-20'), name: 'Pokémon J.League Fest Collaboration Event', link: 'https://pokemongo.com/ja/news/jleague_details' }
];

test('reviewed corrections replace the wrong regional rows', () => {
  const rows = correctOfficialRegionalEvents(cached, NOW);
  const names = rows.map(row => row.name);
  assert.equal(names.some(name => /Mexico City/.test(name)), false, 'ended Mexico City extras are not listed as a daily rally');
  assert.equal(names.some(name => /Official Pokémon GO Event — Taiwan/.test(name)), false, 'no generic Taiwan titles remain');
  const hk = rows.filter(row => /Festival Walk/.test(row.name));
  assert.equal(hk.length, 1);
  assert.equal(hk[0].timeZone, 'Asia/Hong_Kong');
  assert.match(hk[0].location, /Hong Kong/);
  assert.equal(hk[0].imageUrl, 'https://lh3.googleusercontent.com/x');
  const skm = rows.find(row => /Shin Kong Mitsukoshi Taipei/.test(row.name));
  assert.equal(skm.start, '2026-11-14T11:00:00+08:00');
  assert.equal(skm.end, '2026-11-15T22:00:00+08:00');
  const apac = rows.filter(row => /Community Meetups — Asia-Pacific/.test(row.name));
  assert.equal(apac.length, 1, 'one card for the article, not one per language');
  assert.equal(apac[0].details.sections[0].items.length, 12);
  assert.equal(rows.some(row => /J\.League/.test(row.name)), true, 'unrelated rows pass through');
  assert.equal(rows.length, 4);
});

test('consecutive all-day rows from one article become one card; other languages yield to English', () => {
  const rows = correctOfficialRegionalEvents([
    day('some-rally', '2026-12-01'), day('some-rally', '2026-12-02'), day('some-rally', '2026-12-03'), day('some-rally', '2026-12-07'),
    { ...day('some-rally', '2026-12-01'), link: 'https://pokemongo.com/ko/news/some-rally', name: 'Official Pokémon GO Event — South Korea' }
  ], NOW);
  assert.deepEqual(rows.map(row => [row.start, row.end]), [
    ['2026-12-01T00:00:00', '2026-12-03T23:59:59'], ['2026-12-07T00:00:00', '2026-12-07T23:59:59']]);
  assert.match(rows[0].scheduleNote, /2026-12-01–2026-12-03/);
  assert.equal(rows[0].id, 'local-official-some-rally-2026-12-01');
});

test('reviewed cards drop out after they end', () => {
  assert.equal(correctOfficialRegionalEvents(cached, Date.parse('2026-11-18T00:00:00Z')).some(row => /Asia-Pacific|Shin Kong/.test(row.name)), false);
  assert.equal(correctOfficialRegionalEvents(cached, Date.parse('2027-01-05T00:00:00Z')).some(row => /Festival Walk/.test(row.name)), false);
});

test('save-the-date placeholders show until the structured source lists the event', () => {
  assert.equal(SAVE_THE_DATE_EVENTS.length, 11);
  const calendar = normalizeEventSpawns([], NOW).calendarEvents;
  const placeholder = calendar.find(row => row.id === 'local-save-the-date-community-day-2026-12-12');
  assert.equal(placeholder.name, 'Community Day — December 12–13 (details to be announced)');
  assert.equal(placeholder.rating.grade, '—', 'an unannounced event is not graded');
  const source = [{ eventID: 'december-communityday2026', name: 'December Community Day 2026', eventType: 'community-day', heading: 'Community Day',
    link: 'https://leekduck.com/events/december-communityday2026/', image: '', start: '2026-12-12T14:00:00.000', end: '2026-12-13T17:00:00.000', extraData: {} }];
  const after = normalizeEventSpawns(source, NOW).calendarEvents;
  assert.equal(after.some(row => row.id === 'local-save-the-date-community-day-2026-12-12'), false);
  assert.equal(after.some(row => row.id === 'local-save-the-date-raid-day-2026-12-19'), true);
  const maxMonday = { id: 'x', name: 'Dynamax Cryogonal during Max Monday', eventType: 'max-mondays', start: '2026-12-05T06:00:00', end: '2026-12-05T21:00:00' };
  assert.equal(saveTheDateSuperseded(SAVE_THE_DATE_EVENTS[0], [maxMonday]), false, 'a Max Monday is not the Max Battle Day');
});

test('new permanent rallies and Europe meetups are on the calendar', () => {
  const calendar = normalizeEventSpawns([], NOW).calendarEvents;
  for (const id of ['local-sendai-tohoku-forever-stamp-rally', 'local-mexico-city-forever-stamp-rally',
    'local-wild-area-global-2026-meetup-karlsruhe', 'local-wild-area-global-2026-meetup-stockholm']) {
    assert.ok(calendar.find(row => row.id === id), id);
  }
  const mexico = calendar.find(row => row.id === 'local-mexico-city-forever-stamp-rally');
  assert.equal(mexico.end, '');
  assert.equal(mexico.details.sections[1].items.length, 8);
});
