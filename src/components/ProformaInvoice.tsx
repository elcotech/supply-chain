import React, { useEffect, useRef, useState } from 'react';
import { CartItem, CartReport, User, Company, ProformaShareData, DeliveryMode } from '../types';
import {
  formatCurrency, generateProformaQrDataUrl, checkMinOrder,
  buildProformaShareData, addedVatRate,
} from '../utils';
import { loadSettings } from '../settings';

interface ProformaInvoiceProps {
  cart: CartItem[];
  report: CartReport;
  currentUser: User | null;
  /** Every supplier appearing on the proforma — one entry per cart group. */
  suppliers: Company[];
  /**
   * "To Proforma" opens the document with the browser print dialog queued, so the
   * buyer goes straight to print / save-as-PDF. "To Preview" leaves it false and
   * the document is just read on screen. Either way the figures are identical.
   */
  autoPrint?: boolean;
  onClose: () => void;
  /**
   * "Back to To Purchase": close the document and drop the buyer straight back
   * onto step 1 of the cart so they can place the order they just reviewed.
   * Falls back to `onClose` when the host does not supply it.
   */
  onBackToPurchase?: () => void;
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

const DELIVERY_MODE_LABEL: Record<DeliveryMode, string> = {
  supplier: 'Supplier rate',
  platform: 'Platform rate',
  none: 'No delivery',
};

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
  suppliers,
  autoPrint = false,
  onClose,
  onBackToPurchase,
}) => {
  // One proforma covers the whole cart, so the buyer never has to pick a supplier
  // first and the verification QR never moves out of the document header. A cart
  // holds one supplier (enforced in App.tsx); the grouping below still drives the
  // party blocks and totals so a legacy mixed cart renders correctly instead of
  // silently dropping lines.
  const items = report.items && report.items.length > 0 ? report.items : cart;
  const supplierGroups = report.suppliers || [];
  // Keep the document's party order aligned with the cart's supplier grouping.
  const supplierList = supplierGroups.length > 0
    ? supplierGroups
        .map(group => suppliers.find(s => s.id === group.supplierId) || null)
        .filter((s): s is Company => Boolean(s))
    : suppliers;
  const primarySupplier = supplierList.length === 1 ? supplierList[0] : null;

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
  // screen and when paper-printed — scanning opens a mobile-friendly view. The QR
  // is generated once from the full cart and is rendered in the document header,
  // so its position never depends on the cart.
  useEffect(() => {
    let cancelled = false;
    const shareData: ProformaShareData = buildProformaShareData({
      proformaNumber,
      dateISO: now.toISOString().split('T')[0],
      buyerName: currentUser?.name || 'Customer',
      suppliers: (report.suppliers || []).map(group => ({ n: group.supplierName, c: group.supplierCity })),
      items: items.map(i => ({
        n: i.materialName,
        u: i.unit,
        q: i.quantity,
        p: i.basePrice * (1 + i.profitMargin),
        d: i.includeDelivery === false ? 0 : 1,
      })),
      deliveryLines: (report.suppliers || [])
        .map(group => ({ n: group.supplierName, k: group.distanceKm || 0, c: group.transportCost || 0 }))
        .filter(line => line.c > 0),
      subtotal: report.subtotal,
      vat: report.vatAmount,
      delivery: report.transportCost,
      total: report.total,
    });
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
  // Prices exclude VAT: report.subtotal is the net goods value and
  // report.vatAmount is added on top, followed by delivery.
  const vatPercent = addedVatRate(report.subtotal, report.vatAmount);
  const words = amountToWords(report.total);

  const handlePrint = () => {
    window.print();
  };

  // "To Proforma" — fire the print dialog once the modal has actually painted,
  // otherwise the browser prints the page behind the overlay. One shot per open
  // (the ref is set immediately) so a re-render cannot open a second dialog.
  const autoPrintFired = useRef(false);
  useEffect(() => {
    if (!autoPrint || autoPrintFired.current) return;
    autoPrintFired.current = true;
    const timer = setTimeout(() => window.print(), 350);
    return () => clearTimeout(timer);
  }, [autoPrint]);

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
          <button
            className="btn btn-secondary"
            onClick={onBackToPurchase || onClose}
            title="Return to step 1 of the cart and place this order"
          >
            🛒 Back to To Purchase
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
                  <span className="pf-meta-label">{supplierList.length > 1 ? 'Suppliers' : 'Supplier'}</span>
                  <span className="pf-meta-value">
                    {supplierList.length === 0
                      ? '—'
                      : supplierList.length === 1
                        ? primarySupplier!.name
                        : supplierList.length + ' suppliers'}
                  </span>
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
            {box(supplierList.length > 1 ? `SUPPLIER DETAILS (${supplierList.length})` : 'SUPPLIER DETAILS', '🏢',
              supplierList.length === 0 ? (
                <>
                  {infoRow('Company Name', <strong>—</strong>)}
                  {infoRow('Address', '—')}
                </>
              ) : supplierList.map((company, index) => (
                <div key={company.id} className={index > 0 ? 'pf-supplier-alt' : undefined}>
                  {index > 0 && <div className="pf-supplier-index">SUPPLIER {index + 1}</div>}
                  {infoRow('Company Name', <strong>{company.name}</strong>)}
                  {infoRow('Address', company.city + (company.location ? ' – ' + company.location : ''))}
                  {infoRow('TIN', company.tinNumber)}
                  {infoRow('VAT No.', company.vatNumber)}
                  {infoRow('Phone', company.phone)}
                  {infoRow('Email', company.email)}
                </div>
              ))
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
              <span className="pf-section-count">
                {items.length} item{items.length === 1 ? '' : 's'} · {totalQuantity.toLocaleString()} units
                {supplierList.length > 1 ? ' · ' + supplierList.length + ' suppliers' : ''}
              </span>
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
                    <th className="pf-col-deliv">Delivery</th>
                    <th className="pf-col-price">Unit Price<br />(ETB, before VAT)</th>
                    <th className="pf-col-amount">Amount<br />(ETB, before VAT)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const unitPrice = item.basePrice * (1 + item.profitMargin);
                    const amount = unitPrice * item.quantity;
                    const withDelivery = item.includeDelivery !== false;
                    return (
                      <tr key={item.id}>
                        <td className="pf-col-no pf-numeric">{index + 1}</td>
                        <td className="pf-col-desc">
                          {item.materialName}
                          {supplierList.length > 1 && <small className="pf-line-supplier">{item.supplierName}</small>}
                        </td>
                        <td className="pf-col-spec">{specString(item) || '—'}</td>
                        <td className="pf-col-unit pf-center">{item.unit}</td>
                        <td className="pf-col-qty pf-numeric">{item.quantity.toLocaleString()}</td>
                        <td className="pf-col-deliv pf-center">
                          {withDelivery ? '🚚 Included' : '—'}
                        </td>
                        <td className="pf-col-price pf-numeric">{formatCurrency(unitPrice)}</td>
                        <td className="pf-col-amount pf-numeric pf-bold">{formatCurrency(amount)}</td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr><td colSpan={8} className="pf-empty">No items in cart.</td></tr>
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
            {/* Per-supplier delivery breakdown: which lines asked for delivery and
                which pricing rule paid for it. */}
            {supplierGroups.length > 0 && (
              <div className="pf-delivery-box">
                <div className="pf-delivery-head">
                  <span className="pf-delivery-icon">🚚</span>
                  <span>Delivery Breakdown</span>
                </div>
                {supplierGroups.map(group => (
                  <div key={group.supplierId} className="pf-delivery-row">
                    <div className="pf-delivery-name">
                      {group.supplierName}
                      <small>
                        🚗 {group.distanceKm.toFixed(1)} km · {DELIVERY_MODE_LABEL[group.deliveryMode || 'platform']}
                        {group.deliveryMode === 'supplier' && group.deliveryBasis ? ' · ' + group.deliveryBasis : ''}
                      </small>
                    </div>
                    <strong>{formatCurrency(group.transportCost)}</strong>
                  </div>
                ))}
                <div className="pf-delivery-row pf-delivery-total">
                  <div className="pf-delivery-name">Total delivery</div>
                  <strong>{formatCurrency(report.transportCost)}</strong>
                </div>
              </div>
            )}
            <div className="pf-summary">
              <div className="pf-sum-row">
                <span>Amount Before VAT</span>
                <span>{formatCurrency(report.subtotal)}</span>
              </div>
              <div className="pf-sum-row pf-vat-row">
                <span>VAT ({vatPercent}% added)</span>
                <span>{formatCurrency(report.vatAmount)}</span>
              </div>
              <div className="pf-sum-row">
                <span>Delivery Cost</span>
                <span>{formatCurrency(report.transportCost)}</span>
              </div>
              <div className="pf-sum-row pf-grand">
                <span>Grand Total</span>
                <span>{formatCurrency(report.total)}</span>
              </div>
            </div>
            <div className="pf-vat-note">
              Amount Before VAT is the net goods subtotal. VAT is added to the
              goods amount at purchase; delivery is not subject to VAT.
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
                    <em className="pf-term-note">Priced per line as marked in the Delivery column: items marked “Included” use the supplier's own rate (starting fee + per km) over the measured distance; the rest are collected by the buyer.</em>
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
          {/* One signature block per supplier on the proforma, plus the buyer. */}
          <div className="pf-signatures">
            {supplierList.length === 0 ? (
              <div className="pf-sig-box">
                <div className="pf-sig-head">Authorized Supplier Signature</div>
                <div className="pf-sig-name">—</div>
                <div className="pf-sig-line" />
                <div className="pf-sig-date">Date: {signatureDate}</div>
              </div>
            ) : supplierList.map(company => (
              <div key={company.id} className="pf-sig-box">
                <div className="pf-sig-head">Authorized Supplier Signature</div>
                <div className="pf-sig-name">{company.name}</div>
                <div className="pf-sig-line" />
                <div className="pf-sig-date">Date: {signatureDate}</div>
              </div>
            ))}
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