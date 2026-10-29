import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';
import { refreshSettings, ADMIN_USER, ADMIN_EMAIL } from './settings';

describe('system settings persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    refreshSettings();
  });

  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings().currency).toBe('ETB');
    expect(loadSettings().vat).toEqual({ enabled: true, rate: 15 });
  });

  it('keeps a legacy settings object working by adding VAT defaults', () => {
    localStorage.setItem('system_settings', JSON.stringify({
      version: 1,
      currency: 'ETB',
      delivery: DEFAULT_SETTINGS.delivery,
      minOrder: DEFAULT_SETTINGS.minOrder,
    }));
    expect(loadSettings().vat).toEqual({ enabled: true, rate: 15 });
  });

  it('round-trips a full custom configuration', () => {
    const custom = {
      version: 1,
      currency: 'ETB' as const,
      delivery: {
        mode: 'fixed' as const,
        fixedFee: 250,
        distanceBaseFee: 100,
        distancePerKmPerTon: 30,
        freeDeliveryThreshold: 10000,
        zones: [
          { id: 'z1', name: 'Addis Ababa', cities: ['Addis Ababa'], fee: 150 },
        ],
      },
      minOrder: { enabled: true, amount: 2500 },
      vat: { enabled: true, rate: 15 },
    };
    saveSettings(custom);
    const loaded = loadSettings();
    expect(loaded.delivery.mode).toBe('fixed');
    expect(loaded.delivery.fixedFee).toBe(250);
    expect(loaded.delivery.freeDeliveryThreshold).toBe(10000);
    expect(loaded.delivery.zones).toHaveLength(1);
    expect(loaded.minOrder.enabled).toBe(true);
    expect(loaded.minOrder.amount).toBe(2500);
    expect(loaded.vat.rate).toBe(15);
  });

  it('repairs corrupted stored JSON', () => {
    localStorage.setItem('system_settings', '{not valid json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects negative / NaN numeric values', () => {
    const bad = {
      ...DEFAULT_SETTINGS,
      delivery: {
        ...DEFAULT_SETTINGS.delivery,
        fixedFee: -50,
        zones: [],
      },
      minOrder: { enabled: true, amount: NaN as unknown as number },
    };
    saveSettings(bad as never);
    const loaded = loadSettings();
    expect(loaded.delivery.fixedFee).toBe(DEFAULT_SETTINGS.delivery.fixedFee);
    expect(loaded.minOrder.amount).toBe(DEFAULT_SETTINGS.minOrder.amount);
  });

  it('seeds a usable admin account', () => {
    expect(ADMIN_USER.email).toBe(ADMIN_EMAIL);
    expect(ADMIN_USER.userType).toBe('admin');
    expect(ADMIN_USER.password.length).toBeGreaterThanOrEqual(6);
  });
});