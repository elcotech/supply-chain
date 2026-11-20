// ===== Customers - Procurement Workspace (spec 4) =====
//
// Twenty customer submenus: dashboard, profile, projects, sites, smart search,
// supplier discovery, comparison, AI, price intelligence, RFQs, quotation
// comparison, cart, proforma/purchase orders, payments, tracking, delivery,
// documents, reviews/complaints, procurement analytics and notifications.

import React, { useMemo, useState } from 'react';
import {
  CartItem, Company, Complaint, Material, Order, Project, Quotation, Rfq,
} from '../../types';
import {
  formatCurrency, formatDate, genId, timeAgo, exportToCSV, effectiveRating,
  forecastPrice,
} from '../../utils';
import { buildAnalytics, monthlyTrend } from '../../lib/analytics';
import { useLanguage } from '../../lib/i18n';
import { jobStatus, TRANSPORT_STATUS_LABELS } from '../../lib/transport';
import useLocalCollection from '../../hooks/useLocalCollection';
import { LineChart } from '../Charts';
import WorkspaceShell from './shell';
import { WorkspaceProps } from './types';
import {
  BarList, Column, DashboardGrid, DataTable, EmptyState, Field, Kpi, KpiGrid,
  MiniStat, Modal, Panel, RangeSelect, RouteStrip, SectionHeader,
  StatusPill, toneFor,
} from './ui';

interface SavedSite {
  id: string;
  label: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  contact: string;
}

