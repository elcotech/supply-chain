// ===== Role workspace shell =====
//
// One consistent frame for the Administration, Suppliers and Customers menus:
// a persistent section list on desktop, a scrollable section bar on phones, and
// a content area that renders the active spec submenu. The shell owns only
// navigation; each workspace owns its panels.

import React from 'react';
import { MENUS, MenuKey } from '../../lib/menu';
import { useLanguage } from '../../lib/i18n';

export interface WorkspaceShellProps {
  menu: MenuKey;
  section: string;
  onSection: (id: string) => void;
  children: React.ReactNode;
  badgeFor?: (id: string) => number | null;
}

const WorkspaceShell: React.FC<WorkspaceShellProps> = ({ menu, section, onSection, children, badgeFor }) => {
  const { t } = useLanguage();
  const definition = MENUS[menu];

  return (
    <div className="ws-shell">
      <aside className="ws-sidebar" aria-label={t(definition.title) + ' ' + t('Menu')}>
        <div className="ws-sidebar-head">
          <span className="ws-sidebar-eyebrow">{t('Workspace')}</span>
          <strong>{t(definition.title)}</strong>
          <p>{t(definition.subtitle)}</p>
        </div>
        <nav className="ws-sidebar-nav">
          {definition.sections.map(item => {
            const badge = badgeFor ? badgeFor(item.id) : null;
            return (
              <button
                key={item.id}
                type="button"
                className={'ws-nav-item' + (item.id === section ? ' active' : '')}
                onClick={() => onSection(item.id)}
                aria-current={item.id === section ? 'page' : undefined}
              >
                <span className="ws-nav-icon" aria-hidden="true">{item.icon}</span>
                <span className="ws-nav-label">{t(item.label)}</span>
                {badge ? <span className="ws-nav-badge">{badge > 99 ? '99+' : badge}</span> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="ws-main">
        <div className="ws-mobile-sections" role="tablist" aria-label={t(definition.title) + ' ' + t('Menu')}>
          {definition.sections.map(item => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === section}
              className={'ws-chip' + (item.id === section ? ' active' : '')}
              onClick={() => onSection(item.id)}
            >
              <span aria-hidden="true">{item.icon}</span> {t(item.label)}
            </button>
          ))}
        </div>
        <div className="ws-content" key={section}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceShell;
