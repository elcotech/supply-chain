// Public supplier directory (spec §5 "Supplier Directory").
//
// Guests can browse approved supplier businesses, their service locations and
// published products. Contact and ordering actions lead to registration.

import React, { useMemo, useState } from 'react';
import { Company, Material, ProductReview } from '../types';
import { formatCurrency, effectiveRating } from '../utils';
import { useLanguage } from '../lib/i18n';
import { EmptyState, StatusPill, toneFor } from './workspace/ui';

interface SupplierDirectoryProps {
  companies: Company[];
  materials: Material[];
  reviews: ProductReview[];
  onOpenMap: (companyId: string) => void;
  onOpenProduct: (material: Material) => void;
  onLogin: () => void;
  onRegister: () => void;
  onOpenMarketplace: () => void;
}

const SupplierDirectory: React.FC<SupplierDirectoryProps> = ({
  companies, materials, reviews, onOpenMap, onOpenProduct, onLogin, onRegister, onOpenMarketplace,
}) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('all');
  const [selected, setSelected] = useState<Company | null>(null);

  const cities = useMemo(
    () => Array.from(new Set(companies.map(company => company.city).filter(Boolean))).sort(),
    [companies]
  );

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return companies.filter(company => {
      const products = materials.filter(material => material.companyId === company.id);
      const haystack = `${company.name} ${company.city} ${company.location} ${company.description} ${products.map(p => `${p.name} ${p.category}`).join(' ')}`.toLowerCase();
      return (city === 'all' || company.city === city) && (!term || haystack.includes(term));
    });
  }, [companies, materials, query, city]);

  const selectedProducts = selected ? materials.filter(material => material.companyId === selected.id) : [];

  return (
    <main className="main-content ws-public">
      <section className="ws-hero">
        <div>
          <span className="ws-eyebrow">{t('Guests')}</span>
          <h1>{t('Supplier Directory')}</h1>
          <p>{t('Approved supplier businesses, public profiles and service locations.')}</p>
        </div>
        <div className="ws-hero-actions">
          <button className="btn btn-secondary" onClick={onOpenMarketplace}>🛍️ {t('Public Marketplace')}</button>
          <button className="btn btn-primary" onClick={onRegister}>👤 {t('Register')}</button>
        </div>
      </section>

      <div className="ws-searchbar">
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={t('Search suppliers, products or cities…')}
          aria-label="Search suppliers"
        />
        <select value={city} onChange={event => setCity(event.target.value)} aria-label="Filter by city">
          <option value="all">{t('All cities')}</option>
          {cities.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <p className="ws-muted">{rows.length} {t('suppliers')} · {companies.filter(company => company.complianceStatus === 'compliant').length} {t('verified')}</p>

      {rows.length === 0 ? (
        <EmptyState icon="🏢" title={t('No suppliers found')} text={t('Try another city or search term.')} />
      ) : (
        <div className="ws-supplier-grid">
          {rows.map(company => {
            const products = materials.filter(material => material.companyId === company.id);
            const rating = effectiveRating(company.rating, reviews.filter(review => products.some(m => m.id === review.materialId)));
            return (
              <article key={company.id} className="ws-supplier">
                <div className="ws-supplier-head">
                  <strong>{company.name}</strong>
                  <StatusPill label={t(company.complianceStatus)} tone={toneFor(company.complianceStatus)} />
                </div>
                <p>{company.description || t('No description provided.')}</p>
                <ul className="ws-detail-list">
                  <li><span>{t('Location')}</span><strong>{company.city} · {company.location || '—'}</strong></li>
                  <li><span>{t('Products')}</span><strong>{products.length}</strong></li>
                  <li><span>{t('Rating')}</span><strong>⭐ {rating.toFixed(1)} · {company.totalOrders} {t('orders')}</strong></li>
                  <li><span>{t('Working hours')}</span><strong>{company.workingHours || '—'}</strong></li>
                </ul>
                <div className="ws-row-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => onOpenMap(company.id)}>🗺️ {t('Supplier Map')}</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setSelected(company)}>{t('View profile')}</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="ws-callout">
        <div>
          <h2>{t('Need a quotation?')}</h2>
          <p>{t('Create a free account to send RFQs, compare delivered prices and track every delivery.')}</p>
        </div>
        <div className="ws-row-actions">
          <button className="btn btn-secondary" onClick={onLogin}>{t('Sign In')}</button>
          <button className="btn btn-primary" onClick={onRegister}>{t('Create account')}</button>
        </div>
      </section>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content ws-public-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={selected.name}>
            <div className="modal-header">
              <h2>{selected.name}</h2>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <ul className="ws-detail-list">
                <li><span>{t('Location')}</span><strong>{selected.location}, {selected.city}</strong></li>
                <li><span>{t('Working hours')}</span><strong>{selected.workingHours || '—'}</strong></li>
                <li><span>{t('Established')}</span><strong>{selected.established || '—'}</strong></li>
                <li><span>{t('Compliance')}</span><strong>{t(selected.complianceStatus)}</strong></li>
                <li><span>{t('Rating')}</span><strong>⭐ {effectiveRating(selected.rating, reviews.filter(review => selectedProducts.some(m => m.id === review.materialId))).toFixed(1)}</strong></li>
              </ul>
              <h3>{t('Products')}</h3>
              {selectedProducts.length === 0 ? (
                <p className="ws-muted">{t('No public products yet.')}</p>
              ) : (
                <ul className="ws-public-products">
                  {selectedProducts.map(material => (
                    <li key={material.id}>
                      <div><strong>{material.name}</strong><small>{material.category} · {formatCurrency(material.price)} / {material.unit}</small></div>
                      <button className="btn btn-secondary btn-sm" onClick={() => onOpenProduct(material)}>{t('View')}</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="ws-row-actions">
                <button className="btn btn-secondary" onClick={() => { setSelected(null); onOpenMap(selected.id); }}>🗺️ {t('Supplier Map')}</button>
                <button className="btn btn-primary" onClick={onRegister}>{t('Register to order')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default SupplierDirectory;
