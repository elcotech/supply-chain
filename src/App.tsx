import React, { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import './App.css';
import { User, Company, Material, Order, Alert, FormData, SearchResult, CartItem, CartReport, CartSupplier, SystemSettings, ProformaShareData, AppNotification, WalletTx, ProductReview, BackupPayload, DeliveryMode, MaterialDelivery } from './types';
import {
  ETHIOPIAN_CITIES, MEASUREMENT_UNITS, DEPARTMENTS
} from './constants';
import {
  safeLocalStorage, formatCurrency, formatDate,
  calculateDistance, isUserLocked,
  exportToCSV, exportOrdersToCSV,
  geocodeAddress, computeDeliveryFee, computeLineDeliveryFee, lineDeliveryMode,
  deliveryBasisLabel, checkMinOrder,
  decodeProformaPayload, genId, forecastPrice, effectiveRating, applyWalletOp,
  deliveryEta, timeAgo, validateBackup, downloadJson, findOtherCartSupplier,
  vatOnSubtotal, allocateVat, cartGrandTotal
} from './utils';
import { loadSettings, saveSettings, ADMIN_USER, ADMIN_EMAIL } from './settings';
import { cloudPush, fetchCloudChanges, pullCloudToCache, subscribeToCloud } from './lib/cloudStore';
import EditCompany from './components/EditCompany';
import MapPicker from './components/MapPicker';
import DateTime from './components/DateTime';
import ProformaInvoice from './components/ProformaInvoice';
import PublicProforma from './components/PublicProforma';
import InstallGuide from './components/InstallGuide';
import AdminSettings from './components/AdminSettings';
import OrderTimeline from './components/OrderTimeline';
import { Sparkline, StarRatingDisplay, StarRatingInput } from './components/Charts';
import useIsMobile from './hooks/useIsMobile';

// Live date & time shown on the shopping cart. The cart is a transient view so
// a ticking clock here is desirable (unlike the proforma, which freezes a
// timestamp once for a stable invoice number/date).
function LiveClock() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const date = now.toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'long', year: 'numeric',
  });
  const time = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  return (
    <span className="cart-live-clock">
      📅 {date} · 🕒 {time}
    </span>
  );
}

// Demo wallet welcome balance given to every account for the in-app wallet.
const WELCOME_BONUS = 25000;
const LOW_STOCK_THRESHOLD = 10;

// Rebuild a missing supplier profile from the account that owns it. Older
// builds dropped companies that were not part of the demo seed on startup, and
// a cloud merge can leave a company user without a matching profile; either way
// the supplier must be able to open and save their business details.
const companyFromUser = (user: User): Company => {
  const registered = user.registered ? new Date(user.registered) : new Date();
  const established = isNaN(registered.getTime())
    ? new Date().getFullYear().toString()
    : registered.getFullYear().toString();
  return {
    id: genId('comp'),
    userId: user.id,
    name: user.companyName || user.name,
    description: '',
    location: user.address || '',
    city: user.city || 'Addis Ababa',
    lat: typeof user.lat === 'number' && isFinite(user.lat) ? user.lat : 9.032,
    lng: typeof user.lng === 'number' && isFinite(user.lng) ? user.lng : 38.7469,
    rating: 0,
    totalOrders: 0,
    established,
    tinNumber: user.tinNumber || '',
    businessLicense: user.businessLicense || '',
    vatNumber: user.vatRegistered ? user.vatNumber || '' : '',
    tradeLicenseExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    complianceStatus: 'compliant',
  };
};

// Last-resort supplier record for a cart line whose profile cannot be rebuilt
// from an account. The goods value of the line must still be priced, grouped
// and ordered - it is never dropped just because the profile record is gone.
const stubCompany = (id: string, name: string): Company => ({
  id,
  userId: '',
  name: name || 'Unknown supplier',
  description: '',
  location: '',
  city: '',
  lat: 9.032,
  lng: 38.7469,
  rating: 0,
  totalOrders: 0,
  established: '',
  tinNumber: '',
  businessLicense: '',
  vatNumber: '',
  tradeLicenseExpiry: '',
  complianceStatus: 'compliant',
});

// One-time upgrade flag: older releases kept business data on-device, so the
// first cloud-enabled start merges the local copy with whatever is in Supabase
// before the cloud becomes authoritative. Local items win on duplicate IDs, so
// products added just before upgrading are never lost.
const CLOUD_MERGE_KEY = 'escon_cloud_merge_v2';
const MIGRATED_COLLECTIONS = [
  'users', 'companies', 'materials', 'orders', 'notifications',
  'wallets', 'wallet_transactions', 'reviews', 'system_settings',
];

const mergeById = <T extends { id: string }>(local: T[], cloud: T[]): T[] => {
  if (!Array.isArray(local)) return Array.isArray(cloud) ? cloud : [];
  if (!Array.isArray(cloud)) return local;
  const localIds = new Set(local.map(item => item && item.id));
  return [...local, ...cloud.filter(item => item && item.id && !localIds.has(item.id))];
};

const snapshotLegacyLocal = (): Array<[string, string]> => {
  const snapshot: Array<[string, string]> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const shared = MIGRATED_COLLECTIONS.indexOf(key) >= 0 ||
        key.startsWith('cart_') || key.startsWith('favs_');
      if (!shared) continue;
      const raw = localStorage.getItem(key);
      if (raw !== null) snapshot.push([key, raw]);
    }
  } catch {
    /* storage unavailable — nothing to merge */
  }
  return snapshot;
};

// Key-order-independent JSON so a row echoed back by Realtime compares equal to
// the copy already in localStorage (Postgres jsonb does not preserve key order).
const canonicalJson = (value: unknown): string => {
  const normalise = (input: any): any => {
    if (Array.isArray(input)) return input.map(normalise);
    if (input && typeof input === 'object') {
      return Object.keys(input).sort().reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalise(input[key]);
        return acc;
      }, {});
    }
    return input;
  };
  try { return JSON.stringify(normalise(value)); } catch { return ''; }
};

const MapComponent = React.lazy(() => import('./components/MapComponent'));

// The cart quantity has to be freely editable. A number input wired straight to
// state re-renders on every keystroke (clearing the box yields NaN), which makes
// the cart look read-only — so the field keeps a local draft string and only
// commits a valid whole number, on blur, on Enter or via the − / + keys.
// Next to the quantity sits the "with / without delivery cost" checkbox, so the
// buyer decides while filling in how many units they want. Module scope on
// purpose: defined inside App() it would be a new component type on every
// render, remounting the input and dropping the draft.
const CartQuantityInput = ({ item, onCommit, onToggleDelivery }: {
  item: CartItem;
  onCommit: (itemId: string, quantity: number) => void;
  onToggleDelivery: (itemId: string, includeDelivery: boolean) => void;
}) => {
  const [draft, setDraft] = useState(String(item.quantity));
  useEffect(() => { setDraft(String(item.quantity)); }, [item.quantity]);
  // Carts saved before the option existed have no flag; `undefined` means the
  // historical behaviour — delivery included.
  const withDelivery = item.includeDelivery !== false;

  const commit = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      setDraft(String(parsed));
      onCommit(item.id, parsed);
      return;
    }
    // Nothing valid typed (e.g. an empty field while editing) — resync silently.
    setDraft(String(item.quantity));
  };

  return (
    <div className="cart-item-quantity">
      <button type="button" className="cart-qty-btn" onClick={() => commit(String(Math.max(1, item.quantity - 1)))} aria-label={'Decrease quantity of ' + item.materialName}>−</button>
      <input
        type="number"
        inputMode="numeric"
        value={draft}
        min={1}
        step={1}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit((e.target as HTMLInputElement).value); } }}
        aria-label={'Quantity of ' + item.materialName}
      />
      <button type="button" className="cart-qty-btn" onClick={() => commit(String(item.quantity + 1))} aria-label={'Increase quantity of ' + item.materialName}>+</button>
      <span>{item.unit}</span>
      <label className={'cart-delivery-toggle' + (withDelivery ? ' on' : '')}>
        <input
          type="checkbox"
          checked={withDelivery}
          onChange={e => onToggleDelivery(item.id, e.target.checked)}
          aria-label={'Include delivery cost for ' + item.materialName}
        />
        <span>With delivery</span>
      </label>
    </div>
  );
};

// Resolve the delivery fee for one cart line, shared by the cart summary and the
// order it produces so the two can never disagree. The buyer's checkbox is the
// master switch; when it is on, the supplier's published rate (starting fee +
// per km over the measured distance) wins, and the platform's admin rules are
// only consulted when the supplier has no rate of its own.
const resolveLineDelivery = async (
  item: CartItem,
  supplier: Company,
  distanceKm: number,
  orderSubtotal: number,
  customer: User,
  settings: SystemSettings
): Promise<{ fee: number; mode: DeliveryMode }> => {
  const includeDelivery = item.includeDelivery !== false;
  const rate = item.deliveryRate;
  if (!includeDelivery) return { fee: 0, mode: 'none' };
  let platformFee = 0;
  if (!(rate && rate.offered)) {
    platformFee = await computeDeliveryFee({
      supplierLat: supplier.lat,
      supplierLng: supplier.lng,
      customerLat: customer.lat || 9.0320,
      customerLng: customer.lng || 38.7469,
      customerCity: customer.city || null,
      weightTons: (item.weightPerUnit || 0.001) * item.quantity,
      orderSubtotal,
      settings,
    });
  }
  return {
    fee: computeLineDeliveryFee({ includeDelivery, rate, distanceKm, platformFee }),
    mode: lineDeliveryMode({ includeDelivery, rate }),
  };
};

// Two lines from the same supplier can be billed differently (one with delivery
// at the supplier's rate, one collected by the buyer). Fold their modes into the
// single badge the cart group and the proforma show.
const combineDeliveryModes = (a?: DeliveryMode, b?: DeliveryMode): DeliveryMode => {
  if (!a) return b || 'none';
  if (!b) return a;
  if (a === b) return a;
  if (a === 'none') return b;
  if (b === 'none') return a;
  return 'platform'; // a genuine mix of supplier-rate and platform-rate lines
};

// Read a supplier's delivery terms out of the add/edit product form. The rate is
// only kept when the supplier ticks the box AND supplies a non-zero number,
// otherwise the platform's admin-configured delivery rules apply instead.
const buildMaterialDelivery = (form: FormData): MaterialDelivery | undefined => {
  if (!form.materialDeliveryOffered) return undefined;
  const perKm = Math.max(0, parseFloat(form.materialDeliveryPerKm) || 0);
  const startFee = Math.max(0, parseFloat(form.materialDeliveryStartFee) || 0);
  if (perKm <= 0 && startFee <= 0) return { offered: false, perKm: 0, startFee: 0 };
  return { offered: true, perKm, startFee };
};

// Order-quantity picker on the product details page. The number is a real input,
// not a read-only label: the customer can tap − / + OR type any whole number and
// press Enter (or click away). Same draft-string trick as CartQuantityInput, so
// clearing the field never pushes NaN into the order total. Module scope on
// purpose — defined inside App() it would remount on every render and drop the
// draft while the customer is typing.
const QuantityStepper = ({ value, min, unit, onChange }: { value: number; min: number; unit: string; onChange: (v: number) => void }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= min) {
      setDraft(String(parsed));
      onChange(parsed);
      return;
    }
    // Empty or below the minimum while editing — resync silently, never NaN.
    setDraft(String(value));
  };

  return (
    <div className="qty-stepper" role="group" aria-label="Quantity">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Decrease quantity" disabled={value <= min}>−</button>
      <input
        className="qty-value"
        type="number"
        inputMode="numeric"
        value={draft}
        min={min}
        step={1}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit((e.target as HTMLInputElement).value); } }}
        aria-label={'Quantity in ' + (unit || 'units')}
      />
      <span className="qty-unit">{unit || 'units'}</span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Increase quantity">+</button>
    </div>
  );
};

