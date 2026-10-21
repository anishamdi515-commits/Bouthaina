// All calendar dates are plain 'YYYY-MM-DD' strings. Arithmetic is done in UTC
// so daylight-saving changes and time zones can never shift a day.

export type DateStr = string;

export const MONTHS = [
  'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
  'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// Index = JS weekday (0 = Sunday).
export const WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const WEEKDAYS_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

// Display order: Monday first.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function makeDate(year: number, month: number, day: number): DateStr {
  // month is 1-12; Date.UTC normalises overflow (e.g. day 32).
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function parts(date: DateStr): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

function toUTC(date: DateStr): number {
  const { y, m, d } = parts(date);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): DateStr {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: DateStr, n: number): DateStr {
  return fromUTC(toUTC(date) + n * DAY_MS);
}

export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((toUTC(a) - toUTC(b)) / DAY_MS);
}

export function weekday(date: DateStr): number {
  return new Date(toUTC(date)).getUTCDay();
}

export function mondayOf(date: DateStr): DateStr {
  const wd = weekday(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonths(year: number, month: number, n: number): { y: number; m: number } {
  const idx = year * 12 + (month - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function monthStart(year: number, month: number): DateStr {
  return makeDate(year, month, 1);
}

export function monthEnd(year: number, month: number): DateStr {
  return makeDate(year, month, daysInMonth(year, month));
}

/** Each date from `from` to `to`, inclusive. */
export function eachDay(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function todayStr(now: Date = new Date()): DateStr {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function nowMinutes(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function minDate(a: DateStr, b: DateStr): DateStr {
  return a < b ? a : b;
}

export function maxDate(a: DateStr, b: DateStr): DateStr {
  return a > b ? a : b;
}

export interface Range {
  from: DateStr;
  to: DateStr;
}

/**
 * Pay period containing `date`. startDay 1 = calendar month; otherwise the
 * period runs from `startDay` of one month to `startDay - 1` of the next.
 * startDay is clamped to 1..28 so it exists in every month.
 */
export function payPeriodFor(date: DateStr, startDay: number): Range {
  const sd = Math.min(28, Math.max(1, Math.floor(startDay) || 1));
  const { y, m, d } = parts(date);
  if (sd === 1) return { from: monthStart(y, m), to: monthEnd(y, m) };
  const startMonth = d >= sd ? { y, m } : addMonths(y, m, -1);
  const next = addMonths(startMonth.y, startMonth.m, 1);
  return {
    from: makeDate(startMonth.y, startMonth.m, sd),
    to: makeDate(next.y, next.m, sd - 1),
  };
}

/** School year containing `date`, starting on the 1st of `startMonth`. */
export function schoolYearFor(date: DateStr, startMonth: number): Range {
  const { y, m } = parts(date);
  const startY = m >= startMonth ? y : y - 1;
  const end = addMonths(startY, startMonth, 11);
  return { from: monthStart(startY, startMonth), to: monthEnd(end.y, end.m) };
}

export function formatDate(date: DateStr, withWeekday = false): string {
  const { y, m, d } = parts(date);
  const base = `${d} ${MONTHS[m - 1]} ${y}`;
  return withWeekday ? `${WEEKDAYS[weekday(date)]} ${base}` : base;
}

export function formatDateShort(date: DateStr): string {
  const { m, d } = parts(date);
  return `${d} ${MONTHS[m - 1]}`;
}

export function formatRange(r: Range): string {
  const a = parts(r.from);
  const b = parts(r.to);
  if (a.y === b.y && a.m === b.m && a.d === 1 && b.d === daysInMonth(b.y, b.m)) {
    return `${MONTHS[a.m - 1]} ${a.y}`;
  }
  if (a.y === b.y) return `${formatDateShort(r.from)} ← ${formatDateShort(r.to)} ${a.y}`;
  return `${formatDate(r.from)} ← ${formatDate(r.to)}`;
}

export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0 && m === 0) return '0 س';
  if (m === 0) return `${h} س`;
  if (h === 0) return `${m} د`;
  return `${h} س ${m} د`;
}

export function hoursNumber(minutes: number): string {
  const v = minutes / 60;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
