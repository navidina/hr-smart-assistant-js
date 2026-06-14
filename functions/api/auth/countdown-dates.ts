import type { Employee, Env } from "../../../lib/types";
import { json } from "../../../lib/http";
import { getSession } from "../../../lib/session";
import { getEmployeeByCode } from "../../../lib/db";
import {
  addJalaliDays,
  addJalaliMonths,
  calculateTenure,
  compareJ,
  daysBetween,
  formatGregorian,
  formatJalali,
  jalaliDaysInMonth,
  jToG,
  nextAnnualOccurrence,
  parseJalali,
  todayJalali,
  type JDate,
} from "../../../lib/jalali";

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
  const now = new Date();
  const today = todayJalali(now);
  const todayG = jToG(today);

  const countdown: Record<string, unknown> = {
    salary_payout: salaryPayout(today, todayG),
    year_end_bonus: yearEndBonus(today, todayG),
    performance_bonus: performanceBonus(today, todayG),
  };

  if (emp?.birth_date) {
    const ev = nextAnnualOccurrence(parseJalali(emp.birth_date)!, today, todayG);
    if (parseJalali(emp.birth_date)) {
      countdown.birthday = {
        title: "هدیه تولد",
        icon: "fas fa-gift",
        accent: "#0ea5e9",
        scale: 365,
        days: ev.days,
        date_jalali: ev.date_jalali,
        date_gregorian: ev.date_gregorian,
        note: "شارژ بن کارت معادل یک‌سوم حداقل دستمزد ماهیانه وزارت کار",
      };
    }
  }

  if (emp?.hire_date) {
    const hire = parseJalali(emp.hire_date);
    if (hire) {
      const ev = nextAnnualOccurrence(hire, today, todayG);
      countdown.anniversary = {
        title: "هدیه سالگرد عضویت",
        icon: "fas fa-heart",
        accent: "#ef4444",
        scale: 365,
        days: ev.days,
        date_jalali: ev.date_jalali,
        date_gregorian: ev.date_gregorian,
        years_of_service: Math.max(0, ev.year - hire.year),
        note: "شارژ بن کارت معادل سه روز حقوق روزانه",
      };
      countdown.loan_eligibility = loanEligibility(emp.hire_date, hire, todayG);
    }
  }

  return json({ success: true, countdown });
};

function payoutDay(year: number, month: number): number {
  return Math.min(30, jalaliDaysInMonth(year, month));
}

function eventBase(target: JDate, todayG: Date) {
  const g = jToG(target);
  return {
    days: Math.max(0, daysBetween(g, todayG)),
    date_jalali: formatJalali(target),
    date_gregorian: formatGregorian(g),
  };
}

function salaryPayout(today: JDate, todayG: Date) {
  let year = today.year;
  let month = today.month;
  let target: JDate = { year, month, day: payoutDay(year, month) };
  if (today.day > target.day) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    target = { year, month, day: payoutDay(year, month) };
  }
  let pYear = target.year;
  let pMonth = target.month - 1;
  if (pMonth < 1) {
    pMonth = 12;
    pYear -= 1;
  }
  const windowStart: JDate = { year: pYear, month: pMonth, day: payoutDay(pYear, pMonth) };
  return {
    title: "واریز حقوق",
    icon: "fas fa-wallet",
    accent: "#3b82f6",
    scale: 30,
    ...eventBase(target, todayG),
    window_start_jalali: formatJalali(windowStart),
    note: "واریز حقوق ماهانه در روز سی‌ام هر ماه انجام می‌شود",
  };
}

function yearEndBonus(today: JDate, todayG: Date) {
  const year = today.year;
  const target: JDate = { year, month: 12, day: jalaliDaysInMonth(year, 12) };
  return {
    title: "پاداش آخر سال",
    icon: "fas fa-champagne-glasses",
    accent: "#f97316",
    scale: 365,
    ...eventBase(target, todayG),
    fiscal_year: target.year,
    window_start_jalali: formatJalali({ year: target.year, month: 1, day: 1 }),
    note: "پاداش پایان سال و شارژ بن کارت در انتهای سال مالی",
  };
}

function performanceBonus(today: JDate, todayG: Date) {
  const seasonEnds = [3, 6, 9, 12];
  const labels: Record<number, string> = {
    3: "پایان فصل بهار",
    6: "پایان فصل تابستان",
    9: "پایان فصل پاییز",
    12: "پایان فصل زمستان",
  };
  const seasonStarts: Record<number, number> = { 3: 1, 6: 4, 9: 7, 12: 10 };

  let chosen: JDate | null = null;
  let label = "";
  let periodStart: JDate = { year: today.year, month: 1, day: 1 };

  for (let yearOffset = 0; yearOffset < 2 && !chosen; yearOffset++) {
    const year = today.year + yearOffset;
    for (const endMonth of seasonEnds) {
      const endJ: JDate = { year, month: endMonth, day: jalaliDaysInMonth(year, endMonth) };
      const payJ = addJalaliDays(endJ, 31);
      if (daysBetween(jToG(payJ), todayG) >= 0) {
        chosen = payJ;
        label = labels[endMonth];
        periodStart = { year, month: seasonStarts[endMonth], day: 1 };
        break;
      }
    }
  }

  if (!chosen) {
    chosen = { year: today.year + 1, month: 1, day: 28 };
    label = labels[12];
    periodStart = { year: today.year, month: 10, day: 1 };
  }

  return {
    title: "پاداش عملکرد",
    icon: "fas fa-medal",
    accent: "#22c55e",
    scale: 150,
    ...eventBase(chosen, todayG),
    season_label: label,
    period_start_jalali: formatJalali(periodStart),
    note: "بخش متغیر پاداش مبتنی بر عملکرد در پایان دوره فصلی (پرداخت با تاخیر ۳۱ روزه)",
  };
}

function loanEligibility(hireRaw: string, hire: JDate, todayG: Date) {
  const requiredMonths = 18;
  const eligibleJ = addJalaliMonths(hire, requiredMonths);
  const g = jToG(eligibleJ);
  const tenure = calculateTenure(hireRaw);
  const eligible = tenure.tenure_months_total >= requiredMonths;
  return {
    title: "فعال شدن وام سازمانی",
    icon: "fas fa-hand-holding-dollar",
    accent: "#a855f7",
    scale: 365,
    days: eligible ? 0 : Math.max(0, daysBetween(g, todayG)),
    date_jalali: formatJalali(eligibleJ),
    date_gregorian: formatGregorian(g),
    required_months: requiredMonths,
    eligible,
    hire_date_jalali: formatJalali(hire),
    note: "حداقل مدت انتظار برای بهره‌مندی از تسهیلات قرض‌الحسنه سازمان",
  };
}
