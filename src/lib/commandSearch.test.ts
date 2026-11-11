import {
  parseRecentIds,
  rankCommands,
  recordRecentId,
  scoreCommand,
  SearchableCommand,
} from './commandSearch';

const commands: SearchableCommand[] = [
  { id: 'home', label: 'Home', group: 'Navigate', keywords: 'overview dashboard' },
  { id: 'market', label: 'Marketplace', group: 'Navigate', keywords: 'shop catalogue' },
  { id: 'orders', label: 'Orders', group: 'Account', keywords: 'purchase delivery' },
  { id: 'cement', label: 'Portland Cement', group: 'Products', keywords: 'construction binder' },
];

describe('command scoring and ranking', () => {
  it('scores exact, prefix, substring and keyword matches in that order', () => {
    expect(scoreCommand(commands[0], 'home')).toBe(100);
    expect(scoreCommand(commands[1], 'market')).toBe(80);
    expect(scoreCommand(commands[0], 'ome')).toBe(60);
    expect(scoreCommand(commands[0], 'dashboard')).toBe(45);
    expect(scoreCommand(commands[0], 'nothing-here')).toBe(0);
  });

  it('matches every term of a multi-word query against the haystack', () => {
    expect(scoreCommand(commands[3], 'construction cement')).toBeGreaterThan(0);
    expect(scoreCommand(commands[3], 'construction plastic')).toBe(0);
  });

  it('ranks relevant commands and drops non-matches', () => {
    const result = rankCommands(commands, 'order');
    expect(result.map(item => item.id)).toEqual(['orders']);
  });

  it('lifts recent commands into a Recent group when the query is empty', () => {
    const result = rankCommands(commands, '', ['cement', 'orders']);
    expect(result.slice(0, 2).map(item => item.id)).toEqual(['cement', 'orders']);
    expect(result.slice(0, 2).every(item => item.group === 'Recent')).toBe(true);
    expect(result.filter(item => item.id === 'cement')).toHaveLength(1);
  });

  it('ignores unknown recent ids and caps the number of recents', () => {
    const result = rankCommands(commands, '', ['missing', 'orders', 'orders', 'home']);
    expect(result[0].id).toBe('orders');
    expect(result[1].id).toBe('home');
    expect(result.filter(item => item.id === 'orders')).toHaveLength(1);
  });
});

describe('recent command persistence', () => {
  it('parses stored ids safely', () => {
    expect(parseRecentIds('["home","orders"]')).toEqual(['home', 'orders']);
    expect(parseRecentIds('not-json')).toEqual([]);
    expect(parseRecentIds('{"a":1}')).toEqual([]);
    expect(parseRecentIds('["home",1,null]')).toEqual(['home']);
    expect(parseRecentIds(null)).toEqual([]);
  });

  it('moves an id to the front, de-duplicates and caps the list', () => {
    expect(recordRecentId(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(recordRecentId(['a', 'b', 'c', 'd', 'e', 'f'], 'g', 6)).toEqual(['g', 'a', 'b', 'c', 'd', 'e']);
  });
});
