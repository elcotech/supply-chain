# E-SCON — Cloud Database (Supabase)

E-SCON keeps its data in the browser's `localStorage` so it works offline and
starts instantly. When Supabase credentials are configured, the cloud module
mirrors **all shared business data** into a cloud table: accounts, companies,
products, orders, notifications, wallets, transactions, reviews, platform
settings and each user's cart/favourites.

Adding or editing a product on one device therefore reaches every other device,
without a manual reload. The app listens for Realtime changes and also polls as
a fallback, so it still converges if the Realtime publication has not been
enabled.

This document covers the sync module, how to set it up, and the security
limitations to be aware of.

---

## 1. How it works

The sync layer lives in two small files:

- [`src/lib/supabaseClient.ts`](../src/lib/supabaseClient.ts) — creates the
  Supabase client when `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`
  are set. Exposes `isCloudEnabled`.
- [`src/lib/cloudStore.ts`](../src/lib/cloudStore.ts) — the mirror logic.

**Startup:** `App.tsx` calls `pullCloudToCache()` **before** reading the local
cache, so a new device (or one that has been offline) starts from the latest
cloud catalogue/accounts. The first run of v6.1 also performs a one-time merge:
local business data is combined with the cloud copy (local items win on the same
ID) so products added while older builds were local-only are not lost.

**On change:** `cloudPush(key, value)` queues an upload, coalesced per key and
flushed ~800 ms later. `cloudPushNow()` forces an immediate flush; `settings.ts`
uses it for `system_settings`. Every shared persistence effect in `App.tsx`
pushes its collection after writing it locally.

**Live updates:** `subscribeToCloud()` listens to `postgres_changes` on
`escon_kv` and applies remote rows to React state immediately.
`fetchCloudChanges()` runs every 10 seconds while the page is visible and asks
only for rows with a newer `updated_at`, as a fallback when Realtime is not
enabled (or the socket is unavailable).

- With **no credentials**, `isCloudEnabled` is `false`, every function is a
  no-op, and the app behaves exactly as before (local-only, no network calls).

### Which keys sync

| Shared (whole collection) | Shared (per user) | Stays on device only |
| --- | --- | --- |
| `users`, `companies`, `materials`, `orders`, `notifications`, `wallets`, `wallet_transactions`, `reviews`, `system_settings` | `cart_<userId>`, `favs_<userId>` | `currentUser`, `pwa_install_dismissed`, `escon_cloud_merge_v2` |

The full list is in `cloudStore.ts` (`SHARED_KEYS`, `SHARED_PREFIXES`,
`LOCAL_ONLY`).

### Storage shape

Data is stored as **whole JSON documents** in a generic key/value table
(`escon_kv`), not as normalised rows. This mirrors the app's `localStorage`
keys and avoids a fragile migration of every data shape.

| Column | Type | Notes |
| --- | --- | --- |
| `key` | `text` | primary key, e.g. `materials`, `cart_<userId>` |
| `data` | `jsonb` | the full collection/document |
| `updated_at` | `timestamptz` | set on every upsert |

### Conflict model

Sync is **whole-collection, last-writer-wins** per key. There is no per-record
merge on normal saves: a device that pushes a collection replaces the cloud copy
of that collection, and every other device applies it. The one-time v6.1 upgrade
merge is the exception described above. Two devices editing the *same*
collection at the exact same moment can still overwrite each other; for real
high-concurrency editing you would move to per-record tables.

> Realtime is enabled by the `alter publication supabase_realtime …` statement at
> the end of [`supabase/schema.sql`](../supabase/schema.sql). If that statement
> has not been run, the 10-second polling fallback still keeps devices in sync.

---

## 2. Setting up Supabase

1. Create a free project at <https://supabase.com>.
2. In the dashboard, open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](../supabase/schema.sql) and **Run**. This creates the
   `escon_kv` table, its index and the RLS policies.
3. **Optional — load the demo dataset.** Open a new SQL query, paste
   [`supabase/seed.sql`](../supabase/seed.sql) and **Run**. It upserts the demo
   accounts (including `admin@escon.et` / `admin123`), suppliers, materials,
   orders, wallets, reviews and default settings into `escon_kv`. The script is
   idempotent (`on conflict (key) do update`), so it is safe to run again; it does
   not reset data you edit in the app because only a fresh run of the script
   writes those rows. `src/constants.ts` no longer contains any business records,
   so without the seed a new install starts with the admin account only.
4. Open **Project Settings → API** and copy:
   - **Project URL** → `REACT_APP_SUPABASE_URL`
   - **anon public key** → `REACT_APP_SUPABASE_ANON_KEY`
5. Copy `.env.example` to `.env.local` and fill it in:

   ```env
   REACT_APP_SUPABASE_URL=https://<project-ref>.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=sb_publishable_<...>
   ```

6. Rebuild so the values are compiled into the bundle:

   ```powershell
   npm run build
   npx cap sync android    # if rebuilding the Android app
   ```

> Only variables prefixed `REACT_APP_` are exposed to the app. **Never commit
> `.env.local`.**

### Verify the connection

Sign in, change any shared value (e.g. add a product), then check the
**Table Editor → `escon_kv`** in Supabase — the `materials` row should appear.
Open the app on a second device and confirm the change is visible after reload.

---

## 3. Security — read this before storing real data

The shipped `schema.sql` policies grant the **public anon key read *and write*
access to all app data**:

```sql
create policy "escon_kv anon read"   on public.escon_kv for select using (true);
create policy "escon_kv anon insert" on public.escon_kv for insert with check (true);
create policy "escon_kv anon update" on public.escon_kv for update using (true) with check (true);
create policy "escon_kv anon delete" on public.escon_kv for delete using (true);
```

This matches the app's current client-only authentication (passwords are stored
in plaintext in `localStorage` for the demo). **Anyone with the anon key can read
and modify every row.** That is acceptable for a demo or a closed pilot, but
**not** for real customer data.

### Before real customer data

1. **Add Supabase Auth** (email/password or phone) and issue signed-in sessions.
2. **Replace the anon policies** with per-user policies, for example:
   - a row owned by a user (`owner_id uuid`) → `using (auth.uid() = owner_id)`;
   - role-based rules for `materials`, `orders`, etc.
3. Keep only public catalogue data readable by `anon`.
4. Move password handling off `localStorage` entirely.

The data shapes in `src/types.ts` are already API-ready, so the client changes
are mostly swapping the storage calls for authenticated queries.

---

## 4. Operating notes

- **Reset the database:** `delete from public.escon_kv;` (or delete individual
  rows). Clients re-upload their current in-memory collections on the next
  change. To restore the demo catalogue afterwards, run `supabase/seed.sql`
  again; `src/constants.ts` contains no records to fall back to.
- **Free-tier limits:** watch the Supabase project's database size and request
  volume; a large product catalogue with many base64 photos inflates the
  `materials` row quickly.
- **Offline:** with no network the app keeps working from `localStorage`; pushes
  are dropped (best-effort) until the next change while online.
- **Disabling cloud:** remove/comment the two `REACT_APP_SUPABASE_*` values in
  `.env.local` and rebuild — the app goes back to local-only with no code change.
