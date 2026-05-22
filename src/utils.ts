import { CartItem, CartSummary } from './types';

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage not available');
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage not available');
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage not available');
    }
  }
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const calculateTransportCost = (fromLat: number, fromLng: number, toLat: number, toLng: number, quantity: number): number => {
  const distance = calculateDistance(fromLat, fromLng, toLat, toLng);
  const baseRate = 500;
  const ratePerKm = 15;
  const quantityFactor = Math.max(1, quantity / 100);
  return Math.round(baseRate + (distance * ratePerKm * quantityFactor));
};

export const isUserLocked = (user: { lockUntil?: number }): boolean => {
  if (user.lockUntil && user.lockUntil > Date.now()) return true;
  return false;
};

// NEW: Cart Calculation Utilities
export const calculateCartSummary = (items: CartItem[]): CartSummary => {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const vatTotal = items.reduce((sum, item) => sum + item.vatAmount, 0);
  const transportTotal = 0; // Will be calculated per supplier at checkout
  const grandTotal = subtotal + vatTotal + transportTotal;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueSuppliers = new Set(items.map(item => item.companyId)).size;
  
  return { subtotal, vatTotal, transportTotal, grandTotal, itemCount, uniqueSuppliers };
};

export const calculateItemTotals = (price: number, quantity: number, vatPercentage: number) => {
  const subtotal = price * quantity;
  const vatAmount = subtotal * (vatPercentage / 100);
  const total = subtotal + vatAmount;
  return { subtotal, vatAmount, total };
};

// Generate unique ID
export const generateId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};