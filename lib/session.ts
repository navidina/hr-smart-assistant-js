// Session resolution from the signed JWT cookie.

import type { Env, SessionData } from "./types";
import { parseCookies } from "./cookies";
import { verifyJwt } from "./jwt";

export const SESSION_COOKIE = "sa_session";

export async function getSession(
  request: Request,
  env: Env,
): Promise<SessionData | null> {
  const token = parseCookies(request.headers.get("Cookie"))[SESSION_COOKIE];
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET || "dev-secret");
  if (!payload) return null;
  return {
    code: payload.sub,
    name: payload.name || "",
    mobile: payload.mobile || "",
  };
}

/** Whether the cookie should carry the Secure flag (true for HTTPS requests). */
export function isSecureRequest(request: Request): boolean {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return true;
  }
}
