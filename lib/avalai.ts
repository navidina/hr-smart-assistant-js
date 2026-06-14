// AvalAI (OpenAI-compatible) chat completions client.

import type { Env } from "./types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  ok: boolean;
  content: string;
  error?: string;
}

export async function chatCompletion(
  env: Env,
  messages: ChatMessage[],
): Promise<ChatResult> {
  const key = (env.AVALAI_API_KEY || "").trim();
  if (!key) {
    return { ok: false, content: "", error: "AVALAI_API_KEY تنظیم نشده است" };
  }

  const base = (env.AVALAI_BASE_URL || "https://api.avalai.ir/v1").replace(/\/+$/, "");
  const model = env.AVALAI_MODEL || "gpt-4o-mini";

  try {
    const resp = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature: 0.3 }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, content: "", error: `AvalAI error ${resp.status}: ${text.slice(0, 300)}` };
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data?.choices?.[0]?.message?.content ?? "";
    return { ok: true, content };
  } catch (err) {
    return { ok: false, content: "", error: String((err as Error)?.message ?? err) };
  }
}
