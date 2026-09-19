# E-SCON — Ethio-Supply Chain Optimization Network

## 📘 Technical Documentation

> **Version:** 5.0 (Mobile Banking UX)
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
10. [Key Features & How They Work](#10-key-features--how-they-work)
11. [Third-Party Integrations](#11-third-party-integrations)
12. [Styling System & Themes](#12-styling-system--themes)
13. [Responsive / Mobile / Touch Design](#13-responsive--mobile--touch-design)
14. [Routes / Pages](#14-routes--pages)
15. [Building for Production & Deployment](#15-building-for-production--deployment)
16. [Troubleshooting](#16-troubleshooting)
17. [Extending the Project](#17-extending-the-project)
18. [Testing](#18-testing-new-in-v4)
19. [Instructions for the Next Programmer](#19-instructions-for-the-next-programmer)

---

## 1. Project Overview

**E-SCON** (Ethio-Supply Chain Optimization Network) is a single-page web application that connects **suppliers** (companies) with **customers** in Ethiopia. It provides:

- Product catalogue with **live search & filtering** (department, city, max price, sorting).
- **GIS supplier mapping** built on Leaflet, with **driving routes**, **distance**, and **transport cost** calculations.
- **Company dashboards** for suppliers to manage products & orders, and **customer dashboards** for order history.
- **Cart & checkout** flow with VAT (15%) and delivery-fee computation.
- **Compliance** data capture (TIN, business license, VAT).
- CSV **export** and **printable reports**.
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

> The **Admin** account is a seeded platform role. Only admins see the **⚙️ Settings** page where the delivery-fee model, delivery zones, free-delivery threshold and minimum-order rule are configured (see §10.16). It is created automatically on first load if missing.

---

## 5. Project Structure

```
supply-chain1/
├── public/
│   ├── index.html          # HTML entry, meta tags, fonts, Leaflet CDN CSS, PWA meta
│   ├── manifest.json       # PWA manifest (standalone app, icons, shortcuts)
│   ├── sw.js               # Custom service worker (pre-cache + network-first)
│   ├── favicon.ico
│   ├── logo192.png / logo512.png
│   └── robots.txt
├── src/
│   ├── index.tsx           # React root — registers the service worker (production only)
│   ├── index.css           # Minimal global styles
│   ├── App.tsx             # Main application (state, routing, ALL pages)
│   ├── App.css             # All styles (theming, layout, components, responsive, animations)
│   ├── types.ts            # TypeScript interfaces (User, Company, Material, SystemSettings, …)
│   ├── constants.ts        # Sample data + city/unit/department lists
│   ├── settings.ts         # Runtime-configurable platform settings (delivery fee, min order, zones, admin)
│   ├── utils.ts            # Helpers: distance, fees, min-order, QR payloads, CSV, formatting
│   ├── hooks/
│   │   └── useIsMobile.ts  # matchMedia("(max-width: 768px)") — drives the mobile shell
│   ├── settings.test.ts    # Unit tests for SystemSettings persistence
│   ├── utils.test.ts       # Unit tests for formatting, fees, min-order, QR payloads
│   └── components/
│       ├── MapComponent.tsx      # Full-screen Leaflet map with routes + Locate Me
│       ├── MapPicker.tsx         # Small map to pick a location (company edit) + Locate Me
│       ├── EditCompany.tsx       # Company profile edit modal
│       ├── DateTime.tsx          # Global live date/time widget (every screen)
│       ├── ProformaInvoice.tsx   # Professional proforma invoice modal with FX QR
│       ├── PublicProforma.tsx    # Mobile-friendly proforma shown when a QR is scanned
│       ├── AdminSettings.tsx     # Admin-only configuration page (business rules)
│       ├── InstallGuide.tsx      # "Install E-SCON" device-specific instructions modal
│       └── OrderTimeline.tsx     # Shipment progress stepper (Ordered→Confirmed→In Transit→Delivered)
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
3. Sample data is used when nothing is stored, and geocoding of supplier addresses runs once via Nominatim.
4. Every mutation of state arrays is persisted back to `localStorage` via dedicated `useEffect`s.

**Data flow example (search)**

1. User types in the search box on the Search page.
2. A debounced `useEffect` (300 ms) calls `performSearch()`.
3. `performSearch` filters `materials`, then for each match calls the OSRM API for distance and transport cost (parallel `Promise.all`).
4. Results are enriched into `SearchResult[]` (material + company + distance + costs) and rendered in a sortable table.
5. Clicking a product row sets `autoRouteSupplierId` → the map modal opens and **automatically draws the driving route**.

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
  images: string[],          // ← base64 data-URL photos (NEW)
  taxIncluded, vatPercentage, lastUpdated }
```

### Order
```ts
{ id, customerId, companyId, materialId, quantity, unitPrice,
  transportCost, totalAmount, status: 'pending'|'confirmed'|'shipped'|'delivered'|'cancelled',
  orderDate, deliveryDate?, address, notes?, invoiceNumber,
  taxAmount, vatAmount, paymentMethod, paymentStatus }
```

### Other types
`Alert`, `FormData` (all form fields, incl. `materialImages: string[]`), `SearchResult` (Material + computed `distance`, `totalCost`, `estimatedTransport`, `company`), `CartItem`, `CartReport` (now also carries `freeDeliveryApplied`, `minOrderEnabled`, `minOrderAmount`, `belowMinOrder`).

### Platform & sharing types (NEW in v4)

```ts
// DeliveryZone           { id, name, cities: string[], fee }
// DeliverySettings       { mode: 'distance-based'|'fixed', fixedFee,
//                          distanceBaseFee, distancePerKmPerTon,
//                          freeDeliveryThreshold, zones: DeliveryZone[] }
// MinOrderSettings       { enabled, amount }
// SystemSettings         { version, currency: 'ETB',
//                          delivery: DeliverySettings, minOrder: MinOrderSettings }

// Compact NON-SENSITIVE proforma summary embedded in the QR code.
// ProformaShareData      { v, n (proforma no), d (date), b (buyer name),
//                          s: {n,c}[] (suppliers), i: {n,u,q,p}[] (items),
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
- `cart`, `cartDetails`, `showCartSummary` — cart flow.
- `showSupplierMap`, `autoRouteSupplierId` — map modal & route targeting.
- `selectedMaterial`, `editingMaterial` — details modal & product editing.
- `darkMode`, `isFullscreen` — UI preferences.
- `distanceToSelected`, `isDistanceLoading` — distance shown in product details.
- `showProforma`, `showCompare`, `compareItems` — proforma invoice & product comparison.
- `favorites` — per-user favorite materials (persisted to localStorage).
- `mobileMenuOpen` — mobile hamburger menu toggle.
- `deferredPrompt`, `showInstallBanner` — PWA install prompt state.
- `showInstallGuide` — "How to install" modal.
- `systemSettings` — the runtime `SystemSettings` object loaded from localStorage.
- `showSettings` — admin settings page visibility.
- `publicProformaData` — decoded `ProformaShareData` rendered when a QR is scanned.
- `pageAnimating` — controls page transition animation.

Key `useCallback` helpers: `showAlert`, `getCompanyById`, `getMaterialById`, `getCompanyByUserId`, `getUserById`, `navigateTo`, `geocodeCompany`, `geocodeAllCompanies`, `performSearch`, `toggleFavorite`, `toggleCompare`.

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

---

## 10. Key Features & How They Work

### 10.1 Global live Date & Time widget (NEW)
- **File:** `src/components/DateTime.tsx`, rendered once inside the app **header**, therefore visible on **every screen** (home, search, dashboards, map modal, login, etc.).
- Updates **every second** (`setInterval`).
- **Invert colors** toggle (🎨) — flips the widget to a dark chip with inverted text (and light-on-dark mode flips to a light chip).
- **Transparency** toggle (👻) — makes the widget fully transparent ("ghost").
- Both preferences persist to `localStorage`.

### 10.2 Product → Map, distance & route (NEW/improved)
- On the Search page each product row shows a **🚗 Distance badge** computed from the customer's location (or the default Addis Ababa coordinates for guests).
- **Clicking a product row** immediately opens the full-screen Leaflet map and **auto-draws the driving route** to the supplier.
- The map's detail panel shows **route distance (km) and estimated driving time**, plus a "Show/Hide Route" control.
- The **"View Route on Map"** button in the product-details modal does the same.
- Guests get a **default location (Addis Ababa)** with the note *"(default location – login to use yours)"* — see `MapComponent.tsx` (`userLocation` / `hasUserLocation`).

### 10.3 Product pictures (NEW)
- **Upload:** On the *Add Product* and *Edit Product* forms there is a **"📷 Upload Photos"** button (accepts `image/*`, multiple, max 6). Files are read with the `FileReader` API and stored as **base64 data URLs** in `formData.materialImages` → saved to `Material.images`.
- **Preview:** Uploaded photos show as thumbnails with an ✕ remove button before saving.
- **Display:** Thumbnails appear in the search results table, the supplier dashboard table, and a **gallery** inside the product-details modal. Products without photos show a category-based emoji placeholder (🏗️ 🚚 💊 …).

### 10.4 Live search & filters
Debounced search (300 ms) over `name`, `description`, `brand`, `category` + filters for department, city, max price, and sort (price ↑↓, rating, newest). Each result computes OSRM distance and transport cost in parallel.

### 10.5 Cart & checkout
Multi-supplier cart: customers can add products from any number of suppliers into one cart. Checkout computes subtotal + VAT (per-item %) + delivery fee per supplier (OSRM-based) and produces a `CartReport` that groups items by supplier with per-supplier distance/delivery costs; a single **collective proforma** covers all items. Confirming creates one `Order` per item, resets the cart, and shows the Orders page.

### 10.6 Company dashboard
Suppliers see their products (with photos) and can **view / edit / delete** them, manage orders (confirm pending ones), and edit their company profile — including picking an exact map location via `MapPicker` (click/drag marker + reverse geocoding).

### 10.7 Proforma Invoice (NEW)
- **File:** `src/components/ProformaInvoice.tsx`.
- Full proforma invoice with **live-updating clock**, unique invoice number (PI-YYYYMM-XXXXXX), 30-day validity.
- Includes: supplier/buyer details (TIN, VAT, address), item table (brand, origin, specs), financial summary (subtotal, VAT 15%, delivery, grand total), amount in words, terms & conditions (6 clauses), and signature lines.
- Accessible from the cart summary modal via "📄 Proforma Invoice" button.
- **Print-ready**: `@media print` styles hide action buttons and format for A4.

### 10.8 Product Comparison (NEW)
- Compare up to **4 products** side-by-side in a modal.
- Toggle comparison via ⚖️ button on search results; a floating compare bar appears at the bottom.
- Shows: category, price, unit, min order, stock, rating, brand, weight, origin.

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
- Search filters use compact sizing: shorter labels (`Dept`, `City`, `Price ↑`), reduced padding and font-size.
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

### 10.16 System Settings (admin) (NEW in v4)
- **File:** `src/settings.ts` (module) + `src/components/AdminSettings.tsx` (page).
- A validated `SystemSettings` object is persisted to `localStorage` under `system_settings`; `loadSettings()` repairs corrupted data and clamps invalid numbers to defaults.
- **Delivery fee** supports three cooperating rules:
  1. **Fixed mode** — a flat per-order fee.
  2. **Distance-based** — `base fee + perKmPerTon × distance` (OSRM).
  3. **Delivery zones** — a flat fee override keyed by the customer's city (e.g. Addis Ababa `400`, Adama `700`).
  Plus a **free-delivery threshold**: when the goods subtotal reaches it, delivery is `0`.
- **Minimum order** — a goods-subtotal threshold. When enforced, the cart shows a visible warning and the **Confirm Order** button is disabled until the cart qualifies; `confirmOrder` double-checks the rule as a final guard.
- **Who can use it:** only `userType === 'admin'` sees the ⚙️ Settings page (seeded account `admin@escon.et`). The seeder runs during initialization and re-creates the admin if removed from localStorage.

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

Everything is styled in **`src/App.css`** (~2,000 lines, organized in comment sections).

### CSS variables
`:root` defines a **light** palette; `[data-theme="dark"]` (set on `<html>` by `App.tsx`) overrides it. A `.dark-mode` class on the app container also applies targeted overrides.

Key tokens: `--bg`, `--card-bg`, `--text`, `--text-light`, `--border`, `--shadow`, `--glass-bg`, `--glass-border`, `--primary` (#0f2b3d), `--primary-light`, `--secondary` (orange #e67e22), `--accent` (green), `--danger`, `--warning`, `--info`, `--radius`, `--transition`, `--font`.

### Design language
- **Glassmorphism** utility `.glass` (blur + translucency + border).
- **Gradient hero** panels and **gradient table headers**.
- Rounded corners (10–16 px), pill buttons, soft shadows, smooth transitions.
- Zebra-striped tables with sticky gradient headers and orange hover.
- **Beautiful `<select>` list boxes**: custom chevron via inline SVG `background-image`, `appearance: none`, hover/focus rings, readable `option` colors in both themes.

### Sections (for navigation)
Header → Navigation → Buttons → Cards → Search → Product Grid → Tables → Product Row → Modal → Map Picker → Edit Company → Alert → Stats → Features → Footer → Home Hero → User Info → Cart → Dashboard → Distance Loader → Map Styles → PWA → Swipe → Icon Buttons → Dark Mode → Responsive → **UI v2 polish (appended section)**.

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
  - **Top bar**: brand, page title, theme toggle, cart button (customers, with badge), avatar.
  - **Bottom tab bar** (`mobile-tabbar`, fixed, safe-area aware): Home / Search (customers) or Board (companies & admin) / center **FAB** (Cart for customers with badge, Add Product for companies, Login for guests) / Orders (with active-order badge) / More (profile sheet). Guests get Home / Search / FAB-Login / Map / Install.
  - **More sheet** (`m-sheet-overlay` + `m-sheet`): slide-up bottom sheet with profile header + Logout, dashboard, supplier map, compare, install app, theme toggle, CSV export and admin settings shortcuts, plus a horizontally scrollable "Saved products" strip.
  - **Mobile home** (`renderHomeMobile`): gradient greeting hero card with live stat tiles (active orders, delivered, revenue/spent), 2×2 quick-action grid, "Saved for later" strip, horizontally scroll-snapping **Trending products carousel** (star-rating sorted) using the reusable `MobileProductCard`, and recent-order rows with status pills.
  - **Search results** on mobile render a card grid (`MobileProductCard` in `list` variant with qty stepper + Add / In-Cart buttons) instead of the wide table; distance, supplier, stock and price chips are shown per card.
  - **Orders** on mobile render stacked order cards with the `OrderTimeline` shipment stepper, customer/supplier line, itemised totals and Confirm/Reorder/Export actions.
  - **Dashboards** on mobile render 2×2 stat tiles plus compact product/order lists (`renderMobileDashboard(true|false)`).
  - **Modals become bottom sheets** on mobile (`.modal-overlay` aligns to bottom, `.modal-content` gets top-rounded corners) and forms use 16px inputs to prevent iOS auto-zoom. The floating compare bar and PWA banner are lifted above the tab bar.

---

## 14. Routes / Pages

No router library — `currentPage` switch in `App.tsx`:

| currentPage          | Renderer                    | Notes                          |
| -------------------- | --------------------------- | ------------------------------ |
| `splash`             | `renderSplash`              | 3 s intro                       |
| `home`               | `renderHome`                | Hero + stats + features        |
| `login` / `register` | `renderLogin`/`renderRegister` | Auth cards                |
| `search-materials`   | `renderSearchMaterials`     | Live search + results table    |
| `company-dashboard`  | `renderCompanyDashboard`    | Supplier view                  |
| `customer-dashboard` | `renderCustomerDashboard`   | Customer view                  |
| `add-material`       | `renderAddMaterial`         | Product form (+ photos)        |
| `edit-material`      | `renderEditMaterial`        | Product edit (+ photos)        |
| `orders`             | `renderOrders`              | Order management               |
| `settings`           | `AdminSettings` (admin only) | Delivery fee, zones, min order |
| (mobile shell)       | `renderMobileTopBar`, `renderMobileBottomNav`, `renderMobileMoreSheet` | Rendered only when `isMobile`; desktop header/footer replaced |
| (mobile home)        | `renderHomeMobile`      | Welcome hero, quick actions, trending carousel, saved strip, recent orders |
| (mobile orders)      | `renderOrdersMobile`    | Order cards + `OrderTimeline` stepper when `isMobile` |
| (mobile dashboards)  | `renderMobileDashboard` | Stat tiles + compact lists for company/customer when `isMobile` |
| (map)                | `renderSupplierMap`         | Modal flag `showSupplierMap`   |
| (modals)             | `renderMaterialDetails`, `renderCartSummary`, EditCompany, `ProformaInvoice`, `compare-modal` | Overlays |
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
- `public/sw.js` is a **custom service worker** registered in `src/index.tsx` only when `process.env.NODE_ENV === 'production'`. It pre-caches the app shell and enables offline navigation. There is **no auto-updating CRA Workbox** build — version bumps in `VERSION` at the top of `sw.js` force refresh.

> **Installing is always optional.** The app works identically in a normal browser tab; the Install Guide modal explains each device's steps.

---

## 16. Troubleshooting

| Symptom                              | Cause / Fix                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Leaflet default marker icons broken  | The icon-fix snippet in `MapComponent.tsx`/`MapPicker.tsx` must load before any marker creation |
| Distance shows "Unable to calculate" | OSRM demo server offline → haversine fallback already handles this; retry later |
| Geocoding fails at startup           | Nominatim rate limit — the app keeps the last-known coordinates and continues |
| localStorage quota exceeded         | Too many base64 product photos → reduce image count/size (cap is 6/product)   |
| `npm start` fails on Windows         | Ensure Node ≥ 14; delete `node_modules` and re-run `npm install`              |
| Build fails on TypeScript errors     | Run `npx tsc --noEmit` and fix reported errors                                 |
| Build fails with `no-unused-vars`    | Remove unused variables; CI treats ESLint warnings as errors                   |
| PWA install banner doesn't appear    | Must be served over HTTPS; browser must support `beforeinstallprompt` event    |
| Animations feel choppy               | Check `prefers-reduced-motion: reduce` — animations should be disabled for a11y |
| Frozen column overlaps other cells   | Ensure `.td-sticky` has proper `z-index` and `background` to cover scrolling content |

---

## 17. Extending the Project

Common extension points:

- **New pages:** add a case to the `currentPage` switch + a render function in `App.tsx`.
- **New data collection:** mirror the pattern of `materials` (state + persistence `useEffect` + type in `types.ts`).
- **New map behavior:** edit `MapComponent.tsx` (markers, route styling, panels).
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
| `src/utils.test.ts`    | `formatCurrency` (ETB, never ETH), `checkMinOrder`, `computeDeliveryFee` (fixed / zone / free-threshold / distance mode with mocked OSRM), QR payload encode→decode round-trip, tampered token rejection, scannable URL format |

20 unit tests, all passing. `setupTests.ts` intentionally does **not** import `@testing-library/jest-dom` (not installed in this project).

---

## 19. Instructions for the Next Programmer

Read this before touching any code. It prevents the most common mistakes.

### 19.1 Golden rules
1. **Never change "ETH" strings in `constants.ts`.** `ETH` in names like *ETH Steel*, *ETH Rebar* is a **brand name**, not currency. The currency is **ETB** everywhere. If you do a global find-replace of "ETH", you will corrupt product data.
2. **Never commit `.env.local`.** It holds a live Vercel OIDC token and is already gitignored. Do not read it into code, logs or console output.
3. **Money always goes through `formatCurrency`** (in `utils.ts`). Do not hand-roll `Intl.NumberFormat` or template strings with different separators.
4. **Never delete the admin seeder.** In `App.tsx` initialization, `ADMIN_USER` is re-appended if missing. Removing it logs out platform management silently.
5. **Append new CSS at the end of `App.css`** in clearly-commented sections; never rewrite existing rules in place.
6. **Desktop layout is frozen.** The mobile shell must be added *next to* it, never instead of it: JSX branches on `isMobile` (`useIsMobile`), and every mobile rule lives inside `@media (max-width: 768px)` at the end of `App.css`. Keep the JS breakpoint and the CSS breakpoint identical (`768px`).
7. **Tests are pure-logic only.** Do not write tests that import `App.tsx`, `MapComponent.tsx` or Leaflet — they need DOM APIs jsdom can't provide. Run `CI=true npm test -- --watchAll=false`.
8. **Mobile reuse** — build mobile UI from existing helpers (`renderProductImage`, `formatCurrency`, `handleCheckout`, `handleQuickReorder`, …); `MobileProductCard` is the single reusable product card for the carousel and search grid. New mobile-only files go under `src/hooks/` / `src/components/` and use CSS variables so dark mode keeps working.

### 19.2 Where things live
- **Business rules** (delivery fee, zones, min order) → `src/settings.ts` + `src/components/AdminSettings.tsx`. They persist under `system_settings` in localStorage. `calculateTransportCost` in `utils.ts` is the **legacy hard-coded** helper; new code must use `computeDeliveryFee` (settings-driven). Search estimates, cart totals and order creation all use `computeDeliveryFee` now.
- **Currency** → `formatCurrency` in `utils.ts` (used by App, ProformaInvoice, AdminSettings, PublicProforma).
- **QR / sharing** → `encodeProformaPayload`, `decodeProformaPayload`, `buildProformaQrUrl`, `generateProformaQrDataUrl` in `utils.ts`; rendering in `ProformaInvoice.tsx` and `PublicProforma.tsx`. The hash format is `#escon=<base64url(ESCON1+json)>`.
- **PWA** → `public/sw.js` (custom, version `VERSION` const), `src/index.tsx` registration (production only), `src/components/InstallGuide.tsx`, banner logic in `App.tsx`.
- **Admin page routing** → a `case 'settings'` in the `renderCurrentPage` switch guards `userType === 'admin'`.

### 19.3 Common change scenarios
- **"Change the delivery fee":** open the app with `admin@escon.et` → ⚙️ Settings → edit → Save. No code required. To change the default that new installations get, edit `DEFAULT_SETTINGS` in `settings.ts`.
- **"Add a new Ethiopian city to a zone":** Settings → zone → the "+" button adds a city selector. The city list is `ETHIOPIAN_CITIES` in `constants.ts`.
- **"Point the map at a different tile server":** edit the tile-layer URLs in `MapComponent.tsx` and `MapPicker.tsx`. If you add a cross-origin tile host, update `sw.js` caching rules too.
- **"Add a page":** add a `case` in `renderCurrentPage`, a nav button in `renderUserNav`/`renderGuestNav`, and optionally a hash shortcut in `manifest.json` (`shortcuts`).
- **"Push a PWA update":** bump `VERSION` in `public/sw.js` so old caches are purged in `activate`.

### 19.4 Known limitations (do not "fix" without discussion)
- Passwords stored in plaintext — demo only.
- No backend; all data in localStorage (~5 MB limit; base64 product photos are the main consumer).
- OSRM + Nominatim are free public servers — rate limits and occasional outages are expected; fallbacks already exist.

---

*Generated by the E-SCON development workflow — September 2026.*
