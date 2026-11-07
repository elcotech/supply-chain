# E-SCON — Ethio-Supply Chain Optimization Network

A single-page React + TypeScript platform connecting Ethiopian suppliers and customers: live product search, GIS supplier mapping with driving routes, distance & transport-cost calculation, VAT-exclusive product pricing with one configurable VAT calculated on the whole cart at checkout, editable demo data, an admin data manager, supplier & customer dashboards, product photos, CSV exports for suppliers and admins, and a global live date/time widget with invert-color & transparency toggles.

## 📚 Documentation

| Document | Audience | Contents |
| --- | --- | --- |
| [**TECHNICAL_DOCUMENTATION.md**](./TECHNICAL_DOCUMENTATION.md) | Developers | The single source of truth: architecture, data models, features, integrations, styling, responsive design, deployment, troubleshooting |
| [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) | End users | How to search, order, print proformas, sell, install the app, and troubleshoot |
| [docs/ANDROID_BUILD.md](./docs/ANDROID_BUILD.md) | Developers | Building the debug APK and signed release AAB with Capacitor, JDK 17 and the Android SDK |
| [docs/CLOUD_DATABASE.md](./docs/CLOUD_DATABASE.md) | Developers / admins | Supabase setup, the `schema.sql` + `seed.sql` import, the full shared-data sync module, and security limitations |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Developers | Deploying the web app and the Android app |
| [docs/PRIVACY_POLICY.md](./docs/PRIVACY_POLICY.md) | Legal / Play Store | Privacy policy template for the Play Store |
| [docs/PLAY_STORE_LISTING.md](./docs/PLAY_STORE_LISTING.md) | Release managers | Store listing copy, assets, Data safety form and release checklist |

## Quick start

```bash
npm install
npm start        # http://localhost:3000
npm test         # test runner
npm run build    # production build → ./build
```

### Demo login

| Role     | Email example                     | Password |
| -------- | --------------------------------- | -------- |
| Admin    | `admin@escon.et`                  | `admin123` |
| Supplier | `zhiruyanduamlak062@gmail.com`    | `0909`   |
| Customer | pick any user from the login list | `0909`   |

The **Admin** account configures the delivery-fee model, delivery zones, free-delivery threshold, minimum-order rule and VAT rate on the ⚙️ Settings page, and can edit or delete accounts, suppliers and products there. A fresh install starts with only the admin account; to load the demo suppliers, products and orders into Supabase, run `supabase/schema.sql` and then `supabase/seed.sql` in the Supabase SQL editor (see [docs/CLOUD_DATABASE.md](./docs/CLOUD_DATABASE.md)). The seed is an upsert, so edits and deletions made in the app are never re-seeded by the build.

## Key features

