import { User, Company, Material, Order } from './types';

export const ETHIOPIAN_CITIES = [
  'Addis Ababa', 'Dire Dawa', 'Mekele', 'Gondar', 'Bahir Dar', 'Hawassa',
  'Jimma', 'Jinka', 'Arba Minch', 'Adama', 'Asella', 'Debre Markos',
  'Debre Birhan', 'Dessie', 'Harar', 'Nekemte', 'Shashamane', 'Sodo',
  'Wolaita Sodo', 'Bishoftu', 'Adigrat', 'Axum', 'Goba', 'Gode', 'Jijiga',
  'Mizan Teferi', 'Semera', 'Woldia', 'Assosa', 'Gambela'
];

export const MEASUREMENT_UNITS = [
  'Kilogram (KG)', 'Gram (g)', 'Liter (L)', 'Milliliter (mL)', 
  'Meter (m)', 'Centimeter (cm)', 'Millimeter (mm)', 'Square Meter (m²)', 
  'Cubic Meter (m³)', 'Piece', 'Box', 'Bag', 'Carton', 'Roll', 
  'Sheet', 'Bundle', 'Pair', 'Set', 'Ton', 'Quintal'
];

export const DEPARTMENTS = [
  'Agriculture', 'Construction', 'Manufacturing', 'Healthcare', 
  'Education', 'Transportation', 'Energy', 'Information Technology',
  'Textile & Apparel', 'Food & Beverage', 'Pharmaceuticals', 'Mining',
  'Tourism', 'Real Estate', 'Telecommunications', 'Banking & Finance',
  'Government', 'NGO', 'Retail', 'Wholesale', 'Logistics', 'Automotive',
  'Electronics', 'Chemical', 'Plastic', 'Metal Works', 'Wood & Furniture',
  'Printing & Packaging', 'Water & Sanitation', 'Environmental'
];

// Sample data – types are now explicitly correct
export const sampleUsers: User[] = [
  {
    id: 'user1',
    name: 'Mehari Admin',
    email: 'meharinageb@gmail.com',
    password: 'password123',
    userType: 'company',
    companyName: 'Mehari General Supplies PLC',
    phone: '+251909919154',
    address: 'Bole Road, Addis Ababa, Ethiopia',
    city: 'Addis Ababa',
    lat: 8.9806,
    lng: 38.7578,
    registered: '2023-01-15',
    loginAttempts: 0,
    lockUntil: 0,
    tinNumber: 'ET0001234567',
    businessLicense: 'BL/ET/2023/001',
    vatRegistered: true,
    vatNumber: 'VAT00123456'
  },
  {
    id: 'user2',
    name: 'John Customer',
    email: 'customer@example.com',
    password: 'password123',
    userType: 'customer',
    companyName: '',
    phone: '+251 912 345 678',
    address: 'Megenagna, Addis Ababa, Ethiopia',
    city: 'Addis Ababa',
    lat: 9.0227,
    lng: 38.7468,
    registered: '2023-02-20',
    loginAttempts: 0,
    lockUntil: 0,
    vatRegistered: false
  }
];

export const sampleCompanies: Company[] = [
  {
    id: 'comp1',
    userId: 'user1',
    name: 'Mehari General Supplies PLC',
    description: 'Premium supplier for various industrial and consumer goods',
    location: 'Bole Road, Addis Ababa',
    city: 'Addis Ababa',
    lat: 8.9806,
    lng: 38.7578,
    rating: 4.8,
    totalOrders: 124,
    established: '2020',
    tinNumber: 'ET0001234567',
    businessLicense: 'BL/ET/2023/001',
    vatNumber: 'VAT00123456',
    tradeLicenseExpiry: '2025-12-31',
    complianceStatus: 'compliant'
  },
  {
    id: 'comp2',
    userId: 'user3',
    name: 'Ethio Industrial Supplies PLC',
    description: 'Industrial materials wholesale',
    location: 'Merkato, Addis Ababa',
    city: 'Addis Ababa',
    lat: 9.0300,
    lng: 38.7500,
    rating: 4.5,
    totalOrders: 89,
    established: '2019',
    tinNumber: 'ET0002345678',
    businessLicense: 'BL/ET/2019/045',
    vatNumber: 'VAT00234567',
    tradeLicenseExpiry: '2024-12-31',
    complianceStatus: 'compliant'
  },
  {
    id: 'comp3',
    userId: 'user4',
    name: 'Jimma Agricultural Supplies',
    description: 'Agricultural equipment supplier',
    location: 'Jimma Main Road',
    city: 'Jimma',
    lat: 7.6667,
    lng: 36.8333,
    rating: 4.3,
    totalOrders: 67,
    established: '2018',
    tinNumber: 'ET0003456789',
    businessLicense: 'BL/ET/2018/123',
    vatNumber: 'VAT00345678',
    tradeLicenseExpiry: '2024-12-31',
    complianceStatus: 'compliant'
  }
];

