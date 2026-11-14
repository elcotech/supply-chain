// ===== Shared workspace UI kit =====
//
// Spec §9 requires every menu to offer useful KPIs, recent activity, alerts and
// quick actions, and data tables with search, filter, sort, pagination and
// export permissions. These primitives provide exactly that, so all five role
// menus behave the same way on desktop, tablet and phone.

import React, { useMemo, useState } from 'react';
import { exportToCSV } from '../../utils';
import { useLanguage } from '../../lib/i18n';

export interface KpiProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'accent';
}

export const Kpi: React.FC<KpiProps> = ({ label, value, hint, icon, tone = 'default' }) => (
  <div className={'ws-kpi ws-kpi-' + tone}>
    <div className="ws-kpi-top">
      <span className="ws-kpi-label">{label}</span>
      {icon && <span className="ws-kpi-icon" aria-hidden="true">{icon}</span>}
    </div>
    <div className="ws-kpi-value">{value}</div>
    {hint && <div className="ws-kpi-hint">{hint}</div>}
  </div>
);

export const KpiGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="ws-kpi-grid">{children}</div>
);

export const SectionHeader: React.FC<{
  title: string;
  hint?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}> = ({ title, hint, actions, eyebrow }) => (
  <div className="ws-section-head">
    <div>
      {eyebrow && <div className="ws-eyebrow">{eyebrow}</div>}
      <h1 className="ws-title">{title}</h1>
      {hint && <p className="ws-hint">{hint}</p>}
    </div>
    {actions && <div className="ws-head-actions">{actions}</div>}
  </div>
);

export const Panel: React.FC<{
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, actions, children, className }) => (
  <section className={'ws-panel' + (className ? ' ' + className : '')}>
    {(title || actions) && (
      <header className="ws-panel-head">
        <div>
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="ws-panel-actions">{actions}</div>}
      </header>
    )}
    <div className="ws-panel-body">{children}</div>
  </section>
);

export const EmptyState: React.FC<{ icon?: string; title: string; text?: string; action?: React.ReactNode }> = ({
  icon = '📭', title, text, action,
}) => (
  <div className="ws-empty">
    <span aria-hidden="true">{icon}</span>
    <strong>{title}</strong>
    {text && <p>{text}</p>}
    {action}
  </div>
);

export type PillTone = 'good' | 'warn' | 'bad' | 'info' | 'muted';

export const StatusPill: React.FC<{ label: string; tone?: PillTone }> = ({ label, tone = 'muted' }) => (
  <span className={'ws-pill ws-pill-' + tone}>{label}</span>
);

/** Map order / verification / complaint statuses onto a pill tone. */
export const toneFor = (status: string): PillTone => {
  const value = (status || '').toLowerCase();
  if (['delivered', 'paid', 'confirmed', 'resolved', 'accepted', 'active', 'verified', 'compliant', 'completed', 'available'].includes(value)) return 'good';
  if (['pending', 'requested', 'open', 'submitted', 'planning', 'investigating', 'in_transit', 'picked_up', 'on_hold', 'maintenance', 'on_trip', 'quoted', 'in_service'].includes(value)) return 'warn';
  if (['cancelled', 'failed', 'rejected', 'non-compliant', 'suspended', 'refunded', 'off_duty', 'declined'].includes(value)) return 'bad';
  if (['shipped', 'paid'].includes(value)) return 'info';
  return 'muted';
};

export interface Column<T> {
  key: string;
  header: string;
  /** Sort/search/CSV value. Falls back to `render`-independent row[key]. */
  value?: (row: T) => string | number;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Hide this column from the CSV export (e.g. action buttons). */
  noExport?: boolean;
}

