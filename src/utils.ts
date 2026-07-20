export const safeLocalStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const calculateDistance = async (originLat: number, originLng: number, destLat: number, destLng: number): Promise<number> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].distance / 1000;
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
  return R * c;
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

export const printCartReport = (reportData: any) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
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
        <div class="supplier-info">
          <h3>🏢 Supplier Information</h3>
          <p><strong>Name:</strong> ${reportData.supplierName}</p>
          <p><strong>Location:</strong> ${reportData.supplierCity}</p>
          <p><strong>Distance:</strong> ${reportData.distanceKm.toFixed(1)} km</p>
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
        <div class="summary">
          <div class="summary-row"><span>Subtotal (Before Tax):</span><strong>${formatCurrency(reportData.subtotal)}</strong></div>
          <div class="summary-row"><span>VAT (15%):</span><strong>${formatCurrency(reportData.vatAmount)}</strong></div>
          <div class="summary-row"><span>Delivery Fee:</span><strong>${formatCurrency(reportData.transportCost)}</strong></div>
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
    'VAT (15%)': (item.price * item.quantity) * 0.15,
    'Total with VAT': (item.price * item.quantity) * 1.15
  }));
  exportData.push({
    'Material': '--- SUMMARY ---',
    'Supplier': '',
    'Quantity': '',
    'Unit': '',
    'Unit Price': '',
    'Total (Before Tax)': totals.subtotal,
    'VAT (15%)': totals.vatAmount,
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