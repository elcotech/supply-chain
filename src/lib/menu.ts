// ===== Role-based main menu (E-SCON 5.0) =====
// Single source of truth for role navigation. Four primary interfaces
// (Administration, Supplier, Customer, Guest) follow the provided spec;
// Transporter kept for existing operational accounts.

import { UserRole } from '../types';

export type MenuKey = 'admin' | 'supplier' | 'customer' | 'guest' | 'transporter';

export interface MenuSection {
  id: string;
  label: string;
  icon: string;
  hint: string;
  page?: string;
}

export interface RoleMenu {
  key: MenuKey;
  title: string;
  subtitle: string;
  sections: MenuSection[];
  page: string;
}

export const MENUS: Record<MenuKey, RoleMenu> = {
  admin: {
    key: 'admin',
    title: 'Administration',
    subtitle: 'Complete platform management, monitoring and control.',
    page: 'admin-workspace',
    sections: [
      { id: 'home', label: 'Home', icon: '🏠', hint: 'Vision, mission, services of E-SCON, advertisements and graphics.' },
      { id: 'dashboard', label: 'Dashboard', icon: '📊', hint: 'Platform-wide users, suppliers, vehicles, RFQs and orders at a glance.' },
      { id: 'users', label: 'User Management', icon: '👥', hint: 'Search, filter, view, activate, suspend and manage roles.' },
      { id: 'customers', label: 'Customer Management', icon: '🧑‍💼', hint: 'Registered contractors and buyers, activity and total spend.' },
      { id: 'suppliers', label: 'Supplier Verification', icon: '🏢', hint: 'Review applications, licenses, documents; approve or reject.' },
      { id: 'transporters', label: 'Transport Verification', icon: '🚛', hint: 'Verify vehicle registrations, ownership and operator records.' },
      { id: 'logistics', label: 'Logistics Management', icon: '🚚', hint: 'Transport partners, fleet capacity and the delivery pipeline.' },
      { id: 'products', label: 'Product Management', icon: '📦', hint: 'View, categorize, approve listings, monitor prices and availability.' },
      { id: 'prices', label: 'Price Management', icon: '💰', hint: 'Monitor base prices, margins, advertised prices and stock levels.' },
      { id: 'rfqs', label: 'RFQ Management', icon: '📨', hint: 'Monitor all RFQs, supplier responses and quotation status.' },
      { id: 'orders', label: 'Order Management', icon: '🧾', hint: 'All orders, fulfillment, cancellations and completed transactions.' },
      { id: 'market', label: 'Market Intelligence', icon: '📈', hint: 'Material prices, demand, geographic markets and historical trends.' },
      { id: 'ai', label: 'AI Intelligence', icon: '🤖', hint: 'Demand signals, category forecasts and model-based insights.' },
      { id: 'finance', label: 'Financial Management', icon: '💳', hint: 'Transactions, payments, refunds, charges and financial statements.' },
      { id: 'reports', label: 'Reports', icon: '📑', hint: 'User, supplier, product, order, RFQ and financial reports; PDF/Excel export.' },
      { id: 'complaints', label: 'Complaints', icon: '⚠️', hint: 'Customer and supplier complaints, disputes and resolutions.' },
      { id: 'notifications', label: 'Notifications', icon: '🔔', hint: 'Platform announcements and notifications recorded by category/supplier.' },
      { id: 'quotations', label: 'Quotations Ledger', icon: '📄', hint: 'All quotations recorded separately with status and transaction history.' },
      { id: 'security', label: 'Security & Audit', icon: '🔒', hint: 'Account safeguards, suspensions and the full audit trail.' },
      { id: 'monitoring', label: 'Technical Monitoring', icon: '🛠️', hint: 'Service health, cloud sync status and operational queues.' },
      { id: 'settings', label: 'System Settings', icon: '⚙️', hint: 'Configuration, roles, categories, language and audit logs.' },
    ],
  },
  supplier: {
    key: 'supplier',
    title: 'Supplier',
    subtitle: 'Manage products, prices, inventory, quotations, orders and deliveries.',
    page: 'supplier-workspace',
    sections: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊', hint: 'Products, sales, open RFQs, pending orders and seller rating.' },
      { id: 'profile', label: 'Business Profile', icon: '🏢', hint: 'Business information, licenses, TIN, contact and verification status.' },
      { id: 'products', label: 'My Products', icon: '📦', hint: 'Add, edit, publish and manage construction material listings.' },
      { id: 'prices', label: 'Price Management', icon: '💰', hint: 'Update prices, bulk pricing and price history.' },
      { id: 'inventory', label: 'Inventory', icon: '🗃️', hint: 'Stock quantities, movements, low-stock alerts and history.' },
      { id: 'rfqs', label: 'Customer RFQs', icon: '📨', hint: 'Incoming quotation requests with quantities and delivery requirements.' },
      { id: 'quotations', label: 'Quotations', icon: '📄', hint: 'Submitted quotations, acceptance status and expiration.' },
      { id: 'orders', label: 'Orders', icon: '🧾', hint: 'Confirm, process, fulfill and track orders.' },
      { id: 'invoices', label: 'Invoices', icon: '🧾', hint: 'Create, view, download and track invoices and proformas.' },
      { id: 'payments', label: 'Payments', icon: '💳', hint: 'Received payments, balances and transaction history.' },
      { id: 'delivery', label: 'Delivery', icon: '🚚', hint: 'Arrange transport, update status and confirm completion.' },
      { id: 'reviews', label: 'Reviews', icon: '⭐', hint: 'Customer ratings, written reviews and responses.' },
      { id: 'analytics', label: 'Analytics', icon: '📈', hint: 'Revenue, sales performance, demand and inventory performance.' },
    ],
  },
  customer: {
    key: 'customer',
    title: 'Customer / Contractor',
    subtitle: 'Discover materials, compare prices, request quotations and track deliveries.',
    page: 'customer-workspace',
    sections: [
      { id: 'dashboard', label: 'Home', icon: '🏠', hint: 'Open RFQs, quotations, orders and total spend overview.' },
      { id: 'workflow', label: 'Customer Workflow', icon: '🧭', hint: 'Find suppliers, order items, measure delivery, pay and track completion.' },
      { id: 'marketplace', label: 'Marketplace', icon: '🛍️', hint: 'Browse materials, categories, prices and availability.', page: 'marketplace' },
      { id: 'search', label: 'Search', icon: '🔎', hint: 'Find by category, department, place or nearest supplier.', page: 'search-materials' },
      { id: 'compare', label: 'Compare Prices', icon: '⚖️', hint: 'Compare suppliers, unit prices, quantities and delivery costs.' },
      { id: 'map', label: 'Supplier Map', icon: '🗺️', hint: 'Verified suppliers on map with distances.', page: 'supplier-directory' },
      { id: 'rfq', label: 'Request Quotation', icon: '📨', hint: 'Select materials, quantities and submit RFQs.' },
      { id: 'quotations', label: 'My Quotations', icon: '📄', hint: 'Received offers, compare, accept/reject and convert to orders.' },
      { id: 'transport', label: 'Transport', icon: '🚛', hint: 'Browse transport options and request delivery services.' },
      { id: 'cart', label: 'Shopping Cart', icon: '🛒', hint: 'Review items, quantities and totals.' },
      { id: 'proforma', label: 'Proforma', icon: '🧾', hint: 'Generate and review proforma invoices with costs and delivery.' },
      { id: 'orders', label: 'My Orders', icon: '📦', hint: 'Order details, status, history and transaction summaries.' },
      { id: 'tracking', label: 'Track Delivery', icon: '📍', hint: 'Delivery routes, vehicles, ETA and confirmation.' },
      { id: 'wallet', label: 'Wallet', icon: '💳', hint: 'Balance, transactions, payments and refunds.' },
      { id: 'favorites', label: 'Favorites', icon: '❤️', hint: 'Saved materials and suppliers.' },
      { id: 'reviews', label: 'Reviews', icon: '⭐', hint: 'Rate suppliers, write and view reviews.' },
      { id: 'reports', label: 'Reports', icon: '📑', hint: 'Purchase, spending, order and RFQ reports.' },
    ],
  },
  guest: {
    key: 'guest',
    title: 'Guest / Public',
    subtitle: 'Explore materials, prices and suppliers without registration.',
    page: 'guest-workspace',
    sections: [
      { id: 'home', label: 'Homepage', icon: '🏠', hint: 'Featured materials, market trends and supplier highlights.' },
      { id: 'marketplace', label: 'Marketplace', icon: '🛍️', hint: 'Public products, categories and advertised prices.', page: 'marketplace' },
      { id: 'catalogue', label: 'Product Details', icon: '📦', hint: 'Product specs, images, units and advertised prices.', page: 'search-materials' },
      { id: 'directory', label: 'Supplier Directory', icon: '🏢', hint: 'Verified suppliers, profiles and product categories.', page: 'supplier-directory' },
      { id: 'map', label: 'Supplier Map', icon: '🗺️', hint: 'Verified supplier locations in Addis Ababa and beyond.', page: 'supplier-directory' },
      { id: 'compare', label: 'Price Comparison', icon: '⚖️', hint: 'Compare published prices, suppliers and distances.', page: 'search-materials' },
      { id: 'insights', label: 'Market Insights', icon: '📈', hint: 'Historical prices and monthly material price trends.', page: 'analytics' },
      { id: 'about', label: 'About E-SCON', icon: 'ℹ️', hint: 'Platform description, objectives and how it works.', page: 'info' },
      { id: 'contact', label: 'Contact', icon: '📞', hint: 'Contact form, email, telephone and office location.', page: 'info' },
    ],
  },
  transporter: {
    key: 'transporter',
    title: 'Transporters',
    subtitle: 'Delivery requests, fleet, dispatch, routes and earnings.',
    page: 'transporter-dashboard',
    sections: [
      { id: 'overview', label: 'Transport Dashboard', icon: '📊', hint: 'Requests, active and completed trips, earnings.' },
      { id: 'requests', label: 'Delivery Requests', icon: '📨', hint: 'Receive and accept delivery requests.' },
      { id: 'vehicles', label: 'Vehicle Management', icon: '🚛', hint: 'Trucks, types, capacities and maintenance.' },
      { id: 'drivers', label: 'Driver Management', icon: '👷', hint: 'Driver profiles, licences and assignments.' },
      { id: 'gps', label: 'GPS Tracking', icon: '📍', hint: 'Share vehicle location and delivery progress.' },
      { id: 'earnings', label: 'Financial Records', icon: '💳', hint: 'Invoices, earnings and payment status.' },
    ],
  },
};

export const MENU_ORDER: MenuKey[] = ['admin', 'supplier', 'customer', 'guest', 'transporter'];

export const menuForRole = (role: UserRole | null | undefined): MenuKey => {
  if (role === 'admin') return 'admin';
  if (role === 'company') return 'supplier';
  if (role === 'customer') return 'customer';
  if (role === 'transporter') return 'transporter';
  return 'guest';
};

export const sectionById = (menu: MenuKey, id: string): MenuSection | undefined =>
  MENUS[menu].sections.find(section => section.id === id);

export const sectionHint = (menu: MenuKey, id: string): string =>
  sectionById(menu, id)?.hint || '';
