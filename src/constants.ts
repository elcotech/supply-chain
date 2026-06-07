// src/constants.ts
import { User, Company, Material, Order } from './types';

export const ETHIOPIAN_CITIES = [
  'Addis Ababa', 'Adama', 'Bahir Dar', 'Gondar', 'Hawassa',
  'Mekelle', 'Dire Dawa', 'Jimma', 'Harar', 'Bishoftu'
];

export const MEASUREMENT_UNITS = ['kg', 'ton', 'm3', 'm2', 'piece', 'gallon', 'quintal', 'pc'];

export const DEPARTMENTS = [
  'Cement', 'Reinforcement Bar', 'Glass', 'Aluminium with Glass',
  'Ceramics', 'Paint', 'Sand', 'Aggregate', 'GS Pipe', 'Valves',
  'Elbows', 'HDPE Pipe', 'PPR Pipe', 'UPVC Valve'
];

// ---------- USERS (from Excel) ----------
export const sampleUsers: User[] = [
  { id: "user1", name: "Zhiruy Anduamlak", email: "zhiruyanduamlak062@gmail.com", password: "pass123", phone: "0912345678", address: "Yeka, Woreda 09 St Sehaliemariam Square", city: "Addis Ababa", userType: "company", companyName: "Zarecom Construction & Material Supplier", lat: 9.022, lng: 38.770, registered: "2025-01-01", loginAttempts: 0, lockUntil: 0, tinNumber: "TIN12345", businessLicense: "LIC001", vatRegistered: true, vatNumber: "VAT001" },
  { id: "user2", name: "Dagnie Zerihun", email: "dagniezerihun@gmail.com", password: "pass123", phone: "904630519", address: "Lemi Kura, Woreda 02 (Aya Square)", city: "Addis Ababa", userType: "company", companyName: "B and C Aluminums", lat: 8.995, lng: 38.770, registered: "2025-01-02", loginAttempts: 0, lockUntil: 0, tinNumber: "TIN67890", businessLicense: "LIC002", vatRegistered: true, vatNumber: "VAT002" },
  { id: "user3", name: "Abiy Mamo", email: "abisha101999@gmail.com", password: "pass123", phone: "912100824", address: "Bole, Woreda 14 Emperiel Square", city: "Addis Ababa", userType: "company", companyName: "Aser Construction", lat: 9.005, lng: 38.785, registered: "2025-01-03", loginAttempts: 0, lockUntil: 0, tinNumber: "TIN11122", businessLicense: "LIC003", vatRegistered: true, vatNumber: "VAT003" },
  { id: "user4", name: "Naod M", email: "naodmyb@gmail.com", password: "pass123", phone: "919374977", address: "Yeka, Woreda 09", city: "Addis Ababa", userType: "company", companyName: "CCECC ELPA Site", lat: 9.032, lng: 38.770, registered: "2025-01-04", loginAttempts: 0, lockUntil: 0, tinNumber: "TIN44455", businessLicense: "LIC004", vatRegistered: true, vatNumber: "VAT004" },
  { id: "user5", name: "Alemayehu Ketema", email: "naodmyb@gmail.com", password: "pass123", phone: "920336159", address: "Bole Woreda 14, Yerar Ber", city: "Addis Ababa", userType: "company", companyName: "CCECC Grade 1 General Contractor", lat: 9.010, lng: 38.795, registered: "2025-01-05", loginAttempts: 0, lockUntil: 0, tinNumber: "TIN66677", businessLicense: "LIC005", vatRegistered: true, vatNumber: "VAT005" },
  { id: "user6", name: "Akakas", email: "akakaslogistics.com", password: "pass123", phone: "0911224490", address: "Kirkos, Wollo sefer", city: "Addis Ababa", userType: "customer", companyName: "", lat: 9.030, lng: 38.760, registered: "2025-01-06", loginAttempts: 0, lockUntil: 0, tinNumber: "", businessLicense: "", vatRegistered: false, vatNumber: "" },
  { id: "user7", name: "Adinas", email: "https://metrotrukinget.com/", password: "pass123", phone: "0914710861", address: "Kirkos Around Gotera", city: "Addis Ababa", userType: "customer", companyName: "", lat: 9.028, lng: 38.755, registered: "2025-01-07", loginAttempts: 0, lockUntil: 0, tinNumber: "", businessLicense: "", vatRegistered: false, vatNumber: "" },
  { id: "user8", name: "Feven Ermiyas", email: "fevenermiyas11@gmail.com", password: "pass123", phone: "991243263", address: "Bole Woreda 7, Jacros", city: "Addis Ababa", userType: "company", companyName: "3MG Trading PLC", lat: 9.015, lng: 38.780, registered: "2025-01-08", loginAttempts: 0, lockUntil: 0, tinNumber: "TIN88899", businessLicense: "LIC006", vatRegistered: true, vatNumber: "VAT006" },
  { id: "user9", name: "Yeabsra Solomon", email: "yeabsrasolomon1@gmail.com", password: "pass123", phone: "909919154", address: "Lemi Kura Around Square", city: "Addis Ababa", userType: "company", companyName: "Nati Construction Materials", lat: 8.990, lng: 38.775, registered: "2025-01-09", loginAttempts: 0, lockUntil: 0, tinNumber: "TIN00011", businessLicense: "LIC007", vatRegistered: true, vatNumber: "VAT007" },
  { id: "user10", name: "Yordanos Mulatu", email: "yordimulatu02@gmail.com", password: "pass123", phone: "911280761", address: "Bole, Woreda 7, Jacros", city: "Addis Ababa", userType: "company", companyName: "Dolphine General Trading", lat: 9.015, lng: 38.780, registered: "2025-01-10", loginAttempts: 0, lockUntil: 0, tinNumber: "TIN22233", businessLicense: "LIC008", vatRegistered: true, vatNumber: "VAT008" },
  { id: "user11", name: "AG Trading", email: "naodmyb@gmail.com", password: "pass123", phone: "0947232889", address: "Lemi Kura", city: "Addis Ababa", userType: "company", companyName: "AG Construction & Building Materials", lat: 8.995, lng: 38.770, registered: "2025-01-11", loginAttempts: 0, lockUntil: 0, tinNumber: "TIN44455", businessLicense: "LIC009", vatRegistered: true, vatNumber: "VAT009" },
  { id: "user12", name: "Afework", email: "naodmyb@gmail.com", password: "pass123", phone: "911280761", address: "Kirkos Mexico", city: "Addis Ababa", userType: "company", companyName: "Afework Building Material", lat: 9.025, lng: 38.745, registered: "2025-01-12", loginAttempts: 0, lockUntil: 0, tinNumber: "TIN66677", businessLicense: "LIC010", vatRegistered: true, vatNumber: "VAT010" },
  { id: "user13", name: "Mikias", email: "naodmyb@gmail.com", password: "pass123", phone: "0114163555", address: "Kirkos, Mexico", city: "Addis Ababa", userType: "company", companyName: "Mikias Building Materials", lat: 9.025, lng: 38.745, registered: "2025-01-13", loginAttempts: 0, lockUntil: 0, tinNumber: "TIN88899", businessLicense: "LIC011", vatRegistered: true, vatNumber: "VAT011" },
  { id: "user14", name: "SSS", email: "naodmyb@gmail.com", password: "pass123", phone: "0928012628", address: "Kality, Maseltegna", city: "Addis Ababa", userType: "company", companyName: "SSS Construction Materials PLC", lat: 9.008, lng: 38.735, registered: "2025-01-14", loginAttempts: 0, lockUntil: 0, tinNumber: "TIN00022", businessLicense: "LIC012", vatRegistered: true, vatNumber: "VAT012" }
];