const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const CustomerWorkspace: React.FC<WorkspaceProps> = props => {
  const {
    user, users, companies, materials, orders, reviews, notifications, wallets,
    transactions, settings, projects, setProjects, rfqs, setRfqs, quotations,
    setQuotations, complaints, setComplaints, cart, compare, section, onSection,
    onNotify, onNavigate, onOpenProduct, onToggleCompare, onOpenMap, onAddToCart,
    onCheckout, onUpdateCartQty, onRemoveFromCart, onClearCart, onUpdateOrderStatus,
    onReview, onSendMessage, onSaveMyLocation, logEvent, transporterProfiles,
  } = props;
  const { t } = useLanguage();

  const myOrders = useMemo(() => orders.filter(o => o.customerId === user.id), [orders, user.id]);
  const myProjects = useMemo(() => projects.filter(p => p.customerId === user.id), [projects, user.id]);
  const myRfqs = useMemo(() => rfqs.filter(r => r.customerId === user.id), [rfqs, user.id]);
  const myRfqIds = useMemo(() => new Set(myRfqs.map(r => r.id)), [myRfqs]);
  const myQuotes = useMemo(() => quotations.filter(q => myRfqIds.has(q.rfqId)), [quotations, myRfqIds]);
  const myComplaints = complaints.filter(c => c.userId === user.id);
  const analytics = useMemo(
    () => buildAnalytics({ user, materials, companies, orders, users, reviews, settings, days: 30 }),
    [user, materials, companies, orders, users, reviews, settings]
  );

  const [sites, setSites] = useLocalCollection<SavedSite[]>(`sites_${user.id}`, []);
  const [dashRange, setDashRange] = useState('12');
  const [projectTarget, setProjectTarget] = useState<Project | null>(null);
  const [projectDraft, setProjectDraft] = useState<Omit<Project, 'id' | 'customerId'>>({
    name: '', description: '', budget: 0, siteAddress: '', city: '', managerName: '',
    managerPhone: '', startDate: '', endDate: '', status: 'planning', notes: '',
  });
  const [siteDraft, setSiteDraft] = useState<SavedSite>({ id: '', label: '', address: '', city: '', contact: '' });
  const [rfqDraft, setRfqDraft] = useState({ materialId: '', quantity: '', requiredBy: '', supplierIds: [] as string[], notes: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchSort, setSearchSort] = useState<'price-asc' | 'price-desc' | 'rating' | 'distance'>('price-asc');
  const [docTarget, setDocTarget] = useState<{ order: Order; kind: 'proforma' | 'invoice' } | null>(null);
  const [complaintDraft, setComplaintDraft] = useState({ category: 'product' as Complaint['category'], subject: '', message: '', againstId: '' });
  const [messageDraft, setMessageDraft] = useState({ to: '', title: '', body: '' });

  const money = (value: number) => formatCurrency(Math.round(value * 100) / 100);
  const supplierFor = (id: string) => companies.find(c => c.id === id);
  const materialFor = (id: string) => materials.find(m => m.id === id);
  const distanceTo = (company: Company) =>
    user.lat && user.lng && company.lat && company.lng ? haversineKm(user.lat, user.lng, company.lat, company.lng) : null;

  const spend = myOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0);
  const cartSubtotal = cart.reduce((s, item) => s + item.price * item.quantity, 0);

  // ---------- Actions ----------
  const openProject = (project?: Project) => {
    if (project) {
      setProjectTarget(project);
      setProjectDraft({
        name: project.name, description: project.description, budget: project.budget,
        siteAddress: project.siteAddress, city: project.city, managerName: project.managerName,
        managerPhone: project.managerPhone, startDate: project.startDate, endDate: project.endDate,
        status: project.status, notes: project.notes,
      });
    } else {
      setProjectTarget({} as Project);
      setProjectDraft({
        name: '', description: '', budget: 0, siteAddress: '', city: user.city, managerName: user.name,
        managerPhone: user.phone, startDate: new Date().toISOString().slice(0, 10), endDate: '', status: 'planning', notes: '',
      });
    }
  };

  const saveProject = () => {
    if (!projectDraft.name.trim()) {
      onNotify('Project name is required.', 'warning');
      return;
    }
    if (projectTarget?.id) {
      setProjects(prev => prev.map(p => (p.id === projectTarget.id ? { ...projectTarget, ...projectDraft } : p)));
      logEvent('project.update', projectDraft.name);
      onNotify('Project updated', 'success');
    } else {
      const record: Project = { id: genId('proj'), customerId: user.id, ...projectDraft };
      setProjects(prev => [record, ...prev]);
      logEvent('project.create', record.name);
      onNotify('Project created', 'success');
    }
    setProjectTarget(null);
  };

  const saveSite = () => {
    if (!siteDraft.label.trim() || !siteDraft.address.trim()) {
      onNotify('A site needs a label and an address.', 'warning');
      return;
    }
    const record = { ...siteDraft, id: siteDraft.id || genId('site') };
    setSites(prev => (prev.some(s => s.id === record.id) ? prev.map(s => (s.id === record.id ? record : s)) : [...prev, record]));
    logEvent('site.save', record.label);
    onNotify('Site saved', 'success');
    setSiteDraft({ id: '', label: '', address: '', city: '', contact: '' });
  };

  const openRfqFor = (material: Material) => {
    const supplier = supplierFor(material.companyId);
    setRfqDraft({
      materialId: material.id,
      quantity: String(material.minOrder || 1),
      requiredBy: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      supplierIds: supplier ? [supplier.id] : [],
      notes: '',
    });
    onSection('rfqs');
  };

  const submitRfq = () => {
    const material = materialFor(rfqDraft.materialId);
    const quantity = parseInt(rfqDraft.quantity, 10);
    if (!material || !isFinite(quantity) || quantity < 1) {
      onNotify('Choose a product and a quantity of at least one.', 'warning');
      return;
    }
    const record: Rfq = {
      id: genId('rfq'),
      customerId: user.id,
      customerName: user.companyName || user.name,
      materialId: material.id,
      materialName: material.name,
      category: material.category,
      quantity,
      unit: material.unit,
      siteAddress: sites[0]?.address || user.address,
      city: sites[0]?.city || user.city,
      requiredBy: rfqDraft.requiredBy || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      notes: rfqDraft.notes.trim(),
      supplierIds: rfqDraft.supplierIds,
      status: 'open',
      createdAt: Date.now(),
    };
    setRfqs(prev => [record, ...prev]);
    rfqDraft.supplierIds.forEach(id => {
      const supplier = supplierFor(id);
      if (supplier) onSendMessage(supplier.userId, 'New RFQ received', `${record.customerName} requested ${quantity} ${material.unit} of ${material.name}.`);
    });
    logEvent('rfq.create', material.name);
    onNotify(rfqDraft.supplierIds.length ? `RFQ sent to ${rfqDraft.supplierIds.length} supplier(s)` : 'RFQ published to all suppliers', 'success');
    setRfqDraft({ materialId: '', quantity: '', requiredBy: '', supplierIds: [], notes: '' });
  };

  const decideQuote = (quote: Quotation, accept: boolean) => {
    setQuotations(prev => prev.map(q =>
      q.rfqId === quote.rfqId
        ? { ...q, status: q.id === quote.id ? (accept ? 'accepted' : 'declined') : (accept ? 'declined' : q.status) }
        : q
    ));
    setRfqs(prev => prev.map(r => (r.id === quote.rfqId ? { ...r, status: accept ? 'closed' : r.status } : r)));
    const supplier = companies.find(c => c.id === quote.supplierId);
    if (supplier) onSendMessage(supplier.userId, accept ? 'Quotation accepted' : 'Quotation declined',
      accept ? `${user.companyName || user.name} accepted your quotation for ${money(quote.unitPrice)} / ${rfqById(quote.rfqId)?.unit || 'unit'}.` : 'Your quotation was not selected.');
    logEvent(accept ? 'quotation.accept' : 'quotation.decline', quote.supplierName);
    onNotify(accept ? 'Quotation accepted' : 'Quotation declined', accept ? 'success' : 'info');
  };

  const rfqById = (id: string) => myRfqs.find(r => r.id === id);

  const submitComplaint = () => {
    if (!complaintDraft.subject.trim() || !complaintDraft.message.trim()) {
      onNotify('Enter a subject and a description.', 'warning');
      return;
    }
    const against = companies.find(c => c.id === complaintDraft.againstId);
    const record: Complaint = {
      id: genId('cmp'),
      userId: user.id,
      userName: user.name,
      role: 'customer',
      category: complaintDraft.category,
      subject: complaintDraft.subject.trim(),
      message: complaintDraft.message.trim(),
      againstId: against?.id,
      againstName: against?.name,
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setComplaints(prev => [record, ...prev]);
    logEvent('complaint.create', record.subject);
    onNotify('Complaint submitted. Administration will review it.', 'success');
    setComplaintDraft({ category: 'product', subject: '', message: '', againstId: '' });
  };

  const prepareQuote = (quote: Quotation) => {
    const material = materialFor(rfqById(quote.rfqId)?.materialId || '');
    if (!material) {
      onNotify('This product is no longer listed. Contact the supplier directly.', 'warning');
      return;
    }
    onAddToCart(material, quote.quantity);
    onSection('cart');
  };

  // ---------- Filtered catalogue ----------
  const catalogue = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rows = materials.filter(m => {
      const supplier = supplierFor(m.companyId);
      const matchesTerm = !term || `${m.name} ${m.category} ${m.brand || ''} ${m.description} ${supplier?.name || ''}`.toLowerCase().includes(term);
      const matchesCategory = searchCategory === 'all' || m.category === searchCategory;
      return matchesTerm && matchesCategory;
    });
    return [...rows].sort((a, b) => {
      if (searchSort === 'rating') return effectiveRating(b.rating, reviews.filter(r => r.materialId === b.id)) - effectiveRating(a.rating, reviews.filter(r => r.materialId === a.id));
      if (searchSort === 'distance') {
        const da = supplierFor(a.companyId); const db = supplierFor(b.companyId);
        return (da ? distanceTo(da) || 9999 : 9999) - (db ? distanceTo(db) || 9999 : 9999);
      }
      return searchSort === 'price-desc' ? b.price - a.price : a.price - b.price;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials, searchTerm, searchCategory, searchSort, companies, reviews, user.lat, user.lng]);

  const compareRows = materials.filter(m => compare.includes(m.id));

  // ---------- Sections ----------
  const renderDashboard = () => {
    const months = Math.max(1, Number(dashRange) || 12);
    const orderValueSeries = monthlyTrend(myOrders, months).revenue;
    const spendSeries = monthlyTrend(myOrders.filter(o => o.status === 'delivered'), months).revenue;
    const activeDeliveries = myOrders
      .filter(o => o.status !== 'cancelled' && o.status !== 'delivered' && (o.deliveryIncluded || o.transportStatus))
      .slice(0, 3);
    const pendingQuotes = myQuotes.filter(q => q.status === 'submitted');
    const marketplace = catalogue.slice(0, 5);
    const marketplaceColumns: Column<Material>[] = [
      {
        key: 'product',
        header: t('Product'),
        value: row => row.name,
        render: row => (
          <span className="ws-approval-name">
            <strong>{row.name}</strong>
            <small>{row.category} - {row.quantity} {row.unit} available</small>
          </span>
        ),
      },
      {
        key: 'supplier',
        header: t('Supplier'),
        value: row => supplierFor(row.companyId)?.name || '',
        render: row => <span>{supplierFor(row.companyId)?.name || '-'}</span>,
      },
      {
        key: 'price',
        header: t('Offer Price'),
        value: row => row.price,
        render: row => <strong>{money(row.price)}<small className="ws-muted">/{row.unit}</small></strong>,
      },
      {
        key: 'distance',
        header: t('Distance'),
        value: row => {
          const company = supplierFor(row.companyId);
          return company ? distanceTo(company) || 0 : 0;
        },
        render: row => {
          const company = supplierFor(row.companyId);
          const distance = company ? distanceTo(company) : null;
          return <span>{distance !== null ? `${distance.toFixed(0)} km` : '-'}</span>;
        },
      },
      {
        key: 'delivery',
        header: t('Delivery Cost'),
        value: row => row.transportCost || 0,
        render: row => <span>{row.transportCost ? money(row.transportCost) : t('Collect')}</span>,
      },
      {
        key: 'action',
        header: '',
        noExport: true,
        render: row => (
          <span className="ws-pill-stack">
            <button className="btn btn-secondary btn-sm" onClick={() => onOpenProduct(row)}>{t('View')}</button>
            <button className="btn btn-primary btn-sm" onClick={() => openRfqFor(row)}>{t('Select for RFQ')}</button>
          </span>
        ),
      },
    ];

    return (
      <>
        <SectionHeader
          eyebrow={t('Customer / Contractor')}
          title={t('Customer Dashboard')}
          hint={`${t('Welcome back')}, ${user.name.split(' ')[0]} - ${t('Track RFQs, quotations, orders and live deliveries.')}`}
          actions={
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => onSection('search')}> {t('Marketplace')}</button>
              <button className="btn btn-primary btn-sm" onClick={() => onSection('rfqs')}> {t('Request for Quotation')}</button>
            </>
          }
        />

        <KpiGrid>
          <Kpi label={t('Open RFQs')} value={myRfqs.filter(r => r.status === 'open').length} hint={`${myQuotes.length} quotations received`} icon="" tone="warn" />
          <Kpi label={t('New Quotations')} value={pendingQuotes.length} hint={t('awaiting your decision')} icon="" />
          <Kpi label={t('Pending Orders')} value={myOrders.filter(o => o.status === 'pending' || o.status === 'confirmed').length} hint={`${myOrders.filter(o => o.status === 'shipped').length} shipped`} icon="" tone="warn" />
          <Kpi label={t('Completed Orders')} value={myOrders.filter(o => o.status === 'delivered').length} hint={t('delivered to site')} icon="[OK]" tone="good" />
          <Kpi label={t('Total Spend')} value={money(spend)} hint={`${cart.length} ${t('items in cart')}`} icon="" tone="accent" />
        </KpiGrid>

        <DashboardGrid
          main={
            <>
              <Panel
                title={t('Purchasing Analytics')}
                subtitle={t('Order value and delivered spend across your projects')}
                actions={
                  <RangeSelect
                    label={t('Period')}
                    value={dashRange}
                    onChange={setDashRange}
                    options={[
                      { value: '12', label: t('All Months') },
                      { value: '6', label: t('Last 6 months') },
                      { value: '3', label: t('Last 3 months') },
                    ]}
                  />
                }
              >
                <div className="ws-chart-note">
                  <span>{t('Total spend')} - {money(spend)}</span>
                  <span className="ws-pill-stack">
                    <StatusPill label={`* ${t('Delivered spend')}`} tone="good" />
                    <StatusPill label={`* ${t('Order value')}`} tone="info" />
                  </span>
                </div>
                <div className="ws-chart-box">
                  <LineChart
                    height={196}
                    valueFormatter={money}
                    series={[
                      { label: t('Delivered spend'), color: '#1f6feb', data: spendSeries },
                      { label: t('Order value'), color: '#c9a227', data: orderValueSeries },
                    ]}
                  />
                </div>
                <div className="ws-chart-note">
                  <span>{myProjects.filter(p => p.status === 'active').length} {t('active projects')}</span>
                  <span>{t('Wallet')} {money(wallets[user.id] || 0)}</span>
                </div>
              </Panel>

              <Panel
                title={t('Material Marketplace & RFQ Comparison')}
                subtitle={t('Compare offer price, distance and delivery before you request a quote')}
                actions={<button className="btn btn-secondary btn-sm" onClick={() => onSection('search')}>{t('Browse all')}</button>}
              >
                <div className="ws-material-grid">
                  {marketplace.slice(0, 4).map(material => (
                    <button className="ws-material-card" key={material.id} onClick={() => onOpenProduct(material)}>
                      <span className="ws-material-media">
                        {material.images?.[0]
                          ? <img src={material.images[0]} alt={material.name} loading="lazy" />
                          : material.category.slice(0, 2).toUpperCase()}
                      </span>
                      <strong>{material.name}</strong>
                      <small>{supplierFor(material.companyId)?.name || t('Supplier')} - {material.quantity} {material.unit}</small>
                      <span className="ws-material-price">{money(material.price)}<em>/{material.unit}</em></span>
                    </button>
                  ))}
                  {marketplace.length === 0 && (
                    <EmptyState icon="" title={t('Marketplace is empty')} text={t('Products will appear here as suppliers publish their catalogue.')} />
                  )}
                </div>
                {marketplace.length > 0 && (
                  <DataTable
                    rows={marketplace}
                    columns={marketplaceColumns}
                    pageSize={5}
                    exportName="rfq-comparison"
                    searchText={row => `${row.name} ${row.category} ${supplierFor(row.companyId)?.name || ''}`}
                  />
                )}
              </Panel>
            </>
          }
          side={
            <>
              <Panel
                title={t('GPS Real-time Delivery Tracking')}
                subtitle={`${activeDeliveries.length} ${t('active deliveries')}`}
                actions={<button className="btn btn-secondary btn-sm" onClick={() => onSection('tracking')}>{t('Track all')}</button>}
              >
                {activeDeliveries.length === 0 ? (
                  <EmptyState icon="" title={t('No active deliveries')} text={t('Live tracking appears once a supplier dispatches your order.')} />
                ) : (
                  <div className="ws-delivery-list">
                    {activeDeliveries.map(order => {
                      const profile = transporterProfiles.find(p => p.userId === order.transporterId);
                      const driver = profile?.drivers.find(d => d.id === order.assignedDriverId);
                      const stage = jobStatus(order);
                      const progress = stage === 'accepted' ? 28 : stage === 'picked_up' ? 55 : stage === 'in_transit' ? 80 : 10;
                      return (
                        <div className="ws-delivery-card" key={order.id}>
                          <div className="ws-delivery-head">
                            <div>
                              <strong>{order.invoiceNumber}</strong>
                              <small>{materialFor(order.materialId)?.name || t('Material')} - {order.quantity} {materialFor(order.materialId)?.unit || ''}</small>
                            </div>
                            <StatusPill label={t(TRANSPORT_STATUS_LABELS[stage])} tone={toneFor(stage)} />
                          </div>
                          <RouteStrip
                            from={supplierFor(order.companyId)?.city || t('Supplier')}
                            to={user.city || t('Site')}
                            progress={progress}
                          />
                          <div className="ws-delivery-meta">
                            <span>{driver ? ` ${driver.name}` : ` ${profile?.companyName || t('Transporter')}`}</span>
                            <span>{driver?.phone || profile?.phone || t('Contact pending')}</span>
                            <span>{order.deliveryDate ? `${t('ETA')} ${formatDate(order.deliveryDate)}` : t('ETA to confirm')}</span>
                          </div>
                          <button className="btn btn-secondary btn-sm" onClick={() => onSection('tracking')}>{t('Live map')}</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>

              <Panel title={t('Quotations Awaiting Decision')} subtitle={`${pendingQuotes.length} ${t('new offers')}`}>
                {pendingQuotes.length === 0 ? (
                  <EmptyState icon="" title={t('Nothing to review')} text={t('Quotations appear here when suppliers respond to your RFQs.')} />
                ) : (
                  <div className="ws-stat-list">
                    {pendingQuotes.slice(0, 4).map(quote => {
                      const rfq = rfqById(quote.rfqId);
                      return (
                        <div className="ws-stat-row" key={quote.id}>
                          <div>
                            <strong>{quote.supplierName}</strong>
                            <small>{rfq?.materialName} - {money(quote.unitPrice)}/{rfq?.unit} - {t('delivered')} {money(quote.unitPrice * quote.quantity + quote.deliveryFee)}</small>
                          </div>
                          <button className="btn btn-secondary btn-sm" onClick={() => onSection('quotation-compare')}>{t('Compare')}</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>

              <Panel title={t('Procurement Snapshot')} subtitle={t('Budget, wallet and cart')}>
                <div className="ws-mini-grid">
                  <MiniStat label={t('Projects')} value={myProjects.filter(p => p.status === 'active').length} hint={`${myProjects.length} ${t('total')}`} icon="" />
                  <MiniStat label={t('Cart')} value={cart.length} hint={money(cartSubtotal)} tone="accent" icon="" />
                  <MiniStat label={t('Wallet')} value={money(wallets[user.id] || 0)} hint={t('available balance')} tone="good" icon="" />
                  <MiniStat label={t('Unread')} value={notifications.filter(n => n.userId === user.id && !n.read).length} hint={t('notifications')} icon="" />
                </div>
              </Panel>

              <Panel title={t('Project Budget')} subtitle={t('Budget per active project')}>
                <BarList
                  items={myProjects.filter(p => p.status === 'active').slice(0, 5).map(p => ({ label: p.name, value: Math.round(p.budget), hint: p.city }))}
                  format={money}
                  emptyLabel={t('No active projects')}
                />
              </Panel>
            </>
          }
        />
      </>
    );
  };

  const renderProfile = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Customer Profile')}
        hint={t('Enter name, company details, contact information, delivery addresses, business documents and account settings.')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => onNavigate('settings')}> {t('Account settings')}</button>}
      />
      <div className="ws-grid-2">
        <Panel title={user.companyName || user.name} subtitle={user.email}>
          <ul className="ws-detail-list">
            <li><span>{t('Contact')}</span><strong>{user.name}</strong></li>
            <li><span>{t('Phone')}</span><strong>{user.phone || '-'}</strong></li>
            <li><span>{t('Email')}</span><strong>{user.email}</strong></li>
            <li><span>{t('Address')}</span><strong>{user.address || '-'}</strong></li>
            <li><span>{t('City')}</span><strong>{user.city || '-'}</strong></li>
            <li><span>GPS coordinates</span><strong>{Number.isFinite(user.lat) && Number.isFinite(user.lng) ? `Lat ${Math.abs(user.lat as number).toFixed(5)}° ${(user.lat as number) >= 0 ? 'N' : 'S'}, Lng ${Math.abs(user.lng as number).toFixed(5)}° ${(user.lng as number) >= 0 ? 'E' : 'W'} (WGS84)` : 'Not set'}</strong></li>
          </ul>
          <button className="btn btn-secondary btn-sm" onClick={onSaveMyLocation}> {t('Save my location')}</button>
        </Panel>
        <Panel title="Business documents" subtitle="Used on purchase orders and invoices">
          <ul className="ws-detail-list">
            <li><span>TIN</span><strong>{user.tinNumber || '-'}</strong></li>
            <li><span>Business licence</span><strong>{user.businessLicense || '-'}</strong></li>
            <li><span>VAT</span><strong>{user.vatRegistered ? `Registered - ${user.vatNumber || '-'}` : 'Not registered'}</strong></li>
            <li><span>{t('Projects')}</span><strong>{myProjects.length}</strong></li>
            <li><span>{t('Orders')}</span><strong>{myOrders.length}</strong></li>
          </ul>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('settings')}>{t('Edit')} documents</button>
        </Panel>
      </div>
    </>
  );

  const renderProjects = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Project Management')}
        hint={t('Create and manage projects, construction sites, budgets, timelines, project managers and material schedules.')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => openProject()}> {t('New project')}</button>}
      />
      <KpiGrid>
        <Kpi label="Projects" value={myProjects.length} icon="" />
        <Kpi label={t('Active')} value={myProjects.filter(p => p.status === 'active').length} icon="" tone="good" />
        <Kpi label="Total budget" value={money(myProjects.reduce((s, p) => s + p.budget, 0))} icon="" tone="accent" />
        <Kpi label={t('On hold')} value={myProjects.filter(p => p.status === 'on_hold').length} icon="" tone="warn" />
      </KpiGrid>
      {myProjects.length === 0 ? (
        <Panel><EmptyState icon="" title="No projects yet" text="Create a project to organise budgets, sites and material requests." action={<button className="btn btn-primary" onClick={() => openProject()}>Create project</button>} /></Panel>
      ) : (
        <div className="ws-project-grid">
          {myProjects.map(project => {
            const projectOrders = myOrders.filter(o => o.address === project.siteAddress);
            const projectSpend = projectOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0);
            const used = project.budget ? Math.min(100, Math.round((projectSpend / project.budget) * 100)) : 0;
            return (
              <div key={project.id} className="ws-project">
                <div className="ws-project-head">
                  <strong>{project.name}</strong>
                  <StatusPill label={t(project.status)} tone={project.status === 'active' ? 'good' : project.status === 'on_hold' ? 'warn' : 'info'} />
                </div>
                <p>{project.description || 'No description'}</p>
                <ul className="ws-detail-list">
                  <li><span>{t('Site')}</span><strong>{project.siteAddress}, {project.city}</strong></li>
                  <li><span>{t('Manager')}</span><strong>{project.managerName} - {project.managerPhone}</strong></li>
                  <li><span>{t('Schedule')}</span><strong>{formatDate(project.startDate)}  to  {project.endDate ? formatDate(project.endDate) : 'Open'}</strong></li>
                  <li><span>{t('Budget')}</span><strong>{money(project.budget)}</strong></li>
                  <li><span>Spent</span><strong>{money(projectSpend)} ({used}%)</strong></li>
                </ul>
                <div className="ws-progress"><span style={{ width: `${used}%` }} /></div>
                <div className="ws-row-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => openProject(project)}>{t('Edit')}</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setSiteDraft({ id: '', label: project.name, address: project.siteAddress, city: project.city, contact: project.managerPhone }); onSection('sites'); }}> Site</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {projectTarget && (
        <Modal
          title={projectTarget.id ? t('Edit') + ' project' : t('New project')}
          onClose={() => setProjectTarget(null)}
          wide
          footer={<><button className="btn btn-secondary" onClick={() => setProjectTarget(null)}>{t('Cancel')}</button><button className="btn btn-primary" onClick={saveProject}>{t('Save')}</button></>}
        >
          <div className="ws-form">
            <Field label={t('Name')} required>
              <input value={projectDraft.name} onChange={e => setProjectDraft(prev => ({ ...prev, name: e.target.value }))} placeholder="Bole residential tower" />
            </Field>
            <Field label={t('Description')}>
              <textarea rows={2} value={projectDraft.description} onChange={e => setProjectDraft(prev => ({ ...prev, description: e.target.value }))} />
            </Field>
            <div className="ws-form-row">
              <Field label={t('Budget')}>
                <input type="number" min="0" value={projectDraft.budget} onChange={e => setProjectDraft(prev => ({ ...prev, budget: parseFloat(e.target.value) || 0 }))} />
              </Field>
              <Field label={t('Status')}>
                <select value={projectDraft.status} onChange={e => setProjectDraft(prev => ({ ...prev, status: e.target.value as Project['status'] }))}>
                  <option value="planning">{t('Planning')}</option>
                  <option value="active">{t('Active')}</option>
                  <option value="on_hold">{t('On hold')}</option>
                  <option value="completed">{t('Completed')}</option>
                </select>
              </Field>
            </div>
            <div className="ws-form-row">
              <Field label={t('Site address')}>
                <input value={projectDraft.siteAddress} onChange={e => setProjectDraft(prev => ({ ...prev, siteAddress: e.target.value }))} />
              </Field>
              <Field label={t('City')}>
                <input value={projectDraft.city} onChange={e => setProjectDraft(prev => ({ ...prev, city: e.target.value }))} />
              </Field>
            </div>
            <div className="ws-form-row">
              <Field label={t('Manager')}>
                <input value={projectDraft.managerName} onChange={e => setProjectDraft(prev => ({ ...prev, managerName: e.target.value }))} />
              </Field>
              <Field label={t('Phone')}>
                <input value={projectDraft.managerPhone} onChange={e => setProjectDraft(prev => ({ ...prev, managerPhone: e.target.value }))} />
              </Field>
            </div>
            <div className="ws-form-row">
              <Field label="Start"><input type="date" value={projectDraft.startDate} onChange={e => setProjectDraft(prev => ({ ...prev, startDate: e.target.value }))} /></Field>
              <Field label="End"><input type="date" value={projectDraft.endDate} onChange={e => setProjectDraft(prev => ({ ...prev, endDate: e.target.value }))} /></Field>
            </div>
            <Field label={t('Notes')}>
              <textarea rows={2} value={projectDraft.notes || ''} onChange={e => setProjectDraft(prev => ({ ...prev, notes: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );

  const renderSites = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Site & GPS Location')}
        hint={t('Add construction-site GPS locations and saved delivery addresses. Measure distances from supplier warehouses.')}
        actions={<button className="btn btn-secondary btn-sm" onClick={onSaveMyLocation}> {t('Save my location')}</button>}
      />
      <div className="ws-grid-2">
        <Panel title="Add a site" subtitle="Sites are used on RFQs and delivery addresses">
          <div className="ws-form">
            <Field label={t('Label')} required>
              <input value={siteDraft.label} onChange={e => setSiteDraft(prev => ({ ...prev, label: e.target.value }))} placeholder="Main site - Bole" />
            </Field>
            <Field label={t('Address')} required>
              <input value={siteDraft.address} onChange={e => setSiteDraft(prev => ({ ...prev, address: e.target.value }))} />
            </Field>
            <div className="ws-form-row">
              <Field label={t('City')}>
                <input value={siteDraft.city} onChange={e => setSiteDraft(prev => ({ ...prev, city: e.target.value }))} />
              </Field>
              <Field label="Site contact">
                <input value={siteDraft.contact} onChange={e => setSiteDraft(prev => ({ ...prev, contact: e.target.value }))} />
              </Field>
            </div>
            <button className="btn btn-primary" onClick={saveSite}> {t('Save')}</button>
          </div>
        </Panel>
        <Panel title="Saved sites" subtitle={`${sites.length} sites on this device`}>
          {sites.length === 0 ? <EmptyState icon="" title="No saved sites" text="Add a site to reuse its address in RFQs." /> : (
            <ul className="ws-alert-list">
              {sites.map(site => (
                <li key={site.id}>
                  <span></span>
                  <div><strong>{site.label}</strong><small>{site.address}, {site.city}{site.contact ? ` - ${site.contact}` : ''}</small></div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSiteDraft(site)}>{t('Edit')}</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );

  const renderSearch = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Smart Product Search')}
        hint={t('Search by product name, category, specification, grade, price, availability and supplier location.')}
      />
      <div className="ws-searchbar">
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={t('Search products, grades, suppliers...')} aria-label="Search products" />
        <select value={searchCategory} onChange={e => setSearchCategory(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {Array.from(new Set(materials.map(m => m.category))).map(category => <option key={category} value={category}>{category}</option>)}
        </select>
        <select value={searchSort} onChange={e => setSearchSort(e.target.value as typeof searchSort)} aria-label="Sort">
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="rating">Best rated</option>
          <option value="distance">Nearest supplier</option>
        </select>
      </div>
      <p className="ws-muted">{catalogue.length} products - {compare.length} selected for comparison</p>
      {catalogue.length === 0 ? <EmptyState icon="" title="No products match" text="Try another grade, category or supplier." /> : (
        <div className="ws-product-grid">
          {catalogue.map(material => {
            const supplier = supplierFor(material.companyId);
            const distance = supplier ? distanceTo(supplier) : null;
            const rating = effectiveRating(material.rating, reviews.filter(r => r.materialId === material.id));
            return (
              <div key={material.id} className="ws-product">
                <div className="ws-product-media">
                  {material.images?.[0] ? <img src={material.images[0]} alt={material.name} loading="lazy" /> : <span>{material.category?.slice(0, 2).toUpperCase() || ''}</span>}
                </div>
                <div className="ws-product-body">
                  <div className="ws-product-head">
                    <strong>{material.name}</strong>
                    <span>{money(material.price)}<small>/{material.unit}</small></span>
                  </div>
                  <small>{supplier?.name || 'Supplier'} - {supplier?.city || ''}{distance !== null ? ` - ${distance.toFixed(1)} km` : ''}</small>
                  <div className="ws-chip-row">
                    <StatusPill label={material.quantity > 10 ? t('Available') : material.quantity > 0 ? 'Low stock' : 'Out of stock'} tone={material.quantity > 10 ? 'good' : material.quantity > 0 ? 'warn' : 'bad'} />
                    <StatusPill label={`* ${rating.toFixed(1)}`} tone="muted" />
                    {material.brand && <StatusPill label={material.brand} tone="info" />}
                  </div>
                  <div className="ws-row-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => onOpenProduct(material)}>{t('View')}</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => onToggleCompare(material.id)} aria-pressed={compare.includes(material.id)}>{compare.includes(material.id) ? '[OK] Comparing' : t('Compare')}</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => openRfqFor(material)}></button>
                    <button className="btn btn-primary btn-sm" onClick={() => onAddToCart(material, material.minOrder || 1)}>{t('Add to cart')}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const renderSuppliers = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Supplier Discovery')}
        hint={t('Find verified suppliers by location, available products, distance, rating and price competitiveness.')}
      />
      <KpiGrid>
        <Kpi label="Suppliers" value={companies.length} icon="" />
        <Kpi label={t('Verified')} value={companies.filter(c => c.complianceStatus === 'compliant').length} icon="[OK]" tone="good" />
        <Kpi label="Within 25 km" value={companies.filter(c => { const d = distanceTo(c); return d !== null && d <= 25; }).length} icon="" />
        <Kpi label="Cities" value={new Set(companies.map(c => c.city)).size} icon="" />
      </KpiGrid>
      <div className="ws-supplier-grid">
        {companies.map(company => {
          const distance = distanceTo(company);
          const products = materials.filter(m => m.companyId === company.id);
          const rating = effectiveRating(company.rating, reviews.filter(r => products.some(m => m.id === r.materialId)));
          return (
            <div key={company.id} className="ws-supplier">
              <div className="ws-supplier-head">
                <strong>{company.name}</strong>
                <StatusPill label={t(company.complianceStatus)} tone={toneFor(company.complianceStatus)} />
              </div>
              <p>{company.description || 'No description'}</p>
              <ul className="ws-detail-list">
                <li><span>{t('Location')}</span><strong>{company.city}{distance !== null ? ` - ${distance.toFixed(1)} km` : ''}</strong></li>
                <li><span>{t('Products')}</span><strong>{products.length}</strong></li>
                <li><span>{t('Rating')}</span><strong>* {rating.toFixed(1)} - {company.totalOrders} orders</strong></li>
                <li><span>{t('Working hours')}</span><strong>{company.workingHours || '-'}</strong></li>
              </ul>
              <div className="ws-row-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => onOpenMap(company.id)}> {t('Supplier Map')}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setMessageDraft({ to: company.userId, title: '', body: '' })}></button>
                <button className="btn btn-primary btn-sm" onClick={() => { setSearchTerm(company.name); onSection('search'); }}>{t('View products')}</button>
              </div>
            </div>
          );
        })}
        {companies.length === 0 && <EmptyState icon="" title="No suppliers yet" />}
      </div>
    </>
  );

  const renderCompare = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Product Comparison')}
        hint={t('Compare specifications, grades, prices, stock availability, supplier ratings and delivery terms side by side.')}
        actions={<button className="btn btn-secondary btn-sm" onClick={() => onSection('search')}> {t('Add')} products</button>}
      />
      {compareRows.length === 0 ? (
        <Panel><EmptyState icon="" title="Nothing to compare" text="Choose Compare on any product in Smart Product Search." action={<button className="btn btn-primary" onClick={() => onSection('search')}>Browse products</button>} /></Panel>
      ) : (
        <Panel title={`${compareRows.length} products`} subtitle="Lowest price in each row is highlighted">
          <div className="table-scroll-container">
            <table className="data-table ws-table ws-compare">
              <thead>
                <tr>
                  <th>Attribute</th>
                  {compareRows.map(material => <th key={material.id}>{material.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {([
                  ['Supplier', (m: Material) => supplierFor(m.companyId)?.name || '-'],
                  ['Price', (m: Material) => money(m.price) + ' / ' + m.unit],
                  ['Minimum order', (m: Material) => `${m.minOrder} ${m.unit}`],
                  ['Stock', (m: Material) => `${m.quantity.toLocaleString()} ${m.unit}`],
                  ['Grade', (m: Material) => m.specifications?.grade || m.brand || '-'],
                  ['Origin', (m: Material) => m.specifications?.origin || '-'],
                  ['Rating', (m: Material) => `* ${effectiveRating(m.rating, reviews.filter(r => r.materialId === m.id)).toFixed(1)}`],
                  ['Delivery', (m: Material) => m.delivery?.offered ? `${money(m.delivery.perKm)}/km` : 'Not offered'],
                  ['Distance', (m: Material) => { const s = supplierFor(m.companyId); const d = s ? distanceTo(s) : null; return d !== null ? `${d.toFixed(1)} km` : '-'; }],
                ] as [string, (m: Material) => string][]).map(([label, read]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {compareRows.map(material => (
                      <td key={material.id} className={label === 'Price' && material.price === Math.min(...compareRows.map(m => m.price)) ? 'ws-best' : ''}>
                        {read(material)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">Action</th>
                  {compareRows.map(material => (
                    <td key={material.id}>
                      <div className="ws-row-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => onAddToCart(material, material.minOrder || 1)}>{t('Add to cart')}</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => onToggleCompare(material.id)}>[X]</button>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );

  const renderAi = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('AI Procurement Assistant')}
        hint={t('Receive recommended suppliers, alternative products, offer comparisons and cost-saving opportunities based on your projects and order history.')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => onNavigate('copilot')}> Ask Copilot</button>}
      />
      <KpiGrid>
        <Kpi label="Recommended suppliers" value={analytics.topSuppliers.length} icon="" />
        <Kpi label="Cost-saving leads" value={materials.filter(m => m.price < analytics.productCount && m.quantity > 20).length} hint="In-stock alternatives" icon="" tone="accent" />
        <Kpi label="Average order" value={money(analytics.avgOrderValue)} icon="" />
        <Kpi label="Open RFQs" value={myRfqs.filter(r => r.status === 'open').length} icon="" />
      </KpiGrid>
      <Panel title="Recommended suppliers" subtitle="Ranked by delivered revenue and customer rating">
        <BarList items={analytics.topSuppliers.slice(0, 8).map(s => ({ label: s.name, value: Math.round(s.revenue), hint: `${s.city} - * ${s.rating.toFixed(1)} - ${s.products} products` }))} format={money} emptyLabel="Not enough marketplace data yet" />
      </Panel>
      <div className="ws-grid-2">
        <Panel title="Best-value products" subtitle="Lowest unit price among in-stock listings">
          <ul className="ws-alert-list">
            {[...materials].filter(m => m.quantity > 0).sort((a, b) => a.price - b.price).slice(0, 6).map(material => (
              <li key={material.id}>
                <span></span>
                <div><strong>{material.name}</strong><small>{money(material.price)}/{material.unit} - {supplierFor(material.companyId)?.name}</small></div>
                <button className="btn btn-secondary btn-sm" onClick={() => onOpenProduct(material)}>{t('View')}</button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Insights for your account">
          <ul className="ws-insight-list">
            {analytics.insights.map((insight, index) => <li key={index}> {insight}</li>)}
            <li> Sending one RFQ to three or more suppliers typically improves the delivered price.</li>
            <li> Compare delivered cost, not unit price: transport can reverse the ranking.</li>
          </ul>
        </Panel>
      </div>
    </>
  );

  const renderPriceIntelligence = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Price Intelligence')}
        hint={t('Track current prices, historical movement, price alerts and the source of each price.')}
      />
      <KpiGrid>
        <Kpi label="Tracked products" value={materials.length} icon="" />
        <Kpi label="Rising" value={materials.filter(m => (forecastPrice(m.priceHistory, m.price)?.trend || 'flat') === 'up').length} icon="" tone="warn" />
        <Kpi label="Falling" value={materials.filter(m => (forecastPrice(m.priceHistory, m.price)?.trend || 'flat') === 'down').length} icon="" tone="good" />
        <Kpi label="Price snapshots" value={materials.reduce((s, m) => s + (m.priceHistory?.length || 0), 0)} icon="" />
      </KpiGrid>
      <Panel title="Market price board" subtitle="Source: supplier catalogue and price snapshots">
        <DataTable
          rows={materials}
          columns={[
            { key: 'name', header: 'Product', value: m => m.name },
            { key: 'category', header: 'Category', value: m => m.category },
            { key: 'supplier', header: 'Supplier', value: m => supplierFor(m.companyId)?.name || '-' },
            { key: 'price', header: 'Price', align: 'right', value: m => Math.round(m.price), render: m => <>{money(m.price)} <small>/{m.unit}</small></> },
            {
              key: 'change', header: 'Change', align: 'right',
              value: m => {
                const history = m.priceHistory || [];
                return history.length > 1 ? Math.round(((m.price - history[0].price) / (history[0].price || 1)) * 1000) / 10 : 0;
              },
              render: m => {
                const history = m.priceHistory || [];
                if (history.length < 2) return <span className="ws-muted">No history</span>;
                const pct = ((m.price - history[0].price) / (history[0].price || 1)) * 100;
                return <StatusPill label={`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`} tone={pct > 5 ? 'warn' : pct < -5 ? 'good' : 'muted'} />;
              },
            },
            {
              key: 'forecast', header: 'Next', align: 'right',
              value: m => forecastPrice(m.priceHistory, m.price)?.next || m.price,
              render: m => {
                const forecast = forecastPrice(m.priceHistory, m.price);
                return forecast ? money(forecast.next) : <span className="ws-muted">-</span>;
              },
            },
            { key: 'updated', header: 'Updated', value: m => m.lastUpdated, render: m => <span className="ws-nowrap">{formatDate(m.lastUpdated)}</span> },
          ]}
          searchText={m => `${m.name} ${m.category}`}
          exportName="price_intelligence"
          pageSize={12}
        />
      </Panel>
    </>
  );

  const renderRfqs = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Request for Quotation')}
        hint={t('Send one request to multiple eligible suppliers with product details, quantity, delivery site and required date.')}
      />
      <div className="ws-grid-2">
        <Panel title={t('New request')} subtitle="Select the suppliers you want to hear from">
          <div className="ws-form">
            <Field label={t('Product')} required>
              <select value={rfqDraft.materialId} onChange={e => setRfqDraft(prev => ({ ...prev, materialId: e.target.value }))}>
                <option value="">Choose a product...</option>
                {materials.map(material => <option key={material.id} value={material.id}>{material.name} - {material.category} - {money(material.price)}/{material.unit}</option>)}
              </select>
            </Field>
            <div className="ws-form-row">
              <Field label={t('Quantity')} required>
                <input type="number" min="1" value={rfqDraft.quantity} onChange={e => setRfqDraft(prev => ({ ...prev, quantity: e.target.value }))} />
              </Field>
              <Field label={t('Required by')}>
                <input type="date" value={rfqDraft.requiredBy} onChange={e => setRfqDraft(prev => ({ ...prev, requiredBy: e.target.value }))} />
              </Field>
            </div>
            <Field label="Suppliers" hint="Leave all unchecked to publish the request to every supplier.">
              <div className="ws-checkbox-list">
                {companies.map(company => (
                  <label key={company.id}>
                    <input
                      type="checkbox"
                      checked={rfqDraft.supplierIds.includes(company.id)}
                      onChange={e => setRfqDraft(prev => ({
                        ...prev,
                        supplierIds: e.target.checked ? [...prev.supplierIds, company.id] : prev.supplierIds.filter(id => id !== company.id),
                      }))}
                    />
                    {company.name} <small>{company.city}</small>
                  </label>
                ))}
              </div>
            </Field>
            <Field label={t('Notes')}>
              <textarea rows={2} value={rfqDraft.notes} onChange={e => setRfqDraft(prev => ({ ...prev, notes: e.target.value }))} placeholder="Grade, delivery conditions, payment terms..." />
            </Field>
            <button className="btn btn-primary" onClick={submitRfq}> {t('Send')}</button>
          </div>
        </Panel>
        <Panel title="My requests" subtitle={`${myRfqs.length} total`}>
          {myRfqs.length === 0 ? <EmptyState icon="" title="No RFQs yet" text="Send your first request to collect comparable offers." /> : (
            <ul className="ws-feed">
              {myRfqs.map(rfq => (
                <li key={rfq.id}>
                  <span className="ws-feed-icon"></span>
                  <div><strong>{rfq.materialName} - {rfq.quantity} {rfq.unit}</strong><small>{rfq.city} - required {formatDate(rfq.requiredBy)} - {quotations.filter(q => q.rfqId === rfq.id).length} quotes</small></div>
                  <StatusPill label={t(rfq.status)} tone={toneFor(rfq.status)} />
                </li>
              ))}
            </ul>
          )}
          {myRfqs.some(r => quotations.some(q => q.rfqId === r.id)) && (
            <button className="btn btn-secondary btn-sm" onClick={() => onSection('quotation-compare')}>{t('Compare')} quotations</button>
          )}
        </Panel>
      </div>
    </>
  );

  const renderQuotationCompare = () => {
    const grouped = myRfqs
      .map(rfq => ({ rfq, quotes: myQuotes.filter(q => q.rfqId === rfq.id) }))
      .filter(group => group.quotes.length > 0);
    return (
      <>
        <SectionHeader
          eyebrow={t('Customers')}
          title={t('Quotation Comparison')}
          hint={t('Compare supplier prices, transport charges, delivery times, terms and total delivered cost before accepting.')}
        />
        {grouped.length === 0 ? (
          <Panel><EmptyState icon="" title="No quotations yet" text="Suppliers respond to your RFQs here." action={<button className="btn btn-primary" onClick={() => onSection('rfqs')}>Open RFQs</button>} /></Panel>
        ) : grouped.map(({ rfq, quotes }) => {
          const best = Math.min(...quotes.map(q => q.unitPrice * q.quantity + q.deliveryFee));
          return (
            <Panel key={rfq.id} title={rfq.materialName} subtitle={`${rfq.quantity} ${rfq.unit} - ${rfq.city} - required ${formatDate(rfq.requiredBy)}`}>
              <div className="table-scroll-container">
                <table className="data-table ws-table">
                  <thead><tr><th>Supplier</th><th>Unit price</th><th>Subtotal</th><th>Delivery</th><th>Delivered total</th><th>Valid until</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {quotes.map(quote => {
                      const total = quote.unitPrice * quote.quantity + quote.deliveryFee;
                      return (
                        <tr key={quote.id}>
                          <td><strong>{quote.supplierName}</strong>{quote.notes && <small className="ws-block">{quote.notes}</small>}</td>
                          <td>{money(quote.unitPrice)}</td>
                          <td>{money(quote.unitPrice * quote.quantity)}</td>
                          <td>{money(quote.deliveryFee)}</td>
                          <td className={total === best ? 'ws-best' : ''}><strong>{money(total)}</strong>{total === best && <small className="ws-block">Best delivered price</small>}</td>
                          <td className="ws-nowrap">{formatDate(quote.validUntil)}</td>
                          <td><StatusPill label={t(quote.status)} tone={toneFor(quote.status)} /></td>
                          <td>
                            <div className="ws-row-actions">
                              {quote.status === 'submitted' && <button className="btn btn-primary btn-sm" onClick={() => decideQuote(quote, true)}>{t('Accept')}</button>}
                              {quote.status === 'submitted' && <button className="btn btn-secondary btn-sm" onClick={() => decideQuote(quote, false)}>{t('Decline')}</button>}
                              {quote.status === 'accepted' && <button className="btn btn-secondary btn-sm" onClick={() => prepareQuote(quote)}> {t('Order')}</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          );
        })}
      </>
    );
  };

  const renderCart = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Shopping Cart')}
        hint={t('Review quantities, unit prices, subtotals, VAT and delivery charges, then continue to the purchase step.')}
        actions={cart.length ? <button className="btn btn-secondary btn-sm" onClick={onClearCart}>{t('Clear cart')}</button> : undefined}
      />
      {cart.length === 0 ? (
        <Panel><EmptyState icon="" title="Your cart is empty" text="Products you add from search appear here." action={<button className="btn btn-primary" onClick={() => onSection('search')}>Find products</button>} /></Panel>
      ) : (
        <div className="ws-grid-2">
          <Panel title={`${cart.length} line${cart.length === 1 ? '' : 's'}`} subtitle="One supplier per order keeps delivery pricing honest">
            <div className="ws-cart">
              {cart.map((item: CartItem) => (
                <div key={item.id} className="ws-cart-line">
                  <div>
                    <strong>{item.materialName}</strong>
                    <small>{item.supplierName} - {money(item.price)} / {item.unit} - {item.includeDelivery === false ? 'Collection' : 'Delivery included'}</small>
                  </div>
                  <div className="ws-qty">
                    <button className="btn btn-secondary btn-sm" onClick={() => onUpdateCartQty(item.id, item.quantity - 1)} aria-label={'Decrease ' + item.materialName}>-</button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      aria-label={'Quantity for ' + item.materialName}
                      onChange={event => onUpdateCartQty(item.id, parseInt(event.target.value, 10) || 1)}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={() => onUpdateCartQty(item.id, item.quantity + 1)} aria-label={'Increase ' + item.materialName}>+</button>
                  </div>
                  <strong className="ws-nowrap">{money(item.price * item.quantity)}</strong>
                  <button className="btn btn-secondary btn-sm" onClick={() => onRemoveFromCart(item.id)} aria-label={'Remove ' + item.materialName}>[X]</button>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Summary" subtitle="Delivery is confirmed at checkout from the real road distance">
            <ul className="ws-detail-list">
              <li><span>Subtotal</span><strong>{money(cartSubtotal)}</strong></li>
              <li><span>VAT</span><strong>{money(cart.reduce((s, item) => s + item.price * item.quantity * (item.vatPercentage || 0) / 100, 0))}</strong></li>
              <li><span>Products</span><strong>{cart.length}</strong></li>
              <li className="ws-total-row"><span>Estimated total</span><strong>{money(cartSubtotal + cart.reduce((s, item) => s + item.price * item.quantity * (item.vatPercentage || 0) / 100, 0))}</strong></li>
            </ul>
            <p className="ws-note">Delivery and the final payable total are calculated on the checkout page using the supplier's published rate and the measured distance to your site.</p>
            <button className="btn btn-primary" onClick={onCheckout}>{t('Proceed to checkout')}</button>
          </Panel>
        </div>
      )}
    </>
  );

  const renderProforma = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Proforma & Purchase Orders')}
        hint={t('Review supplier proformas, confirm procurement details and issue purchase orders.')}
      />
      <KpiGrid>
        <Kpi label={t('Orders')} value={myOrders.length} icon="" />
        <Kpi label="Awaiting supplier" value={myOrders.filter(o => o.status === 'pending').length} icon="" tone="warn" />
        <Kpi label={t('Confirmed')} value={myOrders.filter(o => o.status === 'confirmed').length} icon="[OK]" tone="good" />
        <Kpi label="Order value" value={money(myOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0))} icon="" tone="accent" />
      </KpiGrid>
      <Panel>
        <DataTable
          rows={myOrders}
          columns={[
            { key: 'invoiceNumber', header: 'Reference', value: o => o.invoiceNumber, render: o => <strong>{o.invoiceNumber}</strong> },
            { key: 'supplier', header: 'Supplier', value: o => supplierFor(o.companyId)?.name || '-' },
            { key: 'material', header: 'Material', value: o => materialFor(o.materialId)?.name || '-' },
            { key: 'quantity', header: 'Qty', align: 'right', value: o => o.quantity },
            { key: 'totalAmount', header: 'Total', align: 'right', value: o => Math.round(o.totalAmount), render: o => money(o.totalAmount) },
            { key: 'paymentStatus', header: 'Payment', value: o => o.paymentStatus, render: o => <StatusPill label={t(o.paymentStatus)} tone={toneFor(o.paymentStatus)} /> },
            { key: 'status', header: 'Status', value: o => o.status, render: o => <StatusPill label={t(o.status)} tone={toneFor(o.status)} /> },
            {
              key: 'actions', header: 'Actions', align: 'right', noExport: true,
              render: o => (
                <div className="ws-row-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => setDocTarget({ order: o, kind: 'proforma' })}>Proforma</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setDocTarget({ order: o, kind: 'invoice' })}></button>
                  {o.status === 'pending' && <button className="btn btn-secondary btn-sm" onClick={() => onUpdateOrderStatus(o.id, 'cancelled')}>{t('Cancel')}</button>}
                </div>
              ),
            },
          ]}
          searchText={o => `${o.invoiceNumber} ${supplierFor(o.companyId)?.name || ''}`}
          exportName="my_purchase_orders"
        />
      </Panel>
    </>
  );

  const renderPayments = () => {
    const myTransactions = transactions.filter(tx => tx.userId === user.id);
    const unpaid = myOrders.filter(o => o.paymentStatus === 'pending' && o.status !== 'cancelled');
    return (
      <>
        <SectionHeader
          eyebrow={t('Customers')}
          title={t('Payment Centre')}
          hint={t('View payment instructions, supported methods, confirmations, receipts and complete payment history.')}
          actions={<button className="btn btn-primary btn-sm" onClick={onCheckout}> {t('Checkout')}</button>}
        />
        <KpiGrid>
          <Kpi label="Wallet balance" value={money(wallets[user.id] || 0)} icon="" tone="accent" />
          <Kpi label="Outstanding" value={money(unpaid.reduce((s, o) => s + o.totalAmount, 0))} hint={`${unpaid.length} unpaid orders`} icon="" tone={unpaid.length ? 'warn' : 'good'} />
          <Kpi label="Paid orders" value={myOrders.filter(o => o.paymentStatus === 'paid').length} icon="[OK]" />
          <Kpi label="Transactions" value={myTransactions.length} icon="" />
        </KpiGrid>
        <div className="ws-grid-2">
          <Panel title="Payment methods" subtitle="Choose a method at checkout">
            <ul className="ws-detail-list">
              <li><span>E-SCON Wallet</span><strong>Instant - {money(wallets[user.id] || 0)} available</strong></li>
              <li><span>Bank transfer</span><strong>Awaiting supplier confirmation</strong></li>
              <li><span>Cash on delivery</span><strong>Pay the supplier on arrival</strong></li>
            </ul>
            <p className="ws-note">Wallet payments are marked paid immediately. Bank transfers stay pending until the supplier confirms receipt.</p>
          </Panel>
          <Panel title="Receipts" subtitle="Latest wallet movements">
            {myTransactions.length === 0 ? <EmptyState icon="" title="No transactions yet" /> : (
              <ul className="ws-feed">
                {myTransactions.slice(0, 6).map(tx => (
                  <li key={tx.id}>
                    <span className="ws-feed-icon">{tx.kind === 'refund' ? '' : tx.kind === 'payment' ? '' : ''}</span>
                    <div><strong>{tx.kind} - {money(tx.amount)}</strong><small>{tx.note} - {new Date(tx.date).toLocaleDateString('en-GB')}</small></div>
                    <small className="ws-nowrap">{money(tx.balanceAfter)}</small>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <Panel title="Payment history">
          <DataTable
            rows={myTransactions}
            columns={[
              { key: 'date', header: t('Date'), value: tx => new Date(tx.date).toISOString().slice(0, 10) },
              { key: 'kind', header: 'Type', value: tx => tx.kind, render: tx => <StatusPill label={t(tx.kind)} tone="info" /> },
              { key: 'amount', header: 'Amount', align: 'right', value: tx => Math.round(tx.amount), render: tx => money(tx.amount) },
              { key: 'balanceAfter', header: 'Balance', align: 'right', value: tx => Math.round(tx.balanceAfter), render: tx => money(tx.balanceAfter) },
              { key: 'note', header: 'Note', value: tx => tx.note },
            ]}
            searchText={tx => `${tx.kind} ${tx.note}`}
            exportName="my_payments"
            emptyTitle="No payment history yet"
          />
        </Panel>
      </>
    );
  };

  const renderTracking = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Order Tracking')}
        hint={t('Follow supplier acceptance, preparation, loading, dispatch, GPS progress and arrival for every order.')}
      />
      {myOrders.length === 0 ? <Panel><EmptyState icon="" title="No orders to track" /></Panel> : (
        <div className="ws-track-list">
          {[...myOrders].sort((a, b) => Date.parse(b.orderDate) - Date.parse(a.orderDate)).map(order => {
            const steps = ['pending', 'confirmed', 'shipped', 'delivered'];
            const index = steps.indexOf(order.status);
            const transporter = transporterProfiles.find(p => p.userId === order.transporterId);
            return (
              <div key={order.id} className="ws-track">
                <div className="ws-track-head">
                  <div><strong>{order.invoiceNumber}</strong><small>{materialFor(order.materialId)?.name} - {order.quantity} {materialFor(order.materialId)?.unit} - {supplierFor(order.companyId)?.name}</small></div>
                  <StatusPill label={t(order.status)} tone={toneFor(order.status)} />
                </div>
                <div className="ws-timeline">
                  {steps.map((step, stepIndex) => (
                    <div key={step} className={'ws-step' + (stepIndex <= index ? ' done' : '')}>
                      <span>{stepIndex <= index ? '*' : 'o'}</span>
                      {t(step.charAt(0).toUpperCase() + step.slice(1))}
                    </div>
                  ))}
                </div>
                <div className="ws-track-meta">
                  <span> {transporter?.companyName || 'Transporter not assigned'}</span>
                  <span>{order.transportStatus ? TRANSPORT_STATUS_LABELS[jobStatus(order)] : 'Delivery not requested'}</span>
                  <span> {order.address}</span>
                  {order.transportDeliveredAt && <span>[OK] {formatDate(order.transportDeliveredAt)}</span>}
                  {order.deliveryDate && <span>ETA {formatDate(order.deliveryDate)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const renderDelivery = () => {
    const deliveries = myOrders.filter(o => o.deliveryIncluded || o.transportStatus);
    return (
      <>
        <SectionHeader
          eyebrow={t('Customers')}
          title={t('Delivery Management')}
          hint={t('Manage delivery address, schedule, transport charges and delivery receipt.')}
          actions={<button className="btn btn-secondary btn-sm" onClick={onSaveMyLocation}> {t('Save my location')}</button>}
        />
        <KpiGrid>
          <Kpi label="Deliveries" value={deliveries.length} icon="" />
          <Kpi label="In transit" value={deliveries.filter(o => o.transportStatus === 'in_transit' || o.transportStatus === 'picked_up').length} icon="" />
          <Kpi label={t('Completed')} value={deliveries.filter(o => o.transportStatus === 'delivered').length} icon="" tone="good" />
          <Kpi label="Transport paid" value={money(myOrders.reduce((s, o) => s + (o.transportCost || 0), 0))} icon="" />
        </KpiGrid>
        <Panel title="Delivery address" subtitle="Used by default on new orders">
          <ul className="ws-detail-list">
            <li><span>{t('Address')}</span><strong>{user.address || '-'}</strong></li>
            <li><span>{t('City')}</span><strong>{user.city || '-'}</strong></li>
            <li><span>GPS coordinates</span><strong>{Number.isFinite(user.lat) && Number.isFinite(user.lng) ? `Lat ${Math.abs(user.lat as number).toFixed(5)}° ${(user.lat as number) >= 0 ? 'N' : 'S'}, Lng ${Math.abs(user.lng as number).toFixed(5)}° ${(user.lng as number) >= 0 ? 'E' : 'W'} (WGS84)` : 'Not set'}</strong></li>
          </ul>
        </Panel>
        <Panel title="Delivery schedule">
          <DataTable
            rows={deliveries}
            columns={[
              { key: 'invoiceNumber', header: 'Order', value: o => o.invoiceNumber },
              { key: 'address', header: t('Address'), value: o => o.address },
              { key: 'transporter', header: 'Transporter', value: o => transporterProfiles.find(p => p.userId === o.transporterId)?.companyName || '-' },
              { key: 'charge', header: 'Charge', align: 'right', value: o => Math.round(o.transportCost || 0), render: o => money(o.transportCost || 0) },
              { key: 'date', header: 'Scheduled', value: o => o.deliveryDate || '', render: o => (o.deliveryDate ? formatDate(o.deliveryDate) : '-') },
              { key: 'pod', header: 'Receipt', value: o => o.transportPod?.receivedBy || '', render: o => (o.transportPod ? <StatusPill label={`Received by ${o.transportPod.receivedBy}`} tone="good" /> : <span className="ws-muted">Pending</span>) },
            ]}
            searchText={o => `${o.invoiceNumber} ${o.address}`}
            exportName="deliveries"
            emptyTitle="No deliveries yet"
          />
        </Panel>
      </>
    );
  };

  const renderDocuments = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Documents Centre')}
        hint={t('Access quotations, proformas, invoices, purchase orders, delivery notes and payment receipts.')}
        actions={<button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(myOrders, 'my_orders')}> Export orders</button>}
      />
      <div className="ws-grid-2">
        <Panel title={t('Quotations')} subtitle={`${myQuotes.length} received`}>
          {myQuotes.length === 0 ? <EmptyState icon="" title="No quotations" /> : (
            <ul className="ws-feed">
              {myQuotes.map(quote => (
                <li key={quote.id}>
                  <span className="ws-feed-icon"></span>
                  <div><strong>{quote.supplierName}</strong><small>{rfqById(quote.rfqId)?.materialName} - {money(quote.unitPrice)} - valid {formatDate(quote.validUntil)}</small></div>
                  <StatusPill label={t(quote.status)} tone={toneFor(quote.status)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Orders & invoices" subtitle="Print a proforma or invoice from any order">
          {myOrders.length === 0 ? <EmptyState icon="" title="No documents" /> : (
            <ul className="ws-feed">
              {myOrders.slice(0, 8).map(order => (
                <li key={order.id}>
                  <span className="ws-feed-icon"></span>
                  <div><strong>{order.invoiceNumber}</strong><small>{money(order.totalAmount)} - {formatDate(order.orderDate)}</small></div>
                  <div className="ws-row-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => setDocTarget({ order, kind: 'proforma' })}>Proforma</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setDocTarget({ order, kind: 'invoice' })}>Invoice</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {docTarget && (
        <Modal
          title={`${docTarget.kind === 'proforma' ? 'Proforma invoice' : 'Invoice'} - ${docTarget.order.invoiceNumber}`}
          onClose={() => setDocTarget(null)}
          wide
          footer={<><button className="btn btn-secondary" onClick={() => setDocTarget(null)}>{t('Close')}</button><button className="btn btn-primary" onClick={() => window.print()}> Print</button></>}
        >
          <div className="ws-invoice">
            <div className="ws-invoice-head">
              <div>
                <strong>{user.companyName || user.name}</strong>
                <span>{user.address}, {user.city}</span>
                <span>TIN {user.tinNumber || '-'} - VAT {user.vatNumber || '-'}</span>
              </div>
              <div>
                <strong>{docTarget.kind === 'proforma' ? 'PROFORMA' : 'INVOICE'}</strong>
                <span>{docTarget.order.invoiceNumber}</span>
                <span>{formatDate(docTarget.order.orderDate)}</span>
              </div>
            </div>
            <div className="ws-invoice-parties">
              <div><span>Supplier</span><strong>{supplierFor(docTarget.order.companyId)?.name || '-'}</strong><small>{supplierFor(docTarget.order.companyId)?.location}</small></div>
              <div><span>Deliver to</span><strong>{docTarget.order.address}</strong><small>{t(docTarget.order.status)}</small></div>
            </div>
            <table className="data-table ws-table">
              <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
              <tbody>
                <tr>
                  <td>{materialFor(docTarget.order.materialId)?.name || 'Material'}</td>
                  <td>{docTarget.order.quantity} {materialFor(docTarget.order.materialId)?.unit || ''}</td>
                  <td>{money(docTarget.order.unitPrice)}</td>
                  <td>{money(docTarget.order.unitPrice * docTarget.order.quantity)}</td>
                </tr>
              </tbody>
            </table>
            <ul className="ws-detail-list">
              <li><span>Subtotal</span><strong>{money(docTarget.order.unitPrice * docTarget.order.quantity)}</strong></li>
              <li><span>VAT</span><strong>{money(docTarget.order.vatAmount || 0)}</strong></li>
              <li><span>Delivery</span><strong>{money(docTarget.order.transportCost || 0)}</strong></li>
              <li className="ws-total-row"><span>Total</span><strong>{money(docTarget.order.totalAmount)}</strong></li>
            </ul>
            <p className="ws-note">Payment method: {docTarget.order.paymentMethod || '-'} - Status: {t(docTarget.order.paymentStatus)}</p>
          </div>
        </Modal>
      )}
    </>
  );

  const renderReviews = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Reviews & Complaints')}
        hint={t('Rate suppliers and transporters, report product or delivery problems and track resolution.')}
      />
      <div className="ws-grid-2">
        <Panel title="Rate a purchase" subtitle="Delivered orders only">
          {myOrders.filter(o => o.status === 'delivered').length === 0 ? <EmptyState icon="*" title="No delivered orders" text="You can review a product after delivery." /> : (
            <ul className="ws-alert-list">
              {myOrders.filter(o => o.status === 'delivered').slice(0, 8).map(order => (
                <li key={order.id}>
                  <span>*</span>
                  <div><strong>{materialFor(order.materialId)?.name}</strong><small>{supplierFor(order.companyId)?.name} - {order.invoiceNumber}</small></div>
                  <button className="btn btn-secondary btn-sm" onClick={() => onReview(order.materialId)}>{t('Rate')}</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Report a problem" subtitle="Complaints reach Administration">
          <div className="ws-form">
            <Field label={t('Category')}>
              <select value={complaintDraft.category} onChange={e => setComplaintDraft(prev => ({ ...prev, category: e.target.value as Complaint['category'] }))}>
                <option value="product">Product quality</option>
                <option value="delivery">Delivery</option>
                <option value="payment">Payment</option>
                <option value="quotation">Quotation</option>
                <option value="service">Service</option>
              </select>
            </Field>
            <Field label="Supplier">
              <select value={complaintDraft.againstId} onChange={e => setComplaintDraft(prev => ({ ...prev, againstId: e.target.value }))}>
                <option value="">Select...</option>
                {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </Field>
            <Field label={t('Subject')} required>
              <input value={complaintDraft.subject} onChange={e => setComplaintDraft(prev => ({ ...prev, subject: e.target.value }))} maxLength={80} />
            </Field>
            <Field label={t('Message')} required>
              <textarea rows={4} value={complaintDraft.message} onChange={e => setComplaintDraft(prev => ({ ...prev, message: e.target.value }))} maxLength={500} />
            </Field>
            <button className="btn btn-primary" onClick={submitComplaint}> {t('Submit')}</button>
          </div>
        </Panel>
      </div>
      <Panel title="My complaints" subtitle={`${myComplaints.length} filed`}>
        {myComplaints.length === 0 ? <EmptyState icon="" title="No complaints" /> : (
          <ul className="ws-feed">
            {myComplaints.map(complaint => (
              <li key={complaint.id}>
                <span className="ws-feed-icon"></span>
                <div><strong>{complaint.subject}</strong><small>{complaint.message}{complaint.response ? ` - Response: ${complaint.response}` : ''}</small></div>
                <StatusPill label={t(complaint.status)} tone={toneFor(complaint.status)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );

  const renderAnalytics = () => (
    <>
      <SectionHeader
        eyebrow={t('Customers')}
        title={t('Procurement Analytics')}
        hint={t('Review project expenditure, material quantities, price comparisons and supplier performance.')}
        actions={<button className="btn btn-secondary btn-sm" onClick={() => onNavigate('analytics')}> Full analytics</button>}
      />
      <KpiGrid>
        <Kpi label="Total spend" value={money(spend)} icon="" tone="accent" />
        <Kpi label={t('Orders')} value={myOrders.length} icon="" />
        <Kpi label="Units purchased" value={analytics.unitsSold.toLocaleString()} icon="" />
        <Kpi label={t('Average order value')} value={money(analytics.avgOrderValue)} icon="" />
        <Kpi label="Projects" value={myProjects.length} hint={money(myProjects.reduce((s, p) => s + p.budget, 0)) + ' budget'} icon="" />
        <Kpi label="Growth (30d)" value={analytics.growthPct === null ? '-' : `${analytics.growthPct >= 0 ? '+' : ''}${analytics.growthPct.toFixed(1)}%`} icon="" tone={(analytics.growthPct || 0) >= 0 ? 'good' : 'bad'} />
      </KpiGrid>
      <div className="ws-grid-2">
        <Panel title="Spend by month"><BarList items={analytics.monthlyRevenue.map(p => ({ label: p.label, value: p.value }))} format={money} /></Panel>
        <Panel title="Spend by category"><BarList items={analytics.categoryData.map(p => ({ label: p.label, value: p.value }))} format={money} /></Panel>
      </div>
      <Panel title="Products purchased" subtitle="Volume and value by product">
        <DataTable
          rows={analytics.topProducts}
          columns={[
            { key: 'name', header: t('Product'), value: p => p.name },
            { key: 'supplier', header: 'Supplier', value: p => p.supplierName },
            { key: 'units', header: 'Units', align: 'right', value: p => p.units },
            { key: 'revenue', header: 'Spend', align: 'right', value: p => Math.round(p.revenue), render: p => money(p.revenue) },
            { key: 'rating', header: t('Rating'), align: 'right', value: p => p.rating, render: p => `* ${p.rating.toFixed(1)}` },
          ]}
          searchText={p => `${p.name} ${p.supplierName}`}
          exportName="procurement_analytics"
          emptyTitle="No purchases yet"
        />
      </Panel>
      <Panel title={t('Supplier Performance')}>
        <BarList items={analytics.topSuppliers.slice(0, 8).map(s => ({ label: s.name, value: Math.round(s.revenue), hint: `* ${s.rating.toFixed(1)}` }))} format={money} />
      </Panel>
    </>
  );

  const renderNotifications = () => {
    const mine = notifications.filter(n => n.userId === user.id).slice().sort((a, b) => b.createdAt - a.createdAt);
    const suppliers = Array.from(new Set(myOrders.map(o => o.companyId))).map(supplierFor).filter((c): c is Company => Boolean(c));
    return (
      <>
        <SectionHeader
          eyebrow={t('Customers')}
          title={t('Notifications & Messages')}
          hint={t('Receive quotation updates, price alerts, order and delivery updates, and exchange messages with suppliers.')}
        />
        <div className="ws-grid-2">
          <Panel title={t('Send')} subtitle="Message a supplier you have ordered from">
            <div className="ws-form">
              <Field label="Supplier" required>
                <select value={messageDraft.to} onChange={e => setMessageDraft(prev => ({ ...prev, to: e.target.value }))}>
                  <option value="">Select...</option>
                  {suppliers.map(company => <option key={company.id} value={company.userId}>{company.name}</option>)}
                </select>
              </Field>
              <Field label={t('Subject')} required>
                <input value={messageDraft.title} onChange={e => setMessageDraft(prev => ({ ...prev, title: e.target.value }))} maxLength={80} />
              </Field>
              <Field label={t('Message')} required>
                <textarea rows={4} value={messageDraft.body} onChange={e => setMessageDraft(prev => ({ ...prev, body: e.target.value }))} maxLength={400} />
              </Field>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!messageDraft.to || !messageDraft.title.trim() || !messageDraft.body.trim()) {
                    onNotify('Choose a supplier and write a subject and message.', 'warning');
                    return;
                  }
                  onSendMessage(messageDraft.to, messageDraft.title.trim(), messageDraft.body.trim());
                  onNotify('Message sent', 'success');
                  setMessageDraft({ to: '', title: '', body: '' });
                }}
              >
                 {t('Send')}
              </button>
            </div>
          </Panel>
          <Panel title={t('Inbox')} subtitle={`${mine.filter(n => !n.read).length} unread`}>
            {mine.length === 0 ? <EmptyState icon="" title="No notifications yet" /> : (
              <ul className="ws-feed">
                {mine.slice(0, 10).map(item => (
                  <li key={item.id}>
                    <span className="ws-feed-icon">{item.type === 'order' ? '' : item.type === 'payment' ? '' : item.type === 'stock' ? '[!]' : ''}</span>
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

  const renderSectionBody = () => {
    switch (section) {
      case 'dashboard': case 'home': return renderDashboard();
      case 'profile': return renderProfile();
      case 'projects': return renderProjects();
      case 'sites': return renderSites();
      case 'search': return renderSearch();
      case 'marketplace': return renderSearch();
      case 'suppliers': return renderSuppliers();
      case 'compare': return renderCompare();
      case 'map': return renderSuppliers();
      case 'ai': return renderAi();
      case 'price-intelligence': return renderPriceIntelligence();
      case 'rfqs': case 'rfq': return renderRfqs();
      case 'quotation-compare': case 'quotations': return renderQuotationCompare();
      case 'cart': return renderCart();
      case 'proforma': return renderProforma();
      case 'payments': case 'wallet': return renderPayments();
      case 'tracking': return renderTracking();
      case 'delivery': case 'transport': return renderDelivery();
      case 'documents': case 'favorites': return renderDocuments();
      case 'reviews': return renderReviews();
      case 'analytics': case 'reports': return renderAnalytics();
      case 'notifications': return renderNotifications();
      case 'orders': return renderTracking();
      default: return renderDashboard();
    }
  };

  return (
    <WorkspaceShell
      menu="customer"
      section={section}
      onSection={onSection}
      badgeFor={id => {
        if (id === 'cart') return cart.length || null;
        if (id === 'rfqs') return myRfqs.filter(r => r.status === 'open').length || null;
        if (id === 'comparison-compare' || id === 'quotation-compare') return myQuotes.filter(q => q.status === 'submitted').length || null;
        if (id === 'notifications') return notifications.filter(n => n.userId === user.id && !n.read).length || null;
        return null;
      }}
    >
      {renderSectionBody()}
    </WorkspaceShell>
  );
};

export default CustomerWorkspace;
