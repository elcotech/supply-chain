// src/utils.ts
export const safeLocalStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
};

export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-ET');
};

// Real distance using OSRM (free, no API key)
export const calculateDistance = async (originLat: number, originLng: number, destLat: number, destLng: number): Promise<number> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].distance / 1000; // meters to km
    }
  } catch (error) {
    console.warn("OSRM failed, using haversine fallback", error);
  }
  // Fallback to straight-line distance (Haversine)
  const R = 6371;
  const dLat = (destLat - originLat) * Math.PI / 180;
  const dLon = (destLng - originLng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(originLat * Math.PI/180) * Math.cos(destLat * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Transport cost formula: Tc = [Fc + (d * Vc * w)]
export const calculateTransportCost = async (
  supplierLat: number, supplierLng: number,
  customerLat: number, customerLng: number,
  totalWeightTons: number,
  fixedCost: number = 500,      // Fc
  variableCostPerKmPerTon: number = 50  // Vc
): Promise<number> => {
  const distance = await calculateDistance(supplierLat, supplierLng, customerLat, customerLng);
  return fixedCost + (distance * variableCostPerKmPerTon * totalWeightTons);
};

// Full landed cost: Tc = [(MP*(1+PM))*Q] + [Fc + (d * Vc * w)]
export const calculateLandedCost = async (
  basePrice: number,
  profitMargin: number,
  quantity: number,
  weightPerUnit: number,
  supplierLat: number, supplierLng: number,
  customerLat: number, customerLng: number,
  fixedCost: number = 500,
  variableCostPerKmPerTon: number = 50
): Promise<{ materialCost: number; transportCost: number; totalLanded: number; distanceKm: number }> => {
  const sellingPrice = basePrice * (1 + profitMargin);
  const materialCost = sellingPrice * quantity;
  const totalWeight = weightPerUnit * quantity;
  const distance = await calculateDistance(supplierLat, supplierLng, customerLat, customerLng);
  const transportCost = fixedCost + (distance * variableCostPerKmPerTon * totalWeight);
  const totalLanded = materialCost + transportCost;
  return { materialCost, transportCost, totalLanded, distanceKm: distance };
};

export const isUserLocked = (user: any) => {
  return user.lockUntil && user.lockUntil > Date.now();
};

// CSV exports
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

export const exportCartToCSV = (cart: any[]) => {
  const exportData = cart.map(item => ({
    'Material': item.materialName,
    'Supplier': item.supplierName,
    'Quantity': item.quantity,
    'Unit': item.unit,
    'Unit Price': item.price,
    'Total': item.price * item.quantity
  }));
  exportToCSV(exportData, 'cart_export');
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
      'Total': order.totalAmount,
      'Status': order.status,
      'Date': order.orderDate
    };
  });
  exportToCSV(exportData, 'orders_export');
};