// D1 data-access helpers.

import type { Employee, Env } from "./types";

export async function getEmployeeByMobile(
  env: Env,
  mobile: string,
): Promise<Employee | null> {
  return (
    (await env.DB.prepare("SELECT * FROM employees WHERE mobile = ? LIMIT 1")
      .bind(mobile)
      .first<Employee>()) ?? null
  );
}

export async function getEmployeeByCode(
  env: Env,
  code: string,
): Promise<Employee | null> {
  return (
    (await env.DB.prepare("SELECT * FROM employees WHERE code = ? LIMIT 1")
      .bind(code)
      .first<Employee>()) ?? null
  );
}

export async function getFirstEmployee(env: Env): Promise<Employee | null> {
  return (
    (await env.DB.prepare("SELECT * FROM employees ORDER BY code LIMIT 1").first<Employee>()) ??
    null
  );
}

export async function listAllEmployees(env: Env): Promise<Employee[]> {
  const res = await env.DB.prepare("SELECT * FROM employees").all<Employee>();
  return res.results ?? [];
}

export async function searchEmployeesByPost(
  env: Env,
  query: string,
  limit = 3,
): Promise<Employee[]> {
  const like = `%${query}%`;
  const res = await env.DB.prepare(
    "SELECT * FROM employees WHERE post LIKE ? OR hoze LIKE ? OR department LIKE ? LIMIT ?",
  )
    .bind(like, like, like, limit)
    .all<Employee>();
  return res.results ?? [];
}

export async function recordLogin(env: Env, emp: Employee): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (code, name, mobile, last_login)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       name = excluded.name,
       mobile = excluded.mobile,
       last_login = excluded.last_login`,
  )
    .bind(emp.code, emp.name, emp.mobile, new Date().toISOString())
    .run();
}

export async function recordConversation(
  env: Env,
  code: string | null,
  question: string,
  answer: string,
  sources: unknown,
  confidence: number | null,
  responseId: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO conversations (employee_code, question, answer, sources, confidence, response_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(code, question, answer, JSON.stringify(sources ?? []), confidence, responseId)
    .run();
}

export interface ConversationRecord {
  question: string;
  answer: string;
  sources: unknown;
  confidence: number | null;
  response_id: string;
  created_at: string;
}

export async function listConversations(
  env: Env,
  code: string,
  limit: number,
): Promise<ConversationRecord[]> {
  const res = await env.DB.prepare(
    `SELECT question, answer, sources, confidence, response_id, created_at
     FROM conversations WHERE employee_code = ? ORDER BY id DESC LIMIT ?`,
  )
    .bind(code, limit)
    .all<Record<string, unknown>>();

  return (res.results ?? []).map((r) => ({
    question: String(r.question ?? ""),
    answer: String(r.answer ?? ""),
    sources: safeParse(r.sources),
    confidence: r.confidence === null || r.confidence === undefined ? null : Number(r.confidence),
    response_id: String(r.response_id ?? ""),
    created_at: String(r.created_at ?? ""),
  }));
}

function safeParse(value: unknown): unknown {
  if (typeof value !== "string" || !value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}
