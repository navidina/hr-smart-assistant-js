import type { Employee, Env } from "../../../lib/types";
import { json, readJson } from "../../../lib/http";
import { getEmployeeByCode, getFirstEmployee, recordLogin } from "../../../lib/db";
import { timingSafeEqual } from "../../../lib/crypto";
import { signJwt } from "../../../lib/jwt";
import { serializeCookie } from "../../../lib/cookies";
import { SESSION_COOKIE, isSecureRequest } from "../../../lib/session";

const TOKEN_TTL_SECONDS = 12 * 60 * 60;

// Demo credentials. Override via DEMO_USERNAME / DEMO_PASSWORD (wrangler vars).
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "rayan@1404";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<{ username?: string; password?: string }>(request);
  const username = (body.username ?? "").toString().trim();
  const password = (body.password ?? "").toString();
  if (!username || !password) {
    return json({ success: false, message: "نام کاربری و رمز عبور الزامی است" }, 400);
  }

  const expectedUser = (env.DEMO_USERNAME || DEFAULT_USERNAME).trim();
  const expectedPass = env.DEMO_PASSWORD || DEFAULT_PASSWORD;
  if (!timingSafeEqual(username, expectedUser) || !timingSafeEqual(password, expectedPass)) {
    return json({ success: false, message: "نام کاربری یا رمز عبور اشتباه است" }, 401);
  }

  // Bind the session to a real employee (so profile/dashboard look populated).
  // Falls back to a synthetic demo identity if D1 is empty or unavailable.
  let emp: Employee | null = null;
  try {
    if (env.DEMO_EMPLOYEE_CODE) {
      emp = await getEmployeeByCode(env, env.DEMO_EMPLOYEE_CODE);
    }
    if (!emp) emp = await getFirstEmployee(env);
  } catch (err) {
    console.error("demo employee lookup failed", err);
  }

  const identity = emp ?? { code: "demo", name: "کاربر دمو", mobile: "", post: "", hoze: "" };
  if (emp) {
    try {
      await recordLogin(env, emp);
    } catch (err) {
      console.error("recordLogin failed", err);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    {
      sub: identity.code,
      name: identity.name,
      mobile: identity.mobile,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    },
    env.JWT_SECRET || "dev-secret",
  );
  const cookie = serializeCookie(SESSION_COOKIE, token, {
    maxAge: TOKEN_TTL_SECONDS,
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "Lax",
    path: "/",
  });

  return json(
    {
      success: true,
      message: "ورود موفقیت‌آمیز بود",
      employee: {
        code: identity.code,
        name: identity.name,
        post: emp?.post ?? "",
        hoze: emp?.hoze ?? "",
      },
    },
    200,
    { "Set-Cookie": cookie },
  );
};