export interface TableFilter {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export interface DataTableProps<T extends { id: string }> {
  rows: T[];
  columns: Column<T>[];
  /** Text used for the free-text search box. */
  searchText?: (row: T) => string;
  filters?: TableFilter[];
  pageSize?: number;
  exportName?: string;
  exportEnabled?: boolean;
  emptyTitle?: string;
  emptyText?: string;
  toolbarExtra?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  searchText,
  filters = [],
  pageSize = 10,
  exportName,
  exportEnabled = true,
  emptyTitle,
  emptyText,
  toolbarExtra,
  onRowClick,
}: DataTableProps<T>) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const valueOf = (row: T, column: Column<T>): string | number => {
    if (column.value) return column.value(row);
    const raw = (row as any)[column.key];
    return typeof raw === 'number' ? raw : String(raw ?? '');
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = rows;
    if (term) {
      list = list.filter(row => {
        const haystack = searchText
          ? searchText(row)
          : columns.map(column => valueOf(row, column)).join(' ');
        return haystack.toLowerCase().includes(term);
      });
    }
    const column = columns.find(c => c.key === sortKey);
    if (column) {
      list = [...list].sort((a, b) => {
        const av = valueOf(a, column);
        const bv = valueOf(b, column);
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, sortKey, sortDir, columns, searchText]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const handleExport = () => {
    const data = filtered.map(row => {
      const record: Record<string, string | number> = {};
      columns.filter(column => !column.noExport).forEach(column => {
        record[column.header] = valueOf(row, column);
      });
      return record;
    });
    exportToCSV(data, exportName || 'escon_export');
  };

  return (
    <div className="ws-table-wrap">
      <div className="ws-table-tools">
        <div className="ws-table-search">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            value={query}
            placeholder={t('Search…')}
            aria-label={t('Search…')}
            onChange={event => { setQuery(event.target.value); setPage(0); }}
          />
          {query && (
            <button type="button" className="ws-clear" onClick={() => setQuery('')} aria-label={t('Clear')}>
              ✕
            </button>
          )}
        </div>
        {filters.map(filter => (
          <label key={filter.id} className="ws-table-filter">
            <span>{t(filter.label)}</span>
            <select
              value={filter.value}
              onChange={event => { filter.onChange(event.target.value); setPage(0); }}
            >
              {filter.options.map(option => (
                <option key={option.value} value={option.value}>{t(option.label)}</option>
              ))}
            </select>
          </label>
        ))}
        {toolbarExtra}
        {exportEnabled && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExport} disabled={filtered.length === 0}>
            📥 {t('Export CSV')}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="🔍" title={emptyTitle || t('No matching records')} text={emptyText} />
      ) : (
        <>
          <div className="table-scroll-container">
            <table className="data-table ws-table">
              <thead>
                <tr>
                  {columns.map(column => (
                    <th
                      key={column.key}
                      scope="col"
                      style={{ textAlign: column.align || 'left' }}
                      aria-sort={sortKey === column.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button type="button" className="ws-sort" onClick={() => toggleSort(column.key)}>
                        {t(column.header)}
                        <span aria-hidden="true" className="ws-sort-arrow">
                          {sortKey === column.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(row => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={onRowClick ? 'ws-row-clickable' : undefined}
                  >
                    {columns.map(column => (
                      <td key={column.key} style={{ textAlign: column.align || 'left' }}>
                        {column.render ? column.render(row) : valueOf(row, column)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ws-table-foot">
            <span>
              {filtered.length} {t('of')} {rows.length}
            </span>
            <div className="ws-pager">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}>
                ← {t('Previous')}
              </button>
              <span className="ws-page-indicator">{t('Page')} {safePage + 1} {t('of')} {pageCount}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}>
                {t('Next')} →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Simple horizontal bar list used for category/city/status distributions. */
export const BarList: React.FC<{
  items: { label: string; value: number; hint?: string }[];
  format?: (value: number) => string;
  emptyLabel?: string;
}> = ({ items, format, emptyLabel }) => {
  const { t } = useLanguage();
  const max = items.reduce((m, item) => Math.max(m, item.value), 0) || 1;
  if (items.length === 0) return <p className="ws-muted">{emptyLabel || t('No data for this period')}</p>;
  return (
    <ul className="ws-bar-list">
      {items.map(item => (
        <li key={item.label}>
          <div className="ws-bar-label">
            <span>{item.label}</span>
            <strong>{format ? format(item.value) : item.value.toLocaleString()}</strong>
          </div>
          <div className="ws-bar-track">
            <span style={{ width: Math.max(3, Math.round((item.value / max) * 100)) + '%' }} />
          </div>
          {item.hint && <div className="ws-bar-hint">{item.hint}</div>}
        </li>
      ))}
    </ul>
  );
};

export const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}> = ({ label, children, hint, required }) => (
  <label className="ws-field">
    <span className="ws-field-label">
      {label}
      {required && <span className="ws-required" aria-hidden="true"> *</span>}
    </span>
    {children}
    {hint && <span className="ws-field-hint">{hint}</span>}
  </label>
);

/** Lightweight modal used by the workspace forms. */
export const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ title, onClose, children, footer, wide }) => {
  const { t } = useLanguage();
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={'modal-content ws-modal' + (wide ? ' ws-modal-wide' : '')}
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t('Close')}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="ws-modal-footer">{footer}</div>}
      </div>
    </div>
  );
};
