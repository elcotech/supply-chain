import React, { useState } from 'react';
import { AuditEvent, Company, Complaint, Material, Order, Quotation, Rfq, TransporterProfile, User, UserRole } from '../../types';
import { formatCurrency, formatDate, timeAgo, isUserLocked } from '../../utils';
import { monthlyTrend } from '../../lib/analytics';
import { isCloudEnabled } from '../../lib/supabaseClient';
import { LANGUAGES, useLanguage } from '../../lib/i18n';
import { APP_VERSION } from '../../version';
import { LineChart } from '../Charts';
import WorkspaceShell from './shell';
import { WorkspaceProps } from './types';
import { BarList, Column, DataTable, EmptyState, Field, Kpi, KpiGrid, Modal, Panel, ProgressBar, RangeSelect, SectionHeader, StatusPill, toneFor } from './ui';

const COMMISSION_RATE = 0.08;
const money = (v: number) => formatCurrency(Math.round((v || 0) * 100) / 100);

const AdminWorkspace: React.FC<WorkspaceProps> = props => {
  const {
    users, companies, materials, orders, notifications, transactions, transporterProfiles, settings,
    rfqs, quotations, complaints, setComplaints, platform, setPlatform, audit, logEvent,
    section, onSection, onNotify, onBroadcast, onUpdateOrderStatus, onUpdateUser, onDeleteUser,
    onUpdateCompany, onDeleteMaterial, onEditMaterial, onAdminEditCompany, onAddSupplier,
    onOpenDataCenter, onEditSettings, onUpdateTransporterProfile
  } = props;
  const { t, lang, setLang } = useLanguage();

  const [dashRange, setDashRange] = useState('12');
  const [roleFilter, setRoleFilter] = useState('all');
  const [complaintTarget, setComplaintTarget] = useState<Complaint | null>(null);
  const [complaintResponse, setComplaintResponse] = useState('');
  const [broadcastRole, setBroadcastRole] = useState<UserRole | 'all'>('all');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastCategory, setBroadcastCategory] = useState('Announcement');
  const [broadcastSupplier, setBroadcastSupplier] = useState('');

  const activeUsers = users.filter(u => !isUserLocked(u));
  const customers = users.filter(u => u.userType === 'customer');
  const supplierUsers = users.filter(u => u.userType === 'company');
  const admins = users.filter(u => u.userType === 'admin');
  const gmv = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0);
  const deliveredRevenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.totalAmount, 0);

  const userById = (id: string) => users.find(u => u.id === id);
  const companyById = (id: string) => companies.find(c => c.id === id);
  const materialById = (id: string) => materials.find(m => m.id === id);

  const exportCsv = (name: string, rows: Record<string, any>[]) => {
    try {
      const header = Object.keys(rows[0] || { record: '' });
      const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [header.join(','), ...rows.map(r => header.map(h => esc(r[h])).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch { onNotify('Unable to export file.', 'warning'); }
  };

  const toggleSuspend = (u: User) => {
    const suspended = isUserLocked(u);
    onUpdateUser({ ...u, lockUntil: suspended ? 0 : Date.now() + 3153600000000, loginAttempts: 0 });
    onNotify(suspended ? `${u.name} reactivated` : `${u.name} suspended`, suspended ? 'success' : 'warning');
    logEvent('user.status', `${u.name}: ${suspended ? 'active' : 'suspended'}`);
  };
  const setCompliance = (c: Company, status: Company['complianceStatus']) => {
    onUpdateCompany({ ...c, complianceStatus: status });
    onNotify(`${c.name}: ${status}`, status === 'compliant' ? 'success' : 'info');
    logEvent('supplier.compliance', `${c.name}  to  ${status}`);
  };
  const verifyTransporter = (p: TransporterProfile) => {
    onUpdateTransporterProfile({ ...p, verified: !p.verified });
    onNotify(`${p.companyName} ${p.verified ? 'unverified' : 'verified'}`, 'success');
  };
  const setOrderStatus = (o: Order, status: string) => {
    onUpdateOrderStatus(o.id, status);
    logEvent('order.status', `${o.invoiceNumber}  to  ${status}`);
  };
  const saveComplaint = (status: Complaint['status']) => {
    if (!complaintTarget) return;
    const updated: Complaint = { ...complaintTarget, status, response: complaintResponse.trim(), updatedAt: Date.now() };
    setComplaints(prev => prev.map(c => c.id === updated.id ? updated : c));
    onNotify(`Complaint ${status}`, status === 'resolved' ? 'success' : 'info');
    setComplaintTarget(null);
  };
  const sendBroadcast = () => {
    const title = broadcastTitle.trim();
    const message = broadcastBody.trim();
    if (!title || !message) { onNotify('Enter a title and a message.', 'warning'); return; }
    const sup = companies.find(c => c.id === broadcastSupplier);
    onBroadcast('system', title, message, broadcastRole, { category: broadcastCategory || 'Announcement', supplierId: sup?.id, supplierName: sup?.name });
    logEvent('broadcast', title);
    onNotify('Announcement sent', 'success');
    setBroadcastTitle(''); setBroadcastBody('');
  };

  const renderHome = () => (
    <>
      <SectionHeader eyebrow={t('Administration')} title="Home" hint="Vision, Mission and Services of E-SCON, with advertisements and graphics." />
      <div className="ws-grid-2">
        <Panel title="Vision" subtitle="E-SCON vision">
          <p style={{ lineHeight: 1.7 }}>To be Ethiopias most trusted integrated construction supply-chain network, enabling transparent, efficient and data-driven sourcing of quality materials for projects of every scale and beyond.</p>
        </Panel>
        <Panel title="Mission" subtitle="E-SCON mission">
          <p style={{ lineHeight: 1.7 }}>To connect verified suppliers, contractors and transporters through a secure digital marketplace that simplifies discovery, price comparison, quotations, ordering, payments and delivery tracking with accountability at every step.</p>
        </Panel>
      </div>
      <Panel title="Services of E-SCON" subtitle="Core platform services">
        <div className="ws-quick-grid">
          {[
            { icon: '', t: 'Digital Marketplace', d: 'Browse verified construction materials with advertised prices and supplier details.', id: 'products' },
            { icon: '', t: 'RFQ & Quotations', d: 'Request, receive, compare and manage supplier quotations as recorded ledgers.', id: 'rfqs' },
            { icon: '', t: 'Orders & Proformas', d: 'Place orders, generate proformas and track detailed buyersupplier transactions.', id: 'orders' },
            { icon: '', t: 'Logistics & Delivery', d: 'Coordinate transport, delivery progress and fulfillment status.', id: 'logistics' },
            { icon: '', t: 'Market Intelligence', d: 'Price trends, demand insights and geographic comparisons.', id: 'ai' },
            { icon: '...', t: 'Verification & Trust', d: 'Verification of suppliers, vehicles, licenses and compliance.', id: 'suppliers' },
          ].map(s => (
            <button key={s.t} type="button" className="ws-card" style={{ padding: 14, textAlign: 'left', cursor: 'pointer' }} onClick={() => onSection(s.id)}>
              <div style={{ fontSize: 22 }}>{s.icon}</div>
              <strong style={{ display: 'block', marginTop: 6 }}>{s.t}</strong>
              <p className="ws-muted" style={{ marginTop: 4 }}>{s.d}</p>
            </button>
          ))}
        </div>
      </Panel>
      <div className="ws-grid-2">
        <Panel title="Advertisements" subtitle="Featured promotions">
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="ws-card" style={{ padding: 14, borderLeft: '4px solid var(--es-gold, #D9B45B)' }}>
              <strong>Build Smarter. Source Better.</strong>
              <p className="ws-muted">Verified suppliers reaching contractors across Ethiopia on E-SCON 5.0.</p>
            </div>
            <div className="ws-card" style={{ padding: 14, borderLeft: '4px solid var(--es-info, #49A8DF)' }}>
              <strong>Contractor Spotlight</strong>
              <p className="ws-muted">Compare cement, rebar and aggregate prices with transparent delivery estimates.</p>
            </div>
            <div className="ws-card" style={{ padding: 14, borderLeft: '4px solid var(--es-success, #38C976)' }}>
              <strong>Reliable Delivery Network</strong>
              <p className="ws-muted">Verified transport partners and tracked deliveries to keep projects on schedule.</p>
            </div>
          </div>
        </Panel>
        <Panel title="Platform Highlights" subtitle="Graphics and at-a-glance metrics">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {[
              { label: 'Active Users', value: activeUsers.length, c: 'var(--es-gold, #D9B45B)' },
              { label: 'Suppliers', value: companies.length, c: 'var(--es-info, #49A8DF)' },
              { label: 'Products', value: materials.length, c: 'var(--es-cyan, #31C4D5)' },
              { label: 'Orders', value: orders.length, c: 'var(--es-success, #38C976)' },
            ].map(g => (
              <div key={g.label} className="ws-card" style={{ padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: g.c }}>{g.value.toLocaleString()}</div>
                <div className="ws-muted">{g.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: 'linear-gradient(135deg, rgba(217,180,91,0.18), rgba(73,168,223,0.12))', border: '1px solid var(--es-border, rgba(255,255,255,0.12))' }}>
            <strong style={{ color: 'var(--es-gold, #D9B45B)' }}>E-SCON 5.0</strong>
            <p className="ws-muted" style={{ marginTop: 4 }}>An Integrated Construction Supply-Chain Network for Ethiopia and Beyond.</p>
          </div>
        </Panel>
      </div>
    </>
  );

  const renderDashboard = () => {
    const months = Math.max(1, Number(dashRange) || 12);
    const trend = monthlyTrend(orders, months);
    const chartSeries = [
      { label: 'Cement', color: '#D9B45B', data: trend.revenue.map(p => ({ label: p.label, value: Math.round(p.value * 0.35) })) },
      { label: 'Rebar', color: '#49A8DF', data: trend.revenue.map(p => ({ label: p.label, value: Math.round(p.value * 0.4) })) },
      { label: 'Aggregate', color: '#31C4D5', data: trend.revenue.map(p => ({ label: p.label, value: Math.round(p.value * 0.25) })) },
    ];
    const approvals = [...companies].sort((a, b) => {
      const rank = (c: Company) => c.complianceStatus === 'pending' ? 0 : c.complianceStatus === 'non-compliant' ? 1 : 2;
      return rank(a) - rank(b);
    }).slice(0, 10);
    const approvalCols: Column<Company>[] = [
      { key: 'name', header: 'Business Name', value: c => c.name, render: c => <div className="ws-cell-stack"><strong>{c.name}</strong><small>{c.city}</small></div> },
      { key: 'req', header: 'Request ID', value: c => c.id, render: c => <span className="ws-mono">{(c.businessLicense || c.id).slice(-8).toUpperCase()}</span> },
      { key: 'date', header: 'Date', value: c => c.tradeLicenseExpiry || '', render: c => c.tradeLicenseExpiry ? formatDate(c.tradeLicenseExpiry) : '' },
      { key: 'status', header: 'Status', value: c => c.complianceStatus, render: c => <StatusPill label={t(c.complianceStatus)} tone={toneFor(c.complianceStatus)} /> },
      { key: 'progress', header: 'Progress', value: c => c.complianceStatus === 'compliant' ? 100 : c.complianceStatus === 'pending' ? 55 : 18, render: c => { const pct = c.complianceStatus === 'compliant' ? 100 : c.complianceStatus === 'pending' ? 55 : 18; return <div className="ws-pill-stack"><ProgressBar value={pct} tone={c.complianceStatus === 'compliant' ? 'good' : c.complianceStatus === 'pending' ? 'warn' : 'bad'} /><small className="ws-muted">{pct}%</small></div>; } },
      { key: 'action', header: '', noExport: true, render: c => <button className="btn btn-secondary btn-sm" onClick={() => onSection('suppliers')}>{c.complianceStatus === 'compliant' ? 'View' : 'Review'}</button> },
    ];
    const queues = [
      { label: 'User Verification Queue', value: users.filter(u => isUserLocked(u)).length, hint: 'Attention required', id: 'users', icon: '' },
      { label: 'Supplier Verification Queue', value: companies.filter(c => c.complianceStatus !== 'compliant').length, hint: 'Applications to review', id: 'suppliers', icon: '' },
      { label: 'Transport Verification Queue', value: transporterProfiles.filter(p => !p.verified).length, hint: 'Vehicles and operators', id: 'transporters', icon: '' },
      { label: 'Product Statistics', value: materials.length, hint: `${materials.filter(m => m.quantity <= 0).length} out of stock`, id: 'products', icon: '' },
    ];
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="Administration Dashboard" hint="Platform-wide users, suppliers, vehicles, RFQs and orders with real-time analytics." actions={<RangeSelect label="Period" value={dashRange} onChange={setDashRange} options={[{ value: '3', label: '3 months' }, { value: '6', label: '6 months' }, { value: '12', label: '12 months' }]} />} />
        <KpiGrid>
          <Kpi label="Active Users" value={activeUsers.length.toLocaleString()} hint="Registered active accounts" icon="" />
          <Kpi label="Registered Suppliers" value={companies.length.toLocaleString()} hint={`${companies.filter(c => c.complianceStatus === 'compliant').length} verified`} icon="" tone="good" />
          <Kpi label="Verified Vehicles" value={transporterProfiles.filter(p => p.verified).length.toLocaleString()} hint="Approved transport fleet" icon="" />
          <Kpi label="RFQs" value={rfqs.length.toLocaleString()} hint="Total quotation requests" icon="" tone="warn" />
          <Kpi label="Total Orders" value={orders.length.toLocaleString()} hint="Platform-wide orders" icon="" tone="accent" />
        </KpiGrid>
        <Panel title="Platform-wide Real-time Analytics" subtitle="Construction material demand and transaction activity"><LineChart series={chartSeries} height={220} valueFormatter={money} showArea /></Panel>
        <div className="ws-grid-2">
          <Panel title="Supplier License Approvals" subtitle="Verification status and progress"><DataTable rows={approvals} columns={approvalCols} exportName="supplier_license_approvals" pageSize={6} /></Panel>
          <Panel title="Verification Queue" subtitle="Pending reviews and key statistics">
            <div className="ws-quick-grid">
              {queues.map(q => (
                <button key={q.label} className="ws-card" style={{ textAlign: 'left', padding: 14, cursor: 'pointer' }} onClick={() => onSection(q.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 22 }}>{q.icon}</span><span style={{ color: 'var(--es-gold, #D9B45B)' }}></span></div>
                  <strong style={{ display: 'block', marginTop: 8 }}>{q.label}</strong>
                  <div style={{ fontSize: 26, fontWeight: 800, margin: '4px 0' }}>{q.value}</div>
                  <small className="ws-muted">{q.hint}</small>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </>
    );
  };

  const renderUsers = () => {
    const rows = users.filter(u => roleFilter === 'all' || u.userType === roleFilter);
    const cols: Column<User>[] = [
      { key: 'name', header: 'Name', value: u => u.name, render: u => <div className="ws-cell-stack"><strong>{u.name}</strong><small>{u.email}</small></div> },
      { key: 'role', header: 'Role', value: u => u.userType, render: u => <StatusPill label={u.userType} tone="info" /> },
      { key: 'city', header: 'City', value: u => u.city || '' },
      { key: 'phone', header: 'Phone', value: u => u.phone || '' },
      { key: 'status', header: 'Status', value: u => isUserLocked(u) ? 'suspended' : 'active', render: u => isUserLocked(u) ? <StatusPill label="Suspended" tone="bad" /> : <StatusPill label="Active" tone="good" /> },
      { key: 'actions', header: 'Actions', align: 'right', noExport: true, render: u => <div className="ws-row-actions"><button className="btn btn-secondary btn-sm" onClick={() => toggleSuspend(u)}>{isUserLocked(u) ? 'Activate' : 'Suspend'}</button><button className="btn btn-secondary btn-sm" onClick={() => { if (window.confirm(`Delete ${u.name}?`)) { onDeleteUser(u.id); logEvent('user.delete', u.name); } }}>Delete</button></div> },
    ];
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="User Management" hint="Search, filter, view, activate, suspend and manage roles." actions={<select className="ws-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}><option value="all">All roles</option><option value="admin">Admin</option><option value="company">Supplier</option><option value="customer">Customer</option><option value="transporter">Transporter</option></select>} />
        <KpiGrid>
          <Kpi label="Total users" value={users.length} icon="" />
          <Kpi label="Customers" value={customers.length} icon="" />
          <Kpi label="Suppliers" value={supplierUsers.length} icon="" />
          <Kpi label="Admins" value={admins.length} icon="" />
        </KpiGrid>
        <Panel><DataTable rows={rows} columns={cols} searchText={u => `${u.name} ${u.email} ${u.city} ${u.userType}`} exportName="users" pageSize={12} /></Panel>
      </>
    );
  };

  const renderCustomers = () => {
    const spendFor = (id: string) => orders
      .filter(o => o.customerId === id && o.status !== 'cancelled')
      .reduce((s, o) => s + o.totalAmount, 0);
    const cols: Column<User>[] = [
      { key: 'name', header: 'Customer', value: u => u.name, render: u => <div className="ws-cell-stack"><strong>{u.name}</strong><small>{u.email}</small></div> },
      { key: 'city', header: 'City', value: u => u.city || '' },
      { key: 'phone', header: 'Phone', value: u => u.phone || '' },
      { key: 'orders', header: 'Orders', align: 'right', value: u => orders.filter(o => o.customerId === u.id).length },
      { key: 'spend', header: 'Total spend', align: 'right', value: u => spendFor(u.id), render: u => <strong>{money(spendFor(u.id))}</strong> },
      { key: 'status', header: 'Status', value: u => isUserLocked(u) ? 'suspended' : 'active', render: u => isUserLocked(u) ? <StatusPill label="Suspended" tone="bad" /> : <StatusPill label="Active" tone="good" /> },
      { key: 'actions', header: 'Actions', align: 'right', noExport: true, render: u => <div className="ws-row-actions"><button className="btn btn-secondary btn-sm" onClick={() => toggleSuspend(u)}>{isUserLocked(u) ? 'Activate' : 'Suspend'}</button><button className="btn btn-secondary btn-sm" onClick={() => onSection('users')}>Manage</button></div> },
    ];
    const totalSpend = customers.reduce((s, u) => s + spendFor(u.id), 0);
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="Customer Management" hint="Registered contractors and buyers, order activity and total spend." actions={<button className="btn btn-secondary btn-sm" onClick={() => onSection('users')}>All users</button>} />
        <KpiGrid>
          <Kpi label="Customers" value={customers.length} icon="" />
          <Kpi label="Active" value={customers.filter(u => !isUserLocked(u)).length} icon="" tone="good" />
          <Kpi label="Suspended" value={customers.filter(isUserLocked).length} icon="" tone="bad" />
          <Kpi label="Customer spend" value={money(totalSpend)} icon="" />
        </KpiGrid>
        <Panel><DataTable rows={customers} columns={cols} searchText={u => `${u.name} ${u.email} ${u.city} ${u.phone}`} exportName="customers" pageSize={12} /></Panel>
      </>
    );
  };

  const renderSuppliers = () => {
    const cols: Column<Company>[] = [
      { key: 'name', header: 'Supplier', value: c => c.name, render: c => <div className="ws-cell-stack"><strong>{c.name}</strong><small>{c.city}  {c.tinNumber || 'No TIN'}</small></div> },
      { key: 'license', header: 'License / TIN', value: c => c.businessLicense || c.tinNumber || '' },
      { key: 'compliance', header: 'Compliance', value: c => c.complianceStatus, render: c => <StatusPill label={t(c.complianceStatus)} tone={toneFor(c.complianceStatus)} /> },
      { key: 'products', header: 'Products', align: 'right', value: c => materials.filter(m => m.companyId === c.id).length },
      { key: 'orders', header: 'Orders', align: 'right', value: c => orders.filter(o => o.companyId === c.id).length },
      { key: 'actions', header: 'Actions', align: 'right', noExport: true, render: c => <div className="ws-row-actions"><button className="btn btn-secondary btn-sm" onClick={() => setCompliance(c, 'compliant')}>Approve</button><button className="btn btn-secondary btn-sm" onClick={() => setCompliance(c, 'pending')}>Review</button><button className="btn btn-secondary btn-sm" onClick={() => setCompliance(c, 'non-compliant')}>Reject</button><button className="btn btn-secondary btn-sm" onClick={() => onAdminEditCompany(c)}>View</button></div> },
    ];
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="Supplier Verification" hint="Review applications, licenses and documents; approve or reject suppliers." actions={<button className="btn btn-primary btn-sm" onClick={onAddSupplier}>+ Add Supplier</button>} />
        <KpiGrid>
          <Kpi label="Total suppliers" value={companies.length} icon="" />
          <Kpi label="Compliant" value={companies.filter(c => c.complianceStatus === 'compliant').length} icon="" tone="good" />
          <Kpi label="Pending" value={companies.filter(c => c.complianceStatus === 'pending').length} icon="" tone="warn" />
          <Kpi label="Non-compliant" value={companies.filter(c => c.complianceStatus === 'non-compliant').length} icon="" tone="bad" />
        </KpiGrid>
        <Panel><DataTable rows={companies} columns={cols} searchText={c => `${c.name} ${c.city} ${c.tinNumber} ${c.complianceStatus}`} exportName="supplier_verification" pageSize={12} /></Panel>
      </>
    );
  };

  const renderTransporters = () => (
    <>
      <SectionHeader eyebrow={t('Administration')} title="Transport Verification" hint="Verify vehicle registrations, ownership and transport operators." />
      <KpiGrid>
        <Kpi label="Profiles" value={transporterProfiles.length} icon="" />
        <Kpi label="Verified vehicles/operators" value={transporterProfiles.filter(p => p.verified).length} icon="" tone="good" />
        <Kpi label="Pending verification" value={transporterProfiles.filter(p => !p.verified).length} icon="" tone="warn" />
      </KpiGrid>
      <Panel>
        {transporterProfiles.length === 0 ? <EmptyState icon="" title="No transporter profiles" text="Transport operators will appear here for verification." /> : (
          <div className="table-scroll-container"><table className="data-table ws-table"><thead><tr><th>Company</th><th>City</th><th>Vehicles</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {transporterProfiles.map(p => (
              <tr key={p.id}>
                <td><strong>{p.companyName}</strong></td>
                <td>{p.city}</td>
                <td>{p.vehicles?.length || 0}</td>
                <td><StatusPill label={p.verified ? 'Verified' : 'Pending'} tone={p.verified ? 'good' : 'warn'} /></td>
                <td><div className="ws-row-actions"><button className="btn btn-secondary btn-sm" onClick={() => verifyTransporter(p)}>{p.verified ? 'Revoke' : 'Verify'}</button></div></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </Panel>
    </>
  );

  const renderLogistics = () => {
    const inTransit = orders.filter(o => o.status === 'shipped').length;
    const pipeline = ['pending', 'confirmed', 'shipped', 'delivered'].map(status => ({
      label: status,
      value: orders.filter(o => o.status === status).length,
    }));
    const cols: Column<TransporterProfile>[] = [
      { key: 'company', header: 'Transport partner', value: p => p.companyName, render: p => <div className="ws-cell-stack"><strong>{p.companyName}</strong><small>{p.licenseNumber || p.tinNumber || 'No license'}</small></div> },
      { key: 'city', header: 'City', value: p => p.city },
      { key: 'vehicles', header: 'Vehicles', align: 'right', value: p => p.vehicles?.length || 0 },
      { key: 'drivers', header: 'Drivers', align: 'right', value: p => p.drivers?.length || 0 },
      { key: 'rate', header: 'Rate / km', align: 'right', value: p => p.ratePerKm, render: p => money(p.ratePerKm) },
      { key: 'status', header: 'Status', value: p => p.verified ? 'verified' : 'pending', render: p => <StatusPill label={p.verified ? 'Verified' : 'Pending'} tone={p.verified ? 'good' : 'warn'} /> },
      { key: 'actions', header: 'Actions', align: 'right', noExport: true, render: p => <button className="btn btn-secondary btn-sm" onClick={() => verifyTransporter(p)}>{p.verified ? 'Revoke' : 'Verify'}</button> },
    ];
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="Logistics Management" hint="Transport partners, fleet capacity and the delivery pipeline." actions={<button className="btn btn-secondary btn-sm" onClick={() => onSection('transporters')}>Verification queue</button>} />
        <KpiGrid>
          <Kpi label="Transport partners" value={transporterProfiles.length} icon="" />
          <Kpi label="Verified" value={transporterProfiles.filter(p => p.verified).length} icon="" tone="good" />
          <Kpi label="Fleet size" value={transporterProfiles.reduce((s, p) => s + (p.vehicles?.length || 0), 0)} icon="" />
          <Kpi label="In transit" value={inTransit} icon="" tone="warn" />
        </KpiGrid>
        <div className="ws-grid-2">
          <Panel title="Fleet by partner"><BarList items={transporterProfiles.map(p => ({ label: p.companyName, value: p.vehicles?.length || 0 })).sort((a, b) => b.value - a.value).slice(0, 10)} /></Panel>
          <Panel title="Delivery pipeline"><BarList items={pipeline} /></Panel>
        </div>
        <Panel title="Transport partners"><DataTable rows={transporterProfiles} columns={cols} searchText={p => `${p.companyName} ${p.city} ${p.licenseNumber} ${p.verified ? 'verified' : 'pending'}`} exportName="logistics_partners" pageSize={12} /></Panel>
      </>
    );
  };

  const renderProducts = () => (
    <>
      <SectionHeader eyebrow={t('Administration')} title="Product Management" hint="View, categorize and monitor all material listings, prices and availability." />
      <KpiGrid>
        <Kpi label="Products" value={materials.length} icon="" />
        <Kpi label="Categories" value={new Set(materials.map(m => m.category)).size} icon="" />
        <Kpi label="Out of stock" value={materials.filter(m => m.quantity <= 0).length} icon="" tone="bad" />
      </KpiGrid>
      <Panel>
        <DataTable rows={materials} columns={[
          { key: 'name', header: 'Product', value: m => m.name, render: m => <div className="ws-cell-stack"><strong>{m.name}</strong><small>{m.category}</small></div> },
          { key: 'supplier', header: 'Supplier', value: m => companyById(m.companyId)?.name || '' },
          { key: 'price', header: 'Price', align: 'right', value: m => m.price, render: m => <strong>{money(m.price)}</strong> },
          { key: 'qty', header: 'Stock', align: 'right', value: m => m.quantity },
          { key: 'actions', header: 'Actions', align: 'right', noExport: true, render: m => <div className="ws-row-actions"><button className="btn btn-secondary btn-sm" onClick={() => onEditMaterial(m)}>Edit</button><button className="btn btn-secondary btn-sm" onClick={() => { if (window.confirm('Delete this product?')) onDeleteMaterial(m.id); }}>Delete</button></div> },
        ] as Column<Material>[]} searchText={m => `${m.name} ${m.category} ${companyById(m.companyId)?.name || ''}`} exportName="products" pageSize={12} />
      </Panel>
    </>
  );

  const renderPrices = () => {
    const priced = [...materials].sort((a, b) => b.price - a.price);
    const avg = materials.length ? materials.reduce((s, m) => s + m.price, 0) / materials.length : 0;
    const cols: Column<Material>[] = [
      { key: 'name', header: 'Material', value: m => m.name, render: m => <div className="ws-cell-stack"><strong>{m.name}</strong><small>{m.category}</small></div> },
      { key: 'supplier', header: 'Supplier', value: m => companyById(m.companyId)?.name || '' },
      { key: 'unit', header: 'Unit', value: m => m.unit },
      { key: 'base', header: 'Base price', align: 'right', value: m => m.basePrice, render: m => money(m.basePrice) },
      { key: 'margin', header: 'Margin', align: 'right', value: m => Math.round((m.profitMargin || 0) * 100), render: m => `${Math.round((m.profitMargin || 0) * 100)}%` },
      { key: 'price', header: 'Advertised', align: 'right', value: m => m.price, render: m => <strong>{money(m.price)}</strong> },
      { key: 'stock', header: 'Stock', align: 'right', value: m => m.quantity, render: m => m.quantity > 0 ? String(m.quantity) : <StatusPill label="Out of stock" tone="bad" /> },
    ];
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="Price Management" hint="Monitor base prices, margins, advertised prices and stock across every listing." actions={<button className="btn btn-secondary btn-sm" onClick={() => onSection('products')}>Open products</button>} />
        <KpiGrid>
          <Kpi label="Listed prices" value={materials.length} icon="" />
          <Kpi label="Average price" value={money(avg)} icon="" />
          <Kpi label="Highest price" value={money(priced[0]?.price || 0)} icon="" tone="warn" />
          <Kpi label="Out of stock" value={materials.filter(m => m.quantity <= 0).length} icon="" tone="bad" />
        </KpiGrid>
        <Panel title="Price monitor"><DataTable rows={priced} columns={cols} searchText={m => `${m.name} ${m.category} ${companyById(m.companyId)?.name || ''}`} exportName="price_management" pageSize={12} /></Panel>
      </>
    );
  };

  const renderRfqs = () => (
    <>
      <SectionHeader eyebrow={t('Administration')} title="RFQ Management" hint="Monitor all quotation requests, responses and status." />
      <KpiGrid>
        <Kpi label="RFQs" value={rfqs.length} icon="" />
        <Kpi label="Open" value={rfqs.filter(r => r.status === 'open').length} icon="" tone="warn" />
        <Kpi label="Quotations received" value={quotations.length} icon="" />
      </KpiGrid>
      <Panel>
        <DataTable rows={rfqs} columns={[
          { key: 'id', header: 'RFQ', value: r => r.id, render: r => <span className="ws-mono">{r.id.slice(-8).toUpperCase()}</span> },
          { key: 'customer', header: 'Customer', value: r => r.customerName },
          { key: 'material', header: 'Material', value: r => r.materialName },
          { key: 'qty', header: 'Qty', align: 'right', value: r => r.quantity },
          { key: 'status', header: 'Status', value: r => r.status, render: r => <StatusPill label={r.status} tone={toneFor(r.status)} /> },
          { key: 'date', header: 'Created', value: r => r.createdAt, render: r => timeAgo(r.createdAt) },
        ] as Column<Rfq>[]} searchText={r => `${r.materialName} ${r.customerName} ${r.status}`} exportName="rfqs" pageSize={12} />
      </Panel>
    </>
  );

  const renderOrders = () => {
    const cols: Column<Order>[] = [
      { key: 'invoice', header: 'Order', value: o => o.invoiceNumber, render: o => <div className="ws-cell-stack"><strong>{o.invoiceNumber}</strong><small>{formatDate(o.orderDate)}</small></div> },
      { key: 'buyer', header: 'Buyer', value: o => userById(o.customerId)?.name || o.customerId },
      { key: 'supplier', header: 'Supplier', value: o => companyById(o.companyId)?.name || '' },
      { key: 'total', header: 'Total', align: 'right', value: o => o.totalAmount, render: o => <strong>{money(o.totalAmount)}</strong> },
      { key: 'payment', header: 'Payment', value: o => o.paymentStatus, render: o => <StatusPill label={t(o.paymentStatus)} tone={toneFor(o.paymentStatus)} /> },
      { key: 'status', header: 'Status', value: o => o.status, render: o => <select className="ws-status-select" value={o.status} onChange={e => setOrderStatus(o, e.target.value)}>{['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{t(s)}</option>)}</select> },
    ];
    const ordered = [...orders].sort((a, b) => (b.orderDate || '').localeCompare(a.orderDate || ''));
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="Order Management" hint="All orders with detailed buyersupplier transactions, summaries and export." />
        <KpiGrid>
          <Kpi label="Orders" value={orders.length} icon="" />
          <Kpi label="Pending" value={orders.filter(o => o.status === 'pending').length} icon="" tone="warn" />
          <Kpi label="Delivered" value={orders.filter(o => o.status === 'delivered').length} icon="" tone="good" />
          <Kpi label="GMV" value={money(gmv)} icon="" />
        </KpiGrid>
        <Panel title="All transactions"><DataTable rows={ordered} columns={cols} searchText={o => `${o.invoiceNumber} ${userById(o.customerId)?.name || ''} ${companyById(o.companyId)?.name || ''} ${o.status}`} exportName="orders_transactions" pageSize={12} /></Panel>
        <Panel title="Detailed buyer & supplier transactions" subtitle="Preview and download per-order summaries">
          <div style={{ display: 'grid', gap: 10 }}>
            {ordered.slice(0, 20).map(o => {
              const buyer = userById(o.customerId);
              const sup = companyById(o.companyId);
              const mat = materialById(o.materialId);
              return (
                <div key={o.id} className="ws-card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div><strong>{o.invoiceNumber}</strong> <StatusPill label={o.status} tone={toneFor(o.status)} /> <StatusPill label={o.paymentStatus} tone={toneFor(o.paymentStatus)} /></div>
                    <div className="ws-muted">{formatDate(o.orderDate)}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8, marginTop: 8, fontSize: 13 }}>
                    <div><span className="ws-muted">Buyer</span><div><strong>{buyer?.name || ''}</strong><div className="ws-muted">{buyer?.phone || ''}</div></div></div>
                    <div><span className="ws-muted">Supplier</span><div><strong>{sup?.name || ''}</strong><div className="ws-muted">{sup?.city || ''}</div></div></div>
                    <div><span className="ws-muted">Item</span><div>{mat?.name || o.materialId} - {o.quantity}</div></div>
                    <div><span className="ws-muted">Total</span><div><strong>{money(o.totalAmount)}</strong></div></div>
                  </div>
                  <div className="ws-row-actions" style={{ marginTop: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => exportCsv(`${o.invoiceNumber}-summary.csv`, [{ invoice: o.invoiceNumber, date: o.orderDate, buyer: buyer?.name || '', buyer_phone: buyer?.phone || '', supplier: sup?.name || '', item: mat?.name || o.materialId, quantity: o.quantity, unit_price: o.unitPrice, total: o.totalAmount, payment: o.paymentStatus, status: o.status, delivery_address: (o as any).address || (o as any).deliveryAddress || '' }])}>Download summary</button>
                  </div>
                </div>
              );
            })}
            {orders.length === 0 && <EmptyState icon="" title="No orders yet" text="Orders will appear here with full transaction details." />}
          </div>
        </Panel>
      </>
    );
  };

  const renderMarket = () => {
    const cats = Array.from(new Set(materials.map(m => m.category))).filter(Boolean);
    const avg = materials.length ? materials.reduce((s, m) => s + m.price, 0) / materials.length : 0;
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="Market Intelligence" hint="Monitor material prices, demand, categories and geographic markets." />
        <KpiGrid>
          <Kpi label="Products" value={materials.length} icon="" />
          <Kpi label="Categories" value={cats.length} icon="" />
          <Kpi label="Avg price" value={money(avg)} icon="" />
          <Kpi label="Cities" value={new Set(companies.map(c => c.city)).size} icon="" />
        </KpiGrid>
        <div className="ws-grid-2">
          <Panel title="By category"><BarList items={cats.map(cat => ({ label: cat, value: materials.filter(m => m.category === cat).length })).sort((a,b)=>b.value-a.value).slice(0,10)} /></Panel>
          <Panel title="By supplier"><BarList items={companies.map(c => ({ label: c.name, value: materials.filter(m => m.companyId === c.id).length })).sort((a,b)=>b.value-a.value).slice(0,10)} /></Panel>
        </div>
        <Panel title="Price & availability overview">
          <DataTable rows={materials} columns={[
            { key: 'name', header: 'Material', value: m => m.name },
            { key: 'category', header: 'Category', value: m => m.category },
            { key: 'supplier', header: 'Supplier', value: m => companyById(m.companyId)?.name || '' },
            { key: 'city', header: 'Place', value: m => companyById(m.companyId)?.city || '' },
            { key: 'price', header: 'Price', align: 'right', value: m => m.price, render: m => money(m.price) },
            { key: 'qty', header: 'Stock', align: 'right', value: m => m.quantity },
          ] as Column<Material>[]} searchText={m => `${m.name} ${m.category} ${companyById(m.companyId)?.name || ''} ${companyById(m.companyId)?.city || ''}`} exportName="market_intelligence" pageSize={12} />
        </Panel>
      </>
    );
  };

  const renderAi = () => {
    const trend = monthlyTrend(orders, 6);
    const demandByCategory = Array.from(new Set(materials.map(m => m.category))).filter(Boolean).map(category => ({
      label: category,
      value: orders
        .filter(o => materialById(o.materialId)?.category === category && o.status !== 'cancelled')
        .reduce((s, o) => s + o.totalAmount, 0),
    })).sort((a, b) => b.value - a.value);
    const recent = trend.revenue.length ? trend.revenue[trend.revenue.length - 1].value : 0;
    const previous = trend.revenue.length > 1 ? trend.revenue[trend.revenue.length - 2].value : recent;
    const growth = previous > 0 ? ((recent - previous) / previous) * 100 : 0;
    const projected = recent * (1 + Math.max(growth, 0) / 100);
    const series = [{ label: 'Order value', color: '#D9B45B', data: trend.revenue.map(p => ({ label: p.label, value: p.value })) }];
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="AI Intelligence Centre" hint="Demand signals, category forecasts and model-based market insights." actions={<button className="btn btn-secondary btn-sm" onClick={() => onSection('market')}>Market data</button>} />
        <KpiGrid>
          <Kpi label="Demand signals" value={demandByCategory.filter(d => d.value > 0).length} icon="" />
          <Kpi label="Top category" value={demandByCategory[0]?.label || 'No data'} icon="" />
          <Kpi label="Monthly growth" value={`${growth.toFixed(1)}%`} icon="" tone={growth >= 0 ? 'good' : 'bad'} />
          <Kpi label="Next month forecast" value={money(projected)} icon="" tone="accent" />
        </KpiGrid>
        <Panel title="Order value trend and forecast" subtitle="Last six months with a projected next month based on current growth"><LineChart series={series} height={220} valueFormatter={money} showArea /></Panel>
        <div className="ws-grid-2">
          <Panel title="Category demand"><BarList items={demandByCategory.slice(0, 10)} /></Panel>
          <Panel title="Model notes" subtitle="How these signals are produced">
            <ul className="ws-detail-list">
              <li><span>Input</span><strong>Orders, listings and prices</strong></li>
              <li><span>Window</span><strong>Six months</strong></li>
              <li><span>Method</span><strong>Trend projection</strong></li>
              <li><span>Refresh</span><strong>On every data change</strong></li>
            </ul>
            <p className="ws-muted" style={{ marginTop: 10 }}>Forecasts are indicative and should be combined with supplier capacity and seasonal demand.</p>
          </Panel>
        </div>
      </>
    );
  };

  const renderFinance = () => (
    <>
      <SectionHeader eyebrow={t('Administration')} title="Financial Management" hint="Transactions, payments and platform financial summaries." actions={<button className="btn btn-secondary btn-sm" onClick={() => exportCsv('financial_transactions.csv', transactions.map(t => ({ date: new Date(t.date).toISOString(), user: userById(t.userId)?.name || t.userId, type: t.kind, amount: t.amount, note: t.note })))}>Export</button>} />
      <KpiGrid>
        <Kpi label="GMV" value={money(gmv)} icon="" />
        <Kpi label="Delivered revenue" value={money(deliveredRevenue)} icon="" tone="good" />
        <Kpi label="Est. commission" value={money(deliveredRevenue * COMMISSION_RATE)} icon="" />
        <Kpi label="Wallet transactions" value={transactions.length} icon="" />
      </KpiGrid>
      <Panel title="Wallet transactions">
        <DataTable rows={transactions} columns={[
          { key: 'date', header: 'Date', value: (tx: any) => tx.date, render: (tx: any) => formatDate(new Date(tx.date).toISOString()) },
          { key: 'user', header: 'Account', value: (tx: any) => userById(tx.userId)?.name || tx.userId },
          { key: 'kind', header: 'Type', value: (tx: any) => tx.kind },
          { key: 'amount', header: 'Amount', align: 'right', value: (tx: any) => tx.amount, render: (tx: any) => money(tx.amount) },
          { key: 'note', header: 'Note', value: (tx: any) => tx.note || '' },
        ] as Column<any>[]} searchText={(tx: any) => `${tx.kind} ${tx.note || ''} ${userById(tx.userId)?.name || ''}`} exportName="financial_transactions" pageSize={12} />
      </Panel>
    </>
  );

  const renderReports = () => (
    <>
      <SectionHeader eyebrow={t('Administration')} title="Reports" hint="Platform reports with downloadable summaries." actions={<div className="ws-row-actions"><button className="btn btn-secondary btn-sm" onClick={() => exportCsv('orders_report.csv', orders.map(o => ({ invoice: o.invoiceNumber, buyer: userById(o.customerId)?.name || '', supplier: companyById(o.companyId)?.name || '', total: o.totalAmount, status: o.status, payment: o.paymentStatus, date: o.orderDate })))}>Orders CSV</button><button className="btn btn-secondary btn-sm" onClick={() => exportCsv('quotations_report.csv', quotations.map(q => ({ id: q.id, supplier: q.supplierName, rfq: q.rfqId, unit_price: q.unitPrice, quantity: q.quantity, total: q.unitPrice * q.quantity + q.deliveryFee, status: q.status })))}>Quotations CSV</button></div>} />
      <KpiGrid>
        <Kpi label="Users" value={users.length} icon="" />
        <Kpi label="Suppliers" value={companies.length} icon="" />
        <Kpi label="Products" value={materials.length} icon="" />
        <Kpi label="Orders" value={orders.length} icon="" />
        <Kpi label="RFQs" value={rfqs.length} icon="" />
        <Kpi label="Quotations" value={quotations.length} icon="" />
      </KpiGrid>
      <Panel title="Platform summary"><BarList items={[{ label: 'Users', value: users.length }, { label: 'Suppliers', value: companies.length }, { label: 'Products', value: materials.length }, { label: 'Orders', value: orders.length }, { label: 'RFQs', value: rfqs.length }, { label: 'Quotations', value: quotations.length }, { label: 'Complaints', value: complaints.length }, { label: 'Notifications', value: notifications.length }]} /></Panel>
    </>
  );

  const renderComplaints = () => (
    <>
      <SectionHeader eyebrow={t('Administration')} title="Complaints" hint="Manage and resolve customer and supplier complaints and disputes." />
      <Panel>
        {complaints.length === 0 ? <EmptyState icon="" title="No complaints" text="Submitted complaints will appear here for review and resolution." /> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {[...complaints].sort((a, b) => b.updatedAt - a.updatedAt).map(c => (
              <div key={c.id} className="ws-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{c.subject}</strong><StatusPill label={c.status} tone={toneFor(c.status)} /></div>
                <p className="ws-muted" style={{ margin: '6px 0' }}>{c.message}</p>
                {c.response && <p style={{ fontSize: 13 }}><strong>Response:</strong> {c.response}</p>}
                <div className="ws-row-actions"><button className="btn btn-secondary btn-sm" onClick={() => { setComplaintTarget(c); setComplaintResponse(c.response || ''); }}>Respond / Update</button></div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {complaintTarget && (
        <Modal title={`Complaint: ${complaintTarget.subject}`} onClose={() => setComplaintTarget(null)} footer={<><button className="btn btn-secondary" onClick={() => saveComplaint('investigating')}>Mark Investigating</button><button className="btn btn-primary" onClick={() => saveComplaint('resolved')}>Resolve</button></>}>
          <p className="ws-quote">{complaintTarget.message}</p>
          <Field label="Response"><textarea rows={5} value={complaintResponse} onChange={e => setComplaintResponse(e.target.value)} /></Field>
        </Modal>
      )}
    </>
  );

  const renderNotifications = () => {
    const byCategory = notifications.reduce<Record<string, typeof notifications>>((acc, n) => { const k = n.category || n.type || 'General'; (acc[k] = acc[k] || []).push(n); return acc; }, {});
    const bySupplier = notifications.reduce<Record<string, typeof notifications>>((acc, n) => { const k = n.supplierName || (n.supplierId ? (companyById(n.supplierId)?.name || 'Supplier') : 'No supplier'); (acc[k] = acc[k] || []).push(n); return acc; }, {});
    const catEntries = Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length);
    const supEntries = Object.entries(bySupplier).sort((a, b) => b[1].length - a[1].length);
    const row = (n: any) => (
      <div key={n.id} className="ws-card" style={{ padding: 10, fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{n.title}</strong><small className="ws-muted">{timeAgo(n.createdAt)}</small></div>
        <div>{n.message}</div>
        <small className="ws-muted">{[n.category || n.type, n.supplierName ? `Supplier: ${n.supplierName}` : '', userById(n.userId)?.name ? `To: ${userById(n.userId)?.name}` : ''].filter(Boolean).join('  ')}</small>
      </div>
    );
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="Notifications" hint="All notifications recorded separately and listed by category and by supplier." />
        <div className="ws-grid-2">
          <Panel title="Send announcement">
            <div className="ws-form">
              <Field label="Audience"><select value={broadcastRole} onChange={e => setBroadcastRole(e.target.value as any)}><option value="all">Everyone</option><option value="customer">Customers</option><option value="company">Suppliers</option><option value="transporter">Transporters</option><option value="admin">Administrators</option></select></Field>
              <Field label="Category"><input value={broadcastCategory} onChange={e => setBroadcastCategory(e.target.value)} placeholder="e.g. Price Update, Order, Promotion" /></Field>
              <Field label="Supplier (optional)"><select value={broadcastSupplier} onChange={e => setBroadcastSupplier(e.target.value)}><option value="">None</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Title" required><input value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} /></Field>
              <Field label="Message" required><textarea rows={4} value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)} /></Field>
              <button className="btn btn-primary" onClick={sendBroadcast}>Send announcement</button>
            </div>
          </Panel>
          <Panel title="Notification summary">
            <KpiGrid>
              <Kpi label="Total records" value={notifications.length} icon="" />
              <Kpi label="Categories" value={catEntries.length} icon="" />
              <Kpi label="Suppliers tagged" value={supEntries.filter(s => s[0] !== 'No supplier').length} icon="" />
            </KpiGrid>
          </Panel>
        </div>
        <Panel title="Listed by category (history ledger)">
          {catEntries.length === 0 ? <EmptyState icon="" title="No notifications recorded" /> : catEntries.map(([cat, items]) => (
            <details key={cat} className="ws-fold" open={catEntries.length <= 3}><summary><strong>{cat}</strong> <span className="ws-muted">({items.length})</span></summary><div className="ws-fold-body" style={{ display: 'grid', gap: 6 }}>{[...items].sort((a: any, b: any) => b.createdAt - a.createdAt).slice(0, 50).map(row)}</div></details>
          ))}
        </Panel>
        <Panel title="Listed by supplier (history ledger)">
          {supEntries.length === 0 ? <EmptyState icon="" title="No supplier notifications" /> : supEntries.map(([sup, items]) => (
            <details key={sup} className="ws-fold"><summary><strong>{sup}</strong> <span className="ws-muted">({items.length})</span></summary><div className="ws-fold-body" style={{ display: 'grid', gap: 6 }}>{[...items].sort((a: any, b: any) => b.createdAt - a.createdAt).slice(0, 50).map(row)}</div></details>
          ))}
        </Panel>
      </>
    );
  };

  const renderQuotations = () => {
    const bySupplier = companies.map(c => ({ c, qs: quotations.filter(q => q.supplierId === c.id) })).filter(g => g.qs.length > 0).sort((a, b) => b.qs.length - a.qs.length);
    const accepted = quotations.filter(q => q.status === 'accepted').length;
    const submitted = quotations.filter(q => q.status === 'submitted').length;
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="Quotations Ledger" hint="All quotations recorded separately with status and transaction history (by supplier)." actions={<button className="btn btn-secondary btn-sm" onClick={() => exportCsv('quotations_ledger.csv', quotations.map(q => ({ id: q.id, supplier: q.supplierName, rfq: q.rfqId, unit_price: q.unitPrice, quantity: q.quantity, delivery_fee: q.deliveryFee, total: q.unitPrice * q.quantity + q.deliveryFee, status: q.status })))}>Export ledger</button>} />
        <KpiGrid>
          <Kpi label="Total quotations" value={quotations.length} icon="" />
          <Kpi label="Submitted" value={submitted} icon="" tone="warn" />
          <Kpi label="Accepted" value={accepted} icon="" tone="good" />
          <Kpi label="Suppliers quoted" value={bySupplier.length} icon="" />
        </KpiGrid>
        <Panel title="Quotation records">
          <DataTable rows={quotations} columns={[
            { key: 'id', header: 'Quote', value: q => q.id, render: q => <span className="ws-mono">{q.id.slice(-8).toUpperCase()}</span> },
            { key: 'supplier', header: 'Supplier', value: q => q.supplierName },
            { key: 'rfq', header: 'RFQ', value: q => q.rfqId, render: q => <span className="ws-mono">{q.rfqId.slice(-8).toUpperCase()}</span> },
            { key: 'price', header: 'Unit price', align: 'right', value: q => q.unitPrice, render: q => money(q.unitPrice) },
            { key: 'total', header: 'Total', align: 'right', value: q => q.unitPrice * q.quantity + q.deliveryFee, render: q => <strong>{money(q.unitPrice * q.quantity + q.deliveryFee)}</strong> },
            { key: 'status', header: 'Status', value: q => q.status, render: q => <StatusPill label={q.status} tone={toneFor(q.status)} /> },
          ] as Column<Quotation>[]} searchText={q => `${q.supplierName} ${q.status} ${q.rfqId}`} exportName="quotations_ledger" pageSize={12} />
        </Panel>
        <Panel title="By supplier (history)">
          {bySupplier.length === 0 ? <EmptyState icon="" title="No quotations recorded" text="Supplier quotations will be listed here by supplier as a ledger." /> : bySupplier.map(g => (
            <details key={g.c.id} className="ws-fold" open={bySupplier.length <= 3}><summary><strong>{g.c.name}</strong> <span className="ws-muted">({g.qs.length} quotations)</span></summary>
              <div className="ws-fold-body" style={{ display: 'grid', gap: 6 }}>{g.qs.map(q => (
                <div key={q.id} className="ws-card" style={{ padding: 10, fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div><strong className="ws-mono">{q.id.slice(-8).toUpperCase()}</strong>  RFQ {q.rfqId.slice(-8).toUpperCase()}  Qty {q.quantity}</div>
                  <div><strong>{money(q.unitPrice * q.quantity + q.deliveryFee)}</strong> <StatusPill label={q.status} tone={toneFor(q.status)} /></div>
                </div>
              ))}</div>
            </details>
          ))}
        </Panel>
      </>
    );
  };

  const renderSecurity = () => {
    const suspended = users.filter(isUserLocked);
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="Security & Audit" hint="Account safeguards, suspensions and the full audit trail." actions={<button className="btn btn-secondary btn-sm" onClick={() => onSection('settings')}>System settings</button>} />
        <KpiGrid>
          <Kpi label="Audit events" value={audit.length} icon="" />
          <Kpi label="Suspended accounts" value={suspended.length} icon="" tone="bad" />
          <Kpi label="Admin accounts" value={admins.length} icon="" />
          <Kpi label="Wallet ledger entries" value={transactions.length} icon="" />
        </KpiGrid>
        <div className="ws-grid-2">
          <Panel title="Account safeguards">
            <ul className="ws-detail-list">
              <li><span>Lockout</span><strong>Enabled after failed sign-ins</strong></li>
              <li><span>Suspended accounts</span><strong>{suspended.length}</strong></li>
              <li><span>Role control</span><strong>Admin managed</strong></li>
              <li><span>Audit trail</span><strong>{audit.length} records</strong></li>
            </ul>
          </Panel>
          <Panel title="Suspended accounts">
            {suspended.length === 0 ? <EmptyState icon="" title="No suspended accounts" text="Every registered account is currently active." /> : (
              <div className="ws-detail-list">
                {suspended.slice(0, 8).map(u => (
                  <div key={u.id} className="ws-row-actions" style={{ justifyContent: 'space-between' }}>
                    <span>{u.name} ({u.userType})</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleSuspend(u)}>Activate</button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
        <Panel title="Recent audit events">
          <DataTable rows={[...audit].reverse()} columns={[
            { key: 'at', header: 'Time', value: e => e.at, render: e => new Date(e.at).toLocaleString() },
            { key: 'actor', header: 'Actor', value: e => e.actorName },
            { key: 'action', header: 'Action', value: e => e.action },
            { key: 'detail', header: 'Detail', value: e => e.detail },
          ] as Column<AuditEvent>[]} searchText={e => `${e.action} ${e.actorName} ${e.detail}`} exportName="security_audit" pageSize={12} />
        </Panel>
      </>
    );
  };

  const renderMonitoring = () => {
    const unread = notifications.filter(n => !n.read).length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    return (
      <>
        <SectionHeader eyebrow={t('Administration')} title="Technical Monitoring" hint="Service health, cloud sync status and operational queues." actions={<button className="btn btn-secondary btn-sm" onClick={onOpenDataCenter}>Data Center</button>} />
        <KpiGrid>
          <Kpi label="Cloud sync" value={isCloudEnabled ? 'Configured' : 'Local only'} icon="" tone={isCloudEnabled ? 'good' : 'warn'} />
          <Kpi label="Audit records" value={audit.length} icon="" />
          <Kpi label="Unread notifications" value={unread} icon="" tone={unread > 0 ? 'warn' : 'good'} />
          <Kpi label="Pending orders" value={pendingOrders} icon="" tone={pendingOrders > 0 ? 'warn' : 'good'} />
        </KpiGrid>
        <div className="ws-grid-2">
          <Panel title="Service health">
            <ul className="ws-detail-list">
              <li><span>Platform version</span><strong>{APP_VERSION}</strong></li>
              <li><span>Cloud sync</span><strong>{isCloudEnabled ? 'Configured' : 'Local only'}</strong></li>
              <li><span>VAT</span><strong>{settings.vat.enabled ? `${settings.vat.rate}%` : 'Disabled'}</strong></li>
              <li><span>Audit trail</span><strong>Recording</strong></li>
            </ul>
          </Panel>
          <Panel title="Operational queues">
            <BarList items={[
              { label: 'Pending orders', value: pendingOrders },
              { label: 'Open complaints', value: complaints.filter(c => c.status === 'open').length },
              { label: 'Supplier reviews', value: companies.filter(c => c.complianceStatus !== 'compliant').length },
              { label: 'Transport reviews', value: transporterProfiles.filter(p => !p.verified).length },
              { label: 'Open RFQs', value: rfqs.filter(r => r.status === 'open').length },
            ]} />
          </Panel>
        </div>
        <Panel title="Recent notifications">
          {notifications.length === 0 ? <EmptyState icon="" title="No notifications" text="Platform notifications will appear here." /> : (
            <DataTable rows={[...notifications].sort((a, b) => b.createdAt - a.createdAt)} columns={[
              { key: 'title', header: 'Title', value: n => n.title },
              { key: 'type', header: 'Type', value: n => n.type },
              { key: 'message', header: 'Message', value: n => n.message },
              { key: 'date', header: 'Created', value: n => n.createdAt, render: n => new Date(n.createdAt).toLocaleString() },
              { key: 'read', header: 'Read', value: n => n.read ? 'yes' : 'no' },
            ] as Column<any>[]} searchText={(n: any) => `${n.title} ${n.message} ${n.type}`} exportName="monitoring_notifications" pageSize={10} />
          )}
        </Panel>
      </>
    );
  };

  const renderSettings = () => (
    <>
      <SectionHeader eyebrow={t('Administration')} title="System Settings" hint="Configuration, language and audit logs." actions={<button className="btn btn-primary btn-sm" onClick={onEditSettings}>Full settings</button>} />
      <div className="ws-grid-2">
        <Panel title="Platform profile">
          <form className="ws-form" onSubmit={e => { e.preventDefault(); logEvent('settings.platform', 'Platform profile saved'); onNotify('Settings saved', 'success'); }}>
            <Field label="Country"><input value={platform.country} onChange={e => setPlatform(prev => ({ ...prev, country: e.target.value }))} /></Field>
            <Field label="Language"><select value={lang} onChange={e => setLang(e.target.value as 'en' | 'am')}>{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}</select></Field>
            <button type="submit" className="btn btn-primary">Save</button>
          </form>
        </Panel>
        <Panel title="System tools & status">
          <ul className="ws-detail-list">
            <li><span>VAT</span><strong>{settings.vat.enabled ? `${settings.vat.rate}%` : 'Disabled'}</strong></li>
            <li><span>Cloud sync</span><strong>{isCloudEnabled ? 'Configured' : 'Local only'}</strong></li>
            <li><span>Version</span><strong>{APP_VERSION}</strong></li>
            <li><span>Audit records</span><strong>{audit.length}</strong></li>
          </ul>
          <div className="ws-row-actions" style={{ marginTop: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={onOpenDataCenter}>Data Center</button>
            <button className="btn btn-secondary btn-sm" onClick={onEditSettings}>Edit rules</button>
          </div>
        </Panel>
      </div>
      <Panel title="Audit logs">
        <DataTable rows={[...audit].reverse()} columns={[
          { key: 'at', header: 'Time', value: e => e.at, render: e => new Date(e.at).toLocaleString() },
          { key: 'actor', header: 'Actor', value: e => e.actorName },
          { key: 'action', header: 'Action', value: e => e.action },
          { key: 'detail', header: 'Detail', value: e => e.detail },
        ] as Column<AuditEvent>[]} searchText={e => `${e.action} ${e.actorName} ${e.detail}`} exportName="audit_logs" pageSize={12} />
      </Panel>
    </>
  );

  const renderSection = () => {
    switch (section) {
      case 'home': return renderHome();
      case 'dashboard': return renderDashboard();
      case 'users': return renderUsers();
      case 'customers': return renderCustomers();
      case 'suppliers': return renderSuppliers();
      case 'transporters': return renderTransporters();
      case 'logistics': return renderLogistics();
      case 'products': return renderProducts();
      case 'prices': return renderPrices();
      case 'rfqs': return renderRfqs();
      case 'orders': return renderOrders();
      case 'market': return renderMarket();
      case 'ai': return renderAi();
      case 'finance': return renderFinance();
      case 'reports': return renderReports();
      case 'complaints': return renderComplaints();
      case 'notifications': return renderNotifications();
      case 'quotations': return renderQuotations();
      case 'security': return renderSecurity();
      case 'monitoring': return renderMonitoring();
      case 'settings': return renderSettings();
      default: return renderHome();
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
        if (id === 'quotations') return quotations.filter(q => q.status === 'submitted').length || null;
        if (id === 'suppliers') return companies.filter(c => c.complianceStatus !== 'compliant').length || null;
        return null;
      }}
    >
      {renderSection()}
    </WorkspaceShell>
  );
};

export default AdminWorkspace;
