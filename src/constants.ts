// ===== src/constants.ts =====
// Static reference lists only. All business records (accounts, suppliers,
// products, orders) live in Supabase / localStorage and are edited in the app.
// The demo dataset that used to be hard-coded here is now supabase/seed.sql.

export const ETHIOPIAN_CITIES = [
  'Addis Ababa', 'Adama', 'Bahir Dar', 'Gondar', 'Dessie',
  'Hawassa', 'Jimma', 'Jijiga', 'Mekelle', 'Dire Dawa',
  'Harar', 'Nekemte', 'Debre Markos', 'Asosa', 'Gambela',
  'Semera', 'Debre Berhan', 'Wolkite', 'Bishoftu', 'Shashemene'
];

export const MEASUREMENT_UNITS = [
  'pcs', 'kg', 'ton', 'm3', 'm2', 'gallon', 'quintal', 'liter',
  'bag', 'roll', 'box', 'set', 'pair', 'piece', 'dozen', 'bundle'
];

export const DEPARTMENTS = [
  'Construction', 'Transport', 'Health', 'Education', 'Agriculture',
  'Manufacturing', 'Energy', 'Mining', 'Technology', 'Retail',
  'Services', 'Hospitality', 'Logistics', 'Pharmaceutical',
  'Automotive', 'Environmental', 'Water', 'Telecom', 'Food & Beverage'
];
