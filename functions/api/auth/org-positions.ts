import type { Env } from "../../../lib/types";
import { json, readJson } from "../../../lib/http";
import { getSession } from "../../../lib/session";
import { searchEmployeesByPost } from "../../../lib/db";

interface PositionRequest {
  id?: string;
  title?: string;
  subtitle?: string;
  label?: string;
  query?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) {
    return json({ error: "لطفاً ابتدا وارد شوید", authenticated: false }, 401);
  }

  const body = await readJson<{ positions?: PositionRequest[] }>(request);
  const positions = Array.isArray(body.positions) ? body.positions : [];

  let resolved = 0;
  const out = [];
  for (const position of positions) {
    const query = (position.query || position.title || position.label || "").toString().trim();
    let matches: unknown[] = [];
    if (query) {
      try {
        const employees = await searchEmployeesByPost(env, query, 3);
        matches = employees.map((e) => ({
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

  return json({ success: true, positions: out, resolved });
};
