// HR Smart Assistant — simple Node.js + Express + SQLite backend.
// Serves the static frontend and the same API the app expects. No Cloudflare.

import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  getEmployeeByCode,
  getFirstEmployee,
  listAllEmployees,
  searchEmployeesByPost,
  listConversations,
  recordConversation,
  recordLogin,
  getDb,
} from "./server/db.js";
import {
  SESSION_COOKIE,
  getSession,
  isSecureRequest,
  serializeCookie,
  signJwt,
  timingSafeEqual,
} from "./server/auth.js";
import { chatCompletion } from "./server/avalai.js";
import { calculateTenure } from "./server/jalali.js";
import { retrieve } from "./server/retrieval.js";
import { buildCelebrations, buildCountdown } from "./server/hr.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration is read from the environment (see .env.example).
const env = {
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret",
  AVALAI_API_KEY: process.env.AVALAI_API_KEY || "",
  AVALAI_BASE_URL: process.env.AVALAI_BASE_URL || "https://api.avalai.ir/v1",
  AVALAI_MODEL: process.env.AVALAI_MODEL || "gpt-4o-mini",
  DEMO_USERNAME: process.env.DEMO_USERNAME || "admin",
  DEMO_PASSWORD: process.env.DEMO_PASSWORD || "rayan@1404",
  DEMO_EMPLOYEE_CODE: process.env.DEMO_EMPLOYEE_CODE || "",
};

const PORT = Number(process.env.PORT) || 3000;
const TOKEN_TTL_SECONDS = 12 * 60 * 60;

const SYSTEM_PROMPT =
  "تو «دستیار هوشمند منابع انسانی رایان هم‌افزا» هستی. وظیفه‌ات پاسخ دقیق، محترمانه و کوتاه به " +
  "پرسش‌های کارکنان دربارهٔ سیاست‌های منابع انسانی، مزایا، مرخصی، حقوق و اطلاعات سازمانی است. " +
  "اگر اطلاعات کافی نداری صادقانه بگو و از حدس‌زدن بپرهیز. همیشه به زبان فارسی پاسخ بده.";

const app = express();
app.use(express.json({ limit: "1mb" }));

// Initialise the database (creates the schema on first run).
getDb();

function systemState() {
  const now = new Date().toISOString();
  return {
    model_status: "ready",
    ready: true,
    model_name: env.AVALAI_MODEL,
    ollama_url: env.AVALAI_BASE_URL,
    details: {
      personnel_loaded: true,
      policies_loaded: true,
      rag_loaded: false,
      pending_requests: 0,
      status: "ready",
      updated_at: now,
    },
    active_person: null,
    server_time: now,
    features: { feedback: true, regenerate: true, copy: true, status_polling: true },
    context_char_limit: 8000,
  };
}

function requireSession(req, res) {
  const session = getSession(req, env);
  if (!session) {
    res.status(401).json({ error: "لطفاً ابتدا وارد شوید", authenticated: false });
    return null;
  }
  return session;
}

// ---- Status ----------------------------------------------------------------
app.get("/status", (_req, res) => {
  const state = systemState();
  res.json({ ...state, error: null });
});

