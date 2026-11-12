// Webhook URLs are secrets (anyone holding one can post to that channel), so they are stored AES-256-GCM encrypted.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const CONTEXT = "pokemon-go-event-webhook/v1";

function encryptionKey() {
  const secret = String(process.env.EVENT_WEBHOOK_ENCRYPTION_KEY || "").trim();
  if (secret.length < 24) {
    throw new Error("EVENT_WEBHOOK_ENCRYPTION_KEY (24+ characters) must be configured before webhooks can be saved.");
  }
  return createHash("sha256").update(`${CONTEXT}:${secret}`).digest();
}

export function encryptEventWebhookUrl(url) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(url), "utf8"), cipher.final()]);
  return {
    version: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: ciphertext.toString("base64url")
  };
}

export function decryptEventWebhookUrl(value) {
  if (Number(value?.version) !== 1 || !value?.iv || !value?.tag || !value?.data) {
    throw new Error("Saved event webhook is unavailable.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(value.tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(value.data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Saved event webhook could not be decrypted.");
  }
}
