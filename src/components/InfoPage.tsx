// Public information pages required by the guest menu: About E-SCON,
// How E-SCON works, Transport services and Help & Support.
import React, { useState } from 'react';

export type InfoTab = 'about' | 'how' | 'transport' | 'help';

export interface InfoPageProps {
  initialTab?: InfoTab;
  onOpenMarketplace: () => void;
  onOpenSupplierMap: () => void;
  onOpenAnalytics: () => void;
  onRegister: () => void;
  onLogin: () => void;
  onOpenInstallGuide: () => void;
}

const TABS: { id: InfoTab; label: string; icon: string }[] = [
  { id: 'about', label: 'About E-SCON', icon: 'ℹ️' },
  { id: 'how', label: 'How it works', icon: '🧭' },
  { id: 'transport', label: 'Transport services', icon: '🚛' },
  { id: 'help', label: 'Help & support', icon: '🛟' },
];

const STEPS = [
  { title: 'Search for materials', body: 'Search cement, sand, aggregate, steel, HCB and other construction materials by name, category, specification, city or price.' },
  { title: 'Compare suppliers', body: 'E-SCON shows verified supplier locations, product specifications, current listed prices, stock availability and ratings.' },
  { title: 'Calculate transport', body: 'GPS and map tools measure the supplier-to-site distance and estimate transport charges before you commit.' },
  { title: 'Compare quotations', body: 'Review product cost, transport, taxes and delivery time side by side.' },
  { title: 'Prepare the proforma', body: 'Check quantities, unit prices, subtotal, VAT and delivery charges on one professional document.' },
  { title: 'Confirm and pay', body: 'Approve the order and use an enabled payment method, wallet balance or agreed payment arrangement.' },
  { title: 'Track delivery', body: 'Follow dispatch, vehicle progress, estimated arrival and proof of delivery in real time.' },
  { title: 'Review and close', body: 'Confirm receipt, rate the supplier and transporter, and keep every transaction document.' },
];

