# E-SCON — Ethio-Supply Chain Optimization Network

A single-page React + TypeScript platform connecting Ethiopian suppliers and customers: live product search, GIS supplier mapping with driving routes, distance & transport-cost calculation, cart/checkout with VAT, supplier & customer dashboards, product photos, CSV exports for suppliers and admins, and a global live date/time widget with invert-color & transparency toggles.

## 📚 Documentation

| Document | Audience | Contents |
| --- | --- | --- |
| [**TECHNICAL_DOCUMENTATION.md**](./TECHNICAL_DOCUMENTATION.md) | Developers | The single source of truth: architecture, data models, features, integrations, styling, responsive design, deployment, troubleshooting |
| [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) | End users | How to search, order, print proformas, sell, install the app, and troubleshoot |
| [docs/ANDROID_BUILD.md](./docs/ANDROID_BUILD.md) | Developers | Building the debug APK and signed release AAB with Capacitor, JDK 17 and the Android SDK |
| [docs/CLOUD_DATABASE.md](./docs/CLOUD_DATABASE.md) | Developers / admins | Supabase setup, how sync works, and the security limitations |
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

The **Admin** account configures the delivery-fee model, delivery zones, free-delivery threshold and minimum-order rule on the ⚙️ Settings page.

## Key features

- 🔍 Live search & filtering (department, **supplier listbox**, city, price, sort)
- 🗺️ Leaflet supplier map with **OSRM driving routes**, distance & delivery cost
- 🚗 **Click a product → map opens with the route & distance immediately**
- 🎯 **Locate Me** button on the maps (with friendly handling of denied/unavailable GPS)
- 📷 **Product photos** (up to 6 per product, base64 stored locally)
- 🕒 **Global live date/time widget** on every screen (invert color + transparency)
- 🛒 **One supplier per cart** — a proforma is a legal document issued by a single seller, so a cart can only hold one supplier's goods. Adding from a second supplier is refused with a warning that names both suppliers and leaves your cart untouched; clear the cart or remove the other supplier's lines first
- 🛒 Single-supplier cart with **professional proforma** (single E-SCON branding, **ETB** currency), VAT, configurable delivery fees & minimum order, checkout → orders
- ➕ **Order from the product view** — the `+ / −` quantity control appears only in the product details (steps of 1, live total, **any quantity** — no per-product minimum); results rows, product cards and the compare view just open the product
- 🔒 **Stock levels stay private** — "In stock", stock counts and low-stock warnings are visible only to suppliers and admins, never to customers or visitors
- 🗺️ **Automatic supplier routing** — the map always draws the route from the customer's real GPS position to the selected supplier, and re-draws it the moment GPS locks in; selecting another supplier (marker, list or re-opening) replaces the previous route instead of leaving it on screen
- 🧾 **Three order actions in the cart, in order** — `1 To Purchase` places the order, `2 To Proforma` opens the proforma ready to print or save as PDF, `3 To Preview` reads the identical document on screen. Cart CSV export and the old "Print Report" are gone: the proforma is the buyer's only order document
- ↩️ **"Back to To Purchase" on the proforma** — reviewed the document and want to order it? The proforma's second button drops you straight back onto step 1 of the cart (re-priced, in case a delivery distance moved) and pulses the **To Purchase** button, so nobody is stranded behind a full-screen invoice. On an empty cart it returns you to product search
- 🚫 **No export for customers** — CSV export is a supplier/admin tool: it is gone from the header, the customer dashboard, "My Orders" and the mobile "More" sheet. The proforma is the buyer's only order document
- 📄 **One proforma for the whole cart** — every selected item is on a single document, so the verification QR always sits in the document header no matter how many items are selected
- 🧭 **QR pinned to the top right** — the verification QR is a fixed third column of the proforma header grid, opposite the logo, on desktop, phone and print. A long supplier name or a long items table can never push it down the page or wrap it below the header
- 🧾 **Per-item delivery column** — each line is marked "Included" or "—", the supplier gets a delivery breakdown row (distance + which rate paid for it), and the supplier's signature block sits next to the buyer's
- 🚚 **Supplier-set delivery rate** — a supplier ticks "this item is delivered by me" and publishes a price per km plus a starting service fee; buyers see a "With delivery" checkbox beside every quantity and the fee is worked out from the real road distance at checkout
- 🔍 **Scannable QR proforma** — scanning the invoice QR opens a mobile-friendly view of the order (works from paper); very long carts truncate the QR item list but record the true count, while the printed document always lists everything
- 🛒 **Two ways into the cart, no more** — the header cart icon on desktop and the cart button in the mobile tab bar; the mobile top bar, the home quick-action tile, the results-row button and the product-card button are gone
- 🏢 **Supplier dashboard leads with the supplier's name** — the company name is bold and centred on both the desktop and mobile supplier dashboards, instead of a "Welcome …!" line or an emoji-prefixed heading
- ⚙️ **Admin platform settings** — delivery pricing, zones, free delivery & minimum order, no code changes needed
- 📲 **Installable PWA** with offline support and a device-specific install guide — every release bumps the service-worker version, so all users' cached assets are purged automatically while their accounts, products and orders stay untouched
- 📊 Supplier & customer dashboards, order management
- 📱 **Mobile banking-style app** — a dedicated mobile shell (bottom tab bar, centre cart button, "More" sheet, greeting home, trending-products carousel, card-based search, order cards with a shipment progress stepper) automatically appears on phones; the desktop layout stays untouched
- 👁️ **Tap-to-explore** — the product photo on the trending carousel and the mobile search grid opens the description, and says so with a pulsing "View details" pill (motion is skipped for reduced-motion users)
- 🖼️ **App icon = the logo** — the Android launcher icon, the PWA icon and the browser favicon are all generated from `public/logo512.png`, so the phone icon, browser tab and Play Store icon match the in-app logo
- 📸 **Screenshots are blocked in the Android app** — the app sets Android's secure-window flag, so prices, proformas and account details cannot be screenshotted or screen-recorded (a browser tab cannot block the OS screenshot feature)
- 🔎 **Mobile search polish** — the Find bar spans the full width of the screen, the department chip on each result card is bold and larger, and a compact 🛒 **Order** button now shares its row with a new 🗺️ **Map** button that opens the driving route; the desktop results table's category column is bold and larger too
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
