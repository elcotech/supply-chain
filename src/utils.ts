import QRCode from 'qrcode';
import { SystemSettings, ProformaShareData } from './types';

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

export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' });
};

// In-memory cache so repeated distance lookups (search, cart, map) don't hammer OSRM
const distanceCache = new Map<string, number>();

export const calculateDistance = async (originLat: number, originLng: number, destLat: number, destLng: number): Promise<number> => {
  const key = `${originLat.toFixed(4)},${originLng.toFixed(4)},${destLat.toFixed(4)},${destLng.toFixed(4)}`;
  const cached = distanceCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const dist = data.routes[0].distance / 1000;
      distanceCache.set(key, dist);
      return dist;
    }
  } catch (error) {
    console.warn("OSRM failed, using haversine fallback", error);
  }
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
  /** Cart goods subtotal (before VAT & delivery) — used for free-delivery. */
  orderSubtotal: number;
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

  const distance = await calculateDistance(
    input.supplierLat, input.supplierLng,
    input.customerLat, input.customerLng
  );
  const base = numberOr(s.distanceBaseFee, 0);
  const perKmPerTon = numberOr(s.distancePerKmPerTon, 0);
  return Math.max(0, base + distance * perKmPerTon * Math.max(input.weightTons, 0.001));
};

const numberOr = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && isFinite(value) && value >= 0 ? value : fallback;

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

// ---------- QR / share payload for proformas & orders ----------
// The QR encodes a URL (so scanning opens the app) AND the compact proforma
// data (so it works anywhere, including printed copies scanned by any phone).

const PAYLOAD_PREFIX = 'ESCON1';

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
                <th>Unit Price (ETB)</th>
                <th>Total (ETB)</th>
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
              <th>Unit Price (ETB)</th>
              <th>Total (ETB)</th>
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
          <div class="summary-row"><span>Subtotal (Before Tax):</span><strong>${formatCurrency(reportData.subtotal)}</strong></div>
          <div class="summary-row"><span>VAT (${Math.round(reportData.vatAmount / Math.max(reportData.subtotal, 0.01) * 100)}%):</span><strong>${formatCurrency(reportData.vatAmount)}</strong></div>
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
    'Unit Price': item.price,
    'Total (Before Tax)': item.price * item.quantity,
    ['VAT (' + (item.vatPercentage || 15) + '%)']: (item.price * item.quantity) * ((item.vatPercentage || 15) / 100),
    'Total with VAT': (item.price * item.quantity) * (1 + ((item.vatPercentage || 15) / 100))
  }));
  exportData.push({
    'Material': '--- SUMMARY ---',
    'Supplier': '',
    'Quantity': '',
    'Unit': '',
    'Unit Price': '',
    'Total (Before Tax)': totals.subtotal,
    ['VAT (' + Math.round(totals.vatAmount / Math.max(totals.subtotal, 0.01) * 100) + '%)']: totals.vatAmount,
    'Total with VAT': totals.subtotal + totals.vatAmount
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
      'Unit Price': order.unitPrice,
      'Transport': order.transportCost,
      'VAT': order.vatAmount,
      'Total': order.totalAmount,
      'Status': order.status,
      'Date': order.orderDate
    };
  });
  exportToCSV(exportData, 'orders_export');
};

export const geocodeAddress = async (address: string, city: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const query = encodeURIComponent(`${address}, ${city}, Ethiopia`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'E-SCON-App' }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
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