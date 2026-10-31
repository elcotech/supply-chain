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
  findOtherCartSupplier,
  cartHasOtherSupplier,
  stageCartLine,
  addedVat,
  addedVatRate,
  cartGrandTotal,
  vatOnSubtotal,
  allocateVat,
  calculateDistance,
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

describe('findOtherCartSupplier (one supplier per cart)', () => {
  const line = (id: string, supplierId: string, materialId: string) => ({
    id,
    materialId,
    materialName: 'Item ' + materialId,
    supplierId,
    supplierName: 'Supplier ' + supplierId,
    quantity: 1,
    price: 100,
    unit: 'pcs',
  }) as any;

  it('allows anything into an empty cart', () => {
    expect(findOtherCartSupplier([], 'c1', 'm1')).toBeNull();
    expect(cartHasOtherSupplier([], 'c1', 'm1')).toBe(false);
  });

  it('allows a second product from the same supplier', () => {
    const cart = [line('1', 'c1', 'm1')];
    expect(findOtherCartSupplier(cart, 'c1', 'm2')).toBeNull();
    expect(cartHasOtherSupplier(cart, 'c1', 'm2')).toBe(false);
  });

  it('refuses a product from a second supplier and names the holder', () => {
    const cart = [line('1', 'c1', 'm1')];
    const clash = findOtherCartSupplier(cart, 'c2', 'm2');
    expect(clash).not.toBeNull();
    expect(clash!.supplierId).toBe('c1');
    expect(clash!.materialId).toBe('m1');
    expect(cartHasOtherSupplier(cart, 'c2', 'm2')).toBe(true);
  });

  it('lets a buyer raise the quantity of a product already in the cart', () => {
    // Re-ordering is a quantity change, not a new supplier, so it must not be
    // blocked - otherwise a legacy mixed cart would be impossible to edit.
    const cart = [line('1', 'c1', 'm1'), line('2', 'c2', 'm9')];
    expect(findOtherCartSupplier(cart, 'c2', 'm9')).toBeNull();
    // ...but a genuinely new product from a third supplier is still refused.
    expect(findOtherCartSupplier(cart, 'c3', 'm3')).not.toBeNull();
  });

  it('blocks a legacy mixed cart regardless of which supplier is added', () => {
    const mixed = [line('1', 'c1', 'm1'), line('2', 'c2', 'm2')];
    expect(findOtherCartSupplier(mixed, 'c1', 'm3')).not.toBeNull();
    expect(findOtherCartSupplier(mixed, 'c2', 'm3')).not.toBeNull();
  });
});

