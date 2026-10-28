# E-SCON — User Guide

**E-SCON** (Ethio-Supply Chain Optimization Network) connects **suppliers** with
**customers** in Ethiopia. You can search for products, see suppliers on a map,
compare prices and delivery costs, build a cart, place an order and print a
proforma invoice.

This guide is for the people who *use* the app. For how it is built, see
[TECHNICAL_DOCUMENTATION.md](../TECHNICAL_DOCUMENTATION.md).

---

## 1. What you can do

| Role | What it is for |
| --- | --- |
| **Customer** | Search products, compare, order, print a proforma, track orders |
| **Supplier** | List products, manage stock and orders, set your own delivery rate |
| **Admin** | Configure platform-wide delivery fees, zones and the minimum-order rule |

You can use E-SCON in a normal browser, or install it as an app on your phone
(see §8).

---

## 2. Getting started

1. Open the app. After a short splash screen you land on the **Home** page.
2. Tap **Login** (or **Register** to create an account).
3. Choose your account type on the register page: **Customer** or **Supplier**.
4. **Suppliers:** finish the company details and register. Your business gets a
   default Addis Ababa location; set the exact pin afterwards from **Profile →
   Edit Company Profile** (or **Edit Company Profile** on the dashboard) by
   clicking/dragging the map marker. Buyers use that pin for distance and delivery
   routing.

### Demo accounts (sample data)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@escon.et` | `admin123` |
| Supplier | `zhiruyanduamlak062@gmail.com` | `0909` |
| Customer | any user from the login list | `0909` |

> If you register and leave the password blank, it becomes `0909`.

**Login security:** after **3 failed attempts** your login is locked for **30
seconds**. Wait and try again.

---

## 3. Finding products (everyone)

On the **Search** page:

- Type in the search box — results filter live as you type (name, description,
  brand, category).
- Narrow results with the filters: **Department**, **Supplier**, **City**,
  **Max price** and **Sort** (price up/down, rating, newest).
- Each product row shows a **🚗 distance** badge from your location to the
  supplier. Guests use a default location (Addis Ababa) marked *"(default
  location – login to use yours)"*.
- Tap a product row to **open the map with the driving route** to that supplier,
  including the distance in km and estimated driving time. Use **View Route on
  Map** from the product details for the same thing.
- On a phone, each product card shows the **bold product name, supplier and
  price**, then a small **🛒 Order** button with a **🗺️ Map** button beside it —
  Map jumps straight to the driving route for that supplier. The department is
  not shown on search results (use the Department filter to narrow the list).
- The search box itself spans the **full width of the screen**, so there is more
  room to type.
- Use the 🎯 **Locate Me** button on any map to centre it on your real position.

### Compare products

Tap the ⚖️ button on up to **4 products** to open a side-by-side comparison
(category, price, unit, rating, brand, weight, origin). A compare bar appears at
the bottom of the screen while comparing.

### Favourites

Tap ❤️/🤍 on a product to save it to your favourites. Favourites are kept per
account.

---

## 4. Ordering (customers)

1. Open a product (tap the row or its 🛒 button) to see its **details**.
2. Set the **quantity** with `−` / `+`, or tap the number to type an exact
   amount. There is **no per-product minimum** — any quantity of 1 or more is
   allowed.
3. If the supplier offers delivery for that item, a **"With delivery"**
   checkbox appears beside the quantity. Tick it to have that line delivered;
   leave it clear to collect.
4. Press **Add to Cart**.

