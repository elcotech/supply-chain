import React, { useEffect, useState } from 'react';
import { CartItem, CartReport, User, Company, ProformaShareData } from '../types';
import { formatCurrency, generateProformaQrDataUrl, checkMinOrder } from '../utils';
import { loadSettings } from '../settings';

export interface ProformaSupplier extends Company {
  transportCost: number;
  distanceKm: number;
}

interface ProformaInvoiceProps {
  cart: CartItem[];
  report: CartReport;
  currentUser: User | null;
  supplier: Company | null;
  suppliers: ProformaSupplier[];
  onClose: () => void;
}

// Standard / specification helper: builds "PN 16, ISO 4427" style strings from
// the product metadata the application actually stores.
function specString(item: CartItem): string {
  const s = item.specifications;
  if (!s) return '';
  const parts: string[] = [];
  if (s.materialType) parts.push(s.materialType);
  if (s.grade) parts.push(s.grade);
  if (s.dimensions) parts.push(s.dimensions);
  if (s.weight) parts.push(s.weight);
  if (s.origin) parts.push(s.origin);
  if (s.certification && s.certification.length > 0) parts.push(s.certification.join(', '));
  return parts.join(' · ');
}

// Convert an amount into English words with Birr + cents support.
function amountToWords(amount: number): string {
  const abs = Math.abs(amount);
  const birr = Math.floor(abs);
  const cents = Math.round((abs - birr) * 100);
  const birrText = (birr === 0 ? 'Zero' : numberToWords(birr)) + ' Ethiopian Birr';
  const centText = cents > 0
    ? ' and ' + numberToWords(cents) + (cents === 1 ? ' Cent' : ' Cents')
    : '';
  return birrText + centText + ' Only';
}

