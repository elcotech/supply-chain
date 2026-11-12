import { Company, Material, Order, ProductReview, User } from '../types';
import { DEFAULT_SETTINGS } from '../settings';
import { AnalyticsInput, analyticsRole, buildAnalytics } from './analytics';
import { answerQuestion, copilotGreeting, copilotSuggestions } from './copilot';

const makeUser = (overrides: Partial<User>): User => ({
  id: 'u1',
  name: 'Test User',
  email: 'test@escon.et',
  password: '0909',
  phone: '0900000000',
  address: 'Bole',
  city: 'Addis Ababa',
  userType: 'customer',
  lat: 9.03,
  lng: 38.74,
  registered: new Date().toISOString(),
  loginAttempts: 0,
  lockUntil: 0,
  tinNumber: '',
  businessLicense: '',
  vatRegistered: false,
  vatNumber: '',
  ...overrides,
});

const makeCompany = (overrides: Partial<Company>): Company => ({
  id: 'c1',
  userId: 'supplier-1',
  name: 'Supplier One',
  description: '',
  location: 'Bole',
  city: 'Addis Ababa',
  lat: 9.03,
  lng: 38.74,
  rating: 4.5,
  totalOrders: 0,
  established: '2020',
  tinNumber: '',
  businessLicense: '',
  vatNumber: '',
  tradeLicenseExpiry: '',
  complianceStatus: 'compliant',
  ...overrides,
});

const makeMaterial = (overrides: Partial<Material>): Material => ({
  id: 'm1',
  companyId: 'c1',
  name: 'Cement',
  category: 'Construction',
  basePrice: 80,
  profitMargin: 25,
  price: 100,
  quantity: 5,
  unit: 'bag',
  minOrder: 1,
  description: '',
  transportCost: 0,
  rating: 4,
  images: [],
  taxIncluded: false,
  vatPercentage: 15,
  lastUpdated: new Date().toISOString(),
  ...overrides,
});

const makeOrder = (overrides: Partial<Order>): Order => ({
  id: 'o1',
  customerId: 'buyer-1',
  companyId: 'c1',
  materialId: 'm1',
  quantity: 10,
  unitPrice: 100,
  transportCost: 0,
  totalAmount: 1000,
  status: 'delivered',
  orderDate: new Date().toISOString(),
  address: 'Bole',
  invoiceNumber: 'INV-1',
  taxAmount: 0,
  vatAmount: 0,
  paymentMethod: 'cash',
  paymentStatus: 'paid',
  ...overrides,
});

const daysAgo = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const admin = makeUser({ id: 'admin-1', name: 'Admin', userType: 'admin' });
const supplierUser = makeUser({
  id: 'supplier-1',
  name: 'Supplier User',
  userType: 'company',
  companyName: 'Supplier One',
});
const buyer = makeUser({
  id: 'buyer-1',
  name: 'Buyer One',
  userType: 'customer',
});

const c1 = makeCompany({ id: 'c1', userId: 'supplier-1', name: 'Supplier One' });
const c2 = makeCompany({
  id: 'c2',
  userId: 'supplier-2',
  name: 'Supplier Two',
  city: 'Adama',
});

const materials: Material[] = [
  makeMaterial({ id: 'm1', companyId: 'c1', name: 'Cement', price: 100, quantity: 5 }),
  makeMaterial({
    id: 'm2',
    companyId: 'c2',
    name: 'Steel',
    price: 200,
    quantity: 50,
    category: 'Construction',
  }),
];

const orders: Order[] = [
  makeOrder({ id: 'o1', totalAmount: 1000, quantity: 10, orderDate: daysAgo(2) }),
  makeOrder({ id: 'o2', totalAmount: 500, quantity: 5, status: 'pending', orderDate: daysAgo(40) }),
  makeOrder({
    id: 'o3',
    companyId: 'c2',
    materialId: 'm2',
    totalAmount: 300,
    quantity: 3,
    status: 'cancelled',
    orderDate: daysAgo(10),
  }),
  makeOrder({
    id: 'o4',
    customerId: 'buyer-2',
    companyId: 'c2',
    materialId: 'm2',
    totalAmount: 2000,
    quantity: 20,
    orderDate: daysAgo(1),
  }),
];

const reviews: ProductReview[] = [
  {
    id: 'r1',
    materialId: 'm1',
    userId: 'buyer-1',
    userName: 'Buyer One',
    rating: 5,
    comment: 'Good',
    date: Date.now(),
  },
];

const inputFor = (user: User | null, days?: number): AnalyticsInput => ({
  user,
  materials,
  companies: [c1, c2],
  orders,
  users: [admin, supplierUser, buyer, makeUser({ id: 'buyer-2', name: 'Buyer Two' })],
  reviews,
  settings: DEFAULT_SETTINGS,
  days,
});

