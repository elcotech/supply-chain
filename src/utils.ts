import QRCode from 'qrcode';
import { SystemSettings, ProformaShareData, PricePoint, ProductReview, BackupPayload, MaterialDelivery, DeliveryMode, CartItem, Material } from './types';

export const safeLocalStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

// Generate a QR code as a base64 data URL (renders reliably in print / PDF)
export const generateQRDataURL = (text: string, size: number = 120): Promise<string> => {
  return QRCode.toDataURL(text, { width: size, margin: 1 });
};

// Single, consistent currency formatter used across cart, proforma, reports,
// receipts and product pricing. Always renders "ETB 500.00" (never "ETH").
// A custom formatter (rather than Intl 'en-ET', which is not a registered
// locale in every engine) guarantees identical output on all devices.
export const formatCurrency = (amount: number): string => {
  const safe = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  const formatted = Math.abs(safe)
    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}ETB ${formatted}`;
};

/**
 * Supplier prices are VAT-exclusive (`Material.taxIncluded` is false), so VAT is
 * added on top of the net goods amount at purchase / proforma time.
 * 100.00 at 15% -> 15.00.
 */
export const addedVat = (netAmount: number, vatPercentage: number): number => {
  const net = typeof netAmount === 'number' && isFinite(netAmount) ? netAmount : 0;
  const percentage = typeof vatPercentage === 'number' && isFinite(vatPercentage) ? vatPercentage : 0;
  if (net <= 0 || percentage <= 0) return 0;
  return round2(net * percentage / 100);
};

/** Recover the VAT rate (%) from a net amount and the VAT added on top of it. */
export const addedVatRate = (netAmount: number, vatAmount: number): number => {
  const net = typeof netAmount === 'number' && isFinite(netAmount) ? netAmount : 0;
  const vat = typeof vatAmount === 'number' && isFinite(vatAmount) ? vatAmount : 0;
  return net > 0 ? Math.round((vat / net) * 100) : 0;
};

/**
 * Grand total of a cart: net goods subtotal + VAT + delivery.
 * Every surface that shows or rewrites a total (cart summary, the manual
 * delivery-fee override, the proforma and order creation) goes through this
 * one helper, so the VAT row on screen and the total can never disagree.
 */
export const cartGrandTotal = (subtotal: number, vatAmount: number, delivery: number): number => {
  const goods = typeof subtotal === 'number' && isFinite(subtotal) ? subtotal : 0;
  const vat = typeof vatAmount === 'number' && isFinite(vatAmount) ? vatAmount : 0;
  const fee = typeof delivery === 'number' && isFinite(delivery) ? delivery : 0;
  return round2(goods + vat + fee);
};

/**
 * VAT for the whole cart. Unlike the old per-line approach, the tax is computed
 * exactly once from the aggregate net goods subtotal, so rounding cannot drift
 * when several lines are bought together.
 */
export const vatOnSubtotal = (
  netSubtotal: number,
  rate: number,
  enabled = true
): { rate: number; vatAmount: number; grossAmount: number } => {
  const net = typeof netSubtotal === 'number' && isFinite(netSubtotal) && netSubtotal > 0 ? netSubtotal : 0;
  const percentage = enabled && typeof rate === 'number' && isFinite(rate) && rate > 0
    ? Math.min(100, rate)
    : 0;
  const vatAmount = addedVat(net, percentage);
  return { rate: percentage, vatAmount, grossAmount: round2(net + vatAmount) };
};

/**
 * Split one aggregate VAT amount across individual order lines by their net
 * value. The last line absorbs any rounding remainder so the sum always equals
 * the VAT on the proforma and cart total.
 */
export const allocateVat = (netAmounts: number[], totalVat: number): number[] => {
  const amounts = (netAmounts || []).map(amount =>
    typeof amount === 'number' && isFinite(amount) && amount > 0 ? amount : 0
  );
  const totalNet = amounts.reduce((sum, amount) => sum + amount, 0);
  const vat = typeof totalVat === 'number' && isFinite(totalVat) && totalVat > 0 ? totalVat : 0;
  if (amounts.length === 0 || totalNet <= 0 || vat <= 0) return amounts.map(() => 0);

  let allocated = 0;
  return amounts.map((amount, index) => {
    if (index === amounts.length - 1) return round2(vat - allocated);
    const share = round2(vat * amount / totalNet);
    allocated = round2(allocated + share);
    return share;
  });
};

/**
 * Convert a non-negative integer into English words. Used by the cart and the
 * proforma so both documents spell the payable amount identically.
 */
export const numberToWords = (num: number): string => {
  if (!Number.isFinite(num) || num <= 0) return 'Zero';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
    'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy',
    'Eighty', 'Ninety',
  ];

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + convert(n % 1000000) : '');
    return convert(Math.floor(n / 1000000000)) + ' Billion' + (n % 1000000000 ? ' ' + convert(n % 1000000000) : '');
  };

  return convert(Math.floor(num));
};

/** Spell an ETB amount as "Five Hundred Ethiopian Birr and Fifty Cents Only". */
export const amountToWords = (amount: number): string => {
  const safe = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  const birr = Math.floor(abs);
  const cents = Math.round((abs - birr) * 100);
  const birrText = numberToWords(birr) + ' Ethiopian Birr';
  const centText = cents > 0
    ? ' and ' + numberToWords(cents) + (cents === 1 ? ' Cent' : ' Cents')
    : '';
  return birrText + centText + ' Only';
};

export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' });
};

export interface GeoCoordinates {
  lat: number;
  lng: number;
  accuracy: number;
}

const positionError = (error: GeolocationPositionError): Error => {
  const message = error.code === error.PERMISSION_DENIED
    ? 'Location permission was denied.'
    : error.code === error.TIMEOUT
      ? 'Getting the current location timed out.'
      : 'The current location is unavailable.';
  return new Error(message);
};

const readPosition = (options: PositionOptions): Promise<GeoCoordinates> =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      error => reject(positionError(error)),
      options
    );
  });

/**
 * Read the device's *current* position (not the saved profile pin). `maximumAge: 0`
 * forces a fresh fix. A high-accuracy GPS/wifi fix is requested first; if the
 * device cannot obtain one in time, a network-assisted fix is attempted before
 * giving up, so ordering is not left waiting indefinitely.
 */
export const getCurrentCoordinates = async (timeoutMs = 16000): Promise<GeoCoordinates> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not supported on this device.');
  }
  const highTimeout = Math.max(5000, Math.round(timeoutMs * 0.7));
  try {
    return await readPosition({
      enableHighAccuracy: true,
      timeout: highTimeout,
      maximumAge: 0,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Location permission was denied.') throw error;
    return readPosition({
      enableHighAccuracy: false,
      timeout: Math.max(4000, timeoutMs - highTimeout),
      maximumAge: 0,
    });
  }
};

// In-memory cache so repeated distance lookups (search, cart, map) don't hammer
// the routing servers. Distances are exact OSRM road kilometres whenever a
// routing server replies.
const distanceCache = new Map<string, number>();
const ROUTE_TIMEOUT_MS = 9000;
const ROUTE_ENDPOINTS = [
  'https://router.project-osrm.org/route/v1/driving',
  'https://routing.openstreetmap.de/routed-car/route/v1/driving',
];

const fetchRoadDistanceKm = async (url: string): Promise<number> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (response.ok === false) throw new Error('Routing server returned ' + response.status);
    const data = await response.json();
    const metres = data?.routes?.[0]?.distance;
    if (!Number.isFinite(metres) || metres <= 0) throw new Error('No route found');
    return metres / 1000;
  } finally {
    clearTimeout(timer);
  }
};

export const calculateDistance = async (originLat: number, originLng: number, destLat: number, destLng: number): Promise<number> => {
  if (![originLat, originLng, destLat, destLng].every(Number.isFinite)) {
    throw new Error('Valid coordinates are required to measure the delivery distance.');
  }
  const key = `${originLat.toFixed(6)},${originLng.toFixed(6)},${destLat.toFixed(6)},${destLng.toFixed(6)}`;
  const cached = distanceCache.get(key);
  if (cached !== undefined) return cached;

  // Always prefer real road routing. Two independent OSRM endpoints keep the
  // measurement working when one public server is slow or unavailable.
  for (const endpoint of ROUTE_ENDPOINTS) {
    try {
      const url = `${endpoint}/${originLng},${originLat};${destLng},${destLat}?overview=false&alternatives=false&steps=false`;
      const dist = await fetchRoadDistanceKm(url);
      distanceCache.set(key, dist);
      return dist;
    } catch (error) {
      console.warn('Road routing failed for ' + endpoint, error);
    }
  }

  // Last-resort straight-line distance. This keeps the app usable offline, but
  // every online order uses the road distance returned above.
  const R = 6371;
  const dLat = (destLat - originLat) * Math.PI / 180;
  const dLon = (destLng - originLng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(originLat * Math.PI/180) * Math.cos(destLat * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const dist = R * c;
  distanceCache.set(key, dist);
  return dist;
};

/**
 * Round a measured distance to the 0.1 km precision shown in every buyer-facing
 * view (search, product page, cart, proforma and map). Storing the rounded value
 * on the cart line means the KM the buyer reads is exactly the KM the delivery
 * fee is calculated from.
 */
export const roundKm = (km: number): number =>
  Number.isFinite(km) && km > 0 ? Math.round(km * 10) / 10 : 0;

export const calculateTransportCost = async (
  supplierLat: number, supplierLng: number,
  customerLat: number, customerLng: number,
  totalWeightTons: number,
  fixedCost: number = 500,
  variableCostPerKmPerTon: number = 50
): Promise<number> => {
  const distance = await calculateDistance(supplierLat, supplierLng, customerLat, customerLng);
  return fixedCost + (distance * variableCostPerKmPerTon * totalWeightTons);
};

export interface DeliveryFeeInput {
  supplierLat: number;
  supplierLng: number;
  customerLat: number;
  customerLng: number;
  customerCity: string | null;
  /** Combined weight for a single supplier's items (tonnes). */
  weightTons: number;
  /** Cart goods subtotal (VAT-exclusive, before delivery) — used for free-delivery. */
  orderSubtotal: number;
  /** Exact road distance already measured for this line, when there is one. */
  distanceKm?: number;
  settings: SystemSettings;
}

/**
 * Flexible delivery fee resolved from SystemSettings instead of being
 * hard-coded. Supports:
 *  - fixed fee (mode: 'fixed')
 *  - distance-based fee (mode: 'distance-based')
 *  - per-city delivery zones (flat override fee)
 *  - free delivery above a configurable order threshold
 */
export const computeDeliveryFee = async (input: DeliveryFeeInput): Promise<number> => {
  const s = input.settings.delivery;

  // Free delivery above a configurable goods-subtotal threshold.
  const threshold = numberOr(s.freeDeliveryThreshold, 0);
  if (threshold > 0 && input.orderSubtotal >= threshold) return 0;

  // Zone override: a flat fee for the customer's city wins over other modes.
  let zoneFee: number | undefined;
  if (input.customerCity) {
    const zone = s.zones.find(z => z.cities.some(city => city.toLowerCase() === input.customerCity!.toLowerCase()));
    if (zone) zoneFee = zone.fee;
  }
  if (zoneFee !== undefined) return Math.max(0, zoneFee);

  if (s.mode === 'fixed') {
    return Math.max(0, numberOr(s.fixedFee, 0));
  }

  const distance = typeof input.distanceKm === 'number' && isFinite(input.distanceKm) && input.distanceKm > 0
    ? input.distanceKm
    : await calculateDistance(
      input.supplierLat, input.supplierLng,
      input.customerLat, input.customerLng
    );
  const base = numberOr(s.distanceBaseFee, 0);
  const perKmPerTon = numberOr(s.distancePerKmPerTon, 0);
  return Math.max(0, base + distance * perKmPerTon * Math.max(input.weightTons, 0.001));
};

const numberOr = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && isFinite(value) && value >= 0 ? value : fallback;

const round2 = (value: number): number => Math.round(value * 100) / 100;

export interface LineDeliveryInput {
  /** The buyer ticked "include delivery cost" for this cart line. */
  includeDelivery: boolean;
  /** The supplier's published per-km rate for this item, if it offers delivery. */
  rate?: MaterialDelivery;
  /** Real supplier -> buyer road distance in km (only known at cart time). */
  distanceKm: number;
  /** Platform fee already resolved by computeDeliveryFee; used as the fallback. */
  platformFee?: number;
}

/**
 * Delivery fee for a single cart line.
 *
 * The buyer's checkbox is the master switch: unticked, nothing is charged for the
 * line. Ticked, the supplier's own published rate wins — a flat delivery service
 * starting fee plus a per-kilometre charge on the measured distance — and only
 * when the supplier has not published a rate does the platform's admin
 * configuration (free threshold / zones / distance rules) apply instead.
 */
export const computeLineDeliveryFee = (input: LineDeliveryInput): number => {
  if (!input.includeDelivery) return 0;
  const rate = input.rate;
  if (rate && rate.offered) {
    const startFee = numberOr(rate.startFee, 0);
    const perKm = numberOr(rate.perKm, 0);
    const km = typeof input.distanceKm === 'number' && isFinite(input.distanceKm) && input.distanceKm > 0
      ? input.distanceKm
      : 0;
    return round2(startFee + perKm * km);
  }
  return round2(Math.max(0, numberOr(input.platformFee, 0)));
};

/**
 * Which pricing rule a line will be billed under. The distance and the platform
 * fee are irrelevant here — only the checkbox and the supplier's rate matter.
 */
export const lineDeliveryMode = (input: Pick<LineDeliveryInput, 'includeDelivery' | 'rate'>): DeliveryMode => {
  if (!input.includeDelivery) return 'none';
  return input.rate && input.rate.offered ? 'supplier' : 'platform';
};

/** Short, human-readable explanation of how a line's delivery fee is priced. */
export const deliveryBasisLabel = (rate?: MaterialDelivery, includeDelivery = true): string => {
  if (!includeDelivery) return 'No delivery cost — you arrange the transport';
  if (rate && rate.offered) {
    const parts: string[] = [];
    if (numberOr(rate.startFee, 0) > 0) parts.push(`${formatCurrency(rate.startFee)} starting fee`);
    if (numberOr(rate.perKm, 0) > 0) parts.push(`${formatCurrency(rate.perKm)}/km`);
    return parts.length > 0
      ? `Supplier delivery · ${parts.join(' + ')}`
      : 'Supplier delivery · free of charge';
  }
  return 'Platform delivery rate';
};

export interface MinOrderCheck {
  enabled: boolean;
  amount: number;
  subtotal: number;
  below: boolean;
  shortfall: number;
}

/**
 * Evaluate whether a cart meets the configured minimum-order rule so the
 * customer is warned BEFORE submitting instead of discovering it later.
 */
export const checkMinOrder = (settings: SystemSettings, goodsSubtotal: number): MinOrderCheck => {
  const enabled = Boolean(settings.minOrder?.enabled);
  const amount = enabled ? numberOr(settings.minOrder?.amount, 0) : 0;
  const subtotal = typeof goodsSubtotal === 'number' && isFinite(goodsSubtotal) ? goodsSubtotal : 0;
  const below = enabled && subtotal < amount;
  return { enabled, amount, subtotal, below, shortfall: below ? amount - subtotal : 0 };
};

// ---------- Cart: one supplier per cart ----------
// A proforma is a legal document issued by a single seller, so a cart may only
// hold one supplier's goods. Kept as a pure helper (not inline in App.tsx) so the
// rule is unit-testable and so the pre-flight check in `addToCartLogic` and the
// authoritative check inside the `setCart` updater cannot drift apart: both call
// this same function.

/**
 * The first cart line that belongs to a supplier other than `supplierId`, or
 * `null` when the cart is empty, holds only that supplier's goods, or is being
 * re-ordered for a material already in it.
 *
 * Re-ordering an existing material is a quantity change, not a new supplier, so
 * `materialId` is passed to let that case through: without it a buyer could not
 * raise the quantity of a line that a legacy mixed cart also happens to contain.
 */
export const findOtherCartSupplier = (
  cart: CartItem[],
  supplierId: string,
  materialId?: string
): CartItem | null => {
  if (!cart || cart.length === 0) return null;
  if (materialId && cart.some(item => item.materialId === materialId)) return null;
  return cart.find(item => item.supplierId !== supplierId) || null;
};

/** True when the cart already contains goods from a supplier other than `supplierId`. */
export const cartHasOtherSupplier = (
  cart: CartItem[],
  supplierId: string,
  materialId?: string
): boolean => findOtherCartSupplier(cart, supplierId, materialId) !== null;

/**
 * Build the cart that results from adding `material` to `current`.
 *
 * Pure, so the cart modal, the product-details **Place Order** action and the
 * unit tests all share one definition of a cart line — the proforma, the order
 * rows and the on-screen summary can therefore never disagree about what was
 * bought. Returns `null` when the add would introduce a second supplier; the
 * caller must then leave the cart exactly as it was.
 *
 * `mode` decides what happens to a line that is already in the cart:
 *  - `'increment'` adds to its quantity (the cart modal's repeat add),
 *  - `'set'` replaces it, because the product-details quantity field states the
 *    total the buyer wants to order.
 */
export const stageCartLine = (
  current: CartItem[],
  material: Material,
  quantity: number,
  includeDelivery: boolean,
  supplierName: string,
  mode: 'increment' | 'set' = 'increment',
  distanceKm?: number
): CartItem[] | null => {
  const clash = findOtherCartSupplier(current, material.companyId, material.id);
  if (clash) return null;
  // Snapshot the supplier's published rate onto the line: the fee is worked out
  // from the distance later, so the cart has to remember which rate applies.
  const rate = material.delivery && material.delivery.offered ? material.delivery : undefined;
  const measured = typeof distanceKm === 'number' && isFinite(distanceKm) && distanceKm > 0
    ? roundKm(distanceKm)
    : undefined;
  const existing = current.find(item => item.materialId === material.id);
  if (existing) {
    return current.map(item => item.materialId === material.id
      ? {
          ...item,
          quantity: mode === 'set' ? quantity : item.quantity + quantity,
          includeDelivery,
          deliveryRate: rate,
          // Keep the existing measurement unless the caller passes a fresh
          // exact result (e.g. the KM the product page just displayed).
          distanceKm: measured !== undefined ? measured : item.distanceKm
        }
      : item);
  }
  const line: CartItem = {
    id: Date.now().toString(),
    materialId: material.id,
    materialName: material.name,
    supplierId: material.companyId,
    supplierName,
    quantity,
    price: material.price,
    unit: material.unit,
    minOrder: material.minOrder,
    vatPercentage: material.vatPercentage,
    specifications: material.specifications,
    basePrice: material.basePrice,
    profitMargin: material.profitMargin,
    weightPerUnit: material.specifications?.weightPerUnit || 0.001,
    includeDelivery,
    deliveryRate: rate,
    distanceKm: measured
  };
  return [...current, line];
};

// ---------- QR / share payload for proformas & orders ----------
// The QR encodes a URL (so scanning opens the app) AND the compact proforma
// data (so it works anywhere, including printed copies scanned by any phone).
// The QR always lives in the document header, whatever the cart holds, so the
// payload is trimmed to stay scannable: only the first MAX_QR_LINE_ITEMS lines
// travel, and the true count is carried in `tc`. The printed document itself
// always lists every item.

const PAYLOAD_PREFIX = 'ESCON1';

/** Line items encoded into the QR before the list is truncated for scannability. */
export const MAX_QR_LINE_ITEMS = 12;

export interface ProformaShareInput {
  proformaNumber: string;
  dateISO: string;
  buyerName: string;
  suppliers: { n: string; c: string }[];
  items: { n: string; u: string; q: number; p: number; d?: 0 | 1 }[];
  deliveryLines: { n: string; k: number; c: number }[];
  subtotal: number;
  vat: number;
  delivery: number;
  total: number;
}

/** Assemble the compact payload embedded in the proforma verification QR code. */
export const buildProformaShareData = (input: ProformaShareInput): ProformaShareData => {
  const items = input.items.map(item => ({
    n: item.n,
    u: item.u,
    q: item.q,
    p: round2(item.p),
    d: (item.d ? 1 : 0) as 0 | 1,
  }));
  const data: ProformaShareData = {
    v: 1,
    n: input.proformaNumber,
    d: input.dateISO,
    b: input.buyerName || 'Customer',
    s: input.suppliers,
    i: items.slice(0, MAX_QR_LINE_ITEMS),
    f: input.deliveryLines,
    sub: round2(input.subtotal),
    vat: round2(input.vat),
    del: round2(input.delivery),
    tot: round2(input.total),
    c: 'ETB',
  };
  if (items.length > MAX_QR_LINE_ITEMS) data.tc = items.length;
  return data;
};

export const encodeProformaPayload = (data: ProformaShareData): string => {
  const json = JSON.stringify(data);
  let b64 = json;
  if (typeof window !== 'undefined' && window.btoa) {
    b64 = window.btoa(unescape(encodeURIComponent(json)));
  } else {
    b64 = Buffer.from(json, 'utf8').toString('base64'); // SSR/node fallback
  }
  return PAYLOAD_PREFIX + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const decodeProformaPayload = (token: string): ProformaShareData | null => {
  try {
    let t = token.trim();
    if (!t.startsWith(PAYLOAD_PREFIX)) return null;
    t = t.slice(PAYLOAD_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4 !== 0) t += '=';
    let json: string;
    if (typeof window !== 'undefined' && window.atob) {
      json = decodeURIComponent(escape(window.atob(t)));
    } else {
      json = Buffer.from(t, 'base64').toString('utf8');
    }
    const data = JSON.parse(json) as ProformaShareData;
    if (!data || data.n === undefined || !Array.isArray(data.i)) return null;
    return data;
  } catch (error) {
    console.warn('Invalid proforma payload', error);
    return null;
  }
};

/**
 * Build the full URL stored in the QR code. Scanning it with a phone camera
 * opens this app (when hosted) and lands directly on the proforma view.
 */
export const buildProformaQrUrl = (data: ProformaShareData): string => {
  const token = encodeProformaPayload(data);
  const base =
    typeof window !== 'undefined' && window.location && window.location.origin
      ? window.location.origin + window.location.pathname
      : '/';
  return `${base}#escon=${token}`;
};

