// ===== src/lib/copilot.ts =====
// E-SCON Copilot — an on-device analytics assistant.
//
// The assistant is deterministic and privacy-first: it reads the same records
// the dashboards use, ranks the numbers with the analytics engine, and answers
// a question with a short narrative, headline metrics, bullets and an optional
// chart. No prompt or business record ever leaves the device, so it also works
// offline inside the Android WebView.
import {
  AnalyticsInput,
  AnalyticsRole,
  AnalyticsResult,
  buildAnalytics,
  scopedOrders,
  scopedMaterials,
} from './analytics';
import { formatCurrency } from '../utils';

export interface CopilotMetric {
  label: string;
  value: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
}

export interface CopilotChartPoint {
  label: string;
  value: number;
}

export interface CopilotAnswer {
  title: string;
  summary: string;
  bullets: string[];
  metrics?: CopilotMetric[];
  chart?: CopilotChartPoint[];
  chartLabel?: string;
  followUps?: string[];
}

const money = (value: number): string => formatCurrency(Math.round(value * 100) / 100);
const pct = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

const roleName = (role: AnalyticsRole): string =>
  role === 'admin' ? 'platform administrator'
    : role === 'company' ? 'supplier'
      : role === 'customer' ? 'buyer'
        : 'marketplace visitor';

export const copilotSuggestions = (role: AnalyticsRole): string[] => {
  if (role === 'admin') {
    return [
      'Give me an executive summary',
      'Which category leads revenue?',
      'How are orders and deliveries performing?',
      'Show price forecasts',
      'Which supplier is strongest?',
      'What should I improve next?',
    ];
  }
  if (role === 'company') {
    return [
      'Give me an executive summary',
      'What are my top-selling products?',
      'What should I restock?',
      'Who are my best customers?',
      'How is delivery priced?',
      'Show price forecasts',
    ];
  }
  if (role === 'customer') {
    return [
      'How much have I spent?',
      'What did I order most?',
      'Which supplier do I buy from most?',
      'Show my active orders',
      'Find the best-rated supplier',
      'What should I buy next?',
    ];
  }
  return [
    'What products are trending?',
    'Which categories are biggest?',
    'Who are the top suppliers?',
    'What is the average price level?',
    'How many reviews are there?',
    'What can you do?',
  ];
};

const trendText = (a: AnalyticsResult): string => {
  if (a.days > 0 && a.growthPct != null) {
    return `Revenue is ${a.growthPct >= 0 ? 'up' : 'down'} ${Math.abs(a.growthPct).toFixed(1)}% versus the previous ${a.days}-day period.`;
  }
  if (a.gmv > 0) {
    return `${a.periodLabel} revenue is ${money(a.gmv)} from ${a.deliveredOrders + a.activeOrders + a.cancelledOrders} orders.`;
  }
  return `No sales are recorded for ${a.periodLabel.toLowerCase()} yet.`;
};

const kpiMetrics = (a: AnalyticsResult): CopilotMetric[] => {
  if (a.role === 'admin') {
    return [
      { label: 'Gross revenue', value: money(a.gmv), tone: a.growthPct != null && a.growthPct < 0 ? 'bad' : 'good' },
      { label: 'Orders', value: String(a.orderCount) },
      { label: 'Active', value: String(a.activeOrders), tone: a.activeOrders > 0 ? 'warn' : 'good' },
      { label: 'Delivered rate', value: `${a.deliveredRatePct.toFixed(0)}%`, tone: a.deliveredRatePct >= 70 ? 'good' : 'warn' },
    ];
  }
  if (a.role === 'company') {
    return [
      { label: 'Revenue', value: money(a.gmv), tone: a.growthPct != null && a.growthPct < 0 ? 'bad' : 'good' },
      { label: 'Orders', value: String(a.orderCount) },
      { label: 'Stock value', value: money(a.stockValue) },
      { label: 'Restock alerts', value: String(a.lowStockCount + a.outOfStockCount), tone: a.lowStockCount + a.outOfStockCount > 0 ? 'warn' : 'good' },
    ];
  }
  if (a.role === 'customer') {
    return [
      { label: 'Total spend', value: money(a.gmv) },
      { label: 'Orders', value: String(a.orderCount) },
      { label: 'Active', value: String(a.activeOrders), tone: a.activeOrders > 0 ? 'warn' : 'good' },
      { label: 'VAT paid', value: money(a.vatCollected) },
    ];
  }
  return [
    { label: 'Products', value: String(a.productCount) },
    { label: 'Suppliers', value: String(a.supplierCount) },
    { label: 'Cities', value: String(a.cityCount) },
    { label: 'Avg rating', value: `${a.avgRating.toFixed(1)}/5` },
  ];
};

const overviewAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const bullets = [...a.insights];
  if (bullets.length < 3) {
    bullets.push(`The catalogue covers ${a.productCount} products from ${a.supplierCount} suppliers in ${a.cityCount} cities.`);
  }
  return {
    title: a.role === 'guest' ? 'Marketplace snapshot' : 'Executive summary',
    summary: trendText(a),
    metrics: kpiMetrics(a),
    bullets: bullets.slice(0, 6),
    chart: a.monthlyRevenue,
    chartLabel: 'Revenue — last six months',
    followUps: copilotSuggestions(a.role).slice(0, 4),
  };
};

const revenueAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const bestMonth = [...a.monthlyRevenue].sort((x, y) => y.value - x.value)[0];
  const leader = a.categoryData[0];
  const hero = a.topProducts[0];
  const bullets: string[] = [];
  if (bestMonth && bestMonth.value > 0) bullets.push(`${bestMonth.label} is the strongest month at ${money(bestMonth.value)}.`);
  if (leader) bullets.push(`${leader.label} is the leading category at ${money(leader.value)}.`);
  if (hero) bullets.push(`${hero.name} contributes ${money(hero.revenue)} from ${hero.units} units.`);
  bullets.push(`Average order value is ${money(a.avgOrderValue)} across ${a.orderCount} orders.`);
  if (a.gmv > 0) bullets.push(`Delivery fees add ${((a.deliveryFees / a.gmv) * 100).toFixed(1)}% and VAT adds ${money(a.vatCollected)}.`);
  return {
    title: a.role === 'customer' ? 'Your spending trend' : 'Revenue intelligence',
    summary: a.role === 'guest'
      ? 'Sign in to see revenue, but the public catalogue already shows category and pricing signals.'
      : trendText(a),
    metrics: [
      { label: a.role === 'customer' ? 'Spend' : 'Revenue', value: money(a.gmv), tone: a.growthPct != null && a.growthPct < 0 ? 'bad' : 'good' },
      { label: 'Orders', value: String(a.orderCount) },
      { label: 'Avg order', value: money(a.avgOrderValue) },
      { label: 'Growth', value: a.growthPct == null ? '—' : pct(a.growthPct), tone: a.growthPct != null && a.growthPct < 0 ? 'bad' : 'good' },
    ],
    bullets: bullets.slice(0, 5),
    chart: a.monthlyRevenue,
    chartLabel: 'Revenue by month (ETB)',
    followUps: ['Which category leads revenue?', 'Show price forecasts', 'What should I improve next?', 'How are orders performing?'],
  };
};

const orderAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const bullets = a.statuses.map(slice => `${slice.label}: ${slice.value} order${slice.value === 1 ? '' : 's'}`);
  if (a.activeOrders > 0) {
    bullets.push(`${a.activeOrders} order${a.activeOrders === 1 ? '' : 's'} worth ${money(a.activeOrderValue)} are awaiting action.`);
  }
  bullets.push(`${a.deliveredOrders} of ${a.orderCount} orders are delivered (${a.deliveredRatePct.toFixed(0)}%).`);
  if (a.cancelledOrders > 0) bullets.push(`${a.cancelledOrders} order${a.cancelledOrders === 1 ? '' : 's'} cancelled — review the reasons before the next campaign.`);
  return {
    title: 'Order & delivery performance',
    summary: a.orderCount === 0
      ? 'No orders are recorded in this workspace yet. As soon as an order is placed the status pipeline appears here.'
      : `${a.orderCount} orders are on file, with ${a.activeOrders} still moving and ${a.deliveredOrders} completed.`,
    metrics: [
      { label: 'Orders', value: String(a.orderCount) },
      { label: 'Active', value: String(a.activeOrders), tone: a.activeOrders > 0 ? 'warn' : 'good' },
      { label: 'Delivered', value: String(a.deliveredOrders), tone: 'good' },
      { label: 'Delivered rate', value: `${a.deliveredRatePct.toFixed(0)}%` },
    ],
    bullets: bullets.slice(0, 6),
    chart: a.statuses.map(slice => ({ label: slice.label, value: slice.value })),
    chartLabel: 'Orders by status',
    followUps: ['What should I restock?', 'How is delivery priced?', 'Who are my best customers?', 'Give me an executive summary'],
  };
};

const stockAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  if (a.role === 'customer' || a.role === 'guest') {
    return {
      title: 'Stock is supplier-private',
      summary: 'Exact stock levels are only visible to suppliers and administrators. Buyers see availability on the product page instead.',
      metrics: [
        { label: 'Products', value: String(a.productCount) },
        { label: 'Suppliers', value: String(a.supplierCount) },
        { label: 'Categories', value: String(new Set(input.materials.map(m => m.category)).size) },
      ],
      bullets: [
        'Open a product to see its live availability badge.',
        'Use the supplier map to compare nearby sellers.',
        'Ask Copilot about price levels, ratings or categories instead.',
      ],
      followUps: ['What products are trending?', 'What is the average price level?', 'Who are the top suppliers?'],
    };
  }
  const own = scopedMaterials(input);
  const critical = own
    .filter(m => (m.quantity || 0) <= 10)
    .sort((x, y) => (x.quantity || 0) - (y.quantity || 0))
    .slice(0, 5);
  const categoryStock = new Map<string, number>();
  own.forEach(m => {
    const value = (m.quantity || 0) * (m.price || 0);
    categoryStock.set(m.category || 'Other', (categoryStock.get(m.category || 'Other') || 0) + value);
  });
  const bullets = critical.length > 0
    ? critical.map(m => `${m.name}: ${m.quantity || 0} ${m.unit || 'units'} left — ${money((m.quantity || 0) * m.price)} value.`)
    : ['Every product currently has more than 10 units in stock.'];
  bullets.push(`${a.stockUnits} units on hand worth ${money(a.stockValue)}.`);
  bullets.push(`${a.lowStockCount} low-stock and ${a.outOfStockCount} out-of-stock product${a.lowStockCount + a.outOfStockCount === 1 ? '' : 's'} need attention.`);
  return {
    title: 'Inventory health & restock plan',
    summary: critical.length > 0
      ? `${critical.length} product${critical.length === 1 ? '' : 's'} are at or below the 10-unit restock line.`
      : 'Stock levels look healthy across the catalogue.',
    metrics: [
      { label: 'Units on hand', value: String(a.stockUnits) },
      { label: 'Stock value', value: money(a.stockValue) },
      { label: 'Low stock', value: String(a.lowStockCount), tone: a.lowStockCount > 0 ? 'warn' : 'good' },
      { label: 'Out of stock', value: String(a.outOfStockCount), tone: a.outOfStockCount > 0 ? 'bad' : 'good' },
    ],
    bullets: bullets.slice(0, 6),
    chart: Array.from(categoryStock.entries())
      .map(([label, value]) => ({ label, value: Math.round(value) }))
      .sort((x, y) => y.value - x.value)
      .slice(0, 6),
    chartLabel: 'Stock value by category (ETB)',
    followUps: ['What are my top-selling products?', 'Show price forecasts', 'Give me an executive summary'],
  };
};

const productAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const hero = a.topProducts[0];
  if (!hero) {
    return {
      title: 'No product sales yet',
      summary: 'There are no order-linked product figures for this workspace, so use the catalogue view to compare price and rating.',
      metrics: [
        { label: 'Products', value: String(a.productCount) },
        { label: 'Suppliers', value: String(a.supplierCount) },
        { label: 'Avg rating', value: `${a.avgRating.toFixed(1)}/5` },
      ],
      bullets: a.priceBoard.slice(0, 5).map(p => `${p.name} — ${money(p.price)} · ${p.category}`),
      chart: a.categoryData,
      chartLabel: a.categoryBasis === 'revenue' ? 'Category revenue' : 'Products per category',
      followUps: ['Which category leads revenue?', 'What should I restock?', 'Give me an executive summary'],
    };
  }
  const runnerUp = a.topProducts[1];
  const bullets = [
    `${hero.units} units sold across ${hero.orders} orders.`,
    `Supplier: ${hero.supplierName} · Category: ${hero.category}.`,
    `Current price ${money(hero.price)} · rating ${hero.rating.toFixed(1)}/5.`,
    runnerUp ? `Next best is ${runnerUp.name} at ${money(runnerUp.revenue)}.` : 'It is the only product with recorded sales.',
  ];
  return {
    title: 'Top-selling products',
    summary: `${hero.name} leads the catalogue at ${money(hero.revenue)} of goods revenue.`,
    metrics: [
      { label: 'Top product', value: hero.name },
      { label: 'Revenue', value: money(hero.revenue), tone: 'good' },
      { label: 'Units', value: String(hero.units) },
      { label: 'Orders', value: String(hero.orders) },
    ],
    bullets,
    chart: a.topProducts.map(p => ({ label: p.name, value: Math.round(p.revenue) })),
    chartLabel: 'Revenue by product (ETB)',
    followUps: ['What should I restock?', 'Show price forecasts', 'Which category leads revenue?', 'Who are my best customers?'],
  };
};

const supplierAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const hero = a.topSuppliers[0];
  if (!hero) {
    const proven = [...input.companies]
      .sort((x, y) => (y.rating || 0) - (x.rating || 0))
      .slice(0, 5);
    return {
      title: 'Supplier landscape',
      summary: `${input.companies.length} suppliers are on the marketplace; the best rated are shown below.`,
      metrics: [
        { label: 'Suppliers', value: String(input.companies.length) },
        { label: 'Cities', value: String(a.cityCount) },
        { label: 'Products', value: String(a.productCount) },
      ],
      bullets: proven.map(c => `${c.name} — ${c.city || '—'} · ${input.materials.filter(m => m.companyId === c.id).length} products · ⭐ ${(c.rating || 0).toFixed(1)}`),
      chart: a.cityData,
      chartLabel: a.cityBasis === 'orders' ? 'Order value by city' : 'Suppliers by city',
      followUps: ['What products are trending?', 'Which category is biggest?', 'What can you do?'],
    };
  }
  const bullets = [
    `${hero.orders} orders worth ${money(hero.revenue)}.`,
    `${hero.products} products listed from ${hero.city}.`,
    hero.rating > 0 ? `Marketplace rating ${hero.rating.toFixed(1)}/5.` : 'No supplier rating recorded yet.',
  ];
  const runnerUp = a.topSuppliers[1];
  if (runnerUp) bullets.push(`${runnerUp.name} follows with ${money(runnerUp.revenue)}.`);
  return {
    title: 'Supplier performance',
    summary: `${hero.name} is the strongest supplier by order value.`,
    metrics: [
      { label: 'Top supplier', value: hero.name },
      { label: 'Revenue', value: money(hero.revenue), tone: 'good' },
      { label: 'Orders', value: String(hero.orders) },
      { label: 'Products', value: String(hero.products) },
    ],
    bullets,
    chart: a.topSuppliers.map(s => ({ label: s.name, value: Math.round(s.revenue) })),
    chartLabel: 'Revenue by supplier (ETB)',
    followUps: ['What are my top-selling products?', 'How is delivery priced?', 'Which category leads revenue?'],
  };
};

const customerAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const hero = a.topCustomers[0];
  if (!hero) {
    return {
      title: 'Buyer activity',
      summary: 'Customer-level rankings appear for suppliers and administrators once orders exist.',
      metrics: [
        { label: 'Buyers', value: String(a.customerCount) },
        { label: 'Orders', value: String(a.orderCount) },
      ],
      bullets: [
        `${a.customerCount} registered buyer accounts.`,
        `${a.orderCount} orders placed in this workspace.`,
        'Place a test order to activate buyer analytics.',
      ],
      followUps: ['How are orders performing?', 'Give me an executive summary'],
    };
  }
  return {
    title: 'Best customers',
    summary: `${hero.name || 'Your top buyer'} is the highest-value customer at ${money(hero.spend)}.`,
    metrics: [
      { label: 'Top buyer', value: hero.name },
      { label: 'Spend', value: money(hero.spend), tone: 'good' },
      { label: 'Orders', value: String(hero.orders) },
      { label: 'Buyers', value: String(a.customerCount) },
    ],
    bullets: [
      `${hero.name} placed ${hero.orders} orders from ${hero.city}.`,
      `Average spend per buyer is ${money(a.customerCount > 0 ? a.gmv / a.customerCount : 0)}.`,
      a.topCustomers[1] ? `${a.topCustomers[1].name} follows with ${money(a.topCustomers[1].spend)}.` : 'No second buyer to rank yet.',
      'Reward repeat buyers with delivery offers or volume pricing.',
    ],
    chart: a.topCustomers.map(c => ({ label: c.name, value: Math.round(c.spend) })),
    chartLabel: 'Spend by customer (ETB)',
    followUps: ['What are my top-selling products?', 'Which category leads revenue?', 'What should I improve next?'],
  };
};

const priceAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const rising = a.priceBoard.filter(p => p.forecast && p.forecast.trend === 'up');
  const falling = a.priceBoard.filter(p => p.forecast && p.forecast.trend === 'down');
  const cheapest = [...input.materials].sort((x, y) => x.price - y.price)[0];
  const priciest = [...input.materials].sort((x, y) => y.price - x.price)[0];
  const bullets = a.priceBoard.slice(0, 5).map(p => {
    const f = p.forecast;
    const outlook = f ? `${f.trend === 'flat' ? 'stable' : `${f.trend} ${Math.abs(f.changePct).toFixed(1)}%`}` : 'tracking';
    return `${p.name}: ${money(p.price)} — ${outlook}${p.marginPct > 0 ? ` · margin ${p.marginPct.toFixed(0)}%` : ''}`;
  });
  if (rising.length > 0) bullets.push(`${rising.length} product${rising.length === 1 ? '' : 's'} trending up; ${rising[0].name} could rise ${Math.abs(rising[0].forecast!.changePct).toFixed(1)}%.`);
  if (falling.length > 0) bullets.push(`${falling.length} product${falling.length === 1 ? '' : 's'} trending down; ${falling[0].name} could fall ${Math.abs(falling[0].forecast!.changePct).toFixed(1)}%.`);
  if (cheapest && priciest) bullets.push(`Catalogue range: ${money(cheapest.price)} (${cheapest.name}) to ${money(priciest.price)} (${priciest.name}).`);
  return {
    title: 'Price intelligence & forecast',
    summary: `${a.priceBoard.length} products are tracked for price movement using their recorded price history.`,
    metrics: [
      { label: 'Products tracked', value: String(a.priceBoard.length) },
      { label: 'Rising', value: String(rising.length), tone: rising.length > 0 ? 'warn' : 'neutral' },
      { label: 'Falling', value: String(falling.length), tone: falling.length > 0 ? 'good' : 'neutral' },
      { label: 'Avg rating', value: `${a.avgRating.toFixed(1)}/5` },
    ],
    bullets: bullets.slice(0, 6),
    chart: a.priceBoard.map(p => ({ label: p.name, value: Math.round(p.price) })),
    chartLabel: 'Selling price (ETB)',
    followUps: ['Which category leads revenue?', 'What should I restock?', 'Give me an executive summary'],
  };
};

const categoryAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const leader = a.categoryData[0];
  const total = a.categoryData.reduce((sum, point) => sum + point.value, 0);
  const share = leader && total > 0 ? (leader.value / total) * 100 : 0;
  const bullets = a.categoryData.slice(0, 5).map((point, index) =>
    `${index + 1}. ${point.label}: ${a.categoryBasis === 'revenue' ? money(point.value) : `${point.value} products`}`
  );
  if (a.categoryData.length > 1) {
    bullets.push(`${a.categoryData.length} categories have activity; ${leader?.label || 'the leader'} holds ${share.toFixed(0)}% of the total.`);
  }
  return {
    title: 'Category performance',
    summary: leader
      ? `${leader.label} is the leading category ${a.categoryBasis === 'revenue' ? `with ${money(leader.value)} (${share.toFixed(0)}%)` : `with ${leader.value} products`}.`
      : 'No category data is available yet.',
    metrics: [
      { label: 'Leading category', value: leader?.label || '—' },
      { label: 'Share', value: `${share.toFixed(0)}%` },
      { label: 'Categories', value: String(a.categoryData.length) },
      { label: 'Basis', value: a.categoryBasis === 'revenue' ? 'Sales' : 'Catalogue' },
    ],
    bullets: bullets.slice(0, 6),
    chart: a.categoryData,
    chartLabel: a.categoryBasis === 'revenue' ? 'Revenue by category (ETB)' : 'Products per category',
    followUps: ['What are my top-selling products?', 'Show price forecasts', 'What should I improve next?'],
  };
};

const logisticsAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const orders = scopedOrders(input);
  const withDelivery = orders.filter(o => o.deliveryIncluded).length;
  const city = a.cityData[0];
  const share = a.gmv > 0 ? (a.deliveryFees / a.gmv) * 100 : 0;
  return {
    title: 'Delivery & logistics',
    summary: a.deliveryFees > 0
      ? `Delivery contributes ${money(a.deliveryFees)} (${share.toFixed(1)}% of order value) across the recorded orders.`
      : 'No delivery fees have been recorded yet; orders either use supplier delivery at zero fee or were placed without delivery.',
    metrics: [
      { label: 'Delivery fees', value: money(a.deliveryFees) },
      { label: 'Share of GMV', value: `${share.toFixed(1)}%` },
      { label: 'Avg per order', value: money(a.orderCount > 0 ? a.deliveryFees / a.orderCount : 0) },
      { label: 'With delivery', value: `${withDelivery}/${orders.length}` },
    ],
    bullets: [
      `Platform rules: ${input.settings.delivery.mode === 'fixed' ? `fixed ${money(input.settings.delivery.fixedFee)} fee` : `${money(input.settings.delivery.distanceBaseFee)} base + ${money(input.settings.delivery.distancePerKmPerTon)}/km/tonne`}.`,
      input.settings.delivery.freeDeliveryThreshold > 0 ? `Free delivery above ${money(input.settings.delivery.freeDeliveryThreshold)}.` : 'Free-delivery threshold is currently off.',
      `${input.settings.delivery.zones.length} delivery zones are configured.`,
      city ? `${city.label} is the biggest ${a.cityBasis === 'orders' ? 'demand city' : 'supplier city'} (${a.cityBasis === 'orders' ? money(city.value) : `${city.value} suppliers`}).` : 'No city data yet.',
      'Suppliers can publish their own per-km rate, which overrides platform delivery pricing.',
    ],
    chart: a.cityData,
    chartLabel: a.cityBasis === 'orders' ? 'Order value by city' : 'Suppliers by city',
    followUps: ['How are orders performing?', 'What should I improve next?', 'Give me an executive summary'],
  };
};

const taxAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const share = a.gmv > 0 ? (a.vatCollected / a.gmv) * 100 : 0;
  return {
    title: 'VAT position',
    summary: `VAT is added once on the net goods subtotal at checkout — ${money(a.vatCollected)} on ${money(a.gmv)} of order value in this workspace.`,
    metrics: [
      { label: 'VAT collected', value: money(a.vatCollected) },
      { label: 'VAT rate', value: `${input.settings.vat.rate}%` },
      { label: 'Share of GMV', value: `${share.toFixed(1)}%` },
      { label: 'VAT enabled', value: input.settings.vat.enabled ? 'Yes' : 'No' },
    ],
    bullets: [
      'Product prices stay VAT-exclusive; VAT is calculated on the whole cart subtotal.',
      'The proforma and the placed order use the same VAT rate and amount.',
      'Suppliers can store their VAT registration number on the company profile.',
      input.settings.vat.enabled ? `At ${input.settings.vat.rate}%, every ${money(10000)} of goods carries ${money(10000 * input.settings.vat.rate / 100)} VAT.` : 'VAT is currently switched off for the platform.',
    ],
    followUps: ['Give me an executive summary', 'How is delivery priced?', 'Which category leads revenue?'],
  };
};

const paymentAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const orders = scopedOrders(input);
  const paid = orders.filter(o => o.paymentStatus === 'paid');
  const pending = orders.filter(o => o.paymentStatus === 'pending');
  const failed = orders.filter(o => o.paymentStatus === 'failed');
  const refunded = orders.filter(o => o.paymentStatus === 'refunded');
  const methods = new Map<string, number>();
  orders.forEach(o => methods.set(o.paymentMethod || 'Unknown', (methods.get(o.paymentMethod || 'Unknown') || 0) + 1));
  return {
    title: 'Payment health',
    summary: `${paid.length} of ${orders.length} orders are marked paid; ${pending.length} are still waiting for settlement.`,
    metrics: [
      { label: 'Paid', value: String(paid.length), tone: 'good' },
      { label: 'Pending', value: String(pending.length), tone: pending.length > 0 ? 'warn' : 'good' },
      { label: 'Failed', value: String(failed.length), tone: failed.length > 0 ? 'bad' : 'good' },
      { label: 'Refunded', value: String(refunded.length) },
    ],
    bullets: [
      ...Array.from(methods.entries()).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([method, count]) => `${method}: ${count} order${count === 1 ? '' : 's'}`),
      `Paid order value is ${money(paid.reduce((sum, o) => sum + (o.totalAmount || 0), 0))}.`,
      `Outstanding value on pending payments is ${money(pending.reduce((sum, o) => sum + (o.totalAmount || 0), 0))}.`,
      'Wallet payments settle instantly; suppliers are credited after delivery.',
    ],
    chart: Array.from(methods.entries()).map(([label, value]) => ({ label, value })),
    chartLabel: 'Orders by payment method',
    followUps: ['How are orders performing?', 'Give me an executive summary'],
  };
};

const reviewAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const scopedReviews = a.role === 'company'
    ? input.reviews.filter(r => scopedMaterials(input).some(m => m.id === r.materialId))
    : a.role === 'customer'
      ? input.reviews.filter(r => r.userId === input.user!.id)
      : input.reviews;
  const avg = scopedReviews.length > 0
    ? scopedReviews.reduce((sum, r) => sum + r.rating, 0) / scopedReviews.length
    : 0;
  return {
    title: 'Ratings & buyer feedback',
    summary: `${scopedReviews.length} review${scopedReviews.length === 1 ? '' : 's'} on file with an average of ${avg.toFixed(1)}/5.`,
    metrics: [
      { label: 'Reviews', value: String(scopedReviews.length) },
      { label: 'Average', value: `${avg.toFixed(1)}/5`, tone: avg >= 4 ? 'good' : avg > 0 ? 'warn' : 'neutral' },
      { label: 'Catalogue rating', value: `${a.avgRating.toFixed(1)}/5` },
      { label: 'Products', value: String(a.productCount) },
    ],
    bullets: scopedReviews.slice(0, 4).map(r => `⭐ ${r.rating}/5 — ${r.comment || 'No comment'} (${r.userName || 'Buyer'})`),
    chart: a.topProducts.slice(0, 6).map(p => ({ label: p.name, value: Math.round(p.rating * 10) / 10 })),
    chartLabel: 'Product ratings (out of 5)',
    followUps: ['What are my top-selling products?', 'Give me an executive summary'],
  };
};

const growthAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const months = a.monthlyRevenue;
  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];
  const delta = lastMonth && lastMonth.value > 0 && thisMonth
    ? ((thisMonth.value - lastMonth.value) / lastMonth.value) * 100
    : null;
  const rising = a.priceBoard.filter(p => p.forecast && p.forecast.trend === 'up');
  return {
    title: 'Growth outlook',
    summary: delta == null
      ? 'Not enough monthly history for a month-on-month comparison yet; the six-month chart below shows the shape of demand.'
      : `This month is ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)}% versus last month.`,
    metrics: [
      { label: 'This month', value: money(thisMonth?.value || 0), tone: delta != null && delta < 0 ? 'bad' : 'good' },
      { label: 'Last month', value: money(lastMonth?.value || 0) },
      { label: 'MoM', value: delta == null ? '—' : pct(delta), tone: delta != null && delta < 0 ? 'bad' : 'good' },
      { label: 'Rising prices', value: String(rising.length), tone: rising.length > 0 ? 'warn' : 'neutral' },
    ],
    bullets: [
      ...months.slice(-3).map(m => `${m.label}: ${money(m.value)}`),
      rising.length > 0 ? `${rising[0].name} has the strongest upward price signal (${pct(rising[0].forecast!.changePct)}).` : 'No strong upward price signal detected.',
      'Use the Analytics page to switch periods and compare trends.',
    ],
    chart: months,
    chartLabel: 'Revenue by month (ETB)',
    followUps: ['Which category leads revenue?', 'Show price forecasts', 'What should I improve next?'],
  };
};

