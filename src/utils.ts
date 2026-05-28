// utils.ts - Updated with proper transport cost formula

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  },
  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }
};

export const formatCurrency = (amount: number): string => {
  return `ETB ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// New Transport Cost Formula based on GIS Logistics module
// Ct = Fc + (d * Vc * w)
// Where:
// Ct = total transport Cost
// d = real-world network distance
// Fc = Fixed loading fees
// w = material weight/volume factor
export const calculateTransportCostGIS = (
  distance: number,
  weight: number,
  fixedCost: number = 500 // Default loading/unloading fee in ETB
): number => {
  const variableCostPerKm = 35; // Vc = 35 ETB per km per ton
  const weightInTons = weight / 1000; // Convert kg to tons
  const transportCost = fixedCost + (distance * variableCostPerKm * weightInTons);
  return Math.round(transportCost);
};

// Total Landed Cost Formula
// TC = [(MP * (1 + PM)) * Q] + [Fc + (d * Vc * w)]
// Where:
// TC: Total Landed Cost (The final price paid by the contractor)
// MP: Base Material Price (Market rate from bulletins/ECWRA)
// PM: Profit Margin percentage (e.g., 0.15 for 15%)
// Q: Quantity of material
// Fc: Fixed Transport Costs (Loading/Unloading)
// d: Network Distance (from GIS/Google Maps API)
// Vc: Variable Cost per kilometer
// w: Material Weight/Volume factor
export const calculateTotalLandedCost = (
  basePrice: number,
  quantity: number,
  distance: number,
  weight: number,
  profitMargin: number = 0.15
): { materialCost: number; transportCost: number; totalCost: number } => {
  // Material Cost with profit margin: MP * (1 + PM) * Q
  const materialCost = basePrice * (1 + profitMargin) * quantity;
  
  // Transport Cost: Fc + (d * Vc * w)
  const fixedCost = 500; // Fc = 500 ETB loading/unloading fee
  const variableCostPerKm = 35; // Vc = 35 ETB per km per ton
  const weightInTons = weight / 1000;
  const transportCost = fixedCost + (distance * variableCostPerKm * weightInTons);
  
  // Total Landed Cost
  const totalCost = materialCost + transportCost;
  
  return {
    materialCost: Math.round(materialCost),
    transportCost: Math.round(transportCost),
    totalCost: Math.round(totalCost)
  };
};

// Legacy function for backward compatibility
export const calculateTransportCost = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  weight: number
): number => {
  const distance = calculateDistance(lat1, lng1, lat2, lng2);
  return calculateTransportCostGIS(distance, weight);
};

export const isUserLocked = (user: any): boolean => {
  if (!user.lockUntil) return false;
  return user.lockUntil > Date.now();
};

export const resetAllData = (): void => {
  localStorage.clear();
  sessionStorage.clear();
  console.log('All data has been reset successfully');
};

export const generateInvoiceNumber = (): string => {
  const prefix = 'INV';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
};

export const calculateVAT = (amount: number, vatPercentage: number = 15): number => {
  return amount * (vatPercentage / 100);
};

export const calculateTotalWithVAT = (amount: number, vatPercentage: number = 15): number => {
  return amount + calculateVAT(amount, vatPercentage);
};

export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const re = /^[0-9]{10}$/;
  return re.test(phone);
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Export Functions for CSV and Receipt
export const exportToCSV = (data: any[], filename: string): void => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [];
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      let value = row[header];
      if (value === undefined || value === null) {
        value = '';
      }
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportCartToCSV = (cart: any[]): void => {
  if (!cart || cart.length === 0) {
    console.warn('Cart is empty');
    return;
  }
  
  const cartData = cart.map(item => ({
    'Product Name': item.materialName || '',
    'Supplier': item.supplierName || '',
    'Quantity': item.quantity || 0,
    'Unit': item.unit || '',
    'Unit Price (ETB)': item.price || 0,
    'Subtotal (ETB)': (item.price || 0) * (item.quantity || 0),
    'Min Order': item.minOrder || 0,
    'VAT %': item.vatPercentage || 15
  }));
  exportToCSV(cartData, 'cart_export');
};

export const exportOrdersToCSV = (orders: any[], materials: any[], companies: any[]): void => {
  if (!orders || orders.length === 0) {
    console.warn('No orders to export');
    return;
  }
  
  const ordersData = orders.map(order => {
    const material = materials.find(m => m.id === order.materialId);
    const company = companies.find(c => c.id === order.companyId);
    return {
      'Order ID': order.id || '',
      'Product': material?.name || 'Unknown',
      'Supplier': company?.name || 'Unknown',
      'Quantity': order.quantity || 0,
      'Unit Price (ETB)': order.unitPrice || 0,
      'Transport Cost (ETB)': order.transportCost || 0,
      'Total Amount (ETB)': order.totalAmount || 0,
      'Status': order.status || 'pending',
      'Order Date': order.orderDate || '',
      'Delivery Date': order.deliveryDate || 'Not delivered',
      'Payment Status': order.paymentStatus || 'pending'
    };
  });
  exportToCSV(ordersData, 'orders_export');
};

// New Receipt Export Function
export const exportReceipt = (orderData: any): void => {
  const receiptData = [
    { 'Field': 'E-SCON Receipt', 'Value': '' },
    { 'Field': 'Ethio-Supply Chain Optimization Network', 'Value': '' },
    { 'Field': '----------------------------------------', 'Value': '' },
    { 'Field': 'Invoice Number', 'Value': orderData.invoiceNumber || 'N/A' },
    { 'Field': 'Date', 'Value': orderData.date || new Date().toLocaleString() },
    { 'Field': '----------------------------------------', 'Value': '' },
    { 'Field': 'Supplier', 'Value': orderData.supplierName || 'N/A' },
    { 'Field': 'Supplier Location', 'Value': orderData.supplierCity || 'N/A' },
    { 'Field': 'Customer', 'Value': orderData.customerName || 'N/A' },
    { 'Field': 'Delivery Address', 'Value': orderData.deliveryAddress || 'N/A' },
    { 'Field': '----------------------------------------', 'Value': '' },
    { 'Field': 'Distance (km)', 'Value': orderData.distance?.toFixed(2) || '0' },
    { 'Field': 'Material Weight (kg)', 'Value': orderData.totalWeight?.toFixed(2) || '0' },
    { 'Field': '----------------------------------------', 'Value': '' },
    { 'Field': 'Items', 'Value': '' }
  ];
  
  // Add items
  if (orderData.items && orderData.items.length > 0) {
    orderData.items.forEach((item: any, index: number) => {
      receiptData.push({ 'Field': `  ${index + 1}. ${item.name}`, 'Value': `${item.quantity} x ${formatCurrency(item.price)}` });
      receiptData.push({ 'Field': `     Subtotal`, 'Value': formatCurrency(item.subtotal) });
    });
  }
  
  receiptData.push({ 'Field': '----------------------------------------', 'Value': '' });
  receiptData.push({ 'Field': 'Material Cost', 'Value': formatCurrency(orderData.materialCost || 0) });
  receiptData.push({ 'Field': 'Transport Cost', 'Value': formatCurrency(orderData.transportCost || 0) });
  receiptData.push({ 'Field': 'VAT (15%)', 'Value': formatCurrency(orderData.vatAmount || 0) });
  receiptData.push({ 'Field': '----------------------------------------', 'Value': '' });
  receiptData.push({ 'Field': 'TOTAL LANDED COST', 'Value': formatCurrency(orderData.totalCost || 0) });
  receiptData.push({ 'Field': '========================================', 'Value': '' });
  receiptData.push({ 'Field': 'Thank you for choosing E-SCON!', 'Value': '' });
  receiptData.push({ 'Field': 'Ethio-Supply Chain Optimization Network', 'Value': '' });
  
  exportToCSV(receiptData, `receipt_${orderData.invoiceNumber || 'order'}`);
};