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

export interface CloudRow {
  key: string;
  data: unknown;
  updated_at?: string;
}

// Highest server timestamp seen so far. The polling fallback asks only for rows
// touched after this point, so a steady app sends a tiny query instead of the
// whole table (products can carry base64 photos).
let syncCursor = new Date(0).toISOString();

const trackCursor = (timestamp?: string): void => {
  if (timestamp && timestamp > syncCursor) syncCursor = timestamp;
};

// Keys that must stay on the device and never travel to the cloud.
const LOCAL_ONLY = new Set<string>([
  'currentUser', 'pwa_install_dismissed', 'escon_cloud_merge_v2',
]);

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

// ---------------------------------------------------------------------------
// Stale-row protection
// ---------------------------------------------------------------------------
// `updated_at` is written from the client clock, so it is the authority on
// which copy of a key is newest. Every local write records that clock here.
//
// Why this matters: a change poll is a read-modify-write. Its query can execute
// *before* a local push commits while the response arrives *after* it, so the
// row it carries still holds the previous value. Applying that row would not
// only revert React state, it would push the reverted copy back to Supabase —
// a just-placed order would vanish a few seconds after the success message.
// Rows older than our own last write for that key are therefore dropped.
const lastLocalWrite = new Map<string, number>();

const noteLocalWrite = (key: string, at: number = Date.now()): void => {
  lastLocalWrite.set(key, at);
};

const isStaleRow = (key: string, updatedAt?: string): boolean => {
  const writtenAt = lastLocalWrite.get(key);
  if (writtenAt === undefined || !updatedAt) return false;
  const rowTime = Date.parse(updatedAt);
  // Keep a row that is at least as new as our last write (that is our own echo).
  return Number.isFinite(rowTime) && rowTime < writtenAt;
};

/** Download every shared row from Supabase into the local cache. */
export const pullCloudToCache = async (): Promise<boolean> => {
  if (!isCloudEnabled || !supabase) return false;
  try {
    const { data, error } = await supabase.from(TABLE).select('key,data,updated_at');
    if (error) {
      console.warn('[cloud] pull failed:', error.message);
      return false;
    }
    (data || []).forEach((row: CloudRow) => {
      if (LOCAL_ONLY.has(row.key)) return;
      try {
        localStorage.setItem(row.key, JSON.stringify(row.data));
        trackCursor(row.updated_at);
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

/**
 * Fetch only rows changed since the last pull/push. Used by the polling
 * fallback so devices that cannot use Realtime still converge within a few
 * seconds. Returns an empty list when cloud sync is disabled or offline.
 */
export const fetchCloudChanges = async (): Promise<CloudRow[]> => {
  if (!isCloudEnabled || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('key,data,updated_at')
      .gt('updated_at', syncCursor);
    if (error) {
      console.warn('[cloud] change poll failed:', error.message);
      return [];
    }
    const rows = (data || []) as CloudRow[];
    const usable = rows.filter(row => {
      if (isStaleRow(row.key, row.updated_at)) {
        console.warn('[cloud] dropped stale row for ' + row.key);
        return false;
      }
      trackCursor(row.updated_at);
      return true;
    });
    return usable;
  } catch (err) {
    console.warn('[cloud] change poll error:', err);
    return [];
  }
};

/**
 * Subscribe to live `escon_kv` changes. Requires the table to be added to the
 * `supabase_realtime` publication (see supabase/schema.sql). Returns a cleanup
 * function; with no credentials this is a safe no-op.
 */
export const subscribeToCloud = (onRow: (key: string, data: unknown) => void): (() => void) => {
  if (!isCloudEnabled || !supabase) return () => undefined;
  const channel = supabase
    .channel('escon-kv-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload: any) => {
        const row = payload?.new as CloudRow | undefined;
        if (!row || typeof row.key !== 'string') return;
        if (isStaleRow(row.key, row.updated_at)) return;
        trackCursor(row.updated_at);
        onRow(row.key, row.data);
      }
    )
    .subscribe();
  return () => {
    void supabase?.removeChannel(channel);
  };
};

// Debounced push queue: a single user action can trigger several state updates
// in a row (e.g. wallets + transactions), so writes are coalesced per key.
const pending = new Map<string, unknown>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const flush = async (): Promise<void> => {
  if (!supabase || pending.size === 0) return;
  const now = new Date().toISOString();
  // Use the very timestamp the row will carry, otherwise a 1 ms clock tick
  // between the two would make our own echo look stale and get dropped.
  const nowMs = Date.parse(now);
  const rows = Array.from(pending.entries()).map(([key, data]) => {
    noteLocalWrite(key, nowMs);
    return { key, data, updated_at: now };
  });
  pending.clear();
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'key' });
  if (error) console.warn('[cloud] push failed:', error.message);
};

/** Queue a shared key for upload to the cloud (coalesced, best-effort). */
export const cloudPush = (key: string, value: unknown): void => {
  if (!isCloudEnabled || !supabase || !isSharedKey(key)) return;
  pending.set(key, value);
  noteLocalWrite(key);
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
  noteLocalWrite(key);
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flush();
};