describe('analytics role scoping', () => {
  it('maps accounts to the correct analytics role', () => {
    expect(analyticsRole(admin)).toBe('admin');
    expect(analyticsRole(supplierUser)).toBe('company');
    expect(analyticsRole(buyer)).toBe('customer');
    expect(analyticsRole(null)).toBe('guest');
  });

  it('gives admins every order and excludes cancelled money', () => {
    const result = buildAnalytics(inputFor(admin));
    expect(result.role).toBe('admin');
    expect(result.orderCount).toBe(4);
    expect(result.gmv).toBe(3500);
    expect(result.unitsSold).toBe(35);
    expect(result.deliveredOrders).toBe(2);
    expect(result.activeOrders).toBe(1);
    expect(result.cancelledOrders).toBe(1);
    expect(result.productCount).toBe(2);
    expect(result.supplierCount).toBe(2);
    expect(result.lowStockCount).toBe(1);
    expect(result.statuses.map(slice => slice.label)).toContain('Cancelled');
  });

  it('limits suppliers to their own company products and orders', () => {
    const result = buildAnalytics(inputFor(supplierUser));
    expect(result.role).toBe('company');
    expect(result.scopeLabel).toBe('Supplier One');
    expect(result.orderCount).toBe(2);
    expect(result.gmv).toBe(1500);
    expect(result.productCount).toBe(1);
    expect(result.topProducts.map(product => product.id)).toEqual(['m1']);
  });

  it('limits customers to their own orders', () => {
    const result = buildAnalytics(inputFor(buyer));
    expect(result.role).toBe('customer');
    expect(result.orderCount).toBe(3);
    expect(result.gmv).toBe(1500);
    expect(result.topCustomers).toHaveLength(0);
    expect(result.topSuppliers).toHaveLength(1);
  });

  it('shows guests only the public catalogue', () => {
    const result = buildAnalytics(inputFor(null));
    expect(result.role).toBe('guest');
    expect(result.orderCount).toBe(0);
    expect(result.gmv).toBe(0);
    expect(result.productCount).toBe(2);
    expect(result.supplierCount).toBe(2);
    expect(result.priceBoard).toHaveLength(2);
    expect(result.priceBoard.every(product => product.marginPct === 0)).toBe(true);
    expect(result.priceBoard.every(product => product.forecast === null)).toBe(true);
    expect(result.priceBoard.every(product => product.history.length === 0)).toBe(true);
    const productsKpi = result.kpis.find(kpi => kpi.key === 'products');
    expect(productsKpi?.sub).not.toMatch(/units/i);
  });
});

describe('analytics periods and insight quality', () => {
  it('filters to the trailing window and compares the previous window', () => {
    const result = buildAnalytics(inputFor(admin, 30));
    expect(result.days).toBe(30);
    expect(result.orderCount).toBe(3);
    expect(result.gmv).toBe(3000);
    expect(result.growthPct).toBeCloseTo(500, 5);
    expect(result.monthlyRevenue).toHaveLength(6);
  });

  it('returns a null growth when the previous window is empty', () => {
    expect(buildAnalytics(inputFor(admin, 90)).growthPct).toBeNull();
  });

  it('produces role-specific KPI keys and narrative insights', () => {
    const result = buildAnalytics(inputFor(admin));
    expect(result.kpis.map(kpi => kpi.key)).toEqual(
      expect.arrayContaining(['gmv', 'orders', 'customers', 'delivery'])
    );
    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.categoryData.length).toBeGreaterThan(0);
    expect(result.cityBasis).toBe('orders');
  });
});

describe('copilot answers', () => {
  it('answers revenue questions with metrics from the same scoped data', () => {
    const answer = answerQuestion('How is revenue this month?', inputFor(admin));
    expect(answer.title).toBe('Revenue intelligence');
    expect(answer.metrics?.length).toBeGreaterThan(0);
    expect(answer.summary).toContain('ETB');
  });

  it('keeps stock intelligence private to suppliers and admins', () => {
    expect(answerQuestion('What should I restock?', inputFor(supplierUser)).title)
      .toBe('Inventory health & restock plan');
    expect(answerQuestion('What should I restock?', inputFor(buyer)).title)
      .toBe('Stock is supplier-private');
  });

  it('answers customer questions from the customer perspective', () => {
    const answer = answerQuestion('How is my spending?', inputFor(buyer));
    expect(answer.title).toBe('Your spending trend');
  });

  it('falls back to an executive snapshot for unknown wording', () => {
    expect(answerQuestion('something completely unrelated', inputFor(admin)).title)
      .toBe('Here is what I found');
  });

  it('greets the signed-in user with live context and role suggestions', () => {
    const greeting = copilotGreeting(inputFor(buyer));
    expect(greeting.title).toContain('Hello Buyer');
    expect(greeting.bullets?.length).toBeGreaterThan(0);
    expect(copilotSuggestions('company').length).toBeGreaterThan(0);
    expect(copilotSuggestions('guest').length).toBeGreaterThan(0);
  });
});