// ---- Auth ------------------------------------------------------------------
app.post("/api/auth/login", (req, res) => {
  const username = (req.body?.username ?? "").toString().trim();
  const password = (req.body?.password ?? "").toString();
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "نام کاربری و رمز عبور الزامی است" });
  }

  if (
    !timingSafeEqual(username, env.DEMO_USERNAME.trim()) ||
    !timingSafeEqual(password, env.DEMO_PASSWORD)
  ) {
    return res.status(401).json({ success: false, message: "نام کاربری یا رمز عبور اشتباه است" });
  }

  let emp = null;
  try {
    if (env.DEMO_EMPLOYEE_CODE) emp = getEmployeeByCode(env.DEMO_EMPLOYEE_CODE);
    if (!emp) emp = getFirstEmployee();
  } catch (err) {
    console.error("demo employee lookup failed", err);
  }

  const identity = emp ?? { code: "demo", name: "کاربر دمو", mobile: "", post: "", hoze: "" };
  if (emp) {
    try {
      recordLogin(emp);
    } catch (err) {
      console.error("recordLogin failed", err);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      sub: identity.code,
      name: identity.name,
      mobile: identity.mobile,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    },
    env.JWT_SECRET,
  );
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, token, {
      maxAge: TOKEN_TTL_SECONDS,
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: "Lax",
      path: "/",
    }),
  );
  res.json({
    success: true,
    message: "ورود موفقیت‌آمیز بود",
    employee: {
      code: identity.code,
      name: identity.name,
      post: emp?.post ?? "",
      hoze: emp?.hoze ?? "",
    },
  });
});

app.get("/api/auth/session", (req, res) => {
  const session = getSession(req, env);
  if (!session) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    employee: { code: session.code, name: session.name, mobile: session.mobile },
  });
});

app.post("/api/auth/logout", (req, res) => {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, "", {
      maxAge: 0,
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: "Lax",
      path: "/",
    }),
  );
  res.json({ success: true, message: "خروج موفقیت‌آمیز بود" });
});

app.get("/api/auth/profile", (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  let emp = null;
  try {
    emp = getEmployeeByCode(session.code);
  } catch (err) {
    console.error("getEmployeeByCode failed", err);
  }

  if (!emp) {
    return res.json({
      success: true,
      authenticated: true,
      profile: {
        code: session.code,
        name: session.name,
        mobile: session.mobile,
        extension: "",
        department: "",
        post: "",
        hire_date: "",
        birth_date: "",
        hoze: "",
        national_id: "",
        tenure_years: 0,
        tenure_months_total: 0,
        tenure_months_remainder: 0,
      },
    });
  }

  const tenure = calculateTenure(emp.hire_date);
  res.json({
    success: true,
    authenticated: true,
    profile: {
      code: emp.code,
      name: emp.name,
      mobile: emp.mobile,
      extension: emp.extension,
      department: emp.department,
      post: emp.post,
      hire_date: emp.hire_date,
      birth_date: emp.birth_date,
      hoze: emp.hoze,
      national_id: emp.national_id,
      ...tenure,
    },
  });
});

app.get("/api/auth/conversations", (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  let limit = parseInt(req.query.limit || "20", 10);
  if (!Number.isFinite(limit)) limit = 20;
  limit = Math.min(Math.max(limit, 1), 200);

  try {
    const conversations = listConversations(session.code, limit);
    res.json({ authenticated: true, conversations });
  } catch (err) {
    console.error("listConversations failed", err);
    res.status(500).json({ error: "امکان بازیابی گفتگوها نیست" });
  }
});

app.get("/api/auth/celebrations", (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const employees = listAllEmployees();
    res.json({ success: true, celebrations: buildCelebrations(employees) });
  } catch (err) {
    console.error("listAllEmployees failed", err);
    res.json({ success: true, celebrations: [] });
  }
});

app.post("/api/auth/org-positions", (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  const positions = Array.isArray(req.body?.positions) ? req.body.positions : [];
  let resolved = 0;
  const out = [];
  for (const position of positions) {
    const query = (position.query || position.title || position.label || "").toString().trim();
    let matches = [];
    if (query) {
      try {
        matches = searchEmployeesByPost(query, 3).map((e) => ({
          name: e.name,
          post: e.post,
          department: e.department,
          hoze: e.hoze,
          code: e.code,
          extension: e.extension,
          score: 100,
        }));
      } catch (err) {
        console.error("searchEmployeesByPost failed", err);
      }
    }
    if (matches.length) resolved += 1;
    out.push({ ...position, matches });
  }

  res.json({ success: true, positions: out, resolved });
});

