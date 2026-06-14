import type { Env } from "../../../lib/types";
import { json } from "../../../lib/http";
import { getSession } from "../../../lib/session";
import { listAllEmployees } from "../../../lib/db";
import {
  formatJalali,
  jToG,
  nextAnnualOccurrence,
  parseJalali,
  todayJalali,
} from "../../../lib/jalali";

const WINDOW_DAYS = 30;
const MAX_ITEMS = 16;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) {
    return json({ error: "لطفاً ابتدا وارد شوید", authenticated: false }, 401);
  }

  let employees;
  try {
    employees = await listAllEmployees(env);
  } catch (err) {
    console.error("listAllEmployees failed", err);
    return json({ success: true, celebrations: [] });
  }

  const now = new Date();
  const today = todayJalali(now);
  const todayG = jToG(today);
  const items: Record<string, unknown>[] = [];

  for (const emp of employees) {
    const name = (emp.name || "").trim();
    const firstName = name.split(/\s+/)[0] || name;

    const birth = parseJalali(emp.birth_date);
    if (birth) {
      const ev = nextAnnualOccurrence(birth, today, todayG);
      if (ev.days <= WINDOW_DAYS) {
        items.push({
          type: "birthday",
          code: emp.code,
          name,
          first_name: firstName,
          days_until: ev.days,
          date_jalali: ev.date_jalali,
          date_gregorian: ev.date_gregorian,
          label: "تولد",
          headline: `تولد ${name}`,
          highlight: ev.days === 0 ? "امروز" : `${ev.days} روز دیگر`,
          message:
            ev.days === 0
              ? `امروز تولد ${firstName} است؛ برایش جشن بگیرید.`
              : `تنها ${ev.days} روز تا آماده‌سازی سورپرایز تولد ${firstName}.`,
          is_today: ev.days === 0,
          accent: "#0ea5e9",
          icon: "fas fa-cake-candles",
        });
      }
    }

    const hire = parseJalali(emp.hire_date);
    if (hire) {
      const ev = nextAnnualOccurrence(hire, today, todayG);
      const years = Math.max(0, ev.year - hire.year);
      if (ev.days <= WINDOW_DAYS && years > 0) {
        items.push({
          type: "anniversary",
          code: emp.code,
          name,
          first_name: firstName,
          days_until: ev.days,
          date_jalali: ev.date_jalali,
          date_gregorian: ev.date_gregorian,
          label: "سالگرد همکاری",
          headline: `سالگرد همکاری ${name}`,
          highlight: ev.days === 0 ? "امروز" : `${ev.days} روز دیگر`,
          message:
            ev.days === 0
              ? `امروز سالگرد ${years} سال همکاری ${firstName} است.`
              : `برای تقدیر از ${years} سال همدلی ${firstName} آماده شوید.`,
          is_today: ev.days === 0,
          years_of_service: years,
          accent: "#ef4444",
          icon: "fas fa-award",
          hire_date_jalali: formatJalali(hire),
        });
      }
    }
  }

  items.sort((a, b) => {
    const da = a.days_until as number;
    const db = b.days_until as number;
    if (da !== db) return da - db;
    const ta = a.type as string;
    const tb = b.type as string;
    if (ta !== tb) return ta.localeCompare(tb);
    return (a.name as string).localeCompare(b.name as string);
  });

  return json({ success: true, celebrations: items.slice(0, MAX_ITEMS) });
};
