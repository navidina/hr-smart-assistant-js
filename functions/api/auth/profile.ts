import type { Employee, Env } from "../../../lib/types";
import { json } from "../../../lib/http";
import { getSession } from "../../../lib/session";
import { getEmployeeByCode } from "../../../lib/db";
import { calculateTenure } from "../../../lib/jalali";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) {
    return json({ error: "لطفاً ابتدا وارد شوید", authenticated: false }, 401);
  }

  let emp: Employee | null = null;
  try {
    emp = await getEmployeeByCode(env, session.code);
  } catch (err) {
    console.error("getEmployeeByCode failed", err);
  }

  // Demo / employee not found in D1: return a minimal profile from the session
  // so the UI still renders instead of erroring.
  if (!emp) {
    return json({
      success: true,
      authenticated: true,
      profile: {
        code: session.code,
        name: session.name,
        mobile: session.mobile,
        extension: "",
        department: "",
        post: "",
        hire_date: "",
        birth_date: "",
        hoze: "",
        national_id: "",
        tenure_years: 0,
        tenure_months_total: 0,
        tenure_months_remainder: 0,
      },
    });
  }

  const tenure = calculateTenure(emp.hire_date);
  const profile = {
    code: emp.code,
    name: emp.name,
    mobile: emp.mobile,
    extension: emp.extension,
    department: emp.department,
    post: emp.post,
    hire_date: emp.hire_date,
    birth_date: emp.birth_date,
    hoze: emp.hoze,
    national_id: emp.national_id,
    ...tenure,
  };

  return json({ success: true, authenticated: true, profile });
};