> **One supplier per cart.** A proforma invoice is a legal document issued by a
> single seller, so a cart can only hold one supplier's goods. If you try to add
> a product from a second supplier, E-SCON warns you, names both suppliers and
> **leaves your cart untouched**. Clear your cart (or remove the other
> supplier's lines) first.

### The cart

Open the cart from the **🛒 icon** in the header (desktop) or the **floating cart
button** in the mobile tab bar. There are only these two ways in.

In the cart you can:

- Change the quantity of any line (number field with `−` / `+`).
- Tick or untick **"With delivery"** per line.
- Toggle a manual delivery-fee override where offered.

The totals update automatically (VAT-inclusive subtotal, the included VAT, per-line delivery and grand total).

### Three order actions, in order

The cart shows three buttons:

1. **1 To Purchase** — places the order for every item in the cart.
2. **2 To Proforma** — opens the proforma invoice **ready to print or save as
   PDF**.
3. **3 To Preview** — shows the same document on screen without printing.

The button at the bottom of the cart is **Clear Cart** only.

> Reviewed a proforma and now want to order? Press **🛒 Back to To Purchase** on
> the proforma. It closes the document, **re-prices the cart** (a delivery
> distance can legitimately change) and drops you back on step 1, pulsing the
> **To Purchase** button so you can't miss it. On an empty cart it takes you back
> to product search.

### The proforma invoice

The **proforma is your order document**. It contains your details and the
supplier's, the item table, a delivery breakdown, the **Amount Before VAT**, the
VAT **included** in the goods subtotal, delivery cost and the grand total, the
amount in words and the terms & conditions. It carries a **QR code** in the
top-right corner.

Scanning the QR (or opening its link) shows a **mobile-friendly view** of the
same proforma — useful for sharing or verifying a printed invoice. Very long
carts show the first 12 items in the QR, but the **printed document always lists
every item**.

> **Customers cannot export CSV.** Exporting is a supplier/admin tool by design;
> the proforma is the buyer's document. Your order history is always visible on
> the **Orders** page.

---

## 5. Your orders (customers)

The **Orders** page and the **customer dashboard** show your past orders, with a
**shipment progress stepper** (Ordered → Confirmed → In Transit → Delivered).

- On mobile, orders appear as cards with the same progress stepper.
- Use the 🔄 **quick reorder** button on a past order to jump back to search with
  that product pre-filled.

---

## 6. Selling (suppliers)

The **Supplier Dashboard** leads with your company name and shows:

- **My stock** panel: units in stock, stock value, low-stock lines and
  out-of-stock lines (amber/red when non-zero).
- Your products table with **In Stock**, **Stock Status** and **Stock Value**
  columns.
- An **Add Product** button and view/edit/delete on every product.
- An **Edit Company Profile** button that opens the business profile, location
  and account form described below.

### Adding or editing a product

- When the operator has configured cloud sync, adding, editing or deleting a
  product takes effect on **every device** (usually within seconds, without a
  reload). The same applies to your company profile and orders.
- Fill in name, description, brand, category, department, unit, price, quantity
  and compliance fields (TIN, VAT, business license) where relevant.
- **🧾 Specifications** — optional **Model**, **Weight**, **Dimensions**,
  **Grade**, **Origin** and **Certifications** (comma-separated). They appear on
  the product-details page next to the photos.
- **📷 Upload Photos** — attach up to **6 photos** per product. They show as
  thumbnails with an ✕ to remove before saving, and appear in search results,
  your dashboard and the product-details gallery.
- **🚚 This item is delivered by me (supplier)** — tick this and publish a
  **price per km** plus a **starting service fee**. Buyers then get a "With
  delivery" checkbox and the fee is worked out from the real road distance.
  Leave it unticked and the platform's delivery rules apply instead.

### Company profile

Open **Profile** in the desktop top navigation, or tap **Edit Company Profile**
on the Supplier Dashboard (also available in the phone's **More** menu). One form
edits:

- your company **logo** (upload/replace/remove), name and description;
- **city, address and exact map location** (click or drag the marker, with
  reverse geocoding);
- contact details (phone, email, website, working hours);
- legal & compliance fields (TIN, business license, VAT, trade licence expiry);
- your **account** — full name and, optionally, a new password (leave the
  password blank to keep the current one).

Products are managed separately from the dashboard. Use **Add Product** or the
view/edit/delete actions on your product table; the Add/Edit forms include the
specifications above.

### Orders

The **Order Management** page shows incoming orders. Confirm pending ones and
export orders to CSV where needed.

### What stock customers see

**Stock levels are private.** Customers and guests never see a stock number, an
"In stock"/"Out" chip or a low-stock warning anywhere in the UI. Suppliers and
admins see everything.

---

## 7. Platform settings (admin only)

Sign in as an admin (`admin@escon.et`) and open the **⚙️ Settings** page to
configure, without any code changes:

- **Delivery fee** — fixed, distance-based (`base + perKmPerTon × km`) or
  **delivery zones** (a flat fee per city), plus a **free-delivery threshold**.
- **Minimum order** — a goods-subtotal threshold. When set, the cart shows a
  warning and **Confirm Order** stays disabled until the cart qualifies.

Only admins can see this page. The system re-creates the admin account
automatically if it is ever removed.

---

## 8. Install E-SCON on your phone

E-SCON is an **installable app** (PWA) and works offline for the app shell.

- On **Android/Chrome**: tap the install banner, or browser menu → **Install
  app** / **Add to Home screen**.
- On **iPhone/Safari**: Share → **Add to Home Screen**.
- On **Windows/Edge**: the install icon in the address bar, or the app menu →
  **Install**.

Inside the app, the **📲 Install App** link in the footer (or the install banner)
opens a **device-specific Install Guide** with step-by-step instructions.

Installing is optional — the app works the same in a normal browser tab.

> **Screenshots on Android:** the Android app allows the normal system
> screenshot and screen-recording shortcuts, so you can capture prices,
> proformas or account screens when you need them. Treat those captures as
> sensitive business documents.

> When a new version is released, the app refreshes its own files automatically
> the next time you open it. **Your account, products, orders and favourites are
> never affected** by an update.

---

## 9. Appearance

- Toggle the **☀️/🌙** button to switch between two light-blue themes (nothing
  dark).
- A **live date/time widget** sits on every screen, with invert-colour and
  transparency toggles.
- All screens are touch-friendly and adapt automatically to phones with a
  dedicated mobile layout (bottom tab bar, card views, carousels).

---

## 10. Troubleshooting

| Problem | What to do |
| --- | --- |
| Distance says "Unable to calculate" | The route service is busy — retry in a moment; the app falls back to a straight-line estimate |
| Map opens without a route | Re-select the supplier; the route redraws from your current GPS position |
| Login is locked | 3 failed attempts lock it for 30 seconds — wait and retry |
| Can't install the app | The install prompt needs HTTPS and a supported browser — try Chrome/Edge/Safari |
| Photos won't save | Products allow up to 6 photos; remove one or use a smaller image |
| Forgot password | This demo stores passwords locally; register again or use a demo account |

For anything else, contact the E-SCON administrator.
