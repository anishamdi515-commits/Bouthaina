import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { nowMinutes, todayStr } from '../lib/dates';
import type { Clock, Data } from '../lib/schedule';
import { DEFAULT_SETTINGS, type Entry, type Job, type Override, type Pause, type Settings } from '../lib/types';
import { jobFromDb, jobToDb, type StoredJob } from './codec';
import { SCHOOL_JOB } from './seed';

interface Store extends Data {
  user: User | null;
  authReady: boolean;
  loaded: boolean;
  loadError: string;
  settings: Settings;
  clock: Clock;
  saveSettings(patch: Partial<Settings>): void;
  saveJob(job: Job): void;
  deleteJob(id: string): void;
  saveOverride(o: Override): void;
  deleteOverride(id: string): void;
  saveEntry(e: Entry): void;
  deleteEntry(id: string): void;
  savePause(p: Pause): void;
  deletePause(id: string): void;
  importAll(data: Partial<Data> & { settings?: Settings }): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

// Development-only demo (`?demo`): in-memory data, no Firebase.
const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has('demo');

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

// Writes resolve only once the server confirms; offline they are queued, so
// never block the interface on them.
function fire(p: Promise<unknown>) {
  p.catch((err) => console.error('save failed', err));
}

function useClock(): Clock {
  const [clock, setClock] = useState<Clock>(() => ({ today: todayStr(), minutes: nowMinutes() }));
  useEffect(() => {
    const tick = () => {
      const next = { today: todayStr(), minutes: nowMinutes() };
      setClock((c) => (c.today === next.today && c.minutes === next.minutes ? c : next));
    };
    const id = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return clock;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pauses, setPauses] = useState<Pause[]>([]);
  const [loadError, setLoadError] = useState('');
  const clock = useClock();

  useEffect(() => {
    if (DEMO) {
      setUser({ uid: 'demo', email: 'demo@bothaina.app' } as User);
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (DEMO) {
      if (user) {
        setSettings(DEFAULT_SETTINGS);
        setJobs([SCHOOL_JOB]);
      }
      return;
    }
    setSettings(null);
    setLoadError('');
    setJobs([]);
    setOverrides([]);
    setEntries([]);
    setPauses([]);
    if (!user) return;
    const root = doc(db, 'users', user.uid);
    const onError = (err: { code?: string }) => {
      console.error('sync failed', err);
      setLoadError(err.code ?? 'unknown');
    };
    let seeded = false;
    const unsubs = [
      // Metadata changes are needed: for a new account the cached answer and
      // the server answer are both "no document", and only the metadata differs.
      onSnapshot(
        root,
        { includeMetadataChanges: true },
        (snap) => {
          if (snap.exists()) {
            setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings>) });
          } else if (!snap.metadata.fromCache && !seeded) {
            // Brand new account (confirmed by the server): start with the school timetable.
            seeded = true;
            try {
              const batch = writeBatch(db);
              batch.set(root, { ...DEFAULT_SETTINGS, createdAt: Date.now() });
              batch.set(doc(root, 'jobs', SCHOOL_JOB.id), jobToDb({ ...SCHOOL_JOB, createdAt: Date.now() }));
              batch.commit().catch(onError);
            } catch (err) {
              // Errors thrown inside a snapshot callback are swallowed; surface them.
              onError(err as { code?: string });
            }
          }
        },
        onError,
      ),
      onSnapshot(
        collection(root, 'jobs'),
        (s) =>
          setJobs(
            s.docs.map((d) => jobFromDb(d.data() as StoredJob)).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
          ),
        onError,
      ),
      onSnapshot(collection(root, 'overrides'), (s) => setOverrides(s.docs.map((d) => d.data() as Override)), onError),
      onSnapshot(collection(root, 'entries'), (s) => setEntries(s.docs.map((d) => d.data() as Entry)), onError),
      onSnapshot(collection(root, 'pauses'), (s) => setPauses(s.docs.map((d) => d.data() as Pause)), onError),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const store = useMemo<Store>(() => {
    const root = () => doc(db, 'users', user!.uid);
    type Row = { id: string };
    const setters: Record<string, (f: (rows: Row[]) => Row[]) => void> = {
      jobs: setJobs as never,
      overrides: setOverrides as never,
      entries: setEntries as never,
      pauses: setPauses as never,
    };
    const put = (col: string, id: string, value: object) =>
      DEMO
        ? setters[col]((rows) => [...rows.filter((r) => r.id !== id), value as Row])
        : fire(setDoc(doc(root(), col, id), value));
    const del = (col: string, id: string) =>
      DEMO ? setters[col]((rows) => rows.filter((r) => r.id !== id)) : fire(deleteDoc(doc(root(), col, id)));
    return {
      user,
      authReady,
      loaded: settings !== null,
      loadError,
      settings: settings ?? DEFAULT_SETTINGS,
      jobs,
      overrides,
      entries,
      pauses,
      clock,
      saveSettings: (patch) =>
        DEMO ? setSettings((x) => ({ ...(x ?? DEFAULT_SETTINGS), ...patch })) : fire(setDoc(root(), patch, { merge: true })),
      saveJob: (job) => put('jobs', job.id, DEMO ? job : jobToDb(job)),
      deleteJob: (id) => {
        if (DEMO) return del('jobs', id);
        const batch = writeBatch(db);
        batch.delete(doc(root(), 'jobs', id));
        overrides.filter((o) => o.jobId === id).forEach((o) => batch.delete(doc(root(), 'overrides', o.id)));
        entries.filter((e) => e.jobId === id).forEach((e) => batch.delete(doc(root(), 'entries', e.id)));
        fire(batch.commit());
      },
      saveOverride: (o) => put('overrides', o.id, o),
      deleteOverride: (id) => del('overrides', id),
      saveEntry: (e) => put('entries', e.id, e),
      deleteEntry: (id) => del('entries', id),
      savePause: (p) => put('pauses', p.id, p),
      deletePause: (id) => del('pauses', id),
      importAll: async (data) => {
        const items: [string, { id: string }][] = [
          ...(data.jobs ?? []).map((x) => ['jobs', jobToDb(jobFromDb(x as unknown as StoredJob))] as [string, { id: string }]),
          ...(data.overrides ?? []).map((x) => ['overrides', x] as [string, { id: string }]),
          ...(data.entries ?? []).map((x) => ['entries', x] as [string, { id: string }]),
          ...(data.pauses ?? []).map((x) => ['pauses', x] as [string, { id: string }]),
        ];
        // Firestore batches hold at most 500 writes.
        for (let i = 0; i < items.length; i += 450) {
          const batch = writeBatch(db);
          items.slice(i, i + 450).forEach(([col, x]) => batch.set(doc(root(), col, x.id), x));
          fire(batch.commit());
        }
        if (data.settings) fire(setDoc(root(), data.settings, { merge: true }));
      },
    };
  }, [user, authReady, settings, jobs, overrides, entries, pauses, clock, loadError]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
