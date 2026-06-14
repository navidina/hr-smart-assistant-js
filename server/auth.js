// Sessions backed by a signed HS256 JWT stored in an HttpOnly cookie.

import crypto from "node:crypto";

export const SESSION_COOKIE = "sa_session";

function b64urlEncode(buf) {
  return Buffer.from(buf).toString("base64url");
}

function b64urlDecodeToString(str) {
  return Buffer.from(str, "base64url").toString("utf8");
}

function hmacSign(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function signJwt(payload, secret) {
  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlEncode(JSON.stringify(payload));
  const signature = hmacSign(secret, `${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expected = hmacSign(secret, `${header}.${body}`);
  if (!timingSafeEqual(expected, signature)) return null;

  try {
    const payload = JSON.parse(b64urlDecodeToString(body));
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  parts.push(`Path=${options.path || "/"}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  return parts.join("; ");
}

/** Resolve the current session from the request's signed cookie. */
export function getSession(req, env) {
  const token = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
  if (!token) return null;
  const payload = verifyJwt(token, env.JWT_SECRET || "dev-secret");
  if (!payload) return null;
  return {
    code: payload.sub,
    name: payload.name || "",
    mobile: payload.mobile || "",
  };
}

/** Whether the cookie should carry the Secure flag (HTTPS or behind a proxy). */
export function isSecureRequest(req) {
  return req.secure || (req.headers["x-forwarded-proto"] || "").split(",")[0] === "https";
}

export { timingSafeEqual };
