import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  parseRecentIds,
  rankCommands,
  recordRecentId,
} from '../lib/commandSearch';

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  hint?: string;
  icon?: string;
  keywords?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  items: CommandItem[];
  onClose: () => void;
  /** Hand a free-text query to the full catalogue search. */
  onSearch?: (query: string) => void;
}

const RECENT_KEY = 'escon_command_recent';
const RECENT_LIMIT = 6;
const SEARCH_ALL_ID = '__search-all';

const readRecentIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    return parseRecentIds(window.localStorage.getItem(RECENT_KEY), RECENT_LIMIT);
  } catch {
    return [];
  }
};

const CommandPalette = ({ open, items, onClose, onSearch }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(readRecentIds);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const trimmed = query.trim();
    const ranked = rankCommands(items, trimmed, recentIds);
    if (!trimmed || !onSearch) return ranked;
    const searchAll: CommandItem = {
      id: SEARCH_ALL_ID,
      group: 'Search',
      label: `Search all products for "${trimmed}"`,
      hint: 'Open the catalogue filtered by this term',
      icon: '🔍',
      keywords: trimmed,
      run: () => onSearch(trimmed),
    };
    return [searchAll, ...ranked.filter(item => item.id !== SEARCH_ALL_ID)];
  }, [items, onSearch, query, recentIds]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    setRecentIds(readRecentIds());
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const active = filtered[activeIndex];
    if (!active) return;
    document.getElementById(listId + '-' + active.id)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, filtered, listId, open]);

  if (!open) return null;

  const choose = (item: CommandItem | undefined) => {
    if (!item) return;
    if (item.id !== SEARCH_ALL_ID) {
      const next = recordRecentId(recentIds, item.id, RECENT_LIMIT);
      setRecentIds(next);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // Private mode or a full quota must never block opening a command.
      }
    }
    onClose();
    item.run();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => filtered.length ? (index + 1) % filtered.length : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => filtered.length ? (index - 1 + filtered.length) % filtered.length : 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(filtered[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div className="command-overlay" onMouseDown={onClose}>
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Quick search"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="command-input-row">
          <span className="command-search-icon" aria-hidden="true">🔎</span>
          <input
            ref={inputRef}
            className="command-input"
            type="text"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, actions and products…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={filtered[activeIndex] ? listId + '-' + filtered[activeIndex].id : undefined}
          />
          <kbd className="command-esc">Esc</kbd>
        </div>
        <div className="command-results" id={listId} role="listbox" aria-label="Search results">
          {filtered.length === 0 ? (
            <div className="command-empty">
              <strong>No matches</strong>
              <span>Try a product name, city, supplier or page.</span>
            </div>
          ) : filtered.map((item, index) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            const active = index === activeIndex;
            return (
              <React.Fragment key={item.id}>
                {showGroup && <div className="command-group-label">{item.group}</div>}
                <button
                  id={listId + '-' + item.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={'command-item' + (active ? ' active' : '')}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(item)}
                >
                  <span className="command-item-icon" aria-hidden="true">{item.icon || '•'}</span>
                  <span className="command-item-copy">
                    <span className="command-item-label">{item.label}</span>
                    {item.hint && <span className="command-item-hint">{item.hint}</span>}
                  </span>
                  <span className="command-item-enter" aria-hidden="true">↵</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="command-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
          <span className="command-footer-brand">E-SCON Quick Search</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
