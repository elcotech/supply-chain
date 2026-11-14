// ===== Role-based main menu (spec §8 "E-SCON MAIN MENU") =====
//
// The document defines five menus, each with the submenus listed below. This
// module is the single source of truth for that hierarchy: the workspace shell,
// the header menu, the mobile sheet, the command palette and the footer all
// read from here, so the navigation can never drift from the specification.

import { UserRole } from '../types';

export type MenuKey = 'admin' | 'supplier' | 'customer' | 'guest' | 'transporter';

export interface MenuSection {
  /** Stable section id used by the workspace router and deep links. */
  id: string;
  /** English label; translated by `useLanguage().t()` at render time. */
  label: string;
  icon: string;
  /** One-line explanation shown under the section title. */
  hint: string;
  /** Existing page this section opens, when it is not a workspace panel. */
  page?: string;
}

export interface RoleMenu {
  key: MenuKey;
  title: string;
  subtitle: string;
  sections: MenuSection[];
  /** Page that hosts this menu. */
  page: string;
}

export const MENUS: Record<MenuKey, RoleMenu> = {
  admin: {
    key: 'admin',
    title: 'Administration',
    subtitle: 'Governance, verification, finance, AI control and platform management.',
    page: 'admin-workspace',
    sections: [
      { id: 'dashboard', label: 'Admin Dashboard', icon: '📊', hint: 'Users, suppliers, customers, transporters, products, orders, revenue and system activity.' },
      { id: 'users', label: 'User Management', icon: '👥', hint: 'Register, approve, suspend, update and deactivate accounts and roles.' },
      { id: 'suppliers', label: 'Supplier Management', icon: '🏢', hint: 'Verify identity, licences, warehouses and products; approve, reject or suspend.' },
      { id: 'customers', label: 'Customer Management', icon: '🧾', hint: 'Contractor, company and individual profiles, verification and account status.' },
      { id: 'transporters', label: 'Transporter Management', icon: '🚛', hint: 'Verify transport companies, vehicles, drivers, capacity and service areas.' },
      { id: 'products', label: 'Product & Category', icon: '📦', hint: 'Categories, descriptions, specifications, units and listings.' },
      { id: 'prices', label: 'Price Management', icon: '💵', hint: 'Supplier prices, price changes, history and unusual pricing.' },
      { id: 'orders', label: 'Order Management', icon: '📋', hint: 'Confirmation, proformas, dispatch, delivery and completion.' },
      { id: 'rfqs', label: 'RFQ & Quotation', icon: '📨', hint: 'Requests, supplier responses, validity, comparisons and status.' },
      { id: 'logistics', label: 'Logistics Management', icon: '🗺️', hint: 'Delivery requests, transport quotes, GPS, distances, ETA and POD.' },
      { id: 'finance', label: 'Finance & Payments', icon: '🏦', hint: 'Transactions, confirmations, commissions, refunds and settlements.' },
      { id: 'ai', label: 'AI Intelligence Centre', icon: '🤖', hint: 'Recommendations, price forecasts, demand and model performance.' },
      { id: 'reports', label: 'Reports & Analytics', icon: '📈', hint: 'Operational, financial, procurement, supplier and logistics reports.' },
      { id: 'complaints', label: 'Complaints & Disputes', icon: '⚖️', hint: 'Receive, investigate and resolve complaints across every role.' },
      { id: 'notifications', label: 'Notifications & Communication', icon: '📣', hint: 'Announcements, account notices, order alerts and targeted messages.' },
      { id: 'security', label: 'Security & Audit', icon: '🔐', hint: 'Permissions, MFA policy, login records, suspicious activity and audit trail.' },
      { id: 'settings', label: 'Platform Settings', icon: '⚙️', hint: 'Language, currency, tax, units, locations, categories and business rules.' },
      { id: 'monitoring', label: 'Technical Monitoring', icon: '🩺', hint: 'System health, API availability, integration errors, backups and performance.' },
    ],
  },
  supplier: {
    key: 'supplier',
    title: 'Suppliers',
    subtitle: 'Business management, products, inventory, prices, quotations and sales.',
    page: 'supplier-workspace',
    sections: [
      { id: 'dashboard', label: 'Supplier Dashboard', icon: '📊', hint: 'Products, stock, pending orders, RFQs, sales, quotations and revenue.' },
      { id: 'profile', label: 'Business Profile', icon: '🏢', hint: 'Company name, registration, licence, contact details and description.' },
      { id: 'verification', label: 'Verification Centre', icon: '🛡️', hint: 'Licences, tax documents, certificates and verification status.' },
      { id: 'locations', label: 'Location & Warehouse', icon: '📍', hint: 'Warehouse GPS locations, service areas, hours and delivery coverage.' },
      { id: 'products', label: 'Product Management', icon: '📦', hint: 'Add, edit, update and remove products with full specifications.' },
      { id: 'inventory', label: 'Inventory Management', icon: '🏭', hint: 'Available and reserved stock, minimum levels, movements and alerts.' },
      { id: 'prices', label: 'Price Management', icon: '💵', hint: 'Unit prices, bulk discounts, minimum order quantities and validity.' },
      { id: 'rfqs', label: 'RFQ Management', icon: '📨', hint: 'Incoming customer requests, materials, quantities, sites and dates.' },
      { id: 'quotations', label: 'Quotation Management', icon: '📝', hint: 'Prepare, send and track quotations with taxes and delivery charges.' },
      { id: 'orders', label: 'Order Management', icon: '📋', hint: 'Accept, reject and update orders; confirm stock and dispatch.' },
      { id: 'invoices', label: 'Proforma & Invoicing', icon: '🧾', hint: 'Proforma invoices, commercial invoices, receipts and documents.' },
      { id: 'customers', label: 'Customer Management', icon: '👤', hint: 'Enquiries, purchasing history, reviews and communication records.' },
      { id: 'delivery', label: 'Delivery Coordination', icon: '🚚', hint: 'Request transport, share collection details and track delivery.' },
      { id: 'analytics', label: 'Sales & Revenue Analytics', icon: '📈', hint: 'Sales volume, revenue, best sellers and quotation acceptance.' },
      { id: 'ai', label: 'AI Business Assistant', icon: '🤖', hint: 'Demand forecasts, stock and pricing insights, customer suggestions.' },
      { id: 'messages', label: 'Messages & Notifications', icon: '🔔', hint: 'Enquiries, RFQs, order confirmations, payments and notices.' },
      { id: 'performance', label: 'Supplier Performance', icon: '⭐', hint: 'Ratings, fulfilment rate, delivery reliability and response time.' },
      { id: 'international', label: 'International Business', icon: '🌍', hint: 'Export information, commercial documents and cross-border sourcing.' },
    ],
  },
  customer: {
    key: 'customer',
    title: 'Customers',
    subtitle: 'Procurement, project requirements, supplier selection, orders and payments.',
    page: 'customer-workspace',
    sections: [
      { id: 'dashboard', label: 'Customer Dashboard', icon: '📊', hint: 'Projects, requirements, quotations, orders, deliveries and payments.' },
      { id: 'profile', label: 'Customer Profile', icon: '👤', hint: 'Name, company details, contacts, business documents and settings.' },
      { id: 'projects', label: 'Project Management', icon: '🏗️', hint: 'Projects, budgets, sites, project managers and material schedules.' },
      { id: 'sites', label: 'Site & GPS Location', icon: '📍', hint: 'Construction-site GPS locations, saved addresses and distances.' },
      { id: 'search', label: 'Smart Product Search', icon: '🔍', hint: 'Search by name, category, specification, grade, price and availability.' },
      { id: 'suppliers', label: 'Supplier Discovery', icon: '🏢', hint: 'Verified suppliers by location, availability, distance, rating and price.' },
      { id: 'compare', label: 'Product Comparison', icon: '⚖️', hint: 'Specifications, grades, prices, stock, ratings and delivery terms.' },
      { id: 'ai', label: 'AI Procurement Assistant', icon: '🤖', hint: 'Recommended suppliers, offer comparisons and cost-saving opportunities.' },
      { id: 'price-intelligence', label: 'Price Intelligence', icon: '💹', hint: 'Current prices, historical movement, alerts and sources.' },
      { id: 'rfqs', label: 'Request for Quotation', icon: '📨', hint: 'Send one request to multiple eligible suppliers with site and date.' },
      { id: 'quotation-compare', label: 'Quotation Comparison', icon: '📝', hint: 'Compare prices, transport, delivery times, terms and delivered cost.' },
      { id: 'cart', label: 'Shopping Cart', icon: '🛒', hint: 'Quantities, subtotals, delivery charges and the purchase step.' },
      { id: 'proforma', label: 'Proforma & Purchase Orders', icon: '🧾', hint: 'Supplier proformas, purchase orders and confirmed procurement details.' },
      { id: 'payments', label: 'Payment Centre', icon: '💳', hint: 'Payment instructions, methods, confirmations, receipts and history.' },
      { id: 'tracking', label: 'Order Tracking', icon: '🚚', hint: 'Acceptance, preparation, loading, dispatch, GPS and arrival.' },
      { id: 'delivery', label: 'Delivery Management', icon: '🏠', hint: 'Delivery address, schedule, transport charges and receipt.' },
      { id: 'documents', label: 'Documents Centre', icon: '📁', hint: 'Quotations, proformas, invoices, purchase orders and receipts.' },
      { id: 'reviews', label: 'Reviews & Complaints', icon: '⭐', hint: 'Rate suppliers and transporters, report problems and track resolution.' },
      { id: 'analytics', label: 'Procurement Analytics', icon: '📈', hint: 'Project expenditure, quantities, price comparisons and supplier performance.' },
      { id: 'notifications', label: 'Notifications & Messages', icon: '🔔', hint: 'Quotation updates, price alerts, orders, deliveries and messages.' },
    ],
  },
  guest: {
    key: 'guest',
    title: 'Guests',
    subtitle: 'Public marketplace, product discovery, supplier directory and registration.',
    page: 'home',
    sections: [
      { id: 'home', label: 'Home Page', icon: '🏠', hint: 'Introducing E-SCON, featured products and main services.', page: 'home' },
      { id: 'marketplace', label: 'Public Marketplace', icon: '🛍️', hint: 'Browse public products and material categories.', page: 'marketplace' },
      { id: 'catalogue', label: 'Product Catalogue', icon: '📦', hint: 'Product images, descriptions, specifications, units and public prices.', page: 'search-materials' },
      { id: 'directory', label: 'Supplier Directory', icon: '🏢', hint: 'Approved supplier businesses, public profiles and service locations.', page: 'supplier-directory' },
      { id: 'map', label: 'Supplier Map', icon: '🗺️', hint: 'Interactive map of supplier locations and service coverage.', page: 'supplier-map' },
      { id: 'insights', label: 'Market Insights', icon: '📈', hint: 'Market price trends, industry information and supply-chain insights.', page: 'analytics' },
      { id: 'transport', label: 'Transport Services', icon: '🚚', hint: 'Available delivery services, coverage and pricing.', page: 'info' },
      { id: 'ai-search', label: 'AI Search Preview', icon: '🤖', hint: 'Public product search and basic discovery recommendations.', page: 'copilot' },
      { id: 'how', label: 'How E-SCON Works', icon: '🧭', hint: 'Tutorials for search, quotations, purchasing and delivery.', page: 'info' },
      { id: 'about', label: 'About E-SCON', icon: 'ℹ️', hint: 'Vision, mission, objectives, services and future expansion.', page: 'info' },
      { id: 'language', label: 'Language Settings', icon: '🌐', hint: 'English, Amharic and other supported languages.', page: 'language' },
      { id: 'help', label: 'Help & Support', icon: '🛟', hint: 'FAQs, user guides, support information and contacts.', page: 'info' },
      { id: 'register', label: 'Register', icon: '👤', hint: 'Create a customer, supplier or transporter account.', page: 'register' },
      { id: 'login', label: 'Sign In', icon: '🔑', hint: 'Log in to a verified account and open role-specific functions.', page: 'login' },
    ],
  },
  transporter: {
    key: 'transporter',
    title: 'Transporters',
    subtitle: 'Delivery requests, fleet, dispatch, routes and earnings.',
    page: 'transporter-dashboard',
    sections: [
      { id: 'overview', label: 'Transport Dashboard', icon: '📊', hint: 'Delivery requests, active trips, completed trips and earnings.' },
      { id: 'profile', label: 'Company Profile', icon: '🏢', hint: 'Transport business, service areas and business documents.' },
      { id: 'vehicles', label: 'Vehicle Management', icon: '🚛', hint: 'Trucks, vehicle types, capacities and maintenance information.' },
      { id: 'drivers', label: 'Driver Management', icon: '🪪', hint: 'Driver profiles, licences, availability and assignments.' },
      { id: 'requests', label: 'Delivery Requests', icon: '📥', hint: 'Receive and accept customer or supplier delivery requests.' },
      { id: 'pricing', label: 'Transport Pricing', icon: '💵', hint: 'Rates by distance, load, vehicle and service conditions.' },
      { id: 'routes', label: 'Route Management', icon: '🗺️', hint: 'Routes, distances, estimated times and alternative routes.' },
      { id: 'gps', label: 'GPS Tracking', icon: '📍', hint: 'Share vehicle location and delivery progress with authorised users.' },
      { id: 'dispatch', label: 'Dispatch Management', icon: '🧭', hint: 'Assign drivers and vehicles, schedule pickup and manage deliveries.' },
      { id: 'pod', label: 'Proof of Delivery', icon: '✍️', hint: 'Delivery confirmation, photographs, signatures and timestamps.' },
      { id: 'earnings', label: 'Financial Records', icon: '💰', hint: 'Transport quotations, invoices, earnings and payment status.' },
      { id: 'analytics', label: 'Performance Analytics', icon: '📈', hint: 'Delivery reliability, vehicle utilisation and operating costs.' },
    ],
  },
};

export const MENU_ORDER: MenuKey[] = ['admin', 'supplier', 'customer', 'guest', 'transporter'];

/** Which main menu a signed-in role belongs to (guests have no account). */
export const menuForRole = (role: UserRole | null | undefined): MenuKey => {
  if (role === 'admin') return 'admin';
  if (role === 'company') return 'supplier';
  if (role === 'customer') return 'customer';
  if (role === 'transporter') return 'transporter';
  return 'guest';
};

/** Sections whose destination is an existing standalone page. */
export const sectionById = (menu: MenuKey, id: string): MenuSection | undefined =>
  MENUS[menu].sections.find(section => section.id === id);

/** Description shown under a workspace heading, translated where available. */
export const sectionHint = (menu: MenuKey, id: string): string =>
  sectionById(menu, id)?.hint || '';
