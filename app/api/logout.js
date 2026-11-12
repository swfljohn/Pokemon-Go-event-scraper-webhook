import { sendJson } from "../lib/http.js";
import { browserMutationIsTrusted } from "../lib/auth.js";
import { cookieValue, SESSION_COOKIE } from "../lib/session.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { ok: false, error: "Method not allowed." });
  }
  if (!browserMutationIsTrusted(request)) return sendJson(response, 403, { ok: false, error: "Invalid request origin." });
  response.setHeader("Set-Cookie", cookieValue(SESSION_COOKIE, "", { maxAge: 0 }));
  return sendJson(response, 200, { ok: true });
}
