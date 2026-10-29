# E-SCON — Deployment

E-SCON ships in two forms: a **static web app** and an **Android app**. Both are
built from the same source.

---

## 1. Build the web app

```bash
npm install
npm run build            # → ./build  (static site)
npx tsc --noEmit         # typecheck without building
```

`build/` is a plain static folder — no server runtime is required.

> `.env.local` is optional; when present, the Supabase values are compiled in and
> all shared business data syncs across devices. Without them the app stays
> local-only (see [CLOUD_DATABASE.md](./CLOUD_DATABASE.md)).

---

## 2. Deploy the web app

Host `build/` on any static host over **HTTPS** (required for the PWA install
prompt and geolocation):

| Host | How |
| --- | --- |
| **Vercel** | Connect the repo; `.vercel/project.json` already exists. Build `npm run build`, output `build` |
| **Netlify** | Publish directory `build`, build command `npm run build` |
| **GitHub Pages** | Push `build/` to the `gh-pages` branch (mind the `homepage` base path) |
| **Nginx / Apache / S3** | Serve `build/` as static files; enable HTTPS |

### SPA routing

The app uses hash-based navigation and a `#escon=<token>` deep link for scanned
proformas, so no server rewrite is strictly needed. As a safety net for any
path-based request, configure a single-page-app fallback to `index.html`.

### PWA cache updates

`public/sw.js` is a **custom** service worker. To push a new version to every
installed user without touching their data:

1. Bump `VERSION` at the top of `public/sw.js` (currently `e-scon-v1.10.0`).
2. Deploy the new `build/`.

On `activate` the worker deletes old cache buckets, and `skipWaiting()` /
`clients.claim()` drop stale assets. **Accounts, products, orders and
favourites live in `localStorage` and are never part of that purge.** Never add a
`localStorage.clear()` to this flow.

---

## 3. Deploy the Android app

Build the signed `.aab` and upload it to the Google Play Console. Full steps in
[ANDROID_BUILD.md](./ANDROID_BUILD.md#6-building-a-signed-release-aab-play-store).

Summary:

```powershell
npm run build
npx cap sync android
# bump versionCode/versionName + sw.js VERSION, then:
gradle bundleRelease --no-daemon --init-script "...\builddir-init.gradle"
```

Then:

1. Sign in to the **Google Play Console** and create/upload the app.
2. Complete the **store listing** (see
   [PLAY_STORE_LISTING.md](./PLAY_STORE_LISTING.md)).
3. Complete the **Data safety** form and link the **Privacy Policy** (see
   [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)).
4. Roll out to **Internal testing** first, verify on a real device, then promote
   to production.

### Sideloading (no Play Store)

For a quick internal install, build a debug APK and use `adb install`
([ANDROID_BUILD.md](./ANDROID_BUILD.md#5-building-a-debug-apk)).

---

## 4. Release checklist

- [ ] `npx tsc --noEmit` clean.
- [ ] `CI=true npm test -- --watchAll=false` passing.
- [ ] `npm run build` succeeds.
- [ ] `.env.local` is either absent or contains the intended Supabase URL/anon key (never committed); `supabase/schema.sql` has been run so the table and Realtime publication exist.
- [ ] `public/sw.js` `VERSION` bumped.
- [ ] Android `versionCode` / `versionName` bumped (for Play uploads).
- [ ] Web `build/` deployed over HTTPS.
- [ ] Signed `.aab` uploaded and tested on the internal track.
- [ ] Privacy policy URL live and pasted into the Play Console.

---

## 5. Environment variables

| Variable | Used by | Where |
| --- | --- | --- |
| `REACT_APP_SUPABASE_URL` | web + Android bundle | `.env.local` (gitignored) |
| `REACT_APP_SUPABASE_ANON_KEY` | web + Android bundle | `.env.local` (gitignored) |

There is no runtime server configuration — the app is fully client-side, so the
values are baked in at build time.