// ---------- COMPANIES (from Excel) ----------
export const sampleCompanies: Company[] = [
  { id: "comp1", userId: "user1", name: "Zarecom Construction & Material Supplier", description: "Building materials supplier", location: "Yeka, Woreda 09 St Sehaliemariam Square", city: "Addis Ababa", lat: 9.022, lng: 38.770, rating: 4.5, totalOrders: 0, established: "2020", tinNumber: "TIN12345", businessLicense: "LIC001", vatNumber: "VAT001", tradeLicenseExpiry: "2026-12-31", complianceStatus: "compliant" },
  { id: "comp2", userId: "user2", name: "B and C Aluminums", description: "Aluminum and glass supplier", location: "Lemi Kura, Woreda 02 (Aya Square)", city: "Addis Ababa", lat: 8.995, lng: 38.770, rating: 4.3, totalOrders: 0, established: "2018", tinNumber: "TIN67890", businessLicense: "LIC002", vatNumber: "VAT002", tradeLicenseExpiry: "2026-12-31", complianceStatus: "compliant" },
  { id: "comp3", userId: "user3", name: "Aser Construction", description: "General contractor", location: "Bole, Woreda 14 Emperiel Square", city: "Addis Ababa", lat: 9.005, lng: 38.785, rating: 4.7, totalOrders: 0, established: "2015", tinNumber: "TIN11122", businessLicense: "LIC003", vatNumber: "VAT003", tradeLicenseExpiry: "2026-12-31", complianceStatus: "compliant" },
  { id: "comp4", userId: "user4", name: "CCECC ELPA Site", description: "Construction contractor", location: "Yeka, Woreda 09", city: "Addis Ababa", lat: 9.032, lng: 38.770, rating: 4.6, totalOrders: 0, established: "2010", tinNumber: "TIN44455", businessLicense: "LIC004", vatNumber: "VAT004", tradeLicenseExpiry: "2026-12-31", complianceStatus: "compliant" },
  { id: "comp5", userId: "user5", name: "CCECC Grade 1 General Contractor", description: "General contractor", location: "Bole Woreda 14, Yerar Ber", city: "Addis Ababa", lat: 9.010, lng: 38.795, rating: 4.8, totalOrders: 0, established: "2008", tinNumber: "TIN66677", businessLicense: "LIC005", vatNumber: "VAT005", tradeLicenseExpiry: "2026-12-31", complianceStatus: "compliant" },
  { id: "comp6", userId: "user8", name: "3MG Trading PLC", description: "Material supplier", location: "Bole Woreda 7, Jacros", city: "Addis Ababa", lat: 9.015, lng: 38.780, rating: 4.2, totalOrders: 0, established: "2019", tinNumber: "TIN88899", businessLicense: "LIC006", vatNumber: "VAT006", tradeLicenseExpiry: "2026-12-31", complianceStatus: "compliant" },
  { id: "comp7", userId: "user9", name: "Nati Construction Materials", description: "Building material supplier", location: "Lemi Kura Around Square", city: "Addis Ababa", lat: 8.990, lng: 38.775, rating: 4.4, totalOrders: 0, established: "2017", tinNumber: "TIN00011", businessLicense: "LIC007", vatNumber: "VAT007", tradeLicenseExpiry: "2026-12-31", complianceStatus: "compliant" },
  { id: "comp8", userId: "user10", name: "Dolphine General Trading", description: "General trading", location: "Bole, Woreda 7, Jacros", city: "Addis Ababa", lat: 9.015, lng: 38.780, rating: 4.1, totalOrders: 0, established: "2020", tinNumber: "TIN22233", businessLicense: "LIC008", vatNumber: "VAT008", tradeLicenseExpiry: "2026-12-31", complianceStatus: "compliant" },
  { id: "comp9", userId: "user11", name: "AG Construction & Building Materials", description: "Building materials", location: "Lemi Kura", city: "Addis Ababa", lat: 8.995, lng: 38.770, rating: 4.3, totalOrders: 0, established: "2016", tinNumber: "TIN44455", businessLicense: "LIC009", vatNumber: "VAT009", tradeLicenseExpiry: "2026-12-31", complianceStatus: "compliant" },
  { id: "comp10", userId: "user12", name: "Afework Building Material", description: "Building material", location: "Kirkos Mexico", city: "Addis Ababa", lat: 9.025, lng: 38.745, rating: 4.2, totalOrders: 0, established: "2018", tinNumber: "TIN66677", businessLicense: "LIC010", vatNumber: "VAT010", tradeLicenseExpiry: "2026-12-31", complianceStatus: "compliant" },
  { id: "comp11", userId: "user13", name: "Mikias Building Materials", description: "Building material", location: "Kirkos, Mexico", city: "Addis Ababa", lat: 9.025, lng: 38.745, rating: 4.0, totalOrders: 0, established: "2019", tinNumber: "TIN88899", businessLicense: "LIC011", vatNumber: "VAT011", tradeLicenseExpiry: "2026-12-31", complianceStatus: "compliant" },
  { id: "comp12", userId: "user14", name: "SSS Construction Materials PLC", description: "Construction materials", location: "Kality, Maseltegna", city: "Addis Ababa", lat: 9.008, lng: 38.735, rating: 4.5, totalOrders: 0, established: "2015", tinNumber: "TIN00022", businessLicense: "LIC012", vatNumber: "VAT012", tradeLicenseExpiry: "2026-12-31", complianceStatus: "compliant" }
];

