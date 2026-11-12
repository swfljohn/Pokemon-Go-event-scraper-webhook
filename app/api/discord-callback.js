import { secretsMatch } from "../lib/auth.js";
import { requestedReturnTo, authReturnLocation } from "../lib/discord-return-target.js";
import { discordConfigured, exchangeDiscordCode, fetchDiscordUser } from "../lib/discord.js";
import { recordDiscordLogin } from "../lib/access.js";
import {
  cookieValue, createSessionToken, isAdminDiscordId, OAUTH_STATE_COOKIE, parseCookies, SESSION_COOKIE, SESSION_DURATION_SECONDS
} from "../lib/session.js";

function redirect(response, location, cookies = []) {
  if (cookies.length) response.setHeader("Set-Cookie", cookies);
  response.statusCode = 302;
  response.setHeader("Location", location);
  return response.end();
}

function queryValue(request, name) {
  try {
    return new URL(String(request.url || ""), "https://local.invalid").searchParams.get(name) || "";
  } catch {
    return "";
  }
}

const returnToFromState = state => requestedReturnTo(String(state || "").split(".").at(-1));

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).end();
  }
  const clearState = cookieValue(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/api/discord-callback" });
  const savedState = parseCookies(request)[OAUTH_STATE_COOKIE] || "";
  const returnTo = returnToFromState(savedState);
  if (!discordConfigured()) return redirect(response, authReturnLocation("not-configured", returnTo), [clearState]);

  const code = queryValue(request, "code");
  const returnedState = queryValue(request, "state");
  if (!code || !secretsMatch(returnedState, savedState)) {
    return redirect(response, authReturnLocation("invalid-state", returnTo), [clearState]);
  }
  try {
    const token = await exchangeDiscordCode(request, code);
    const discordUser = await fetchDiscordUser(token.access_token);
    const administrator = isAdminDiscordId(discordUser.id);
    const access = await recordDiscordLogin(discordUser).catch(error => {
      if (administrator) return null;
      throw error;
    });
    if (!access && !administrator) return redirect(response, authReturnLocation("denied", returnTo), [clearState]);
    const session = createSessionToken(discordUser, process.env.SESSION_SECRET);
    const sessionCookie = cookieValue(SESSION_COOKIE, session, { maxAge: SESSION_DURATION_SECONDS });
    const status = administrator || access?.enabled ? "success" : "pending";
    return redirect(response, authReturnLocation(status, returnTo), [clearState, sessionCookie]);
  } catch {
    return redirect(response, authReturnLocation("failed", returnTo), [clearState]);
  }
}
