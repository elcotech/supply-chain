// ===== Administration — Enterprise Control Centre (spec §2) =====
//
// All eighteen administration submenus, built on the live platform collections.
// Every list uses the shared DataTable (search, filter, sort, pagination and
// CSV export); every mutation goes back through App.tsx so persistence, cloud
// sync and notifications keep working exactly as before.

import React, { useMemo, useState } from 'react';
import {
  AuditEvent, Company, Complaint, Material, Order, Quotation, Rfq,
  TransporterProfile, User, UserRole,
} from '../../types';
import {
  formatCurrency, formatDate, timeAgo, exportToCSV, exportOrdersToCSV,
  isUserLocked, forecastPrice, effectiveRating,
} from '../../utils';
import { buildAnalytics, monthlyTrend } from '../../lib/analytics';
import { isCloudEnabled } from '../../lib/supabaseClient';
import { LANGUAGES, useLanguage } from '../../lib/i18n';
import { jobStatus, TRANSPORT_STATUS_LABELS } from '../../lib/transport';
import { APP_VERSION } from '../../version';
import { LineChart } from '../Charts';
import WorkspaceShell from './shell';
import { WorkspaceProps } from './types';
import {
  BarList, Column, DashboardGrid, DataTable, EmptyState, Field, Kpi, KpiGrid,
  MiniStat, Modal, Panel, ProgressBar, RangeSelect, SectionHeader, StatusPill,
  toneFor,
} from './ui';

const COMMISSION_RATE = 0.08;

