import { useCallback, useState } from "react";

/** useState backed by localStorage. Storage failures (private mode, quota) fall back to memory. */
export function useStoredState<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key);
      return allowed.includes(v as T) ? (v as T) : fallback;
    } catch {
      return fallback;
    }
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        /* keep the in-memory value */
      }
    },
    [key],
  );
  return [value, set] as const;
}
