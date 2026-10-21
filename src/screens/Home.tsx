import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import {
  addDays, addMonths, formatDate, formatDateShort, formatHours, formatRange, hoursNumber, makeDate, maxDate,
  minDate, monthEnd, monthStart, parts, payPeriodFor, schoolYearFor, WEEK_ORDER, WEEKDAYS_SHORT, weekday,
  type DateStr,
} from '../lib/dates';
import { learnState, versionFromLearning } from '../lib/learn';
import { useLocal } from '../lib/local';
import { occurrences, pauseFor, totals } from '../lib/schedule';
import type { Entry, EntryKind, Job, Occurrence, Pause } from '../lib/types';
import { CONDITION_LABEL, type Weather } from '../sky/weather';
import { goBack, Icon, Sheet, toast } from '../components/ui';
import { SessionItem } from './SessionItem';
import { DaySheet, EntrySheet, OccurrenceSheet, PauseSheet } from './sheets';

type Overlay =
  | { kind: 'occ'; occ: Occurrence }
  | { kind: 'entry'; entry?: Entry; date?: DateStr; jobId?: string; entryKind?: EntryKind }
  | { kind: 'pause'; pause?: Pause; from?: DateStr }
  | { kind: 'rates' };

const WEATHER_ICON: Record<string, string> = {
  clear: '☀️', clouds: '⛅', rain: '🌧️', storm: '⛈️', snow: '❄️', fog: '🌫️',
};

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'صباح الخير';
  if (h >= 12 && h < 18) return 'مساء الخير';
  return 'مساء النور';
}

