import type { Job } from '../lib/types';

// Bothaina's timetable from the school sheet (counting starts 1 October 2026).
export const SCHOOL_JOB: Job = {
  id: 'school',
  name: 'المدرسة',
  color: '#e88aa8',
  emoji: '🏫',
  startDate: '2026-10-01',
  rate: 0,
  mode: 'schedule',
  order: 0,
  createdAt: 0,
  versions: [
    {
      id: 'school-v1',
      from: '2026-10-01',
      anchor: '2026-09-28',
      weeks: [
        [
          { id: 'mon-1', weekday: 1, start: '10:00', end: '12:00', label: '1ث01', room: '06' },
          { id: 'wed-1', weekday: 3, start: '14:00', end: '15:00', label: '1ث01', room: '07' },
          { id: 'wed-2', weekday: 3, start: '15:00', end: '17:00', label: '2إق03', room: '07' },
          { id: 'thu-1', weekday: 4, start: '08:00', end: '10:00', label: '1ث01', room: '02' },
          { id: 'thu-2', weekday: 4, start: '10:00', end: '12:00', label: '2إق03', room: '06' },
        ],
      ],
    },
  ],
};
