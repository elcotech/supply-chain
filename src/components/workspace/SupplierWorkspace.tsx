// ===== Suppliers — Business Management (spec §3) =====
//
// Eighteen supplier submenus covering identity and verification, warehouses,
// catalogue, inventory movements, pricing, RFQs, quotations, orders, invoices,
// customers, delivery coordination, analytics, AI guidance, messages,
// performance and international enquiries.
//
// Everything mutates through App.tsx so the existing cloud sync, notifications
// and order rules stay authoritative.

import React, { useMemo, useState } from 'react';
import { Material, Order, Quotation, Rfq, User } from '../../types';
import {
  formatCurrency, formatDate, genId, timeAgo, effectiveRating, forecastPrice,
} from '../../utils';
import { buildAnalytics } from '../../lib/analytics';
import { useLanguage } from '../../lib/i18n';
import { jobStatus, TRANSPORT_STATUS_LABELS } from '../../lib/transport';
import useLocalCollection from '../../hooks/useLocalCollection';
import WorkspaceShell from './shell';
import { WorkspaceProps } from './types';
import {
  BarList, Column, DataTable, EmptyState, Field, Kpi, KpiGrid, Modal, Panel,
  SectionHeader, StatusPill, toneFor,
} from './ui';

interface Warehouse {
  id: string;
  name: string;
  address: string;
  city: string;
  hours: string;
  coverage: string;
}

interface StockMovement {
  id: string;
  materialId: string;
  materialName: string;
  delta: number;
  reason: string;
  at: number;
}

interface InternationalProfile {
  markets: string;
  incoterms: string;
  documents: string;
  notes: string;
}

