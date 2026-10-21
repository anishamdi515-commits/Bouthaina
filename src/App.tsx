import { useEffect, useState, type ReactNode } from 'react';
import { StoreProvider, useStore } from './data/store';
import { useLocal } from './lib/local';
import type { ScheduleVersion } from './lib/types';
import { isDarkSky, Sky, skyColors, type SkyScene } from './sky/Sky';
import { seasonOf, useWeather, type Condition, type Season, type Weather } from './sky/weather';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { Toaster, useBackLayer } from './components/ui';
import { AuthScreen } from './screens/Auth';
import { Home } from './screens/Home';
import { ReportPage } from './screens/Report';
import { ScheduleEditor } from './screens/ScheduleEditor';
import { JobPage, PausesPage, SettingsPage } from './screens/Settings';

export type Route =
  | { name: 'settings' }
  | { name: 'job'; id: string }
  | { name: 'schedule'; jobId: string; versionId?: string; draft?: ScheduleVersion }
  | { name: 'pauses' }
  | { name: 'report' };

function sceneFor(weather: Weather, preview: string): SkyScene {
  const season = seasonOf();
  const base: SkyScene = { cond: weather.cond, isDay: weather.isDay, season, temp: weather.temp };
  if (!preview) return base;
  const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
  if (seasons.includes(preview as Season)) return { cond: 'clear', isDay: true, season: preview as Season, temp: 22 };
  if (preview === 'night') return { ...base, cond: 'clear', isDay: false };
  if (preview === 'hot') return { ...base, cond: 'clear', isDay: true, temp: 34 };
  return { ...base, cond: preview as Condition, isDay: true, temp: preview === 'clear' ? 22 : base.temp };
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const store = useStore();
  const [geo] = useLocal('b-geo');
  const [preview] = useLocal('b-preview');
  const weather = useWeather(Boolean(store.user), geo === 'yes');
  const scene = sceneFor(weather, preview);
  const dark = isDarkSky(scene);

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', skyColors(scene)[0]);
  }, [scene.cond, scene.isDay, scene.season, scene.temp]);

  return (
    <>
      <Sky scene={scene} animate={store.settings.animations} />
      <div className={'app' + (dark ? ' dark-sky' : '')} style={{ ['--sky-ink' as string]: dark ? '#fff6fb' : '#4b3048' }}>
        {!store.authReady ? <Loading /> : !store.user ? <AuthScreen /> : !store.loaded ? <Loading slow /> : <Main weather={preview ? { ...weather, cond: scene.cond, isDay: scene.isDay, temp: scene.temp, live: true } : weather} />}
      </div>
      <Toaster />
    </>
  );
}

function Loading({ slow }: { slow?: boolean }) {
  const { loadError } = useStore();
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="loading">
      <div>
        <span className="flower">🌸</span>
        {slow && loadError ? (
          <div className="card" style={{ marginTop: 16 }}>
            <p style={{ marginTop: 0 }}>تعذّر تحميل البيانات</p>
            <p className="muted small" dir="ltr">
              {loadError}
            </p>
            <div className="row">
              <button className="btn" onClick={() => location.reload()}>
                إعادة المحاولة
              </button>
              <button className="btn ghost" onClick={() => signOut(auth)}>
                تسجيل الخروج
              </button>
            </div>
          </div>
        ) : (
          slow && late && <p>أول مرة على هذا الهاتف؟ تحتاجين الإنترنت لتحميل بياناتك.</p>
        )}
      </div>
    </div>
  );
}

function Main({ weather }: { weather: Weather }) {
  const [stack, setStack] = useState<Route[]>([]);
  const nav = (r: Route, replace = false) => setStack((s) => (replace ? [...s.slice(0, -1), r] : [...s, r]));
  const top = stack[stack.length - 1];

  useEffect(() => window.scrollTo(0, 0), [stack.length, top]);

  return (
    <>
      <div style={{ display: top ? 'none' : undefined }}>
        <Home weather={weather} onSettings={() => nav({ name: 'settings' })} onReport={() => nav({ name: 'report' })} />
      </div>
      {stack.map((r, i) => (
        <Page key={`${i}-${r.name}`} visible={i === stack.length - 1} onBack={() => setStack((s) => s.slice(0, i))}>
          {r.name === 'settings' && <SettingsPage nav={nav} />}
          {r.name === 'job' && <JobPage id={r.id} nav={nav} />}
          {r.name === 'schedule' && <ScheduleEditor jobId={r.jobId} versionId={r.versionId} draft={r.draft} />}
          {r.name === 'pauses' && <PausesPage />}
          {r.name === 'report' && <ReportPage />}
        </Page>
      ))}
    </>
  );
}

function Page({ visible, onBack, children }: { visible: boolean; onBack: () => void; children: ReactNode }) {
  useBackLayer(onBack);
  return <div style={{ display: visible ? undefined : 'none' }}>{children}</div>;
}
