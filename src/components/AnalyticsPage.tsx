// ===== src/components/AnalyticsPage.tsx =====
// Role-aware business intelligence, laid out like the Sample Layout document:
// a centred, A4-inspired sheet on desktop that becomes a full-width report on
// phones. The calculations live in src/lib/analytics.ts so the Copilot can use
// exactly the same figures.
import React, { useMemo, useState } from 'react';
import { Company, Material, Order, ProductReview, SystemSettings, User } from '../types';
import { buildAnalytics } from '../lib/analytics';
import { effectiveRating, exportToCSV, formatCurrency } from '../utils';
import { DonutChart, HorizontalBarChart, LineChart, Sparkline } from './Charts';

export interface AnalyticsPageProps {
  user: User | null;
  materials: Material[];
  companies: Company[];
  orders: Order[];
  users: User[];
  reviews: ProductReview[];
  settings: SystemSettings;
  onOpenProduct: (material: Material) => void;
  onOpenMarketplace: () => void;
  onOpenSettings: () => void;
  onOpenSupplierMap: () => void;
  onAskCopilot: (prompt?: string) => void;
  onNotify: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

const PERIODS = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '1 year', value: 365 },
  { label: 'All time', value: 0 },
];

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  user,
  materials,
  companies,
  orders,
  users,
  reviews,
  settings,
  onOpenProduct,
  onOpenMarketplace,
  onOpenSettings,
  onOpenSupplierMap,
  onAskCopilot,
  onNotify,
}) => {
  const [days, setDays] = useState(90);
  const analytics = useMemo(
    () => buildAnalytics({ user, materials, companies, orders, users, reviews, settings, days }),
    [user, materials, companies, orders, users, reviews, settings, days]
  );

  const company = user?.userType === 'company' ? companies.find(c => c.userId === user.id) : undefined;
  const stockMaterials = user?.userType === 'company'
    ? materials.filter(m => m.companyId === company?.id)
    : user?.userType === 'admin' ? materials : [];
  const criticalStock = stockMaterials
    .filter(m => (m.quantity || 0) <= 10)
    .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
    .slice(0, 6);

  const isGuest = analytics.role === 'guest';

  // Public, non-confidential catalogue views for signed-out visitors. These
  // never touch orders, revenue, customer identities, stock or supplier margin.
  const guestData = useMemo(() => {
    const reviewsFor = (materialId: string) => reviews.filter(r => r.materialId === materialId);
    const ratedMaterials = materials.map(material => {
      const materialReviews = reviewsFor(material.id);
      return {
        material,
        rating: effectiveRating(material.rating || 0, materialReviews),
        reviewCount: materialReviews.length,
      };
    });
    const topRated = [...ratedMaterials]
      .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount || a.material.name.localeCompare(b.material.name))
      .slice(0, 6);
    const priceBands = [
      { label: 'Under 1k', min: 0, max: 1000 },
      { label: '1k–5k', min: 1000, max: 5000 },
      { label: '5k–10k', min: 5000, max: 10000 },
      { label: '10k–50k', min: 10000, max: 50000 },
      { label: '50k+', min: 50000, max: Infinity },
    ].map(band => ({
      label: band.label,
      value: materials.filter(m => (m.price || 0) >= band.min && (m.price || 0) < band.max).length,
    })).filter(band => band.value > 0);
    const ratings = reviews.length > 0
      ? reviews.map(r => Number(r.rating) || 0)
      : materials.map(m => Number(m.rating) || 0);
    const ratingMix = [
      { label: '4.5–5 ★', value: ratings.filter(r => r >= 4.5).length, color: '#2ecc71' },
      { label: '3.5–4.4 ★', value: ratings.filter(r => r >= 3.5 && r < 4.5).length, color: '#3498db' },
      { label: '2.5–3.4 ★', value: ratings.filter(r => r >= 2.5 && r < 3.5).length, color: '#f1c40f' },
      { label: 'Below 2.5 ★', value: ratings.filter(r => r < 2.5).length, color: '#e74c3c' },
    ].filter(slice => slice.value > 0);
    const suppliers = companies.map(company => ({
      ...company,
      productCount: materials.filter(m => m.companyId === company.id).length,
    })).sort((a, b) => (b.rating || 0) - (a.rating || 0) || b.productCount - a.productCount);
    const cities = Array.from(
      companies.reduce((map, company) => {
        const city = company.city || 'Unknown';
        const current = map.get(city) || { suppliers: 0, products: 0 };
        current.suppliers += 1;
        current.products += materials.filter(m => m.companyId === company.id).length;
        map.set(city, current);
        return map;
      }, new Map<string, { suppliers: number; products: number }>())
    )
      .map(([city, value]) => ({ city, ...value }))
      .sort((a, b) => b.suppliers - a.suppliers || b.products - a.products);
    const categoryPrices = Array.from(
      materials.reduce((map, material) => {
        const category = material.category || 'Other';
        const current = map.get(category) || { prices: [] as number[], products: 0 };
        current.prices.push(material.price || 0);
        current.products += 1;
        map.set(category, current);
        return map;
      }, new Map<string, { prices: number[]; products: number }>())
    ).map(([category, value]) => {
      const sum = value.prices.reduce((total, price) => total + price, 0);
      return {
        category,
        products: value.products,
        min: Math.min(...value.prices),
        avg: value.prices.length > 0 ? sum / value.prices.length : 0,
        max: Math.max(...value.prices),
      };
    }).sort((a, b) => b.products - a.products);
    return { topRated, priceBands, ratingMix, suppliers, cities, categoryPrices };
  }, [companies, materials, reviews]);

  const costMix = [
    { label: 'Goods', value: Math.max(analytics.gmv - analytics.deliveryFees - analytics.vatCollected, 0), color: '#1a6fb5' },
    { label: 'Delivery', value: analytics.deliveryFees, color: '#e67e22' },
    { label: 'VAT', value: analytics.vatCollected, color: '#8b5cf6' },
  ];
  const trendLabel = analytics.role === 'customer' ? 'Spending trend' : 'Revenue trend';

  const accountMix = [
    { label: 'Customers', value: users.filter(u => u.userType === 'customer').length, color: '#2ecc71' },
    { label: 'Suppliers', value: users.filter(u => u.userType === 'company').length, color: '#e67e22' },
    { label: 'Admins', value: users.filter(u => u.userType === 'admin').length, color: '#8b5cf6' },
  ];
  const complianceMix = [
    { label: 'Compliant', value: companies.filter(c => c.complianceStatus === 'compliant').length, color: '#2ecc71' },
    { label: 'Pending', value: companies.filter(c => c.complianceStatus === 'pending').length, color: '#f1c40f' },
    { label: 'Non-compliant', value: companies.filter(c => c.complianceStatus === 'non-compliant').length, color: '#e74c3c' },
  ];
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const missingLocations = users.filter(u => {
    const lat = Number(u.lat);
    const lng = Number(u.lng);
    return !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0);
  }).length;
  const unverifiedSuppliers = companies.filter(c => !c.tinNumber || c.complianceStatus !== 'compliant').length;

  const exportAccounts = (): void => {
    if (users.length === 0) {
      onNotify('No accounts to export yet.', 'warning');
      return;
    }
    exportToCSV(users.map(u => ({
      Name: u.name,
      Email: u.email,
      Role: u.userType,
      Company: u.companyName || '',
      Phone: u.phone,
      City: u.city,
      Address: u.address,
      Registered: u.registered,
      Latitude: u.lat,
      Longitude: u.lng,
      VATRegistered: u.vatRegistered ? 'yes' : 'no',
    })), `escon-accounts-${new Date().toISOString().slice(0, 10)}`);
    onNotify('Account report exported as CSV', 'success');
  };

  const exportSuppliers = (): void => {
    if (companies.length === 0) {
      onNotify('No suppliers to export yet.', 'warning');
      return;
    }
    exportToCSV(companies.map(company => {
      const supplierOrders = orders.filter(o => o.companyId === company.id && o.status !== 'cancelled');
      return {
        Supplier: company.name,
        City: company.city,
        Rating: company.rating || 0,
        Products: materials.filter(m => m.companyId === company.id).length,
        Orders: supplierOrders.length,
        RevenueETB: supplierOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        Compliance: company.complianceStatus || 'pending',
        TIN: company.tinNumber || '',
        VAT: company.vatNumber || '',
      };
    }), `escon-suppliers-${new Date().toISOString().slice(0, 10)}`);
    onNotify('Supplier report exported as CSV', 'success');
  };

  const exportAdminOrders = (): void => {
    if (orders.length === 0) {
      onNotify('No orders to export yet.', 'warning');
      return;
    }
    exportToCSV(orders.map(order => {
      const customer = users.find(u => u.id === order.customerId);
      const supplier = companies.find(c => c.id === order.companyId);
      const product = materials.find(m => m.id === order.materialId);
      return {
        Order: order.id,
        Date: order.orderDate,
        Customer: customer?.name || order.customerId,
        Supplier: supplier?.name || order.companyId,
        Product: product?.name || order.materialId,
        Quantity: order.quantity,
        UnitPriceETB: order.unitPrice,
        DeliveryETB: order.transportCost,
        VATETB: order.vatAmount,
        TotalETB: order.totalAmount,
        Status: order.status,
        Payment: order.paymentStatus,
      };
    }), `escon-orders-${new Date().toISOString().slice(0, 10)}`);
    onNotify('Order book exported as CSV', 'success');
  };

  const exportAnalytics = (): void => {
    const rows = analytics.topProducts.length > 0
      ? analytics.topProducts.map(p => ({
          Product: p.name,
          Category: p.category,
          Supplier: p.supplierName,
          Units: p.units,
          Orders: p.orders,
          RevenueETB: p.revenue,
          PriceETB: p.price,
          Rating: p.rating,
        }))
      : analytics.priceBoard.map(p => ({
          Product: p.name,
          Category: p.category,
          PriceETB: p.price,
          MarginPercent: Math.round(p.marginPct),
          Forecast: p.forecast ? p.forecast.trend : 'tracking',
          ForecastChangePercent: p.forecast ? p.forecast.changePct.toFixed(1) : '',
        }));
    if (rows.length === 0) {
      onNotify('Nothing to export yet — add products or place an order first.', 'warning');
      return;
    }
    exportToCSV(rows, `escon-analytics-${analytics.role}-${new Date().toISOString().slice(0, 10)}`);
    onNotify('Analytics exported as CSV', 'success');
  };

  const periodChip = (value: number, label: string) => (
    <button
      key={value}
      type="button"
      className={'escon-period-chip' + (days === value ? ' active' : '')}
      onClick={() => setDays(value)}
    >
      {label}
    </button>
  );

  const categoryFormatter = (value: number): string =>
    analytics.categoryBasis === 'revenue' ? formatCurrency(value) : String(value);

  return (
    <main className="main-content">
      <div className="escon-sheet analytics-sheet">
        <header className="escon-sheet-head">
          <div className="escon-sheet-brand">
            <span className="escon-sheet-logo">🏗️</span>
            <div>
              <span className="escon-kicker">E-SCON · Business Intelligence</span>
              <h1 className="escon-sheet-title">Analytics &amp; Insights</h1>
              <p className="escon-sheet-sub">{analytics.scopeLabel} · {isGuest ? 'Public catalogue' : analytics.periodLabel}</p>
            </div>
          </div>
          <div className="escon-sheet-meta">
            <span className={'escon-role-chip role-' + analytics.role}>{analytics.role === 'company' ? 'Supplier' : analytics.role === 'customer' ? 'Buyer' : analytics.role === 'admin' ? 'Administrator' : analytics.role === 'transporter' ? 'Transporter' : 'Visitor'} view</span>
            <span>Generated {new Date(analytics.generatedAt).toLocaleString()}</span>
            <span>{isGuest ? `${analytics.productCount} products · ${analytics.supplierCount} suppliers` : `${analytics.orderCount} orders · ${analytics.productCount} products`}</span>
          </div>
        </header>

        <div className="escon-toolbar">
          {!isGuest && (
            <div className="escon-period-group" role="group" aria-label="Analytics period">
              {PERIODS.map(p => periodChip(p.value, p.label))}
            </div>
          )}
          {isGuest && (
            <p className="escon-toolbar-note">
              Public marketplace view. Sign in to see your own orders, spending and forecasts.
            </p>
          )}
          <div className="escon-toolbar-actions">
            <button type="button" className="escon-btn ghost" onClick={onOpenMarketplace}>🛍️ Marketplace</button>
            {!isGuest && (
              <>
                <button type="button" className="escon-btn ghost" onClick={() => onAskCopilot('Give me an executive summary')}>🤖 Ask Copilot</button>
                <button type="button" className="escon-btn" onClick={exportAnalytics}>📥 Export CSV</button>
              </>
            )}
            {isGuest && (
              <button type="button" className="escon-btn" onClick={onOpenSupplierMap}>📍 Explore supplier map</button>
            )}
          </div>
        </div>

        {analytics.insights.length > 0 && (
          <section className="escon-insights" aria-label={isGuest ? 'Marketplace snapshot' : 'Key insights'}>
            <div className="escon-insights-head">
              <span className="escon-insights-icon">✨</span>
              <h2>{isGuest ? 'Marketplace snapshot' : 'AI insights'}</h2>
              <span className="escon-insights-live">{isGuest ? 'Public data' : 'Live data'}</span>
            </div>
            <ul>
              {analytics.insights.map((insight, index) => <li key={index}>{insight}</li>)}
            </ul>
          </section>
        )}

        <section className="kpi-grid" aria-label="Key performance indicators">
          {analytics.kpis.map(kpi => (
            <div key={kpi.key} className={'kpi-card' + (kpi.tone ? ' kpi-' + kpi.tone : '')}>
              <span className="kpi-icon">{kpi.icon}</span>
              <span className="kpi-label">{kpi.label}</span>
              <strong className="kpi-value">{kpi.value}</strong>
              {kpi.sub && <span className="kpi-sub">{kpi.sub}</span>}
            </div>
          ))}
        </section>

        {analytics.role === 'admin' && (
          <section className="escon-section admin-control" aria-label="Administrator controls">
            <div className="escon-section-head">
              <h2>Platform control room</h2>
              <span className="escon-badge">{users.length} accounts | {companies.length} suppliers</span>
            </div>
            <div className="admin-control-grid">
              <div className="admin-control-cards">
                <div className="admin-control-card">
                  <span className="admin-control-icon">CU</span>
                  <div><strong>{accountMix.find(a => a.label === 'Customers')?.value || 0}</strong><small>Customer accounts</small></div>
                </div>
                <div className="admin-control-card">
                  <span className="admin-control-icon">SU</span>
                  <div><strong>{accountMix.find(a => a.label === 'Suppliers')?.value || 0}</strong><small>Supplier accounts</small></div>
                </div>
                <div className="admin-control-card">
                  <span className="admin-control-icon">PO</span>
                  <div><strong>{pendingOrders}</strong><small>Pending orders</small></div>
                </div>
                <div className={'admin-control-card' + (missingLocations > 0 ? ' warn' : '')}>
                  <span className="admin-control-icon">GPS</span>
                  <div><strong>{missingLocations}</strong><small>Accounts without GPS pin</small></div>
                </div>
                <div className={'admin-control-card' + (unverifiedSuppliers > 0 ? ' warn' : '')}>
                  <span className="admin-control-icon">TIN</span>
                  <div><strong>{unverifiedSuppliers}</strong><small>Suppliers needing compliance review</small></div>
                </div>
              </div>
              <div className="admin-control-actions">
                <button type="button" className="escon-btn" onClick={onOpenSettings}>Open Data Manager</button>
                <button type="button" className="escon-btn ghost" onClick={onOpenSupplierMap}>Supplier Map</button>
                <button type="button" className="escon-btn ghost" onClick={exportAccounts}>Accounts CSV</button>
                <button type="button" className="escon-btn ghost" onClick={exportSuppliers}>Suppliers CSV</button>
                <button type="button" className="escon-btn ghost" onClick={exportAdminOrders}>Order Book CSV</button>
              </div>
            </div>
            <div className="chart-grid admin-control-charts">
              <section className="escon-chart-card">
                <div className="escon-section-head">
                  <h2>Accounts by role</h2>
                  <span className="escon-badge">{users.length} total</span>
                </div>
                <DonutChart data={accountMix} size={142} centerLabel={String(users.length)} />
              </section>
              <section className="escon-chart-card">
                <div className="escon-section-head">
                  <h2>Supplier compliance</h2>
                  <span className="escon-badge">{companies.length} profiles</span>
                </div>
                <DonutChart data={complianceMix} size={142} centerLabel={String(companies.length)} />
              </section>
            </div>
          </section>
        )}

        {isGuest ? (
          <>
            <div className="chart-grid">
              <section className="escon-chart-card">
                <div className="escon-section-head">
                  <h2>Price bands</h2>
                  <span className="escon-badge">{materials.length} products</span>
                </div>
                <HorizontalBarChart
                  data={guestData.priceBands}
                  valueFormatter={value => String(value) + ' products'}
                  color="#1a6fb5"
                />
              </section>
              <section className="escon-chart-card">
                <div className="escon-section-head">
                  <h2>Rating mix</h2>
                  <span className="escon-badge">{reviews.length > 0 ? reviews.length + ' reviews' : 'Catalogue ratings'}</span>
                </div>
                <DonutChart
                  data={guestData.ratingMix}
                  size={150}
                  centerLabel={reviews.length > 0 ? String(reviews.length) : String(materials.length)}
                />
              </section>
            </div>

            <div className="chart-grid">
              <section className="escon-chart-card">
                <div className="escon-section-head">
                  <h2>Catalogue by category</h2>
                  <span className="escon-badge">Products</span>
                </div>
                <HorizontalBarChart
                  data={analytics.categoryData}
                  valueFormatter={value => String(value) + ' products'}
                  color="#2ecc71"
                />
              </section>
              <section className="escon-chart-card">
                <div className="escon-section-head">
                  <h2>Supplier coverage</h2>
                  <span className="escon-badge">{analytics.supplierCount} suppliers</span>
                </div>
                <HorizontalBarChart
                  data={analytics.cityData}
                  valueFormatter={value => String(value) + ' suppliers'}
                  color="#e67e22"
                />
              </section>
            </div>
          </>
        ) : (
          <>
            <div className="chart-grid">
              <section className="escon-chart-card">
                <div className="escon-section-head">
                  <h2>{trendLabel}</h2>
                  <span className="escon-badge">Last 6 months</span>
                </div>
                <LineChart
                  series={[{ label: analytics.role === 'customer' ? 'Spend' : 'Revenue', color: '#1a6fb5', data: analytics.monthlyRevenue }]}
                  height={170}
                  valueFormatter={value => formatCurrency(value)}
                />
              </section>
              <section className="escon-chart-card">
                <div className="escon-section-head">
                  <h2>Order status</h2>
                  <span className="escon-badge">{analytics.orderCount} orders</span>
                </div>
                <DonutChart
                  data={analytics.statuses}
                  size={150}
                  centerLabel={analytics.orderCount > 0 ? String(analytics.orderCount) : '0'}
                />
              </section>
            </div>

            <div className="chart-grid">
              <section className="escon-chart-card">
                <div className="escon-section-head">
                  <h2>Order volume</h2>
                  <span className="escon-badge">Last 6 months</span>
                </div>
                <LineChart
                  series={[{ label: 'Orders', color: '#8b5cf6', data: analytics.monthlyOrders }]}
                  height={170}
                  valueFormatter={value => String(value)}
                  showArea={false}
                />
              </section>
              <section className="escon-chart-card">
                <div className="escon-section-head">
                  <h2>{analytics.categoryBasis === 'revenue' ? 'Revenue by category' : 'Catalogue by category'}</h2>
                  <span className="escon-badge">{analytics.categoryBasis === 'revenue' ? 'Sales' : 'Products'}</span>
                </div>
                <HorizontalBarChart
                  data={analytics.categoryData}
                  valueFormatter={categoryFormatter}
                  color="#2ecc71"
                />
              </section>
            </div>

            <div className="chart-grid">
              <section className="escon-chart-card">
                <div className="escon-section-head">
                  <h2>{analytics.cityBasis === 'orders' ? 'Demand by city' : 'Supplier coverage'}</h2>
                  <span className="escon-badge">{analytics.cityBasis === 'orders' ? 'Order value' : 'Suppliers'}</span>
                </div>
                <HorizontalBarChart
                  data={analytics.cityData}
                  valueFormatter={value => analytics.cityBasis === 'orders' ? formatCurrency(value) : String(value)}
                  color="#e67e22"
                />
              </section>
              <section className="escon-chart-card">
                <div className="escon-section-head">
                  <h2>{analytics.role === 'customer' ? 'Spend composition' : 'Order value mix'}</h2>
                  <span className="escon-badge">{formatCurrency(analytics.gmv)}</span>
                </div>
                <DonutChart
                  data={costMix}
                  size={150}
                  centerLabel={formatCurrency(analytics.gmv)}
                />
              </section>
            </div>
          </>
        )}

        <section className="escon-section">
          <div className="escon-section-head">
            <h2>{isGuest ? 'Top rated products' : 'Top products'}</h2>
            {!isGuest ? (
              <button type="button" className="escon-link" onClick={() => onAskCopilot('What are my top-selling products?')}>
                Ask Copilot about products →
              </button>
            ) : (
              <span className="escon-badge">{guestData.topRated.length} featured</span>
            )}
          </div>
          {isGuest ? (
            guestData.topRated.length === 0 ? (
              <div className="escon-empty compact"><p>No products are listed yet.</p></div>
            ) : (
              <div className="escon-table-wrap">
                <table className="escon-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Supplier</th>
                      <th className="num">Price</th>
                      <th className="num">Rating</th>
                      <th className="num">Reviews</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guestData.topRated.map(({ material, rating, reviewCount }, index) => (
                      <tr key={material.id}>
                        <td className="escon-rank">{index + 1}</td>
                        <td>
                          <button type="button" className="escon-product-link" onClick={() => onOpenProduct(material)}>
                            {material.name}
                          </button>
                        </td>
                        <td>{material.category || 'Other'}</td>
                        <td>{companies.find(c => c.id === material.companyId)?.name || 'Supplier'}</td>
                        <td className="num strong">{formatCurrency(material.price)}</td>
                        <td className="num">⭐ {rating.toFixed(1)}</td>
                        <td className="num">{reviewCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : analytics.topProducts.length === 0 ? (
            <div className="escon-empty">
              <span>📊</span>
              <p>No product sales in this period yet. Place an order or switch to “All time”.</p>
              <button type="button" className="escon-btn ghost" onClick={onOpenMarketplace}>Browse the marketplace</button>
            </div>
          ) : (
            <div className="escon-table-wrap">
              <table className="escon-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Supplier</th>
                    <th className="num">Units</th>
                    <th className="num">Orders</th>
                    <th className="num">Revenue</th>
                    <th className="num">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topProducts.map((product, index) => {
                    const material = materials.find(m => m.id === product.id);
                    return (
                      <tr key={product.id}>
                        <td className="escon-rank">{index + 1}</td>
                        <td>
                          <button type="button" className="escon-product-link" onClick={() => material && onOpenProduct(material)} disabled={!material}>
                            {product.name}
                          </button>
                        </td>
                        <td>{product.category}</td>
                        <td>{product.supplierName}</td>
                        <td className="num">{product.units}</td>
                        <td className="num">{product.orders}</td>
                        <td className="num strong">{formatCurrency(product.revenue)}</td>
                        <td className="num">⭐ {product.rating.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {isGuest ? (
          <div className="analytics-two-col">
            <section className="escon-section">
              <div className="escon-section-head">
                <h2>Top rated suppliers</h2>
                <span className="escon-badge">{companies.length}</span>
              </div>
              <div className="escon-list">
                {guestData.suppliers.slice(0, 6).map((supplier, index) => (
                  <div key={supplier.id} className="escon-list-row">
                    <span className="escon-rank">{index + 1}</span>
                    <div className="escon-list-main">
                      <strong>{supplier.name}</strong>
                      <small>{supplier.city || '—'} · {supplier.productCount} products</small>
                    </div>
                    <div className="escon-list-figure">
                      <strong>⭐ {(supplier.rating || 0).toFixed(1)}</strong>
                      <small>{supplier.complianceStatus || 'pending'}</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="escon-section">
              <div className="escon-section-head">
                <h2>City coverage</h2>
                <span className="escon-badge">{guestData.cities.length} cities</span>
              </div>
              <div className="escon-list">
                {guestData.cities.slice(0, 6).map((city, index) => (
                  <div key={city.city} className="escon-list-row">
                    <span className="escon-rank">{index + 1}</span>
                    <div className="escon-list-main">
                      <strong>{city.city}</strong>
                      <small>{city.products} products listed</small>
                    </div>
                    <div className="escon-list-figure">
                      <strong>{city.suppliers}</strong>
                      <small>suppliers</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="analytics-two-col">
            <section className="escon-section">
              <div className="escon-section-head">
                <h2>Top suppliers</h2>
                <span className="escon-badge">{analytics.supplierCount}</span>
              </div>
              {analytics.topSuppliers.length === 0 ? (
                <div className="escon-empty compact"><p>No supplier orders in this period.</p></div>
              ) : (
                <div className="escon-list">
                  {analytics.topSuppliers.map((supplier, index) => (
                    <div key={supplier.id} className="escon-list-row">
                      <span className="escon-rank">{index + 1}</span>
                      <div className="escon-list-main">
                        <strong>{supplier.name}</strong>
                        <small>{supplier.city} · {supplier.products} products · ⭐ {supplier.rating.toFixed(1)}</small>
                      </div>
                      <div className="escon-list-figure">
                        <strong>{formatCurrency(supplier.revenue)}</strong>
                        <small>{supplier.orders} orders</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="escon-section">
              <div className="escon-section-head">
                <h2>{analytics.role === 'company' || analytics.role === 'admin' || analytics.role === 'transporter' ? 'Top customers' : 'Best suppliers to try'}</h2>
                <span className="escon-badge">{analytics.role === 'company' || analytics.role === 'admin' || analytics.role === 'transporter' ? analytics.customerCount : analytics.supplierCount}</span>
              </div>
              {analytics.role === 'company' || analytics.role === 'admin' || analytics.role === 'transporter' ? (
                analytics.topCustomers.length === 0 ? (
                  <div className="escon-empty compact"><p>No buyer activity in this period.</p></div>
                ) : (
                  <div className="escon-list">
                    {analytics.topCustomers.map((customer, index) => (
                      <div key={customer.id} className="escon-list-row">
                        <span className="escon-rank">{index + 1}</span>
                        <div className="escon-list-main">
                          <strong>{customer.name}</strong>
                          <small>{customer.city} · {customer.orders} orders</small>
                        </div>
                        <div className="escon-list-figure">
                          <strong>{formatCurrency(customer.spend)}</strong>
                          <small>lifetime</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="escon-list">
                  {[...companies]
                    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                    .slice(0, 5)
                    .map((supplier, index) => (
                      <div key={supplier.id} className="escon-list-row">
                        <span className="escon-rank">{index + 1}</span>
                        <div className="escon-list-main">
                          <strong>{supplier.name}</strong>
                          <small>{supplier.city || '—'} · {materials.filter(m => m.companyId === supplier.id).length} products</small>
                        </div>
                        <div className="escon-list-figure">
                          <strong>⭐ {(supplier.rating || 0).toFixed(1)}</strong>
                          <small>{supplier.complianceStatus || 'pending'}</small>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </div>
        )}

        {isGuest ? (
          <section className="escon-section">
            <div className="escon-section-head">
              <h2>Price guide by category</h2>
              <span className="escon-badge">{guestData.categoryPrices.length} categories</span>
            </div>
            <div className="escon-table-wrap">
              <table className="escon-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Products</th>
                    <th className="num">Lowest</th>
                    <th className="num">Average</th>
                    <th className="num">Highest</th>
                  </tr>
                </thead>
                <tbody>
                  {guestData.categoryPrices.map(category => (
                    <tr key={category.category}>
                      <td>{category.category}</td>
                      <td className="num">{category.products}</td>
                      <td className="num">{formatCurrency(category.min)}</td>
                      <td className="num strong">{formatCurrency(category.avg)}</td>
                      <td className="num">{formatCurrency(category.max)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="escon-section">
            <div className="escon-section-head">
              <h2>Price intelligence</h2>
              <button type="button" className="escon-link" onClick={() => onAskCopilot('Show price forecasts')}>
                Open Copilot forecast →
              </button>
            </div>
            {analytics.priceBoard.length === 0 ? (
              <div className="escon-empty compact"><p>No products to analyse yet.</p></div>
            ) : (
              <div className="price-board">
                {analytics.priceBoard.map(product => {
                  const forecast = product.forecast;
                  const tone = forecast ? forecast.trend : 'flat';
                  return (
                    <div key={product.id} className="price-card">
                      <div className="price-card-top">
                        <div>
                          <strong>{product.name}</strong>
                          <small>{product.category}</small>
                        </div>
                        <Sparkline points={product.history} width={86} height={32} />
                      </div>
                      <div className="price-card-price">{formatCurrency(product.price)}</div>
                      <div className="price-card-foot">
                        <span className={'price-trend ' + tone}>
                          {forecast
                            ? `${tone === 'up' ? '▲' : tone === 'down' ? '▼' : '■'} ${Math.abs(forecast.changePct).toFixed(1)}%`
                            : 'Tracking'}
                        </span>
                        {product.marginPct > 0 && <span className="price-margin">{product.marginPct.toFixed(0)}% margin</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {(analytics.role === 'company' || analytics.role === 'admin') && criticalStock.length > 0 && (
          <section className="escon-section">
            <div className="escon-section-head">
              <h2>Restock advisory</h2>
              <span className="escon-badge warn">{criticalStock.length} at risk</span>
            </div>
            <div className="restock-grid">
              {criticalStock.map(material => (
                <div key={material.id} className={'restock-card' + ((material.quantity || 0) <= 0 ? ' out' : '')}>
                  <span className="restock-icon">{(material.quantity || 0) <= 0 ? '🚫' : '⚠️'}</span>
                  <div>
                    <strong>{material.name}</strong>
                    <small>{material.quantity || 0} {material.unit || 'units'} left · {formatCurrency((material.quantity || 0) * material.price)}</small>
                  </div>
                  <button type="button" className="escon-link" onClick={() => onOpenProduct(material)}>View</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {isGuest ? (
          <section className="escon-ask">
            <div>
              <h2>Want your own numbers?</h2>
              <p>Sign in to unlock order history, spending trends, delivery costs and role-scoped forecasts.</p>
            </div>
            <div className="escon-ask-actions">
              <button type="button" className="escon-btn" onClick={onOpenMarketplace}>Browse the marketplace</button>
              <button type="button" className="escon-btn ghost" onClick={onOpenSupplierMap}>Find suppliers on the map</button>
            </div>
          </section>
        ) : (
          <section className="escon-ask">
            <div>
              <h2>Turn these numbers into decisions</h2>
              <p>Copilot reads the same live records and answers in plain language.</p>
            </div>
            <div className="escon-ask-actions">
              <button type="button" className="escon-btn" onClick={() => onAskCopilot('Give me an executive summary')}>Executive summary</button>
              <button type="button" className="escon-btn ghost" onClick={() => onAskCopilot('What should I improve next?')}>What should I improve?</button>
              <button type="button" className="escon-btn ghost" onClick={() => onAskCopilot('Show price forecasts')}>Price forecast</button>
            </div>
          </section>
        )}

        <footer className="escon-sheet-foot">
          <span>E-SCON · Ethio-Supply Chain Optimization Network</span>
          <span>{analytics.role === 'guest' ? 'Public catalogue data' : 'Private to this account'} · Generated on this device</span>
        </footer>
      </div>
    </main>
  );
};

export default AnalyticsPage;
