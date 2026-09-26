# E-SCON — Ethio-Supply Chain Optimization Network

## 📘 Technical Documentation

> **Version:** 5.1 (Supplier filter + single-supplier proforma)
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

- Product catalogue with **live search & filtering** (department, **supplier**, city, max price, sorting).
- **GIS supplier mapping** built on Leaflet, with **driving routes**, **distance**, and **transport cost** calculations.
- **Company dashboards** for suppliers to manage products & orders, and **customer dashboards** for order history.
- **Cart & checkout** flow with VAT (15%) and delivery-fee computation.
- **Proforma invoices** — one supplier per invoice, scannable QR, print-ready.
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
│   ├── utils.ts            # Helpers: distance, fees, min-order, single-supplier report, QR payloads, CSV, formatting
│   ├── hooks/
│   │   └── useIsMobile.ts  # matchMedia("(max-width: 768px)") — drives the mobile shell
│   ├── settings.test.ts    # Unit tests for SystemSettings persistence
│   ├── utils.test.ts       # Unit tests for formatting, fees, min-order, QR payloads, single-supplier report
│   └── components/
│       ├── MapComponent.tsx      # Full-screen Leaflet map with routes + Locate Me
│       ├── MapPicker.tsx         # Small map to pick a location (company edit) + Locate Me
│       ├── EditCompany.tsx       # Company profile edit modal
│       ├── DateTime.tsx          # Global live date/time widget (every screen)
│       ├── ProformaInvoice.tsx   # Professional single-supplier proforma invoice modal with FX QR
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

1. User types in the search box on the Search page, or picks a filter pill (department, **supplier**, city, max price, sort).
2. A debounced `useEffect` (300 ms) calls `performSearch()`.
3. `performSearch` filters `materials`, then for each match calls the OSRM API for distance and transport cost (parallel `Promise.all`).
4. Results are enriched into `SearchResult[]` (material + company + distance + costs) and rendered in a sortable table.
5. Clicking a product row sets `autoRouteSupplierId` and bumps `routeRequestId` → the map modal opens and **automatically draws the driving route** from the customer's current position.

**Data flow example (proforma)**

1. Cart → "👁️ Preview Proforma" → `groupCartBySupplier()` groups the cart lines per supplier.
2. One supplier → straight to step 4. Several suppliers → the supplier picker modal asks which one to invoice.
3. `calculateCartTotals()` builds the whole-cart `CartReport` (subtotal, VAT, per-supplier delivery fee).
4. `buildSingleSupplierReport(report, supplierId, settings)` narrows that report to the chosen supplier, and it is stored in `proformaDetails` (the cart report in `cartDetails` is left untouched).
5. `ProformaInvoice` renders from `proformaDetails` and generates the QR (`generateProformaQrDataUrl`), which encodes the same single-supplier summary for `PublicProforma`.

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
- `proformaDetails`, `showProformaSupplierPicker` — the report the proforma renders from (always one supplier) and the "choose supplier" modal.
- `showSupplierMap`, `autoRouteSupplierId`, `routeRequestId` — map modal, the supplier the map should route to (sticky), and a nonce bumped on every explicit route request so the same supplier can be re-routed.
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

