// ===== Persisted, cloud-mirrored collections =====
//
// The original v6 collections (users, companies, materials, ...) are declared with
// `useState` in App.tsx and persisted by dedicated effects. The new v3.0
// workspaces add five more collections (projects, RFQs, quotations, complaints,
// audit events). This hook gives them the same behaviour with far less wiring:
//
//   * initial value is read from localStorage (fast first paint, offline safe);
//   * every later change is written back to localStorage and queued for Supabase
//     through `cloudPush` (which is a no-op when the cloud is not configured);
//   * the first render is never pushed, so an empty fresh state can never
//     overwrite a newer cloud copy that is still being pulled.
//
// Cloud rows that arrive later are applied by App.tsx's `applyCloudRow`, which
// owns the setter returned here.

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { cloudPush } from '../lib/cloudStore';

export const readCollection = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
};

export const writeCollection = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode - the in-memory state remains usable */
  }
  cloudPush(key, value);
};

export function useLocalCollection<T>(
  key: string,
  initial: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readCollection(key, initial));
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    writeCollection(key, value);
  }, [key, value]);

  return [value, setValue];
}

export default useLocalCollection;
