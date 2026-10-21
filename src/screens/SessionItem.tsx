import { formatHours } from '../lib/dates';
import type { Job, Occurrence } from '../lib/types';
import { Mark, type MarkKind } from '../components/marks';

const STATUS_LABEL = {
  done: 'تمّت',
  upcoming: 'قادمة',
  cancelled: 'ملغاة',
  holiday: 'عطلة',
};

export function SessionItem({
  occ,
  job,
  onClick,
  showJob,
  showDate,
}: {
  occ: Occurrence;
  job?: Job;
  onClick?: () => void;
  showJob?: boolean;
  showDate?: string;
}) {
  const isExtra = (occ.source === 'makeup' || occ.source === 'extra') && occ.status !== 'cancelled' && occ.status !== 'holiday';
  const kind: MarkKind = isExtra ? (occ.source as MarkKind) : occ.status;
  const label = isExtra ? (occ.source === 'makeup' ? 'تعويض' : 'إضافية') : STATUS_LABEL[occ.status];
  return (
    <button
      className={`session is-${occ.status}`}
      style={{ ['--c' as string]: job?.color }}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="bar" />
      <span className="main">
        <span className="time">
          {occ.start} – {occ.end}
        </span>
        <span className="what" style={{ display: 'block' }}>
          <span>
            {showDate && `${showDate} · `}
            {occ.label || job?.name}
            {occ.room && ` · قاعة ${occ.room}`}
          </span>
          <span>
            {' · '}
            {formatHours(occ.minutes)}
            {showJob && job && ` · ${job.name}`}
          </span>
        </span>
        {occ.reason && (
          <span className="reason" style={{ display: 'block' }}>
            {occ.reason}
            {occ.note && ` — ${occ.note}`}
          </span>
        )}
      </span>
      <span className={`badge ${kind}`}>
        <Mark kind={kind} />
        {label}
      </span>
    </button>
  );
}
