// ===== Shared contract between the App shell and the role workspaces =====
//
// One interface for all three signed-in workspaces. Each workspace reads the
// slice it needs; every mutation goes back through App.tsx so the existing
// persistence, cloud sync, notifications and wallet rules stay the single
// source of truth.

import type { Dispatch, SetStateAction } from 'react';
import {
  Alert,
  AppNotification,
  AuditEvent,
  CartItem,
  Company,
  Complaint,
  Material,
  Order,
  PlatformProfile,
  ProductReview,
  Project,
  Quotation,
  Rfq,
  SystemSettings,
  TransporterProfile,
  User,
  UserRole,
  WalletTx,
} from '../../types';

export interface WorkspaceProps {
  user: User;
  users: User[];
  companies: Company[];
  materials: Material[];
  orders: Order[];
  reviews: ProductReview[];
  notifications: AppNotification[];
  wallets: Record<string, number>;
  transactions: WalletTx[];
  transporterProfiles: TransporterProfile[];
  settings: SystemSettings;

  projects: Project[];
  setProjects: Dispatch<SetStateAction<Project[]>>;
  rfqs: Rfq[];
  setRfqs: Dispatch<SetStateAction<Rfq[]>>;
  quotations: Quotation[];
  setQuotations: Dispatch<SetStateAction<Quotation[]>>;
  complaints: Complaint[];
  setComplaints: Dispatch<SetStateAction<Complaint[]>>;

  platform: PlatformProfile;
  setPlatform: Dispatch<SetStateAction<PlatformProfile>>;

  audit: AuditEvent[];
  logEvent: (action: string, detail: string) => void;

  /** Buyer basket, including the delivery choice per line. */
  cart: CartItem[];
  /** Product ids selected on the marketplace compare tray. */
  compare: string[];
  onUpdateCartQty: (itemId: string, quantity: number) => void;
  onRemoveFromCart: (itemId: string) => void;
  onClearCart: () => void;

  /** Active submenu id from the role menu. */
  section: string;
  onSection: (id: string) => void;

  onNotify: (message: string, type?: Alert['type']) => void;
  onNavigate: (page: string) => void;
  onBroadcast: (type: AppNotification['type'], title: string, message: string, role?: UserRole | 'all', meta?: { category?: string; supplierId?: string; supplierName?: string }) => void;

  onUpdateOrderStatus: (orderId: string, status: string) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
  onUpdateCompany: (company: Company) => void;
  onUpdateTransporterProfile: (profile: TransporterProfile) => void;
  onDeleteCompany: (id: string) => void;
  onUpdateMaterial: (material: Material) => void;
  onDeleteMaterial: (id: string) => void;
  onEditMaterial: (material: Material) => void;
  onAdminEditCompany: (company: Company) => void;
  onAddProduct: () => void;
  onAddSupplier: () => void;
  onEditCompany: () => void;
  onOpenMap: (companyId: string) => void;
  onOpenProduct: (material: Material) => void;
  onCheckout: () => void;
  onAddToCart: (material: Material, quantity: number) => boolean;
  onToggleCompare: (materialId: string) => void;
  onSaveMyLocation: () => void;
  onOpenMessages: () => void;
  onReview: (materialId: string) => void;
  onSendMessage: (userId: string, title: string, message: string) => void;
  onOpenDataCenter: () => void;
  onEditSettings: () => void;
  onOpenWallet: () => void;
}
