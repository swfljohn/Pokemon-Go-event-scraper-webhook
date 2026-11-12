function headerObject(headers) {
  const value = {};
  for (const [name, entry] of headers.entries()) value[name.toLowerCase()] = entry;
  return value;
}

function queryObject(url) {
  const query = {};
  for (const [name, value] of url.searchParams.entries()) {
    if (!(name in query)) query[name] = value;
    else if (Array.isArray(query[name])) query[name].push(value);
    else query[name] = [query[name], value];
  }
  return query;
}

export class PayloadTooLargeError extends Error {
  constructor(limit) {
    super(`Request body exceeds the ${Math.max(1, Number(limit) || 0)} byte limit.`);
    this.name = "PayloadTooLargeError";
    this.status = 413;
  }
}

async function requestBody(request, maxBodyBytes) {
  if (["GET", "HEAD"].includes(request.method)) return { value: undefined, byteLength: 0 };
  const limit = Math.max(1, Number(maxBodyBytes) || 4_000_000);
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > limit) throw new PayloadTooLargeError(limit);
  if (!request.body) return { value: undefined, byteLength: 0 };
  const reader = request.body.getReader();
  const chunks = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > limit) {
      await reader.cancel().catch(() => {});
      throw new PayloadTooLargeError(limit);
    }
    chunks.push(value);
  }
  if (!byteLength) return { value: undefined, byteLength: 0 };
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  if (String(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    try {
      return { value: JSON.parse(text), byteLength };
    } catch {
      return { value: text, byteLength };
    }
  }
  return { value: text, byteLength };
}

export async function legacyRequest(request, { maxBodyBytes = 4_000_000 } = {}) {
  const url = new URL(request.url);
  const headers = headerObject(request.headers);
  const body = await requestBody(request, maxBodyBytes);
  if (!["GET", "HEAD"].includes(request.method)) headers["content-length"] = String(body.byteLength);
  return {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers,
    query: queryObject(url),
    body: body.value
  };
}

export class LegacyResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = new Map();
    this.body = null;
    this.finished = false;
  }

  setHeader(name, value) {
    this.headers.set(String(name).toLowerCase(), { name: String(name), value });
    return this;
  }

  status(value) {
    this.statusCode = Number(value) || 200;
    return this;
  }

  json(value) {
    if (!this.headers.has("content-type")) {
      this.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    this.body = JSON.stringify(value);
    this.finished = true;
    return this;
  }

  send(value) {
    this.body = value == null ? null : value;
    this.finished = true;
    return this;
  }

  end(value) {
    if (value !== undefined) this.body = value;
    this.finished = true;
    return this;
  }

  toResponse() {
    const headers = new Headers();
    for (const { name, value } of this.headers.values()) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(name, String(item));
      } else {
        headers.set(name, String(value));
      }
    }
    headers.set("X-Frame-Options", "SAMEORIGIN");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(this.body, { status: this.statusCode, headers });
  }
}

export async function runLegacyHandler(handler, request, options) {
  const legacy = await legacyRequest(request, options);
  const response = new LegacyResponse();
  await handler(legacy, response);
  return response.toResponse();
}