const SupplierWorkspace: React.FC<WorkspaceProps> = props => {
  const {
    user, users, companies, materials, orders, reviews, notifications, settings,
    rfqs, setRfqs, quotations, setQuotations, section, onSection, onNotify,
    onNavigate, onUpdateOrderStatus, onUpdateMaterial,
    onEditMaterial, onAddProduct, onEditCompany, onOpenMap,
    onSendMessage, logEvent, transporterProfiles,
  } = props;
  const { t } = useLanguage();

  const company = companies.find(c => c.userId === user.id);
  const ownMaterials = useMemo(
    () => (company ? materials.filter(m => m.companyId === company.id) : []),
    [materials, company]
  );
  const ownOrders = useMemo(
    () => (company ? orders.filter(o => o.companyId === company.id) : []),
    [orders, company]
  );
  const analytics = useMemo(
    () => buildAnalytics({ user, materials, companies, orders, users, reviews, settings, days: 30 }),
    [user, materials, companies, orders, users, reviews, settings]
  );

  const [warehouses, setWarehouses] = useLocalCollection<Warehouse[]>(
    `warehouses_${user.id}`,
    []
  );
  const [movements, setMovements] = useLocalCollection<StockMovement[]>(
    `stock_movements_${user.id}`,
    []
  );
  const [intl, setIntl] = useLocalCollection<InternationalProfile>(
    `intl_${user.id}`,
    { markets: '', incoterms: 'FOB', documents: '', notes: '' }
  );

  const money = (value: number) => formatCurrency(Math.round(value * 100) / 100);
  const companyRating = company ? effectiveRating(company.rating, reviews.filter(r => {
    const material = materials.find(m => m.id === r.materialId);
    return material?.companyId === company.id;
  })) : 0;

  const revenue = ownOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.totalAmount, 0);
  const pipeline = ownOrders.filter(o => o.status === 'pending' || o.status === 'confirmed').reduce((s, o) => s + o.totalAmount, 0);
  const lowStock = ownMaterials.filter(m => m.quantity <= 10);
  const stockValue = ownMaterials.reduce((s, m) => s + m.price * m.quantity, 0);

  // RFQs this supplier is allowed to quote on (no target list = open to all).
  const visibleRfqs = useMemo(
    () => rfqs.filter(rfq => !company || rfq.supplierIds.length === 0 || rfq.supplierIds.includes(company.id)),
    [rfqs, company]
  );
  const ownQuotations = useMemo(
    () => quotations.filter(q => company && q.supplierId === company.id),
    [quotations, company]
  );

  const buyerFor = (id: string) => users.find(u => u.id === id);
  const materialFor = (id: string) => materials.find(m => m.id === id);

  // ---------- Modals ----------
  const [priceTarget, setPriceTarget] = useState<Material | null>(null);
  const [priceDraft, setPriceDraft] = useState({ price: '', minOrder: '' });
  const [stockTarget, setStockTarget] = useState<Material | null>(null);
  const [stockDraft, setStockDraft] = useState({ delta: '0', reason: 'Restock' });
  const [rfqTarget, setRfqTarget] = useState<Rfq | null>(null);
  const [quoteDraft, setQuoteDraft] = useState({ unitPrice: '', deliveryFee: '0', validUntil: '', notes: '' });
  const [invoiceTarget, setInvoiceTarget] = useState<Order | null>(null);
  const [warehouseDraft, setWarehouseDraft] = useState<Warehouse>({ id: '', name: '', address: '', city: '', hours: '', coverage: '' });
  const [messageDraft, setMessageDraft] = useState({ to: '', title: '', body: '' });

  const openPrice = (material: Material) => {
    setPriceTarget(material);
    setPriceDraft({ price: String(material.price), minOrder: String(material.minOrder) });
  };

  const savePrice = () => {
    if (!priceTarget) return;
    const price = Math.max(0, parseFloat(priceDraft.price) || 0);
    const minOrder = Math.max(1, parseInt(priceDraft.minOrder, 10) || 1);
    onUpdateMaterial({
      ...priceTarget,
      price,
      minOrder,
      lastUpdated: new Date().toISOString(),
      priceHistory: [...(priceTarget.priceHistory || []), { date: Date.now(), price }].slice(-24),
    });
    logEvent('price.update', `${priceTarget.name} → ${price}`);
    onNotify('Price updated', 'success');
    setPriceTarget(null);
  };

  const saveStock = () => {
    if (!stockTarget) return;
    const delta = parseInt(stockDraft.delta, 10) || 0;
    const next = Math.max(0, stockTarget.quantity + delta);
    onUpdateMaterial({ ...stockTarget, quantity: next, lastUpdated: new Date().toISOString() });
    setMovements(prev => [
      { id: genId('mv'), materialId: stockTarget.id, materialName: stockTarget.name, delta, reason: stockDraft.reason, at: Date.now() },
      ...prev,
    ].slice(0, 200));
    logEvent('stock.adjust', `${stockTarget.name}: ${delta > 0 ? '+' : ''}${delta}`);
    onNotify(`Stock updated to ${next} ${stockTarget.unit}`, 'success');
    setStockTarget(null);
    setStockDraft({ delta: '0', reason: 'Restock' });
  };

  const openQuote = (rfq: Rfq) => {
    const material = rfq.materialId ? materialFor(rfq.materialId) : undefined;
    setRfqTarget(rfq);
    setQuoteDraft({
      unitPrice: material ? String(material.price) : '',
      deliveryFee: '0',
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      notes: '',
    });
  };

  const submitQuote = () => {
    if (!rfqTarget || !company) return;
    const unitPrice = parseFloat(quoteDraft.unitPrice);
    if (!isFinite(unitPrice) || unitPrice <= 0) {
      onNotify('Enter a valid unit price.', 'warning');
      return;
    }
    const quote: Quotation = {
      id: genId('quote'),
      rfqId: rfqTarget.id,
      supplierId: company.id,
      supplierName: company.name,
      unitPrice,
      quantity: rfqTarget.quantity,
      deliveryFee: Math.max(0, parseFloat(quoteDraft.deliveryFee) || 0),
      validUntil: quoteDraft.validUntil || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      notes: quoteDraft.notes.trim(),
      status: 'submitted',
      createdAt: Date.now(),
    };
    // Replace an earlier quote from this supplier for the same RFQ.
    setQuotations(prev => [
      quote,
      ...prev.filter(q => !(q.rfqId === rfqTarget.id && q.supplierId === company.id)),
    ]);
    setRfqs(prev => prev.map(item => (item.id === rfqTarget.id ? { ...item, status: item.status === 'open' ? 'quoted' : item.status } : item)));
    onSendMessage(rfqTarget.customerId, 'New quotation received', `${company.name} quoted ${money(unitPrice)} / ${rfqTarget.unit} for ${rfqTarget.materialName}.`);
    logEvent('quotation.submit', `${rfqTarget.materialName} → ${money(unitPrice)}`);
    onNotify('Quotation submitted', 'success');
    setRfqTarget(null);
  };

  const saveWarehouse = () => {
    if (!warehouseDraft.name.trim()) {
      onNotify('Warehouse name is required.', 'warning');
      return;
    }
    const record: Warehouse = { ...warehouseDraft, id: warehouseDraft.id || genId('wh') };
    setWarehouses(prev => (prev.some(w => w.id === record.id)
      ? prev.map(w => (w.id === record.id ? record : w))
      : [...prev, record]));
    logEvent('warehouse.save', record.name);
    onNotify('Warehouse saved', 'success');
    setWarehouseDraft({ id: '', name: '', address: '', city: '', hours: '', coverage: '' });
  };

  const sendMessage = () => {
    if (!messageDraft.to || !messageDraft.title.trim() || !messageDraft.body.trim()) {
      onNotify('Choose a recipient and write a subject and message.', 'warning');
      return;
    }
    onSendMessage(messageDraft.to, messageDraft.title.trim(), messageDraft.body.trim());
    onNotify('Message sent', 'success');
    setMessageDraft({ to: '', title: '', body: '' });
  };

  if (!company) {
    return (
      <WorkspaceShell menu="supplier" section={section} onSection={onSection}>
        <SectionHeader eyebrow={t('Suppliers')} title={t('Business Profile')} hint="Your supplier profile is missing." />
        <Panel>
          <EmptyState
            icon="🏢"
            title="Create your business profile"
            text="A supplier profile stores your company name, licence, location and warehouse coverage. Buyers see it in the directory."
            action={<button className="btn btn-primary" onClick={onEditCompany}>Create profile</button>}
          />
        </Panel>
      </WorkspaceShell>
    );
  }

  // ---------- Column builders ----------
  const materialColumns: Column<Material>[] = [
    {
      key: 'name', header: 'Product', value: m => m.name,
      render: m => (
        <div className="ws-cell-stack">
          <strong>{m.name}</strong>
          <small>{m.category} · {m.brand || m.specifications?.grade || '—'}</small>
        </div>
      ),
    },
    { key: 'price', header: 'Price', align: 'right', value: m => Math.round(m.price), render: m => <>{money(m.price)} <small>/{m.unit}</small></> },
    { key: 'quantity', header: 'Stock', align: 'right', value: m => m.quantity, render: m => <span className={m.quantity <= 10 ? 'ws-low' : ''}>{m.quantity.toLocaleString()} {m.unit}</span> },
    { key: 'minOrder', header: 'Min order', align: 'right', value: m => m.minOrder, render: m => `${m.minOrder} ${m.unit}` },
    { key: 'rating', header: 'Rating', align: 'right', value: m => effectiveRating(m.rating, reviews.filter(r => r.materialId === m.id)) },
    { key: 'lastUpdated', header: 'Updated', value: m => m.lastUpdated, render: m => <span className="ws-nowrap">{formatDate(m.lastUpdated)}</span> },
    {
      key: 'actions', header: 'Actions', align: 'right', noExport: true,
      render: m => (
        <div className="ws-row-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => openPrice(m)}>💵</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setStockTarget(m); setStockDraft({ delta: '0', reason: 'Restock' }); }}>🏭</button>
          <button className="btn btn-secondary btn-sm" onClick={() => onEditMaterial(m)}>{t('Edit')}</button>
        </div>
      ),
    },
  ];

  const orderColumns: Column<Order>[] = [
    { key: 'invoiceNumber', header: 'Order', value: o => o.invoiceNumber, render: o => <div className="ws-cell-stack"><strong>{o.invoiceNumber}</strong><small>{formatDate(o.orderDate)}</small></div> },
    { key: 'buyer', header: 'Buyer', value: o => buyerFor(o.customerId)?.name || '—', render: o => <div className="ws-cell-stack"><span>{buyerFor(o.customerId)?.name || '—'}</span><small>{o.address}</small></div> },
    { key: 'material', header: 'Material', value: o => materialFor(o.materialId)?.name || '—', render: o => <div className="ws-cell-stack"><span>{materialFor(o.materialId)?.name || '—'}</span><small>{o.quantity} {materialFor(o.materialId)?.unit || ''}</small></div> },
    { key: 'totalAmount', header: 'Total', align: 'right', value: o => Math.round(o.totalAmount), render: o => <strong>{money(o.totalAmount)}</strong> },
    { key: 'paymentStatus', header: 'Payment', value: o => o.paymentStatus, render: o => <StatusPill label={t(o.paymentStatus)} tone={toneFor(o.paymentStatus)} /> },
    { key: 'status', header: 'Status', value: o => o.status, render: o => <StatusPill label={t(o.status)} tone={toneFor(o.status)} /> },
    {
      key: 'actions', header: 'Actions', align: 'right', noExport: true,
      render: o => (
        <div className="ws-row-actions">
          {o.status === 'pending' && <button className="btn btn-primary btn-sm" onClick={() => onUpdateOrderStatus(o.id, 'confirmed')}>{t('Approve')}</button>}
          {o.status === 'confirmed' && <button className="btn btn-secondary btn-sm" onClick={() => onUpdateOrderStatus(o.id, 'shipped')}>🚚 {t('Dispatch')}</button>}
          {o.status === 'shipped' && <button className="btn btn-secondary btn-sm" onClick={() => onUpdateOrderStatus(o.id, 'delivered')}>✅ {t('Delivered')}</button>}
          {(o.status === 'pending') && <button className="btn btn-secondary btn-sm" onClick={() => onUpdateOrderStatus(o.id, 'cancelled')}>{t('Reject')}</button>}
          <button className="btn btn-secondary btn-sm" onClick={() => setInvoiceTarget(o)}>🧾</button>
        </div>
      ),
    },
  ];

  // ---------- Sections ----------
  const renderDashboard = () => (
    <>
      <SectionHeader
        eyebrow={t('Suppliers')}
        title={company.name}
        hint={t('View total products, available stock, pending orders, new RFQs, sales, quotations, revenue and customer activity.')}
        actions={<><button className="btn btn-secondary btn-sm" onClick={onEditCompany}>🏢 {t('Business Profile')}</button><button className="btn btn-primary btn-sm" onClick={onAddProduct}>➕ {t('Add product')}</button></>}
      />
      <KpiGrid>
        <Kpi label={t('Total products')} value={ownMaterials.length} hint={`${new Set(ownMaterials.map(m => m.category)).size} categories`} icon="📦" />
        <Kpi label={t('Stock')} value={ownMaterials.reduce((s, m) => s + m.quantity, 0).toLocaleString()} hint={`Value ${money(stockValue)}`} icon="🏭" />
        <Kpi label={t('Pending orders')} value={ownOrders.filter(o => o.status === 'pending').length} hint={money(pipeline) + ' in pipeline'} icon="🕒" tone={ownOrders.some(o => o.status === 'pending') ? 'warn' : 'good'} />
        <Kpi label="New RFQs" value={visibleRfqs.filter(r => r.status === 'open').length} hint={`${ownQuotations.length} quotations sent`} icon="📨" />
        <Kpi label={t('Sales')} value={ownOrders.filter(o => o.status !== 'cancelled').length} hint="Orders received" icon="🛒" />
        <Kpi label={t('Revenue')} value={money(revenue)} hint="Delivered orders" icon="💰" tone="accent" />
        <Kpi label={t('Low-stock items')} value={lowStock.length} icon="⚠️" tone={lowStock.length ? 'warn' : 'good'} />
        <Kpi label={t('Average rating')} value={`⭐ ${companyRating.toFixed(1)}`} hint={`${reviews.filter(r => ownMaterials.some(m => m.id === r.materialId)).length} reviews`} icon="⭐" />
      </KpiGrid>
      <div className="ws-grid-2">
        <Panel title={t('Revenue trend')} subtitle="Last six months"><BarList items={analytics.monthlyRevenue.map(p => ({ label: p.label, value: p.value }))} format={money} /></Panel>
        <Panel title={t('Top products')} subtitle="By revenue in the last 30 days"><BarList items={analytics.topProducts.slice(0, 6).map(p => ({ label: p.name, value: Math.round(p.revenue), hint: `${p.units} units` }))} format={money} /></Panel>
      </div>
      <Panel title={t('Recent activity')} subtitle="Newest orders and enquiries">
        {ownOrders.length === 0 ? <EmptyState icon="📦" title="No orders yet" text="Publish products and respond to RFQs to start selling." /> : (
          <ul className="ws-feed">
            {[...ownOrders].reverse().slice(0, 6).map(o => (
              <li key={o.id}>
                <span className="ws-feed-icon">📦</span>
                <div><strong>{o.invoiceNumber} · {money(o.totalAmount)}</strong><small>{buyerFor(o.customerId)?.name || 'Customer'} · {materialFor(o.materialId)?.name || ''}</small></div>
                <StatusPill label={t(o.status)} tone={toneFor(o.status)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {lowStock.length > 0 && (
        <Panel title={t('Low stock')} subtitle="At or below ten units remaining">
          <ul className="ws-alert-list">
            {lowStock.map(m => (
              <li key={m.id}>
                <span>⚠️</span>
                <div><strong>{m.name}</strong><small>{m.quantity} {m.unit} left · {money(m.price)}/{m.unit}</small></div>
                <button className="btn btn-secondary btn-sm" onClick={() => { setStockTarget(m); setStockDraft({ delta: '0', reason: 'Restock' }); }}>Restock</button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );

  const renderProfile = () => (
    <>
      <SectionHeader
        eyebrow={t('Suppliers')}
        title={t('Business Profile')}
        hint={t('Enter company name, registration details, business licence, contact information, business type and company description.')}
        actions={<button className="btn btn-primary btn-sm" onClick={onEditCompany}>{t('Edit')}</button>}
      />
      <div className="ws-grid-2">
        <Panel title={company.name} subtitle={company.description || 'No description yet'}>
          <ul className="ws-detail-list">
            <li><span>{t('Address')}</span><strong>{company.location || '—'}, {company.city}</strong></li>
            <li><span>{t('Phone')}</span><strong>{company.phone || user.phone || '—'}</strong></li>
            <li><span>{t('Email')}</span><strong>{company.email || user.email}</strong></li>
            <li><span>Website</span><strong>{company.website || '—'}</strong></li>
            <li><span>{t('Working hours')}</span><strong>{company.workingHours || '—'}</strong></li>
            <li><span>Established</span><strong>{company.established || '—'}</strong></li>
          </ul>
        </Panel>
        <Panel title="Registration & compliance" subtitle="Used for verification and invoices">
          <ul className="ws-detail-list">
            <li><span>TIN</span><strong>{company.tinNumber || '—'}</strong></li>
            <li><span>Business licence</span><strong>{company.businessLicense || '—'}</strong></li>
            <li><span>VAT number</span><strong>{company.vatNumber || 'Not registered'}</strong></li>
            <li><span>Licence expiry</span><strong>{company.tradeLicenseExpiry ? formatDate(company.tradeLicenseExpiry) : '—'}</strong></li>
            <li><span>{t('Compliance')}</span><strong><StatusPill label={t(company.complianceStatus)} tone={toneFor(company.complianceStatus)} /></strong></li>
            <li><span>{t('Rating')}</span><strong>⭐ {companyRating.toFixed(1)} · {company.totalOrders} orders</strong></li>
          </ul>
          <button className="btn btn-secondary btn-sm" onClick={() => onOpenMap(company.id)}>🗺️ {t('Supplier Map')}</button>
        </Panel>
      </div>
    </>
  );

  const renderVerification = () => {
    const checks = [
      { label: 'Company name', done: Boolean(company.name) },
      { label: 'Business description', done: company.description.length > 20 },
      { label: 'TIN number', done: Boolean(company.tinNumber) },
      { label: 'Business licence', done: Boolean(company.businessLicense) },
      { label: 'Licence expiry date', done: Boolean(company.tradeLicenseExpiry) },
      { label: 'Warehouse address', done: Boolean(company.location) },
      { label: 'GPS coordinates', done: Boolean(company.lat && company.lng) },
      { label: 'Contact phone', done: Boolean(company.phone || user.phone) },
      { label: 'VAT registration', done: Boolean(company.vatNumber) || !user.vatRegistered },
    ];
    const complete = checks.filter(c => c.done).length;
    return (
      <>
        <SectionHeader
          eyebrow={t('Suppliers')}
          title={t('Verification Centre')}
          hint={t('Upload business licences, tax documents and required certificates. Track verification status and respond to administrator requests.')}
          actions={<button className="btn btn-primary btn-sm" onClick={onEditCompany}>{t('Upload')} / {t('Edit')}</button>}
        />
        <KpiGrid>
          <Kpi label="Verification status" value={t(company.complianceStatus)} icon="🛡️" tone={company.complianceStatus === 'compliant' ? 'good' : 'warn'} />
          <Kpi label="Checklist" value={`${complete}/${checks.length}`} hint="Documents and details" icon="📋" />
          <Kpi label="Products listed" value={ownMaterials.length} icon="📦" />
          <Kpi label="Admin requests" value={company.complianceStatus === 'non-compliant' ? 1 : 0} icon="📨" tone={company.complianceStatus === 'non-compliant' ? 'bad' : 'good'} />
        </KpiGrid>
        <Panel title="Verification checklist" subtitle="Every item is required before a supplier is marked compliant">
          <ul className="ws-checklist">
            {checks.map(check => (
              <li key={check.label} className={check.done ? 'done' : ''}>
                <span aria-hidden="true">{check.done ? '✅' : '⬜'}</span>
                {check.label}
              </li>
            ))}
          </ul>
          {company.complianceStatus !== 'compliant' && (
            <p className="ws-note">
              Complete every item, then use <strong>{t('Edit')}</strong> to save your business details. Administration reviews the profile before marking it compliant.
            </p>
          )}
        </Panel>
        <Panel title="Documents on file" subtitle="Reference numbers shown to buyers on quotations and invoices">
          <ul className="ws-detail-list">
            <li><span>Business licence</span><strong>{company.businessLicense || 'Not provided'}</strong></li>
            <li><span>TIN certificate</span><strong>{company.tinNumber || 'Not provided'}</strong></li>
            <li><span>VAT certificate</span><strong>{company.vatNumber || 'Not registered'}</strong></li>
            <li><span>Trade licence expiry</span><strong>{company.tradeLicenseExpiry ? formatDate(company.tradeLicenseExpiry) : 'Not provided'}</strong></li>
          </ul>
        </Panel>
      </>
    );
  };

  const renderLocations = () => (
    <>
      <SectionHeader
        eyebrow={t('Suppliers')}
        title={t('Location & Warehouse')}
        hint={t('Register warehouse locations using GPS. Add warehouse addresses, service areas, operating hours and available delivery coverage.')}
        actions={<button className="btn btn-secondary btn-sm" onClick={() => onOpenMap(company.id)}>🗺️ {t('Supplier Map')}</button>}
      />
      <div className="ws-grid-2">
        <Panel title="Primary location" subtitle="Used to measure delivery distance to buyers">
          <ul className="ws-detail-list">
            <li><span>{t('Address')}</span><strong>{company.location || '—'}</strong></li>
            <li><span>{t('City')}</span><strong>{company.city || '—'}</strong></li>
            <li><span>GPS</span><strong>{company.lat.toFixed(4)}, {company.lng.toFixed(4)}</strong></li>
            <li><span>{t('Working hours')}</span><strong>{company.workingHours || '—'}</strong></li>
          </ul>
          <button className="btn btn-secondary btn-sm" onClick={onEditCompany}>{t('Edit')} location</button>
        </Panel>
        <Panel title="Add a warehouse" subtitle="Multiple warehouses are supported">
          <div className="ws-form">
            <Field label={t('Name')} required>
              <input value={warehouseDraft.name} onChange={e => setWarehouseDraft(prev => ({ ...prev, name: e.target.value }))} placeholder="Kality depot" />
            </Field>
            <Field label={t('Address')}>
              <input value={warehouseDraft.address} onChange={e => setWarehouseDraft(prev => ({ ...prev, address: e.target.value }))} />
            </Field>
            <div className="ws-form-row">
              <Field label={t('City')}>
                <input value={warehouseDraft.city} onChange={e => setWarehouseDraft(prev => ({ ...prev, city: e.target.value }))} />
              </Field>
              <Field label={t('Working hours')}>
                <input value={warehouseDraft.hours} onChange={e => setWarehouseDraft(prev => ({ ...prev, hours: e.target.value }))} placeholder="Mon–Sat 08:00–18:00" />
              </Field>
            </div>
            <Field label="Delivery coverage" hint="Cities or zones served from this warehouse.">
              <input value={warehouseDraft.coverage} onChange={e => setWarehouseDraft(prev => ({ ...prev, coverage: e.target.value }))} placeholder="Addis Ababa, Adama" />
            </Field>
            <button className="btn btn-primary" onClick={saveWarehouse}>➕ {t('Save')}</button>
          </div>
        </Panel>
      </div>
      <Panel title="Warehouses" subtitle={`${warehouses.length} registered`}>
        {warehouses.length === 0 ? (
          <EmptyState icon="🏭" title="No extra warehouses" text="Add a second warehouse above to list it here." />
        ) : (
          <div className="table-scroll-container">
            <table className="data-table ws-table">
              <thead><tr><th>{t('Name')}</th><th>{t('Address')}</th><th>{t('City')}</th><th>{t('Working hours')}</th><th>Coverage</th><th /></tr></thead>
              <tbody>
                {warehouses.map(warehouse => (
                  <tr key={warehouse.id}>
                    <td><strong>{warehouse.name}</strong></td>
                    <td>{warehouse.address || '—'}</td>
                    <td>{warehouse.city || '—'}</td>
                    <td>{warehouse.hours || '—'}</td>
                    <td>{warehouse.coverage || '—'}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => { setWarehouseDraft(warehouse); }}>{t('Edit')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );

  const renderProducts = () => (
    <>
      <SectionHeader
        eyebrow={t('Suppliers')}
        title={t('Product Management')}
        hint={t('Add, edit, update and remove products. Include product name, category, grade, specifications, images, unit, description and availability.')}
        actions={<button className="btn btn-primary btn-sm" onClick={onAddProduct}>➕ {t('Add product')}</button>}
      />
      <KpiGrid>
        <Kpi label={t('Products')} value={ownMaterials.length} icon="📦" />
        <Kpi label="Catalogue value" value={money(stockValue)} icon="💰" tone="accent" />
        <Kpi label={t('Low stock')} value={lowStock.length} icon="⚠️" tone={lowStock.length ? 'warn' : 'good'} />
        <Kpi label="Average price" value={money(ownMaterials.reduce((s, m) => s + m.price, 0) / (ownMaterials.length || 1))} icon="💵" />
      </KpiGrid>
      <Panel>
        <DataTable rows={ownMaterials} columns={materialColumns} searchText={m => `${m.name} ${m.category} ${m.brand || ''}`} exportName="my_products" emptyTitle="No products yet" emptyText="Add your first product to appear in the marketplace." />
      </Panel>
    </>
  );

  const renderInventory = () => (
    <>
      <SectionHeader
        eyebrow={t('Suppliers')}
        title={t('Inventory Management')}
        hint={t('Update available stock, reserved stock, minimum stock levels, warehouse quantities and stock movements. Receive low-stock alerts.')}
      />
      <KpiGrid>
        <Kpi label="Units in stock" value={ownMaterials.reduce((s, m) => s + m.quantity, 0).toLocaleString()} icon="🏭" />
        <Kpi label={t('Stock value')} value={money(stockValue)} icon="💰" tone="accent" />
        <Kpi label={t('Low stock')} value={lowStock.length} icon="⚠️" tone={lowStock.length ? 'warn' : 'good'} />
        <Kpi label="Movements" value={movements.length} icon="🔄" />
      </KpiGrid>
      <Panel title="Stock levels" subtitle="Use 🏭 on a row to record a movement">
        <DataTable
          rows={ownMaterials}
          columns={[
            { key: 'name', header: 'Product', value: m => m.name },
            { key: 'category', header: 'Category', value: m => m.category },
            { key: 'quantity', header: 'Available', align: 'right', value: m => m.quantity, render: m => <span className={m.quantity <= 10 ? 'ws-low' : ''}>{m.quantity.toLocaleString()} {m.unit}</span> },
            { key: 'reserved', header: 'Reserved', align: 'right', value: m => orders.filter(o => o.materialId === m.id && (o.status === 'confirmed')).reduce((s, o) => s + o.quantity, 0) },
            { key: 'value', header: 'Value', align: 'right', value: m => Math.round(m.price * m.quantity), render: m => money(m.price * m.quantity) },
            {
              key: 'actions', header: 'Actions', align: 'right', noExport: true,
              render: m => <button className="btn btn-secondary btn-sm" onClick={() => { setStockTarget(m); setStockDraft({ delta: '0', reason: 'Restock' }); }}>🏭 Adjust</button>,
            },
          ]}
          searchText={m => `${m.name} ${m.category}`}
          exportName="inventory"
        />
      </Panel>
      <Panel title="Stock movements" subtitle="Device-local movement ledger for this business">
        {movements.length === 0 ? <EmptyState icon="🔄" title="No movements recorded" /> : (
          <div className="table-scroll-container">
            <table className="data-table ws-table">
              <thead><tr><th>{t('Date')}</th><th>{t('Product')}</th><th>Change</th><th>Reason</th></tr></thead>
              <tbody>
                {movements.slice(0, 30).map(movement => (
                  <tr key={movement.id}>
                    <td className="ws-nowrap">{new Date(movement.at).toLocaleString('en-GB')}</td>
                    <td>{movement.materialName}</td>
                    <td className={movement.delta >= 0 ? 'ws-positive' : 'ws-negative'}>{movement.delta >= 0 ? '+' : ''}{movement.delta}</td>
                    <td>{movement.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );

  const renderPrices = () => (
    <>
      <SectionHeader
        eyebrow={t('Suppliers')}
        title={t('Price Management')}
        hint={t('Set product prices, unit prices, bulk discounts, minimum order quantities and price validity dates. Maintain price history.')}
      />
      <KpiGrid>
        <Kpi label="Average price" value={money(ownMaterials.reduce((s, m) => s + m.price, 0) / (ownMaterials.length || 1))} icon="💵" />
        <Kpi label="Price snapshots" value={ownMaterials.reduce((s, m) => s + (m.priceHistory?.length || 0), 0)} icon="🗂️" />
        <Kpi label="Forecast rising" value={ownMaterials.filter(m => (forecastPrice(m.priceHistory, m.price)?.trend || 'flat') === 'up').length} icon="📈" tone="warn" />
        <Kpi label="Forecast falling" value={ownMaterials.filter(m => (forecastPrice(m.priceHistory, m.price)?.trend || 'flat') === 'down').length} icon="📉" tone="good" />
      </KpiGrid>
      <Panel title="Price list" subtitle="Saving a price appends a snapshot to the forecast history">
        <DataTable
          rows={ownMaterials}
          columns={[
            { key: 'name', header: 'Product', value: m => m.name },
            { key: 'price', header: 'Unit price', align: 'right', value: m => Math.round(m.price), render: m => <>{money(m.price)} <small>/{m.unit}</small></> },
            { key: 'minOrder', header: 'Min order', align: 'right', value: m => m.minOrder, render: m => `${m.minOrder} ${m.unit}` },
            {
              key: 'forecast', header: 'Forecast', align: 'right',
              value: m => forecastPrice(m.priceHistory, m.price)?.next || m.price,
              render: m => {
                const forecast = forecastPrice(m.priceHistory, m.price);
                if (!forecast) return <span className="ws-muted">No history</span>;
                return <StatusPill label={`${forecast.trend === 'up' ? '▲' : forecast.trend === 'down' ? '▼' : '■'} ${money(forecast.next)}`} tone={forecast.trend === 'up' ? 'warn' : forecast.trend === 'down' ? 'good' : 'muted'} />;
              },
            },
            { key: 'updated', header: 'Updated', value: m => m.lastUpdated, render: m => <span className="ws-nowrap">{formatDate(m.lastUpdated)}</span> },
            {
              key: 'actions', header: 'Actions', align: 'right', noExport: true,
              render: m => <button className="btn btn-primary btn-sm" onClick={() => openPrice(m)}>{t('Edit')} price</button>,
            },
          ]}
          searchText={m => `${m.name} ${m.category}`}
          exportName="price_list"
        />
      </Panel>
    </>
  );

  const renderRfqs = () => {
    const columns: Column<Rfq>[] = [
      { key: 'materialName', header: 'Material', value: r => r.materialName, render: r => <div className="ws-cell-stack"><strong>{r.materialName}</strong><small>{r.quantity} {r.unit} · {r.category}</small></div> },
      { key: 'customerName', header: 'Buyer', value: r => r.customerName },
      { key: 'city', header: 'Delivery site', value: r => `${r.siteAddress}, ${r.city}` },
      { key: 'requiredBy', header: 'Required by', value: r => r.requiredBy, render: r => <span className="ws-nowrap">{formatDate(r.requiredBy)}</span> },
      { key: 'status', header: 'Status', value: r => r.status, render: r => <StatusPill label={t(r.status)} tone={toneFor(r.status)} /> },
      {
        key: 'quoted', header: 'My quote', value: r => ownQuotations.find(q => q.rfqId === r.id)?.unitPrice || 0,
        render: r => {
          const quote = ownQuotations.find(q => q.rfqId === r.id);
          return quote ? money(quote.unitPrice) : <span className="ws-muted">—</span>;
        },
      },
      {
        key: 'actions', header: 'Actions', align: 'right', noExport: true,
        render: r => (
          <button className="btn btn-primary btn-sm" onClick={() => openQuote(r)} disabled={r.status === 'closed' || r.status === 'cancelled'}>
            {t('Submit quotation')}
          </button>
        ),
      },
    ];
    return (
      <>
        <SectionHeader
          eyebrow={t('Suppliers')}
          title={t('RFQ Management')}
          hint={t('Receive customer requests for quotations. Review required materials, quantities, delivery locations and requested dates.')}
        />
        <KpiGrid>
          <Kpi label="Open RFQs" value={visibleRfqs.filter(r => r.status === 'open').length} icon="📨" tone="warn" />
          <Kpi label="Awaiting my quote" value={visibleRfqs.filter(r => r.status === 'open' && !ownQuotations.some(q => q.rfqId === r.id)).length} icon="⏳" />
          <Kpi label={t('Quotations')} value={ownQuotations.length} icon="📝" />
          <Kpi label={t('Quotation acceptance')} value={`${ownQuotations.length ? Math.round((ownQuotations.filter(q => q.status === 'accepted').length / ownQuotations.length) * 100) : 0}%`} icon="✅" tone="good" />
        </KpiGrid>
        <Panel>
          <DataTable rows={visibleRfqs} columns={columns} searchText={r => `${r.materialName} ${r.customerName} ${r.city} ${r.status}`} exportName="rfqs" emptyTitle="No requests for quotation yet" />
        </Panel>
      </>
    );
  };

  const renderQuotations = () => {
    const columns: Column<Quotation>[] = [
      { key: 'rfq', header: 'Material', value: q => rfqs.find(r => r.id === q.rfqId)?.materialName || q.rfqId },
      { key: 'buyer', header: 'Buyer', value: q => rfqs.find(r => r.id === q.rfqId)?.customerName || '—' },
      { key: 'unitPrice', header: 'Unit price', align: 'right', value: q => Math.round(q.unitPrice), render: q => money(q.unitPrice) },
      { key: 'quantity', header: 'Qty', align: 'right', value: q => q.quantity },
      { key: 'deliveryFee', header: 'Delivery', align: 'right', value: q => Math.round(q.deliveryFee), render: q => money(q.deliveryFee) },
      { key: 'total', header: 'Total', align: 'right', value: q => Math.round(q.unitPrice * q.quantity + q.deliveryFee), render: q => <strong>{money(q.unitPrice * q.quantity + q.deliveryFee)}</strong> },
      { key: 'validUntil', header: 'Valid until', value: q => q.validUntil, render: q => <span className="ws-nowrap">{formatDate(q.validUntil)}</span> },
      { key: 'status', header: 'Status', value: q => q.status, render: q => <StatusPill label={t(q.status)} tone={toneFor(q.status)} /> },
    ];
    return (
      <>
        <SectionHeader
          eyebrow={t('Suppliers')}
          title={t('Quotation Management')}
          hint={t('Prepare quotations showing product specifications, quantity, unit price, subtotal, taxes, delivery charges, validity and total amount.')}
        />
        <KpiGrid>
          <Kpi label="Submitted" value={ownQuotations.filter(q => q.status === 'submitted').length} icon="📝" />
          <Kpi label="Accepted" value={ownQuotations.filter(q => q.status === 'accepted').length} icon="✅" tone="good" />
          <Kpi label="Declined" value={ownQuotations.filter(q => q.status === 'declined').length} icon="🚫" tone="bad" />
          <Kpi label="Quoted value" value={money(ownQuotations.reduce((s, q) => s + q.unitPrice * q.quantity + q.deliveryFee, 0))} icon="💰" tone="accent" />
        </KpiGrid>
        <Panel>
          <DataTable rows={ownQuotations} columns={columns} searchText={q => `${q.supplierName} ${q.status}`} exportName="my_quotations" emptyTitle="No quotations yet" emptyText="Open an RFQ and submit your first quotation." />
        </Panel>
      </>
    );
  };

  const renderOrders = () => (
    <>
      <SectionHeader
        eyebrow={t('Suppliers')}
        title={t('Order Management')}
        hint={t('Accept, reject or update orders. Confirm stock, prepare products, update order status and coordinate dispatch.')}
      />
      <KpiGrid>
        <Kpi label={t('Pending orders')} value={ownOrders.filter(o => o.status === 'pending').length} icon="🕒" tone="warn" />
        <Kpi label={t('Confirmed')} value={ownOrders.filter(o => o.status === 'confirmed').length} icon="✅" />
        <Kpi label={t('Shipped')} value={ownOrders.filter(o => o.status === 'shipped').length} icon="🚚" />
        <Kpi label={t('Delivered')} value={ownOrders.filter(o => o.status === 'delivered').length} icon="🏁" tone="good" />
        <Kpi label={t('Revenue')} value={money(revenue)} icon="💰" tone="accent" />
        <Kpi label="Pipeline" value={money(pipeline)} icon="📈" />
      </KpiGrid>
      <Panel>
        <DataTable rows={ownOrders} columns={orderColumns} searchText={o => `${o.invoiceNumber} ${buyerFor(o.customerId)?.name || ''} ${o.status}`} exportName="my_orders" pageSize={12} emptyTitle="No orders yet" />
      </Panel>
    </>
  );

  const renderInvoices = () => (
    <>
      <SectionHeader
        eyebrow={t('Suppliers')}
        title={t('Proforma & Invoicing')}
        hint={t('Generate proforma invoices, commercial invoices, receipts and transaction documents.')}
      />
      <KpiGrid>
        <Kpi label={t('Invoices')} value={ownOrders.length} icon="🧾" />
        <Kpi label={t('Paid')} value={ownOrders.filter(o => o.paymentStatus === 'paid').length} icon="✅" tone="good" />
        <Kpi label={t('Unpaid')} value={ownOrders.filter(o => o.paymentStatus === 'pending').length} icon="🕒" tone="warn" />
        <Kpi label="Invoiced value" value={money(ownOrders.reduce((s, o) => s + o.totalAmount, 0))} icon="💰" tone="accent" />
      </KpiGrid>
      <Panel>
        <DataTable
          rows={ownOrders}
          columns={[
            { key: 'invoiceNumber', header: 'Invoice', value: o => o.invoiceNumber, render: o => <strong>{o.invoiceNumber}</strong> },
            { key: 'buyer', header: 'Buyer', value: o => buyerFor(o.customerId)?.name || '—' },
            { key: 'date', header: 'Date', value: o => o.orderDate, render: o => <span className="ws-nowrap">{formatDate(o.orderDate)}</span> },
            { key: 'subtotal', header: 'Net', align: 'right', value: o => Math.round(o.totalAmount - (o.vatAmount || 0) - (o.transportCost || 0)), render: o => money(o.totalAmount - (o.vatAmount || 0) - (o.transportCost || 0)) },
            { key: 'vat', header: 'VAT', align: 'right', value: o => Math.round(o.vatAmount || 0), render: o => money(o.vatAmount || 0) },
            { key: 'delivery', header: 'Delivery', align: 'right', value: o => Math.round(o.transportCost || 0), render: o => money(o.transportCost || 0) },
            { key: 'totalAmount', header: 'Total', align: 'right', value: o => Math.round(o.totalAmount), render: o => <strong>{money(o.totalAmount)}</strong> },
            { key: 'paymentStatus', header: 'Payment', value: o => o.paymentStatus, render: o => <StatusPill label={t(o.paymentStatus)} tone={toneFor(o.paymentStatus)} /> },
            {
              key: 'actions', header: 'Actions', align: 'right', noExport: true,
              render: o => <button className="btn btn-secondary btn-sm" onClick={() => setInvoiceTarget(o)}>🧾 {t('Open')}</button>,
            },
          ]}
          searchText={o => `${o.invoiceNumber} ${buyerFor(o.customerId)?.name || ''}`}
          exportName="invoices"
        />
      </Panel>
    </>
  );

  const renderCustomers = () => {
    const buyerIds = Array.from(new Set(ownOrders.map(o => o.customerId)));
    const rows = buyerIds.map(id => buyerFor(id)).filter((u): u is User => Boolean(u));
    const columns: Column<User>[] = [
      { key: 'name', header: 'Customer', value: u => u.name, render: u => <div className="ws-cell-stack"><strong>{u.companyName || u.name}</strong><small>{u.email}</small></div> },
      { key: 'city', header: 'City', value: u => u.city },
      { key: 'orders', header: 'Orders', align: 'right', value: u => ownOrders.filter(o => o.customerId === u.id).length },
      { key: 'spend', header: 'Spend', align: 'right', value: u => Math.round(ownOrders.filter(o => o.customerId === u.id && o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0)), render: u => money(ownOrders.filter(o => o.customerId === u.id && o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0)) },
      { key: 'phone', header: 'Phone', value: u => u.phone },
      {
        key: 'actions', header: 'Actions', align: 'right', noExport: true,
        render: u => <button className="btn btn-secondary btn-sm" onClick={() => setMessageDraft({ to: u.id, title: '', body: '' })}>✉️</button>,
      },
    ];
    return (
      <>
        <SectionHeader
          eyebrow={t('Suppliers')}
          title={t('Customer Management')}
          hint={t('View customer enquiries, purchasing history, reviews and communication records.')}
        />
        <KpiGrid>
          <Kpi label={t('Customers')} value={rows.length} icon="👤" />
          <Kpi label="Repeat buyers" value={rows.filter(u => ownOrders.filter(o => o.customerId === u.id).length > 1).length} icon="🔁" tone="good" />
          <Kpi label="Reviews" value={reviews.filter(r => ownMaterials.some(m => m.id === r.materialId)).length} icon="⭐" />
          <Kpi label="Top buyer" value={rows.length ? (() => { const top = [...rows].sort((a, b) => ownOrders.filter(o => o.customerId === b.id).reduce((s, o) => s + o.totalAmount, 0) - ownOrders.filter(o => o.customerId === a.id).reduce((s, o) => s + o.totalAmount, 0))[0]; return top.name.split(' ')[0]; })() : '—'} icon="🏆" />
        </KpiGrid>
        <Panel>
          <DataTable rows={rows} columns={columns} searchText={u => `${u.name} ${u.email} ${u.city}`} exportName="my_customers" emptyTitle="No customers yet" />
        </Panel>
      </>
    );
  };

  const renderDelivery = () => {
    const deliveries = ownOrders.filter(o => o.deliveryIncluded || o.transportStatus);
    const columns: Column<Order>[] = [
      { key: 'invoiceNumber', header: 'Order', value: o => o.invoiceNumber },
      { key: 'destination', header: 'Destination', value: o => o.address },
      { key: 'transporter', header: 'Transporter', value: o => transporterProfiles.find(p => p.userId === o.transporterId)?.companyName || '—', render: o => transporterProfiles.find(p => p.userId === o.transporterId)?.companyName || <span className="ws-muted">Awaiting claim</span> },
      { key: 'status', header: 'Delivery status', value: o => (o.transportStatus ? TRANSPORT_STATUS_LABELS[jobStatus(o)] : 'not requested'), render: o => <StatusPill label={o.transportStatus ? TRANSPORT_STATUS_LABELS[jobStatus(o)] : 'Not requested'} tone={o.transportStatus ? toneFor(o.transportStatus) : 'muted'} /> },
      { key: 'fee', header: 'Fee', align: 'right', value: o => Math.round(o.transportFee || 0), render: o => (o.transportFee ? money(o.transportFee) : '—') },
      { key: 'pod', header: 'POD', value: o => (o.transportPod ? 'captured' : '—'), render: o => (o.transportPod ? <StatusPill label={o.transportPod.receivedBy} tone="good" /> : <span className="ws-muted">—</span>) },
    ];
    return (
      <>
        <SectionHeader
          eyebrow={t('Suppliers')}
          title={t('Delivery Coordination')}
          hint={t('Request transport services, share collection details, coordinate loading and track delivery progress.')}
        />
        <KpiGrid>
          <Kpi label="Deliveries" value={deliveries.length} icon="🚚" />
          <Kpi label="Unassigned" value={deliveries.filter(o => !o.transporterId).length} icon="⚠️" tone="warn" />
          <Kpi label="In transit" value={deliveries.filter(o => o.transportStatus === 'in_transit' || o.transportStatus === 'picked_up').length} icon="🛣️" />
          <Kpi label={t('Completed')} value={deliveries.filter(o => o.transportStatus === 'delivered').length} icon="🏁" tone="good" />
        </KpiGrid>
        <Panel>
          <DataTable rows={deliveries} columns={columns} searchText={o => `${o.invoiceNumber} ${o.address}`} exportName="deliveries" emptyTitle="No deliveries yet" />
        </Panel>
        <Panel title="Collection & loading" subtitle="Confirmed orders ready for loading">
          {ownOrders.filter(o => o.status === 'confirmed').length === 0 ? <EmptyState icon="📦" title="Nothing to load" text="Confirmed orders appear here until dispatch." /> : (
            <ul className="ws-alert-list">
              {ownOrders.filter(o => o.status === 'confirmed').map(o => (
                <li key={o.id}>
                  <span>📦</span>
                  <div><strong>{o.invoiceNumber}</strong><small>{materialFor(o.materialId)?.name} · {o.quantity} {materialFor(o.materialId)?.unit}</small></div>
                  <button className="btn btn-primary btn-sm" onClick={() => onUpdateOrderStatus(o.id, 'shipped')}>{t('Dispatch')}</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </>
    );
  };

  const renderAnalytics = () => (
    <>
      <SectionHeader
        eyebrow={t('Suppliers')}
        title={t('Sales & Revenue Analytics')}
        hint={t('Review sales volume, revenue, best-selling products, quotation acceptance and customer retention.')}
        actions={<button className="btn btn-secondary btn-sm" onClick={() => onNavigate('analytics')}>📊 Full analytics</button>}
      />
      <KpiGrid>
        <Kpi label={t('Revenue')} value={money(revenue)} hint="Delivered orders" icon="💰" tone="accent" />
        <Kpi label="Units sold" value={analytics.unitsSold.toLocaleString()} icon="📦" />
        <Kpi label="Orders" value={ownOrders.length} hint={`${ownOrders.filter(o => o.status === 'cancelled').length} cancelled`} icon="📋" />
        <Kpi label={t('Average order value')} value={money(analytics.avgOrderValue)} icon="📊" />
        <Kpi label={t('Quotation acceptance')} value={`${ownQuotations.length ? Math.round((ownQuotations.filter(q => q.status === 'accepted').length / ownQuotations.length) * 100) : 0}%`} icon="📝" />
        <Kpi label="Growth (30d)" value={analytics.growthPct === null ? '—' : `${analytics.growthPct >= 0 ? '+' : ''}${analytics.growthPct.toFixed(1)}%`} icon="📈" tone={(analytics.growthPct || 0) >= 0 ? 'good' : 'bad'} />
      </KpiGrid>
      <div className="ws-grid-2">
        <Panel title="Revenue by month"><BarList items={analytics.monthlyRevenue.map(p => ({ label: p.label, value: p.value }))} format={money} /></Panel>
        <Panel title={t('Best sellers')}><BarList items={analytics.topProducts.slice(0, 8).map(p => ({ label: p.name, value: p.units, hint: money(p.revenue) }))} /></Panel>
        <Panel title="Revenue by category"><BarList items={analytics.categoryData.map(p => ({ label: p.label, value: p.value }))} format={money} /></Panel>
        <Panel title="Order status"><BarList items={analytics.statuses.map(s => ({ label: t(s.label), value: s.value }))} /></Panel>
      </div>
      <Panel title="Plain-language insights">
        <ul className="ws-insight-list">{analytics.insights.map((insight, index) => <li key={index}>💡 {insight}</li>)}</ul>
      </Panel>
    </>
  );

  const renderAi = () => {
    const forecasts = ownMaterials
      .map(material => ({ material, forecast: forecastPrice(material.priceHistory, material.price) }))
      .filter((row): row is { material: Material; forecast: NonNullable<ReturnType<typeof forecastPrice>> } => Boolean(row.forecast));
    const slowMovers = ownMaterials.filter(material => !ownOrders.some(o => o.materialId === material.id));
    return (
      <>
        <SectionHeader
          eyebrow={t('Suppliers')}
          title={t('AI Business Assistant')}
          hint={t('Receive demand forecasts, stock recommendations, pricing insights and suggestions for potential customers.')}
          actions={<button className="btn btn-primary btn-sm" onClick={() => onNavigate('copilot')}>🤖 Ask Copilot</button>}
        />
        <KpiGrid>
          <Kpi label="Forecast signals" value={forecasts.length} icon="💹" />
          <Kpi label="Rising prices" value={forecasts.filter(f => f.forecast.trend === 'up').length} icon="📈" tone="warn" />
          <Kpi label="Restock now" value={lowStock.length} icon="⚠️" tone={lowStock.length ? 'warn' : 'good'} />
          <Kpi label="Slow movers" value={slowMovers.length} hint="No orders yet" icon="🐢" />
        </KpiGrid>
        <Panel title="Price guidance" subtitle="Source: your own price history · updated on each price change">
          {forecasts.length === 0 ? <EmptyState icon="💹" title="Not enough history" text="Update a product price twice to unlock a forecast." /> : (
            <ul className="ws-forecast-list">
              {forecasts.map(({ material, forecast }) => (
                <li key={material.id}>
                  <div>
                    <strong>{material.name}</strong>
                    <small>{money(material.price)} / {material.unit} → {money(forecast.next)} ({forecast.changePct >= 0 ? '+' : ''}{forecast.changePct.toFixed(1)}%)</small>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => openPrice(material)}>{t('Edit')}</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="ws-grid-2">
          <Panel title="Restock recommendations" subtitle="Stock at or below ten units">
            {lowStock.length === 0 ? <EmptyState icon="✅" title="Stock is healthy" /> : (
              <ul className="ws-alert-list">
                {lowStock.map(material => (
                  <li key={material.id}>
                    <span>⚠️</span>
                    <div><strong>{material.name}</strong><small>{material.quantity} {material.unit} left</small></div>
                    <button className="btn btn-secondary btn-sm" onClick={() => setStockTarget(material)}>Restock</button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Demand signals" subtitle="Best sellers in the last 30 days">
            <BarList items={analytics.topProducts.slice(0, 6).map(p => ({ label: p.name, value: p.units }))} emptyLabel="No sales in this period" />
          </Panel>
        </div>
        <Panel title="Suggested customers" subtitle="Buyers who ordered most from the platform">
          <BarList items={analytics.topCustomers.slice(0, 6).map(c => ({ label: c.name, value: Math.round(c.spend), hint: `${c.city} · ${c.orders} orders` }))} format={money} />
        </Panel>
      </>
    );
  };

  const renderMessages = () => {
    const mine = notifications.filter(n => n.userId === user.id);
    const buyers = Array.from(new Set([...ownOrders.map(o => o.customerId), ...visibleRfqs.map(r => r.customerId)]))
      .map(id => buyerFor(id))
      .filter((u): u is User => Boolean(u));
    return (
      <>
        <SectionHeader
          eyebrow={t('Suppliers')}
          title={t('Messages & Notifications')}
          hint={t('Receive customer enquiries, new RFQs, order confirmations, payment updates and administrative notices.')}
        />
        <div className="ws-grid-2">
          <Panel title={t('Send')} subtitle="Delivered to the buyer's notification drawer">
            <div className="ws-form">
              <Field label={t('Buyer')} required>
                <select value={messageDraft.to} onChange={e => setMessageDraft(prev => ({ ...prev, to: e.target.value }))}>
                  <option value="">Select a customer…</option>
                  {buyers.map(buyer => <option key={buyer.id} value={buyer.id}>{buyer.name}</option>)}
                </select>
              </Field>
              <Field label={t('Subject')} required>
                <input value={messageDraft.title} onChange={e => setMessageDraft(prev => ({ ...prev, title: e.target.value }))} maxLength={80} />
              </Field>
              <Field label={t('Message')} required>
                <textarea rows={4} value={messageDraft.body} onChange={e => setMessageDraft(prev => ({ ...prev, body: e.target.value }))} maxLength={400} />
              </Field>
              <button className="btn btn-primary" onClick={sendMessage}>✉️ {t('Send')}</button>
            </div>
          </Panel>
          <Panel title={t('Notifications')} subtitle={`${mine.filter(n => !n.read).length} unread`}>
            {mine.length === 0 ? <EmptyState icon="🔔" title="No notifications yet" /> : (
              <ul className="ws-feed">
                {mine.slice(0, 10).map(item => (
                  <li key={item.id}>
                    <span className="ws-feed-icon">{item.type === 'order' ? '📦' : item.type === 'payment' ? '💳' : item.type === 'stock' ? '⚠️' : 'ℹ️'}</span>
                    <div><strong>{item.title}</strong><small>{item.message}</small></div>
                    <small className="ws-nowrap">{timeAgo(item.createdAt)}</small>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </>
    );
  };

  const renderPerformance = () => {
    const supplierReviews = reviews.filter(r => ownMaterials.some(m => m.id === r.materialId));
    const fulfilled = ownOrders.filter(o => o.status === 'delivered').length;
    const responded = visibleRfqs.filter(r => ownQuotations.some(q => q.rfqId === r.id)).length;
    return (
      <>
        <SectionHeader
          eyebrow={t('Suppliers')}
          title={t('Supplier Performance')}
          hint={t('View customer ratings, fulfilment rates, delivery reliability, quotation response time and verified business status.')}
        />
        <KpiGrid>
          <Kpi label={t('Average rating')} value={`⭐ ${companyRating.toFixed(1)}`} hint={`${supplierReviews.length} reviews`} icon="⭐" tone="good" />
          <Kpi label="Fulfilment rate" value={`${ownOrders.length ? Math.round((fulfilled / ownOrders.length) * 100) : 0}%`} hint={`${fulfilled} delivered`} icon="✅" />
          <Kpi label="RFQ response" value={`${visibleRfqs.length ? Math.round((responded / visibleRfqs.length) * 100) : 0}%`} hint={`${responded} of ${visibleRfqs.length}`} icon="📨" />
          <Kpi label="Cancelled orders" value={ownOrders.filter(o => o.status === 'cancelled').length} icon="🚫" tone={ownOrders.some(o => o.status === 'cancelled') ? 'warn' : 'good'} />
          <Kpi label="Deliveries completed" value={ownOrders.filter(o => o.transportStatus === 'delivered').length} icon="🏁" />
          <Kpi label={t('Verification')} value={t(company.complianceStatus)} icon="🛡️" tone={company.complianceStatus === 'compliant' ? 'good' : 'warn'} />
        </KpiGrid>
        <Panel title="Rating breakdown" subtitle="Newest customer reviews">
          {supplierReviews.length === 0 ? <EmptyState icon="⭐" title="No reviews yet" /> : (
            <ul className="ws-feed">
              {supplierReviews.slice(0, 8).map(review => (
                <li key={review.id}>
                  <span className="ws-feed-icon">{'⭐'.repeat(Math.round(review.rating))}</span>
                  <div><strong>{review.userName}</strong><small>{review.comment || 'No comment'}</small></div>
                  <small className="ws-nowrap">{timeAgo(review.date)}</small>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </>
    );
  };

  const renderInternational = () => (
    <>
      <SectionHeader
        eyebrow={t('Suppliers')}
        title={t('International Business')}
        hint={t('Manage international enquiries, export product information, commercial documents and cross-border sourcing requests when enabled.')}
      />
      <div className="ws-grid-2">
        <Panel title="Export profile" subtitle="Stored on this device for your international enquiries">
          <div className="ws-form">
            <Field label="Target markets">
              <input value={intl.markets} onChange={e => setIntl(prev => ({ ...prev, markets: e.target.value }))} placeholder="Djibouti, Kenya, South Sudan" />
            </Field>
            <Field label="Incoterms">
              <select value={intl.incoterms} onChange={e => setIntl(prev => ({ ...prev, incoterms: e.target.value }))}>
                {['FOB', 'CIF', 'EXW', 'DAP', 'DDP'].map(term => <option key={term} value={term}>{term}</option>)}
              </select>
            </Field>
            <Field label="Commercial documents ready">
              <input value={intl.documents} onChange={e => setIntl(prev => ({ ...prev, documents: e.target.value }))} placeholder="Certificate of origin, packing list, invoice" />
            </Field>
            <Field label={t('Notes')}>
              <textarea rows={4} value={intl.notes} onChange={e => setIntl(prev => ({ ...prev, notes: e.target.value }))} />
            </Field>
          </div>
        </Panel>
        <Panel title="Export readiness" subtitle="What buyers look for in a cross-border quote">
          <ul className="ws-checklist">
            <li className={company.complianceStatus === 'compliant' ? 'done' : ''}><span>{company.complianceStatus === 'compliant' ? '✅' : '⬜'}</span>Verified business</li>
            <li className={company.tinNumber ? 'done' : ''}><span>{company.tinNumber ? '✅' : '⬜'}</span>TIN registered</li>
            <li className={company.vatNumber ? 'done' : ''}><span>{company.vatNumber ? '✅' : '⬜'}</span>VAT registered</li>
            <li className={ownMaterials.length > 0 ? 'done' : ''}><span>{ownMaterials.length ? '✅' : '⬜'}</span>Products published</li>
            <li className={intl.markets ? 'done' : ''}><span>{intl.markets ? '✅' : '⬜'}</span>Target markets selected</li>
            <li className={intl.documents ? 'done' : ''}><span>{intl.documents ? '✅' : '⬜'}</span>Commercial documents listed</li>
          </ul>
          <p className="ws-note">Cross-border trade is enabled per country by Administration. Export quotes are prepared with the same quotation tools as domestic requests.</p>
        </Panel>
      </div>
    </>
  );

  const renderSectionBody = () => {
    switch (section) {
      case 'dashboard': return renderDashboard();
      case 'profile': return renderProfile();
      case 'verification': return renderVerification();
      case 'locations': return renderLocations();
      case 'products': return renderProducts();
      case 'inventory': return renderInventory();
      case 'prices': return renderPrices();
      case 'rfqs': return renderRfqs();
      case 'quotations': return renderQuotations();
      case 'orders': return renderOrders();
      case 'invoices': return renderInvoices();
      case 'customers': return renderCustomers();
      case 'delivery': return renderDelivery();
      case 'analytics': return renderAnalytics();
      case 'ai': return renderAi();
      case 'messages': return renderMessages();
      case 'performance': return renderPerformance();
      case 'international': return renderInternational();
      default: return renderDashboard();
    }
  };

  return (
    <WorkspaceShell
      menu="supplier"
      section={section}
      onSection={onSection}
      badgeFor={id => {
        if (id === 'orders') return ownOrders.filter(o => o.status === 'pending').length || null;
        if (id === 'rfqs') return visibleRfqs.filter(r => r.status === 'open').length || null;
        if (id === 'messages') return notifications.filter(n => n.userId === user.id && !n.read).length || null;
        return null;
      }}
    >
      {renderSectionBody()}

      {priceTarget && (
        <Modal
          title={`${t('Price')} · ${priceTarget.name}`}
          onClose={() => setPriceTarget(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setPriceTarget(null)}>{t('Cancel')}</button><button className="btn btn-primary" onClick={savePrice}>{t('Save')}</button></>}
        >
          <div className="ws-form">
            <Field label={`Unit price (${company ? 'ETB' : 'ETB'})`} required hint={`Current: ${money(priceTarget.price)} / ${priceTarget.unit}`}>
              <input type="number" min="0" step="0.01" value={priceDraft.price} onChange={e => setPriceDraft(prev => ({ ...prev, price: e.target.value }))} />
            </Field>
            <Field label={`Minimum order (${priceTarget.unit})`}>
              <input type="number" min="1" step="1" value={priceDraft.minOrder} onChange={e => setPriceDraft(prev => ({ ...prev, minOrder: e.target.value }))} />
            </Field>
            <p className="ws-note">Saving records a price snapshot, which powers the forecast and the price-history chart buyers see.</p>
          </div>
        </Modal>
      )}

      {stockTarget && (
        <Modal
          title={`${t('Stock')} · ${stockTarget.name}`}
          onClose={() => setStockTarget(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setStockTarget(null)}>{t('Cancel')}</button><button className="btn btn-primary" onClick={saveStock}>{t('Save')}</button></>}
        >
          <div className="ws-form">
            <p className="ws-muted">Current stock: <strong>{stockTarget.quantity.toLocaleString()} {stockTarget.unit}</strong></p>
            <Field label="Movement (+ received / − removed)" hint="Use a negative number to remove damaged or reserved stock.">
              <input type="number" step="1" value={stockDraft.delta} onChange={e => setStockDraft(prev => ({ ...prev, delta: e.target.value }))} />
            </Field>
            <Field label="Reason">
              <select value={stockDraft.reason} onChange={e => setStockDraft(prev => ({ ...prev, reason: e.target.value }))}>
                {['Restock', 'Sale', 'Damage', 'Return', 'Stock count', 'Transfer'].map(reason => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </Field>
            <p className="ws-muted">New level: <strong>{Math.max(0, stockTarget.quantity + (parseInt(stockDraft.delta, 10) || 0)).toLocaleString()} {stockTarget.unit}</strong></p>
          </div>
        </Modal>
      )}

      {rfqTarget && (
        <Modal
          title={`${t('Submit quotation')} · ${rfqTarget.materialName}`}
          onClose={() => setRfqTarget(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setRfqTarget(null)}>{t('Cancel')}</button><button className="btn btn-primary" onClick={submitQuote}>{t('Submit')}</button></>}
        >
          <div className="ws-detail-grid">
            <div><span>{t('Buyer')}</span><strong>{rfqTarget.customerName}</strong></div>
            <div><span>{t('Quantity')}</span><strong>{rfqTarget.quantity} {rfqTarget.unit}</strong></div>
            <div><span>{t('Site')}</span><strong>{rfqTarget.siteAddress}, {rfqTarget.city}</strong></div>
            <div><span>{t('Required by')}</span><strong>{formatDate(rfqTarget.requiredBy)}</strong></div>
          </div>
          {rfqTarget.notes && <p className="ws-quote">{rfqTarget.notes}</p>}
          <div className="ws-form">
            <Field label={`Unit price (ETB / ${rfqTarget.unit})`} required>
              <input type="number" min="0" step="0.01" value={quoteDraft.unitPrice} onChange={e => setQuoteDraft(prev => ({ ...prev, unitPrice: e.target.value }))} />
            </Field>
            <Field label="Delivery charge (ETB)" hint="Leave 0 when the buyer collects.">
              <input type="number" min="0" step="0.01" value={quoteDraft.deliveryFee} onChange={e => setQuoteDraft(prev => ({ ...prev, deliveryFee: e.target.value }))} />
            </Field>
            <Field label={t('Valid until')}>
              <input type="date" value={quoteDraft.validUntil} onChange={e => setQuoteDraft(prev => ({ ...prev, validUntil: e.target.value }))} />
            </Field>
            <Field label={t('Notes')}>
              <textarea rows={3} value={quoteDraft.notes} onChange={e => setQuoteDraft(prev => ({ ...prev, notes: e.target.value }))} placeholder="Grade, lead time, payment terms…" />
            </Field>
            <p className="ws-quote">
              Total: <strong>{money((parseFloat(quoteDraft.unitPrice) || 0) * rfqTarget.quantity + (parseFloat(quoteDraft.deliveryFee) || 0))}</strong> before VAT
            </p>
          </div>
        </Modal>
      )}

      {invoiceTarget && (
        <Modal
          title={`Invoice ${invoiceTarget.invoiceNumber}`}
          onClose={() => setInvoiceTarget(null)}
          wide
          footer={<><button className="btn btn-secondary" onClick={() => setInvoiceTarget(null)}>{t('Close')}</button><button className="btn btn-primary" onClick={() => window.print()}>🖨️ Print</button></>}
        >
          <div className="ws-invoice">
            <div className="ws-invoice-head">
              <div>
                <strong>{company.name}</strong>
                <span>{company.location}, {company.city}</span>
                <span>TIN {company.tinNumber || '—'} · VAT {company.vatNumber || '—'}</span>
              </div>
              <div>
                <strong>INVOICE</strong>
                <span>{invoiceTarget.invoiceNumber}</span>
                <span>{formatDate(invoiceTarget.orderDate)}</span>
              </div>
            </div>
            <div className="ws-invoice-parties">
              <div><span>Billed to</span><strong>{buyerFor(invoiceTarget.customerId)?.name || '—'}</strong><small>{invoiceTarget.address}</small></div>
              <div><span>Status</span><strong>{t(invoiceTarget.status)}</strong><small>{t(invoiceTarget.paymentStatus)}</small></div>
            </div>
            <table className="data-table ws-table">
              <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
              <tbody>
                <tr>
                  <td>{materialFor(invoiceTarget.materialId)?.name || 'Material'}</td>
                  <td>{invoiceTarget.quantity} {materialFor(invoiceTarget.materialId)?.unit || ''}</td>
                  <td>{money(invoiceTarget.unitPrice)}</td>
                  <td>{money(invoiceTarget.unitPrice * invoiceTarget.quantity)}</td>
                </tr>
              </tbody>
            </table>
            <ul className="ws-detail-list">
              <li><span>Subtotal</span><strong>{money(invoiceTarget.unitPrice * invoiceTarget.quantity)}</strong></li>
              <li><span>VAT</span><strong>{money(invoiceTarget.vatAmount || 0)}</strong></li>
              <li><span>Delivery</span><strong>{money(invoiceTarget.transportCost || 0)}</strong></li>
              <li className="ws-total-row"><span>Total</span><strong>{money(invoiceTarget.totalAmount)}</strong></li>
            </ul>
            <p className="ws-note">Payment method: {invoiceTarget.paymentMethod || '—'}. This document is generated from the confirmed order.</p>
          </div>
        </Modal>
      )}
    </WorkspaceShell>
  );
};

export default SupplierWorkspace;
