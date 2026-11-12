// Discord webhook delivery for event posts (text + optional PNG attachment, or embeds).
import { normalizeDiscordWebhookUrl } from "./event-webhooks.js";
import { normalizeEventWebhookBranding } from "./event-settings.js";

export class DiscordWebhookDeliveryError extends Error {
  constructor(message, {
    status = 0,
    discordCode = "",
    retryable = false,
    retryAfterMs = 0,
    permanentDestinationFailure = false
  } = {}) {
    super(String(message || "Discord webhook delivery failed."));
    this.name = "DiscordWebhookDeliveryError";
    this.status = Math.max(0, Number(status) || 0);
    this.discordCode = String(discordCode || "").replace(/[^0-9]/g, "").slice(0, 12);
    this.retryable = retryable === true;
    this.retryAfterMs = Math.max(0, Number(retryAfterMs) || 0);
    this.permanentDestinationFailure = permanentDestinationFailure === true;
  }
}

function cleanText(value, limit = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

export async function sendEventDigestWebhook(message, destinationUrl = "", { roleId = "", username = "" } = {}) {
  const textPost = message && !Array.isArray(message) && typeof message.content === "string" ? message : null;
  const rows = textPost ? [] : Array.isArray(message) ? message.filter(Boolean).slice(0, 10) : [];
  if (!textPost && !rows.length) return false;
  if (textPost && !textPost.content.trim() && !textPost.image) return false;
  let webhookUrl;
  try {
    webhookUrl = normalizeDiscordWebhookUrl(destinationUrl || process.env.ADMIN_WEBHOOK_URL || "");
  } catch {
    return false;
  }
  // `wait=true` makes Discord return the saved Message instead of an
  // unconfirmed 204. Add it only to this request URL so the canonical webhook
  // identity used by settings and automatic-delivery dedupe remains unchanged.
  const executionUrl = new URL(webhookUrl);
  executionUrl.searchParams.set("wait", "true");
  executionUrl.hash = "";
  const safeRoleId = /^\d{15,22}$/.test(String(roleId || "").trim()) ? String(roleId).trim() : "";
  const safeUsername = normalizeEventWebhookBranding({ botName: username }).botName;
  const payloadJson = JSON.stringify(textPost ? {
    username: safeUsername,
    content: `${safeRoleId ? `<@&${safeRoleId}>\n` : ""}${textPost.content}`.slice(0, 2000),
    allowed_mentions: safeRoleId ? { parse: [], roles: [safeRoleId] } : { parse: [] },
    ...(textPost.image ? { attachments: [{ id: 0, filename: textPost.image.name }] } : {})
  } : {
    username: safeUsername,
    content: safeRoleId ? `<@&${safeRoleId}>` : undefined,
    allowed_mentions: safeRoleId ? { parse: [], roles: [safeRoleId] } : { parse: [] },
    embeds: rows
  });
  const requestBody = () => {
    if (!textPost?.image) return { body: payloadJson, headers: { "Content-Type": "application/json" } };
    const form = new FormData();
    form.append("payload_json", payloadJson);
    form.append("files[0]", new Blob([textPost.image.data], { type: "image/png" }), textPost.image.name);
    return { body: form, headers: {} };
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try {
      const request = requestBody();
      response = await fetch(executionUrl.toString(), {
        method: "POST",
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.timeout(10_000)
      });
    } catch (error) {
      if (attempt < 2) continue;
      throw new DiscordWebhookDeliveryError(
        error?.name === "TimeoutError"
          ? "Discord webhook delivery timed out."
          : "Discord webhook delivery could not reach Discord.",
        { retryable: true }
      );
    }
    const payload = await response.json().catch(() => null);
    if (response.status === 200) {
      const messageId = typeof payload?.id === "string" ? payload.id.trim() : "";
      if (/^\d{15,22}$/.test(messageId)) return true;
      throw new DiscordWebhookDeliveryError(
        "Discord webhook confirmation failed: HTTP 200 response did not include a valid Discord Message id.",
        { status: 200 }
      );
    }
    if (response.ok) {
      throw new DiscordWebhookDeliveryError(
        `Discord webhook confirmation failed: expected HTTP 200 with a Discord Message id; received HTTP ${response.status}.`,
        { status: response.status }
      );
    }
    const retryable = response.status === 429 || response.status >= 500;
    const retryAfterHeader = Number(response.headers.get("retry-after"));
    const retryAfterBody = Number(payload?.retry_after);
    const retryAfterMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader * 1000
      : Number.isFinite(retryAfterBody) && retryAfterBody > 0
        ? retryAfterBody * 1000
        : 500 * 2 ** attempt;
    // Long waits belong to the delivery queue. Capping a requested wait and
    // retrying early would violate Discord's rate limit and waste attempts.
    if (!retryable || attempt === 2 || retryAfterMs > 10_000) {
      const detail = cleanText(payload?.message, 180);
      const code = /^\d{1,12}$/.test(String(payload?.code ?? "").trim())
        ? String(payload.code).trim()
        : "";
      const safeDetail = [detail, code ? `Discord code ${code}` : ""].filter(Boolean).join(" · ");
      const permanentDestinationFailure = [401, 403, 404].includes(response.status) || code === "10015";
      throw new DiscordWebhookDeliveryError(
        `Discord webhook returned HTTP ${response.status}${safeDetail ? `: ${safeDetail}` : ""}.`,
        {
          status: response.status,
          discordCode: code,
          retryable,
          retryAfterMs: retryable ? retryAfterMs : 0,
          permanentDestinationFailure
        }
      );
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(10_000, Math.max(250, retryAfterMs))));
  }
  return false;
}
