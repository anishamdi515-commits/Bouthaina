import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { formatDate, formatHours, timeToMin, type DateStr } from '../lib/dates';
import { overrideId } from '../lib/schedule';
import { ENTRY_KIND_LABEL, type Entry, type EntryKind, type Job, type Occurrence, type Pause } from '../lib/types';
import { uid } from '../lib/uid';
import { goBack, Sheet, Switch, toast } from '../components/ui';
import { SessionItem } from './SessionItem';

// ---------------------------------------------------------------- one session

export function OccurrenceSheet({ occ, onClose }: { occ: Occurrence; onClose: () => void }) {
  const store = useStore();
  const job = store.jobs.find((j) => j.id === occ.jobId);
  const entry = occ.entryId ? store.entries.find((e) => e.id === occ.entryId) : undefined;
  const [mode, setMode] = useState<'view' | 'cancel' | 'edit'>('view');
  const [reason, setReason] = useState(store.settings.reasons[0] ?? '');
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState(occ.note);

  if (mode === 'edit' && entry) return <EntrySheet entry={entry} onClose={onClose} />;

  const finalReason = custom.trim() || reason;

  const cancel = () => {
    if (!finalReason) return;
    if (entry) {
      store.saveEntry({ ...entry, cancelled: true, reason: finalReason, note: note.trim() });
    } else {
      store.saveOverride({
        id: overrideId(occ.jobId, occ.date, occ.slotId!),
        jobId: occ.jobId,
        date: occ.date,
        slotId: occ.slotId!,
        status: 'cancelled',
        reason: finalReason,
        note: note.trim(),
        updatedAt: Date.now(),
      });
    }
    toast('تم إلغاء الحصة وحفظ السبب');
    goBack();
  };

  const restore = () => {
    if (entry) store.saveEntry({ ...entry, cancelled: false, reason: '' });
    else store.deleteOverride(occ.key);
    toast('تم استرجاع الحصة');
    goBack();
  };

  const workedAnyway = () => {
    store.saveOverride({
      id: occ.key,
      jobId: occ.jobId,
      date: occ.date,
      slotId: occ.slotId!,
      status: 'done',
      reason: '',
      note: note.trim(),
      updatedAt: Date.now(),
    });
    toast('ستُحتسب هذه الحصة');
    goBack();
  };

  const remove = () => {
    if (!entry || !confirm('حذف هذه الحصة نهائياً؟')) return;
    store.deleteEntry(entry.id);
    toast('تم الحذف');
    goBack();
  };

  const isWorkedOverride = store.overrides.some((o) => o.id === occ.key && o.status === 'done');

  return (
    <Sheet onClose={onClose}>
      <h2>{occ.label || job?.name}</h2>
      <div className="sheet-sub">
        {formatDate(occ.date, true)} · <span dir="ltr">{occ.start} – {occ.end}</span> · {formatHours(occ.minutes)}
        {occ.room && ` · قاعة ${occ.room}`}
        {job && ` · ${job.emoji} ${job.name}`}
      </div>

      {mode === 'view' && (
        <>
          <div className="sessions" style={{ marginBottom: 16 }}>
            <SessionItem occ={occ} job={job} />
          </div>
          {occ.note && <p className="muted small">📝 {occ.note}</p>}
          <div className="sessions">
            {occ.status === 'cancelled' && (
              <button className="btn block" onClick={restore}>
                ↩︎ استرجاع الحصة
              </button>
            )}
            {occ.status === 'holiday' && (
              <button className="btn block soft" onClick={workedAnyway}>
                عملتُ في هذا اليوم، احسبيها
              </button>
            )}
            {isWorkedOverride && (
              <button className="btn block soft" onClick={restore}>
                إرجاعها كعطلة
              </button>
            )}
            {(occ.status === 'done' || occ.status === 'upcoming') && (
              <button className="btn block danger" onClick={() => setMode('cancel')}>
                ✕ إلغاء الحصة
              </button>
            )}
            {entry && (
              <div className="row">
                <button className="btn soft" onClick={() => setMode('edit')}>
                  ✎ تعديل
                </button>
                <button className="btn ghost" onClick={remove}>
                  حذف نهائي
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {mode === 'cancel' && (
        <>
          <div className="field">
            <span>سبب الإلغاء</span>
            <div className="pills">
              {store.settings.reasons.map((r) => (
                <button
                  key={r}
                  className={'pill' + (r === reason && !custom ? ' on' : '')}
                  onClick={() => {
                    setReason(r);
                    setCustom('');
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>أو اكتبي سبباً آخر</span>
            <input className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="سبب آخر…" />
          </label>
          <label className="field">
            <span>ملاحظة (اختياري)</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="sheet-actions">
            <button className="btn ghost" onClick={() => setMode('view')}>
              رجوع
            </button>
            <button className="btn" onClick={cancel} disabled={!finalReason}>
              تأكيد الإلغاء
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- add / edit a manual session

export function EntrySheet({
  entry,
  date,
  jobId,
  kind,
  onClose,
}: {
  entry?: Entry;
  date?: DateStr;
  jobId?: string;
  kind?: EntryKind;
  onClose: () => void;
}) {
  const store = useStore();
  const jobs = store.jobs;
  const [f, setF] = useState<Entry>(
    () =>
      entry ?? {
        id: uid(),
        jobId: jobId ?? jobs[0]?.id ?? '',
        date: date ?? store.clock.today,
        start: '08:00',
        end: '09:00',
        kind: kind ?? (jobs.find((j) => j.id === jobId)?.mode === 'learning' ? 'regular' : 'makeup'),
        label: '',
        room: '',
        note: '',
        cancelled: false,
        reason: '',
        createdAt: Date.now(),
      },
  );
  const set = (patch: Partial<Entry>) => setF((x) => ({ ...x, ...patch }));
  const job = jobs.find((j) => j.id === f.jobId);
  const labels = useMemo(() => labelsOf(job), [job]);
  const minutes = timeToMin(f.end) - timeToMin(f.start);
  const valid = f.jobId && f.date && minutes > 0;

  const save = () => {
    if (!valid) return;
    store.saveEntry({ ...f, label: f.label.trim(), room: f.room.trim(), note: f.note.trim() });
    toast(entry ? 'تم الحفظ' : 'تمت الإضافة');
    goBack();
  };

  return (
    <Sheet onClose={onClose}>
      <h2>{entry ? 'تعديل الحصة' : 'إضافة حصة'}</h2>
      <div className="sheet-sub">تُحفظ في جدولها الخاص ولا تختلط بغيرها</div>

      {jobs.length > 1 && (
        <div className="field">
          <span>العمل</span>
          <div className="pills">
            {jobs.map((j) => (
              <button key={j.id} className={'pill' + (f.jobId === j.id ? ' on' : '')} onClick={() => set({ jobId: j.id })}>
                {j.emoji} {j.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <span>النوع</span>
        <div className="pills">
          {(Object.keys(ENTRY_KIND_LABEL) as EntryKind[]).map((k) => (
            <button key={k} className={'pill' + (f.kind === k ? ' on' : '')} onClick={() => set({ kind: k })}>
              {ENTRY_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>التاريخ</span>
        <input className="input" type="date" value={f.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
      </label>

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

      <div className="row">
        <label className="field">
          <span>القاعة</span>
          <input className="input" value={f.room} onChange={(e) => set({ room: e.target.value })} />
        </label>
        <label className="field">
          <span>ملاحظة</span>
          <input className="input" value={f.note} onChange={(e) => set({ note: e.target.value })} />
        </label>
      </div>

      <div className="sheet-actions">
        <button className="btn ghost" onClick={goBack}>
          إلغاء
        </button>
        <button className="btn" onClick={save} disabled={!valid}>
          حفظ {minutes > 0 && `(${formatHours(minutes)})`}
        </button>
      </div>
    </Sheet>
  );
}

function labelsOf(job: Job | undefined): string[] {
  if (!job) return [];
  const set = new Set<string>();
  job.versions.forEach((v) => v.weeks.forEach((w) => w.forEach((s) => s.label && set.add(s.label))));
  return [...set];
}

// ---------------------------------------------------------------- holidays / pause

const PAUSE_REASONS = ['عطلة مدرسية', 'عطلة رسمية', 'عيد', 'عطلة شخصية', 'مرض', 'امتحانات'];

export function PauseSheet({ pause, from, onClose }: { pause?: Pause; from?: DateStr; onClose: () => void }) {
  const store = useStore();
  const [f, setF] = useState<Pause>(
    () =>
      pause ?? {
        id: uid(),
        from: from ?? store.clock.today,
        to: from ?? '',
        reason: PAUSE_REASONS[0],
        jobIds: [],
        createdAt: Date.now(),
      },
  );
  const set = (patch: Partial<Pause>) => setF((x) => ({ ...x, ...patch }));
  const openEnded = f.to === '';
  const valid = f.from && (openEnded || f.to >= f.from) && f.reason.trim();

  const save = () => {
    if (!valid) return;
    store.savePause({ ...f, reason: f.reason.trim() });
    toast(openEnded ? 'تم إيقاف العدّ ⏸' : 'تم حفظ العطلة 🏖️');
    goBack();
  };

  const remove = () => {
    if (!pause || !confirm('حذف هذه العطلة؟ ستُحتسب الحصص من جديد.')) return;
    store.deletePause(pause.id);
    goBack();
  };

  const toggleJob = (id: string) =>
    set({ jobIds: f.jobIds.includes(id) ? f.jobIds.filter((x) => x !== id) : [...f.jobIds, id] });

  return (
    <Sheet onClose={onClose}>
      <h2>{pause ? 'تعديل العطلة' : 'عطلة / إيقاف العدّ'}</h2>
      <div className="sheet-sub">الحصص في هذه الفترة تبقى ظاهرة لكن لا تُحتسب</div>

      <div className="field">
        <span>السبب</span>
        <div className="pills">
          {PAUSE_REASONS.map((r) => (
            <button key={r} className={'pill' + (f.reason === r ? ' on' : '')} onClick={() => set({ reason: r })}>
              {r}
            </button>
          ))}
        </div>
        <input className="input" value={f.reason} onChange={(e) => set({ reason: e.target.value })} />
      </div>

      <label className="field">
        <span>من</span>
        <input className="input" type="date" value={f.from} onChange={(e) => e.target.value && set({ from: e.target.value })} />
      </label>

      <div className="field">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span style={{ flex: 'none' }}>حتى أستأنف بنفسي</span>
          <div style={{ flex: 'none' }}>
            <Switch checked={openEnded} onChange={(v) => set({ to: v ? '' : f.from })} />
          </div>
        </div>
      </div>

      {!openEnded && (
        <label className="field">
          <span>إلى (آخر يوم في العطلة)</span>
          <input className="input" type="date" value={f.to} min={f.from} onChange={(e) => e.target.value && set({ to: e.target.value })} />
        </label>
      )}

      {store.jobs.length > 1 && (
        <div className="field">
          <span>تنطبق على</span>
          <div className="pills">
            <button className={'pill' + (f.jobIds.length === 0 ? ' on' : '')} onClick={() => set({ jobIds: [] })}>
              كل الأعمال
            </button>
            {store.jobs.map((j) => (
              <button key={j.id} className={'pill' + (f.jobIds.includes(j.id) ? ' on' : '')} onClick={() => toggleJob(j.id)}>
                {j.emoji} {j.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sheet-actions">
        {pause ? (
          <button className="btn ghost" onClick={remove}>
            حذف
          </button>
        ) : (
          <button className="btn ghost" onClick={goBack}>
            إلغاء
          </button>
        )}
        <button className="btn" onClick={save} disabled={!valid}>
          حفظ
        </button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- one day

export function DaySheet({
  date,
  occs,
  jobId,
  onClose,
  onOpen,
  onAdd,
  onPause,
}: {
  date: DateStr;
  occs: Occurrence[];
  jobId?: string;
  onClose: () => void;
  onOpen: (o: Occurrence) => void;
  onAdd: () => void;
  onPause: () => void;
}) {
  const store = useStore();
  const done = occs.filter((o) => o.status === 'done').reduce((s, o) => s + o.minutes, 0);
  const pause = store.pauses.find((p) => p.from <= date && (!p.to || date <= p.to) && (p.jobIds.length === 0 || !jobId || p.jobIds.includes(jobId)));
  return (
    <Sheet onClose={onClose}>
      <h2>{formatDate(date, true)}</h2>
      <div className="sheet-sub">
        {occs.length === 0 ? 'لا توجد حصص في هذا اليوم' : `${occs.length} حصة · منجز ${formatHours(done)}`}
        {pause && ` · 🏖️ ${pause.reason}`}
      </div>
      <div className="sessions" style={{ marginBottom: 16 }}>
        {occs.map((o) => (
          <SessionItem key={o.key} occ={o} job={store.jobs.find((j) => j.id === o.jobId)} onClick={() => onOpen(o)} showJob={!jobId && store.jobs.length > 1} />
        ))}
      </div>
      <div className="row">
        <button className="btn" onClick={onAdd}>
          + إضافة حصة
        </button>
        <button className="btn soft" onClick={onPause}>
          🏖️ عطلة
        </button>
      </div>
    </Sheet>
  );
}
