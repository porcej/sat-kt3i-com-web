import { useCallback, useEffect, useState } from "react";

export function usePersistedState<T>(
  key: string,
  initial: T
): [T, (v: T | ((p: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore quota */
    }
  }, [key, state]);

  const set = useCallback((v: T | ((p: T) => T)) => {
    setState((p) => (typeof v === "function" ? (v as (x: T) => T)(p) : v));
  }, []);

  return [state, set];
}
