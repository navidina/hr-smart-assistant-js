// Minimal HS256 JWT implementation backed by Web Crypto.

import { b64urlDecode, b64urlEncode, hmacSign, timingSafeEqual } from "./crypto";

export interface JwtPayload {
  sub: string;
  name?: string;
  mobile?: string;
  iat?: number;
  exp: number;
}

function encodeSegment(value: unknown): string {
  return b64urlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

export async function signJwt(
  payload: JwtPayload,
  secret: string,
): Promise<string> {
  const header = encodeSegment({ alg: "HS256", typ: "JWT" });
  const body = encodeSegment(payload);
  const signature = await hmacSign(secret, `${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expected = await hmacSign(secret, `${header}.${body}`);
  if (!timingSafeEqual(expected, signature)) return null;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(body)),
    ) as JwtPayload;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
