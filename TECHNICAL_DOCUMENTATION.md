# E-SCON — Ethio-Supply Chain Optimization Network

## 📘 Technical Documentation

> **Version:** 6.16 (centred A4-width cart on desktop; the map measures from the same buyer pin as search, product page and cart before and after a refresh)
> **Previous:** 6.15 (one consistent 0.1 km everywhere, map GPS fix shared with the app), 6.14 (responsive Sample Layout cart & product page — matches Sample Layout.jpg on all devices: desktop, tablet, mobile), 6.13 (accurate map pins and live cart delivery), 6.12 (Sample Layout cart UI)
> **Previous:** 6.10 (cart-first ordering, location requested by the cart, reliable repricing), 6.9 (order without a saved location), 6.8 (Sample Layout product page, cloud-first order commit)
> **Stack:** React 18 + TypeScript + Leaflet (Create React App)
> **Purpose:** This document is the single source of truth for recreating, running, extending, and deploying the entire project. Anyone with this file and the project source can rebuild the application from scratch.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Prerequisites](#3-prerequisites)
4. [Getting Started](#4-getting-started)
5. [Project Structure](#5-project-structure)
6. [Architecture & Data Flow](#6-architecture--data-flow)
7. [Data Models](#7-data-models)
8. [State Management](#8-state-management)
9. [Persistence (localStorage)](#9-persistence-localstorage)
10. [Key Features & How They Work](#10-key-features--how-they-work) — including [10.5 Cart & checkout](#105-cart--checkout), [10.7 Proforma invoice](#107-proforma-invoice-new), [10.21 Whole-cart proforma](#1021-whole-cart-proforma-invoice-new-in-v52-single-supplier-again-from-v56), [10.22 Per-line delivery pricing](#1022-per-line-delivery-pricing-new-in-v52), [10.23 Single-supplier cart](#1023-single-supplier-cart-v56), [10.24 Branding, screenshots & search polish](#1024-branding-screenshots--search-polish-v58v60) and [10.26 Cart/order UX, locations & one-page proforma](#1026-cartorder-ux-locations--one-page-proforma-v65), plus [10.27 Cart-first ordering](#1027-cart-first-ordering-v610)
11. [Third-Party Integrations](#11-third-party-integrations)
12. [Styling System & Themes](#12-styling-system--themes)
13. [Responsive / Mobile / Touch Design](#13-responsive--mobile--touch-design)
14. [Routes / Pages](#14-routes--pages)
15. [Building for Production & Deployment](#15-building-for-production--deployment)
16. [Troubleshooting](#16-troubleshooting)
17. [Extending the Project](#17-extending-the-project)
18. [Testing](#18-testing-new-in-v4)
19. [Instructions for the Next Programmer](#19-instructions-for-the-next-programmer)
20. [Changelog (recent releases)](#20-changelog-recent-releases)

---

## 1. Project Overview

**E-SCON** (Ethio-Supply Chain Optimization Network) is a single-page web application that connects **suppliers** (companies) with **customers** in Ethiopia. It provides:

- Product catalogue with **live search & filtering** (department, **supplier**, city, max price, sorting).
- **GIS supplier mapping** built on Leaflet, with **driving routes**, **distance**, and **transport cost** calculations.
- **Company dashboards** for suppliers to manage products & orders, and **customer dashboards** for order history.
- **Cart & checkout** flow with **VAT-exclusive product prices**. VAT is **not** added when a product enters the cart: the cart shows goods + delivery and states that VAT is added when the order is placed. `confirmOrder` and both proforma actions price the cart with `calculateCartTotals(true)`, applying **one aggregate VAT** to the whole net goods subtotal (admin-configurable rate, never deducted from supplier prices, never rounded per line), plus **per-line** delivery-fee computation (buyer's with/without-delivery choice, supplier-set per-km rate, platform fallback).
- **Editable data** - no business records are hard-coded in `src/constants.ts`. A fresh install starts with the admin account only; demo accounts, suppliers, materials and orders are loaded with [`supabase/seed.sql`](../supabase/seed.sql) (an idempotent upsert). Every saved record, including an empty collection, is respected after refresh. Admins can edit/delete accounts, suppliers and every product field from **Settings**, including any account's saved location.
- **Proforma invoices** — **one proforma for the whole cart** (any number of items and suppliers), scannable QR fixed in the header, print-ready.
- **Compliance** data capture (TIN, business license, VAT).
- CSV **export** and **printable reports** — **suppliers and admins only**; customers have no export surface at all (§10.5).
- **Product photos** (base64 uploads stored locally).
- A **live global date/time widget** with invert-color & transparency toggles, shown on every screen.

---

## 2. Technology Stack

| Concern          | Technology                                    |
| ---------------- | --------------------------------------------- |
| Framework        | React 18 (`react`, `react-dom`)               |
| Language         | TypeScript 4.9                                 |
| Build tool       | Create React App 5 (`react-scripts`)           |
| Maps             | Leaflet 1.9 + `@types/leaflet`                 |
| Route decoration | `leaflet-polylinedecorator` (installed)        |
| Routing engine   | OSRM public demo server (HTTP)                 |
| Geocoding        | Nominatim (OpenStreetMap)                     |
| Map tiles        | CARTO basemaps (`light_all`)                   |
| Styling          | Plain CSS with CSS custom properties (variables) |
| Fonts            | Inter (Google Fonts)                          |

> No CSS framework (Tailwind/Bootstrap) is used — all styling lives in `src/App.css`.

---

## 3. Prerequisites

- **Node.js** ≥ 14 (recommended 18 LTS)
- **npm** (bundled with Node)
- A modern browser (Chrome, Firefox, Edge, Safari) — desktop & mobile
- Internet connection (map tiles, OSRM and Nominatim are remote services)

---

## 4. Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run development server (http://localhost:3000)
npm start

# 3. Run the test runner (interactive watch mode)
npm test

# 4. Create a production build (outputs to ./build)
npm run build

# 5. Typecheck without building
npx tsc --noEmit
```

### Demo accounts

| Role     | Email (pick from the login datalist) | Password |
| -------- | ------------------------------------ | -------- |
| Admin    | `admin@escon.et`                     | `admin123` |
| Supplier | `zhiruyanduamlak062@gmail.com`       | `0909`   |
| Customer | `abisha101999@gmail.com` (any user)  | `0909`   |

New registrations default to password `0909` when left blank.

**Seed data (v6.5).** The demo dataset now lives in
[`supabase/seed.sql`](../supabase/seed.sql), not in `src/constants.ts`. Run
[`supabase/schema.sql`](../supabase/schema.sql) once, then paste
`seed.sql` into the Supabase SQL editor. It upserts the `escon_kv` rows for
`users`, `companies`, `materials`, `orders`, `notifications`, `wallets`,
`wallet_transactions`, `reviews` and `system_settings`, so re-running it does not
duplicate records. On devices with no cloud configuration the app starts empty
except for the admin account.

**Registration and editable locations (v6.5).** Registration geocodes the typed
address/city with Nominatim and stores the real `lat`/`lng` (falling back to
central Addis Ababa only if geocoding fails). Customers can correct the pin at
any time from **Dashboard → My Location**, which uses the shared
[`MapPicker`](../src/components/MapPicker.tsx) and saves the address, city and
coordinates back to their account. Suppliers edit the same pin from **Profile →
Edit Company Profile**. Admins can correct any account from **Settings → Data
Manager → Location**. Search previews and the product page measure from this
saved pin; since v6.11 the **Order** action reuses that exact measured KM for
the cart, proforma and placed order, and only takes a fresh high-accuracy GPS
fix when a line has no measurement yet (e.g. a legacy cart or no pin at all).

> The **Admin** account is a seeded platform role. Only admins see the **⚙️ Settings** page where the delivery-fee model, delivery zones, free-delivery threshold, minimum-order rule and VAT rate are configured, and where accounts, suppliers and products can be managed (see §10.16). It is created automatically on first load if missing and cannot be deleted from the data manager.

---

## 5. Project Structure

```
supply-chain1/
├── public/
│   ├── index.html          # HTML entry, meta tags, fonts, Leaflet CDN CSS, PWA meta
│   ├── manifest.json       # PWA manifest (standalone app, icons, shortcuts)
│   ├── sw.js               # Custom service worker (pre-cache + network-first)
│   ├── favicon.ico         # Generated from logo512.png
│   ├── logo192.png / logo512.png  # App logo (logo512.png is the master icon source)
│   └── robots.txt
├── src/
│   ├── index.tsx           # React root — registers the service worker (production only)
│   ├── index.css           # Minimal global styles
│   ├── App.tsx             # Main application (state, routing, ALL pages)
│   ├── App.css             # All styles (theming, layout, components, responsive, animations)
│   ├── types.ts            # TypeScript interfaces (User, Company, Material, SystemSettings, …)
│   ├── constants.ts        # City/unit/department reference lists (business data lives in Supabase / seed.sql)
│   ├── settings.ts         # Runtime-configurable platform settings (delivery fee, min order, zones, admin)
│   ├── utils.ts            # Helpers: current GPS position, distance, fees, per-line delivery pricing, formatting
│   ├── lib/
│   │   ├── cloudStore.ts   # Supabase sync module (only settings pushes in v6.0)
│   │   └── supabaseClient.ts  # Supabase client, built from .env.local (disabled if unset)
│   ├── hooks/
│   │   └── useIsMobile.ts  # Reactive isMobile flag from matchMedia("(max-width: 768px)")
│   ├── components/
│   │   ├── ProformaInvoice.tsx, PublicProforma.tsx, AdminSettings.tsx,
│   │   ├── InstallGuide.tsx, OrderTimeline.tsx, MapComponent.tsx (lazy) … see §10
│   └── *.test.ts           # Jest unit tests (fees, formatting, settings, QR payloads)
├── android/                # Capacitor Android project (see docs/ANDROID_BUILD.md)
│   └── app/src/main/
│       ├── java/et/escon/supplychain/MainActivity.java   # Screenshots allowed (no FLAG_SECURE)
│       └── res/mipmap-*/   # Launcher icons generated from public/logo512.png
├── supabase/               # SQL schema for the optional cloud sync (docs/CLOUD_DATABASE.md)
├── docs/                   # User guide, Android build, cloud DB, deployment, Play Store, privacy
├── capacitor.config.json   # Capacitor app id / name / webDir (build)
├── package.json
├── tsconfig.json
├── README.md
└── TECHNICAL_DOCUMENTATION.md   # ← this file
```

> **Note:** `App.tsx` is intentionally the single page-routing hub — it renders different "pages" via a `currentPage` string switch (no react-router is used).

---

## 6. Architecture & Data Flow

```
┌─────────────────────────────┐
│  src/index.tsx              │
│  └─ <App/>                  │
│     ├─ state (useState)     │
│     ├─ localStorage sync    │
│     ├─ page router (switch) │
│     ├─ Header + DateTime    │  ← desktop; mobile uses TopBar + TabBar (isMobile)
│     ├─ Active page render   │  ← mobile variants branch on isMobile
│     ├─ Modals (product,     │
│     │  cart, edit company)  │
│     └─ Footer               │  ← desktop only; mobile uses TabBar + More sheet
└─────────────────────────────┘
```

**Boot sequence**

1. `App` mounts → `showSplash = true` → splash screen for **3 seconds**, then `currentPage = 'home'`.
2. An initialization `useEffect` reads `localStorage` (`users`, `companies`, `materials`, `orders`, `currentUser`).
3. Sample data is used **only when a collection has never been stored** (first run). Once a key exists, even as `[]`, the saved collection is authoritative - deleted sample rows are never re-added - and geocoding of supplier addresses runs once via Nominatim.
4. Every mutation of state arrays is persisted back to `localStorage` via dedicated `useEffect`s.

**Data flow example (search)**

1. User types in the search box on the Search page, or picks a filter pill (department, **supplier**, city, max price, sort).
2. A debounced `useEffect` (300 ms) calls `performSearch()`.
3. `performSearch` filters `materials`, then for each match calls the OSRM API for distance and transport cost (parallel `Promise.all`).
4. Results are enriched into `SearchResult[]` (material + company + distance + costs) and rendered in a sortable table.
5. Clicking a product row sets `autoRouteSupplierId` and bumps `routeRequestId` → the map modal opens and **automatically draws the driving route** from the customer's current position.

**Data flow example (proforma)**

1. Cart → `1 To Purchase` / `2 To Proforma` / `3 To Preview` → `confirmOrder()` / `handlePrintProforma()` / `handlePreviewProforma()`. All three price the same cart with VAT (`true`); only the destination differs.
2. `priceCartItems(cart, applyVat, origin?)` builds the **whole-cart** `CartReport`: net subtotal, **one aggregate VAT** (`vatOnSubtotal`) only when `applyVat` is true, and a delivery fee resolved **per line** by `resolveLineDelivery` (buyer checkbox → supplier's `startFee + perKm × km` → platform fallback), grouped by supplier with distance, mode and fee each. A cart holds one supplier (§10.23), so the report normally has a single group.
3. The report is stored in `proformaDetails` (the cart report in `cartDetails` is left untouched) and `showProforma` is set. `To Preview` also clears `proformaAutoPrint`; `To Proforma` sets it, which makes `ProformaInvoice` fire `window.print()` once the modal has painted.
4. `ProformaInvoice` renders from `proformaDetails` — every item, the supplier, one **Delivery Cost** total and the supplier's signature block beside the buyer's.
5. `buildProformaShareData` + `generateProformaQrDataUrl` encode the compact summary into the QR, which is a fixed top-right cell of the **document header** grid regardless of item count; the payload is capped at `MAX_QR_LINE_ITEMS` with the true count in `tc`, and `PublicProforma` renders it on scan.
6. The buyer presses **🛒 Back to To Purchase** → `handleBackToPurchase()` closes the document and re-enters the cart at step 1 (§10.5). Nothing is lost: the proforma never mutates the cart.

---

## 7. Data Models

All interfaces live in **`src/types.ts`**.

### User
```ts
{ id, name, email, password, phone, address, city,
  userType: 'customer' | 'company' | 'admin', companyName?,
  lat, lng, registered, loginAttempts, lockUntil,
  tinNumber, businessLicense, vatRegistered, vatNumber }
```

### Company
```ts
{ id, userId, name, description, location, city,
  lat, lng, rating, totalOrders, established,
  tinNumber, businessLicense, vatNumber, tradeLicenseExpiry,
  complianceStatus: 'compliant' | 'pending' | 'non-compliant',
  logo?, website?, workingHours?, phone?, email? }
```

### Material (Product)
```ts
{ id, companyId, name, category, basePrice, profitMargin, price,
  quantity, unit, minOrder, description, transportCost, rating,
  brand?, model?,
  specifications?: { weight?, dimensions?, grade?, origin?,
                     certification?: string[], weightPerUnit?, materialType? },
  images: string[],          // ← base64 data-URL photos
  delivery?: MaterialDelivery, // ← NEW v5.2 supplier delivery terms
  taxIncluded, vatPercentage, lastUpdated }
```

### MaterialDelivery (NEW in v5.2)
```ts
// A supplier publishing their own delivery rate for one product.
{ offered: boolean,   // the "This item is delivered by me" checkbox
  perKm?: number,     // ETB per kilometre of real road distance
  startFee?: number } // ETB starting service fee, charged once
```
Set on `Material` by the add/edit product form and snapshotted onto the cart
line (`CartItem.deliveryRate`) so a later price change by the supplier cannot
alter a cart the buyer already priced.

### Order
```ts
{ id, customerId, companyId, materialId, quantity, unitPrice,
  transportCost, totalAmount, status: 'pending'|'confirmed'|'shipped'|'delivered'|'cancelled',
  orderDate, deliveryDate?, address, notes?, invoiceNumber,
  taxAmount, vatAmount, paymentMethod, paymentStatus,
  deliveryIncluded: boolean } // ← NEW v5.2: did the buyer pay for delivery?
```

### Other types
`Alert`, `FormData` (all form fields, incl. `materialImages: string[]` and the three delivery fields `materialDeliveryOffered` / `materialDeliveryPerKm` / `materialDeliveryStartFee`), `SearchResult` (Material + computed `distance`, `totalCost`, `estimatedTransport`, `company`).

```ts
// CartItem      … includeDelivery?: boolean,   // ← NEW v5.2 buyer's master switch
//                 deliveryRate?: MaterialDelivery
// DeliveryMode   'supplier' | 'platform' | 'none'
// CartSupplier   … deliveryMode?: DeliveryMode, // ← NEW v5.2 which rule paid
//                 deliveryBasis?: string          //   e.g. "300 start + 12/km"
// CartReport     … freeDeliveryApplied, minOrderEnabled, minOrderAmount, belowMinOrder
```

### Platform & sharing types (NEW in v4)

```ts
// DeliveryZone           { id, name, cities: string[], fee }
// DeliverySettings       { mode: 'distance-based'|'fixed', fixedFee,
//                          distanceBaseFee, distancePerKmPerTon,
//                          freeDeliveryThreshold, zones: DeliveryZone[] }
// MinOrderSettings       { enabled, amount }
// VatSettings            { enabled, rate }            // rate = percent, applied once
// SystemSettings         { version, currency: 'ETB',
//                          delivery: DeliverySettings, minOrder: MinOrderSettings,
//                          vat: VatSettings }
// CartReport             also carries vatRate for the single cart-level VAT row.

// Compact NON-SENSITIVE proforma summary embedded in the QR code.
// ProformaShareData      { v, n (proforma no), d (date), b (buyer name),
//                          s: {n,c}[] (suppliers),
//                          i: {n,u,q,p,d?}[] (items, d = 1 delivery / 0 none),
//                          f?: {n,k,c}[] (legacy per-supplier delivery data:
//                                          name, km, cost; still encoded for
//                                          old QR readers but no longer shown
//                                          as a breakdown anywhere),
//                          tc?: number (true item count when the QR list is
//                                        truncated at MAX_QR_LINE_ITEMS),
//                          sub, vat, del, tot, c: 'ETB' }
```

> ⚠️ `ProformaShareData` deliberately excludes passwords, addresses, TIN/VAT numbers, phone and email — scanning a QR must never leak private business data.

---

## 8. State Management

All state lives in `App.tsx` using React hooks (no Redux/Context — fine for this scale):

- `materials`, `companies`, `orders`, `users` — the four data collections.
- `currentUser` — logged-in user (`User | null`).
- `formData` — a single object holding every form field value (login, register, product add/edit, search filters, company edit).
- `searchResults`, `isSearchPerformed` — search page state.
- `cart`, `cartDetails`, `showCartSummary`, `deliveryFeeOverride` — cart flow and the optional manual delivery fee.
- `proformaDetails`, `showProforma` — the whole-cart report the proforma renders from (all items, all suppliers).
- `showSupplierMap`, `autoRouteSupplierId`, `routeRequestId` — map modal, the supplier the map should route to (sticky), and a nonce bumped on every explicit route request so the same supplier can be re-routed.
- `selectedMaterial`, `editingMaterial` — details modal & product editing.
- `darkMode`, `isFullscreen` — UI preferences.
- `distanceToSelected`, `isDistanceLoading` — distance shown in product details.
- `showCompare`, `compareItems` — product comparison.
- `favorites` — per-user favorite materials (persisted to localStorage).
- `mobileMenuOpen` — mobile hamburger menu toggle.
- `deferredPrompt`, `showInstallBanner` — PWA install prompt state.
- `showInstallGuide` — "How to install" modal.
- `systemSettings` — the runtime `SystemSettings` object loaded from localStorage.
- `showSettings` — admin settings page visibility.
- `publicProformaData` — decoded `ProformaShareData` rendered when a QR is scanned.
- `pageAnimating` — controls page transition animation.

Key `useCallback` helpers: `showAlert`, `getCompanyById`, `getMaterialById`, `getCompanyByUserId`, `getUserById`, `navigateTo`, `geocodeCompany`, `geocodeAllCompanies`, `performSearch`, `toggleFavorite`, `toggleCompare`.

Plain (non-memo) helpers worth knowing:

| Helper | Role |
| --- | --- |
| `resolveLineDelivery` | **The single source of truth for one line's delivery fee** — checkbox → supplier rate → platform fallback, returning both the fee and its `DeliveryMode` |
| `combineDeliveryModes` | Folds two lines' modes into the one badge a supplier group shows |
| `buildMaterialDelivery` | Turns the three product-form fields into a `MaterialDelivery` |
| `priceCartItems` | Prices any set of cart lines into a `CartReport` (used by checkout, the proforma and the re-pricing effect) |
| `calculateCartTotals` | Thin wrapper: prices the current `cart` |
| `groupCartBySupplier` | Cart lines grouped per supplier |
| `handlePreviewProforma` | Prices the whole cart and opens the single consolidated proforma |
| `handleBackToPurchase` | Closes the proforma, re-prices and re-opens the cart at step 1 with `is-returned` on "To Purchase" (v5.7) |
| `handleDeliveryFeeChange` / `handleDeliveryFeeReset` | **Removed in v6.12.** Manual delivery-fee override was retired when the cart was rebuilt as a single-page proforma-style layout; delivery is now driven solely by each line's "With delivery" checkbox and the supplier's published rate (or the platform fallback). |
| `renderDeliveryTermsFields` | The shared "delivered by me + per km + starting fee" block in the add and edit product forms |
| `platformDeliveryHint` | Live buyer-facing note shown in the cart's Delivery Cost block when one or more supplier groups have no published rate and the platform fee applies |
| `cartSignature` | Quantity + delivery-flag signature that keys the cart re-pricing effect |

Quantity controls (§10.5): the new single-page cart (§10.28) renders each line's quantity with inline `−` / `+` stepper buttons inside the items table, and the "With delivery" choice is on the same card's Delivery Cost block. The old `CartQuantityInput` module component (a reusable quantity + checkbox unit that lived above `function App()` and was shared by the old cart modal and `DetailsOrderBox`) was removed when the cart UI was rebuilt; per-line delivery is still a cart-line property (`CartItem.includeDelivery`) so the proforma and placed orders keep agreeing.

---

## 9. Persistence (localStorage)

Storage keys (managed via the `safeLocalStorage` wrapper in `utils.ts`):

| Key                     | Contents                                  |
| ----------------------- | ----------------------------------------- |
| `users`                 | `User[]`                                  |
| `companies`             | `Company[]` (geocoded coords)             |
| `materials`             | `Material[]` (includes base64 images)     |
| `orders`                | `Order[]`                                 |
| `currentUser`           | `User` (removed on logout)                |
| `cart_<userId>`         | `CartItem[]` per user                     |
| `favs_<userId>`         | `string[]` (material IDs) per user        |
| `datetime-inverted`     | `'1'`/`'0'` (clock invert-color toggle)   |
| `datetime-ghost`        | `'1'`/`'0'` (clock transparency toggle)   |
| `pwa_install_dismissed` | `'true'` (hides install banner permanently) |
| `system_settings`       | `SystemSettings` (delivery fee, zones, min order — admin editable) |

> ⚠️ Because product photos are stored as **base64 data URLs inside `materials`**, the localStorage budget (~5 MB) can fill up quickly. Keep uploads to a few small images (the UI caps at **6 images per product**).

**Schema changes are additive, never a migration (v5.2).** Every new field is optional and every read is written to tolerate its absence, so a browser that has been running the app since before v5.2 keeps working with no repair step:

- `Material.delivery` — absent means "this supplier publishes no rate", so the platform fee applies.
- `CartItem.includeDelivery` — **absent means delivery was included** (`!== false`), which is exactly how old carts were priced.
- `CartItem.deliveryRate` — absent means the platform fallback; it is (re)snapshotted the next time the line's delivery checkbox is toggled or the supplier edits that product.
- `Order.deliveryIncluded` — absent means true; nothing in the UI depends on it being present.

A backup JSON taken on an older build still validates (`validateBackup`), because it only checks the collection shapes, not individual optional fields.

**Cloud sync status (v6.1):** every shared collection is synced when Supabase is
configured. Startup calls `pullCloudToCache()` before reading state; each shared
persistence effect calls `cloudPush()`; `subscribeToCloud()` applies Realtime
rows immediately; and `fetchCloudChanges()` polls newer rows every 10 seconds as
a fallback. A one-time `escon_cloud_merge_v2` merge protects products created
while older builds were local-only. With no credentials, the whole layer is a
no-op and the app remains local-only. See `docs/CLOUD_DATABASE.md`.

---

## 10. Key Features & How They Work

### 10.1 Global live Date & Time widget (NEW)
- **File:** `src/components/DateTime.tsx`, rendered once inside the app **header**, therefore visible on **every screen** (home, search, dashboards, map modal, login, etc.).
- Updates **every second** (`setInterval`).
- **Invert colors** toggle (🎨) — flips the widget from its light frosted chip to a dark chip with inverted text (and back again).
- **Transparency** toggle (👻) — makes the widget fully transparent ("ghost").
- Both preferences persist to `localStorage`.

### 10.2 Product → Map, distance & route (NEW/improved)
- On the Search page each product row shows a **🚗 Distance badge** computed from the customer's location (or the default Addis Ababa coordinates for guests).
- **Clicking a product row** immediately opens the full-screen Leaflet map and **auto-draws the driving route** to the supplier.
- The map's detail panel shows **route distance (km) and estimated driving time**, plus a "Show/Hide Route" control.
- The **"View Route on Map"** button in the product-details modal does the same.
- Guests get a **default location (Addis Ababa)** with the note *"(default location – login to use yours)"* — see `MapComponent.tsx` (`userLocation` / `hasUserLocation`).

**Automatic routing & re-routing (v5.4)** — three bugs made the route feel unreliable; all three are fixed in `MapComponent.tsx` / `App.tsx`:

| Problem | Cause | Fix |
| --- | --- | --- |
| Route sometimes never appeared | the auto-route effect ran **before** the mount effect created the Leaflet map, so `drawRouteForSupplier` hit `if (!map) return` | `isMapReady` state is set right after the map is constructed; routing waits for it |
| Clicking the same supplier twice did nothing | `handleSupplierSelect` early-returned when `company.id === currentCompanyIdRef.current` | the early return is gone — a selection always redraws; `drawnRequestRef` + the parent's `routeRequestId` nonce keep it to one draw per request |
| Route stayed on screen after another supplier was chosen | `onRouteShown` cleared `autoRouteSupplierId` in the parent, so the next open silently fell back to the first supplier | the parent now **remembers** the destination (`setAutoRouteSupplierId(companyId)`) and re-requests it with an incremented `routeRequestId` |

- **Current location is the route origin.** While GPS is pending, the route starts from the registered address (or the Addis default) and the geolocation watch **redraws it from the real position** on the first fix (`hasGpsFixRef` + `selectedCompanyRef` + `drawRouteRef`, one redraw per selection).
- `clearAllOverlays` also removes the standalone "Your Location" marker, which is placed on the map before any route exists — otherwise a stale marker survives the next redraw.
- Marker clicks and `window.__selectSupplier` go through `selectSupplierRef`, so they always hit the current selection logic instead of the first-render closure.

### 10.3 Product pictures (NEW)
- **Upload:** On the *Add Product* and *Edit Product* forms there is a **"📷 Upload Photos"** button (accepts `image/*`, multiple, max 6). Files are read with the `FileReader` API and stored as **base64 data URLs** in `formData.materialImages` → saved to `Material.images`.
- **Preview:** Uploaded photos show as thumbnails with an ✕ remove button before saving.
- **Display:** Thumbnails appear in the search results table, the supplier dashboard table, and a **gallery** inside the product-details modal. Products without photos show a category-based emoji placeholder (🏗️ 🚚 💊 …).

### 10.4 Live search & filters
Debounced search (300 ms) over `name`, `description`, `brand`, `category` + filters for department, **supplier**, city, max price, and sort (price ↑↓, rating, newest). Each result computes OSRM distance and transport cost in parallel.

**Supplier listbox filter (NEW):**
- The filter row on the Search page holds a **supplier listbox** (`<select name="searchSupplier">`) between the department and city filters, reusing the existing `.filter-select` pill styling — no new CSS.
- Options are built from `companies`, keeping only suppliers that actually list products (`materials.some(m => m.companyId === company.id)`), sorted alphabetically and labelled `Name — City`. The first option is `all` (labelled `Supplier`), so no filter is applied by default.
- Filtering happens in `performSearch` (`App.tsx`) with `material.companyId === searchSupplier`, so it composes with the other filters, sorting and the distance/delivery estimates.
- The field is `FormData.searchSupplier`, is part of the debounce dependency list, and is reset by the ✕ clear-filters button.
- The active supplier is echoed in the results header (`📊 Results (12) · 🏢 Build Well Trading`) so the filtered state is obvious. The same filter row is rendered on mobile, so phones get it too.
- **No results-header export (v5.4):** the 📥 Export button that used to sit next to the results count is removed — the header 📥 menu and the company dashboard export are the only product exports. `handleExportMaterials` stays in use by those two.

### 10.5 Cart & checkout
**One supplier per cart (v5.6):** a proforma is a legal document issued by a single seller, and every distance, delivery rate, VAT line and signature on it assumes one, so a cart may only hold one supplier's goods. `findOtherCartSupplier` (the pure, unit-tested rule in `utils.ts`, wrapped by `otherSupplierInCart` in `App.tsx`) refuses an add from a second supplier with a warning naming both suppliers, and **leaves the cart exactly as it was** — it is never cleared or replaced on the buyer's behalf. The same rule is re-checked inside `addToCartLogic`'s functional `setCart` update against `prev` (the real cart at the moment of the write), so a cart persisted by an older build cannot smuggle in a second supplier. Re-adding a product that is already in the cart is a quantity change, not a new supplier, so it skips the check. See [10.23](#1023-single-supplier-cart-v56).

Supplier prices are **VAT-exclusive** (`Material.taxIncluded` is always `false`; older sample rows are normalised on load), so VAT is never extracted from the entered price. `priceCartItems` sums the net line totals into `subtotal`. With `applyVat` false (cart, re-price, back-to-purchase, delivery-fee reset) `vatAmount` is `0`; with `applyVat` true (both proforma actions and `confirmOrder`) it calls **`vatOnSubtotal(subtotal, settings.vat.rate, settings.vat.enabled)` once** for the whole cart and sets `total = subtotal + vatAmount + transportCost`. VAT is therefore never rounded per line. The **per-line** delivery fee is resolved separately (see [10.22](#1022-per-line-delivery-pricing-new-in-v52)), producing a `CartReport` grouped by supplier with per-supplier distance/delivery costs. Confirming creates one `Order` per item; `allocateVat` splits the single cart VAT across those rows by their net value (last row absorbs the rounding remainder), so the orders always sum to the proforma total. The cart shows a pending-VAT note and a VAT-inclusive payable figure (used for the wallet check); the proforma shows the VAT amount. The cart then resets and the Orders page opens. A **single** proforma invoice covers the whole cart — see [10.21](#1021-whole-cart-proforma-invoice-new-in-v52-single-supplier-again-from-v56).

**Three order actions, in order (v5.6):** the cart modal's action row is `.cart-order-steps` (`.cart-order-step` buttons, `is-primary` on the first). `1 To Purchase` → `confirmOrder()` places the order; `2 To Proforma` → `handlePrintProforma()` opens the proforma and sets `proformaAutoPrint`, so `ProformaInvoice` fires `window.print()` once the modal has painted (print / save as PDF); `3 To Preview` → `handlePreviewProforma()` opens the identical document read on screen. All three call the same `calculateCartTotals(true)`, so the figures cannot disagree (the cart modal itself prices with `calculateCartTotals(false)`). Since v6.11 the bottom of the modal follows `Sample Layout.jpg` again: an outlined **Clear** pill on the left and a solid dark-blue **To Purchase** pill on the right (`.cart-sample-actions`), both committing through the same `confirmOrder()` as step 1 — two entry points, one code path, so they can never disagree about the total. **Cart CSV export and "Print Report" were removed** in v5.6: `handleExportCart`, `handlePrintCart` and the `exportCartToCSV` / `printCartReport` imports are gone, and the proforma is the buyer's only order document.

**Sample Layout cart UI (v6.11):** `renderCartSummary` now rebuilds the cart modal against `Sample Layout.jpg`, inside the `cart-sample-*` class family (styles at the end of `App.css`):
- **Header** (`.cart-sample-head`): dark-blue bar with the `E-SCON | SHOPPING CART` brand on the left, a **live date/time** (`LiveClock`, a 1 s `setInterval` in `App.tsx` — deliberately ticking here, unlike the proforma which freezes its timestamp) and the ✕ close button on the right.
- **Steps** (`.cart-sample-steps`): the three order actions restyled to the layout — step 1 solid dark blue with white text, steps 2/3 light-blue fill with dark-blue text.
- **Product cards** (`.cart-sample-products` / `.cart-sample-product`): one white card per line with a photo thumbnail (`.cart-sample-thumb`, 🏗️ fallback), the product name in dark blue, **Supplier:** / **Location:** rows, the `ETB … / unit • Min: …` price line, and two stacked outlined buttons on the right — **View** (opens the product details) and **Map** (draws the supplier route). Both close the cart first because the details/map modals render *before* the cart in the DOM and would otherwise be covered. The quantity row is the per-line `−` / `+` stepper plus a **Remove** button; the "With delivery" choice lives on the Delivery Cost card, not on the product card.
- **Financial Summary** (`.cart-sample-summary`): dark-blue header bar, then numbered rows (`.cart-sample-row` + CSS-counter `.cart-fin-no`): **Unit price × Quantity** (one row per line), **Subtotal**, **VAT (rate%)** with the "added when you place the order" note, **Delivery Cost** — whose sub-label prints the **exact road KM** the line carried from the product page, e.g. `(11.7 km × 25.01 ETB/km)` — and the highlighted **Grand Total** (the VAT-inclusive payable used for the wallet check). The delivery fee stays editable (input + ⟲ auto) exactly as before.
- **Payment Method** (`.cart-sample-payment`) and the **Clear / To Purchase** action row (`.cart-sample-actions`), as in the layout.

**The product page's exact KM carries into the cart (v6.11):** delivery used to be re-measured when the cart opened (a fresh GPS fix or a new OSRM query), so the KM the buyer had just seen on the product page could come back different in the cart and at checkout. Now the measurement travels with the line:
- `CartItem.distanceKm` (`types.ts`) stores the exact road km measured on the product page when the line was staged. `stageCartLine(..., distanceKm)` snapshots it (keeping the previous measurement when a later re-stage has none — unit-tested in `utils.test.ts`).
- `measureDistanceForMaterial(material)` captures what the page is displaying: `distanceToSelected` when it is already loaded, otherwise one measurement from the saved pin (the same endpoints the pill will display). The `selectedMaterialId` reset effect clears `distanceToSelected` on every product switch so a previous product's KM can never be staged for the new one.
- `measuredLineDistance(item)` is the single reader. `priceCartItems`, `resolveLineDelivery` (which passes it to `computeDeliveryFee` as `distanceKm`), `confirmOrder` and the cart's Financial Summary all prefer it and only fall back to `calculateDistance` for legacy lines that have no measurement.
- **No new GPS fix while a measurement exists:** the cart-open location effect, `priceCartItems`' coordinate guard and `confirmOrder`'s fix request all skip when every line carries a measured distance, so opening the cart or pressing **To Purchase** cannot move the number. A fresh fix is taken only for an unmeasured line (legacy carts, buyer with no pin).
- The **Delivery Cost** row in the cart, the proforma's per-supplier distance and the placed orders therefore all show the same KM the product page displayed. Unit tests: `stageCartLine` distance snapshots, `computeDeliveryFee` reusing `distanceKm` without calling the router.

**Back to "To Purchase" (v5.7):** the proforma is a **full-screen overlay**, and its old `← Back to Cart` button only called `setShowProforma(false)` — which left the buyer on whatever page was behind it with no cart open. Anyone who opened "To Proforma" to check a figure and then wanted to order had to hunt for the 🛒 icon again, and a buyer who had just reviewed a delivery total had no obvious way to commit to it. The proforma's second button is now **🛒 Back to To Purchase** and takes the optional `onBackToPurchase` prop, wired in `App.tsx` to `handleBackToPurchase()`:
- It clears `showProforma` **and** `proformaAutoPrint` — a later "To Preview" must not inherit a queued print.
- It **re-prices** the cart with `calculateCartTotals()` before reopening the modal. Delivery is priced from a live OSRM distance, so a cart left open behind the proforma can legitimately cost a few birr more now; the buyer must land on the real current total, not a stale one. If pricing fails it returns early and the cart stays closed.
- It sets `showCartSummary` and writes `cartSignature(cart) + '|' + deliveryFeeOverride` into `repricedCart`, exactly like `handleCheckout`, so the live re-pricing `useEffect` does not immediately recalculate what was just calculated.
- It sets `highlightPurchaseStep`, which adds `is-returned` to the "To Purchase" button and swaps its hint to *"Tap here to place your order"*. `.cart-order-step.is-returned` pulses a 6 px ring (`@keyframes purchaseStepPulse`, 4 iterations) and a `useEffect` clears the flag after 8 s; `prefers-reduced-motion: reduce` replaces the animation with a static outline. The flag is **presentation only** — never gate `confirmOrder` on it.
- **Empty cart:** the proforma cannot normally outlive the cart, but if it does, the handler warns and navigates to `search-materials` instead of opening an empty modal.
- `onBackToPurchase` is **optional** and falls back to `onClose`, so any other host of `ProformaInvoice` still renders a working button. `onClose` itself is unchanged and still backs the overlay click and the ✕.

**Customers cannot export anything (v5.7):** export is a supplier/admin tool. Every customer-reachable entry point was removed, not just hidden:
- Header 📥 Export — now gated on `currentUser.userType !== 'customer'` (it previously exported the whole product catalogue for anyone on the Search page).
- Customer dashboard "📋 Recent Orders" — the Export button beside "Find Products" is gone.
- Orders page — the Export button is now `{isCompany && …}`, so it survives on the supplier's Order Management page only.
- Mobile "More" sheet — "Export Orders" is gated on `userType !== 'customer'`.
- Mobile order cards — the per-card 📥 Export is now `{isCompany && …}`.

`handleExportOrders`, `exportOrdersToCSV`, `handleExportMaterials` and `exportToCSV` are all still in `utils.ts` / `App.tsx` and still used by the supplier + admin surfaces (header, company dashboard "Your Products", order management, Data Center backup). **If you add a new export, gate it the same way** — never add one to a page a customer can reach.

**Order entry:** a customer never picks a quantity in a list. The 🛒 button on a results row, the **Order** button on a mobile product card and **View & Order** in the compare modal all open the **product details**, where the only quantity control lives (`DetailsOrderBox` + `QuantityStepper`, steps of 1 with a live total, and since v5.5 the number itself is a **typed field** so a custom quantity can be entered without tapping + a hundred times).

**Product page layout (v6.8, follows `Sample Layout.jpg`):** the details are rendered as four stacked sections in this fixed order — **Product Details → Supplier Information → Customer Reviews → Order Summary** (`.pd-section`, each with a `.pd-head`). *Product Details* holds the photo gallery (`.pd-media`, `.pd-dots`), the category tag, title, description, the **Unit Price** and **Delivery Price** metric cards, the quantity row (`.pd-qty` + `QuantityStepper`) with the live **Material Subtotal**, and the **Order Date** / **Delivery Time** row. *Supplier Information* shows the verified supplier, rating, address, phone and a route card with distance, ETA and **View Route on Map**. *Customer Reviews* lists per-product reviews. *Order Summary* (`.pd-summary`) is the order box: it prices the order **on the page** 250 ms after any change — Material Subtotal, Delivery Price, VAT (when enabled) and **Total Payable** — and offers **🛒 Place Order** plus a quieter **Add to cart & review instead**.

Pressing **Place Order** stages the line with the **exact KM the page is displaying** and writes the order (cloud-first) from it; a fresh GPS fix is taken only when a line has no measurement yet (see the v6.11 distance note above). **Add to Cart & Review** stores the line the same way and opens the cart. The distance shown before you order is therefore not a preview — it is the value checkout charges.

**The summary never fails silently.** When the totals cannot be produced, the rows and the dead "Calculating…" button are replaced by a `.pd-summary-block` (`is-conflict` / `is-location` / …) that states the reason and offers the one action that fixes it: **📍 Use my current location** when the buyer has no saved pin, **🗑️ Clear cart & order this product** for a cross-supplier cart, **🔁 Retry calculating** for a failed quote. If the buyer has no coordinates the summary asks for one GPS fix automatically (once per product); pressing **📍 Use my current location** retries that fix. While pricing it is legitimately disabled and reads **Calculating…**; while the request runs it reads **Placing your order…**. A customer account is required (`pd-summary-note`), and sold-out products show *Currently unavailable* instead of the actions. If GPS is denied or unavailable the buyer is warned; the saved location is used only when it exists. The cart modal still allows per-line quantity edits and per-line delivery toggles. Full rules in [13.1](#131-ordering-flow--supplier-only-stock).

**Two cart entry points only (v5.2):** the cart is reachable from exactly two places — the header 🛒 icon on desktop (`.cart-icon-btn`) and the floating cart button in the mobile tab bar (`.m-fab-cart`). The mobile top-bar cart button, the home "Cart" quick-action tile, the desktop results-row cart button and the mobile product-card "In Cart — Open" button were all removed as duplicates. Product rows and cards keep their single button, but it now only ever **opens the product details** (where quantity and delivery are chosen) — it never opens the cart directly. On the product page the order action lives in **Order Summary**: **🛒 Place Order** places the order end-to-end, and **Add to cart & review instead** adds the line and opens the cart. The cart modal's own actions stay.

**No per-product minimum (v5.4):** customers may order **any quantity of 1 or more**. A product's `minOrder` field is kept as **supplier reference data** (product form, cart snapshot, proforma notes, comparison view) but is no longer enforced in the ordering path — `addToCart`, `updateCartQuantity`, the cart quantity inputs and the product-details stepper all work in units of 1, and the customer-facing description panel no longer shows a "Min Order" line. The separate **admin-configured minimum-order value** in ETB (goods-subtotal threshold, see [10.5](#105-cart--checkout)) is a different rule and is untouched.

**Cart re-prices live (v5.2):** while the cart modal is open, a `useEffect` re-runs `priceCartItems` 250 ms after any quantity change, "With delivery" toggle or manual delivery-fee override, so the totals on screen never drift from the cart. It keys off `cartPriceSignature(cart)` — the cart lines, the manual delivery-fee override **and the buyer's current coordinates** — and reaches the pricing function through `priceCartItemsRef`; putting `priceCartItems` itself in the dependency array would loop, because it is rebuilt on every render. A fresh GPS fix from the Order action therefore re-prices delivery fees even when the cart lines are unchanged (v6.7). `handleCheckout` writes the same signature into `repricedCart` so opening the cart does not immediately recalculate what it just calculated.

Since v6.10 the guard is written **inside** the 250 ms timeout. Writing it before the timeout let a re-render clear the timer while leaving the signature marked as priced; the next effect run then returned early and the cart stayed on "Calculating your order..." indefinitely. A cancelled in-flight price now releases the guard (only if it still owns the same signature), and both the no-totals path and the error path release it before setting `cartPriceFailed`. The failure state is rendered inside the loading modal, with the saved cart lines and a **Use my current location** / **Retry calculating** action instead of a dead spinner.

**Cart quantity is freely editable (v5.4):** each cart line renders its quantity with a `−` / `+` stepper inside the new single-page cart's items table (`.cart-new-table .cart-new-qty`). The stepper keeps a local draft string and only commits a valid whole number on blur, Enter or via the buttons, so clearing the box never pushes NaN into the line total or the grand total. The native spinners are hidden in favour of the `−` / `+` buttons (`.cart-new-qty-btn`). Since v5.2 the same quantity card also carries the per-line "With delivery" checkbox, now rendered inside the cart's Delivery Cost block rather than on the line card itself — the decision still rides on `CartItem.includeDelivery` so the proforma and placed orders keep agreeing.

**Stock visibility:** stock numbers, "In stock"/"Out" chips and low-stock banners are shown **only to suppliers and admins** (`canSeeStock`). Customers and guests see price and unit only.

### 10.6 Company dashboard
Suppliers see their products (with photos) and can **view / edit / delete** them, manage orders (confirm pending ones), and open the **Edit Company Profile** modal from the dashboard or the desktop **Profile** nav link. That modal edits the company profile, logo, exact map location and account details; products stay on the dashboard (see [10.25](#1025-company-profile-editing-v60)).

**Header shows the supplier's name (v5.6):** the supplier's own name is bold and centred on **both** dashboards. Desktop renders `<p className="dashboard-supplier-name">{company?.name}</p>` inside `.dashboard-header-supplier`, on its own line under the **Welcome - Supplier Dashboard** page heading (v6.5), replacing the old `Welcome {company?.name}!` paragraph. Mobile puts the same `.dashboard-supplier-name` on the `<h2>` of `.mobile-page-head-supplier`, with "Supplier Dashboard" demoted to the `<p>` subtitle and the old `🏢` prefix dropped from the name. The rules are scoped to the supplier pages so the **customer** dashboard keeps its `Welcome {currentUser.name}!` / `Hi, {name}` greeting and its left alignment, and `word-break: break-word` keeps a long trading name from overflowing on a phone.

**Own-stock detail (v5.4):** a supplier always sees everything about *their own* stock (this is the one surface where a stock number is not behind `canSeeStock`, because a supplier is reading their own inventory):
- A **"📥 My stock"** card with four tiles: units in stock, stock value (`Σ quantity × price`), low-stock lines (`0 < quantity ≤ LOW_STOCK_THRESHOLD`) and out-of-stock lines. The tiles turn amber/red when the count is above zero.
- The products table gains **In Stock** (`N unit`), **Stock Status** (`.stock-chip-in` / `.stock-chip-low` / `.stock-chip-out`) and **Stock Value** columns; the header/footer hint states that stock is private to the supplier.
- The mobile supplier dashboard gets the same four tiles (`.m-stock-grid`) plus a status chip on every product row.
- Nothing here is customer-visible: these components only render for `currentUser.userType === 'company'`, and the product-details/compare/search stock surfaces remain `canSeeStock`-gated (§13.1).

### 10.7 Proforma Invoice (NEW)
- **File:** `src/components/ProformaInvoice.tsx`.
- Full proforma invoice with **live-updating clock**, unique invoice number (PI-YYYYMM-XXXXXX), 30-day validity.
- Includes: supplier/buyer details (TIN, VAT, address), item table (brand, origin, specs, delivery flag), financial summary (**Amount Before VAT** → **VAT (x% added)** → **Delivery Cost** → **Grand Total**), amount in words, terms & conditions (6 clauses), and signature lines. The QR “public proforma” shows the same VAT-exclusive totals; the old per-supplier delivery breakdown was removed in v6.15.
- **Layout (v5.4, extended in v5.5):** supplier and buyer blocks stay **side by side** everywhere — desktop, phones (`≤760px` shrinks the label column to 68px and the box chrome) and print (the `1fr 1fr` grid is re-asserted because a print viewport can also be ≤760px). Only the terms block still stacks — it is prose and needs the full width.
- **Signature grid (changed in v5.2):** `.pf-signatures` is `repeat(auto-fit, minmax(200px, 1fr))`, so each party gets its own block next to the buyer's. The old fixed `1fr 1fr` only had room for two parties; do not hard-code a column count here.
- **Amount in words (v5.4):** `.pf-summary-wrap` is a right-aligned column, so `.pf-words` renders **directly under** the numeric `.pf-summary` (46% width on screen, 52% in print, 100% on phones) instead of sitting beside it. The v6.15 document no longer renders the old `.pf-delivery-box`, so the money summary is the first block in that column.
- **Header is a 3-column grid (v5.6):** `.pf-header` is `display: grid` with `grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) auto` — `.pf-brand` column 1, `.pf-meta` column 2, `.pf-header-qr` column 3, all pinned to `grid-row: 1`. **Do not change it back to flex.** With flex, the long `.pf-tagline` plus `.pf-meta` could not shrink far enough on a mid-width screen, and the QR — which must never shrink — was pushed out of the row and wrapped onto a new line at the left. The grid makes "always top-right" structural, and the `≤760px` and `@media print` blocks only re-declare columns 1/2/3; they must keep `align-self: start` and `justify-self: end` on `.pf-header-qr` so it stays hard against the top-right corner, opposite the logo, whether the items table is 2 lines or 400.
- Accessible from the cart summary modal via `2 To Proforma` (prints) and `3 To Preview` (screen only), both covering the **whole cart** — see [10.21](#1021-whole-cart-proforma-invoice-new-in-v52-single-supplier-again-from-v56) and [10.5](#105-cart--checkout).
- **Action bar (v5.7):** two buttons — `🖨️ Print Proforma` and `🛒 Back to To Purchase`. The second fires `onBackToPurchase` when the host supplies it (falling back to `onClose`) and returns the buyer to step 1 of the cart; see [10.5](#105-cart--checkout). The bar is `.proforma-actions.no-print`, so neither button is printed.
- **Print-ready**: `@media print` styles hide action buttons and format for A4.

### 10.8 Product Comparison (NEW)
- Compare up to **4 products** side-by-side in a modal.
- Toggle comparison via ⚖️ button on search results; a floating compare bar appears at the bottom.
- Shows: category, price, unit, min order, rating, brand, weight, origin — plus the **stock row for suppliers/admins only** (see [13.1](#131-ordering-flow--supplier-only-stock)).

### 10.9 Favorites / Wishlist (NEW)
- Toggle ❤️/🤍 on search results to save/unsave favorites.
- Persisted per-user in localStorage under `favs_<userId>`.

### 10.10 Quick Reorder (NEW)
- 🔄 button on past orders jumps to search with that product pre-filled.

### 10.11 PWA Install Banner (NEW)
- Captures the browser's `beforeinstallprompt` event and shows a styled banner.
- **Install** button triggers the native browser install flow.
- **Dismiss** button hides the banner permanently (stored in `pwa_install_dismissed`).
- Only shows when the browser supports PWA installation and the app isn't already installed.

### 10.12 Frozen Products Column (NEW)
- The "Product" column in the search results table is **sticky** (position: sticky; left: 0) so it stays visible while scrolling horizontally.
- Text wraps naturally with `-webkit-line-clamp: 2` for long product names.

### 10.13 Optimized Filter Frame (NEW)
- Search filters use compact sizing: shorter labels (`Dept`, `Supplier`, `City`, `Price ↑`), reduced padding and font-size.
- Filter pills use 20px border-radius for a modern look.
- Search button shows only 🔍 icon on desktop (saves width).

### 10.14 Expert-Level Animations (NEW)
All animations are **CSS-only** (no JS animation libraries), using CSS custom properties and `@keyframes`:

| Animation | Where | Technique |
| --- | --- | --- |
| **Page transition** | Every page switch | `opacity` + `translateY` via `.page-transition` class |
| **Staggered card reveal** | Stat/feature/dashboard cards | `@keyframes cardReveal` with `animation-delay` per `:nth-child` |
| **Hero text reveal** | Home hero heading, subtitle, badge | `@keyframes heroTextReveal` with staggered delays |
| **Search hero shimmer** | Search page gradient background | `::before` pseudo-element with `@keyframes heroShimmer` |
| **Button ripple** | All primary/secondary buttons | `::after` pseudo-element expanding circle on `:active` |
| **Gradient text hover** | Feature card headings | `-webkit-background-clip: text` on `:hover` |
| **Stats scale** | Stat value numbers | `transform: scale()` on card `:hover` |
| **Logo spin** | Header logo icon | `rotate(360deg)` on hover with spring easing |
| **Alert bounce** | Toast notifications | `@keyframes alertBounce` (translateY + spring) |
| **Modal entrance** | All modals | `scale(0.85) + translateY` with spring `cubic-bezier` |
| **Nav underline** | Navigation links | `::before` width transition from 0 → 70% |
| **Cart badge pulse** | Cart item count badge | `@keyframes badgePulse` (scale oscillation) |
| **Glass glow** | All `.glass` elements | Enhanced `box-shadow` with orange glow on hover |
| **Focus ring** | Form inputs on focus | `@keyframes focusRing` (box-shadow expansion) |

### 10.15 Auth & security simulation
Demo auth with lockout: 3 failed logins → 30-second lock (`loginAttempts`, `lockUntil`). Passwords are stored in plaintext (demo only — do **not** use in production).

**Screenshots are allowed in the Android app (v6.0):** `MainActivity.java` no longer sets `WindowManager.LayoutParams.FLAG_SECURE`, so the normal Android screenshot and screen-recording shortcuts work — see [10.24](#1024-branding-screenshots--search-polish-v58v60).

**Sign-in / create-account layout (v5.4):** `renderLogin` and `renderRegister` both render `<main class="main-content"><div class="auth-container"><div class="auth-card glass">`. The `.auth-*` classes had no CSS at all, so the form sat in the top-left and its inputs rendered unstyled. They are now a centered, frosted card (see §12) and the `.form-*` controls are styled for every form in the app. The Customer/Supplier switch on the register page is `.auth-tabs` / `.auth-tab.active`.

### 10.16 System Settings (admin) (NEW in v4)
- **File:** `src/settings.ts` (module) + `src/components/AdminSettings.tsx` (page).
- A validated `SystemSettings` object is persisted to `localStorage` under `system_settings`; `loadSettings()` repairs corrupted data and clamps invalid numbers to defaults.
- **Delivery fee** supports three cooperating rules:
  1. **Fixed mode** — a flat per-order fee.
  2. **Distance-based** — `base fee + perKmPerTon × distance` (OSRM).
  3. **Delivery zones** — a flat fee override keyed by the customer's city (e.g. Addis Ababa `400`, Adama `700`).
  Plus a **free-delivery threshold**: when the goods subtotal reaches it, delivery is `0`.
- **Minimum order** — a goods-subtotal threshold. When enforced, the cart shows a visible warning and the **Confirm Order** button is disabled until the cart qualifies; `confirmOrder` double-checks the rule as a final guard.
- **VAT (v6.4)** �?" an enable/disable switch and a percentage rate (`settings.vat`). The rate is applied **once** to the whole net goods subtotal; delivery is never taxed. New and edited products store the current rate for reference, but pricing reads the admin setting.
- **Accounts, suppliers & products (v6.4)** �?" the same page lists every account (delete non-admin users), every supplier profile (edit or delete it with its products) and the full catalogue (search, edit every field, delete). Deleting a supplier/account also removes its products, cart lines, notifications, wallet and ledger rows so initialization cannot "heal" it back.
- **Who can use it:** only `userType === 'admin'` sees the ⚙️ Settings page (seeded account `admin@escon.et`). The seeder runs during initialization and re-creates the admin if removed from localStorage; the admin account is protected from deletion in the data manager.

### 10.17 Professional Proforma + scannable QR (NEW in v4)
- **Files:** `src/components/ProformaInvoice.tsx`, `src/components/PublicProforma.tsx`.
- The proforma now shows the **E-SCON brand exactly once** (header). The footer carries only the contact strip + legal note.
- **Currency:** all figures render through the shared `formatCurrency` in `utils.ts` → `ETB 1,234.50` — never `ETH`.
- **QR code:** encodes the full link `…/#escon=<token>` where `<token>` is a **base64url-encoded `ProformaShareData` JSON** (compact, non-sensitive). Scanning it opens a **mobile-first proforma view** (`PublicProforma`) directly — works both on screen and from a paper print.
- `encodeProformaPayload` / `decodeProformaPayload` / `buildProformaQrUrl` / `generateProformaQrDataUrl` live in `utils.ts` and are unit-tested.
- The printed document also shows a **minimum-order advisory** banner when the rule is enabled.

### 10.18 "Locate Me" on the maps (NEW in v4)
- **Files:** `src/components/MapComponent.tsx`, `src/components/MapPicker.tsx`.
- A prominent **🎯 Locate Me** button centers the map on the user's current location using the browser Geolocation API.
- Every possible outcome is handled with a readable message instead of a silent failure: **permission granted**, **denied** (with guidance to enable it), **unavailable**, **timed out**, and **unsupported** browser.
- `MapComponent` also keeps a live `watchPosition` tracker for the route origin with an accuracy circle.

### 10.19 PWA install experience (NEW in v4)
- **Service worker:** new `public/sw.js` (pre-caches the app shell, network-first for navigations so hash routes like `#escon=…` still work offline, runtime caches same-origin GETs, and streams Leaflet map tiles through a cache with fallback).
- Registered in `src/index.tsx` **only in production** (avoids stale-cache interference with `npm start` hot reload).
- `public/manifest.json` gained `id`, `display_override`, `categories`, `shortcuts` (`#search`, `#orders`) and maskable icons.
- `public/index.html` gained richer SEO/mobile meta tags.
- **Install Guide** (`src/components/InstallGuide.tsx`): a modal with device-specific steps for Android / iPhone / Windows / other — reachable from the PWA banner and the footer "📲 Install App" link.

### 10.20 Consistent currency (NEW in v4)
All money values (search results, product cards, cart summary, proforma, order exports, admin settings preview) use the single `formatCurrency` helper. **"ETH" appears only in company/brand names** (e.g. "ETH Steel"), which is correct and must not be changed.

### 10.21 Whole-cart proforma invoice (NEW in v5.2, single supplier again from v5.6)
One proforma covers **every selected item** in the cart. The v5.1 "choose one supplier first" **picker** is still gone — it was removed from the state (`showProformaSupplierPicker`), the helper (`renderProformaSupplierPicker`) and `src/utils.ts` (`buildSingleSupplierReport`) in v5.2 and has not come back. What v5.6 changed is the **cart** instead of the proforma: a cart can no longer contain a second supplier, so the document is naturally a single-seller invoice again without any picker or re-scoping step. See [10.23](#1023-single-supplier-cart-v56).

- **Rule:** `handlePrintProforma` and `handlePreviewProforma` both price the whole cart and open the same document; the only difference is `proformaAutoPrint`. No picker, so a buyer never has to invoice N times to see N proformas.
- **QR never moves (v5.2, hardened in v5.6):** the verification QR is rendered in `.pf-header-qr`, pinned to column 3 of the `.pf-header` **grid** so its position is independent of the item count. This was the point of the change — a longer items table must not push the QR down the page. In v5.6 the header was converted from flex to grid precisely so a long brand tagline or supplier name could never wrap the QR onto a new line; see [10.7](#107-proforma-invoice-new).
- **Legacy mixed carts:** a cart persisted by a pre-v5.6 build can still hold more than one supplier. Nothing auto-clears it. `priceCartItems` keeps grouping by supplier and `ProformaInvoice` keeps rendering `SUPPLIER DETAILS (N)` with a signature block each, so such a cart still produces a correct document instead of silently dropping lines. The buyer is expected to clear it and start again.
- **Payload vs document:** `buildProformaShareData` (`src/utils.ts`) truncates the QR item list at `MAX_QR_LINE_ITEMS = 12` so the code stays scannable, and records the true count in `tc` when it does. `PublicProforma` shows "Showing the first 12 of 40 line items — the printed proforma lists every item." The **printed document is never truncated.**
- **Document (`ProformaInvoice.tsx`):** `suppliers: Company[]` replaced the old `supplier` + `ProformaSupplier[]` props. It renders every supplier in `SUPPLIER DETAILS (N)`, a `Delivery` column (`🚚 Included` / `—`) per line, the supplier name under the item description (`.pf-line-supplier`), the money summary with one **Delivery Cost** total, and a note under the delivery terms explaining how each line was priced. The v5.2 **Delivery Breakdown** block (`.pf-delivery-box`) and the public-proforma delivery lines were removed in v6.15. `.pf-signatures` is `repeat(auto-fit, minmax(200px, 1fr))` so each party gets a signature line. `autoPrint?: boolean` (default `false`) fires `window.print()` 350 ms after mount, guarded by a `useRef` so a re-render cannot open a second dialog.
- **Columns:** the item table's `pf-col-*` widths were re-balanced to make room for `pf-col-deliv` (12%) — the descriptions and specs give up the space.
- **No double counting:** the per-line delivery fees must add up to `report.transportCost`, which is why a manual fee override is still scaled across suppliers in `priceCartItems` rather than applied afterwards. The document shows only that one total.

### 10.22 Per-line delivery pricing (NEW in v5.2)
A supplier can offer to deliver an item themselves, and the buyer decides per line whether they want that.

**Supplier side (add / edit product form):** `renderDeliveryTermsFields()` renders a shared block in both forms:
- `materialDeliveryOffered` — "🚚 This item is delivered by me (supplier)".
- `materialDeliveryPerKm` — ETB per kilometre.
- `materialDeliveryStartFee` — ETB starting service fee, charged once.
The two rate fields and the live example sentence (`.delivery-terms-preview`) are **hidden** until the box is ticked, so an irrelevant rate is never asked for. `buildMaterialDelivery(formData)` turns the three fields into `Material.delivery`.

**Buyer side:** a "With delivery" checkbox sits on the same card as the quantity — in the new single-page cart's Delivery Cost block and in `DetailsOrderBox` (product details). The product-details checkbox defaults to **on**; a cart line with no `includeDelivery` field at all (saved before v5.2) also means **on**, so existing carts keep their old totals — `item.includeDelivery !== false` is the check everywhere, never a truthiness test.

**The pricing rule — one function, `resolveLineDelivery`:**
1. Box unticked → fee `0`, mode `none`.
2. Supplier published a rate → `startFee + perKm × distanceKm` over the **measured supplier → buyer road distance** (OSRM, same source as the map), mode `supplier`. The admin's delivery settings (fixed fee, per-km-per-ton, zones, free-delivery threshold) are **not** consulted for these lines.
3. No supplier rate → the existing `computeDeliveryFee(...)` platform rules apply, mode `platform`, and `platformDeliveryHint` tells the buyer why the fee appeared.
`computeLineDeliveryFee` in `src/utils.ts` is the pure, unit-tested core; `lineDeliveryMode` and `deliveryBasisLabel` give the label text. Mixed lines from one supplier are folded with `combineDeliveryModes`, and the group's badge shows whichever rule actually paid.

**Snapshot, not live lookup:** the rate is copied onto `CartItem.deliveryRate` at add-to-cart time and refreshed when the supplier edits that product (`handleUpdateMaterial` walks the cart), so a supplier raising prices never silently re-prices a cart the buyer already approved. The fee itself is calculated later — at checkout, when the proforma is previewed, and on every cart re-price — which is why the distance is only fetched there.

**Single source of truth:** `confirmOrder` calls the same `resolveLineDelivery` for each line before writing an `Order`, and stores the outcome in `Order.deliveryIncluded`. Never re-derive a delivery fee in the order path; that is exactly how the proforma and the order drifted apart in earlier versions.

### 10.23 Single-supplier cart (v5.6)
A cart belongs to exactly one supplier. A proforma is a legal document issued by a **single seller**; its distance, delivery rate, VAT lines and signature block all assume that. Allowing a mixed cart produced an invoice no one could sign.

**Where the rule lives** — a pure helper in `src/utils.ts` plus two call sites in `App.tsx`, all three required:
1. `findOtherCartSupplier(cart, supplierId, materialId?)` (`utils.ts`, unit-tested) returns the first cart line from a *different* supplier, or `null`. Passing `materialId` lets a re-order of an already-carded product through — that is a quantity change, not a new supplier. `cartHasOtherSupplier` is the boolean form.
2. `otherSupplierInCart` in `App.tsx` wraps that helper over the `cart` closure. `addToCartLogic` calls it before writing, and on a hit shows a warning that names the supplier already in the cart and the supplier being added, then **returns `false` without touching the cart**. The buyer's items are never cleared or swapped out for them.
3. The same helper is called again inside the functional `setCart` update against `prev` — the real cart at the moment of the write, not the `cart` closure captured at render. This is the authoritative guard: a cart persisted by a pre-v5.6 build can already hold two suppliers and would otherwise slip through the first check. If it trips, the write is dropped and `prev` is returned unchanged.

**Why `addToCart` returns `boolean`:** `DetailsOrderBox` only closes the product-details dialog when the add succeeded — `if (addToCart(...)) onAdded()`. On a rejection the dialog must stay open with the quantity and delivery choices intact so the buyer can simply clear the cart and retry. Do not reintroduce a flag set *inside* the `setCart` updater and read immediately after: React does not promise the updater has run yet, so that flag was always `false` at the check.

**Re-adding is not a new supplier:** bumping the quantity of a line already in the cart (product details "Update Cart", the cart's `+`/`−`) must keep working, so the check is skipped when `cart.some(i => i.materialId === material.id)`. In the updater the same `materialId` test comes first for the same reason.

**Legacy carts are not auto-cleared.** A mixed cart from an older build still prices, still renders and still proformas (see [10.21](#1021-whole-cart-proforma-invoice-new-in-v52-single-supplier-again-from-v56)); the buyer is expected to clear it. Only *new* adds are blocked.

**Where it is documented for the buyer:** `README.md` ("One supplier per cart") and the in-cart supplier line, which names the single supplier.

---

### 10.24 Branding, screenshot protection & search polish (v5.8)

**One logo everywhere.** `public/logo512.png` is the master artwork. `public/logo192.png`, `public/favicon.ico` (16/32/48 multi-size ICO) and every Android launcher icon are **generated from it**, so the home-screen icon, the browser tab and the Play Store icon are the same mark:

| Asset | Source / size |
| --- | --- |
| `public/logo192.png` | logo scaled to 80% on a 512-white square, then resized to 192×192 |
| `public/favicon.ico` | 16 / 32 / 48 PNG entries in an ICO container |
| `mipmap-mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi/ic_launcher.png` and `ic_launcher_round.png` | 48 / 72 / 96 / 144 / 192 px — white square with the logo at 80% |
| `mipmap-*/ic_launcher_foreground.png` | 108 / 162 / 216 / 324 / 432 px transparent canvas with the logo inside the **66% adaptive-icon safe zone**; the background layer stays `@color/ic_launcher_background` (`#FFFFFF`) |

`AndroidManifest.xml` already wires `android:icon="@mipmap/ic_launcher"` and `android:roundIcon="@mipmap/ic_launcher_round"`; the adaptive-icon XMLs live in `mipmap-anydpi-v26/`. Regenerate every size from `public/logo512.png` after a logo change (see [ANDROID_BUILD.md](./docs/ANDROID_BUILD.md#10-icons--branding)).

**Screenshots are allowed in the Android app (v6.0).** `MainActivity.java` no
longer calls `WindowManager.LayoutParams.FLAG_SECURE`. The standard Android
screenshot and screen-recording shortcuts work on every page, and the recents
preview is no longer blanked. Do not re-add `FLAG_SECURE` unless a future release
deliberately wants to block screenshots again.

**Find bar and results cards (v6.0).** See §10.4 and §13 for the full-bleed
mobile Find bar and the compact Order/Map buttons. Search results no longer show
the department/category: the mobile card drops `.m-pc-chip`, the desktop table
drops its Category column, and the product name, supplier and price are bold.

### 10.25 Company profile editing (v6.0)

Suppliers edit their business from the **Edit Company Profile** modal
(`showEditCompany` + `handleEditCompany` + `handleSaveCompany` in `App.tsx`).
It is reachable from the desktop **Profile** nav link and the
**Edit Company Profile** button on both supplier dashboards. The modal uses
[`EditCompany`](../src/components/EditCompany.tsx), which still supports its
`embedded` prop for other hosts but is rendered as a modal here.

The form edits the company name/description, **company logo** (single base64
image, upload/replace/remove, capped at 1.5 MB), contact details, **city/address
and exact map location** via `MapPicker`, legal/compliance fields, and the
**account** full name plus an optional new password (blank keeps the current
one). `handleSaveCompany` updates `companies`, `users` and `currentUser` and
writes the company/user collections back to `localStorage`.

Products stay on the supplier dashboard: add/edit/delete and the
`renderMaterialSpecificationsFields()` section (**Model**, **Weight**,
**Dimensions**, **Grade**, **Origin**, comma-separated **Certifications**) are
unchanged. The v5.9 `my-business` page, its `myBusinessTab` state and the
desktop/More-sheet **My Business** links are **not present in the v6.1 build**.

---

### 10.26 Cart/order UX, locations & one-page proforma (v6.5)

**Data is no longer hard-coded.** `src/constants.ts` now exports only
`ETHIOPIAN_CITIES`, `MEASUREMENT_UNITS` and `DEPARTMENTS`. `App.tsx` initializes
`users`, `companies`, `materials` and `orders` from `localStorage`/Supabase or
from `[]`; the admin seeder still guarantees `admin@escon.et`. Demo data is the
idempotent `supabase/seed.sql` described in [4. Getting Started](#4-getting-started).

**VAT timing.** `priceCartItems(items, applyVat = false)` and
`calculateCartTotals(applyVat = false)` default to the net cart used by the
cart modal and its re-pricing effect. `handlePrintProforma`,
`handlePreviewProforma` and `confirmOrder` pass `true`, so VAT appears on the
proforma and is charged on placement, never when the product is added. The cart
summary hides the VAT amount, shows `VAT (x%): Added when you place the order`,
and keeps a separate VAT-inclusive payable figure for wallet validation only.
`priceCartItems` still computes VAT once on the aggregate goods subtotal.

**Order / Ordered colours.** Order actions are yellow: `.m-pc-add-btn` (mobile
product card) and `.order-box-btn` (product details). Once the line is in the
cart they become green via `.m-pc-add-btn.ordered` / `.order-box-btn.is-ordered`.
The cart summary box uses a green border, green heading, and green bold totals
(`.cart-summary`, `.summary-row.total`, `.summary-row.vat-payable`).

**GPS beside Order.** `MobileProductCard` renders `.m-pc-map-btn` (`🗺️ GPS`)
next to the yellow Order button in `.m-pc-buy`; it calls
`handleOpenMapWithRoute(company.id)`, the same route/selection path as the
desktop “View Route on Map” control.

**One-page print.** `ProformaInvoice.tsx` keeps a ref to `.pf-document`. Before
printing it resets `--pf-print-zoom` to `1`, temporarily measures the document at
`198mm` (A4 width minus 6mm margins), then sets the variable to
`min(1, printableHeight / measuredHeight)`. `beforeprint` repeats the fit and
`afterprint` resets it. `@media print` applies
`zoom: var(--pf-print-zoom, 1)` and uses `@page { size: A4 portrait; margin: 6mm; }`
plus `break-inside: avoid` for every major block.

**My Location.** The customer dashboard (desktop and mobile) shows a **My
Location** card with the saved address and coordinates. It opens `MapPicker`;
`handleSaveMyLocation` writes `lat`, `lng` and reverse-geocoded address to the
current user and (for suppliers) their company, so the next search preview uses
the correct distance. On **Order**, a fresh fix is taken only for a line that
has no measured distance yet; a line that carries the product page's exact KM
reuses it, so the cart and proforma cannot change the number under the buyer.
When a fix is taken, `refreshCurrentLocation` overwrites the pin silently so the
customer's current position wins over an old one. Admin edits go through
`handleAdminUpdateUser` (`onUpdateUser` prop on `AdminSettings`).

### 10.27 Cart-first ordering (v6.10)

### 10.28 New Sample Layout cart (v6.12)

`renderCartSummary` now renders the cart in the new proforma-style layout matching the latest `Sample Layout.jpg` (supplier/buyer details, product banner, items table, delivery section, financial totals, amount in words, terms/payment, signatures, bottom actions). The modal is constrained to fit as a single page on every device with responsive scaling.

Adding a product and pricing delivery are separate steps. `handleDetailsOrder`
now calls `addToCart` **before** it looks at the buyer's coordinates, so a
denied, unavailable or slow GPS fix can no longer prevent a line from reaching
the cart. `Add to Cart & Review` is always visible on the product page; it
stores the line, keeps the page quantity, and opens the cart. A route preview on
the product page only updates when coordinates already exist, so opening a
product never blocks on geolocation.

The cart asks for the position itself. The first time an open, non-empty cart
has no usable coordinates, the `showCartSummary` effect calls
`refreshCurrentLocation()` once (`cartLocationTried` prevents repeat prompts).
While pricing, the modal lists the saved lines and shows **Calculating your
order...**. If the fix cannot be obtained, the same modal becomes an explicit
failure state with the saved lines, **Use my current location** (when there is
still no pin) or **Retry calculating** (when a pin exists). Nothing added to the
cart is lost.

`handlePlaceOrderFromDetails` follows the same rule: it stages the line into the
cart before requesting a fresh fix. If the fix fails it opens the cart instead
of returning the buyer to an unchanged product page. The cart's own
**To Purchase** path remains the retry point.

The cart re-pricing effect also no longer cancels itself. Its signature guard is
written inside the 250 ms timer, not before it, and is released when an in-flight
price is cancelled. Previously a re-render during the debounce cleared the timer
while leaving the guard set, so the effect returned early forever and the cart
stayed on the loading state. When pricing finishes without totals, the guard is
released and `cartPriceFailed` exposes the retry action.

### 10.29 Accurate supplier locations (v6.13)

`utils.ts` exports three location helpers:

- `lookupKnownPlace(address, city)` matches the most specific gazetteer alias
  first (`Bole Gerji` before `Bole`) and returns exact OSM coordinates for the
  seeded Addis neighbourhoods plus Adama.
- `isGenericCoordinate(lat, lng, address, city)` detects the legacy pins that
  were placed within ~1 km of a city centre, so existing local/browser data is
  repaired on the next startup.
- `geocodeAddress(address, city)` uses the gazetteer first, then Nominatim
  (`jsonv2`, `addressdetails=1`, `countrycodes=et`, `limit=1`) with a 1.1 s
  throttle and an Ethiopia bounding-box check.

`App.tsx` geocodes changed supplier pins sequentially, persists local storage
only when a pin actually moved, and the cart's **Refresh** action calls
`refreshCartDelivery` to take one fresh high-accuracy fix, re-measure every line
with `calculateDistance` and re-price through `priceCartItems`.

---

## 11. Third-Party Integrations

All are **public HTTP APIs** consumed client-side (no API keys required):

| Service            | Used for                              | Notes                                                            |
| ------------------ | ------------------------------------- | ---------------------------------------------------------------- |
| **Leaflet**        | Interactive maps                      | Installed via npm; CSS also loaded from CDN in `index.html`       |
| **CARTO basemaps** | Map tiles (`light_all`)               | Free tile server                                                  |
| **OSRM demo server** | Driving routes + distances           | `router.project-osrm.org`; falls back to **haversine** math on failure (`calculateDistance` in `utils.ts`) |
| **Nominatim**      | Forward & reverse geocoding           | Requires `User-Agent: E-SCON-App` header; rate-limited (~1 req/s) |

### Leaflet icon fix
Both map components run this snippet to load marker icons from a CDN (otherwise default icons are broken under webpack):

```ts
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});
```

---

## 12. Styling System & Themes

Everything is styled in **`src/App.css`** (~6,100 lines, organized in comment sections).

### CSS variables
`:root` defines the base palette; `[data-theme="dark"]` (set on `<html>` by `App.tsx`) overrides it. A `.dark-mode` class on the app container also applies targeted overrides.

Key tokens: `--bg`, `--bg-alt`, `--surface`, `--surface-alt`, `--card-bg`, `--text`, `--text-light`, `--text-muted`, `--border`, `--shadow`, `--glass-bg`, `--glass-border`, `--primary` (#0f4c81), `--primary-light`, `--secondary` (orange #e67e22), `--accent` (green), `--danger`, `--warning`, `--info`, `--radius`, `--transition`, `--font`.

`--bg-alt`, `--surface`, `--surface-alt` and `--text-muted` used to be **used but never defined**, which left every rule that referenced them (cart quantity field, delivery-fee field, cart meta text, settings/admin helper text) with a transparent background or a grey fallback. They are now part of both palettes — keep them defined.

#### Light-blue palette in both themes
The app is **light blue everywhere** — the page background is a soft blue wash, cards are frosted white and the text is deep navy. The ☀️/🌙 toggle still works; it switches between two *blue tints* (a paler blue and a slightly deeper blue) rather than between light and dark. Nothing in the app is navy or black any more.

| Token | `:root` (paler blue) | `[data-theme="dark"]` (deeper blue) | Used by |
| --- | --- | --- | --- |
| `--bg` | `#e4f0fd` | `#cbe0f8` | `body`, form sections, list rows, icon buttons |
| `--bg-alt` | `#d3e6fa` | `#bcd6f3` | inset strips, the cart quantity field |
| `--surface` / `--surface-alt` | `#ffffff` / `rgba(15,76,129,0.06)` | `#ffffff` / `rgba(11,63,109,0.08)` | inputs, selects, textareas, stock tiles |
| `--card-bg` | `rgba(255,255,255,0.8)` | `rgba(255,255,255,0.86)` | cards, modals, mobile sheet/tab bar, stat tiles |
| `--glass-bg` | `rgba(255,255,255,0.68)` | `rgba(255,255,255,0.76)` | `.glass` header/footer, map modal, compare bar, supplier panel |
| `--text` / `--text-light` | `#12314f` / `#4a6b8a` | `#0f2b4a` / `#43617f` | all body copy |
| `--primary` / `--primary-light` | `#0f4c81` / `#1a6fb5` | `#0b3f6d` / `#12588f` | splash screen, gradient heroes, table headers, primary buttons |

Rules to respect when theming:
- **Never introduce a dark page surface.** The page, cards, modals, header band, sheets and tab bars are all light blue / frosted white. Deep blue (`--primary`) is allowed only as an *accent* that carries white text: the splash screen, the search/home/mobile heroes, gradient table headers, primary buttons, avatars and badges.
- The `.dark-mode` overrides (the "Dark Mode" block) were converted from navy surfaces to light ones and must stay in sync with `[data-theme="dark"]`, otherwise the `!important` rules win. Anything that used to be `rgba(255,255,255,0.08)` or `#6ee7b7`-style pastel is now a light tint with a **dark** foreground (`#047857`, `#b45309`, `#b91c1c`, `#1d4ed8`).
- Dim scrims are still navy-tinted (`rgba(8, 22, 40, 0.5)` for modal/sheet overlays, `rgba(8, 22, 40, 0.6)` for map + proforma overlays) — they are overlays, not surfaces.
- The one deliberate exception is `.datetime-widget.inverted` (`rgba(0,0,0,0.55)`) — it is a high-contrast readability toggle, not a theme surface. The normal `.datetime-widget` is a light frosted chip with `color: var(--text)`.
- `public/index.html` and `public/manifest.json` carry `theme-color: #cbe0f8` (and `background_color: #cbe0f8`), matching the default page background for the browser/PWA chrome. Update both if you re-tint the page.
- Palette tokens, `.dark-mode` overrides and scrim colours are the **only** existing rules that may be edited in place; everything else is appended (see §19.1).

### Form controls, auth card & supplier stock (appended v5.4 section)
These classes were used in the JSX but had **no base rules at all** (only a mobile font-size bump), so the sign-in and create-account forms rendered as raw browser inputs in the top-left corner. They now have a base block at the end of `App.css`:
- `.form-label`, `.form-input`, `.form-select`, `.form-textarea`, `.btn-submit` — one visual language for the login form, the create-account form, the add/edit product forms and the wallet top-up. The 16px font / 46px min-height touch sizes are re-asserted inside `@media (max-width: 768px)` so iOS does not zoom on focus.
- `.auth-container` / `.auth-card` / `.auth-header` / `.auth-icon` / `.auth-body` / `.auth-tabs` / `.auth-tab` — the sign-in and create-account card is centered horizontally (`width: min(100%, 480px)`) and vertically (`min-height: 58vh`), with a round gradient icon, centered header and a two-tab Customer/Supplier switch. On phones the vertical centering is dropped so the long create-account form scrolls normally.
- `.form-group label.checkbox-label` — higher specificity than `.form-group label` (`display: block`) and `.form-group input` (`width: 100%`), so a checkbox stays a small box **on the same line as its text** (VAT Registered, "I agree to Ethiopian Trade Regulations").
- `.cart-qty-btn` / `.cart-item-quantity input` — the cart quantity editor (see §10.5).
- `.stock-summary-*`, `.stock-chip-*`, `.m-stock-*` — supplier-only stock tiles and status chips (see §10.6).

### Delivery controls (v5.2)
The delivery UI is four small blocks, added in one commented section:
- `.cart-delivery-toggle` (+ `.on`) — the pill-shaped "With delivery" checkbox beside a cart quantity. It inherits the theme's `--border` / `--bg-alt` when off and `--primary` accents when on, so the buyer's choice is visible at a glance. It is inside `.cart-item-quantity`, so it must stay `inline-flex` and must not grow to `width: 100%` (that is what `.form-group input` would do to it).
- `.order-box-delivery` (+ `.on`) — the same choice, but as a full-width row in `DetailsOrderBox` with a two-line `.order-box-delivery-text` (title + `deliveryBasisLabel` explanation, e.g. "Supplier delivery · ETB 300.00 starting fee + ETB 12.00/km"), because in the product details the fee basis is worth spelling out.
- `.delivery-terms` / `.delivery-terms-preview` — the supplier's "delivered by me" block in the add/edit product form. `.checkbox-label` is reused (see above) and the preview sentence is a live example built from the two rate fields, so the supplier sees the formula before saving.
- `.min-order-notice.warn` / `.cart-delivery-hint` — the amber "this supplier publishes no rate, so the platform fee applies" note and the grey "tick With delivery…" instruction above the cart totals. `warn` was added alongside the existing `.error` / `.ok` variants; do not repurpose those.

### Design language
- **Glassmorphism** utility `.glass` (blur + translucency + border).
- **Gradient hero** panels and **gradient table headers**.
- Rounded corners (10–16 px), pill buttons, soft shadows, smooth transitions.
- Zebra-striped tables with sticky gradient headers and orange hover.
- **Beautiful `<select>` list boxes**: custom chevron via inline SVG `background-image`, `appearance: none`, hover/focus rings, readable `option` colors in both themes.
- **Product page (Sample Layout)** (`.pd-section`, `.pd-grid`, `.pd-media`, `.pd-metric`, `.pd-qty`, `.pd-supplier`, `.pd-summary`, `.pd-summary-row`, `.pd-place-order`): the four-section product-details layout — Product Details → Supplier Information → Customer Reviews → Order Summary — with the price/quantity cards, supplier route card and the on-page order box, styled once for all breakpoints (44px touch targets on ≤ 768px).
- **Cart (Sample Layout, v6.11)** (`.cart-sample-modal`, `.cart-sample-head`, `.cart-sample-steps`, `.cart-sample-product`, `.cart-sample-card-btn`, `.cart-qty-sep`, `.cart-sample-summary`, `.cart-sample-row`, `.cart-fin-no`, `.cart-sample-payment`, `.cart-sample-actions`): the rebuilt cart — brand header with live clock, three order steps, photo product cards with View/Map, numbered Financial Summary rows (the Delivery Cost row prints the carried KM) and the Clear / To Purchase pills, styled once for all breakpoints.
- **Order box** (`.order-box`, `.qty-stepper`): the quantity control inside the product page (`.qty-stepper` is the stepper itself; `.order-box` is the legacy wrapper kept for older markup), styled once for all breakpoints.
- **Stock flags** (`.stock-flag` / `.stock-flag-low`): amber pill used for the supplier-only low-stock warning inside the product details view.
- **Stock chips** (`.stock-chip-in` / `.stock-chip-low` / `.stock-chip-out`): green / amber / red pills used on the supplier dashboard so a supplier reads their own stock status at a glance (never shown to customers).

### Sections (for navigation)
Header → Navigation → Buttons → Cards → Search → Product Grid → Tables → Product Row → Modal → Map Picker → Edit Company → Alert → Stats → Features → Footer → Home Hero → User Info → Cart → Dashboard → Distance Loader → Map Styles → PWA → Swipe → Icon Buttons → Dark Mode → Responsive → **UI v2 polish (appended section)** → Mobile shell (≤ 768px) → **Product page (Sample Layout)** & quantity stepper → Stock flags → **Proforma invoice & print** → **Product card "View details" affordance** → **Form controls / checkbox rows** → **Auth pages (centered sign-in)** → **Cart quantity editor** → **Supplier stock tiles & chips**.

---

## 13. Responsive / Mobile / Touch Design

- **Viewport meta** (`public/index.html`): `width=device-width, initial-scale=1, viewport-fit=cover` (allows user zoom for accessibility).
- **Touch handling**: `touch-action: manipulation` on interactive elements; `-webkit-tap-highlight-color: transparent`; `:focus-visible` rings for keyboard users.
- **Hover suppression** on touch devices (`@media (hover: none)` disables lift-on-hover).
- **Header** stacks vertically on ≤ 640 px; nav links scroll horizontally; the DateTime widget centers and shrinks.
- **Mobile hamburger menu** (`☰`) appears on ≤ 768px, toggles full-width navigation.
- **Tables** scroll horizontally inside `.table-responsive-wrapper` (min-widths per table); cell padding & font shrink on mobile.
- **Frozen Product column** stays visible during horizontal scroll via `position: sticky`.
- **Optimized filters** use compact sizing with short labels on all breakpoints.
- **Map modal** rebalances: map 40–45% height, details panel scrolls (≤ 768/480 px media queries).
- **Forms** collapse `.form-row` two-column grids to one column.
- **PWA install banner** stacks vertically on mobile.
- **Touch targets**: `.btn-icon` ≥ 40px, buttons ≥ 44px on touch devices.
- **Safe area insets**: respects device notches via `env(safe-area-inset-*)`.
- **Mobile banking-style shell (v5)**: under `768px` the app swaps its desktop chrome for a dedicated mobile shell — this is a *dual layout*, both are fully supported and the desktop layout is **unchanged** (all mobile markup/CSS is opt-in and gated):
  - `src/hooks/useIsMobile.ts` returns a reactive `isMobile` boolean from `matchMedia("(max-width: 768px)")`; `App.tsx` uses it to render `renderMobileTopBar()`, `renderMobileBottomNav()` and the profile "More" bottom sheet instead of the desktop header/footer. The same `768px` breakpoint is the CSS boundary, so JS and CSS always agree.
  - **Top bar**: brand, page title, theme toggle, avatar. The cart button that used to sit here was **removed in v5.2** — the tab bar's cart FAB is the mobile cart entry point (§10.5).
  - **Bottom tab bar** (`mobile-tabbar`, fixed, safe-area aware): Home / Search (customers) or Board (companies & admin) / center **FAB** (Cart for customers with badge, Add Product for companies, Login for guests) / Orders (with active-order badge) / More (profile sheet). Guests get Home / Search / FAB-Login / Map / Install.
  - **More sheet** (`m-sheet-overlay` + `m-sheet`): slide-up bottom sheet with profile header + Logout, dashboard, supplier map, compare, install app, theme toggle, CSV export (**supplier/admin only since v5.7**) and admin settings shortcuts, plus a horizontally scrollable "Saved products" strip.
  - **Mobile home** (`renderHomeMobile`): gradient greeting hero card with live stat tiles (active orders, delivered, revenue/spent), quick-action grid (v5.2 dropped the "Cart" tile so the mobile shell has one cart button, not two), "Saved for later" strip, horizontally scroll-snapping **Trending products carousel** (star-rating sorted) using the reusable `MobileProductCard`, and recent-order rows with status pills.
  - **Search results** on mobile render a card grid (`MobileProductCard` in `list` variant with a compact **Order** button — or **Edit order** when the product is already in the cart — that opens the product details; since v5.2 the card no longer opens the cart) instead of the wide table. Stock chips are supplier-only (see §13.1). **v6.0 layout:** the department chip is removed, and the product name (`.m-pc-name`), supplier (`.m-pc-supplier`) and price (`.m-pc-price`) are bold. The Order button stays short, and the buy row (`.m-pc-buy`) keeps the 🗺️ **Map** button that jumps straight to the driving route via `handleOpenMapWithRoute(company.id)`. The desktop results table drops the Category column and bolds the product name, `.supplier-cell` and `.price-cell`.
  - **Full-bleed Find bar (v5.8):** inside the `768px` block the search hero is `padding: 14px 0 10px !important` with the input group as `gap: 0` and square-cornered input/button, and the heading, copy and filter row carry their own `0 12px` padding, so the **search field and its 🔍 button span the whole window width, side to side**, while the rest of the hero keeps its inset. It also removes the old `margin: 0 -12px` that made the hero wider than the viewport on the un-padded mobile `main-content`.
  - **Tap-to-explore affordance (v5.4)**: the product photo inside `MobileProductCard` opens the description, so it must look tappable — `.m-pc-img` scales to 0.97 on press and carries a `.m-pc-view-hint` pill (👁️ View details) that fades in (`mViewHintIn`) while the eye pulses (`mViewPulse`, 1.9 s). The pill is `pointer-events: none` so taps always reach the button, it is `aria-hidden` next to a descriptive `aria-label` on the button, and both animations plus the press transition are disabled under `@media (prefers-reduced-motion: reduce)`. Shared by the trending carousel and the mobile search grid.
  - **Orders** on mobile render stacked order cards with the `OrderTimeline` shipment stepper, customer/supplier line, itemised totals and Confirm/Reorder actions, plus Export on **supplier cards only** since v5.7.
  - **Dashboards** on mobile render 2×2 stat tiles plus compact product/order lists (`renderMobileDashboard(true|false)`).
  - **Modals become bottom sheets** on mobile (`.modal-overlay` aligns to bottom, `.modal-content` gets top-rounded corners) and forms use 16px inputs to prevent iOS auto-zoom. The floating compare bar and PWA banner are lifted above the tab bar.
- **Forms (v5.4)**: `.form-input` / `.form-select` / `.form-textarea` / `.btn-submit` are re-stated inside the `768px` block (16px font, 46px min-height) because their base rules now live at the end of the file and would otherwise win. The sign-in card drops its vertical centering on phones, and the cart quantity field grows its `−` / `+` keys to 38px.
- **Supplier stock (v5.4)**: the mobile supplier dashboard shows the same four stock tiles as the desktop one (`.m-stock-grid`, 2×2) plus a per-row status chip.

### 13.1 Sample Layout responsive cart (v6.14)

The cart modal (`renderCartSummary`) follows `Sample Layout.jpg` and now renders correctly on **every device size**: desktop (> 900px), tablet landscape (768–900px), phones (≤ 640px) and very small phones (≤ 400px).

**Layout sections (in order, matching the reference image):**

1. **Header** (`.cart-sample-head`): dark-blue gradient bar with `☰ E-SCON | SHOPPING CART` and ✕ close on the first line, and the live clock (`LiveClock`) on its own single line so the brand never wraps. The blue bar is inset by the modal's page padding only on phones; on desktop the sheet has no outer padding.
2. **Steps** (`.cart-new-steps` / `.cart-order-step`): three tabs — `1 To Purchase` (solid dark blue, white text), `2 To Proforma`, `3 To Review` (light-blue fill, dark-blue text).
3. **Supplier & Buyer Details** (`.cart-new-parties`): two side-by-side rounded cards — Supplier Details and Buyer Details — each with key:value rows (Company Name, Address, TIN, VAT No., Phone, Email for supplier; plus Contact Person for buyer).
4. **Item Details Banner** (`.cart-new-product-banner`): per-line card with product thumbnail, name, price/unit, description, and stacked **GPS MAP** + **Auto Refresh** buttons.
5. **Order Items Table** (`.cart-new-items-section` / `.cart-new-table`): No., Item Name, Description, Unit, Qty (with `−` / `+` stepper), Unit Price.
6. **Delivery Cost** (`.cart-new-delivery-section`): header with 📍 Delivery Cost label + GPS MAP / Refresh buttons, then Starting Point / Destination / Total Distance / Delivery Cost rows. The distance is the same 0.1 km value used by the product page and proforma (v6.15).
7. **Financial Summary** (`.cart-new-financial`): Amount Before VAT, VAT (%), Delivery Cost, Grand Total (highlighted dark-blue row).
8. **Amount in Words** (`.cart-new-words`): light-blue bar with the total spelled out.
9. **Terms & Payment** (`.cart-new-bottom`): two side-by-side boxes — Terms, Conditions, Delivery & Remarks (left) and Payment Methods (right, with wallet/bank/cash radio options).
10. **Signatures** (`.cart-new-signatures`): three boxes — Authorized Supplier Signature, E-SCON, Buyer's Acknowledgment.
11. **Bottom Actions** (`.cart-new-actions`): green **Place Order** button + outlined **Add to Cart & Review** button.

**Responsive breakpoints:**

| Breakpoint | Width | Behavior |
| --- | --- | --- |
| Desktop | ≥ 641px | Centred A4-width sheet (794px, A4 at 96 dpi) with the modal padding removed; full two-column parties, two-column bottom (terms + payment), 4-column delivery row, side-by-side product banner with stacked actions. The sheet hugs its content and only scrolls inside when taller than the viewport |
| Tablet landscape | 768–900px | Parties stack to 1fr, delivery row 2-col, product banner keeps thumbnail + info + stacked actions |
| Phone | ≤ 640px | Everything single-column, compact font sizes (0.6–0.75rem), full-width action buttons stacked vertically, delivery row 1-col, signatures stacked |
| Small phone | ≤ 400px | Extra compact (0.55–0.7rem), 35px thumbnails, tighter spacing |

The product details page (§4 — Product Details → Supplier Information → Customer Reviews → Order Summary) also stacks to single-column on phones (≤ 720px) per the existing `.pd-grid` / `.pd-metrics` / `.pd-supplier-meta` media query.

### 13.2 Ordering flow & supplier-only stock

Two rules govern what a customer sees about quantities and stock.

**1. The `+ / −` quantity control appears only in the product details view.**
It is the step where the customer has actually seen the product and is ready to order, so a list never shows a quantity picker:

| Surface | Customer action |
| --- | --- |
| Desktop results row (`🛒`) | opens the product details (`setSelectedMaterial`) |
| Mobile product card (`🛒 Order` / `🛒 Edit order`) | opens the product details |
| Compare modal (`View & Order`) | closes the modal and opens the product details |
| Product details (`DetailsOrderBox`) | four Sample-Layout sections ending in **Order Summary**: `QuantityStepper` (typed number + − / +) + live Material Subtotal in Product Details, **With delivery** on the Delivery Price card, then **🛒 Place Order** (stages the exact measured KM → order → Orders page; fresh GPS fix only when a line has no measurement) or **Add to Cart & Review** (stores the line without waiting for GPS and opens the cart, v6.10) |
| Cart modal | per-line number input (`updateCartQuantity`) + per-line **With delivery** checkbox (`updateCartDelivery`); the staged `distanceKm` is what the totals and checkout charge (v6.11) |

- `QuantityStepper` is a **module-scope** component in `App.tsx` (just above `function App()`, used only by `DetailsOrderBox`); `DetailsOrderBox` stays next to `renderMaterialDetails`. It steps by **1** and stops at **1** — customers may order any amount, so the stepper must not derive its step or floor from `minOrder` (`min` is hard-coded to `1`).
- **The number is a real input (v5.5).** The middle of `.qty-stepper` is `<input className="qty-value">`, not a read-only `<span>`: a customer can tap − / + **or type any whole number** and commit with Enter or by clicking away. The local `draft` string keeps the field usable while it is being emptied, and `commit()` only calls `onChange` with a parsed integer `>= min` (never `NaN`, so the running subtotal below the stepper can never go blank). The unit moved out of the old `<small>` into a sibling `<span className="qty-unit">`. The native spinners are hidden (`appearance: textfield` + the two `::-webkit-*-spin-button` resets) so − / + stay the only visible controls; do not re-add a read-only value span.
- `DetailsOrderBox` owns its quantity state, so it resets to `1` every time the modal is opened (no `document.getElementById` juggling any more). Its hint reads "Any quantity — use − / + or tap the number to type your own."
- The cart's own quantity control is the inline `−` / `+` stepper in the items table, not a separate module component: that keeps the single-page layout self-contained and avoids the stale `CartQuantityInput` dead code path.
- `addToCart` and `updateCartQuantity` only guard against non-finite values and quantities below 1. The cart line input uses `min={1} step={1}`. **Do not** re-add a `minOrder` check to either function; the per-product minimum is reference data only (see [10.5](#105-cart--checkout)).
- A sold-out product shows **"Currently unavailable — please contact the supplier."** instead of the stepper, so nothing un-orderable can be added to the cart.
- The old native `prompt("Quantity (Min: …)")` on the desktop results row and the card-level `m-stepper` are **removed** — keep it that way; never reintroduce a quantity control in a list.
- **Adding can be refused (v5.6).** `addToCart` returns `boolean`: `false` when the buyer is not a signed-in customer, when the quantity is invalid, when the supplier cannot be resolved, or when the cart already holds a **different** supplier. `DetailsOrderBox` calls `onAdded()` only on `true`, so a refused add leaves the dialog open with the quantity and delivery choices intact. Do not close the dialog unconditionally.
- **Adding does not require GPS (v6.10).** `handleDetailsOrder` adds the line first; location is only requested by the open cart when it needs to price delivery. **Place Order** also stages the line before taking a fix and, if the fix fails, opens the cart with the saved line instead of leaving the product page unchanged. Since v6.11 both actions pass the page's exact KM (`measureDistanceForMaterial`) into `stageCartLine`, so the cart charges the distance the buyer just read.

**2. Stock levels are supplier-only data.**
`const canSeeStock = currentUser?.userType === 'company' || currentUser?.userType === 'admin'` (`App.tsx`, "Role visibility") gates **every** stock number in the UI. Customers *and* signed-out visitors see none:

| Where | Gated by |
| --- | --- |
| Desktop results `<th>`/`<td>` Stock column | `{canSeeStock && …}` (both cells, or the columns misalign) |
| Product details "Stock: N unit" pricing line | `{canSeeStock && …}` (the "Min Order" line on the same paragraph is gated the same way) |
| Product details low-stock banner | `isLowStock = canSeeStock && quantity <= LOW_STOCK_THRESHOLD` |
| Mobile product card `m-pc-stock` chip | `{canSeeStock && …}` |
| Compare modal "Stock" row | `{canSeeStock && …}` |

Suppliers and admins keep full visibility: the company dashboard table, the mobile company dashboard (`N in stock`), the add/edit product forms, the low-stock banner and the low-stock notifications (`LOW_STOCK_THRESHOLD = 10`) are all unchanged. When you add a new surface that prints `material.quantity`, gate it with `canSeeStock`.

**3. Delivery is chosen where the quantity is (v5.2).**
The "With delivery" checkbox lives in the same two places as the quantity control — `DetailsOrderBox` (product details) and `CartQuantityInput` (cart modal) — and nowhere else. It is a per-line decision, so a buyer can order 100 bags delivered and 50 collected from the same supplier. It rides on `CartItem.includeDelivery` (never a local-only UI state) because `priceCartItems`, the proforma and `confirmOrder` all have to agree on it long after the click. The supplier-side counterpart is the "delivered by me" block in the add/edit product form (§10.22).

---

## 14. Routes / Pages

No router library — `currentPage` switch in `App.tsx`:

| currentPage          | Renderer                    | Notes                          |
| -------------------- | --------------------------- | ------------------------------ |
| `splash`             | `renderSplash`              | 3 s intro                       |
| `home`               | `renderHome`                | Hero + stats + features        |
| `login` / `register` | `renderLogin`/`renderRegister` | Auth cards                |
| `search-materials`   | `renderSearchMaterials`     | Live search + supplier/dept/city/price filters + results table |
| `company-dashboard`  | `renderCompanyDashboard`    | Supplier view                  |
| `customer-dashboard` | `renderCustomerDashboard`   | Customer view (no export, v5.7) |
| `add-material`       | `renderAddMaterial`         | Product form (+ photos)        |
| `edit-material`      | `renderEditMaterial`        | Product edit (+ photos)        |
| `orders`             | `renderOrders`              | Order management (Export button is supplier-only, v5.7) |
| `settings`           | `AdminSettings` (admin only) | Delivery fee, zones, min order |
| (mobile shell)       | `renderMobileTopBar`, `renderMobileBottomNav`, `renderMobileMoreSheet` | Rendered only when `isMobile`; desktop header/footer replaced |
| (mobile home)        | `renderHomeMobile`      | Welcome hero, quick actions, trending carousel, saved strip, recent orders |
| (mobile orders)      | `renderOrdersMobile`    | Order cards + `OrderTimeline` stepper when `isMobile` |
| (mobile dashboards)  | `renderMobileDashboard` | Stat tiles + compact lists for company/customer when `isMobile` |
| (map)                | `renderSupplierMap`         | Modal flag `showSupplierMap`   |
| (modals)             | `renderMaterialDetails`, `renderCartSummary`, `renderProformaSupplierPicker`, EditCompany, `ProformaInvoice`, `compare-modal` | Overlays |
| (compare bar)        | Floating compare bar at bottom | Shows when `compareItems.length > 0` |
| (PWA banner)         | `pwa-install-banner` | Shows when browser supports install prompt |
| (public proforma)    | `PublicProforma` overlay | Opens automatically when URL hash is `#escon=<token>` |

---

## 15. Building for Production & Deployment

```bash
npm run build          # → ./build (static site)
npx tsc --noEmit       # Typecheck without building
CI=true npm run build  # Build with ESLint errors (Vercel CI mode)
```

Deploy the `build/` folder to any static host (Vercel, Netlify, GitHub Pages, Nginx, etc.). A `.vercel/project.json` already exists for Vercel.

> Because the app is fully client-side (no server), there is no environment configuration needed at runtime.

### PWA Requirements
For the install prompt to work:
- `public/manifest.json` must define `name`, `short_name`, `start_url`, `display: 'standalone'`, `background_color`, and `theme_color`.
- `public/index.html` must include `<link rel="manifest">` and `<meta name="apple-mobile-web-app-capable" content="yes">`.
- The app must be served over **HTTPS** (Vercel/Netlify provide this by default).
- `public/sw.js` is a **custom service worker** registered in `src/index.tsx` only when `process.env.NODE_ENV === 'production'`. It pre-caches the app shell and enables offline navigation. There is **no auto-updating CRA Workbox** build — version bumps in `VERSION` at the top of `sw.js` force refresh. Current value: `e-scon-v1.14.6` (bumped with every release so every installed PWA drops the old assets).
- **Clearing the cache for every user without touching their data (v5.5):** bump `VERSION` in `public/sw.js` and ship. On `activate` the worker deletes every Cache Storage bucket whose name is not the current `<VERSION>-shell` / `<VERSION>-runtime` pair, and `install` calls `skipWaiting()` + `activate` calls `clients.claim()`, so every open client drops its stale JS/CSS, pre-cached shell and map tiles and re-fetches the new build on its next load. **This is asset-only:** accounts, companies, products, orders, per-user carts, favourites, wallets, reviews, notifications and `system_settings` live in `localStorage`, which the service worker never reads or writes. Never add a `localStorage.clear()` (or a `caches`-touching data wipe) to that flow — that is what would destroy real data. A client that never opens the app again keeps its old cache until it does; that is expected.

> **Installing is always optional.** The app works identically in a normal browser tab; the Install Guide modal explains each device's steps.

---

## 16. Troubleshooting

| Symptom                              | Cause / Fix                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Leaflet default marker icons broken  | The icon-fix snippet in `MapComponent.tsx`/`MapPicker.tsx` must load before any marker creation |
| Distance shows "Unable to calculate" | OSRM demo server offline → haversine fallback already handles this; retry later |
| Tapping Order seems to do nothing    | Fixed in v6.8: alerts are a fixed toast above modals, the cart shows a loading state instead of returning `null`, routing requests abort after 9 s and try a second OSRM endpoint, and `confirmOrder` has `try/catch/finally` so it can never leave the button stuck |
| Order says location is unavailable   | Browser/app location permission is off, timed out, or the saved profile has no coordinates. Since v6.9 the Order Summary automatically asks for a fix and offers **📍 Use my current location**; allow GPS/location access and tap it, or press **Place Order** again. The app only falls back to the saved pin when one exists |
| KM did not change after moving       | By design since v6.11: the measured KM is fixed once a line carries it so the cart/checkout cannot quote a different number. To re-measure from a new position, move the pin in **My Location** (or reopen the product page) — the route effect re-runs on the updated coordinates |
| Order Summary stays on "Calculating…" | The quote is still debounced (250 ms) or the routing request is in flight. If it never resolves the block explains why and offers **📍 Use my current location** (no pin), **Retry calculating** (failed quote) or **Clear cart & order this product** (cross-supplier cart) instead (§13.1) |
| Cart stays on "Calculating your order..." | Fixed in v6.10: the re-pricing guard is written inside the 250 ms timer and released when pricing is cancelled. If totals still fail, the loading modal lists the saved lines and offers **Use my current location** or **Retry calculating**. Check `repricedCart`, `cartPriceFailed` and the auto-location effect (10.27) |
| "Please select a valid user" on a correct login | The account list had not finished loading. Local data is now published before the geocoding pass and login falls back to the stored `users` cache, so this window is gone in v6.8 (§6 startup order) |
| Geocoding fails at startup           | Nominatim rate limit — the app keeps the last-known coordinates and continues |
| localStorage quota exceeded         | Too many base64 product photos → reduce image count/size (cap is 6/product)   |
| `npm start` fails on Windows         | Ensure Node ≥ 14; delete `node_modules` and re-run `npm install`              |
| Build fails on TypeScript errors     | Run `npx tsc --noEmit` and fix reported errors                                 |
| Build fails with `no-unused-vars`    | Remove unused variables; CI treats ESLint warnings as errors                   |
| PWA install banner doesn't appear    | Must be served over HTTPS; browser must support `beforeinstallprompt` event    |
| Animations feel choppy               | Check `prefers-reduced-motion: reduce` — animations should be disabled for a11y |
| Frozen column overlaps other cells   | Ensure `.td-sticky` has proper `z-index` and `background` to cover scrolling content |
| A cart's delivery fee ignores the "With delivery" box | The open cart is priced 250 ms after a change; a fee that never updates means a line lost `CartItem.deliveryRate`, so `resolveLineDelivery` fell back to the platform rules (§10.22) |
| Proforma total ≠ order total         | Something computed a delivery fee outside `resolveLineDelivery`. Both `priceCartItems` and `confirmOrder` must call it (§10.22) |
| QR moved down the page / no QR       | The QR must stay in `.pf-header-qr`, pinned to column 3 of the `.pf-header` **grid**. Never render it inside the items block or after the table, and never put `.pf-header` back on `display: flex` — a long brand tagline then wraps the QR onto a new line at the left on mid-width screens (§10.7, §10.21) |
| Big cart → "Showing the first 12 of 40" | Expected: the QR payload is capped at `MAX_QR_LINE_ITEMS` for scannability and the true count is in `tc`. The printed document still lists everything (§10.21) |
| Adding a second supplier wiped the cart | `findOtherCartSupplier` must `return false` **before** `setCart` and never clear or replace anything. The check belongs in both `addToCartLogic` and the updater (§10.23) |
| Product details closes even though nothing was added | `addToCart` must return `boolean`; `DetailsOrderBox` awaits `onOrder()` and the App handler (`handleDetailsOrder`) refreshes GPS, adds the line and opens the cart only on success. An already-carted line skips the duplicate add but still refreshes the position (§10.23, v6.7) |
| "To Proforma" opens but does not print | `handlePrintProforma` must set `proformaAutoPrint`, and `ProformaInvoice`'s `autoPrint` effect must not be blocked by its `useRef` guard firing early (§10.5) |
| "Back to To Purchase" drops the buyer on a bare page | `handleBackToPurchase` must set `showCartSummary` **and** `setShowProforma(false)` — the old `← Back to Cart` only closed the proforma. It must also re-price via `calculateCartTotals()` and seed `repricedCart` (§10.5) |
| Buyer cannot leave the proforma / cart not re-priced on return | Check `onBackToPurchase` is passed to `ProformaInvoice` and that the handler does not reuse the stale `cartDetails`; delivery fees are computed from a live OSRM distance |
| A customer can still export orders | Every export surface must be role-gated: header `userType !== 'customer'`, orders page + mobile order card `{isCompany && …}`, mobile More sheet `userType !== 'customer'` (§10.5) |
| "To Purchase" won't pulse after coming back | `highlightPurchaseStep` is presentation only — it sets `is-returned` on the button and self-clears after 8 s. Verify the keyframes rule exists in `App.css` and that `prefers-reduced-motion` users get the static outline instead |

---

## 17. Extending the Project

Common extension points:

- **New pages:** add a case to the `currentPage` switch + a render function in `App.tsx`.
- **New data collection:** mirror the pattern of `materials` (state + persistence `useEffect` + type in `types.ts`).
- **New map behavior:** edit `MapComponent.tsx` (markers, route styling, panels).
- **New delivery pricing rule:** extend `computeLineDeliveryFee` / `resolveLineDelivery` and add cases to `src/utils.test.ts`. Do not add the rule inline in a component, or the cart, the proforma and the order will disagree.
- **A new line item on the proforma:** add the column to `ProformaInvoice.tsx` **and** `PublicProforma.tsx`, and re-balance the `pf-col-*` widths so the table still fits A4. The QR payload and its `tc` cap stay as they are.
- **Real backend:** replace localStorage reads/writes with API calls (the shapes in `types.ts` are already API-ready).
- **Real auth:** swap the demo login in `App.tsx` for a secure provider; **never** ship plaintext passwords.
- **New CSS:** append a clearly-commented section at the end of `App.css` (as done for the UI v2 polish) to avoid touching existing rules.

---

## 18. Testing (NEW in v4)

Tests target **pure logic only** — the map components and `App.tsx` rely on Leaflet/DOM APIs that jsdom cannot run reliably.

```bash
# Run once (non-watch) — recommended for CI
CI=true npm test -- --watchAll=false

# Interactive watch mode
npm test
```

| File                  | What it covers                                                       |
| --------------------- | -------------------------------------------------------------------- |
| `src/settings.test.ts` | Defaults, round-trip persistence, corrupted-JSON repair, number sanitising, admin seed |
| `src/utils.test.ts`    | `formatCurrency` (ETB, never ETH), `checkMinOrder`, **`findOtherCartSupplier` / `cartHasOtherSupplier`** (empty cart, same-supplier add, second supplier refused and the holder identified, re-ordering an existing material allowed, legacy mixed cart blocked from either side), `computeDeliveryFee` (fixed / zone / free-threshold / distance mode with mocked OSRM), **`computeLineDeliveryFee`** (box unticked = free, supplier start fee + per km, start fee alone, free offer, platform fallback, `offered: false` treated as no rate, negative fee clamped, `NaN`/negative distance = 0 km), **`lineDeliveryMode`**, **`deliveryBasisLabel`**, QR payload encode→decode round-trip, tampered token rejection, scannable URL format, **`buildProformaShareData`** (multi-item + multi-supplier payload, per-item delivery flag, legacy delivery data, `MAX_QR_LINE_ITEMS` truncation with `tc`, and a round-trip that survives truncation), **`roundKm`** (0.1 km rounding used by every buyer-facing view and by `stageCartLine`) |

41 unit tests, all passing. `setupTests.ts` intentionally does **not** import `@testing-library/jest-dom` (not installed in this project).

The single-supplier rule is a **pure** function in `utils.ts` precisely so it can be tested: `App.tsx` calls `findOtherCartSupplier` in both the pre-flight check and the `setCart` updater, so the UI and the tests cannot disagree. If you ever inline the `supplierId !==` comparison back into `App.tsx`, these five tests stop covering the real code path.

---

## 19. Instructions for the Next Programmer

Read this before touching any code. It prevents the most common mistakes.

### 19.1 Golden rules
1. **Never change "ETH" strings in `constants.ts`.** `ETH` in names like *ETH Steel*, *ETH Rebar* is a **brand name**, not currency. The currency is **ETB** everywhere. If you do a global find-replace of "ETH", you will corrupt product data.
2. **Never commit `.env.local`.** It holds a live Vercel OIDC token and is already gitignored. Do not read it into code, logs or console output.
3. **Money always goes through `formatCurrency`** (in `utils.ts`). Do not hand-roll `Intl.NumberFormat` or template strings with different separators.
4. **Never delete the admin seeder.** In `App.tsx` initialization, `ADMIN_USER` is re-appended if missing. Removing it logs out platform management silently.
5. **Append new CSS at the end of `App.css`** in clearly-commented sections; never rewrite existing rules in place. The exceptions are (a) the palette — theme tokens (`:root` / `[data-theme="dark"]`), the `.dark-mode` overrides and the navy scrim colours may be edited in place when the theme changes (see §12) — and (b) an explicit layout change requested for an existing component, which is edited inside **that component's own block** and never by borrowing rules from another section (e.g. the proforma party/totals layout in the `.pf-*` block, see §10.7).
6. **Desktop layout is frozen.** The mobile shell must be added *next to* it, never instead of it: JSX branches on `isMobile` (`useIsMobile`), and every mobile rule lives inside `@media (max-width: 768px)` at the end of `App.css`. Keep the JS breakpoint and the CSS breakpoint identical (`768px`). An explicitly requested layout change to an existing responsive component is the one thing that may edit its own block (§10.7, rule 5b).
7. **Tests are pure-logic only.** Do not write tests that import `App.tsx`, `MapComponent.tsx` or Leaflet — they need DOM APIs jsdom can't provide. Run `CI=true npm test -- --watchAll=false`.
8. **Mobile reuse** — build mobile UI from existing helpers (`renderProductImage`, `formatCurrency`, `handleCheckout`, `handleQuickReorder`, …); `MobileProductCard` is the single reusable product card for the carousel and search grid. New mobile-only files go under `src/hooks/` / `src/components/` and use CSS variables so both themes keep working.
9. **No dark surfaces.** Both themes are light blue. Use the `--bg` / `--card-bg` / `--glass-bg` / `--surface` tokens for any new background; deep blue (`--primary`) is only for accents that carry white text (heroes, primary buttons, avatars, badges). Never paint a page, card, modal or bar in `#000` / navy / `rgba(0,0,0,α)` (except `.datetime-widget.inverted`). Dim overlays may use the navy scrim `rgba(8, 22, 40, α)`.
10. **Quantities are chosen in one place only** — the product page's **Order Summary** / quantity row (§13.1). A list, card or carousel may only *navigate* to it; do not add a stepper, quantity input or `prompt()` to a results row, product card or table.
11. **Stock is supplier-only.** Any new UI that prints `material.quantity` must be wrapped in `canSeeStock` (company + admin) — the only exception is a supplier reading **their own** inventory on the company dashboard, which already renders inside the `userType === 'company'` guard (§10.6). Customers and guests must never see a stock number, an "In stock"/"Out" chip or a low-stock banner.
12. **Never enforce a per-product minimum.** `Material.minOrder` is supplier reference data; the customer path works in units of 1 (§13.1). The only minimum a customer can hit is the admin-configured goods-subtotal rule in `settings.ts`.
13. **A route request is a nonce, not a flag.** When the map should show a route, bump `routeRequestId` *and* set `autoRouteSupplierId`; never clear the destination to "reset" it (§10.2). Drawing waits for `isMapReady` and always goes through `drawRouteForSupplier`, which starts from the real GPS position once it is known.
14. **Never write a checkbox into `.form-group` without `checkbox-label`.** `.form-group label` is `display: block` and `.form-group input` is `width: 100%`, so a bare `<input type="checkbox">` becomes a full-width bar with its text on the next line. Use `<label className="checkbox-label">` (§12).
15. **A line's delivery fee is only ever computed by `resolveLineDelivery`.** Never call `computeDeliveryFee` or multiply a per-km rate by hand in the cart, the proforma or the order path. `confirmOrder` and `priceCartItems` must agree, or the invoice stops matching the order (§10.22). The same applies to the "is delivery included?" test: it is always `item.includeDelivery !== false`, never a truthiness check, because pre-v5.2 carts have no field at all and must keep charging delivery.
16. **The cart has two entry points.** Desktop header (`.cart-icon-btn`) and mobile tab bar (`.m-fab-cart`). Do not add a third — a button on a product row, card, carousel or the mobile top bar may only navigate to the product details, never open the cart (§10.5).
17. **One cart, one supplier.** Never let an add from a second supplier through, and never resolve the conflict by clearing or replacing the buyer's cart. Warn, name both suppliers, keep the dialog open, return `false`. Enforce it with `findOtherCartSupplier`, not an inline comparison, so the unit tests keep covering the real path (§10.23).
18. **The proforma header is a grid, not a flex row.** `.pf-header` pins `.pf-brand` / `.pf-meta` / `.pf-header-qr` to columns 1 / 2 / 3 of row 1, and the `≤760px` and `@media print` blocks only re-declare the columns. Flex let a long tagline push the QR onto a new line at the left on some screens; never reintroduce it (§10.7).
19. **Export is supplier/admin only.** Never add a CSV/export control to a surface a customer can reach, and never re-add one that exists only for them: header `userType !== 'customer'`, orders page and mobile order card `{isCompany && …}`, mobile More sheet `userType !== 'customer'`. The proforma is the buyer's only order document, by design (§10.5).
20. **A full-screen overlay must always be able to get the buyer back.** Closing the proforma must never be the only way out of it — `onBackToPurchase` re-opens the cart at step 1, re-priced. Any new full-screen modal (wallet, compare, notifications) that a customer enters mid-order must offer an explicit route back, and re-derive live figures rather than reusing a stale report (§10.5).

### 19.2 Where things live
- **Business rules** (delivery fee, zones, min order) → `src/settings.ts` + `src/components/AdminSettings.tsx`. They persist under `system_settings` in localStorage. `calculateTransportCost` in `utils.ts` is the **legacy hard-coded** helper; new code must use `computeDeliveryFee` (settings-driven). Search estimates use `computeDeliveryFee` directly; cart totals, the proforma and order creation go through `resolveLineDelivery`, which only falls back to `computeDeliveryFee` when a supplier publishes no rate of their own (§10.22).
- **Currency** → `formatCurrency` in `utils.ts` (used by App, ProformaInvoice, AdminSettings, PublicProforma).
- **Search filters** → `FormData.search*` fields + `performSearch` in `App.tsx`; the filter row is `renderSearchMaterials` and reuses `.search-filters` / `.filter-select` / `.filter-input` / `.filter-clear`. A new filter needs: the field in `FormData` (`types.ts`), the `formData` initialiser, the check in `performSearch`, the control in the filter row, the debounce dependency list, and the reset in `clearFilters`.
- **Proforma scope** → a proforma is always the **whole cart**: `handlePrintProforma` and `handlePreviewProforma` both price every line with `priceCartItems` and store the report in `proformaDetails`. Do not render the proforma from `cartDetails`, and do not reintroduce a supplier picker, a "one supplier per invoice" scoping helper, or a QR that moves down the page as the item list grows (§10.21).
- **Cart scope** → the cart holds **one supplier** (§10.23). The rule is `findOtherCartSupplier` in `utils.ts` (pure, unit-tested); `App.tsx` calls it in `addToCartLogic` before the write and again inside the `setCart` updater. `addToCart` returns a `boolean` so `DetailsOrderBox` can keep the dialog open on a rejection.
- **Supplier dashboard name** → `.dashboard-supplier-name` in `App.css`, rendered on the desktop `.dashboard-header-supplier` and the mobile `.mobile-page-head-supplier`. Bold and centred; the customer dashboard keeps its greeting.
- **QR / sharing** → `encodeProformaPayload`, `decodeProformaPayload`, `buildProformaQrUrl`, `generateProformaQrDataUrl`, `buildProformaShareData` and `MAX_QR_LINE_ITEMS` in `utils.ts`; rendering in `ProformaInvoice.tsx` and `PublicProforma.tsx`. The hash format is `#escon=<base64url(ESCON1+json)>`. Truncating the payload is allowed; truncating the **printed** document is not.
- **PWA** → `public/sw.js` (custom, version `VERSION` const), `src/index.tsx` registration (production only), `src/components/InstallGuide.tsx`, banner logic in `App.tsx`.
- **Admin page routing** → a `case 'settings'` in the `renderCurrentPage` switch guards `userType === 'admin'`.
- **Role visibility** → `canSeeStock` in the "Role visibility" block of `App.tsx` (top of the component, right after the state) is the single source of truth for supplier-only data; the customer-only blocks use `currentUser?.userType === 'customer'`. **Exports** are gated separately, inline, at each surface (§10.5) — there is no `canExport` helper.

### 19.3 Common change scenarios
- **"Change the delivery fee":** open the app with `admin@escon.et` → ⚙️ Settings → edit → Save. No code required. To change the default that new installations get, edit `DEFAULT_SETTINGS` in `settings.ts`.
- **"Add a new Ethiopian city to a zone":** Settings → zone → the "+" button adds a city selector. The city list is `ETHIOPIAN_CITIES` in `constants.ts`.
- **"Point the map at a different tile server":** edit the tile-layer URLs in `MapComponent.tsx` and `MapPicker.tsx`. If you add a cross-origin tile host, update `sw.js` caching rules too.
- **"Add a page":** add a `case` in `renderCurrentPage`, a nav button in `renderUserNav`/`renderGuestNav`, and optionally a hash shortcut in `manifest.json` (`shortcuts`).
- **"Add a search filter":** see the *Search filters* bullet in 19.2 — six touch points, and reuse the existing filter classes so the frame does not change.
- **"Let a customer order from two suppliers at once":** you don't — one cart, one supplier (§10.23). `findOtherCartSupplier` refuses the second add and leaves the cart alone. Do **not** relax this by clearing or replacing the cart on the buyer's behalf, and do not re-add the v5.1 supplier picker to the proforma; if a buyer genuinely needs two suppliers, they clear the cart and order twice.
- **"Push a PWA update":** bump `VERSION` in `public/sw.js` so old caches are purged in `activate`.
- **"Users are seeing an old/stale version of the app":** bump `VERSION` in `public/sw.js` (currently `e-scon-v1.14.6`) and push. Every client purges its asset + tile caches on the next load and keeps all of its data — accounts, products and orders are in `localStorage` and are never part of that purge (§16). If a single user is still stuck, they have to reload once; an unopened app cannot be reached.
- **"A customer asks how much stock is left":** they cannot see it anywhere in the UI by design (§13.1). Suppliers see it on the company dashboard, the mobile dashboard and the product details page; add a `canSeeStock` block if you need a new stock surface.
- **"A customer asks about the minimum order for one product":** there is none — any quantity of 1 or more is allowed. The per-product `minOrder` is reference data for the supplier and appears in the comparison view and the supplier-side forms. The admin-configured cart minimum in ⚙️ Settings is the only threshold a customer can hit.
- **"The map opens without a route":** check `isMapReady`, the `routeRequestId` nonce and the sticky `autoRouteSupplierId` (§10.2), then confirm the destination is in the `companies` list passed to the map.
- **"Add a quantity control somewhere new":** don't. Open the product details (`setSelectedMaterial`) and let `DetailsOrderBox` handle it. The same goes for the "With delivery" checkbox — it belongs to the quantity card, so it rides along in the new single-page cart's Delivery Cost block and in `DetailsOrderBox`.
- **"The delivery fee on the proforma doesn't match the order":** something bypassed `resolveLineDelivery`. Diff the call sites: `priceCartItems` (cart + proforma) and `confirmOrder` (order creation) must both call it with the same `includeDelivery` and `deliveryRate`. Also check `CartItem.deliveryRate` was snapshotted when the item was added — a cart line that lost its rate silently falls back to the platform fee (§10.22).
- **"A customer wants their order list as a file":** they cannot export it — that is deliberate. Point them at the **proforma** (cart → `2 To Proforma` / `3 To Preview`), which is their order document. Do not add an export for them; if the product owner changes their mind, the gating points are listed together in §10.5.
- **"The buyer went to the proforma and now can't order":** that is what `handleBackToPurchase` is for. It closes the document, re-prices and re-opens the cart with `is-returned` on the "To Purchase" step. If the button only closes the overlay, you have restored the old broken behaviour (§10.5).

### 19.4 Known limitations (do not "fix" without discussion)
- Passwords stored in plaintext — demo only.
- No custom backend; localStorage is the offline cache (~5 MB limit; base64 product photos are the main consumer). Supabase mirrors shared data when configured.
- OSRM + Nominatim are free public servers — rate limits and occasional outages are expected; fallbacks already exist.

---

## 20. Changelog (recent releases)

The app's user-facing labels are unchanged; the Android build carries `versionCode`
(integer, must increase for every Play upload) and `versionName` in
[`android/app/build.gradle`](../android/app/build.gradle). The PWA's cache-bust
switch is `VERSION` at the top of [`public/sw.js`](../public/sw.js).

### v6.16 - centred A4-width cart on desktop, map measures from the same buyer pin
- **Desktop cart is a centred A4-width sheet.** At `min-width: 641px` the cart
  modal is capped at 794 px (A4 width at 96 dpi) and centred by the overlay,
  instead of stretching to `99vw`. The sheet hugs its content (`height: auto`,
  `max-height: calc(100vh - 48px)`) with no dead space at the bottom, the modal
  padding is removed so the document fills the page, and the header clock sits
  on its own line. The cart body scrolls inside when the review is taller than
  the screen. Phones (≤640 px) are unchanged and stay full-screen.
- **The map now uses the same origin as search and the product page.** The
  `MapComponent` origin is seeded from the saved buyer pin and a new effect
  follows `currentUser.lat/lng` changes until a live GPS fix arrives, so the
  pre-click search KM, the product page and the route card cannot disagree.
- **No fake Addis measurement.** Without a saved pin or GPS fix the map no
  longer draws a distance from the `9.0320/38.7469` default; it shows
  "Set your location to measure" and redraws automatically on the first fix.
  The status line now distinguishes "using your saved location" from "set your
  location", and `Locate Me` marks the position as trustworthy.
- **Release.** `versionCode 19` / `versionName "1.9.9"`, `sw.js` `VERSION`
  `e-scon-v1.14.7`.

### v6.15 - one KM everywhere, map fix shared with the app, delivery breakdown removed
- **Single source of truth for distance.** `roundKm` in `utils.ts` rounds every
  measured road distance to the 0.1 km shown to buyers. `stageCartLine`,
  `priceCartItems`, `confirmOrder`, the product-page preview and search all store
  or display that same value, so the KM read on a result row, the product page,
  the cart, the proforma and the placed order can no longer differ.
- **Search no longer invents an Addis fallback.** `performSearch` measures only
  when the buyer has a real pin (its old `9.0320/38.7469` fallback could show a
  KM the product page refused to produce). Without a location the row shows `—`.
- **The map's GPS fix flows back to the app.** `MapComponent` accepts
  `onLocationFix` and reports the first real fix, then only meaningful moves
  (≈50 m) or much better accuracy. `App` persists that pin as the buyer origin,
  so the map, product page, cart and proforma measure from the same point.
- **Saved carts re-measure when the origin moves.** A new effect compares
  `currentUser.lat/lng` with the origin the lines were measured from and updates
  `CartItem.distanceKm` (then re-prices the open cart), covering a fresh GPS fix
  from the map, the cart's Refresh button, and a reload after moving.
- **Delivery breakdown removed.** `ProformaInvoice` no longer renders the
  `.pf-delivery-box` "Delivery Breakdown", and `PublicProforma` no longer lists
  the per-supplier delivery lines. The one **Delivery Cost** row in the summary
  remains the authoritative total. The legacy `f` payload field is still encoded
  for old QR readers but is not shown.
- **Release.** `versionCode 18` / `versionName "1.9.8"`, `sw.js` `VERSION`
  `e-scon-v1.14.6`.

### v6.13 - accurate map pins, live cart delivery block, shared amount in words
- **Supplier pins resolve to their real addresses.** `utils.ts` now carries a
  local OSM gazetteer for Bole, Bole Gerji/Gerji, CMC, Kazanchis, Kality, Akaki,
  Piazza, Megenagna, Sar Bet, Gofa, Lebanon/Bole Medhanialem, Lideta, Mexico and
  Adama. `geocodeAddress` checks it before calling Nominatim, and
  `isGenericCoordinate` detects the old hand-waved seed pins so they are
  re-resolved automatically.
- **Nominatim is no longer called in parallel.** Startup geocoding runs
  sequentially with a 1.1 s gap, uses `format=jsonv2&addressdetails=1`, and
  rejects results outside Ethiopia. Supplier alerts appear only when a pin
  actually moved.
- **Cart Delivery Cost block is live.** Starting Point is the selected supplier's
  real location (switchable), Destination is the buyer's address/city,
  Total Distance is the measured line distance, Rate is the supplier's per-km
  rate or the effective platform rate, and Delivery Cost is the actual quote.
  `GPS MAP` opens the supplier route; `Refresh` takes a fresh GPS fix,
  re-measures every line and re-prices the cart.
- **Amount in words is shared.** `numberToWords` / `amountToWords` live in
  `utils.ts`; the cart and `ProformaInvoice` both use them (Birr + cents).
- **Routing is resilient.** The map tries `router.project-osrm.org`, then
  `routing.openstreetmap.de`, checks HTTP status and times out at 12 s before
  falling back to a straight line.
- **Seed data.** `supabase/seed.sql` user/company pins now use the same accurate
  neighbourhood coordinates.
- **Release.** Bumped `versionCode` 16 to 17, `versionName` 1.9.6 to 1.9.7 and
  `sw.js` `VERSION` `e-scon-v1.14.4` to `e-scon-v1.14.5`.

### v6.12 — new Sample Layout cart, single page on every device (bug-fix: dead code + stale docs cleaned)
- **Cart rebuilt against the latest `Sample Layout.jpg`.** The modal is now a full single-page proforma-style order document that fits on one screen on desktop, tablet and phone: supplier & buyer details, a product photo banner per line, a numbered order-items table (with inline `−` / `+` quantity stepper), a Delivery Cost block that prints the **exact road km** carried from the product page and the per-km rate, a live buyer-facing note when a supplier group has no published rate and the platform fee applies, financial totals (Amount before VAT → VAT → Delivery Cost → Grand Total), the amount in words, terms & conditions, payment-method choices, supplier & buyer signature lines, and the bottom actions.
- **Stale-weight guard fixed.** The cart no longer quotes a different distance than the product page: each `CartItem.distanceKm` is snapshotted when the line is staged, and `priceCartItems`, `resolveLineDelivery`, `confirmOrder` and the proforma reuse it verbatim, routing only for legacy lines without one.
- **Dead code removed.** The old `CartQuantityInput` module component and its `onToggleDelivery` wiring were removed when the cart UI was rebuilt; the dead `handleDeliveryFeeChange` / `handleDeliveryFeeReset` manual-delivery-fee handlers were removed (delivery is now driven solely by each line's "With delivery" checkbox and the supplier's published rate, or the platform fallback). No unused declarations remain in the production build.
- **Single-page sizing.** The modal body is capped and scaled so the whole order document is readable without scrolling on every device; the close button is the layout's ✕ style and lives in the dark-blue header with the live `LiveClock`.
- **Documentation.** §9 (module-scope functions) and §10.5 (cart & checkout) rewritten for the rebuilt cart; stale `CartQuantityInput` / manual-delivery-fee references removed from the troubleshooting notes and the route table.
- **Release.** Bumped `versionCode` 15 to 16, `versionName` 1.9.5 to 1.9.6 and `sw.js` `VERSION` `e-scon-v1.14.3` to `e-scon-v1.14.4`.

### v6.10 - cart first, location when pricing
- **Adding to the cart never waits for GPS.** `Add to Cart & Review` is always
  visible on the product page and `handleDetailsOrder` stores the line before it
  reads any coordinates. A denied, unavailable or slow location can no longer
  stop a product from reaching the cart. The button label is now
  **Add to Cart & Review**.
- **The cart asks for the location.** Opening a non-empty cart without usable
  coordinates calls `refreshCurrentLocation()` once (`cartLocationTried` stops
  repeat prompts). While delivery is priced the modal lists the saved lines and
  shows **Calculating your order...**. If the fix fails, the modal keeps the
  lines and offers **Use my current location** (no pin) or **Retry calculating**
  (pin exists), with the proforma/checkout steps hidden until pricing succeeds.
- **Place Order stages the line first.** `handlePlaceOrderFromDetails` adds the
  line to the cart before taking a fresh fix. If the fix fails, the cart opens
  with the line saved so the buyer can retry from **1 To Purchase** instead of
  returning to an unchanged product page.
- **Cart repricing can no longer cancel itself.** The `repricedCart` signature
  guard is now written inside the 250 ms timer, and a cancelled in-flight price
  releases it. The previous ordering let a re-render clear the timer while the
  guard stayed set, so the effect returned early forever and the cart stayed on
  "Calculating your order...". The failure state is now reachable and actionable.
- **Release.** Bumped `versionCode` 12 to 13, `versionName` 1.9.2 to 1.9.3 and
  `sw.js` `VERSION` `e-scon-v1.14.0` to `e-scon-v1.14.1`.

### v6.9 — ordering works for a buyer with no saved pin
- **Order Summary gets the location itself.** If the buyer has no usable
  coordinates, the quote effect now requests one high-accuracy GPS fix
  (`detailsLocationTried` limits it to one attempt per product) and prices from
  it. If that fix fails, the `.pd-summary-block` offers **📍 Use my current
  location**, which resets the attempt and re-quotes — instead of a dead
  "Retry calculating" loop that could never succeed.
- **Place Order uses the fresh fix immediately.** `handlePlaceOrderFromDetails`
  passes the coordinates it just acquired to `confirmOrder`, which builds the
  buyer object from them for the coordinate guard, `priceCartItems`,
  `calculateDistance`, the wallet and the written order rows. The first location
  grant therefore no longer fails against the stale `currentUser` state.
- **Cart path asks for a fix too.** `confirmOrder` acquires a GPS position when
  no `origin` is supplied and the buyer/stored profile has no coordinates, so
  **1 To Purchase** stops refusing legacy or location-less accounts.
- **Release.** Bumped `versionCode` 11 to 12, `versionName` 1.9.1 to 1.9.2 and
  `sw.js` `VERSION` `e-scon-v1.13.0` to `e-scon-v1.14.0`.

### v6.8 - order feedback, accurate KM and cloud-first commit
- **Product page rebuilt to the Sample Layout.** `DetailsOrderBox`/`renderMaterialDetails`
  now render four sections in a fixed order — **Product Details → Supplier
  Information → Customer Reviews → Order Summary** (`.pd-section`) — with the
  photo gallery, Unit/Delivery price cards, the quantity row and live Material
  Subtotal, the supplier route card, reviews, and an **Order Summary** that
  prices subtotal, delivery, VAT and **Total Payable** on the page. The old
  **Supplier → Description → Pricing → Distance → Reviews** ordering and the
  trailing `.order-box` are gone.
- **Ordering no longer dead-ends.** When the summary cannot quote — no usable
  location, or the cart holds another supplier's goods — the disabled
  "Calculating…" button with `…` totals is replaced by a `.pd-summary-block`
  that names the cause and offers **Retry calculating** or **Clear cart & order
  this product**. **🛒 Place Order** writes the order and opens the Orders page;
  **Add to cart & review instead** keeps the old cart path.
- **Startup no longer blocks login or the catalogue.** The account, company,
  material and order collections are published to React state (and the login
  datalist) *before* the Nominatim geocoding pass, which is the only network
  part of init; `setIsInitialized(true)` still gates persistence and cloud
  pushes. `handleLogin` also falls back to the stored `users` cache, so a valid
  account is never rejected with "Please select a valid user" while the list
  loads.
- **Order no longer appears to do nothing.** Alerts now render in a fixed toast
  layer above every modal, so a GPS/permission error is visible instead of being
  hidden behind the product-details overlay.
- **Cart opens even while pricing.** The cart modal no longer returns `null`
  when totals are still loading; it shows a live "Calculating your order..."
  state and then the priced cart. This removes the blank/no-response failure
  when the routing request was slow.
- **No hung routing requests.** `calculateDistance` now aborts each OSRM request
  after 9 seconds and tries a second independent OSRM endpoint. The straight-line
  fallback is used only when both road-routing servers fail. Six-decimal cache
  keys and the real supplier/buyer coordinates keep the measured KM accurate.
- **No invented Addis coordinates.** `confirmOrder` refuses to place an order
  without a real customer pin; the old `9.0320 / 38.7469` fallback is gone.
- **Cloud-first order write.** Placed orders are written to React state and
  pushed to Supabase `escon_kv` immediately, in addition to the normal realtime
  and polling sync. All shared collections remain cloud-synced; localStorage is
  only the fast local cache.
- **Safer failure handling.** `confirmOrder` has a `try/catch/finally`, always
  clears the calculating state, and refunds a wallet payment if the order could
  not be committed. The success alert is no longer overwritten by "Cart cleared".
- **Release.** Bumped `versionCode` 10 to 11, `versionName` 1.9 to 1.9.1 and
  `sw.js` `VERSION` `e-scon-v1.12.0` to `e-scon-v1.13.0`.

### v6.7 — live GPS distance on Order
- **Fresh fix, not the saved pin.** Pressing **Order** in the product details
  calls `getCurrentCoordinates()` with `enableHighAccuracy: true` and
  `maximumAge: 0`, so the delivery distance is measured from where the customer
  is at that moment. The new coordinates are saved to the profile (silently) and
  reused by the cart, proforma and placed order.
- **Accurate road distance.** The live coordinates are sent to OSRM for the
  driving distance (`calculateDistance`); the haversine fallback is only used if
  the route service is unreachable. Distance cache keys now use 6 decimals so
  nearby GPS fixes are not rounded together.
- **Clear fallback.** If permission is denied, timeout or GPS is unavailable,
  the app warns the buyer and uses the saved location only when one exists;
  otherwise the order is stopped with instructions to enable location access.
- **Cart re-prices on location change.** The cart's re-pricing signature includes
  the buyer's coordinates, so a new fix updates delivery fees even when the cart
  lines did not change.
- **Release.** Bumped `versionCode` 9 to 10, `versionName` 1.8 to 1.9 and
  `sw.js` `VERSION` `e-scon-v1.11.0` to `e-scon-v1.12.0`.

### v6.6 — product-detail order flow
- **Fixed details order.** The product details view now renders **1 Supplier,
  2 Description, 3 Pricing (with forecast), 4 Distance, 5 Customer Reviews**,
  followed by the order box.
- **Order button.** `DetailsOrderBox` is now an **Order** action: it adds the
  selected quantity and opens the cart/order screen. A line already in the cart
  shows a green **Ordered — Go to Order** button that opens the cart without
  adding the same item twice.
- **Release.** Bumped `versionCode` 8 to 9, `versionName` 1.7 to 1.8 and
  `sw.js` `VERSION` `e-scon-v1.10.0` to `e-scon-v1.11.0`.

### v6.5 — Supabase seed, VAT at order, one-page proforma & editable locations
- **Hard-coded business records removed.** `src/constants.ts` keeps only the
  city / unit / department reference lists; `App.tsx` falls back to `[]`. The
  demo data moves to `supabase/seed.sql` (idempotent upsert of every `escon_kv`
  key, generated from the previous sample arrays).
- **VAT only at order time.** The cart no longer adds VAT on add or re-price. The
  proforma and placed order apply one aggregate VAT through
  `calculateCartTotals(true)`; the cart shows a clear pending-VAT note and checks
  wallet balance against the VAT-inclusive total.
- **One-page proforma.** `ProformaInvoice` measures `.pf-document` at A4 width and
  sets `--pf-print-zoom` before every print, so long invoices scale down instead
  of producing a second page.
- **Locations everywhere.** Registration geocodes the address; customers get a
  **My Location** card/`MapPicker`; admins can edit any user's coordinates from
  Settings; supplier profile editing is unchanged.
- **Order affordances.** Mobile product cards now show **🗺️ GPS** beside **Order**.
  Order buttons are yellow; ordered/update buttons and the cart summary are green.
- **Welcome headings** on page-level headings across desktop and mobile.
- **Docs, tests & release.** README, this document, `docs/CLOUD_DATABASE.md` and
  `docs/USER_GUIDE.md` describe the seed and new flows; `npm test` (55 tests) and
  `npm run build` pass. Bumped `versionCode` 7 → 8, `versionName` 1.6 → 1.7 and
  `sw.js` `VERSION` `e-scon-v1.9.0` → `e-scon-v1.10.0`.

### v6.4 — editable data, admin data manager & single aggregate VAT
- **Seed data no longer resets.** Initialization uses `sampleUsers` /
  `sampleCompanies` / `sampleMaterials` / `sampleOrders` **only when the key is
  absent**. A saved empty collection is respected, saved companies are no longer
  merged back with `sampleCompanies`, and persistence writes empty arrays too.
  Deleted demo rows therefore stay deleted after refresh.
- **Every product field is editable.** The add/edit forms now expose profit
  margin, transport estimate, weight per unit, model, packed weight, dimensions,
  grade, origin and certifications. The old hard-coded 15% margin / 15 ETB
  transport / 0.001 t weight are form defaults instead.
- **Admin data manager.** **Settings** now lists accounts, suppliers and the
  catalogue. Admins can delete non-admin accounts, edit/delete supplier profiles
  (with their products) and search/edit/delete any product. The seeded admin
  account is protected.
- **VAT is calculated once.** `vatOnSubtotal()` computes VAT on the aggregate
  net goods subtotal and `allocateVat()` splits that single amount across order
  rows by net value, so cart, proforma and orders always agree. The rate and an
  enable switch live in `SystemSettings.vat` and are editable in **Settings**.
  Legacy `taxIncluded: true` sample rows are normalised to the VAT-exclusive
  model on initialization.
- **Housekeeping** — bumped `versionCode` 7 → 8, `versionName` 1.6 → 1.7 and
  `sw.js` `VERSION` `e-scon-v1.9.0` → `e-scon-v1.10.0`.

### v6.3 — VAT always in the total & supplier profile recovery

- **VAT is part of every total.** Editing the delivery fee on the cart used to
  recompute `total = subtotal + delivery` and silently drop the VAT that was
  still displayed on the same screen; the override now keeps
  `total = subtotal + VAT + delivery`, so the VAT row and the total can never
  disagree.
- **No cart line is ever dropped.** `priceCartItems` and `confirmOrder` skipped a
  line whose supplier profile record was missing, which removed its goods value
  (and its VAT) from the totals while the line was still shown, and could charge
  a buyer for an item that produced no order. Both now rebuild the supplier
  record on the spot — from the owning account under its original id, or a stub —
  so every line is priced, VAT-charged and ordered. A line whose product was
  deleted is also ordered now, using the details snapshotted on the cart line.
- **"Edit Company Profile" always opens.** When the profile record was missing,
  the page router fell through to the previous page (the failure mode behind the
  old *Company profile not found* alert). The editor is now rebuilt from the
  account on the spot, and a cloud row can no longer wipe supplier profiles: an
  incoming `companies` row is merged with the local copy and re-attached to any
  company account that has lost its profile, exactly like the startup recovery.
- **Proforma styling matches the maths.** The VAT summary row was still styled
  as a greyed, non-additive "information only" line left over from the
  VAT-inclusive build; it is a normal summary row again.
- **Housekeeping** — bumped `versionCode` 6 → 7, `versionName` 1.5 → 1.6 and
  `sw.js` `VERSION` `e-scon-v1.8.0` → `e-scon-v1.9.0`.

### v6.2 — VAT-exclusive product pricing

- **Supplier prices are net.** New products are saved with `taxIncluded: false`;
  the price entered by the supplier is the amount before VAT and is never
  reduced by a VAT extraction.
- **VAT is added at purchase.** `addedVat()` / `addedVatRate()` in `utils.ts`
  replace the old inclusive helpers. Cart, checkout, orders, CSV exports, the
  printed proforma and the QR public proforma use
  `total = net subtotal + VAT + delivery`.
- **Clear documents.** The proforma shows **Amount Before VAT**, **VAT (15%
  added)**, **Delivery Cost** and **Grand Total**; item prices are labelled
  "before VAT".
- **Housekeeping** — bumped `versionCode` 5 → 6, `versionName` 1.4 → 1.5 and
  `sw.js` `VERSION` `e-scon-v1.7.0` → `e-scon-v1.8.0`.

### v6.1 — global cloud sync & Amount Before VAT

- **Products are global.** Adding, editing or deleting a product now pushes the
  `materials` collection to Supabase. Startup pulls the cloud copy first, a
  Realtime subscription applies remote edits instantly, and a 10-second polling
  fallback covers projects where the Realtime publication is not enabled.
- **All shared data travels.** Users, companies, orders, notifications, wallets,
  wallet transactions, reviews, settings and per-user carts/favourites are
  mirrored the same way. With no Supabase credentials the app stays local-only.
- **Safe upgrade merge.** The first v6.1 start merges local business data with
  the cloud copy (local wins on the same ID) so items added while v6.0 was
  local-only are not overwritten. New users, companies and products get
  collision-resistant IDs instead of sequential ones.
- **Amount Before VAT on the proforma.** The printed/on-screen proforma and the
  QR “public proforma” now show the goods amount before VAT, followed by the
  VAT-included subtotal, the included VAT and the grand total.
- **Housekeeping** — bumped `versionCode` 4 → 5, `versionName` 1.3 → 1.4 and
  `sw.js` `VERSION` `e-scon-v1.6.0` → `e-scon-v1.7.0`.

### v6.0 — VAT-inclusive totals, clearer search results & screenshots allowed

- **VAT is no longer added twice.** Supplier prices are VAT-inclusive. New
  `includedVat()` / `includedVatRate()` helpers in `utils.ts` extract the VAT
  already contained in a gross line total; cart, checkout, orders, the proforma
  and the public QR proforma now use `total = subtotal + delivery`. Labels say
  **VAT included**, and the cart CSV columns make the inclusive basis explicit.
- **Clearer search results.** Mobile product cards drop the department chip;
  the desktop results table drops the Category column. Product name, supplier
  and price are bold on both layouts.
- **Screenshots are allowed on Android.** `MainActivity.java` no longer sets
  `FLAG_SECURE`; the standard screenshot/screen-recording shortcuts work and
  store screenshots can be taken from the shipped app.
- **Current account flow.** The codebase retains the pre-v5.9 account flow:
  suppliers get a near-Addis default at registration and edit their business
  through the **Edit Company Profile** modal; the v5.9 **My Business** page,
  map-at-registration step and automatic entity cloud sync were not wired in v6.0
  (the sync layer was re-enabled in v6.1). `settings.ts` still syncs
  `system_settings` when Supabase is configured.
- **Housekeeping** — bumped `versionCode` 3 → 4, `versionName` 1.2 → 1.3 and
  `sw.js` `VERSION` `e-scon-v1.5.0` → `e-scon-v1.6.0`.

### v5.8 — branding, screenshot protection & mobile search polish

- **App icon = `public/logo512.png`.** The Android launcher icons (legacy + round +
  adaptive foreground, all densities) and the PWA `logo192.png` / `favicon.ico`
  were regenerated from the logo, so the phone icon, browser tab and store icon
  all match the in-app logo. See [10.24](#1024-branding-screenshots--search-polish-v58v60).
- **Screenshots are blocked in the Android app.** `MainActivity.java` now sets
  `FLAG_SECURE`, so the OS refuses screenshots/screen recordings of the app and
  blanks the recents preview. This is native-only — a browser tab cannot block
  screenshots.
- **Mobile search results** — the department chip is bold and larger, the **Order**
  button is compact, and a new 🗺️ **Map** button sits beside it on the next line
  (`handleOpenMapWithRoute`). The desktop table's category column is bold and
  slightly larger too.
- **Full-bleed Find bar** — on phones the search field and its 🔍 button now span
  the entire window width, side to side.
- **Housekeeping** — removed unused `escon.pdf`, `sample.jpg`, the CRA `logo.svg`
  and the unused launcher template vectors; bumped `versionCode` 1 → 2,
  `versionName` 1.0 → 1.1 and `sw.js` `VERSION` `e-scon-v1.3.0` → `e-scon-v1.4.0`.

### v5.9 — supplier self-service "My Business"

- **One place for everything a supplier owns.** New `my-business` page
  (`renderMyBusiness`) with **Profile & Location** and **Products** segments,
  reachable from the desktop nav, the phone **More** sheet and a **🏢 Manage My
  Business** button on both supplier dashboards. See
  [10.25](#1025-company-profile-editing-v60).
- **Editable account** — full name and an optional new password; the company
  **logo** can be uploaded, replaced or removed. `EditCompany` gained an
  `embedded` mode and the old `showEditCompany` modal / `handleEditCompany` were
  removed.
- **Complete product forms** — the add/edit product forms now expose the
  previously-stored weight/dimensions/grade/origin/certifications and model
  fields via `renderMaterialSpecificationsFields()`.
- **Housekeeping** — bumped `versionCode` 2 → 3, `versionName` 1.1 → 1.2 and
  `sw.js` `VERSION` `e-scon-v1.4.0` → `e-scon-v1.5.0`.
- **Location at sign-up** — suppliers now pin their business on the map during
  registration (required), with the same `MapPicker` they already use in **My
  Business**.
- **Not present in v6.0:** this release's My Business page, map-at-registration
  step and entity cloud sync were reverted in the current working tree. Keep this
  entry as history; v6.0 documents the account flow that actually ships.

Earlier releases (v5.2 – v5.8) are summarised inline throughout §10; nothing in
this release changed an existing feature or its behaviour.

---

*Generated by the E-SCON development workflow — September 2026.*