export const generateProformaQrDataUrl = async (data: ProformaShareData): Promise<string> => {
  const url = buildProformaQrUrl(data);
  return QRCode.toDataURL(url, { width: 160, margin: 1, errorCorrectionLevel: 'M' });
};

export const isUserLocked = (user: any) => {
  return user.lockUntil && user.lockUntil > Date.now();
};

export const normalizeEmail = (value: string): string =>
  (value || '').trim().toLowerCase();

const userRoleWeight = (user: { userType?: string }): number => {
  if (user.userType === 'admin') return 3;
  if (user.userType === 'company') return 2;
  return 1;
};

export const findLoginUser = <T extends { email?: string; password?: string; userType?: string }>(
  users: T[],
  email: string,
  password: string
): T | undefined => {
  const target = normalizeEmail(email);
  if (!target) return undefined;
  const matches = users
    .filter(user => normalizeEmail(user.email || '') === target)
    .sort((a, b) => userRoleWeight(b) - userRoleWeight(a));
  return matches.find(user => user.password === password) || matches[0];
};

export const exportToCSV = (data: any[], filename: string) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  for (const row of data) {
    const values = headers.map(header => JSON.stringify(row[header] || ''));
    csvRows.push(values.join(','));
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const printCartReport = async (reportData: any) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const suppliers = reportData.suppliers || [];
  const supplierLine = suppliers.length > 0
    ? suppliers.map((s: any) => s.supplierName).join(', ')
    : (reportData.supplierName || '');
  const qrPayload = [
    'ESCON-CART-REPORT',
    'SUPPLIER=' + supplierLine,
    'TOTAL=' + (reportData.total ? reportData.total.toFixed(2) : '0.00'),
    'CURRENCY=ETB',
    'DATE=' + (reportData.reportDate || new Date().toLocaleString())
  ].join('|');
  const qrDataUrl = await generateQRDataURL(qrPayload, 110).catch(() => '');
  const supplierBlocks = suppliers.length > 0
    ? suppliers.map((sup: any, idx: number) => `
        <div class="supplier-info">
          <h3>🏢 ${idx + 1}. ${sup.supplierName}</h3>
          <p><strong>Location:</strong> ${sup.supplierCity || 'N/A'}</p>
          <p><strong>Distance:</strong> ${sup.distanceKm.toFixed(1)} km</p>
          <p><strong>Delivery Fee:</strong> ${formatCurrency(sup.transportCost)}</p>
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Unit</th>
                <th>Quantity</th>
                <th>Unit Price (ETB, before VAT)</th>
                <th>Amount (ETB, before VAT)</th>
              </tr>
            </thead>
            <tbody>
              ${sup.items.map((item: any) => `
                <tr>
                  <td>${item.materialName}</td>
                  <td>${item.unit}</td>
                  <td>${item.quantity}</td>
                  <td>${formatCurrency(item.price)}</td>
                  <td>${formatCurrency(item.price * item.quantity)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${idx === 0 && qrDataUrl ? `<div class="qr-block">
            <img src="${qrDataUrl}" alt="QR code to verify this cart report" />
            <p>🔍 Scan to verify this cart report</p>
          </div>` : ''}
        </div>
      `).join('')
    : `
        <div class="supplier-info">
          <h3>🏢 Supplier Information</h3>
          <p><strong>Name:</strong> ${reportData.supplierName}</p>
          <p><strong>Location:</strong> ${reportData.supplierCity}</p>
          <p><strong>Distance:</strong> ${reportData.distanceKm.toFixed(1)} km</p>
          ${qrDataUrl ? `<div class="qr-block">
            <img src="${qrDataUrl}" alt="QR code to verify this cart report" />
            <p>🔍 Scan to verify this cart report</p>
          </div>` : ''}
        </div>
        <h3>📦 Cart Items</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Unit</th>
              <th>Quantity</th>
              <th>Unit Price (ETB, before VAT)</th>
              <th>Amount (ETB, before VAT)</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.items.map((item: any) => `
              <tr>
                <td>${item.materialName}</td>
                <td>${item.unit}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(item.price * item.quantity)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cart Report - E-SCON</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background: white; }
        .report-container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1a4a6f; }
        .header h1 { color: #1a4a6f; font-size: 28px; }
        .header p { color: #666; margin-top: 5px; }
        .supplier-info { background: #f0f2f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .supplier-info h3 { color: #1a4a6f; margin-bottom: 10px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        .items-table th { background: #1a4a6f; color: white; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; }
        .summary-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .summary-row.total { font-size: 20px; font-weight: bold; border-top: 2px solid #1a4a6f; margin-top: 10px; padding-top: 10px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        .qr-block { margin-top: 12px; display: flex; align-items: center; gap: 10px; }
        .qr-block img { width: 84px; height: 84px; border: 1px solid #ddd; border-radius: 6px; padding: 3px; background: #fff; }
        .qr-block p { margin: 0; font-size: 12px; color: #666; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="report-container">
        <div class="header">
          <h1>🏗️ E-SCON Cart Report</h1>
          <p>Ethio-Supply Chain Optimization Network</p>
          <p>Report Date: ${reportData.reportDate}</p>
        </div>
        ${supplierBlocks}
        <div class="summary">
          <div class="summary-row"><span>Subtotal (before VAT):</span><strong>${formatCurrency(reportData.subtotal)}</strong></div>
          <div class="summary-row"><span>VAT (${typeof reportData.vatRate === 'number' ? reportData.vatRate : addedVatRate(reportData.subtotal, reportData.vatAmount)}% added once):</span><strong>${formatCurrency(reportData.vatAmount)}</strong></div>
          <div class="summary-row"><span>Delivery Fee (${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'}):</span><strong>${formatCurrency(reportData.transportCost)}</strong></div>
          <div class="summary-row total"><span>Total Amount:</span><strong>${formatCurrency(reportData.total)}</strong></div>
        </div>
        <div class="footer">
          <p>© 2026 E-SCON | Ethio-Supply Chain Optimization Network</p>
          <p>This is a system-generated report.</p>
        </div>
      </div>
      <script>
        window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };
      </script>
    </body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
};

export const exportCartToCSV = (cart: any[], totals: any) => {
  const exportData = cart.map(item => ({
    'Material': item.materialName,
    'Supplier': item.supplierName,
    'Quantity': item.quantity,
    'Unit': item.unit,
    'Unit Price (before VAT)': item.price,
    'Line Total (before VAT)': item.price * item.quantity,
    'VAT (added once at checkout)': '',
    'Total with VAT and Delivery': ''
  }));
  exportData.push({
    'Material': '--- SUMMARY ---',
    'Supplier': '',
    'Quantity': '',
    'Unit': '',
    'Unit Price (before VAT)': '',
    'Line Total (before VAT)': totals.subtotal,
    'VAT (added once at checkout)': totals.vatAmount,
    'Total with VAT and Delivery': totals.total
  });
  exportToCSV(exportData, 'cart_detailed_report');
};

export const exportOrdersToCSV = (orders: any[], materials: any[], companies: any[]) => {
  const exportData = orders.map(order => {
    const material = materials.find(m => m.id === order.materialId);
    const company = companies.find(c => c.id === order.companyId);
    return {
      'Order ID': order.id,
      'Product': material?.name,
      'Supplier': company?.name,
      'Quantity': order.quantity,
      'Unit Price (before VAT)': order.unitPrice,
      'Transport': order.transportCost,
      'VAT (added)': order.vatAmount,
      'Total (VAT + transport)': order.totalAmount,
      'Status': order.status,
      'Date': order.orderDate
    };
  });
  exportToCSV(exportData, 'orders_export');
};

/**
 * City centres used only as a last-resort fallback when an address cannot be
 * resolved. They match the map's list so a supplier without an address still
 * appears in the right town instead of in the middle of Addis Ababa.
 */
export const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  'Addis Ababa': { lat: 9.0320, lng: 38.7469 },
  'Adama': { lat: 8.5410, lng: 39.2705 },
  'Bahir Dar': { lat: 11.6000, lng: 37.3900 },
  'Gondar': { lat: 12.6000, lng: 37.4700 },
  'Dessie': { lat: 11.1300, lng: 39.6300 },
  'Hawassa': { lat: 7.0500, lng: 38.4800 },
  'Jimma': { lat: 7.6700, lng: 36.8300 },
  'Jijiga': { lat: 9.3500, lng: 42.8000 },
  'Mekelle': { lat: 13.4900, lng: 39.4800 },
  'Dire Dawa': { lat: 9.5900, lng: 41.8700 },
  'Harar': { lat: 9.3100, lng: 42.1200 },
  'Nekemte': { lat: 9.0800, lng: 36.5300 },
  'Debre Markos': { lat: 10.3300, lng: 37.7300 },
  'Asosa': { lat: 10.0600, lng: 34.5300 },
  'Gambela': { lat: 8.2500, lng: 34.5900 },
  'Semera': { lat: 11.7900, lng: 41.0100 },
  'Debre Berhan': { lat: 9.6800, lng: 39.5300 },
  'Wolkite': { lat: 8.2800, lng: 37.7900 },
  'Bishoftu': { lat: 8.7400, lng: 38.9800 },
  'Shashemene': { lat: 7.2000, lng: 38.6000 },
};

/**
 * Resolved neighbourhood / landmark coordinates for the places used by the
 * demo catalogue and by ordinary Addis Ababa addresses. Local lookup is tried
 * before Nominatim because (a) it is instant and (b) Nominatim's public usage
 * policy allows at most one request per second. Coordinates were resolved from
 * OpenStreetMap data.
 */
const KNOWN_PLACES: { aliases: string[]; lat: number; lng: number }[] = [
  { aliases: ['bole gerji', 'gerji'], lat: 8.9940023, lng: 38.8274717 },
  { aliases: ['cmc'], lat: 9.0197660, lng: 38.8475773 },
  { aliases: ['kazanchis'], lat: 9.0159277, lng: 38.7712221 },
  { aliases: ['kality', 'akaki kality'], lat: 8.9379544, lng: 38.7630034 },
  { aliases: ['akaki'], lat: 8.8985522, lng: 38.8103421 },
  { aliases: ['piazza', 'piassa'], lat: 9.0336984, lng: 38.7547538 },
  { aliases: ['megenagna'], lat: 9.0196149, lng: 38.8016732 },
  { aliases: ['sar bet', 'sarbet'], lat: 8.9954127, lng: 38.7377105 },
  { aliases: ['gofa'], lat: 8.9808340, lng: 38.7494830 },
  { aliases: ['lebanon'], lat: 8.9984556, lng: 38.7862428 },
  { aliases: ['lideta'], lat: 9.0114751, lng: 38.7288996 },
  { aliases: ['mexico'], lat: 9.0103877, lng: 38.7445490 },
  { aliases: ['bole medhanialem'], lat: 8.9984556, lng: 38.7862428 },
  { aliases: ['bole'], lat: 8.9822541, lng: 38.8383871 },
  { aliases: ['adama'], lat: 8.5410261, lng: 39.2705461 },
];

const normalizePlace = (value: string): string =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const distanceKmBetween = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Resolve an address/city against the accurate local gazetteer. */
export const lookupKnownPlace = (address: string, city: string): { lat: number; lng: number } | null => {
  const haystack = normalizePlace(`${address || ''} ${city || ''}`);
  if (!haystack) return null;
  for (const place of KNOWN_PLACES) {
    if (place.aliases.some(alias => haystack.includes(normalizePlace(alias)))) {
      return { lat: place.lat, lng: place.lng };
    }
  }
  return null;
};

/**
 * True when a saved pin is a hand-waved "somewhere near the city centre" value
 * rather than the supplier's actual address. Such pins are safely re-geocoded;
 * a pin that already sits on its known neighbourhood is left untouched.
 */
export const isGenericCoordinate = (lat: number, lng: number, address: string, city: string): boolean => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return true;
  const known = lookupKnownPlace(address, city);
  if (known) return distanceKmBetween(lat, lng, known.lat, known.lng) > 0.5;
  const center = CITY_CENTERS[city];
  return center ? distanceKmBetween(lat, lng, center.lat, center.lng) < 2 : false;
};

// Nominatim asks clients to send no more than one request per second. Serialise
// the fallback lookups so a fresh install never gets its IP blocked.
let lastNominatimAt = 0;
const waitForNominatim = async (): Promise<void> => {
  const wait = 1100 - (Date.now() - lastNominatimAt);
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  lastNominatimAt = Date.now();
};

export const geocodeAddress = async (address: string, city: string): Promise<{ lat: number; lng: number } | null> => {
  const cleanAddress = (address || '').trim();
  const cleanCity = (city || '').trim();
  // Known Ethiopian neighbourhoods resolve instantly and consistently.
  const known = lookupKnownPlace(cleanAddress, cleanCity);
  if (known) return known;
  if (!cleanAddress && !cleanCity) return null;

  const seen = new Set<string>();
  const parts = [cleanAddress, cleanCity, 'Ethiopia']
    .filter(part => part && !seen.has(part.toLowerCase()) && seen.add(part.toLowerCase()));
  const query = encodeURIComponent(parts.join(', '));
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=jsonv2&addressdetails=1&countrycodes=et&limit=1&accept-language=en`;
  try {
    await waitForNominatim();
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Geocoding server returned ' + response.status);
    const data = await response.json();
    const first = Array.isArray(data) ? data[0] : null;
    const lat = parseFloat(first?.lat);
    const lng = parseFloat(first?.lon);
    // Reject results outside Ethiopia; a wrong country would wreck distances.
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 3.3 || lat > 15 || lng < 32.8 || lng > 48.1) {
      return null;
    }
    return { lat, lng };
  } catch (error) {
    console.warn('Geocoding failed for', address, city, error);
    return null;
  }
};

// Reverse geocoding for map clicks
export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'E-SCON-App' }
    });
    const data = await response.json();
    if (data && data.display_name) {
      return data.display_name;
    }
    return null;
  } catch (error) {
    console.warn('Reverse geocoding failed', error);
    return null;
  }
};