describe('stageCartLine (one source of truth for a cart line)', () => {
  const material = (overrides: Partial<any> = {}) => ({
    id: 'm1',
    companyId: 'c1',
    name: 'Cement',
    category: 'Construction Material',
    basePrice: 100,
    profitMargin: 0.15,
    price: 115,
    quantity: 500,
    unit: 'bag',
    minOrder: 1,
    description: 'Portland cement',
    transportCost: 15,
    rating: 0,
    images: [],
    taxIncluded: false,
    vatPercentage: 15,
    lastUpdated: '2025-10-30',
    ...overrides,
  }) as any;

  const existing = (overrides: Partial<any> = {}) => ({
    id: '1',
    materialId: 'm1',
    materialName: 'Cement',
    supplierId: 'c1',
    supplierName: 'Nati Building Supplies',
    quantity: 5,
    price: 115,
    unit: 'bag',
    minOrder: 1,
    vatPercentage: 15,
    basePrice: 100,
    profitMargin: 0.15,
    weightPerUnit: 0.001,
    ...overrides,
  }) as any;

  it('builds a full line from an empty cart and snapshots the supplier rate', () => {
    const rate = { offered: true, perKm: 12, startFee: 300 };
    const lines = stageCartLine([], material({ delivery: rate }), 50, true, 'Nati Building Supplies', 'set');
    expect(lines).not.toBeNull();
    expect(lines).toHaveLength(1);
    expect(lines![0]).toMatchObject({
      materialId: 'm1',
      supplierId: 'c1',
      supplierName: 'Nati Building Supplies',
      quantity: 50,
      price: 115,
      basePrice: 100,
      profitMargin: 0.15,
      includeDelivery: true,
      unit: 'bag',
    });
    expect(lines![0].deliveryRate).toEqual(rate);
  });

  it('stores no rate when the supplier does not offer delivery', () => {
    const lines = stageCartLine([], material({ delivery: { offered: false, perKm: 0, startFee: 0 } }), 1, false, 'S');
    expect(lines![0].deliveryRate).toBeUndefined();
    expect(lines![0].includeDelivery).toBe(false);
  });

  it('refuses a second supplier and leaves the cart untouched', () => {
    const cart = [existing({ quantity: 5 })];
    // A genuinely different product from a different supplier - not a re-order
    // of the line already in the cart.
    const result = stageCartLine(cart, material({ id: 'm9', name: 'Timber', companyId: 'c2' }), 3, true, 'Other Supplier');
    expect(result).toBeNull();
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(5);
  });

  it("'increment' adds to the quantity of a line already in the cart", () => {
    const cart = [existing({ quantity: 5 })];
    const lines = stageCartLine(cart, material(), 3, true, 'Nati Building Supplies', 'increment');
    expect(lines).toHaveLength(1);
    expect(lines![0].quantity).toBe(8);
  });

  it("'set' replaces the quantity, which is what the product page states", () => {
    const cart = [existing({ quantity: 5 })];
    const lines = stageCartLine(cart, material(), 50, true, 'Nati Building Supplies', 'set');
    expect(lines).toHaveLength(1);
    expect(lines![0].quantity).toBe(50);
  });

  it('does not mutate the cart it was given', () => {
    const cart = [existing({ quantity: 5 })];
    const before = JSON.stringify(cart);
    stageCartLine(cart, material(), 50, true, 'Nati Building Supplies', 'set');
    expect(JSON.stringify(cart)).toBe(before);
  });

  it('adds a second product from the same supplier as its own line', () => {
    const cart = [existing()];
    const lines = stageCartLine(cart, material({ id: 'm2', name: 'Steel' }), 7, true, 'Nati Building Supplies');
    expect(lines).toHaveLength(2);
    expect(lines!.map(l => l.materialId)).toEqual(['m1', 'm2']);
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
describe('addedVat (supplier prices exclude VAT)', () => {
  it('adds VAT on top of the net goods amount', () => {
    expect(addedVat(100, 15)).toBe(15);
    expect(addedVat(230, 15)).toBe(34.5);
  });

  it('rounds to two decimals and handles safe inputs', () => {
    expect(addedVat(100.05, 15)).toBe(15.01);
    expect(addedVat(0, 15)).toBe(0);
    expect(addedVat(-50, 15)).toBe(0);
    expect(addedVat(NaN, 15)).toBe(0);
    expect(addedVat(100, 0)).toBe(0);
  });

  it('recovers the added VAT rate for display', () => {
    expect(addedVatRate(100, 15)).toBe(15);
    expect(addedVatRate(200, 30)).toBe(15);
    expect(addedVatRate(0, 0)).toBe(0);
  });
});

describe('cartGrandTotal (VAT is always part of the total)', () => {
  it('adds VAT and delivery on top of the net goods subtotal', () => {
    expect(cartGrandTotal(1000, 150, 200)).toBe(1350);
    expect(cartGrandTotal(3000, 450, 700)).toBe(4150);
  });

  it('keeps VAT in the total when only the delivery fee is rewritten', () => {
    // The manual delivery-fee override on the cart used to recompute the total
    // as subtotal + delivery and silently drop the VAT row shown above it.
    expect(cartGrandTotal(3000, 450, 0)).toBe(3450);
    expect(cartGrandTotal(3000, 450, 120.5)).toBe(3570.5);
  });

  it('rounds to two decimals and tolerates unsafe inputs', () => {
    expect(cartGrandTotal(100.005, 15.004, 0)).toBe(115.01);
    expect(cartGrandTotal(NaN, 150, 200)).toBe(350);
    expect(cartGrandTotal(1000, 150, NaN)).toBe(1150);
  });
});

describe('vatOnSubtotal (one calculation for the whole cart)', () => {
  it('adds the configured rate to the aggregate subtotal', () => {
    expect(vatOnSubtotal(3000, 15)).toEqual({ rate: 15, vatAmount: 450, grossAmount: 3450 });
  });

  it('rounds once at the end instead of per line', () => {
    // Three 33.33 lines would each round to 5.00 (15.00 total) if VAT were
    // applied per line; the aggregate is 99.99 -> 15.00 as well, but the
    // aggregate is computed from one value, so tests with awkward numbers stay
    // consistent across cart, proforma and orders.
    expect(vatOnSubtotal(99.99, 15).vatAmount).toBe(15);
  });

  it('returns zero VAT when disabled or the rate is zero', () => {
    expect(vatOnSubtotal(1000, 15, false)).toEqual({ rate: 0, vatAmount: 0, grossAmount: 1000 });
    expect(vatOnSubtotal(1000, 0)).toEqual({ rate: 0, vatAmount: 0, grossAmount: 1000 });
  });

  it('caps the rate at 100% and handles unsafe values', () => {
    expect(vatOnSubtotal(1000, 150).rate).toBe(100);
    expect(vatOnSubtotal(NaN, 15)).toEqual({ rate: 15, vatAmount: 0, grossAmount: 0 });
  });
});

describe('allocateVat (order rows mirror the proforma total)', () => {
  it('splits VAT by net value and keeps the sum exact', () => {
    const shares = allocateVat([1000, 2000, 3000], 900);
    expect(shares).toEqual([150, 300, 450]);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(900);
  });

  it('gives the rounding remainder to the last line', () => {
    const shares = allocateVat([100, 100, 100], 45.01);
    expect(shares[0]).toBe(15);
    expect(shares[1]).toBe(15);
    expect(shares[2]).toBe(15.01);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(45.01);
  });

  it('returns zero shares for an empty or valueless cart', () => {
    expect(allocateVat([], 100)).toEqual([]);
    expect(allocateVat([0, 0], 100)).toEqual([0, 0]);
    expect(allocateVat([100, 200], 0)).toEqual([0, 0]);
  });
});
describe('calculateDistance (road kilometres)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the OSRM road distance in kilometres', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ distance: 12345 }] }),
    } as any);
    await expect(calculateDistance(6.11, 37.22, 6.33, 37.44)).resolves.toBe(12.345);
  });

  it('falls back to the second routing server when the first fails', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ routes: [{ distance: 76500 }] }),
      } as any);
    await expect(calculateDistance(6.51, 37.62, 6.73, 37.84)).resolves.toBe(76.5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects missing coordinates instead of inventing a distance', async () => {
    await expect(calculateDistance(Number.NaN, 37.22, 6.33, 37.44)).rejects.toThrow('Valid coordinates');
  });
});
