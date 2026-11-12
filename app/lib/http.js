export function setApiHeaders(response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

export function sendJson(response, status, body) {
  setApiHeaders(response);
  return response.status(status).json(body);
}

function apiRequestId() {
  return globalThis.crypto?.randomUUID?.() ||
    `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function redactedErrorMessage(error) {
  return String(error?.message || error || "Unknown error")
    .replace(/https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/[^\s"']+/gi, "[redacted-discord-webhook]")
    .replace(/\b(password|secret|token|authorization)(\s*[=:]\s*)[^\s,;]+/gi, "$1$2[redacted]")
    .slice(0, 500);
}

export function sendApiFailure(response, error, {
  event = "api-request-failed",
  fallbackStatus = 500
} = {}) {
  const explicitStatus = Number(error?.statusCode) || 0;
  const status = explicitStatus >= 400 && explicitStatus < 600
    ? explicitStatus
    : error instanceof TypeError ? 400 : fallbackStatus;
  if (status < 500) {
    return sendJson(response, status, { ok: false, error: String(error?.message || error) });
  }
  const requestId = apiRequestId();
  console.error(JSON.stringify({
    event,
    requestId,
    status,
    error: redactedErrorMessage(error)
  }));
  return sendJson(response, status, {
    ok: false,
    error: "The request could not be completed. Try again shortly.",
    requestId
  });
}

