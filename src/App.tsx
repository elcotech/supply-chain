import React, { useState, useEffect } from 'react';
import './App.css';
import { User, Company, Material, Order, Alert, FormData, SearchResult, CartItem } from './types';
import {
  ETHIOPIAN_CITIES, MEASUREMENT_UNITS, DEPARTMENTS,
  sampleUsers, sampleCompanies, sampleMaterials, sampleOrders
} from './constants';
import {
  safeLocalStorage, formatCurrency, formatDate,
  calculateDistance, calculateTransportCost, isUserLocked,
  exportToCSV, exportCartToCSV, exportOrdersToCSV
} from './utils';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartSummary, setShowCartSummary] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [cartDetails, setCartDetails] = useState<any>(null);
  
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

  const [currentPage, setCurrentPage] = useState<string>('splash');

  // Splash screen timeout
  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
        setCurrentPage('home');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  // Reset and initialize data on first load
  useEffect(() => {
    if (!isInitialized) {
      // Clear all existing data
      localStorage.clear();
      sessionStorage.clear();
      
      // Set new data
      setUsers(sampleUsers);
      setCompanies(sampleCompanies);
      setMaterials(sampleMaterials);
      setOrders(sampleOrders);
      
      // Save to localStorage
      safeLocalStorage.setItem('users', JSON.stringify(sampleUsers));
      safeLocalStorage.setItem('companies', JSON.stringify(sampleCompanies));
      safeLocalStorage.setItem('materials', JSON.stringify(sampleMaterials));
      safeLocalStorage.setItem('orders', JSON.stringify(sampleOrders));
      
      setIsInitialized(true);
    } else {
      // Load existing data after initialization
      const savedUsers = safeLocalStorage.getItem('users');
      const savedCompanies = safeLocalStorage.getItem('companies');
      const savedMaterials = safeLocalStorage.getItem('materials');
      const savedOrders = safeLocalStorage.getItem('orders');
      const savedCurrentUser = safeLocalStorage.getItem('currentUser');
      
      if (savedUsers) setUsers(JSON.parse(savedUsers));
      if (savedCompanies) setCompanies(JSON.parse(savedCompanies));
      if (savedMaterials) setMaterials(JSON.parse(savedMaterials));
      if (savedOrders) setOrders(JSON.parse(savedOrders));
      if (savedCurrentUser) setCurrentUser(JSON.parse(savedCurrentUser));
    }
  }, [isInitialized]);

  // Load cart from localStorage
  useEffect(() => {
    if (currentUser && isInitialized) {
      const savedCart = safeLocalStorage.getItem(`cart_${currentUser.id}`);
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    }
  }, [currentUser, isInitialized]);

  // Save cart to localStorage
  useEffect(() => {
    if (currentUser && isInitialized) {
      safeLocalStorage.setItem(`cart_${currentUser.id}`, JSON.stringify(cart));
    }
  }, [cart, currentUser, isInitialized]);

  // Persistence effects
  useEffect(() => {
    if (isInitialized && users.length > 0) {
      safeLocalStorage.setItem('users', JSON.stringify(users));
    }
  }, [users, isInitialized]);
  
  useEffect(() => {
    if (isInitialized && companies.length > 0) {
      safeLocalStorage.setItem('companies', JSON.stringify(companies));
    }
  }, [companies, isInitialized]);
  
  useEffect(() => {
    if (isInitialized && materials.length > 0) {
      safeLocalStorage.setItem('materials', JSON.stringify(materials));
    }
  }, [materials, isInitialized]);
  
  useEffect(() => {
    if (isInitialized) {
      safeLocalStorage.setItem('orders', JSON.stringify(orders));
    }
  }, [orders, isInitialized]);

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

  // Edit Material Functions
  const handleEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setFormData(prev => ({
      ...prev,
      materialName: material.name,
      materialCategory: material.category,
      materialPrice: material.price.toString(),
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
      materialCertifications: material.specifications?.certification?.join(', ') || ''
    }));
    setCurrentPage('edit-material');
  };

  const handleUpdateMaterial = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!editingMaterial) return;
    
    const updatedMaterial: Material = {
      ...editingMaterial,
      name: formData.materialName,
      category: formData.materialCategory,
      price: parseFloat(formData.materialPrice),
      quantity: parseInt(formData.materialQuantity),
      unit: formData.materialUnit,
      minOrder: parseInt(formData.materialMinOrder),
      description: formData.materialDescription,
      brand: formData.materialBrand || undefined,
      model: formData.materialModel || undefined,
      specifications: {
        ...editingMaterial.specifications,
        weight: formData.materialWeight || undefined,
        dimensions: formData.materialDimensions || undefined,
        grade: formData.materialGrade || undefined,
        origin: formData.materialOrigin || undefined,
        certification: formData.materialCertifications.split(',').map(c => c.trim()).filter(c => c)
      },
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    
    setMaterials(prev => prev.map(m => m.id === editingMaterial.id ? updatedMaterial : m));
    showAlert('Product updated successfully! ✏️', 'success');
    setEditingMaterial(null);
    setCurrentPage(currentUser?.userType === 'company' ? 'company-dashboard' : 'search-materials');
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

  // Export Functions
  const handleExportMaterials = () => {
    exportToCSV(materials, 'materials_export');
    showAlert('Materials exported successfully! 📊', 'success');
  };

  const handleExportCart = () => {
    if (cart.length === 0) {
      showAlert('Cart is empty. Nothing to export.', 'warning');
      return;
    }
    exportCartToCSV(cart);
    showAlert('Cart exported successfully! 🛒', 'success');
  };

  const handleExportOrders = () => {
    const userOrders = currentUser ? orders.filter(o => o.customerId === currentUser.id) : orders;
    if (userOrders.length === 0) {
      showAlert('No orders to export.', 'warning');
      return;
    }
    exportOrdersToCSV(userOrders, materials, companies);
    showAlert('Orders exported successfully! 📦', 'success');
  };

  // Cart Functions
  const addToCart = (material: Material, quantity: number) => {
    if (!currentUser) {
      showAlert('Please login to add items to cart', 'danger');
      setCurrentPage('login');
      return;
    }
    if (currentUser.userType !== 'customer') {
      showAlert('Only customers can add items to cart', 'danger');
      return;
    }

    if (quantity < material.minOrder) {
      showAlert(`Minimum order quantity is ${material.minOrder} ${material.unit}`, 'danger');
      return;
    }

    const materialCompany = getCompanyById(material.companyId);
    if (!materialCompany) return;

    if (cart.length > 0) {
      const currentSupplierId = cart[0].supplierId;
      if (currentSupplierId !== material.companyId) {
        if (window.confirm(`Your cart currently has items from ${cart[0].supplierName}. Do you want to clear your cart and add items from ${materialCompany.name}?`)) {
          clearCart();
          addToCartLogic(material, quantity, materialCompany);
        }
        return;
      }
    }

    addToCartLogic(material, quantity, materialCompany);
  };

  const addToCartLogic = (material: Material, quantity: number, company: Company) => {
    const existingItem = cart.find(item => item.materialId === material.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.materialId === material.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
      showAlert(`Updated ${material.name} quantity in cart`, 'success');
    } else {
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
        specifications: material.specifications
      };
      setCart([...cart, newCartItem]);
      showAlert(`Added ${material.name} to cart`, 'success');
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
    showAlert('Item removed from cart', 'info');
  };

  const updateCartQuantity = (itemId: string, newQuantity: number) => {
    const item = cart.find(i => i.id === itemId);
    if (item && newQuantity >= item.minOrder) {
      setCart(cart.map(i =>
        i.id === itemId ? { ...i, quantity: newQuantity } : i
      ));
    } else if (item && newQuantity < item.minOrder) {
      showAlert(`Minimum quantity is ${item.minOrder} ${item.unit}`, 'warning');
    }
  };

  const clearCart = () => {
    setCart([]);
    setShowCartSummary(false);
    showAlert('Cart cleared', 'info');
  };

  const calculateCartTotals = () => {
    if (cart.length === 0) return null;
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalVAT = cart.reduce((sum, item) => sum + ((item.price * item.quantity) * (item.vatPercentage / 100)), 0);
    
    const supplierCompany = getCompanyById(cart[0].supplierId);
    let transportCost = 0;
    let distance = 0;
    
    if (supplierCompany && currentUser) {
      distance = calculateDistance(
        supplierCompany.lat, supplierCompany.lng,
        currentUser.lat || 9.0320, currentUser.lng || 38.7469
      );
      const totalWeight = cart.reduce((sum, item) => {
        const weight = item.specifications?.weight ? parseFloat(item.specifications.weight) : 1;
        return sum + (weight * item.quantity);
      }, 0);
      transportCost = calculateTransportCost(
        supplierCompany.lat, supplierCompany.lng,
        currentUser.lat || 9.0320, currentUser.lng || 38.7469,
        totalWeight
      );
    }
    
    const total = subtotal + totalVAT + transportCost;
    
    return {
      subtotal,
      totalVAT,
      transportCost,
      total,
      distance,
      supplierName: supplierCompany?.name || 'Unknown Supplier',
      supplierCity: supplierCompany?.city || 'Unknown City',
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      uniqueItems: cart.length
    };
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      showAlert('Your cart is empty', 'warning');
      return;
    }
    
    const totals = calculateCartTotals();
    if (!totals) return;
    
    setCartDetails(totals);
    setShowCartSummary(true);
  };

  const confirmOrder = () => {
    if (cart.length === 0) return;
    
    const totals = calculateCartTotals();
    if (!totals) return;
    
    const supplierCompany = getCompanyById(cart[0].supplierId);
    if (!supplierCompany) return;
    
    cart.forEach(item => {
      const material = getMaterialById(item.materialId);
      if (!material) return;
      
      const newOrder: Order = {
        id: 'order' + (orders.length + 1) + '_' + Date.now() + '_' + item.materialId,
        customerId: currentUser!.id,
        companyId: supplierCompany.id,
        materialId: item.materialId,
        quantity: item.quantity,
        unitPrice: item.price,
        transportCost: totals.transportCost / cart.length,
        totalAmount: (item.price * item.quantity) + ((item.price * item.quantity) * (item.vatPercentage / 100)) + (totals.transportCost / cart.length),
        status: 'pending',
        orderDate: new Date().toISOString().split('T')[0],
        address: currentUser?.address || '',
        notes: `Order from cart - ${cart.length} items total`,
        invoiceNumber: `INV-${new Date().getFullYear()}-${orders.length + 1000}`,
        taxAmount: 0,
        vatAmount: (item.price * item.quantity) * (item.vatPercentage / 100),
        paymentMethod: 'Bank Transfer',
        paymentStatus: 'pending'
      };
      
      setOrders(prev => [...prev, newOrder]);
    });
    
    showAlert(`Order placed successfully! 📦 Total: ${formatCurrency(totals.total)}`, 'success');
    clearCart();
    setShowCartSummary(false);
    setCurrentPage('orders');
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
    setCart([]);
    setShowCartSummary(false);
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
      images: [],
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
    if (window.confirm('Are you sure you want to delete this product?')) {
      setMaterials(prev => prev.filter(m => m.id !== id));
      showAlert('Product deleted successfully 🗑️', 'success');
    }
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
  
  // Splash Screen
  const renderSplash = () => (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="splash-logo">🏗️</div>
        <h1 className="splash-title">E-SCON</h1>
        <p className="splash-subtitle">Ethio-Supply Chain Optimization Network</p>
        <div className="splash-loader">
          <div className="loader-bar"></div>
        </div>
        <p className="splash-loading">Loading platform...</p>
      </div>
    </div>
  );

  const ScrollableTable = ({ children, minWidth = '800px' }: { children: React.ReactNode; minWidth?: string }) => (
    <div className="table-responsive-wrapper">
      <div className="table-scroll-container" style={{ minWidth }}>
        {children}
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
            <div className="logo-text">
              <h1>E-SCON</h1>
              <p>Ethio-Supply Chain Optimization Network</p>
            </div>
          </div>
          <div className="nav-links">
            {currentUser ? renderUserNav() : renderGuestNav()}
            {currentUser && currentUser.userType === 'customer' && (
              <button className="cart-icon-btn" onClick={() => setShowCartSummary(true)}>
                🛒 {cart.length > 0 && <span className="cart-badge">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>}
              </button>
            )}
            {currentUser && (
              <button className="export-btn" onClick={() => {
                if (currentPage === 'search-materials') handleExportMaterials();
                else if (currentPage === 'orders') handleExportOrders();
                else if (showCartSummary) handleExportCart();
              }}>
                📥 Export
              </button>
            )}
          </div>
        </div>
      </header>
    );
  };

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

  const renderCartSummary = () => {
    if (!showCartSummary) return null;
    const totals = calculateCartTotals();
    if (!totals) return null;

    return (
      <div className="modal-overlay" onClick={() => setShowCartSummary(false)}>
        <div className="modal-content cart-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>🛒 Shopping Cart</h2>
            <button className="modal-close" onClick={() => setShowCartSummary(false)}>✕</button>
          </div>
          <div className="modal-body">
            {cart.length === 0 ? (
              <div className="empty-cart">
                <span className="empty-cart-icon">🛒</span>
                <h3>Your cart is empty</h3>
                <button className="btn btn-primary" onClick={() => { setShowCartSummary(false); navigateTo('search-materials'); }}>
                  Start Shopping
                </button>
              </div>
            ) : (
              <>
                <button className="btn-export-cart" onClick={handleExportCart}>📥 Export Cart to CSV</button>
                <div className="cart-supplier-info">
                  <h3>🏢 Supplier: {totals.supplierName}</h3>
                  <p>📍 Location: {totals.supplierCity}</p>
                  <p>📦 Items from this supplier only (same supplier policy)</p>
                </div>
                
                <div className="cart-items">
                  {cart.map(item => (
                    <div key={item.id} className="cart-item">
                      <div className="cart-item-info">
                        <h4>{item.materialName}</h4>
                        <p>Price: {formatCurrency(item.price)} / {item.unit}</p>
                        <p>Min Order: {item.minOrder} {item.unit}</p>
                      </div>
                      <div className="cart-item-quantity">
                        <label>Quantity:</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateCartQuantity(item.id, parseInt(e.target.value))}
                          min={item.minOrder}
                          step={item.minOrder}
                        />
                        <span>{item.unit}</span>
                      </div>
                      <div className="cart-item-total">
                        <strong>{formatCurrency(item.price * item.quantity)}</strong>
                      </div>
                      <button className="btn-icon danger" onClick={() => removeFromCart(item.id)}>🗑️</button>
                    </div>
                  ))}
                </div>
                
                <div className="cart-summary">
                  <h3>Order Summary</h3>
                  <div className="summary-row">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="summary-row">
                    <span>VAT (15%):</span>
                    <span>{formatCurrency(totals.totalVAT)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Transport Cost:</span>
                    <span>{formatCurrency(totals.transportCost)}</span>
                  </div>
                  <div className="summary-row distance-info">
                    <span>Distance: {totals.distance.toFixed(1)} km</span>
                  </div>
                  <div className="summary-row total">
                    <span>Total:</span>
                    <span>{formatCurrency(totals.total)}</span>
                  </div>
                </div>
                
                <div className="cart-actions">
                  <button className="btn-secondary" onClick={clearCart}>Clear Cart</button>
                  <button className="btn-primary" onClick={confirmOrder}>Confirm Order ✅</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHome = () => {
    const stats = { totalMaterials: materials.length, totalCompanies: companies.length, totalOrders: orders.length, avgRating: (materials.reduce((s, m) => s + (m.rating || 0), 0) / materials.length).toFixed(1) || '4.5' };
    return (
      <main className="main-content">
        <section className="home-hero">
          <div className="hero-badge">🇪🇹 Ethiopian Supply Chain Platform</div>
          <h1>E-SCON</h1>
          <p>Ethio-Supply Chain Optimization Network</p>
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
                  <datalist id="userList">
                    {users.map(user => <option key={user.id} value={user.email}>{user.name} - {user.email}</option>)}
                  </datalist>
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
        <div className="card"><div className="card-header"><h3>📦 Your Products</h3><button className="btn btn-primary" onClick={() => navigateTo('add-material')}>➕ Add Product</button><button className="btn btn-secondary" onClick={handleExportMaterials}>📥 Export Products</button></div>
        <ScrollableTable minWidth="900px">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sticky-col">Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Unit</th>
                <th>Stock</th>
                <th>Rating</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companyMaterials.map(material => (
                <tr key={material.id}>
                  <td className="sticky-col"><strong>{material.name}</strong>{material.brand && <small>{material.brand}</small>}</td>
                  <td>{material.category}</td>
                  <td className="price-cell">{formatCurrency(material.price)}</td>
                  <td>{material.unit}</td>
                  <td>{material.quantity} {material.unit}</td>
                  <td>⭐ {material.rating || 'N/A'}</td>
                  <td>
                    <button className="btn-icon" onClick={() => setSelectedMaterial(material)}>👁️</button>
                    <button className="btn-icon edit" onClick={() => handleEditMaterial(material)}>✏️</button>
                    <button className="btn-icon danger" onClick={() => handleDeleteMaterial(material.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
        </div>
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
        <div className="card"><div className="card-header"><h3>📋 Recent Orders</h3><button className="btn btn-primary" onClick={() => navigateTo('search-materials')}>🔍 Find Products</button><button className="btn btn-secondary" onClick={handleExportOrders}>📥 Export Orders</button></div>
        <ScrollableTable minWidth="800px">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sticky-col">Order ID</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {userOrders.slice(0,5).map(order => { 
                const material = getMaterialById(order.materialId); 
                return (
                  <tr key={order.id}>
                    <td className="sticky-col">{order.id}</td>
                    <td>{material?.name}</td>
                    <td>{order.quantity}</td>
                    <td className="price-cell">{formatCurrency(order.totalAmount)}</td>
                    <td>{order.status === 'delivered' ? '✅' : order.status === 'pending' ? '⏳' : '🚚'} {order.status}</td>
                    <td>{formatDate(order.orderDate)}</td>
                  </tr>
                ); 
              })}
            </tbody>
          </table>
        </ScrollableTable>
        </div>
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

  const renderEditMaterial = () => (
    <main className="main-content">
      <div className="form-container"><h2 className="form-title">✏️ Edit Product</h2>
      <form onSubmit={handleUpdateMaterial}>
        <div className="form-group"><label className="form-label">📦 Product Name *</label><input type="text" className="form-input" name="materialName" value={formData.materialName} onChange={handleInputChange} required /></div>
        <div className="form-row"><div className="form-group"><label className="form-label">🏭 Category *</label><select className="form-select" name="materialCategory" value={formData.materialCategory} onChange={handleInputChange} required><option value="">Select</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        <div className="form-group"><label className="form-label">📏 Unit *</label><input type="text" className="form-input" name="materialUnit" value={formData.materialUnit} onChange={handleInputChange} required list="unitList" /><datalist id="unitList">{MEASUREMENT_UNITS.map(u => <option key={u} value={u} />)}</datalist></div></div>
        <div className="form-row"><div className="form-group"><label className="form-label">💰 Price (ETB) *</label><input type="number" className="form-input" name="materialPrice" value={formData.materialPrice} onChange={handleInputChange} required step="0.01" /></div>
        <div className="form-group"><label className="form-label">📊 Quantity *</label><input type="number" className="form-input" name="materialQuantity" value={formData.materialQuantity} onChange={handleInputChange} required /></div></div>
        <div className="form-row"><div className="form-group"><label className="form-label">📋 Min Order *</label><input type="number" className="form-input" name="materialMinOrder" value={formData.materialMinOrder} onChange={handleInputChange} required /></div>
        <div className="form-group"><label className="form-label">🏷️ Brand</label><input type="text" className="form-input" name="materialBrand" value={formData.materialBrand} onChange={handleInputChange} /></div></div>
        <div className="form-group"><label className="form-label">📝 Description *</label><textarea className="form-textarea" name="materialDescription" value={formData.materialDescription} onChange={handleInputChange} required rows={4} /></div>
        <div className="form-actions"><button type="submit" className="btn-submit">✅ Update Product</button><button type="button" className="btn-secondary" onClick={() => navigateTo('company-dashboard')}>❌ Cancel</button></div>
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
        <div className="search-results"><div className="results-header"><h2>{searchResults.length > 0 ? `📊 Results (${displayMaterials.length})` : '📦 Available Products'}</h2><button className="btn btn-secondary" onClick={handleExportMaterials}>📥 Export Products</button></div>
        {displayMaterials.length === 0 ? (
          <div className="no-results"><span className="no-results-icon">🔍</span><h3>No products found</h3><button className="btn btn-primary" onClick={() => { setSearchResults([]); setFormData(prev => ({ ...prev, searchQuery: '', searchMaxPrice: '', searchCategory: 'all', searchCity: 'all' })); }}>Show All Products</button></div>
        ) : (
          <ScrollableTable minWidth="1200px">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sticky-col">Product</th>
                  <th>Category</th>
                  <th>Supplier</th>
                  <th>City</th>
                  <th>Price</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th>Rating</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(displayMaterials as SearchResult[]).map(item => {
                  const company = getCompanyById(item.companyId);
                  const isInCart = cart.some(cartItem => cartItem.materialId === item.id);
                  const currentSupplierInCart = cart.length > 0 ? cart[0].supplierId : null;
                  const canAddToCart = !currentSupplierInCart || currentSupplierInCart === item.companyId;
                  
                  return (
                    <tr key={item.id}>
                      <td className="sticky-col"><strong>{item.name}</strong>{item.brand && <small>{item.brand}</small>}</td>
                      <td>{item.category}</td>
                      <td>{company?.name || 'Unknown'}</td>
                      <td>{company?.city || 'N/A'}</td>
                      <td className="price-cell">{formatCurrency(item.price)}</td>
                      <td>{item.unit}</td>
                      <td className={item.quantity > 0 ? 'in-stock' : 'out-stock'}>{item.quantity > 0 ? `${item.quantity}` : 'Out'}</td>
                      <td>⭐ {item.rating || 'N/A'}</td>
                      <td>
                        <button className="btn-icon" onClick={() => setSelectedMaterial(item)}>👁️</button>
                        <button className="btn-icon contact" onClick={() => handleContactSupplier(item.id)}>📞</button>
                        {currentUser && currentUser.userType === 'customer' && (
                          isInCart ? (
                            <button className="btn-icon success" onClick={handleCheckout}>🛒</button>
                          ) : (
                            <button className="btn-icon add-to-cart" onClick={() => {
                              const quantity = prompt(`Enter quantity (Min: ${item.minOrder} ${item.unit}):`, item.minOrder.toString());
                              if (quantity && !isNaN(parseInt(quantity))) {
                                if (!canAddToCart && currentSupplierInCart) {
                                  if (window.confirm(`Your cart has items from another supplier. Clear cart and add this item?`)) {
                                    clearCart();
                                    addToCart(item, parseInt(quantity));
                                  }
                                } else {
                                  addToCart(item, parseInt(quantity));
                                }
                              }
                            }}>➕</button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollableTable>
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
        <div className="dashboard-header"><div className="dashboard-title"><span className="title-icon">🛒</span><h1>{isCompany ? 'Order Management' : 'My Orders'}</h1></div><div className="order-summary"><span>📊 Total: {userOrders.length} orders</span><span>💰 Value: {formatCurrency(totalValue)}</span><button className="btn btn-secondary" onClick={handleExportOrders}>📥 Export Orders</button></div></div>
        {userOrders.length === 0 ? (
          <div className="no-orders"><span className="no-orders-icon">📦</span><h3>No orders yet</h3>{!isCompany && <button className="btn btn-primary" onClick={() => navigateTo('search-materials')}>🔍 Browse Products</button>}</div>
        ) : (
          <ScrollableTable minWidth="900px">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sticky-col">Order ID</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Transport</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  {isCompany && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {userOrders.map(order => { 
                  const material = getMaterialById(order.materialId); 
                  return (
                    <tr key={order.id}>
                      <td className="sticky-col">{order.id}</td>
                      <td>{material?.name}</td>
                      <td>{order.quantity}</td>
                      <td className="price-cell">{formatCurrency(order.unitPrice)}</td>
                      <td className="price-cell">{formatCurrency(order.transportCost)}</td>
                      <td className="price-cell">{formatCurrency(order.totalAmount)}</td>
                      <td>{order.status === 'delivered' ? '✅' : order.status === 'pending' ? '⏳' : '🚚'} {order.status}</td>
                      <td>{formatDate(order.orderDate)}</td>
                      {isCompany && order.status === 'pending' && (
                        <td><button className="btn-icon success" onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}>✅ Confirm</button></td>
                      )}
                    </tr>
                  ); 
                })}
              </tbody>
            </table>
          </ScrollableTable>
        )}
      </main>
    );
  };

  const renderSupplierMap = () => (
    <main className="main-content">
      <div className="dashboard-header"><div className="dashboard-title"><span className="title-icon">🗺️</span><h1>Supplier Map</h1></div><p>Find suppliers across all Ethiopian cities</p></div>
      <div className="map-container"><div className="map-placeholder"><span className="map-icon">🗺️</span><h3>GIS Supplier Location Map</h3><p>Interactive map showing supplier locations across Ethiopia</p><div className="city-list">{ETHIOPIAN_CITIES.slice(0,8).map(city => <span key={city} className="city-tag">📍 {city}</span>)}<span className="city-tag">➕ More cities available</span></div></div></div>
      <div className="card"><div className="card-header"><h3>🏢 Suppliers Directory</h3><span className="badge">{companies.length} Verified Suppliers</span></div>
      <ScrollableTable minWidth="800px">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sticky-col">Company</th>
              <th>City</th>
              <th>Products</th>
              <th>Rating</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(company => { 
              const compMaterials = materials.filter(m => m.companyId === company.id); 
              const supplier = getUserById(company.userId); 
              return (
                <tr key={company.id}>
                  <td className="sticky-col"><strong>{company.name}</strong><small>{company.complianceStatus === 'compliant' ? '✅ Verified' : '⏳ Pending'}</small></td>
                  <td>📍 {company.city}</td>
                  <td>{compMaterials.length} items</td>
                  <td>⭐ {company.rating || '4.5'}</td>
                  <td>{supplier && <button className="btn-icon contact" onClick={() => showAlert(`📞 ${supplier.phone} | ✉️ ${supplier.email}`, 'info', 5000)}>📞</button>}</td>
                </tr>
              ); 
            })}
          </tbody>
        </table>
      </ScrollableTable>
      </div>
    </main>
  );

  const renderMaterialDetails = () => {
    if (!selectedMaterial) return null;
    const company = getCompanyById(selectedMaterial.companyId);
    const isInCart = cart.some(item => item.materialId === selectedMaterial.id);
    const currentSupplierInCart = cart.length > 0 ? cart[0].supplierId : null;
    const canAddToCart = !currentSupplierInCart || currentSupplierInCart === selectedMaterial.companyId;
    
    return (
      <div className="modal-overlay" onClick={() => setSelectedMaterial(null)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header"><h2>{selectedMaterial.name}</h2><button className="modal-close" onClick={() => setSelectedMaterial(null)}>✕</button></div>
          <div className="modal-body">
            <div className="detail-section"><h3>📝 Description</h3><p>{selectedMaterial.description}</p></div>
            <div className="detail-section"><h3>💰 Pricing</h3><div className="price-detail"><span>Unit Price:</span><strong>{formatCurrency(selectedMaterial.price)}</strong><span>per {selectedMaterial.unit}</span></div><div className="price-detail"><span>Min Order:</span><span>{selectedMaterial.minOrder} {selectedMaterial.unit}</span></div><div className="price-detail"><span>In Stock:</span><span className={selectedMaterial.quantity > 0 ? 'in-stock' : 'out-stock'}>{selectedMaterial.quantity} {selectedMaterial.unit}</span></div></div>
            <div className="detail-section"><h3>🏢 Supplier</h3><p><strong>{company?.name}</strong></p><p>📍 {company?.city}</p><p>⭐ Rating: {company?.rating || '4.5'}/5</p></div>
            {currentUser?.userType === 'customer' && (
              <div className="order-section">
                <h3>📦 Add to Cart</h3>
                {!canAddToCart && cart.length > 0 && (
                  <div className="alert alert-warning">
                    ⚠️ Your cart already has items from another supplier. Adding this will clear your cart.
                  </div>
                )}
                <input type="number" className="form-input" placeholder={`Quantity (Min: ${selectedMaterial.minOrder})`} id="cartQuantity" defaultValue={selectedMaterial.minOrder} />
                <button className="btn btn-primary" onClick={() => {
                  const quantityInput = document.getElementById('cartQuantity') as HTMLInputElement;
                  const quantity = parseInt(quantityInput.value);
                  if (!canAddToCart && currentSupplierInCart) {
                    if (window.confirm(`Your cart has items from another supplier. Clear cart and add ${selectedMaterial.name}?`)) {
                      clearCart();
                      addToCart(selectedMaterial, quantity);
                      setSelectedMaterial(null);
                    }
                  } else {
                    addToCart(selectedMaterial, quantity);
                    setSelectedMaterial(null);
                  }
                }}>
                  {isInCart ? '🔄 Update Cart' : '➕ Add to Cart'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFooter = () => {
    if (currentPage === 'splash') return null;
    return (
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section"><h3>🏗️ E-SCON</h3><p>Ethio-Supply Chain Optimization Network</p><p>AI-driven supply chain platform optimizing logistics across Ethiopia</p><p>📍 Serving all Ethiopian cities</p><p>✅ Compliant with Ethiopian Trade Regulations</p></div>
          <div className="footer-section"><h3>🔗 Quick Links</h3><button onClick={() => navigateTo('home')}>🏠 Home</button><button onClick={() => navigateTo('search-materials')}>🔍 Find Products</button><button onClick={() => navigateTo('supplier-map')}>🗺️ Supplier Map</button>{!currentUser && <button onClick={() => navigateTo('register')}>📝 Register</button>}</div>
          <div className="footer-section"><h3>🏙️ Major Cities</h3><div className="city-tags">{ETHIOPIAN_CITIES.slice(0,6).map(city => <span key={city}>📍 {city}</span>)}</div></div>
          <div className="footer-section"><h3>📞 Contact</h3><p>📧 meharinageb@gmail.com</p><p>📱 +251909919154</p><p>🏛️ Ethiopian Revenue & Customs</p></div>
        </div>
        <div className="copyright"><p>© 2024 E-SCON | Ethio-Supply Chain Optimization Network | Master's Program Project</p></div>
      </footer>
    );
  };

  const renderCurrentPage = () => {
    if (showSplash) return renderSplash();
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
      {renderCartSummary()}
      {renderFooter()}
    </div>
  );
}

export default App;