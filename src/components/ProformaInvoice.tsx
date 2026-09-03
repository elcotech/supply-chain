import React, { useEffect, useState } from 'react';
import { CartItem, CartReport, User, Company } from '../types';

interface ProformaInvoiceProps {
  cart: CartItem[];
  report: CartReport;
  currentUser: User | null;
  supplier: Company | null;
  onClose: () => void;
}

const ProformaInvoice: React.FC<ProformaInvoiceProps> = ({
  cart,
  report,
  currentUser,
  supplier,
  onClose,
}) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(amount);

  const formatDateTime = (date: Date) => ({
    date: date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
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

  const totalWords = numberToWords(Math.round(report.total));

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
            ✕ Close
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
              <h2 className="proforma-doc-title">PROFORMA INVOICE</h2>
              <div className="proforma-meta">
                <div className="proforma-meta-row">
                  <span className="meta-label">Invoice No:</span>
                  <span className="meta-value">{proformaNumber}</span>
                </div>
                <div className="proforma-meta-row">
                  <span className="meta-label">Date:</span>
                  <span className="meta-value">{dt.date}</span>
                </div>
                <div className="proforma-meta-row">
                  <span className="meta-label">Time:</span>
                  <span className="meta-value">{dt.time}</span>
                </div>
                <div className="proforma-meta-row">
                  <span className="meta-label">Currency:</span>
                  <span className="meta-value">ETB (Ethiopian Birr)</span>
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

          {/* Parties */}
          <div className="proforma-parties">
            <div className="proforma-party">
              <h4 className="party-title">FROM (Supplier)</h4>
              <div className="party-details">
                <p>
                  <strong>{supplier?.name || 'N/A'}</strong>
                </p>
                <p>📍 {supplier?.location || supplier?.city || 'N/A'}</p>
                <p>🏙️ {supplier?.city || 'N/A'}</p>
                {supplier?.tinNumber && <p>📋 TIN: {supplier.tinNumber}</p>}
                {supplier?.vatNumber && <p>💰 VAT: {supplier.vatNumber}</p>}
                <p>📞 {supplier?.phone || 'N/A'}</p>
              </div>
            </div>
            <div className="proforma-party">
              <h4 className="party-title">TO (Buyer)</h4>
              <div className="party-details">
                <p>
                  <strong>{currentUser?.name || 'N/A'}</strong>
                </p>
                <p>📍 {currentUser?.address || 'N/A'}</p>
                <p>🏙️ {currentUser?.city || 'N/A'}</p>
                <p>📧 {currentUser?.email || 'N/A'}</p>
                <p>📞 {currentUser?.phone || 'N/A'}</p>
                {currentUser?.tinNumber && (
                  <p>📋 TIN: {currentUser.tinNumber}</p>
                )}
              </div>
            </div>
          </div>

          <div className="proforma-divider" />

          {/* Items Table */}
          <div className="proforma-items-section">
            <h4 className="section-heading">📦 ORDER ITEMS</h4>
            <div className="proforma-table-wrapper">
              <table className="proforma-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item Description</th>
                    <th>Brand/Model</th>
                    <th>Origin</th>
                    <th>Unit</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Subtotal</th>
                    <th>VAT (15%)</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => {
                    const itemSubtotal = item.basePrice * (1 + item.profitMargin) * item.quantity;
                    const itemVat = itemSubtotal * (item.vatPercentage / 100);
                    const itemTotal = itemSubtotal + itemVat;
                    return (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{item.materialName}</strong>
                          {item.specifications?.weight && (
                            <small> (Wt: {item.specifications.weight})</small>
                          )}
                        </td>
                        <td>
                          {item.specifications?.materialType || item.specifications?.grade || '—'}
                        </td>
                        <td>{item.specifications?.origin || 'Ethiopia'}</td>
                        <td>{item.unit}</td>
                        <td>{item.quantity.toLocaleString()}</td>
                        <td>{formatCurrency(item.basePrice * (1 + item.profitMargin))}</td>
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

          {/* Financial Summary */}
          <div className="proforma-summary-section">
            <div className="proforma-summary-left">
              <div className="proforma-amount-words">
                <h4>Amount in Words</h4>
                <p className="amount-words-text">{totalWords} Ethiopian Birr Only</p>
              </div>
              <div className="proforma-notes">
                <h4>Notes & Remarks</h4>
                <ul>
                  <li>This is a proforma invoice, not a tax invoice.</li>
                  <li>Payment terms: 50% advance, 50% on delivery.</li>
                  <li>Delivery estimated within 3-5 business days.</li>
                  <li>Goods remain property of supplier until full payment.</li>
                </ul>
              </div>
            </div>
            <div className="proforma-summary-right">
              <h4>Financial Summary</h4>
              <div className="summary-table">
                <div className="summary-line">
                  <span>Total Items:</span>
                  <span>{report.uniqueItems} unique ({report.itemCount} total)</span>
                </div>
                <div className="summary-line">
                  <span>Subtotal (Before Tax):</span>
                  <span>{formatCurrency(report.subtotal)}</span>
                </div>
                <div className="summary-line">
                  <span>VAT (15%):</span>
                  <span>{formatCurrency(report.vatAmount)}</span>
                </div>
                <div className="summary-line">
                  <span>Delivery/Transport Fee:</span>
                  <span>{formatCurrency(report.transportCost)}</span>
                </div>
                <div className="summary-line">
                  <span>Distance:</span>
                  <span>{report.distanceKm.toFixed(1)} km</span>
                </div>
                <div className="summary-line grand-total">
                  <span>GRAND TOTAL:</span>
                  <span>{formatCurrency(report.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="proforma-divider" />

          {/* Terms & Conditions */}
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
              <p className="signature-name">{supplier?.name || ''}</p>
              <p className="signature-date">Date: _______________</p>
            </div>
            <div className="signature-block">
              <div className="signature-line" />
              <p className="signature-label">Buyer's Acknowledgment</p>
              <p className="signature-name">{currentUser?.name || ''}</p>
              <p className="signature-date">Date: _______________</p>
            </div>
          </div>

          {/* Footer */}
          <div className="proforma-footer">
            <p>🏗️ E-SCON — Ethio-Supply Chain Optimization Network</p>
            <p>
              📧 meharinageb@gmail.com | 📱 +251909919154 | 🌐 www.e-scon.et
            </p>
            <p className="proforma-footer-legal">
              This document was generated electronically and is valid without
              signature or stamp.
            </p>
            <p className="proforma-timestamp">
              Generated: {dt.date} at {dt.time}
            </p>
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
