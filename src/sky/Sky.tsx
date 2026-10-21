import { useEffect, useRef } from 'react';
import type { Condition, Season } from './weather';

export interface SkyScene {
  cond: Condition;
  isDay: boolean;
  season: Season;
  temp: number | null;
}

const PAGE_BG = '#f8f6f7';

// ---------------------------------------------------------------- palettes

/** Top and middle colours of the header sky; it always fades into the page. */
export function skyColors(s: SkyScene): [string, string] {
  if (!s.isDay) {
    if (s.cond === 'rain' || s.cond === 'storm') return ['#25283a', '#4a4d63'];
    if (s.cond === 'snow') return ['#353a55', '#636986'];
    if (s.cond === 'clear') return ['#1f2340', '#454769'];
    return ['#2b2c42', '#535369'];
  }
  switch (s.cond) {
    case 'rain':
      return ['#b4b9cb', '#d9dce5'];
    case 'storm':
      return ['#979bb1', '#c9ccd8'];
    case 'snow':
      return ['#cfd9e8', '#e8ecf3'];
    case 'fog':
      return ['#dddbdf', '#ecebed'];
    case 'clouds':
      return ['#d9dbe6', '#ebebf1'];
  }
  if (s.temp !== null && s.temp >= 28) return ['#f5d3bf', '#f9e9df'];
  switch (s.season) {
    case 'spring':
      return ['#cde3f5', '#eef0f6'];
    case 'summer':
      return ['#c5e3f5', '#f2eee8'];
    case 'autumn':
      return ['#efd9cc', '#f5ebe5'];
    case 'winter':
      return ['#d6e0ee', '#ecf0f5'];
  }
}

export function isDarkSky(s: SkyScene): boolean {
  return !s.isDay;
}

// ---------------------------------------------------------------- particles

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number; // rotation / phase
  va: number;
  c: string;
  kind: 'rain' | 'snow' | 'leaf' | 'petal' | 'spark' | 'star' | 'cloud' | 'fog';
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const LEAVES = ['#d99a6c', '#c98060', '#e2b77a'];
const PETALS = ['#efbccb', '#f3cdd8', '#e9aabd'];
const SPARKS = ['#f6d58e', '#f8e3b0'];

function build(s: SkyScene, w: number, h: number): P[] {
  const k = Math.max(0.7, Math.min(1.6, w / 420));
  const ps: P[] = [];
  const add = (n: number, f: () => P) => {
    for (let i = 0; i < Math.round(n * k); i++) ps.push(f());
  };
  const wet = s.cond === 'rain' || s.cond === 'storm';

  if (!s.isDay && (s.cond === 'clear' || s.cond === 'clouds')) {
    add(s.cond === 'clear' ? 35 : 12, () => ({
      kind: 'star', x: rand(0, w), y: rand(0, h * 0.65), vx: 0, vy: 0, r: rand(0.5, 1.4),
      a: rand(0, Math.PI * 2), va: rand(0.4, 1.2), c: '#fff',
    }));
  }

  const clouds = s.cond === 'clear' ? (s.isDay ? 1 : 0) : s.cond === 'fog' ? 0 : s.cond === 'snow' ? 2 : 3;
  for (let i = 0; i < clouds; i++) {
    ps.push({
      kind: 'cloud', x: rand(-60, w), y: rand(h * 0.08, h * 0.32), vx: rand(3, 7), vy: 0,
      r: rand(26, 44), a: 0, va: 0, c: '',
    });
  }

  if (s.cond === 'fog') {
    for (let i = 0; i < 4; i++) {
      ps.push({ kind: 'fog', x: rand(-w, w), y: rand(h * 0.1, h * 0.6), vx: rand(5, 10), vy: 0, r: rand(110, 180), a: 0, va: 0, c: '' });
    }
  }

  if (wet) {
    add(s.cond === 'storm' ? 90 : 55, () => ({
      kind: 'rain', x: rand(0, w), y: rand(-h, h), vx: -40, vy: rand(500, 680), r: rand(8, 14), a: 0, va: 0, c: '',
    }));
  }
  if (s.cond === 'snow') {
    add(45, () => ({
      kind: 'snow', x: rand(0, w), y: rand(-h, h), vx: 0, vy: rand(18, 38), r: rand(1.4, 3), a: rand(0, 6), va: 0, c: '#fff',
    }));
  }

  // A few seasonal touches, only when the weather itself is calm.
  if (!wet && s.cond !== 'snow') {
    if (s.season === 'autumn') {
      add(5, () => ({
        kind: 'leaf', x: rand(0, w), y: rand(-h, h), vx: rand(-10, 10), vy: rand(16, 30), r: rand(5, 7.5),
        a: rand(0, 6), va: rand(-1, 1), c: pick(LEAVES),
      }));
    } else if (s.season === 'spring') {
      add(6, () => ({
        kind: 'petal', x: rand(0, w), y: rand(-h, h), vx: rand(-14, -4), vy: rand(14, 26), r: rand(4, 6),
        a: rand(0, 6), va: rand(-1.4, 1.4), c: pick(PETALS),
      }));
    } else if (s.season === 'summer') {
      add(6, () => ({
        kind: 'spark', x: rand(0, w), y: rand(0, h), vx: rand(-4, 4), vy: rand(-10, -4), r: rand(2, 3.5),
        a: rand(0, 6), va: rand(0.8, 1.6), c: pick(SPARKS),
      }));
    } else {
      add(14, () => ({
        kind: 'snow', x: rand(0, w), y: rand(-h, h), vx: 0, vy: rand(12, 24), r: rand(1.1, 2.2), a: rand(0, 6), va: 0, c: '#fff',
      }));
    }
  }
  return ps;
}

