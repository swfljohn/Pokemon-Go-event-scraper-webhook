function parseLocalDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(String(value || "").trim());
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0", fractionText = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(fractionText.padEnd(3, "0") || 0);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const dayStart = Date.UTC(year, month - 1, day);
  const date = new Date(dayStart);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return {
    date: `${yearText}-${monthText}-${dayText}`,
    minuteOfDay: hour * 60 + minute,
    absoluteMilliseconds: dayStart + hour * 3_600_000 + minute * 60_000 + second * 1_000 + millisecond,
    second,
    millisecond
  };
}

function formatLocalClock(minuteOfDay) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function naturalList(values) {
  if (values.length < 2) return values[0] || "";
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

/** A regional wall-clock range has no single UTC instant, but its dates are still published. */
export function regionalLocalEventRangeLine(event) {
  if (String(event?.scope || "").toLowerCase() !== "regional" ||
      event?.localTime !== true || String(event?.timeZone || "").trim()) return "";
  const start = parseLocalDateTime(event?.start);
  const end = parseLocalDateTime(event?.end);
  if (!start || !end || end.absoluteMilliseconds < start.absoluteMilliseconds) return "";
  const format = value => new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  }).format(new Date(value.absoluteMilliseconds));
  return `Event dates: ${format(start)} – ${format(end)} local time in each listed region`;
}

/**
 * Return a card-safe label for a regional spawn schedule whose wall-clock
 * windows cannot be converted until a visitor chooses a specific region.
 */
export function regionalLocalSpawnScheduleCardLine(event) {
  const schedule = event?.details?.spawnSchedule;
  if (String(event?.scope || "").toLowerCase() !== "regional" ||
      event?.localTime !== true || String(event?.timeZone || "").trim() ||
      schedule?.localTime !== true || !Array.isArray(schedule.windows) || !schedule.windows.length) return "";

  const windowMinutes = Number(schedule.windowMinutes);
  if (!Number.isInteger(windowMinutes) || windowMinutes <= 0) return "";

  const windows = schedule.windows.map(row => {
    const start = parseLocalDateTime(row?.start);
    const end = parseLocalDateTime(row?.end);
    if (!start || !end || start.second !== 0 || start.millisecond !== 0 ||
        end.absoluteMilliseconds - start.absoluteMilliseconds !== windowMinutes * 60_000) return null;
    return { ...start, names: Array.isArray(row?.spawns) ? row.spawns : [] };
  });
  if (windows.some(window => !window)) return "";

  const byDate = new Map();
  for (const window of windows) {
    if (!byDate.has(window.date)) byDate.set(window.date, new Map());
    byDate.get(window.date).set(window.minuteOfDay, window.names);
  }
  const dailyTimes = [...byDate.values()].map(day => [...day.keys()].sort((a, b) => a - b));
  const firstTimes = dailyTimes[0] || [];
  if (!firstTimes.length) return "";
  const repeatsDaily = dailyTimes.length > 1 && dailyTimes.every(times =>
    times.length === firstTimes.length && times.every((time, index) => time === firstTimes[index])
  );

  const names = [...new Set(windows.flatMap(window => window.names.map(name => String(name || "").trim()).filter(Boolean)))];
  const subject = names.length === 1 ? `${names[0]} windows` : "Published windows";
  const times = naturalList(firstTimes.map(formatLocalClock));
  const cadence = repeatsDaily ? "each day" : "per window";
  return `${subject}: ${times} local time · ${windowMinutes} minutes ${cadence}`;
}
