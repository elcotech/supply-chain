// ===== src/components/MarketplacePage.tsx =====
// The E-SCON Marketplace: a supplier-first catalogue with category tiles,
// verified-supplier storefronts, favourites, comparison and the same
// Sample-Layout document styling used by the cart, analytics and Copilot.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Company, Material, ProductReview, User } from '../types';
import { effectiveRating, formatCurrency } from '../utils';

export interface MarketplacePageProps {
  materials: Material[];
  companies: Company[];
  reviews: ProductReview[];
  currentUser: User | null;
  favorites: string[];
  compareItems: string[];
  cartMaterialIds: string[];
  canSeeStock: boolean;
  onOpenProduct: (material: Material) => void;
  onAddToCart: (material: Material) => void;
  onToggleFavorite: (materialId: string) => void;
  onToggleCompare: (materialId: string) => void;
  onOpenMap: (companyId: string) => void;
  onOpenAnalytics: () => void;
  onAskCopilot: (prompt?: string) => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Construction: '🏗️', Transport: '🚚', Health: '💊', Education: '📚',
  Agriculture: '🌾', Manufacturing: '🏭', Energy: '⚡', Mining: '⛏️',
  Technology: '💻', Retail: '🛍️', Services: '🛠️', Hospitality: '🏨',
  Logistics: '📦', Pharmaceutical: '💉', Automotive: '🚗',
  Environmental: '🌱', Water: '💧', Telecom: '📡', 'Food & Beverage': '🍽️',
};

const categoryIcon = (category: string): string => CATEGORY_EMOJI[category] || '📦';

const ProductThumb: React.FC<{ material: Material; size?: 'xs' | 'sm' | 'md' | 'lg' }> = ({ material, size = 'md' }) => {
  const image = material.images && material.images.length > 0 ? material.images[0] : null;
  return (
    <div className={'market-thumb market-thumb-' + size}>
      {image
        ? <img src={image} alt={material.name} loading="lazy" />
        : <span className="market-thumb-emoji" aria-hidden="true">{categoryIcon(material.category)}</span>}
    </div>
  );
};

