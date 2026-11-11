export interface SearchableCommand {
  id: string;
  label: string;
  group: string;
  hint?: string;
  keywords?: string;
}

/** Relevance of a command for a free-text query. Higher is better; 0 means no match. */
export const scoreCommand = (item: SearchableCommand, query: string): number => {
  if (!query) return 0;
  const label = item.label.toLowerCase();
  const haystack = [item.label, item.group, item.hint || '', item.keywords || '']
    .join(' ')
    .toLowerCase();
  if (label === query) return 100;
  if (label.startsWith(query)) return 80;
  if (label.includes(query)) return 60;
  if (haystack.includes(query)) return 45;
  const terms = query.split(/\s+/).filter(Boolean);
  if (terms.length > 1 && terms.every(term => haystack.includes(term))) return 30;
  return 0;
};

/**
 * Order commands for the palette. With no query, the most recently used
 * commands are lifted into a "Recent" group ahead of the rest. With a query,
 * commands are ranked by relevance and then alphabetically.
 */
export const rankCommands = <T extends SearchableCommand>(
  items: T[],
  query: string,
  recentIds: string[] = [],
  limit = 60
): T[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    const byId = new Map(items.map(item => [item.id, item]));
    const recent: T[] = [];
    for (const id of recentIds) {
      const item = byId.get(id);
      if (item && !recent.some(existing => existing.id === item.id)) {
        recent.push({ ...item, group: 'Recent' } as T);
      }
      if (recent.length >= 6) break;
    }
    const recentIdsSet = new Set(recent.map(item => item.id));
    return [
      ...recent,
      ...items.filter(item => !recentIdsSet.has(item.id)),
    ].slice(0, limit);
  }

  return items
    .map(item => ({ item, score: scoreCommand(item, normalized) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .slice(0, limit)
    .map(entry => entry.item);
};

/** Read a stored recent-command list without ever throwing on corrupt data. */
export const parseRecentIds = (raw: string | null, limit = 6): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string').slice(0, limit);
  } catch {
    return [];
  }
};

/** Move an id to the front of the recent list, de-duplicating and capping it. */
export const recordRecentId = (ids: string[], id: string, limit = 6): string[] =>
  [id, ...ids.filter(existing => existing !== id)].slice(0, limit);
