export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  city: string;
  userType: 'customer' | 'company';
  companyName?: string;
  lat: number;
  lng: number;
  registered: string;
  loginAttempts: number;
  lockUntil: number;
  tinNumber: string;
  businessLicense: string;
  vatRegistered: boolean;
  vatNumber: string;
}

export interface Company {
  id: string;
  userId: string;
  name: string;
  description: string;
  location: string;
  city: string;
  lat: number;
  lng: number;
  rating: number;
  totalOrders: number;
  established: string;
  tinNumber: string;
  businessLicense: string;
  vatNumber: string;
  tradeLicenseExpiry: string;
  complianceStatus: 'compliant' | 'pending' | 'non-compliant';
  logo?: string;
  website?: string;
  workingHours?: string;
  phone?: string;
  email?: string;
}

export interface Material {
  id: string;
  companyId: string;
  name: string;
  category: string;
  basePrice: number;
  profitMargin: number;
  price: number;
  quantity: number;
  unit: string;
  minOrder: number;
  description: string;
  transportCost: number;
  rating: number;
  brand?: string;
  model?: string;
  specifications?: {
    weight?: string;
    dimensions?: string;
    grade?: string;
    origin?: string;
    certification?: string[];
    weightPerUnit?: number;
    materialType?: string;
  };
  images: string[];
  taxIncluded: boolean;
  vatPercentage: number;
  lastUpdated: string;
}

export interface Order {
  id: string;
  customerId: string;
  companyId: string;
  materialId: string;
  quantity: number;
  unitPrice: number;
  transportCost: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: string;
  deliveryDate?: string;
  address: string;
  notes?: string;
  invoiceNumber: string;
  taxAmount: number;
  vatAmount: number;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
}

export interface Alert {
  message: string;
  type: 'success' | 'danger' | 'warning' | 'info';
}

export interface FormData {
  loginEmail: string;
  loginPassword: string;
  selectedUser: string;
  registerFullName: string;
  registerEmail: string;
  registerPassword: string;
  registerPhone: string;
  registerAddress: string;
  registerCity: string;
  registerCompanyName: string;
  registerUserType: string;
  tinNumber: string;
  businessLicense: string;
  vatNumber: string;
  vatRegistered: boolean;
  materialName: string;
  materialCategory: string;
  materialPrice: string;
  materialQuantity: string;
  materialUnit: string;
  materialMinOrder: string;
  materialDescription: string;
  searchQuery: string;
  searchCategory: string;
  searchMaxPrice: string;
  searchSupplier: string;
  searchCity: string;
  searchSortBy: string;
  orderQuantity: string;
  orderAddress: string;
  materialBrand: string;
  materialModel: string;
  materialWeight: string;
  materialDimensions: string;
  materialGrade: string;
  materialOrigin: string;
  materialCertifications: string;
  materialImages: string[];
  // Company edit fields
  companyName: string;
  companyDescription: string;
  companyLocation: string;
  companyCity: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  companyWorkingHours: string;
  companyTinNumber: string;
  companyBusinessLicense: string;
  companyVatNumber: string;
  companyTradeLicenseExpiry: string;
}

export interface SearchResult extends Material {
  company?: Company;
  totalCost?: number;
  estimatedTransport?: number;
  distance?: number;
}

export interface CartItem {
  id: string;
  materialId: string;
  materialName: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  price: number;
  unit: string;
  minOrder: number;
  vatPercentage: number;
  specifications?: Material['specifications'];
  basePrice: number;
  profitMargin: number;
  weightPerUnit: number;
}

export interface CartSupplier {
  supplierId: string;
  supplierName: string;
  supplierCity: string;
  distanceKm: number;
  transportCost: number;
  items: CartItem[];
}

export interface CartReport {
  items: CartItem[];
  subtotal: number;
  vatAmount: number;
  transportCost: number;
  total: number;
  distanceKm: number;
  suppliers: CartSupplier[];
  supplierName: string;
  supplierCity: string;
  itemCount: number;
  uniqueItems: number;
  currency: string;
  reportDate: string;
}