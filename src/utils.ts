// utils.ts - Complete file with all required functions including exports

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

export const calculateTransportCost = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  weight: number
): number => {
  const distance = calculateDistance(lat1, lng1, lat2, lng2);
  const baseRate = 15; // ETB per km
  const weightRate = 2; // ETB per kg per km
  const cost = (baseRate * distance) + (weightRate * weight * distance);
  return Math.round(cost);
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

// Export Functions for CSV
export const exportToCSV = (data: any[], filename: string): void => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Convert data to CSV format
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      let value = row[header];
      // Handle undefined or null values
      if (value === undefined || value === null) {
        value = '';
      }
      // Handle strings with commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      // Handle objects or arrays
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  // Create blob and download
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