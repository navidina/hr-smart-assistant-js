import type { Env } from "../lib/types";
import { json } from "../lib/http";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const now = new Date().toISOString();
  return json({
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
    error: null,
  });
};