const ProformaInvoice: React.FC<ProformaInvoiceProps> = ({
  cart,
  report,
  currentUser,
  supplier,
  suppliers,
  onClose,
}) => {
  // A proforma invoice is always issued by a single supplier, so the document
  // renders one supplier block and only that supplier's line items.
  const items = report.items && report.items.length > 0 ? report.items : cart;
  const primarySupplier = suppliers.length > 0 ? suppliers[0] : supplier;

  // Capture the timestamp once for a stable proforma number / date — not a ticking clock
  const [now] = useState(() => new Date());

  // Flexible delivery & remarks (editable per order/proforma). Editable inputs
  // render as plain text when printed.
  const [deliveryService, setDeliveryService] = useState('Supplier Delivery');
  const [deliveryEta, setDeliveryEta] = useState('3-5 business days');
  const [remarks, setRemarks] = useState(
    'Please confirm the delivery address and contact number before dispatch.'
  );
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrStatus, setQrStatus] = useState<'generating' | 'ready' | 'failed'>('generating');

  const formatDateTime = (date: Date) => ({
    date: date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
  });

  const dt = formatDateTime(now);
  const proformaNumber =
    'PI-' +
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getTime()).slice(-6);

  const validUntil = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000
  ).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const signatureDate =
    String(now.getDate()).padStart(2, '0') +
    ' / ' +
    String(now.getMonth() + 1).padStart(2, '0') +
    ' / ' +
    now.getFullYear();

  // QR encodes a URL + compact, non-sensitive proforma data so it works both on
  // screen and when paper-printed — scanning opens a mobile-friendly view.
  useEffect(() => {
    let cancelled = false;
    const shareItems = items.map(i => ({
      n: i.materialName,
      u: i.unit,
      q: i.quantity,
      p: Math.round((i.basePrice * (1 + i.profitMargin)) * 100) / 100,
    }));
    const shareData: ProformaShareData = {
      v: 1,
      n: proformaNumber,
      d: now.toISOString().split('T')[0],
      b: currentUser?.name || 'Customer',
      s: primarySupplier ? [{ n: primarySupplier.name, c: primarySupplier.city }] : [],
      i: shareItems.slice(0, 40),
      sub: Math.round(report.subtotal * 100) / 100,
      vat: Math.round(report.vatAmount * 100) / 100,
      del: Math.round(report.transportCost * 100) / 100,
      tot: Math.round(report.total * 100) / 100,
      c: 'ETB',
    };
    setQrStatus('generating');
    generateProformaQrDataUrl(shareData)
      .then(url => { if (!cancelled) { setQrDataUrl(url); setQrStatus('ready'); } })
      .catch(() => { if (!cancelled) { setQrDataUrl(''); setQrStatus('failed'); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settings = loadSettings();
  const minOrderCheck = checkMinOrder(settings, report.subtotal);

  // ------------------------------------------------------------------ finance
  const vatPercent = report.subtotal > 0
    ? Math.round((report.vatAmount / report.subtotal) * 100)
    : 0;
  const totalBeforeVat = report.subtotal + report.transportCost;
  const words = amountToWords(report.total);

  const handlePrint = () => {
    window.print();
  };

  // ----------------------------------------------------------------- parts
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const supplierNotes = items
    .filter((i) => i.minOrder > 1)
    .map((i) => i.materialName + ': ' + i.minOrder + ' ' + i.unit)
    .join(' · ');

  const box = (title: string, icon: string, children: React.ReactNode) => (
    <div className="pf-box">
      <div className="pf-box-head">
        <span className="pf-box-icon">{icon}</span>
        <span>{title}</span>
      </div>
      <div className="pf-box-body">{children}</div>
    </div>
  );

  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="pf-info-row">
      <span className="pf-info-label">{label}</span>
      <span className="pf-info-value">{value || '—'}</span>
    </div>
  );

  const termItem = (icon: string, title: string, body: React.ReactNode) => (
    <div className="pf-term-item">
      <span className="pf-term-icon">{icon}</span>
      <div className="pf-term-text">
        <strong>{title}:</strong> {body}
      </div>
    </div>
  );

  return (
    <div className="proforma-overlay" onClick={onClose}>
      <div className="proforma-container" onClick={(e) => e.stopPropagation()}>
        {/* Action Bar */}
        <div className="proforma-actions no-print">
          <button className="btn btn-primary" onClick={handlePrint}>
            🖨️ Print Proforma
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            ← Back to Cart
          </button>
        </div>

        {/* Invoice Document */}
        <div className="proforma-document pf-document">
          {/* ============================= HEADER ============================= */}
          <div className="pf-header">
            <div className="pf-brand">
              <div className="pf-logo">
                <img
                  src={process.env.PUBLIC_URL + '/logo512.png'}
                  alt="E-SCON logo"
                  className="pf-logo-img"
                />
              </div>
              <div className="pf-company">
                <h1 className="pf-company-name">E-SCON</h1>
                <p className="pf-company-full">Ethio-Supply Chain Optimization Network</p>
                <p className="pf-tagline">
                  Smarter Supply Chains&nbsp;&nbsp;|&nbsp;&nbsp;Better Decisions&nbsp;&nbsp;|&nbsp;&nbsp;A Stronger Ethiopia
                </p>
              </div>
            </div>

            <div className="pf-meta">
              <div className="pf-title-banner">
                <div className="pf-banner-stripe">
                  <span />
                  <span />
                </div>
                <h2 className="pf-title">Proforma Invoice</h2>
              </div>
              <div className="pf-meta-rows">
                <div className="pf-meta-row">
                  <span className="pf-meta-label">Supplier</span>
                  <span className="pf-meta-value">{primarySupplier?.name || '—'}</span>
                </div>
                <div className="pf-meta-row">
                  <span className="pf-meta-label">Proforma No.</span>
                  <span className="pf-meta-value">{proformaNumber}</span>
                </div>
                <div className="pf-meta-row">
                  <span className="pf-meta-label">Date &amp; Time</span>
                  <span className="pf-meta-value">{dt.date} – {dt.time}</span>
                </div>
                <div className="pf-meta-row">
                  <span className="pf-meta-label">Currency</span>
                  <span className="pf-meta-value">ETB – Ethiopian Birr</span>
                </div>
                <div className="pf-meta-row">
                  <span className="pf-meta-label">Valid Until</span>
                  <span className="pf-meta-value">{validUntil}</span>
                </div>
              </div>
            </div>

            <div className="pf-header-qr">
              {qrStatus === 'generating' && (
                <div className="pf-qr">
                  <div className="pf-qr-img pf-qr-img-placeholder" />
                  <p className="pf-qr-caption">Generating…</p>
                </div>
              )}
              {qrStatus === 'failed' && (
                <p className="pf-qr-caption">QR code unavailable.</p>
              )}
              {qrStatus === 'ready' && qrDataUrl && (
                <div className="pf-qr">
                  <img
                    className="pf-qr-img"
                    src={qrDataUrl}
                    alt={'QR code to view Proforma ' + proformaNumber}
                  />
                  <p className="pf-qr-caption">🔍 Scan to verify</p>
                </div>
              )}
            </div>
          </div>

          {/* ============================= PARTIES ============================= */}
          <div className="pf-parties">
            {box('SUPPLIER DETAILS', '🏢',
              primarySupplier ? (
                <>
                  {infoRow('Company Name', <strong>{primarySupplier.name}</strong>)}
                  {infoRow('Address', primarySupplier.city + (primarySupplier.location ? ' – ' + primarySupplier.location : ''))}
                  {infoRow('TIN', primarySupplier.tinNumber)}
                  {infoRow('VAT No.', primarySupplier.vatNumber)}
                  {infoRow('Contact Person', '—')}
                  {infoRow('Phone', primarySupplier.phone)}
                  {infoRow('Email', primarySupplier.email)}
                </>
              ) : (
                <>
                  {infoRow('Company Name', <strong>—</strong>)}
                  {infoRow('Address', '—')}
                </>
              )
            )}

            {box('BUYER DETAILS', '👤',
              <>
                {infoRow('Company Name', <strong>{currentUser?.name || '—'}</strong>)}
                {infoRow('Address', currentUser?.city ? currentUser.city + (currentUser.address ? ' – ' + currentUser.address : '') : '—')}
                {infoRow('TIN', currentUser?.tinNumber)}
                {infoRow('VAT No.', currentUser?.vatNumber)}
                {infoRow('Contact Person', currentUser?.name || '—')}
                {infoRow('Phone', currentUser?.phone)}
                {infoRow('Email', currentUser?.email)}
              </>
            )}
          </div>

          {/* ============================= ITEMS ============================= */}
          <div className="pf-items">
            <div className="pf-section-head">
              <span className="pf-section-icon">🛒</span>
              <span>Order Items</span>
              <span className="pf-section-count">{items.length} item{items.length === 1 ? '' : 's'} · {totalQuantity.toLocaleString()} units</span>
            </div>
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th className="pf-col-no">No.</th>
                    <th className="pf-col-desc">Item Description</th>
                    <th className="pf-col-spec">Standard / Specification</th>
                    <th className="pf-col-unit">Unit</th>
                    <th className="pf-col-qty">Qty</th>
                    <th className="pf-col-price">Unit Price<br />(ETB)</th>
                    <th className="pf-col-amount">Amount<br />(ETB)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const unitPrice = item.basePrice * (1 + item.profitMargin);
                    const amount = unitPrice * item.quantity;
                    return (
                      <tr key={item.id}>
                        <td className="pf-col-no pf-numeric">{index + 1}</td>
                        <td className="pf-col-desc">{item.materialName}</td>
                        <td className="pf-col-spec">{specString(item) || '—'}</td>
                        <td className="pf-col-unit pf-center">{item.unit}</td>
                        <td className="pf-col-qty pf-numeric">{item.quantity.toLocaleString()}</td>
                        <td className="pf-col-price pf-numeric">{formatCurrency(unitPrice)}</td>
                        <td className="pf-col-amount pf-numeric pf-bold">{formatCurrency(amount)}</td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr><td colSpan={7} className="pf-empty">No items in cart.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {minOrderCheck.enabled && (
              <div className={minOrderCheck.below ? 'pf-min-order pf-min-order-warn' : 'pf-min-order'}>
                {minOrderCheck.below
                  ? <>⚠️ Order below the configured minimum goods value of {formatCurrency(minOrderCheck.amount)} — subtotal is {formatCurrency(minOrderCheck.subtotal)}.</>
                  : <>✅ Meets the minimum order requirement ({formatCurrency(minOrderCheck.amount)}).</>}
              </div>
            )}
          </div>

          {/* ============================= SUMMARY ============================= */}
          <div className="pf-summary-wrap">
            <div className="pf-summary">
              <div className="pf-sum-row">
                <span>Subtotal (Goods)</span>
                <span>{formatCurrency(report.subtotal)}</span>
              </div>
              <div className="pf-sum-row">
                <span>Delivery Cost</span>
                <span>{formatCurrency(report.transportCost)}</span>
              </div>
              <div className="pf-sum-row">
                <span>Total Before VAT</span>
                <span>{formatCurrency(totalBeforeVat)}</span>
              </div>
              <div className="pf-sum-row">
                <span>VAT ({vatPercent}%)</span>
                <span>{formatCurrency(report.vatAmount)}</span>
              </div>
              <div className="pf-sum-row pf-grand">
                <span>Grand Total</span>
                <span>{formatCurrency(report.total)}</span>
              </div>
            </div>
            {/* The words sit directly under the numeric total. */}
            <div className="pf-words">
              <div className="pf-words-label">
                <span className="pf-words-icon">💰</span>
                Amount in Words
              </div>
              <div className="pf-words-text">{words}</div>
            </div>
          </div>

          {/* ============================= TERMS ============================= */}
          <div className="pf-terms">
            <div className="pf-section-head">
              <span className="pf-section-icon">📋</span>
              <span>Terms, Conditions, Delivery &amp; Remarks</span>
            </div>
            <div className="pf-terms-grid">
              <div className="pf-terms-col">
                {termItem('💳', 'Payment Terms',
                  <span className="pf-editable-inline">
                    50% advance required. Balance due upon delivery.
                  </span>)}
                {termItem('🚚', 'Delivery',
                  <span className="pf-editable-inline">
                    <select
                      className="pf-inline-edit pf-inline-select"
                      value={deliveryService}
                      onChange={(e) => setDeliveryService(e.target.value)}
                      aria-label="Delivery service"
                    >
                      <option value="Supplier Delivery">Supplier Delivery</option>
                      <option value="Customer Pickup">Customer Pickup</option>
                      <option value="Courier Service">Courier Service</option>
                      <option value="Custom Arrangement">Custom Arrangement</option>
                    </select>{' '}
                    — <input
                      className="pf-inline-edit pf-inline-input"
                      type="text"
                      value={deliveryEta}
                      onChange={(e) => setDeliveryEta(e.target.value)}
                      aria-label="Delivery ETA"
                    /> from order confirmation. Subject to stock availability.
                  </span>)}
                {termItem('🛡️', 'Warranty',
                  <span>Standard manufacturer warranty applies. Damaged goods must be reported within 48 hours.</span>)}
              </div>
              <div className="pf-terms-col">
                {termItem('↩️', 'Returns',
                  <span>Unopened items may be returned within 7 days. Restocking fee of 10% may apply.</span>)}
                {termItem('💱', 'Pricing',
                  <span>Prices are subject to change without prior notice.</span>)}
                {termItem('📝', 'Remarks',
                  <textarea
                    className="pf-inline-edit pf-inline-textarea"
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    aria-label="Remarks"
                  />)}
              </div>
            </div>
            {supplierNotes && (
              <div className="pf-min-order">🗒️ Minimum order per item: {supplierNotes}</div>
            )}
          </div>

          {/* ============================= SIGNATURES ============================= */}
          <div className="pf-signatures">
            <div className="pf-sig-box">
              <div className="pf-sig-head">Authorized Supplier Signature</div>
              <div className="pf-sig-name">{primarySupplier?.name || '—'}</div>
              <div className="pf-sig-line" />
              <div className="pf-sig-date">Date: {signatureDate}</div>
            </div>
            <div className="pf-sig-box">
              <div className="pf-sig-head">Buyer's Acknowledgment</div>
              <div className="pf-sig-name">{currentUser?.name || '—'}</div>
              <div className="pf-sig-line" />
              <div className="pf-sig-date">Date: {signatureDate}</div>
            </div>
          </div>

          {/* ============================= FOOTER ============================= */}
          <div className="pf-footer">
            <div className="pf-footer-left">
              <div className="pf-footer-brand">E-SCON</div>
              <div className="pf-footer-brand-sub">Ethio-Supply Chain Optimization Network</div>
            </div>
            <div className="pf-footer-center">
              <p className="pf-footer-contact">
                <span>📧 meharinageb@gmail.com</span>
                <span className="pf-footer-divider">|</span>
                <span>📱 +251909919154</span>
              </p>
              <p className="pf-footer-legal">
                This document was generated electronically and is valid without signature or stamp.
              </p>
              <p className="pf-footer-copy">
                Proforma {proformaNumber} · Generated {dt.date} {dt.time}
              </p>
            </div>
            <div className="pf-footer-right" aria-hidden="true">
              <div className="pf-foot-graphic">
                <span className="pf-foot-shape pf-foot-shape-blue" />
                <span className="pf-foot-shape pf-foot-shape-yellow" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper: convert an integer to English words (reused by amountToWords).
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
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

  return convert(num);
}

export default ProformaInvoice;