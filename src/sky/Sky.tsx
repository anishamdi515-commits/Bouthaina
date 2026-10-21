import { useEffect, useRef } from 'react';
import type { Condition, Season } from './weather';

export interface SkyScene {
  cond: Condition;
  isDay: boolean;
  season: Season;
  temp: number | null;
}

// ---------------------------------------------------------------- palettes

export function skyColors(s: SkyScene): string[] {
  if (!s.isDay) {
    if (s.cond === 'clear') return ['#2a1d48', '#55397a', '#9c6fa3'];
    if (s.cond === 'rain' || s.cond === 'storm') return ['#26233a', '#47405f', '#6f6488'];
    if (s.cond === 'snow') return ['#3a3a5c', '#6b6a8e', '#a7a3c4'];
    return ['#342b4c', '#5d4f78', '#8d7aa0'];
  }
  switch (s.cond) {
    case 'rain':
      return ['#a9a6c8', '#cbc5df', '#e9e2ef'];
    case 'storm':
      return ['#7f789f', '#aaa2c6', '#d6cfe4'];
    case 'snow':
      return ['#b9c7e6', '#d7def0', '#eef0f8'];
    case 'fog':
      return ['#d9d3df', '#e8e3ea', '#f5f1f4'];
    case 'clouds':
      return ['#d8cce8', '#eadff0', '#f8f0f5'];
  }
  if (s.temp !== null && s.temp >= 28) return ['#ffc2a6', '#ffdcc6', '#fff1e8'];
  switch (s.season) {
    case 'spring':
      return ['#bfe0fb', '#f8d8e6', '#fff2f6'];
    case 'summer':
      return ['#a9dcf7', '#ffe0cc', '#fff4ea'];
    case 'autumn':
      return ['#f6c9b8', '#fbdcd0', '#fff2ec'];
    case 'winter':
      return ['#c3d3ef', '#e2e3f3', '#f9f2f7'];
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

const LEAVES = ['#e39a5f', '#d4724f', '#efbf6f', '#c4643f', '#e8855f'];
const PETALS = ['#f7b3c7', '#f9c9d6', '#f19ab5', '#fde0e9', '#f6a8c0'];
const SPARKS = ['#ffd27a', '#ffe7a8', '#ffc0a0', '#fff1c9'];

function build(s: SkyScene, w: number, h: number): P[] {
  const k = Math.max(0.6, Math.min(1.8, (w * h) / (420 * 900)));
  const ps: P[] = [];
  const add = (n: number, f: () => P) => {
    for (let i = 0; i < Math.round(n * k); i++) ps.push(f());
  };
  const wet = s.cond === 'rain' || s.cond === 'storm';

  // stars
  if (!s.isDay && (s.cond === 'clear' || s.cond === 'clouds')) {
    add(s.cond === 'clear' ? 70 : 25, () => ({
      kind: 'star', x: rand(0, w), y: rand(0, h * 0.6), vx: 0, vy: 0, r: rand(0.6, 1.8),
      a: rand(0, Math.PI * 2), va: rand(0.6, 2), c: '#fff',
    }));
  }

  // clouds
  const clouds = s.cond === 'clear' ? (s.isDay ? 2 : 1) : s.cond === 'fog' ? 0 : wet ? 6 : s.cond === 'snow' ? 4 : 5;
  for (let i = 0; i < clouds; i++) {
    ps.push({
      kind: 'cloud', x: rand(-100, w), y: rand(h * 0.02, h * (wet ? 0.3 : 0.35)), vx: rand(4, 12), vy: 0,
      r: rand(40, 80), a: Math.random(), va: 0, c: '',
    });
  }

  // fog bands
  if (s.cond === 'fog') {
    for (let i = 0; i < 7; i++) {
      ps.push({ kind: 'fog', x: rand(-w, w), y: rand(0, h), vx: rand(6, 16), vy: 0, r: rand(120, 220), a: 0, va: 0, c: '' });
    }
  }

  // precipitation
  if (wet) {
    add(s.cond === 'storm' ? 190 : 120, () => ({
      kind: 'rain', x: rand(0, w), y: rand(-h, h), vx: -60, vy: rand(650, 900), r: rand(10, 20),
      a: 0, va: 0, c: '',
    }));
  }
  if (s.cond === 'snow') {
    add(110, () => ({
      kind: 'snow', x: rand(0, w), y: rand(-h, h), vx: 0, vy: rand(25, 60), r: rand(1.5, 4),
      a: rand(0, 6), va: rand(0.5, 1.5), c: '#fff',
    }));
  }

  // seasonal decoration
  const decor = wet || s.cond === 'snow' ? 0.35 : 1;
  if (s.season === 'autumn') {
    add(12 * decor, () => ({
      kind: 'leaf', x: rand(0, w), y: rand(-h, h), vx: rand(-15, 15), vy: rand(25, 55), r: rand(7, 12),
      a: rand(0, 6), va: rand(-1.5, 1.5), c: pick(LEAVES),
    }));
  } else if (s.season === 'spring') {
    add(16 * decor, () => ({
      kind: 'petal', x: rand(0, w), y: rand(-h, h), vx: rand(-25, -5), vy: rand(20, 45), r: rand(5, 8),
      a: rand(0, 6), va: rand(-2, 2), c: pick(PETALS),
    }));
  } else if (s.season === 'summer') {
    add(16 * decor, () => ({
      kind: 'spark', x: rand(0, w), y: rand(0, h), vx: rand(-5, 5), vy: rand(-18, -6), r: rand(2, 5),
      a: rand(0, 6), va: rand(1, 2.5), c: pick(SPARKS),
    }));
  } else if (s.cond !== 'snow') {
    add(28 * decor, () => ({
      kind: 'snow', x: rand(0, w), y: rand(-h, h), vx: 0, vy: rand(15, 35), r: rand(1.2, 2.8),
      a: rand(0, 6), va: rand(0.5, 1.5), c: '#fff',
    }));
  }
  return ps;
}

// ---------------------------------------------------------------- drawing

function drawCloud(ctx: CanvasRenderingContext2D, p: P, s: SkyScene) {
  const wet = s.cond === 'rain' || s.cond === 'storm';
  const col = !s.isDay
    ? 'rgba(210,200,240,0.13)'
    : wet
      ? 'rgba(140,130,175,0.35)'
      : 'rgba(255,255,255,0.6)';
  ctx.fillStyle = col;
  const r = p.r;
  const blobs = [
    [0, 0, 1],
    [r * 0.9, r * 0.15, 0.8],
    [-r * 0.9, r * 0.2, 0.75],
    [r * 0.35, -r * 0.45, 0.85],
    [-r * 0.35, -r * 0.35, 0.7],
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
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(0, -p.r);
  ctx.quadraticCurveTo(p.r * 0.9, -p.r * 0.2, 0, p.r);
  ctx.quadraticCurveTo(-p.r * 0.9, -p.r * 0.2, 0, -p.r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,60,30,0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -p.r);
  ctx.lineTo(0, p.r * 1.25);
  ctx.stroke();
  ctx.restore();
}

function drawPetal(ctx: CanvasRenderingContext2D, p: P) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.a);
  ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(p.a * 1.7)));
  ctx.fillStyle = p.c;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, p.r);
  ctx.bezierCurveTo(p.r, p.r * 0.3, p.r * 0.7, -p.r, 0, -p.r * 0.6);
  ctx.bezierCurveTo(-p.r * 0.7, -p.r, -p.r, p.r * 0.3, 0, p.r);
  ctx.fill();
  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, w: number, t: number, warm: boolean) {
  const x = Math.min(90, w * 0.2);
  const y = 118;
  const g = ctx.createRadialGradient(x, y, 10, x, y, 150);
  g.addColorStop(0, warm ? 'rgba(255,214,150,0.95)' : 'rgba(255,236,190,0.95)');
  g.addColorStop(0.25, warm ? 'rgba(255,190,140,0.45)' : 'rgba(255,225,200,0.4)');
  g.addColorStop(1, 'rgba(255,220,200,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.05);
  ctx.fillStyle = 'rgba(255,236,200,0.22)';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(-5, 40);
    ctx.lineTo(5, 40);
    ctx.lineTo(0, 120 + 15 * Math.sin(t + i));
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = warm ? '#ffd39a' : '#fff0c8';
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoon(ctx: CanvasRenderingContext2D, w: number, top: string) {
  const x = Math.min(85, w * 0.2);
  const y = 115;
  const g = ctx.createRadialGradient(x, y, 10, x, y, 110);
  g.addColorStop(0, 'rgba(255,240,250,0.35)');
  g.addColorStop(1, 'rgba(255,240,250,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fdf1f7';
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.arc(x + 12, y - 8, 25, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- component

export function Sky({ scene, animate }: { scene: SkyScene; animate: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const colors = skyColors(scene);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const moving = animate && !reduce;
    let w = 0;
    let h = 0;
    let ps: P[] = [];
    let flash = 0;
    let nextFlash = rand(3, 8);
    let t = 0;
    let last = performance.now();
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
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
              p.y = rand(-60, -10);
              p.x = rand(0, w + 60);
            }
            break;
          case 'snow':
          case 'leaf':
          case 'petal':
            p.a += p.va * dt;
            p.x += (p.vx + Math.sin(t * 0.8 + p.r * 3) * (p.kind === 'snow' ? 12 : 22)) * dt;
            p.y += p.vy * dt;
            if (p.y > h + 20) {
              p.y = rand(-40, -10);
              p.x = rand(0, w);
            }
            if (p.x < -30) p.x = w + 20;
            if (p.x > w + 30) p.x = -20;
            break;
          case 'spark':
            p.a += p.va * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y < -10) {
              p.y = h + 10;
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
          nextFlash = rand(4, 10);
        }
        flash = Math.max(0, flash - dt * 2.5);
      }
    };

    const draw = () => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, colors[0]);
      g.addColorStop(0.45, colors[1]);
      g.addColorStop(1, colors[2]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (const p of ps) {
        if (p.kind !== 'star') continue;
        ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(p.a));
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (scene.isDay && (scene.cond === 'clear' || scene.cond === 'clouds')) {
        drawSun(ctx, w, t, scene.temp !== null && scene.temp >= 28);
      } else if (!scene.isDay && (scene.cond === 'clear' || scene.cond === 'clouds')) {
        drawMoon(ctx, w, colors[0]);
      }

      for (const p of ps) {
        if (p.kind === 'cloud') drawCloud(ctx, p, scene);
        else if (p.kind === 'fog') {
          const fg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          fg.addColorStop(0, 'rgba(255,255,255,0.55)');
          fg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = fg;
          ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
      }

      const night = !scene.isDay;
      ctx.lineCap = 'round';
      ctx.strokeStyle = night ? 'rgba(220,215,255,0.4)' : 'rgba(95,85,160,0.38)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const p of ps) {
        if (p.kind !== 'rain') continue;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + (p.vx / p.vy) * p.r, p.y + p.r);
      }
      ctx.stroke();

      for (const p of ps) {
        if (p.kind === 'snow') {
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.shadowColor = 'rgba(120,130,190,0.45)';
          ctx.shadowBlur = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (p.kind === 'leaf') drawLeaf(ctx, p);
        else if (p.kind === 'petal') drawPetal(ctx, p);
        else if (p.kind === 'spark') {
          const a = 0.35 + 0.45 * Math.abs(Math.sin(p.a));
          const sg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
          sg.addColorStop(0, p.c);
          sg.addColorStop(1, 'rgba(255,230,180,0)');
          ctx.globalAlpha = a;
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.55})`;
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
