import type { ReactNode } from 'react';

export type MarkKind = 'done' | 'upcoming' | 'cancelled' | 'holiday' | 'makeup' | 'extra';

const PATHS: Record<MarkKind, ReactNode> = {
  done: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cancelled: <path d="M7 7l10 10M17 7L7 17" />,
  upcoming: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  holiday: (
    <>
      <path d="M3 12a9 9 0 0 1 18 0z" />
      <path d="M12 12v7.5" />
    </>
  ),
  makeup: (
    <>
      <path d="M19 12a7 7 0 1 1-2.1-5" />
      <path d="M19 4.5V8h-3.5" />
    </>
  ),
  extra: <path d="M12 6v12M6 12h12" />,
};

/** Small round status symbol, shared by the calendar, lists and legend. */
export function Mark({ kind, className = '' }: { kind: MarkKind; className?: string }) {
  return (
    <span className={`mark ${kind} ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={kind === 'upcoming' ? 2.4 : 3} strokeLinecap="round" strokeLinejoin="round">
        {PATHS[kind]}
      </svg>
    </span>
  );
}
