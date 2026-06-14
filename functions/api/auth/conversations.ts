import type { Env } from "../../../lib/types";
import { json } from "../../../lib/http";
import { getSession } from "../../../lib/session";
import { listConversations } from "../../../lib/db";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) {
    return json({ error: "لطفاً ابتدا وارد شوید", authenticated: false }, 401);
  }

  let limit = parseInt(new URL(request.url).searchParams.get("limit") || "20", 10);
  if (!Number.isFinite(limit)) limit = 20;
  limit = Math.min(Math.max(limit, 1), 200);

  let conversations: unknown[] = [];
  try {
    conversations = await listConversations(env, session.code, limit);
  } catch (err) {
    console.error("listConversations failed", err);
    return json({ error: "امکان بازیابی گفتگوها نیست" }, 500);
  }

  return json({ authenticated: true, conversations });
};
