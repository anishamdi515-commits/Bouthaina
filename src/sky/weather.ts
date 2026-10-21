import { useEffect, useState } from 'react';

export type Condition = 'clear' | 'clouds' | 'rain' | 'storm' | 'snow' | 'fog';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface Weather {
  cond: Condition;
  isDay: boolean;
  temp: number | null;
  city: string;
  live: boolean; // false = guessed from season/time (offline)
}

interface Coords {
  lat: number;
  lon: number;
  city: string;
  t: number;
  gps: boolean;
}

const COORDS_KEY = 'b-coords';
const WEATHER_KEY = 'b-weather';
const COORDS_TTL = 6 * 3600_000;
const WEATHER_TTL = 20 * 60_000;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function seasonOf(date = new Date()): Season {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

export const SEASON_LABEL: Record<Season, string> = {
  spring: 'ربيع',
  summer: 'صيف',
  autumn: 'خريف',
  winter: 'شتاء',
};

export const CONDITION_LABEL: Record<Condition, string> = {
  clear: 'صحو',
  clouds: 'غائم',
  rain: 'ممطر',
  storm: 'عاصفة رعدية',
  snow: 'ثلج',
  fog: 'ضباب',
};

function fromWmo(code: number): Condition {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'clouds';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51 && code <= 82) return 'rain';
  return 'clouds';
}

function guessDay(): boolean {
  const h = new Date().getHours();
  return h >= 6 && h < 19;
}

function position(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      { maximumAge: COORDS_TTL, timeout: 15_000, enableHighAccuracy: false },
    );
  });
}

async function cityName(lat: number, lon: number): Promise<string> {
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ar`,
    );
    const j = await r.json();
    return j.city || j.locality || j.principalSubdivision || '';
  } catch {
    return '';
  }
}

async function locate(useGps: boolean): Promise<Coords | null> {
  const cached = read<Coords>(COORDS_KEY);
  if (cached && Date.now() - cached.t < COORDS_TTL && (cached.gps || !useGps)) return cached;
  try {
    if (!useGps) throw new Error('approximate only');
    const p = await position();
    const c = { ...p, city: await cityName(p.lat, p.lon), t: Date.now(), gps: true };
    write(COORDS_KEY, c);
    return c;
  } catch {
    // Location refused or unavailable: approximate it from the connection.
    try {
      const r = await fetch('https://get.geojs.io/v1/ip/geo.json');
      const j = await r.json();
      const lat = Number(j.latitude);
      const lon = Number(j.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return cached;
      const c = { lat, lon, city: await cityName(lat, lon), t: Date.now(), gps: false };
      write(COORDS_KEY, c);
      return c;
    } catch {
      return cached;
    }
  }
}

async function fetchWeather(useGps: boolean): Promise<Weather | null> {
  const cached = read<Weather & { t: number; gps: boolean }>(WEATHER_KEY);
  if (cached && Date.now() - cached.t < WEATHER_TTL && (cached.gps || !useGps)) return cached;
  const c = await locate(useGps);
  if (!c) return cached;
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code,is_day&timezone=auto`,
    );
    const j = await r.json();
    const w: Weather = {
      cond: fromWmo(j.current.weather_code),
      isDay: j.current.is_day === 1,
      temp: Math.round(j.current.temperature_2m),
      city: c.city,
      live: true,
    };
    write(WEATHER_KEY, { ...w, t: Date.now(), gps: c.gps });
    return w;
  } catch {
    return cached;
  }
}

/** Live weather where she is. `useGps` asks for the exact location. */
export function useWeather(enabled: boolean, useGps: boolean): Weather {
  const [w, setW] = useState<Weather>(() => {
    const cached = read<Weather>(WEATHER_KEY);
    return cached ?? { cond: 'clear', isDay: guessDay(), temp: null, city: '', live: false };
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const refresh = () =>
      fetchWeather(useGps).then((next) => {
        if (alive && next) setW(next);
        else if (alive) setW((cur) => ({ ...cur, isDay: guessDay() }));
      });
    refresh();
    const id = setInterval(refresh, WEATHER_TTL);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, useGps]);

  return w;
}
