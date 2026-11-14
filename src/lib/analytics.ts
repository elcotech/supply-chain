// ===== src/lib/analytics.ts =====
// Pure, deterministic business-intelligence engine for E-SCON.
//
// Everything here is derived from the records already held by the app
// (materials, companies, orders, users, reviews and settings). No network
// request is made, so Analytics and Copilot work offline and on every device.
//
// The role scope is the important part: an administrator sees platform-wide
// figures, a supplier sees only its own orders/products, a customer sees only
// its own spending, and a signed-out visitor only sees public catalogue data.
import { User, Company, Material, Order, ProductReview, SystemSettings } from '../types';
import { formatCurrency, forecastPrice, effectiveRating, ForecastResult } from '../utils';

export type AnalyticsRole = 'admin' | 'company' | 'customer' | 'transporter' | 'guest';

export interface AnalyticsInput {
  user: User | null;
  materials: Material[];
  companies: Company[];
  orders: Order[];
  users: User[];
  reviews: ProductReview[];
  settings: SystemSettings;
  /** 0 / undefined = all time. Otherwise the trailing number of days. */
  days?: number;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface AnalyticsKpi {
  key: string;
  icon: string;
  label: string;
  value: string;
  sub?: string;
  tone?: 'up' | 'down' | 'flat' | 'neutral';
}

export interface StatusSlice {
  label: string;
  value: number;
  color: string;
}

export interface AnalyticsProduct {
  id: string;
  name: string;
  category: string;
  supplierName: string;
  price: number;
  units: number;
  revenue: number;
  orders: number;
  rating: number;
}

export interface AnalyticsSupplier {
  id: string;
  name: string;
  city: string;
  orders: number;
  revenue: number;
  products: number;
  rating: number;
}

export interface AnalyticsCustomer {
  id: string;
  name: string;
  city: string;
  orders: number;
  spend: number;
}

export interface PriceInsight {
  id: string;
  name: string;
  category: string;
  price: number;
  history: number[];
  forecast: ForecastResult | null;
  marginPct: number;
}

export interface AnalyticsResult {
  role: AnalyticsRole;
  scopeLabel: string;
  days: number;
  periodLabel: string;
  generatedAt: number;

  orderCount: number;
  unitsSold: number;
  gmv: number;
  deliveredRevenue: number;
  avgOrderValue: number;
  activeOrders: number;
  activeOrderValue: number;
  deliveredOrders: number;
  cancelledOrders: number;
  deliveredRatePct: number;
  deliveryFees: number;
  vatCollected: number;
  growthPct: number | null;

  productCount: number;
  supplierCount: number;
  customerCount: number;
  cityCount: number;
  reviewCount: number;
  avgRating: number;

  stockUnits: number;
  stockValue: number;
  lowStockCount: number;
  outOfStockCount: number;

  monthlyRevenue: ChartPoint[];
  monthlyOrders: ChartPoint[];
  statuses: StatusSlice[];
  categoryData: ChartPoint[];
  categoryBasis: 'revenue' | 'catalogue';
  cityData: ChartPoint[];
  cityBasis: 'orders' | 'suppliers';

