import {
  formatCurrency,
  checkMinOrder,
  computeDeliveryFee,
  encodeProformaPayload,
  decodeProformaPayload,
  buildProformaQrUrl,
} from './utils';
import { DEFAULT_SETTINGS } from './settings';
import { SystemSettings, ProformaShareData } from './types';

const baseInput = (overrides: Partial<any> = {}) => ({
  supplierLat: 9.032,
  supplierLng: 38.7469,
  customerLat: 8.54,
  customerLng: 39.27,
  customerCity: null,
  weightTons: 1,
  orderSubtotal: 12000,
  settings: DEFAULT_SETTINGS,
  ...overrides,
});

const fixedSettings = (patch: Partial<any> = {}): SystemSettings => ({
  ...DEFAULT_SETTINGS,
  delivery: {
    ...DEFAULT_SETTINGS.delivery,
    mode: 'fixed',
    fixedFee: 350,
    freeDeliveryThreshold: 0,
    zones: [],
    ...patch,
  },
});

describe('formatCurrency', () => {
  it('renders ETB amounts with 2 decimals', () => {
    expect(formatCurrency(500)).toBe('ETB 500.00');
    expect(formatCurrency(1234.5)).toBe('ETB 1,234.50');
  });

  it('never renders ETH', () => {
    expect(formatCurrency(0)).not.toContain('ETH');
  });

  it('handles negatives and invalid input safely', () => {
    expect(formatCurrency(-25)).toBe('-ETB 25.00');
    expect(formatCurrency(NaN)).toBe('ETB 0.00');
  });
});

describe('checkMinOrder', () => {
  it('is disabled by default', () => {
    expect(checkMinOrder(DEFAULT_SETTINGS, 100).enabled).toBe(false);
    expect(checkMinOrder(DEFAULT_SETTINGS, 100).below).toBe(false);
  });

  it('flags orders below the configured minimum', () => {
    const on = { ...DEFAULT_SETTINGS, minOrder: { enabled: true, amount: 5000 } };
    const below = checkMinOrder(on, 4000);
    expect(below.enabled).toBe(true);
    expect(below.below).toBe(true);
    expect(below.shortfall).toBe(1000);
  });

  it('passes orders at or above the minimum', () => {
    const on = { ...DEFAULT_SETTINGS, minOrder: { enabled: true, amount: 5000 } };
    expect(checkMinOrder(on, 5000).below).toBe(false);
    expect(checkMinOrder(on, 9000).below).toBe(false);
  });
});

describe('computeDeliveryFee', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockRejectedValue(Error('offline test'));
  });
  afterEach(() => {
    (global.fetch as jest.Mock).mockRestore();
  });

  it('applies the fixed fee in fixed mode', async () => {
    const fee = await computeDeliveryFee(baseInput({ settings: fixedSettings() }));
    expect(fee).toBe(350);
  });

  it('applies a zone fee when the customer city matches', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      delivery: {
        ...DEFAULT_SETTINGS.delivery,
        mode: 'fixed',
        fixedFee: 999,
        zones: [{ id: 'z', name: 'Addis Ababa', cities: ['Addis Ababa'], fee: 150 }],
      },
    };
    const fee = await computeDeliveryFee(baseInput({ settings, customerCity: 'Addis Ababa' }));
    expect(fee).toBe(150);
  });

  it('ignores zone case differences', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      delivery: {
        ...DEFAULT_SETTINGS.delivery,
        zones: [{ id: 'z', name: 'Adama', cities: ['Adama', 'Bishoftu'], fee: 700 }],
      },
    };
    const fee = await computeDeliveryFee(baseInput({ settings, customerCity: 'adama' }));
    expect(fee).toBe(700);
  });

  it('charges nothing when the free-delivery threshold is met', async () => {
    const settings = fixedSettings({ freeDeliveryThreshold: 10000 });
    const fee = await computeDeliveryFee(
      baseInput({ settings, orderSubtotal: 15000 })
    );
    expect(fee).toBe(0);
  });

  it('charges the fixed fee below the free-delivery threshold', async () => {
    const settings = fixedSettings({ freeDeliveryThreshold: 10000 });
    const fee = await computeDeliveryFee(
      baseInput({ settings, orderSubtotal: 5000 })
    );
    expect(fee).toBe(350);
  });

  it('calculates distance-based fee from base + per-km-per-tonne', async () => {
    // OSRM returns a fixed 100 km route → deterministic fee.
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ routes: [{ distance: 100000 }] }),
    });
    const fee = await computeDeliveryFee(
      baseInput({ weightTons: 2, orderSubtotal: 1000 })
    );
    const expected =
      DEFAULT_SETTINGS.delivery.distanceBaseFee +
      100 * DEFAULT_SETTINGS.delivery.distancePerKmPerTon * 2;
    expect(fee).toBe(expected);
  });
});

describe('proforma QR payload', () => {
  const sample: ProformaShareData = {
    v: 1,
    n: 'PI-2026-01-123456',
    d: '2026-09-19',
    b: 'Test Buyer',
    s: [{ n: 'ETH Cement Co.', c: 'Addis Ababa' }],
    i: [{ n: 'Cement Grade 42.5', u: 'bags', q: 500, p: 305 }],
    sub: 152500,
    vat: 22875,
    del: 700,
    tot: 176075,
    c: 'ETB',
  };

  it('round-trips encode → decode without data loss', () => {
    const token = encodeProformaPayload(sample);
    const decoded = decodeProformaPayload(token);
    expect(decoded).toEqual(sample);
  });

  it('rejects garbage / tampered tokens', () => {
    expect(decodeProformaPayload('not-a-payload')).toBeNull();
    expect(decodeProformaPayload('ESCON1%%%garbage')).toBeNull();
  });

  it('builds a scannable URL with the escon hash fragment', () => {
    const url = buildProformaQrUrl(sample);
    expect(url).toMatch(/^[^#]+#escon=/);
    const token = url.split('#escon=')[1];
    expect(decodeProformaPayload(token)).toEqual(sample);
  });
});