// ----------------------------------------------------------------//
// v6 — Advanced features: forecasts, wallets, ETA, ratings, backup //
// ----------------------------------------------------------------//

/** Deterministic ID generator for notifications, wallet txs, reviews… */
export const genId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export interface ForecastResult {
  next: number;
  change: number;
  changePct: number;
  trend: 'up' | 'down' | 'flat';
}

/**
 * Lightweight "AI" price forecast over a material's price history.
 * Uses a least-squares linear trend over the last N points and extrapolates
 * one step ahead (same unit as the prices). Gracefully falls back to the
 * latest price when there is too little history to be meaningful.
 */
export const forecastPrice = (history: PricePoint[] | undefined, basePrice: number, horizon = 1): ForecastResult | null => {
  const points = (history || []).filter(p => typeof p.price === 'number' && isFinite(p.price));
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.date - b.date).slice(-12);
  const n = sorted.length;
  const y = sorted.map(p => p.price);
  const latest = y[n - 1];
  let slope = 0;
  if (n >= 3) {
    const xAvg = (n - 1) / 2;
    const yAvg = y.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xAvg) * (y[i] - yAvg);
      den += (i - xAvg) * (i - xAvg);
    }
    slope = den > 0 ? num / den : 0;
  } else if (n === 2) {
    slope = y[1] - y[0];
  }
  const next = Math.max(0, latest + slope * horizon);
  const change = next - (basePrice || latest);
  const changePct = basePrice > 0 ? (change / basePrice) * 100 : 0;
  return { next, change, changePct, trend: changePct > 1.5 ? 'up' : changePct < -1.5 ? 'down' : 'flat' };
};

