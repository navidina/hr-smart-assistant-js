// Jalali (Persian) calendar utilities ported from the original Python backend.
// All Gregorian dates are handled in UTC to avoid timezone drift.

const JALALI_MONTH_LENGTHS = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

export interface JDate {
  year: number;
  month: number;
  day: number;
}

export function jalaliIsLeap(year: number): boolean {
  const cycle = year - (year >= 0 ? 474 : 473);
  const mod = (cycle % 2820) + 474;
  return ((mod * 682) % 2816) < 682;
}

export function jalaliDaysInMonth(year: number, month: number): number {
  if (month === 12) return jalaliIsLeap(year) ? 30 : 29;
  if (month >= 1 && month <= 6) return 31;
  if (month >= 7 && month <= 11) return 30;
  throw new Error(`invalid jalali month: ${month}`);
}

export function jalaliToGregorian(year: number, month: number, day: number): Date {
  const jy = year - 979;
  const jm = month - 1;
  const jd = day - 1;

  let jDayNo = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4);
  for (let i = 0; i < jm; i++) jDayNo += JALALI_MONTH_LENGTHS[i];
  jDayNo += jd;

  let gDayNo = jDayNo + 79;
  let gy = 1600 + 400 * Math.floor(gDayNo / 146097);
  gDayNo %= 146097;

  let leap = true;
  if (gDayNo >= 36525) {
    gDayNo -= 1;
    gy += 100 * Math.floor(gDayNo / 36524);
    gDayNo %= 36524;
    if (gDayNo >= 365) gDayNo += 1;
    else leap = false;
  }

  gy += 4 * Math.floor(gDayNo / 1461);
  gDayNo %= 1461;

  if (gDayNo >= 366) {
    leap = false;
    gDayNo -= 1;
    gy += Math.floor(gDayNo / 365);
    gDayNo %= 365;
  }

  let gd = gDayNo + 1;
  const gMonthLengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 12 && gd > gMonthLengths[gm]) {
    gd -= gMonthLengths[gm];
    gm += 1;
  }
  return new Date(Date.UTC(gy, gm, gd));
}

export function gregorianToJalali(gYear: number, gMonth: number, gDay: number): JDate {
  const gy = gYear - 1600;
  const gm = gMonth - 1;
  const gd = gDay - 1;

  let gDayNo =
    365 * gy +
    Math.floor((gy + 3) / 4) -
    Math.floor((gy + 99) / 100) +
    Math.floor((gy + 399) / 400);
  const gMonthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let i = 0; i < gm; i++) gDayNo += gMonthLengths[i];
  if (gm > 1) {
    const isLeap =
      (gy + 1600) % 4 === 0 && ((gy + 1600) % 100 !== 0 || (gy + 1600) % 400 === 0);
    if (isLeap) gDayNo += 1;
  }
  gDayNo += gd;

  let jDayNo = gDayNo - 79;
  const jNp = Math.floor(jDayNo / 12053);
  jDayNo %= 12053;

  let jy = 979 + 33 * jNp + 4 * Math.floor(jDayNo / 1461);
  jDayNo %= 1461;

  if (jDayNo >= 366) {
    jy += Math.floor((jDayNo - 1) / 365);
    jDayNo = (jDayNo - 1) % 365;
  }

  let jm = 0;
  while (jm < 11 && jDayNo >= JALALI_MONTH_LENGTHS[jm]) {
    jDayNo -= JALALI_MONTH_LENGTHS[jm];
    jm += 1;
  }
  return { year: jy, month: jm + 1, day: jDayNo + 1 };
}

export function todayJalali(now: Date = new Date()): JDate {
  return gregorianToJalali(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}

export function jToG(j: JDate): Date {
  return jalaliToGregorian(j.year, j.month, j.day);
}

export function daysBetween(target: Date, base: Date): number {
  const MS = 86400000;
  const t = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const b = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
  return Math.round((t - b) / MS);
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

export function formatJalali(j: JDate): string {
  return `${pad(j.year, 4)}/${pad(j.month, 2)}/${pad(j.day, 2)}`;
}

export function formatGregorian(d: Date): string {
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}

export function compareJ(a: JDate, b: JDate): number {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1;
  if (a.month !== b.month) return a.month < b.month ? -1 : 1;
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  return 0;
}

export function addJalaliMonths(base: JDate, months: number): JDate {
  let year = base.year;
  let month = base.month + months;
  const day = base.day;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month <= 0) {
    month += 12;
    year -= 1;
  }
  const maxDay = jalaliDaysInMonth(year, month);
  return { year, month, day: Math.min(day, maxDay) };
}

export function addJalaliDays(base: JDate, days: number): JDate {
  const g = jToG(base);
  const shifted = new Date(g.getTime() + days * 86400000);
  return gregorianToJalali(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

export function parseJalali(value?: string | null): JDate | null {
  if (!value) return null;
  let clean = String(value).trim();
  if (!clean) return null;
  for (const alt of ["﹨", "∕", "／", "⁄"]) clean = clean.split(alt).join("/");
  clean = clean.replace(/[-.\\ ]/g, "/");
  const persianMap: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  };
  clean = clean.replace(/[۰-۹]/g, (d) => persianMap[d] ?? d);

  const parts = clean.split("/").filter(Boolean);
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!year || !month || !day || month < 1 || month > 12) return null;
  const clampedDay = Math.max(1, Math.min(day, jalaliDaysInMonth(year, month)));
  return { year, month, day: clampedDay };
}

export interface TenureMetadata {
  tenure_years: number;
  tenure_months_total: number;
  tenure_months_remainder: number;
}

export function calculateTenure(
  hireDate?: string | null,
  now: Date = new Date(),
): TenureMetadata {
  const result: TenureMetadata = {
    tenure_years: 0,
    tenure_months_total: 0,
    tenure_months_remainder: 0,
  };
  const hireJ = parseJalali(hireDate);
  if (!hireJ) return result;
  const todayJ = todayJalali(now);
  let total = (todayJ.year - hireJ.year) * 12 + (todayJ.month - hireJ.month);
  if (todayJ.day < hireJ.day) total -= 1;
  total = Math.max(0, total);
  return {
    tenure_years: Math.floor(total / 12),
    tenure_months_total: total,
    tenure_months_remainder: total % 12,
  };
}

/** Next annual recurrence (this year or next) of the given Jalali date's month/day. */
export function nextAnnualOccurrence(
  source: JDate,
  today: JDate,
  todayG: Date,
): { days: number; date_jalali: string; date_gregorian: string; year: number } {
  let year = today.year;
  let day = Math.min(source.day, jalaliDaysInMonth(year, source.month));
  let target: JDate = { year, month: source.month, day };
  if (compareJ(target, today) < 0) {
    year = today.year + 1;
    day = Math.min(source.day, jalaliDaysInMonth(year, source.month));
    target = { year, month: source.month, day };
  }
  const g = jToG(target);
  return {
    days: Math.max(0, daysBetween(g, todayG)),
    date_jalali: formatJalali(target),
    date_gregorian: formatGregorian(g),
    year: target.year,
  };
}
