import { useCallback, useEffect, useState } from 'react';

// Per-device preferences (not synced): remembered filter, location choice…

const listeners = new Map<string, Set<(v: string) => void>>();

export function getLocal(key: string, fallback = ''): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
  listeners.get(key)?.forEach((l) => l(value));
}

export function useLocal(key: string, fallback = ''): [string, (v: string) => void] {
  const [value, setValue] = useState(() => getLocal(key, fallback));
  useEffect(() => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    const set = listeners.get(key)!;
    set.add(setValue);
    return () => {
      set.delete(setValue);
    };
  }, [key]);
  const update = useCallback((v: string) => setLocal(key, v), [key]);
  return [value, update];
}
