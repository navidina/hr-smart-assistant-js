-- D1 schema for the HR Smart Assistant Cloudflare backend.

CREATE TABLE IF NOT EXISTS employees (
  code        TEXT PRIMARY KEY,
  name        TEXT,
  mobile      TEXT,
  extension   TEXT,
  department  TEXT,
  post        TEXT,
  hire_date   TEXT,
  birth_date  TEXT,
  hoze        TEXT,
  national_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_employees_mobile ON employees(mobile);

CREATE TABLE IF NOT EXISTS users (
  code       TEXT PRIMARY KEY,
  name       TEXT,
  mobile     TEXT,
  last_login TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT,
  question      TEXT NOT NULL,
  answer        TEXT,
  sources       TEXT,
  confidence    REAL,
  response_id   TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conversations_code ON conversations(employee_code, id DESC);
