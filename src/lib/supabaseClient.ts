import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase credentials come from Create React App environment variables so the
// keys are never hard-coded in the source. Set them in `.env.local`:
//
//   REACT_APP_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
//   REACT_APP_SUPABASE_ANON_KEY=YOUR-ANON-KEY
//
// When either value is missing the whole cloud layer switches itself off and
// the app keeps working exactly as before (local-only).

const url = (process.env.REACT_APP_SUPABASE_URL || '').trim();
const anonKey = (process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();

export const isCloudEnabled: boolean = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isCloudEnabled
  ? createClient(url, anonKey, { auth: { persistSession: false } })
  : null;
