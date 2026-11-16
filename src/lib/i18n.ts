// ===== Bilingual interface layer (English + Amharic) =====
//
// The platform requirement asks for English, Amharic and expandable
// multilingual support. Translation is keyed by the English string itself, so
// any string that has no Amharic entry yet simply falls back to English - the
// dictionary can grow without touching the components that use it.
//
// The selected language is stored on the device and exposed through a tiny
// external store so every mounted component re-renders on change.

import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'am';

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'am', label: 'Amharic', native: '' },
];

const AMHARIC: Record<string, string> = {
  // ---- Roles & menus -------------------------------------------------------
  'Administration': '',
  'Enterprise Control Centre': '  ',
  'Governance, verification, finance, AI control and platform management.':
    '   AI    ',
  'Suppliers': '',
  'Business Management': ' ',
  'Business management, products, inventory, prices, quotations and sales.':
    '        ',
  'Customers': '',
  'Procurement & Projects': '  ',
  'Procurement, project requirements, supplier selection, orders and payments.':
    '       ',
  'Guests': '',
  'Public Marketplace & Discovery': '   ',
  'Public marketplace, product discovery, supplier directory and registration.':
    '       ',
  'Transporters': '',
  'Transport Operations': ' ',
  'Delivery requests, fleet, dispatch, routes and earnings.':
    '      ',
  'Dashboard': '',
  'Admin Dashboard': ' ',
  'User Management': ' ',
  'Supplier Management': ' ',
  'Customer Management': ' ',
  'Transporter Management': ' ',
  'Product & Category': '  ',
  'Price Management': ' ',
  'Order Management': ' ',
  'RFQ & Quotation': '   ',
  'Logistics Management': ' ',
  'Finance & Payments': '  ',
  'AI Intelligence Centre': 'AI  ',
  'Reports & Analytics': '  ',
  'Complaints & Disputes': '  ',
  'Notifications & Communication': '  ',
  'Security & Audit': '  ',
  'Platform Settings': ' ',
  'Technical Monitoring': ' ',
  'Supplier Dashboard': ' ',
  'Business Profile': ' ',
  'Verification Centre': ' ',
  'Location & Warehouse': '  ',
  'Product Management': ' ',
  'Inventory Management': ' ',
  'RFQ Management': '  ',
  'Quotation Management': '  ',
  'Proforma & Invoicing': '  ',
  'Delivery Coordination': ' ',
  'Sales & Revenue Analytics': '   ',
  'AI Business Assistant': 'AI  ',
  'Messages & Notifications': '  ',
  'Supplier Performance': ' ',
  'International Business': '  ',
  'Customer Dashboard': ' ',
  'Customer Profile': ' ',
  'Project Management': ' ',
  'Site & GPS Location': '  GPS ',
  'Smart Product Search': '  ',
  'Supplier Discovery': ' ',
  'Product Comparison': ' ',
  'AI Procurement Assistant': 'AI  ',
  'Price Intelligence': ' ',
  'Request for Quotation': ' ',
  'Quotation Comparison': '  ',
  'Shopping Cart': ' ',
  'Proforma & Purchase Orders': '   ',
  'Payment Centre': ' ',
  'Order Tracking': ' ',
  'Delivery Management': ' ',
  'Documents Centre': ' ',
  'Reviews & Complaints': '  ',
  'Procurement Analytics': ' ',
  'Notifications & Messages': '  ',
  'Home Page': ' ',
  'Public Marketplace': ' ',
  'Product Catalogue': ' ',
  'Supplier Directory': ' ',
  'Supplier Map': ' ',
  'Market Insights': ' ',
  'Transport Services': ' ',
  'AI Search Preview': 'AI   ',
  'How E-SCON Works': 'E-SCON  ',
  'About E-SCON': ' E-SCON',
  'Language Settings': ' ',
  'Help & Support': '  ',
  'Register': '',
  'Sign In': '',
  'Transport Dashboard': ' ',
  'Company Profile': ' ',
  'Vehicle Management': ' ',
  'Driver Management': ' ',
  'Delivery Requests': ' ',
  'Transport Pricing': ' ',
  'Route Management': ' ',
  'GPS Tracking': 'GPS ',
  'Dispatch Management': ' ',
  'Proof of Delivery': ' ',
  'Financial Records': ' ',
  'Performance Analytics': ' ',

  // ---- Common actions ------------------------------------------------------
  'Search': '',
  'Search...': '...',
  'Export CSV': 'CSV ',
  'Save': '',
  'Saving...': ' ...',
  'Cancel': '',
  'Close': '',
  'Submit': '',
  'Delete': '',
  'Edit': '',
  'Add': '',
  'View': '',
  'Open menu': ' ',
  'Actions': '',
  'Status': '',
  'Total': '',
  'Approve': '',
  'Reject': ' ',
  'Suspend': '',
  'Activate': '',
  'Verify': '',
  'Resolve': '',
  'Investigate': '',
  'All': '',
  'Loading...': ' ...',
  'No records yet': '  ',
  'No matching records': '  ',
  'Previous': '',
  'Next': '',
  'Page': '',
  'of': '',
  'Refresh': '',
  'Download': '',
  'Upload': '',
  'Review': '',
  'Details': '',
  'Filters': '',
  'Clear': '',
  'Send': '',
  'Back': '',
  'Quick actions': ' ',
  'Recent activity': ' ',
  'Overview': ' ',
  'Alerts': '',

  // ---- Domain terms --------------------------------------------------------
  'Revenue': '',
  'Sales': '',
  'Orders': '',
  'Products': '',
  'Users': '',
  'Reports': '',
  'Settings': '',
  'Profile': '',
  'Inventory': '',
  'Stock': '',
  'Pending': ' ',
  'Confirmed': '',
  'Shipped': '',
  'Delivered': '',
  'Cancelled': '',
  'Paid': '',
  'Unpaid': '',
  'Refunded': ' ',
  'Price': '',
  'Quantity': '',
  'Unit': '',
  'Date': '',
  'Name': '',
  'Email': '',
  'Phone': '',
  'City': '',
  'Address': '',
  'Category': '',
  'Description': '',
  'Budget': '',
  'Project': '',
  'Projects': '',
  'Compliance': '',
  'Verified': '',
  'Not verified': '',
  'Language': '',
  'English': '',
  'Amharic': '',
  'Activity': '',
  'Top products': ' ',
  'Low stock': ' ',
  'Delivery': '',
  'Payment': '',
  'Payments': '',
  'Finance': '',
  'Security': '',
  'Audit log': ' ',
  'System health': ' ',
  'Complaints': '',
  'Disputes': '',
  'Notifications': '',
  'Messages': '',
  'Performance': '',
  'Earnings': '',
  'Routes': '',
  'Dispatch': '',
  'Vehicles': '',
  'Drivers': '',
  'Documents': '',
  'Reviews': '',
  'Site': '',
  'Warehouse': '',
  'Verification': '',
  'Quotations': ' ',
  'Invoices': '',
  'Forecast': '',
  'Recommended': '',
  'Distance': '',
  'Transport': '',
  'Subtotal': ' ',
  'VAT': '',
  'Grand total': ' ',
  'Verified suppliers': ' ',
  'Pending verification': '  ',
  'Account status': ' ',
  'Suspended': '',
  'Active': '',
  'Open': '',
  'Resolved': '',
  'Investigating': ' ',
  'Submitted': '',
  'Accepted': '',
  'Declined': ' ',
  'Planning': ' ',
  'On hold': '',
  'Completed': '',
  'Available': '',
  'In service': ' ',
  'Maintenance': '',
  'On trip': ' ',
  'Off duty': ' ',
  'Total users': ' ',
  'Total orders': ' ',
  'Total products': ' ',
  'Active orders': ' ',
  'Pending orders': '   ',
  'Average order value': '  ',
  'Stock value': ' ',
  'Low-stock items': '   ',
  'Delivery revenue': ' ',
  'VAT collected': ' ',
  'Registered accounts': ' ',
  'Compliance reviews': ' ',
  'Open complaints': ' ',
  'Delivery jobs': ' ',
  'No data for this period': '   ',
  'New': '',
  'Add product': ' ',
  'Add project': ' ',
  'New RFQ': '  ',
  'Submit quotation': '  ',
  'File a complaint': ' ',
  'Send announcement': ' ',
  'Change language': ' ',
  'Workspace': ' ',
  'Menu': '',
  'More': '',
  'Back to dashboard': '  ',
  'Export report': ' ',
  'All records': ' ',
  'Requires registration': ' ',
  'Publicly accessible': ' ',
  'Sign in to continue': ' ',
  'Create account': ' ',
  'Demo data': ' ',
  'Source': '',
  'Updated': '',
  'Contact': '',
  'Working hours': ' ',
  'Service areas': ' ',
  'Capacity': '',
  'Plate': '',
  'Make & model': '',
  'Licence': '',
  'Expiry': '',
  'Driver': '',
  'Vehicle': '',
  'Assign': '',
  'Unassign': '',
  'Claim': '',
  'Advance status': ' ',
  'Proof': '',
  'Route': '',
  'Estimated time': ' ',
  'Rate per km': ' ',
  'Start fee': ' ',
  'Rate per ton': ' ',
  'Total jobs': ' ',
  'Completed jobs': ' ',
  'Average rating': ' ',
  'Fulfilment rate': ' ',
  'Response time': ' ',
  'Best sellers': ' ',
  'Retention': ' ',
  'Quotation acceptance': '  ',
  'Spend': '',
  'Savings': '',
  'Budget used': ' ',
  'Materials': '',
  'Supplier': '',
  'Buyer': '',
  'Seller': '',
  'Reference': '',
  'Valid until': ' ',
  'Required by': ' ',
  'Site address': ' ',
  'Notes': '',
  'Response': '',
  'Subject': '',
  'Message': '',
  'Against': '',
  'Raised by': '',
  'Created': '',
  'Updated at': '',
  'Attachments': '',
  'Search products, suppliers, orders...': '   ...',
  'All categories': ' ',
  'All cities': ' ',
  'All statuses': ' ',
  'Newest first': ' ',
  'Oldest first': ' ',
  'Highest value': ' ',
  'Lowest value': ' ',
};

const LANG_KEY = 'escon_language';

const readLanguage = (): Lang => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'am') return saved;
  } catch {
    /* storage unavailable - keep English */
  }
  return 'en';
};

let currentLanguage: Lang = readLanguage();
const listeners = new Set<() => void>();

const applyDocumentLanguage = (lang: Lang): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('lang', lang === 'am' ? 'am' : 'en');
};

applyDocumentLanguage(currentLanguage);

export const getLanguage = (): Lang => currentLanguage;

export const setLanguage = (lang: Lang): void => {
  if (lang !== 'en' && lang !== 'am') return;
  currentLanguage = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage unavailable - the choice still applies for this session */
  }
  applyDocumentLanguage(lang);
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Translate one English string into the active language (fallback: English). */
export const translate = (lang: Lang, text: string): string =>
  lang === 'am' ? AMHARIC[text] || text : text;

/** React hook: active language plus a `t()` helper and the setter. */
export const useLanguage = (): { lang: Lang; setLang: (lang: Lang) => void; t: (text: string) => string } => {
  const lang = useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return {
    lang,
    setLang: setLanguage,
    t: (text: string) => translate(lang, text),
  };
};

export { LANG_KEY };
