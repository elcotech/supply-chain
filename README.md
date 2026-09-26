# E-SCON — Ethio-Supply Chain Optimization Network

A single-page React + TypeScript platform connecting Ethiopian suppliers and customers: live product search, GIS supplier mapping with driving routes, distance & transport-cost calculation, cart/checkout with VAT, supplier & customer dashboards, product photos, CSV exports, and a global live date/time widget with invert-color & transparency toggles.

## 📄 Full technical documentation

**👉 See [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md)** — a complete guide covering architecture, data models, all features, third-party integrations, the styling system, responsive design, deployment, and troubleshooting, so anyone can recreate the entire project by reading it.

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
- 🛒 Multi-supplier cart with **professional proforma** (single E-SCON branding, **ETB** currency), VAT, configurable delivery fees & minimum order, checkout → orders
- ➕ **Order from the product view** — the `+ / −` quantity control appears only in the product details (steps of 1, live total, **any quantity** — no per-product minimum); results rows, product cards and the compare view just open the product
- 🔒 **Stock levels stay private** — "In stock", stock counts and low-stock warnings are visible only to suppliers and admins, never to customers or visitors
- 🗺️ **Automatic supplier routing** — the map always draws the route from the customer's real GPS position to the selected supplier, and re-draws it the moment GPS locks in; selecting another supplier (marker, list or re-opening) replaces the previous route instead of leaving it on screen
- 📄 **One supplier per proforma** — a cart with several suppliers asks which supplier to invoice, and the proforma then carries only that supplier's items, VAT and delivery fee (reusable modal, styled like the cart)
- 🔍 **Scannable QR proforma** — scanning the invoice QR opens a mobile-friendly view of the order (works from paper)
- ⚙️ **Admin platform settings** — delivery pricing, zones, free delivery & minimum order, no code changes needed
- 📲 **Installable PWA** with offline support and a device-specific install guide
- 📊 Supplier & customer dashboards, order management
- 📱 **Mobile banking-style app** — a dedicated mobile shell (bottom tab bar, centre cart button, "More" sheet, greeting home, trending-products carousel, card-based search, order cards with a shipment progress stepper) automatically appears on phones; the desktop layout stays untouched
- 👁️ **Tap-to-explore** — the product photo on the trending carousel and the mobile search grid opens the description, and says so with a pulsing "View details" pill (motion is skipped for reduced-motion users)
- 🧾 **Readable proforma** — supplier and buyer details always sit side by side (phones and print included) and the amount in words sits directly under the totals
- ✅ TIN / VAT / business-license compliance fields
- 📥 CSV exports & printable reports
- ✅ Unit tests for fees, formatting, settings, QR payloads and single-supplier proforma reports
- 🌙 Dark / light themes (deep navy dark palette — no black screens), 📱 fully responsive & touch-friendly

---

*Bootstrapped with [Create React App](https://github.com/facebook/create-react-app).*
