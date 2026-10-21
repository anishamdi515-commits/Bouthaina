import { addDays, diffDays, mondayOf, weekday, type DateStr } from './dates';
import type { Entry, Job, ScheduleVersion, Slot } from './types';
import { uid } from './uid';

// "Learning" jobs: she fills sessions by hand week after week, and once the
// weeks start repeating we offer to turn them into an automatic cycle.

export interface LearnState {
  weekStarts: DateStr[]; // Monday of every completed week since startDate
  weeks: Entry[][]; // regular entries of each completed week
  filledWeeks: number; // weeks (completed or not) up to the last one with an entry
  cycle: number; // proposed cycle length in weeks (0 = nothing to propose yet)
  confirmations: number; // how many weeks already matched the proposed cycle
}

function signature(entries: Entry[]): string {
  return entries
    .map((e) => `${weekday(e.date)}|${e.start}|${e.end}|${e.label.trim()}|${e.room.trim()}`)
    .sort()
    .join(';');
}

export function learnState(job: Job, entries: Entry[], today: DateStr): LearnState {
  const first = mondayOf(job.startDate);
  const regular = entries.filter((e) => e.jobId === job.id && e.kind === 'regular' && e.date >= first);
  const completed = Math.max(0, Math.floor(diffDays(mondayOf(today), first) / 7));

  const weeks: Entry[][] = [];
  const weekStarts: DateStr[] = [];
  for (let i = 0; i < completed; i++) {
    const start = addDays(first, i * 7);
    const end = addDays(start, 6);
    weekStarts.push(start);
    weeks.push(regular.filter((e) => e.date >= start && e.date <= end));
  }

  let filledWeeks = 0;
  for (const e of regular) {
    filledWeeks = Math.max(filledWeeks, Math.floor(diffDays(e.date, first) / 7) + 1);
  }

  let cycle = 0;
  let confirmations = 0;
  // Weeks left empty at the end (not filled yet) say nothing about the cycle.
  let known = weeks.length;
  while (known > 0 && weeks[known - 1].length === 0) known--;
  if (known > 0 && weeks[0].length > 0) {
    const sigs = weeks.slice(0, known).map(signature);
    for (let p = 1; p <= sigs.length; p++) {
      let ok = true;
      for (let i = p; i < sigs.length && ok; i++) ok = sigs[i] === sigs[i - p];
      if (ok) {
        cycle = p;
        confirmations = sigs.length - p;
        break;
      }
    }
  }

  return { weekStarts, weeks, filledWeeks, cycle, confirmations };
}

/** Builds the repeating schedule from the first `cycle` learned weeks. */
export function versionFromLearning(job: Job, state: LearnState): ScheduleVersion {
  const anchor = mondayOf(job.startDate);
  const weeks: Slot[][] = [];
  for (let i = 0; i < state.cycle; i++) {
    weeks.push(
      state.weeks[i].map((e) => ({
        id: uid(),
        weekday: weekday(e.date),
        start: e.start,
        end: e.end,
        label: e.label,
        room: e.room,
      })),
    );
  }
  // Start right after the last week she filled by hand so nothing is doubled.
  const startWeek = Math.max(state.weekStarts.length, state.filledWeeks);
  return { id: uid(), from: addDays(anchor, startWeek * 7), anchor, weeks };
}
