import { Material, Order, TransporterProfile } from '../types';
import {
  activeTransporterJobs,
  availableTransportRequests,
  canAdvanceTransportJob,
  canClaimTransportJob,
  completedTransporterJobs,
  computeTransportFee,
  createTransporterProfile,
  jobStatus,
  nextTransportStatus,
  normalizeServiceAreas,
  orderWeightTons,
  transportEarnings,
  transportJobFee,
  transporterJobs,
} from './transport';

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1',
  customerId: 'buyer-1',
  companyId: 'supplier-1',
  materialId: 'material-1',
  quantity: 1000,
  unitPrice: 166.75,
  transportCost: 5000,
  totalAmount: 196762.5,
  status: 'confirmed',
  orderDate: '2026-11-01',
  address: 'Addis Ababa',
  invoiceNumber: 'INV-1',
  taxAmount: 0,
  vatAmount: 25012.5,
  paymentMethod: 'bank',
  paymentStatus: 'pending',
  deliveryIncluded: true,
  ...overrides,
});

const makeMaterial = (overrides: Partial<Material> = {}): Material => ({
  id: 'material-1',
  companyId: 'supplier-1',
  name: 'Rebar Grade 60',
  category: 'Construction',
  basePrice: 145,
  profitMargin: 0.15,
  price: 166.75,
  quantity: 20000,
  unit: 'kg',
  minOrder: 1,
  description: 'Rebar',
  transportCost: 0,
  rating: 4.5,
  specifications: { weightPerUnit: 0.001 },
  images: [],
  taxIncluded: false,
  vatPercentage: 15,
  lastUpdated: '2026-11-01',
  ...overrides,
});

const makeProfile = (overrides: Partial<TransporterProfile> = {}): TransporterProfile =>
  createTransporterProfile({
    id: 'user-transport',
    name: 'Haile Transport',
    email: 'haile@example.com',
    phone: '+251900000000',
    address: 'Kality',
    city: 'Addis Ababa',
    lat: 9.02,
    lng: 38.75,
    companyName: 'Haile Transport PLC',
  }, overrides);

describe('transport helpers', () => {
  it('normalises service areas from text and arrays', () => {
    expect(normalizeServiceAreas(' Addis Ababa, Adama ,, Addis Ababa '))
      .toEqual(['Addis Ababa', 'Adama']);
    expect(normalizeServiceAreas(['Bishoftu', ' Bishoftu ', ''])).toEqual(['Bishoftu']);
  });

  it('computes a delivered transport fee from start, distance and weight', () => {
    expect(computeTransportFee({ startFee: 300, ratePerKm: 25, ratePerTon: 150 }, 12.4, 2))
      .toBe(910);
  });

  it('clamps malformed fee inputs instead of producing NaN or negatives', () => {
    expect(computeTransportFee({ startFee: -100, ratePerKm: -2, ratePerTon: 0 }, -5, 1))
      .toBe(0);
    expect(computeTransportFee({ startFee: 0, ratePerKm: 10, ratePerTon: 0 }, Number.NaN, 0))
      .toBe(0);
  });

  it('derives cargo tonnes from material weight-per-unit', () => {
    expect(orderWeightTons(makeMaterial(), 1000)).toBe(1);
    expect(orderWeightTons(undefined, 2500)).toBe(2.5);
    expect(orderWeightTons(makeMaterial({ specifications: { weightPerUnit: 0 } }), 1000)).toBe(1);
  });

  it('lists unclaimed eligible requests only', () => {
    const orders = [
      makeOrder({ id: 'open' }),
      makeOrder({ id: 'claimed', transporterId: 'other' }),
      makeOrder({ id: 'pending', status: 'pending' }),
      makeOrder({ id: 'delivered', transportStatus: 'delivered' }),
      makeOrder({ id: 'no-delivery', deliveryIncluded: false, transportCost: 0 }),
    ];
    expect(availableTransportRequests(orders).map(o => o.id)).toEqual(['open']);
  });

  it('scopes jobs, active jobs and completed jobs to one transporter', () => {
    const orders = [
      makeOrder({ id: 'mine-active', transporterId: 't1' }),
      makeOrder({ id: 'mine-done', transporterId: 't1', transportStatus: 'delivered' }),
      makeOrder({ id: 'other', transporterId: 't2' }),
    ];
    expect(transporterJobs(orders, 't1').map(o => o.id).sort())
      .toEqual(['mine-active', 'mine-done']);
    expect(activeTransporterJobs(orders, 't1').map(o => o.id)).toEqual(['mine-active']);
    expect(completedTransporterJobs(orders, 't1').map(o => o.id)).toEqual(['mine-done']);
  });

  it('pays the quoted job fee rather than the order value', () => {
    const order = makeOrder({ transporterId: 't1', transportStatus: 'delivered', transportFee: 910 });
    expect(transportJobFee(order)).toBe(910);
    expect(transportEarnings([order], 't1')).toBe(910);
  });

  it('advances the delivery state one step at a time', () => {
    expect(nextTransportStatus('requested')).toBe('accepted');
    expect(nextTransportStatus('picked_up')).toBe('in_transit');
    expect(nextTransportStatus('in_transit')).toBe('delivered');
    expect(nextTransportStatus('delivered')).toBeNull();
  });

  it('protects other transporters from claiming or advancing a job', () => {
    const order = makeOrder({ transporterId: 't2' });
    expect(canClaimTransportJob(order, 't1')).toBe(false);
    expect(canAdvanceTransportJob(order, 't1')).toBe(false);
    expect(canAdvanceTransportJob({ ...order, transporterId: 't1' }, 't1')).toBe(true);
    expect(jobStatus(order)).toBe('requested');
  });

  it('creates a complete profile with default rates', () => {
    const profile = makeProfile();
    expect(profile.id).toBe('transport-user-transport');
    expect(profile.companyName).toBe('Haile Transport PLC');
    expect(profile.ratePerKm).toBe(25);
    expect(profile.startFee).toBe(300);
    expect(profile.ratePerTon).toBe(150);
    expect(profile.vehicles).toEqual([]);
  });
});
