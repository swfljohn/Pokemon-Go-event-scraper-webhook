import { sendJson } from "../lib/http.js";
import { signupMode } from "../lib/access.js";
import { cookieValue, createSessionToken, readAuthorizedSession, SESSION_COOKIE, SESSION_DURATION_SECONDS } from "../lib/session.js";
import { discordConfigured } from "../lib/discord.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { ok: false, error: "Method not allowed." });
  }
  const user = await readAuthorizedSession(request);
  if (!user) {
    return sendJson(response, 401, { ok: false, error: "Not signed in.", discordConfigured: discordConfigured(), signupMode: signupMode() });
  }
  // Slide the seven-day window while the user is active.
  const token = createSessionToken({
    id: user.discordId, username: user.username, global_name: user.displayName, avatar: user.avatar
  }, process.env.SESSION_SECRET);
  response.setHeader("Set-Cookie", cookieValue(SESSION_COOKIE, token, { maxAge: SESSION_DURATION_SECONDS }));
  return sendJson(response, 200, { ok: true, user, signupMode: signupMode() });
}