app.get("/api/auth/countdown-dates", (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  let emp = null;
  try {
    emp = getEmployeeByCode(session.code);
  } catch (err) {
    console.error("getEmployeeByCode failed", err);
  }
  res.json({ success: true, countdown: buildCountdown(emp) });
});

// ---- Assistant -------------------------------------------------------------
app.post("/ask", async (req, res) => {
  const body = req.body ?? {};
  const question = (body.question ?? "").toString().trim();
  const responseId = crypto.randomUUID();

  if (!question) {
    return res.json({
      answer: "لطفاً سوال خود را وارد کنید.",
      sources: [],
      confidence: 0,
      response_id: responseId,
      system_state: systemState(),
    });
  }

  const session = getSession(req, env);
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  if (session) {
    try {
      const emp = getEmployeeByCode(session.code);
      if (emp) {
        const tenure = calculateTenure(emp.hire_date);
        messages.push({
          role: "system",
          content:
            `اطلاعات کاربر فعلی (برای شخصی‌سازی پاسخ): نام: ${emp.name}؛ پست: ${emp.post || "-"}؛ ` +
            `حوزه: ${emp.hoze || "-"}؛ بخش: ${emp.department || "-"}؛ تاریخ استخدام: ${emp.hire_date || "-"}؛ ` +
            `سابقه: ${tenure.tenure_years} سال و ${tenure.tenure_months_remainder} ماه.`,
        });
      }
    } catch (err) {
      console.error("profile context lookup failed", err);
    }
  }

  // Lightweight RAG over the bundled knowledge base.
  const retrieved = retrieve(question, 4);
  const sources = retrieved.map((c) => ({ file: c.source, section: c.title }));
  if (retrieved.length) {
    const context = retrieved
      .map((c, i) => `[منبع ${i + 1}] ${c.title}\n${c.text}`)
      .join("\n\n");
    messages.push({
      role: "system",
      content:
        "برای پاسخ از «منابع» زیر استفاده کن. اگر پاسخ پرسش در این منابع نبود، صادقانه بگو که " +
        "اطلاعات کافی نداری و از خودت چیزی نساز.\n\n===== منابع =====\n" +
        context,
    });
  }

  if (Array.isArray(body.conversation)) {
    for (const turn of body.conversation.slice(-6)) {
      if (turn?.question) messages.push({ role: "user", content: String(turn.question) });
      const latest =
        Array.isArray(turn?.answers) && turn.answers.length
          ? turn.answers[turn.answers.length - 1]?.text
          : turn?.answer;
      if (latest) messages.push({ role: "assistant", content: String(latest) });
    }
  }

  if (body.regenerate && body.previous_answer) {
    messages.push({
      role: "system",
      content: "پاسخ قبلی مناسب نبود؛ لطفاً پاسخی متفاوت و بهتر ارائه بده.",
    });
  }

  messages.push({ role: "user", content: question });

  const result = await chatCompletion(env, messages);
  if (!result.ok) {
    return res.json({
      answer: "در حال حاضر امکان پاسخ‌گویی نیست. لطفاً کمی بعد دوباره تلاش کنید.",
      sources: [],
      confidence: 0,
      response_id: responseId,
      system_state: { ...systemState(), error: result.error ?? "chat error" },
    });
  }

  const answer = result.content || "پاسخی دریافت نشد.";
  if (session) {
    try {
      recordConversation(session.code, question, answer, sources, 0.9, responseId);
    } catch (err) {
      console.error("recordConversation failed", err);
    }
  }

  res.json({
    answer,
    sources,
    confidence: 0.9,
    response_id: responseId,
    system_state: systemState(),
  });
});

// ---- Static frontend -------------------------------------------------------
app.use(
  express.static(__dirname, {
    extensions: ["html"],
    setHeaders(res, path) {
      if (path.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  }),
);

app.get("/", (_req, res) => res.sendFile(join(__dirname, "login.html")));

app.listen(PORT, () => {
  console.log(`HR Smart Assistant running on http://localhost:${PORT}`);
});
