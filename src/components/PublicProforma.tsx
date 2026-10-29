// ===== src/components/PublicProforma.tsx =====
// Mobile-friendly proforma view opened by scanning a QR code (URL plus
// compact JSON payload embedded in the QR). Works with zero backend because
// the non-sensitive order summary travels inside the QR itself.
import React from 'react';
import { ProformaShareData } from '../types';
import { formatCurrency, addedVatRate } from '../utils';

interface PublicProformaProps {
  data: ProformaShareData;
  onClose: () => void;
}

const PublicProforma: React.FC<PublicProformaProps> = ({ data, onClose }) => {
  const totalQuantity = data.i.reduce((sum, it) => sum + (Number(it.q) || 0), 0);
  const vatPercent = addedVatRate(data.sub, data.vat);

  return (
    <div className="public-proforma-overlay">
      <div className="public-proforma">
        <div className="public-proforma-top">
          <div className="public-proforma-brand">E-SCON</div>
          <button className="btn-secondary no-print" onClick={onClose}>✕ Close</button>
        </div>

        <div className="public-proforma-doc">
          <div className="public-proforma-head">
            <div>
              <h2 className="public-proforma-title">PROFORMA / ORDER</h2>
              <p className="public-proforma-sub">Ethio-Supply Chain Optimization Network</p>
            </div>
            <div className="public-proforma-meta">
              <span><em>No:</em> {data.n}</span>
              <span><em>Date:</em> {data.d}</span>
              <span><em>Buyer:</em> {data.b || 'Customer'}</span>
            </div>
          </div>

          {data.s && data.s.length > 0 && (
            <div className="public-proforma-suppliers">
              {data.s.map((s, idx) => (
                <span key={idx}>🏢 {s.n}{s.c ? ` · ${s.c}` : ''}</span>
              ))}
            </div>
          )}

          <table className="public-proforma-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Delivery</th>
                <th>Unit Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {data.i.map((item, idx) => {
                const unitPrice = Number(item.p) || 0;
                const qty = Number(item.q) || 0;
                return (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{item.n}</td>
                    <td>{qty.toLocaleString()}</td>
                    <td>{item.u}</td>
                    <td>{item.d ? '🚚 Yes' : '—'}</td>
                    <td>{formatCurrency(unitPrice)}</td>
                    <td className="p-pf-price">{formatCurrency(unitPrice * qty)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {data.tc !== undefined && data.tc > data.i.length && (
            <p className="public-proforma-note">
              Showing the first {data.i.length} of {data.tc} line items — the printed
              proforma lists every item.
            </p>
          )}

          {data.f && data.f.length > 0 && (
            <div className="public-proforma-suppliers">
              {data.f.map((line, idx) => (
                <span key={idx}>
                  🚚 {line.n}: {(Number(line.k) || 0).toFixed(1)} km — {formatCurrency(Number(line.c) || 0)}
                </span>
              ))}
            </div>
          )}

          <div className="public-proforma-summary">
            <div><span>Items:</span><strong>{data.i.length} line item{data.i.length === 1 ? '' : 's'} · {totalQuantity.toLocaleString()} units</strong></div>
            <div><span>Amount Before VAT:</span><strong>{formatCurrency(data.sub)}</strong></div>
            <div><span>VAT ({vatPercent}% added once on goods):</span><strong>{formatCurrency(data.vat)}</strong></div>
            <div><span>Delivery Fee:</span><strong>{formatCurrency(data.del)}</strong></div>
            <div className="p-pf-grand"><span>GRAND TOTAL:</span><strong>{formatCurrency(data.tot)}</strong></div>
            <div className="p-pf-currency">All amounts in ETB – Ethiopian Birr</div>
          </div>

          <p className="public-proforma-note">
            This document was generated electronically by the E-SCON platform.
            For questions, contact the supplier or E-SCON support.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicProforma;