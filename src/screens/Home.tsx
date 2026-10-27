import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import {
  addDays, addMonths, formatDate, formatDateShort, formatHours, formatRange, hoursNumber, makeDate, maxDate,
  minDate, monthEnd, monthStart, parts, payPeriodFor, schoolYearFor, WEEK_ORDER, WEEKDAYS_SHORT, weekday,
  type DateStr,
} from '../lib/dates';
import { learnState, versionFromLearning } from '../lib/learn';
import { greeting } from '../lib/greeting';
import { useLocal } from '../lib/local';
import { occurrences, pauseFor, totals } from '../lib/schedule';
import type { Entry, EntryKind, Job, Occurrence, Pause } from '../lib/types';
import { CONDITION_LABEL, type Weather } from '../sky/weather';
import { goBack, Icon, Sheet, toast } from '../components/ui';
import { Mark } from '../components/marks';
import { SessionItem } from './SessionItem';
import { DaySheet, EntrySheet, OccurrenceSheet, PauseSheet, RecoverySheet } from './sheets';
import { codeOf } from '../lib/recovery';

type Overlay =
  | { kind: 'occ'; occ: Occurrence }
  | { kind: 'entry'; entry?: Entry; date?: DateStr; jobId?: string; entryKind?: EntryKind }
  | { kind: 'pause'; pause?: Pause; from?: DateStr }
  | { kind: 'rates' }
  | { kind: 'recovery' };

