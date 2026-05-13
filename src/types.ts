export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  userType: string;
  companyName?: string;
  phone: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  registered: string;
  loginAttempts: number;
  lockUntil?: number;
  tinNumber?: string;
  businessLicense?: string;
  vatRegistered: boolean;
  vatNumber?: string;
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
  vatNumber?: string;
  tradeLicenseExpiry: string;
  complianceStatus: 'compliant' | 'pending' | 'suspended';
}

export interface Material {
  id: string;
  companyId: string;
  name: string;
  category: string;
  description: string;
  price: number;
  unit: string;
  quantity: number;
  minOrder: number;
  transportCost?: number;
  rating?: number;
  brand?: string;
  model?: string;
  specifications: {
    weight?: string;
    dimensions?: string;
    materialType?: string;
    color?: string;
    grade?: string;
    certification?: string[];
    origin?: string;
    shelfLife?: string;
    packaging?: string;
    safetyStandards?: string[];
  };
  images?: string[];
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
  status: string;
  orderDate: string;
  deliveryDate?: string;
  address: string;
  notes?: string;
  invoiceNumber?: string;
  taxAmount: number;
  vatAmount: number;
  paymentMethod: string;
  paymentStatus: string;
}

export interface Alert {
  message: string;
  type: string;
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
  searchSortBy: 'price_asc' | 'price_desc' | 'distance_asc' | 'distance_desc' | 'rating_desc' | 'newest';
  orderQuantity: string;
  orderAddress: string;
  materialBrand: string;
  materialModel: string;
  materialWeight: string;
  materialDimensions: string;
  materialGrade: string;
  materialOrigin: string;
  materialCertifications: string;
}

// Extended type for search results (includes computed fields)
export interface SearchResult extends Material {
  company?: Company;
  totalCost?: number;
  estimatedTransport?: number;
  distance?: number;
}

// Add CartItem interface for the shopping cart system
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
  specifications?: {
    weight?: string;
    dimensions?: string;
    grade?: string;
    origin?: string;
    certification?: string[];
    materialType?: string;
    color?: string;
    shelfLife?: string;
    packaging?: string;
    safetyStandards?: string[];
  };
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
  specifications?: {
    weight?: string;
    dimensions?: string;
    grade?: string;
    origin?: string;
    certification?: string[];
    materialType?: string;
    color?: string;
    shelfLife?: string;
    packaging?: string;
    safetyStandards?: string[];
  };
}