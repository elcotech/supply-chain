# E-SCON Privacy Policy

**Last updated:** _[DATE]_

> **Template notice for the maintainer:** Google Play requires a public privacy
> policy URL. Replace every `_[...]_` placeholder below with real values, review
> the statements against how you actually operate the app, and host this page at
> a public HTTPS URL before submitting. This is not legal advice.

E-SCON ("we", "us", "the app") is operated by **_[COMPANY / DEVELOPER NAME]_**
("the Developer"). This policy explains what information the app collects, how
it is used and stored, and the choices you have.

**Contact:** **_[CONTACT EMAIL]_** · **_[POSTAL ADDRESS, if required]_**

---

## 1. Information we collect

### Information you provide

- **Account details** — name, email address, phone number (if provided),
  account type (customer or supplier) and password. On the current version,
  passwords are stored only on your device (see §3).
- **Company / business details** (suppliers) — company name, TIN, VAT and
  business-licence details, address and a map location you pick.
- **Product and order details** — products you list, cart contents, orders and
  proforma data.

### Information collected automatically

- **Approximate and precise location** — only when you grant the app's location
  permission, used to show your position on the map, calculate distances and
  draw delivery routes. If you deny permission, the app uses a default location
  (Addis Ababa). You can withdraw permission at any time in your device
  settings.
- **Basic technical data** — the app is a client-side application; it does not
  run analytics or advertising trackers.

### Data from third-party services

Maps, routing and geocoding use public OpenStreetMap-based services (CARTO map
tiles, the OSRM demo router and Nominatim geocoding). Requests to these services
include the coordinates needed to render a map or route. See §5.

---

## 2. How we use information

- To create and authenticate your account.
- To let customers search products and suppliers, compare prices and delivery
  costs, build a cart, place orders and print proforma invoices.
- To let suppliers list products, manage stock and orders and set delivery
  rates.
- To calculate distances and delivery fees and to display maps and routes.
- To keep accounts, products, orders, carts, wallet balances, reviews and
  platform settings consistent across devices when the operator enables cloud
  sync.

---

## 3. How information is stored

- **On your device:** account, product, cart, order and settings data are stored
  in your browser's / app's local storage (`localStorage`). Passwords are stored
  in plain text **on your device only** in the current demo version.
- **In the cloud (optional):** when the operator configures Supabase, shared
  data — accounts (including the demo plaintext password field), companies,
  products, orders, notifications, wallet balances, transactions, reviews,
  platform settings and each user's cart/favourites — is mirrored to a Supabase
  table so every device sees the same data. The database is hosted by
  **Supabase** on the operator's project. With no Supabase configuration, all of
  this data stays on the device only.

We do not sell your personal information.

---

## 4. Legal basis and your rights

Depending on where you live, you may have the right to access, correct, export
or delete your personal data, and to object to certain processing. To make a
request, contact **_[CONTACT EMAIL]_**. We may need to verify your identity
before acting.

To delete your data:

- **On your device:** clear the app's data / site data, or uninstall the app.
- **In the cloud:** request deletion from the operator at **_[CONTACT EMAIL]_**
  (the operator can remove your rows from the cloud database).

---

## 5. Third-party services

| Service | Purpose | Their privacy policy |
| --- | --- | --- |
| OpenStreetMap / CARTO | Map tiles | <https://osmfoundation.org/wiki/Privacy_Policy> · <https://carto.com/privacy/> |
| OSRM demo server | Driving routes & distances | <https://project-osrm.org/> |
| Nominatim | Address ↔ coordinate lookup | <https://osmfoundation.org/wiki/Privacy_Policy> |
| Supabase (optional) | Cloud database hosting | <https://supabase.com/privacy> |

These services receive only the data needed to fulfil the request (for example,
coordinates for a route). We do not control their practices.

---

## 6. Data retention and security

- Device data remains until you clear it or uninstall the app.
- Cloud data (when enabled) is retained until the operator deletes it.
- We take reasonable measures to protect data, but **no method of transmission
  or storage is 100% secure**. The current cloud configuration uses a public
  anonymous key with permissive access rules suitable for a demo or closed
  pilot — see the security note in
  [CLOUD_DATABASE.md](./CLOUD_DATABASE.md) before using real customer data.
- The **Android app allows screenshots and screen recordings** in v6.0 (it no
  longer sets the Android `FLAG_SECURE` window flag). You can capture prices,
  proformas and account screens; treat those images as sensitive business
  documents and avoid sharing them publicly.

---

## 7. Children

The app is intended for business use and is **not directed to children under
13** (or the minimum age in your jurisdiction). We do not knowingly collect data
from children.

---

## 8. Changes to this policy

We may update this policy from time to time. The "Last updated" date at the top
will change, and material changes will be communicated where required.

---

## 9. Contact

Questions about this policy or your data:

**_[COMPANY / DEVELOPER NAME]_**
Email: **_[CONTACT EMAIL]_**
Address: **_[POSTAL ADDRESS]_**
