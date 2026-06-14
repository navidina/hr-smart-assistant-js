import type { Env } from "../lib/types";
import { json, readJson } from "../lib/http";
import { getSession } from "../lib/session";
import { getEmployeeByCode, recordConversation } from "../lib/db";
import { chatCompletion, type ChatMessage } from "../lib/avalai";
import { calculateTenure } from "../lib/jalali";
import { retrieve } from "../lib/retrieval";

const SYSTEM_PROMPT =
  "تو «دستیار هوشمند منابع انسانی رایان هم‌افزا» هستی. وظیفه‌ات پاسخ دقیق، محترمانه و کوتاه به " +
  "پرسش‌های کارکنان دربارهٔ سیاست‌های منابع انسانی، مزایا، مرخصی، حقوق و اطلاعات سازمانی است. " +
  "اگر اطلاعات کافی نداری صادقانه بگو و از حدس‌زدن بپرهیز. همیشه به زبان فارسی پاسخ بده.";

interface AskBody {
  question?: string;
  conversation?: Array<{
    question?: string;
    answer?: string;
    answers?: Array<{ text?: string }>;
  }>;
  previous_answer?: string;
  regenerate?: boolean;
  turn_id?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<AskBody>(request);
  const question = (body.question ?? "").toString().trim();
  const responseId = crypto.randomUUID();
  const systemState = buildSystemState(env);

  if (!question) {
    return json({
      answer: "لطفاً سوال خود را وارد کنید.",
      sources: [],
      confidence: 0,
      response_id: responseId,
      system_state: systemState,
    });
  }

  const session = await getSession(request, env);
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  if (session) {
    try {
      const emp = await getEmployeeByCode(env, session.code);
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

  // Lightweight RAG: pull the most relevant knowledge-base chunks for this
  // question and ground the model on them.
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
    return json({
      answer: "در حال حاضر امکان پاسخ‌گویی نیست. لطفاً کمی بعد دوباره تلاش کنید.",
      sources: [],
      confidence: 0,
      response_id: responseId,
      system_state: { ...systemState, error: result.error ?? "chat error" },
    });
  }

  const answer = result.content || "پاسخی دریافت نشد.";
  if (session) {
    try {
      await recordConversation(env, session.code, question, answer, sources, 0.9, responseId);
    } catch (err) {
      console.error("recordConversation failed", err);
    }
  }

  return json({
    answer,
    sources,
    confidence: 0.9,
    response_id: responseId,
    system_state: systemState,
  });
};

function buildSystemState(env: Env) {
  const now = new Date().toISOString();
  return {
    model_status: "ready",
    ready: true,
    model_name: env.AVALAI_MODEL || "gpt-4o-mini",
    ollama_url: env.AVALAI_BASE_URL || "https://api.avalai.ir/v1",
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
