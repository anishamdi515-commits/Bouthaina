import { useEffect, useRef, useState, type ReactNode } from 'react';

// ---------------------------------------------------------------- back handling
// Every open page or sheet pushes a history entry, so the Android back button
// (and history.back()) closes the top-most layer instead of leaving the app.

let ignorePops = 0;
let depth = 0; // history entries we pushed and that are still there
const layers: { close: () => void }[] = [];

window.addEventListener('popstate', () => {
  if (ignorePops > 0) {
    ignorePops--;
    return;
  }
  depth = Math.max(0, depth - 1);
  layers.pop()?.close();
});

export function useBackLayer(onBack: () => void) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    const entry = { close: () => ref.current() };
    layers.push(entry);
    // Reuse the entry of a layer that was just replaced instead of pushing.
    if (depth < layers.length) {
      history.pushState({ layer: layers.length }, '');
      depth++;
    }
    return () => {
      const i = layers.indexOf(entry);
      if (i === -1) return; // closed through the back button
      layers.splice(i, 1);
      setTimeout(() => {
        if (depth > layers.length) {
          depth--;
          ignorePops++;
          history.back();
        }
      }, 0);
    };
  }, []);
}

export function goBack() {
  history.back();
}

// ---------------------------------------------------------------- sheet

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useBackLayer(onClose);
  return (
    <div className="overlay" onClick={goBack}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- toast

type Listener = (msg: string) => void;
const toastListeners = new Set<Listener>();

export function toast(msg: string) {
  toastListeners.forEach((l) => l(msg));
}

export function Toaster() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const l: Listener = (m) => {
      setMsg(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(''), 2200);
    };
    toastListeners.add(l);
    return () => {
      toastListeners.delete(l);
      clearTimeout(timer);
    };
  }, []);
  return msg ? <div className="toast">{msg}</div> : null;
}

// ---------------------------------------------------------------- small pieces

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function PageHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <button className="icon-btn" onClick={goBack} aria-label="رجوع">
        <Icon.Back />
      </button>
      <h1>{title}</h1>
      {action}
    </div>
  );
}

const svg = (path: ReactNode) => () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

export const Icon = {
  Gear: svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>,
  ),
  Doc: svg(
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </>,
  ),
  Prev: svg(<path d="M9 18l6-6-6-6" />),
  Next: svg(<path d="M15 18l-6-6 6-6" />),
  Back: svg(<path d="M5 12h14M13 5l7 7-7 7" />),
  Plus: svg(<path d="M12 5v14M5 12h14" />),
  Chevron: svg(<path d="M15 18l-6-6 6-6" />),
  Pin: svg(
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>,
  ),
  Wallet: svg(
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M16 12.5h2M3 10h18" />
    </>,
  ),
  Pause: svg(<path d="M9 6v12M15 6v12" />),
  Spark: svg(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />),
  Pencil: svg(<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />),
};
