import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, daysInMonth, eachDay, mondayOf, payPeriodFor, schoolYearFor, weekday,
} from './dates';
import { occurrences, overrideId, totals, type Clock, type Data } from './schedule';
import { learnState, versionFromLearning } from './learn';
import { SCHOOL_JOB } from '../data/seed';
import type { Entry, Job } from './types';
import { jobFromDb, jobToDb } from '../data/codec';
import { greeting } from './greeting';
import { normalizeEmail, passwordVariants, toLatinDigits } from './digits';
import { cleanCode, codeEmail, codeOf, formatCode, isValidCode, newCode } from './recovery';

const clock = (today: string, minutes = 23 * 60): Clock => ({ today, minutes });
const data = (over: Partial<Data> = {}): Data => ({ jobs: [SCHOOL_JOB], overrides: [], entries: [], pauses: [], ...over });

describe('dates', () => {
  it('handles month lengths and leap years', () => {
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths(2026, 12, 1)).toEqual({ y: 2027, m: 1 });
    expect(addMonths(2027, 1, -1)).toEqual({ y: 2026, m: 12 });
  });

  it('knows weekdays across DST changes', () => {
    expect(weekday('2026-10-01')).toBe(4); // Thursday
    expect(weekday('2026-10-25')).toBe(0); // Sunday, EU DST ends
    expect(weekday('2027-03-28')).toBe(0);
    expect(mondayOf('2026-10-04')).toBe('2026-09-28');
    expect(eachDay('2026-10-24', '2026-10-27')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
    expect(eachDay('2026-09-01', '2027-08-31')).toHaveLength(365);
    expect(eachDay('2027-09-01', '2028-08-31')).toHaveLength(366);
  });

  it('computes pay periods', () => {
    expect(payPeriodFor('2026-10-21', 1)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(payPeriodFor('2026-10-21', 20)).toEqual({ from: '2026-10-20', to: '2026-11-19' });
    expect(payPeriodFor('2026-10-05', 20)).toEqual({ from: '2026-09-20', to: '2026-10-19' });
    expect(payPeriodFor('2027-01-10', 15)).toEqual({ from: '2026-12-15', to: '2027-01-14' });
    expect(payPeriodFor('2028-02-29', 1)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(payPeriodFor('2026-03-01', 31)).toEqual({ from: '2026-02-28', to: '2026-03-27' });
  });

  it('computes school years', () => {
    expect(schoolYearFor('2026-10-21', 9)).toEqual({ from: '2026-09-01', to: '2027-08-31' });
    expect(schoolYearFor('2027-03-01', 9)).toEqual({ from: '2026-09-01', to: '2027-08-31' });
    expect(schoolYearFor('2027-09-01', 9)).toEqual({ from: '2027-09-01', to: '2028-08-31' });
  });
});

describe('schedule', () => {
  it('generates the school timetable: 9 hours per week from 1 October', () => {
    const occ = occurrences(data(), { from: '2026-09-01', to: '2026-10-04' }, clock('2026-12-01'));
    // Only Thursday 1 Oct (Mon/Wed of that week are before the start date).
    expect(occ.map((o) => o.date + ' ' + o.start)).toEqual(['2026-10-01 08:00', '2026-10-01 10:00']);
    const week = occurrences(data(), { from: '2026-10-05', to: '2026-10-11' }, clock('2026-12-01'));
    expect(totals(week, [SCHOOL_JOB]).doneMin).toBe(9 * 60);
  });

  it('counts October 2026 correctly', () => {
    const occ = occurrences(data(), { from: '2026-10-01', to: '2026-10-31' }, clock('2026-11-01'));
    // Oct 2026: Mondays 5,12,19,26 (4×2h) Wednesdays 7,14,21,28 (4×3h) Thursdays 1,8,15,22,29 (5×4h)
    expect(totals(occ, [SCHOOL_JOB]).doneMin).toBe((8 + 12 + 20) * 60);
  });

  it('splits done and upcoming around now', () => {
    const occ = occurrences(data(), { from: '2026-10-21', to: '2026-10-21' }, clock('2026-10-21', 15 * 60 + 30));
    expect(occ.map((o) => o.status)).toEqual(['done', 'upcoming']);
  });

  it('applies cancellations and pauses but keeps them visible', () => {
    const d = data({
      overrides: [{
        id: overrideId('school', '2026-10-05', 'mon-1'), jobId: 'school', date: '2026-10-05', slotId: 'mon-1',
        status: 'cancelled', reason: 'مرض', note: '', updatedAt: 0,
      }],
      pauses: [{ id: 'p', from: '2026-10-07', to: '2026-10-08', reason: 'عطلة', jobIds: [], createdAt: 0 }],
    });
    const occ = occurrences(d, { from: '2026-10-05', to: '2026-10-11' }, clock('2026-12-01'));
    expect(occ).toHaveLength(5);
    expect(occ[0]).toMatchObject({ status: 'cancelled', reason: 'مرض' });
    expect(occ.filter((o) => o.status === 'holiday')).toHaveLength(4);
    expect(totals(occ, [SCHOOL_JOB]).doneMin).toBe(0);
  });

  it('treats an open-ended pause as running until resumed', () => {
    const d = data({ pauses: [{ id: 'p', from: '2026-12-20', to: '', reason: 'عطلة', jobIds: [], createdAt: 0 }] });
    const occ = occurrences(d, { from: '2026-12-14', to: '2027-01-31' }, clock('2027-02-01'));
    expect(occ.filter((o) => o.status !== 'holiday').every((o) => o.date < '2026-12-20')).toBe(true);
  });

  it('adds manual entries and counts money per job rate', () => {
    const job: Job = { ...SCHOOL_JOB, rate: 10 };
    const entry: Entry = {
      id: 'x', jobId: 'school', date: '2026-10-10', start: '09:00', end: '10:30', kind: 'makeup',
      label: '1ث01', room: '', note: '', cancelled: false, reason: '', createdAt: 0,
    };
    const occ = occurrences(data({ jobs: [job], entries: [entry] }), { from: '2026-10-05', to: '2026-10-11' }, clock('2026-12-01'));
    const t = totals(occ, [job]);
    expect(t.doneMin).toBe(9 * 60 + 90);
    expect(t.extraMin).toBe(90);
    expect(t.money).toBe(105);
  });

  it('repeats multi-week cycles and respects schedule versions', () => {
    const job: Job = {
      ...SCHOOL_JOB, id: 'j', startDate: '2026-10-05',
      versions: [
        {
          id: 'v1', from: '2026-10-05', anchor: '2026-10-05',
          weeks: [
            [{ id: 'a', weekday: 1, start: '08:00', end: '09:00', label: 'A', room: '' }],
            [{ id: 'b', weekday: 2, start: '08:00', end: '10:00', label: 'B', room: '' }],
            [{ id: 'c', weekday: 3, start: '08:00', end: '11:00', label: 'C', room: '' }],
          ],
        },
        {
          id: 'v2', from: '2026-11-16', anchor: '2026-11-16',
          weeks: [[{ id: 'd', weekday: 5, start: '08:00', end: '12:00', label: 'D', room: '' }]],
        },
      ],
    };
    const occ = occurrences(data({ jobs: [job] }), { from: '2026-10-01', to: '2026-11-29' }, clock('2027-01-01'));
    expect(occ.map((o) => o.label).join('')).toBe('ABCABCDD');
    expect(occ[3].date).toBe('2026-10-26');
  });
});

describe('learning', () => {
  const mk = (date: string, start: string, end: string, label: string): Entry => ({
    id: date + start, jobId: 'L', date, start, end, kind: 'regular', label, room: '', note: '',
    cancelled: false, reason: '', createdAt: 0,
  });
  const job: Job = { ...SCHOOL_JOB, id: 'L', mode: 'learning', startDate: '2026-10-05', versions: [] };

  it('proposes weekly repetition after the first week', () => {
    const s = learnState(job, [mk('2026-10-06', '08:00', '10:00', 'X')], '2026-10-13');
    expect(s.cycle).toBe(1);
    const v = versionFromLearning(job, s);
    expect(v.from).toBe('2026-10-12');
    const occ = occurrences(data({ jobs: [{ ...job, versions: [v] }] }), { from: '2026-10-12', to: '2026-10-25' }, clock('2027-01-01'));
    expect(occ.map((o) => o.date)).toEqual(['2026-10-13', '2026-10-20']);
  });

  it('ignores weeks not filled yet', () => {
    const s = learnState(job, [mk('2026-10-06', '08:00', '10:00', 'X')], '2026-10-21');
    expect(s.cycle).toBe(1);
    // starts after the completed weeks, aligned with the weekly pattern
    expect(versionFromLearning(job, s).from).toBe('2026-10-19');
  });

  it('detects a two-week rotation', () => {
    const entries = [
      mk('2026-10-06', '08:00', '10:00', 'X'),
      mk('2026-10-14', '14:00', '16:00', 'Y'),
      mk('2026-10-20', '08:00', '10:00', 'X'),
      mk('2026-10-28', '14:00', '16:00', 'Y'),
      mk('2026-11-03', '08:00', '10:00', 'X'), // current (unfinished) week already filled
    ];
    const s = learnState(job, entries, '2026-11-04');
    expect(s.cycle).toBe(2);
    expect(s.confirmations).toBe(2);
    const v = versionFromLearning(job, s);
    expect(v.from).toBe('2026-11-09');
    const learned = { ...job, versions: [v] };
    const occ = occurrences(data({ jobs: [learned] }), { from: '2026-11-09', to: '2026-11-22' }, clock('2027-01-01'));
    expect(occ.map((o) => o.date + o.label)).toEqual(['2026-11-11Y', '2026-11-17X']);
  });
});

describe('storage', () => {
  const hasNestedArray = (v: unknown, inArray = false): boolean =>
    Array.isArray(v)
      ? inArray || v.some((x) => hasNestedArray(x, true))
      : v !== null && typeof v === 'object' && Object.values(v).some((x) => hasNestedArray(x, false));

  it('stores jobs without nested arrays (Firestore rejects them) and reads them back', () => {
    expect(hasNestedArray(SCHOOL_JOB)).toBe(true);
    const stored = jobToDb(SCHOOL_JOB);
    expect(hasNestedArray(stored)).toBe(false);
    expect(jobFromDb(stored)).toEqual(SCHOOL_JOB);
  });
});

describe('login input', () => {
  it('accepts Arabic-Indic digits typed on an Arabic keyboard', () => {
    expect(toLatinDigits('بثينة١٢٣٤')).toBe('بثينة1234');
    expect(toLatinDigits('۰۹')).toBe('09');
    expect(passwordVariants('abc١٢٣')).toEqual(['abc١٢٣', 'abc123']);
    expect(passwordVariants('abc123')).toEqual(['abc123', 'abc١٢٣']);
    expect(passwordVariants('abcdef')).toEqual(['abcdef']);
    expect(normalizeEmail('  Bothaina٢٠@Gmail.com ')).toBe('bothaina20@gmail.com');
  });
});

describe('recovery codes', () => {
  it('generates valid, unique codes and reads them back from the account email', () => {
    const codes = new Set(Array.from({ length: 500 }, newCode));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(isValidCode(c)).toBe(true);
    const c = [...codes][0];
    expect(codeOf(codeEmail(c))).toBe(c);
    expect(codeOf('bothaina@gmail.com')).toBeNull();
  });

  it('accepts the code however it is typed', () => {
    expect(formatCode('K7QM4XPT9HWN')).toBe('K7QM-4XPT-9HWN');
    expect(cleanCode(' k7qm-4xpt 9hwn ')).toBe('K7QM4XPT9HWN');
    expect(cleanCode('K٧QM-4XPT-٩HWN')).toBe('K7QM4XPT9HWN');
    expect(isValidCode('K7QM4XPT9HW')).toBe(false);
    expect(isValidCode('K7QM4XPT9HW0')).toBe(false);
  });
});

describe('greeting', () => {
  const g = (hour: number, st: Parameters<typeof greeting>[3], day = '2026-10-27') => greeting('بثينة', day, hour, st);
  it('talks about her sessions when she has some today', () => {
    expect(g(8, ['upcoming', 'upcoming'])).toBe('أمامك حصتان اليوم، بثينة');
    expect(g(8, ['upcoming'])).toBe('أمامك حصة واحدة اليوم، بثينة');
    expect(g(13, ['done', 'upcoming'])).toBe('بثينة، بقيت حصة واحدة');
    expect(g(13, ['done', 'upcoming', 'upcoming', 'upcoming'])).toBe('بثينة، بقيت لكِ 3 حصص');
    expect(g(18, ['done', 'done', 'cancelled'])).toContain('بثينة');
  });
  it('never uses the old fixed phrasing and stays the same all day', () => {
    for (const h of [6, 13, 19, 23]) {
      const line = g(h, []);
      expect(line).toContain('بثينة');
      expect(line).not.toMatch(/يا بثينة|صباح الخير|مساء الخير/);
      expect(g(h, [])).toBe(line);
    }
    expect(g(10, ['holiday', 'holiday'])).toMatch(/عطلة|الأقسام/);
  });
});
