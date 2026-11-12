// Public, read-only event data: GET /api/events (all events), ?id=<event id> (one event with scraped details),
// ?id=<event id>&format=gpx (venue coordinates as GPX).
import { buildEventGpx, eventGpxFilename } from "../event-gpx.js";
import { enrichCalendarEventDetail, fetchEventSpawns } from "../lib/event-spawns.js";
import { curatedLocalEvents } from "../lib/local-events.js";
import { sendJson } from "../lib/http.js";

const PUBLIC_CACHE = "public, max-age=300, stale-while-revalidate=900";

function eventById(result, id) {
  return (result.calendarEvents || []).find(row => row.id === id) ||
    (result.sourceCalendarEvents || []).find(row => row.id === id) || null;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { ok: false, error: "Method not allowed." });
  }
  const url = new URL(request.url, "http://localhost");
  const id = String(url.searchParams.get("id") || "").trim().slice(0, 160);
  try {
    const result = await fetchEventSpawns();
    if (id && url.searchParams.get("format") === "gpx") {
      const event = eventById(result, id) || curatedLocalEvents(0).find(row => row.id === id);
      const gpx = event ? buildEventGpx(event) : "";
      if (!gpx) return sendJson(response, 404, { ok: false, error: "No mapped locations are available for that event." });
      response.setHeader("Cache-Control", PUBLIC_CACHE);
      response.setHeader("Content-Type", "application/gpx+xml; charset=utf-8");
      response.setHeader("Content-Disposition", `attachment; filename="${eventGpxFilename(event)}"`);
      return response.status(200).send(gpx);
    }
    if (id) {
      const event = eventById(result, id);
      if (!event) return sendJson(response, 404, { ok: false, error: "Event not found." });
      const detailed = await enrichCalendarEventDetail(event);
      response.setHeader("Cache-Control", PUBLIC_CACHE);
      return response.status(200).json({ ok: true, fetchedAt: result.fetchedAt, event: detailed });
    }
    response.setHeader("Cache-Control", PUBLIC_CACHE);
    return response.status(200).json({
      ok: true,
      source: result.source,
      fetchedAt: result.fetchedAt,
      stale: Boolean(result.stale),
      calendarEvents: result.calendarEvents
    });
  } catch (error) {
    return sendJson(response, 502, { ok: false, error: String(error?.message || error).slice(0, 240) });
  }
}
