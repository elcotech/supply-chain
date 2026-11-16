// ===== Guests - Public View =====
//
// The guest workspace is the unauthenticated version of the marketplace: it
// reuses the same live catalogue and supplier records, but every transactional
// action points to registration or sign-in.

import React from 'react';
import { Company, Material, ProductReview } from '../../types';
import { effectiveRating, formatCurrency } from '../../utils';
import { useLanguage } from '../../lib/i18n';
import { MENUS } from '../../lib/menu';
import { LineChart } from '../Charts';
import WorkspaceShell from './shell';
import {
  Column, DashboardGrid, DataTable, EmptyState, Kpi, KpiGrid, MiniStat,
  Panel, SectionHeader, StatusPill,
} from './ui';

export interface GuestWorkspaceProps {
  section: string;
  companies: Company[];
  materials: Material[];
  reviews: ProductReview[];
  onSection: (id: string) => void;
  onNavigate: (page: string) => void;
  onOpenProduct: (material: Material) => void;
}

const money = (value: number) => formatCurrency(Math.round(value * 100) / 100);

const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;

const GuestWorkspace: React.FC<GuestWorkspaceProps> = ({
  section, companies, materials, reviews, onSection, onNavigate, onOpenProduct,
}) => {
  const { t } = useLanguage();

  const handleSection = (id: string) => {
    const target = MENUS.guest.sections.find(item => item.id === id);
    if (target?.page && target.page !== 'guest-workspace') {
      onNavigate(target.page);
      return;
    }
    onSection(id);
  };

  const supplierFor = (id: string) => companies.find(company => company.id === id);
  const verifiedCompanies = companies.filter(company => company.complianceStatus === 'compliant');
  const categories = Array.from(new Set(materials.map(material => material.category)));
  const cities = Array.from(new Set(companies.map(company => company.city).filter(Boolean)));
  const averageRating = verifiedCompanies.length
    ? verifiedCompanies.reduce((sum, company) => sum + effectiveRating(company.rating, reviews), 0) / verifiedCompanies.length
    : 0;

  const priceColumns: Column<Material>[] = [
    {
      key: 'material',
      header: t('Material'),
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
      header: t('Public Price'),
      value: row => row.price,
      render: row => <strong>{money(row.price)}<small className="ws-muted">/{row.unit}</small></strong>,
    },
    {
      key: 'delivery',
      header: t('Delivery'),
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
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('register')}>{t('Register to quote')}</button>
        </span>
      ),
    },
  ];

  const priceRows = [...materials].sort((a, b) => a.price - b.price).slice(0, 7);
  const featured = [...materials]
    .sort((a, b) => effectiveRating(b.rating, reviews) - effectiveRating(a.rating, reviews))
    .slice(0, 6);
  const topSuppliers = [...verifiedCompanies]
    .sort((a, b) => effectiveRating(b.rating, reviews) - effectiveRating(a.rating, reviews))
    .slice(0, 5);

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: monthKey(date),
      label: date.toLocaleString('en', { month: 'short' }),
      sum: 0,
      count: 0,
      low: Number.POSITIVE_INFINITY,
    };
  });
  const bucketByKey = new Map(months.map(bucket => [bucket.key, bucket]));
  materials.forEach(material => {
    (material.priceHistory || []).forEach(point => {
      const bucket = bucketByKey.get(monthKey(new Date(point.date)));
      if (!bucket) return;
      bucket.sum += point.price;
      bucket.count += 1;
      bucket.low = Math.min(bucket.low, point.price);
    });
  });
  const averageSeries = months.map(bucket => ({
    label: bucket.label,
    value: bucket.count ? Math.round(bucket.sum / bucket.count) : 0,
  }));
  const lowestSeries = months.map(bucket => ({
    label: bucket.label,
    value: Number.isFinite(bucket.low) ? Math.round(bucket.low) : 0,
  }));

  const latValues = companies.map(company => company.lat).filter(Number.isFinite);
  const lngValues = companies.map(company => company.lng).filter(Number.isFinite);
  const minLat = latValues.length ? Math.min(...latValues) : 0;
  const maxLat = latValues.length ? Math.max(...latValues) : 1;
  const minLng = lngValues.length ? Math.min(...lngValues) : 0;
  const maxLng = lngValues.length ? Math.max(...lngValues) : 1;
  const mapPins = verifiedCompanies.slice(0, 8).map((company, index) => {
    const x = maxLng === minLng ? 12 + index * 11 : 10 + ((company.lng - minLng) / (maxLng - minLng)) * 80;
    const y = maxLat === minLat ? 18 + (index % 4) * 20 : 12 + (1 - (company.lat - minLat) / (maxLat - minLat)) * 68;
    return { company, x, y, tone: index % 3 === 0 ? 'gold' : 'good' };
  });

  return (
    <WorkspaceShell menu="guest" section={section} onSection={handleSection}>
      <SectionHeader
        eyebrow={t('Guest / Public')}
        title={t('Guest / Public View')}
        hint={t('No registration required for browsing. Compare public prices and discover verified suppliers.')}
        actions={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('login')}> {t('Sign In')}</button>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('register')}> {t('Register')}</button>
          </>
        }
      />

      <div className="ws-public-hero">
        <span className="ws-hero-eyebrow">{t('Build Smarter. Source Better.')}</span>
        <h2>{t('Ethiopia's construction supply chain, open to everyone.')}</h2>
        <p>
          {t('Browse verified suppliers, compare live material prices and explore market insights before you create an account.')}
        </p>
        <div className="ws-hero-actions">
          <button className="btn btn-primary" onClick={() => onNavigate('marketplace')}>{t('Browse Marketplace')}</button>
          <button className="btn btn-secondary" onClick={() => onNavigate('supplier-directory')}>{t('Supplier Directory')}</button>
        </div>
        <div className="ws-pill-stack">
          <StatusPill label={`[OK] ${t('No registration required')}`} tone="good" />
          <StatusPill label={` ${verifiedCompanies.length} ${t('verified suppliers')}`} tone="info" />
          <StatusPill label={` ${materials.length} ${t('public products')}`} tone="muted" />
        </div>
      </div>

      <KpiGrid>
        <Kpi label={t('Verified Suppliers')} value={verifiedCompanies.length} hint={`${companies.length} ${t('registered')}`} icon="" tone="good" />
        <Kpi label={t('Public Products')} value={materials.length} hint={`${categories.length} ${t('categories')}`} icon="" />
        <Kpi label={t('Cities Covered')} value={cities.length} hint={cities.slice(0, 3).join(' - ') || '-'} icon="" />
        <Kpi label={t('Average Rating')} value={`${averageRating.toFixed(1)} `} hint={`${reviews.length} ${t('reviews')}`} icon="*" tone="accent" />
        <Kpi label={t('Marketplace')} value={t('Open')} hint={t('Browse without an account')} icon="" tone="good" />
      </KpiGrid>

      <DashboardGrid
        main={
          <>
            <Panel
              title={t('Featured Construction Materials')}
              subtitle={t('Popular products from verified suppliers')}
              actions={<button className="btn btn-secondary btn-sm" onClick={() => onNavigate('marketplace')}>{t('Browse all')}</button>}
            >
              {featured.length === 0 ? (
                <EmptyState icon="" title={t('Catalogue coming soon')} text={t('Verified suppliers will publish materials here.')} />
              ) : (
                <div className="ws-material-grid">
                  {featured.map(material => (
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
                </div>
              )}
            </Panel>

            <Panel
              title={t('Market Insights')}
              subtitle={t('Average and lowest public material prices, last six months')}
              actions={<button className="btn btn-secondary btn-sm" onClick={() => onNavigate('analytics')}>{t('Full insights')}</button>}
            >
              <div className="ws-chart-note">
                <span>{categories.length} {t('categories tracked')}</span>
                <span className="ws-pill-stack">
                  <StatusPill label={`* ${t('Average price')}`} tone="info" />
                  <StatusPill label={`* ${t('Lowest price')}`} tone="good" />
                </span>
              </div>
              <div className="ws-chart-box">
                <LineChart
                  height={190}
                  valueFormatter={money}
                  series={[
                    { label: t('Average price'), color: '#1f6feb', data: averageSeries },
                    { label: t('Lowest price'), color: '#c9a227', data: lowestSeries },
                  ]}
                />
              </div>
              <div className="ws-category-grid">
                {categories.slice(0, 4).map(category => {
                  const rows = materials.filter(material => material.category === category);
                  const low = rows.length ? Math.min(...rows.map(row => row.price)) : 0;
                  return (
                    <div className="ws-category-card" key={category}>
                      <span>{category}</span>
                      <strong>{rows.length} {t('products')}</strong>
                      <em>{t('from')} {money(low)}</em>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel
              title={t('Price Comparison')}
              subtitle={t('Lowest public offers across the catalogue')}
              actions={<button className="btn btn-secondary btn-sm" onClick={() => onNavigate('search-materials')}>{t('Compare products')}</button>}
            >
              {priceRows.length === 0 ? (
                <EmptyState icon="" title={t('No prices yet')} text={t('Supplier listings will appear here once approved.')} />
              ) : (
                <DataTable
                  rows={priceRows}
                  columns={priceColumns}
                  pageSize={7}
                  exportName="public-price-comparison"
                  searchText={row => `${row.name} ${row.category} ${supplierFor(row.companyId)?.name || ''}`}
                />
              )}
            </Panel>
          </>
        }
        side={
          <>
            <Panel
              title={t('Supplier Map')}
              subtitle={`${verifiedCompanies.length} ${t('verified businesses')}`}
              actions={<button className="btn btn-secondary btn-sm" onClick={() => onNavigate('supplier-directory')}>{t('Directory')}</button>}
            >
              <div className="ws-map-panel">
                {mapPins.map(pin => (
                  <span
                    className={'ws-map-pin ' + pin.tone}
                    key={pin.company.id}
                    style={{ left: pin.x + '%', top: pin.y + '%' }}
                    title={`${pin.company.name} - ${pin.company.city}`}
                  >
                    <b></b>
                    {pin.company.city}
                  </span>
                ))}
                {mapPins.length === 0 && (
                  <span className="ws-map-pin" style={{ left: '50%', top: '55%' }}><b></b>{t('No suppliers yet')}</span>
                )}
              </div>
              <div className="ws-mini-grid" style={{ marginTop: 10 }}>
                <MiniStat label={t('Cities')} value={cities.length} hint={t('coverage')} icon="" />
                <MiniStat label={t('Suppliers')} value={verifiedCompanies.length} hint={t('verified')} tone="good" icon="[OK]" />
              </div>
            </Panel>

            <Panel
              title={t('Top Rated Suppliers')}
              subtitle={t('Public supplier directory preview')}
              actions={<button className="btn btn-secondary btn-sm" onClick={() => onNavigate('supplier-directory')}>{t('View all')}</button>}
            >
              {topSuppliers.length === 0 ? (
                <EmptyState icon="" title={t('No suppliers yet')} text={t('Approved suppliers will be listed here.')} />
              ) : (
                <div className="ws-stat-list">
                  {topSuppliers.map(company => (
                    <div className="ws-stat-row" key={company.id}>
                      <div>
                        <strong>{company.name}</strong>
                        <small>{company.city} - {company.totalOrders} {t('orders')} - * {effectiveRating(company.rating, reviews).toFixed(1)}</small>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('supplier-directory')}>{t('View')}</button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title={t('Create an Account to Trade')} subtitle={t('Registration is free for buyers and suppliers')}>
              <ul className="ws-detail-list">
                <li><span></span><strong>{t('Send RFQs and collect quotations')}</strong></li>
                <li><span></span><strong>{t('Order materials with delivery')}</strong></li>
                <li><span></span><strong>{t('Track deliveries in real time')}</strong></li>
                <li><span></span><strong>{t('Pay securely through the platform')}</strong></li>
              </ul>
              <div className="ws-hero-actions">
                <button className="btn btn-primary" onClick={() => onNavigate('register')}>{t('Create account')}</button>
                <button className="btn btn-secondary" onClick={() => onNavigate('login')}>{t('Sign in')}</button>
              </div>
            </Panel>
          </>
        }
      />
    </WorkspaceShell>
  );
};

export default GuestWorkspace;

