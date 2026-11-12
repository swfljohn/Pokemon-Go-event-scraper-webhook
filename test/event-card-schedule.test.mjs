import test from "node:test";
import assert from "node:assert/strict";
import { regionalLocalEventRangeLine, regionalLocalSpawnScheduleCardLine } from "../app/event-card-schedule.js";
import { curatedLocalEvents } from "../app/lib/local-events.js";

test("regional Clefairy card uses its published local burst windows when the broad range has no single timezone", () => {
  const event = curatedLocalEvents(Date.parse("2026-09-22T00:00:00Z"))
    .find(row => row.id === "local-dancing-in-the-moonlight-2026");

  assert.ok(event);
  assert.equal(regionalLocalSpawnScheduleCardLine(event),
    "Clefairy windows: 12:00 PM, 1:00 PM, 7:00 PM, and 8:00 PM local time · 5 minutes each day");
});

test("regional local schedule card copy does not replace a timezone-specific event range", () => {
  const event = curatedLocalEvents(Date.parse("2026-09-22T00:00:00Z"))
    .find(row => row.id === "local-dancing-in-the-moonlight-2026");

  assert.ok(event);
  assert.equal(regionalLocalSpawnScheduleCardLine({ ...event, timeZone: "Asia/Tokyo" }), "");
});

test("regional Clefairy detail shows its published local date range", () => {
  const event = curatedLocalEvents(Date.parse("2026-09-22T00:00:00Z"))
    .find(row => row.id === "local-dancing-in-the-moonlight-2026");

  assert.equal(regionalLocalEventRangeLine(event),
    "Event dates: Sep 23, 10:00 AM – Sep 28, 11:59 PM local time in each listed region");
  assert.equal(regionalLocalEventRangeLine({ ...event, timeZone: "Asia/Tokyo" }), "");
});
