// E-SCON local activity record
// Maintained by Codebuff/open-code sessions. Rewrite on success; cleared when
// the task is verified complete and pushed to GitHub.
//
// Remote: https://github.com/elcotech/supply-chain.git
// Branch: main
//
// 2026-11-14 session goal (exact user wording):
//   "update the system based on ESCON WEB & App Design & Feature.doc
//   record your everything and incase anything happened, anyone can finish
//   what you started and you can clear the record when you finish . dont
//   forget to update apks and all documentations before pushing to github."
//
// Spec source: ./ESCON WEB & App Design & Feature.doc (extracted text reviewed
// in full). This session closed the two major gaps: the dedicated Transporter
// menu/operational dashboard (spec section 6) and the guest About /
// How-it-works / Transport / Help pages (spec section 5), then polished the new
// surfaces for desktop, tablet and phone and refreshed every release artifact.
//
// Follow-up directive from the user during the session:
//   make the app "rich in features, very beautiful and extremely advanced but
//   functional and helpful by being compatible on all devices."
//
// Session plan / progress
// [x] 1. Add transporter domain types + pure helpers/tests
// [x] 2. Wire transporter role into register/auth/nav/persistence/cloud/backup
// [x] 3. Add dedicated Transporter dashboard
// [x] 4. Add guest About/How-it-works/Transport/Help page
// [x] 5. Update all documentation and version numbers
// [x] 6. npm test + npm run build
// [x] 7. Rebuild E-SCON-debug.apk, E-SCON-release.apk, E-SCON-release.aab
// [ ] 8. Commit, push to main, clear this log
//
// What shipped
// - src/types.ts: UserRole, Order transport fields, TransportJobStatus,
//   TransportProof, TransportVehicle, TransportDriver, TransporterProfile,
//   optional BackupPayload.transporterProfiles, registration service areas and
//   licence number.
// - src/lib/transport.ts (+ .test.ts): status labels/order, start/km/ton fee
//   calculation, service-area matching, profile creation, job scoping, earnings,
//   guarded claim/status transitions and proof-of-delivery validation.
// - src/components/TransporterDashboard.tsx: overview, searchable/filterable
//   requests, capacity + service-area matching, claim/advance, POD, vehicles,
//   drivers, pricing preview, earnings, company/verification.
// - src/components/InfoPage.tsx: About / How it works / Transport services /
//   Help & support with CTAs to marketplace, registration, login, map, analytics
//   and install guide.
// - src/App.tsx: transporter registration, profile persistence, cloud sync,
//   backup export/restore, transporter route, info route, desktop/mobile nav,
//   footer, home module and command-palette entries.
// - src/lib/cloudStore.ts: `transporter_profiles` in SHARED_KEYS.
// - src/utils.ts: validateBackup preserves transporterProfiles.
// - src/lib/analytics.ts + AnalyticsPage + copilot.ts: transporter role scoping,
//   earnings/jobs/cargo KPIs, top suppliers/customers, role labels and
//   transporter Copilot suggestions.
// - src/escon-transport.css: responsive transporter/info layouts (900/640/380px,
//   landscape, touch, safe areas, reduced motion) and transporter role styling.
//
// Verification (all passed)
// - `$env:CI='true'; npm test -- --watchAll=false`
//   -> 5 suites, 113 tests passed.
// - `$env:CI='true'; npm run build`
//   -> Compiled successfully; main 256 kB gzip, CSS 44.23 kB gzip.
// - Android debug + signed release APK + signed release AAB built after
//   `npx cap copy android`.
// - `aapt dump badging E-SCON-release.apk` -> versionCode 24, versionName 2.0.0.
// - Embedded `assets/public/sw.js` -> `e-scon-v2.0.0`.
//
// Artifact SHA-256
// - E-SCON-debug.apk    cb4ec7ece2465226de28e8ab5e853a88e1ec5d6ae0dc194a9c1949d03b17a0c7
// - E-SCON-release.apk  1201db5d3eb15591b215ef89f854ab97e4985f123f6a33b995e0037bbf3003fb
// - E-SCON-release.aab  1fb574ca0aaf2f7dd0506dea2a50fdf2df9aaacc76205337bc9440bc9dc3e4f8
//
// Versioning
// - package.json / package-lock.json 1.10.0 -> 2.0.0
// - android versionCode 23 -> 24, versionName 1.10.0 -> 2.0.0
// - public/sw.js VERSION e-scon-v1.15.0 -> e-scon-v2.0.0
//
// Working notes for the next person
// - Order already had transportCost/deliveryIncluded; all new transport fields
//   are optional so existing orders and backups remain valid.
// - Cloud sync is a generic KV store (`escon_kv`); new shared collections need
//   adding to src/lib/cloudStore.ts SHARED_KEYS and the App persistence effect.
// - `StarRatingDisplay` expects `value`, not `rating`.
// - `createTransporterProfile` overrides are Partial<TransporterProfile> and do
//   not include `businessLicense`; that value comes from the user record.
// - Android builds need JDK 17. It was not on PATH on this machine, so a
//   portable Temurin 17 was used from
//   C:\Users\ETHIOMK\AppData\Local\Temp\opencode\jdk17\jdk-17.0.21+9.
// - The pre-existing working-tree wrapper upgrade to Gradle 9.7.1 is
//   incompatible with AGP 8.2.1 (`SelfResolvingDependency` failure). Builds were
//   run with the cached Gradle 8.4 distribution instead. Do not commit the
//   unrelated wrapper changes unless the Android plugin is upgraded too.
// - Do not commit unrelated pre-existing changes: Sample Layout.jpg, Gradle
//   wrapper files, src/utils.test.ts, smoke scripts/screenshots/logs, the spec
//   .doc, src/__mocks__, or build logs.
// - Keep versionCode/versionName/sw VERSION in lockstep on every release.