const WEATHER_ICON: Record<string, string> = {
  clear: '☀️', clouds: '⛅', rain: '🌧️', storm: '⛈️', snow: '❄️', fog: '🌫️',
};

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

  const recoveryCode = codeOf(store.user?.email);
  const openPauses = store.pauses.filter((p) => !p.to && p.from <= clock.today);
  const earliestStart = shownJobs.reduce<DateStr | null>((m, j) => (!m || j.startDate < m ? j.startDate : m), null);
  const jobOf = (id: string) => jobs.find((j) => j.id === id);

  const resume = (p: Pause) => {
    const yesterday = addDays(clock.today, -1);
    if (p.from > yesterday) store.deletePause(p.id);
    else store.savePause({ ...p, to: yesterday });
    toast('عاد العدّ للعمل');
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
          {greeting(
            settings.name,
            clock.today,
            Math.floor(clock.minutes / 60),
            todayOccs.map((o) => o.status),
          )}
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
              {j.name}
            </button>
          ))}
        </div>
      )}

      {recoveryCode && !settings.recoverySaved && (
        <div className="card banner">
          <span className="ic">
            <Icon.Key />
          </span>
          <div className="grow">
            <b>احفظي رمز الاسترجاع</b>
            <p>لترجع بياناتك إذا غيّرتِ الهاتف</p>
          </div>
          <div className="acts">
            <button className="btn sm" onClick={() => setOverlay({ kind: 'recovery' })}>
              عرض
            </button>
          </div>
        </div>
      )}

      {openPauses.map((p) => (
        <div className="card banner" key={p.id}>
          <span className="ic">
            <Icon.Pause />
          </span>
          <div className="grow">
            <b>العدّ متوقف</b>
            <p>
              {p.reason} · منذ {formatDateShort(p.from)}
              {p.jobIds.length > 0 && ` · ${p.jobIds.map((id) => jobOf(id)?.name).join('، ')}`}
            </p>
          </div>
          <div className="acts">
            <button className="btn sm" onClick={() => resume(p)}>
              استئناف
            </button>
          </div>
        </div>
      ))}

      {!geo && (
        <div className="card banner">
          <span className="ic">
            <Icon.Pin />
          </span>
          <div className="grow">
            <b>طقس مكانك</b>
            <p>ليتغيّر التطبيق مع الطقس حيث أنتِ</p>
          </div>
          <div className="acts">
            <button className="btn sm" onClick={() => setGeo('yes')}>
              سماح
            </button>
            <button className="btn sm ghost" onClick={() => setGeo('no')}>
              لا
            </button>
          </div>
        </div>
      )}

      {!settings.salaryAsked && (
        <div className="card banner">
          <span className="ic">
            <Icon.Wallet />
          </span>
          <div className="grow">
            <b>حساب الأجر؟</b>
            <p>بسعر الساعة، لكل شهر</p>
          </div>
          <div className="acts">
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
              لا
            </button>
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
            <div className="meta">{formatRange(period)}</div>
            <div className="progress">
              <div style={{ width: `${pct(periodT.doneMin, periodT.doneMin + periodT.upcomingMin)}%` }} />
            </div>
            {periodT.upcomingMin > 0 && <div className="meta">متبقي {formatHours(periodT.upcomingMin)}</div>}
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
            {(yearT.cancelled > 0 || yearT.extraMin > 0) && (
              <div className="meta">
                {yearT.cancelled > 0 && `${yearT.cancelled} ملغاة`}
                {yearT.cancelled > 0 && yearT.extraMin > 0 && ' · '}
                {yearT.extraMin > 0 && `تعويض ${formatHours(yearT.extraMin)}`}
              </div>
            )}
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
                    <span style={{ color: 'var(--accent-strong)' }}>أدخلي سعر الساعة</span>
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
          <div className="empty">لا حصص اليوم</div>
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
            const cls = ['cal-day'];
            if (d === clock.today) cls.push('today');
            if (paused) cls.push('paused');
            if (earliestStart && d < earliestStart) cls.push('before');
            const dayJobs = [...new Set(occs.map((o) => o.jobId))];
            return (
              <button key={d} className={cls.join(' ')} onClick={() => setDay(d)}>
                <span className="num">{parts(d).d}</span>
                <DayMark occs={occs} />
                {jobs.length > 1 && dayJobs.length > 0 && (
                  <span className="cal-jobs">
                    {dayJobs.map((id) => (
                      <i key={id} style={{ ['--c' as string]: jobOf(id)?.color }} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="legend">
          <b>معاني الرموز</b>
          <span>
            <Mark kind="done" /> تمّت
          </span>
          <span>
            <Mark kind="upcoming" /> قادمة
          </span>
          <span>
            <Mark kind="cancelled" /> ملغاة
          </span>
          <span>
            <Mark kind="holiday" /> عطلة
          </span>
          <span>
            <Mark kind="makeup" /> تعويض
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
      {overlay?.kind === 'recovery' && recoveryCode && <RecoverySheet code={recoveryCode} onClose={() => setOverlay(null)} />}
    </>
  );
}

/** The symbol under a day number: one clear mark plus the hours. */
function DayMark({ occs }: { occs: Occurrence[] }) {
  if (occs.length === 0) return null;
  const counted = occs.filter((o) => o.status === 'done' || o.status === 'upcoming');
  const doneMin = counted.filter((o) => o.status === 'done').reduce((s, o) => s + o.minutes, 0);
  const upMin = counted.filter((o) => o.status === 'upcoming').reduce((s, o) => s + o.minutes, 0);
  const cancelled = occs.some((o) => o.status === 'cancelled');
  const extra = counted.some((o) => o.source === 'makeup' || o.source === 'extra');

  if (counted.length === 0) {
    return <Mark kind={occs.every((o) => o.status === 'holiday') ? 'holiday' : 'cancelled'} />;
  }
  const corner = cancelled ? 'cancelled' : extra ? 'makeup' : null;
  return (
    <>
      <Mark kind={upMin > 0 && doneMin === 0 ? 'upcoming' : 'done'} />
      <span className={'cal-hours' + (upMin > 0 && doneMin === 0 ? ' upcoming' : '')}>
        {hoursNumber(doneMin + upMin)} س
      </span>
      {corner && <Mark kind={corner} className="cal-corner" />}
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
    toast(`سيتكرر جدول ${job.name} تلقائياً من ${formatDateShort(v.from)}`);
  };

  if (s.cycle > 0 && dismissed !== String(s.weekStarts.length)) {
    return (
      <div className="card banner stack">
        <span className="ic">
          <Icon.Spark />
        </span>
        <div className="grow">
          <b>فهمتُ طريقة عملك في «{job.name}»</b>
          <p>
            {s.cycle === 1 ? 'نفس الأسبوع يتكرر كل أسبوع.' : `عملك يدور كل ${s.cycle} أسابيع ثم يعود.`}
            {s.confirmations > 0 && ` تأكدتُ ${s.confirmations} مرة.`} أعمّره تلقائياً؟
          </p>
          <div className="acts">
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
      <span className="ic">
        <Icon.Pencil />
      </span>
      <div className="grow">
        <b>
          {job.name}: الأسبوع {weekNo}
        </b>
        <p>
          {s.weekStarts.length === 0
            ? 'أضيفي حصص أسبوعك الأول، وبعدها أكرّرها وحدي.'
            : 'واصلي التعمير، وسأقترح التكرار عندما أفهم الدورة.'}
        </p>
      </div>
      <div className="acts">
        <button className="btn sm soft" onClick={() => onAdd(store.clock.today)}>
          + حصة
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
    toast('تم الحفظ');
    goBack();
  };

  return (
    <Sheet onClose={onClose}>
      <h2>سعر الساعة</h2>
      <div className="sheet-sub">لكل عمل سعره الخاص · يمكن تغييره لاحقاً من الإعدادات</div>
      {store.jobs.map((j) => (
        <label className="field" key={j.id}>
          <span>{j.name}</span>
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
