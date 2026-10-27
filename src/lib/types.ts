import type { DateStr } from './dates';

export interface Slot {
  id: string;
  weekday: number; // JS weekday, 0 = Sunday
  start: string; // 'HH:MM'
  end: string;
  label: string; // class name, e.g. 1ث01
  room: string;
}

/** A schedule that applies from `from` onward, repeating `weeks` in a cycle. */
export interface ScheduleVersion {
  id: string;
  from: DateStr;
  anchor: DateStr; // Monday on which cycle week 1 starts
  weeks: Slot[][];
}

export type JobMode = 'schedule' | 'learning';

export interface Job {
  id: string;
  name: string;
  color: string;
  emoji: string;
  startDate: DateStr;
  rate: number; // per hour, 0 = not set
  mode: JobMode;
  versions: ScheduleVersion[];
  order: number;
  createdAt: number;
}

export type OverrideStatus = 'cancelled' | 'done';

/** A change to one scheduled occurrence (id = `${jobId}__${date}__${slotId}`). */
export interface Override {
  id: string;
  jobId: string;
  date: DateStr;
  slotId: string;
  status: OverrideStatus;
  reason: string;
  note: string;
  updatedAt: number;
}

export type EntryKind = 'regular' | 'makeup' | 'extra';

/** A session added by hand. */
export interface Entry {
  id: string;
  jobId: string;
  date: DateStr;
  start: string;
  end: string;
  kind: EntryKind;
  label: string;
  room: string;
  note: string;
  cancelled: boolean;
  reason: string;
  createdAt: number;
}

/** A holiday / paused counter. `to` empty = still paused. */
export interface Pause {
  id: string;
  from: DateStr;
  to: DateStr | '';
  reason: string;
  jobIds: string[]; // empty = all jobs
  createdAt: number;
}

export interface Settings {
  name: string;
  payStartDay: number;
  yearStartMonth: number;
  salaryEnabled: boolean;
  salaryAsked: boolean;
  currency: string;
  reasons: string[];
  animations: boolean;
  recoverySaved: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  name: 'بثينة',
  payStartDay: 1,
  yearStartMonth: 9,
  salaryEnabled: false,
  salaryAsked: false,
  currency: 'د.ت',
  reasons: ['غياب', 'مرض', 'عطلة', 'إضراب', 'امتحانات', 'اجتماع', 'رحلة مدرسية', 'إلغاء من الإدارة'],
  animations: true,
  recoverySaved: false,
};

export type OccStatus = 'done' | 'upcoming' | 'cancelled' | 'holiday';

/** One concrete session on one date, scheduled or manual. */
export interface Occurrence {
  key: string;
  jobId: string;
  date: DateStr;
  start: string;
  end: string;
  minutes: number;
  label: string;
  room: string;
  source: 'schedule' | EntryKind;
  slotId?: string;
  entryId?: string;
  status: OccStatus;
  reason: string;
  note: string;
}

export const ENTRY_KIND_LABEL: Record<EntryKind, string> = {
  regular: 'حصة',
  makeup: 'تعويض',
  extra: 'ساعة إضافية',
};