// ---------------------------------------------------------------- drawing

function drawCloud(ctx: CanvasRenderingContext2D, p: P, s: SkyScene) {
  const wet = s.cond === 'rain' || s.cond === 'storm';
  ctx.fillStyle = !s.isDay ? 'rgba(220,215,240,0.10)' : wet ? 'rgba(150,150,180,0.28)' : 'rgba(255,255,255,0.55)';
  const r = p.r;
  const blobs: [number, number, number][] = [
    [0, 0, 1],
    [r * 0.95, r * 0.2, 0.75],
    [-r * 0.95, r * 0.25, 0.7],
    [r * 0.3, -r * 0.4, 0.8],
  ];
  ctx.beginPath();
  for (const [dx, dy, sc] of blobs) {
    ctx.moveTo(p.x + dx + r * sc, p.y + dy);
    ctx.arc(p.x + dx, p.y + dy, r * sc, 0, Math.PI * 2);
  }
  ctx.fill();
}

function drawLeaf(ctx: CanvasRenderingContext2D, p: P) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.a);
  ctx.fillStyle = p.c;
  ctx.beginPath();
  ctx.moveTo(0, -p.r);
  ctx.quadraticCurveTo(p.r * 0.85, 0, 0, p.r);
  ctx.quadraticCurveTo(-p.r * 0.85, 0, 0, -p.r);
  ctx.fill();
  ctx.restore();
}

