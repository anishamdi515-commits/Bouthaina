import { diffDays, eachDay, maxDate, mondayOf, timeToMin, weekday, type DateStr, type Range } from './dates';
import type { Entry, Job, Occurrence, OccStatus, Override, Pause, ScheduleVersion, Slot } from './types';

export function overrideId(jobId: string, date: DateStr, slotId: string): string {
  return `${jobId}__${date}__${slotId}`;
}

export function versionFor(job: Job, date: DateStr): ScheduleVersion | undefined {
  let found: ScheduleVersion | undefined;
  for (const v of job.versions) {
    if (v.from <= date && (!found || v.from >= found.from)) found = v;
  }
  return found;
}

/** Index of the cycle week that `date` falls in (0-based). */
export function cycleWeekIndex(v: ScheduleVersion, date: DateStr): number {
  const n = v.weeks.length;
  if (n <= 1) return 0;
  const weeks = Math.floor(diffDays(mondayOf(date), mondayOf(v.anchor)) / 7);
  return ((weeks % n) + n) % n;
}

export function slotsOn(job: Job, date: DateStr): Slot[] {
  if (date < job.startDate) return [];
  const v = versionFor(job, date);
  if (!v || v.weeks.length === 0) return [];
  const wd = weekday(date);
  return v.weeks[cycleWeekIndex(v, date)].filter((s) => s.weekday === wd);
}

export function pauseFor(pauses: Pause[], jobId: string, date: DateStr): Pause | undefined {
  return pauses.find(
    (p) =>
      p.from <= date &&
      (!p.to || date <= p.to) &&
      (p.jobIds.length === 0 || p.jobIds.includes(jobId)),
  );
}

export interface Clock {
  today: DateStr;
  minutes: number; // minutes since midnight now
}

function timeStatus(date: DateStr, end: string, clock: Clock): OccStatus {
  if (date < clock.today) return 'done';
  if (date > clock.today) return 'upcoming';
  return clock.minutes >= timeToMin(end) ? 'done' : 'upcoming';
}

export interface Data {
  jobs: Job[];
  overrides: Override[];
  entries: Entry[];
  pauses: Pause[];
}

/** Every session of the given jobs within `range`, sorted by date and time. */
export function occurrences(data: Data, range: Range, clock: Clock, jobIds?: string[]): Occurrence[] {
  const jobs = data.jobs.filter((j) => !jobIds || jobIds.includes(j.id));
  const ovMap = new Map(data.overrides.map((o) => [o.id, o]));
  const out: Occurrence[] = [];

  for (const job of jobs) {
    const from = maxDate(range.from, job.startDate);
    if (from > range.to) continue;
    for (const date of eachDay(from, range.to)) {
      for (const slot of slotsOn(job, date)) {
        const ov = ovMap.get(overrideId(job.id, date, slot.id));
        const pause = pauseFor(data.pauses, job.id, date);
        let status: OccStatus;
        let reason = '';
        if (ov?.status === 'cancelled') {
          status = 'cancelled';
          reason = ov.reason;
        } else if (pause && ov?.status !== 'done') {
          status = 'holiday';
          reason = pause.reason;
        } else {
          status = timeStatus(date, slot.end, clock);
        }
        out.push({
          key: overrideId(job.id, date, slot.id),
          jobId: job.id,
          date,
          start: slot.start,
          end: slot.end,
          minutes: timeToMin(slot.end) - timeToMin(slot.start),
          label: slot.label,
          room: slot.room,
          source: 'schedule',
          slotId: slot.id,
          status,
          reason,
          note: ov?.note ?? '',
        });
      }
    }
  }

  const jobSet = new Set(jobs.map((j) => j.id));
  for (const e of data.entries) {
    if (!jobSet.has(e.jobId) || e.date < range.from || e.date > range.to) continue;
    out.push({
      key: 'e_' + e.id,
      jobId: e.jobId,
      date: e.date,
      start: e.start,
      end: e.end,
      minutes: timeToMin(e.end) - timeToMin(e.start),
      label: e.label,
      room: e.room,
      source: e.kind,
      entryId: e.id,
      status: e.cancelled ? 'cancelled' : timeStatus(e.date, e.end, clock),
      reason: e.cancelled ? e.reason : '',
      note: e.note,
    });
  }

  out.sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)));
  return out;
}

export interface Totals {
  doneMin: number;
  upcomingMin: number;
  extraMin: number; // done makeup + extra hours (included in doneMin)
  cancelled: number;
  holiday: number;
  doneCount: number;
  money: number;
}

export function totals(occs: Occurrence[], jobs: Job[]): Totals {
  const rate = new Map(jobs.map((j) => [j.id, j.rate || 0]));
  const t: Totals = { doneMin: 0, upcomingMin: 0, extraMin: 0, cancelled: 0, holiday: 0, doneCount: 0, money: 0 };
  for (const o of occs) {
    if (o.status === 'done') {
      t.doneMin += o.minutes;
      t.doneCount++;
      t.money += (o.minutes / 60) * (rate.get(o.jobId) ?? 0);
      if (o.source === 'makeup' || o.source === 'extra') t.extraMin += o.minutes;
    } else if (o.status === 'upcoming') t.upcomingMin += o.minutes;
    else if (o.status === 'cancelled') t.cancelled++;
    else t.holiday++;
  }
  return t;
}
