import type { Job, ScheduleVersion, Slot } from '../lib/types';

// Firestore rejects nested arrays, so each week of a cycle is stored as
// { slots: [...] } instead of a bare array.

type StoredVersion = Omit<ScheduleVersion, 'weeks'> & { weeks: { slots: Slot[] }[] };
export type StoredJob = Omit<Job, 'versions'> & { versions: StoredVersion[] };

export function jobToDb(job: Job): StoredJob {
  return { ...job, versions: job.versions.map((v) => ({ ...v, weeks: v.weeks.map((slots) => ({ slots })) })) };
}

export function jobFromDb(data: StoredJob): Job {
  return {
    ...data,
    versions: (data.versions ?? []).map((v) => ({
      ...v,
      weeks: (v.weeks ?? []).map((w) => (Array.isArray(w) ? (w as Slot[]) : (w.slots ?? []))),
    })),
  };
}