const recommendationAnswer = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const recommendations: string[] = [];
  if (a.role === 'company' || a.role === 'admin') {
    if (a.activeOrders > 0) recommendations.push(`Clear the ${a.activeOrders} active order${a.activeOrders === 1 ? '' : 's'} worth ${money(a.activeOrderValue)} — fast fulfilment lifts repeat purchases.`);
    if (a.lowStockCount + a.outOfStockCount > 0) recommendations.push(`Restock ${a.lowStockCount + a.outOfStockCount} at-risk product${a.lowStockCount + a.outOfStockCount === 1 ? '' : 's'} before demand outruns supply.`);
    if (a.categoryData[0]) recommendations.push(`Double down on ${a.categoryData[0].label}, the current demand leader.`);
    if (a.topProducts[0]) recommendations.push(`Protect ${a.topProducts[0].name} availability and feature it on the marketplace.`);
    if (a.deliveryFees > 0 && a.gmv > 0) recommendations.push(`Delivery is ${((a.deliveryFees / a.gmv) * 100).toFixed(1)}% of order value — review rates or bundle free delivery above a threshold.`);
  } else if (a.role === 'customer') {
    recommendations.push('Compare at least two suppliers before ordering to keep the delivered price low.');
    if (a.topSuppliers[0]) recommendations.push(`You buy most from ${a.topSuppliers[0].name}; ask for a volume price on repeat items.`);
    recommendations.push('Save products to your watchlist so price moves are easy to track.');
    recommendations.push('Use the supplier map to confirm the road distance before checkout.');
  } else {
    recommendations.push('Create an account to unlock spending history and AI recommendations.');
    recommendations.push('Use the marketplace category filters to compare verified suppliers.');
    recommendations.push('Check the supplier map to find the closest seller and cut delivery cost.');
  }
  return {
    title: 'Recommended next actions',
    summary: a.role === 'guest' ? 'Here is how to get the most from E-SCON.' : 'Prioritised actions derived from your live figures.',
    metrics: kpiMetrics(a),
    bullets: recommendations.slice(0, 6),
    chart: a.categoryData,
    chartLabel: a.categoryBasis === 'revenue' ? 'Revenue by category (ETB)' : 'Products per category',
    followUps: ['Give me an executive summary', 'How are orders performing?', 'Show price forecasts'],
  };
};

const helpAnswer = (): CopilotAnswer => ({
  title: 'What Copilot can answer',
  summary: 'I read the live E-SCON records on this device and turn them into plain-language answers. Try any of the questions below.',
  bullets: [
    'Revenue, spend and growth trends (six-month chart).',
    'Order status, delivery performance and payment health.',
    'Top products, suppliers and customers.',
    'Stock, restock alerts and inventory value.',
    'Price levels, margins and forecast direction.',
    'VAT, delivery pricing, categories and buyer feedback.',
  ],
  followUps: ['Give me an executive summary', 'What are my top-selling products?', 'What should I restock?', 'Show price forecasts'],
});

const findNamed = (input: AnalyticsInput, question: string): { product?: string; supplier?: string } => {
  const q = question.toLowerCase();
  const product = [...input.materials]
    .sort((a, b) => b.name.length - a.name.length)
    .find(m => m.name.length >= 3 && q.includes(m.name.toLowerCase()));
  const supplier = [...input.companies]
    .sort((a, b) => b.name.length - a.name.length)
    .find(c => c.name.length >= 3 && q.includes(c.name.toLowerCase()));
  return { product: product?.name, supplier: supplier?.name };
};

const namedProductAnswer = (input: AnalyticsInput, name: string): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const material = input.materials.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (!material) return productAnswer(input);
  const sales = a.topProducts.find(p => p.id === material.id);
  const forecast = a.priceBoard.find(p => p.id === material.id)?.forecast || null;
  const bullets = [
    `${material.category} · listed by ${input.companies.find(c => c.id === material.companyId)?.name || 'a supplier'}.`,
    `Price ${money(material.price)} per ${material.unit || 'unit'}.`,
    sales ? `${sales.units} units sold for ${money(sales.revenue)} across ${sales.orders} orders.` : 'No sales recorded in this workspace yet.',
    `Rating ${sales?.rating?.toFixed(1) || (material.rating || 0).toFixed(1)}/5.`,
    forecast ? `Forecast: ${forecast.trend === 'flat' ? 'stable' : `${forecast.trend} ${Math.abs(forecast.changePct).toFixed(1)}%`}.` : 'Not enough price history for a forecast.',
  ];
  return {
    title: material.name,
    summary: `${material.name} is a ${material.category} product at ${money(material.price)} per ${material.unit || 'unit'}.`,
    metrics: [
      { label: 'Price', value: money(material.price) },
      { label: 'Units sold', value: String(sales?.units || 0) },
      { label: 'Revenue', value: money(sales?.revenue || 0), tone: (sales?.revenue || 0) > 0 ? 'good' : 'neutral' },
      { label: 'Rating', value: `${(sales?.rating || material.rating || 0).toFixed(1)}/5` },
    ],
    bullets,
    chart: (material.priceHistory || []).slice(-8).map(point => ({
      label: new Date(point.date).toLocaleDateString('en', { month: 'short' }),
      value: Math.round(point.price),
    })),
    chartLabel: cartChartLabel(material.priceHistory),
    followUps: ['Show price forecasts', 'What should I restock?', 'Who are the best suppliers?'],
  };
};

const cartChartLabel = (history: unknown): string =>
  Array.isArray(history) && history.length > 0 ? 'Price history (ETB)' : 'Live product context';

