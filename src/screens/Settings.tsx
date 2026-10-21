import { useRef, useState, type ReactNode } from 'react';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useStore } from '../data/store';
import { formatDate, MONTHS, mondayOf, todayStr } from '../lib/dates';
import { useLocal } from '../lib/local';
import type { Job } from '../lib/types';
import { uid } from '../lib/uid';
import { Icon, PageHead, Switch, toast } from '../components/ui';
import { PauseSheet } from './sheets';
import type { Route } from '../App';

export const JOB_COLORS = ['#e88aa8', '#b48ad8', '#7fb8e6', '#6fc2a5', '#f0a96b', '#e7c25c', '#d97a7a', '#9aa6d8'];
export const JOB_EMOJIS = ['🏫', '📚', '✏️', '🎓', '🧑‍🏫', '💼', '🏠', '🌸', '📝', '⭐'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="card-title">
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- main settings

export function SettingsPage({ nav }: { nav: (r: Route) => void }) {
  const store = useStore();
  const { settings } = store;
  const [name, setName] = useState(settings.name);
  const [reason, setReason] = useState('');
  const [geo, setGeo] = useLocal('b-geo');
  const [preview, setPreview] = useLocal('b-preview');
  const fileRef = useRef<HTMLInputElement>(null);

  const addReason = () => {
    const r = reason.trim();
    if (!r || settings.reasons.includes(r)) return;
    store.saveSettings({ reasons: [...settings.reasons, r] });
    setReason('');
  };

  const exportData = () => {
    const data = {
      app: 'bothaina',
      exportedAt: new Date().toISOString(),
      settings,
      jobs: store.jobs,
      overrides: store.overrides,
      entries: store.entries,
      pauses: store.pauses,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const file = new File([blob], `بثينة-نسخة-${todayStr()}.json`, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file] }).catch(() => undefined);
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  };

  const importData = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'bothaina') throw new Error('bad file');
      if (!confirm('استرجاع هذه النسخة؟ ستُضاف بياناتها إلى بياناتك الحالية.')) return;
      await store.importAll(data);
      toast('تم الاسترجاع');
    } catch {
      alert('هذا الملف ليس نسخة صالحة من تطبيق بثينة');
    }
  };

  const PREVIEWS: [string, string][] = [
    ['', 'مباشر'], ['rain', '🌧️ مطر'], ['storm', '⛈️ عاصفة'], ['snow', '❄️ ثلج'], ['clouds', '⛅ غيوم'],
    ['fog', '🌫️ ضباب'], ['clear', '☀️ شمس'], ['hot', '🔥 حرّ'], ['night', '🌙 ليل'],
    ['spring', '🌷 ربيع'], ['summer', '🏖️ صيف'], ['autumn', '🍂 خريف'], ['winter', '⛄ شتاء'],
  ];

  return (
    <>
      <PageHead title="الإعدادات" />

      <Section title="الاسم">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== settings.name && store.saveSettings({ name: name.trim() })}
        />
      </Section>

      <Section title="جداول العمل">
        <div className="list">
          {store.jobs.map((j) => (
            <button key={j.id} className="list-item" onClick={() => nav({ name: 'job', id: j.id })}>
              <span className="ic" style={{ background: j.color + '33' }}>
                {j.emoji}
              </span>
              <span className="grow">
                {j.name}
                <div className="sub">
                  {j.mode === 'learning' ? 'في طور التعلّم' : jobSummary(j)} · منذ {formatDate(j.startDate)}
                </div>
              </span>
              <span className="chev">
                <Icon.Chevron />
              </span>
            </button>
          ))}
        </div>
        <button className="btn soft block" style={{ marginTop: 10 }} onClick={() => nav({ name: 'job', id: 'new' })}>
          + عمل جديد (جدول منفصل)
        </button>
      </Section>

      <Section title="العطل وإيقاف العدّ">
        <button className="list-item" onClick={() => nav({ name: 'pauses' })}>
          <span className="ic">🏖️</span>
          <span className="grow">
            العطل
            <div className="sub">{store.pauses.length} مسجّلة</div>
          </span>
          <span className="chev">
            <Icon.Chevron />
          </span>
        </button>
      </Section>

      <Section title="الشهر والسنة">
        <label className="field">
          <span>يبدأ شهر الأجر يوم</span>
          <select
            className="input"
            value={settings.payStartDay}
            onChange={(e) => store.saveSettings({ payStartDay: Number(e.target.value) })}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d === 1 ? '1 (من أول الشهر إلى آخره)' : `${d} من كل شهر (إلى ${d - 1} من الشهر التالي)`}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>تبدأ السنة الدراسية في شهر</span>
          <select
            className="input"
            value={settings.yearStartMonth}
            onChange={(e) => store.saveSettings({ yearStartMonth: Number(e.target.value) })}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section title="الأجر">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ flex: 1 }}>حساب الأجر</span>
          <div style={{ flex: 'none' }}>
            <Switch checked={settings.salaryEnabled} onChange={(v) => store.saveSettings({ salaryEnabled: v, salaryAsked: true })} />
          </div>
        </div>
        {settings.salaryEnabled && (
          <>
            {store.jobs.map((j) => (
              <RateField key={j.id} job={j} />
            ))}
            <label className="field">
              <span>العملة</span>
              <input
                className="input"
                defaultValue={settings.currency}
                onBlur={(e) => store.saveSettings({ currency: e.target.value.trim() || 'د.ت' })}
              />
            </label>
          </>
        )}
      </Section>

      <Section title="أسباب الإلغاء">
        <div className="pills" style={{ marginBottom: 12 }}>
          {settings.reasons.map((r) => (
            <button
              key={r}
              className="pill"
              onClick={() => confirm(`حذف «${r}»؟`) && store.saveSettings({ reasons: settings.reasons.filter((x) => x !== r) })}
            >
              {r} ✕
            </button>
          ))}
        </div>
        <div className="row">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب جديد" />
          <button className="btn sm" style={{ flex: 'none' }} onClick={addReason}>
            إضافة
          </button>
        </div>
      </Section>

      <Section title="المظهر">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ flex: 1 }}>الحركات (مطر، ثلج، أوراق…)</span>
          <div style={{ flex: 'none' }}>
            <Switch checked={settings.animations} onChange={(v) => store.saveSettings({ animations: v })} />
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ flex: 1 }}>
            استعمال موقعي الدقيق للطقس
            <div className="muted small">بدونه يُقدَّر المكان من الإنترنت</div>
          </span>
          <div style={{ flex: 'none' }}>
            <Switch checked={geo === 'yes'} onChange={(v) => setGeo(v ? 'yes' : 'no')} />
          </div>
        </div>
        <div className="field">
          <span>معاينة الأجواء</span>
          <div className="pills">
            {PREVIEWS.map(([k, label]) => (
              <button key={k} className={'pill' + (preview === k ? ' on' : '')} onClick={() => setPreview(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="نسخة احتياطية">
        <p className="muted small" style={{ marginTop: 0 }}>
          بياناتك محفوظة تلقائياً في حسابك. هذه نسخة إضافية في ملف، للاطمئنان.
        </p>
        <div className="row">
          <button className="btn soft" onClick={exportData}>
            تصدير ملف
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            استرجاع ملف
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
        />
      </Section>

      <Section title="الحساب">
        <p style={{ marginTop: 0 }}>
          <span className="muted small">مسجّلة باسم</span>
          <br />
          <b dir="ltr">{store.user?.email}</b>
        </p>
        <div className="row">
          <button
            className="btn soft"
            onClick={() =>
              store.user?.email &&
              sendPasswordResetEmail(auth, store.user.email)
                .then(() => toast('أرسلنا رابط تغيير كلمة السر إلى بريدك'))
                .catch(() => toast('تعذّر الإرسال، تحققي من الإنترنت'))
            }
          >
            تغيير كلمة السر
          </button>
          <button className="btn ghost" onClick={() => confirm('تسجيل الخروج؟') && signOut(auth)}>
            تسجيل الخروج
          </button>
        </div>
      </Section>

      <p className="muted small" style={{ textAlign: 'center' }}>
        بثينة · الإصدار {__APP_VERSION__}
      </p>
    </>
  );
}

function RateField({ job }: { job: Job }) {
  const store = useStore();
  return (
    <label className="field">
      <span>
        سعر الساعة · {job.emoji} {job.name}
      </span>
      <input
        className="input"
        inputMode="decimal"
        defaultValue={job.rate || ''}
        placeholder="0"
        onBlur={(e) => {
          const v = Number(e.target.value.replace(',', '.'));
          const rate = Number.isFinite(v) && v > 0 ? v : 0;
          if (rate !== job.rate) store.saveJob({ ...job, rate });
        }}
      />
    </label>
  );
}

export function jobSummary(j: Job): string {
  const v = [...j.versions].sort((a, b) => b.from.localeCompare(a.from))[0];
  if (!v) return 'بدون جدول';
  const min = v.weeks.reduce(
    (s, w) => s + w.reduce((t, sl) => t + (toMin(sl.end) - toMin(sl.start)), 0),
    0,
  );
  const perWeek = min / 60 / Math.max(1, v.weeks.length);
  const h = Number.isInteger(perWeek) ? perWeek : perWeek.toFixed(1);
  return v.weeks.length > 1 ? `دورة ${v.weeks.length} أسابيع · ~${h} س/أسبوع` : `${h} س في الأسبوع`;
}

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ---------------------------------------------------------------- job editor

export function JobPage({ id, nav }: { id: string; nav: (r: Route, replace?: boolean) => void }) {
  const store = useStore();
  const existing = store.jobs.find((j) => j.id === id);
  const isNew = !existing;
  const [f, setF] = useState<Job>(
    () =>
      existing ?? {
        id: uid(),
        name: '',
        color: JOB_COLORS[store.jobs.length % JOB_COLORS.length],
        emoji: JOB_EMOJIS[(store.jobs.length + 1) % JOB_EMOJIS.length],
        startDate: store.clock.today,
        rate: 0,
        mode: 'schedule',
        versions: [],
        order: store.jobs.length,
        createdAt: Date.now(),
      },
  );
  const set = (patch: Partial<Job>) => setF((x) => ({ ...x, ...patch }));
  // Keep schedule changes made on the schedule page.
  const job: Job = existing ? { ...existing, ...pickMeta(f) } : f;
  const versions = [...job.versions].sort((a, b) => b.from.localeCompare(a.from));
  const labels = [...new Set(job.versions.flatMap((v) => v.weeks.flatMap((w) => w.map((s) => s.label))).filter(Boolean))];

  const saveMeta = () => {
    if (!f.name.trim()) return toast('اكتبي اسم العمل');
    if (existing) {
      store.saveJob({ ...existing, ...pickMeta(f), name: f.name.trim() });
      toast('تم الحفظ');
      return;
    }
    const created = { ...f, name: f.name.trim() };
    store.saveJob(created);
    if (created.mode === 'schedule') {
      nav(
        {
          name: 'schedule',
          jobId: created.id,
          draft: { id: uid(), from: created.startDate, anchor: mondayOf(created.startDate), weeks: [[]] },
        },
        true,
      );
    } else {
      toast('ابدئي بتعمير أسبوعك الأول من الروزنامة');
      history.back();
    }
  };

  const renameLabel = (old: string) => {
    const next = prompt(`الاسم الجديد للقسم «${old}»`, old)?.trim();
    if (!next || next === old || !existing) return;
    store.saveJob({
      ...existing,
      versions: existing.versions.map((v) => ({
        ...v,
        weeks: v.weeks.map((w) => w.map((s) => (s.label === old ? { ...s, label: next } : s))),
      })),
    });
    store.entries
      .filter((e) => e.jobId === existing.id && e.label === old)
      .forEach((e) => store.saveEntry({ ...e, label: next }));
    toast('تم تغيير اسم القسم في كل مكان');
  };

  const remove = () => {
    if (!existing) return;
    if (!confirm(`حذف «${existing.name}» وكل حصصه نهائياً؟`)) return;
    if (!confirm('متأكدة؟ لا يمكن التراجع.')) return;
    store.deleteJob(existing.id);
    history.back();
  };

  return (
    <>
      <PageHead title={isNew ? 'عمل جديد' : f.name || 'العمل'} />

      <div className="card">
        <label className="field">
          <span>الاسم</span>
          <input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثال: دروس خاصة" />
        </label>
        <div className="field">
          <span>الأيقونة</span>
          <div className="pills">
            {JOB_EMOJIS.map((e) => (
              <button key={e} className={'pill' + (f.emoji === e ? ' on' : '')} onClick={() => set({ emoji: e })}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>اللون</span>
          <div className="colors">
            {JOB_COLORS.map((c) => (
              <button key={c} className={'color-dot' + (f.color === c ? ' on' : '')} style={{ background: c }} onClick={() => set({ color: c })} />
            ))}
          </div>
        </div>
        <label className="field">
          <span>يبدأ العدّ من</span>
          <input className="input" type="date" value={f.startDate} onChange={(e) => e.target.value && set({ startDate: e.target.value })} />
        </label>

        {isNew && (
          <div className="field">
            <span>كيف نعمّر الجدول؟</span>
            <div className="sessions">
              <button className={'session' + (f.mode === 'schedule' ? '' : ' is-holiday')} onClick={() => set({ mode: 'schedule' })}>
                <span className="main">
                  <b>{f.mode === 'schedule' ? '● ' : '○ '}أعرف جدولي</b>
                  <span className="what" style={{ display: 'block', whiteSpace: 'normal' }}>
                    أدخله الآن (أسبوع واحد أو دورة من عدة أسابيع)
                  </span>
                </span>
              </button>
              <button className={'session' + (f.mode === 'learning' ? '' : ' is-holiday')} onClick={() => set({ mode: 'learning' })}>
                <span className="main">
                  <b>{f.mode === 'learning' ? '● ' : '○ '}أعمّر أسبوعاً بأسبوع</b>
                  <span className="what" style={{ display: 'block', whiteSpace: 'normal' }}>
                    أضيف حصصي في الروزنامة، والتطبيق يفهم الدورة ويكررها
                  </span>
                </span>
              </button>
            </div>
          </div>
        )}

        <button className="btn block" onClick={saveMeta}>
          {isNew ? 'إنشاء' : 'حفظ'}
        </button>
      </div>

      {existing && (
        <>
          <Section title="الجدول">
            {versions.length === 0 ? (
              <p className="muted small" style={{ marginTop: 0 }}>
                {job.mode === 'learning' ? 'التطبيق يتعلّم من الحصص التي تضيفينها في الروزنامة.' : 'لا يوجد جدول بعد.'}
              </p>
            ) : (
              <div className="list">
                {versions.map((v, i) => (
                  <button key={v.id} className="list-item" onClick={() => nav({ name: 'schedule', jobId: job.id, versionId: v.id })}>
                    <span className="ic">{i === 0 ? '📅' : '🗂️'}</span>
                    <span className="grow">
                      {i === 0 ? 'الجدول الحالي' : 'جدول سابق'}
                      <div className="sub">
                        من {formatDate(v.from)}
                        {i > 0 && ` إلى ${formatDate(versions[i - 1].from)}`}
                        {v.weeks.length > 1 && ` · دورة ${v.weeks.length} أسابيع`}
                      </div>
                    </span>
                    <span className="chev">
                      <Icon.Chevron />
                    </span>
                  </button>
                ))}
              </div>
            )}
            <button
              className="btn soft block"
              style={{ marginTop: 10 }}
              onClick={() => {
                const base = versions[0];
                const from = versions.length === 0 ? job.startDate : store.clock.today;
                nav({
                  name: 'schedule',
                  jobId: job.id,
                  draft: {
                    id: uid(),
                    from,
                    anchor: base && base.weeks.length > 1 ? base.anchor : mondayOf(from),
                    // Same slot ids, so cancellations already noted for future days still apply.
                    weeks: base ? base.weeks.map((w) => w.map((s) => ({ ...s }))) : [[]],
                  },
                });
              }}
            >
              {versions.length === 0 ? 'إدخال الجدول مباشرة' : 'تغيير الجدول ابتداءً من تاريخ…'}
            </button>
            {versions.length > 0 && (
              <p className="muted small">الأشهر السابقة لا تتأثر عند تغيير الجدول من تاريخ معيّن.</p>
            )}
          </Section>

          {labels.length > 0 && (
            <Section title="الأقسام">
              <p className="muted small" style={{ marginTop: 0 }}>
                اضغطي على قسم لتغيير اسمه في كل مكان
              </p>
              <div className="pills">
                {labels.map((l) => (
                  <button key={l} className="pill" onClick={() => renameLabel(l)}>
                    {l} ✎
                  </button>
                ))}
              </div>
            </Section>
          )}

          <button className="btn danger block" onClick={remove}>
            حذف هذا العمل
          </button>
        </>
      )}
    </>
  );
}

function pickMeta(f: Job) {
  return { name: f.name, color: f.color, emoji: f.emoji, startDate: f.startDate };
}

// ---------------------------------------------------------------- holidays

export function PausesPage() {
  const store = useStore();
  const [open, setOpen] = useState<{ id?: string } | null>(null);
  const pauses = [...store.pauses].sort((a, b) => b.from.localeCompare(a.from));
  const jobName = (id: string) => store.jobs.find((j) => j.id === id)?.name ?? '';
  return (
    <>
      <PageHead title="العطل وإيقاف العدّ" />
      <div className="card">
        {pauses.length === 0 ? (
          <div className="empty">
            <span className="big">🏖️</span>
            لا توجد عطل مسجّلة
          </div>
        ) : (
          <div className="list">
            {pauses.map((p) => (
              <button key={p.id} className="list-item" onClick={() => setOpen({ id: p.id })}>
                <span className="ic">{p.to ? '🏖️' : '⏸️'}</span>
                <span className="grow">
                  {p.reason}
                  <div className="sub">
                    {formatDate(p.from)} ← {p.to ? formatDate(p.to) : 'حتى الاستئناف'}
                    {p.jobIds.length > 0 && ` · ${p.jobIds.map(jobName).join('، ')}`}
                  </div>
                </span>
                <span className="chev">
                  <Icon.Chevron />
                </span>
              </button>
            ))}
          </div>
        )}
        <button className="btn block" style={{ marginTop: 10 }} onClick={() => setOpen({})}>
          + عطلة جديدة
        </button>
      </div>
      {open && <PauseSheet pause={store.pauses.find((p) => p.id === open.id)} onClose={() => setOpen(null)} />}
    </>
  );
}
