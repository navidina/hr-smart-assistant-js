import type { Env } from "../../../lib/types";
import { json } from "../../../lib/http";
import { serializeCookie } from "../../../lib/cookies";
import { SESSION_COOKIE, isSecureRequest } from "../../../lib/session";

export const onRequestPost: PagesFunction<Env> = async ({ request }) => {
  const cookie = serializeCookie(SESSION_COOKIE, "", {
    maxAge: 0,
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "Lax",
    path: "/",
  });
  return json({ success: true, message: "خروج موفقیت‌آمیز بود" }, 200, {
    "Set-Cookie": cookie,
  });
};
