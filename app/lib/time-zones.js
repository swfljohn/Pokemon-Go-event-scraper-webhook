// Time zones offered in the signup and admin forms.
const CURATED_TIME_ZONES = [
  "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos",
  "America/Anchorage", "America/Argentina/Buenos_Aires", "America/Bogota",
  "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Mexico_City",
  "America/New_York", "America/Phoenix", "America/Sao_Paulo",
  "Asia/Bangkok", "Asia/Dubai", "Asia/Hong_Kong", "Asia/Kolkata",
  "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Adelaide", "Australia/Brisbane", "Australia/Perth", "Australia/Sydney",
  "Europe/Athens", "Europe/Berlin", "Europe/London", "Europe/Madrid",
  "Europe/Moscow", "Europe/Paris", "Europe/Rome",
  "Pacific/Auckland", "Pacific/Honolulu", "Pacific/Kiritimati", "UTC"
];

function timeZoneLabel(value) {
  if (value === "UTC") return "UTC — Coordinated Universal Time";
  if (value === "Pacific/Kiritimati") return "London, Kiribati — Kiritimati Time (UTC+14)";
  const [region, ...locationParts] = value.split("/");
  const location = locationParts.join(" / ").replaceAll("_", " ");
  return location ? `${region.replaceAll("_", " ")} — ${location}` : value.replaceAll("_", " ");
}

function supportedTimeZones() {
  return [...new Set(CURATED_TIME_ZONES)].sort((left, right) =>
    left.localeCompare(right, "en", { sensitivity: "base" })
  );
}

export const DAILY_TIME_ZONE_OPTIONS = supportedTimeZones().map(value => ({
  value,
  label: timeZoneLabel(value)
}));
