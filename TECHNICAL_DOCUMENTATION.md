# E-SCON — Ethio-Supply Chain Optimization Network

## 📘 Technical Documentation

> **Version:** 3.0 (Animation & PWA Pass)
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
| Supplier | `zhiruyanduamlak062@gmail.com`       | `0909`   |
| Customer | `abisha101999@gmail.com` (any user)  | `0909`   |

New registrations default to password `0909` when left blank.

---

## 5. Project Structure

```
supply-chain1/
├── public/
│   ├── index.html          # HTML entry, fonts, Leaflet CDN CSS, viewport meta
│   ├── manifest.json       # PWA manifest
│   └── robots.txt
├── src/
│   ├── index.tsx           # React root — renders <App/>
│   ├── index.css           # Minimal global styles
│   ├── App.tsx             # Main application (state, routing, ALL pages)
│   ├── App.css             # All styles (theming, layout, components, responsive, animations)
│   ├── types.ts            # TypeScript interfaces (User, Company, Material, …)
│   ├── constants.ts        # Sample data + city/unit/department lists
│   ├── utils.ts            # Helpers: distance, costs, CSV, geocoding, formatting
│   └── components/
│       ├── MapComponent.tsx      # Full-screen Leaflet map with routes
│       ├── MapPicker.tsx         # Small map to pick a location (company edit)
│       ├── EditCompany.tsx       # Company profile edit modal
│       ├── DateTime.tsx          # Global live date/time widget (every screen)
│       └── ProformaInvoice.tsx   # Proforma invoice modal with full financial details
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
│     ├─ Header + DateTime    │
│     ├─ Active page render   │
│     ├─ Modals (product,     │
│     │  cart, edit company)  │
│     └─ Footer               │
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
  userType: 'customer' | 'company', companyName?,
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
`Alert`, `FormData` (all form fields, incl. `materialImages: string[]`), `SearchResult` (Material + computed `distance`, `totalCost`, `estimatedTransport`, `company`), `CartItem`, `CartReport`.

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
Single-supplier carts enforced (adding a different supplier prompts to clear). Checkout computes subtotal + VAT 15% + delivery fee (OSRM-based) and produces a `CartReport`; confirming creates one `Order` per item, resets the cart, and shows the Orders page.

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
| (map)                | `renderSupplierMap`         | Modal flag `showSupplierMap`   |
| (modals)             | `renderMaterialDetails`, `renderCartSummary`, EditCompany, `ProformaInvoice`, `compare-modal` | Overlays |
| (compare bar)        | Floating compare bar at bottom | Shows when `compareItems.length > 0` |
| (PWA banner)         | `pwa-install-banner` | Shows when browser supports install prompt |

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
- The browser must detect the service worker and manifest — CRA includes a service worker by default if `serviceWorker` is registered.

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

*Generated by the E-SCON development workflow — September 2026.*
