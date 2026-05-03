import React, { useState, useEffect } from 'react';
import './App.css';
import { User, Company, Material, Order, Alert, FormData, SearchResult } from './types';
import {
  ETHIOPIAN_CITIES, MEASUREMENT_UNITS, DEPARTMENTS,
  sampleUsers, sampleCompanies, sampleMaterials, sampleOrders
} from './constants';
import {
  safeLocalStorage, formatCurrency, formatDate,
  calculateDistance, calculateTransportCost, isUserLocked
} from './utils';

function App() {
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
  useEffect(() => {
    safeLocalStorage.setItem('materials', JSON.stringify(materials));
  }, [materials]);
  useEffect(() => {
    safeLocalStorage.setItem('companies', JSON.stringify(companies));
  }, [companies]);
  useEffect(() => {
    safeLocalStorage.setItem('orders', JSON.stringify(orders));
  }, [orders]);
  useEffect(() => {
    safeLocalStorage.setItem('users', JSON.stringify(users));
  }, [users]);

  const showAlert = (message: string, type = 'info', duration = 5000): void => {
    setAlert({ message, type });
    if (duration > 0) setTimeout(() => setAlert(null), duration);
  };

  const getMaterialById = (id: string): Material | undefined => materials.find(m => m.id === id);
  const getCompanyById = (id: string): Company | undefined => companies.find(c => c.id === id);
  const getCompanyByUserId = (userId: string): Company | undefined => companies.find(c => c.userId === userId);
  const getUserById = (id: string): User | undefined => users.find(u => u.id === id);

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

  const handlePlaceOrder = (materialId: string): void => {
    if (!currentUser) {
      showAlert('Please login to place an order', 'danger');
      setCurrentPage('login');
      return;
    }
    if (currentUser.userType !== 'customer') {
      showAlert('Only customers can place orders', 'danger');
      return;
    }
    const { orderQuantity, orderAddress } = formData;
    const quantity = parseInt(orderQuantity);
    const material = getMaterialById(materialId);
    if (!material) {
      showAlert('Material not found', 'danger');
      return;
    }
    if (quantity < material.minOrder) {
      showAlert(`Minimum order quantity is ${material.minOrder}`, 'danger');
      return;
    }
    const company = getCompanyById(material.companyId);
    if (!company) {
      showAlert('Supplier not found', 'danger');
      return;
    }
    const transportCost = calculateTransportCost(
      company.lat, company.lng,
      currentUser.lat || 9.0320, currentUser.lng || 38.7469,
      quantity
    );
    const subtotal = material.price * quantity;
    const vatAmount = subtotal * (material.vatPercentage / 100);
    const totalAmount = subtotal + transportCost + vatAmount;
    const newOrder: Order = {
      id: 'order' + (orders.length + 1),
      customerId: currentUser.id,
      companyId: company.id,
      materialId: materialId,
      quantity,
      unitPrice: material.price,
      transportCost,
      totalAmount,
      status: 'pending',
      orderDate: new Date().toISOString().split('T')[0],
      address: orderAddress || currentUser.address,
      notes: '',
      invoiceNumber: `INV-${new Date().getFullYear()}-${orders.length + 1000}`,
      taxAmount: 0,
      vatAmount,
      paymentMethod: 'Bank Transfer',
      paymentStatus: 'pending'
    };
    setOrders(prev => [...prev, newOrder]);
    showAlert('Order placed successfully! 📦', 'success');
    setCurrentPage('orders');
    setFormData(prev => ({ ...prev, orderQuantity: '', orderAddress: '' }));
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
          {currentUser ? renderUserNav() : renderGuestNav()}
        </div>
      </div>
    </header>
  );

  const renderGuestNav = () => (
    <>
      <button className={`nav-link ${currentPage === 'home' ? 'active' : ''}`} onClick={() => navigateTo('home')}>🏠 Home</button>
      <button className={`nav-link ${currentPage === 'search-materials' ? 'active' : ''}`} onClick={() => navigateTo('search-materials')}>🔍 Search</button>
      <button className={`nav-link ${currentPage === 'supplier-map' ? 'active' : ''}`} onClick={() => navigateTo('supplier-map')}>🗺️ Map</button>
      <button className={`nav-link ${currentPage === 'login' ? 'active' : ''}`} onClick={() => navigateTo('login')}>🔑 Login</button>
      <button className={`nav-link ${currentPage === 'register' ? 'active' : ''}`} onClick={() => navigateTo('register')}>📝 Register</button>
    </>
  );

  const renderUserNav = () => {
    const isCompany = currentUser?.userType === 'company';
    return (
      <>
        <button className={`nav-link ${currentPage === 'home' ? 'active' : ''}`} onClick={() => navigateTo('home')}>🏠 Home</button>
        <button className={`nav-link ${currentPage === 'search-materials' ? 'active' : ''}`} onClick={() => navigateTo('search-materials')}>🔍 Search</button>
        {isCompany ? (
          <>
            <button className={`nav-link ${currentPage === 'company-dashboard' ? 'active' : ''}`} onClick={() => navigateTo('company-dashboard')}>📊 Dashboard</button>
            <button className={`nav-link ${currentPage === 'add-material' ? 'active' : ''}`} onClick={() => navigateTo('add-material')}>➕ Add Product</button>
          </>
        ) : (
          <button className={`nav-link ${currentPage === 'customer-dashboard' ? 'active' : ''}`} onClick={() => navigateTo('customer-dashboard')}>📊 Dashboard</button>
        )}
        <button className={`nav-link ${currentPage === 'orders' ? 'active' : ''}`} onClick={() => navigateTo('orders')}>🛒 Orders</button>
        <button className={`nav-link ${currentPage === 'supplier-map' ? 'active' : ''}`} onClick={() => navigateTo('supplier-map')}>🗺️ Map</button>
        <div className="user-info">
          <div className="user-avatar">{currentUser?.name?.charAt(0).toUpperCase()}</div>
          <div>
            <div className="user-name">{currentUser?.name?.split(' ')[0]}</div>
            <div className="user-type">{currentUser?.userType === 'company' ? '🏢 Supplier' : '👤 Customer'}</div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>🚪 Logout</button>
        </div>
      </>
    );
  };

  const renderAlert = () => {
    if (!alert) return null;
    const icons: Record<string, string> = { success: '✅', danger: '⚠️', warning: '⚠️', info: 'ℹ️' };
    return <div className={`alert alert-${alert.type}`}><span className="alert-icon">{icons[alert.type] || 'ℹ️'}</span>{alert.message}</div>;
  };

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
        <h2 className="section-title">✨ Key Features</h2>
        <div className="features-grid">
          <div className="feature-card"><div className="feature-icon">🤖</div><h3>AI Price Forecasting</h3><p>Predict future prices using machine learning algorithms</p></div>
          <div className="feature-card"><div className="feature-icon">🗺️</div><h3>GIS Supplier Mapping</h3><p>Interactive map with transport cost calculations</p></div>
          <div className="feature-card"><div className="feature-icon">🚚</div><h3>Logistics Optimization</h3><p>Smart routing and cost minimization</p></div>
          <div className="feature-card"><div className="feature-icon">📋</div><h3>Business Compliance</h3><p>Full TIN and VAT registration support</p></div>
        </div>
        <h2 className="section-title">🏭 Departments Served</h2>
        <div className="departments-grid">
          {DEPARTMENTS.slice(0, 8).map((dept, idx) => (
            <div className="department-badge" key={idx}>{dept === 'Agriculture' ? '🌾' : dept === 'Construction' ? '🏗️' : dept === 'Healthcare' ? '🏥' : dept === 'Manufacturing' ? '🏭' : dept === 'Information Technology' ? '💻' : dept === 'Transportation' ? '🚛' : dept === 'Energy' ? '⚡' : dept === 'Education' ? '📚' : '📌'} {dept}</div>
          ))}
        </div>
        <h2 className="section-title">⭐ Popular Products</h2>
        <div className="materials-grid">
          {materials.slice(0, 4).map(material => {
            const company = getCompanyById(material.companyId);
            return (
              <div className="material-card" key={material.id} onClick={() => setSelectedMaterial(material)}>
                <div className="material-header"><h3 className="material-title">{material.name}</h3><span className="material-category">{material.category}</span></div>
                <div className="material-body">
                  <p className="material-description">{material.description.substring(0, 80)}...</p>
                  <div className="material-price">{formatCurrency(material.price)} <span className="price-unit">/{material.unit}</span></div>
                  <div className="material-footer"><span className="supplier-name">🏢 {company?.name}</span><span className="material-rating">⭐ {material.rating || '4.5'}</span></div>
                </div>
              </div>
            );
          })}
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
          <div className="auth-card">
            <div className="auth-header"><span className="auth-icon">🔑</span><h2>Welcome Back</h2><p>Login to your account</p></div>
            <div className="auth-body">
              <form onSubmit={handleLogin}>
                <div className="form-group"><label className="form-label">📧 Select or Enter Email</label>
                  <input list="userList" className="form-input" name="selectedUser" value={formData.selectedUser} onChange={handleDatalistInputChange} required disabled={isLocked} />
                  <datalist id="userList">{users.map(user => <option key={user.id} value={user.email}>{user.name} - {user.email}</option>)}</datalist>
                </div>
                {formData.selectedUser && !isLocked && (
                  <>
                    <div className="form-group"><label className="form-label">🔒 Password</label><input type="password" className="form-input" name="loginPassword" value={formData.loginPassword} onChange={handleInputChange} required /></div>
                    <button type="submit" className="btn-submit">🔐 Login</button>
                  </>
                )}
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
        <div className="auth-card">
          <div className="auth-header"><span className="auth-icon">📝</span><h2>Create Account</h2><p>Join EthioSupply AI Platform</p></div>
          <div className="auth-body">
            <div className="auth-tabs">
              <button className={`auth-tab ${formData.registerUserType === 'customer' ? 'active' : ''}`} onClick={() => switchUserType('customer')}>👤 Customer</button>
              <button className={`auth-tab ${formData.registerUserType === 'company' ? 'active' : ''}`} onClick={() => switchUserType('company')}>🏢 Supplier</button>
            </div>
            <form onSubmit={handleRegister}>
              {formData.registerUserType === 'company' && (
                <>
                  <div className="form-group"><label className="form-label">🏢 Company Name *</label><input type="text" className="form-input" name="registerCompanyName" value={formData.registerCompanyName} onChange={handleInputChange} required /></div>
                  <div className="form-row"><div className="form-group"><label className="form-label">📋 TIN Number *</label><input type="text" className="form-input" name="tinNumber" value={formData.tinNumber} onChange={handleInputChange} required /></div>
                  <div className="form-group"><label className="form-label">📄 Business License *</label><input type="text" className="form-input" name="businessLicense" value={formData.businessLicense} onChange={handleInputChange} required /></div></div>
                  <div className="form-group"><label className="checkbox-label"><input type="checkbox" name="vatRegistered" checked={formData.vatRegistered} onChange={handleInputChange} /> ✅ VAT Registered</label></div>
                  {formData.vatRegistered && <div className="form-group"><label className="form-label">💰 VAT Number</label><input type="text" className="form-input" name="vatNumber" value={formData.vatNumber} onChange={handleInputChange} /></div>}
                </>
              )}
              <div className="form-row"><div className="form-group"><label className="form-label">👤 Full Name *</label><input type="text" className="form-input" name="registerFullName" value={formData.registerFullName} onChange={handleInputChange} required /></div>
              <div className="form-group"><label className="form-label">📧 Email Address *</label><input type="email" className="form-input" name="registerEmail" value={formData.registerEmail} onChange={handleInputChange} required /></div></div>
              <div className="form-row"><div className="form-group"><label className="form-label">🔒 Password *</label><input type="password" className="form-input" name="registerPassword" value={formData.registerPassword} onChange={handleInputChange} required /></div>
              <div className="form-group"><label className="form-label">📞 Phone Number *</label><input type="tel" className="form-input" name="registerPhone" value={formData.registerPhone} onChange={handleInputChange} required /></div></div>
              <div className="form-group"><label className="form-label">📍 Address *</label><input type="text" className="form-input" name="registerAddress" value={formData.registerAddress} onChange={handleInputChange} required /></div>
              <div className="form-group"><label className="form-label">🏙️ City *</label><select className="form-select" name="registerCity" value={formData.registerCity} onChange={handleInputChange} required><option value="">Select City</option>{ETHIOPIAN_CITIES.map(city => <option key={city} value={city}>{city}</option>)}</select></div>
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
    if (!currentUser || currentUser.userType !== 'company') return <main className="main-content"><div className="alert alert-danger">⚠️ Access denied. Company users only.</div></main>;
    const company = getCompanyByUserId(currentUser.id);
    const companyMaterials = materials.filter(m => m.companyId === company?.id);
    const stats = calculateStats();
    return (
      <main className="main-content">
        <div className="dashboard-header"><div className="dashboard-title"><span className="title-icon">🏢</span><h1>Supplier Dashboard</h1></div><p>Welcome back, {company?.name}! 👋</p></div>
        <div className="dashboard-grid">
          <div className="dashboard-card"><div className="card-icon">📦</div><div className="stat-value">{companyMaterials.length}</div><div className="stat-label">Products</div></div>
          <div className="dashboard-card"><div className="card-icon">📊</div><div className="stat-value">{stats.totalOrders}</div><div className="stat-label">Orders</div></div>
          <div className="dashboard-card"><div className="card-icon">⏳</div><div className="stat-value">{stats.pendingOrders}</div><div className="stat-label">Pending</div></div>
          <div className="dashboard-card"><div className="card-icon">💰</div><div className="stat-value">{formatCurrency(stats.totalRevenue)}</div><div className="stat-label">Revenue</div></div>
        </div>
        <div className="card"><div className="card-header"><h3>📦 Your Products</h3><button className="btn btn-primary" onClick={() => navigateTo('add-material')}>➕ Add Product</button></div>
        <ScrollableTable minWidth="700px"><table className="data-table"><thead><tr><th className="sticky-col">Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>{companyMaterials.map(material => (<tr key={material.id}><td className="sticky-col"><strong>{material.name}</strong>{material.brand && <small>{material.brand}</small>}</td><td>{material.category}</td><td className="price-cell">{formatCurrency(material.price)}</td><td>{material.quantity} {material.unit}</td><td><button className="btn-icon" onClick={() => setSelectedMaterial(material)}>👁️</button><button className="btn-icon danger" onClick={() => handleDeleteMaterial(material.id)}>🗑️</button></td></tr>))}</tbody></table></ScrollableTable></div>
      </main>
    );
  };

  const renderCustomerDashboard = () => {
    if (!currentUser || currentUser.userType !== 'customer') return <main className="main-content"><div className="alert alert-danger">⚠️ Access denied. Customer users only.</div></main>;
    const userOrders = orders.filter(o => o.customerId === currentUser.id);
    const stats = calculateStats();
    return (
      <main className="main-content">
        <div className="dashboard-header"><div className="dashboard-title"><span className="title-icon">👤</span><h1>Customer Dashboard</h1></div><p>Welcome back, {currentUser.name}! 👋</p></div>
        <div className="dashboard-grid">
          <div className="dashboard-card"><div className="card-icon">📦</div><div className="stat-value">{stats.totalOrders}</div><div className="stat-label">Orders</div></div>
          <div className="dashboard-card"><div className="card-icon">⏳</div><div className="stat-value">{stats.pendingOrders}</div><div className="stat-label">Pending</div></div>
          <div className="dashboard-card"><div className="card-icon">✅</div><div className="stat-value">{stats.deliveredOrders}</div><div className="stat-label">Delivered</div></div>
          <div className="dashboard-card"><div className="card-icon">💰</div><div className="stat-value">{formatCurrency(stats.totalRevenue)}</div><div className="stat-label">Spent</div></div>
        </div>
        <div className="card"><div className="card-header"><h3>📋 Recent Orders</h3><button className="btn btn-primary" onClick={() => navigateTo('search-materials')}>🔍 Find Products</button></div>
        <ScrollableTable minWidth="700px"><table className="data-table"><thead><tr><th className="sticky-col">Order ID</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{userOrders.slice(0,5).map(order => { const material = getMaterialById(order.materialId); return (<tr key={order.id}><td className="sticky-col">{order.id}</td><td>{material?.name}</td><td className="price-cell">{formatCurrency(order.totalAmount)}</td><td>{order.status === 'delivered' ? '✅' : order.status === 'pending' ? '⏳' : '🚚'} {order.status}</td><td>{formatDate(order.orderDate)}</td></tr>); })}</tbody></table></ScrollableTable></div>
      </main>
    );
  };

  const renderAddMaterial = () => (
    <main className="main-content">
      <div className="form-container"><h2 className="form-title">➕ Add New Product</h2>
      <form onSubmit={handleAddMaterial}>
        <div className="form-group"><label className="form-label">📦 Product Name *</label><input type="text" className="form-input" name="materialName" value={formData.materialName} onChange={handleInputChange} required /></div>
        <div className="form-row"><div className="form-group"><label className="form-label">🏭 Category *</label><select className="form-select" name="materialCategory" value={formData.materialCategory} onChange={handleInputChange} required><option value="">Select</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        <div className="form-group"><label className="form-label">📏 Unit *</label><input type="text" className="form-input" name="materialUnit" value={formData.materialUnit} onChange={handleInputChange} required list="unitList" /><datalist id="unitList">{MEASUREMENT_UNITS.map(u => <option key={u} value={u} />)}</datalist></div></div>
        <div className="form-row"><div className="form-group"><label className="form-label">💰 Price (ETB) *</label><input type="number" className="form-input" name="materialPrice" value={formData.materialPrice} onChange={handleInputChange} required step="0.01" /></div>
        <div className="form-group"><label className="form-label">📊 Quantity *</label><input type="number" className="form-input" name="materialQuantity" value={formData.materialQuantity} onChange={handleInputChange} required /></div></div>
        <div className="form-row"><div className="form-group"><label className="form-label">📋 Min Order *</label><input type="number" className="form-input" name="materialMinOrder" value={formData.materialMinOrder} onChange={handleInputChange} required /></div>
        <div className="form-group"><label className="form-label">🏷️ Brand</label><input type="text" className="form-input" name="materialBrand" value={formData.materialBrand} onChange={handleInputChange} /></div></div>
        <div className="form-group"><label className="form-label">📝 Description *</label><textarea className="form-textarea" name="materialDescription" value={formData.materialDescription} onChange={handleInputChange} required rows={4} /></div>
        <div className="form-actions"><button type="submit" className="btn-submit">✅ Add Product</button><button type="button" className="btn-secondary" onClick={() => navigateTo('company-dashboard')}>❌ Cancel</button></div>
      </form></div>
    </main>
  );

  const renderSearchMaterials = () => {
    const displayMaterials = searchResults.length > 0 ? searchResults : materials;
    return (
      <main className="main-content">
        <div className="search-hero"><h1>🔍 Find Products Across Ethiopia</h1><p>Search and compare products from verified suppliers</p>
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-group"><input type="text" className="search-input-large" placeholder="Search products, brands, or categories..." name="searchQuery" value={formData.searchQuery} onChange={handleInputChange} /><button type="submit" className="search-btn">🔍 Search</button></div>
          <div className="search-filters"><select className="filter-select" name="searchCategory" value={formData.searchCategory} onChange={handleInputChange}><option value="all">All Departments</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <select className="filter-select" name="searchCity" value={formData.searchCity} onChange={handleInputChange}><option value="all">All Cities</option>{ETHIOPIAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <input type="number" className="filter-input" placeholder="Max Price" name="searchMaxPrice" value={formData.searchMaxPrice} onChange={handleInputChange} />
          <select className="filter-select" name="searchSortBy" value={formData.searchSortBy} onChange={handleInputChange}><option value="price_asc">Price: Low to High</option><option value="price_desc">Price: High to Low</option><option value="rating_desc">Highest Rated</option></select>
          <button type="button" className="filter-clear" onClick={() => { setSearchResults([]); setFormData(prev => ({ ...prev, searchQuery: '', searchMaxPrice: '', searchCategory: 'all', searchCity: 'all' })); }}>Clear</button></div>
        </form></div>
        <div className="search-results"><div className="results-header"><h2>{searchResults.length > 0 ? `📊 Results (${displayMaterials.length})` : '📦 Available Products'}</h2></div>
        {displayMaterials.length === 0 ? (
          <div className="no-results"><span className="no-results-icon">🔍</span><h3>No products found</h3><button className="btn btn-primary" onClick={() => { setSearchResults([]); setFormData(prev => ({ ...prev, searchQuery: '', searchMaxPrice: '', searchCategory: 'all', searchCity: 'all' })); }}>Show All Products</button></div>
        ) : (
          <ScrollableTable minWidth="900px"><table className="data-table"><thead><tr><th className="sticky-col">Product</th><th>Category</th><th>Supplier</th><th>City</th><th>Price</th><th>Unit</th><th>Stock</th><th>Rating</th><th>Actions</th></tr></thead><tbody>{(displayMaterials as SearchResult[]).map(item => {
            const company = getCompanyById(item.companyId);
            return (<tr key={item.id} onClick={() => setSelectedMaterial(item)} style={{ cursor: 'pointer' }}><td className="sticky-col"><strong>{item.name}</strong>{item.brand && <small>{item.brand}</small>}</td><td>{item.category}</td><td>{company?.name || 'Unknown'}</td><td>{company?.city || 'N/A'}</td><td className="price-cell">{formatCurrency(item.price)}</td><td>{item.unit}</td><td className={item.quantity > 0 ? 'in-stock' : 'out-stock'}>{item.quantity > 0 ? `${item.quantity}` : 'Out'}</td><td>⭐ {item.rating || 'N/A'}</td><td><button className="btn-icon" onClick={(e) => { e.stopPropagation(); setSelectedMaterial(item); }}>👁️</button><button className="btn-icon contact" onClick={(e) => { e.stopPropagation(); handleContactSupplier(item.id); }}>📞</button></td></tr>);
          })}</tbody></table></ScrollableTable>
        )}</div>
      </main>
    );
  };

  const renderOrders = () => {
    const isCompany = currentUser?.userType === 'company';
    const userOrders = isCompany ? orders.filter(o => { const comp = getCompanyByUserId(currentUser!.id); return comp && o.companyId === comp.id; }) : orders.filter(o => o.customerId === currentUser?.id);
    const totalValue = userOrders.reduce((s, o) => s + o.totalAmount, 0);
    return (
      <main className="main-content">
        <div className="dashboard-header"><div className="dashboard-title"><span className="title-icon">🛒</span><h1>{isCompany ? 'Order Management' : 'My Orders'}</h1></div><div className="order-summary"><span>📊 Total: {userOrders.length} orders</span><span>💰 Value: {formatCurrency(totalValue)}</span></div></div>
        {userOrders.length === 0 ? (
          <div className="no-orders"><span className="no-orders-icon">📦</span><h3>No orders yet</h3>{!isCompany && <button className="btn btn-primary" onClick={() => navigateTo('search-materials')}>🔍 Browse Products</button>}</div>
        ) : (
          <ScrollableTable minWidth="800px"><table className="data-table"><thead><tr><th className="sticky-col">Order ID</th><th>Product</th><th>Quantity</th><th>Amount</th><th>Status</th><th>Date</th>{isCompany && <th>Actions</th>}</tr></thead><tbody>{userOrders.map(order => { const material = getMaterialById(order.materialId); return (<tr key={order.id}><td className="sticky-col">{order.id}</td><td>{material?.name}</td><td>{order.quantity}</td><td className="price-cell">{formatCurrency(order.totalAmount)}</td><td>{order.status === 'delivered' ? '✅' : order.status === 'pending' ? '⏳' : '🚚'} {order.status}</td><td>{formatDate(order.orderDate)}</td>{isCompany && order.status === 'pending' && <td><button className="btn-icon success" onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}>✅ Confirm</button></td>}</tr>); })}</tbody></table></ScrollableTable>
        )}
      </main>
    );
  };

  const renderSupplierMap = () => (
    <main className="main-content">
      <div className="dashboard-header"><div className="dashboard-title"><span className="title-icon">🗺️</span><h1>Supplier Map</h1></div><p>Find suppliers across all Ethiopian cities</p></div>
      <div className="map-container"><div className="map-placeholder"><span className="map-icon">🗺️</span><h3>GIS Supplier Location Map</h3><p>Interactive map showing supplier locations across Ethiopia</p><div className="city-list">{ETHIOPIAN_CITIES.slice(0,8).map(city => <span key={city} className="city-tag">📍 {city}</span>)}<span className="city-tag">➕ More cities available</span></div></div></div>
      <div className="card"><div className="card-header"><h3>🏢 Suppliers Directory</h3><span className="badge">{companies.length} Verified Suppliers</span></div>
      <ScrollableTable minWidth="700px"><table className="data-table"><thead><tr><th className="sticky-col">Company</th><th>City</th><th>Products</th><th>Rating</th><th>Contact</th></tr></thead><tbody>{companies.map(company => { const compMaterials = materials.filter(m => m.companyId === company.id); const supplier = getUserById(company.userId); return (<tr key={company.id}><td className="sticky-col"><strong>{company.name}</strong><small>{company.complianceStatus === 'compliant' ? '✅ Verified' : '⏳ Pending'}</small></td><td>📍 {company.city}</td><td>{compMaterials.length} items</td><td>⭐ {company.rating || '4.5'}</td><td>{supplier && <button className="btn-icon contact" onClick={() => showAlert(`📞 ${supplier.phone} | ✉️ ${supplier.email}`, 'info', 5000)}>📞</button>}</td></tr>); })}</tbody></table></ScrollableTable></div>
    </main>
  );

  const renderMaterialDetails = () => {
    if (!selectedMaterial) return null;
    const company = getCompanyById(selectedMaterial.companyId);
    return (
      <div className="modal-overlay" onClick={() => setSelectedMaterial(null)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header"><h2>{selectedMaterial.name}</h2><button className="modal-close" onClick={() => setSelectedMaterial(null)}>✕</button></div>
          <div className="modal-body">
            <div className="detail-section"><h3>📝 Description</h3><p>{selectedMaterial.description}</p></div>
            <div className="detail-section"><h3>💰 Pricing</h3><div className="price-detail"><span>Unit Price:</span><strong>{formatCurrency(selectedMaterial.price)}</strong><span>per {selectedMaterial.unit}</span></div><div className="price-detail"><span>Min Order:</span><span>{selectedMaterial.minOrder} {selectedMaterial.unit}</span></div><div className="price-detail"><span>In Stock:</span><span className={selectedMaterial.quantity > 0 ? 'in-stock' : 'out-stock'}>{selectedMaterial.quantity} {selectedMaterial.unit}</span></div></div>
            <div className="detail-section"><h3>🏢 Supplier</h3><p><strong>{company?.name}</strong></p><p>📍 {company?.city}</p><p>⭐ Rating: {company?.rating || '4.5'}/5</p></div>
            {currentUser?.userType === 'customer' && (
              <div className="order-section"><h3>📦 Place Order</h3><input type="number" className="form-input" placeholder={`Quantity (Min: ${selectedMaterial.minOrder})`} value={formData.orderQuantity} onChange={(e) => setFormData(prev => ({ ...prev, orderQuantity: e.target.value }))} /><input type="text" className="form-input" placeholder="Delivery Address" value={formData.orderAddress} onChange={(e) => setFormData(prev => ({ ...prev, orderAddress: e.target.value }))} /><button className="btn btn-primary" onClick={() => { handlePlaceOrder(selectedMaterial.id); setSelectedMaterial(null); }}>🛒 Place Order</button></div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFooter = () => (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section"><h3>🚚 EthioSupply AI</h3><p>AI-driven supply chain platform optimizing logistics across Ethiopia</p><p>📍 Serving all Ethiopian cities</p><p>✅ Compliant with Ethiopian Trade Regulations</p></div>
        <div className="footer-section"><h3>🔗 Quick Links</h3><button onClick={() => navigateTo('home')}>🏠 Home</button><button onClick={() => navigateTo('search-materials')}>🔍 Find Products</button><button onClick={() => navigateTo('supplier-map')}>🗺️ Supplier Map</button>{!currentUser && <button onClick={() => navigateTo('register')}>📝 Register</button>}</div>
        <div className="footer-section"><h3>🏙️ Major Cities</h3><div className="city-tags">{ETHIOPIAN_CITIES.slice(0,6).map(city => <span key={city}>📍 {city}</span>)}</div></div>
        <div className="footer-section"><h3>📞 Contact</h3><p>📧 meharinageb@gmail.com</p><p>📱 +251909919154</p><p>🏛️ Ethiopian Revenue & Customs</p></div>
      </div>
      <div className="copyright"><p>© 2024 EthioSupply AI | Master's Program Project | Compliant with Ethiopian Commercial Code</p></div>
    </footer>
  );

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home': return renderHome();
      case 'login': return renderLogin();
      case 'register': return renderRegister();
      case 'company-dashboard': return renderCompanyDashboard();
      case 'customer-dashboard': return renderCustomerDashboard();
      case 'add-material': return renderAddMaterial();
      case 'search-materials': return renderSearchMaterials();
      case 'orders': return renderOrders();
      case 'supplier-map': return renderSupplierMap();
      default: return renderHome();
    }
  };

  return (
    <div className="app-container">
      {renderHeader()}
      {renderAlert()}
      {renderCurrentPage()}
      {renderMaterialDetails()}
      {renderFooter()}
    </div>
  );
}

export default App;