import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../data/store';
import {
  addDays, formatDate, formatDateShort, formatHours, formatRange, monthStart, mondayOf, parts,
  payPeriodFor, schoolYearFor, WEEKDAYS, weekday, type Range,
} from '../lib/dates';
import { occurrences, totals } from '../lib/schedule';
import type { Job, Occurrence, Settings } from '../lib/types';
import { PageHead, toast } from '../components/ui';
import { money } from './Home';

type Preset = 'period' | 'prevPeriod' | 'week' | 'today' | 'year' | 'custom';

const PRESETS: [Preset, string][] = [
  ['period', 'هذا الشهر'],
  ['prevPeriod', 'الشهر الماضي'],
  ['week', 'هذا الأسبوع'],
  ['today', 'اليوم'],
  ['year', 'السنة الدراسية'],
  ['custom', 'فترة أختارها'],
];

export function ReportPage() {
  const store = useStore();
  const { settings, clock } = store;
  const [preset, setPreset] = useState<Preset>('period');
  const [custom, setCustom] = useState<Range>(() => ({ from: monthStart(parts(clock.today).y, parts(clock.today).m), to: clock.today }));
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [busy, setBusy] = useState(false);

  const range = useMemo<Range>(() => {
    const sd = settings.payStartDay;
    switch (preset) {
      case 'period':
        return payPeriodFor(clock.today, sd);
      case 'prevPeriod':
        return payPeriodFor(addDays(payPeriodFor(clock.today, sd).from, -1), sd);
      case 'week': {
        const mon = mondayOf(clock.today);
        return { from: mon, to: addDays(mon, 6) };
      }
      case 'today':
        return { from: clock.today, to: clock.today };
      case 'year':
        return schoolYearFor(clock.today, settings.yearStartMonth);
      case 'custom':
        return custom.to >= custom.from ? custom : { from: custom.from, to: custom.from };
    }
  }, [preset, custom, clock.today, settings.payStartDay, settings.yearStartMonth]);

  const jobs = jobIds.length ? store.jobs.filter((j) => jobIds.includes(j.id)) : store.jobs;

  useEffect(() => {
    let alive = true;
    const occs = occurrences(store, range, clock, jobs.map((j) => j.id));
    renderReport({ range, jobs, occs, settings, today: clock.today }).then((c) => alive && setPages(c));
    return () => {
      alive = false;
    };
  }, [range, jobIds.join(), store.jobs, store.overrides, store.entries, store.pauses, settings]);

  const toggleJob = (id: string) => setJobIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const exportPdf = async () => {
    if (!pages.length) return;
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      pages.forEach((c, i) => {
        if (i > 0) pdf.addPage();
        pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, PAGE_W, PAGE_H);
      });
      const blob = pdf.output('blob');
      const name = `${settings.name} - ${formatRange(range)}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
      const file = new File([blob], name, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name }).catch(() => undefined);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        toast('تم تحميل الملف');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="ملف PDF" />
      <div className="card">
        <div className="field">
          <span>الفترة</span>
          <div className="pills">
            {PRESETS.map(([k, label]) => (
              <button key={k} className={'pill' + (preset === k ? ' on' : '')} onClick={() => setPreset(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {preset === 'custom' && (
          <div className="row">
            <label className="field">
              <span>من</span>
              <input className="input" type="date" value={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
            </label>
            <label className="field">
              <span>إلى</span>
              <input className="input" type="date" value={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} />
            </label>
          </div>
        )}
        {store.jobs.length > 1 && (
          <div className="field">
            <span>الأعمال</span>
            <div className="pills">
              <button className={'pill' + (jobIds.length === 0 ? ' on' : '')} onClick={() => setJobIds([])}>
                الكل
              </button>
              {store.jobs.map((j) => (
                <button key={j.id} className={'pill' + (jobIds.includes(j.id) ? ' on' : '')} onClick={() => toggleJob(j.id)}>
                  {j.emoji} {j.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="muted small" style={{ margin: '0 0 12px' }}>
          {formatRange(range)} · {pages.length} صفحة
        </p>
        <button className="btn block" onClick={exportPdf} disabled={busy || !pages.length}>
          {busy ? 'جاري التحضير…' : '📄 حفظ / مشاركة PDF'}
        </button>
      </div>
      <div className="report-pages">
        {pages.map((c, i) => (
          <img key={i} src={c.toDataURL('image/jpeg', 0.8)} alt={`صفحة ${i + 1}`} />
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- canvas rendering

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const SCALE = 2.2;
const M = 36; // margin
const ROW = 21;

const INK = '#4b3048';
const SOFT = '#8d7289';
const ROSE = '#c9628a';
const LINE = '#f0dce5';

interface Col {
  key: string;
  title: string;
  w: number;
  ltr?: boolean;
}

const COLS: Col[] = [
  { key: 'date', title: 'التاريخ', w: 70 },
  { key: 'day', title: 'اليوم', w: 58 },
  { key: 'time', title: 'الوقت', w: 82, ltr: true },
  { key: 'label', title: 'القسم', w: 66 },
  { key: 'room', title: 'القاعة', w: 44 },
  { key: 'status', title: 'الحالة', w: 155 },
  { key: 'hours', title: 'المدة', w: 48 },
];

type Block =
  | { t: 'job'; job: Job; occs: Occurrence[] }
  | { t: 'head' }
  | { t: 'row'; o: Occurrence; i: number }
  | { t: 'total'; job: Job; occs: Occurrence[] };

function font(size: number, weight = 400, family = 'Tajawal') {
  return `${weight} ${size}px "${family}", "Tajawal", sans-serif`;
}

function fit(ctx: CanvasRenderingContext2D, s: string, w: number): string {
  if (ctx.measureText(s).width <= w) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(t + '…').width > w) t = t.slice(0, -1);
  return t + '…';
}

function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  opts: { align?: CanvasTextAlign; ltr?: boolean; max?: number } = {},
) {
  ctx.direction = opts.ltr ? 'ltr' : 'rtl';
  ctx.textAlign = opts.align ?? 'right';
  ctx.fillText(opts.max ? fit(ctx, s, opts.max) : s, x, y);
}

function statusText(o: Occurrence): [string, string] {
  const kind = o.source === 'makeup' ? 'تعويض' : o.source === 'extra' ? 'ساعة إضافية' : '';
  switch (o.status) {
    case 'done':
      return [kind ? `${kind} ✓` : 'تمّت ✓', '#3c9a73'];
    case 'upcoming':
      return [kind ? `${kind} (قادمة)` : 'قادمة', '#7d68b4'];
    case 'cancelled':
      return [`ملغاة: ${o.reason}${o.note ? ' — ' + o.note : ''}`, '#c9506d'];
    case 'holiday':
      return [`عطلة: ${o.reason}`, '#8f8090'];
  }
}

export async function renderReport(args: {
  range: Range;
  jobs: Job[];
  occs: Occurrence[];
  settings: Settings;
  today: string;
}): Promise<HTMLCanvasElement[]> {
  const { range, jobs, occs, settings, today } = args;
  try {
    await Promise.all([
      document.fonts.load(font(12)),
      document.fonts.load(font(12, 700)),
      document.fonts.load(font(20, 700, 'El Messiri')),
    ]);
  } catch {
    /* fall back to system font */
  }

  const all = totals(occs, jobs);
  const blocks: Block[] = [];
  for (const job of jobs) {
    const jo = occs.filter((o) => o.jobId === job.id);
    blocks.push({ t: 'job', job, occs: jo }, { t: 'head' });
    jo.forEach((o, i) => blocks.push({ t: 'row', o, i }));
    if (jo.length === 0) blocks.push({ t: 'row', o: null as unknown as Occurrence, i: -1 });
    blocks.push({ t: 'total', job, occs: jo });
  }

  const pages: HTMLCanvasElement[] = [];
  let ctx!: CanvasRenderingContext2D;
  let y = 0;
  let currentJob: Job | null = null;

  const newPage = () => {
    const c = document.createElement('canvas');
    c.width = Math.round(PAGE_W * SCALE);
    c.height = Math.round(PAGE_H * SCALE);
    ctx = c.getContext('2d')!;
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.textBaseline = 'middle';
    pages.push(c);
    y = M;
    if (pages.length === 1) drawCover();
  };

  const drawCover = () => {
    const g = ctx.createLinearGradient(0, 0, PAGE_W, 0);
    g.addColorStop(0, '#f9d3e0');
    g.addColorStop(1, '#efe0f7');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, PAGE_W, 112);
    ctx.fillStyle = INK;
    ctx.font = font(24, 700, 'El Messiri');
    text(ctx, `دفتر حصص ${settings.name} 🌸`, PAGE_W - M, 42);
    ctx.font = font(13, 500);
    ctx.fillStyle = SOFT;
    text(ctx, `${formatDate(range.from)} ← ${formatDate(range.to)}`, PAGE_W - M, 72);
    text(ctx, jobs.map((j) => `${j.emoji} ${j.name}`).join('   '), PAGE_W - M, 92);

    // summary boxes
    const boxes: [string, string][] = [
      ['ساعات منجزة', formatHours(all.doneMin)],
      ['حصص منجزة', String(all.doneCount)],
      ['ملغاة', String(all.cancelled)],
      ['تعويض وإضافي', formatHours(all.extraMin)],
    ];
    if (settings.salaryEnabled) boxes.push(['الأجر', `${money(all.money)} ${settings.currency}`]);
    const gap = 8;
    const bw = (PAGE_W - 2 * M - gap * (boxes.length - 1)) / boxes.length;
    boxes.forEach(([label, value], i) => {
      const x = PAGE_W - M - i * (bw + gap);
      ctx.fillStyle = '#fdf1f5';
      roundRect(ctx, x - bw, 126, bw, 54, 10);
      ctx.fill();
      ctx.fillStyle = SOFT;
      ctx.font = font(10, 500);
      text(ctx, label, x - bw / 2, 142, { align: 'center' });
      ctx.fillStyle = ROSE;
      ctx.font = font(15, 700);
      text(ctx, value, x - bw / 2, 162, { align: 'center', max: bw - 8 });
    });
    y = 200;
  };

  const drawHead = () => {
    ctx.fillStyle = '#faf3f6';
    ctx.fillRect(M, y, PAGE_W - 2 * M, ROW);
    ctx.fillStyle = SOFT;
    ctx.font = font(10, 700);
    let x = PAGE_W - M;
    for (const c of COLS) {
      text(ctx, c.title, x - 5, y + ROW / 2);
      x -= c.w;
    }
    y += ROW;
  };

  const footer = () => {
    pages.forEach((c, i) => {
      const k = c.getContext('2d')!;
      k.save();
      k.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      k.fillStyle = SOFT;
      k.font = font(9);
      k.textBaseline = 'middle';
      k.direction = 'rtl';
      k.textAlign = 'right';
      k.fillText(`بثينة 🌸 · أُنشئ يوم ${formatDate(today)}`, PAGE_W - M, PAGE_H - 20);
      k.textAlign = 'left';
      k.fillText(`صفحة ${i + 1} من ${pages.length}`, M, PAGE_H - 20);
      k.restore();
    });
  };

  newPage();
  const bottom = PAGE_H - 44;

  for (const b of blocks) {
    const h = b.t === 'job' ? 40 : b.t === 'total' ? 30 : ROW;
    // keep a job title with at least its header and one row
    const need = b.t === 'job' ? h + ROW * 2 : h;
    if (y + need > bottom) {
      newPage();
      if (b.t === 'row' && currentJob) {
        ctx.fillStyle = SOFT;
        ctx.font = font(11, 700);
        text(ctx, `${currentJob.emoji} ${currentJob.name} (تابع)`, PAGE_W - M, y + 8);
        y += 20;
        drawHead();
      }
    }

    if (b.t === 'job') {
      currentJob = b.job;
      y += 10;
      ctx.fillStyle = b.job.color;
      ctx.beginPath();
      ctx.arc(PAGE_W - M - 5, y + 14, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.font = font(15, 700, 'El Messiri');
      text(ctx, `${b.job.emoji} ${b.job.name}`, PAGE_W - M - 16, y + 14);
      y += 30;
    } else if (b.t === 'head') {
      drawHead();
    } else if (b.t === 'row') {
      if (!b.o) {
        ctx.fillStyle = SOFT;
        ctx.font = font(11);
        text(ctx, 'لا توجد حصص في هذه الفترة', PAGE_W / 2, y + ROW / 2, { align: 'center' });
        y += ROW;
        continue;
      }
      const o = b.o;
      if (b.i % 2 === 1) {
        ctx.fillStyle = '#fffafc';
        ctx.fillRect(M, y, PAGE_W - 2 * M, ROW);
      }
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(M, y + ROW);
      ctx.lineTo(PAGE_W - M, y + ROW);
      ctx.stroke();

      const counted = o.status === 'done' || o.status === 'upcoming';
      const [st, stColor] = statusText(o);
      const values: Record<string, string> = {
        date: formatDateShort(o.date),
        day: WEEKDAYS[weekday(o.date)],
        time: `${o.start} – ${o.end}`,
        label: o.label,
        room: o.room,
        status: st,
        hours: formatHours(o.minutes),
      };
      let x = PAGE_W - M;
      for (const c of COLS) {
        ctx.font = font(10.5, c.key === 'status' || c.key === 'hours' ? 700 : 400);
        ctx.fillStyle = c.key === 'status' ? stColor : c.key === 'hours' && !counted ? '#c7b8c3' : INK;
        if (c.ltr) text(ctx, values[c.key], x - c.w + 5, y + ROW / 2, { align: 'left', ltr: true, max: c.w - 8 });
        else text(ctx, values[c.key], x - 5, y + ROW / 2, { max: c.w - 8 });
        if (c.key === 'hours' && !counted) {
          const wdt = ctx.measureText(values.hours).width;
          ctx.strokeStyle = '#c7b8c3';
          ctx.beginPath();
          ctx.moveTo(x - 5 - wdt, y + ROW / 2);
          ctx.lineTo(x - 5, y + ROW / 2);
          ctx.stroke();
        }
        x -= c.w;
      }
      y += ROW;
    } else {
      const t = totals(b.occs, jobs);
      ctx.fillStyle = '#fdf1f5';
      roundRect(ctx, M, y + 5, PAGE_W - 2 * M, 22, 8);
      ctx.fill();
      ctx.fillStyle = ROSE;
      ctx.font = font(11, 700);
      const parts2 = [`المجموع: ${formatHours(t.doneMin)}`, `${t.doneCount} حصة`];
      if (t.cancelled) parts2.push(`${t.cancelled} ملغاة`);
      if (t.holiday) parts2.push(`${t.holiday} في عطلة`);
      if (t.upcomingMin) parts2.push(`قادمة ${formatHours(t.upcomingMin)}`);
      if (settings.salaryEnabled && b.job.rate) parts2.push(`${money(t.money)} ${settings.currency}`);
      text(ctx, parts2.join('  ·  '), PAGE_W - M - 10, y + 16);
      y += 34;
    }
  }

  footer();
  return pages;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