const namedSupplierAnswer = (input: AnalyticsInput, name: string): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const company = input.companies.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!company) return supplierAnswer(input);
  const row = a.topSuppliers.find(s => s.id === company.id);
  const products = input.materials.filter(m => m.companyId === company.id);
  return {
    title: company.name,
    summary: `${company.name} is a verified ${company.city || 'Ethiopian'} supplier with ${products.length} products.`,
    metrics: [
      { label: 'Revenue', value: money(row?.revenue || 0), tone: (row?.revenue || 0) > 0 ? 'good' : 'neutral' },
      { label: 'Orders', value: String(row?.orders || 0) },
      { label: 'Products', value: String(products.length) },
      { label: 'Rating', value: `${(company.rating || 0).toFixed(1)}/5` },
    ],
    bullets: [
      `Location: ${company.location || company.city || '—'}.`,
      `Compliance: ${company.complianceStatus || 'pending'}.`,
      `Top products: ${products.slice(0, 3).map(p => p.name).join(', ') || 'none yet'}.`,
      company.workingHours ? `Working hours: ${company.workingHours}.` : 'Working hours are not published.',
    ],
    chart: products.slice(0, 6).map(p => ({ label: p.name, value: Math.round(p.price) })),
    chartLabel: 'Product prices (ETB)',
    followUps: ['Which supplier is strongest?', 'What are my top-selling products?', 'Which category leads revenue?'],
  };
};

/**
 * Answer one natural-language question from the live data.
 * The matching is intentionally forgiving: keyword families cover the common
 * business questions, and a product/supplier name always wins over a keyword.
 */
export const answerQuestion = (question: string, input: AnalyticsInput): CopilotAnswer => {
  const q = question.trim().toLowerCase();
  if (!q) return overviewAnswer(input);
  if (q.includes('help') || q.includes('what can you') || q.includes('what do you do') || q.includes('capabilit')) {
    return helpAnswer();
  }

  const named = findNamed(input, question);
  if (named.product) return namedProductAnswer(input, named.product);
  if (named.supplier) return namedSupplierAnswer(input, named.supplier);

  if (/(revenue|sales|turnover|income|gmv|earn|spend|spent|turnover)/.test(q)) return revenueAnswer(input);
  if (/(order|deliver|ship|status|pending|confirm|cancel)/.test(q)) return orderAnswer(input);
  if (/(stock|inventory|restock|warehouse|out of stock|low stock)/.test(q)) return stockAnswer(input);
  if (/(price|forecast|cost|trend|expensive|cheap|margin)/.test(q)) return priceAnswer(input);
  if (/(product|item|best.?sell|top.?sell|catalog)/.test(q)) return productAnswer(input);
  if (/(supplier|vendor|seller|company|store|shop)/.test(q)) return supplierAnswer(input);
  if (/(customer|buyer|client|spend)/.test(q)) return customerAnswer(input);
  if (/(category|department|sector|segment)/.test(q)) return categoryAnswer(input);
  if (/(delivery|transport|logistic|fee|route|distance|city)/.test(q)) return logisticsAnswer(input);
  if (/(vat|tax)/.test(q)) return taxAnswer(input);
  if (/(wallet|payment|paid|unpaid|refund|failed)/.test(q)) return paymentAnswer(input);
  if (/(rating|review|feedback|satisfaction)/.test(q)) return reviewAnswer(input);
  if (/(growth|grow|next month|predict|outlook|future)/.test(q)) return growthAnswer(input);
  if (/(recommend|advice|improve|increase|strategy|optimis|optimiz|what should)/.test(q)) return recommendationAnswer(input);
  if (/(summary|overview|executive|snapshot|hello|hi\b|hey|report)/.test(q)) return overviewAnswer(input);

  return {
    ...overviewAnswer(input),
    title: 'Here is what I found',
    summary: `I could not match "${question.trim()}" to a specific report, so here is the current executive snapshot. ${trendText(buildAnalytics({ ...input, days: 0 }))}`,
    followUps: ['What can you do?', ...copilotSuggestions(buildAnalytics({ ...input, days: 0 }).role).slice(0, 3)],
  };
};

/** A short, role-aware opening message for the chat. */
export const copilotGreeting = (input: AnalyticsInput): CopilotAnswer => {
  const a = buildAnalytics({ ...input, days: 0 });
  const name = input.user?.name?.trim().split(/\s+/)[0];
  return {
    ...overviewAnswer(input),
    title: name ? `Hello ${name} — here is your snapshot` : 'Hello — ask me about the marketplace',
    summary: a.role === 'guest'
      ? `I can analyse the public catalogue of ${a.productCount} products from ${a.supplierCount} suppliers. Sign in for revenue and order intelligence.`
      : `${trendText(a)} I am grounded in this device's live E-SCON data — ${a.productCount} products, ${a.supplierCount} suppliers and ${a.orderCount} orders.`,
    bullets: a.insights.slice(0, 4),
    followUps: copilotSuggestions(a.role).slice(0, 4),
  };
};

/** Human label for the role chip in the Copilot sidebar. */
export const copilotRoleLabel = (role: AnalyticsRole): string => roleName(role);
