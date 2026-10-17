// Cloud sync layer backed by Supabase.
//
// The app keeps its data in localStorage (fast, offline, synchronous reads).
// When Supabase credentials are configured, this module mirrors every shared
// key into the `escon_kv` table so all devices see the same data:
//
//   * on startup  -> `pullCloudToCache()` downloads the cloud rows into the
//                    local cache before the app reads state;
//   * on change   -> `cloudPush(key, value)` uploads the key (coalesced).
//
// With no credentials set, every function is a no-op and the app behaves
// exactly as before (local-only, no network calls).

import { supabase, isCloudEnabled } from './supabaseClient';

const TABLE = 'escon_kv';

// Keys that must stay on the device and never travel to the cloud.
const LOCAL_ONLY = new Set<string>(['currentUser', 'pwa_install_dismissed']);

// Whole-collection keys shared across every user.
const SHARED_KEYS = new Set<string>([
  'users',
  'companies',
  'materials',
  'orders',
  'notifications',
  'wallets',
  'wallet_transactions',
  'reviews',
  'system_settings',
]);

// Per-user keys (`cart_<uid>`, `favs_<uid>`) travel with the account.
const SHARED_PREFIXES = ['cart_', 'favs_'];

export const isSharedKey = (key: string): boolean =>
  !LOCAL_ONLY.has(key) &&
  (SHARED_KEYS.has(key) || SHARED_PREFIXES.some(prefix => key.startsWith(prefix)));

/** Download every shared row from Supabase into the local cache. */
export const pullCloudToCache = async (): Promise<boolean> => {
  if (!isCloudEnabled || !supabase) return false;
  try {
    const { data, error } = await supabase.from(TABLE).select('key,data');
    if (error) {
      console.warn('[cloud] pull failed:', error.message);
      return false;
    }
    (data || []).forEach((row: { key: string; data: unknown }) => {
      try {
        localStorage.setItem(row.key, JSON.stringify(row.data));
      } catch {
        /* storage quota — ignore, the app falls back to defaults */
      }
    });
    return true;
  } catch (err) {
    console.warn('[cloud] pull error:', err);
    return false;
  }
};

// Debounced push queue: a single user action can trigger several state updates
// in a row (e.g. wallets + transactions), so writes are coalesced per key.
const pending = new Map<string, unknown>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const flush = async (): Promise<void> => {
  if (!supabase || pending.size === 0) return;
  const rows = Array.from(pending.entries()).map(([key, data]) => ({
    key,
    data,
    updated_at: new Date().toISOString(),
  }));
  pending.clear();
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'key' });
  if (error) console.warn('[cloud] push failed:', error.message);
};

/** Queue a shared key for upload to the cloud (coalesced, best-effort). */
export const cloudPush = (key: string, value: unknown): void => {
  if (!isCloudEnabled || !supabase || !isSharedKey(key)) return;
  pending.set(key, value);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 800);
};

/** Push a single key immediately (used for one-off writes such as settings). */
export const cloudPushNow = async (key: string, value: unknown): Promise<void> => {
  if (!isCloudEnabled || !supabase || !isSharedKey(key)) return;
  pending.set(key, value);
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flush();
};
