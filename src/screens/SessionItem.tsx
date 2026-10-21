import { formatHours } from '../lib/dates';
import type { Job, Occurrence } from '../lib/types';

const STATUS_LABEL = {
  done: 'تمّت ✓',
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
  const kindBadge = occ.source === 'makeup' ? 'تعويض' : occ.source === 'extra' ? 'إضافية' : '';
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
            {showJob && job && ` · ${job.emoji} ${job.name}`}
          </span>
        </span>
        {occ.reason && (
          <span className="reason" style={{ display: 'block' }}>
            {occ.status === 'holiday' ? '🏖️' : '✕'} {occ.reason}
            {occ.note && ` — ${occ.note}`}
          </span>
        )}
      </span>
      {kindBadge && occ.status !== 'cancelled' ? (
        <span className={`badge ${occ.source}`}>{kindBadge}</span>
      ) : (
        <span className={`badge ${occ.status}`}>{STATUS_LABEL[occ.status]}</span>
      )}
    </button>
  );
}
