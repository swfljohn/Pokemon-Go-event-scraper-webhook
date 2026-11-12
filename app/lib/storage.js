// Small JSON key/value store on Cloudflare D1 (tables app_kv and app_locks, see migrations/0001).
// Values are gzip + base64 so large event snapshots fit in one row.
import { randomUUID } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { currentRuntime, runtimeExecutionContext } from "./runtime-context.js";

const DEFAULT_LOCK_TIMEOUT_MS = 10_000;
const DEFAULT_LOCK_LEASE_MS = 20_000;
const D1_VALUE_LIMIT_BYTES = 1_900_000;
const KEY_PREFIX_PATTERN = /[^A-Za-z0-9:._-]/g;

// In-memory fallback so unit tests and `node` scripts work without D1.
const memory = new Map();

function database() {
  return currentRuntime()?.d1 || null;
}

export function storageConfigured() {
  return Boolean(database());
}

function encode(value) {
  const encoded = gzipSync(JSON.stringify(value)).toString("base64");
  if (Buffer.byteLength(encoded, "utf8") > D1_VALUE_LIMIT_BYTES) {
    throw new Error("Stored JSON exceeds Cloudflare D1's safe row-size limit.");
  }
  return encoded;
}

function decode(row, key) {
  try {
    const text = row.encoding === "json"
      ? String(row.value || "")
      : gunzipSync(Buffer.from(String(row.value || ""), "base64")).toString("utf8");
    return JSON.parse(text);
  } catch {
    throw new Error(`Stored value ${key} is not valid JSON.`);
  }
}

export async function readJson(key) {
  const db = database();
  if (!db) return memory.has(key) ? structuredClone(memory.get(key)) : null;
  const row = await db.prepare("SELECT value, encoding FROM app_kv WHERE key = ?").bind(key).first();
  return row ? decode(row, key) : null;
}

export async function readJsonMany(keys) {
  const list = [...new Set((keys || []).map(String))];
  const values = await Promise.all(list.map(key => readJson(key)));
  return Object.fromEntries(list.map((key, index) => [key, values[index]]));
}

export async function writeJson(key, value) {
  const db = database();
  if (!db) {
    memory.set(key, structuredClone(value));
    return true;
  }
  await db.prepare(
    `INSERT INTO app_kv (key, value, encoding, updated_at) VALUES (?, ?, 'gzip-base64', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, encoding = excluded.encoding, updated_at = excluded.updated_at`
  ).bind(key, encode(value), Date.now()).run();
  return true;
}

export async function deleteJson(key) {
  const db = database();
  if (!db) return memory.delete(key);
  await db.prepare("DELETE FROM app_kv WHERE key = ?").bind(key).run();
  return true;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function acquire(db, lockKey, token, leaseMs) {
  const now = Date.now();
  const result = await db.prepare(
    `INSERT INTO app_locks (name, token, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at
     WHERE app_locks.expires_at <= ?`
  ).bind(lockKey, token, now + leaseMs, now).run();
  return Number(result?.meta?.changes) > 0;
}

async function release(db, lockKey, token) {
  await db.prepare("DELETE FROM app_locks WHERE name = ? AND token = ?").bind(lockKey, token).run();
}

const memoryLocks = new Map();

/** Run `callback` while holding a named lock (D1 row lease; in-process mutex without D1). */
export async function withRedisLock(name, callback, options = {}) {
  const lockKey = `lock:${String(name || "shared").replace(KEY_PREFIX_PATTERN, "-")}`;
  const timeoutMs = Math.max(500, Number(options.timeoutMs) || DEFAULT_LOCK_TIMEOUT_MS);
  const leaseMs = Math.max(timeoutMs + 2_000, Number(options.leaseMs) || DEFAULT_LOCK_LEASE_MS);
  const db = database();
  if (!db) {
    const previous = memoryLocks.get(lockKey) || Promise.resolve();
    let done;
    const current = new Promise(resolve => { done = resolve; });
    memoryLocks.set(lockKey, previous.then(() => current));
    await previous;
    try { return await callback(); } finally { done(); }
  }
  const token = randomUUID();
  const deadline = Date.now() + timeoutMs;
  let acquired = false;
  while (!acquired && Date.now() < deadline) {
    acquired = await acquire(db, lockKey, token, leaseMs);
    if (!acquired) await wait(35 + Math.floor(Math.random() * 40));
  }
  if (!acquired) {
    const error = new Error(`Timed out waiting for the ${name} storage lock.`);
    error.status = 503;
    throw error;
  }
  const work = (async () => {
    try {
      return await callback();
    } finally {
      await release(db, lockKey, token).catch(error => {
        console.warn(`Storage lock release failed for ${name}: ${String(error?.message || error)}`);
      });
    }
  })();
  const context = runtimeExecutionContext();
  if (typeof context?.waitUntil === "function") {
    try { context.waitUntil(work.then(() => undefined, () => undefined)); } catch { /* ignore */ }
  }
  return work;
}
