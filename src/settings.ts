// ===== src/settings.ts =====
// Runtime-configurable system settings (delivery fee, minimum order, zones).
// Persisted to localStorage so administrators can change business rules
// without touching code or redeploying.
import { SystemSettings, DeliveryZone, User } from './types';
import { safeLocalStorage } from './utils';

export const SETTINGS_KEY = 'system_settings';

export const DEFAULT_SETTINGS: SystemSettings = {
  version: 1,
  currency: 'ETB',
  delivery: {
    mode: 'distance-based',
    fixedFee: 500,
    distanceBaseFee: 500,
    distancePerKmPerTon: 50,
    freeDeliveryThreshold: 0, // 0 = free-delivery rule disabled
    zones: [
      { id: 'zone-aa', name: 'Addis Ababa', cities: ['Addis Ababa'], fee: 400 },
      { id: 'zone-adama', name: 'Adama', cities: ['Adama', 'Bishoftu'], fee: 700 },
      { id: 'zone-bahir', name: 'Bahir Dar', cities: ['Bahir Dar'], fee: 1500 },
      { id: 'zone-mekelle', name: 'Mekelle', cities: ['Mekelle'], fee: 2200 },
      { id: 'zone-diredawa', name: 'Dire Dawa', cities: ['Dire Dawa', 'Harar', 'Jijiga'], fee: 1800 },
    ],
  },
  minOrder: {
    enabled: false,
    amount: 5000,
  },
};

/**
 * Load settings from localStorage, falling back to defaults and repairing
 * partially-corrupted values.
 */
export const loadSettings = (): SystemSettings => {
  try {
    const raw = safeLocalStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SystemSettings>;
    return {
      version: DEFAULT_SETTINGS.version,
      currency: 'ETB',
      delivery: {
        mode: parsed.delivery?.mode === 'fixed' ? 'fixed' : 'distance-based',
        fixedFee: numberOr(parsed.delivery?.fixedFee, DEFAULT_SETTINGS.delivery.fixedFee),
        distanceBaseFee: numberOr(parsed.delivery?.distanceBaseFee, DEFAULT_SETTINGS.delivery.distanceBaseFee),
        distancePerKmPerTon: numberOr(parsed.delivery?.distancePerKmPerTon, DEFAULT_SETTINGS.delivery.distancePerKmPerTon),
        freeDeliveryThreshold: numberOr(parsed.delivery?.freeDeliveryThreshold, DEFAULT_SETTINGS.delivery.freeDeliveryThreshold),
        zones: Array.isArray(parsed.delivery?.zones)
          ? (parsed.delivery!.zones as DeliveryZone[]).filter(z => z && typeof z.fee === 'number')
          : DEFAULT_SETTINGS.delivery.zones,
      },
      minOrder: {
        enabled: Boolean(parsed.minOrder?.enabled),
        amount: numberOr(parsed.minOrder?.amount, DEFAULT_SETTINGS.minOrder.amount),
      },
    };
  } catch (error) {
    console.warn('Failed to load system settings, using defaults', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: SystemSettings): void => {
  try {
    safeLocalStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to persist system settings', error);
  }
};

const numberOr = (value: any, fallback: number): number =>
  typeof value === 'number' && isFinite(value) && value >= 0 ? value : fallback;

/**
 * Simple in-memory cache so repeated settings reads (every render that needs
 * delivery/min-order rules) do not hit JSON.parse + localStorage each time.
 */
let cached: SystemSettings | null = null;
export const getSettings = (): SystemSettings => {
  if (!cached) cached = loadSettings();
  return cached;
};
export const refreshSettings = (): void => {
  cached = null;
};

export const ADMIN_EMAIL = 'admin@escon.et';
export const ADMIN_PASSWORD = 'admin123';

export const ADMIN_USER: User = {
  id: 'user-admin',
  name: 'E-SCON Administrator',
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
  phone: '+251900000000',
  address: 'Head Office, Addis Ababa',
  city: 'Addis Ababa',
  userType: 'admin',
  companyName: '',
  lat: 9.032,
  lng: 38.7469,
  registered: '2024-01-01',
  loginAttempts: 0,
  lockUntil: 0,
  tinNumber: '',
  businessLicense: '',
  vatRegistered: false,
  vatNumber: '',
};