export function Home({ weather, onSettings, onReport }: { weather: Weather; onSettings: () => void; onReport: () => void }) {
  const store = useStore();
  const { jobs, settings, clock } = store;
  const [filterRaw, setFilter] = useLocal('b-filter', 'all');
  const filter = filterRaw !== 'all' && jobs.some((j) => j.id === filterRaw) ? filterRaw : 'all';
  const jobIds = filter === 'all' ? undefined : [filter];
  const shownJobs = filter === 'all' ? jobs : jobs.filter((j) => j.id === filter);

  const t = parts(clock.today);
  const [view, setView] = useState({ y: t.y, m: t.m });
  const [day, setDay] = useState<DateStr | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [geo, setGeo] = useLocal('b-geo');

  const isCurrent = view.y === t.y && view.m === t.m;
  const sd = settings.payStartDay;
  const period = payPeriodFor(isCurrent ? clock.today : makeDate(view.y, view.m, Math.min(28, Math.max(1, sd))), sd);
  const year = schoolYearFor(isCurrent ? clock.today : monthStart(view.y, view.m), settings.yearStartMonth);
  const month = { from: monthStart(view.y, view.m), to: monthEnd(view.y, view.m) };

  const all = useMemo(() => {
    const range = {
      from: minDate(minDate(year.from, period.from), month.from),
      to: maxDate(maxDate(year.to, period.to), month.to),
    };
    return occurrences(store, range, clock, jobIds);
  }, [store.jobs, store.overrides, store.entries, store.pauses, clock, filter, year.from, period.from, month.from]);

  const inRange = (r: { from: DateStr; to: DateStr }) => all.filter((o) => o.date >= r.from && o.date <= r.to);
  const periodT = totals(inRange(period), jobs);
  const yearT = totals(inRange(year), jobs);
  const todayOccs = all.filter((o) => o.date === clock.today);
  const byDay = useMemo(() => {
    const m = new Map<DateStr, Occurrence[]>();
    for (const o of all) {
      if (o.date < month.from || o.date > month.to) continue;
      if (!m.has(o.date)) m.set(o.date, []);
      m.get(o.date)!.push(o);
    }
    return m;
  }, [all, month.from, month.to]);
  const extras = all.filter((o) => (o.source === 'makeup' || o.source === 'extra') && o.date >= month.from && o.date <= month.to);
  const extrasMin = extras.filter((o) => o.status === 'done' || o.status === 'upcoming').reduce((s, o) => s + o.minutes, 0);

  const openPauses = store.pauses.filter((p) => !p.to && p.from <= clock.today);
  const earliestStart = shownJobs.reduce<DateStr | null>((m, j) => (!m || j.startDate < m ? j.startDate : m), null);
  const jobOf = (id: string) => jobs.find((j) => j.id === id);

  const resume = (p: Pause) => {
    const yesterday = addDays(clock.today, -1);
    if (p.from > yesterday) store.deletePause(p.id);
    else store.savePause({ ...p, to: yesterday });
    toast('عاد العدّ للعمل 🌸');
  };

  // ------------------------------------------------------------ calendar cells
  const first = month.from;
  const lead = WEEK_ORDER.indexOf(weekday(first));
  const cells: (DateStr | null)[] = [...Array(lead).fill(null)];
  for (let d = first; d <= month.to; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const moveMonth = (n: number) => setView(addMonths(view.y, view.m, n));

  return (
    <>
      <div className="topbar">
        <button className="icon-btn" onClick={onSettings} aria-label="الإعدادات">
          <Icon.Gear />
        </button>
        <button className="icon-btn" onClick={onReport} aria-label="ملف PDF">
          <Icon.Doc />
        </button>
      </div>

      <div className="hello">
        <h1>
          {greeting()} يا {settings.name} 🌸
        </h1>
        <div className="sub">
          <span>{formatDate(clock.today, true)}</span>
          {weather.live && (
            <span className="weather-chip">
              {weather.isDay || (weather.cond !== 'clear' && weather.cond !== 'clouds') ? WEATHER_ICON[weather.cond] : '🌙'}
              {weather.temp !== null && <b dir="ltr">{weather.temp}°</b>}
              {CONDITION_LABEL[weather.cond]}
              {weather.city && ` · ${weather.city}`}
            </span>
          )}
        </div>
      </div>

      {jobs.length > 1 && (
        <div className="chips">
          <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>
            الكل
          </button>
          {jobs.map((j) => (
            <button
              key={j.id}
              className={'chip' + (filter === j.id ? ' on' : '')}
              style={{ ['--c' as string]: j.color }}
              onClick={() => setFilter(j.id)}
            >
              <span className="dot" />
              {j.emoji} {j.name}
            </button>
          ))}
        </div>
      )}

      {openPauses.map((p) => (
        <div className="card banner" key={p.id}>
          <span className="emoji">⏸️</span>
          <div className="grow">
            <b>العدّ متوقف</b>
            <p>
              {p.reason} · منذ {formatDateShort(p.from)}
              {p.jobIds.length > 0 && ` · ${p.jobIds.map((id) => jobOf(id)?.name).join('، ')}`}
            </p>
          </div>
          <button className="btn sm" onClick={() => resume(p)}>
            استئناف
          </button>
        </div>
      ))}

      {!geo && (
        <div className="card banner">
          <span className="emoji">🌦️</span>
          <div className="grow">
            <b>طقس مكانك الحقيقي</b>
            <p>اسمحي بمعرفة موقعك ليتغيّر التطبيق مع المطر والشمس حيث أنتِ</p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn sm" onClick={() => setGeo('yes')}>
                سماح
              </button>
              <button className="btn sm ghost" onClick={() => setGeo('no')}>
                لاحقاً
              </button>
            </div>
          </div>
        </div>
      )}

      {!settings.salaryAsked && (
        <div className="card banner">
          <span className="emoji">💰</span>
          <div className="grow">
            <b>هل تريدين حساب أجرك أيضاً؟</b>
            <p>أدخلي سعر الساعة مرة واحدة، وسأحسب لكِ أجر كل شهر</p>
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="btn sm"
                onClick={() => {
                  store.saveSettings({ salaryAsked: true, salaryEnabled: true });
                  setOverlay({ kind: 'rates' });
                }}
              >
                نعم
              </button>
              <button className="btn sm ghost" onClick={() => store.saveSettings({ salaryAsked: true })}>
                لا شكراً
              </button>
            </div>
          </div>
        </div>
      )}

      {shownJobs
        .filter((j) => j.mode === 'learning')
        .map((j) => (
          <LearningCard key={j.id} job={j} onAdd={(date) => setOverlay({ kind: 'entry', date, jobId: j.id, entryKind: 'regular' })} />
        ))}

      <div className="card">
        <div className="stats">
          <div className="stat">
            <div className="label">{sd === 1 ? 'هذا الشهر' : 'فترة الأجر'}</div>
            <div className="value">
              {hoursNumber(periodT.doneMin)}
              <small>ساعة</small>
            </div>
            <div className="meta">
              {formatRange(period)}
              {periodT.upcomingMin > 0 && ` · متبقي ${formatHours(periodT.upcomingMin)}`}
            </div>
            <div className="progress">
              <div style={{ width: `${pct(periodT.doneMin, periodT.doneMin + periodT.upcomingMin)}%` }} />
            </div>
          </div>
          <div className="stat year">
            <div className="label">السنة الدراسية</div>
            <div className="value">
              {hoursNumber(yearT.doneMin)}
              <small>ساعة</small>
            </div>
            <div className="meta">
              <span dir="ltr">
                {parts(year.from).y}–{parts(year.to).y}
              </span>{' '}
              · {yearT.doneCount} حصة
            </div>
            <div className="meta">
              {yearT.cancelled > 0 && `${yearT.cancelled} ملغاة`}
              {yearT.cancelled > 0 && yearT.extraMin > 0 && ' · '}
              {yearT.extraMin > 0 && `تعويض ${formatHours(yearT.extraMin)}`}
            </div>
          </div>
          {settings.salaryEnabled && (
            <button className="stat money" onClick={() => setOverlay({ kind: 'rates' })} style={{ textAlign: 'start' }}>
              <div>
                <div className="label">الأجر · {formatRange(period)}</div>
                <div className="value">
                  {money(periodT.money)}
                  <small>{settings.currency}</small>
                </div>
              </div>
              <div className="meta" style={{ textAlign: 'end' }}>
                السنة
                <br />
                <b>
                  {money(yearT.money)} {settings.currency}
                </b>
                {jobs.some((j) => !j.rate) && (
                  <>
                    <br />
                    <span style={{ color: 'var(--rose-deep)' }}>أدخلي سعر الساعة ←</span>
                  </>
                )}
              </div>
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>اليوم</h2>
          <span className="hint">{todayOccs.length > 0 ? `${todayOccs.length} حصة` : ''}</span>
        </div>
        {todayOccs.length === 0 ? (
          <div className="empty">
            <span className="big">☕</span>
            لا حصص اليوم، استمتعي بيومك
          </div>
        ) : (
          <div className="sessions">
            {todayOccs.map((o) => (
              <SessionItem
                key={o.key}
                occ={o}
                job={jobOf(o.jobId)}
                showJob={filter === 'all' && jobs.length > 1}
                onClick={() => setOverlay({ kind: 'occ', occ: o })}
              />
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="cal-head">
          <button className="cal-nav" onClick={() => moveMonth(-1)} aria-label="الشهر السابق">
            <Icon.Prev />
          </button>
          <button onClick={() => setView({ y: t.y, m: t.m })}>
            <h2>{formatRange(month)}</h2>
          </button>
          <button className="cal-nav" onClick={() => moveMonth(1)} aria-label="الشهر التالي">
            <Icon.Next />
          </button>
        </div>
        <div className="cal-grid">
          {WEEK_ORDER.map((wd) => (
            <div key={wd} className="cal-wd">
              {WEEKDAYS_SHORT[wd]}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={'x' + i} className="cal-day other" />;
            const occs = byDay.get(d) ?? [];
            const paused = shownJobs.some((j) => pauseFor(store.pauses, j.id, d));
            const done = occs.filter((o) => o.status === 'done' || o.status === 'upcoming').reduce((s, o) => s + o.minutes, 0);
            const cls = ['cal-day'];
            if (d === clock.today) cls.push('today');
            else if (paused) cls.push('paused');
            if (earliestStart && d < earliestStart) cls.push('before');
            return (
              <button key={d} className={cls.join(' ')} onClick={() => setDay(d)}>
                {parts(d).d}
                <span className="cal-dots">
                  {occs.slice(0, 6).map((o) => (
                    <i key={o.key} className={o.status} style={{ ['--c' as string]: jobOf(o.jobId)?.color }} />
                  ))}
                </span>
                {done > 0 && <span className="cal-hours">{hoursNumber(done)}س</span>}
              </button>
            );
          })}
        </div>
        <div className="legend">
          <span>
            <i className="cal-dots">
              <i style={{ ['--c' as string]: 'var(--rose)' }} />
            </i>
            تمّت
          </span>
          <span>
            <i className="cal-dots">
              <i className="upcoming" style={{ ['--c' as string]: 'var(--rose)' }} />
            </i>
            قادمة
          </span>
          <span>
            <i className="cal-dots">
              <i className="cancelled" />
            </i>
            ملغاة
          </span>
          <span>
            <i className="cal-dots">
              <i className="holiday" />
            </i>
            عطلة
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>التعويضات والساعات الإضافية</h2>
          <span className="hint">{extrasMin > 0 && formatHours(extrasMin)}</span>
        </div>
        {extras.length === 0 ? (
          <div className="empty small">لا شيء في {formatRange(month)}</div>
        ) : (
          <div className="sessions" style={{ marginBottom: 12 }}>
            {extras.map((o) => (
              <SessionItem
                key={o.key}
                occ={o}
                job={jobOf(o.jobId)}
                showDate={formatDateShort(o.date)}
                showJob={filter === 'all' && jobs.length > 1}
                onClick={() => setOverlay({ kind: 'occ', occ: o })}
              />
            ))}
          </div>
        )}
        <button
          className="btn soft block"
          onClick={() => setOverlay({ kind: 'entry', jobId: filter === 'all' ? undefined : filter, entryKind: 'makeup' })}
        >
          + إضافة تعويض أو ساعة إضافية
        </button>
      </div>

      {day && (
        <DaySheet
          date={day}
          occs={all.filter((o) => o.date === day)}
          jobId={filter === 'all' ? undefined : filter}
          onClose={() => setDay(null)}
          onOpen={(occ) => setOverlay({ kind: 'occ', occ })}
          onAdd={() => setOverlay({ kind: 'entry', date: day, jobId: filter === 'all' ? undefined : filter })}
          onPause={() => setOverlay({ kind: 'pause', from: day })}
        />
      )}
      {overlay?.kind === 'occ' && (
        <OccurrenceSheet occ={all.find((o) => o.key === overlay.occ.key) ?? overlay.occ} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'entry' && (
        <EntrySheet
          entry={overlay.entry}
          date={overlay.date}
          jobId={overlay.jobId}
          kind={overlay.entryKind}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'pause' && <PauseSheet pause={overlay.pause} from={overlay.from} onClose={() => setOverlay(null)} />}
      {overlay?.kind === 'rates' && <RatesSheet onClose={() => setOverlay(null)} />}
    </>
  );
}

function pct(a: number, b: number): number {
  return b <= 0 ? 0 : Math.round((a / b) * 100);
}

export function money(v: number): string {
  return v.toLocaleString('fr-TN', { maximumFractionDigits: 3 });
}

// ---------------------------------------------------------------- learning

function LearningCard({ job, onAdd }: { job: Job; onAdd: (date: DateStr) => void }) {
  const store = useStore();
  const s = learnState(job, store.entries, store.clock.today);
  const [dismissed, setDismissed] = useLocal(`b-learn-${job.id}`);
  const weekNo = s.weekStarts.length + 1;

  const accept = () => {
    const v = versionFromLearning(job, s);
    store.saveJob({ ...job, mode: 'schedule', versions: [...job.versions, v] });
    toast(`سيتكرر جدول ${job.name} تلقائياً من ${formatDateShort(v.from)} 🌸`);
  };

  if (s.cycle > 0 && dismissed !== String(s.weekStarts.length)) {
    return (
      <div className="card banner" style={{ ['--c' as string]: job.color }}>
        <span className="emoji">✨</span>
        <div className="grow">
          <b>
            {job.emoji} فهمتُ طريقة عملك في «{job.name}»
          </b>
          <p>
            {s.cycle === 1
              ? 'يبدو أن نفس الأسبوع يتكرر كل أسبوع.'
              : `يبدو أن عملك يدور كل ${s.cycle} أسابيع (الأسبوع 1، 2${s.cycle > 2 ? '، …' : ''} ثم يعود).`}
            {s.confirmations > 0 && ` تأكدتُ من ذلك ${s.confirmations} مرة.`} هل أعمّره تلقائياً من الآن؟
          </p>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sm" onClick={accept}>
              نعم، كرّريه
            </button>
            <button className="btn sm ghost" onClick={() => setDismissed(String(s.weekStarts.length))}>
              الأسبوع القادم مختلف
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card banner">
      <span className="emoji">📝</span>
      <div className="grow">
        <b>
          {job.emoji} {job.name}: الأسبوع {weekNo}
        </b>
        <p>
          {s.weekStarts.length === 0
            ? 'عمّري حصص أسبوعك الأول بالضغط على الأيام في الروزنامة، وبعدها أتعلّم وأكرر وحدي.'
            : 'واصلي تعمير هذا الأسبوع، وعندما أفهم الدورة سأقترح التكرار التلقائي.'}
        </p>
        <button className="btn sm soft" style={{ marginTop: 10 }} onClick={() => onAdd(store.clock.today)}>
          + إضافة حصة
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- rates

function RatesSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(store.jobs.map((j) => [j.id, j.rate ? String(j.rate) : ''])),
  );
  const [currency, setCurrency] = useState(store.settings.currency);

  const save = () => {
    for (const j of store.jobs) {
      const v = Number((rates[j.id] ?? '').replace(',', '.'));
      const rate = Number.isFinite(v) && v > 0 ? v : 0;
      if (rate !== j.rate) store.saveJob({ ...j, rate });
    }
    store.saveSettings({ currency: currency.trim() || 'د.ت', salaryEnabled: true });
    toast('تم الحفظ 💰');
    goBack();
  };

  return (
    <Sheet onClose={onClose}>
      <h2>سعر الساعة</h2>
      <div className="sheet-sub">لكل عمل سعره الخاص · يمكن تغييره لاحقاً من الإعدادات</div>
      {store.jobs.map((j) => (
        <label className="field" key={j.id}>
          <span>
            {j.emoji} {j.name}
          </span>
          <input
            className="input"
            inputMode="decimal"
            value={rates[j.id] ?? ''}
            placeholder="مثال: 12.5"
            onChange={(e) => setRates({ ...rates, [j.id]: e.target.value })}
          />
        </label>
      ))}
      <label className="field">
        <span>العملة</span>
        <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} />
      </label>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={goBack}>
          إلغاء
        </button>
        <button className="btn" onClick={save}>
          حفظ
        </button>
      </div>
    </Sheet>
  );
}