/** Effective rating = average of customer reviews when present, else base. */
export const effectiveRating = (base: number, reviews: ProductReview[] | undefined): number => {
  const list = (reviews || []).filter(r => r && typeof r.rating === 'number');
  if (list.length === 0) return base || 0;
  const avg = list.reduce((s, r) => s + r.rating, 0) / list.length;
  return Math.round(avg * 10) / 10;
};

/**
 * Wallet ledger helper — validates the operation and returns the new balance,
 * or null when the operation is not allowed (e.g. overdrawing).
 */
export const applyWalletOp = (
  balance: number,
  kind: 'topup' | 'payment' | 'income' | 'refund',
  amount: number
): number | null => {
  if (!isFinite(amount) || amount <= 0) return null;
  let next = balance;
  if (kind === 'topup' || kind === 'income' || kind === 'refund') {
    next = balance + amount;
  } else if (kind === 'payment') {
    if (balance < amount) return null;
    next = balance - amount;
  }
  return Math.round(next * 100) / 100;
};

/** Estimated delivery time from a driving distance (avg 50 km/h + margin). */
export const deliveryEta = (distanceKm: number, avgSpeedKmh = 50): string => {
  if (!isFinite(distanceKm) || distanceKm <= 0) return '—';
  const hours = distanceKm / avgSpeedKmh;
  if (hours < 1) return `~${Math.max(30, Math.round(hours * 60))} min`;
  if (hours < 24) {
    const h = Math.max(1, Math.round(hours));
    return `~${h} hr${h > 1 ? 's' : ''}`;
  }
  const d = Math.round(hours / 24);
  return `~${d} day${d > 1 ? 's' : ''}`;
};

