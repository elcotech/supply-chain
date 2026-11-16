// ===== Role workspace shell (E-SCON 5.0) =====
import React, { useState } from 'react';
import { MENUS, MenuKey } from '../../lib/menu';
import { useLanguage } from '../../lib/i18n';
import { APP_VERSION } from '../../version';

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

  const activeLabel = definition.sections.find(s => s.id === section)?.label || definition.title;

  return (
    <div className={'ws-shell' + (collapsed ? ' ws-shell-collapsed' : '') + ' ws-role-' + menu}>
      {drawerOpen && <div className="ws-drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

      <aside className={'ws-sidebar' + (drawerOpen ? ' ws-sidebar-open' : '')} aria-label={t(definition.title) + ' ' + t('Menu')}>
        <div className="ws-sidebar-brand">
          <div className="ws-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="34" height="34">
              <polygon points="24,4 44,14 44,34 24,44 4,34 4,14" fill="none" stroke="#D9B45B" strokeWidth="2.2"/>
              <polygon points="24,4 44,14 24,24 4,14" fill="none" stroke="#F0C65A" strokeWidth="1.6"/>
              <line x1="24" y1="24" x2="24" y2="44" stroke="#D9B45B" strokeWidth="1.6"/>
              <line x1="4" y1="14" x2="4" y2="34" stroke="#D9B45B" strokeWidth="1.2"/>
              <line x1="44" y1="14" x2="44" y2="34" stroke="#D9B45B" strokeWidth="1.2"/>
            </svg>
          </div>
          {!collapsed && (
            <div className="ws-brand-text">
              <strong>E-SCON <span>5.0</span></strong>
              <small>{t('Build Smarter. Source Better.')}</small>
            </div>
          )}
        </div>
        <div className="ws-sidebar-head">
          <span className="ws-sidebar-eyebrow">{t('Menu')}</span>
          <strong>{!collapsed ? t(definition.title) : ''}</strong>
          {!collapsed && <p>{t(definition.subtitle)}</p>}
          <button
            type="button"
            className="ws-sidebar-collapse"
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '>' : ''}
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
        {!collapsed && <div className="ws-sidebar-foot">v{APP_VERSION}</div>}
      </aside>

      <div className="ws-main">
        <div className="ws-topstrip">
          <button
            type="button"
            className="ws-menu-toggle"
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(o => !o)}
          >
            {drawerOpen ? '' : ''}
          </button>
          <div className="ws-topstrip-title">
            <strong>{t(activeLabel)}</strong>
            <span>{t('An Integrated Construction Supply-Chain Network for Ethiopia and Beyond')}</span>
          </div>
          <div className="ws-topstrip-meta">EN</div>
        </div>

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

        <details className="ws-fold">
          <summary>{t('Quick navigation')}</summary>
          <div className="ws-fold-body">
            {definition.sections.map(item => (
              <button key={item.id} type="button" className={'ws-fold-link' + (item.id === section ? ' active' : '')} onClick={() => onSection(item.id)}>
                <span>{item.icon}</span> {t(item.label)}
              </button>
            ))}
          </div>
        </details>

        <div className="ws-content" key={section}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceShell;
