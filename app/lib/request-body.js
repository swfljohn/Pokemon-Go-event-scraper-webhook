// Body parser shared by the API handlers.
export function parseRequestBody(body) {
  if (body && typeof body === "object") return body;
  if (typeof body !== "string" || !body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new TypeError("The request body is not valid JSON.");
  }
}