function drawPetal(ctx: CanvasRenderingContext2D, p: P) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.a);
  ctx.scale(1, 0.6 + 0.4 * Math.abs(Math.cos(p.a * 1.5)));
  ctx.fillStyle = p.c;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.r * 0.6, p.r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, w: number, warm: boolean) {
  const x = Math.min(76, w * 0.17);
  const y = 112;
  const g = ctx.createRadialGradient(x, y, 8, x, y, 80);
  g.addColorStop(0, warm ? 'rgba(255,214,160,0.75)' : 'rgba(255,240,205,0.75)');
  g.addColorStop(1, 'rgba(255,240,215,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = warm ? '#ffd9a6' : '#fff1cf';
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoon(ctx: CanvasRenderingContext2D, w: number, top: string) {
  const x = Math.min(72, w * 0.17);
  const y = 110;
  ctx.fillStyle = '#f4efe6';
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.arc(x + 8, y - 6, 16, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- component

export function Sky({ scene, animate }: { scene: SkyScene; animate: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const [top, mid] = skyColors(scene);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const moving = animate && !reduce;
    let w = 0;
    let h = 0;
    let ps: P[] = [];
    let flash = 0;
    let nextFlash = rand(4, 9);
    let t = 0;
    let last = performance.now();
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width || window.innerWidth;
      h = rect.height || 300;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ps = build(scene, w, h);
    };

    const step = (dt: number) => {
      t += dt;
      for (const p of ps) {
        switch (p.kind) {
          case 'rain':
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y > h) {
              p.y = rand(-40, -10);
              p.x = rand(0, w + 40);
            }
            break;
          case 'snow':
          case 'leaf':
          case 'petal':
            p.a += p.va * dt;
            p.x += (p.vx + Math.sin(t * 0.7 + p.r * 3) * (p.kind === 'snow' ? 8 : 14)) * dt;
            p.y += p.vy * dt;
            if (p.y > h) {
              p.y = rand(-30, -8);
              p.x = rand(0, w);
            }
            if (p.x < -20) p.x = w + 10;
            if (p.x > w + 20) p.x = -10;
            break;
          case 'spark':
            p.a += p.va * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y < -10) {
              p.y = h;
              p.x = rand(0, w);
            }
            break;
          case 'star':
            p.a += p.va * dt;
            break;
          case 'cloud':
          case 'fog':
            p.x += p.vx * dt;
            if (p.x - p.r * 2 > w) p.x = -p.r * 2;
            break;
        }
      }
      if (scene.cond === 'storm') {
        nextFlash -= dt;
        if (nextFlash <= 0) {
          flash = 1;
          nextFlash = rand(6, 12);
        }
        flash = Math.max(0, flash - dt * 3);
      }
    };

    // Particles fade out towards the bottom so content stays calm.
    const fadeAt = (y: number) => Math.max(0, Math.min(1, 1 - (y - h * 0.45) / (h * 0.45)));

    const draw = () => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, top);
      g.addColorStop(0.5, mid);
      g.addColorStop(1, PAGE_BG);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (const p of ps) {
        if (p.kind !== 'star') continue;
        ctx.globalAlpha = (0.4 + 0.5 * Math.abs(Math.sin(p.a))) * fadeAt(p.y);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (scene.cond === 'clear' || scene.cond === 'clouds') {
        if (scene.isDay) drawSun(ctx, w, scene.temp !== null && scene.temp >= 28);
        else drawMoon(ctx, w, top);
      }

      for (const p of ps) {
        if (p.kind === 'cloud') drawCloud(ctx, p, scene);
        else if (p.kind === 'fog') {
          const fg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          fg.addColorStop(0, 'rgba(255,255,255,0.45)');
          fg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = fg;
          ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
      }

      ctx.lineCap = 'round';
      ctx.lineWidth = 1;
      const rainColor = scene.isDay ? '90,95,140' : '215,215,240';
      for (const p of ps) {
        if (p.kind !== 'rain') continue;
        ctx.strokeStyle = `rgba(${rainColor},${0.35 * fadeAt(p.y)})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + (p.vx / p.vy) * p.r, p.y + p.r);
        ctx.stroke();
      }

      for (const p of ps) {
        const a = fadeAt(p.y);
        if (a <= 0) continue;
        if (p.kind === 'snow') {
          ctx.globalAlpha = 0.9 * a;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'leaf') {
          ctx.globalAlpha = 0.7 * a;
          drawLeaf(ctx, p);
        } else if (p.kind === 'petal') {
          ctx.globalAlpha = 0.75 * a;
          drawPetal(ctx, p);
        } else if (p.kind === 'spark') {
          ctx.globalAlpha = (0.25 + 0.35 * Math.abs(Math.sin(p.a))) * a;
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`;
        ctx.fillRect(0, 0, w, h);
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.visibilityState === 'visible') {
        step(dt);
        draw();
      }
      raf = requestAnimationFrame(loop);
    };

    resize();
    step(0);
    draw();
    if (moving) raf = requestAnimationFrame(loop);
    const onResize = () => {
      resize();
      draw();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [scene.cond, scene.isDay, scene.season, scene.temp, animate]);

  return <canvas ref={ref} className="sky" aria-hidden="true" />;
}
