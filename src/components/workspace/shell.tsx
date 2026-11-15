// ===== Role workspace shell =====
//
// One consistent frame for the Administration, Suppliers and Customers menus:
// a persistent (and foldable) section list on desktop, a slide-in drawer on
// phones, and a content area that renders the active spec submenu. The shell
// owns only navigation; each workspace owns its panels.

import React, { useState } from 'react';
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
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSection = (id: string) => {
    onSection(id);
    setDrawerOpen(false);
  };

  return (
    <div className={'ws-shell' + (collapsed ? ' ws-shell-collapsed' : '')}>
      {/* Backdrop for the mobile drawer */}
      {drawerOpen && <div className="ws-drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

      <aside
        className={'ws-sidebar' + (drawerOpen ? ' ws-sidebar-open' : '')}
        aria-label={t(definition.title) + ' ' + t('Menu')}
      >
        <div className="ws-sidebar-head">
          <span className="ws-sidebar-eyebrow">{t('Workspace')}</span>
          <strong>{!collapsed ? t(definition.title) : ''}</strong>
          {!collapsed && <p>{t(definition.subtitle)}</p>}
          <button
            type="button"
            className="ws-sidebar-collapse"
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>
        <nav className="ws-sidebar-nav">
          {definition.sections.map(item => {
            const badge = badgeFor ? badgeFor(item.id) : null;
            return (
              <button
                key={item.id}
                type="button"
                className={'ws-nav-item' + (item.id === section ? ' active' : '')}
                onClick={() => handleSection(item.id)}
                aria-current={item.id === section ? 'page' : undefined}
                title={collapsed ? t(item.label) : undefined}
              >
                <span className="ws-nav-icon" aria-hidden="true">{item.icon}</span>
                {!collapsed && <span className="ws-nav-label">{t(item.label)}</span>}
                {badge ? <span className="ws-nav-badge">{badge > 99 ? '99+' : badge}</span> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="ws-main">
        <button
          type="button"
          className="ws-menu-toggle"
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(o => !o)}
        >
          {drawerOpen ? '✕' : '☰'}
        </button>
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