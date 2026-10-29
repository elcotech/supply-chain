# E-SCON — Google Play Store Listing

Ready-to-paste copy and a checklist for publishing the E-SCON Android app.
Everything below is based on the app's actual behaviour; adjust wording to taste.

---

## 1. App identity

| Field | Value |
| --- | --- |
| App name (max 30 chars) | **E-SCON: Supply Chain** |
| Package name | `et.escon.supplychain` |
| Default language | English |
| Category | **Business** |
| Tags | supply chain, B2B, marketplace, procurement, logistics |
| Price | Free |
| Contains ads | No |
| In-app purchases | No |

---

## 2. Store listing copy

### Short description (max 80 characters)

```
Connect Ethiopian suppliers and customers: search, compare, order, proforma.
```

### Full description (max 4000 characters)

```
E-SCON (Ethio-Supply Chain Optimization Network) connects suppliers and
customers across Ethiopia in one simple app.

Find what you need, see who sells it nearby, compare prices and delivery costs,
and place an order in minutes — then get a professional proforma invoice you can
print or share.

FOR CUSTOMERS
• Search the catalogue with live filtering by department, supplier, city and price.
• See each supplier on a map with the driving route, distance and delivery cost.
• Compare up to four products side by side.
• Save favourites and reorder past purchases in one tap.
• Build a cart, choose delivery per item, and check out with VAT and delivery added to the net price.
• Print or preview a professional proforma invoice — or scan its QR code to open a mobile-friendly view.

FOR SUPPLIERS
• List your products with up to six photos each.
• Manage your stock with units on hand, stock value and low-stock alerts.
• Set your own delivery rate (price per km plus a starting fee) and let buyers choose it per item.
• Confirm and manage incoming orders.
• Pick your exact business location on the map.

FOR EVERYONE
• A clean, fast, touch-friendly interface with light-blue themes.
• Installable as an app and works offline for the app shell.
• Sign in securely (accounts are locked for 30 seconds after 3 failed attempts).

Built for the Ethiopian market: prices are shown in ETB and the app supports
TIN, VAT and business-licence details for compliant invoicing.

Note: E-SCON uses location to show nearby suppliers and calculate delivery
routes. Location is only used while you use the app and you can deny it — the
app falls back to a default location.
```

---

## 3. Graphic assets

Prepare and upload in the Play Console:

| Asset | Requirement |
| --- | --- |
| App icon | 512 × 512 px PNG, 32-bit, no transparency — upload a square export of **`public/logo512.png`** (the same file the app's launcher icons are generated from, see [ANDROID_BUILD.md](./ANDROID_BUILD.md#10-icons--branding)) |
| Feature graphic | 1024 × 500 px PNG/JPEG |
| Phone screenshots | 2–8 images, min 320 px, aspect ratio 16:9 or 9:16 |
| (Optional) 7-inch / 10-inch tablet screenshots | as required by the Console |

> In-app screenshots are **allowed** in the v6.1 Android build. Capture the
> six suggested shots directly from a debug or release install. See
> [ANDROID_BUILD.md §11](./ANDROID_BUILD.md#11-screenshots).

Suggested screenshots:

1. Home / hero screen.
2. Search results with the map route and distance badge open.
3. Product details with quantity and "With delivery" choice.
4. Cart with the three order steps.
5. Proforma invoice (header QR visible).
6. Supplier dashboard "My stock" panel.
7. Mobile order cards with the shipment progress stepper.

---

## 4. Data safety form answers

Based on how E-SCON currently works (see
[PRIVACY_POLICY.md](./PRIVACY_POLICY.md) and
[CLOUD_DATABASE.md](./CLOUD_DATABASE.md)):

| Question | Answer |
| --- | --- |
| Does your app collect or share user data? | **Yes** (collects; not shared with third parties for advertising) |
| Data types collected | **Personal info** (name, email, phone, user IDs); **Location** (approximate + precise, optional); **App activity** (in-app search/orders) |
| Data shared with third parties | Route/map coordinates sent to OSM/CARTO/OSRM/Nominatim to render maps; database hosting via Supabase |
| Is data encrypted in transit? | **Yes** (HTTPS) |
| Can users request data deletion? | **Yes** — via the contact in the privacy policy and by clearing app data |
| Is data collection optional? | Location is optional; account data is required to use the app |
| Data collected for | App functionality, account management |

> Verify each answer against your actual deployment before submitting — an
> inaccurate Data safety form can get the app rejected.

---

## 5. Content rating questionnaire

- Category: **Utility / Business / Productivity**.
- No violence, sexual content, profanity, drugs, gambling or user-generated
  public content.
- Likely rating: **Everyone / 3+** (**PEGI 3**).

---

## 6. Permissions declared

The Android manifest requests:

| Permission | Why |
| --- | --- |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | Show the user's position, distances and delivery routes |
| `INTERNET` | Map tiles, routing, geocoding and optional cloud sync |

No camera, contacts, microphone, storage or background-location permission is
requested.

---

## 7. Release checklist

- [ ] Signed **AAB** built and signature verified
      ([ANDROID_BUILD.md](./ANDROID_BUILD.md#6-building-a-signed-release-aab-play-store)).
- [ ] `versionCode` increased, `versionName` set (current build: **8 / "1.7"**).
- [ ] App name, short and full descriptions entered.
- [ ] Icon, feature graphic and screenshots uploaded.
- [ ] **Privacy Policy URL** live and entered in the Console
      ([PRIVACY_POLICY.md](./PRIVACY_POLICY.md)).
- [ ] **Data safety** form completed accurately (§4).
- [ ] **Content rating** questionnaire completed (§5).
- [ ] Target audience and content set correctly (not for children).
- [ ] Internal-testing track released and verified on a real device.
- [ ] Production rollout staged (percentage or full).
