import type { OccStatus } from './types';

// The header line changes with her day instead of a fixed "good morning".
// One line is picked per day and situation, so it stays put between refreshes.

const POOLS = {
  morning: ['قهوة أولاً، {n}', 'صباح هادئ لكِ، {n}', '{n}، يومك يبدأ بخفّة', 'صباحك أخفّ من الأمس، {n}'],
  afternoon: ['{n}، نصف اليوم خلفك', 'استراحة مستحقّة، {n}', 'ظهيرة هادئة، {n}'],
  evening: ['انتهى الضجيج، {n}', '{n}، المساء لكِ وحدك', 'مساء خفيف، {n}'],
  night: ['الدفاتر نائمة، {n}', '{n}، غداً صفحة جديدة', 'ليل هادئ، {n}'],
  dayOff: ['يوم بلا حصص، {n}', '{n}، اليوم لكِ', 'لا جرس اليوم، {n}'],
  done: ['أنهيتِ حصص اليوم، {n}', 'يوم مُنجز، {n}', '{n}، اليوم تمّ على أكمل وجه'],
  holiday: ['عطلة سعيدة، {n}', '{n}، استمتعي بالعطلة', 'الأقسام فارغة اليوم، {n}'],
};

function sessions(count: number): string {
  if (count === 1) return 'حصة واحدة';
  if (count === 2) return 'حصتان';
  if (count <= 10) return `${count} حصص`;
  return `${count} حصة`;
}

function pick(pool: string[], seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

export function greeting(name: string, today: string, hour: number, statuses: OccStatus[]): string {
  const left = statuses.filter((s) => s === 'upcoming').length;
  const done = statuses.filter((s) => s === 'done').length;
  const fill = (line: string) => line.replace('{n}', name);

  if (left > 0) {
    return done > 0 ? `${name}، ${left === 1 ? 'بقيت' : 'بقيت لكِ'} ${sessions(left)}` : `أمامك ${sessions(left)} اليوم، ${name}`;
  }
  if (done > 0) return fill(pick(POOLS.done, today));
  if (statuses.length > 0 && statuses.every((s) => s === 'holiday')) return fill(pick(POOLS.holiday, today));

  const part = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 22 ? 'evening' : 'night';
  // On a day without sessions, mix in the "day off" lines during daytime.
  const pool = part === 'morning' || part === 'afternoon' ? [...POOLS[part], ...POOLS.dayOff] : POOLS[part];
  return fill(pick(pool, today + part));
}
