// SQLite data-access layer (better-sqlite3, synchronous).

import Database from "better-sqlite3";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DB_PATH = process.env.DATABASE_PATH || join(ROOT, "data", "smartassistant.db");

let db;

export function getDb() {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  // Ensure the schema exists (idempotent — uses CREATE TABLE IF NOT EXISTS).
  const schemaPath = join(ROOT, "schema.sql");
  if (existsSync(schemaPath)) {
    db.exec(readFileSync(schemaPath, "utf8"));
  }
  return db;
}

export function getEmployeeByMobile(mobile) {
  return getDb()
    .prepare("SELECT * FROM employees WHERE mobile = ? LIMIT 1")
    .get(mobile) ?? null;
}

export function getEmployeeByCode(code) {
  return getDb()
    .prepare("SELECT * FROM employees WHERE code = ? LIMIT 1")
    .get(code) ?? null;
}

export function getFirstEmployee() {
  return getDb()
    .prepare("SELECT * FROM employees ORDER BY code LIMIT 1")
    .get() ?? null;
}

export function listAllEmployees() {
  return getDb().prepare("SELECT * FROM employees").all();
}

export function searchEmployeesByPost(query, limit = 3) {
  const like = `%${query}%`;
  return getDb()
    .prepare(
      "SELECT * FROM employees WHERE post LIKE ? OR hoze LIKE ? OR department LIKE ? LIMIT ?",
    )
    .all(like, like, like, limit);
}

export function recordLogin(emp) {
  getDb()
    .prepare(
      `INSERT INTO users (code, name, mobile, last_login)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         name = excluded.name,
         mobile = excluded.mobile,
         last_login = excluded.last_login`,
    )
    .run(emp.code, emp.name, emp.mobile, new Date().toISOString());
}

export function recordConversation(code, question, answer, sources, confidence, responseId) {
  getDb()
    .prepare(
      `INSERT INTO conversations (employee_code, question, answer, sources, confidence, response_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(code, question, answer, JSON.stringify(sources ?? []), confidence, responseId);
}

function safeParse(value) {
  if (typeof value !== "string" || !value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export function listConversations(code, limit) {
  const rows = getDb()
    .prepare(
      `SELECT question, answer, sources, confidence, response_id, created_at
       FROM conversations WHERE employee_code = ? ORDER BY id DESC LIMIT ?`,
    )
    .all(code, limit);

  return rows.map((r) => ({
    question: String(r.question ?? ""),
    answer: String(r.answer ?? ""),
    sources: safeParse(r.sources),
    confidence: r.confidence === null || r.confidence === undefined ? null : Number(r.confidence),
    response_id: String(r.response_id ?? ""),
    created_at: String(r.created_at ?? ""),
  }));
}
