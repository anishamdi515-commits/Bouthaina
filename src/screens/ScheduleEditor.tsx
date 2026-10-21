import { useState } from 'react';
import { useStore } from '../data/store';
import { formatDate, formatHours, mondayOf, timeToMin, WEEK_ORDER, WEEKDAYS, type DateStr } from '../lib/dates';
import { cycleWeekIndex } from '../lib/schedule';
import type { ScheduleVersion, Slot } from '../lib/types';
import { uid } from '../lib/uid';
import { goBack, PageHead, Sheet, toast } from '../components/ui';

export function ScheduleEditor({ jobId, versionId, draft }: { jobId: string; versionId?: string; draft?: ScheduleVersion }) {
  const store = useStore();
  const job = store.jobs.find((j) => j.id === jobId);
  const original = draft ?? job?.versions.find((v) => v.id === versionId);
  const [v, setV] = useState<ScheduleVersion | undefined>(original);
  const [week, setWeek] = useState(0);
  const [slot, setSlot] = useState<{ slot?: Slot } | null>(null);

  if (!job || !v) {
    return (
      <>
        <PageHead title="الجدول" />
        <div className="card empty">جاري التحميل…</div>
      </>
    );
  }

  const isNew = !job.versions.some((x) => x.id === v.id);
  const labels = [...new Set(job.versions.concat(v).flatMap((x) => x.weeks.flatMap((w) => w.map((s) => s.label))).filter(Boolean))];
  const w = Math.min(week, v.weeks.length - 1);
  const slots = v.weeks[w];
  const weekMin = slots.reduce((s, x) => s + timeToMin(x.end) - timeToMin(x.start), 0);
  const currentWeek = v.weeks.length > 1 ? cycleWeekIndex(v, store.clock.today) : 0;

  const setWeekSlots = (next: Slot[]) => setV({ ...v, weeks: v.weeks.map((x, i) => (i === w ? next : x)) });

  const saveSlot = (s: Slot) => {
    const exists = slots.some((x) => x.id === s.id);
    setWeekSlots(exists ? slots.map((x) => (x.id === s.id ? s : x)) : [...slots, s]);
  };

  const addWeek = () => {
    setV({ ...v, weeks: [...v.weeks, []] });
    setWeek(v.weeks.length);
  };

  const copyWeek = () => {
    setV({ ...v, weeks: [...v.weeks, slots.map((s) => ({ ...s, id: uid() }))] });
    setWeek(v.weeks.length);
  };

  const removeWeek = () => {
    if (v.weeks.length <= 1 || !confirm(`حذف الأسبوع ${w + 1} من الدورة؟`)) return;
    setV({ ...v, weeks: v.weeks.filter((_, i) => i !== w) });
    setWeek(Math.max(0, w - 1));
  };

  const save = () => {
    const others = job.versions.filter((x) => x.id !== v.id && x.from !== v.from);
    store.saveJob({ ...job, mode: 'schedule', versions: [...others, v].sort((a, b) => a.from.localeCompare(b.from)) });
    toast('تم حفظ الجدول 🌸');
    goBack();
  };

  const removeVersion = () => {
    if (!confirm('حذف هذا الجدول؟ ستعود الفترة إلى الجدول السابق.')) return;
    store.saveJob({ ...job, versions: job.versions.filter((x) => x.id !== v.id) });
    goBack();
  };

  return (
    <>
      <PageHead title={`جدول ${job.name}`} />

      <div className="card">
        <label className="field">
          <span>يُطبَّق ابتداءً من</span>
          <input
            className="input"
            type="date"
            value={v.from}
            onChange={(e) => e.target.value && setV({ ...v, from: e.target.value })}
          />
        </label>
        {!isNew && (
          <p className="muted small" style={{ marginTop: -6 }}>
            التعديل هنا يشمل كل الأيام منذ {formatDate(v.from)}. لتغيير الجدول من اليوم فقط، استعملي «تغيير الجدول ابتداءً من تاريخ».
          </p>
        )}

        {v.weeks.length > 1 && (
          <label className="field">
            <span>الأسبوع 1 من الدورة يبدأ يوم الإثنين</span>
            <input
              className="input"
              type="date"
              value={v.anchor}
              onChange={(e) => e.target.value && setV({ ...v, anchor: mondayOf(e.target.value as DateStr) })}
            />
            <span className="muted small">هذا الأسبوع هو «الأسبوع {currentWeek + 1}» من الدورة</span>
          </label>
        )}
      </div>

      <div className="tabs">
        {v.weeks.map((_, i) => (
          <button key={i} className={'tab' + (i === w ? ' on' : '')} onClick={() => setWeek(i)}>
            الأسبوع {i + 1}
            {v.weeks.length > 1 && i === currentWeek && ' •'}
          </button>
        ))}
        <button className="tab" onClick={addWeek}>
          + أسبوع
        </button>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>{v.weeks.length > 1 ? `الأسبوع ${w + 1}` : 'كل أسبوع'}</h2>
          <span className="hint">{formatHours(weekMin)}</span>
        </div>
        {v.weeks.length === 1 && (
          <p className="muted small" style={{ marginTop: -6 }}>
            إذا كان عملك يتغيّر من أسبوع لآخر، أضيفي «+ أسبوع» لتكوين دورة تتكرر.
          </p>
        )}

        {slots.length === 0 && <div className="empty">لا حصص بعد في هذا الأسبوع</div>}
        {WEEK_ORDER.map((wd) => {
          const daySlots = slots.filter((s) => s.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
          if (daySlots.length === 0) return null;
          return (
            <div key={wd} className="day-block">
              <h3>{WEEKDAYS[wd]}</h3>
              <div className="sessions">
                {daySlots.map((s) => (
                  <button key={s.id} className="session" style={{ ['--c' as string]: job.color }} onClick={() => setSlot({ slot: s })}>
                    <span className="bar" />
                    <span className="main">
                      <span className="time">
                        {s.start} – {s.end}
                      </span>
                      <span className="what" style={{ display: 'block' }}>
                        {s.label || '—'}
                        {s.room && ` · قاعة ${s.room}`} · {formatHours(timeToMin(s.end) - timeToMin(s.start))}
                      </span>
                    </span>
                    <span className="muted">✎</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <button className="btn soft block" onClick={() => setSlot({})}>
          + إضافة حصة
        </button>
        {v.weeks.length > 1 && (
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn ghost sm" onClick={copyWeek}>
              نسخ كأسبوع جديد
            </button>
            <button className="btn ghost sm" onClick={removeWeek}>
              حذف هذا الأسبوع
            </button>
          </div>
        )}
        {v.weeks.length === 1 && slots.length > 0 && (
          <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={copyWeek}>
            نسخه كأسبوع 2 (دورة أسبوعين)
          </button>
        )}
      </div>

      <button className="btn block" onClick={save}>
        حفظ الجدول
      </button>
      {!isNew && job.versions.length > 1 && (
        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={removeVersion}>
          حذف هذا الجدول
        </button>
      )}

      {slot && (
        <SlotSheet
          slot={slot.slot}
          labels={labels}
          onSave={saveSlot}
          onDelete={(id) => setWeekSlots(slots.filter((x) => x.id !== id))}
          onClose={() => setSlot(null)}
        />
      )}
    </>
  );
}

function SlotSheet({
  slot,
  labels,
  onSave,
  onDelete,
  onClose,
}: {
  slot?: Slot;
  labels: string[];
  onSave: (s: Slot) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<Slot>(
    () => slot ?? { id: uid(), weekday: 1, start: '08:00', end: '10:00', label: labels[0] ?? '', room: '' },
  );
  const set = (patch: Partial<Slot>) => setF((x) => ({ ...x, ...patch }));
  const minutes = timeToMin(f.end) - timeToMin(f.start);

  return (
    <Sheet onClose={onClose}>
      <h2>{slot ? 'تعديل الحصة' : 'حصة جديدة'}</h2>
      <div className="sheet-sub">تتكرر في هذا اليوم من كل أسبوع (في هذا الأسبوع من الدورة)</div>
      <div className="field">
        <span>اليوم</span>
        <div className="pills">
          {WEEK_ORDER.map((wd) => (
            <button key={wd} className={'pill' + (f.weekday === wd ? ' on' : '')} onClick={() => set({ weekday: wd })}>
              {WEEKDAYS[wd]}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <label className="field">
          <span>من</span>
          <input className="input" type="time" value={f.start} onChange={(e) => set({ start: e.target.value })} />
        </label>
        <label className="field">
          <span>إلى</span>
          <input className="input" type="time" value={f.end} onChange={(e) => set({ end: e.target.value })} />
        </label>
      </div>
      {minutes <= 0 && <div className="error">وقت النهاية يجب أن يكون بعد وقت البداية</div>}
      <label className="field">
        <span>القسم</span>
        <input className="input" value={f.label} onChange={(e) => set({ label: e.target.value })} placeholder="مثال: 1ث01" />
        {labels.length > 0 && (
          <div className="pills">
            {labels.map((l) => (
              <button key={l} className={'pill' + (f.label === l ? ' on' : '')} onClick={() => set({ label: l })}>
                {l}
              </button>
            ))}
          </div>
        )}
      </label>
      <label className="field">
        <span>القاعة</span>
        <input className="input" value={f.room} onChange={(e) => set({ room: e.target.value })} />
      </label>
      <div className="sheet-actions">
        {slot ? (
          <button
            className="btn ghost"
            onClick={() => {
              onDelete(slot.id);
              goBack();
            }}
          >
            حذف
          </button>
        ) : (
          <button className="btn ghost" onClick={goBack}>
            إلغاء
          </button>
        )}
        <button
          className="btn"
          disabled={minutes <= 0}
          onClick={() => {
            onSave({ ...f, label: f.label.trim(), room: f.room.trim() });
            goBack();
          }}
        >
          حفظ
        </button>
      </div>
    </Sheet>
  );
}
