// ===== Bilingual interface layer (English + Amharic) =====
//
// The platform requirement asks for English, Amharic and expandable
// multilingual support. Translation is keyed by the English string itself, so
// any string that has no Amharic entry yet simply falls back to English — the
// dictionary can grow without touching the components that use it.
//
// The selected language is stored on the device and exposed through a tiny
// external store so every mounted component re-renders on change.

import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'am';

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'am', label: 'Amharic', native: 'አማርኛ' },
];

const AMHARIC: Record<string, string> = {
  // ---- Roles & menus -------------------------------------------------------
  'Administration': 'አስተዳደር',
  'Enterprise Control Centre': 'የድርጅት መቆጣጠሪያ ማዕከል',
  'Governance, verification, finance, AI control and platform management.':
    'አስተዳደር፣ ማረጋገጫ፣ ፋይናንስ፣ የAI ቁጥጥር እና የመድረክ አስተዳደር።',
  'Suppliers': 'አቅራቢዎች',
  'Business Management': 'የንግድ አስተዳደር',
  'Business management, products, inventory, prices, quotations and sales.':
    'የንግድ አስተዳደር፣ ምርቶች፣ ክምችት፣ ዋጋዎች፣ የዋጋ ማቅረቢያዎች እና ሽያጭ።',
  'Customers': 'ደንበኞች',
  'Procurement & Projects': 'ግዥ እና ፕሮጀክቶች',
  'Procurement, project requirements, supplier selection, orders and payments.':
    'ግዥ፣ የፕሮጀክት ፍላጎቶች፣ አቅራቢ ምርጫ፣ ትዕዛዞች እና ክፍያዎች።',
  'Guests': 'እንግዶች',
  'Public Marketplace & Discovery': 'የህዝብ ገበያ እና ፍለጋ',
  'Public marketplace, product discovery, supplier directory and registration.':
    'የህዝብ ገበያ፣ የምርት ፍለጋ፣ የአቅራቢ ማውጫ እና ምዝገባ።',
  'Transporters': 'አጓጓዦች',
  'Transport Operations': 'የትራንስፖርት ስራዎች',
  'Delivery requests, fleet, dispatch, routes and earnings.':
    'የአቅርቦት ጥያቄዎች፣ ተሽከርካሪዎች፣ መላኪያ፣ መንገዶች እና ገቢዎች።',
  'Dashboard': 'ዳሽቦርድ',
  'Admin Dashboard': 'የአስተዳደር ዳሽቦርድ',
  'User Management': 'የተጠቃሚ አስተዳደር',
  'Supplier Management': 'የአቅራቢ አስተዳደር',
  'Customer Management': 'የደንበኛ አስተዳደር',
  'Transporter Management': 'የአጓጓዥ አስተዳደር',
  'Product & Category': 'ምርት እና ምድብ',
  'Price Management': 'የዋጋ አስተዳደር',
  'Order Management': 'የትዕዛዝ አስተዳደር',
  'RFQ & Quotation': 'የዋጋ ጥያቄ እና ማቅረቢያ',
  'Logistics Management': 'የሎጂስቲክስ አስተዳደር',
  'Finance & Payments': 'ፋይናንስ እና ክፍያዎች',
  'AI Intelligence Centre': 'የAI ኢንተለጀንስ ማዕከል',
  'Reports & Analytics': 'ሪፖርቶች እና ትንታኔ',
  'Complaints & Disputes': 'ቅሬታዎች እና ክርክሮች',
  'Notifications & Communication': 'ማሳወቂያዎች እና ግንኙነት',
  'Security & Audit': 'ደህንነት እና ኦዲት',
  'Platform Settings': 'የመድረክ ቅንብሮች',
  'Technical Monitoring': 'ቴክኒካዊ ክትትል',
  'Supplier Dashboard': 'የአቅራቢ ዳሽቦርድ',
  'Business Profile': 'የንግድ መገለጫ',
  'Verification Centre': 'የማረጋገጫ ማዕከል',
  'Location & Warehouse': 'አካባቢ እና መጋዘን',
  'Product Management': 'የምርት አስተዳደር',
  'Inventory Management': 'የክምችት አስተዳደር',
  'RFQ Management': 'የዋጋ ጥያቄ አስተዳደር',
  'Quotation Management': 'የዋጋ ማቅረቢያ አስተዳደር',
  'Proforma & Invoicing': 'ፕሮፎርማ እና ደረሰኝ',
  'Delivery Coordination': 'የአቅርቦት ቅንጅት',
  'Sales & Revenue Analytics': 'የሽያጭ እና ገቢ ትንታኔ',
  'AI Business Assistant': 'የAI ንግድ ረዳት',
  'Messages & Notifications': 'መልዕክቶች እና ማሳወቂያዎች',
  'Supplier Performance': 'የአቅራቢ አፈጻጸም',
  'International Business': 'ዓለም አቀፍ ንግድ',
  'Customer Dashboard': 'የደንበኛ ዳሽቦርድ',
  'Customer Profile': 'የደንበኛ መገለጫ',
  'Project Management': 'የፕሮጀክት አስተዳደር',
  'Site & GPS Location': 'የጣቢያ እና GPS አካባቢ',
  'Smart Product Search': 'ብልህ የምርት ፍለጋ',
  'Supplier Discovery': 'አቅራቢ ማግኘት',
  'Product Comparison': 'የምርት ንጽጽር',
  'AI Procurement Assistant': 'የAI ግዥ ረዳት',
  'Price Intelligence': 'የዋጋ መረጃ',
  'Request for Quotation': 'የዋጋ ጥያቄ',
  'Quotation Comparison': 'የዋጋ ማቅረቢያ ንጽጽር',
  'Shopping Cart': 'የግዢ ቅርጫት',
  'Proforma & Purchase Orders': 'ፕሮፎርማ እና የግዢ ትዕዛዝ',
  'Payment Centre': 'የክፍያ ማዕከል',
  'Order Tracking': 'የትዕዛዝ ክትትል',
  'Delivery Management': 'የአቅርቦት አስተዳደር',
  'Documents Centre': 'የሰነድ ማዕከል',
  'Reviews & Complaints': 'ግምገማዎች እና ቅሬታዎች',
  'Procurement Analytics': 'የግዥ ትንታኔ',
  'Notifications & Messages': 'ማሳወቂያዎች እና መልዕክቶች',
  'Home Page': 'ዋና ገጽ',
  'Public Marketplace': 'የህዝብ ገበያ',
  'Product Catalogue': 'የምርት ካታሎግ',
  'Supplier Directory': 'የአቅራቢ ማውጫ',
  'Supplier Map': 'የአቅራቢ ካርታ',
  'Market Insights': 'የገበያ ግንዛቤ',
  'Transport Services': 'የትራንስፖርት አገልግሎቶች',
  'AI Search Preview': 'የAI ፍለጋ ቅድመ እይታ',
  'How E-SCON Works': 'E-SCON እንዴት ይሰራል',
  'About E-SCON': 'ስለ E-SCON',
  'Language Settings': 'የቋንቋ ቅንብሮች',
  'Help & Support': 'እርዳታ እና ድጋፍ',
  'Register': 'ተመዝገብ',
  'Sign In': 'ግባ',
  'Transport Dashboard': 'የትራንስፖርት ዳሽቦርድ',
  'Company Profile': 'የኩባንያ መገለጫ',
  'Vehicle Management': 'የተሽከርካሪ አስተዳደር',
  'Driver Management': 'የአሽከርካሪ አስተዳደር',
  'Delivery Requests': 'የአቅርቦት ጥያቄዎች',
  'Transport Pricing': 'የትራንስፖርት ዋጋ',
  'Route Management': 'የመንገድ አስተዳደር',
  'GPS Tracking': 'የGPS ክትትል',
  'Dispatch Management': 'የመላኪያ አስተዳደር',
  'Proof of Delivery': 'የአቅርቦት ማረጋገጫ',
  'Financial Records': 'የፋይናንስ መዝገቦች',
  'Performance Analytics': 'የአፈጻጸም ትንታኔ',

  // ---- Common actions ------------------------------------------------------
  'Search': 'ፍለጋ',
  'Search…': 'ፈልግ…',
  'Export CSV': 'CSV አውጣ',
  'Save': 'አስቀምጥ',
  'Saving…': 'በማስቀመጥ ላይ…',
  'Cancel': 'ሰርዝ',
  'Close': 'ዝጋ',
  'Submit': 'አስገባ',
  'Delete': 'አጥፋ',
  'Edit': 'አስተካክል',
  'Add': 'ጨምር',
  'View': 'ተመልከት',
  'Open menu': 'ምናሌ ክፈት',
  'Actions': 'እርምጃዎች',
  'Status': 'ሁኔታ',
  'Total': 'ጠቅላላ',
  'Approve': 'አጽድቅ',
  'Reject': 'ውድቅ አድርግ',
  'Suspend': 'አግድ',
  'Activate': 'አግብር',
  'Verify': 'አረጋግጥ',
  'Resolve': 'ፍታ',
  'Investigate': 'መርምር',
  'All': 'ሁሉም',
  'Loading…': 'በመጫን ላይ…',
  'No records yet': 'እስካሁን መዝገብ የለም',
  'No matching records': 'ተመሳሳይ መዝገብ አልተገኘም',
  'Previous': 'ቀዳሚ',
  'Next': 'ቀጣይ',
  'Page': 'ገጽ',
  'of': 'ከ',
  'Refresh': 'አድስ',
  'Download': 'አውርድ',
  'Upload': 'ጫን',
  'Review': 'ገምግም',
  'Details': 'ዝርዝር',
  'Filters': 'ማጣሪያዎች',
  'Clear': 'አጽዳ',
  'Send': 'ላክ',
  'Back': 'ተመለስ',
  'Quick actions': 'ፈጣን እርምጃዎች',
  'Recent activity': 'የቅርብ እንቅስቃሴ',
  'Overview': 'አጠቃላይ እይታ',
  'Alerts': 'ማንቂያዎች',

  // ---- Domain terms --------------------------------------------------------
  'Revenue': 'ገቢ',
  'Sales': 'ሽያጭ',
  'Orders': 'ትዕዛዞች',
  'Products': 'ምርቶች',
  'Users': 'ተጠቃሚዎች',
  'Reports': 'ሪፖርቶች',
  'Settings': 'ቅንብሮች',
  'Profile': 'መገለጫ',
  'Inventory': 'ክምችት',
  'Stock': 'ክምችት',
  'Pending': 'በመጠባበቅ ላይ',
  'Confirmed': 'ተረጋግጧል',
  'Shipped': 'ተልኳል',
  'Delivered': 'ደርሷል',
  'Cancelled': 'ተሰርዟል',
  'Paid': 'ተከፍሏል',
  'Unpaid': 'ያልተከፈለ',
  'Refunded': 'ተመላሽ ሆኗል',
  'Price': 'ዋጋ',
  'Quantity': 'ብዛት',
  'Unit': 'መለኪያ',
  'Date': 'ቀን',
  'Name': 'ስም',
  'Email': 'ኢሜይል',
  'Phone': 'ስልክ',
  'City': 'ከተማ',
  'Address': 'አድራሻ',
  'Category': 'ምድብ',
  'Description': 'መግለጫ',
  'Budget': 'በጀት',
  'Project': 'ፕሮጀክት',
  'Projects': 'ፕሮጀክቶች',
  'Compliance': 'ተገዢነት',
  'Verified': 'ተረጋግጧል',
  'Not verified': 'ያልተረጋገጠ',
  'Language': 'ቋንቋ',
  'English': 'እንግሊዝኛ',
  'Amharic': 'አማርኛ',
  'Activity': 'እንቅስቃሴ',
  'Top products': 'ምርጥ ምርቶች',
  'Low stock': 'ዝቅተኛ ክምችት',
  'Delivery': 'አቅርቦት',
  'Payment': 'ክፍያ',
  'Payments': 'ክፍያዎች',
  'Finance': 'ፋይናንስ',
  'Security': 'ደህንነት',
  'Audit log': 'የኦዲት መዝገብ',
  'System health': 'የስርዓት ጤና',
  'Complaints': 'ቅሬታዎች',
  'Disputes': 'ክርክሮች',
  'Notifications': 'ማሳወቂያዎች',
  'Messages': 'መልዕክቶች',
  'Performance': 'አፈጻጸም',
  'Earnings': 'ገቢዎች',
  'Routes': 'መንገዶች',
  'Dispatch': 'መላኪያ',
  'Vehicles': 'ተሽከርካሪዎች',
  'Drivers': 'አሽከርካሪዎች',
  'Documents': 'ሰነዶች',
  'Reviews': 'ግምገማዎች',
  'Site': 'ጣቢያ',
  'Warehouse': 'መጋዘን',
  'Verification': 'ማረጋገጫ',
  'Quotations': 'የዋጋ ማቅረቢያዎች',
  'Invoices': 'ደረሰኞች',
  'Forecast': 'ትንበያ',
  'Recommended': 'የተመከረ',
  'Distance': 'ርቀት',
  'Transport': 'ትራንስፖርት',
  'Subtotal': 'ንዑስ ድምር',
  'VAT': 'ተእታ',
  'Grand total': 'ጠቅላላ ድምር',
  'Verified suppliers': 'የተረጋገጡ አቅራቢዎች',
  'Pending verification': 'ማረጋገጫ በመጠባበቅ ላይ',
  'Account status': 'የመለያ ሁኔታ',
  'Suspended': 'ተግዷል',
  'Active': 'ንቁ',
  'Open': 'ክፍት',
  'Resolved': 'ተፈትቷል',
  'Investigating': 'በመመርመር ላይ',
  'Submitted': 'ቀርቧል',
  'Accepted': 'ተቀብሏል',
  'Declined': 'ውድቅ ተደርጓል',
  'Planning': 'በእቅድ ላይ',
  'On hold': 'ቆሟል',
  'Completed': 'ተጠናቋል',
  'Available': 'ይገኛል',
  'In service': 'በአገልግሎት ላይ',
  'Maintenance': 'ጥገና',
  'On trip': 'በጉዞ ላይ',
  'Off duty': 'ከስራ ውጪ',
  'Total users': 'ጠቅላላ ተጠቃሚዎች',
  'Total orders': 'ጠቅላላ ትዕዛዞች',
  'Total products': 'ጠቅላላ ምርቶች',
  'Active orders': 'ንቁ ትዕዛዞች',
  'Pending orders': 'በመጠባበቅ ላይ ያሉ ትዕዛዞች',
  'Average order value': 'አማካይ የትዕዛዝ ዋጋ',
  'Stock value': 'የክምችት ዋጋ',
  'Low-stock items': 'ዝቅተኛ ክምችት ያላቸው ምርቶች',
  'Delivery revenue': 'የአቅርቦት ገቢ',
  'VAT collected': 'የተሰበሰበ ተእታ',
  'Registered accounts': 'የተመዘገቡ መለያዎች',
  'Compliance reviews': 'የተገዢነት ግምገማዎች',
  'Open complaints': 'ክፍት ቅሬታዎች',
  'Delivery jobs': 'የአቅርቦት ስራዎች',
  'No data for this period': 'ለዚህ ጊዜ መረጃ የለም',
  'New': 'አዲስ',
  'Add product': 'ምርት ጨምር',
  'Add project': 'ፕሮጀክት ጨምር',
  'New RFQ': 'አዲስ የዋጋ ጥያቄ',
  'Submit quotation': 'የዋጋ ማቅረቢያ አስገባ',
  'File a complaint': 'ቅሬታ አቅርብ',
  'Send announcement': 'ማስታወቂያ ላክ',
  'Change language': 'ቋንቋ ቀይር',
  'Workspace': 'የስራ ቦታ',
  'Menu': 'ዝርዝር',
  'More': 'ተጨማሪ',
  'Back to dashboard': 'ወደ ዳሽቦርድ ተመለስ',
  'Export report': 'ሪፖርት አውጣ',
  'All records': 'ሁሉም መዝገቦች',
  'Requires registration': 'ምዝገባ ይፈልጋል',
  'Publicly accessible': 'ለሁሉም ክፍት',
  'Sign in to continue': 'ለመቀጠል ይግቡ',
  'Create account': 'መለያ ፍጠር',
  'Demo data': 'የማሳያ መረጃ',
  'Source': 'ምንጭ',
  'Updated': 'ተዘምኗል',
  'Contact': 'አግኙ',
  'Working hours': 'የስራ ሰዓት',
  'Service areas': 'የአገልግሎት አካባቢዎች',
  'Capacity': 'አቅም',
  'Plate': 'ታርጋ',
  'Make & model': 'ሞዴል',
  'Licence': 'ፈቃድ',
  'Expiry': 'መብቃቂያ',
  'Driver': 'አሽከርካሪ',
  'Vehicle': 'ተሽከርካሪ',
  'Assign': 'መድብ',
  'Unassign': 'አላድብ',
  'Claim': 'ተቀበል',
  'Advance status': 'ሁኔታ አሳድግ',
  'Proof': 'ማረጋገጫ',
  'Route': 'መንገድ',
  'Estimated time': 'የሚገመተው ጊዜ',
  'Rate per km': 'በኪሜ ዋጋ',
  'Start fee': 'የመጀመሪያ ክፍያ',
  'Rate per ton': 'በቶን ዋጋ',
  'Total jobs': 'ጠቅላላ ስራዎች',
  'Completed jobs': 'የተጠናቀቁ ስራዎች',
  'Average rating': 'አማካይ ደረጃ',
  'Fulfilment rate': 'የማሟላት መጠን',
  'Response time': 'የምላሽ ጊዜ',
  'Best sellers': 'በብዛት የተሸጡ',
  'Retention': 'የደንበኛ ቅጥር',
  'Quotation acceptance': 'የዋጋ ማቅረቢያ ተቀባይነት',
  'Spend': 'ወጪ',
  'Savings': 'ቁጠባ',
  'Budget used': 'የተጠቀመ በጀት',
  'Materials': 'ቁሳቁሶች',
  'Supplier': 'አቅራቢ',
  'Buyer': 'ገዢ',
  'Seller': 'ሻጭ',
  'Reference': 'ማጣቀሻ',
  'Valid until': 'እስከሚሰራበት ቀን',
  'Required by': 'የሚያስፈልግበት ቀን',
  'Site address': 'የጣቢያ አድራሻ',
  'Notes': 'ማስታወሻ',
  'Response': 'ምላሽ',
  'Subject': 'ርዕስ',
  'Message': 'መልዕክት',
  'Against': 'በተጨማሪ',
  'Raised by': 'ያቀረበው',
  'Created': 'ተፈጥሯል',
  'Updated at': 'የተዘመነበት',
  'Attachments': 'አባሪዎች',
  'Search products, suppliers, orders…': 'ምርቶች፣ አቅራቢዎች፣ ትዕዛዞች ፈልግ…',
  'All categories': 'ሁሉም ምድቦች',
  'All cities': 'ሁሉም ከተሞች',
  'All statuses': 'ሁሉም ሁኔታዎች',
  'Newest first': 'አዲስ መጀመሪያ',
  'Oldest first': 'ቀድሞ መጀመሪያ',
  'Highest value': 'ከፍተኛ ዋጋ',
  'Lowest value': 'ዝቅተኛ ዋጋ',
};

const LANG_KEY = 'escon_language';

const readLanguage = (): Lang => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'am') return saved;
  } catch {
    /* storage unavailable — keep English */
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
    /* storage unavailable — the choice still applies for this session */
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
