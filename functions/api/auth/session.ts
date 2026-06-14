import type { Env } from "../../../lib/types";
import { json } from "../../../lib/http";
import { getSession } from "../../../lib/session";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) {
    return json({ authenticated: false });
  }
  return json({
    authenticated: true,
    employee: {
      code: session.code,
      name: session.name,
      mobile: session.mobile,
    },
  });
};