function App() {
  // ---------- State ----------
  const [showSplash, setShowSplash] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchPerformed, setIsSearchPerformed] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartSummary, setShowCartSummary] = useState(false);
  const [cartDetails, setCartDetails] = useState<CartReport | null>(null);
  // Optional buyer-set delivery fee. null = use the automatic fee computed from
  // system settings; a number overrides it everywhere (cart, proforma, orders).
  const [deliveryFeeOverride, setDeliveryFeeOverride] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showSupplierMap, setShowSupplierMap] = useState(false);
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [showMyLocationPicker, setShowMyLocationPicker] = useState(false);
  const [adminCompanyTarget, setAdminCompanyTarget] = useState<{ company: Company; user: User } | null>(null);
  const [adminEditingMaterial, setAdminEditingMaterial] = useState(false);
  const [currentPage, setCurrentPage] = useState<string>('splash');
  const [darkMode, setDarkMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRouteSupplierId, setAutoRouteSupplierId] = useState<string | null>(null);
  // Bumped on every explicit route request so the map redraws the route even when
  // the same supplier is clicked twice in a row.
  const [routeRequestId, setRouteRequestId] = useState(0);
  const [showProforma, setShowProforma] = useState(false);
  // "To Proforma" opens the document and queues the browser print dialog;
  // "To Preview" opens the same document read-only on screen.
  const [proformaAutoPrint, setProformaAutoPrint] = useState(false);
  // Report the proforma is rendered from. Kept apart from cartDetails because a
  // proforma always covers the whole cart - one supplier, every selected line.
  const [proformaDetails, setProformaDetails] = useState<CartReport | null>(null);
  // True for a few seconds after the buyer comes back from the proforma, so the
  // cart can pulse its "To Purchase" step and make clear where they landed.
  const [highlightPurchaseStep, setHighlightPurchaseStep] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareItems, setCompareItems] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [publicProformaData, setPublicProformaData] = useState<ProformaShareData | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => loadSettings());

  // ---------- v6 state: notifications, wallets, reviews ----------
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = safeLocalStorage.getItem('notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [wallets, setWallets] = useState<Record<string, number>>(() => {
    const saved = safeLocalStorage.getItem('wallets');
    return saved ? JSON.parse(saved) : {};
  });
  const [transactions, setTransactions] = useState<WalletTx[]>(() => {
    const saved = safeLocalStorage.getItem('wallet_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  const [reviews, setReviews] = useState<ProductReview[]>(() => {
    const saved = safeLocalStorage.getItem('reviews');
    return saved ? JSON.parse(saved) : [];
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showDataCenter, setShowDataCenter] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(10000);
  const [topUpMethod, setTopUpMethod] = useState('Telebirr');
  const [reviewDraft, setReviewDraft] = useState<{ rating: number; comment: string }>({ rating: 5, comment: '' });
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'cod' | 'wallet'>('bank');

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  // The realtime listener is installed once; this ref lets it check which
  // per-user cart/favourites row belongs to the signed-in account.
  const currentUserRef = useRef<User | null>(null);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // ---------- Role visibility ----------
  // Stock levels are internal supplier data: only signed-in suppliers (company
  // accounts) and admins ever see them. Customers and signed-out visitors must
  // not learn how much of a product is left, so every stock number in the UI is
  // gated behind this flag.
  const canSeeStock = currentUser?.userType === 'company' || currentUser?.userType === 'admin';

  // ---------- Mobile / desktop shell ----------
  const isMobile = useIsMobile();
  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  // The "To Purchase" step pulses for a few seconds after the buyer returns from
  // the proforma ("Back to To Purchase"), so it is obvious where they landed.
  useEffect(() => {
    if (!highlightPurchaseStep) return;
    const timer = setTimeout(() => setHighlightPurchaseStep(false), 8000);
    return () => clearTimeout(timer);
  }, [highlightPurchaseStep]);

  // ---------- Proforma QR deep-link (#escon=payload) ----------
  // Decode the compact payload embedded in a QR code and open the
  // mobile-friendly proforma view directly, whatever page the user is on.
  useEffect(() => {
    const handleHash = () => {
      const match = window.location.hash.match(/^#escon=(.+)$/);
      if (match) {
        const data = decodeProformaPayload(match[1]);
        if (data) setPublicProformaData(data);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // ---------- PWA Install prompt ----------
  useEffect(() => {
    const dismissed = safeLocalStorage.getItem('pwa_install_dismissed');
    if (dismissed) { setShowInstallBanner(false); return; }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') { showAlert('App installed! 🎉', 'success'); }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    safeLocalStorage.setItem('pwa_install_dismissed', 'true');
  };

  const [formData, setFormData] = useState<FormData>({
    loginEmail: '', loginPassword: '', selectedUser: '',
    registerFullName: '', registerEmail: '', registerPassword: '', registerPhone: '',
    registerAddress: '', registerCity: 'Addis Ababa', registerLat: 0, registerLng: 0, registerCompanyName: '', registerUserType: 'customer',
    tinNumber: '', businessLicense: '', vatNumber: '', vatRegistered: false,
    materialName: '', materialCategory: '', materialPrice: '', materialQuantity: '', materialUnit: '',
    materialMinOrder: '', materialDescription: '', searchQuery: '', searchCategory: 'all',
    searchMaxPrice: '', searchSupplier: 'all', searchCity: 'all', searchSortBy: 'price_asc',
    orderQuantity: '', orderAddress: '', materialBrand: '', materialModel: '', materialWeight: '',
    materialDimensions: '', materialGrade: '', materialOrigin: 'Ethiopia', materialCertifications: '', materialImages: [],
    materialProfitMargin: '15', materialTransportCost: '15', materialVatPercentage: '15', materialTaxIncluded: false, materialWeightPerUnit: '0.001',
    materialDeliveryOffered: false, materialDeliveryPerKm: '', materialDeliveryStartFee: '',
    companyName: '', companyDescription: '', companyLocation: '', companyCity: '',
    companyPhone: '', companyEmail: '', companyWebsite: '', companyWorkingHours: '',
    companyTinNumber: '', companyBusinessLicense: '', companyVatNumber: '', companyTradeLicenseExpiry: '',
  });

  // ---------- Page transition animation ----------
  const [pageAnimating, setPageAnimating] = useState(false);

  useEffect(() => {
    if (currentPage !== 'splash') {
      setPageAnimating(true);
      const t = setTimeout(() => setPageAnimating(false), 500);
      return () => clearTimeout(t);
    }
  }, [currentPage]);

  // ---------- Dark mode & Fullscreen ----------
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
    } else {
      document.exitFullscreen().catch(err => console.warn(err));
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ---------- Close map on page change ----------
  useEffect(() => {
    setShowSupplierMap(false);
  }, [currentPage]);

  // ---------- Helpers ----------
  const showAlert = useCallback((message: string, type: Alert['type'] = 'info', duration = 5000): void => {
    setAlert({ message, type });
    if (duration > 0) setTimeout(() => setAlert(null), duration);
  }, []);

  const getCompanyById = useCallback((id: string): Company | undefined => {
    return companies.find(c => c.id === id);
  }, [companies]);

  const getMaterialById = useCallback((id: string): Material | undefined => {
    return materials.find(m => m.id === id);
  }, [materials]);

  const getCompanyByUserId = useCallback((userId: string): Company | undefined => {
    return companies.find(c => c.userId === userId);
  }, [companies]);

  // A cart line must always keep its supplier. Profiles go missing when an older
  // build dropped them or a cloud row arrives without them; pricing or ordering
  // must never silently skip such a line, because its goods value would vanish
  // from the total while still being shown on screen. Rebuild the record from the
  // owning account under its original id and keep it from then on.
  const ensureSupplierCompany = useCallback((supplierId: string, supplierName: string): Company => {
    const existing = companies.find(c => c.id === supplierId);
    if (existing) return existing;
    const name = (supplierName || '').trim().toLowerCase();
    const owner = name
      ? users.find(u => u.userType === 'company' && (u.companyName || '').trim().toLowerCase() === name)
      : undefined;
    const rebuilt = owner ? { ...companyFromUser(owner), id: supplierId } : stubCompany(supplierId, supplierName);
    setCompanies(prev => prev.some(c => c.id === rebuilt.id) ? prev : [...prev, rebuilt]);
    return rebuilt;
  }, [companies, users]);

  const getUserById = useCallback((id: string): User | undefined => {
    return users.find(u => u.id === id);
  }, [users]);

  const navigateTo = useCallback((page: string): void => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Every page heading greets the signed-in user by name, so the word the
  // requirement asks for ("Welcome") is present on every heading, on desktop
  // and mobile alike.
  const welcomeTitle = useCallback((title: string): string => {
    const firstName = currentUser?.name?.trim().split(/\s+/)[0];
    return firstName ? `Welcome, ${firstName} — ${title}` : `Welcome — ${title}`;
  }, [currentUser]);

  // Apply one cloud row to the React state. Echoes of our own pushes are ignored
  // by comparing with the local copy first, so devices cannot ping-pong writes.
  const applyCloudRow = useCallback((key: string, data: unknown): void => {
    const uid = currentUserRef.current?.id || '';
    if (key.startsWith('cart_') && key !== `cart_${uid}`) return;
    if (key.startsWith('favs_') && key !== `favs_${uid}`) return;

    const localRaw = safeLocalStorage.getItem(key);
    if (localRaw !== null) {
      try {
        if (canonicalJson(JSON.parse(localRaw)) === canonicalJson(data)) return;
      } catch {
        /* corrupt local value — let the cloud copy replace it */
      }
    }
    try {
      safeLocalStorage.setItem(key, JSON.stringify(data));
    } catch {
      return; // storage quota — keep the in-memory state as it is
    }

    const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);
    switch (key) {
      case 'users': {
        const list = asArray<User>(data);
        setUsers(list);
        setCurrentUser(prev => prev ? (list.find(u => u.id === prev.id) || prev) : prev);
        break;
      }
      case 'companies': {
        const cloudList = asArray<Company>(data);
        // A cloud row must never drop a supplier profile this device already
        // has (an older build or another device can push a list without it),
        // and every company account must end up with a profile. Merge both
        // ways, then keep the healed list in the cache so the local copy and
        // the cloud converge on the same data.
        const prevLocal: Company[] = (() => {
          try { return localRaw ? JSON.parse(localRaw) as Company[] : []; } catch { return []; }
        })();
        const merged = [...cloudList];
        const mergedIds = new Set(merged.map(c => c.id));
        const mergedUserIds = new Set(merged.map(c => c.userId));
        prevLocal.forEach(c => {
          if (!mergedIds.has(c.id) && !mergedUserIds.has(c.userId)) merged.push(c);
        });
        try {
          const parsedUsers = JSON.parse(safeLocalStorage.getItem('users') || '[]') as User[];
          const owned = new Set(merged.map(c => c.userId));
          parsedUsers.forEach(u => {
            if (u.userType !== 'company' || owned.has(u.id)) return;
            // Same recovery as startup: re-attach a name-matching orphan first
            // so products already pointing at that profile keep their id.
            const companyName = (u.companyName || '').trim().toLowerCase();
            const orphan = companyName
              ? merged.find(c =>
                  c.name.trim().toLowerCase() === companyName &&
                  !parsedUsers.some(other => other.id === c.userId))
              : undefined;
            if (orphan) {
              const idx = merged.indexOf(orphan);
              merged[idx] = { ...orphan, userId: u.id };
              owned.add(u.id);
            } else {
              const rebuilt = companyFromUser(u);
              merged.push(rebuilt);
              owned.add(u.id);
            }
          });
        } catch {
          /* unreadable user list - keep whatever profiles we already have */
        }
        setCompanies(merged);
        safeLocalStorage.setItem('companies', JSON.stringify(merged));
        break;
      }
      case 'materials': {
        const list = asArray<Material>(data);
        setMaterials(list);
        setEditingMaterial(prev => prev ? (list.find(m => m.id === prev.id) || prev) : prev);
        break;
      }
      case 'orders':
        setOrders(asArray<Order>(data));
        break;
      case 'notifications':
        setNotifications(asArray<AppNotification>(data));
        break;
      case 'wallets':
        setWallets(data && typeof data === 'object' ? data as Record<string, number> : {});
        break;
      case 'wallet_transactions':
        setTransactions(asArray<WalletTx>(data));
        break;
      case 'reviews':
        setReviews(asArray<ProductReview>(data));
        break;
      case 'system_settings':
        setSystemSettings(data as SystemSettings);
        break;
      default:
        if (uid && key === `cart_${uid}`) setCart(asArray<CartItem>(data));
        if (uid && key === `favs_${uid}`) setFavorites(asArray<string>(data));
    }
  }, []);

  // ---------- v6 core helpers: notifications, wallet, reviews ----------
  const pushNotification = useCallback((userId: string, type: AppNotification['type'], title: string, message: string): void => {
    setNotifications(prev => [
      { id: genId('ntf'), userId, type, title, message, createdAt: Date.now(), read: false },
      ...prev,
    ].slice(0, 100));
  }, []);

  const notifyOrderParties = useCallback((order: Order, title: string, message: string, type: AppNotification['type'] = 'order'): void => {
    pushNotification(order.customerId, type, title, message);
    const supplierUser = getUserById(companies.find(c => c.id === order.companyId)?.userId || '');
    if (supplierUser) pushNotification(supplierUser.id, type, title, message);
  }, [companies, getUserById, pushNotification]);

  const walletBalance = useCallback((userId: string): number => wallets[userId] || 0, [wallets]);

  const applyWalletChange = useCallback((userId: string, kind: WalletTx['kind'], amount: number, note: string): number | null => {
    const current = walletBalance(userId);
    const next = applyWalletOp(current, kind, amount);
    if (next === null) return null;
    setWallets(prev => ({ ...prev, [userId]: next }));
    setTransactions(prev => [
      { id: genId('tx'), userId, kind, amount, balanceAfter: next, note, date: Date.now() },
      ...prev,
    ].slice(0, 300));
    return next;
  }, [walletBalance]);

  const topUpWallet = useCallback((amount: number, method: string): void => {
    if (!currentUser) return;
    const next = applyWalletChange(currentUser.id, 'topup', amount, `Top-up via ${method}`);
    if (next === null) return;
    pushNotification(currentUser.id, 'payment', 'Wallet top-up successful',
      `ETB ${amount.toLocaleString()} added via ${method}. New balance ${formatCurrency(next)}.`);
    showAlert(`Wallet topped up! ${formatCurrency(next)}`, 'success');
    setShowTopUp(false);
  }, [applyWalletChange, currentUser, showAlert, pushNotification]);

  const reviewForMaterial = useCallback((materialId: string): ProductReview[] =>
    reviews.filter(r => r.materialId === materialId).sort((a, b) => b.date - a.date),
    [reviews]);

  const ratingForMaterial = useCallback((m: Material): number =>
    effectiveRating(m.rating, reviewForMaterial(m.id)),
    [reviewForMaterial]);

  const submitReview = useCallback((materialId: string): void => {
    if (!currentUser || currentUser.userType !== 'customer') return;
    if (reviewDraft.rating < 1 || reviewDraft.rating > 5) { showAlert('Please pick 1–5 stars', 'warning'); return; }
    const material = getMaterialById(materialId);
    const company = material ? getCompanyById(material.companyId) : undefined;
    setReviews(prev => [
      { id: genId('rv'), materialId, userId: currentUser.id, userName: currentUser.name, rating: reviewDraft.rating, comment: reviewDraft.comment.trim(), date: Date.now() },
      ...prev,
    ]);
    if (company) {
      const supplierUser = getUserById(company.userId);
      if (supplierUser) {
        pushNotification(supplierUser.id, 'rating', 'New customer rating',
          `${currentUser.name} rated ${material?.name || 'a product'} ${reviewDraft.rating}★.`);
      }
    }
    setReviewDraft({ rating: 5, comment: '' });
    showAlert('Thanks — your rating was submitted ⭐', 'success');
  }, [currentUser, getCompanyById, getMaterialById, getUserById, pushNotification, reviewDraft, showAlert]);

  const unreadNotifications = useCallback((): number =>
    notifications.filter(n => !n.read).length, [notifications]);

  const markAllNotificationsRead = useCallback((): void => {
    if (currentUser) setNotifications(prev => prev.map(n => n.userId === currentUser.id ? { ...n, read: true } : n));
  }, [currentUser]);

  const markNotificationRead = useCallback((id: string): void => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  // ---------- Data Center ----------
  const buildBackupPayload = useCallback((): BackupPayload | null => {
    if (!currentUser) return null;
    return {
      app: 'ESCON', version: 6, exportedAt: new Date().toISOString(),
      users, companies, materials, orders,
      notifications, wallets, transactions, reviews,
      settings: systemSettings,
    };
  }, [currentUser, users, companies, materials, orders, notifications, wallets, transactions, reviews, systemSettings]);

  const handleBackupExport = useCallback((): void => {
    const payload = buildBackupPayload();
    if (!payload) { showAlert('Login to export a backup', 'warning'); return; }
    downloadJson(payload, `escon-backup-${new Date().toISOString().split('T')[0]}.json`);
    showAlert('Backup downloaded 📦', 'success');
    setShowDataCenter(false);
  }, [buildBackupPayload, showAlert]);

  const handleBackupRestore = useCallback((file: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = validateBackup(JSON.parse(String(reader.result)));
        if (!parsed) { showAlert('Invalid backup file', 'danger'); return; }
        setUsers(parsed.users); setCompanies(parsed.companies); setMaterials(parsed.materials);
        setOrders(parsed.orders); setNotifications(parsed.notifications);
        setWallets(parsed.wallets); setTransactions(parsed.transactions); setReviews(parsed.reviews);
        if (parsed.settings) {
          // Older backups predate the VAT block; save then re-load through the
          // normaliser so the restored settings always contain every field.
          saveSettings(parsed.settings);
          const normalized = loadSettings();
          setSystemSettings(normalized);
          saveSettings(normalized);
        }
        showAlert('Backup restored successfully ✅', 'success');
        setShowDataCenter(false);
        navigateTo('home');
      } catch (e) {
        showAlert('Could not read backup file', 'danger');
      }
    };
    reader.readAsText(file);
  }, [showAlert, navigateTo]);

  // ---------- Geocoding helpers ----------
  const isGenericCoord = useCallback((lat: number, lng: number, city: string): boolean => {
    const cityCenters: Record<string, [number, number]> = {
      'Addis Ababa': [9.0320, 38.7469],
      'Adama': [8.5400, 39.2700],
    };
    const center = cityCenters[city];
    if (!center) return false;
    return Math.abs(lat - center[0]) < 0.01 && Math.abs(lng - center[1]) < 0.01;
  }, []);

  const geocodeCompany = useCallback(async (company: Company): Promise<Company> => {
    if (isGenericCoord(company.lat, company.lng, company.city)) {
      const result = await geocodeAddress(company.location, company.city);
      if (result) return { ...company, lat: result.lat, lng: result.lng };
    }
    return company;
  }, [isGenericCoord]);

  const geocodeAllCompanies = useCallback(async (companiesToGeocode: Company[]): Promise<Company[]> => {
    return await Promise.all(companiesToGeocode.map(geocodeCompany));
  }, [geocodeCompany]);

  // ---------- Initialisation ----------
  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => { setShowSplash(false); setCurrentPage('home'); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSplash, navigateTo]);

  useEffect(() => {
    if (isInitialized) return;
    let cancelled = false;
    const init = async () => {
      // First run of this version: remember local-only data so it can be merged
      // with the cloud instead of being overwritten by an old cloud copy. Do
      // not mark the merge as done when cloud sync is off or the pull failed —
      // otherwise enabling it later would skip this protection.
      const alreadyMerged = Boolean(safeLocalStorage.getItem(CLOUD_MERGE_KEY));
      const legacyLocal = alreadyMerged ? [] : snapshotLegacyLocal();
      // Pull shared data from the cloud BEFORE reading the local cache, so a
      // fresh device (or a device that has been offline) starts from the latest
      // catalogue/accounts instead of its own stale copy.
      const pulled = await pullCloudToCache();
      if (cancelled) return;
      if (pulled && !alreadyMerged) {
        if (legacyLocal.length > 0) {
          legacyLocal.forEach(([key, raw]) => {
            // system_settings was already synced by v6.0, so the cloud copy wins.
            if (key === 'system_settings') return;
            try {
              const localValue = JSON.parse(raw);
              const cloudRaw = safeLocalStorage.getItem(key);
              let cloudValue: any = null;
              if (cloudRaw) {
                try { cloudValue = JSON.parse(cloudRaw); } catch { cloudValue = null; }
              }
              let merged: any;
              if (key === 'wallets') {
                merged = { ...(cloudValue || {}), ...(localValue || {}) };
              } else if (key.startsWith('favs_')) {
                merged = Array.from(new Set([...(localValue || []), ...(cloudValue || [])]));
              } else {
                merged = mergeById(localValue || [], cloudValue || []);
              }
              safeLocalStorage.setItem(key, JSON.stringify(merged));
            } catch {
              /* unreadable local value — leave the cloud copy in place */
            }
          });
        }
        safeLocalStorage.setItem(CLOUD_MERGE_KEY, '1');
      }

      const savedUsers = safeLocalStorage.getItem('users');
      const savedCompanies = safeLocalStorage.getItem('companies');
      const savedMaterials = safeLocalStorage.getItem('materials');
      const savedOrders = safeLocalStorage.getItem('orders');
      const savedCurrentUser = safeLocalStorage.getItem('currentUser');

      const parsedUsers: User[] = savedUsers ? JSON.parse(savedUsers) : [];
      // Guarantee the platform administrator always exists, even for
      // installations that predate the admin role.
      if (!parsedUsers.some(u => u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())) {
        parsedUsers.push(ADMIN_USER);
      }

      // Saved data is the authoritative copy after first run. Seed demo
      // companies only when no company collection has ever been stored, and
      // never re-add a sample company that the user has deleted.
      let baseCompanies: Company[] = savedCompanies
        ? JSON.parse(savedCompanies) as Company[]
        : [];

      // Self-heal supplier accounts whose company profile is missing (or was
      // orphaned by an older build / a partial cloud merge).
      for (const user of parsedUsers) {
        if (user.userType !== 'company') continue;
        if (baseCompanies.some(c => c.userId === user.id)) continue;
        const companyName = (user.companyName || '').trim().toLowerCase();
        const orphan = companyName
          ? baseCompanies.find(c =>
              c.name.trim().toLowerCase() === companyName &&
              !parsedUsers.some(u => u.id === c.userId))
          : undefined;
        if (orphan) {
          baseCompanies = baseCompanies.map(c => c.id === orphan.id ? { ...c, userId: user.id } : c);
        } else {
          baseCompanies.push(companyFromUser(user));
        }
      }

      const enrichedCompanies = await geocodeAllCompanies(baseCompanies);
      if (cancelled) return;
      setCompanies(enrichedCompanies);
      setUsers(parsedUsers);
      if (!savedUsers) safeLocalStorage.setItem('users', JSON.stringify(parsedUsers));
      // v6.4 uses one VAT-exclusive price model for every product. Older sample
      // rows carried taxIncluded: true even though VAT was added at checkout;
      // normalise them without changing the stored price.
      const parsedMaterials: Material[] = (savedMaterials
        ? JSON.parse(savedMaterials)
        : []
      ).map((material: Material) => ({ ...material, taxIncluded: false }));
      setMaterials(parsedMaterials);
      if (!savedMaterials) safeLocalStorage.setItem('materials', JSON.stringify(parsedMaterials));
      const parsedOrders: Order[] = savedOrders ? JSON.parse(savedOrders) : [];
      setOrders(parsedOrders);
      if (!savedOrders) safeLocalStorage.setItem('orders', JSON.stringify(parsedOrders));
      if (savedCurrentUser) setCurrentUser(JSON.parse(savedCurrentUser));

      // These were initialised before the cloud pull ran; reload them now so a
      // fresh device sees the shared wallet balances, notifications, reviews
      // and platform settings as well.
      const savedNotifications = safeLocalStorage.getItem('notifications');
      if (savedNotifications) setNotifications(JSON.parse(savedNotifications));
      const savedWallets = safeLocalStorage.getItem('wallets');
      if (savedWallets) setWallets(JSON.parse(savedWallets));
      const savedTransactions = safeLocalStorage.getItem('wallet_transactions');
      if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
      const savedReviews = safeLocalStorage.getItem('reviews');
      if (savedReviews) setReviews(JSON.parse(savedReviews));
      setSystemSettings(loadSettings());

      safeLocalStorage.setItem('companies', JSON.stringify(enrichedCompanies));
      setIsInitialized(true);
      showAlert('Supplier locations geocoded successfully! 🗺️', 'success');
    };
    init();
    return () => { cancelled = true; };
  }, [isInitialized, geocodeAllCompanies, showAlert]);

  // Persistence — every shared collection is written locally and mirrored to
  // Supabase so adding/editing a product on one device reaches the others.
  useEffect(() => {
    if (isInitialized) {
      safeLocalStorage.setItem('users', JSON.stringify(users));
      cloudPush('users', users);
    }
  }, [users, isInitialized]);
  useEffect(() => {
    if (isInitialized) {
      safeLocalStorage.setItem('companies', JSON.stringify(companies));
      cloudPush('companies', companies);
    }
  }, [companies, isInitialized]);
  useEffect(() => {
    if (isInitialized) {
      safeLocalStorage.setItem('materials', JSON.stringify(materials));
      cloudPush('materials', materials);
    }
  }, [materials, isInitialized]);
  useEffect(() => {
    if (isInitialized) {
      safeLocalStorage.setItem('orders', JSON.stringify(orders));
      cloudPush('orders', orders);
    }
  }, [orders, isInitialized]);
  useEffect(() => {
    if (currentUser && isInitialized) safeLocalStorage.setItem('currentUser', JSON.stringify(currentUser));
    else if (!currentUser) safeLocalStorage.removeItem('currentUser');
  }, [currentUser, isInitialized]);

  // Cart persistence
  useEffect(() => {
    if (currentUser && isInitialized) {
      const savedCart = safeLocalStorage.getItem(`cart_${currentUser.id}`);
      if (savedCart) setCart(JSON.parse(savedCart));
    }
  }, [currentUser, isInitialized]);
  useEffect(() => {
    if (currentUser && isInitialized) {
      safeLocalStorage.setItem(`cart_${currentUser.id}`, JSON.stringify(cart));
      cloudPush(`cart_${currentUser.id}`, cart);
    }
  }, [cart, currentUser, isInitialized]);

  // Favorites persistence
  useEffect(() => {
    if (currentUser && isInitialized) {
      const savedFavs = safeLocalStorage.getItem(`favs_${currentUser.id}`);
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
    }
  }, [currentUser, isInitialized]);
  useEffect(() => {
    if (currentUser && isInitialized) {
      safeLocalStorage.setItem(`favs_${currentUser.id}`, JSON.stringify(favorites));
      cloudPush(`favs_${currentUser.id}`, favorites);
    }
  }, [favorites, currentUser, isInitialized]);

  // ---------- Notifications / wallet / reviews persistence ----------
  useEffect(() => {
    if (isInitialized) {
      safeLocalStorage.setItem('notifications', JSON.stringify(notifications));
      cloudPush('notifications', notifications);
    }
  }, [notifications, isInitialized]);
  useEffect(() => {
    if (isInitialized) {
      safeLocalStorage.setItem('wallets', JSON.stringify(wallets));
      cloudPush('wallets', wallets);
    }
  }, [wallets, isInitialized]);
  useEffect(() => {
    if (isInitialized) {
      safeLocalStorage.setItem('wallet_transactions', JSON.stringify(transactions));
      cloudPush('wallet_transactions', transactions);
    }
  }, [transactions, isInitialized]);
  useEffect(() => {
    if (isInitialized) {
      safeLocalStorage.setItem('reviews', JSON.stringify(reviews));
      cloudPush('reviews', reviews);
    }
  }, [reviews, isInitialized]);

  // Grant every registered account its welcome wallet balance exactly once.
  useEffect(() => {
    if (!isInitialized || users.length === 0) return;
    setWallets(prev => {
      const missing = users.filter(u => !(u.id in prev));
      if (missing.length === 0) return prev;
      const next = { ...prev };
      missing.forEach(u => { next[u.id] = WELCOME_BONUS; });
      return next;
    });
    setTransactions(prev => {
      const missing = users.filter(u => !prev.some(t => t.userId === u.id && t.note === 'Welcome bonus'));
      if (missing.length === 0) return prev;
      return [
        ...prev,
        ...missing.map(u => ({
          id: genId('tx'), userId: u.id, kind: 'topup' as const, amount: WELCOME_BONUS,
          balanceAfter: WELCOME_BONUS, note: 'Welcome bonus', date: Date.now(),
        })),
      ];
    });
  }, [isInitialized, users]);

  // ---------- Live cloud updates ----------
  // Realtime gives near-instant cross-device updates; the polling fallback
  // (every 10 s while visible) covers projects where the Realtime publication
  // has not been enabled yet, so a product added on one device still appears on
  // every other device without a manual reload.
  useEffect(() => {
    if (!isInitialized) return;
    const unsubscribe = subscribeToCloud(applyCloudRow);
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const rows = await fetchCloudChanges();
      if (stopped) return;
      rows.forEach(row => applyCloudRow(row.key, row.data));
    };

    const timer = window.setInterval(() => { void poll(); }, 10000);
    const onVisibility = () => { if (document.visibilityState === 'visible') void poll(); };
    document.addEventListener('visibilitychange', onVisibility);
    void poll();

    return () => {
      stopped = true;
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isInitialized, applyCloudRow]);

  // ---------- Distance for selected material ----------
  const [distanceToSelected, setDistanceToSelected] = useState<number | null>(null);
  const [isDistanceLoading, setIsDistanceLoading] = useState(false);

  useEffect(() => {
    if (selectedMaterial) {
      const company = getCompanyById(selectedMaterial.companyId);
      if (company) {
        setIsDistanceLoading(true);
        calculateDistance(company.lat, company.lng, currentUser?.lat || 9.0320, currentUser?.lng || 38.7469)
          .then(dist => setDistanceToSelected(dist))
          .catch(() => setDistanceToSelected(null))
          .finally(() => setIsDistanceLoading(false));
      } else {
        setDistanceToSelected(null);
        setIsDistanceLoading(false);
      }
    }
  }, [selectedMaterial, currentUser, getCompanyById]);

  // ---------- Open map with route ----------
  // Opens the map straight onto the route from the customer's current location to
  // the chosen supplier. The destination is remembered, so reopening the map
  // shows the same route, and every new click replaces the previous one.
  const handleOpenMapWithRoute = (companyId: string) => {
    setAutoRouteSupplierId(companyId);
    setRouteRequestId(id => id + 1);
    setShowSupplierMap(true);
  };

  // ---------- Authentication ----------
  const handleLogin = (e: React.FormEvent): void => {
    e.preventDefault();
    const { loginPassword, selectedUser } = formData;
    const user = users.find(u => u.email === selectedUser);
    if (!user) { showAlert('Please select a valid user', 'danger'); return; }
    if (isUserLocked(user)) {
      const remainingTime = Math.ceil((user.lockUntil! - Date.now()) / 1000);
      showAlert('Account locked. Try again in ' + remainingTime + ' seconds', 'danger');
      return;
    }
    if (user.password === loginPassword) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, loginAttempts: 0, lockUntil: 0 } : u));
      setCurrentUser(user);
      showAlert('Login successful! 🎉', 'success');
      setCurrentPage('home');
      setFormData(prev => ({ ...prev, loginPassword: '', selectedUser: '' }));
    } else {
      const newAttempts = (user.loginAttempts || 0) + 1;
      let lockUntil = 0;
      if (newAttempts >= 3) { lockUntil = Date.now() + 30000; showAlert('Too many failed attempts. Account locked for 30 seconds.', 'danger'); }
      else { showAlert('Incorrect password. ' + (3 - newAttempts) + ' attempts remaining.', 'danger'); }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, loginAttempts: newAttempts, lockUntil } : u));
    }
  };

  const handleRegister = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const { registerFullName, registerEmail, registerPassword, registerPhone, registerAddress, registerCity, registerCompanyName, registerUserType, tinNumber, businessLicense, vatNumber, vatRegistered } = formData;
    if (users.find(u => u.email === registerEmail)) { showAlert('User with this email already exists', 'danger'); return; }
    // Geocode the address the user typed so distances are measured from their
    // real location instead of a random point near Addis Ababa. They can refine
    // it later from Dashboard -> My Location (or on the map picker).
    const coords = await geocodeAddress(registerAddress, registerCity);
    const newUser: User = {
      id: genId('user'), name: registerFullName, email: registerEmail, password: registerPassword || '0909',
      phone: registerPhone, address: registerAddress, city: registerCity, userType: registerUserType as 'customer' | 'company',
      companyName: registerUserType === 'company' ? registerCompanyName : '',
      lat: coords?.lat ?? 9.0320, lng: coords?.lng ?? 38.7469,
      registered: new Date().toISOString().split('T')[0], loginAttempts: 0, lockUntil: 0,
      tinNumber: registerUserType === 'company' ? tinNumber : '',
      businessLicense: registerUserType === 'company' ? businessLicense : '',
      vatRegistered: registerUserType === 'company' ? vatRegistered : false,
      vatNumber: registerUserType === 'company' ? vatNumber : ''
    };
    setUsers(prev => [...prev, newUser]);
    if (registerUserType === 'company') {
      const newCompany: Company = {
        id: genId('comp'), userId: newUser.id, name: registerCompanyName, description: '',
        location: registerAddress, city: registerCity, lat: newUser.lat || 9.0320, lng: newUser.lng || 38.7469,
        rating: 0, totalOrders: 0, established: new Date().getFullYear().toString(), tinNumber, businessLicense,
        vatNumber: vatRegistered ? vatNumber : '',
        tradeLicenseExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        complianceStatus: 'compliant'
      };
      setCompanies(prev => [...prev, newCompany]);
    }
    showAlert('Registration successful! Please login. ✅', 'success');
    setCurrentPage('login');
    setFormData(prev => ({ ...prev, registerFullName: '', registerEmail: '', registerPassword: '', registerPhone: '', registerAddress: '', registerCity: 'Addis Ababa', registerCompanyName: '', tinNumber: '', businessLicense: '', vatNumber: '', vatRegistered: false }));
  };

  const handleLogout = (): void => {
    setCurrentUser(null);
    setCart([]);
    setShowCartSummary(false);
    setCartDetails(null);
    setDeliveryFeeOverride(null);
    safeLocalStorage.removeItem('currentUser');
    showAlert('Logged out successfully 👋', 'info');
    setCurrentPage('home');
  };

  // ---------- Company edit ----------
  const handleEditCompany = () => {
    if (!currentUser || currentUser.userType !== 'company') {
      showAlert('Only company users can edit their profile', 'danger');
      return;
    }
    const existing = getCompanyByUserId(currentUser.id);
    // Never block a supplier from their own profile: rebuild it from the
    // account and open the editor immediately.
    const company = existing || companyFromUser(currentUser);
    if (!existing) setCompanies(prev => [...prev, company]);
    setFormData(prev => ({
      ...prev,
      companyName: company.name,
      companyDescription: company.description,
      companyLocation: company.location,
      companyCity: company.city,
      companyPhone: currentUser.phone,
      companyEmail: currentUser.email,
      companyWebsite: company.website || '',
      companyWorkingHours: company.workingHours || '',
      companyTinNumber: company.tinNumber,
      companyBusinessLicense: company.businessLicense,
      companyVatNumber: company.vatNumber,
      companyTradeLicenseExpiry: company.tradeLicenseExpiry,
    }));
    setShowEditCompany(true);
  };

  const handleSaveCompany = (updatedCompany: Company, updatedUser: User) => {
    const nextCompanies = companies.some(c => c.id === updatedCompany.id)
      ? companies.map(c => c.id === updatedCompany.id ? updatedCompany : c)
      : [...companies, updatedCompany];
    const nextUsers = users.some(u => u.id === updatedUser.id)
      ? users.map(u => u.id === updatedUser.id ? updatedUser : u)
      : [...users, updatedUser];
    setCompanies(nextCompanies);
    setUsers(nextUsers);
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
    safeLocalStorage.setItem('companies', JSON.stringify(nextCompanies));
    safeLocalStorage.setItem('users', JSON.stringify(nextUsers));
    setShowEditCompany(false);
    showAlert('Company profile updated successfully! ✅', 'success');
  };

  // ---------- Admin: edit/delete any account, supplier or product ----------
  const handleAdminEditCompany = (company: Company) => {
    const owner = users.find(u => u.id === company.userId);
    if (!owner) {
      showAlert('This supplier profile has no matching account to edit.', 'danger');
      return;
    }
    setAdminCompanyTarget({ company, user: owner });
  };

  const handleAdminSaveCompany = (updatedCompany: Company, updatedUser: User) => {
    handleSaveCompany(updatedCompany, updatedUser);
    setAdminCompanyTarget(null);
  };

  const handleAdminDeleteUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (user.userType === 'admin' || user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      showAlert('The platform administrator account cannot be deleted.', 'danger');
      return;
    }
    const ownedCompanies = companies.filter(c => c.userId === userId);
    const ownedIds = new Set(ownedCompanies.map(c => c.id));
    const productCount = materials.filter(m => ownedIds.has(m.companyId)).length;
    const label = ownedCompanies.length > 0
      ? `${user.name}, their supplier profile and ${productCount} product${productCount === 1 ? '' : 's'}`
      : user.name;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    setUsers(prev => prev.filter(u => u.id !== userId));
    setCompanies(prev => prev.filter(c => c.userId !== userId));
    setMaterials(prev => prev.filter(m => !ownedIds.has(m.companyId)));
    setCart(prev => prev.filter(item => !ownedIds.has(item.supplierId)));
    setNotifications(prev => prev.filter(n => n.userId !== userId));
    setTransactions(prev => prev.filter(tx => tx.userId !== userId));
    setWallets(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    if (currentUser?.id === userId) setCurrentUser(null);
    showAlert('Account deleted permanently.', 'success');
  };

  // Administrators can correct any account's saved location. The owner can do the
  // same from their own dashboard ("My Location"), so GPS distances always start
  // from the user's real position once it has been set.
  const handleAdminUpdateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    setCompanies(prev => prev.map(c => c.userId === updatedUser.id
      ? { ...c, lat: updatedUser.lat, lng: updatedUser.lng, city: updatedUser.city, location: updatedUser.address }
      : c));
    if (currentUser?.id === updatedUser.id) setCurrentUser(updatedUser);
    showAlert('Account location updated ✅', 'success');
  };

  const handleSaveMyLocation = (lat: number, lng: number, address: string) => {
    if (!currentUser) return;
    const matchedCity = ETHIOPIAN_CITIES.find(city =>
      address.toLowerCase().includes(city.toLowerCase())
    );
    const updated: User = {
      ...currentUser,
      lat,
      lng,
      address: address || currentUser.address,
      city: matchedCity || currentUser.city,
    };
    setCurrentUser(updated);
    handleAdminUpdateUser(updated);
    setShowMyLocationPicker(false);
  };

  const handleAdminDeleteCompany = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    const owner = users.find(u => u.id === company.userId);
    if (owner && (owner.userType === 'admin' || owner.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())) {
      showAlert('The platform administrator account cannot be deleted.', 'danger');
      return;
    }
    const productCount = materials.filter(m => m.companyId === companyId).length;
    if (!window.confirm(`Delete ${company.name}, ${productCount} product${productCount === 1 ? '' : 's'} and the supplier account? This cannot be undone.`)) return;

    setCompanies(prev => prev.filter(c => c.id !== companyId));
    setMaterials(prev => prev.filter(m => m.companyId !== companyId));
    setCart(prev => prev.filter(item => item.supplierId !== companyId));
    if (owner) {
      setUsers(prev => prev.filter(u => u.id !== owner.id));
      setNotifications(prev => prev.filter(n => n.userId !== owner.id));
      setTransactions(prev => prev.filter(tx => tx.userId !== owner.id));
      setWallets(prev => {
        const next = { ...prev };
        delete next[owner.id];
        return next;
      });
    }
    showAlert('Supplier and its products deleted.', 'success');
  };

  // ---------- System settings (admin) ----------
  const handleSaveAdminSettings = (nextSettings: SystemSettings): void => {
    setSystemSettings(nextSettings);
    saveSettings(nextSettings);
    showAlert('Platform settings saved and applied ✅', 'success');
  };

  // Money carried by a line when the buyer leaves the "with delivery" tick on but
  // the supplier publishes no rate: the platform's own delivery rules apply, and
  // the buyer is told so rather than seeing a fee with no explanation.
  const platformDeliveryHint = (supplierGroups: CartSupplier[]): string | null => {
    const platformGroups = supplierGroups.filter(s => s.deliveryMode === 'platform');
    if (platformGroups.length === 0) return null;
    return platformGroups.length === 1
      ? '⚠️ ' + platformGroups[0].supplierName + ' does not publish a delivery rate for this item, so the platform delivery fee applies.'
      : '⚠️ ' + platformGroups.length + ' suppliers do not publish a delivery rate for these items, so the platform delivery fee applies to them.';
  };

  // ---------- Material CRUD ----------
  const handleAddMaterial = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!currentUser || currentUser.userType !== 'company') { showAlert('Only company users can add materials', 'danger'); return; }
    const existingCompany = getCompanyByUserId(currentUser.id);
    const company = existingCompany || companyFromUser(currentUser);
    if (!existingCompany) setCompanies(prev => [...prev, company]);
    // Delivery terms are read straight off formData by buildMaterialDelivery().
    const { materialName, materialCategory, materialPrice, materialQuantity, materialUnit, materialMinOrder, materialDescription, materialBrand, materialModel, materialWeight, materialDimensions, materialGrade, materialOrigin, materialCertifications, materialImages } = formData;
    const basePrice = Math.max(0, parseFloat(materialPrice) || 0);
    const profitMargin = Math.max(0, parseFloat(formData.materialProfitMargin) || 0) / 100;
    const transportCost = Math.max(0, parseFloat(formData.materialTransportCost) || 0);
    const weightPerUnit = Math.max(0.001, parseFloat(formData.materialWeightPerUnit) || 0.001);
    const sellingPrice = basePrice * (1 + profitMargin);
    const specs = {
      weight: materialWeight || undefined, dimensions: materialDimensions || undefined, grade: materialGrade || undefined,
      origin: materialOrigin || undefined, certification: materialCertifications.split(',').map(c => c.trim()).filter(c => c),
      weightPerUnit
    };
    const newMaterial: Material = {
      id: genId('mat'), companyId: company.id, name: materialName, category: materialCategory,
      basePrice, profitMargin, price: sellingPrice, quantity: parseInt(materialQuantity), unit: materialUnit,      minOrder: parseInt(materialMinOrder) || 1, description: materialDescription, transportCost, rating: 0,
      brand: materialBrand || undefined, model: materialModel || undefined, specifications: specs, images: materialImages,
      delivery: buildMaterialDelivery(formData),
      taxIncluded: false, vatPercentage: systemSettings.vat.rate, lastUpdated: new Date().toISOString().split('T')[0],
      priceHistory: [{ date: Date.now(), price: sellingPrice }]
    };
    setMaterials(prev => [...prev, newMaterial]);
    if (parseInt(materialQuantity) <= LOW_STOCK_THRESHOLD) {
      pushNotification(currentUser.id, 'stock', 'Low-stock alert',
        `${materialName} has only ${materialQuantity} ${materialUnit || 'units'} left — restock soon.`);
    }
    showAlert('Product added successfully! 🎉', 'success');
    setCurrentPage('company-dashboard');
    setFormData(prev => ({ ...prev, materialName: '', materialCategory: '', materialPrice: '', materialQuantity: '', materialUnit: '', materialMinOrder: '', materialDescription: '', materialBrand: '',       materialModel: '', materialWeight: '', materialDimensions: '', materialGrade: '', materialOrigin: 'Ethiopia', materialCertifications: '', materialImages: [], materialProfitMargin: '15', materialTransportCost: '15', materialVatPercentage: '15', materialTaxIncluded: false, materialWeightPerUnit: '0.001', materialDeliveryOffered: false, materialDeliveryPerKm: '', materialDeliveryStartFee: '' }));
  };

  const handleEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setFormData(prev => ({
      ...prev,
      materialName: material.name,
      materialCategory: material.category,
      materialPrice: material.basePrice.toString(),
      materialQuantity: material.quantity.toString(),
      materialUnit: material.unit,
      materialMinOrder: material.minOrder.toString(),
      materialDescription: material.description,
      materialBrand: material.brand || '',
      materialModel: material.model || '',
      materialWeight: material.specifications?.weight || '',
      materialDimensions: material.specifications?.dimensions || '',
      materialGrade: material.specifications?.grade || '',
      materialOrigin: material.specifications?.origin || 'Ethiopia',
      materialCertifications: material.specifications?.certification?.join(', ') || '',
      materialImages: material.images || [],
      materialProfitMargin: (material.profitMargin * 100).toString(),
      materialTransportCost: String(material.transportCost),
      materialVatPercentage: String(material.vatPercentage),
      materialTaxIncluded: false,
      materialWeightPerUnit: String(material.specifications?.weightPerUnit || 0.001),
      materialDeliveryOffered: Boolean(material.delivery?.offered),
      materialDeliveryPerKm: material.delivery?.perKm ? String(material.delivery.perKm) : '',
      materialDeliveryStartFee: material.delivery?.startFee ? String(material.delivery.startFee) : '',
    }));
    setCurrentPage('edit-material');
  };

  const handleAdminEditMaterial = (material: Material) => {
    setAdminEditingMaterial(true);
    handleEditMaterial(material);
  };

  const handleCancelMaterialEdit = () => {
    setAdminEditingMaterial(false);
    navigateTo(currentUser?.userType === 'admin' ? 'admin-settings' : 'company-dashboard');
  };

  const handleUpdateMaterial = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!editingMaterial) return;
    const basePrice = Math.max(0, parseFloat(formData.materialPrice) || 0);
    const profitMargin = Math.max(0, parseFloat(formData.materialProfitMargin) || 0) / 100;
    const transportCost = Math.max(0, parseFloat(formData.materialTransportCost) || 0);
    const weightPerUnit = Math.max(0.001, parseFloat(formData.materialWeightPerUnit) || 0.001);
    const newPrice = basePrice * (1 + profitMargin);
    const updatedMaterial: Material = {
      ...editingMaterial,
      priceHistory: newPrice !== editingMaterial.price
        ? [...(editingMaterial.priceHistory || []), { date: Date.now(), price: newPrice }].slice(-24)
        : editingMaterial.priceHistory,
      name: formData.materialName,
      category: formData.materialCategory,
      basePrice,
      profitMargin,
      price: newPrice,
      quantity: parseInt(formData.materialQuantity),
      unit: formData.materialUnit,      minOrder: parseInt(formData.materialMinOrder) || 1,
      description: formData.materialDescription,
      transportCost,
      brand: formData.materialBrand || undefined,
      model: formData.materialModel || undefined,
      specifications: {
        ...editingMaterial.specifications,
        weight: formData.materialWeight || undefined,
        dimensions: formData.materialDimensions || undefined,
        grade: formData.materialGrade || undefined,
        origin: formData.materialOrigin || undefined,
        certification: formData.materialCertifications.split(',').map(c => c.trim()).filter(c => c),
        weightPerUnit
      },
      images: formData.materialImages,
      delivery: buildMaterialDelivery(formData),
      taxIncluded: false,
      vatPercentage: systemSettings.vat.rate,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    setMaterials(prev => prev.map(m => m.id === editingMaterial.id ? updatedMaterial : m));
    // Cart lines snapshot the supplier's rate, so a changed rate must reach the
    // carts that still hold this product or they would be billed on stale terms.
    const rate = updatedMaterial.delivery;
    setCart(prev => prev.map(item => item.materialId === updatedMaterial.id
      ? { ...item, deliveryRate: rate && rate.offered ? rate : undefined }
      : item));
    if (updatedMaterial.quantity <= LOW_STOCK_THRESHOLD) {
      pushNotification(currentUser?.id || '', 'stock', 'Low-stock alert',
        `${updatedMaterial.name} has only ${updatedMaterial.quantity} ${updatedMaterial.unit || 'units'} left — restock soon.`);
    }
    showAlert('Product updated successfully! ✏️', 'success');
    setEditingMaterial(null);
    setCurrentPage(adminEditingMaterial ? 'admin-settings' : currentUser?.userType === 'company' ? 'company-dashboard' : 'search-materials');
    setAdminEditingMaterial(false);
    setFormData(prev => ({ ...prev, materialName: '', materialCategory: '', materialPrice: '', materialQuantity: '', materialUnit: '', materialMinOrder: '', materialDescription: '', materialBrand: '',       materialModel: '', materialWeight: '', materialDimensions: '', materialGrade: '', materialOrigin: 'Ethiopia', materialCertifications: '', materialImages: [], materialProfitMargin: '15', materialTransportCost: '15', materialVatPercentage: '15', materialTaxIncluded: false, materialWeightPerUnit: '0.001', materialDeliveryOffered: false, materialDeliveryPerKm: '', materialDeliveryStartFee: '' }));
  };

  const handleDeleteMaterial = (id: string): void => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setMaterials(prev => prev.filter(m => m.id !== id));
      showAlert('Product deleted successfully 🗑️', 'success');
    }
  };

  // ---------- Live Search ----------
  const performSearch = useCallback(async () => {
    const { searchQuery, searchCategory, searchMaxPrice, searchSupplier, searchCity, searchSortBy } = formData;
    let filtered = materials.filter(material => {
      let matches = true;
      if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        matches = matches && (material.name.toLowerCase().includes(lower) ||
          material.description.toLowerCase().includes(lower) ||
          material.brand?.toLowerCase().includes(lower) ||
          material.category.toLowerCase().includes(lower));
      }
      if (searchCategory && searchCategory !== 'all') {
        matches = matches && material.category === searchCategory;
      }
      if (searchMaxPrice) {
        matches = matches && material.price <= parseFloat(searchMaxPrice);
      }
      if (searchSupplier && searchSupplier !== 'all') {
        matches = matches && material.companyId === searchSupplier;
      }
      if (searchCity && searchCity !== 'all') {
        const company = getCompanyById(material.companyId);
        matches = matches && company?.city === searchCity;
      }
      return matches;
    });
    const resultsWithCost = await Promise.all(filtered.map(async material => {
      const company = getCompanyById(material.companyId);
      let estimatedTransport: number | undefined;
      let distance: number | undefined;
      if (company) {
        const weight = (material.specifications?.weightPerUnit || 0.001) * material.minOrder;
        distance = await calculateDistance(company.lat, company.lng, currentUser?.lat || 9.0320, currentUser?.lng || 38.7469);
        // Delivery estimate is driven by SystemSettings (fixed/distance/zones).
        estimatedTransport = await computeDeliveryFee({
          supplierLat: company.lat, supplierLng: company.lng,
          customerLat: currentUser?.lat || 9.0320, customerLng: currentUser?.lng || 38.7469,
          customerCity: currentUser?.city || null,
          weightTons: weight,
          orderSubtotal: material.price * material.minOrder,
          settings: systemSettings,
        });
      }
      const totalCost = material.price + ((estimatedTransport || 0) / material.minOrder);
      return { ...material, company, totalCost, estimatedTransport, distance };
    }));
    resultsWithCost.sort((a, b) => {
      switch (searchSortBy) {
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'rating_desc': return (b.rating || 0) - (a.rating || 0);
        case 'newest': return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default: return (a.totalCost || 0) - (b.totalCost || 0);
      }
    });
    setSearchResults(resultsWithCost);
    setIsSearchPerformed(true);
  }, [formData, materials, currentUser, getCompanyById, systemSettings]);

  useEffect(() => {
    if (currentPage !== 'search-materials') return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { performSearch(); }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [formData.searchQuery, formData.searchCategory, formData.searchMaxPrice, formData.searchSupplier, formData.searchCity, formData.searchSortBy, performSearch, currentPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  // Reset search state when clearing filters
  const clearFilters = () => {
    setSearchResults([]);
    setIsSearchPerformed(false);
    setFormData(prev => ({ ...prev, searchQuery: '', searchMaxPrice: '', searchCategory: 'all', searchSupplier: 'all', searchCity: 'all' }));
  };

  // Favorites
  const toggleFavorite = (materialId: string) => {
    if (!currentUser) { showAlert('Please login to save favorites', 'info'); return; }
    setFavorites(prev => prev.includes(materialId) ? prev.filter(id => id !== materialId) : [...prev, materialId]);
  };

  // Compare
  const toggleCompare = (materialId: string) => {
    setCompareItems(prev => {
      if (prev.includes(materialId)) return prev.filter(id => id !== materialId);
      if (prev.length >= 4) { showAlert('Maximum 4 items to compare', 'warning'); return prev; }
      return [...prev, materialId];
    });
  };

  const clearCompare = () => {
    setCompareItems([]);
    setShowCompare(false);
  };

  // Quick Reorder from past orders
  const handleQuickReorder = (materialId: string) => {
    const material = getMaterialById(materialId);
    if (!material) return;
    if (!currentUser) { showAlert('Please login', 'danger'); setCurrentPage('login'); return; }
    navigateTo('search-materials');
    setFormData(prev => ({ ...prev, searchQuery: material.name }));
    showAlert('Showing ' + material.name + ' — add to cart to reorder', 'info');
  };

  // ---------- Cart ----------
  // One cart belongs to exactly one supplier. A proforma is a legal document
  // issued by a single seller, and every fee, distance, delivery rate and
  // signature on it assumes that - so a buyer cannot mix sellers in one cart.
  // The check lives here (and again inside `addToCartLogic`, against the
  // functional `prev` state) so no other add path can slip past it. The rule
  // itself is the pure, unit-tested `findOtherCartSupplier` in utils.ts.
  const otherSupplierInCart = (supplierId: string, materialId?: string) =>
    findOtherCartSupplier(cart, supplierId, materialId);

  const addToCart = (material: Material, quantity: number, includeDelivery: boolean): boolean => {
    if (!currentUser) { showAlert('Please login to add items to cart', 'danger'); setCurrentPage('login'); return false; }
    if (currentUser.userType !== 'customer') { showAlert('Only customers can add items to cart', 'danger'); return false; }
    // Customers may order any amount: a per-product `minOrder` is supplier
    // reference data only and is never enforced here.
    if (!Number.isFinite(quantity) || quantity < 1) { showAlert('Please enter a quantity of at least 1', 'danger'); return false; }
    const materialCompany = getCompanyById(material.companyId);
    if (!materialCompany) return false;
    return addToCartLogic(material, quantity, materialCompany, includeDelivery);
  };

  const addToCartLogic = (material: Material, quantity: number, company: Company, includeDelivery: boolean): boolean => {
    // Re-adding the same product is always fine, whatever else is in the cart,
    // so `materialId` is passed and findOtherCartSupplier lets that case through.
    const foreign = otherSupplierInCart(material.companyId, material.id);
    if (foreign) {
      showAlert(
        'Your cart can only contain items from one supplier. It currently holds ' +
        foreign.supplierName + ' — remove those items or clear the cart before adding ' +
        material.name + ' from ' + company.name + '.',
        'warning'
      );
      return false;
    }
    // Snapshot the supplier's published rate onto the line: the fee is worked out
    // from the distance later, so the cart has to remember which rate applies.
    const rate = material.delivery && material.delivery.offered ? material.delivery : undefined;
    setCart(prev => {
      // Same rule as above, re-applied on `prev` — the real cart at the moment of
      // the write. The pre-flight check above runs against the `cart` closure,
      // which a cart persisted by an older build could already contradict; this
      // one cannot. A cart that gets past it is left exactly as it was rather
      // than gaining a second supplier.
      const clash = findOtherCartSupplier(prev, material.companyId, material.id);
      if (clash) return prev;
      // Re-adding a product already in the cart is a quantity change, not a new
      // supplier, so it bumps the quantity instead of adding a line.
      if (prev.some(item => item.materialId === material.id)) {
        return prev.map(item => item.materialId === material.id ? { ...item, quantity: item.quantity + quantity, includeDelivery, deliveryRate: rate } : item);
      }
      const newCartItem: CartItem = {
        id: Date.now().toString(),
        materialId: material.id,
        materialName: material.name,
        supplierId: material.companyId,
        supplierName: company.name,
        quantity: quantity,
        price: material.price,
        unit: material.unit,
        minOrder: material.minOrder,
        vatPercentage: material.vatPercentage,
        specifications: material.specifications,
        basePrice: material.basePrice,
        profitMargin: material.profitMargin,
        weightPerUnit: material.specifications?.weightPerUnit || 0.001,
        includeDelivery,
        deliveryRate: rate
      };
      return [...prev, newCartItem];
    });
    showAlert(cart.some(i => i.materialId === material.id) ? 'Updated ' + material.name + ' quantity in cart' : 'Added ' + material.name + ' to cart', 'success');
    return true;
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
    showAlert('Item removed from cart', 'info');
  };

  const updateCartQuantity = (itemId: string, newQuantity: number) => {
    const item = cart.find(i => i.id === itemId);
    if (!item) return;
    if (!Number.isFinite(newQuantity) || newQuantity < 1) {
      showAlert('Quantity must be at least 1 ' + (item.unit || 'unit'), 'warning');
      return;
    }
    if (item.quantity === Math.round(newQuantity)) return;
    setCart(prev => prev.map(i => i.id === itemId ? { ...i, quantity: Math.round(newQuantity) } : i));
  };

  // The "with / without delivery cost" checkbox on a cart line. Ticking it on a
  // product the supplier delivers themselves stores that supplier's rate, so the
  // per-km fee can be calculated from the real distance in the cart totals.
  const updateCartDelivery = (itemId: string, includeDelivery: boolean) => {
    setCart(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const material = getMaterialById(item.materialId);
      const rate = material && material.delivery && material.delivery.offered ? material.delivery : item.deliveryRate;
      return { ...item, includeDelivery, deliveryRate: rate };
    }));
  };



  const clearCart = () => {
    setCart([]);
    setShowCartSummary(false);
    setCartDetails(null);
    setDeliveryFeeOverride(null);
    showAlert('Cart cleared', 'info');
  };

  // Price a set of cart lines. Delivery is resolved per line: the buyer's checkbox
  // decides whether anything is charged, the supplier's published per-km rate is
  // applied to the real supplier→buyer distance, and the platform settings are
  // only used for lines whose supplier has no rate of their own.
  const priceCartItems = async (items: CartItem[], applyVat = false): Promise<CartReport | null> => {
    if (items.length === 0) return null;
    if (!currentUser) return null;
    setIsCalculating(true);
    let subtotal = 0, transportCost = 0;
    const supplierMap = new Map<string, CartSupplier>();
    const settings = systemSettings;
    // First pass: value the whole cart. VAT is deliberately not calculated per
    // line; it is applied once below to this aggregate net subtotal — and only
    // when the cart is turned into a proforma / placed order (`applyVat`).
    for (const item of items) {
      subtotal += item.basePrice * (1 + item.profitMargin) * item.quantity;
    }
    subtotal = Math.round(subtotal * 100) / 100;
    const vat = vatOnSubtotal(subtotal, settings.vat.rate, settings.vat.enabled);
    const vatAmount = applyVat ? vat.vatAmount : 0;
    try {
      for (const item of items) {
        // Never skip a line: a missing profile is rebuilt on the spot so the
        // goods value, its VAT and its delivery are always counted.
        const supplierCompany = ensureSupplierCompany(item.supplierId, item.supplierName);
        const dist = await calculateDistance(
          supplierCompany.lat, supplierCompany.lng,
          currentUser.lat || 9.0320, currentUser.lng || 38.7469
        );
        const { fee, mode } = await resolveLineDelivery(
          item, supplierCompany, dist, subtotal, currentUser, settings
        );
        transportCost += fee;
        const existing = supplierMap.get(item.supplierId);
        if (existing) {
          existing.items.push(item);
          existing.transportCost = Math.round((existing.transportCost + fee) * 100) / 100;
          existing.deliveryMode = combineDeliveryModes(existing.deliveryMode, mode);
          if (mode === 'supplier' && !existing.deliveryBasis) {
            existing.deliveryBasis = deliveryBasisLabel(item.deliveryRate, true);
          }
        } else {
          supplierMap.set(item.supplierId, {
            supplierId: supplierCompany.id,
            supplierName: supplierCompany.name,
            supplierCity: supplierCompany.city,
            distanceKm: dist,
            transportCost: fee,
            deliveryMode: mode,
            deliveryBasis: mode === 'supplier' ? deliveryBasisLabel(item.deliveryRate, true) : undefined,
            items: [item]
          });
        }
      }
    } finally {
      setIsCalculating(false);
    }
    const suppliers = Array.from(supplierMap.values());
    // Honour an optional manually-edited delivery fee. When set, the automatic
    // transport sum is replaced and the per-supplier breakdown is re-scaled so
    // the proforma sub-lines still add up to the grand total.
    if (deliveryFeeOverride !== null && deliveryFeeOverride >= 0) {
      const computed = suppliers.reduce((sum, sup) => sum + sup.transportCost, 0);
      const scale = computed > 0 ? deliveryFeeOverride / computed : 1;
      suppliers.forEach(sup => {
        sup.transportCost = Math.round(sup.transportCost * scale * 100) / 100;
      });
      transportCost = deliveryFeeOverride;
    }
    // `subtotal` is the net goods value; VAT is added once on top, then delivery.
    const total = cartGrandTotal(subtotal, vatAmount, transportCost);
    const multiple = suppliers.length > 1;
    const totalDistance = suppliers.reduce((sum, sup) => sum + sup.distanceKm, 0);
    const minOrderCheck = checkMinOrder(settings, subtotal);
    const threshold = settings.delivery.freeDeliveryThreshold;
    return {
      items,
      subtotal,
      vatAmount,
      vatRate: vat.rate,
      transportCost,
      total,
      distanceKm: totalDistance,
      suppliers,
      supplierName: multiple ? 'Multiple Suppliers (' + suppliers.length + ')' : (suppliers[0]?.supplierName || ''),
      supplierCity: multiple ? '' : (suppliers[0]?.supplierCity || ''),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      uniqueItems: items.length,
      currency: 'ETB',
      reportDate: new Date().toLocaleString(),
      freeDeliveryApplied: transportCost === 0 && threshold > 0 && subtotal >= threshold,
      minOrderEnabled: minOrderCheck.enabled,
      minOrderAmount: minOrderCheck.amount,
      belowMinOrder: minOrderCheck.below,
    };
  };

  const calculateCartTotals = (applyVat = false): Promise<CartReport | null> => priceCartItems(cart, applyVat);

  // Two repricings of the cart are only worth doing when the lines themselves
  // differ, so the effect below keys off a signature of quantity + delivery flag.
  const cartSignature = (items: CartItem[]) =>
    JSON.stringify(items.map(i => [i.id, i.quantity, i.includeDelivery !== false]));

  const priceCartItemsRef = useRef(priceCartItems);
  priceCartItemsRef.current = priceCartItems;
  const repricedCart = useRef('');

  // Re-price the open cart whenever a quantity, a "with delivery" checkbox or the
  // manual delivery override changes, so the totals on screen always match the
  // cart. The pricing helper lives in a ref because it is rebuilt on every render
  // and must not itself be an effect dependency.
  useEffect(() => {
    if (!showCartSummary || cart.length === 0) return;
    const signature = cartSignature(cart) + '|' + deliveryFeeOverride;
    if (signature === repricedCart.current) return;
    repricedCart.current = signature;
    let cancelled = false;
    const timer = setTimeout(() => {
      priceCartItemsRef.current(cart, false).then(totals => {
        if (cancelled || !totals) return;
        setCartDetails(totals);
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [cart, showCartSummary, deliveryFeeOverride]);

  const handleCheckout = async () => {
    if (cart.length === 0) { showAlert('Your cart is empty', 'warning'); return; }
    const totals = await calculateCartTotals();
    if (!totals) return;
    setCartDetails(totals);
    setShowCartSummary(true);
    // Mark these exact lines as priced so the re-pricing effect above does not
    // immediately recalculate what we just calculated.
    repricedCart.current = cartSignature(cart) + '|' + deliveryFeeOverride;
  };

  // "To Proforma" — open the proforma straight in its printable form. The buyer
  // lands on the document with the print dialog already queued, which is what
  // they want when they are ordering: a proforma to print, sign or save as PDF.
  // The verification QR stays in the document header (§10.21).
  const handlePrintProforma = async () => {
    if (cart.length === 0) { showAlert('Your cart is empty', 'warning'); return; }
    const totals = await calculateCartTotals(true);
    if (!totals) return;
    setProformaDetails(totals);
    setShowProforma(true);
    setProformaAutoPrint(true);
  };

  // "To Preview" — the same proforma, but read on screen. Identical figures to
  // the printed document; the only difference is that nothing auto-prints.
  const handlePreviewProforma = async () => {
    if (cart.length === 0) { showAlert('Your cart is empty', 'warning'); return; }
    const totals = await calculateCartTotals(true);
    if (!totals) return;
    setProformaDetails(totals);
    setProformaAutoPrint(false);
    setShowProforma(true);
  }; 

  // "Back to To Purchase" — the buyer read the proforma and wants to place the
  // order, so they must land back on step 1 of the cart, not on the page behind
  // it. Close the document, re-price the cart (delivery distances are live, so
  // the figures may have moved while the proforma was open), reopen the cart
  // modal and pulse the "To Purchase" step so the way forward is obvious.
  const handleBackToPurchase = async () => {
    setShowProforma(false);
    setProformaAutoPrint(false);
    if (cart.length === 0) {
      setShowCartSummary(false);
      showAlert('Your cart is empty. Add products to purchase.', 'warning');
      navigateTo('search-materials');
      return;
    }
    const totals = await calculateCartTotals();
    if (!totals) return;
    setCartDetails(totals);
    setShowCartSummary(true);
    setHighlightPurchaseStep(true);
    repricedCart.current = cartSignature(cart) + '|' + deliveryFeeOverride;
  };

  // Allow the buyer to edit the delivery fee on the cart. Overrides the
  // automatic fee everywhere (cart summary, proforma, placed orders).
  const handleDeliveryFeeChange = (value: number) => {
    const fee = Number.isFinite(value) && value >= 0 ? value : 0;
    setDeliveryFeeOverride(fee);
    setCartDetails(prev => {
      if (!prev) return prev;
      const scale = prev.transportCost > 0 ? fee / prev.transportCost : 1;
      const suppliers = (prev.suppliers || []).map(sup => ({
        ...sup,
        transportCost: Math.round(sup.transportCost * scale * 100) / 100,
      }));
      return {
        ...prev,
        transportCost: fee,
        // VAT stays in the total: only the delivery component changes here.
        total: cartGrandTotal(prev.subtotal, prev.vatAmount, fee),
        suppliers,
        freeDeliveryApplied: fee === 0 && prev.minOrderEnabled,
      };
    });
  };

  const handleDeliveryFeeReset = async () => {
    setDeliveryFeeOverride(null);
    const totals = await calculateCartTotals();
    if (totals) setCartDetails(totals);
  };

  const confirmOrder = async () => {
    if (cart.length === 0) return;
    const totals = await calculateCartTotals(true);
    if (!totals) return;
    // Block submission when the configured minimum-order rule is not met so
    // the customer cannot accidentally create an unfulfillable order.
    if (totals.minOrderEnabled && totals.belowMinOrder) {
      showAlert('This order is below the minimum of ' + formatCurrency(totals.minOrderAmount || 0) + '. Please add more items.', 'danger');
      setShowCartSummary(true);
      return;
    }
    setIsCalculating(true);
    // When paying from the E-SCON wallet, validate and reserve the full total once.
    const wholeTotal = totals.total;
    let walletPaid = 0;
    if (paymentMethod === 'wallet') {
      walletPaid = wholeTotal;
      const ok = applyWalletChange(currentUser!.id, 'payment', wholeTotal, `Payment for cart (${cart.length} item${cart.length > 1 ? 's' : ''})`);
      if (ok === null) {
        showAlert('Insufficient wallet balance. Please top up first.', 'danger');
        setIsCalculating(false);
        setShowCartSummary(true);
        return;
      }
      pushNotification(currentUser!.id, 'payment', 'Wallet payment successful',
        `ETB ${wholeTotal.toLocaleString()} paid with your wallet. Balance is now ${formatCurrency(ok)}.`);
    }
    // Allocate the one cart-level VAT amount across the order rows. The sum of
    // the rows therefore always equals the VAT shown on the proforma, even when
    // per-line rounding would otherwise add up to a cent or two more.
    const netByLine = cart.map(item => item.basePrice * (1 + item.profitMargin) * item.quantity);
    const vatByLine = allocateVat(netByLine, totals.vatAmount);
    const createdOrders: Order[] = [];
    for (let lineIndex = 0; lineIndex < cart.length; lineIndex++) {
      const item = cart[lineIndex];
      // The material may have been deleted since the line was added; the order
      // must still be created, otherwise the buyer is charged for goods that
      // never reach the supplier.
      const material = getMaterialById(item.materialId);
      const materialName = material?.name || item.materialName;
      const materialUnit = material?.unit || item.unit || 'units';
      const supplierCompany = ensureSupplierCompany(item.supplierId, item.supplierName);
      const sellingPrice = item.basePrice * (1 + item.profitMargin);
      const materialTotal = sellingPrice * item.quantity;
      // The line total is VAT-exclusive; use its share of the single cart VAT.
      const vatAmountItem = vatByLine[lineIndex] || 0;
      // Delivery must match what the buyer approved on the proforma: the same
      // per-line checkbox, the supplier's per-km rate over the real distance, or
      // the platform fallback when that supplier publishes no rate.
      const distanceKm = await calculateDistance(
        supplierCompany.lat, supplierCompany.lng,
        currentUser!.lat || 9.0320, currentUser!.lng || 38.7469
      ).catch(() => 0);
      const { fee: transportCostItem, mode: deliveryMode } = await resolveLineDelivery(
        item, supplierCompany, distanceKm, totals.subtotal, currentUser!, systemSettings
      );
      const totalAmount = cartGrandTotal(materialTotal, vatAmountItem, transportCostItem);
      const newOrder: Order = {
        id: 'order' + (orders.length + 1) + '_' + Date.now() + '_' + item.materialId,
        customerId: currentUser!.id,
        companyId: supplierCompany.id,
        materialId: item.materialId,
        quantity: item.quantity,
        unitPrice: sellingPrice,
        transportCost: transportCostItem,
        totalAmount: totalAmount,
        status: 'pending',
        orderDate: new Date().toISOString().split('T')[0],
        address: currentUser?.address || '',
        notes: 'Order from cart - ' + cart.length + ' items total',
        invoiceNumber: 'INV-' + new Date().getFullYear() + '-' + (orders.length + 1000 + createdOrders.length),
        taxAmount: 0,
        vatAmount: vatAmountItem,
        paymentMethod: paymentMethod === 'wallet' ? 'E-SCON Wallet' : paymentMethod === 'cod' ? 'Cash on Delivery' : 'Bank Transfer',
        paymentStatus: paymentMethod === 'wallet' ? 'paid' : 'pending',
        walletPayment: paymentMethod === 'wallet',
        deliveryIncluded: deliveryMode !== 'none',
        revenueCredited: false
      };
      createdOrders.push(newOrder);
      setOrders(prev => [...prev, newOrder]);
      notifyOrderParties(newOrder, `New order ${newOrder.invoiceNumber}`,
        `${currentUser!.name} ordered ${item.quantity} ${materialUnit} of ${materialName} — ETA ${deliveryEta(distanceKm)}.`);
      const buyerCompany = materialName;
      if (paymentMethod === 'wallet') {
        pushNotification(currentUser!.id, 'order', 'Order confirmed on the platform',
          `${buyerCompany} purchased and is already marked paid from your wallet.`);
      }
    }
    // If the buyer edited the delivery fee, re-scale each order's transport so
    // the placed orders match the proforma the buyer approved.
    if (deliveryFeeOverride !== null && createdOrders.length > 0) {
      const computedTrans = createdOrders.reduce((s, o) => s + o.transportCost, 0);
      const scale = computedTrans > 0 ? deliveryFeeOverride / computedTrans : 1;
      setOrders(prev => {
        const ids = new Set(createdOrders.map(o => o.id));
        const scaled = createdOrders.map(o => {
          const newTrans = Math.round(o.transportCost * scale * 100) / 100;
          const materialTotal = o.unitPrice * o.quantity;
          return {
            ...o,
            transportCost: newTrans,
            totalAmount: cartGrandTotal(materialTotal, o.vatAmount || 0, newTrans)
          };
        });
        return [...prev.filter(o => !ids.has(o.id)), ...scaled];
      });
    }
    if (walletPaid > 0) {
      pushNotification(currentUser!.id, 'order', 'Wallet orders placed',
        `${createdOrders.length} order(s) totalling ${formatCurrency(walletPaid)} were paid instantly from your wallet.`);
    }
    showAlert('Order placed successfully! 📦 Total: ' + formatCurrency(totals.total), 'success');
    clearCart();
    setShowCartSummary(false);
    setCurrentPage('orders');
    setIsCalculating(false);
    setPaymentMethod('bank');
  };

  // ---------- Export ----------
  const handleExportMaterials = () => {
    exportToCSV(materials, 'materials_export');
    showAlert('Materials exported! 📊', 'success');
  };
  const handleExportOrders = () => {
    const userOrders = currentUser ? orders.filter(o => o.customerId === currentUser.id) : orders;
    if (userOrders.length === 0) { showAlert('No orders to export.', 'warning'); return; }
    exportOrdersToCSV(userOrders, materials, companies);
    showAlert('Orders exported! 📦', 'success');
  };

  const handleUpdateOrderStatus = (orderId: string, status: string) => {
    const existing = orders.find(o => o.id === orderId);
    if (!existing) return;
    const updated: Order = { ...existing, status: status as Order['status'] };
    const supplierCompany = getCompanyById(existing.companyId);
    const supplierUser = supplierCompany ? getUserById(supplierCompany.userId) : undefined;

    if (status === 'confirmed') {
      // Reduce supplier stock on confirmation and alert on low stock.
      setMaterials(prev => prev.map(m => m.id === existing.materialId
        ? { ...m, quantity: Math.max(0, m.quantity - existing.quantity) } : m));
      const material = getMaterialById(existing.materialId);
      if (material) {
        const remaining = Math.max(0, material.quantity - existing.quantity);
        if (remaining <= LOW_STOCK_THRESHOLD && supplierUser) {
          pushNotification(supplierUser.id, 'stock', 'Low-stock alert',
            `${material.name} now has ${remaining} ${material.unit || 'units'} left — consider restocking.`);
        }
      }
      // Wallet orders already went through walletToInvoice; supplier income is
      // credited on delivery below to avoid crediting before the goods ship.
      pushNotification(existing.customerId, 'order', 'Order confirmed ✅',
        `${existing.invoiceNumber} (${formatCurrency(existing.totalAmount)}) was confirmed by ${supplierCompany?.name || 'the supplier'}.`);
    }
    if (status === 'shipped') {
      updated.deliveryDate = new Date().toISOString().split('T')[0];
      pushNotification(existing.customerId, 'order', 'Order shipped 🚚',
        `${existing.invoiceNumber} is on its way from ${supplierCompany?.city || 'the supplier'}.`);
      if (supplierUser) {
        pushNotification(supplierUser.id, 'order', 'Shipment confirmed',
          `${existing.invoiceNumber} marked as shipped.`);
      }
    }
    if (status === 'delivered') {
      updated.deliveryDate = new Date().toISOString().split('T')[0];
      updated.paymentStatus = 'paid';
      updated.revenueCredited = true;
      // Credit the supplier's wallet (net of an 8% platform commission).
      if (supplierUser) {
        const gross = existing.totalAmount;
        const commission = Math.round(gross * 0.08 * 100) / 100;
        const net = gross - commission;
        applyWalletChange(supplierUser.id, 'income', net,
          `Invoice ${existing.invoiceNumber} delivered — net of 8% platform fee (${formatCurrency(commission)})`);
        pushNotification(supplierUser.id, 'payment', 'Payment received 💰',
          `You earned ${formatCurrency(net)} (after 8% platform fee) for ${existing.invoiceNumber}.`);
      }
      pushNotification(existing.customerId, 'order', 'Order delivered 🎉',
        `${existing.invoiceNumber} was delivered — you can now rate the product.`);
    }
    if (status === 'cancelled') {
      updated.paymentStatus = 'refunded';
      // Refund the buyer's wallet when they originally paid with it.
      if (existing.walletPayment && existing.paymentStatus === 'paid') {
        const refunded = applyWalletChange(existing.customerId, 'refund', existing.totalAmount,
          `Refund for cancelled ${existing.invoiceNumber}`);
        pushNotification(existing.customerId, 'payment', 'Refund issued 💳',
          `ETB ${existing.totalAmount.toLocaleString()} returned to your wallet${refunded !== null ? ' — new balance ' + formatCurrency(refunded) : ''}.`);
      } else {
        pushNotification(existing.customerId, 'order', 'Order cancelled',
          `${existing.invoiceNumber} was cancelled by the supplier.`);
      }
      if (supplierUser) {
        pushNotification(supplierUser.id, 'order', 'Order cancelled',
          `${existing.invoiceNumber} has been cancelled.`);
      }
    }
    setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
    showAlert('Order status updated to ' + status + ' 🚀', 'success');
  };

  const handleContactSupplier = (materialId: string) => {
    const material = getMaterialById(materialId);
    if (!material) return;
    const company = getCompanyById(material.companyId);
    if (!company) return;
    const user = getUserById(company.userId);
    if (!user) return;
    const phoneNumber = user.phone.replace(/\s/g, '');
    window.location.href = 'tel:' + phoneNumber;
  };

  const calculateStats = () => {
    const userOrders = currentUser ? orders.filter(o => {
      if (currentUser.userType === 'company') {
        const comp = getCompanyByUserId(currentUser.id);
        return comp && o.companyId === comp.id;
      }
      return o.customerId === currentUser.id;
    }) : [];
    const totalRevenue = userOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const pendingOrders = userOrders.filter(o => o.status === 'pending').length;
    const deliveredOrders = userOrders.filter(o => o.status === 'delivered').length;
    return { totalRevenue, pendingOrders, deliveredOrders, totalOrders: userOrders.length };
  };

  // ---------- Input handlers ----------
  const switchUserType = (type: string) => {
    setFormData(prev => ({ ...prev, registerUserType: type }));
  };

  // Shared "does this product include delivery, and at what rate?" block used by
  // both the add and the edit product form. The rate fields only matter when the
  // supplier ticks the box, so they are hidden until then.
  const deliveryStartFee = Math.max(0, parseFloat(formData.materialDeliveryStartFee) || 0);
  const deliveryPerKm = Math.max(0, parseFloat(formData.materialDeliveryPerKm) || 0);
  const renderDeliveryTermsFields = () => (
    <div className="delivery-terms">
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="materialDeliveryOffered"
            checked={formData.materialDeliveryOffered}
            onChange={handleInputChange}
          />
          🚚 This item is delivered by me (supplier)
        </label>
        <small className="form-hint">
          Tick this to publish your own delivery rate. Buyers then see a “with delivery cost”
          option on this item and the fee is calculated from the distance later.
        </small>
      </div>
      {formData.materialDeliveryOffered && (
        <div className="form-row">
          <div className="form-group">
            <label>🛣️ Delivery Price per km (ETB) *</label>
            <input
              type="number"
              className="form-input"
              name="materialDeliveryPerKm"
              value={formData.materialDeliveryPerKm}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              placeholder="e.g. 12"
            />
          </div>
          <div className="form-group">
            <label>🏁 Delivery Service Starting Fee (ETB) *</label>
            <input
              type="number"
              className="form-input"
              name="materialDeliveryStartFee"
              value={formData.materialDeliveryStartFee}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              placeholder="e.g. 300"
            />
          </div>
        </div>
      )}
      {formData.materialDeliveryOffered && (
        <p className="delivery-terms-preview">
          💡 A buyer ordering this item with delivery is charged{' '}
          <strong>{formatCurrency(deliveryStartFee)}</strong> starting fee
          {' + '}
          <strong>{formatCurrency(deliveryPerKm)}</strong> per km
          travelled, worked out from the real road distance when they check out.
        </p>
      )}
    </div>
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    // If user modifies search filters, automatically trigger search via useEffect
  };

  const handleDatalistInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, selectedUser: value }));
    const user = users.find(u => u.email === value);
    if (user && isUserLocked(user)) {
      const remainingTime = Math.ceil((user.lockUntil! - Date.now()) / 1000);
      showAlert('Account locked. Try again in ' + remainingTime + ' seconds.', 'warning', 3000);
    }
  };

  // ---------- Product images (base64) ----------
  const handleMaterialImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024; // 1.5 MB
    let files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const oversized = files.filter(f => f.size > MAX_IMAGE_SIZE);
    if (oversized.length > 0) {
      showAlert('Some photos exceed 1.5 MB and were skipped to protect storage.', 'warning');
      files = files.filter(f => f.size <= MAX_IMAGE_SIZE);
    }
    if (files.length === 0) return;
    const readers = files.map(file => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then(results => {
      const valid = results.filter(r => r);
      setFormData(prev => ({ ...prev, materialImages: [...prev.materialImages, ...valid].slice(0, 6) }));
    });
    e.target.value = '';
  };

  const removeMaterialImage = (index: number) => {
    setFormData(prev => ({ ...prev, materialImages: prev.materialImages.filter((_, i) => i !== index) }));
  };

  // Render product image (or a category-based placeholder when none uploaded)
  const renderProductImage = (images: string[] | undefined, category: string, size = 'md') => {
    const src = images && images.length > 0 ? images[0] : null;
    const emojiMap: Record<string, string> = {
      'Construction': '🏗️', 'Transport': '🚚', 'Health': '💊', 'Education': '📚',
      'Agriculture': '🌾', 'Manufacturing': '🏭', 'Energy': '⚡', 'Mining': '⛏️',
      'Technology': '💻', 'Retail': '🛍️', 'Services': '🛠️', 'Hospitality': '🏨',
      'Logistics': '📦', 'Pharmaceutical': '🧪', 'Automotive': '🚗', 'Environmental': '🌱',
      'Water': '💧', 'Telecom': '📡', 'Food & Beverage': '🍞'
    };
    const emoji = emojiMap[category] || '📦';
    if (src) {
      return <img className={'product-img product-img-' + size} src={src} alt="Product" loading="lazy" />;
    }
    return <div className={'product-img product-img-' + size + ' product-img-placeholder'}>{emoji}</div>;
  };

  // Render product image gallery for the details modal
  const renderProductGallery = (material: Material) => {
    if (!material.images || material.images.length === 0) {
      return <div className="product-gallery product-gallery-empty">{renderProductImage([], material.category, 'lg')}<p>No photo uploaded yet</p></div>;
    }
    return (
      <div className="product-gallery">
        {material.images.map((img, i) => (
          <img key={i} src={img} alt={material.name + ' photo ' + (i + 1)} className="product-gallery-img" loading="lazy" />
        ))}
      </div>
    );
  };

  // Product image upload section used in add/edit material forms
  const renderMaterialImageUploader = () => (
    <div className="form-group">
      <label>📷 Product Photos <small className="form-hint">(up to 6, shown in the catalogue &amp; details)</small></label>
      <div className="image-uploader">
        <label className="image-upload-btn">
          📷 Upload Photos
          <input type="file" accept="image/*" multiple onChange={handleMaterialImagesChange} />
        </label>
        {formData.materialImages.length > 0 && (
          <div className="image-preview-list">
            {formData.materialImages.map((img, i) => (
              <div key={i} className="image-preview-item">
                <img src={img} alt={'Preview ' + (i + 1)} />
                <button type="button" className="image-preview-remove" onClick={() => removeMaterialImage(i)} title="Remove photo">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ---------- Render helpers ----------
  const ScrollableTable = ({ children, minWidth = '800px' }: { children: React.ReactNode; minWidth?: string }) => (
    <div className="table-responsive-wrapper"><div className="table-scroll-container" style={{ minWidth }}>{children}</div></div>
  );

  // ---------- Page render functions ----------
  const renderSplash = () => (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="splash-logo">🏗️</div>
        <h1 className="splash-title">E-SCON</h1>
        <p className="splash-subtitle">Ethio-Supply Chain Optimization Network</p>
        <div className="splash-loader"><div className="loader-bar"></div></div>
        <p className="splash-loading">Loading platform...</p>
      </div>
    </div>
  );

  const renderHeader = () => {
    if (currentPage === 'splash') return null;
    return (
      <header className="header">
        <div className="header-content">
          <div className="logo" onClick={() => navigateTo('home')}>
            <div className="logo-icon">🏗️</div>
          </div>
          <DateTime />
          <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
          <div className={'header-actions' + (mobileMenuOpen ? ' open' : '')}>
            <button className="icon-btn" onClick={() => setDarkMode(!darkMode)} title="Toggle Theme">
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button className="icon-btn" onClick={toggleFullscreen} title="Fullscreen">
              {isFullscreen ? '⛶' : '⛶'}
            </button>
            {currentUser && (
              <button className="icon-btn notif-btn" onClick={() => setShowNotifications(true)} title="Notifications">
                🔔 {unreadNotifications() > 0 && <span className="notif-badge">{unreadNotifications()}</span>}
              </button>
            )}
            {currentUser && (
              <button className="wallet-chip" onClick={() => setShowWallet(true)} title="E-SCON Wallet">
                💳 {formatCurrency(walletBalance(currentUser.id))}
              </button>
            )}
            {currentUser ? renderUserNav() : renderGuestNav()}
            {currentUser && currentUser.userType === 'customer' && (
              <button className="cart-icon-btn" onClick={handleCheckout}>
                🛒 {cart.length > 0 && <span className="cart-badge">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>}
              </button>
            )}
            {/* Customers never export: the proforma is the buyer's only order
                document, and the platform data stays with suppliers and admins. */}
            {currentUser && currentUser.userType !== 'customer' && (
              <button className="export-btn" onClick={() => {
                if (currentPage === 'search-materials') handleExportMaterials();
                else if (currentPage === 'orders') handleExportOrders();
              }}>📥 Export</button>
            )}
          </div>
        </div>
      </header>
    );
  };

  const renderGuestNav = () => (
    <>
      <button className={'nav-link ' + (currentPage === 'home' ? 'active' : '')} onClick={() => navigateTo('home')}>Home</button>
      <button className={'nav-link ' + (currentPage === 'search-materials' ? 'active' : '')} onClick={() => navigateTo('search-materials')}>Search</button>
      <button className={'nav-link ' + (currentPage === 'supplier-map' ? 'active' : '')} onClick={() => setShowSupplierMap(true)}>Map</button>
      <button className={'nav-link ' + (currentPage === 'login' ? 'active' : '')} onClick={() => navigateTo('login')}>Login</button>
      <button className={'nav-link ' + (currentPage === 'register' ? 'active' : '')} onClick={() => navigateTo('register')}>Register</button>
    </>
  );

  const renderUserNav = () => {
    const isCompany = currentUser?.userType === 'company';
    const isAdmin = currentUser?.userType === 'admin';
    return (
      <>
        <button className={'nav-link ' + (currentPage === 'home' ? 'active' : '')} onClick={() => navigateTo('home')}>Home</button>
        <button className={'nav-link ' + (currentPage === 'search-materials' ? 'active' : '')} onClick={() => navigateTo('search-materials')}>Search</button>
        {isCompany ? (
          <>
            <button className={'nav-link ' + (currentPage === 'company-dashboard' ? 'active' : '')} onClick={() => navigateTo('company-dashboard')}>Dashboard</button>
            <button className={'nav-link ' + (currentPage === 'add-material' ? 'active' : '')} onClick={() => navigateTo('add-material')}>+ Add</button>
            <button className={'nav-link ' + (currentPage === 'edit-company' ? 'active' : '')} onClick={handleEditCompany}>Profile</button>
          </>
        ) : (
          <button className={'nav-link ' + (currentPage === 'customer-dashboard' ? 'active' : '')} onClick={() => navigateTo('customer-dashboard')}>Dashboard</button>
        )}
        <button className={'nav-link ' + (currentPage === 'orders' ? 'active' : '')} onClick={() => navigateTo('orders')}>Orders</button>
        <button className={'nav-link ' + (currentPage === 'supplier-map' ? 'active' : '')} onClick={() => setShowSupplierMap(true)}>Map</button>
        {isAdmin && (
          <button className={'nav-link ' + (currentPage === 'settings' ? 'active' : '')} onClick={() => navigateTo('settings')}>⚙️ Settings</button>
        )}
        <div className="user-info">
          <div className="user-avatar">{currentUser?.name?.charAt(0).toUpperCase()}</div>
          <div><div className="user-name">{currentUser?.name?.split(' ')[0]}</div><div className="user-type">{isAdmin ? 'Admin' : isCompany ? 'Supplier' : 'Customer'}</div></div>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </>
    );
  };

  const renderAlert = () => {
    if (!alert) return null;
    const icons: Record<string, string> = { success: '✅', danger: '⚠️', warning: '⚠️', info: 'ℹ️' };
    return <div className={'alert alert-' + alert.type}><span className="alert-icon">{icons[alert.type] || 'ℹ️'}</span>{alert.message}</div>;
  };

  const renderCartSummary = () => {
    if (!showCartSummary || !cartDetails) return null;
    const supplierGroups = cartDetails.suppliers || [];
    const multipleSuppliers = supplierGroups.length > 1;
    // The cart shows goods + delivery only. VAT is applied at order time, so the
    // wallet check has to look at the VAT-inclusive amount the buyer will pay.
    const expectedVat = vatOnSubtotal(cartDetails.subtotal, cartDetails.vatRate ?? 0, systemSettings.vat.enabled);
    const payableTotal = cartGrandTotal(cartDetails.subtotal, expectedVat.vatAmount, cartDetails.transportCost);
    return (
      <div className="modal-overlay" onClick={() => setShowCartSummary(false)}>
        <div className="modal-content cart-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header"><h2>🛒 Shopping Cart</h2><button className="modal-close" onClick={() => setShowCartSummary(false)}>✕</button></div>
          <div className="cart-datetime-bar"><LiveClock /></div>
          <div className="modal-body">
            {cart.length === 0 ? (
              <div className="empty-cart"><span className="empty-cart-icon">🛒</span><h3>Your cart is empty</h3><button className="btn btn-primary" onClick={() => { setShowCartSummary(false); navigateTo('search-materials'); }}>Start Shopping</button></div>
            ) : (
              <>
                {/* The three order actions, in the order the buyer works through
                    them. "To Purchase" places the order, "To Proforma" opens the
                    printable/save-as-PDF invoice, "To Preview" reads the same
                    invoice on screen. The proforma has a "Back to To Purchase"
                    button that returns here and highlights step 1, so a buyer who
                    reviewed the document is never stranded. Cart CSV export was
                    removed: the proforma is now the buyer's only order document. */}
                <div className="cart-order-steps">
                  <button
                    className={'cart-order-step is-primary' + (highlightPurchaseStep ? ' is-returned' : '')}
                    onClick={confirmOrder}
                    disabled={isCalculating || (cartDetails.minOrderEnabled && cartDetails.belowMinOrder)}
                    title={cartDetails.minOrderEnabled && cartDetails.belowMinOrder ? 'Minimum order not met' : ''}
                  >
                    <span className="cart-step-num">1</span>
                    <span className="cart-step-label">{isCalculating ? 'Calculating...' : 'To Purchase'}</span>
                    <span className="cart-step-hint">{highlightPurchaseStep ? 'Tap here to place your order' : 'Place the order'}</span>
                  </button>
                  <button className="cart-order-step" onClick={handlePrintProforma}>
                    <span className="cart-step-num">2</span>
                    <span className="cart-step-label">To Proforma</span>
                    <span className="cart-step-hint">Print / save PDF</span>
                  </button>
                  <button className="cart-order-step" onClick={handlePreviewProforma}>
                    <span className="cart-step-num">3</span>
                    <span className="cart-step-label">To Preview</span>
                    <span className="cart-step-hint">View on screen</span>
                  </button>
                </div>
                {multipleSuppliers ? (
                  <div className="cart-supplier-info"><h3>🏢 {cartDetails.supplierName}</h3><p>📦 {cartDetails.itemCount} units from {supplierGroups.length} suppliers</p></div>
                ) : (
                  <div className="cart-supplier-info"><h3>🏢 Supplier: {cartDetails.supplierName}</h3><p>📍 {cartDetails.supplierCity} • 📦 Distance: {cartDetails.distanceKm.toFixed(1)} km</p></div>
                )}
                {supplierGroups.map(sup => (
                  <div key={sup.supplierId} className="cart-supplier-group">
                    <div className="cart-supplier-group-header">
                      <span className="cart-supplier-group-name">🏢 {sup.supplierName}</span>
                      <span className="cart-supplier-group-meta">
                        📍 {sup.supplierCity} • 🚗 {sup.distanceKm.toFixed(1)} km • 🚚 {formatCurrency(sup.transportCost)}
                        {sup.deliveryMode && sup.deliveryMode !== 'none' && sup.deliveryBasis ? ' · ' + sup.deliveryBasis : ''}
                        {sup.deliveryMode === 'none' ? ' · no delivery cost' : ''}
                      </span>
                    </div>
                    <div className="cart-items">
                      {sup.items.map(item => (
                        <div key={item.id} className="cart-item">
                          <div className="cart-item-info">
                            <h4>{item.materialName}</h4>
                            <p>
                              {formatCurrency(item.price)} / {item.unit} • Min: {item.minOrder}
                              {item.includeDelivery !== false && ' • 🚚 delivery included'}
                            </p>
                          </div>
                          <CartQuantityInput item={item} onCommit={updateCartQuantity} onToggleDelivery={updateCartDelivery} />
                          <div className="cart-item-total"><strong>{formatCurrency(item.price * item.quantity)}</strong></div>
                          <button className="btn-icon danger" onClick={() => removeFromCart(item.id)}>🗑️</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="cart-summary">
                  <h3>Financial Summary</h3>
                  <div className="cart-delivery-hint">
                    🚚 Tick <strong>“With delivery”</strong> next to a quantity to include its delivery cost, or untick it to collect the item yourself.
                  </div>
                  {platformDeliveryHint(supplierGroups) && (
                    <div className="min-order-notice warn">{platformDeliveryHint(supplierGroups)}</div>
                  )}
                  <div className="summary-row"><span>Subtotal (before VAT):</span><span>{formatCurrency(cartDetails.subtotal)}</span></div>
                  {systemSettings.vat.enabled && (
                    <div className="summary-row vat-pending"><span>VAT ({expectedVat.rate}%):</span><span>Added when you place the order</span></div>
                  )}
                  <div className="summary-row">
                    <span>Delivery Fee{multipleSuppliers ? ` (${supplierGroups.length} suppliers)` : ''}:</span>
                    <span className="delivery-fee-edit">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={deliveryFeeOverride !== null ? deliveryFeeOverride : cartDetails.transportCost}
                        onChange={(e) => handleDeliveryFeeChange(parseFloat(e.target.value))}
                        aria-label="Delivery fee (ETB)"
                      />
                      <span className="delivery-fee-currency">ETB</span>
                      {deliveryFeeOverride !== null && (
                        <button type="button" className="link-btn delivery-fee-reset" onClick={handleDeliveryFeeReset} title="Use the automatic delivery fee">⟲ auto</button>
                      )}
                    </span>
                  </div>
                  {cartDetails.freeDeliveryApplied && (
                    <div className="summary-row free-delivery-row"><span>🎉 Free delivery applied (order above threshold):</span><span>ETB 0.00</span></div>
                  )}
                  <div className="summary-row total"><span>Total Before VAT:</span><span>{formatCurrency(cartDetails.subtotal + cartDetails.transportCost)}</span></div>
                  {systemSettings.vat.enabled && (
                    <div className="summary-row vat-payable"><span>Payable after VAT is added:</span><span>{formatCurrency(payableTotal)}</span></div>
                  )}
                  {cartDetails.minOrderEnabled && (
                    cartDetails.belowMinOrder ? (
                      <div className="min-order-notice error">
                        ⚠️ This order is below the minimum of {formatCurrency(cartDetails.minOrderAmount || 0)} in goods value. Add {formatCurrency((cartDetails.minOrderAmount || 0) - cartDetails.subtotal)} more to proceed.
                      </div>
                    ) : (
                      <div className="min-order-notice ok">✅ Meets the minimum order requirement of {formatCurrency(cartDetails.minOrderAmount || 0)}.</div>
                    )
                  )}
                </div>
                <div className="payment-selector">
                  <h4>💳 Payment Method</h4>
                  <div className="payment-options">
                    <label className={'pay-option' + (paymentMethod === 'wallet' ? ' active' : '')}>
                      <input type="radio" name="paymentMethod" checked={paymentMethod === 'wallet'} onChange={() => setPaymentMethod('wallet')} />
                      <span className="pay-icon">💳</span>
                      <span className="pay-meta"><strong>E-SCON Wallet</strong><small>Balance {formatCurrency(walletBalance(currentUser!.id))}</small></span>
                      <span className="pay-check">{paymentMethod === 'wallet' ? '✓' : ''}</span>
                    </label>
                    <label className={'pay-option' + (paymentMethod === 'bank' ? ' active' : '')}>
                      <input type="radio" name="paymentMethod" checked={paymentMethod === 'bank'} onChange={() => setPaymentMethod('bank')} />
                      <span className="pay-icon">🏦</span>
                      <span className="pay-meta"><strong>Bank Transfer</strong><small>Pay on invoice (proforma)</small></span>
                      <span className="pay-check">{paymentMethod === 'bank' ? '✓' : ''}</span>
                    </label>
                    <label className={'pay-option' + (paymentMethod === 'cod' ? ' active' : '')}>
                      <input type="radio" name="paymentMethod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                      <span className="pay-icon">💵</span>
                      <span className="pay-meta"><strong>Cash on Delivery</strong><small>Pay when goods arrive</small></span>
                      <span className="pay-check">{paymentMethod === 'cod' ? '✓' : ''}</span>
                    </label>
                  </div>
                  {paymentMethod === 'wallet' && walletBalance(currentUser ? currentUser.id : '') < payableTotal && (
                    <div className="min-order-notice error">⚠️ Insufficient wallet balance ({formatCurrency(walletBalance(currentUser ? currentUser.id : ''))}). <button className="link-btn" onClick={() => { setShowCartSummary(false); setShowWallet(true); }}>Top up now</button></div>
                  )}
                  {paymentMethod === 'wallet' && walletBalance(currentUser ? currentUser.id : '') >= payableTotal && (
                    <div className="min-order-notice ok">✅ Balance covers this order — instant checkout.</div>
                  )}
                </div>
                {/* Utility row only. Placing the order is the "To Purchase" step
                    at the top, so the two cannot disagree about the total and a
                    buyer never has to guess which of two buttons commits. */}
                <div className="cart-actions">
                  <button className="btn-secondary" onClick={clearCart}>Clear Cart</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHome = () => {
    if (isMobile) return renderHomeMobile();
    const stats = {
      totalMaterials: materials.length,
      totalCompanies: companies.length,
      totalOrders: orders.length,
      avgRating: (materials.reduce((s, m) => s + (m.rating || 0), 0) / materials.length).toFixed(1) || '4.5'
    };
    return (
      <main className="main-content">
        <section className="home-hero glass">
          <div className="hero-badge">🇪🇹 Ethiopian Supply Chain Platform</div>
          <h1>Welcome to Ethio-Supply Chain Optimization Network</h1>
          <p>Connecting verified suppliers with buyers across Ethiopia</p>
          <div className="search-center">
            <form onSubmit={(e) => { e.preventDefault(); navigateTo('search-materials'); }}>
              <div className="search-center-input"><input type="text" className="search-input" placeholder="Search products..." value={formData.searchQuery} onChange={(e) => setFormData(prev => ({ ...prev, searchQuery: e.target.value }))} /><button type="submit" className="search-center-btn">🔍 Search</button></div>
            </form>
          </div>
          <div className="cta-buttons">
            {currentUser ? (
              <>
                {currentUser.userType === 'company' ? <button className="btn btn-primary" onClick={() => navigateTo('company-dashboard')}>📊 Dashboard</button> : <button className="btn btn-primary" onClick={() => navigateTo('search-materials')}>🔍 Find Products</button>}
                <button className="btn btn-secondary" onClick={() => setShowSupplierMap(true)}>🗺️ Supplier Map</button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => navigateTo('register')}>📝 Get Started</button>
                <button className="btn btn-secondary" onClick={() => navigateTo('login')}>🔑 Login</button>
              </>
            )}
          </div>
        </section>
        <div className="stats-grid">
          <div className="stat-card glass"><div className="stat-icon">📦</div><div className="stat-value">{stats.totalMaterials}+</div><div className="stat-label">Products</div></div>
          <div className="stat-card glass"><div className="stat-icon">🏢</div><div className="stat-value">{stats.totalCompanies}</div><div className="stat-label">Suppliers</div></div>
          <div className="stat-card glass"><div className="stat-icon">📊</div><div className="stat-value">{stats.totalOrders}</div><div className="stat-label">Orders</div></div>
          <div className="stat-card glass"><div className="stat-icon">⭐</div><div className="stat-value">{stats.avgRating}/5</div><div className="stat-label">Rating</div></div>
        </div>
        <h2 className="section-title">✨ Key Features</h2>
        <div className="features-grid">
          <div className="feature-card glass"><div className="feature-icon">🤖</div><h3>AI Price Forecasting</h3><p>Predict future prices using ML</p></div>
          <div className="feature-card glass"><div className="feature-icon">🗺️</div><h3>GIS Supplier Mapping</h3><p>Interactive map with cost calculation</p></div>
          <div className="feature-card glass"><div className="feature-icon">🚚</div><h3>Logistics Optimization</h3><p>Smart routing & cost minimization</p></div>
          <div className="feature-card glass"><div className="feature-icon">📋</div><h3>Business Compliance</h3><p>Full TIN & VAT support</p></div>
        </div>
      </main>
    );
  };

  const renderLogin = () => {
    const selectedUser = users.find(u => u.email === formData.selectedUser);
    const isLocked = selectedUser ? isUserLocked(selectedUser) : false;
    return (
      <main className="main-content">
        <div className="auth-container">
          <div className="auth-card glass">
            <div className="auth-header"><span className="auth-icon">🔑</span><h2>Welcome Back</h2><p>Login with email & password (0909)</p></div>
            <div className="auth-body">
              <form onSubmit={handleLogin}>
                <div className="form-group"><label className="form-label">📧 Email</label><input list="userList" className="form-input" name="selectedUser" value={formData.selectedUser} onChange={handleDatalistInputChange} required disabled={isLocked} /><datalist id="userList">{users.map(user => <option key={user.id} value={user.email}>{user.name} - {user.email}</option>)}</datalist></div>
                {formData.selectedUser && !isLocked && (<><div className="form-group"><label className="form-label">🔒 Password</label><input type="password" className="form-input" name="loginPassword" value={formData.loginPassword} onChange={handleInputChange} required /></div><button type="submit" className="btn-submit">🔐 Login</button></>)}
              </form>
              <div className="text-center"><p>Don't have an account? <button className="link-btn" onClick={() => navigateTo('register')}>Register here</button></p></div>
            </div>
          </div>
        </div>
      </main>
    );
  };

  const renderRegister = () => (
    <main className="main-content">
      <div className="auth-container">
        <div className="auth-card glass">
          <div className="auth-header"><span className="auth-icon">📝</span><h2>Welcome — Create Account</h2><p>Join E-SCON Platform</p></div>
          <div className="auth-body">
            <div className="auth-tabs"><button className={'auth-tab ' + (formData.registerUserType === 'customer' ? 'active' : '')} onClick={() => switchUserType('customer')}>👤 Customer</button><button className={'auth-tab ' + (formData.registerUserType === 'company' ? 'active' : '')} onClick={() => switchUserType('company')}>🏢 Supplier</button></div>
            <form onSubmit={handleRegister}>
              {formData.registerUserType === 'company' && (<>
                <div className="form-group"><label className="form-label">🏢 Company Name *</label><input type="text" className="form-input" name="registerCompanyName" value={formData.registerCompanyName} onChange={handleInputChange} required /></div>
                <div className="form-row"><div className="form-group"><label className="form-label">📋 TIN Number *</label><input type="text" className="form-input" name="tinNumber" value={formData.tinNumber} onChange={handleInputChange} required /></div><div className="form-group"><label className="form-label">📄 Business License *</label><input type="text" className="form-input" name="businessLicense" value={formData.businessLicense} onChange={handleInputChange} required /></div></div>
                <div className="form-group"><label className="checkbox-label"><input type="checkbox" name="vatRegistered" checked={formData.vatRegistered} onChange={handleInputChange} /> ✅ VAT Registered</label></div>
                {formData.vatRegistered && <div className="form-group"><label className="form-label">💰 VAT Number</label><input type="text" className="form-input" name="vatNumber" value={formData.vatNumber} onChange={handleInputChange} /></div>}
              </>)}
              <div className="form-row"><div className="form-group"><label className="form-label">👤 Full Name *</label><input type="text" className="form-input" name="registerFullName" value={formData.registerFullName} onChange={handleInputChange} required /></div><div className="form-group"><label className="form-label">📧 Email *</label><input type="email" className="form-input" name="registerEmail" value={formData.registerEmail} onChange={handleInputChange} required /></div></div>
              <div className="form-row"><div className="form-group"><label className="form-label">🔒 Password *</label><input type="password" className="form-input" name="registerPassword" value={formData.registerPassword} onChange={handleInputChange} required /></div><div className="form-group"><label className="form-label">📞 Phone *</label><input type="tel" className="form-input" name="registerPhone" value={formData.registerPhone} onChange={handleInputChange} required /></div></div>
              <div className="form-group"><label className="form-label">📍 Address *</label><input type="text" className="form-input" name="registerAddress" value={formData.registerAddress} onChange={handleInputChange} required /></div>
              <div className="form-group"><label className="form-label">🏙️ City *</label><select className="form-select" name="registerCity" value={formData.registerCity} onChange={handleInputChange} required><option value="">Select</option>{ETHIOPIAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="form-group"><label className="checkbox-label"><input type="checkbox" required /> ✅ I agree to Ethiopian Trade Regulations</label></div>
              <button type="submit" className="btn-submit">📝 Create Account</button>
            </form>
            <div className="text-center"><p>Already have an account? <button className="link-btn" onClick={() => navigateTo('login')}>Login here</button></p></div>
          </div>
        </div>
      </div>
    </main>
  );

  const renderCompanyDashboard = () => {
    if (isMobile) return renderMobileDashboard(true);
    if (!currentUser || currentUser.userType !== 'company') return <main className="main-content"><div className="alert alert-danger">⚠️ Access denied.</div></main>;
    const company = getCompanyByUserId(currentUser.id);
    const companyMaterials = materials.filter(m => m.companyId === company?.id);
    const stats = calculateStats();
    // A supplier always sees the full picture of their own stock: how many units
    // are on hand, what they are worth, and which lines need restocking.
    const stockSummary = {
      units: companyMaterials.reduce((sum, m) => sum + (m.quantity || 0), 0),
      value: companyMaterials.reduce((sum, m) => sum + (m.quantity || 0) * m.price, 0),
      low: companyMaterials.filter(m => m.quantity > 0 && m.quantity <= LOW_STOCK_THRESHOLD).length,
      out: companyMaterials.filter(m => (m.quantity || 0) <= 0).length,
    };
    return (
      <main className="main-content">
        <div className="dashboard-header dashboard-header-supplier">
          <div className="dashboard-title"><span className="title-icon">🏢</span><h1>{welcomeTitle('Supplier Dashboard')}</h1></div>
          <p className="dashboard-supplier-name">{company?.name}</p>
        </div>
        <div className="dashboard-grid">
          <div className="dashboard-card glass"><div className="card-icon">📦</div><div className="stat-value">{companyMaterials.length}</div><div className="stat-label">Products</div></div>
          <div className="dashboard-card glass"><div className="card-icon">📊</div><div className="stat-value">{stats.totalOrders}</div><div className="stat-label">Orders</div></div>
          <div className="dashboard-card glass"><div className="card-icon">⏳</div><div className="stat-value">{stats.pendingOrders}</div><div className="stat-label">Pending</div></div>
          <div className="dashboard-card glass"><div className="card-icon">💰</div><div className="stat-value">{formatCurrency(stats.totalRevenue)}</div><div className="stat-label">Revenue</div></div>
        </div>
        <div className="card glass stock-summary-card">
          <div className="card-header"><h3>📥 My stock</h3><span className="stock-summary-hint">Visible to you only — customers never see stock levels</span></div>
          <div className="stock-summary-grid">
            <div className="stock-summary-tile"><span className="stock-tile-icon">📦</span><strong>{stockSummary.units}</strong><small>Units in stock</small></div>
            <div className="stock-summary-tile"><span className="stock-tile-icon">💵</span><strong>{formatCurrency(stockSummary.value)}</strong><small>Stock value</small></div>
            <div className={'stock-summary-tile' + (stockSummary.low > 0 ? ' warn' : '')}><span className="stock-tile-icon">⚠️</span><strong>{stockSummary.low}</strong><small>Low stock (≤ {LOW_STOCK_THRESHOLD})</small></div>
            <div className={'stock-summary-tile' + (stockSummary.out > 0 ? ' danger' : '')}><span className="stock-tile-icon">🚫</span><strong>{stockSummary.out}</strong><small>Out of stock</small></div>
          </div>
        </div>
        <div className="card glass"><div className="card-header"><h3>📦 Your Products</h3><button className="btn btn-primary" onClick={() => navigateTo('add-material')}>➕ Add Product</button><button className="btn btn-secondary" onClick={handleExportMaterials}>📥 Export</button></div>
          <ScrollableTable minWidth="1000px">
            <table className="data-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Unit</th><th>In Stock</th><th>Stock Status</th><th>Stock Value</th><th>Rating</th><th>Actions</th></tr></thead><tbody>
              {companyMaterials.map(m => {
                const inStock = (m.quantity || 0) > 0;
                const isLow = inStock && m.quantity <= LOW_STOCK_THRESHOLD;
                return (
                <tr key={m.id}>
                  <td className="product-cell">
                    {renderProductImage(m.images, m.category, 'sm')}
                    <div className="product-cell-info"><strong>{m.name}</strong>{m.brand && <small>{m.brand}</small>}</div>
                  </td>
                  <td>{m.category}</td>
                  <td className="price-cell">{formatCurrency(m.price)}</td>
                  <td>{m.unit}</td>
                  <td className="stock-cell"><strong>{m.quantity}</strong> {m.unit}</td>
                  <td>
                    {!inStock
                      ? <span className="stock-chip stock-chip-out">🚫 Out of stock</span>
                      : isLow
                        ? <span className="stock-chip stock-chip-low">⚠️ Low stock</span>
                        : <span className="stock-chip stock-chip-in">✅ In stock</span>}
                  </td>
                  <td className="stock-cell">{formatCurrency((m.quantity || 0) * m.price)}</td>
                  <td>⭐ {m.rating || 'N/A'}</td>
                  <td>
                    <button className="btn-icon" title="View details" onClick={() => setSelectedMaterial(m)}>👁️</button>
                    <button className="btn-icon edit" title="Edit product" onClick={() => handleEditMaterial(m)}>✏️</button>
                    <button className="btn-icon danger" title="Delete product" onClick={() => handleDeleteMaterial(m.id)}>🗑️</button>
                  </td>
                </tr>
                );
              })}
            </tbody></table>
          </ScrollableTable>
        </div>
        <button className="btn btn-secondary" onClick={handleEditCompany}>✏️ Edit Company Profile</button>
      </main>
    );
  };

  const renderCustomerDashboard = () => {
    if (isMobile) return renderMobileDashboard(false);
    if (!currentUser || currentUser.userType !== 'customer') return <main className="main-content"><div className="alert alert-danger">⚠️ Access denied.</div></main>;
    const userOrders = orders.filter(o => o.customerId === currentUser.id);
    const stats = calculateStats();
    return (
      <main className="main-content">
        <div className="dashboard-header"><div className="dashboard-title"><span className="title-icon">👤</span><h1>{welcomeTitle('Customer Dashboard')}</h1></div><p>📍 {currentUser.address || currentUser.city}</p></div>
        <div className="dashboard-grid">
          <div className="dashboard-card glass"><div className="card-icon">📦</div><div className="stat-value">{stats.totalOrders}</div><div className="stat-label">Orders</div></div>
          <div className="dashboard-card glass"><div className="card-icon">⏳</div><div className="stat-value">{stats.pendingOrders}</div><div className="stat-label">Pending</div></div>
          <div className="dashboard-card glass"><div className="card-icon">✅</div><div className="stat-value">{stats.deliveredOrders}</div><div className="stat-label">Delivered</div></div>
          <div className="dashboard-card glass"><div className="card-icon">💰</div><div className="stat-value">{formatCurrency(stats.totalRevenue)}</div><div className="stat-label">Spent</div></div>
        </div>
        <div className="card glass">
          <div className="card-header">
            <h3>📍 My Location</h3>
            <button className="btn btn-primary" onClick={() => setShowMyLocationPicker(true)}>🗺️ Edit / use current location</button>
          </div>
          <p className="my-location-text">
            {currentUser.address || 'No address'}, {currentUser.city || 'No city'} · {Number.isFinite(currentUser.lat) && Number.isFinite(currentUser.lng) ? `Lat ${Number(currentUser.lat).toFixed(5)}, Lng ${Number(currentUser.lng).toFixed(5)}` : 'location not set — tap to pin it'}
          </p>
          <small className="my-location-hint">Every delivery distance is calculated from this point. Update it whenever you move.</small>
        </div>
        <div className="card glass"><div className="card-header"><h3>📋 Recent Orders</h3><button className="btn btn-primary" onClick={() => navigateTo('search-materials')}>🔍 Find Products</button></div>
          <ScrollableTable minWidth="800px">
            <table className="data-table"><thead><tr><th>Order ID</th><th>Product</th><th>Quantity</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>
              {userOrders.slice(0,5).map(order => {
                const m = getMaterialById(order.materialId);
                return (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{m?.name}</td>
                    <td>{order.quantity}</td>
                    <td className="price-cell">{formatCurrency(order.totalAmount)}</td>
                    <td>{order.status === 'delivered' ? '✅' : order.status === 'pending' ? '⏳' : '🚚'} {order.status}</td>
                    <td>{formatDate(order.orderDate)}</td>
                  </tr>
                );
              })}
            </tbody></table>
          </ScrollableTable>
        </div>
      </main>
    );
  };

  // Pricing and specification fields that used to be hard-coded in the add /
  // edit handlers. Exposing them here means a supplier can change every value
  // without editing source code.
  const renderMaterialDetailFields = () => (
    <div className="delivery-terms">
      <div className="form-row">
        <div className="form-group"><label>📈 Profit margin (%)</label><input type="number" className="form-input" name="materialProfitMargin" value={formData.materialProfitMargin} onChange={handleInputChange} min="0" step="0.1" /></div>
        <div className="form-group"><label>🚚 Transport estimate (ETB)</label><input type="number" className="form-input" name="materialTransportCost" value={formData.materialTransportCost} onChange={handleInputChange} min="0" step="0.01" /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>⚖️ Weight per unit (tonnes)</label><input type="number" className="form-input" name="materialWeightPerUnit" value={formData.materialWeightPerUnit} onChange={handleInputChange} min="0.001" step="0.001" /></div>
        <div className="form-group"><label>🏷️ Model</label><input type="text" className="form-input" name="materialModel" value={formData.materialModel} onChange={handleInputChange} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>⚖️ Packed weight</label><input type="text" className="form-input" name="materialWeight" value={formData.materialWeight} onChange={handleInputChange} placeholder="e.g. 50 kg" /></div>
        <div className="form-group"><label>📐 Dimensions</label><input type="text" className="form-input" name="materialDimensions" value={formData.materialDimensions} onChange={handleInputChange} placeholder="e.g. 120 × 80 × 60 cm" /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>🏅 Grade</label><input type="text" className="form-input" name="materialGrade" value={formData.materialGrade} onChange={handleInputChange} /></div>
        <div className="form-group"><label>🌍 Origin</label><input type="text" className="form-input" name="materialOrigin" value={formData.materialOrigin} onChange={handleInputChange} /></div>
      </div>
      <div className="form-group"><label>📜 Certifications <small className="form-hint">(comma separated)</small></label><input type="text" className="form-input" name="materialCertifications" value={formData.materialCertifications} onChange={handleInputChange} placeholder="e.g. ISO 9001, CE" /></div>
    </div>
  );

  const renderAddMaterial = () => (
    <main className="main-content"><div className="form-container glass"><h2>{welcomeTitle('Add New Product')}</h2>
      <form onSubmit={handleAddMaterial}>
        <div className="form-group"><label>📦 Product Name *</label><input type="text" className="form-input" name="materialName" value={formData.materialName} onChange={handleInputChange} required /></div>
        <div className="form-row"><div className="form-group"><label>🏭 Category *</label><select className="form-select" name="materialCategory" value={formData.materialCategory} onChange={handleInputChange} required><option value="">Select</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div><div className="form-group"><label>📏 Unit *</label><input type="text" className="form-input" name="materialUnit" value={formData.materialUnit} onChange={handleInputChange} required list="unitList" /><datalist id="unitList">{MEASUREMENT_UNITS.map(u => <option key={u} value={u} />)}</datalist></div></div>
        <div className="form-row"><div className="form-group"><label>💰 Base Price (ETB) *</label><input type="number" className="form-input" name="materialPrice" value={formData.materialPrice} onChange={handleInputChange} required step="0.01" /></div><div className="form-group"><label>📊 Quantity *</label><input type="number" className="form-input" name="materialQuantity" value={formData.materialQuantity} onChange={handleInputChange} required /></div></div>
        <div className="form-row"><div className="form-group"><label>📋 Min Order <small className="form-hint">(optional — defaults to 1)</small></label><input type="number" className="form-input" name="materialMinOrder" value={formData.materialMinOrder} onChange={handleInputChange} min="1" placeholder="1" /></div><div className="form-group"><label>🏷️ Brand</label><input type="text" className="form-input" name="materialBrand" value={formData.materialBrand} onChange={handleInputChange} /></div></div>
        <div className="form-group"><label>📝 Description *</label><textarea className="form-textarea" name="materialDescription" value={formData.materialDescription} onChange={handleInputChange} required rows={4} /></div>
        {renderMaterialDetailFields()}
        {renderDeliveryTermsFields()}
        {renderMaterialImageUploader()}
        <div className="form-actions"><button type="submit" className="btn-submit">✅ Add Product</button><button type="button" className="btn-secondary" onClick={() => navigateTo('company-dashboard')}>❌ Cancel</button></div>
      </form>
    </div></main>
  );

  const renderEditMaterial = () => (
    <main className="main-content"><div className="form-container glass"><h2>{welcomeTitle('Edit Product')}</h2>
      <form onSubmit={handleUpdateMaterial}>
        <div className="form-group"><label>📦 Product Name *</label><input type="text" className="form-input" name="materialName" value={formData.materialName} onChange={handleInputChange} required /></div>
        <div className="form-row"><div className="form-group"><label>🏭 Category *</label><select className="form-select" name="materialCategory" value={formData.materialCategory} onChange={handleInputChange} required><option value="">Select</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div><div className="form-group"><label>📏 Unit *</label><input type="text" className="form-input" name="materialUnit" value={formData.materialUnit} onChange={handleInputChange} required list="unitList" /><datalist id="unitList">{MEASUREMENT_UNITS.map(u => <option key={u} value={u} />)}</datalist></div></div>
        <div className="form-row"><div className="form-group"><label>💰 Base Price (ETB) *</label><input type="number" className="form-input" name="materialPrice" value={formData.materialPrice} onChange={handleInputChange} required step="0.01" /></div><div className="form-group"><label>📊 Quantity *</label><input type="number" className="form-input" name="materialQuantity" value={formData.materialQuantity} onChange={handleInputChange} required /></div></div>
        <div className="form-row"><div className="form-group"><label>📋 Min Order <small className="form-hint">(optional — defaults to 1)</small></label><input type="number" className="form-input" name="materialMinOrder" value={formData.materialMinOrder} onChange={handleInputChange} min="1" placeholder="1" /></div><div className="form-group"><label>🏷️ Brand</label><input type="text" className="form-input" name="materialBrand" value={formData.materialBrand} onChange={handleInputChange} /></div></div>
        <div className="form-group"><label>📝 Description *</label><textarea className="form-textarea" name="materialDescription" value={formData.materialDescription} onChange={handleInputChange} required rows={4} /></div>
        {renderMaterialDetailFields()}
        {renderDeliveryTermsFields()}
        {renderMaterialImageUploader()}
        <div className="form-actions"><button type="submit" className="btn-submit">✅ Update</button><button type="button" className="btn-secondary" onClick={handleCancelMaterialEdit}>Cancel</button></div>
      </form>
    </div></main>
  );

  const renderSearchMaterials = () => {
    // Decide what to display:
    // If search has been performed (isSearchPerformed true), show searchResults (even if empty)
    // Else show all materials
    const displayMaterials = isSearchPerformed ? searchResults : materials;

    // Suppliers that actually list products, used by the supplier filter listbox.
    const supplierOptions = companies
      .filter(company => materials.some(material => material.companyId === company.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const activeSupplierName = formData.searchSupplier !== 'all'
      ? supplierOptions.find(company => company.id === formData.searchSupplier)?.name
      : undefined;

    return (
      <main className="main-content">
        <div className="search-hero glass">
          <h1>🔍 {welcomeTitle('Find Products')}</h1>
          <p>Compare prices from verified suppliers</p>
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-group">
              <input type="text" className="search-input-large" placeholder="Search products..." name="searchQuery" value={formData.searchQuery} onChange={handleInputChange} />
              <button type="submit" className="search-btn">🔍</button>
            </div>
            <div className="search-filters">
              <select className="filter-select" name="searchCategory" value={formData.searchCategory} onChange={handleInputChange}>
                <option value="all">Dept</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="filter-select" name="searchSupplier" value={formData.searchSupplier} onChange={handleInputChange} aria-label="Filter by supplier">
                <option value="all">Supplier</option>
                {supplierOptions.map(company => (
                  <option key={company.id} value={company.id}>{company.name} — {company.city}</option>
                ))}
              </select>
              <select className="filter-select" name="searchCity" value={formData.searchCity} onChange={handleInputChange}>
                <option value="all">City</option>
                {ETHIOPIAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" className="filter-input" placeholder="Max Price" name="searchMaxPrice" value={formData.searchMaxPrice} onChange={handleInputChange} />
              <select className="filter-select" name="searchSortBy" value={formData.searchSortBy} onChange={handleInputChange}>
                <option value="price_asc">Price ↑</option>
                <option value="price_desc">Price ↓</option>
                <option value="rating_desc">Rating</option>
                <option value="newest">Newest</option>
              </select>
              <button type="button" className="filter-clear" onClick={clearFilters}>✕</button>
            </div>
          </form>
        </div>
        <div className="search-results">
          <div className="results-header">
            <h2>
              {isSearchPerformed 
                ? `📊 Results (${displayMaterials.length})` 
                : '📦 All Products'}
              {activeSupplierName ? ` · 🏢 ${activeSupplierName}` : ''}
            </h2>
          </div>
          {displayMaterials.length === 0 ? (
            <div className="no-results glass">
              <p>🔍 No products found matching your criteria.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Try adjusting your filters or search terms.</p>
            </div>
          ) : isMobile ? (
            <div className="m-search-grid">
              {(displayMaterials as SearchResult[]).map(item => {
                const company = getCompanyById(item.companyId);
                return (
                  <div key={item.id} className="m-search-item">
                    <MobileProductCard
                      material={item}
                      company={company}
                      isInCart={cart.some(c => c.materialId === item.id)}
                      isFav={favorites.includes(item.id)}
                      distanceKm={item.distance}
                      onOpen={() => setSelectedMaterial(item)}
                      onToggleFav={() => toggleFavorite(item.id)}
                      variant="list"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <ScrollableTable minWidth="1000px">
              <table className="data-table">
                <thead><tr><th className="th-sticky">Product</th><th>Supplier</th><th>City</th><th>Price</th><th>Unit</th>{canSeeStock && <th>Stock</th>}<th>Rating</th><th>Distance</th><th>Actions</th></tr></thead>
                <tbody>
                  {(displayMaterials as SearchResult[]).map(item => {
                    const company = getCompanyById(item.companyId);
                    return (
                      <tr 
                        key={item.id}
                        className="product-row"
                        onClick={() => {
                          if (company) {
                            handleOpenMapWithRoute(company.id);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                        title="Click to open the route on the map"
                      >
                        <td className="product-cell td-sticky">
                          {renderProductImage(item.images, item.category, 'sm')}
                          <div className="product-cell-info"><strong>{item.name}</strong>{item.brand && <small>{item.brand}</small>}</div>
                        </td>
                        <td className="supplier-cell">{company?.name || 'Unknown'}</td>
                        <td>{company?.city || 'N/A'}</td>
                        <td className="price-cell">{formatCurrency(item.price)}</td>
                        <td>{item.unit}</td>
                        {canSeeStock && (
                          <td className={item.quantity > 0 ? 'in-stock' : 'out-stock'}>{item.quantity > 0 ? item.quantity : 'Out'}</td>
                        )}
                        <td>⭐ {item.rating || 'N/A'}</td>
                        <td className="distance-cell">
                          <span className="distance-badge" title={currentUser ? 'Distance from your location' : 'Distance from default location (Addis Ababa)'}>
                            🚗 {item.distance != null ? item.distance.toFixed(1) + ' km' : '—'}
                          </span>
                        </td>
                        <td>
                          <button className={'btn-icon ' + (favorites.includes(item.id) ? 'fav-active' : '')} title="Toggle favorite" onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}>{favorites.includes(item.id) ? '❤️' : '🤍'}</button>
                          <button className={'btn-icon ' + (compareItems.includes(item.id) ? 'compare-active' : '')} title="Compare" onClick={(e) => { e.stopPropagation(); toggleCompare(item.id); }}>⚖️</button>
                          <button className="btn-icon map" title="View route on map" onClick={(e) => { e.stopPropagation(); if (company) handleOpenMapWithRoute(company.id); }}>🗺️</button>
                          <button className="btn-icon" title="View details" onClick={(e) => { e.stopPropagation(); setSelectedMaterial(item); }}>👁️</button>
                          <button className="btn-icon contact" title="Call supplier" onClick={(e) => { e.stopPropagation(); handleContactSupplier(item.id); }}>📞</button>
                          {currentUser?.userType === 'customer' && (
                            // Quantity — and whether the line includes delivery — is
                            // chosen in the product details, never from this row. The
                            // cart itself is reached from the header button.
                            <button className="btn-icon add-to-cart" title="View product & choose quantity" onClick={(e) => { e.stopPropagation(); setSelectedMaterial(item); }}>🛒</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollableTable>
          )}
        </div>
      </main>
    );
  };

  const renderOrders = () => {
    if (isMobile) return renderOrdersMobile();
    const isCompany = currentUser?.userType === 'company';
    const userOrders = isCompany ? orders.filter(o => {
      const comp = getCompanyByUserId(currentUser!.id);
      return comp && o.companyId === comp.id;
    }) : orders.filter(o => o.customerId === currentUser?.id);
    const totalValue = userOrders.reduce((s, o) => s + o.totalAmount, 0);
    return (
      <main className="main-content">
        <div className="dashboard-header"><div className="dashboard-title"><span className="title-icon">🛒</span><h1>{welcomeTitle(isCompany ? 'Order Management' : 'My Orders')}</h1></div><div className="order-summary"><span>📊 Total: {userOrders.length} orders</span><span>💰 Value: {formatCurrency(totalValue)}</span>{isCompany && <button className="btn btn-secondary" onClick={handleExportOrders}>📥 Export</button>}</div></div>
        {userOrders.length === 0 ? <div className="no-orders glass">No orders yet</div> : (
          <ScrollableTable minWidth="900px">
            <table className="data-table"><thead><tr><th>Order ID</th><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Transport</th><th>Total</th><th>Status</th><th>Date</th>{isCompany && <th>Actions</th>}</tr></thead><tbody>
              {userOrders.map(order => {
                const m = getMaterialById(order.materialId);
                return (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{m?.name}</td>
                    <td>{order.quantity}</td>
                    <td className="price-cell">{formatCurrency(order.unitPrice)}</td>
                    <td className="price-cell">{formatCurrency(order.transportCost)}</td>
                    <td className="price-cell">{formatCurrency(order.totalAmount)}</td>
                    <td>{order.status === 'delivered' ? '✅' : order.status === 'pending' ? '⏳' : '🚚'} {order.status}</td>
                    <td>{formatDate(order.orderDate)}</td>
                    {!isCompany && (
                      <td><button className="btn-icon" title="Quick Reorder" onClick={() => handleQuickReorder(order.materialId)}>🔄</button></td>
                    )}
                    {isCompany && order.status === 'pending' && (
                      <td><button className="btn-icon success" onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}>✅ Confirm</button></td>
                    )}
                  </tr>
                );
              })}
            </tbody></table>
          </ScrollableTable>
        )}
      </main>
    );
  };

  const renderSupplierMap = () => {
    // Route to the destination the map last showed, or to the first supplier
    // when it is opened without one.
    const firstCompanyId = companies.length > 0 ? companies[0].id : null;
    const routeId = autoRouteSupplierId || firstCompanyId;
    return (
      <Suspense fallback={<div className="map-placeholder">Loading map...</div>}>
        <MapComponent
          companies={companies}
          materials={materials}
          currentUser={currentUser}
          onClose={() => setShowSupplierMap(false)}
          onSelectSupplier={(company) => console.log('Selected supplier:', company)}
          autoRouteSupplierId={routeId}
          routeRequestId={routeRequestId}
          onRouteShown={(companyId) => setAutoRouteSupplierId(companyId)}
        />
      </Suspense>
    );
  };

  // The quantity +/- control lives ONLY here, in the product details view — the
  // step where a customer has actually seen the product and is ready to order.
  // Search results, product cards and carousels only ever open this view.
  const DetailsOrderBox = ({ material, isInCart, onAdded }: { material: Material; isInCart: boolean; onAdded: () => void }) => {
    const min = 1; // customers may order any amount — no minimum order
    const [qty, setQty] = useState(min);
    // Delivery is a decision the buyer makes here, while filling in the quantity.
    // It defaults to on: if the supplier publishes a per-km rate that is the fee
    // basis, otherwise the platform's configured delivery rate applies.
    const [withDelivery, setWithDelivery] = useState(true);
    const soldOut = material.quantity <= 0;
    return (
      <div className="order-box">
        <h3>🛒 Add to Cart</h3>
        {soldOut ? (
          <p className="order-box-note">Currently unavailable — please contact the supplier.</p>
        ) : (
          <>
            <div className="order-box-row">
              <QuantityStepper value={qty} min={min} unit={material.unit} onChange={setQty} />
              <span className="order-box-hint">Any quantity — use − / + or tap the number to type your own.</span>
            </div>
            <label className={'order-box-delivery' + (withDelivery ? ' on' : '')}>
              <input
                type="checkbox"
                checked={withDelivery}
                onChange={e => setWithDelivery(e.target.checked)}
                aria-label={'Include delivery cost for ' + material.name}
              />
              <span className="order-box-delivery-text">
                <strong>With delivery cost</strong>
                <small>{deliveryBasisLabel(material.delivery, withDelivery)}</small>
              </span>
            </label>
            <div className="order-box-total">Total: <strong>{formatCurrency(material.price * qty)}</strong></div>
            <button
              className={'btn order-box-btn' + (isInCart ? ' is-ordered' : '')}
              onClick={() => { if (addToCart(material, qty, withDelivery)) onAdded(); }}
            >
              {isInCart ? '✅ Ordered — Update' : '➕ Add to Cart'}
            </button>
          </>
        )}
      </div>
    );
  };

  const renderMaterialDetails = () => {
    if (!selectedMaterial) return null;
    const company = getCompanyById(selectedMaterial.companyId);
    const isInCart = cart.some(item => item.materialId === selectedMaterial.id);
    const history = selectedMaterial.priceHistory || [];
    const forecast = forecastPrice(history, selectedMaterial.price);
    const productReviews = reviewForMaterial(selectedMaterial.id);
    const avgRating = ratingForMaterial(selectedMaterial);
    const isLowStock = canSeeStock && selectedMaterial.quantity <= LOW_STOCK_THRESHOLD;
    const canReview = currentUser?.userType === 'customer' &&
      orders.some(o => o.customerId === currentUser.id && o.materialId === selectedMaterial.id && o.status === 'delivered');

    return (
      <div className="modal-overlay" onClick={() => setSelectedMaterial(null)}>
        <div className="modal-content glass" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{selectedMaterial.name}</h2>
            <button className="modal-close" onClick={() => setSelectedMaterial(null)}>✕</button>
          </div>
          <div className="modal-body">
            {isLowStock && <div className="stock-flag stock-flag-low">⚠️ Low stock — only {selectedMaterial.quantity} {selectedMaterial.unit || 'units'} left</div>}
            {renderProductGallery(selectedMaterial)}
            <div><h3>📝 Description</h3><p>{selectedMaterial.description}</p></div>
            <div><h3>💰 Pricing</h3>
              <p>Unit: <strong>{formatCurrency(selectedMaterial.price)}</strong> / {selectedMaterial.unit}{canSeeStock && <><br/>Min Order: {selectedMaterial.minOrder} {selectedMaterial.unit}</>}{canSeeStock && <><br/>Stock: {selectedMaterial.quantity} {selectedMaterial.unit}</>}</p>
              <div className="rating-summary">
                <StarRatingDisplay value={avgRating} />
                <span className="rating-num">{avgRating.toFixed(1)}</span>
                <span className="rating-count">({productReviews.length} review{productReviews.length !== 1 ? 's' : ''})</span>
              </div>
            </div>
            {history.length >= 2 && forecast && (
              <div className="forecast-panel">
                <div className="forecast-header">
                  <h3>🤖 AI Price Forecast</h3>
                  <span className={'trend-chip trend-' + forecast.trend}>
                    {forecast.trend === 'up' ? '📈 Trending up' : forecast.trend === 'down' ? '📉 Trending down' : '➡️ Stable'}
                  </span>
                </div>
                <Sparkline points={history.map(p => p.price)} width={220} height={56} />
                <div className="forecast-details">
                  <span>Predicted next price: <strong>{formatCurrency(forecast.next)}</strong></span>
                  <span className={forecast.changePct > 0 ? 'forecast-pos' : forecast.changePct < 0 ? 'forecast-neg' : ''}>
                    {forecast.changePct > 0 ? '+' : ''}{forecast.changePct.toFixed(1)}% vs today
                  </span>
                  {selectedMaterial.category === 'Fuel' && (
                    <span className="forecast-note">⚠️ Fuel prices are volatile — order at current price when the trend is rising</span>
                  )}
                </div>
              </div>
            )}
            <div><h3>🏢 Supplier</h3>
              <p><strong>{company?.name}</strong><br/>📍 {company?.city}<br/>⭐ {company?.rating}/5</p>
              <p>
                <strong>🚗 Distance from you:</strong>
                {isDistanceLoading ? (
                  <span className="distance-loader"><span className="dot-pulse"></span></span>
                ) : distanceToSelected !== null ? (
                  <span className="distance-link" onClick={() => company && handleOpenMapWithRoute(company.id)} title="Click to view route on map">
                    {distanceToSelected.toFixed(1)} km
                  </span>
                ) : ' Unable to calculate'}
                {distanceToSelected !== null && <span className="eta-chip">🕒 ETA {deliveryEta(distanceToSelected)}</span>}
              </p>
              {company && (
                <button className="btn btn-primary map-route-btn" onClick={() => { handleOpenMapWithRoute(company.id); setSelectedMaterial(null); }}>🗺️ View Route on Map</button>
              )}
            </div>
            <div className="reviews-section">
              <h3>⭐ Customer Reviews</h3>
              {currentUser?.userType === 'customer' && (
                <div className="review-form">
                  <StarRatingInput value={reviewDraft.rating} onChange={(v) => setReviewDraft(prev => ({ ...prev, rating: v }))} />
                  <textarea
                    className="form-input"
                    placeholder={canReview ? 'Share your experience with this product…' : 'Only customers who received this product can review it (close & collect after delivery).'}
                    value={reviewDraft.comment}
                    disabled={!canReview}
                    rows={2}
                    onChange={(e) => setReviewDraft(prev => ({ ...prev, comment: e.target.value }))}
                  />
                  <button className="btn btn-primary" disabled={!canReview} onClick={() => submitReview(selectedMaterial.id)}>Post Review</button>
                </div>
              )}
              {productReviews.length === 0 ? (
                <p className="reviews-empty">No reviews yet — be the first to rate this product.</p>
              ) : (
                <div className="reviews-list">
                  {productReviews.map(r => (
                    <div key={r.id} className="review-item">
                      <div className="review-top">
                        <span className="review-avatar">{r.userName.charAt(0).toUpperCase()}</span>
                        <span className="review-name">{r.userName}</span>
                        <span className="review-date">{timeAgo(r.date)}</span>
                      </div>
                      <StarRatingDisplay value={r.rating} size={12} />
                      {r.comment && <p className="review-comment">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {currentUser?.userType === 'customer' && (
              <DetailsOrderBox material={selectedMaterial} isInCart={isInCart} onAdded={() => setSelectedMaterial(null)} />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFooter = () => {
    if (currentPage === 'splash') return null;
    return (
      <footer className="footer glass">
        <div className="footer-content">
          <div className="footer-section"><h3>E-SCON</h3><p>Ethio-Supply Chain Optimization Network</p><p>📍 Serving all Ethiopian cities</p><p>✅ Compliant with Ethiopian Trade Regulations</p></div>
          <div className="footer-section"><h3>Quick Links</h3><button onClick={() => navigateTo('home')}>Home</button><button onClick={() => navigateTo('search-materials')}>Find Products</button><button onClick={() => setShowSupplierMap(true)}>Supplier Map</button><button onClick={() => setShowInstallGuide(true)}>📲 Install App</button></div>
          <div className="footer-section"><h3>Cities</h3><div className="city-tags">{ETHIOPIAN_CITIES.slice(0,6).map(c => <span key={c}>{c}</span>)}</div></div>
          <div className="footer-section"><h3>Contact</h3><p>📧 meharinageb@gmail.com</p><p>📱 +251909919154</p></div>
        </div>
        <div className="copyright"><p>© 2026 E-SCON | Master's Program Project</p></div>
      </footer>
    );
  };

  // ---------- MOBILE UX (banking-app style; desktop untouched) ----------
  const mobilePageTitle = (): string => {
    const titles: Record<string, string> = {
      home: 'E-SCON',
      'search-materials': 'Find Products',
      'company-dashboard': 'Supplier Dashboard',
      'customer-dashboard': 'My Dashboard',
      orders: 'Orders',
      'add-material': 'New Product',
      'edit-material': 'Edit Product',
      login: 'Login',
      register: 'Create Account',
      settings: 'Platform Settings',
    };
    return titles[currentPage] || 'E-SCON';
  };

  const renderMobileTopBar = () => {
    if (currentPage === 'splash') return null;
    return (
      <header className="mobile-topbar">
        <div className="mobile-topbar-brand" onClick={() => navigateTo('home')}>
          <span className="mobile-topbar-logo">🏗️</span>
          <span className="mobile-topbar-title">{mobilePageTitle()}</span>
        </div>
        <div className="mobile-topbar-actions">
          <button className="mobile-icon-btn" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle theme">
            {darkMode ? '☀️' : '🌙'}
          </button>
          {currentUser && (
            <button className="mobile-icon-btn" onClick={() => setShowNotifications(true)} aria-label="Notifications">
              🔔
              {unreadNotifications() > 0 && <span className="mobile-badge">{unreadNotifications()}</span>}
            </button>
          )}
          {currentUser && (
            <button className="mobile-icon-btn" onClick={() => setShowWallet(true)} aria-label="Wallet" title="Wallet">
              💳
            </button>
          )}
          {currentUser && (
            <button className="mobile-avatar" onClick={() => setMobileMenuOpen(true)} aria-label="Account menu">
              {currentUser.name?.charAt(0).toUpperCase() || '?'}
            </button>
          )}
        </div>
      </header>
    );
  };

  const renderMobileBottomNav = () => {
    if (currentPage === 'splash') return null;
    const isCustomer = currentUser?.userType === 'customer';
    const isCompany = currentUser?.userType === 'company';

    const myOrders = currentUser
      ? orders.filter(o => {
          if (currentUser.userType === 'company') {
            const comp = getCompanyByUserId(currentUser.id);
            return comp && o.companyId === comp.id;
          }
          return o.customerId === currentUser.id;
        })
      : [];
    const activeOrders = myOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;

    const TabLink = ({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: string; label: string; badge?: number }) => (
      <button className={'m-tab' + (active ? ' active' : '')} onClick={onClick}>
        <span className="m-tab-icon">{icon}</span>
        <span className="m-tab-label">{label}</span>
        {badge ? <span className="m-tab-badge">{badge}</span> : null}
      </button>
    );

    return (
      <nav className="mobile-tabbar">
        {!currentUser ? (
          <>
            <TabLink active={currentPage === 'home'} onClick={() => navigateTo('home')} icon="🏠" label="Home" />
            <TabLink active={currentPage === 'search-materials'} onClick={() => navigateTo('search-materials')} icon="🔍" label="Search" />
            <button className="m-fab" onClick={() => navigateTo('login')} aria-label="Login">
              <span className="m-fab-icon">🔑</span>
              <span className="m-fab-label">Login</span>
            </button>
            <TabLink active={false} onClick={() => setShowSupplierMap(true)} icon="🗺️" label="Map" />
            <TabLink active={false} onClick={() => setShowInstallGuide(true)} icon="📲" label="Install" />
          </>
        ) : (
          <>
            <TabLink active={currentPage === 'home'} onClick={() => navigateTo('home')} icon="🏠" label="Home" />
            {isCustomer && <TabLink active={currentPage === 'search-materials'} onClick={() => navigateTo('search-materials')} icon="🔍" label="Search" />}
            {!isCustomer && <TabLink active={currentPage === (isCompany ? 'company-dashboard' : 'customer-dashboard')} onClick={() => navigateTo(isCompany ? 'company-dashboard' : 'customer-dashboard')} icon="📊" label="Board" />}
            {isCustomer ? (
              <button className="m-fab m-fab-cart" onClick={handleCheckout} aria-label="Open cart">
                <span className="m-fab-icon">🛒</span>
                <span className="m-fab-label">Cart</span>
                {cart.length > 0 && <span className="m-fab-badge">{cart.reduce((s, i) => s + i.quantity, 0)}</span>}
              </button>
            ) : (
              <button className="m-fab" onClick={() => navigateTo('add-material')} aria-label="Add product">
                <span className="m-fab-icon">➕</span>
                <span className="m-fab-label">Add</span>
              </button>
            )}
            <TabLink active={currentPage === 'orders'} onClick={() => navigateTo('orders')} icon="📦" label="Orders" badge={activeOrders} />
            <button className={'m-tab' + (mobileMenuOpen ? ' active' : '')} onClick={() => setMobileMenuOpen(true)}>
              <span className="m-tab-icon">👤</span>
              <span className="m-tab-label">More</span>
            </button>
          </>
        )}
      </nav>
    );
  };

  const renderMobileMoreSheet = () => {
    if (!mobileMenuOpen) return null;
    const isCompany = currentUser?.userType === 'company';
    const isAdmin = currentUser?.userType === 'admin';
    const favouriteMaterials = currentUser
      ? favorites.map(id => getMaterialById(id)).filter((m): m is Material => Boolean(m)).slice(0, 6)
      : [];

    const Action = ({ icon, label, sub, onClick }: { icon: string; label: string; sub?: string; onClick: () => void }) => (
      <button className="m-more-action" onClick={onClick}>
        <span className="m-more-icon">{icon}</span>
        <span className="m-more-text">{label}{sub && <small>{sub}</small>}</span>
        <span className="m-more-chevron">›</span>
      </button>
    );

    return (
      <div className="m-sheet-overlay" onClick={() => setMobileMenuOpen(false)}>
        <div className="m-sheet" onClick={e => e.stopPropagation()}>
          <div className="m-sheet-grabber" />
          {currentUser && (
            <div className="m-sheet-profile">
              <div className="m-sheet-avatar">{currentUser.name?.charAt(0).toUpperCase() || '?'}</div>
              <div className="m-sheet-user">
                <strong>{currentUser.name}</strong>
                <small>{currentUser.email}</small>
              </div>
              <button className="m-sheet-logout" onClick={() => { setMobileMenuOpen(false); handleLogout(); }}>Logout</button>
            </div>
          )}
          <div className="m-sheet-actions">
            <Action
              icon="📊"
              label="Dashboard"
              sub={isCompany ? 'Supplier' : isAdmin ? 'Admin' : 'Customer'}
              onClick={() => { setMobileMenuOpen(false); navigateTo(isCompany ? 'company-dashboard' : 'customer-dashboard'); }}
            />
            <Action icon="🗺️" label="Supplier Map" sub="Show suppliers with routes" onClick={() => { setMobileMenuOpen(false); setShowSupplierMap(true); }} />
            <Action icon="💳" label="E-SCON Wallet" sub={currentUser ? 'Balance ' + formatCurrency(walletBalance(currentUser.id)) : 'Top up & pay with wallet'} onClick={() => { setMobileMenuOpen(false); setShowWallet(true); }} />
            <Action icon="🔔" label="Notifications" sub={unreadNotifications() > 0 ? unreadNotifications() + ' unread' : 'All caught up'} onClick={() => { setMobileMenuOpen(false); setShowNotifications(true); }} />
            <Action
              icon="⚖️"
              label="Compare Products"
              sub={compareItems.length >= 2 ? compareItems.length + ' selected — tap to compare' : 'Pick 2–4 products to compare'}
              onClick={() => { setMobileMenuOpen(false); setShowCompare(true); }}
            />
            <Action icon="📲" label="Install App" sub="Work offline, home-screen icon" onClick={() => { setMobileMenuOpen(false); setShowInstallGuide(true); }} />
            <Action icon={darkMode ? '☀️' : '🌙'} label={darkMode ? 'Light Theme' : 'Dark Theme'} onClick={() => setDarkMode(!darkMode)} />
            {currentUser && currentUser.userType !== 'customer' && (
              <Action icon="📥" label="Export Orders" sub="Download your orders as CSV" onClick={() => { setMobileMenuOpen(false); handleExportOrders(); }} />
            )}
            {currentUser && (
              <Action icon="🛡️" label="Data Center" sub="JSON backup & restore" onClick={() => { setMobileMenuOpen(false); setShowDataCenter(true); }} />
            )}
            {isAdmin && <Action icon="⚙️" label="Platform Settings" sub="Delivery, VAT, accounts & catalogue" onClick={() => { setMobileMenuOpen(false); navigateTo('settings'); }} />}
          </div>
          {favouriteMaterials.length > 0 && (
            <div className="m-sheet-favs">
              <h4>❤️ Saved products</h4>
              <div className="m-sheet-fav-row">
                {favouriteMaterials.map(m => (
                  <button key={m.id} className="m-sheet-fav-chip" onClick={() => { setMobileMenuOpen(false); setSelectedMaterial(m); }}>
                    <span className="m-sheet-fav-emoji">{renderProductImage(m.images, m.category, 'xs')}</span>
                    <span className="m-sheet-fav-name">{m.name.split(' ').slice(0, 3).join(' ')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const MobileProductCard = ({ material, company, isInCart, isFav, distanceKm, onOpen, onToggleFav, variant }: {
    material: Material;
    company?: Company;
    isInCart: boolean;
    isFav: boolean;
    distanceKm?: number;
    onOpen: () => void;
    onToggleFav: () => void;
    variant: 'list' | 'carousel';
  }) => {
    const outOfStock = material.quantity <= 0;
    return (
      <div className={'m-product-card ' + variant}>
        <button className="m-pc-img" onClick={onOpen} aria-label={'View details of ' + material.name}>
          {renderProductImage(material.images, material.category, 'md')}
          <span className="m-pc-view-hint" aria-hidden="true">
            <span className="m-pc-view-icon">👁️</span>
            <span className="m-pc-view-text">View details</span>
          </span>
        </button>
        {!isFav && (
          <button className="m-pc-fav" onClick={onToggleFav} aria-label="Save for later">❤️</button>
        )}
        <div className="m-pc-body">
          <button className="m-pc-name" onClick={onOpen}>{material.name}</button>
          {material.brand && <div className="m-pc-brand">{material.brand}</div>}
          <div className="m-pc-supplier">{company?.name || 'Unknown'}{company?.city ? ' · ' + company.city : ''}</div>
          {distanceKm != null && <div className="m-pc-distance">🚗 {distanceKm.toFixed(1)} km</div>}
          <div className="m-pc-price-row">
            <div className="m-pc-price">{formatCurrency(material.price)}<span className="m-pc-unit"> / {material.unit}</span></div>
            {canSeeStock && (
              <span className={outOfStock ? 'm-pc-stock out' : 'm-pc-stock'}>{outOfStock ? 'Out' : 'In stock'}</span>
            )}
          </div>
          {currentUser?.userType === 'customer' && (
            <div className="m-pc-buy">
              {/* GPS and Order sit side by side below the Find button: one opens
                  the supplier's route on the map, the other opens the order
                  stepper. Tapping the card itself still opens product details. */}
              <button
                type="button"
                className="m-pc-map-btn"
                onClick={() => company && handleOpenMapWithRoute(company.id)}
                disabled={!company}
                aria-label={'Open GPS route to ' + (company?.name || 'supplier')}
              >🗺️ GPS</button>
              <button className={'m-pc-add-btn' + (isInCart ? ' ordered' : '')} onClick={onOpen}>
                {isInCart ? '🛒 Ordered — edit' : '🛒 Order'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHomeMobile = () => {
    const isCustomer = currentUser?.userType === 'customer';
    const isCompany = currentUser?.userType === 'company';
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const stats = calculateStats();
    const myOrders = currentUser
      ? orders.filter(o => {
          if (currentUser.userType === 'company') {
            const comp = getCompanyByUserId(currentUser.id);
            return comp && o.companyId === comp.id;
          }
          return o.customerId === currentUser.id;
        })
      : [];
    const activeOrders = myOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
    const trending = [...materials].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 8);
    const recentOrders = isCustomer ? myOrders.slice(0, 3) : [];
    const favouriteMaterials = currentUser ? favorites.map(id => getMaterialById(id)).filter((m): m is Material => Boolean(m)).slice(0, 8) : [];

    const Quick = ({ icon, label, sub, onClick, badge }: { icon: string; label: string; sub: string; onClick: () => void; badge?: number }) => (
      <button className="m-quick-item" onClick={onClick}>
        <span className="m-quick-icon">{icon}</span>
        <span className="m-quick-label">{label}</span>
        <span className="m-quick-sub">{sub}</span>
        {badge ? <span className="m-quick-badge">{badge}</span> : null}
      </button>
    );

    return (
      <main className="main-content mobile-home">
        <section className="m-hero">
          <div className="m-hero-top">
            <div>
              <div className="m-hero-greeting">{greeting}{currentUser ? ', ' + currentUser.name.split(' ')[0] : ' 👋'}</div>
              <div className="m-hero-role">
                {currentUser ? (isCompany ? 'Supplier' : isCustomer ? 'Customer' : 'Administrator') : "Explore Ethiopia's materials marketplace"}
              </div>
            </div>
            <span className="m-hero-flag">🇪🇹</span>
          </div>

          {currentUser ? (
            <div className="m-hero-stats">
              <div className="m-hero-stat">
                <span className="m-hero-stat-val">{activeOrders.length}</span>
                <span className="m-hero-stat-lbl">Active</span>
              </div>
              <div className="m-hero-stat">
                <span className="m-hero-stat-val">{stats.deliveredOrders}</span>
                <span className="m-hero-stat-lbl">Delivered</span>
              </div>
              <div className="m-hero-stat">
                <span className="m-hero-stat-val">{formatCurrency(stats.totalRevenue)}</span>
                <span className="m-hero-stat-lbl">{isCompany ? 'Revenue' : 'Spent'}</span>
              </div>
            </div>
          ) : (
            <div className="m-hero-cta">
              <button className="m-hero-btn primary" onClick={() => navigateTo('register')}>Create Account</button>
              <button className="m-hero-btn ghost" onClick={() => navigateTo('login')}>Login</button>
            </div>
          )}
        </section>

        {!currentUser && (
          <div className="m-quick-grid">
            <Quick icon="🔍" label="Browse" sub="Compare prices" onClick={() => navigateTo('search-materials')} />
            <Quick icon="🗺️" label="Supplier Map" sub="Nearby suppliers" onClick={() => setShowSupplierMap(true)} />
            <Quick icon="📲" label="Install App" sub="Offline access" onClick={() => setShowInstallGuide(true)} />
            <Quick icon="👤" label="Sign in" sub="Track orders" onClick={() => navigateTo('login')} />
          </div>
        )}

        {currentUser && isCustomer && (
          <div className="m-quick-grid">
            <Quick icon="🔍" label="Find" sub="Materials" onClick={() => navigateTo('search-materials')} />
            <Quick icon="📦" label="Orders" sub={myOrders.length + ' total'} onClick={() => navigateTo('orders')} />
            <Quick icon="🗺️" label="Map" sub="Suppliers" onClick={() => setShowSupplierMap(true)} />
          </div>
        )}
        {currentUser && isCompany && (
          <div className="m-quick-grid">
            <Quick icon="📦" label="Products" sub={materials.filter(m => m.companyId === getCompanyByUserId(currentUser.id)?.id).length + ' listed'} onClick={() => navigateTo('company-dashboard')} />
            <Quick icon="➕" label="Add Product" sub="List new item" onClick={() => navigateTo('add-material')} />
            <Quick icon="📦" label="Orders" sub={myOrders.length + ' total'} onClick={() => navigateTo('orders')} />
            <Quick icon="🗺️" label="Map" sub="Suppliers" onClick={() => setShowSupplierMap(true)} />
          </div>
        )}

        {favouriteMaterials.length > 0 && (
          <section className="m-section">
            <div className="m-section-head">
              <h3>❤️ Saved for later</h3>
              <button className="m-section-more" onClick={() => navigateTo('search-materials')}>See all</button>
            </div>
            <div className="m-saved-strip">
              {favouriteMaterials.map(m => (
                <button key={m.id} className="m-saved-chip" onClick={() => setSelectedMaterial(m)}>
                  {renderProductImage(m.images, m.category, 'xs')}
                  <span>{m.name.split(' ').slice(0, 3).join(' ')}</span>
                  <strong>{formatCurrency(m.price)}</strong>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="m-section">
          <div className="m-section-head">
            <h3 className="m-trending-title">🚀 Trending products</h3>
            <button className="m-section-more" onClick={() => navigateTo('search-materials')}>Browse all</button>
          </div>
          {trending.length === 0 ? (
            <div className="no-results glass"><p>No products listed yet.</p></div>
          ) : (
            <div className="m-carousel">
              {trending.map(m => {
                const company = getCompanyById(m.companyId);
                return (
                  <div key={m.id} className="m-carousel-item">
                    <MobileProductCard
                      material={m}
                      company={company}
                      isInCart={cart.some(c => c.materialId === m.id)}
                      isFav={favorites.includes(m.id)}
                      onOpen={() => setSelectedMaterial(m)}
                      onToggleFav={() => toggleFavorite(m.id)}
                      variant="carousel"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {recentOrders.length > 0 && (
          <section className="m-section">
            <div className="m-section-head">
              <h3>📦 Recent orders</h3>
              <button className="m-section-more" onClick={() => navigateTo('orders')}>All orders</button>
            </div>
            <div className="m-recent-orders">
              {recentOrders.map(order => {
                const m = getMaterialById(order.materialId);
                return (
                  <div key={order.id} className="m-recent-order">
                    <div className="m-recent-order-icon">{m ? renderProductImage(m.images, m.category, 'xs') : null}</div>
                    <div className="m-recent-order-info">
                      <strong>{m?.name || order.materialId}</strong>
                      <small>{order.quantity} {m?.unit || ''} · {formatCurrency(order.totalAmount)}</small>
                    </div>
                    <span className={'m-status-pill ' + order.status}>{order.status === 'delivered' ? '✅' : order.status === 'pending' ? '⏳' : '🚚'} {order.status}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {!isCustomer && !isCompany && currentUser && (
          <section className="m-section">
            <div className="m-section-head">
              <h3>⚙️ Administration</h3>
              <button className="m-section-more" onClick={() => navigateTo('settings')}>Settings</button>
            </div>
            <div className="m-quick-grid">
              <Quick icon="🔍" label="Search" sub="All materials" onClick={() => navigateTo('search-materials')} />
              <Quick icon="📦" label="Orders" sub="Platform orders" onClick={() => navigateTo('orders')} />
            </div>
          </section>
        )}
      </main>
    );
  };

  const renderOrdersMobile = () => {
    const isCompany = currentUser?.userType === 'company';
    const userOrders = isCompany ? orders.filter(o => {
      const comp = getCompanyByUserId(currentUser!.id);
      return comp && o.companyId === comp.id;
    }) : orders.filter(o => o.customerId === currentUser?.id);
    const totalValue = userOrders.reduce((s, o) => s + o.totalAmount, 0);

    return (
      <main className="main-content mobile-orders">
        <div className="mobile-page-head">
          <h2>{welcomeTitle(isCompany ? 'Order Management' : 'My Orders')}</h2>
          <p>{userOrders.length} orders · {formatCurrency(totalValue)}</p>
        </div>
        {userOrders.length === 0 ? (
          <div className="no-orders glass">No orders yet</div>
        ) : (
          <div className="m-order-list">
            {userOrders.map(order => {
              const m = getMaterialById(order.materialId);
              const customer = getUserById(order.customerId);
              return (
                <div key={order.id} className="m-order-card glass">
                  <div className="m-order-top">
                    <div className="m-order-prod">
                      {m ? renderProductImage(m.images, m.category, 'sm') : null}
                      <div>
                        <strong>{m?.name || order.materialId}</strong>
                        <small>Order {order.id}</small>
                      </div>
                    </div>
                    <span className={'m-status-pill ' + order.status}>
                      {order.status === 'delivered' ? '✅' : order.status === 'pending' ? '⏳' : '🚚'} {order.status}
                    </span>
                  </div>
                  <OrderTimeline status={order.status} size="sm" />
                  {isCompany && customer && (
                    <div className="m-order-customer">👤 {customer.name} · 📍 {customer.city}</div>
                  )}
                  <div className="m-order-meta">
                    <span>{order.quantity} {m?.unit || ''} × {formatCurrency(order.unitPrice)}</span>
                    <span>🚚 {formatCurrency(order.transportCost)}</span>
                    <strong>Total {formatCurrency(order.totalAmount)}</strong>
                    <small>{formatDate(order.orderDate)}</small>
                  </div>
                  <div className="m-order-pay">
                    <span className={'pay-pill pay-' + order.paymentStatus}>
                      {order.paymentStatus === 'paid' ? '💳 Paid' : order.paymentStatus === 'refunded' ? '↩️ Refunded' : '⏳ Payment pending'}
                    </span>
                    <span className="pay-method">{order.paymentMethod}</span>
                  </div>
                  <div className="m-order-actions">
                    {!isCompany && (
                      <button className="m-order-btn" onClick={() => handleQuickReorder(order.materialId)}>🔄 Reorder</button>
                    )}
                    {!isCompany && order.status === 'delivered' && m && (
                      <button className="m-order-btn primary" onClick={() => setSelectedMaterial(m)}>⭐ Rate product</button>
                    )}
                    {isCompany && order.status === 'pending' && (
                      <button className="m-order-btn primary" onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}>✅ Confirm</button>
                    )}
                    {isCompany && order.status === 'confirmed' && (
                      <button className="m-order-btn primary" onClick={() => handleUpdateOrderStatus(order.id, 'shipped')}>🚚 Ship</button>
                    )}
                    {isCompany && order.status === 'shipped' && (
                      <button className="m-order-btn primary" onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}>📦 Delivered</button>
                    )}
                    {isCompany && (order.status === 'pending' || order.status === 'confirmed') && (
                      <button className="m-order-btn danger" onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}>🚫 Cancel</button>
                    )}
                    {isCompany && <button className="m-order-btn" onClick={handleExportOrders}>📥 Export</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    );
  };

  const renderMobileDashboard = (isCompanyPage: boolean) => {
    const stats = calculateStats();
    if (isCompanyPage) {
      if (!currentUser || currentUser.userType !== 'company') {
        return (
          <main className="main-content">
            <div className="alert alert-danger">⚠️ Access denied.</div>
          </main>
        );
      }
      const company = getCompanyByUserId(currentUser.id);
      const companyMaterials = materials.filter(m => m.companyId === company?.id);
      const companyOrders = orders.filter(o => company && o.companyId === company.id);
      const mobileStock = {
        units: companyMaterials.reduce((sum, m) => sum + (m.quantity || 0), 0),
        value: companyMaterials.reduce((sum, m) => sum + (m.quantity || 0) * m.price, 0),
        low: companyMaterials.filter(m => m.quantity > 0 && m.quantity <= LOW_STOCK_THRESHOLD).length,
        out: companyMaterials.filter(m => (m.quantity || 0) <= 0).length,
      };
      return (
        <main className="main-content mobile-dashboard">
          <div className="mobile-page-head mobile-page-head-supplier">
            <h2 className="dashboard-supplier-name">{welcomeTitle(company?.name || 'Supplier Dashboard')}</h2>
            <p>Supplier Dashboard</p>
          </div>
          <div className="m-stat-grid">
            <div className="m-stat-tile"><span className="m-stat-icon">📦</span><strong>{companyMaterials.length}</strong><small>Products</small></div>
            <div className="m-stat-tile"><span className="m-stat-icon">📊</span><strong>{stats.totalOrders}</strong><small>Orders</small></div>
            <div className="m-stat-tile"><span className="m-stat-icon">⏳</span><strong>{stats.pendingOrders}</strong><small>Pending</small></div>
            <div className="m-stat-tile"><span className="m-stat-icon">💰</span><strong>{formatCurrency(stats.totalRevenue)}</strong><small>Revenue</small></div>
          </div>
          <div className="m-section">
            <div className="m-section-head"><h3>📥 My stock</h3></div>
            <div className="m-stock-grid">
              <div className="m-stock-tile"><strong>{mobileStock.units}</strong><small>Units in stock</small></div>
              <div className="m-stock-tile"><strong>{formatCurrency(mobileStock.value)}</strong><small>Stock value</small></div>
              <div className={'m-stock-tile' + (mobileStock.low > 0 ? ' warn' : '')}><strong>{mobileStock.low}</strong><small>Low stock</small></div>
              <div className={'m-stock-tile' + (mobileStock.out > 0 ? ' danger' : '')}><strong>{mobileStock.out}</strong><small>Out of stock</small></div>
            </div>
          </div>
          <div className="m-section">
            <div className="m-section-head">
              <h3>📦 Your products</h3>
              <button className="m-section-more" onClick={() => navigateTo('add-material')}>+ Add</button>
            </div>
            {companyMaterials.length === 0 ? (
              <div className="no-results glass"><p>No products yet — add your first one.</p></div>
            ) : (
              <div className="m-dash-list">
                {companyMaterials.map(m => (
                  <div key={m.id} className="m-dash-row">
                    {renderProductImage(m.images, m.category, 'sm')}
                    <div className="m-dash-row-info">
                      <strong>{m.name}</strong>
                      <small>{m.category} · {m.quantity} {m.unit} in stock · {formatCurrency((m.quantity || 0) * m.price)}</small>
                      {(m.quantity || 0) <= 0
                        ? <span className="stock-chip stock-chip-out">🚫 Out of stock</span>
                        : m.quantity <= LOW_STOCK_THRESHOLD
                          ? <span className="stock-chip stock-chip-low">⚠️ Low stock</span>
                          : <span className="stock-chip stock-chip-in">✅ In stock</span>}
                    </div>
                    <strong className="m-dash-row-price">{formatCurrency(m.price)}</strong>
                    <button className="btn-icon edit" onClick={() => handleEditMaterial(m)}>✏️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleEditCompany}>✏️ Edit Company Profile</button>
          <div className="m-section">
            <div className="m-section-head">
              <h3>📦 Recent orders</h3>
              <button className="m-section-more" onClick={() => navigateTo('orders')}>All</button>
            </div>
            {companyOrders.length === 0 ? (
              <div className="no-results glass"><p>No orders yet.</p></div>
            ) : (
              <div className="m-recent-orders">
                {companyOrders.slice(0, 4).map(order => {
                  const m = getMaterialById(order.materialId);
                  return (
                    <div key={order.id} className="m-recent-order">
                      {m ? renderProductImage(m.images, m.category, 'xs') : null}
                      <div className="m-recent-order-info">
                        <strong>{m?.name || order.materialId}</strong>
                        <small>{order.quantity} {m?.unit || ''} · {formatCurrency(order.totalAmount)}</small>
                      </div>
                      <span className={'m-status-pill ' + order.status}>{order.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      );
    }

    if (!currentUser || currentUser.userType !== 'customer') {
      return (
        <main className="main-content">
          <div className="alert alert-danger">⚠️ Access denied.</div>
        </main>
      );
    }
    const userOrders = orders.filter(o => o.customerId === currentUser.id);
    return (
      <main className="main-content mobile-dashboard">
        <div className="mobile-page-head">
          <h2>👤 {welcomeTitle('Customer Dashboard')}</h2>
          <p>📍 {currentUser.address || currentUser.city}</p>
        </div>
        <div className="m-stat-grid">
          <div className="m-stat-tile"><span className="m-stat-icon">📦</span><strong>{stats.totalOrders}</strong><small>Orders</small></div>
          <div className="m-stat-tile"><span className="m-stat-icon">⏳</span><strong>{stats.pendingOrders}</strong><small>Pending</small></div>
          <div className="m-stat-tile"><span className="m-stat-icon">✅</span><strong>{stats.deliveredOrders}</strong><small>Delivered</small></div>
          <div className="m-stat-tile"><span className="m-stat-icon">💰</span><strong>{formatCurrency(stats.totalRevenue)}</strong><small>Spent</small></div>
        </div>
        <div className="m-section">
          <div className="m-section-head">
            <h3>📍 My location</h3>
            <button className="m-section-more" onClick={() => setShowMyLocationPicker(true)}>Edit</button>
          </div>
          <div className="m-location-card">
            <strong>{currentUser.address || currentUser.city}</strong>
            <small>{Number.isFinite(currentUser.lat) && Number.isFinite(currentUser.lng) ? `Lat ${Number(currentUser.lat).toFixed(5)}, Lng ${Number(currentUser.lng).toFixed(5)}` : 'Location not set'} · distances start here</small>
          </div>
        </div>
        <div className="m-quick-grid">
          <div className="m-section-head" style={{ gridColumn: '1 / -1' }}>
            <h3>📋 Recent orders</h3>
            <button className="m-section-more" onClick={() => navigateTo('orders')}>All</button>
          </div>
        </div>
        {userOrders.length === 0 ? (
          <div className="no-results glass"><p>No orders yet — start shopping!</p></div>
        ) : (
          <div className="m-recent-orders">
            {userOrders.slice(0, 4).map(order => {
              const m = getMaterialById(order.materialId);
              return (
                <div key={order.id} className="m-recent-order">
                  {m ? renderProductImage(m.images, m.category, 'xs') : null}
                  <div className="m-recent-order-info">
                    <strong>{m?.name || order.materialId}</strong>
                    <small>{order.quantity} {m?.unit || ''} · {formatCurrency(order.totalAmount)}</small>
                  </div>
                  <span className={'m-status-pill ' + order.status}>{order.status}</span>
                </div>
              );
            })}
          </div>
        )}
        <button className="m-order-btn primary" style={{ width: '100%' }} onClick={() => navigateTo('search-materials')}>🔍 Find Products</button>
      </main>
    );
  };

  // ---------- Current page router ----------
  const renderCurrentPage = () => {
    if (showSplash) return renderSplash();
    if (showSupplierMap) return renderSupplierMap();
    if (showEditCompany) {
      const user = currentUser;
      // The profile record can be missing (older build dropped it, or a cloud
      // row arrived without it) - rebuild it here rather than silently falling
      // back to the previous page, which looked like "profile not found".
      const company = user ? (getCompanyByUserId(user.id) || companyFromUser(user)) : null;
      if (company && user) {
        return <EditCompany company={company} user={user} onSave={handleSaveCompany} onClose={() => setShowEditCompany(false)} />;
      }
    }
    if (adminCompanyTarget) {
      return (
        <EditCompany
          company={adminCompanyTarget.company}
          user={adminCompanyTarget.user}
          onSave={handleAdminSaveCompany}
          onClose={() => setAdminCompanyTarget(null)}
        />
      );
    }
    switch (currentPage) {
      case 'home': return renderHome();
      case 'login': return renderLogin();
      case 'register': return renderRegister();
      case 'company-dashboard': return renderCompanyDashboard();
      case 'customer-dashboard': return renderCustomerDashboard();
      case 'add-material': return renderAddMaterial();
      case 'edit-material': return renderEditMaterial();
      case 'search-materials': return renderSearchMaterials();
      case 'orders': return renderOrders();
      case 'settings': return (
        currentUser?.userType === 'admin' ? (
          <AdminSettings
            settings={systemSettings}
            onSave={handleSaveAdminSettings}
            users={users}
            companies={companies}
            materials={materials}
            onDeleteUser={handleAdminDeleteUser}
            onUpdateUser={handleAdminUpdateUser}
            onDeleteCompany={handleAdminDeleteCompany}
            onEditCompany={handleAdminEditCompany}
            onEditMaterial={handleAdminEditMaterial}
            onDeleteMaterial={handleDeleteMaterial}
          />
        ) : (
          <div className="main-content"><div className="admin-settings glass"><h2>⛔ Welcome — Access restricted</h2><p>Only platform administrators can change system settings.</p></div></div>
        )
      );
      default: return renderHome();
    }
  };

  // ---------- Main render ----------
  return (
    <div className={'app-container ' + (darkMode ? 'dark-mode' : '') + (isMobile ? ' mobile-view' : '')}>
      {isMobile ? renderMobileTopBar() : renderHeader()}
      {renderAlert()}

      {/* PWA Install Banner */}
      {showInstallBanner && deferredPrompt && (
        <div className="pwa-install-banner" role="alert">
          <div className="pwa-install-text">
            <span className="pwa-install-icon">📲</span>
            <div>
              <strong>Install E-SCON App</strong>
              <p>Add to your home screen for the best experience — works offline!</p>
            </div>
          </div>
          <div className="pwa-install-actions">
            <button className="btn btn-primary btn-sm" onClick={handleInstallPWA}>Install</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowInstallGuide(true)}>How to install</button>
            <button className="pwa-install-dismiss" onClick={dismissInstallBanner} title="Dismiss">✕</button>
          </div>
        </div>
      )}

      {/* Install guide modal — always reachable via ?install link behaviour */}
      {showInstallGuide && <InstallGuide onClose={() => setShowInstallGuide(false)} />}

      {/* Public proforma opened by scanning a QR code (#escon=...) */}
      {publicProformaData && (
        <PublicProforma
          data={publicProformaData}
          onClose={() => {
            setPublicProformaData(null);
            if (window.location.hash) {
              // Fall back to the app home page without closing the tab
              window.location.hash = '#home';
            }
          }}
        />
      )}

      {showMyLocationPicker && currentUser && (
        <MapPicker
          initialLat={currentUser.lat}
          initialLng={currentUser.lng}
          initialAddress={currentUser.address}
          onLocationSelect={handleSaveMyLocation}
          onClose={() => setShowMyLocationPicker(false)}
        />
      )}

      <div className={'page-transition ' + (pageAnimating ? 'page-enter' : '')}>
      {renderCurrentPage()}
      {renderMaterialDetails()}
      {renderCartSummary()}
      {showProforma && proformaDetails && (
        <ProformaInvoice
          cart={proformaDetails.items}
          report={proformaDetails}
          currentUser={currentUser}
          suppliers={proformaDetails.suppliers
            .map(sup => getCompanyById(sup.supplierId) || null)
            .filter((s): s is Company => s !== null)}
          onClose={() => setShowProforma(false)}
          onBackToPurchase={handleBackToPurchase}
          autoPrint={proformaAutoPrint}
        />
      )}

      {/* Compare Bar */}
      {compareItems.length > 0 && (
        <div className="compare-bar glass">
          <div className="compare-bar-inner">
            <span>⚖️ Comparing {compareItems.length} items</span>
            <div className="compare-bar-items">
              {compareItems.map(id => {
                const m = getMaterialById(id);
                return m ? (
                  <span key={id} className="compare-chip">
                    {m.name}
                    <button onClick={() => toggleCompare(id)}>✕</button>
                  </span>
                ) : null;
              })}
            </div>
            <div className="compare-bar-actions">
              <button className="btn btn-primary btn-sm" onClick={() => setShowCompare(true)} disabled={compareItems.length < 2}>Compare Now</button>
              <button className="btn btn-secondary btn-sm" onClick={clearCompare}>Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompare && compareItems.length >= 2 && (
        <div className="modal-overlay" onClick={() => setShowCompare(false)}>
          <div className="modal-content compare-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>⚖️ Product Comparison</h2><button className="modal-close" onClick={() => setShowCompare(false)}>✕</button></div>
            <div className="modal-body">
              <div className="compare-grid">
                {compareItems.map(id => {
                  const m = getMaterialById(id);
                  if (!m) return null;
                  const company = getCompanyById(m.companyId);
                  return (
                    <div key={id} className="compare-col">
                      <div className="compare-col-header">
                        {renderProductImage(m.images, m.category, 'md')}
                        <h4>{m.name}</h4>
                        <p className="compare-supplier">{company?.name || 'N/A'}</p>
                      </div>
                      <div className="compare-row"><span>Category</span><span>{m.category}</span></div>
                      <div className="compare-row"><span>Price</span><span className="price-cell">{formatCurrency(m.price)}</span></div>
                      <div className="compare-row"><span>Unit</span><span>{m.unit}</span></div>
                      <div className="compare-row"><span>Min Order</span><span>{m.minOrder}</span></div>
                      {canSeeStock && (
                        <div className="compare-row"><span>Stock</span><span className={m.quantity > 0 ? 'in-stock' : 'out-stock'}>{m.quantity}</span></div>
                      )}
                      <div className="compare-row"><span>Rating</span><span>⭐ {ratingForMaterial(m)}</span></div>
                      <div className="compare-row"><span>Brand</span><span>{m.brand || '—'}</span></div>
                      <div className="compare-row"><span>Weight</span><span>{m.specifications?.weight || '—'}</span></div>
                      <div className="compare-row"><span>Origin</span><span>{m.specifications?.origin || 'Ethiopia'}</span></div>
                      {currentUser?.userType === 'customer' && (
                        <button className="btn btn-primary btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={() => {
                          setShowCompare(false);
                          setSelectedMaterial(m);
                        }}>View & Order</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
      {isMobile ? renderMobileBottomNav() : renderFooter()}
      {isMobile && renderMobileMoreSheet()}

      {/* ---------- Notifications drawer ---------- */}
      {showNotifications && currentUser && (
        <div className="modal-overlay" onClick={() => setShowNotifications(false)}>
          <div className={'notifications-panel' + (isMobile ? ' notifications-panel-mobile' : '')} onClick={e => e.stopPropagation()}>
            <div className="notifications-header">
              <h3>🔔 Notifications</h3>
              <div>
                <button className="btn-secondary btn-sm" onClick={markAllNotificationsRead}>Mark all read</button>
                <button className="modal-close" onClick={() => setShowNotifications(false)}>✕</button>
              </div>
            </div>
            <div className="notifications-body">
              {notifications.filter(n => n.userId === currentUser.id).length === 0 ? (
                <div className="notif-empty"><span>🔕</span><p>You're all caught up — no notifications yet.</p></div>
              ) : (
                notifications.filter(n => n.userId === currentUser.id).map(n => (
                  <button key={n.id} className={'notif-item' + (n.read ? '' : ' unread')} onClick={() => markNotificationRead(n.id)}>
                    <span className="notif-icon">
                      {n.type === 'order' ? '📦' : n.type === 'payment' ? '💳' : n.type === 'stock' ? '⚠️' : n.type === 'rating' ? '⭐' : 'ℹ️'}
                    </span>
                    <span className="notif-content">
                      <span className="notif-title">{n.title}</span>
                      <span className="notif-msg">{n.message}</span>
                      <span className="notif-time">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="notif-dot" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Wallet modal ---------- */}
      {showWallet && currentUser && (
        <div className="modal-overlay" onClick={() => setShowWallet(false)}>
          <div className="modal-content wallet-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>💳 E-SCON Wallet</h2><button className="modal-close" onClick={() => setShowWallet(false)}>✕</button></div>
            <div className="modal-body">
              <div className="wallet-hero">
                <div className="wallet-balance">{formatCurrency(walletBalance(currentUser.id))}</div>
                <div className="wallet-balance-label">Available balance</div>
                <button className="btn btn-primary" onClick={() => setShowTopUp(true)}>➕ Top Up</button>
              </div>
              <div className="wallet-methods-note">
                💡 Wallet payments settle instantly. Suppliers are credited automatically on delivery (net of an 8% platform fee).
              </div>
              {showTopUp && (
                <div className="topup-panel">
                  <h4>Top up your wallet</h4>
                  <div className="topup-quick">
                    {[5000, 10000, 20000, 50000].map(amt => (
                      <button key={amt} className={'topup-quick-btn' + (topUpAmount === amt ? ' active' : '')} onClick={() => setTopUpAmount(amt)}>{formatCurrency(amt)}</button>
                    ))}
                  </div>
                  <input type="number" className="form-input" value={topUpAmount} min={100} onChange={(e) => setTopUpAmount(parseInt(e.target.value))} />
                  <div className="topup-methods">
                    {['Telebirr', 'Chappa', 'CBE Birr', 'Awash Bank'].map(m => (
                      <label key={m} className={'topup-method' + (topUpMethod === m ? ' active' : '')}>
                        <input type="radio" name="topupMethod" checked={topUpMethod === m} onChange={() => setTopUpMethod(m)} />
                        {m}
                      </label>
                    ))}
                  </div>
                  <button className="btn btn-primary btn-block" onClick={() => topUpWallet(topUpAmount, topUpMethod)}>
                    Confirm {formatCurrency(topUpAmount)} via {topUpMethod}
                  </button>
                </div>
              )}
              <div className="wallet-ledger">
                <h4>Recent activity</h4>
                {transactions.filter(t => t.userId === currentUser.id).length === 0 ? (
                  <p className="reviews-empty">No transactions yet. Top up or place an order to get started.</p>
                ) : (
                  <div className="ledger-list">
                    {transactions.filter(t => t.userId === currentUser.id).slice(0, 15).map(tx => (
                      <div key={tx.id} className="ledger-item">
                        <span className={'ledger-icon ledger-' + tx.kind}>
                          {tx.kind === 'topup' ? '➕' : tx.kind === 'payment' ? '➖' : tx.kind === 'income' ? '💰' : '↩️'}
                        </span>
                        <span className="ledger-info">
                          <strong>{tx.note}</strong>
                          <small>{timeAgo(tx.date)} · Balance {formatCurrency(tx.balanceAfter)}</small>
                        </span>
                        <span className={'ledger-amount ' + (tx.kind === 'topup' || tx.kind === 'income' || tx.kind === 'refund' ? 'positive' : 'negative')}>
                          {tx.kind === 'topup' || tx.kind === 'income' || tx.kind === 'refund' ? '+' : '−'}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Data Center (backup & restore) ---------- */}
      {showDataCenter && currentUser && (
        <div className="modal-overlay" onClick={() => setShowDataCenter(false)}>
          <div className="modal-content data-center-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>🛡️ Data Center</h2><button className="modal-close" onClick={() => setShowDataCenter(false)}>✕</button></div>
            <div className="modal-body">
              <div className="dc-card">
                <div className="dc-icon">📦</div>
                <h4>Export backup</h4>
                <p>Download all products, orders, wallet, notifications and settings as a portable JSON file.</p>
                <button className="btn btn-primary" onClick={handleBackupExport}>⬇️ Download JSON backup</button>
              </div>
              <div className="dc-card dc-danger">
                <div className="dc-icon">♻️</div>
                <h4>Restore backup</h4>
                <p>Load a previous backup file. This replaces the current app data on this device.</p>
                <label className="btn btn-secondary">
                  ⬆️ Choose backup file…
                  <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBackupRestore(file);
                  }} />
                </label>
              </div>
              <p className="dc-note">⚠️ Backups are stored locally in your browser. Export regularly to keep a safe copy.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;