const AdminWorkspace: React.FC<WorkspaceProps> = props => {
  const {
    user, users, companies, materials, orders, reviews, notifications, wallets,
    transactions, transporterProfiles, settings, projects, rfqs, quotations,
    complaints, setComplaints, platform, setPlatform, audit, logEvent, section,
    onSection, onNotify, onNavigate, onBroadcast, onUpdateOrderStatus,
    onUpdateUser, onDeleteUser, onUpdateCompany,
    onDeleteMaterial, onEditMaterial, onAdminEditCompany,
    onAddSupplier, onOpenMap, onOpenDataCenter, onEditSettings,
    onUpdateTransporterProfile,
  } = props;
  const { t, lang, setLang } = useLanguage();

  // Filter state lives at the top level: the section renderers are plain
  // functions of this component, so any hook declared inside them would run in
  // a different order whenever the active section changes.
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dashRange, setDashRange] = useState('12');

  // One analytics pass shared by the dashboard, AI and reports panels.
  const analytics = useMemo(
    () => buildAnalytics({ user, materials, companies, orders, users, reviews, settings, days: 30 }),
    [user, materials, companies, orders, users, reviews, settings]
  );

  const suppliers = companies;
  const customers = users.filter(u => u.userType === 'customer');
  const transporters = users.filter(u => u.userType === 'transporter');
  const admins = users.filter(u => u.userType === 'admin');
  const gmv = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.totalAmount, 0);
  const deliveredRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.totalAmount, 0);
  const commission = deliveredRevenue * COMMISSION_RATE;
  const vatTotal = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (o.vatAmount || 0), 0);
  const openComplaints = complaints.filter(c => c.status === 'open' || c.status === 'investigating');

  const customerFor = (id: string) => users.find(u => u.id === id);
  const supplierFor = (id: string) => companies.find(c => c.id === id);
  const materialFor = (id: string) => materials.find(m => m.id === id);
  const money = (value: number) => formatCurrency(Math.round(value * 100) / 100);

  // ---------- Small helpers ----------
  const setOrderStatus = (order: Order, status: string) => {
    onUpdateOrderStatus(order.id, status);
    logEvent('order.status', `${order.invoiceNumber} → ${status}`);
  };

  const toggleSuspend = (account: User) => {
    const suspended = isUserLocked(account);
    onUpdateUser({ ...account, lockUntil: suspended ? 0 : Date.now() + 1000 * 60 * 60 * 24 * 365 * 100, loginAttempts: 0 });
    logEvent(suspended ? 'user.activate' : 'user.suspend', account.email);
    onNotify(suspended ? `${account.name} reactivated` : `${account.name} suspended`, suspended ? 'success' : 'warning');
  };

  const setCompliance = (company: Company, status: Company['complianceStatus']) => {
    onUpdateCompany({ ...company, complianceStatus: status });
    logEvent('supplier.compliance', `${company.name} → ${status}`);
    onNotify(`${company.name}: ${status}`, status === 'compliant' ? 'success' : 'info');
  };

  const verifyTransporter = (profile: TransporterProfile) => {
    onUpdateTransporterProfile({ ...profile, verified: !profile.verified });
    logEvent('transporter.verify', `${profile.companyName} → ${!profile.verified}`);
    onNotify(`${profile.companyName} ${profile.verified ? 'unverified' : 'verified'}`, 'success');
  };

  const [responseTarget, setResponseTarget] = useState<Complaint | null>(null);
  const [responseText, setResponseText] = useState('');

  const openComplaint = (complaint: Complaint) => {
    setResponseTarget(complaint);
    setResponseText(complaint.response || '');
  };

  const saveComplaint = (status: Complaint['status']) => {
    if (!responseTarget) return;
    const updated: Complaint = {
      ...responseTarget,
      status,
      response: responseText.trim(),
      updatedAt: Date.now(),
    };
    setComplaints(prev => prev.map(c => (c.id === updated.id ? updated : c)));
    onBroadcast('system', `Complaint ${status}`, `${updated.subject}: ${updated.response || 'Status updated by administration.'}`, 'all');
    logEvent('complaint.' + status, updated.subject);
    onNotify(`Complaint ${status}`, status === 'resolved' ? 'success' : 'info');
    setResponseTarget(null);
  };

  // Broadcast composer
  const [broadcastRole, setBroadcastRole] = useState<UserRole | 'all'>('all');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');

  const sendBroadcast = () => {
    const title = broadcastTitle.trim();
    const message = broadcastBody.trim();
    if (!title || !message) {
      onNotify('Enter a title and a message.', 'warning');
      return;
    }
    onBroadcast('system', title, message, broadcastRole);
    logEvent('notification.broadcast', `${broadcastRole}: ${title}`);
    onNotify('Announcement sent', 'success');
    setBroadcastTitle('');
    setBroadcastBody('');
  };

  // Platform profile form
  const savePlatform = (event: React.FormEvent) => {
    event.preventDefault();
    logEvent('platform.settings', `${platform.country} · ${platform.defaultLanguage}`);
    onNotify('Platform settings saved', 'success');
  };

  // ---------- Shared column builders ----------
  const accountStatus = (account: User) =>
    isUserLocked(account)
      ? <StatusPill label={t('Suspended')} tone="bad" />
      : <StatusPill label={t('Active')} tone="good" />;

  const userColumns: Column<User>[] = [
    {
      key: 'name', header: 'Name', value: u => u.name,
      render: u => (
        <div className="ws-cell-stack">
          <strong>{u.name}</strong>
          <small>{u.email}</small>
        </div>
      ),
    },
    { key: 'userType', header: 'Role', value: u => u.userType, render: u => <StatusPill label={u.userType} tone="info" /> },
    { key: 'city', header: 'City', value: u => u.city },
    { key: 'phone', header: 'Phone', value: u => u.phone },
    { key: 'registered', header: 'Created', value: u => u.registered, render: u => <span className="ws-nowrap">{formatDate(u.registered)}</span> },
    { key: 'status', header: 'Status', value: u => (isUserLocked(u) ? 'suspended' : 'active'), render: accountStatus },
    {
      key: 'actions', header: 'Actions', align: 'right', noExport: true,
      render: u => (
        <div className="ws-row-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleSuspend(u)}>
            {isUserLocked(u) ? t('Activate') : t('Suspend')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (!window.confirm(`Delete ${u.name}'s account?`)) return;
              onDeleteUser(u.id);
              logEvent('user.delete', u.email);
            }}
          >
            {t('Delete')}
          </button>
        </div>
      ),
    },
  ];

  const orderColumns: Column<Order>[] = [
    {
      key: 'invoiceNumber', header: 'Order', value: o => o.invoiceNumber,
      render: o => (
        <div className="ws-cell-stack">
          <strong>{o.invoiceNumber}</strong>
          <small>{formatDate(o.orderDate)}</small>
        </div>
      ),
    },
    {
      key: 'buyer', header: 'Buyer', value: o => customerFor(o.customerId)?.name || o.customerId,
      render: o => <span>{customerFor(o.customerId)?.name || '—'}</span>,
    },
    {
      key: 'supplier', header: 'Supplier', value: o => supplierFor(o.companyId)?.name || '—',
      render: o => <span>{supplierFor(o.companyId)?.name || '—'}</span>,
    },
    {
      key: 'material', header: 'Material', value: o => materialFor(o.materialId)?.name || '—',
      render: o => (
        <div className="ws-cell-stack">
          <span>{materialFor(o.materialId)?.name || '—'}</span>
          <small>{o.quantity} {materialFor(o.materialId)?.unit || ''}</small>
        </div>
      ),
    },
    { key: 'totalAmount', header: 'Total', align: 'right', value: o => Math.round(o.totalAmount), render: o => <strong>{money(o.totalAmount)}</strong> },
    { key: 'paymentStatus', header: 'Payment', value: o => o.paymentStatus, render: o => <StatusPill label={t(o.paymentStatus)} tone={toneFor(o.paymentStatus)} /> },
    {
      key: 'status', header: 'Status', value: o => o.status,
      render: o => (
        <select
          className="ws-status-select"
          value={o.status}
          aria-label={'Status for ' + o.invoiceNumber}
          onChange={event => setOrderStatus(o, event.target.value)}
        >
          {['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(status => (
            <option key={status} value={status}>{t(status.charAt(0).toUpperCase() + status.slice(1))}</option>
          ))}
        </select>
      ),
    },
  ];

  const supplierColumns: Column<Company>[] = [
    {
      key: 'name', header: 'Supplier', value: c => c.name,
      render: c => (
        <div className="ws-cell-stack">
          <strong>{c.name}</strong>
          <small>{c.city} · {c.tinNumber || 'No TIN'}</small>
        </div>
      ),
    },
    {
      key: 'complianceStatus', header: 'Compliance', value: c => c.complianceStatus,
      render: c => <StatusPill label={t(c.complianceStatus)} tone={toneFor(c.complianceStatus)} />,
    },
    { key: 'products', header: 'Products', align: 'right', value: c => materials.filter(m => m.companyId === c.id).length },
    { key: 'orders', header: 'Orders', align: 'right', value: c => orders.filter(o => o.companyId === c.id).length },
    { key: 'rating', header: 'Rating', align: 'right', value: c => Number(c.rating.toFixed(1)), render: c => `⭐ ${c.rating.toFixed(1)}` },
    {
      key: 'actions', header: 'Actions', align: 'right', noExport: true,
      render: c => (
        <div className="ws-row-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCompliance(c, c.complianceStatus === 'compliant' ? 'pending' : 'compliant')}>
            {c.complianceStatus === 'compliant' ? t('Review') : t('Approve')}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAdminEditCompany(c)}>{t('Edit')}</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenMap(c.id)}>🗺️</button>
        </div>
      ),
    },
  ];

  const materialColumns: Column<Material>[] = [
    {
      key: 'name', header: 'Product', value: m => m.name,
      render: m => (
        <div className="ws-cell-stack">
          <strong>{m.name}</strong>
          <small>{m.category} · {supplierFor(m.companyId)?.name || '—'}</small>
        </div>
      ),
    },
    { key: 'price', header: 'Price', align: 'right', value: m => Math.round(m.price), render: m => <>{money(m.price)} <small>/{m.unit}</small></> },
    { key: 'quantity', header: 'Stock', align: 'right', value: m => m.quantity, render: m => <span className={m.quantity <= 10 ? 'ws-low' : ''}>{m.quantity.toLocaleString()}</span> },
    { key: 'rating', header: 'Rating', align: 'right', value: m => effectiveRating(m.rating, reviews.filter(r => r.materialId === m.id)) },
    { key: 'lastUpdated', header: 'Updated', value: m => m.lastUpdated, render: m => <span className="ws-nowrap">{formatDate(m.lastUpdated)}</span> },
    {
      key: 'actions', header: 'Actions', align: 'right', noExport: true,
      render: m => (
        <div className="ws-row-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEditMaterial(m)}>{t('Edit')}</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onDeleteMaterial(m.id)}>{t('Delete')}</button>
        </div>
      ),
    },
  ];

  // ---------- Section renderers ----------
  const renderDashboard = () => {
    const months = Math.max(1, Number(dashRange) || 12);
    const gmvTrend = monthlyTrend(orders, months).revenue;
    const deliveredTrend = monthlyTrend(orders.filter(o => o.status === 'delivered'), months).revenue;
    const unverifiedTransporters = transporterProfiles.filter(p => !p.verified);
    const lowStock = materials.filter(m => m.quantity <= 10);
    const verificationTotal = companies.filter(c => c.complianceStatus !== 'compliant').length
      + unverifiedTransporters.length + lowStock.length;
    const approvalRows = [...companies]
      .sort((a, b) => {
        const rank = (c: Company) => (c.complianceStatus === 'pending' ? 0 : c.complianceStatus === 'non-compliant' ? 1 : 2);
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      })
      .slice(0, 6);
    const approvalColumns: Column<Company>[] = [
      {
        key: 'name',
        header: t('Business Name'),
        value: row => row.name,
        render: row => (
          <span className="ws-approval-name">
            <strong>{row.name}</strong>
            <small>{row.city}</small>
          </span>
        ),
      },
      {
        key: 'request',
        header: t('Request ID'),
        value: row => row.businessLicense || row.id,
        render: row => <span className="ws-mono">{row.businessLicense || row.id.slice(-8).toUpperCase()}</span>,
      },
      {
        key: 'date',
        header: t('Date'),
        value: row => row.tradeLicenseExpiry,
        render: row => <span>{row.tradeLicenseExpiry ? formatDate(row.tradeLicenseExpiry) : '—'}</span>,
      },
      {
        key: 'status',
        header: t('Status'),
        value: row => row.complianceStatus,
        render: row => <StatusPill label={t(row.complianceStatus)} tone={toneFor(row.complianceStatus)} />,
      },
      {
        key: 'progress',
        header: t('Progress'),
        value: row => (row.complianceStatus === 'compliant' ? 100 : row.complianceStatus === 'pending' ? 55 : 18),
        render: row => {
          const pct = row.complianceStatus === 'compliant' ? 100 : row.complianceStatus === 'pending' ? 55 : 18;
          return (
            <span className="ws-pill-stack">
              <ProgressBar value={pct} tone={row.complianceStatus === 'compliant' ? 'good' : row.complianceStatus === 'pending' ? 'warn' : 'bad'} />
              <small className="ws-muted">{pct}%</small>
            </span>
          );
        },
      },
      {
        key: 'action',
        header: '',
        noExport: true,
        render: row => (
          <button className="btn btn-secondary btn-sm" onClick={() => onSection('suppliers')}>
            {row.complianceStatus === 'compliant' ? t('View') : t('Review')}
          </button>
        ),
      },
    ];

    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('Administration Dashboard')}
          hint={t('Platform-wide users, suppliers, fleet verification, RFQs and orders in one control centre.')}
          actions={
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => onSection('suppliers')}>🏢 {t('Manage suppliers')}</button>
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate('analytics')}>📊 {t('Reports & Analytics')}</button>
            </>
          }
        />

        <KpiGrid>
          <Kpi label={t('Active Users')} value={users.filter(u => !isUserLocked(u)).length} hint={`${customers.length} customers · ${admins.length} admins`} icon="👥" />
          <Kpi label={t('Registered Suppliers')} value={companies.length} hint={`${companies.filter(c => c.complianceStatus === 'compliant').length} compliant`} icon="🏢" tone="good" />
          <Kpi label={t('Verified Vehicles')} value={transporterProfiles.filter(p => p.verified).length} hint={`${transporterProfiles.length} transporter profiles`} icon="🚛" />
          <Kpi label={t('RFQs')} value={orders.filter(o => o.status === 'pending').length} hint="Awaiting supplier quotations" icon="📝" />
          <Kpi label={t('Total Orders')} value={orders.length} hint={`${orders.filter(o => o.status === 'delivered').length} delivered`} icon="📋" tone="accent" />
        </KpiGrid>

        <DashboardGrid
          main={
            <>
              <Panel
                title={t('Platform-wide Real-time Analytics')}
                subtitle={t('Revenue and order value across every registered supplier')}
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
                  <span>{t('Total platform value')} · {money(gmv)}</span>
                  <span className="ws-pill-stack">
                    <StatusPill label={`● ${t('Delivered')}`} tone="good" />
                    <StatusPill label={`● ${t('All orders')}`} tone="info" />
                  </span>
                </div>
                <div className="ws-chart-box">
                  <LineChart
                    height={196}
                    valueFormatter={money}
                    series={[
                      { label: t('Delivered'), color: '#1f6feb', data: deliveredTrend },
                      { label: t('All orders'), color: '#c9a227', data: gmvTrend },
                    ]}
                  />
                </div>
                <div className="ws-chart-note">
                  <span>{analytics.periodLabel} · {orders.length} {t('orders')}</span>
                  <span>{t('GMV')} {money(gmv)}</span>
                </div>
              </Panel>

              <Panel
                title={t('Supplier License Approvals')}
                subtitle={t('Trade licences, compliance status and onboarding progress')}
                actions={<button className="btn btn-secondary btn-sm" onClick={() => onSection('suppliers')}>{t('View all')}</button>}
              >
                <DataTable
                  rows={approvalRows}
                  columns={approvalColumns}
                  pageSize={6}
                  exportName="supplier-license-approvals"
                  searchText={row => `${row.name} ${row.city} ${row.businessLicense} ${row.complianceStatus}`}
                  emptyTitle={t('No suppliers yet')}
                />
              </Panel>
            </>
          }
          side={
            <>
              <Panel
                title={`${t('Verification Queue')} (${verificationTotal})`}
                subtitle={t('Items waiting for an administrator decision')}
              >
                <div className="ws-mini-grid">
                  <MiniStat label={t('Licences')} value={companies.filter(c => c.complianceStatus === 'pending').length} hint={t('pending review')} tone="warn" icon="📄" />
                  <MiniStat label={t('Vehicles')} value={unverifiedTransporters.length} hint={t('awaiting verification')} tone="bad" icon="🚚" />
                  <MiniStat label={t('Low stock')} value={lowStock.length} hint={t('products')} tone="accent" icon="📦" />
                  <MiniStat label={t('Complaints')} value={openComplaints.length} hint={t('open cases')} tone={openComplaints.length ? 'warn' : 'good'} icon="⚖️" />
                </div>
                <div className="ws-stat-list">
                  {companies.filter(c => c.complianceStatus !== 'compliant').slice(0, 3).map(c => (
                    <div className="ws-stat-row" key={c.id}>
                      <span aria-hidden="true">🏢</span>
                      <div><strong>{c.name}</strong><small>{t('Licence')} · {c.city}</small></div>
                      <button className="btn btn-secondary btn-sm" onClick={() => onSection('suppliers')}>{t('Review')}</button>
                    </div>
                  ))}
                  {unverifiedTransporters.slice(0, 2).map(p => (
                    <div className="ws-stat-row" key={p.id}>
                      <span aria-hidden="true">🚛</span>
                      <div><strong>{p.companyName}</strong><small>{t('Fleet verification')} · {p.serviceAreas?.[0] || p.city || '—'}</small></div>
                      <button className="btn btn-secondary btn-sm" onClick={() => onSection('transporters')}>{t('Verify')}</button>
                    </div>
                  ))}
                  {lowStock.slice(0, 2).map(m => (
                    <div className="ws-stat-row" key={m.id}>
                      <span aria-hidden="true">⚠️</span>
                      <div><strong>{m.name}</strong><small>{t('Low stock')} · {m.quantity} {m.unit}</small></div>
                      <button className="btn btn-secondary btn-sm" onClick={() => onSection('products')}>{t('View')}</button>
                    </div>
                  ))}
                  {verificationTotal === 0 && (
                    <div className="ws-stat-row">
                      <span aria-hidden="true">✅</span>
                      <div><strong>{t('Queue is clear')}</strong><small>{t('Every supplier, vehicle and product is in good standing.')}</small></div>
                    </div>
                  )}
                </div>
              </Panel>

              <Panel
                title={t('Product Statistics')}
                subtitle={`${materials.length} ${t('products')} · ${analytics.stockUnits} ${t('units in stock')}`}
              >
                <BarList
                  items={analytics.categoryData.slice(0, 5).map(item => ({ label: t(item.label), value: item.value }))}
                  format={analytics.categoryBasis === 'revenue' ? money : undefined}
                />
                <div className="ws-chart-note" style={{ marginTop: 10 }}>
                  <span>{analytics.categoryBasis === 'revenue' ? t('Revenue by category') : t('Catalogue by category')}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => onSection('products')}>{t('Catalogue')}</button>
                </div>
              </Panel>

              <Panel title={t('Quick actions')}>
                <div className="ws-quick-grid">
                  <button className="ws-quick" onClick={onAddSupplier}><span>🏢</span>{t('Add Supplier')}</button>
                  <button className="ws-quick" onClick={() => onSection('notifications')}><span>📣</span>{t('Send announcement')}</button>
                  <button className="ws-quick" onClick={() => onSection('complaints')}><span>⚖️</span>{t('Complaints & Disputes')}</button>
                  <button className="ws-quick" onClick={onEditSettings}><span>⚙️</span>{t('Platform Settings')}</button>
                </div>
              </Panel>
            </>
          }
        />
      </>
    );
  };

  const renderUsers = () => {
    const rows = users.filter(u =>
      (roleFilter === 'all' || u.userType === roleFilter) &&
      (statusFilter === 'all' || (statusFilter === 'suspended' ? isUserLocked(u) : !isUserLocked(u)))
    );
    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('User Management')}
          hint={t('Register, approve, suspend, update and deactivate user accounts. Assign roles and permissions. Review login activity and account history.')}
          actions={<button className="btn btn-primary btn-sm" onClick={() => onNavigate('register')}>➕ {t('Register')}</button>}
        />
        <KpiGrid>
          <Kpi label={t('Registered accounts')} value={users.length} icon="👥" />
          <Kpi label={t('Active')} value={users.filter(u => !isUserLocked(u)).length} icon="✅" tone="good" />
          <Kpi label={t('Suspended')} value={users.filter(isUserLocked).length} icon="🚫" tone="warn" />
          <Kpi label={t('Administrators')} value={admins.length} icon="🔐" />
        </KpiGrid>
        <Panel>
          <DataTable
            rows={rows}
            columns={userColumns}
            searchText={u => `${u.name} ${u.email} ${u.city} ${u.userType} ${u.phone}`}
            filters={[
              {
                id: 'role', label: 'Role', value: roleFilter, onChange: setRoleFilter,
                options: [
                  { value: 'all', label: 'All' },
                  { value: 'customer', label: 'Customers' },
                  { value: 'company', label: 'Suppliers' },
                  { value: 'transporter', label: 'Transporters' },
                  { value: 'admin', label: 'Administration' },
                ],
              },
              {
                id: 'status', label: 'Status', value: statusFilter, onChange: setStatusFilter,
                options: [
                  { value: 'all', label: 'All statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' },
                ],
              },
            ]}
            exportName="escon_accounts"
            emptyTitle={t('No matching records')}
          />
        </Panel>
      </>
    );
  };

  const renderSuppliers = () => (
    <>
      <SectionHeader
        eyebrow={t('Administration')}
        title={t('Supplier Management')}
        hint={t('Verify supplier identity, business licences, addresses, warehouses and products. Approve, reject or suspend supplier accounts.')}
        actions={<button className="btn btn-primary btn-sm" onClick={onAddSupplier}>➕ {t('Add Supplier')}</button>}
      />
      <KpiGrid>
        <Kpi label={t('Verified suppliers')} value={suppliers.filter(c => c.complianceStatus === 'compliant').length} icon="✅" tone="good" />
        <Kpi label={t('Pending verification')} value={suppliers.filter(c => c.complianceStatus === 'pending').length} icon="🕒" tone="warn" />
        <Kpi label={t('Non-compliant')} value={suppliers.filter(c => c.complianceStatus === 'non-compliant').length} icon="⚠️" tone="bad" />
        <Kpi label={t('Cities covered')} value={new Set(suppliers.map(c => c.city).filter(Boolean)).size} icon="📍" />
      </KpiGrid>
      <Panel>
        <DataTable
          rows={suppliers}
          columns={supplierColumns}
          searchText={c => `${c.name} ${c.city} ${c.tinNumber} ${c.location}`}
          exportName="escon_suppliers"
          emptyTitle={t('No records yet')}
        />
      </Panel>
    </>
  );

  const renderCustomers = () => {
    const spendFor = (id: string) => orders.filter(o => o.customerId === id && o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0);
    const columns: Column<User>[] = [
      {
        key: 'name', header: 'Customer', value: u => u.name,
        render: u => (
          <div className="ws-cell-stack">
            <strong>{u.companyName || u.name}</strong>
            <small>{u.name} · {u.email}</small>
          </div>
        ),
      },
      { key: 'city', header: 'City', value: u => u.city },
      { key: 'orders', header: 'Orders', align: 'right', value: u => orders.filter(o => o.customerId === u.id).length },
      { key: 'spend', header: 'Spend', align: 'right', value: u => Math.round(spendFor(u.id)), render: u => money(spendFor(u.id)) },
      { key: 'projects', header: 'Projects', align: 'right', value: u => projects.filter(p => p.customerId === u.id).length },
      { key: 'status', header: 'Status', value: u => (isUserLocked(u) ? 'suspended' : 'active'), render: accountStatus },
      {
        key: 'actions', header: 'Actions', align: 'right', noExport: true,
        render: u => (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleSuspend(u)}>
            {isUserLocked(u) ? t('Activate') : t('Suspend')}
          </button>
        ),
      },
    ];
    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('Customer Management')}
          hint={t('Manage contractor, company and individual customer profiles. Verify business information, manage account status and resolve customer issues.')}
        />
        <KpiGrid>
          <Kpi label={t('Customers')} value={customers.length} icon="👤" />
          <Kpi label={t('Active')} value={customers.filter(u => !isUserLocked(u)).length} icon="✅" tone="good" />
          <Kpi label={t('Projects')} value={projects.length} icon="🏗️" />
          <Kpi label={t('Lifetime spend')} value={money(customers.reduce((s, u) => s + spendFor(u.id), 0))} icon="💰" tone="accent" />
        </KpiGrid>
        <Panel>
          <DataTable rows={customers} columns={columns} searchText={u => `${u.name} ${u.email} ${u.city} ${u.companyName || ''}`} exportName="escon_customers" />
        </Panel>
      </>
    );
  };

  const renderTransporters = () => {
    const columns: Column<TransporterProfile>[] = [
      {
        key: 'companyName', header: 'Company', value: p => p.companyName,
        render: p => (
          <div className="ws-cell-stack">
            <strong>{p.companyName}</strong>
            <small>{p.city} · {p.licenseNumber || 'No licence'}</small>
          </div>
        ),
      },
      { key: 'serviceAreas', header: 'Service areas', value: p => p.serviceAreas.join(', '), render: p => <span className="ws-clamp">{p.serviceAreas.join(', ') || '—'}</span> },
      { key: 'vehicles', header: 'Vehicles', align: 'right', value: p => p.vehicles.length },
      { key: 'drivers', header: 'Drivers', align: 'right', value: p => p.drivers.length },
      { key: 'completedJobs', header: 'Jobs', align: 'right', value: p => p.completedJobs },
      { key: 'rating', header: 'Rating', align: 'right', value: p => p.rating, render: p => `⭐ ${p.rating.toFixed(1)}` },
      { key: 'verified', header: 'Verified', value: p => (p.verified ? 'verified' : 'pending'), render: p => <StatusPill label={p.verified ? t('Verified') : t('Pending')} tone={p.verified ? 'good' : 'warn'} /> },
      {
        key: 'actions', header: 'Actions', align: 'right', noExport: true,
        render: p => (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => verifyTransporter(p)}>
            {p.verified ? t('Suspend') : t('Verify')}
          </button>
        ),
      },
    ];
    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('Transporter Management')}
          hint={t('Verify transport companies, vehicles, driver licences, vehicle capacities and service areas. Monitor transporter performance.')}
        />
        <KpiGrid>
          <Kpi label={t('Transporters')} value={transporterProfiles.length} icon="🚛" />
          <Kpi label={t('Verified')} value={transporterProfiles.filter(p => p.verified).length} icon="✅" tone="good" />
          <Kpi label={t('Vehicles')} value={transporterProfiles.reduce((s, p) => s + p.vehicles.length, 0)} icon="🚚" />
          <Kpi label={t('Drivers')} value={transporterProfiles.reduce((s, p) => s + p.drivers.length, 0)} icon="🪪" />
          <Kpi label={t('Delivery jobs')} value={orders.filter(o => o.transportStatus).length} icon="📦" />
          <Kpi label={t('Completed jobs')} value={orders.filter(o => o.transportStatus === 'delivered').length} icon="🏁" tone="accent" />
        </KpiGrid>
        <Panel>
          <DataTable rows={transporterProfiles} columns={columns} searchText={p => `${p.companyName} ${p.city} ${p.serviceAreas.join(' ')}`} exportName="escon_transporters" emptyTitle="No transport companies registered yet" />
        </Panel>
        <Panel title={t('Transport accounts')} subtitle="Sign-in accounts for transport companies">
          <DataTable
            rows={transporters}
            columns={userColumns}
            searchText={u => `${u.name} ${u.email} ${u.city}`}
            exportEnabled={false}
          />
        </Panel>
      </>
    );
  };

  const renderProducts = () => (
    <>
      <SectionHeader
        eyebrow={t('Administration')}
        title={t('Product & Category')}
        hint={t('Create and organise categories such as cement, sand, aggregate, steel, HCB and other products. Review descriptions, specifications, units and listings.')}
      />
      <KpiGrid>
        <Kpi label={t('Total products')} value={materials.length} icon="📦" />
        <Kpi label={t('Categories')} value={new Set(materials.map(m => m.category)).size} icon="🗂️" />
        <Kpi label={t('Stock value')} value={money(materials.reduce((s, m) => s + m.price * m.quantity, 0))} icon="🏭" tone="accent" />
        <Kpi label={t('Low-stock items')} value={materials.filter(m => m.quantity <= 10).length} icon="⚠️" tone="warn" />
      </KpiGrid>
      <Panel>
        <DataTable
          rows={materials}
          columns={materialColumns}
          searchText={m => `${m.name} ${m.category} ${supplierFor(m.companyId)?.name || ''} ${m.brand || ''}`}
          exportName="escon_catalogue"
        />
      </Panel>
      <Panel title={t('Categories')} subtitle="Catalogue distribution by material category">
        <BarList
          items={Array.from(new Set(materials.map(m => m.category))).map(category => ({
            label: category || 'Uncategorised',
            value: materials.filter(m => m.category === category).length,
          }))}
        />
      </Panel>
    </>
  );

  const renderPrices = () => {
    const categoryMedian = (category: string) => {
      const prices = materials.filter(m => m.category === category).map(m => m.price).sort((a, b) => a - b);
      if (!prices.length) return 0;
      return prices[Math.floor(prices.length / 2)];
    };
    const columns: Column<Material>[] = [
      { key: 'name', header: 'Product', value: m => m.name },
      { key: 'category', header: 'Category', value: m => m.category },
      { key: 'price', header: 'Price', align: 'right', value: m => Math.round(m.price), render: m => <>{money(m.price)} <small>/{m.unit}</small></> },
      { key: 'basePrice', header: 'Base', align: 'right', value: m => Math.round(m.basePrice), render: m => money(m.basePrice) },
      { key: 'margin', header: 'Margin', align: 'right', value: m => m.profitMargin, render: m => `${m.profitMargin}%` },
      {
        key: 'change', header: 'Change', align: 'right',
        value: m => {
          const history = m.priceHistory || [];
          if (history.length < 2) return 0;
          const first = history[0].price;
          return Math.round(((m.price - first) / (first || 1)) * 1000) / 10;
        },
        render: m => {
          const history = m.priceHistory || [];
          if (history.length < 2) return <span className="ws-muted">—</span>;
          const pct = ((m.price - history[0].price) / (history[0].price || 1)) * 100;
          return <StatusPill label={`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`} tone={pct > 12 ? 'warn' : pct < -12 ? 'info' : 'muted'} />;
        },
      },
      {
        key: 'flag', header: 'Review', value: m => (m.price > categoryMedian(m.category) * 1.4 ? 'unusual' : 'normal'),
        render: m => (m.price > categoryMedian(m.category) * 1.4
          ? <StatusPill label="Unusual" tone="warn" />
          : <StatusPill label="Normal" tone="good" />),
      },
      { key: 'updated', header: 'Updated', value: m => m.lastUpdated, render: m => <span className="ws-nowrap">{formatDate(m.lastUpdated)}</span> },
    ];
    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('Price Management')}
          hint={t('Monitor supplier prices, price changes, historical records and unusual pricing. Set platform pricing rules where authorised.')}
        />
        <KpiGrid>
          <Kpi label="Catalogue value" value={money(materials.reduce((s, m) => s + m.price * m.quantity, 0))} icon="💵" />
          <Kpi label="Average price" value={money(materials.reduce((s, m) => s + m.price, 0) / (materials.length || 1))} icon="📊" />
          <Kpi label="Unusual pricing" value={materials.filter(m => m.price > categoryMedian(m.category) * 1.4).length} icon="⚠️" tone="warn" />
          <Kpi label="Price records" value={materials.reduce((s, m) => s + (m.priceHistory?.length || 0), 0)} icon="🗂️" />
        </KpiGrid>
        <Panel>
          <DataTable rows={materials} columns={columns} searchText={m => `${m.name} ${m.category}`} exportName="escon_prices" />
        </Panel>
      </>
    );
  };

  const renderOrders = () => (
    <>
      <SectionHeader
        eyebrow={t('Administration')}
        title={t('Order Management')}
        hint={t('Monitor customer orders, supplier confirmation, proformas, dispatch, delivery and completion. Investigate cancelled or delayed orders.')}
      />
      <KpiGrid>
        <Kpi label={t('Total orders')} value={orders.length} icon="📋" />
        <Kpi label={t('Pending orders')} value={orders.filter(o => o.status === 'pending').length} icon="🕒" tone="warn" />
        <Kpi label={t('Delivered')} value={orders.filter(o => o.status === 'delivered').length} icon="✅" tone="good" />
        <Kpi label={t('Cancelled')} value={orders.filter(o => o.status === 'cancelled').length} icon="🚫" tone="bad" />
        <Kpi label="GMV" value={money(gmv)} icon="💰" tone="accent" />
        <Kpi label={t('Average order value')} value={money(gmv / (orders.filter(o => o.status !== 'cancelled').length || 1))} icon="📈" />
      </KpiGrid>
      <Panel>
        <DataTable
          rows={orders}
          columns={orderColumns}
          searchText={o => `${o.invoiceNumber} ${customerFor(o.customerId)?.name || ''} ${supplierFor(o.companyId)?.name || ''} ${o.status} ${o.paymentStatus}`}
          exportName="escon_orders"
          pageSize={12}
        />
      </Panel>
      <Panel title="Delayed orders" subtitle="Pending for more than seven days">
        {(() => {
          const stale = orders.filter(o => {
            if (o.status !== 'pending') return false;
            const days = (Date.now() - new Date(o.orderDate).getTime()) / 86400000;
            return days > 7;
          });
          if (!stale.length) return <EmptyState icon="✅" title="No delayed orders" text="Every pending order was placed within the last seven days." />;
          return (
            <ul className="ws-alert-list">
              {stale.map(o => (
                <li key={o.id}>
                  <span>⏰</span>
                  <div><strong>{o.invoiceNumber}</strong><small>{customerFor(o.customerId)?.name} · {formatDate(o.orderDate)}</small></div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setOrderStatus(o, 'confirmed')}>{t('Approve')}</button>
                </li>
              ))}
            </ul>
          );
        })()}
      </Panel>
    </>
  );

  const renderRfqs = () => {
    const rfqColumns: Column<Rfq>[] = [
      { key: 'customerName', header: 'Buyer', value: r => r.customerName },
      {
        key: 'materialName', header: 'Material', value: r => r.materialName,
        render: r => (
          <div className="ws-cell-stack">
            <strong>{r.materialName}</strong>
            <small>{r.quantity} {r.unit} · {r.category}</small>
          </div>
        ),
      },
      { key: 'city', header: 'Site', value: r => r.city },
      { key: 'requiredBy', header: 'Required by', value: r => r.requiredBy, render: r => <span className="ws-nowrap">{formatDate(r.requiredBy)}</span> },
      { key: 'suppliers', header: 'Suppliers', align: 'right', value: r => r.supplierIds.length },
      { key: 'quotes', header: 'Quotes', align: 'right', value: r => quotations.filter(q => q.rfqId === r.id).length },
      { key: 'status', header: 'Status', value: r => r.status, render: r => <StatusPill label={t(r.status)} tone={toneFor(r.status)} /> },
      {
        key: 'actions', header: 'Actions', align: 'right', noExport: true,
        render: r => r.status === 'open' || r.status === 'quoted' ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              props.setRfqs(prev => prev.map(item => (item.id === r.id ? { ...item, status: 'closed' } : item)));
              logEvent('rfq.close', r.materialName);
              onNotify('RFQ closed', 'success');
            }}
          >
            {t('Resolve')}
          </button>
        ) : null,
      },
    ];
    const quoteColumns: Column<Quotation>[] = [
      { key: 'supplierName', header: 'Supplier', value: q => q.supplierName },
      {
        key: 'rfq', header: 'RFQ',
        value: q => rfqs.find(r => r.id === q.rfqId)?.materialName || q.rfqId,
        render: q => {
          const rfq = rfqs.find(r => r.id === q.rfqId);
          return (
            <div className="ws-cell-stack">
              <span>{rfq?.materialName || '—'}</span>
              <small>{rfq?.customerName || ''}</small>
            </div>
          );
        },
      },
      { key: 'unitPrice', header: 'Unit price', align: 'right', value: q => Math.round(q.unitPrice), render: q => money(q.unitPrice) },
      { key: 'quantity', header: 'Qty', align: 'right', value: q => q.quantity },
      { key: 'deliveryFee', header: 'Delivery', align: 'right', value: q => Math.round(q.deliveryFee), render: q => money(q.deliveryFee) },
      { key: 'validUntil', header: 'Valid until', value: q => q.validUntil, render: q => <span className="ws-nowrap">{formatDate(q.validUntil)}</span> },
      { key: 'status', header: 'Status', value: q => q.status, render: q => <StatusPill label={t(q.status)} tone={toneFor(q.status)} /> },
    ];
    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('RFQ & Quotation')}
          hint={t('Monitor requests for quotations, supplier responses, quotation validity, price comparisons and procurement status.')}
        />
        <KpiGrid>
          <Kpi label="RFQs" value={rfqs.length} icon="📨" />
          <Kpi label="Open" value={rfqs.filter(r => r.status === 'open').length} icon="🕒" tone="warn" />
          <Kpi label={t('Quotations')} value={quotations.length} icon="📝" />
          <Kpi label="Accepted" value={quotations.filter(q => q.status === 'accepted').length} icon="✅" tone="good" />
        </KpiGrid>
        <Panel title="RFQ book">
          <DataTable rows={rfqs} columns={rfqColumns} searchText={r => `${r.customerName} ${r.materialName} ${r.city} ${r.status}`} exportName="escon_rfqs" emptyTitle="No requests for quotation yet" />
        </Panel>
        <Panel title={t('Quotations')}>
          <DataTable rows={quotations} columns={quoteColumns} searchText={q => `${q.supplierName} ${q.status}`} exportName="escon_quotations" emptyTitle="No quotations submitted yet" />
        </Panel>
      </>
    );
  };

  const renderLogistics = () => {
    const jobs = orders.filter(o => o.transportStatus || o.deliveryIncluded);
    const columns: Column<Order>[] = [
      { key: 'invoiceNumber', header: 'Order', value: o => o.invoiceNumber },
      {
        key: 'supplier', header: 'Supplier', value: o => supplierFor(o.companyId)?.name || '',
        render: o => (
          <div className="ws-cell-stack">
            <span>{supplierFor(o.companyId)?.name || '—'}</span>
            <small>{supplierFor(o.companyId)?.city || ''}</small>
          </div>
        ),
      },
      { key: 'destination', header: 'Destination', value: o => o.address },
      {
        key: 'transporter', header: 'Transporter',
        value: o => transporterProfiles.find(p => p.userId === o.transporterId)?.companyName || '—',
        render: o => transporterProfiles.find(p => p.userId === o.transporterId)?.companyName || <span className="ws-muted">Unassigned</span>,
      },
      {
        key: 'transport', header: 'Delivery status',
        value: o => (o.transportStatus ? TRANSPORT_STATUS_LABELS[jobStatus(o)] : 'not requested'),
        render: o => (o.transportStatus
          ? <StatusPill label={TRANSPORT_STATUS_LABELS[jobStatus(o)]} tone={toneFor(o.transportStatus)} />
          : <StatusPill label="Not requested" tone="muted" />),
      },
      { key: 'fee', header: 'Transport fee', align: 'right', value: o => Math.round(o.transportFee || 0), render: o => (o.transportFee ? money(o.transportFee) : '—') },
      {
        key: 'pod', header: 'POD', value: o => (o.transportPod ? 'captured' : 'pending'),
        render: o => (o.transportPod ? <StatusPill label={o.transportPod.receivedBy} tone="good" /> : <span className="ws-muted">—</span>),
      },
    ];
    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('Logistics Management')}
          hint={t('Monitor delivery requests, transport quotations, GPS tracking, route distances, estimated delivery times and proof of delivery.')}
        />
        <KpiGrid>
          <Kpi label={t('Delivery jobs')} value={jobs.length} icon="🚚" />
          <Kpi label="In transit" value={orders.filter(o => o.transportStatus === 'in_transit' || o.transportStatus === 'picked_up').length} icon="🛣️" tone="warn" />
          <Kpi label={t('Completed')} value={orders.filter(o => o.transportStatus === 'delivered').length} icon="🏁" tone="good" />
          <Kpi label="Transport revenue" value={money(orders.reduce((s, o) => s + (o.transportFee || 0), 0))} icon="💰" tone="accent" />
          <Kpi label="Unassigned" value={orders.filter(o => o.deliveryIncluded && !o.transporterId).length} icon="⚠️" tone="warn" />
          <Kpi label="Fleet" value={transporterProfiles.reduce((s, p) => s + p.vehicles.length, 0)} icon="🚛" />
        </KpiGrid>
        <Panel>
          <DataTable rows={jobs} columns={columns} searchText={o => `${o.invoiceNumber} ${o.address} ${o.transporterId || ''}`} exportName="escon_logistics" emptyTitle="No delivery jobs yet" />
        </Panel>
      </>
    );
  };

  const renderFinance = () => {
    const refunds = transactions.filter(tx => tx.kind === 'refund').reduce((s, tx) => s + tx.amount, 0);
    const walletFloat = Object.values(wallets).reduce((s, value) => s + value, 0);
    const columns: Column<(typeof transactions)[number]>[] = [
      { key: 'date', header: 'Date', value: tx => new Date(tx.date).toISOString().slice(0, 10), render: tx => <span className="ws-nowrap">{formatDate(new Date(tx.date).toISOString())}</span> },
      { key: 'user', header: 'Account', value: tx => users.find(u => u.id === tx.userId)?.name || tx.userId },
      { key: 'kind', header: 'Type', value: tx => tx.kind, render: tx => <StatusPill label={t(tx.kind)} tone={tx.kind === 'payment' ? 'info' : tx.kind === 'refund' ? 'bad' : 'good'} /> },
      { key: 'amount', header: 'Amount', align: 'right', value: tx => Math.round(tx.amount), render: tx => <strong>{money(tx.amount)}</strong> },
      { key: 'balanceAfter', header: 'Balance', align: 'right', value: tx => Math.round(tx.balanceAfter), render: tx => money(tx.balanceAfter) },
      { key: 'note', header: 'Note', value: tx => tx.note },
    ];
    const balances = users
      .map(u => ({ label: u.name, value: wallets[u.id] || 0 }))
      .filter(row => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('Finance & Payments')}
          hint={t('Monitor transaction records, payment confirmations, commissions, refunds, supplier settlements and financial reconciliation.')}
        />
        <KpiGrid>
          <Kpi label="GMV" value={money(gmv)} icon="💰" tone="accent" />
          <Kpi label={t('Revenue')} value={money(deliveredRevenue)} icon="📈" />
          <Kpi label={t('Platform commission')} value={money(commission)} hint="8% of delivered orders" icon="🏦" />
          <Kpi label={t('VAT collected')} value={money(vatTotal)} icon="🧾" />
          <Kpi label="Refunds" value={money(refunds)} icon="↩️" tone="warn" />
          <Kpi label="Wallet float" value={money(walletFloat)} icon="💳" />
        </KpiGrid>
        <div className="ws-grid-2">
          <Panel title="Payment status" subtitle="Paid vs unpaid order value">
            <BarList
              items={[
                { label: t('Paid'), value: Math.round(orders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.totalAmount, 0)) },
                { label: t('Unpaid'), value: Math.round(orders.filter(o => o.paymentStatus === 'pending').reduce((s, o) => s + o.totalAmount, 0)) },
                { label: t('Refunded'), value: Math.round(orders.filter(o => o.paymentStatus === 'refunded').reduce((s, o) => s + o.totalAmount, 0)) },
              ]}
              format={money}
            />
          </Panel>
          <Panel title="Wallet balances" subtitle="Largest balances on the platform">
            <BarList items={balances} format={money} emptyLabel="No wallet balances yet" />
          </Panel>
        </div>
        <Panel title="Transaction ledger">
          <DataTable rows={transactions} columns={columns} searchText={tx => `${tx.note} ${tx.kind} ${users.find(u => u.id === tx.userId)?.name || ''}`} exportName="escon_finance" pageSize={12} emptyTitle="No transactions yet" />
        </Panel>
      </>
    );
  };

  const renderAi = () => {
    const forecasts = materials
      .map(material => ({ material, forecast: forecastPrice(material.priceHistory, material.price) }))
      .filter((row): row is { material: Material; forecast: NonNullable<ReturnType<typeof forecastPrice>> } => Boolean(row.forecast))
      .slice(0, 8);
    const demand = [...analytics.topProducts].sort((a, b) => b.units - a.units).slice(0, 8);
    const matching = [...analytics.topSuppliers].slice(0, 8);
    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('AI Intelligence Centre')}
          hint={t('Monitor AI recommendations, price forecasts, demand predictions, supplier matching, route optimisation and model performance.')}
        />
        <KpiGrid>
          <Kpi label="Price models" value={forecasts.length} hint="Products with enough history" icon="💹" />
          <Kpi label="Demand models" value={demand.length} hint="30-day product ranking" icon="📦" />
          <Kpi label="Supplier matches" value={matching.length} hint="Ranked by revenue and rating" icon="🤝" />
          <Kpi label="Recommendations" value={analytics.insights.length} hint="Generated from live data" icon="🤖" tone="accent" />
        </KpiGrid>
        <Panel title="Price forecasts" subtitle="Source: supplier price history · updated on every price change">
          {forecasts.length === 0 ? (
            <EmptyState icon="💹" title="No forecast available" text="A product needs at least two price snapshots before a forecast can be produced." />
          ) : (
            <ul className="ws-forecast-list">
              {forecasts.map(({ material, forecast }) => (
                <li key={material.id}>
                  <div>
                    <strong>{material.name}</strong>
                    <small>{material.category} · {money(material.price)} / {material.unit}</small>
                  </div>
                  <StatusPill
                    label={`${forecast.trend === 'up' ? '▲' : forecast.trend === 'down' ? '▼' : '■'} ${money(forecast.next)} (${forecast.changePct >= 0 ? '+' : ''}${forecast.changePct.toFixed(1)}%)`}
                    tone={forecast.trend === 'up' ? 'warn' : forecast.trend === 'down' ? 'good' : 'muted'}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="ws-grid-2">
          <Panel title="Demand leaders" subtitle="Units sold in the last 30 days">
            <BarList items={demand.map(p => ({ label: p.name, value: p.units, hint: p.supplierName }))} />
          </Panel>
          <Panel title="Supplier matching" subtitle="Ranked by revenue, then rating">
            <BarList items={matching.map(s => ({ label: s.name, value: Math.round(s.revenue), hint: `${s.city} · ⭐ ${s.rating.toFixed(1)}` }))} format={money} />
          </Panel>
        </div>
        <Panel title="Model performance" subtitle="Every recommendation is labelled with its source and update time">
          <div className="ws-model-grid">
            {[
              { name: 'AI Price Intelligence', detail: 'Linear trend over stored price snapshots', state: 'Active', source: 'Supplier price history' },
              { name: 'AI Demand Forecasting', detail: '30-day order volume by product', state: 'Active', source: 'Order book' },
              { name: 'AI Supplier Matching', detail: 'Revenue, rating and delivery reliability', state: 'Active', source: 'Orders, reviews, companies' },
              { name: 'Route Optimisation', detail: 'OSRM driving routes with fallback', state: isCloudEnabled ? 'Online' : 'Local', source: 'OSRM / OSM' },
              { name: 'Document Intelligence', detail: 'Proforma and invoice extraction', state: 'Preview', source: 'Approved documents' },
            ].map(model => (
              <div key={model.name} className="ws-model">
                <strong>{model.name}</strong>
                <span>{model.detail}</span>
                <small>{t('Source')}: {model.source}</small>
                <StatusPill label={model.state} tone={model.state === 'Active' ? 'good' : 'info'} />
              </div>
            ))}
          </div>
          <p className="ws-note">
            AI recommendations use only authorised platform data. Payments, contracts and other sensitive decisions remain subject to human approval.
          </p>
        </Panel>
      </>
    );
  };

  const renderReports = () => {
    const exportAccounts = () => {
      exportToCSV(users.map(u => ({ name: u.name, email: u.email, role: u.userType, city: u.city, phone: u.phone, registered: u.registered })), 'escon_accounts_report');
      logEvent('report.export', 'accounts');
    };
    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('Reports & Analytics')}
          hint={t('Generate operational, financial, procurement, supplier, customer and logistics reports. Export approved reports.')}
          actions={<button className="btn btn-primary btn-sm" onClick={() => onNavigate('analytics')}>📊 Full analytics</button>}
        />
        <KpiGrid>
          <Kpi label={t('Revenue')} value={money(deliveredRevenue)} icon="💰" tone="accent" />
          <Kpi label="GMV" value={money(gmv)} icon="📈" />
          <Kpi label={t('Delivery revenue')} value={money(orders.reduce((s, o) => s + (o.transportCost || 0), 0))} icon="🚚" />
          <Kpi label={t('VAT collected')} value={money(vatTotal)} icon="🧾" />
          <Kpi label="Delivered rate" value={`${analytics.deliveredRatePct.toFixed(1)}%`} icon="✅" />
          <Kpi label={t('Average order value')} value={money(analytics.avgOrderValue)} icon="📊" />
        </KpiGrid>
        <div className="ws-grid-2">
          <Panel title="Revenue by month"><BarList items={analytics.monthlyRevenue.map(p => ({ label: p.label, value: p.value }))} format={money} /></Panel>
          <Panel title="Orders by month"><BarList items={analytics.monthlyOrders.map(p => ({ label: p.label, value: p.value }))} /></Panel>
          <Panel title="Category revenue"><BarList items={analytics.categoryData.map(p => ({ label: p.label, value: p.value }))} format={money} /></Panel>
          <Panel title="Orders by city"><BarList items={analytics.cityData.map(p => ({ label: p.label, value: p.value }))} /></Panel>
        </div>
        <Panel title={t('Export report')} subtitle="Approved platform reports, ready for finance and operations">
          <div className="ws-quick-grid">
            <button className="ws-quick" onClick={() => exportOrdersToCSV(orders, materials, companies)}><span>📋</span>Order book</button>
            <button className="ws-quick" onClick={exportAccounts}><span>👥</span>Accounts</button>
            <button className="ws-quick" onClick={() => exportToCSV(companies, 'escon_suppliers_report')}><span>🏢</span>{t('Suppliers')}</button>
            <button className="ws-quick" onClick={() => exportToCSV(materials, 'escon_catalogue_report')}><span>📦</span>{t('Product Catalogue')}</button>
            <button className="ws-quick" onClick={() => exportToCSV(quotations, 'escon_quotations_report')}><span>📝</span>{t('Quotations')}</button>
            <button className="ws-quick" onClick={() => exportToCSV(complaints, 'escon_complaints_report')}><span>⚖️</span>{t('Complaints')}</button>
          </div>
        </Panel>
        <Panel title="Plain-language insights">
          <ul className="ws-insight-list">
            {analytics.insights.map((insight, index) => <li key={index}>💡 {insight}</li>)}
          </ul>
        </Panel>
      </>
    );
  };

  const renderComplaints = () => {
    const columns: Column<Complaint>[] = [
      { key: 'subject', header: 'Subject', value: c => c.subject, render: c => <div className="ws-cell-stack"><strong>{c.subject}</strong><small>{c.message}</small></div> },
      { key: 'userName', header: 'Raised by', value: c => c.userName, render: c => <div className="ws-cell-stack"><span>{c.userName}</span><small>{c.role}</small></div> },
      { key: 'category', header: 'Category', value: c => c.category },
      { key: 'againstName', header: 'Against', value: c => c.againstName || '—' },
      { key: 'createdAt', header: 'Created', value: c => c.createdAt, render: c => <span className="ws-nowrap">{timeAgo(c.createdAt)}</span> },
      { key: 'status', header: 'Status', value: c => c.status, render: c => <StatusPill label={t(c.status)} tone={toneFor(c.status)} /> },
      {
        key: 'actions', header: 'Actions', align: 'right', noExport: true,
        render: c => <button type="button" className="btn btn-secondary btn-sm" onClick={() => openComplaint(c)}>{t('Review')}</button>,
      },
    ];
    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('Complaints & Disputes')}
          hint={t('Receive, investigate and resolve complaints related to products, delivery, payments, quotations and service quality.')}
        />
        <KpiGrid>
          <Kpi label="Open" value={complaints.filter(c => c.status === 'open').length} icon="📬" tone={complaints.some(c => c.status === 'open') ? 'warn' : 'good'} />
          <Kpi label={t('Investigating')} value={complaints.filter(c => c.status === 'investigating').length} icon="🔎" />
          <Kpi label={t('Resolved')} value={complaints.filter(c => c.status === 'resolved').length} icon="✅" tone="good" />
          <Kpi label="Rejected" value={complaints.filter(c => c.status === 'rejected').length} icon="🚫" />
        </KpiGrid>
        <Panel>
          <DataTable rows={complaints} columns={columns} searchText={c => `${c.subject} ${c.message} ${c.userName} ${c.category} ${c.status}`} exportName="escon_complaints" emptyTitle="No complaints filed" />
        </Panel>
        {responseTarget && (
          <Modal
            title={`${t('Review')} · ${responseTarget.subject}`}
            onClose={() => setResponseTarget(null)}
            footer={
              <>
                <button className="btn btn-secondary" onClick={() => setResponseTarget(null)}>{t('Cancel')}</button>
                <button className="btn btn-secondary" onClick={() => saveComplaint('investigating')}>{t('Investigate')}</button>
                <button className="btn btn-secondary" onClick={() => saveComplaint('rejected')}>{t('Reject')}</button>
                <button className="btn btn-primary" onClick={() => saveComplaint('resolved')}>{t('Resolve')}</button>
              </>
            }
          >
            <div className="ws-detail-grid">
              <div><span>{t('Raised by')}</span><strong>{responseTarget.userName} ({responseTarget.role})</strong></div>
              <div><span>{t('Category')}</span><strong>{responseTarget.category}</strong></div>
              <div><span>{t('Against')}</span><strong>{responseTarget.againstName || '—'}</strong></div>
              <div><span>{t('Created')}</span><strong>{formatDate(new Date(responseTarget.createdAt).toISOString())}</strong></div>
            </div>
            <p className="ws-quote">{responseTarget.message}</p>
            <Field label={t('Response')} hint="Shared with the person who raised the complaint.">
              <textarea rows={5} value={responseText} onChange={event => setResponseText(event.target.value)} placeholder="Explain the outcome and next steps…" />
            </Field>
          </Modal>
        )}
      </>
    );
  };

  const renderNotifications = () => (
    <>
      <SectionHeader
        eyebrow={t('Administration')}
        title={t('Notifications & Communication')}
        hint={t('Send platform announcements, account notifications, order alerts, system updates and targeted messages.')}
      />
      <div className="ws-grid-2">
        <Panel title={t('Send announcement')} subtitle="Delivered to the notification drawer of every selected account">
          <div className="ws-form">
            <Field label="Audience">
              <select value={broadcastRole} onChange={event => setBroadcastRole(event.target.value as UserRole | 'all')}>
                <option value="all">Everyone</option>
                <option value="customer">Customers</option>
                <option value="company">Suppliers</option>
                <option value="transporter">Transporters</option>
                <option value="admin">Administrators</option>
              </select>
            </Field>
            <Field label={t('Subject')} required>
              <input value={broadcastTitle} onChange={event => setBroadcastTitle(event.target.value)} placeholder="Scheduled maintenance" maxLength={80} />
            </Field>
            <Field label={t('Message')} required>
              <textarea rows={4} value={broadcastBody} onChange={event => setBroadcastBody(event.target.value)} placeholder="E-SCON will be unavailable on Sunday 02:00–03:00 for scheduled maintenance." maxLength={280} />
            </Field>
            <button className="btn btn-primary" onClick={sendBroadcast}>📣 {t('Send')}</button>
          </div>
        </Panel>
        <Panel title={t('Recent activity')} subtitle="Latest platform notifications">
          {notifications.length === 0 ? (
            <EmptyState icon="🔔" title="No notifications yet" />
          ) : (
            <ul className="ws-feed">
              {notifications.slice(0, 8).map(item => (
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
      <Panel title="Templates" subtitle="One tap fills the composer">
        <div className="ws-quick-grid">
          {[
            { title: 'Scheduled maintenance', message: 'E-SCON will be unavailable on Sunday 02:00–03:00 for scheduled maintenance.' },
            { title: 'Price update', message: 'Supplier price updates have been published. Review current prices before ordering.' },
            { title: 'Verification required', message: 'Please upload your renewed business licence in the Verification Centre.' },
            { title: 'Delivery policy', message: 'Delivery fees are now calculated from the exact road distance to your site.' },
          ].map(template => (
            <button key={template.title} className="ws-quick" onClick={() => { setBroadcastTitle(template.title); setBroadcastBody(template.message); }}>
              <span>📄</span>{template.title}
            </button>
          ))}
        </div>
      </Panel>
    </>
  );

  const renderSecurity = () => {
    const columns: Column<AuditEvent>[] = [
      { key: 'at', header: 'Time', value: e => e.at, render: e => <span className="ws-nowrap">{new Date(e.at).toLocaleString('en-GB')}</span> },
      { key: 'actorName', header: 'Actor', value: e => e.actorName },
      { key: 'action', header: 'Action', value: e => e.action },
      { key: 'detail', header: 'Detail', value: e => e.detail },
    ];
    const capabilities: { label: string; roles: Record<UserRole, boolean> }[] = [
      { label: 'Manage users & roles', roles: { admin: true, company: false, customer: false, transporter: false } },
      { label: 'Verify suppliers', roles: { admin: true, company: false, customer: false, transporter: false } },
      { label: 'Publish products', roles: { admin: true, company: true, customer: false, transporter: false } },
      { label: 'Place orders', roles: { admin: false, company: false, customer: true, transporter: false } },
      { label: 'Accept delivery jobs', roles: { admin: false, company: false, customer: false, transporter: true } },
      { label: 'Change platform settings', roles: { admin: true, company: false, customer: false, transporter: false } },
    ];
    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('Security & Audit')}
          hint={t('Manage access permissions, MFA policies, login records, suspicious activity, audit logs and security incidents.')}
        />
        <KpiGrid>
          <Kpi label="Audit events" value={audit.length} icon="🧾" />
          <Kpi label="Locked accounts" value={users.filter(isUserLocked).length} icon="🔒" tone={users.some(isUserLocked) ? 'warn' : 'good'} />
          <Kpi label="Failed sign-ins" value={users.reduce((s, u) => s + (u.loginAttempts || 0), 0)} icon="⚠️" />
          <Kpi label={t('Administrators')} value={admins.length} icon="🛡️" />
        </KpiGrid>
        <Panel title="MFA policy" subtitle="Applies to the next sign-in on every device">
          <div className="ws-toggle-row">
            <div>
              <strong>Require multi-factor authentication</strong>
              <small>Ask administrators and suppliers for a second factor at sign-in.</small>
            </div>
            <button
              type="button"
              className={'ws-toggle' + (platform.mfaRequired ? ' on' : '')}
              aria-pressed={platform.mfaRequired}
              onClick={() => {
                setPlatform(prev => ({ ...prev, mfaRequired: !prev.mfaRequired }));
                logEvent('security.mfa', platform.mfaRequired ? 'disabled' : 'enabled');
              }}
            >
              {platform.mfaRequired ? 'On' : 'Off'}
            </button>
          </div>
          <p className="ws-note">Policy changes are recorded in the audit trail below.</p>
        </Panel>
        <Panel title="Permission matrix" subtitle="Role-based access enforced throughout the app">
          <div className="table-scroll-container">
            <table className="data-table ws-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Admin</th>
                  <th>Supplier</th>
                  <th>Customer</th>
                  <th>Transporter</th>
                </tr>
              </thead>
              <tbody>
                {capabilities.map(row => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    {(['admin', 'company', 'customer', 'transporter'] as UserRole[]).map(role => (
                      <td key={role}>{row.roles[role] ? <StatusPill label="Allowed" tone="good" /> : <span className="ws-muted">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title={t('Audit log')} subtitle="Device-local, append-only security trail">
          <DataTable rows={audit} columns={columns} searchText={e => `${e.action} ${e.actorName} ${e.detail}`} exportName="escon_audit" emptyTitle="No audit events yet" pageSize={12} />
        </Panel>
      </>
    );
  };

  const renderSettings = () => (
    <>
      <SectionHeader
        eyebrow={t('Administration')}
        title={t('Platform Settings')}
        hint={t('Configure language, currency, tax, units, locations, product categories, business rules and country settings.')}
        actions={<button className="btn btn-primary btn-sm" onClick={onEditSettings}>⚙️ Full settings</button>}
      />
      <div className="ws-grid-2">
        <Panel title="Localisation" subtitle="Default language and country for new visitors">
          <form className="ws-form" onSubmit={savePlatform}>
            <Field label={t('Language')} hint="Applies immediately to this device.">
              <select value={lang} onChange={event => setLang(event.target.value as 'en' | 'am')}>
                {LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.label} · {language.native}</option>)}
              </select>
            </Field>
            <Field label="Default language for new accounts">
              <select value={platform.defaultLanguage} onChange={event => setPlatform(prev => ({ ...prev, defaultLanguage: event.target.value as 'en' | 'am' }))}>
                {LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.label}</option>)}
              </select>
            </Field>
            <Field label="Country">
              <input value={platform.country} onChange={event => setPlatform(prev => ({ ...prev, country: event.target.value }))} />
            </Field>
            <Field label="Currency" hint="Amounts are stored and printed in this currency.">
              <input value={platform.currency} onChange={event => setPlatform(prev => ({ ...prev, currency: event.target.value }))} />
            </Field>
            <Field label="Tax label">
              <input value={platform.taxLabel} onChange={event => setPlatform(prev => ({ ...prev, taxLabel: event.target.value }))} />
            </Field>
            <div className="ws-form-row">
              <Field label={t('Phone')}><input value={platform.supportPhone} onChange={event => setPlatform(prev => ({ ...prev, supportPhone: event.target.value }))} /></Field>
              <Field label={t('Email')}><input value={platform.supportEmail} onChange={event => setPlatform(prev => ({ ...prev, supportEmail: event.target.value }))} /></Field>
            </div>
            <button type="submit" className="btn btn-primary">{t('Save')}</button>
          </form>
        </Panel>
        <div className="ws-stack">
          <Panel title="Business rules" subtitle="Managed on the full settings page">
            <ul className="ws-detail-list">
              <li><span>VAT</span><strong>{settings.vat.enabled ? `${settings.vat.rate}%` : 'Disabled'}</strong></li>
              <li><span>Delivery model</span><strong>{settings.delivery.mode === 'fixed' ? `Fixed ${money(settings.delivery.fixedFee)}` : `${money(settings.delivery.distanceBaseFee)} + ${money(settings.delivery.distancePerKmPerTon)}/km/ton`}</strong></li>
              <li><span>Minimum order</span><strong>{settings.minOrder.enabled ? money(settings.minOrder.amount) : 'Not enforced'}</strong></li>
              <li><span>Free delivery from</span><strong>{settings.delivery.freeDeliveryThreshold > 0 ? money(settings.delivery.freeDeliveryThreshold) : 'Disabled'}</strong></li>
              <li><span>Delivery zones</span><strong>{settings.delivery.zones.length}</strong></li>
            </ul>
            <button className="btn btn-secondary btn-sm" onClick={onEditSettings}>{t('Edit')} business rules</button>
          </Panel>
          <Panel title="Catalogue" subtitle="Units and categories available to suppliers">
            <p className="ws-muted">Units: {['pcs', 'kg', 'ton', 'm3', 'm2', 'bag', 'roll', 'box', 'set', 'quintal'].join(' · ')}</p>
            <p className="ws-muted">Categories in use: {Array.from(new Set(materials.map(m => m.category))).join(' · ') || '—'}</p>
          </Panel>
        </div>
      </div>
    </>
  );

  const renderMonitoring = () => {
    const recordCount = users.length + companies.length + materials.length + orders.length + projects.length + rfqs.length + quotations.length + complaints.length + transporterProfiles.length;
    const storageKb = (() => {
      try {
        return Math.round(JSON.stringify({
          users, companies, materials, orders, projects, rfqs, quotations, complaints,
        }).length / 1024);
      } catch {
        return 0;
      }
    })();
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    const integrations = [
      { name: 'Supabase cloud sync', state: isCloudEnabled ? 'Configured' : 'Offline mode', tone: isCloudEnabled ? 'good' as const : 'warn' as const, detail: 'escon_kv table · Realtime + polling fallback' },
      { name: 'OSRM routing', state: 'Operational', tone: 'good' as const, detail: 'Driving distance and ETA, two servers' },
      { name: 'Nominatim geocoding', state: 'Operational', tone: 'good' as const, detail: 'Address → coordinates, one request per second' },
      { name: 'OpenStreetMap tiles', state: online ? 'Operational' : 'Offline', tone: online ? 'good' as const : 'warn' as const, detail: 'Supplier and site maps' },
      { name: 'PWA service worker', state: 'serviceWorker' in navigator ? 'Registered' : 'Unsupported', tone: 'serviceWorker' in navigator ? 'good' as const : 'muted' as const, detail: 'Offline shell and cached assets' },
      { name: 'Wallet & payments', state: 'Local ledger', tone: 'info' as const, detail: 'Demo settlement, no live gateway keys' },
    ];
    return (
      <>
        <SectionHeader
          eyebrow={t('Administration')}
          title={t('Technical Monitoring')}
          hint={t('Monitor system health, API availability, integration errors, backups, database performance and service interruptions.')}
        />
        <KpiGrid>
          <Kpi label="Records" value={recordCount.toLocaleString()} hint="Across nine collections" icon="🗄️" />
          <Kpi label="Local storage" value={`${storageKb} KB`} hint="JSON snapshot size" icon="💾" />
          <Kpi label="Connectivity" value={online ? 'Online' : 'Offline'} icon={online ? '🌐' : '📡'} tone={online ? 'good' : 'warn'} />
          <Kpi label="Cloud sync" value={isCloudEnabled ? 'Active' : 'Local'} icon="☁️" tone={isCloudEnabled ? 'good' : 'warn'} />
          <Kpi label="Version" value={APP_VERSION} icon="🏷️" />
          <Kpi label="Audit events" value={audit.length} icon="🧾" />
        </KpiGrid>
        <Panel title="Connected platform services" subtitle="Every integration the platform depends on">
          <ul className="ws-integration-list">
            {integrations.map(item => (
              <li key={item.name}>
                <div><strong>{item.name}</strong><small>{item.detail}</small></div>
                <StatusPill label={item.state} tone={item.tone} />
              </li>
            ))}
          </ul>
        </Panel>
        <div className="ws-grid-2">
          <Panel title="Data collections" subtitle="Live record counts">
            <BarList
              items={[
                { label: 'Accounts', value: users.length },
                { label: 'Suppliers', value: companies.length },
                { label: 'Products', value: materials.length },
                { label: 'Orders', value: orders.length },
                { label: 'Projects', value: projects.length },
                { label: 'RFQs', value: rfqs.length },
                { label: 'Quotations', value: quotations.length },
                { label: 'Complaints', value: complaints.length },
                { label: 'Transporters', value: transporterProfiles.length },
              ]}
            />
          </Panel>
          <Panel title="Backups & recovery" subtitle="Export a portable snapshot of every collection">
            <p className="ws-muted">Backups include accounts, suppliers, products, orders, projects, RFQs, quotations, complaints, wallets, reviews, transporter profiles and settings.</p>
            <button className="btn btn-primary" onClick={onOpenDataCenter}>🛡️ Open Data Center</button>
          </Panel>
        </div>
      </>
    );
  };

  const renderSection = () => {
    switch (section) {
      case 'dashboard': return renderDashboard();
      case 'users': return renderUsers();
      case 'suppliers': return renderSuppliers();
      case 'customers': return renderCustomers();
      case 'transporters': return renderTransporters();
      case 'products': return renderProducts();
      case 'prices': return renderPrices();
      case 'orders': return renderOrders();
      case 'rfqs': return renderRfqs();
      case 'logistics': return renderLogistics();
      case 'finance': return renderFinance();
      case 'ai': return renderAi();
      case 'reports': return renderReports();
      case 'complaints': return renderComplaints();
      case 'notifications': return renderNotifications();
      case 'security': return renderSecurity();
      case 'settings': return renderSettings();
      case 'monitoring': return renderMonitoring();
      default: return renderDashboard();
    }
  };

  return (
    <WorkspaceShell
      menu="admin"
      section={section}
      onSection={onSection}
      badgeFor={id => {
        if (id === 'complaints') return complaints.filter(c => c.status === 'open').length || null;
        if (id === 'notifications') return notifications.filter(n => !n.read).length || null;
        if (id === 'orders') return orders.filter(o => o.status === 'pending').length || null;
        return null;
      }}
    >
      {renderSection()}
    </WorkspaceShell>
  );
};

export default AdminWorkspace;
