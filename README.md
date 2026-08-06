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
| Supplier | `zhiruyanduamlak062@gmail.com`    | `0909`   |
| Customer | pick any user from the login list | `0909`   |

## Key features

- 🔍 Live search & filtering (department, city, price, sort)
- 🗺️ Leaflet supplier map with **OSRM driving routes**, distance & delivery cost
- 🚗 **Click a product → map opens with the route & distance immediately**
- 📷 **Product photos** (up to 6 per product, base64 stored locally)
- 🕒 **Global live date/time widget** on every screen (invert color + transparency)
- 🛒 Single-supplier cart, VAT 15%, checkout → orders
- 📊 Supplier & customer dashboards, order management
- ✅ TIN / VAT / business-license compliance fields
- 📥 CSV exports & printable reports
- 🌙 Dark / light themes, 📱 fully responsive & touch-friendly

---

*Bootstrapped with [Create React App](https://github.com/facebook/create-react-app).*