const MarketplacePage: React.FC<MarketplacePageProps> = ({
  materials,
  companies,
  reviews,
  currentUser,
  favorites,
  compareItems,
  cartMaterialIds,
  canSeeStock,
  onOpenProduct,
  onAddToCart,
  onToggleFavorite,
  onToggleCompare,
  onOpenMap,
  onOpenAnalytics,
  onAskCopilot,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [city, setCity] = useState('all');
  const [sort, setSort] = useState('featured');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [limit, setLimit] = useState(18);

  useEffect(() => { setLimit(18); }, [query, category, city, sort]);

  const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies]);
  const reviewCount = useMemo(() => {
    const counts = new Map<string, number>();
    reviews.forEach(review => counts.set(review.materialId, (counts.get(review.materialId) || 0) + 1));
    return counts;
  }, [reviews]);

  const ratingFor = useCallback((material: Material): number =>
    effectiveRating(material.rating || 0, reviews.filter(r => r.materialId === material.id)), [reviews]);

  const supplierSummaries = useMemo(() => companies
    .map(company => {
      const products = materials.filter(m => m.companyId === company.id);
      const ratingValues = products.map(m => ratingFor(m));
      const avg = ratingValues.length > 0
        ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length
        : (company.rating || 0);
      return {
        company,
        products,
        productCount: products.length,
        rating: avg,
      };
    })
    .filter(summary => summary.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount || b.rating - a.rating), [companies, materials, ratingFor]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    materials.forEach(m => counts.set(m.category, (counts.get(m.category) || 0) + 1));
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [materials]);

  const cities = useMemo(() =>
    Array.from(new Set(companies.map(c => c.city).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [companies]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = materials.filter(material => {
      const company = companyMap.get(material.companyId);
      if (category !== 'all' && material.category !== category) return false;
      if (city !== 'all' && company?.city !== city) return false;
      if (!needle) return true;
      return [
        material.name,
        material.description,
        material.brand || '',
        material.model || '',
        material.category,
        company?.name || '',
        company?.city || '',
      ].some(value => value.toLowerCase().includes(needle));
    });
    const rating = (material: Material): number => ratingFor(material);
    return list.sort((a, b) => {
      switch (sort) {
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'rating_desc': return rating(b) - rating(a);
        case 'newest': return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default: return rating(b) - rating(a) || a.name.localeCompare(b.name);
      }
    });
  }, [materials, companyMap, query, category, city, sort, ratingFor]);

  const visible = filtered.slice(0, limit);
  const supplierCount = supplierSummaries.length;
  const cityCount = cities.length;
  const avgRating = materials.length > 0
    ? materials.reduce((sum, material) => sum + ratingFor(material), 0) / materials.length
    : 0;
  const lowestPrice = materials.length > 0 ? Math.min(...materials.map(m => m.price)) : 0;

  const isCustomer = currentUser?.userType === 'customer';
  const canOrder = isCustomer || !currentUser;

  const storeSupplier = storeId ? supplierSummaries.find(summary => summary.company.id === storeId) : undefined;

  const productCard = (material: Material) => {
    const company = companyMap.get(material.companyId);
    const inCart = cartMaterialIds.includes(material.id);
    const isFav = favorites.includes(material.id);
    const comparing = compareItems.includes(material.id);
    const rating = ratingFor(material);
    const outOfStock = (material.quantity || 0) <= 0;
    return (
      <article key={material.id} className="market-card">
        <div className="market-card-visual">
          <button type="button" className="market-card-image" onClick={() => onOpenProduct(material)} aria-label={'View ' + material.name}>
            <ProductThumb material={material} />
          </button>
          <div className="market-card-badges">
            {rating >= 4.5 && <span className="market-pill gold">★ Top rated</span>}
            {canSeeStock && outOfStock && <span className="market-pill danger">Out of stock</span>}
            {!canSeeStock && outOfStock && <span className="market-pill">Unavailable</span>}
          </div>
          <div className="market-card-tools">
            <button
              type="button"
              className={'market-tool' + (isFav ? ' active' : '')}
              onClick={() => onToggleFavorite(material.id)}
              aria-label={isFav ? 'Remove from saved' : 'Save product'}
              title={isFav ? 'Saved' : 'Save'}
            >❤️</button>
            <button
              type="button"
              className={'market-tool' + (comparing ? ' active' : '')}
              onClick={() => onToggleCompare(material.id)}
              aria-label={comparing ? 'Remove from comparison' : 'Add to comparison'}
              title="Compare"
            >⚖️</button>
          </div>
        </div>
        <div className="market-card-body">
          <button type="button" className="market-card-name" onClick={() => onOpenProduct(material)}>{material.name}</button>
          <button type="button" className="market-card-supplier" onClick={() => company && setStoreId(company.id)} disabled={!company}>
            {company?.name || 'Unknown supplier'}{company?.city ? ' · ' + company.city : ''}
          </button>
          <div className="market-card-meta">
            <span className="market-cat-chip">{categoryIcon(material.category)} {material.category}</span>
            <span className="market-rating">⭐ {rating.toFixed(1)} <small>({reviewCount.get(material.id) || 0})</small></span>
          </div>
          <div className="market-card-price-row">
            <div className="market-card-price">
              {formatCurrency(material.price)}
              <span> / {material.unit || 'unit'}</span>
            </div>
            {canSeeStock && <span className={'market-stock' + (outOfStock ? ' out' : '')}>{outOfStock ? 'Out' : 'In stock'}</span>}
          </div>
          <div className="market-card-actions">
            <button
              type="button"
              className="market-map-btn"
              onClick={() => company && onOpenMap(company.id)}
              disabled={!company}
              aria-label={'Open route to ' + (company?.name || 'supplier')}
            >🗺️ Route</button>
            {canOrder ? (
              <button
                type="button"
                className={'market-add-btn' + (inCart ? ' in-cart' : '')}
                onClick={() => inCart ? onOpenProduct(material) : onAddToCart(material)}
              >
                {inCart ? '🛒 In cart — review' : '🛒 Add to cart'}
              </button>
            ) : (
              <button type="button" className="market-add-btn ghost" onClick={() => onOpenProduct(material)}>👁️ View</button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <main className="main-content">
      <div className="escon-sheet market-sheet">
        <header className="market-hero">
          <div className="market-hero-copy">
            <span className="escon-kicker">E-SCON · Marketplace</span>
            <h1>Ethiopia's verified materials marketplace</h1>
            <p>Compare real suppliers, published prices and road distances — then order with a single-supplier proforma and track delivery.</p>
            <form className="market-search" onSubmit={e => e.preventDefault()}>
              <span className="market-search-icon">🔍</span>
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search products, brands, suppliers or cities…"
                aria-label="Search marketplace"
              />
              {query && <button type="button" className="market-search-clear" onClick={() => setQuery('')} aria-label="Clear search">✕</button>}
            </form>
            <div className="market-hero-actions">
              <button type="button" className="escon-btn ghost" onClick={onOpenAnalytics}>📊 Marketplace analytics</button>
              <button type="button" className="escon-btn ghost" onClick={() => onAskCopilot('What products are trending?')}>🤖 Ask Copilot</button>
            </div>
          </div>
          <aside className="market-hero-stats">
            <div><strong>{materials.length}</strong><span>Products</span></div>
            <div><strong>{supplierCount}</strong><span>Suppliers</span></div>
            <div><strong>{cityCount}</strong><span>Cities</span></div>
            <div><strong>{avgRating.toFixed(1)}</strong><span>Avg rating</span></div>
            <div className="market-hero-low"><strong>{formatCurrency(lowestPrice)}</strong><span>Lowest price</span></div>
          </aside>
        </header>

        <div className="market-toolbar">
          <div className="market-toolbar-group">
            <label>
              <span>Category</span>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map(item => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}
              </select>
            </label>
            <label>
              <span>City</span>
              <select value={city} onChange={e => setCity(e.target.value)}>
                <option value="all">All cities</option>
                {cities.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select value={sort} onChange={e => setSort(e.target.value)}>
                <option value="featured">Featured</option>
                <option value="rating_desc">Highest rated</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="newest">Newest</option>
              </select>
            </label>
          </div>
          <div className="market-toolbar-result">
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
            {(query || category !== 'all' || city !== 'all') && (
              <button type="button" className="escon-link" onClick={() => { setQuery(''); setCategory('all'); setCity('all'); }}>Reset filters</button>
            )}
          </div>
        </div>

        <div className="market-cats" aria-label="Categories">
          <button
            type="button"
            className={'market-cat' + (category === 'all' ? ' active' : '')}
            onClick={() => setCategory('all')}
          >
            <span>🌍</span><strong>All</strong><small>{materials.length}</small>
          </button>
          {categories.map(item => (
            <button
              key={item.name}
              type="button"
              className={'market-cat' + (category === item.name ? ' active' : '')}
              onClick={() => setCategory(item.name)}
            >
              <span>{categoryIcon(item.name)}</span><strong>{item.name}</strong><small>{item.count}</small>
            </button>
          ))}
        </div>

        {supplierSummaries.length > 0 && (
          <section className="market-section">
            <div className="escon-section-head">
              <h2>Supplier storefronts</h2>
              <button type="button" className="escon-link" onClick={() => onAskCopilot('Who are the top suppliers?')}>Ask Copilot →</button>
            </div>
            <div className="supplier-spotlight">
              {supplierSummaries.slice(0, 8).map(summary => (
                <button
                  key={summary.company.id}
                  type="button"
                  className="supplier-spot-card"
                  onClick={() => setStoreId(summary.company.id)}
                >
                  <span className="supplier-spot-avatar">{summary.company.name.charAt(0).toUpperCase()}</span>
                  <span className="supplier-spot-info">
                    <strong>{summary.company.name}</strong>
                    <small>📍 {summary.company.city || 'Ethiopia'} · {summary.productCount} products</small>
                    <span className="supplier-spot-rating">⭐ {summary.rating.toFixed(1)}</span>
                  </span>
                  <span className={'supplier-spot-badge ' + (summary.company.complianceStatus || 'pending')}>
                    {summary.company.complianceStatus === 'compliant' ? '✅ Verified' : summary.company.complianceStatus === 'non-compliant' ? '⚠️ Review' : '⏳ Pending'}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="market-section">
          <div className="escon-section-head">
            <h2>{query ? `Results for “${query}”` : category === 'all' ? 'All products' : category}</h2>
            <span className="escon-badge">{filtered.length} items</span>
          </div>
          {visible.length === 0 ? (
            <div className="escon-empty">
              <span>🛍️</span>
              <p>No products match these filters. Try another category, city or search.</p>
              <button type="button" className="escon-btn ghost" onClick={() => { setQuery(''); setCategory('all'); setCity('all'); }}>Reset filters</button>
            </div>
          ) : (
            <>
              <div className="market-grid">{visible.map(productCard)}</div>
              {filtered.length > visible.length && (
                <div className="market-load-more">
                  <button type="button" className="escon-btn" onClick={() => setLimit(limit + 18)}>Show {Math.min(18, filtered.length - visible.length)} more products</button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="escon-ask market-ask">
          <div>
            <h2>Need help choosing?</h2>
            <p>Copilot can compare suppliers, forecast prices and explain the best-value category from live data.</p>
          </div>
          <div className="escon-ask-actions">
            <button type="button" className="escon-btn" onClick={() => onAskCopilot('Find the best-rated supplier')}>Best suppliers</button>
            <button type="button" className="escon-btn ghost" onClick={() => onAskCopilot('What should I buy next?')}>What to buy next</button>
            <button type="button" className="escon-btn ghost" onClick={() => onAskCopilot('Show price forecasts')}>Price forecast</button>
          </div>
        </section>

        <footer className="escon-sheet-foot">
          <span>E-SCON · Ethio-Supply Chain Optimization Network</span>
          <span>{currentUser ? 'Signed in as ' + (currentUser.userType === 'company' ? 'supplier' : currentUser.userType) : 'Browse freely — sign in to order'}</span>
        </footer>
      </div>

      {storeSupplier && (
        <div className="modal-overlay" onClick={() => setStoreId(null)}>
          <div className="modal-content market-store-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{storeSupplier.company.name}</h2>
              <button className="modal-close" onClick={() => setStoreId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="market-store-head">
                <span className="supplier-spot-avatar large">{storeSupplier.company.name.charAt(0).toUpperCase()}</span>
                <div>
                  <p className="market-store-location">📍 {storeSupplier.company.location || storeSupplier.company.city || 'Ethiopia'}</p>
                  <p className="market-store-desc">{storeSupplier.company.description || 'Verified E-SCON supplier.'}</p>
                  <div className="market-store-stats">
                    <span>⭐ {storeSupplier.rating.toFixed(1)} rating</span>
                    <span>📦 {storeSupplier.productCount} products</span>
                    <span>{storeSupplier.company.complianceStatus === 'compliant' ? '✅ Compliant' : '⏳ ' + (storeSupplier.company.complianceStatus || 'pending')}</span>
                  </div>
                </div>
                <button type="button" className="escon-btn" onClick={() => onOpenMap(storeSupplier.company.id)}>🗺️ Map & route</button>
              </div>
              <div className="market-store-products">
                {storeSupplier.products.map(material => (
                  <div key={material.id} className="market-store-row">
                    <ProductThumb material={material} size="sm" />
                    <div className="market-store-row-info">
                      <strong>{material.name}</strong>
                      <small>{material.category} · {formatCurrency(material.price)} / {material.unit || 'unit'}</small>
                    </div>
                    <button type="button" className="escon-btn ghost" onClick={() => { setStoreId(null); onOpenProduct(material); }}>View</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default MarketplacePage;
