import React, { useState, useEffect } from 'react';
import './App.css';
import { User, Company, Material, Order, Alert, FormData, SearchResult, CartItem, CartSummary } from './types';
import {
  ETHIOPIAN_CITIES, MEASUREMENT_UNITS, DEPARTMENTS,
  sampleUsers, sampleCompanies, sampleMaterials, sampleOrders
} from './constants';
import {
  safeLocalStorage, formatCurrency, formatDate,
  calculateDistance, calculateTransportCost, isUserLocked,
  calculateCartSummary, calculateItemTotals, generateId
} from './utils';

function App() {
  // Existing state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = safeLocalStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  const [materials, setMaterials] = useState<Material[]>(() => {
    const saved = safeLocalStorage.getItem('materials');
    return saved ? JSON.parse(saved) : [];
  });

  const [companies, setCompanies] = useState<Company[]>(() => {
    const saved = safeLocalStorage.getItem('companies');
    return saved ? JSON.parse(saved) : [];
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = safeLocalStorage.getItem('orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = safeLocalStorage.getItem('users');
    if (saved) {
      const parsedUsers = JSON.parse(saved);
      return parsedUsers.map((user: User) => ({
        ...user,
        loginAttempts: user.loginAttempts || 0,
        lockUntil: user.lockUntil || 0,
        vatRegistered: user.vatRegistered || false
      }));
    }
    return [];
  });
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = safeLocalStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [showCart, setShowCart] = useState<boolean>(false);
  const [cartSummary, setCartSummary] = useState<CartSummary>({ subtotal: 0, vatTotal: 0, transportTotal: 0, grandTotal: 0, itemCount: 0, uniqueSuppliers: 0 });
  
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    loginEmail: '',
    loginPassword: '',
    selectedUser: '',
    registerFullName: '',
    registerEmail: '',
    registerPassword: '',
    registerPhone: '',
    registerAddress: '',
    registerCity: 'Addis Ababa',
    registerCompanyName: '',
    registerUserType: 'customer',
    tinNumber: '',
    businessLicense: '',
    vatNumber: '',
    vatRegistered: false,
    materialName: '',
    materialCategory: '',
    materialPrice: '',
    materialQuantity: '',
    materialUnit: '',
    materialMinOrder: '',
    materialDescription: '',
    searchQuery: '',
    searchCategory: 'all',
    searchMaxPrice: '',
    searchSupplier: '',
    searchCity: 'all',
    searchSortBy: 'price_asc',
    orderQuantity: '',
    orderAddress: '',
    materialBrand: '',
    materialModel: '',
    materialWeight: '',
    materialDimensions: '',
    materialGrade: '',
    materialOrigin: 'Ethiopia',
    materialCertifications: '',
  });

  const [currentPage, setCurrentPage] = useState<string>('home');

  // Update cart summary whenever cart changes
  useEffect(() => {
    const summary = calculateCartSummary(cart);
    setCartSummary(summary);
    safeLocalStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Initialize with sample data
  useEffect(() => {
    const initializeData = () => {
      if (users.length === 0) {
        setUsers(sampleUsers);
        safeLocalStorage.setItem('users', JSON.stringify(sampleUsers));
      }
      if (companies.length === 0) {
        setCompanies(sampleCompanies);
        safeLocalStorage.setItem('companies', JSON.stringify(sampleCompanies));
      }
      if (materials.length === 0) {
        setMaterials(sampleMaterials);
        safeLocalStorage.setItem('materials', JSON.stringify(sampleMaterials));
      }
      if (orders.length === 0) {
        setOrders(sampleOrders);
        safeLocalStorage.setItem('orders', JSON.stringify(sampleOrders));
      }
    };
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistence effects
  useEffect(() => { safeLocalStorage.setItem('materials', JSON.stringify(materials)); }, [materials]);
  useEffect(() => { safeLocalStorage.setItem('companies', JSON.stringify(companies)); }, [companies]);
  useEffect(() => { safeLocalStorage.setItem('orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { safeLocalStorage.setItem('users', JSON.stringify(users)); }, [users]);

  const showAlert = (message: string, type = 'info', duration = 5000): void => {
    setAlert({ message, type });
    if (duration > 0) setTimeout(() => setAlert(null), duration);
  };

  const getMaterialById = (id: string): Material | undefined => materials.find(m => m.id === id);
  const getCompanyById = (id: string): Company | undefined => companies.find(c => c.id === id);
  const getCompanyByUserId = (userId: string): Company | undefined => companies.find(c => c.userId === userId);
  const getUserById = (id: string): User | undefined => users.find(u => u.id === id);

  // Cart Functions
  const addToCart = (material: Material, quantity: number) => {
    if (!currentUser) {
      showAlert('Please login to add items to cart', 'warning');
      setCurrentPage('login');
      return;
    }
    
    if (currentUser.userType !== 'customer') {
      showAlert('Only customers can add items to cart', 'warning');
      return;
    }
    
    if (quantity < material.minOrder) {
      showAlert(`Minimum order quantity is ${material.minOrder} ${material.unit}`, 'danger');
      return;
    }
    
    const company = getCompanyById(material.companyId);
    if (!company) return;
    
    const { subtotal, vatAmount, total } = calculateItemTotals(material.price, quantity, material.vatPercentage);
    
    const existingItem = cart.find(item => item.materialId === material.id);
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > material.quantity) {
        showAlert(`Only ${material.quantity} ${material.unit} available in stock`, 'danger');
        return;
      }
      const { subtotal: newSubtotal, vatAmount: newVat, total: newTotal } = calculateItemTotals(material.price, newQuantity, material.vatPercentage);
      setCart(cart.map(item => 
        item.materialId === material.id 
          ? { ...item, quantity: newQuantity, subtotal: newSubtotal, vatAmount: newVat, total: newTotal }
          : item
      ));
      showAlert(`Updated ${material.name} quantity in cart`, 'success');
    } else {
      if (quantity > material.quantity) {
        showAlert(`Only ${material.quantity} ${material.unit} available in stock`, 'danger');
        return;
      }
      const newItem: CartItem = {
        id: generateId('cart'),
        materialId: material.id,
        companyId: material.companyId,
        name: material.name,
        brand: material.brand,
        unit: material.unit,
        quantity: quantity,
        price: material.price,
        subtotal: subtotal,
        vatAmount: vatAmount,
        total: total,
        minOrder: material.minOrder,
        maxStock: material.quantity
      };
      setCart([...cart, newItem]);
      showAlert(`Added ${material.name} to cart! 🛒`, 'success');
    }
    
    setShowCart(true);
  };
  
  const updateCartQuantity = (cartId: string, newQuantity: number) => {
    const item = cart.find(i => i.id === cartId);
    if (!item) return;
    
    const material = getMaterialById(item.materialId);
    if (!material) return;
    
    if (newQuantity < material.minOrder) {
      showAlert(`Minimum quantity is ${material.minOrder} ${material.unit}`, 'warning');
      return;
    }
    
    if (newQuantity > material.quantity) {
      showAlert(`Only ${material.quantity} ${material.unit} available`, 'danger');
      return;
    }
    
    const { subtotal, vatAmount, total } = calculateItemTotals(material.price, newQuantity, material.vatPercentage);
    setCart(cart.map(i => i.id === cartId ? { ...i, quantity: newQuantity, subtotal, vatAmount, total } : i));
    showAlert('Cart updated', 'success');
  };
  
  const removeFromCart = (cartId: string) => {
    setCart(cart.filter(item => item.id !== cartId));
    showAlert('Item removed from cart', 'info');
  };
  
  const clearCart = () => {
    setCart([]);
    setShowCart(false);
    showAlert('Cart cleared', 'info');
  };
  
  const handleCheckout = () => {
    if (cart.length === 0) {
      showAlert('Your cart is empty', 'warning');
      return;
    }
    setShowCart(false);
    setCurrentPage('checkout');
  };

  const resetLoginAttempts = (userId: string): void => {
    setUsers(prev => prev.map(user => {
      if (user.id === userId && user.lockUntil && user.lockUntil <= Date.now()) {
        return { ...user, loginAttempts: 0, lockUntil: 0 };
      }
      return user;
    }));
  };

  const handleLogin = (e: React.FormEvent): void => {
    e.preventDefault();
    const { loginPassword, selectedUser } = formData;
    const user = users.find(u => u.email === selectedUser);
    if (!user) {
      showAlert('Please select a valid user', 'danger');
      return;
    }
    if (isUserLocked(user)) {
      const remainingTime = Math.ceil((user.lockUntil! - Date.now()) / 1000);
      showAlert(`Account locked. Try again in ${remainingTime} seconds`, 'danger');
      return;
    }
    if (user.password === loginPassword) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, loginAttempts: 0, lockUntil: 0 } : u));
      setCurrentUser(user);
      safeLocalStorage.setItem('currentUser', JSON.stringify(user));
      showAlert('Login successful! 🎉', 'success');
      setCurrentPage('home');
      setFormData(prev => ({ ...prev, loginPassword: '', selectedUser: '' }));
    } else {
      const newAttempts = (user.loginAttempts || 0) + 1;
      let lockUntil = 0;
      if (newAttempts >= 3) {
        lockUntil = Date.now() + 30000;
        showAlert('Too many failed attempts. Account locked for 30 seconds.', 'danger');
      } else {
        showAlert(`Incorrect password. ${3 - newAttempts} attempts remaining.`, 'danger');
      }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, loginAttempts: newAttempts, lockUntil } : u));
    }
  };

  const handleRegister = (e: React.FormEvent): void => {
    e.preventDefault();
    const { 
      registerFullName, registerEmail, registerPassword, registerPhone, 
      registerAddress, registerCity, registerCompanyName, registerUserType,
      tinNumber, businessLicense, vatNumber, vatRegistered
    } = formData;
    const existingUser = users.find(u => u.email === registerEmail);
    if (existingUser) {
      showAlert('User with this email already exists', 'danger');
      return;
    }
    const newUser: User = {
      id: 'user' + (users.length + 1),
      name: registerFullName,
      email: registerEmail,
      password: registerPassword,
      phone: registerPhone,
      address: registerAddress,
      city: registerCity,
      userType: registerUserType,
      companyName: registerUserType === 'company' ? registerCompanyName : '',
      lat: 9.0320 + (Math.random() * 0.05 - 0.025),
      lng: 38.7469 + (Math.random() * 0.05 - 0.025),
      registered: new Date().toISOString().split('T')[0],
      loginAttempts: 0,
      lockUntil: 0,
      tinNumber: registerUserType === 'company' ? tinNumber : '',
      businessLicense: registerUserType === 'company' ? businessLicense : '',
      vatRegistered: registerUserType === 'company' ? vatRegistered : false,
      vatNumber: registerUserType === 'company' ? vatNumber : ''
    };
    setUsers(prev => [...prev, newUser]);
    if (registerUserType === 'company') {
      const newCompany: Company = {
        id: 'comp' + (companies.length + 1),
        userId: newUser.id,
        name: registerCompanyName,
        description: '',
        location: registerAddress,
        city: registerCity,
        lat: newUser.lat || 9.0320,
        lng: newUser.lng || 38.7469,
        rating: 0,
        totalOrders: 0,
        established: new Date().getFullYear().toString(),
        tinNumber,
        businessLicense,
        vatNumber: vatRegistered ? vatNumber : '',
        tradeLicenseExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        complianceStatus: 'compliant'
      };
      setCompanies(prev => [...prev, newCompany]);
    }
    showAlert('Registration successful! Please login. ✅', 'success');
    setCurrentPage('login');
    setFormData(prev => ({
      ...prev,
      registerFullName: '',
      registerEmail: '',
      registerPassword: '',
      registerPhone: '',
      registerAddress: '',
      registerCity: 'Addis Ababa',
      registerCompanyName: '',
      tinNumber: '',
      businessLicense: '',
      vatNumber: '',
      vatRegistered: false
    }));
  };

  const handleLogout = (): void => {
    setCurrentUser(null);
    safeLocalStorage.removeItem('currentUser');
    setCart([]);
    safeLocalStorage.removeItem('cart');
    showAlert('Logged out successfully 👋', 'info');
    setCurrentPage('home');
  };

  const handleAddMaterial = (e: React.FormEvent): void => {
    e.preventDefault();
    const { 
      materialName, materialCategory, materialPrice, materialQuantity,
      materialUnit, materialMinOrder, materialDescription,
      materialBrand, materialModel, materialWeight, materialDimensions,
      materialGrade, materialOrigin, materialCertifications
    } = formData;
    if (!currentUser || currentUser.userType !== 'company') {
      showAlert('Only company users can add materials', 'danger');
      return;
    }
    const company = getCompanyByUserId(currentUser.id);
    if (!company) {
      showAlert('Company profile not found', 'danger');
      return;
    }
    const specifications = {
      weight: materialWeight || undefined,
      dimensions: materialDimensions || undefined,
      grade: materialGrade || undefined,
      origin: materialOrigin || undefined,
      certification: materialCertifications.split(',').map(c => c.trim()).filter(c => c)
    };
    const newMaterial: Material = {
      id: 'mat' + (materials.length + 1),
      companyId: company.id,
      name: materialName,
      category: materialCategory,
      price: parseFloat(materialPrice),
      quantity: parseInt(materialQuantity),
      unit: materialUnit,
      minOrder: parseInt(materialMinOrder),
      description: materialDescription,
      transportCost: 15,
      rating: 0,
      brand: materialBrand || undefined,
      model: materialModel || undefined,
      specifications,
      taxIncluded: true,
      vatPercentage: 15,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    setMaterials(prev => [...prev, newMaterial]);
    showAlert('Product added successfully! 🎉', 'success');
    setCurrentPage('company-dashboard');
    setFormData(prev => ({
      ...prev,
      materialName: '',
      materialCategory: '',
      materialPrice: '',
      materialQuantity: '',
      materialUnit: '',
      materialMinOrder: '',
      materialDescription: '',
      materialBrand: '',
      materialModel: '',
      materialWeight: '',
      materialDimensions: '',
      materialGrade: '',
      materialOrigin: 'Ethiopia',
      materialCertifications: ''
    }));
  };

  const handleDeleteMaterial = (id: string): void => {
    setMaterials(prev => prev.filter(m => m.id !== id));
    showAlert('Product deleted successfully 🗑️', 'success');
  };

  const handleUpdateOrderStatus = (orderId: string, status: string): void => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const updatedOrder = { ...order, status };
        if (status === 'delivered') {
          updatedOrder.deliveryDate = new Date().toISOString().split('T')[0];
          updatedOrder.paymentStatus = 'paid';
        }
        return updatedOrder;
      }
      return order;
    }));
    showAlert(`Order status updated to ${status} 🚀`, 'success');
  };

  const handleContactSupplier = (materialId: string): void => {
    const material = getMaterialById(materialId);
    if (!material) return;
    const company = getCompanyById(material.companyId);
    if (!company) return;
    const user = getUserById(company.userId);
    if (!user) return;
    showAlert(`📞 Contact ${company.name}: ${user.phone} | ✉️ ${user.email}`, 'info', 8000);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const { searchQuery, searchCategory, searchMaxPrice, searchCity, searchSortBy } = formData;
    
    let results: SearchResult[] = materials.filter(material => {
      let matches = true;
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        matches = matches && (
          material.name.toLowerCase().includes(searchLower) ||
          material.description.toLowerCase().includes(searchLower) ||
          material.brand?.toLowerCase().includes(searchLower) ||
          material.category.toLowerCase().includes(searchLower)
        );
      }
      if (searchCategory && searchCategory !== 'all') {
        matches = matches && material.category === searchCategory;
      }
      if (searchMaxPrice) {
        matches = matches && material.price <= parseFloat(searchMaxPrice);
      }
      if (searchCity && searchCity !== 'all') {
        const company = getCompanyById(material.companyId);
        matches = matches && company?.city === searchCity;
      }
      return matches;
    }).map(material => {
      const company = getCompanyById(material.companyId);
      let estimatedTransport = 0;
      let distance = 0;
      if (company && currentUser) {
        distance = calculateDistance(company.lat, company.lng, currentUser.lat || 9.0320, currentUser.lng || 38.7469);
        estimatedTransport = calculateTransportCost(company.lat, company.lng, currentUser.lat || 9.0320, currentUser.lng || 38.7469, material.minOrder);
      }
      const totalCost = material.price + (estimatedTransport / material.minOrder);
      return { ...material, company, totalCost, estimatedTransport, distance };
    });
    
    results.sort((a, b) => {
      switch (searchSortBy) {
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'rating_desc': return (b.rating || 0) - (a.rating || 0);
        case 'newest': return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default: return (a.totalCost || 0) - (b.totalCost || 0);
      }
    });
    
    setSearchResults(results);
    setCurrentPage('search-materials');
  };

  const navigateTo = (page: string): void => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const switchUserType = (type: string): void => {
    setFormData(prev => ({ ...prev, registerUserType: type }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDatalistInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, selectedUser: value }));
    const user = users.find(u => u.email === value);
    if (user && isUserLocked(user)) {
      const remainingTime = Math.ceil((user.lockUntil! - Date.now()) / 1000);
      showAlert(`Account locked. Try again in ${remainingTime} seconds.`, 'warning', 3000);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      users.forEach(user => {
        if (user.lockUntil && user.lockUntil <= Date.now()) {
          resetLoginAttempts(user.id);
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [users]);

  const calculateStats = () => {
    const userOrders = currentUser ? orders.filter(o => 
      currentUser.userType === 'company' 
        ? getCompanyByUserId(currentUser.id)?.id === o.companyId
        : o.customerId === currentUser.id
    ) : [];
    const totalRevenue = userOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const pendingOrders = userOrders.filter(o => o.status === 'pending').length;
    const deliveredOrders = userOrders.filter(o => o.status === 'delivered').length;
    return { totalRevenue, pendingOrders, deliveredOrders, totalOrders: userOrders.length };
  };

  // ======================= RENDER FUNCTIONS =======================
  
  const ScrollableTable = ({ children, minWidth = '800px' }: { children: React.ReactNode; minWidth?: string }) => (
    <div className="table-responsive-wrapper">
      <div className="table-scroll-container" style={{ minWidth }}>
        {children}
      </div>
    </div>
  );

  // Cart Modal Component
  const CartModal = () => {
    if (!showCart) return null;
    
    return (
      <div className="cart-modal-overlay" onClick={() => setShowCart(false)}>
        <div className="cart-modal-content" onClick={e => e.stopPropagation()}>
          <div className="cart-modal-header">
            <div className="cart-header-title">
              <span className="cart-icon">🛒</span>
              <h2>Shopping Cart</h2>
              <span className="cart-badge">{cartSummary.itemCount} items</span>
            </div>
            <button className="cart-modal-close" onClick={() => setShowCart(false)}>✕</button>
          </div>
          
          <div className="cart-modal-body">
            {cart.length === 0 ? (
              <div className="empty-cart">
                <div className="empty-cart-icon">🛒</div>
                <h3>Your cart is empty</h3>
                <p>Add items from the product catalog to get started</p>
                <button className="btn btn-primary" onClick={() => { setShowCart(false); navigateTo('search-materials'); }}>
                  Browse Products
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items-section">
                  <div className="cart-table-responsive">
                    <table className="cart-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Unit</th>
                          <th>Price</th>
                          <th>Quantity</th>
                          <th>Subtotal</th>
                          <th>VAT (15%)</th>
                          <th>Total</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map(item => (
                          <tr key={item.id}>
                            <td className="cart-product-cell">
                              <div className="cart-product-info">
                                <strong>{item.name}</strong>
                                {item.brand && <small>{item.brand}</small>}
                              </div>
                            </td>
                            <td>{item.unit}</td>
                            <td className="price-cell">{formatCurrency(item.price)}</td>
                            <td>
                              <div className="cart-quantity-control">
                                <button 
                                  className="quantity-btn"
                                  onClick={() => updateCartQuantity(item.id, Math.max(item.minOrder, item.quantity - item.minOrder))}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="quantity-input"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val)) updateCartQuantity(item.id, val);
                                  }}
                                  min={item.minOrder}
                                  max={item.maxStock}
                                />
                                <button 
                                  className="quantity-btn"
                                  onClick={() => updateCartQuantity(item.id, Math.min(item.maxStock, item.quantity + item.minOrder))}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="price-cell">{formatCurrency(item.subtotal)}</td>
                            <td className="price-cell">{formatCurrency(item.vatAmount)}</td>
                            <td className="price-cell total-cell">{formatCurrency(item.total)}</td>
                            <td>
                              <button 
                                className="remove-item-btn"
                                onClick={() => removeFromCart(item.id)}
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="cart-summary-section">
                  <div className="summary-header">
                    <h3>Order Summary</h3>
                    <span className="summary-subtitle">Like a Bank Statement</span>
                  </div>
                  
                  <div className="summary-details">
                    <div className="summary-row">
                      <span>Subtotal (excluding VAT)</span>
                      <span className="summary-amount">{formatCurrency(cartSummary.subtotal)}</span>
                    </div>
                    <div className="summary-row">
                      <span>VAT (15%)</span>
                      <span className="summary-amount">{formatCurrency(cartSummary.vatTotal)}</span>
                    </div>
                    <div className="summary-row">
                      <span>Estimated Transport*</span>
                      <span className="summary-amount">To be calculated</span>
                    </div>
                    <div className="summary-divider"></div>
                    <div className="summary-row total-row">
                      <span>Grand Total (excluding transport)</span>
                      <span className="summary-amount grand-total">{formatCurrency(cartSummary.grandTotal)}</span>
                    </div>
                    <div className="summary-note">
                      <small>*Transport cost will be calculated based on your delivery address and supplier locations</small>
                    </div>
                    <div className="summary-note">
                      <small>📋 {cartSummary.uniqueSuppliers} unique supplier(s) in your cart</small>
                    </div>
                  </div>
                  
                  <div className="cart-actions">
                    <button className="btn-secondary" onClick={clearCart}>Clear Cart</button>
                    <button className="btn-primary" onClick={handleCheckout}>Proceed to Checkout →</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Simplified render functions (keep from previous version)
  const renderHeader = () => (
    <header className="header">
      <div className="header-content">
        <div className="logo" onClick={() => navigateTo('home')}>
          <div className="logo-icon">🚚</div>
          <div className="logo-text">
            <h1>EthioSupply AI</h1>
            <p>Smart Logistics • Ethiopian Market</p>
          </div>
        </div>
        <div className="nav-links">
          {currentUser ? (
            <>
              <button className={`nav-link ${currentPage === 'home' ? 'active' : ''}`} onClick={() => navigateTo('home')}>🏠 Home</button>
              <button className={`nav-link ${currentPage === 'search-materials' ? 'active' : ''}`} onClick={() => navigateTo('search-materials')}>🔍 Search</button>
              {currentUser.userType === 'company' ? (
                <>
                  <button className={`nav-link ${currentPage === 'company-dashboard' ? 'active' : ''}`} onClick={() => navigateTo('company-dashboard')}>📊 Dashboard</button>
                  <button className={`nav-link ${currentPage === 'add-material' ? 'active' : ''}`} onClick={() => navigateTo('add-material')}>➕ Add Product</button>
                </>
              ) : (
                <button className={`nav-link ${currentPage === 'customer-dashboard' ? 'active' : ''}`} onClick={() => navigateTo('customer-dashboard')}>📊 Dashboard</button>
              )}
              <button className={`nav-link ${currentPage === 'orders' ? 'active' : ''}`} onClick={() => navigateTo('orders')}>🛒 Orders</button>
              <button className={`nav-link ${currentPage === 'supplier-map' ? 'active' : ''}`} onClick={() => navigateTo('supplier-map')}>🗺️ Map</button>
              <button className="cart-nav-btn" onClick={() => setShowCart(true)}>
                🛒
                {cartSummary.itemCount > 0 && <span className="cart-count">{cartSummary.itemCount}</span>}
              </button>
              <div className="user-info">
                <div className="user-avatar">{currentUser?.name?.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="user-name">{currentUser?.name?.split(' ')[0]}</div>
                  <div className="user-type">{currentUser?.userType === 'company' ? '🏢 Supplier' : '👤 Customer'}</div>
                </div>
                <button className="btn-logout" onClick={handleLogout}>🚪 Logout</button>
              </div>
            </>
          ) : (
            <>
              <button className={`nav-link ${currentPage === 'home' ? 'active' : ''}`} onClick={() => navigateTo('home')}>🏠 Home</button>
              <button className={`nav-link ${currentPage === 'search-materials' ? 'active' : ''}`} onClick={() => navigateTo('search-materials')}>🔍 Search</button>
              <button className={`nav-link ${currentPage === 'supplier-map' ? 'active' : ''}`} onClick={() => navigateTo('supplier-map')}>🗺️ Map</button>
              <button className={`nav-link ${currentPage === 'login' ? 'active' : ''}`} onClick={() => navigateTo('login')}>🔑 Login</button>
              <button className={`nav-link ${currentPage === 'register' ? 'active' : ''}`} onClick={() => navigateTo('register')}>📝 Register</button>
            </>
          )}
        </div>
      </div>
    </header>
  );

  const renderAlert = () => {
    if (!alert) return null;
    const icons: Record<string, string> = { success: '✅', danger: '⚠️', warning: '⚠️', info: 'ℹ️' };
    return <div className={`alert alert-${alert.type}`}><span className="alert-icon">{icons[alert.type] || 'ℹ️'}</span>{alert.message}</div>;
  };

  // Simplified Home render (keep main structure)
  const renderHome = () => {
    const stats = { totalMaterials: materials.length, totalCompanies: companies.length, totalOrders: orders.length, avgRating: (materials.reduce((s, m) => s + (m.rating || 0), 0) / materials.length).toFixed(1) || '4.5' };
    return (
      <main className="main-content">
        <section className="home-hero">
          <div className="hero-badge">🇪🇹 Ethiopian Supply Chain Platform</div>
          <h1>AI-Driven Supply Chain for Ethiopia</h1>
          <p>Connecting businesses across all departments and cities</p>
          <div className="search-center">
            <form onSubmit={(e) => { e.preventDefault(); navigateTo('search-materials'); }}>
              <div className="search-center-input">
                <input type="text" className="search-input" placeholder="Search for products, suppliers..." value={formData.searchQuery} onChange={(e) => setFormData(prev => ({ ...prev, searchQuery: e.target.value }))} />
                <button type="submit" className="search-center-btn">🔍 Search</button>
              </div>
            </form>
          </div>
          <div className="cta-buttons">
            {currentUser ? (
              <>
                {currentUser.userType === 'company' ? (
                  <button className="btn btn-primary" onClick={() => navigateTo('company-dashboard')}>📊 Dashboard</button>
                ) : (
                  <button className="btn btn-primary" onClick={() => navigateTo('search-materials')}>🔍 Find Products</button>
                )}
                <button className="btn btn-secondary" onClick={() => navigateTo('supplier-map')}>🗺️ Supplier Map</button>
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
          <div className="stat-card"><div className="stat-icon">📦</div><div className="stat-value">{stats.totalMaterials}+</div><div className="stat-label">Products</div></div>
          <div className="stat-card"><div className="stat-icon">🏢</div><div className="stat-value">{stats.totalCompanies}</div><div className="stat-label">Suppliers</div></div>
          <div className="stat-card"><div className="stat-icon">📊</div><div className="stat-value">{stats.totalOrders}</div><div className="stat-label">Orders</div></div>
          <div className="stat-card"><div className="stat-icon">⭐</div><div className="stat-value">{stats.avgRating}/5</div><div className="stat-label">Rating</div></div>
        </div>
        <h2 className="section-title">⭐ Popular Products</h2>
        <div className="materials-grid">
          {materials.slice(0, 4).map(m