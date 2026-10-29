export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  city: string;
  userType: 'customer' | 'company' | 'admin';
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

/**
 * Delivery terms a supplier publishes for a material.
 *
 * When `offered` is true the buyer can tick "include delivery cost" on that cart
 * line and the fee is the supplier's own rate: a flat *delivery service starting
 * fee* plus a *per-kilometre* charge applied to the real supplier -> buyer
 * distance, which is only known later (at cart/proforma time). When the supplier
 * leaves it off, the platform's admin-configured delivery rules apply instead.
 */
export interface MaterialDelivery {
  offered: boolean;
  /** ETB charged for every kilometre travelled (0 = distance is not billed). */
  perKm: number;
  /** Flat "delivery service starting fee" (ETB) charged once delivery is used. */
  startFee: number;
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
  /** Optional per-km delivery terms published by the supplier. */
  delivery?: MaterialDelivery;
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
  /** Rolling price-snapshot history used by the AI price-forecast chart. */
  priceHistory?: PricePoint[];
}

/** A single price snapshot (timestamp + selling price) in a material's history. */
export interface PricePoint {
  date: number;
  price: number;
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
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  /** True when the buyer ticked "include delivery cost" for this order line. */
  deliveryIncluded?: boolean;
  /** True when this order was settled from the buyer's E-SCON wallet. */
  walletPayment?: boolean;
  /** True once the supplier's wallet has been credited for a paid order. */
  revenueCredited?: boolean;
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
  registerLat: number;
  registerLng: number;
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
  materialProfitMargin: string;
  materialTransportCost: string;
  materialVatPercentage: string;
  materialTaxIncluded: boolean;
  materialWeightPerUnit: string;
  materialImages: string[];
  materialDeliveryOffered: boolean;
  materialDeliveryPerKm: string;
  materialDeliveryStartFee: string;
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
  /**
   * The buyer's "with / without delivery cost" choice for this line. Optional so
   * carts persisted before the option existed still load; `undefined` is read as
   * `true` (delivery included), which is how the cart has always behaved.
   */
  includeDelivery?: boolean;
  /** The supplier's published per-km rate, snapshotted when the line was added. */
  deliveryRate?: MaterialDelivery;
}

/** How a supplier's delivery fee was priced for one cart/order. */
export type DeliveryMode = 'supplier' | 'platform' | 'none';

export interface CartSupplier {
  supplierId: string;
  supplierName: string;
  supplierCity: string;
  distanceKm: number;
  transportCost: number;
  items: CartItem[];
  /** Whether this supplier's fee came from its own per-km rate, the platform, or nowhere. */
  deliveryMode?: DeliveryMode;
  /** Short human-readable pricing basis, e.g. "15 ETB/km + 300 ETB start". */
  deliveryBasis?: string;
}

export interface CartReport {
  items: CartItem[];
  subtotal: number;
  vatAmount: number;
  /** VAT rate (%) applied once to the aggregate goods subtotal. */
  vatRate?: number;
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
  /* Delivery & minimum-order metadata resolved against system settings */
  freeDeliveryApplied?: boolean;
  minOrderEnabled?: boolean;
  minOrderAmount?: number;
  belowMinOrder?: boolean;
}

/**
 * Platform configuration that administrators can change at runtime.
 * Persisted in localStorage under the `system_settings` key.
 */
export interface DeliveryZone {
  id: string;
  name: string;
  /** Ethiopian cities covered by this zone (see ETHIOPIAN_CITIES). */
  cities: string[];
  /** Flat delivery fee (ETB) applied when the customer's city matches. */
  fee: number;
}

export interface DeliverySettings {
  /** 'distance-based' calculates from OSRM distance; 'fixed' uses a flat fee. */
  mode: 'distance-based' | 'fixed';
  /** Flat fee used when mode === 'fixed'. */
  fixedFee: number;
  /** Base fee before distance/variable additions (ETB). */
  distanceBaseFee: number;
  /** Added cost per km per tonne (ETB). */
  distancePerKmPerTon: number;
  /** Orders with a goods subtotal >= this amount ship free (0 disables). */
  freeDeliveryThreshold: number;
  /** Per-city/zone overrides. When a customer's city matches, its fee wins. */
  zones: DeliveryZone[];
}

export interface MinOrderSettings {
  /** Whether the minimum-order rule is enforced. */
  enabled: boolean;
  /** Minimum cart goods subtotal (ETB) before VAT/delivery. */
  amount: number;
}

export interface VatSettings {
  /** Whether VAT is charged on the goods subtotal. */
  enabled: boolean;
  /** VAT rate (%) applied once to the whole net goods subtotal. */
  rate: number;
}

export interface SystemSettings {
  version: number;
  currency: 'ETB';
  delivery: DeliverySettings;
  minOrder: MinOrderSettings;
  vat: VatSettings;
}

/**
 * Compact, non-sensitive proforma summary embedded in the printed/spoken QR.
 * Intentionally excludes passwords, full addresses, TIN / VAT numbers, phone
 * numbers and email addresses so that scanning never leaks private data.
 */
export interface ProformaShareData {
  v: number;
  n: string; // proforma number
  d: string; // ISO date
  b: string; // buyer name (display only)
  s: { n: string; c: string }[]; // suppliers: name + city
  i: { n: string; u: string; q: number; p: number; d?: 0 | 1 }[]; // items (d = delivery included)
  /** Per-supplier delivery breakdown: name, distance km, fee. */
  f?: { n: string; k: number; c: number }[];
  /** True line-item count, present only when the QR had to truncate the item list. */
  tc?: number;
  sub: number; // subtotal
  vat: number; // VAT amount
  del: number; // delivery fee
  tot: number; // grand total
  c: 'ETB';
}

/** Platform notification shown in the bell drawer. Persisted per app. */
export interface AppNotification {
  id: string;
  userId: string;
  type: 'order' | 'payment' | 'stock' | 'system' | 'rating';
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
}

/** A wallet ledger entry (top-up, payment, income, refund). */
export interface WalletTx {
  id: string;
  userId: string;
  kind: 'topup' | 'payment' | 'income' | 'refund';
  amount: number;
  balanceAfter: number;
  note: string;
  date: number;
}

/** Customer rating left on a delivered order / product. */
export interface ProductReview {
  id: string;
  materialId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: number;
  orderId?: string;
}

/** Snapshot serialized to JSON by the Data Center backup/restore. */
export interface BackupPayload {
  app: 'ESCON';
  version: number;
  exportedAt: string;
  users: User[];
  companies: Company[];
  materials: Material[];
  orders: Order[];
  notifications: AppNotification[];
  wallets: Record<string, number>;
  transactions: WalletTx[];
  reviews: ProductReview[];
  settings: SystemSettings | null;
}