const InfoPage: React.FC<InfoPageProps> = ({
  initialTab = 'about',
  onOpenMarketplace,
  onOpenSupplierMap,
  onOpenAnalytics,
  onRegister,
  onLogin,
  onOpenInstallGuide,
}) => {
  const [tab, setTab] = useState<InfoTab>(initialTab);

  return (
    <main className="main-content info-page">
      <section className="info-hero glass">
        <span className="hero-badge">🇪🇹 Ethio-Supply Chain Optimization Network</span>
        <h1>E-SCON — one integrated supply-chain network</h1>
        <p>
          A single platform for administration, suppliers, customers, guests and transport
          companies: verified businesses, transparent prices, GPS logistics and AI-assisted
          procurement.
        </p>
        <div className="cta-buttons">
          <button type="button" className="btn btn-primary" onClick={onOpenMarketplace}>🛍️ Browse marketplace</button>
          <button type="button" className="btn btn-secondary" onClick={onRegister}>📝 Create account</button>
          <button type="button" className="btn btn-secondary" onClick={onLogin}>🔑 Sign in</button>
        </div>
      </section>

      <div className="transport-tabs" role="tablist" aria-label="Information sections">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={'transport-tab' + (tab === item.id ? ' active' : '')}
            onClick={() => setTab(item.id)}
          >
            <span>{item.icon}</span> {item.label}
          </button>
        ))}
      </div>

      {tab === 'about' && (
        <>
          <div className="card glass">
            <div className="card-header"><h3>🎯 Vision, mission and objectives</h3></div>
            <p>
              E-SCON connects Ethiopia&apos;s construction material buyers with verified suppliers
              and transport companies. The platform makes prices, availability, distances and
              delivery costs visible before a purchase is made, and keeps every quotation,
              proforma, order and delivery record in one place.
            </p>
            <div className="info-grid">
              <div><strong>Verified businesses</strong><span>Supplier, customer and transporter accounts with TIN, licence and compliance details.</span></div>
              <div><strong>Transparent delivered cost</strong><span>Material subtotal, VAT and real road-distance delivery charges on every document.</span></div>
              <div><strong>AI-assisted decisions</strong><span>Supplier matching, price intelligence, demand forecasts and inventory recommendations.</span></div>
              <div><strong>International-ready</strong><span>Built for multi-city Ethiopian operations with room for multi-country expansion.</span></div>
            </div>
          </div>
          <div className="card glass">
            <div className="card-header"><h3>🧩 Five connected areas</h3></div>
            <div className="info-grid">
              <div><strong>Administration</strong><span>Governance, verification, finance, AI control and platform settings.</span></div>
              <div><strong>Suppliers</strong><span>Business profile, products, inventory, prices, quotations, orders and invoices.</span></div>
              <div><strong>Customers</strong><span>Search, supplier comparison, RFQs, cart, proforma, payments and tracking.</span></div>
              <div><strong>Transporters</strong><span>Dedicated dispatch dashboard for verified transport companies and fleets.</span></div>
              <div><strong>Guests</strong><span>Public marketplace, supplier directory, map, insights, help and registration.</span></div>
            </div>
          </div>
        </>
      )}

      {tab === 'how' && (
        <div className="card glass">
          <div className="card-header"><h3>🧭 From search to final delivery</h3></div>
          <div className="info-steps">
            {STEPS.map((step, index) => (
              <div className="info-step" key={step.title}>
                <span className="info-step-number">{index + 1}</span>
                <div><strong>{step.title}</strong><p>{step.body}</p></div>
              </div>
            ))}
          </div>
          <div className="cta-buttons">
            <button type="button" className="btn btn-primary" onClick={onOpenMarketplace}>Start browsing</button>
            <button type="button" className="btn btn-secondary" onClick={onOpenSupplierMap}>Open supplier map</button>
          </div>
        </div>
      )}

      {tab === 'transport' && (
        <>
          <div className="card glass">
            <div className="card-header"><h3>🚛 Transport services and coverage</h3></div>
            <p>
              Verified transport companies publish their vehicles, drivers, service areas and
              rates. E-SCON matches confirmed delivery requests with an available transporter
              and shows the distance-based job fee before the trip is accepted.
            </p>
            <div className="info-grid">
              <div><strong>Dedicated transporter dashboard</strong><span>Open requests, active trips, dispatch, fleet, drivers, pricing and earnings.</span></div>
              <div><strong>Distance-based pricing</strong><span>Starting fee + per-kilometre rate + per-tonne rate, calculated from the real road distance.</span></div>
              <div><strong>Dispatch and tracking</strong><span>Assign a vehicle and driver, advance pickup, transit and delivery status.</span></div>
              <div><strong>Proof of delivery</strong><span>Capture who received the goods, a delivery note and a timestamp.</span></div>
            </div>
          </div>
          <div className="card glass">
            <div className="card-header"><h3>📦 For transport companies</h3></div>
            <p>Register a transporter account to receive delivery requests, manage your fleet and track earnings.</p>
            <div className="cta-buttons">
              <button type="button" className="btn btn-primary" onClick={onRegister}>Register as a transporter</button>
              <button type="button" className="btn btn-secondary" onClick={onOpenSupplierMap}>See supplier locations</button>
            </div>
          </div>
        </>
      )}

      {tab === 'help' && (
        <>
          <div className="card glass">
            <div className="card-header"><h3>🛟 Frequently asked questions</h3></div>
            <div className="info-faq">
              <details><summary>How do I place an order?</summary><p>Search or browse the marketplace, open a product, choose your quantity and delivery option, then review the cart and proforma before confirming.</p></details>
              <details><summary>Who can see stock levels?</summary><p>Stock counts are visible only to the supplier who owns the product and platform administrators. Buyers see availability, not internal quantities.</p></details>
              <details><summary>How is delivery priced?</summary><p>The platform measures the real road distance from the supplier to your saved location. The supplier&apos;s published rate is used first; otherwise the platform delivery rules apply.</p></details>
              <details><summary>How do I install the app?</summary><p>Use the install button in the header or the installation guide. On Android you can also install the packaged APK.</p></details>
              <details><summary>How do transporters get work?</summary><p>Confirmed customer orders that need delivery appear in the transporter&apos;s Delivery requests tab. Accept a request, assign a vehicle and driver, then complete it with proof of delivery.</p></details>
              <details><summary>How do I change my language?</summary><p>E-SCON is designed for English, Amharic and additional languages. Language selection will expand as translations are enabled.</p></details>
            </div>
          </div>
          <div className="card glass">
            <div className="card-header"><h3>📞 Contact and support</h3></div>
            <div className="info-grid">
              <div><strong>Platform administrator</strong><span>Use this device&apos;s registered administrator account for account and compliance issues.</span></div>
              <div><strong>Supplier or transporter</strong><span>Open your dashboard to update your profile, fleet, prices and delivery availability.</span></div>
              <div><strong>Install help</strong><span>Follow the step-by-step installation guide for Android, iPhone and desktop.</span></div>
            </div>
            <div className="cta-buttons">
              <button type="button" className="btn btn-primary" onClick={onOpenInstallGuide}>📲 Installation guide</button>
              <button type="button" className="btn btn-secondary" onClick={onOpenAnalytics}>📊 Public market insights</button>
            </div>
          </div>
        </>
      )}
    </main>
  );
};

export default InfoPage;
