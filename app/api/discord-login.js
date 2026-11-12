import {
  createOAuthState,
  discordAuthorizationUrl,
  discordConfigured,
  incomingRequestOrigin,
  requestOrigin
} from "../lib/discord.js";
import { cookieValue, OAUTH_STATE_COOKIE } from "../lib/session.js";
import { requestedReturnTo, authReturnLocation } from "../lib/discord-return-target.js";

function unavailableRedirect(returnTo) {
  return authReturnLocation("not-configured", returnTo);
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).end();
  }
  const canonicalOrigin = requestOrigin(request);
  if (incomingRequestOrigin(request) !== canonicalOrigin) {
    response.statusCode = 308;
    const incomingUrl = new URL(request.url, canonicalOrigin);
    const returnTo = requestedReturnTo(incomingUrl.searchParams.get("returnTo"));
    response.setHeader("Location", `${canonicalOrigin}/api/discord-login?returnTo=${returnTo}`);
    return response.end();
  }
  const requestUrl = new URL(request.url, canonicalOrigin);
  const returnTo = requestedReturnTo(requestUrl.searchParams.get("returnTo"));
  if (!discordConfigured()) {
    response.statusCode = 302;
    response.setHeader("Location", unavailableRedirect(returnTo));
    return response.end();
  }
  const state = `${createOAuthState()}.${returnTo}`;
  response.setHeader("Set-Cookie", cookieValue(OAUTH_STATE_COOKIE, state, {
    maxAge: 600,
    path: "/api/discord-callback"
  }));
  response.statusCode = 302;
  response.setHeader("Location", discordAuthorizationUrl(request, state));
  return response.end();
}