  topProducts: AnalyticsProduct[];
  topSuppliers: AnalyticsSupplier[];
  topCustomers: AnalyticsCustomer[];
  priceBoard: PriceInsight[];
  kpis: AnalyticsKpi[];
  insights: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_COLORS: Record<Order['status'], string> = {
  pending: '#f1c40f',
  confirmed: '#3498db',
  shipped: '#e67e22',
  delivered: '#2ecc71',
  cancelled: '#e74c3c',
};

const money = (value: number): string => formatCurrency(Math.round(value * 100) / 100);

const pctText = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

/** Resolve the role from the signed-in account. */
export const analyticsRole = (user: User | null): AnalyticsRole => {
  if (!user) return 'guest';
  if (user.userType === 'admin') return 'admin';
  if (user.userType === 'company') return 'company';
  if (user.userType === 'transporter') return 'transporter';
  return 'customer';
};

/** The company record owned by the signed-in supplier, if any. */
export const analyticsCompany = (input: AnalyticsInput): Company | undefined => {
  if (!input.user || input.user.userType !== 'company') return undefined;
  return input.companies.find(c => c.userId === input.user!.id);
};

/**
 * The orders an account is allowed to analyse. Cancelled orders stay in the
 * list for status breakdowns but are excluded from money and unit totals.
 */
export const scopedOrders = (input: AnalyticsInput): Order[] => {
  const role = analyticsRole(input.user);
  if (role === 'guest') return [];
  if (role === 'admin') return input.orders;
  if (role === 'company') {
    const company = analyticsCompany(input);
    return company ? input.orders.filter(o => o.companyId === company.id) : [];
  }
  if (role === 'transporter') {
    return input.orders.filter(o => o.transporterId === input.user!.id);
  }
  return input.orders.filter(o => o.customerId === input.user!.id);
};

export const scopedMaterials = (input: AnalyticsInput): Material[] => {
  const role = analyticsRole(input.user);
  if (role !== 'company') return input.materials;
  const company = analyticsCompany(input);
  return company ? input.materials.filter(m => m.companyId === company.id) : [];
};

const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const orderTime = (order: Order): number => {
  const parsed = Date.parse(order.orderDate);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildMonthly = (orders: Order[], now: Date): { revenue: ChartPoint[]; orders: ChartPoint[] } => {
  const buckets: { key: string; label: string; revenue: number; orders: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: monthKey(d),
      label: d.toLocaleString('en', { month: 'short' }),
      revenue: 0,
      orders: 0,
    });
  }
  const byKey = new Map(buckets.map(b => [b.key, b]));
  orders.filter(o => o.status !== 'cancelled').forEach(order => {
    const t = orderTime(order);
    if (!t) return;
    const bucket = byKey.get(monthKey(new Date(t)));
    if (!bucket) return;
    bucket.revenue += order.totalAmount || 0;
    bucket.orders += 1;
  });
  return {
    revenue: buckets.map(b => ({ label: b.label, value: Math.round(b.revenue * 100) / 100 })),
    orders: buckets.map(b => ({ label: b.label, value: b.orders })),
  };
};

const buildCategoryData = (
  orders: Order[],
  materials: Material[],
): { data: ChartPoint[]; basis: 'revenue' | 'catalogue' } => {
  const materialMap = new Map(materials.map(m => [m.id, m]));
  const totals = new Map<string, number>();
  orders.filter(o => o.status !== 'cancelled').forEach(order => {
    const material = materialMap.get(order.materialId);
    const category = material?.category || 'Other';
    const goods = (order.unitPrice || 0) * (order.quantity || 0);
    totals.set(category, (totals.get(category) || 0) + goods);
  });
  let basis: 'revenue' | 'catalogue' = 'revenue';
  if (totals.size === 0) {
    basis = 'catalogue';
    materials.forEach(material => {
      const category = material.category || 'Other';
      totals.set(category, (totals.get(category) || 0) + 1);
    });
  }
  const data = Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);
  return { data, basis };
};

const buildCityData = (
  orders: Order[],
  companies: Company[],
): { data: ChartPoint[]; basis: 'orders' | 'suppliers' } => {
  const companyMap = new Map(companies.map(c => [c.id, c]));
  const totals = new Map<string, number>();
  orders.filter(o => o.status !== 'cancelled').forEach(order => {
    const city = companyMap.get(order.companyId)?.city || 'Unknown';
    totals.set(city, (totals.get(city) || 0) + (order.totalAmount || 0));
  });
  let basis: 'orders' | 'suppliers' = 'orders';
  if (totals.size === 0) {
    basis = 'suppliers';
    companies.forEach(company => {
      const city = company.city || 'Unknown';
      totals.set(city, (totals.get(city) || 0) + 1);
    });
  }
  const data = Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);
  return { data, basis };
};

