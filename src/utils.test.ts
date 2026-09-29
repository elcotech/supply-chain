import {
  formatCurrency,
  checkMinOrder,
  computeDeliveryFee,
  computeLineDeliveryFee,
  lineDeliveryMode,
  deliveryBasisLabel,
  encodeProformaPayload,
  decodeProformaPayload,
  buildProformaQrUrl,
  buildProformaShareData,
  MAX_QR_LINE_ITEMS,
} from './utils';
import { DEFAULT_SETTINGS } from './settings';
import { SystemSettings, ProformaShareData, MaterialDelivery } from './types';

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

describe('computeLineDeliveryFee', () => {
  // A supplier who delivers the item themselves: 300 ETB to start, 12 ETB per km.
  const supplierRate: MaterialDelivery = { offered: true, perKm: 12, startFee: 300 };

  it('charges nothing when the buyer unticks the delivery checkbox', () => {
    expect(
      computeLineDeliveryFee({ includeDelivery: false, rate: supplierRate, distanceKm: 100, platformFee: 500 })
    ).toBe(0);
  });

  it('applies the supplier starting fee plus per km over the distance', () => {
    // 300 + (12 x 100 km)
    expect(
      computeLineDeliveryFee({ includeDelivery: true, rate: supplierRate, distanceKm: 100 })
    ).toBe(1500);
  });

  it('charges only the starting fee when the rate has no per-km component', () => {
    expect(
      computeLineDeliveryFee({ includeDelivery: true, rate: { offered: true, perKm: 0, startFee: 400 }, distanceKm: 80 })
    ).toBe(400);
  });

  it('is free when the supplier offers delivery with no charge at all', () => {
    expect(
      computeLineDeliveryFee({ includeDelivery: true, rate: { offered: true, perKm: 0, startFee: 0 }, distanceKm: 50 })
    ).toBe(0);
  });

  it('falls back to the platform fee when the supplier publishes no rate', () => {
    expect(
      computeLineDeliveryFee({ includeDelivery: true, rate: undefined, distanceKm: 100, platformFee: 640 })
    ).toBe(640);
    // offered: false is the same as no rate at all
    expect(
      computeLineDeliveryFee({
        includeDelivery: true,
        rate: { offered: false, perKm: 20, startFee: 200 },
        distanceKm: 100,
        platformFee: 640,
      })
    ).toBe(640);
  });

  it('never falls back to a negative platform fee', () => {
    expect(computeLineDeliveryFee({ includeDelivery: true, distanceKm: 10, platformFee: -50 })).toBe(0);
  });

  it('treats a missing or nonsensical distance as zero km', () => {
    expect(computeLineDeliveryFee({ includeDelivery: true, rate: supplierRate, distanceKm: NaN })).toBe(300);
    expect(computeLineDeliveryFee({ includeDelivery: true, rate: supplierRate, distanceKm: -5 })).toBe(300);
  });

  it('reports which pricing rule each line falls under', () => {
    expect(lineDeliveryMode({ includeDelivery: false, rate: supplierRate })).toBe('none');
    expect(lineDeliveryMode({ includeDelivery: true, rate: supplierRate })).toBe('supplier');
    expect(lineDeliveryMode({ includeDelivery: true, rate: undefined })).toBe('platform');
  });
});

describe('deliveryBasisLabel', () => {
  const supplierRate: MaterialDelivery = { offered: true, perKm: 12, startFee: 300 };

  it('explains the supplier rate in both parts', () => {
    expect(deliveryBasisLabel(supplierRate, true)).toBe('Supplier delivery · ETB 300.00 starting fee + ETB 12.00/km');
  });

  it('mentions the starting fee alone when only that is charged', () => {
    expect(deliveryBasisLabel({ offered: true, perKm: 0, startFee: 250 }, true))
      .toBe('Supplier delivery · ETB 250.00 starting fee');
  });

  it('says the platform rate applies when the supplier has none', () => {
    expect(deliveryBasisLabel(undefined, true)).toBe('Platform delivery rate');
  });

  it('states plainly that nothing is charged without delivery', () => {
    expect(deliveryBasisLabel(supplierRate, false)).toBe('No delivery cost — you arrange the transport');
  });
});

describe('buildProformaShareData (multi-item cart)', () => {
  const base = {
    proformaNumber: 'PI-2026-09-123456',
    dateISO: '2026-09-29',
    buyerName: 'Test Buyer',
    subtotal: 3000,
    vat: 450,
    delivery: 700,
    total: 4150,
  };

  const line = (n: string, d: 0 | 1) => ({ n, u: 'bags', q: 10, p: 100, d });

  it('carries every item and every supplier in one payload', () => {
    const data = buildProformaShareData({
      ...base,
      suppliers: [
        { n: 'Build Well Trading', c: 'Addis Ababa' },
        { n: 'ETH Cement Co.', c: 'Adama' },
      ],
      items: [line('Sand', 1), line('Cement', 0)],
      deliveryLines: [{ n: 'Build Well Trading', k: 12, c: 450 }],
    });
    expect(data.s).toHaveLength(2);
    expect(data.i).toHaveLength(2);
    expect(data.i[0].d).toBe(1);
    expect(data.i[1].d).toBe(0);
    expect(data.f).toEqual([{ n: 'Build Well Trading', k: 12, c: 450 }]);
    expect(data.tot).toBe(4150);
  });

  it('truncates a very long item list but records the true count', () => {
    const items = Array.from({ length: MAX_QR_LINE_ITEMS + 5 }, (_, i) => line('Item ' + i, 1));
    const data = buildProformaShareData({ ...base, suppliers: [], items, deliveryLines: [] });
    expect(data.i).toHaveLength(MAX_QR_LINE_ITEMS);
    expect(data.tc).toBe(MAX_QR_LINE_ITEMS + 5);
  });

  it('omits the truncated count when everything fits', () => {
    const data = buildProformaShareData({
      ...base, suppliers: [], items: [line('Sand', 1)], deliveryLines: [],
    });
    expect(data.tc).toBeUndefined();
  });

  it('still round-trips through encode → decode after truncation', () => {
    const items = Array.from({ length: MAX_QR_LINE_ITEMS + 2 }, (_, i) => line('Item ' + i, 1));
    const data = buildProformaShareData({ ...base, suppliers: [], items, deliveryLines: [] });
    expect(decodeProformaPayload(encodeProformaPayload(data))).toEqual(data);
  });
});