// ===== src/lib/transport.ts =====
// Pure helpers for the Transporter menu. Kept free of React/localStorage so the
// same rules are used by the dashboard, the order book and the unit tests.
import {
  Material,
  Order,
  TransporterProfile,
  TransportJobStatus,
  User,
} from '../types';

export const TRANSPORT_STATUS_LABELS: Record<TransportJobStatus, string> = {
  requested: 'Requested',
  accepted: 'Accepted',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  delivered: 'Delivered',
};

export const TRANSPORT_STATUS_ORDER: TransportJobStatus[] = [
  'requested',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
];

export const DEFAULT_TRANSPORT_RATES = {
  startFee: 300,
  ratePerKm: 25,
  ratePerTon: 150,
};

export const normalizeServiceAreas = (value: string | string[] | undefined): string[] => {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return Array.from(new Set(
    list.map(area => String(area).trim()).filter(Boolean)
  ));
};

/** Deterministic profile id so a re-created profile is never duplicated. */
export const transporterProfileId = (userId: string): string => `transport-${userId}`;

export const createTransporterProfile = (
  user: Pick<User, 'id' | 'name' | 'email' | 'phone' | 'address' | 'city' | 'lat' | 'lng' | 'companyName'> & {
    tinNumber?: string;
    businessLicense?: string;
  },
  overrides: Partial<TransporterProfile> = {}
): TransporterProfile => ({
  id: transporterProfileId(user.id),
  userId: user.id,
  companyName: overrides.companyName ?? user.companyName ?? user.name,
  description: overrides.description ?? '',
  phone: overrides.phone ?? user.phone ?? '',
  email: overrides.email ?? user.email ?? '',
  address: overrides.address ?? user.address ?? '',
  city: overrides.city ?? user.city ?? 'Addis Ababa',
  lat: Number.isFinite(user.lat) ? user.lat : 9.032,
  lng: Number.isFinite(user.lng) ? user.lng : 38.7469,
  tinNumber: overrides.tinNumber ?? user.tinNumber ?? '',
  licenseNumber: overrides.licenseNumber ?? user.businessLicense ?? '',
  serviceAreas: normalizeServiceAreas(overrides.serviceAreas),
  verified: overrides.verified ?? false,
  rating: overrides.rating ?? 0,
  completedJobs: overrides.completedJobs ?? 0,
  startFee: overrides.startFee ?? DEFAULT_TRANSPORT_RATES.startFee,
  ratePerKm: overrides.ratePerKm ?? DEFAULT_TRANSPORT_RATES.ratePerKm,
  ratePerTon: overrides.ratePerTon ?? DEFAULT_TRANSPORT_RATES.ratePerTon,
  vehicles: overrides.vehicles ?? [],
  drivers: overrides.drivers ?? [],
});

const nonNegative = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

/**
 * Delivered cost of a transport job:
 *   starting fee + (road km x per-km rate) + (tonnes x per-tonne rate)
 * All inputs are clamped so a malformed rate or distance can never produce a
 * negative or NaN fee.
 */
export const computeTransportFee = (
  profile: Pick<TransporterProfile, 'startFee' | 'ratePerKm' | 'ratePerTon'>,
  distanceKm: number,
  weightTons: number
): number => {
  const km = nonNegative(distanceKm);
  const tons = nonNegative(weightTons);
  const fee = nonNegative(profile.startFee)
    + km * nonNegative(profile.ratePerKm)
    + tons * nonNegative(profile.ratePerTon);
  return Math.round(fee * 100) / 100;
};

/** Best-effort cargo weight for one order line, in tonnes. */
export const orderWeightTons = (material: Material | undefined, quantity: number): number => {
  const qty = nonNegative(quantity);
  const perUnit = material?.specifications?.weightPerUnit;
  if (typeof perUnit === 'number' && Number.isFinite(perUnit) && perUnit > 0) {
    return Math.round(qty * perUnit * 1000) / 1000;
  }
  return Math.round((qty / 1000) * 1000) / 1000;
};

export const jobStatus = (order: Order): TransportJobStatus =>
  order.transportStatus || 'requested';

/** Confirmed/shipped orders that still need a truck (or already have one). */
export const isTransportEligible = (order: Order): boolean =>
  (order.status === 'confirmed' || order.status === 'shipped')
  && jobStatus(order) !== 'delivered'
  && (order.deliveryIncluded !== false || (order.transportCost || 0) > 0);

/** Jobs no transporter has claimed yet. */
export const availableTransportRequests = (orders: Order[]): Order[] =>
  orders
    .filter(order => isTransportEligible(order) && !order.transporterId)
    .sort((a, b) => Date.parse(b.orderDate) - Date.parse(a.orderDate));

/** Jobs assigned to one transporter, newest first. */
export const transporterJobs = (orders: Order[], transporterId: string): Order[] =>
  orders
    .filter(order => order.transporterId === transporterId)
    .sort((a, b) => Date.parse(b.orderDate) - Date.parse(a.orderDate));

export const activeTransporterJobs = (orders: Order[], transporterId: string): Order[] =>
  transporterJobs(orders, transporterId).filter(order => jobStatus(order) !== 'delivered');

export const completedTransporterJobs = (orders: Order[], transporterId: string): Order[] =>
  transporterJobs(orders, transporterId).filter(order => jobStatus(order) === 'delivered');

/** A transporter earns the quoted job fee, not the whole order value. */
export const transportJobFee = (order: Order): number => {
  if (typeof order.transportFee === 'number' && Number.isFinite(order.transportFee)) {
    return Math.max(0, order.transportFee);
  }
  return Math.max(0, order.transportCost || 0);
};

export const transportEarnings = (orders: Order[], transporterId: string): number =>
  completedTransporterJobs(orders, transporterId)
    .reduce((sum, order) => sum + transportJobFee(order), 0);

export const nextTransportStatus = (status: TransportJobStatus): TransportJobStatus | null => {
  const index = TRANSPORT_STATUS_ORDER.indexOf(status);
  if (index < 0 || index >= TRANSPORT_STATUS_ORDER.length - 1) return null;
  return TRANSPORT_STATUS_ORDER[index + 1];
};

export const canClaimTransportJob = (order: Order, transporterId: string): boolean =>
  isTransportEligible(order)
  && (!order.transporterId || order.transporterId === transporterId);

export const canAdvanceTransportJob = (order: Order, transporterId: string): boolean =>
  order.transporterId === transporterId
  && jobStatus(order) !== 'delivered'
  && isTransportEligible(order);