export const sampleMaterials: Material[] = [
  {
    id: 'mat1',
    companyId: 'comp1',
    name: 'Portland Cement - 42.5 Grade',
    category: 'Construction',
    description: 'High quality Portland cement 42.5 Grade for construction.',
    price: 850,
    unit: '50kg bag',
    quantity: 500,
    minOrder: 10,
    transportCost: 15,
    rating: 4.5,
    brand: 'Dangote',
    model: 'PC-42.5',
    specifications: {
      weight: '50kg',
      dimensions: 'N/A',
      grade: '42.5',
      origin: 'Ethiopia',
      certification: ['ES Standard', 'ISO 9001']
    },
    taxIncluded: true,
    vatPercentage: 15,
    lastUpdated: '2024-01-15'
  },
  {
    id: 'mat2',
    companyId: 'comp1',
    name: 'Medical Gloves - Nitrile',
    category: 'Healthcare',
    description: 'Disposable medical gloves, powder-free.',
    price: 120,
    unit: 'Box (100 pcs)',
    quantity: 1000,
    minOrder: 5,
    transportCost: 8,
    rating: 4.7,
    brand: 'MediSafe',
    model: 'NG-100',
    specifications: {
      weight: '200g per box',
      grade: 'Medical Grade',
      origin: 'China',
      certification: ['FDA Approved', 'CE Mark']
    },
    taxIncluded: true,
    vatPercentage: 15,
    lastUpdated: '2024-01-10'
  },
  {
    id: 'mat3',
    companyId: 'comp2',
    name: 'Fertilizer Urea - 46%',
    category: 'Agriculture',
    description: 'Agricultural grade urea fertilizer.',
    price: 950,
    unit: '50kg bag',
    quantity: 2000,
    minOrder: 20,
    transportCost: 12,
    rating: 4.3,
    brand: 'AgriMax',
    model: 'U-46',
    specifications: {
      weight: '50kg',
      grade: '46% N',
      origin: 'Ethiopia',
      certification: ['ES Standard']
    },
    taxIncluded: true,
    vatPercentage: 15,
    lastUpdated: '2024-01-12'
  },
  {
    id: 'mat4',
    companyId: 'comp3',
    name: 'Agricultural Plough',
    category: 'Agriculture',
    description: 'Heavy duty agricultural plough.',
    price: 4500,
    unit: 'Piece',
    quantity: 50,
    minOrder: 1,
    transportCost: 350,
    rating: 4.4,
    brand: 'FarmPro',
    model: 'HD-PL400',
    specifications: {
      weight: '45kg',
      dimensions: '150 x 60 x 90 cm',
      grade: 'Commercial Grade',
      origin: 'Ethiopia'
    },
    taxIncluded: true,
    vatPercentage: 15,
    lastUpdated: '2024-01-05'
  }
];

export const sampleOrders: Order[] = [
  {
    id: 'order1',
    customerId: 'user2',
    companyId: 'comp1',
    materialId: 'mat1',
    quantity: 50,
    unitPrice: 850,
    transportCost: 750,
    totalAmount: 43000,
    status: 'delivered',
    orderDate: '2023-10-15',
    deliveryDate: '2023-10-18',
    address: 'Megenagna, Addis Ababa',
    invoiceNumber: 'INV-2023-001',
    taxAmount: 6450,
    vatAmount: 967.5,
    paymentMethod: 'Bank Transfer',
    paymentStatus: 'paid'
  }
];