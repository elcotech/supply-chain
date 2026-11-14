# WORK RECORD — E-SCON spec alignment (v3.0.0)

> Resumable record. If work stops for any reason, read this file, run `git status`,
> and continue from **Next step**. Delete this file when the task is finished.

**Source of truth:** `ESCON WEB & App Design & Feature.doc`
(extracted with `antiword` to `%LOCALAPPDATA%/Temp/escon_spec.txt`, 547 lines).
Key sections: §1 four user menus + transporter dashboard, §2 Administration (18
submenus), §3 Suppliers (18), §4 Customers (20), §5 Guests (14), §6 Transporters
(12), §7 shared AI/integration, §8 navigation structure, §9 design standards,
§10 phased priorities.

## Goal
Bring the app to the document exactly: five role-based menus with every listed
submenu working, rich/advanced but functional, design standards §9 (navy / blue /
white / restrained gold, responsive, English + Amharic, accessible, data tables
with search/filter/sort/pagination/export), then update all docs, rebuild the
APKs/AAB, and push to GitHub.

## Status
- [x] Spec extracted and read
- [ ] Work record written  ← this file
- [ ] Types + i18n + role menu config
- [ ] Workspace UI kit
- [ ] Administration workspace (18)
- [ ] Supplier workspace (18)
- [ ] Customer workspace (20)
- [ ] Transporter sections (12)
- [ ] Guest menu + supplier directory + language page
- [ ] App wiring + CSS
- [ ] Build, tests, docs, APKs, push

## Planned files (create)
| File | Purpose |
| --- | --- |
| `src/lib/i18n.ts` | EN/AM dictionary + language store/hook |
| `src/lib/menu.ts` | Five menus exactly as spec §8 |
| `src/hooks/usePersistentState.ts` | Persisted collection hook (localStorage + sync event) |
| `src/components/workspace/ui.tsx` | KPI cards, panels, DataTable (search/filter/sort/page/CSV) |
| `src/components/workspace/shell.tsx` | Role workspace shell (sidebar + mobile section bar) |
| `src/components/workspace/AdminWorkspace.tsx` | 18 admin submenus |
| `src/components/workspace/SupplierWorkspace.tsx` | 18 supplier submenus |
| `src/components/workspace/CustomerWorkspace.tsx` | 20 customer submenus |
| `src/components/workspace/SupplierDirectory.tsx` | Guest supplier directory |
| `src/components/workspace/LanguagePage.tsx` | Language settings (EN/AM) |
| `src/escon-workspace.css` | Workspace/menu styling and responsive rules |

## Decisions
- Keep the existing cart/proforma/order pipeline untouched; new features reuse it.
- New collections (`projects`, `rfqs`, `quotations`, `complaints`) persist locally,
  sync to Supabase via the existing `escon_kv` table, and are included in backup.
- `audit_events` stays device-local (security log, no cross-device need).
- i18n translates navigation, workspace chrome, KPI labels and common actions;
  untranslated strings fall back to English (expandable dictionary).
- Version: app `3.0.0`, Android `versionCode 25`, service worker `e-scon-v3.0.0`.
- Do **not** push until docs + APKs are updated (user instruction).

## Environment notes (from previous session)
- Android SDK: `C:/Users/ETHIOMK/AppData/Local/Android/Sdk` (build-tools 34.0.0, android-34).
- JDK 17: `C:/Users/ETHIOMK/AppData/Local/Programs/jdk-17/jdk-17.0.13+11`
  (`export JAVA_HOME=...` before Gradle). Gradle wrapper stays 8.2.1 (AGP 8.2.1).
- `/tmp` misresolves in Node here; use `C:\Users\ETHIOMK\AppData\Local\Temp`.
- `npm run build`, `npm test`, `npx cap sync android`, then
  `./gradlew assembleDebug assembleRelease bundleRelease`.

## Next step
Create `src/lib/i18n.ts` and `src/lib/menu.ts`, then the workspace UI kit.
