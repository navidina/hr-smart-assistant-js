// Shared types for the Cloudflare Pages Functions backend.

export interface Env {
  // Bindings
  DB: D1Database;

  // Secrets (set via `wrangler pages secret put` or the dashboard)
  JWT_SECRET: string;
  AVALAI_API_KEY: string;

  // Demo username/password login
  DEMO_USERNAME?: string;
  DEMO_PASSWORD?: string;
  DEMO_EMPLOYEE_CODE?: string;

  // Vars (wrangler.toml [vars])
  AVALAI_BASE_URL: string;
  AVALAI_MODEL: string;
}

export interface Employee {
  code: string;
  name: string;
  mobile: string;
  extension: string;
  department: string;
  post: string;
  hire_date: string;
  birth_date: string;
  hoze: string;
  national_id: string;
}

export interface SessionData {
  code: string;
  name: string;
  mobile: string;
}