Plain (non-memo) helpers worth knowing: `calculateCartTotals` (whole-cart `CartReport`), `groupCartBySupplier` (cart lines grouped per supplier), `openProformaFor` (builds the single-supplier proforma), `handleDeliveryFeeChange` / `handleDeliveryFeeReset` (manual delivery fee, split pro-rata across the cart's suppliers), `handlePreviewProforma`, `renderCartSummary`, `renderProformaSupplierPicker`, `renderSearchMaterials`. Module-scope component: `CartQuantityInput` (the editable per-line quantity field, §10.5).

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
Multi-supplier cart: customers can add products from any number of suppliers into one cart. Checkout computes subtotal + VAT (per-item %) + delivery fee per supplier (OSRM-based) and produces a `CartReport` that groups items by supplier with per-supplier distance/delivery costs. Confirming creates one `Order` per item, resets the cart, and shows the Orders page. A proforma invoice is always issued per supplier — see [10.21](#1021-single-supplier-proforma-invoice-new-in-v51).

**Order entry:** a customer never picks a quantity in a list. The 🛒 button on a results row, the **Order** button on a mobile product card and **View & Order** in the compare modal all open the **product details**, where the only `+ / −` control lives (`DetailsOrderBox` + `QuantityStepper`, steps of 1 with a live total). The cart modal still allows per-line quantity edits. Full rules in [13.1](#131-ordering-flow--supplier-only-stock).

**No per-product minimum (v5.4):** customers may order **any quantity of 1 or more**. A product's `minOrder` field is kept as **supplier reference data** (product form, cart snapshot, proforma notes, comparison view) but is no longer enforced in the ordering path — `addToCart`, `updateCartQuantity`, the cart quantity inputs and the product-details stepper all work in units of 1, and the customer-facing description panel no longer shows a "Min Order" line. The separate **admin-configured minimum-order value** in ETB (goods-subtotal threshold, see [10.5](#105-cart--checkout)) is a different rule and is untouched.

**Cart quantity is freely editable (v5.4):** each cart line renders `CartQuantityInput` (module scope in `App.tsx`, just above `function App()`) — a number field with `−` / `+` keys. It keeps a **local draft string** and only calls `updateCartQuantity` with a valid whole number (on blur, on Enter or via the keys). The old inline `onChange={e => updateCartQuantity(item.id, parseInt(e.target.value))}` re-rendered the field on every keystroke, so clearing the box produced `NaN`, bounced an alert and made the cart look read-only. Keep the component at module scope — defined inside `App()` it becomes a new component type on every render, which remounts the input and drops the draft mid-typing. The `Qty:` label was dropped so the unit sits next to the field, and the native spinners are hidden in favour of the `−` / `+` buttons (`.cart-qty-btn`, 38px on touch).

**Stock visibility:** stock numbers, "In stock"/"Out" chips and low-stock banners are shown **only to suppliers and admins** (`canSeeStock`). Customers and guests see price and unit only.

### 10.6 Company dashboard
Suppliers see their products (with photos) and can **view / edit / delete** them, manage orders (confirm pending ones), and edit their company profile — including picking an exact map location via `MapPicker` (click/drag marker + reverse geocoding).

**Own-stock detail (v5.4):** a supplier always sees everything about *their own* stock (this is the one surface where a stock number is not behind `canSeeStock`, because a supplier is reading their own inventory):
- A **"📥 My stock"** card with four tiles: units in stock, stock value (`Σ quantity × price`), low-stock lines (`0 < quantity ≤ LOW_STOCK_THRESHOLD`) and out-of-stock lines. The tiles turn amber/red when the count is above zero.
- The products table gains **In Stock** (`N unit`), **Stock Status** (`.stock-chip-in` / `.stock-chip-low` / `.stock-chip-out`) and **Stock Value** columns; the header/footer hint states that stock is private to the supplier.
- The mobile supplier dashboard gets the same four tiles (`.m-stock-grid`) plus a status chip on every product row.
- Nothing here is customer-visible: these components only render for `currentUser.userType === 'company'`, and the product-details/compare/search stock surfaces remain `canSeeStock`-gated (§13.1).

### 10.7 Proforma Invoice (NEW)
- **File:** `src/components/ProformaInvoice.tsx`.
- Full proforma invoice with **live-updating clock**, unique invoice number (PI-YYYYMM-XXXXXX), 30-day validity.
- Includes: supplier/buyer details (TIN, VAT, address), item table (brand, origin, specs), financial summary (subtotal, VAT 15%, delivery, grand total), amount in words, terms & conditions (6 clauses), and signature lines.
- **Layout (v5.4):** supplier and buyer blocks stay **side by side** everywhere — desktop, phones (`≤760px` shrinks the label column to 68px and the box chrome) and print (the `1fr 1fr` grid is re-asserted because a print viewport can also be ≤760px). Terms and signature blocks still stack on phones, they need the full width.
- **Amount in words (v5.4):** `.pf-summary-wrap` is a right-aligned column, so `.pf-words` renders **directly under** the numeric `.pf-summary` (46% width on screen, 52% in print, 100% on phones) instead of sitting beside it.
- Accessible from the cart summary modal via the "👁️ Preview Proforma" button, which asks which supplier to invoice when the cart holds several — see [10.21](#1021-single-supplier-proforma-invoice-new-in-v51).
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

### 10.21 Single-supplier proforma invoice (NEW in v5.1)
A proforma invoice is a legal document issued by **one** seller, so the proforma is now always generated from a **single supplier**, even when the cart contains items from several.

- **Rule:** `handlePreviewProforma` groups the cart with `groupCartBySupplier()` (`App.tsx`). One supplier → the proforma opens straight away (unchanged behaviour). Several suppliers → the **"🏢 Choose Proforma Supplier"** modal opens.
- **Picker UI** (`renderProformaSupplierPicker`): reuses the existing cart modal classes (`modal-overlay`, `modal-content cart-modal`, `modal-header`, `modal-body`, `cart-supplier-group`, `cart-item`, `btn-primary`) — **no new CSS**. Each supplier block shows city, unit count, goods value and its line items, with a "📄 Generate Proforma" button.
- **Scoping helper:** `buildSingleSupplierReport(report, supplierId, settings)` in `src/utils.ts` derives the single-supplier `CartReport` from the cart report that `calculateCartTotals()` already produced. It keeps the supplier's line items, recomputes that supplier's subtotal/VAT, and takes the supplier's own delivery fee — which already includes its pro-rata share of any manually edited fee (the cart scales the per-supplier transport so the parts still add up to the grand total). Unit-tested in `src/utils.test.ts`.
  - Because the numbers come from the cart report, the proforma always matches the per-supplier figures the buyer saw in the cart.
- **Separate report state:** the proforma renders from `proformaDetails`, not `cartDetails`, so opening a single-supplier proforma never mutates the cart summary behind it. `confirmOrder` and checkout keep using the whole-cart report, so ordering behaviour is untouched.
- **Document (`ProformaInvoice.tsx`):** renders one supplier block (`suppliers[0] || supplier`), the item table, quantity counts and minimum-order notes all read from `report.items` (falling back to the `cart` prop), the signature line names that supplier, the QR payload carries a single supplier entry, and a **Supplier** row was added to the header meta block so the seller is identified at the top of the printed page.
- `PublicProforma` (the QR scan view) needs no change — it renders whatever supplier list the payload carries, which is now always one.

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

### Design language
- **Glassmorphism** utility `.glass` (blur + translucency + border).
- **Gradient hero** panels and **gradient table headers**.
- Rounded corners (10–16 px), pill buttons, soft shadows, smooth transitions.
- Zebra-striped tables with sticky gradient headers and orange hover.
- **Beautiful `<select>` list boxes**: custom chevron via inline SVG `background-image`, `appearance: none`, hover/focus rings, readable `option` colors in both themes.
- **Order box** (`.order-box`, `.qty-stepper`): the product-details quantity control, styled once for all breakpoints (44px touch targets on ≤ 768px).
- **Stock flags** (`.stock-flag` / `.stock-flag-low`): amber pill used for the supplier-only low-stock warning inside the product details view.
- **Stock chips** (`.stock-chip-in` / `.stock-chip-low` / `.stock-chip-out`): green / amber / red pills used on the supplier dashboard so a supplier reads their own stock status at a glance (never shown to customers).

### Sections (for navigation)
Header → Navigation → Buttons → Cards → Search → Product Grid → Tables → Product Row → Modal → Map Picker → Edit Company → Alert → Stats → Features → Footer → Home Hero → User Info → Cart → Dashboard → Distance Loader → Map Styles → PWA → Swipe → Icon Buttons → Dark Mode → Responsive → **UI v2 polish (appended section)** → Mobile shell (≤ 768px) → Order box / quantity stepper → Stock flags → **Proforma invoice & print** → **Product card "View details" affordance** → **Form controls / checkbox rows** → **Auth pages (centered sign-in)** → **Cart quantity editor** → **Supplier stock tiles & chips**.

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
  - **Search results** on mobile render a card grid (`MobileProductCard` in `list` variant with an **Order** button that opens the product details, or an **In Cart — Open** button once the product is in the cart) instead of the wide table; distance, supplier and price chips are shown per card. Stock chips are supplier-only (see §13.1).
  - **Tap-to-explore affordance (v5.4)**: the product photo inside `MobileProductCard` opens the description, so it must look tappable — `.m-pc-img` scales to 0.97 on press and carries a `.m-pc-view-hint` pill (👁️ View details) that fades in (`mViewHintIn`) while the eye pulses (`mViewPulse`, 1.9 s). The pill is `pointer-events: none` so taps always reach the button, it is `aria-hidden` next to a descriptive `aria-label` on the button, and both animations plus the press transition are disabled under `@media (prefers-reduced-motion: reduce)`. Shared by the trending carousel and the mobile search grid.
  - **Orders** on mobile render stacked order cards with the `OrderTimeline` shipment stepper, customer/supplier line, itemised totals and Confirm/Reorder/Export actions.
  - **Dashboards** on mobile render 2×2 stat tiles plus compact product/order lists (`renderMobileDashboard(true|false)`).
  - **Modals become bottom sheets** on mobile (`.modal-overlay` aligns to bottom, `.modal-content` gets top-rounded corners) and forms use 16px inputs to prevent iOS auto-zoom. The floating compare bar and PWA banner are lifted above the tab bar.
- **Forms (v5.4)**: `.form-input` / `.form-select` / `.form-textarea` / `.btn-submit` are re-stated inside the `768px` block (16px font, 46px min-height) because their base rules now live at the end of the file and would otherwise win. The sign-in card drops its vertical centering on phones, and the cart quantity field grows its `−` / `+` keys to 38px.
- **Supplier stock (v5.4)**: the mobile supplier dashboard shows the same four stock tiles as the desktop one (`.m-stock-grid`, 2×2) plus a per-row status chip.

### 13.1 Ordering flow & supplier-only stock

Two rules govern what a customer sees about quantities and stock.

**1. The `+ / −` quantity control appears only in the product details view.**
It is the step where the customer has actually seen the product and is ready to order, so a list never shows a quantity picker:

| Surface | Customer action |
| --- | --- |
| Desktop results row (`🛒`) | opens the product details (`setSelectedMaterial`) |
| Mobile product card (`🛒 Order`) | opens the product details |
| Compare modal (`View & Order`) | closes the modal and opens the product details |
| Product details (`DetailsOrderBox`) | `QuantityStepper` + running total + **Add to Cart / Update Cart** |
| Cart modal | per-line number input (`updateCartQuantity`) |

- `QuantityStepper` and `DetailsOrderBox` are defined in `App.tsx` next to `renderMaterialDetails`. It steps by **1** and stops at **1** — customers may order any amount, so the stepper must not derive its step or floor from `minOrder` (`min` is hard-coded to `1`).
- `DetailsOrderBox` owns its quantity state, so it resets to `1` every time the modal is opened (no `document.getElementById` juggling any more). Its hint reads "Any quantity — order exactly what you need."
- `addToCart` and `updateCartQuantity` only guard against non-finite values and quantities below 1. The cart line input uses `min={1} step={1}`. **Do not** re-add a `minOrder` check to either function; the per-product minimum is reference data only (see [10.5](#105-cart--checkout)).
- A sold-out product shows **"Currently unavailable — please contact the supplier."** instead of the stepper, so nothing un-orderable can be added to the cart.
- The old native `prompt("Quantity (Min: …)")` on the desktop results row and the card-level `m-stepper` are **removed** — keep it that way; never reintroduce a quantity control in a list.

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
| `src/utils.test.ts`    | `formatCurrency` (ETB, never ETH), `checkMinOrder`, `computeDeliveryFee` (fixed / zone / free-threshold / distance mode with mocked OSRM), QR payload encode→decode round-trip, tampered token rejection, scannable URL format, `buildSingleSupplierReport` (single-supplier totals, unknown supplier, minimum-order flag) |

23 unit tests, all passing. `setupTests.ts` intentionally does **not** import `@testing-library/jest-dom` (not installed in this project).

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
10. **Quantities are chosen in one place only** — the product details order box (§13.1). A list, card or carousel may only *navigate* to it; do not add a stepper, quantity input or `prompt()` to a results row, product card or table.
11. **Stock is supplier-only.** Any new UI that prints `material.quantity` must be wrapped in `canSeeStock` (company + admin) — the only exception is a supplier reading **their own** inventory on the company dashboard, which already renders inside the `userType === 'company'` guard (§10.6). Customers and guests must never see a stock number, an "In stock"/"Out" chip or a low-stock banner.
12. **Never enforce a per-product minimum.** `Material.minOrder` is supplier reference data; the customer path works in units of 1 (§13.1). The only minimum a customer can hit is the admin-configured goods-subtotal rule in `settings.ts`.
13. **A route request is a nonce, not a flag.** When the map should show a route, bump `routeRequestId` *and* set `autoRouteSupplierId`; never clear the destination to "reset" it (§10.2). Drawing waits for `isMapReady` and always goes through `drawRouteForSupplier`, which starts from the real GPS position once it is known.
14. **Never write a checkbox into `.form-group` without `checkbox-label`.** `.form-group label` is `display: block` and `.form-group input` is `width: 100%`, so a bare `<input type="checkbox">` becomes a full-width bar with its text on the next line. Use `<label className="checkbox-label">` (§12).

### 19.2 Where things live
- **Business rules** (delivery fee, zones, min order) → `src/settings.ts` + `src/components/AdminSettings.tsx`. They persist under `system_settings` in localStorage. `calculateTransportCost` in `utils.ts` is the **legacy hard-coded** helper; new code must use `computeDeliveryFee` (settings-driven). Search estimates, cart totals and order creation all use `computeDeliveryFee` now.
- **Currency** → `formatCurrency` in `utils.ts` (used by App, ProformaInvoice, AdminSettings, PublicProforma).
- **Search filters** → `FormData.search*` fields + `performSearch` in `App.tsx`; the filter row is `renderSearchMaterials` and reuses `.search-filters` / `.filter-select` / `.filter-input` / `.filter-clear`. A new filter needs: the field in `FormData` (`types.ts`), the `formData` initialiser, the check in `performSearch`, the control in the filter row, the debounce dependency list, and the reset in `clearFilters`.
- **Proforma scope** → a proforma is always one supplier: `groupCartBySupplier` + `renderProformaSupplierPicker` (App) and `buildSingleSupplierReport` (`utils.ts`) build it from the cart report in `proformaDetails`. Do not render the proforma from `cartDetails`, and do not add multi-supplier blocks back to `ProformaInvoice.tsx`.
- **QR / sharing** → `encodeProformaPayload`, `decodeProformaPayload`, `buildProformaQrUrl`, `generateProformaQrDataUrl` in `utils.ts`; rendering in `ProformaInvoice.tsx` and `PublicProforma.tsx`. The hash format is `#escon=<base64url(ESCON1+json)>`.
- **PWA** → `public/sw.js` (custom, version `VERSION` const), `src/index.tsx` registration (production only), `src/components/InstallGuide.tsx`, banner logic in `App.tsx`.
- **Admin page routing** → a `case 'settings'` in the `renderCurrentPage` switch guards `userType === 'admin'`.
- **Role visibility** → `canSeeStock` in the "Role visibility" block of `App.tsx` (top of the component, right after the state) is the single source of truth for supplier-only data; the customer-only blocks use `currentUser?.userType === 'customer'`.

### 19.3 Common change scenarios
- **"Change the delivery fee":** open the app with `admin@escon.et` → ⚙️ Settings → edit → Save. No code required. To change the default that new installations get, edit `DEFAULT_SETTINGS` in `settings.ts`.
- **"Add a new Ethiopian city to a zone":** Settings → zone → the "+" button adds a city selector. The city list is `ETHIOPIAN_CITIES` in `constants.ts`.
- **"Point the map at a different tile server":** edit the tile-layer URLs in `MapComponent.tsx` and `MapPicker.tsx`. If you add a cross-origin tile host, update `sw.js` caching rules too.
- **"Add a page":** add a `case` in `renderCurrentPage`, a nav button in `renderUserNav`/`renderGuestNav`, and optionally a hash shortcut in `manifest.json` (`shortcuts`).
- **"Add a search filter":** see the *Search filters* bullet in 19.2 — six touch points, and reuse the existing filter classes so the frame does not change.
- **"Invoice a second supplier from the same cart":** close the proforma, reopen the cart (🛒) and press "👁️ Preview Proforma" again — the supplier picker lists every supplier in the cart. Each invoice is independent.
- **"Push a PWA update":** bump `VERSION` in `public/sw.js` so old caches are purged in `activate`.
- **"A customer asks how much stock is left":** they cannot see it anywhere in the UI by design (§13.1). Suppliers see it on the company dashboard, the mobile dashboard and the product details page; add a `canSeeStock` block if you need a new stock surface.
- **"A customer asks about the minimum order for one product":** there is none — any quantity of 1 or more is allowed. The per-product `minOrder` is reference data for the supplier and appears in the comparison view and the supplier-side forms. The admin-configured cart minimum in ⚙️ Settings is the only threshold a customer can hit.
- **"The map opens without a route":** check `isMapReady`, the `routeRequestId` nonce and the sticky `autoRouteSupplierId` (§10.2), then confirm the destination is in the `companies` list passed to the map.
- **"Add a quantity control somewhere new":** don't. Open the product details (`setSelectedMaterial`) and let `DetailsOrderBox` handle it.

### 19.4 Known limitations (do not "fix" without discussion)
- Passwords stored in plaintext — demo only.
- No backend; all data in localStorage (~5 MB limit; base64 product photos are the main consumer).
- OSRM + Nominatim are free public servers — rate limits and occasional outages are expected; fallbacks already exist.

---

*Generated by the E-SCON development workflow — September 2026.*