- 🔍 Live search & filtering (department, **supplier listbox**, city, price, sort)
- 🗺️ Leaflet supplier map with **OSRM driving routes**, distance & delivery cost
- 🚗 **Click a product → map opens with the route & distance immediately**
- 🎯 **Locate Me** button on the maps (with friendly handling of denied/unavailable GPS)
- 📷 **Product photos** (up to 6 per product, base64 stored locally)
- 🌍 **Global cloud sync** — with Supabase configured, products added or edited on one device appear on every other device (startup pull, live Realtime updates and a 10-second polling fallback); accounts, companies, orders, wallets, reviews and carts travel too
- 🕒 **Global live date/time widget** on every screen (invert color + transparency)
- 🛒 **One supplier per cart** — a proforma is a legal document issued by a single seller, so a cart can only hold one supplier's goods. Adding from a second supplier is refused with a warning that names both suppliers and leaves your cart untouched; clear the cart or remove the other supplier's lines first
- 🛒 Single-supplier cart with **professional proforma** (single E-SCON branding, **ETB** currency), **VAT-exclusive prices** and **VAT added only when the order is placed** (the cart shows goods + delivery plus a clear "VAT added when you place the order" note), configurable delivery fees & minimum order, checkout → orders
- 🖨️ **One-page proforma on every device** — `ProformaInvoice` measures the document at A4 width and auto-scales it before printing, so the invoice, totals, signatures and footer always stay on a single page
- 📍 **Editable locations & live GPS ordering** — customers set their real position from **My Location** on the dashboard (or in the map picker), suppliers edit the company pin in their profile, and admins can correct any account's coordinates from **Settings**. Every mobile product card has a **GPS** button beside **Order**; the product page measures the OSRM road distance for its route card and Order Summary, and **🛒 Place Order** reuses that exact KM (a fresh high-accuracy fix is taken only when a line has no measurement yet)
- ➕ **Order from the product view** — the `+ / −` quantity control appears only in the product details (steps of 1, live total, **any quantity** — no per-product minimum); results rows, product cards and the compare view just open the product
- 🧾 **Product page in the Sample Layout order** — **Product Details → Supplier Information → Customer Reviews → Order Summary**, exactly as in `Sample Layout.jpg`: photo gallery with stock badge, price cards, quantity row with a live Material Subtotal, supplier route card with ETA, reviews, then an **Order Summary** that prices subtotal, delivery, VAT and **Total Payable** on the page. **🛒 Place Order** stages the line with the exact measured KM and places the order; **🛒 Add to Cart & Review** stores the line without waiting for GPS and opens the cart, which asks for a location only when it needs to price delivery. When it cannot price, the summary says why and offers the action that fixes it — **📍 Use my current location** when no pin is available, **Retry calculating** for a failed quote, or **Clear cart & order this product** for another supplier's goods — instead of a dead button
- 🛒 **Cart first, location when pricing (v6.10)** — adding to the cart never depends on GPS: the product line is stored first, and the open cart requests one location fix to price delivery. If permission is denied the cart keeps every line and offers **Use my current location** or **Retry calculating** instead of an endless "Calculating your order..." spinner. Place Order also stages the line before taking a fix, so a failed fix lands on the cart, not an unchanged product page.
- 📏 **The exact KM from the product page carries into the cart & checkout (v6.11)** — every cart line snapshots the road distance the product page displayed (`CartItem.distanceKm`), and cart totals, the Delivery Cost row, the proforma and the placed orders all reuse that number verbatim instead of re-routing from a new GPS fix — so the distance you saw is the distance you pay for. Switching products clears the old measurement, and while every line carries one the cart takes no location fix at all
- 🛒 **Cart rebuilt in the new Sample Layout style (v6.12)** — the cart modal follows the new `Sample Layout.jpg`: a full single-page proforma-style order document with supplier & buyer details, a product photo banner per line, a numbered order-items table, a Delivery Cost block that prints the exact road km and the per-km rate (and a clear note when the platform fee applies), financial totals, the amount in words, terms & conditions, payment-method choices, supplier & buyer signature lines, and bottom actions. Sized to fit one page on desktop, tablet and phone.
- 🔒 **Accurate map pins and live cart delivery (v6.13)** - supplier addresses now resolve through an OSM neighbourhood gazetteer before Nominatim (Bole, Bole Gerji, CMC, Kazanchis, Kality, Akaki, Piazza, Megenagna, Sar Bet, Gofa, Lebanon, Lideta, Mexico, Adama); startup geocoding is sequential and only alerts when a pin moves. The cart Delivery Cost block shows the selected supplier's real Starting Point, the buyer's Destination, the measured Total Distance and rate, with a working **GPS MAP** route and **Refresh** that takes a fresh fix and re-prices every line. Amount in words is shared with the proforma, and map routing falls back to a second OSRM server before drawing a straight line.
- 🎯 **One KM everywhere (v6.15)** - search results, the product page, the cart, the proforma and the placed order all measure from the buyer's current pin and round to the same 0.1 km. The map now reports its real GPS fix back to the app, the cart re-measures saved lines when that pin moves (including after a reload), and the proforma no longer prints a separate delivery breakdown: the **Delivery Cost** row is the single, consistent total.
- 📄 **Centred A4-width cart on desktop (v6.16)** - on computers and tablets the cart is presented as a centred 794px A4-width sheet that hugs its content instead of stretching edge to edge, with the wasted padding removed and the clock on its own line. The supplier map now measures from the same saved buyer pin as search and the product page (before and after a refresh), never from a hidden Addis default. Phones keep their full-screen cart unchanged.
- **Stock levels stay private** — "In stock", stock counts and low-stock warnings are visible only to suppliers and admins, never to customers or visitors
- 🗺️ **Automatic supplier routing** — the map always draws the route from the customer's real GPS position to the selected supplier, and re-draws it the moment GPS locks in; selecting another supplier (marker, list or re-opening) replaces the previous route instead of leaving it on screen
- 🧾 **Three order actions in the cart, in order** — `1 To Purchase` places the order, `2 To Proforma` opens the proforma ready to print or save as PDF, `3 To Preview` reads the identical document on screen; the Sample Layout bottom row repeats the primary action as a **To Purchase** pill beside **Clear**, through the same code path. Cart CSV export and the old "Print Report" are gone: the proforma is the buyer's only order document
- ↩️ **"Back to To Purchase" on the proforma** — reviewed the document and want to order it? The proforma's second button drops you straight back onto step 1 of the cart (re-priced, in case a delivery distance moved) and pulses the **To Purchase** button, so nobody is stranded behind a full-screen invoice. On an empty cart it returns you to product search
- 🚫 **No export for customers** — CSV export is a supplier/admin tool: it is gone from the header, the customer dashboard, "My Orders" and the mobile "More" sheet. The proforma is the buyer's only order document
- 📄 **One proforma for the whole cart** — every selected item is on a single document, so the verification QR always sits in the document header no matter how many items are selected
- 🧭 **QR pinned to the top right** — the verification QR is a fixed third column of the proforma header grid, opposite the logo, on desktop, phone and print. A long supplier name or a long items table can never push it down the page or wrap it below the header
- 🧾 **Per-item delivery column** — each line is marked "Included" or "—" and the supplier's signature block sits next to the buyer's; the proforma shows one **Delivery Cost** total instead of a separate breakdown
- 🚚 **Supplier-set delivery rate** — a supplier ticks "this item is delivered by me" and publishes a price per km plus a starting service fee; buyers see a "With delivery" checkbox beside every quantity and the fee is worked out from the real road distance at checkout
- 🔍 **Scannable QR proforma** — scanning the invoice QR opens a mobile-friendly view of the order (works from paper); very long carts truncate the QR item list but record the true count, while the printed document always lists everything
- 🛒 **Two ways into the cart, no more** — the header cart icon on desktop and the cart button in the mobile tab bar; the mobile top bar, the home quick-action tile, the results-row button and the product-card button are gone
- 🏢 **Consistent "Welcome" headings** — every page-level heading starts with **Welcome**, and the supplier dashboard still leads with the supplier's company name
- ⚙️ **Admin platform settings** — delivery pricing, zones, free delivery & minimum order, no code changes needed
- 📲 **Installable PWA** with offline support and a device-specific install guide — every release bumps the service-worker version, so all users' cached assets are purged automatically while their accounts, products and orders stay untouched
- 📊 Supplier & customer dashboards, order management
- 📱 **Mobile banking-style app** — a dedicated mobile shell (bottom tab bar, centre cart button, "More" sheet, greeting home, trending-products carousel, card-based search, order cards with a shipment progress stepper) automatically appears on phones; the desktop layout stays untouched
- 👁️ **Tap-to-explore** — the product photo on the trending carousel and the mobile search grid opens the description, and says so with a pulsing "View details" pill (motion is skipped for reduced-motion users)
- 🖼️ **App icon = the logo** — the Android launcher icon, the PWA icon and the browser favicon are all generated from `public/logo512.png`, so the phone icon, browser tab and Play Store icon match the in-app logo
- 📸 **Screenshots are allowed in the Android app** — the Android screenshot and screen-recording shortcuts work normally, and store screenshots can be captured from the shipped build
- 🔎 **Clearer search results (v6.0)** — the Find bar spans the full width of the screen; product name, supplier and price are bold on both the mobile card and desktop table, and the department/category is no longer shown on search results; each card keeps the compact 🛒 **Order** button and the 🗺️ **Map** route button
- 🧾 **Readable proforma** — supplier and buyer details always sit side by side (phones and print included), the authorization block does too (supplier name + date beside buyer name + date), and the amount in words sits directly under the totals
- ✅ TIN / VAT / business-license compliance fields
- 📥 CSV exports & printable reports (suppliers and admins only)
- ✅ Unit tests for fees, formatting, settings, QR payloads, per-line delivery pricing and multi-item proforma payloads
- 🌙 **Light-blue interface in every theme** — soft blue page, frosted-white cards, deep navy text; the ☀️/🌙 toggle switches between two blue tints (nothing navy or black), 📱 fully responsive & touch-friendly
- 🔐 **Centered sign-in & create-account forms** — a frosted, centered card with styled inputs, a Customer/Supplier switch and checkboxes that sit on the same line as their text
- ✏️ **Editable quantities** — change the amount of any line straight in the cart with a number field plus `−` / `+` keys, and on a product page tap the quantity to type a custom number instead of tapping `+` over and over
- 📥 **Supplier stock overview** — a "My stock" panel with units on hand, stock value, low-stock and out-of-stock counts, plus an in-stock column, a status pill and a stock value per product (supplier-only, never shown to customers)

---

*Bootstrapped with [Create React App](https://github.com/facebook/create-react-app).*
