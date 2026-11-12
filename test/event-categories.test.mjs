import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENT_CALENDAR_CATEGORIES,
  eventCalendarCategory,
  eventCalendarCategoryClass,
  eventMatchesCalendarCategory
} from "../app/event-calendar.js";

test("calendar category metadata stays ordered and every category has an accessible label and color", () => {
  assert.deepEqual(EVENT_CALENDAR_CATEGORIES.map(({ id }) => id), [
    "local", "raid-day", "raids", "community-day", "max-battles", "research", "spotlight-hour", "stamp-rally", "other"
  ]);
  for (const category of EVENT_CALENDAR_CATEGORIES) {
    assert.ok(category.label);
    assert.match(category.color, /^#[0-9a-f]{6}$/i);
  }
});

test("explicit event types map to their categories, including separated raid and Max Battle families", () => {
  const cases = [
    ["raid-day", "raid-day"], ["elite-raid", "raid-day"], ["raid-hour", "raids"], ["mega-raids", "raids"],
    ["regional-community-day", "community-day"], ["max-mondays", "max-battles"], ["field-research", "research"],
    ["pokemon-spotlight-hour", "spotlight-hour"], ["stamp-rally", "stamp-rally"]
  ];
  for (const [eventType, category] of cases) assert.equal(eventCalendarCategory({ eventType }), category, eventType);
  assert.equal(eventCalendarCategory({ eventType: "event", name: "Raid Night at the harbor" }), "other");
  assert.equal(eventCalendarCategory({ eventType: "event", heading: "Field Research" }), "other");
});

test("local filtering overlaps typed categories when scope is local and handles unscoped local types", () => {
  const localRaid = { eventType: "raid-hour", scope: "venue" };
  assert.equal(eventCalendarCategory(localRaid), "raids");
  assert.equal(eventMatchesCalendarCategory(localRaid, "raids"), true);
  assert.equal(eventMatchesCalendarCategory(localRaid, "local"), true);
  assert.equal(eventMatchesCalendarCategory({ eventType: "raid-hour", scope: "global" }, "local"), false);
  assert.equal(eventCalendarCategory({ eventType: "local-partnership" }), "local");
  assert.equal(eventMatchesCalendarCategory({ eventType: "local-partnership" }, "local"), true);
});

test("unknown and reset category behavior is explicit", () => {
  assert.equal(eventMatchesCalendarCategory({ eventType: "raid-day" }, "all"), true);
  assert.equal(eventMatchesCalendarCategory({ eventType: "anything" }, "all"), true);
  assert.equal(eventMatchesCalendarCategory({ eventType: "raid-day" }, "raid-day"), true);
  assert.equal(eventMatchesCalendarCategory({ eventType: "raid-day" }, "other"), false);
  assert.equal(eventCalendarCategoryClass({ eventType: "max-monday" }), "event-category-max-battles");
});
