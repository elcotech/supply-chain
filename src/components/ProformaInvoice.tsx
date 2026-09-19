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

const ProformaInvoice: React.FC<ProformaInvoiceProps> = ({
  cart,
  report,
  currentUser,
  supplier,
  suppliers,
  onClose,
}) => {
  // Capture the timestamp once for a stable proforma number / date — not a ticking clock
  const [now] = useState(() => new Date());

  // Flexible delivery & remarks (editable per order/proforma)
  const [deliveryService, setDeliveryService] = useState('Supplier Delivery');
  const [deliveryEta, setDeliveryEta] = useState('3-5 business days');
  const [remarks, setRemarks] = useState(
    'This is a proforma invoice, not a tax invoice.\nPayment terms: 50% advance, 50% on delivery.'
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

  // QR encodes a URL + compact, non-sensitive proforma data so it works both on
  // screen and when paper-printed — scanning opens a mobile-friendly view.
  useEffect(() => {
    let cancelled = false;
    const items = (report.items || cart).map(i => ({
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
      s: (suppliers.length > 0 ? suppliers : []).map(s => ({ n: s.name, c: s.city })),
      i: items.slice(0, 40),
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

  const totalWords = numberToWords(Math.round(report.total));
  const minOrderText = cart
    .filter((i) => i.minOrder > 1)
    .map((i) => i.materialName + ': ' + i.minOrder + ' ' + i.unit)
    .join(' · ');

  // Minimum-order visibility — warn inside the document too, so the customer
  // learns about the rule before committing, not after submission.
  const settings = loadSettings();
  const minOrderCheck = checkMinOrder(settings, report.subtotal);

  const handlePrint = () => {
    window.print();
  };

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
        <div className="proforma-document">
          {/* Header */}
          <div className="proforma-header">
            <div className="proforma-logo-section">
              <div className="proforma-logo-icon">🏗️</div>
              <div>
                <h1 className="proforma-brand">E-SCON</h1>
                <p className="proforma-brand-sub">
                  Ethio-Supply Chain Optimization Network
                </p>
              </div>
            </div>
            <div className="proforma-title-section">
              <h2 className="proforma-doc-title">PROFORMA</h2>
              <div className="proforma-meta">
                <div className="proforma-meta-row">
                  <span className="meta-label">Proforma No:</span>
                  <span className="meta-value">{proformaNumber}</span>
                </div>
                <div className="proforma-meta-row">
                  <span className="meta-label">Date & Time:</span>
                  <span className="meta-value">{dt.date} · {dt.time}</span>
                </div>
                <div className="proforma-meta-row">
                  <span className="meta-label">Currency:</span>
                  <span className="meta-value">ETB – Ethiopian Birr</span>
                </div>
                <div className="proforma-meta-row">
                  <span className="meta-label">Valid Until:</span>
                  <span className="meta-value">
                    {new Date(
                      now.getTime() + 30 * 24 * 60 * 60 * 1000
                    ).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="proforma-divider" />

          {/* Parties — Supplier(s) & Buyer side-by-side */}
          <div className="proforma-parties">
            <div className="proforma-party">
              <h4 className="party-title">
                Supplier Details
                {suppliers.length > 1 && (
                  <span className="party-count"> ({suppliers.length} suppliers)</span>
                )}
              </h4>
              <div className="party-details">
                {suppliers.length > 0 ? (
                  suppliers.map((s, idx) => (
                    <div key={s.id} className={'party-supplier' + (idx > 0 ? ' party-supplier-alt' : '')}>
                      {suppliers.length > 1 && (
                        <p className="party-supplier-index">Supplier {idx + 1}</p>
                      )}
                      <p><strong>{s.name}</strong></p>
                      <p>📍 {s.city}{s.location ? ' - ' + s.location : ''}</p>
                      {s.tinNumber && <p>📋 TIN: {s.tinNumber}</p>}
                      {s.vatNumber && <p>💰 VAT: {s.vatNumber}</p>}
                      {s.phone && <p>📞 {s.phone}</p>}
                    </div>
                  ))
                ) : (
                  <p><strong>{supplier?.name || 'N/A'}</strong></p>
                )}
              </div>
            </div>
            <div className="proforma-party">
              <h4 className="party-title">Buyer Details</h4>
              <div className="party-details">
                <p><strong>{currentUser?.name || 'N/A'}</strong></p>
                <p>📍 {currentUser?.city || 'N/A'}</p>
                {currentUser?.address && <p>{currentUser.address}</p>}
                <p>📧 {currentUser?.email || 'N/A'}</p>
                <p>📞 {currentUser?.phone || 'N/A'}</p>
                {currentUser?.tinNumber && (
                  <p>📋 TIN: {currentUser.tinNumber}</p>
                )}
              </div>
            </div>
          </div>

          <div className="proforma-divider" />

          {/* Financial Summary — upper part, immediately visible */}
          <div className="proforma-summary-section">
            <div className="proforma-amount-words">
              <h4>Amount in Words</h4>
              <p className="amount-words-text">{totalWords} Ethiopian Birr Only</p>
              <p className="amount-items-line">
                {report.uniqueItems} line item{report.uniqueItems === 1 ? '' : 's'} · {report.itemCount} unit{report.itemCount === 1 ? '' : 's'} total
              </p>
            </div>
            <div className="proforma-summary-right">
              <h4>Financial Summary</h4>
              <div className="summary-table">
                <div className="summary-line">
                  <span>Subtotal (Before Tax):</span>
                  <span>{formatCurrency(report.subtotal)}</span>
                </div>
                <div className="summary-line">
                  <span>VAT ({Math.round(report.vatAmount / Math.max(report.subtotal, 0.01) * 100)}%):</span>
                  <span>{formatCurrency(report.vatAmount)}</span>
                </div>
                {suppliers.length > 1 ? (
                  <>
                    <div className="summary-line">
                      <span>Delivery / Transport Fee ({suppliers.length} suppliers):</span>
                      <span>{formatCurrency(report.transportCost)}</span>
                    </div>
                    {suppliers.map((s, idx) => (
                      <div key={s.id} className="summary-line summary-line-sub">
                        <span>↳ {idx + 1}. {s.name} ({s.distanceKm.toFixed(1)} km)</span>
                        <span>{formatCurrency(s.transportCost)}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="summary-line">
                      <span>Delivery / Transport Fee:</span>
                      <span>{formatCurrency(report.transportCost)}</span>
                    </div>
                    <div className="summary-line">
                      <span>Distance:</span>
                      <span>{report.distanceKm.toFixed(1)} km</span>
                    </div>
                  </>
                )}
                <div className="summary-line grand-total">
                  <span>GRAND TOTAL:</span>
                  <span>{formatCurrency(report.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="proforma-divider" />

          {/* Items Table — all selected items, no duplicates, no omissions */}
          <div className="proforma-items-section">
            <h4 className="section-heading">📦 ORDER ITEMS</h4>
            <div className="proforma-table-wrapper">
              <table className="proforma-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item Description</th>
                    <th>Supplier</th>
                    <th>Unit</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Subtotal</th>
                    <th>VAT ({Math.round(report.vatAmount / Math.max(report.subtotal, 0.01) * 100)}%)</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => {
                    const unitPrice = item.basePrice * (1 + item.profitMargin);
                    const itemSubtotal = unitPrice * item.quantity;
                    const itemVat = itemSubtotal * (item.vatPercentage / 100);
                    const itemTotal = itemSubtotal + itemVat;
                    return (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{item.materialName}</strong>
                          {(item.specifications?.materialType || item.specifications?.grade) && (
                            <small className="item-spec">
                              {' '}
                              {item.specifications?.materialType ||
                                item.specifications?.grade}
                            </small>
                          )}
                        </td>
                        <td className="proforma-supplier">{item.supplierName}</td>
                        <td>{item.unit}</td>
                        <td>{item.quantity.toLocaleString()}</td>
                        <td>{formatCurrency(unitPrice)}</td>
                        <td>{formatCurrency(itemSubtotal)}</td>
                        <td>{formatCurrency(itemVat)}</td>
                        <td className="proforma-price">{formatCurrency(itemTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="proforma-divider" />

          {/* Notes, Delivery & Remarks — flexible per order */}
          <div className="proforma-notes-section no-print-borders">
            <h4>📝 Notes, Delivery & Remarks</h4>
            <div className="note-fields-grid">
              <div className="proforma-field">
                <label htmlFor="pf-delivery-service">Delivery Service</label>
                <select
                  id="pf-delivery-service"
                  value={deliveryService}
                  onChange={(e) => setDeliveryService(e.target.value)}
                >
                  <option value="Supplier Delivery">Supplier Delivery</option>
                  <option value="Customer Pickup">Customer Pickup</option>
                  <option value="Courier Service">Courier Service</option>
                  <option value="Custom Arrangement">Custom Arrangement</option>
                </select>
              </div>
              <div className="proforma-field">
                <label htmlFor="pf-delivery-eta">Delivery ETA</label>
                <input
                  id="pf-delivery-eta"
                  type="text"
                  value={deliveryEta}
                  onChange={(e) => setDeliveryEta(e.target.value)}
                  placeholder="e.g. 3-5 business days"
                />
              </div>
            </div>
            <div className="proforma-field">
              <label htmlFor="pf-remarks">Notes & Remarks</label>
              <textarea
                id="pf-remarks"
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
            {minOrderText && (
              <p className="min-order-note">
                🗒️ Minimum order per item: {minOrderText}
              </p>
            )}
          </div>

          <div className="proforma-divider" />

          {/* Minimum-order advisory (only when the rule is enabled) */}
          {minOrderCheck.enabled && (
            <div className={(minOrderCheck.below ? 'min-order-warning' : 'min-order-ok')}>
              {minOrderCheck.below ? (
                <>⚠️ Order below minimum. Minimum goods value: {formatCurrency(minOrderCheck.amount)} — your subtotal is {formatCurrency(minOrderCheck.subtotal)}.</>
              ) : (
                <>✅ Meets minimum order requirement ({formatCurrency(minOrderCheck.amount)}).</>
              )}
            </div>
          )}

          {/* Terms & Conditions — compact, side-by-side columns */}
          <div className="proforma-terms">
            <h4>📜 Terms & Conditions</h4>
            <div className="terms-grid">
              <div className="term-item">
                <strong>1. Payment Terms</strong>
                <p>50% advance payment required. Balance due upon delivery. Accepted: Bank Transfer, Mobile Money.</p>
              </div>
              <div className="term-item">
                <strong>2. Delivery</strong>
                <p>Estimated 3-5 business days from order confirmation. Subject to stock availability.</p>
              </div>
              <div className="term-item">
                <strong>3. Warranty</strong>
                <p>Standard manufacturer warranty applies. Damaged goods must be reported within 48 hours.</p>
              </div>
              <div className="term-item">
                <strong>4. Compliance</strong>
                <p>All transactions comply with Ethiopian Trade Regulations and VAT requirements.</p>
              </div>
              <div className="term-item">
                <strong>5. Returns</strong>
                <p>Unopened items may be returned within 7 days. Restocking fee of 10% may apply.</p>
              </div>
              <div className="term-item">
                <strong>6. Disputes</strong>
                <p>Any disputes shall be resolved under Ethiopian law in Addis Ababa courts.</p>
              </div>
            </div>
          </div>

          <div className="proforma-divider" />

          {/* Signatures */}
          <div className="proforma-signatures">
            <div className="signature-block">
              <div className="signature-line" />
              <p className="signature-label">Authorized Supplier Signature</p>
              <p className="signature-name">{suppliers.length > 1 ? 'All Listed Suppliers' : (suppliers[0]?.name || supplier?.name || '')}</p>
              <p className="signature-date">Date: _______________</p>
            </div>
            <div className="signature-block">
              <div className="signature-line" />
              <p className="signature-label">Buyer's Acknowledgment</p>
              <p className="signature-name">{currentUser?.name || ''}</p>
              <p className="signature-date">Date: _______________</p>
            </div>
          </div>

          {/* Footer — only QR & contact (the E-SCON heading appears once, above) */}
          <div className="proforma-footer">
            <p>Ethio-Supply Chain Optimization Network</p>
            <p>
              📧 meharinageb@gmail.com | 📱 +251909919154
            </p>
            <p className="proforma-footer-legal">
              This document was generated electronically and is valid without
              signature or stamp.
            </p>
            <div className="proforma-qr-block">
              {qrStatus === 'generating' && (
                <p className="proforma-qr-caption">Generating QR code…</p>
              )}
              {qrStatus === 'failed' && (
                <p className="proforma-qr-caption">QR code unavailable.</p>
              )}
              {qrStatus === 'ready' && qrDataUrl && (
                <>
                  <img
                    className="proforma-qr-img"
                    src={qrDataUrl}
                    alt={'QR code to view Proforma ' + proformaNumber}
                  />
                  <p className="proforma-qr-caption">
                    🔍 Scan to view Proforma {proformaNumber}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper: convert number to words (simplified for ETB)
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