/** Human-relative timestamp ("2h ago") for notifications & ledger. */
export const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 7) return d + 'd ago';
  return new Date(ts).toLocaleDateString('en-ET', { month: 'short', day: 'numeric' });
};

// ---------- Data Center (JSON backup & restore) ----------

const BACKUP_MAGIC = 'ESCON';

/** Validate arbitrary parsed JSON as a BackupPayload. */
export const validateBackup = (raw: unknown): BackupPayload | null => {
  try {
    if (typeof raw !== 'object' || raw === null) return null;
    const obj = raw as BackupPayload;
    if (obj.app !== BACKUP_MAGIC) return null;
    if (!Array.isArray(obj.users) || !Array.isArray(obj.companies) || !Array.isArray(obj.materials)) return null;
    if (!Array.isArray(obj.orders)) return null;
    return {
      app: BACKUP_MAGIC,
      version: obj.version || 1,
      exportedAt: obj.exportedAt || '',
      users: obj.users,
      companies: obj.companies,
      materials: obj.materials,
      orders: obj.orders,
      notifications: Array.isArray(obj.notifications) ? obj.notifications : [],
      wallets: obj.wallets && typeof obj.wallets === 'object' ? obj.wallets : {},
      transactions: Array.isArray(obj.transactions) ? obj.transactions : [],
      reviews: Array.isArray(obj.reviews) ? obj.reviews : [],
      settings: obj.settings || null,
      transporterProfiles: Array.isArray(obj.transporterProfiles) ? obj.transporterProfiles : [],
    };
  } catch (e) {
    console.warn('Backup validation failed', e);
    return null;
  }
};

/** Download a JSON file (used by Data Center export). */
export const downloadJson = (payload: BackupPayload, filename: string): void => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};