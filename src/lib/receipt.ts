import { Company, Material, Order, User } from '../types';
import { formatCurrency, formatDate } from '../utils';

const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char] || char));

const row = (label: string, value: unknown) => `
  <div class="receipt-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;

export const printOrderReceipt = (order: Order, buyer?: User, supplier?: Company, material?: Material): boolean => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  const subtotal = order.quantity * order.unitPrice;
  const vat = order.vatAmount || 0;
  const transport = order.transportCost || 0;
  const total = order.totalAmount || subtotal + vat + transport;
  const itemName = material?.name || order.materialId;
  const description = material?.description ? `<div class="receipt-item-desc">${escapeHtml(material.description)}</div>` : '';
  const reference = order.orderNumber || order.invoiceNumber || order.id;
  const date = formatDate(order.orderDate);
  const deliveryAddress = (order as any).deliveryAddress || order.address || 'Not provided';

  printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(reference)} - E-SCON receipt</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; background: #eef2f7; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .receipt { width: 92mm; max-width: 100%; margin: 0 auto; padding: 8mm; background: #fff; box-shadow: 0 8px 30px rgba(15,23,42,.16); }
    .receipt-brand { text-align: center; border-bottom: 2px solid #0b2f52; padding-bottom: 10px; margin-bottom: 12px; }
    .receipt-brand strong { display: block; font-size: 20px; letter-spacing: 2px; color: #0b2f52; }
    .receipt-brand span { display: block; font-size: 10px; letter-spacing: 1px; color: #64748b; margin-top: 3px; }
    .receipt h1 { font-size: 15px; text-align: center; margin: 0 0 4px; color: #0b2f52; }
    .receipt-ref { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 14px; }
    .receipt-divider { border-top: 1px dashed #94a3b8; margin: 12px 0; }
    .receipt-section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin: 0 0 6px; }
    .receipt-row { display: flex; justify-content: space-between; gap: 10px; font-size: 11px; line-height: 1.7; }
    .receipt-row span { color: #64748b; }
    .receipt-row strong { text-align: right; color: #111827; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
    th, td { padding: 7px 4px; text-align: left; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    th { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; }
    .num { text-align: right; white-space: nowrap; }
    .receipt-item-desc { font-size: 9px; color: #64748b; margin-top: 3px; }
    .receipt-total { font-size: 14px; font-weight: 800; color: #0b2f52; }
    .receipt-total-row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 10px; padding-top: 10px; border-top: 2px solid #0b2f52; }
    .receipt-sign { display: flex; justify-content: space-between; gap: 14px; margin-top: 28px; font-size: 10px; }
    .receipt-sign div { flex: 1; border-top: 1px solid #94a3b8; padding-top: 6px; text-align: center; color: #64748b; }
    .receipt-foot { margin-top: 16px; text-align: center; font-size: 9px; color: #64748b; line-height: 1.6; }
    .receipt-badge { display: inline-block; padding: 3px 7px; border-radius: 20px; background: #ecfdf5; color: #047857; font-size: 9px; font-weight: 700; }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt { box-shadow: none; margin: 0; width: 100%; }
    }
  </style>
</head>
<body>
  <main class="receipt">
    <div class="receipt-brand">
      <strong>E-SCON</strong>
      <span>ETHIO-SUPPLY CHAIN OPTIMIZATION NETWORK</span>
    </div>
    <h1>ORDER RECEIPT</h1>
    <div class="receipt-ref">${escapeHtml(reference)}</div>
    <div style="text-align:center;margin-bottom:12px;"><span class="receipt-badge">${escapeHtml(order.paymentStatus)} payment</span></div>

    <div class="receipt-divider"></div>
    <p class="receipt-section-title">Transaction details</p>
    ${row('Receipt date', date)}
    ${row('Order status', order.status)}
    ${row('Payment method', order.paymentMethod)}
    ${row('Delivery address', deliveryAddress)}

    <div class="receipt-divider"></div>
    <p class="receipt-section-title">Supplier</p>
    ${row('Company', supplier?.name || 'Not available')}
    ${row('Location', supplier?.location || supplier?.city || 'Not available')}
    ${row('TIN / VAT', [supplier?.tinNumber, supplier?.vatNumber].filter(Boolean).join(' / ') || 'Not provided')}

    <div class="receipt-divider"></div>
    <p class="receipt-section-title">Buyer</p>
    ${row('Name', buyer?.name || 'Not available')}
    ${row('Phone', buyer?.phone || 'Not provided')}
    ${row('E-mail', buyer?.email || 'Not provided')}

    <div class="receipt-divider"></div>
    <p class="receipt-section-title">Items</p>
    <table>
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>${escapeHtml(itemName)}</strong>${description}</td>
          <td class="num">${escapeHtml(order.quantity)}</td>
          <td class="num">${escapeHtml(formatCurrency(order.unitPrice))}</td>
          <td class="num">${escapeHtml(formatCurrency(subtotal))}</td>
        </tr>
      </tbody>
    </table>

    <div class="receipt-divider"></div>
    ${row('Goods subtotal', formatCurrency(subtotal))}
    ${row('VAT', formatCurrency(vat))}
    ${row('Delivery / transport', order.deliveryIncluded ? formatCurrency(transport) : 'Not included')}
    <div class="receipt-total-row"><span>TOTAL PAID / PAYABLE</span><span class="receipt-total">${escapeHtml(formatCurrency(total))}</span></div>

    <div class="receipt-sign"><div>Supplier signature</div><div>Buyer signature</div></div>
    <div class="receipt-foot">
      Thank you for using E-SCON.<br />
      This receipt is generated from the E-SCON order record for ${escapeHtml(reference)}.
    </div>
  </main>
</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
  return true;
};
