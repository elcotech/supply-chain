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
(see §9).

---

## 2. Getting started

1. Open the app. After a short splash screen you land on the **Home** page.
2. Tap **Login** (or **Register** to create an account).
3. Choose your account type on the register page: **Customer** or **Supplier**.
4. Enter your address and city. E-SCON geocodes them so your account starts with
   a real location; you can refine it at any time:
   - **Customers:** **Dashboard → My Location → Edit / use current location**, then
     drag the pin or press **Locate Me**.
   - **Suppliers:** **Profile → Edit Company Profile** (or **Edit Company Profile**
     on the dashboard) and click/drag the marker.
   Buyers use that saved pin for search previews; pressing **Place Order** on a
   product refreshes it with the device's current GPS position before pricing
   delivery. Admins can also
   correct any account from **Settings → Data Manager → Location**.

### Demo accounts (sample data)

> Demo suppliers, products and orders are loaded from **`supabase/seed.sql`** into
> Supabase (see `docs/CLOUD_DATABASE.md`). A fresh install otherwise starts with
> only the admin account — nothing is hard-coded in the app any more.

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
  supplier. If you have not set a location (for example, before signing in) the
  badge shows **—** instead of inventing a distance; sign in or set **My
  Location** to see it.
- Tap a product row to **open the map with the driving route** to that supplier,
  including the distance in km and estimated driving time. Use **View Route on
  Map** from the product details for the same thing.
- On a phone, each product card shows the **bold product name, supplier and
  price**, then a yellow **🛒 Order** button with a **🗺️ GPS** button beside it.
  **GPS** jumps straight to the driving route for that supplier; once the item is
  in your cart the Order button turns **green** and reads **Ordered — edit**. The
  department is not shown on search results (use the Department filter to narrow
  the list).
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
3. If the supplier offers delivery for that item, the **Delivery Price** card
   carries a **"With delivery"** checkbox. Untick it to collect instead — the
   Order Summary re-prices straight away.
4. Scroll to **Order Summary**. It prices the order on the page: material
   subtotal, delivery price, VAT and **Total Payable** — the exact amount that
   will leave your account. If you have no saved pin yet, the summary asks your
   device for your location automatically.
5. Press **🛒 Place Order**. E-SCON places the order using the **exact driving
   distance the page just showed you** — no new location prompt while that
   measurement exists (it only asks your device for a position when a line has
   none) — and takes you to the **Orders** page. If the item is already in your
   cart, the quantity you set on the page is the quantity that gets ordered.

Would rather review first? Press **Add to Cart & Review** — the item goes
into your cart and the cart opens, where **1 To Purchase** places the same order.
Adding never waits for GPS: the line is saved first. When the cart needs to price
delivery it asks for your location once. If permission is denied, your lines stay
in the cart and you can press **Use my current location** or **Retry calculating**.

The product page is laid out in four sections, in this order: **Product Details →
Supplier Information → Customer Reviews → Order Summary**. Product Details holds
the photo gallery with its **✔ In Stock** badge, the category tag, title,
description, the **Unit Price** and **Delivery Price** cards, the quantity row
with the live **Material Subtotal**, and the **Order Date** / **Delivery Time**
row. Supplier Information shows the verified supplier, its rating, address, phone
and a route preview with the distance, ETA and **View Route on Map**. The
distance shown is the one used for delivery: **Place Order** and **Add to Cart
& Review** carry that exact figure into the cart and checkout instead of
measuring again.

> **Location access is needed to price delivery, not to add items.** If permission is denied,
> the fix times out, or GPS is unavailable, E-SCON warns you and uses your saved
> location only when one exists. If no saved location exists, the cart (or Order Summary)
> asks for a fix and shows **📍 Use my current location** — allow location access
> and tap it (or press **Place Order**) again.

> **Order Summary never fails silently.** While it prices, the button reads
> **Calculating…**. If it cannot produce a total, it says why and gives you the
> one action that fixes it: **📍 Use my current location** when you have no pin,
> **🔁 Retry calculating** for a failed quote, or **🗑️ Clear cart & order this
> product** when the cart holds another supplier's goods.

> **One supplier per cart.** A proforma invoice is a legal document issued by a
> single seller, so a cart can only hold one supplier's goods. If your cart
> already holds another supplier's items, the Order Summary names that supplier
> instead of pretending the order can go through. Clear your cart (or remove the
> other supplier's lines) first.

### The cart

Open the cart from the **🛒 icon** in the header (desktop) or the **floating cart
button** in the mobile tab bar. There are only these two ways in.

The cart follows the app's shopping-cart layout: a dark-blue **E-SCON |
SHOPPING CART** header with the **live date and time** on its own line, the
three order steps below it, one photo card per item (with **View** to open the
product page and **Map** to draw the route), the quantity controls with the
**With delivery** choice, then a numbered **Financial Summary** and the
**Payment Method** block. On a computer or tablet the cart opens as a centred
A4-width sheet instead of stretching across the whole screen; on a phone it
stays full-screen.

In the cart you can:

- Change the quantity of any line (number field with `−` / `+`).
- Tick or untick **"With delivery"** per line.
- Toggle a manual delivery-fee override where offered.
- Press **View** or **Map** on an item card to re-open the product or its route.

The totals update automatically, and the **Delivery Cost** row shows the same
road distance as the product page (for example `11.7 km × 25.01 ETB/km`), rounded
to one decimal in every view. If you move, the cart re-measures its saved lines
from your new position (from the map's live GPS fix, the cart's **Refresh**
button, or after a reload) so the cart, proforma and order never keep an old KM.
The cart only asks your device for a location when a line has no measured
distance yet; if permission is denied, the cart keeps every line and shows **Use
my current location** or **Retry calculating** instead of spinning forever. The
map measures from the same saved pin as search and the product page, so the KM
you see before opening a product matches the route and the value after a
refresh. If no location is saved, the map asks you to set one instead of
inventing an Addis distance. The
Financial Summary shows the goods subtotal, the pending VAT note (**"Added when
you place the order"**) and the **Grand Total** — the VAT-inclusive payable that
is what the wallet balance must cover.

### Three order actions, in order

The cart shows three buttons:

1. **1 To Purchase** — places the order for every item in the cart.
2. **2 To Proforma** — opens the proforma invoice **ready to print or save as
   PDF**.
3. **3 To Preview** — shows the same document on screen without printing.

The bottom row of the cart holds **Clear** (empties the cart) and **To
Purchase** — the same action as step 1, through the same code path, so the two
can never disagree about the total.

> Reviewed a proforma and now want to order? Press **🛒 Back to To Purchase** on
> the proforma. It closes the document, **re-prices the cart** (quantities and
> fees are refreshed; the measured distance itself stays fixed) and drops you back on step 1, pulsing the
> **To Purchase** button so you can't miss it. On an empty cart it takes you back
> to product search.

### The proforma invoice

The **proforma is your order document**. It contains your details and the
supplier's, the item table, one **Delivery Cost** total, the **Amount Before VAT**, the
VAT **added** on top of the goods subtotal, delivery cost and the grand total, the
amount in words and the terms & conditions. It carries a **QR code** in the
top-right corner. The document automatically scales to fit **one A4 page** when
printed — on desktop, phone or tablet — so totals, signatures and the footer never
continue onto a second page.

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

## 7. Marketplace, analytics and Copilot (everyone)

### Marketplace

Open **Marketplace** from the top navigation, the footer, the mobile bottom bar
(**Market**) or the **New in E-SCON** card on Home.

- Search the whole catalogue in the hero box, then narrow it with **category**
  and **city** chips and the **sort** list (relevance, price up/down, rating,
  newest).
- Tap a **supplier storefront** to see their city, rating, catalogue size,
  delivery-rate summary and a **View route** button that opens the same map and
  distance used by Search, product details and the cart.
- Product cards work like the rest of the app: ♡ saves a favourite, the compare
  icon adds up to four items, and **Add** stages the item in the same cart. The
  button changes to **In cart** once added.
- Use **Load more** to see the next page of results.

### Analytics & Insights

Open **Insights** (or **Analytics**) from the navigation, footer, mobile **More**
sheet or the Home card.

- Pick a period: **30 days**, **90 days**, **365 days** or **All time**.
- The figures always match your account:
  - **Admin** sees the whole platform.
  - **Supplier** sees only their own company's products and orders.
  - **Customer** sees only their own orders and spending.
- Cards summarise revenue/GMV, orders, average order value, delivery and VAT,
  stock value and low-stock items. Charts show the six-month trend, order
  status, category and city mix; tables rank top products, suppliers and
  customers; the price board shows each product's current price and forecast.
- The coloured insight strip explains the most important movement in plain
  language (for example, revenue up or down versus the previous period).
- **Export CSV** is available to suppliers and admins. Customers do not export
  data.

### Copilot

Open **Copilot** from the navigation, footer, mobile bottom bar (**🤖 Copilot**)
or any **Ask Copilot** button.

- Tap a suggested question or type your own, for example **"How is revenue this
  month?"**, **"What should I restock?"**, **"Who are my top customers?"** or
  **"Compare category performance"**.
- Answers are built **only from your own role-scoped data** and show metric
  cards, mini-charts and bullet explanations. Copilot runs on the device, so it
  works offline and never sends your business data to a server.
- Follow-up chips suggest the next useful question. The sidebar shows the live
  context (role, period, orders, catalog size) and shortcuts back to
  Marketplace and Insights.
- **Clear chat** removes the conversation. History is kept for the current
  browser tab only.

---

## 8. Platform settings (admin only)

Sign in as an admin (`admin@escon.et`) and open the **⚙️ Settings** page to
configure, without any code changes:

- **Delivery fee** — fixed, distance-based (`base + perKmPerTon × km`) or
  **delivery zones** (a flat fee per city), plus a **free-delivery threshold**.
- **Minimum order** — a goods-subtotal threshold. When set, the cart shows a
  warning and **Confirm Order** stays disabled until the cart qualifies.

Only admins can see this page. The system re-creates the admin account
automatically if it is ever removed.

---

## 9. Install E-SCON on your phone

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

> When a new version is released, the app refreshes its own files automatically — the service-worker version for the web build, and the Android `versionCode` for the installed app. Your account, products and orders are never lost in a refresh; the next time you open the app you get the new build.

---

## 10. Appearance

- Toggle the **☀️/🌙** button to switch between two light-blue themes (nothing
  dark).
- A **live date/time widget** sits on every screen, with invert-colour and
  transparency toggles.
- All screens are touch-friendly and adapt automatically to phones with a
  dedicated mobile layout (bottom tab bar, card views, carousels).

---

## 11. Troubleshooting

| Problem | What to do |
| --- | --- |
| Distance says "Unable to calculate" | The route service is busy — retry in a moment; the app falls back to a straight-line estimate |
| Order says my location is unavailable | Your items are already saved in the cart. Allow location/GPS access for E-SCON, then use **Use my current location** in the cart (or press **Place Order** again). Without permission the app can only use a saved location, if one exists |
| Distance didn't change after I moved | Open the map once so it can lock a GPS fix, or press **Refresh** in the cart's Delivery Cost block; the saved cart lines are then re-measured from the new position and every view shows the same 0.1 km value |
| Order Summary keeps saying "Calculating…" | It prices 250 ms after you change something, so wait a beat. If it cannot finish, the block on screen says why and gives you **📍 Use my current location** when you have no pin, **Retry calculating** for a failed quote, or **Clear cart & order this product** when the cart holds another supplier's goods |
| "Please select a valid user" although the details are right | The account list was still loading. Close the form and try again — the list loads without waiting on location any more |
| Map opens without a route | Re-select the supplier; the route redraws from your current GPS position |
| Login is locked | 3 failed attempts lock it for 30 seconds — wait and retry |
| Can't install the app | The install prompt needs HTTPS and a supported browser — try Chrome/Edge/Safari |
| Photos won't save | Products allow up to 6 photos; remove one or use a smaller image |
| Forgot password | This demo stores passwords locally; register again or use a demo account |

For anything else, contact the E-SCON administrator.