// ---------- MATERIALS (from Excel price data) ----------
// Helper to assign weight per unit (tons)
const getWeightPerUnit = (category: string, unit: string): number => {
  if (unit === 'ton') return 1;
  if (unit === 'quintal') return 0.1;
  if (category === 'Cement') return 0.05;
  if (category === 'Reinforcement Bar') return 0.001;
  if (unit === 'kg') return 0.001;
  if (unit === 'm3') return 1.5;
  if (unit === 'gallon') return 0.004;
  if (unit === 'piece' || unit === 'pc') return 0.001;
  return 0.001;
};

// We create materials based on the Excel rows. For brevity, we include a representative sample.
// Full data can be added following the same pattern.
export const sampleMaterials: Material[] = [
  // Zarecom (comp1)
  { id: "mat1", companyId: "comp1", name: "OPC Dangote Cement", category: "Cement", basePrice: 1500, profitMargin: 0.15, price: 1725, quantity: 1000, unit: "quintal", minOrder: 10, description: "Dangote cement", transportCost: 15, rating: 4.5, brand: "Dangote", specifications: { weight: "50kg/bag", origin: "Ethiopia", weightPerUnit: 0.05 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  { id: "mat2", companyId: "comp1", name: "OPC Derba Cement", category: "Cement", basePrice: 1500, profitMargin: 0.15, price: 1725, quantity: 1000, unit: "quintal", minOrder: 10, description: "Derba cement", transportCost: 15, rating: 4.4, brand: "Derba", specifications: { weightPerUnit: 0.05 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  { id: "mat3", companyId: "comp1", name: "National Cement", category: "Cement", basePrice: 1600, profitMargin: 0.15, price: 1840, quantity: 800, unit: "quintal", minOrder: 10, description: "National cement", transportCost: 15, rating: 4.3, specifications: { weightPerUnit: 0.05 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  { id: "mat4", companyId: "comp1", name: "Rebar (Turkey)", category: "Reinforcement Bar", basePrice: 142, profitMargin: 0.15, price: 163.3, quantity: 5000, unit: "kg", minOrder: 100, description: "Turkish rebar", transportCost: 15, rating: 4.6, brand: "Turkey", specifications: { weightPerUnit: 0.001 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  { id: "mat5", companyId: "comp1", name: "Rebar (ETH)", category: "Reinforcement Bar", basePrice: 129, profitMargin: 0.15, price: 148.35, quantity: 5000, unit: "kg", minOrder: 100, description: "Ethiopian rebar", transportCost: 15, rating: 4.5, brand: "ETH", specifications: { weightPerUnit: 0.001 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  { id: "mat6", companyId: "comp1", name: "Glass (India)", category: "Glass", basePrice: 2400, profitMargin: 0.15, price: 2760, quantity: 2000, unit: "m2", minOrder: 10, description: "Indian glass", transportCost: 15, rating: 4.2, brand: "India", specifications: { weightPerUnit: 0.01 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  { id: "mat7", companyId: "comp1", name: "Glass (ETH)", category: "Glass", basePrice: 18000, profitMargin: 0.15, price: 20700, quantity: 500, unit: "m2", minOrder: 5, description: "Ethiopian glass", transportCost: 15, rating: 4.0, brand: "ETH", specifications: { weightPerUnit: 0.012 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  { id: "mat8", companyId: "comp1", name: "Aluminium with Glass", category: "Aluminium with Glass", basePrice: 5500, profitMargin: 0.15, price: 6325, quantity: 1000, unit: "m2", minOrder: 10, description: "Aluminium frame with glass", transportCost: 15, rating: 4.3, specifications: { weightPerUnit: 0.015 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  { id: "mat9", companyId: "comp1", name: "Ceramics", category: "Ceramics", basePrice: 2800, profitMargin: 0.15, price: 3220, quantity: 2000, unit: "m2", minOrder: 20, description: "Floor/wall tiles", transportCost: 15, rating: 4.4, specifications: { weightPerUnit: 0.02 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  { id: "mat10", companyId: "comp1", name: "Paint", category: "Paint", basePrice: 1850, profitMargin: 0.15, price: 2127.5, quantity: 500, unit: "gallon", minOrder: 5, description: "Emulsion paint", transportCost: 15, rating: 4.5, specifications: { weightPerUnit: 0.004 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  { id: "mat11", companyId: "comp1", name: "Sand Mekii", category: "Sand", basePrice: 7420, profitMargin: 0.15, price: 8533, quantity: 100, unit: "m3", minOrder: 5, description: "Fine sand", transportCost: 15, rating: 4.6, specifications: { weightPerUnit: 1.6 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  { id: "mat12", companyId: "comp1", name: "Aggregate 002", category: "Aggregate", basePrice: 5350, profitMargin: 0.15, price: 6152.5, quantity: 100, unit: "m3", minOrder: 5, description: "Crushed aggregate", transportCost: 15, rating: 4.5, specifications: { weightPerUnit: 1.5 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  // Additional materials from other companies (comp6 - 3MG Trading)
  { id: "mat13", companyId: "comp6", name: "GS Pipe 3/4", category: "GS Pipe", basePrice: 5200, profitMargin: 0.15, price: 5980, quantity: 500, unit: "piece", minOrder: 10, description: "Galvanized steel pipe", transportCost: 15, rating: 4.2, specifications: { weightPerUnit: 0.002 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  { id: "mat14", companyId: "comp6", name: "GS Get Valve 1\"", category: "Valves", basePrice: 2800, profitMargin: 0.15, price: 3220, quantity: 300, unit: "piece", minOrder: 5, description: "Gate valve", transportCost: 15, rating: 4.1, specifications: { weightPerUnit: 0.001 }, images: [], taxIncluded: true, vatPercentage: 15, lastUpdated: "2026-05-09" },
  // Add more as needed – full data can be extended.
];

export const sampleOrders: Order[] = [];