export const buildAnalytics = (input: AnalyticsInput): AnalyticsResult => {
  const role = analyticsRole(input.user);
  const days = typeof input.days === 'number' && input.days > 0 ? input.days : 0;
  const company = analyticsCompany(input);
  const scoped = scopedOrders(input);
  const catalog = scopedMaterials(input);
  const now = Date.now();
  const since = days > 0 ? now - days * DAY_MS : 0;
  const previousSince = days > 0 ? now - days * 2 * DAY_MS : 0;

  const inPeriod = (order: Order): boolean => {
    if (days === 0) return true;
    const t = orderTime(order);
    return !t || t >= since;
  };

  const periodOrders = scoped.filter(inPeriod);
  const previousOrders = days > 0
    ? scoped.filter(o => {
        const t = orderTime(o);
        return t >= previousSince && t < since;
      })
    : [];
  const valid = periodOrders.filter(o => o.status !== 'cancelled');
  const previousValid = previousOrders.filter(o => o.status !== 'cancelled');

  const gmv = valid.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const previousGmv = previousValid.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const deliveredOrders = valid.filter(o => o.status === 'delivered');
  const deliveredRevenue = deliveredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const activeList = periodOrders.filter(o => o.status === 'pending' || o.status === 'confirmed' || o.status === 'shipped');
  const activeOrderValue = activeList.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const cancelledOrders = periodOrders.filter(o => o.status === 'cancelled').length;
  const unitsSold = valid.reduce((sum, o) => sum + (o.quantity || 0), 0);
  const deliveryFees = valid.reduce((sum, o) => sum + (o.transportCost || 0), 0);
  const vatCollected = valid.reduce((sum, o) => sum + (o.vatAmount || 0), 0);
  const transportEarningsTotal = valid.reduce(
    (sum, o) => sum + (o.transportFee || o.transportCost || 0), 0
  );
  const transportActiveValue = activeList.reduce(
    (sum, o) => sum + (o.transportFee || o.transportCost || 0), 0
  );
  const transportAvgFee = valid.length > 0 ? transportEarningsTotal / valid.length : 0;
  const avgOrderValue = valid.length > 0 ? gmv / valid.length : 0;
  const deliveredRatePct = valid.length > 0 ? (deliveredOrders.length / valid.length) * 100 : 0;
  const growthPct = days > 0 && previousGmv > 0 ? ((gmv - previousGmv) / previousGmv) * 100 : null;

  // ---------- Catalogue & scope ----------
  const productCount = catalog.length;
  const supplierCount = new Set(catalog.map(m => m.companyId)).size;
  const customerCount = role === 'admin'
    ? input.users.filter(u => u.userType === 'customer').length
    : role === 'company' || role === 'transporter'
      ? new Set(valid.map(o => o.customerId)).size
      : role === 'customer' ? 1 : 0;
  const cityCount = new Set(input.companies.map(c => c.city).filter(Boolean)).size;
  const scopedReviewList = role === 'company'
    ? input.reviews.filter(r => catalog.some(m => m.id === r.materialId))
    : role === 'customer'
      ? input.reviews.filter(r => r.userId === input.user!.id)
      : role === 'transporter'
        ? input.reviews.filter(r => valid.some(o => o.materialId === r.materialId))
        : input.reviews;
  const avgRating = catalog.length > 0
    ? catalog.reduce((sum, m) => sum + effectiveRating(m.rating || 0, input.reviews.filter(r => r.materialId === m.id)), 0) / catalog.length
    : 0;
  const stockUnits = catalog.reduce((sum, m) => sum + (m.quantity || 0), 0);
  const stockValue = catalog.reduce((sum, m) => sum + (m.quantity || 0) * (m.price || 0), 0);
  const lowStockCount = catalog.filter(m => m.quantity > 0 && m.quantity <= 10).length;
  const outOfStockCount = catalog.filter(m => (m.quantity || 0) <= 0).length;

  // ---------- Monthly trend (last six months) ----------
  const monthly = buildMonthly(scoped, new Date(now));

  // ---------- Status mix ----------
  const statuses: StatusSlice[] = (['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as Order['status'][])
    .map(status => ({
      label: status.charAt(0).toUpperCase() + status.slice(1),
      value: periodOrders.filter(o => o.status === status).length,
      color: STATUS_COLORS[status],
    }))
    .filter(slice => slice.value > 0);

  // ---------- Category / city ----------
  const category = buildCategoryData(periodOrders, catalog);
  const city = buildCityData(periodOrders, input.companies);

  // ---------- Top products ----------
  const materialMap = new Map(input.materials.map(m => [m.id, m]));
  const companyMap = new Map(input.companies.map(c => [c.id, c]));
  const productAgg = new Map<string, { units: number; revenue: number; orders: number }>();
  valid.forEach(order => {
    const current = productAgg.get(order.materialId) || { units: 0, revenue: 0, orders: 0 };
    current.units += order.quantity || 0;
    current.revenue += (order.unitPrice || 0) * (order.quantity || 0);
    current.orders += 1;
    productAgg.set(order.materialId, current);
  });
  const topProducts: AnalyticsProduct[] = Array.from(productAgg.entries())
    .map(([id, agg]) => {
      const material = materialMap.get(id);
      return {
        id,
        name: material?.name || id,
        category: material?.category || 'Other',
        supplierName: companyMap.get(material?.companyId || '')?.name || 'Unknown supplier',
        price: material?.price || 0,
        units: agg.units,
        revenue: Math.round(agg.revenue * 100) / 100,
        orders: agg.orders,
        rating: material ? effectiveRating(material.rating || 0, input.reviews.filter(r => r.materialId === material.id)) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // ---------- Top suppliers / customers ----------
  const supplierAgg = new Map<string, { orders: number; revenue: number }>();
  valid.forEach(order => {
    const current = supplierAgg.get(order.companyId) || { orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += order.totalAmount || 0;
    supplierAgg.set(order.companyId, current);
  });
  const topSuppliers: AnalyticsSupplier[] = Array.from(supplierAgg.entries())
    .map(([id, agg]) => {
      const supplier = companyMap.get(id);
      return {
        id,
        name: supplier?.name || 'Unknown supplier',
        city: supplier?.city || '—',
        orders: agg.orders,
        revenue: Math.round(agg.revenue * 100) / 100,
        products: input.materials.filter(m => m.companyId === id).length,
        rating: supplier?.rating || 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const customerAgg = new Map<string, { orders: number; spend: number }>();
  valid.forEach(order => {
    const current = customerAgg.get(order.customerId) || { orders: 0, spend: 0 };
    current.orders += 1;
    current.spend += order.totalAmount || 0;
    customerAgg.set(order.customerId, current);
  });
  const topCustomers: AnalyticsCustomer[] = role === 'admin' || role === 'company' || role === 'transporter'
    ? Array.from(customerAgg.entries())
        .map(([id, agg]) => {
          const customer = input.users.find(u => u.id === id);
          return {
            id,
            name: customer?.name || 'Customer',
            city: customer?.city || '—',
            orders: agg.orders,
            spend: Math.round(agg.spend * 100) / 100,
          };
        })
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 8)
    : [];

  // ---------- Price intelligence ----------
  const priceRanked = catalog
    .map(material => {
      const agg = productAgg.get(material.id);
      return { material, revenue: agg?.revenue || 0 };
    })
    .sort((a, b) => b.revenue - a.revenue || (b.material.rating || 0) - (a.material.rating || 0))
    .slice(0, 6);
  const priceBoard: PriceInsight[] = priceRanked.map(({ material }) => {
    // Guests get public catalogue prices only: no supplier margin, price
    // history or forecast is exposed before sign-in.
    const isGuest = role === 'guest';
    const history = isGuest ? [] : (material.priceHistory || [])
      .filter(point => typeof point.price === 'number' && isFinite(point.price))
      .sort((a, b) => a.date - b.date)
      .slice(-12)
      .map(point => point.price);
    const rawMargin = material.profitMargin || 0;
    return {
      id: material.id,
      name: material.name,
      category: material.category,
      price: material.price,
      history,
      forecast: isGuest ? null : forecastPrice(material.priceHistory, material.price),
      marginPct: isGuest ? 0 : rawMargin > 0 && rawMargin <= 1 ? rawMargin * 100 : rawMargin,
    };
  });

  // ---------- KPIs ----------
  const toneFromGrowth: AnalyticsKpi['tone'] = growthPct == null
    ? 'neutral'
    : growthPct > 1.5 ? 'up' : growthPct < -1.5 ? 'down' : 'flat';
  const periodLabel = days > 0 ? `Last ${days} days` : 'All time';
  const growthSub = growthPct == null ? periodLabel : `${pctText(growthPct)} vs previous period`;
  const kpis: AnalyticsKpi[] = [];

  if (role === 'admin') {
    kpis.push(
      { key: 'gmv', icon: '💰', label: 'Gross revenue', value: money(gmv), sub: growthSub, tone: toneFromGrowth },
      { key: 'orders', icon: '📦', label: 'Orders', value: String(valid.length), sub: `${activeList.length} active · ${cancelledOrders} cancelled` },
      { key: 'customers', icon: '👥', label: 'Customers', value: String(customerCount), sub: 'Registered buyers' },
      { key: 'suppliers', icon: '🏢', label: 'Suppliers', value: String(input.companies.length), sub: `${supplierCount} with listings` },
      { key: 'products', icon: '🧾', label: 'Products', value: String(input.materials.length), sub: `${input.materials.reduce((s, m) => s + (m.quantity || 0), 0)} units in catalogue` },
      { key: 'delivered', icon: '✅', label: 'Delivered rate', value: `${deliveredRatePct.toFixed(0)}%`, sub: `${deliveredOrders.length} of ${valid.length} orders` },
      { key: 'delivery', icon: '🚚', label: 'Delivery fees', value: money(deliveryFees), sub: gmv > 0 ? `${((deliveryFees / gmv) * 100).toFixed(1)}% of GMV` : 'No sales yet' },
      { key: 'vat', icon: '🧮', label: 'VAT collected', value: money(vatCollected), sub: `Rate ${input.settings.vat.rate}%` },
    );
  } else if (role === 'company') {
    kpis.push(
      { key: 'revenue', icon: '💰', label: 'Revenue', value: money(gmv), sub: growthSub, tone: toneFromGrowth },
      { key: 'orders', icon: '📦', label: 'Orders', value: String(valid.length), sub: `${activeList.length} active · ${cancelledOrders} cancelled` },
      { key: 'active', icon: '⏳', label: 'Active orders', value: String(activeList.length), sub: money(activeOrderValue) + ' in progress' },
      { key: 'delivered', icon: '✅', label: 'Delivered', value: String(deliveredOrders.length), sub: `${deliveredRatePct.toFixed(0)}% delivery rate` },
      { key: 'avg', icon: '📈', label: 'Avg order', value: money(avgOrderValue), sub: `${unitsSold} units sold` },
      { key: 'products', icon: '🧾', label: 'Products', value: String(productCount), sub: `${input.materials.filter(m => m.companyId === company?.id && (m.quantity || 0) <= 0).length} out of stock` },
      { key: 'stock', icon: '🏷️', label: 'Stock value', value: money(stockValue), sub: `${stockUnits} units on hand` },
      { key: 'low', icon: '⚠️', label: 'Restock alerts', value: String(lowStockCount), sub: `${outOfStockCount} out of stock`, tone: lowStockCount + outOfStockCount > 0 ? 'down' : 'up' },
    );
  } else if (role === 'customer') {
    kpis.push(
      { key: 'spend', icon: '💳', label: 'Total spend', value: money(gmv), sub: growthSub, tone: toneFromGrowth },
      { key: 'orders', icon: '📦', label: 'Orders', value: String(valid.length), sub: `${activeList.length} active` },
      { key: 'delivered', icon: '✅', label: 'Delivered', value: String(deliveredOrders.length), sub: `${deliveredOrders.reduce((s, o) => s + (o.quantity || 0), 0)} units received` },
      { key: 'avg', icon: '📈', label: 'Avg order', value: money(avgOrderValue), sub: 'Per checkout' },
      { key: 'delivery', icon: '🚚', label: 'Delivery paid', value: money(deliveryFees), sub: gmv > 0 ? `${((deliveryFees / gmv) * 100).toFixed(1)}% of spend` : 'No orders yet' },
      { key: 'vat', icon: '🧮', label: 'VAT paid', value: money(vatCollected), sub: `${input.settings.vat.rate}% on goods` },
      { key: 'suppliers', icon: '🏢', label: 'Suppliers used', value: String(new Set(valid.map(o => o.companyId)).size), sub: `${input.companies.length} on the marketplace` },
      { key: 'reviews', icon: '⭐', label: 'Reviews written', value: String(scopedReviewList.length), sub: `Catalogue rating ${avgRating.toFixed(1)}/5` },
    );
  } else if (role === 'transporter') {
    kpis.push(
      { key: 'earnings', icon: '💰', label: 'Transport earnings', value: money(transportEarningsTotal), sub: growthSub, tone: toneFromGrowth },
      { key: 'jobs', icon: '🚚', label: 'Delivery jobs', value: String(valid.length), sub: `${activeList.length} active · ${cancelledOrders} cancelled` },
      { key: 'active', icon: '⏳', label: 'Active trips', value: String(activeList.length), sub: money(transportActiveValue) + ' in progress' },
      { key: 'delivered', icon: '✅', label: 'Completed', value: String(deliveredOrders.length), sub: `${deliveredRatePct.toFixed(0)}% completion rate` },
      { key: 'avg', icon: '📈', label: 'Avg job fee', value: money(transportAvgFee), sub: `${unitsSold} units moved` },
      { key: 'customers', icon: '👥', label: 'Customers served', value: String(customerCount), sub: `${new Set(valid.map(o => o.companyId)).size} suppliers` },
      { key: 'value', icon: '📦', label: 'Cargo value moved', value: money(gmv), sub: `${productCount} product lines` },
      { key: 'vat', icon: '🧮', label: 'VAT on cargo', value: money(vatCollected), sub: `Rate ${input.settings.vat.rate}%` },
    );
  } else {
    kpis.push(
      { key: 'products', icon: '🧾', label: 'Products', value: String(input.materials.length), sub: `${new Set(input.materials.map(m => m.category)).size} categories` },
      { key: 'suppliers', icon: '🏢', label: 'Suppliers', value: String(input.companies.length), sub: `${cityCount} cities covered` },
      { key: 'categories', icon: '🗂️', label: 'Categories', value: String(new Set(input.materials.map(m => m.category)).size), sub: 'Across the marketplace' },
      { key: 'rating', icon: '⭐', label: 'Avg rating', value: `${avgRating.toFixed(1)}/5`, sub: `${input.reviews.length} reviews` },
      { key: 'cities', icon: '📍', label: 'Cities', value: String(cityCount), sub: 'Delivery coverage' },
      { key: 'reviews', icon: '💬', label: 'Reviews', value: String(input.reviews.length), sub: 'Buyer feedback on file' },
    );
  }

  // ---------- Narrative insights ----------
  const insights: string[] = [];
  if (role === 'guest') {
    insights.push(`The marketplace lists ${input.materials.length} products from ${input.companies.length} suppliers across ${cityCount} cities.`);
    insights.push(`Average catalogue rating is ${avgRating.toFixed(1)}/5 from ${input.reviews.length} buyer reviews.`);
    insights.push('Sign in to unlock your own orders, spending and forecasts.');
  } else {
    if (growthPct != null) {
      insights.push(`Revenue is ${growthPct >= 0 ? 'up' : 'down'} ${Math.abs(growthPct).toFixed(1)}% versus the previous ${days}-day period (${money(previousGmv)} → ${money(gmv)}).`);
    } else if (gmv > 0) {
      insights.push(`${periodLabel}: ${money(gmv)} across ${valid.length} orders, averaging ${money(avgOrderValue)} per order.`);
    } else {
      insights.push(`No sales are recorded for ${periodLabel.toLowerCase()} yet — the catalogue holds ${productCount} products worth ${money(stockValue)}.`);
    }

    if (category.data.length > 0 && category.data[0].value > 0) {
      const leader = category.data[0];
      const total = category.data.reduce((s, p) => s + p.value, 0);
      const share = total > 0 ? (leader.value / total) * 100 : 0;
      insights.push(
        category.basis === 'revenue'
          ? `${leader.label} leads demand with ${money(leader.value)} (${share.toFixed(0)}% of category sales).`
          : `${leader.label} is the largest category with ${leader.value} product${leader.value === 1 ? '' : 's'}.`
      );
    }

    if (topProducts.length > 0) {
      const hero = topProducts[0];
      insights.push(`${hero.name} is the top seller: ${hero.units} units for ${money(hero.revenue)} across ${hero.orders} orders.`);
    }

    if (activeList.length > 0) {
      insights.push(`${activeList.length} order${activeList.length === 1 ? '' : 's'} worth ${money(activeOrderValue)} ${activeList.length === 1 ? 'is' : 'are'} still in progress${role === 'company' || role === 'admin' ? ' — confirm or ship them to protect the delivery promise.' : '.'}`);
    }

    if ((role === 'company' || role === 'admin') && (lowStockCount > 0 || outOfStockCount > 0)) {
      insights.push(`${lowStockCount} product${lowStockCount === 1 ? '' : 's'} low on stock and ${outOfStockCount} out of stock — restock before the next demand wave.`);
    }

    if (gmv > 0) {
      insights.push(`Delivery adds ${money(deliveryFees)} (${((deliveryFees / gmv) * 100).toFixed(1)}% of order value) and VAT contributes ${money(vatCollected)}.`);
    }

    const rising = priceBoard.filter(p => p.forecast && p.forecast.trend === 'up');
    const falling = priceBoard.filter(p => p.forecast && p.forecast.trend === 'down');
    if (rising.length > 0) {
      insights.push(`Price forecast: ${rising[0].name} may rise ${Math.abs(rising[0].forecast!.changePct).toFixed(1)}% — consider buying or quoting early.`);
    } else if (falling.length > 0) {
      insights.push(`Price forecast: ${falling[0].name} may fall ${Math.abs(falling[0].forecast!.changePct).toFixed(1)}% — a later order could cost less.`);
    }

    if (role === 'transporter') {
      insights.unshift(
        `${periodLabel}: ${money(transportEarningsTotal)} in transport earnings across ${valid.length} delivery job${valid.length === 1 ? '' : 's'} (avg ${money(transportAvgFee)}).`
      );
      if (activeList.length > 0) {
        insights.push(`${activeList.length} trip${activeList.length === 1 ? '' : 's'} worth ${money(transportActiveValue)} still need dispatch or proof of delivery.`);
      }
      if (topSuppliers.length > 0) {
        insights.push(`Most of your work originates from ${topSuppliers[0].name} in ${topSuppliers[0].city} (${topSuppliers[0].orders} jobs).`);
      }
    }
    if (role === 'company' && topCustomers.length > 0) {
      insights.push(`${topCustomers[0].name || 'Your top buyer'} is your largest buyer with ${money(topCustomers[0].spend)} across ${topCustomers[0].orders} orders.`);
    }
    if (role === 'customer' && topSuppliers.length > 0) {
      insights.push(`You buy most from ${topSuppliers[0].name} (${topSuppliers[0].orders} orders, ${money(topSuppliers[0].revenue)}).`);
    }
  }

  const scopeLabel = role === 'admin'
    ? 'Platform-wide'
    : role === 'company'
      ? (company?.name || 'Your supplier account')
      : role === 'customer'
        ? 'Your buyer account'
        : role === 'transporter'
          ? 'Your transport operation'
          : 'Public marketplace';

  return {
    role,
    scopeLabel,
    days,
    periodLabel,
    generatedAt: now,
    orderCount: periodOrders.length,
    unitsSold,
    gmv: Math.round(gmv * 100) / 100,
    deliveredRevenue: Math.round(deliveredRevenue * 100) / 100,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    activeOrders: activeList.length,
    activeOrderValue: Math.round(activeOrderValue * 100) / 100,
    deliveredOrders: deliveredOrders.length,
    cancelledOrders,
    deliveredRatePct,
    deliveryFees: Math.round(deliveryFees * 100) / 100,
    vatCollected: Math.round(vatCollected * 100) / 100,
    growthPct,
    productCount,
    supplierCount,
    customerCount,
    cityCount,
    reviewCount: scopedReviewList.length,
    avgRating,
    stockUnits,
    stockValue: Math.round(stockValue * 100) / 100,
    lowStockCount,
    outOfStockCount,
    monthlyRevenue: monthly.revenue,
    monthlyOrders: monthly.orders,
    statuses,
    categoryData: category.data,
    categoryBasis: category.basis,
    cityData: city.data,
    cityBasis: city.basis,
    topProducts,
    topSuppliers,
    topCustomers,
    priceBoard,
    kpis,
    insights: insights.slice(0, 7),
  };
};
