// Dedicated operational dashboard for verified transport companies.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Company,
  Material,
  Order,
  TransporterProfile,
  TransportDriver,
  TransportProof,
  TransportVehicle,
  User,
} from '../types';
import {
  TRANSPORT_STATUS_LABELS,
  activeTransporterJobs,
  availableTransportRequests,
  canAdvanceTransportJob,
  canClaimTransportJob,
  completedTransporterJobs,
  computeTransportFee,
  jobStatus,
  nextTransportStatus,
  normalizeServiceAreas,
  orderWeightTons,
  transportEarnings,
  transportJobFee,
  transporterJobs,
} from '../lib/transport';
import { formatCurrency, formatDate, genId } from '../utils';
import { StarRatingDisplay } from './Charts';

type Tab = 'overview' | 'requests' | 'dispatch' | 'vehicles' | 'drivers' | 'pricing' | 'earnings' | 'profile';

export interface TransporterDashboardProps {
  user: User;
  profile: TransporterProfile;
  orders: Order[];
  materials: Material[];
  companies: Company[];
  onSaveProfile: (profile: TransporterProfile, message?: string) => void;
  onClaimJob: (orderId: string) => void;
  onAdvanceJob: (orderId: string, proof?: TransportProof) => void;
  onAssignAsset: (orderId: string, vehicleId: string, driverId: string) => void;
  onOpenMap: (companyId: string) => void;
  onOpenOrders: () => void;
  onNotify: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Dashboard', icon: '📊' },
  { id: 'requests', label: 'Delivery requests', icon: '📥' },
  { id: 'dispatch', label: 'Dispatch', icon: '🚚' },
  { id: 'vehicles', label: 'Vehicles', icon: '🚛' },
  { id: 'drivers', label: 'Drivers', icon: '🪪' },
  { id: 'pricing', label: 'Transport pricing', icon: '💵' },
  { id: 'earnings', label: 'Earnings', icon: '💰' },
  { id: 'profile', label: 'Company & verification', icon: '🏢' },
];

const statusTone = (order: Order): string => {
  const status = jobStatus(order);
  if (status === 'delivered') return 'stock-chip stock-chip-in';
  if (status === 'requested') return 'stock-chip stock-chip-low';
  return 'stock-chip stock-chip-in';
};

const TransporterDashboard: React.FC<TransporterDashboardProps> = ({
  user,
  profile,
  orders,
  materials,
  companies,
  onSaveProfile,
  onClaimJob,
  onAdvanceJob,
  onAssignAsset,
  onOpenMap,
  onOpenOrders,
  onNotify,
}) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [profileDraft, setProfileDraft] = useState(profile);
  const [pricingDraft, setPricingDraft] = useState({
    startFee: String(profile.startFee),
    ratePerKm: String(profile.ratePerKm),
    ratePerTon: String(profile.ratePerTon),
  });
  const [vehicleDraft, setVehicleDraft] = useState<TransportVehicle>({
    id: '', plate: '', type: 'Flatbed truck', capacityTons: 10, makeModel: '', year: '', status: 'available',
  });
  const [driverDraft, setDriverDraft] = useState<TransportDriver>({
    id: '', name: '', phone: '', licenseNumber: '', licenseExpiry: '', status: 'available',
  });
  const [podDraft, setPodDraft] = useState<{ orderId: string; receivedBy: string; note: string }>({
    orderId: '', receivedBy: '', note: '',
  });
  const [quoteDraft, setQuoteDraft] = useState({ distanceKm: '12.4', weightTons: '2' });
  const [requestQuery, setRequestQuery] = useState('');
  const [requestArea, setRequestArea] = useState('all');
  const [requestSort, setRequestSort] = useState<'newest' | 'fee' | 'weight'>('newest');

  useEffect(() => {
    setProfileDraft(profile);
    setPricingDraft({
      startFee: String(profile.startFee),
      ratePerKm: String(profile.ratePerKm),
      ratePerTon: String(profile.ratePerTon),
    });
  }, [profile]);

  const requests = useMemo(() => availableTransportRequests(orders), [orders]);
  const jobs = useMemo(() => transporterJobs(orders, user.id), [orders, user.id]);
  const activeJobs = useMemo(() => activeTransporterJobs(orders, user.id), [orders, user.id]);
  const completedJobs = useMemo(() => completedTransporterJobs(orders, user.id), [orders, user.id]);
  const earnings = useMemo(() => transportEarnings(orders, user.id), [orders, user.id]);
  const inTransitValue = useMemo(
    () => activeJobs.reduce((sum, order) => sum + transportJobFee(order), 0),
    [activeJobs]
  );

  const materialById = useMemo(() => new Map(materials.map(m => [m.id, m])), [materials]);
  const companyById = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies]);

  const requestMatchesArea = useCallback((order: Order): boolean => {
    if (profile.serviceAreas.length === 0) return true;
    const supplier = companyById.get(order.companyId);
    const haystack = `${supplier?.city || ''} ${supplier?.location || ''} ${order.address || ''}`.toLowerCase();
    return profile.serviceAreas.some(area => haystack.includes(area.toLowerCase()));
  }, [companyById, profile.serviceAreas]);

  const visibleRequests = useMemo(() => {
    const query = requestQuery.trim().toLowerCase();
    const filtered = requests.filter(order => {
      if (requestArea === 'matched' && !requestMatchesArea(order)) return false;
      if (requestArea === 'outside' && requestMatchesArea(order)) return false;
      if (!query) return true;
      const material = materialById.get(order.materialId);
      const supplier = companyById.get(order.companyId);
      return `${order.invoiceNumber} ${order.address} ${material?.name || ''} ${supplier?.name || ''} ${supplier?.city || ''}`
        .toLowerCase()
        .includes(query);
    });
    return filtered.sort((a, b) => {
      if (requestSort === 'fee') return transportJobFee(b) - transportJobFee(a);
      if (requestSort === 'weight') {
        return orderWeightTons(materialById.get(b.materialId), b.quantity)
          - orderWeightTons(materialById.get(a.materialId), a.quantity);
      }
      return Date.parse(b.orderDate) - Date.parse(a.orderDate);
    });
  }, [companyById, materialById, requestArea, requestMatchesArea, requestQuery, requestSort, requests]);

  const matchedRequestCount = requests.filter(requestMatchesArea).length;
  const availableVehicles = profile.vehicles.filter(vehicle => vehicle.status === 'available').length;
  const availableDrivers = profile.drivers.filter(driver => driver.status === 'available').length;
  const profileCompleteness = Math.round([
    Boolean(profile.companyName),
    Boolean(profile.phone),
    Boolean(profile.email),
    Boolean(profile.tinNumber),
    Boolean(profile.licenseNumber),
    profile.serviceAreas.length > 0,
    profile.vehicles.length > 0,
    profile.drivers.length > 0,
  ].filter(Boolean).length / 8 * 100);
  const needsDispatch = activeJobs.filter(order =>
    jobStatus(order) === 'accepted' || jobStatus(order) === 'picked_up' || jobStatus(order) === 'in_transit'
  );

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    if (!profileDraft.companyName.trim()) {
      onNotify('Enter the transport company name.', 'danger');
      return;
    }
    onSaveProfile({
      ...profileDraft,
      companyName: profileDraft.companyName.trim(),
      serviceAreas: normalizeServiceAreas(profileDraft.serviceAreas),
    }, 'Transport company profile saved ✅');
  };

  const savePricing = (event: React.FormEvent) => {
    event.preventDefault();
    const startFee = Math.max(0, parseFloat(pricingDraft.startFee) || 0);
    const ratePerKm = Math.max(0, parseFloat(pricingDraft.ratePerKm) || 0);
    const ratePerTon = Math.max(0, parseFloat(pricingDraft.ratePerTon) || 0);
    onSaveProfile({ ...profile, startFee, ratePerKm, ratePerTon }, 'Transport pricing updated ✅');
  };

  const addVehicle = (event: React.FormEvent) => {
    event.preventDefault();
    if (!vehicleDraft.plate.trim()) {
      onNotify('Enter the vehicle plate number.', 'danger');
      return;
    }
    const vehicle: TransportVehicle = {
      ...vehicleDraft,
      id: genId('veh'),
      plate: vehicleDraft.plate.trim().toUpperCase(),
      capacityTons: Math.max(0, Number(vehicleDraft.capacityTons) || 0),
    };
    onSaveProfile({ ...profile, vehicles: [...profile.vehicles, vehicle] }, 'Vehicle registered ✅');
    setVehicleDraft({ id: '', plate: '', type: 'Flatbed truck', capacityTons: 10, makeModel: '', year: '', status: 'available' });
  };

  const addDriver = (event: React.FormEvent) => {
    event.preventDefault();
    if (!driverDraft.name.trim() || !driverDraft.licenseNumber.trim()) {
      onNotify('Enter the driver name and licence number.', 'danger');
      return;
    }
    const driver: TransportDriver = {
      ...driverDraft,
      id: genId('drv'),
      name: driverDraft.name.trim(),
      licenseNumber: driverDraft.licenseNumber.trim(),
    };
    onSaveProfile({ ...profile, drivers: [...profile.drivers, driver] }, 'Driver registered ✅');
    setDriverDraft({ id: '', name: '', phone: '', licenseNumber: '', licenseExpiry: '', status: 'available' });
  };

  const updateVehicleStatus = (vehicleId: string, status: TransportVehicle['status']) => {
    onSaveProfile({
      ...profile,
      vehicles: profile.vehicles.map(vehicle => vehicle.id === vehicleId ? { ...vehicle, status } : vehicle),
    }, 'Vehicle status updated');
  };

  const updateDriverStatus = (driverId: string, status: TransportDriver['status']) => {
    onSaveProfile({
      ...profile,
      drivers: profile.drivers.map(driver => driver.id === driverId ? { ...driver, status } : driver),
    }, 'Driver status updated');
  };

  const removeVehicle = (vehicleId: string) => {
    onSaveProfile({ ...profile, vehicles: profile.vehicles.filter(vehicle => vehicle.id !== vehicleId) }, 'Vehicle removed');
  };

  const removeDriver = (driverId: string) => {
    onSaveProfile({ ...profile, drivers: profile.drivers.filter(driver => driver.id !== driverId) }, 'Driver removed');
  };

  const submitPod = (order: Order) => {
    if (!podDraft.receivedBy.trim()) {
      onNotify('Enter who received the goods.', 'warning');
      return;
    }
    onAdvanceJob(order.id, {
      receivedBy: podDraft.receivedBy.trim(),
      note: podDraft.note.trim(),
      deliveredAt: new Date().toISOString(),
    });
    setPodDraft({ orderId: '', receivedBy: '', note: '' });
  };

  const previewFee = computeTransportFee(profile, parseFloat(quoteDraft.distanceKm) || 0, parseFloat(quoteDraft.weightTons) || 0);

  const renderOrderMeta = (order: Order) => {
    const material = materialById.get(order.materialId);
    const supplier = companyById.get(order.companyId);
    const weight = orderWeightTons(material, order.quantity);
    return (
      <div className="transport-order-meta">
        <div>
          <strong>{material?.name || order.materialId}</strong>
          <small>
            {order.quantity} {material?.unit || 'units'} · {weight.toLocaleString()} t ·
            {' '}{supplier?.name || 'Supplier'}{supplier?.city ? ' · ' + supplier.city : ''}
          </small>
        </div>
        <div className="transport-order-money">
          <strong>{formatCurrency(transportJobFee(order))}</strong>
          <small>Job fee</small>
        </div>
      </div>
    );
  };

  const renderRequestCard = (order: Order) => (
    <article className="transport-card glass" key={order.id}>
      <div className="transport-card-head">
        <div>
          <strong>Order {order.invoiceNumber}</strong>
          <small>{formatDate(order.orderDate)} · {order.address}</small>
        </div>
        <div className="transport-badges">
          <span className="stock-chip stock-chip-low">Open request</span>
          <span className={'transport-match ' + (requestMatchesArea(order) ? 'in' : 'out')}>
            {requestMatchesArea(order) ? '✓ In your service area' : 'Outside service area'}
          </span>
        </div>
      </div>
      {renderOrderMeta(order)}
      <div className="transport-card-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenMap(order.companyId)}>
          🗺️ Route
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onClaimJob(order.id)}
          disabled={!canClaimTransportJob(order, user.id)}
        >
          ✅ Accept delivery
        </button>
      </div>
    </article>
  );

  const renderDispatchCard = (order: Order) => {
    const status = jobStatus(order);
    const next = nextTransportStatus(status);
    const vehicleId = order.assignedVehicleId || '';
    const driverId = order.assignedDriverId || '';
    const material = materialById.get(order.materialId);
    const cargoWeight = orderWeightTons(material, order.quantity);
    const selectedVehicle = profile.vehicles.find(vehicle => vehicle.id === vehicleId);
    const capacityWarning = Boolean(selectedVehicle && selectedVehicle.capacityTons > 0
      && cargoWeight > selectedVehicle.capacityTons);
    return (
      <article className="transport-card glass" key={order.id}>
        <div className="transport-card-head">
          <div>
            <strong>Order {order.invoiceNumber}</strong>
            <small>{formatDate(order.orderDate)} · {order.address}</small>
          </div>
          <span className={statusTone(order)}>{TRANSPORT_STATUS_LABELS[status]}</span>
        </div>
        {renderOrderMeta(order)}
        {order.transportPod && (
          <div className="transport-pod">
            <strong>Proof of delivery</strong>
            <small>
              Received by {order.transportPod.receivedBy}
              {order.transportPod.note ? ' · ' + order.transportPod.note : ''}
              {' · '}{new Date(order.transportPod.deliveredAt).toLocaleString()}
            </small>
          </div>
        )}
        <div className="transport-assign">
          <label>
            Vehicle
            <select
              className="form-select"
              value={vehicleId}
              onChange={event => onAssignAsset(order.id, event.target.value, driverId)}
            >
              <option value="">Select vehicle</option>
              {profile.vehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate} · {vehicle.type} · {vehicle.capacityTons}t
                </option>
              ))}
            </select>
          </label>
          <label>
            Driver
            <select
              className="form-select"
              value={driverId}
              onChange={event => onAssignAsset(order.id, vehicleId, event.target.value)}
            >
              <option value="">Select driver</option>
              {profile.drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} · {driver.licenseNumber}
                </option>
              ))}
            </select>
          </label>
        </div>
        {capacityWarning && selectedVehicle && (
          <p className="transport-warning" role="status">
            ⚠️ Cargo is {cargoWeight.toLocaleString()} t but {selectedVehicle.plate} carries {selectedVehicle.capacityTons} t.
            Assign a larger vehicle or split the load.
          </p>
        )}
        <div className="transport-card-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenMap(order.companyId)}>
            🗺️ Route
          </button>
          {next && next !== 'delivered' && canAdvanceTransportJob(order, user.id) && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onAdvanceJob(order.id)}>
              {next === 'picked_up' ? '📦 Mark picked up' : '🚚 Start delivery'}
            </button>
          )}
          {status === 'in_transit' && canAdvanceTransportJob(order, user.id) && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setPodDraft({ orderId: order.id, receivedBy: '', note: '' })}
            >
              ✅ Complete delivery
            </button>
          )}
        </div>
        {podDraft.orderId === order.id && (
          <div className="transport-pod-form">
            <input
              className="form-input"
              placeholder="Received by (name)"
              value={podDraft.receivedBy}
              onChange={event => setPodDraft(prev => ({ ...prev, receivedBy: event.target.value }))}
            />
            <input
              className="form-input"
              placeholder="Delivery note (optional)"
              value={podDraft.note}
              onChange={event => setPodDraft(prev => ({ ...prev, note: event.target.value }))}
            />
            <div className="transport-card-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPodDraft({ orderId: '', receivedBy: '', note: '' })}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => submitPod(order)}>
                Confirm proof of delivery
              </button>
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <main className="main-content transporter-page">
      <div className="dashboard-header dashboard-header-supplier">
        <div className="dashboard-title">
          <span className="title-icon">🚛</span>
          <h1>Welcome{user.name ? ', ' + user.name.split(' ')[0] : ''} — Transporter Dashboard</h1>
        </div>
        <p className="dashboard-supplier-name">
          {profile.companyName} · {profile.verified ? '✅ Verified transport company' : '⏳ Verification pending'}
        </p>
      </div>

      <div className="transport-tabs" role="tablist" aria-label="Transporter sections">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={'transport-tab' + (tab === item.id ? ' active' : '')}
            onClick={() => setTab(item.id)}
          >
            <span>{item.icon}</span> {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="dashboard-grid">
            <div className="dashboard-card glass"><div className="card-icon">📥</div><div className="stat-value">{requests.length}</div><div className="stat-label">Open requests</div></div>
            <div className="dashboard-card glass"><div className="card-icon">🚚</div><div className="stat-value">{activeJobs.length}</div><div className="stat-label">Active jobs</div></div>
            <div className="dashboard-card glass"><div className="card-icon">✅</div><div className="stat-value">{completedJobs.length}</div><div className="stat-label">Completed</div></div>
            <div className="dashboard-card glass"><div className="card-icon">💰</div><div className="stat-value">{formatCurrency(earnings)}</div><div className="stat-label">Transport earnings</div></div>
          </div>
          <div className="card glass">
            <div className="card-header"><h3>🚛 Fleet &amp; dispatch readiness</h3><button className="btn btn-secondary" onClick={() => setTab('vehicles')}>Manage fleet</button></div>
            <div className="stock-summary-grid">
              <div className="stock-summary-tile"><span className="stock-tile-icon">🚛</span><strong>{profile.vehicles.length}</strong><small>Vehicles</small></div>
              <div className="stock-summary-tile"><span className="stock-tile-icon">✅</span><strong>{availableVehicles}</strong><small>Vehicles ready</small></div>
              <div className="stock-summary-tile"><span className="stock-tile-icon">🪪</span><strong>{availableDrivers}</strong><small>Drivers ready</small></div>
              <div className="stock-summary-tile"><span className="stock-tile-icon">📍</span><strong>{matchedRequestCount}</strong><small>Requests in area</small></div>
              <div className="stock-summary-tile"><span className="stock-tile-icon">🧾</span><strong>{profileCompleteness}%</strong><small>Profile complete</small></div>
              <div className="stock-summary-tile"><span className="stock-tile-icon">💵</span><strong>{formatCurrency(inTransitValue)}</strong><small>In-progress value</small></div>
            </div>
          </div>
          <div className="card glass">
            <div className="card-header"><h3>🕒 Latest open requests</h3><button className="btn btn-primary" onClick={() => setTab('requests')}>View all</button></div>
            {requests.length === 0 ? <p className="transport-empty">No unclaimed delivery requests right now.</p> : (
              <div className="transport-grid">{visibleRequests.slice(0, 4).map(renderRequestCard)}</div>
            )}
          </div>
          <div className="card glass">
            <div className="card-header"><h3>🔔 Active trips</h3><button className="btn btn-secondary" onClick={onOpenOrders}>Order book</button></div>
            {activeJobs.length === 0 ? <p className="transport-empty">No active trips. Accept a delivery request to begin.</p> : (
              <div className="transport-grid">{activeJobs.slice(0, 4).map(renderDispatchCard)}</div>
            )}
          </div>
        </>
      )}

      {tab === 'requests' && (
        <div className="card glass">
          <div className="card-header">
            <h3>📥 Delivery requests</h3>
            <span className="stock-summary-hint">Confirmed customer orders that still need a transport company.</span>
          </div>
          <div className="transport-toolbar">
            <input
              className="form-input"
              type="search"
              placeholder="Search order, product, city or supplier"
              aria-label="Search delivery requests"
              value={requestQuery}
              onChange={event => setRequestQuery(event.target.value)}
            />
            <select
              className="form-select"
              aria-label="Filter delivery requests by service area"
              value={requestArea}
              onChange={event => setRequestArea(event.target.value)}
            >
              <option value="all">All service areas</option>
              <option value="matched">In my service areas</option>
              <option value="outside">Outside my areas</option>
            </select>
            <select
              className="form-select"
              aria-label="Sort delivery requests"
              value={requestSort}
              onChange={event => setRequestSort(event.target.value as typeof requestSort)}
            >
              <option value="newest">Newest first</option>
              <option value="fee">Highest job fee</option>
              <option value="weight">Heaviest cargo</option>
            </select>
          </div>
          <p className="transport-resultline">
            {visibleRequests.length} of {requests.length} open request{requests.length === 1 ? '' : 's'}
            {profile.serviceAreas.length > 0 ? ` · ${matchedRequestCount} in ${profile.serviceAreas.join(', ')}` : ''}
          </p>
          {requests.length === 0 ? (
            <p className="transport-empty">No open requests. New confirmed orders will appear here automatically.</p>
          ) : visibleRequests.length === 0 ? (
            <p className="transport-empty">No requests match these filters. Clear the search or choose another service area.</p>
          ) : (
            <div className="transport-grid">{visibleRequests.map(renderRequestCard)}</div>
          )}
        </div>
      )}

      {tab === 'dispatch' && (
        <div className="card glass">
          <div className="card-header">
            <h3>🚚 Dispatch management</h3>
            <span className="stock-summary-hint">Assign a vehicle and driver, then advance the trip to proof of delivery.</span>
          </div>
          {needsDispatch.length === 0 ? (
            <p className="transport-empty">No jobs in dispatch. Accept a request first.</p>
          ) : (
            <div className="transport-grid">{needsDispatch.map(renderDispatchCard)}</div>
          )}
        </div>
      )}

      {tab === 'vehicles' && (
        <>
          <form className="card glass" onSubmit={addVehicle}>
            <div className="card-header"><h3>🚛 Register a vehicle</h3></div>
            <div className="form-row">
              <div className="form-group"><label>Plate number *</label><input className="form-input" value={vehicleDraft.plate} onChange={e => setVehicleDraft(prev => ({ ...prev, plate: e.target.value }))} required /></div>
              <div className="form-group"><label>Vehicle type</label><input className="form-input" value={vehicleDraft.type} onChange={e => setVehicleDraft(prev => ({ ...prev, type: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Capacity (tonnes)</label><input type="number" min="0" step="0.1" className="form-input" value={vehicleDraft.capacityTons} onChange={e => setVehicleDraft(prev => ({ ...prev, capacityTons: Number(e.target.value) }))} /></div>
              <div className="form-group"><label>Make / model</label><input className="form-input" value={vehicleDraft.makeModel} onChange={e => setVehicleDraft(prev => ({ ...prev, makeModel: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Year</label><input className="form-input" value={vehicleDraft.year} onChange={e => setVehicleDraft(prev => ({ ...prev, year: e.target.value }))} /></div>
              <div className="form-group"><label>Status</label><select className="form-select" value={vehicleDraft.status} onChange={e => setVehicleDraft(prev => ({ ...prev, status: e.target.value as TransportVehicle['status'] }))}><option value="available">Available</option><option value="in_service">In service</option><option value="maintenance">Maintenance</option></select></div>
            </div>
            <button type="submit" className="btn btn-primary">➕ Add vehicle</button>
          </form>
          <div className="card glass">
            <div className="card-header"><h3>🚛 Fleet</h3><span className="stock-summary-hint">{profile.vehicles.length} registered</span></div>
            {profile.vehicles.length === 0 ? <p className="transport-empty">No vehicles registered yet.</p> : (
              <div className="table-scroll-container">
                <table className="data-table">
                  <thead><tr><th>Plate</th><th>Type</th><th>Capacity</th><th>Make / model</th><th>Year</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {profile.vehicles.map(vehicle => (
                      <tr key={vehicle.id}>
                        <td><strong>{vehicle.plate}</strong></td>
                        <td>{vehicle.type}</td>
                        <td>{vehicle.capacityTons} t</td>
                        <td>{vehicle.makeModel || '—'}</td>
                        <td>{vehicle.year || '—'}</td>
                        <td>
                          <select className="form-select" value={vehicle.status} onChange={e => updateVehicleStatus(vehicle.id, e.target.value as TransportVehicle['status'])}>
                            <option value="available">Available</option>
                            <option value="in_service">In service</option>
                            <option value="maintenance">Maintenance</option>
                          </select>
                        </td>
                        <td><button type="button" className="btn-icon danger" onClick={() => removeVehicle(vehicle.id)} title="Remove vehicle">🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'drivers' && (
        <>
          <form className="card glass" onSubmit={addDriver}>
            <div className="card-header"><h3>🪪 Register a driver</h3></div>
            <div className="form-row">
              <div className="form-group"><label>Driver name *</label><input className="form-input" value={driverDraft.name} onChange={e => setDriverDraft(prev => ({ ...prev, name: e.target.value }))} required /></div>
              <div className="form-group"><label>Phone</label><input className="form-input" value={driverDraft.phone} onChange={e => setDriverDraft(prev => ({ ...prev, phone: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Licence number *</label><input className="form-input" value={driverDraft.licenseNumber} onChange={e => setDriverDraft(prev => ({ ...prev, licenseNumber: e.target.value }))} required /></div>
              <div className="form-group"><label>Licence expiry</label><input type="date" className="form-input" value={driverDraft.licenseExpiry} onChange={e => setDriverDraft(prev => ({ ...prev, licenseExpiry: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label>Status</label><select className="form-select" value={driverDraft.status} onChange={e => setDriverDraft(prev => ({ ...prev, status: e.target.value as TransportDriver['status'] }))}><option value="available">Available</option><option value="on_trip">On trip</option><option value="off_duty">Off duty</option></select></div>
            <button type="submit" className="btn btn-primary">➕ Add driver</button>
          </form>
          <div className="card glass">
            <div className="card-header"><h3>🪪 Drivers</h3><span className="stock-summary-hint">{profile.drivers.length} registered</span></div>
            {profile.drivers.length === 0 ? <p className="transport-empty">No drivers registered yet.</p> : (
              <div className="table-scroll-container">
                <table className="data-table">
                  <thead><tr><th>Driver</th><th>Phone</th><th>Licence</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {profile.drivers.map(driver => (
                      <tr key={driver.id}>
                        <td><strong>{driver.name}</strong></td>
                        <td>{driver.phone || '—'}</td>
                        <td>{driver.licenseNumber}</td>
                        <td>{driver.licenseExpiry || '—'}</td>
                        <td>
                          <select className="form-select" value={driver.status} onChange={e => updateDriverStatus(driver.id, e.target.value as TransportDriver['status'])}>
                            <option value="available">Available</option>
                            <option value="on_trip">On trip</option>
                            <option value="off_duty">Off duty</option>
                          </select>
                        </td>
                        <td><button type="button" className="btn-icon danger" onClick={() => removeDriver(driver.id)} title="Remove driver">🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'pricing' && (
        <>
          <form className="card glass" onSubmit={savePricing}>
            <div className="card-header"><h3>💵 Transport pricing</h3></div>
            <p className="transport-empty">Buyers see this rate when your company accepts a delivery job.</p>
            <div className="form-row">
              <div className="form-group"><label>Starting fee (ETB)</label><input type="number" min="0" step="0.01" className="form-input" value={pricingDraft.startFee} onChange={e => setPricingDraft(prev => ({ ...prev, startFee: e.target.value }))} /></div>
              <div className="form-group"><label>Rate per km (ETB)</label><input type="number" min="0" step="0.01" className="form-input" value={pricingDraft.ratePerKm} onChange={e => setPricingDraft(prev => ({ ...prev, ratePerKm: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label>Rate per tonne (ETB)</label><input type="number" min="0" step="0.01" className="form-input" value={pricingDraft.ratePerTon} onChange={e => setPricingDraft(prev => ({ ...prev, ratePerTon: e.target.value }))} /></div>
            <button type="submit" className="btn btn-primary">💾 Save pricing</button>
          </form>
          <div className="card glass">
            <div className="card-header"><h3>🧮 Quote preview</h3></div>
            <div className="form-row">
              <div className="form-group"><label>Distance (km)</label><input type="number" min="0" step="0.1" className="form-input" value={quoteDraft.distanceKm} onChange={e => setQuoteDraft(prev => ({ ...prev, distanceKm: e.target.value }))} /></div>
              <div className="form-group"><label>Cargo (tonnes)</label><input type="number" min="0" step="0.1" className="form-input" value={quoteDraft.weightTons} onChange={e => setQuoteDraft(prev => ({ ...prev, weightTons: e.target.value }))} /></div>
            </div>
            <p className="transport-quote">
              {formatCurrency(profile.startFee)} start + {quoteDraft.distanceKm || 0} km × {formatCurrency(profile.ratePerKm)} + {quoteDraft.weightTons || 0} t × {formatCurrency(profile.ratePerTon)} = <strong>{formatCurrency(previewFee)}</strong>
            </p>
          </div>
        </>
      )}

      {tab === 'earnings' && (
        <>
          <div className="dashboard-grid">
            <div className="dashboard-card glass"><div className="card-icon">💰</div><div className="stat-value">{formatCurrency(earnings)}</div><div className="stat-label">Total earnings</div></div>
            <div className="dashboard-card glass"><div className="card-icon">✅</div><div className="stat-value">{completedJobs.length}</div><div className="stat-label">Delivered jobs</div></div>
            <div className="dashboard-card glass"><div className="card-icon">🚚</div><div className="stat-value">{activeJobs.length}</div><div className="stat-label">Active jobs</div></div>
            <div className="dashboard-card glass"><div className="card-icon">⭐</div><div className="stat-value">{profile.rating.toFixed(1)}</div><div className="stat-label">Company rating</div></div>
          </div>
          <div className="card glass">
            <div className="card-header"><h3>🧾 Financial records</h3></div>
            {completedJobs.length === 0 ? <p className="transport-empty">No completed jobs yet.</p> : (
              <div className="table-scroll-container">
                <table className="data-table">
                  <thead><tr><th>Order</th><th>Date</th><th>Product</th><th>Supplier</th><th>Job fee</th><th>Delivered</th></tr></thead>
                  <tbody>
                    {completedJobs.map(order => {
                      const material = materialById.get(order.materialId);
                      const supplier = companyById.get(order.companyId);
                      return (
                        <tr key={order.id}>
                          <td>{order.invoiceNumber}</td>
                          <td>{formatDate(order.orderDate)}</td>
                          <td>{material?.name || order.materialId}</td>
                          <td>{supplier?.name || '—'}</td>
                          <td className="price-cell">{formatCurrency(transportJobFee(order))}</td>
                          <td>{order.transportDeliveredAt ? formatDate(order.transportDeliveredAt) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'profile' && (
        <>
          <form className="card glass" onSubmit={saveProfile}>
            <div className="card-header"><h3>🏢 Company profile</h3></div>
            <div className="form-row">
              <div className="form-group"><label>Company name *</label><input className="form-input" value={profileDraft.companyName} onChange={e => setProfileDraft(prev => ({ ...prev, companyName: e.target.value }))} required /></div>
              <div className="form-group"><label>Phone</label><input className="form-input" value={profileDraft.phone} onChange={e => setProfileDraft(prev => ({ ...prev, phone: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>E-mail</label><input className="form-input" value={profileDraft.email} onChange={e => setProfileDraft(prev => ({ ...prev, email: e.target.value }))} /></div>
              <div className="form-group"><label>City</label><input className="form-input" value={profileDraft.city} onChange={e => setProfileDraft(prev => ({ ...prev, city: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label>Address</label><input className="form-input" value={profileDraft.address} onChange={e => setProfileDraft(prev => ({ ...prev, address: e.target.value }))} /></div>
            <div className="form-row">
              <div className="form-group"><label>TIN number</label><input className="form-input" value={profileDraft.tinNumber} onChange={e => setProfileDraft(prev => ({ ...prev, tinNumber: e.target.value }))} /></div>
              <div className="form-group"><label>Transport licence number</label><input className="form-input" value={profileDraft.licenseNumber} onChange={e => setProfileDraft(prev => ({ ...prev, licenseNumber: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label>Service areas <small className="form-hint">(comma separated cities)</small></label><input className="form-input" value={profileDraft.serviceAreas.join(', ')} onChange={e => setProfileDraft(prev => ({ ...prev, serviceAreas: normalizeServiceAreas(e.target.value) }))} /></div>
            <div className="form-group"><label>Company description</label><textarea className="form-textarea" rows={3} value={profileDraft.description} onChange={e => setProfileDraft(prev => ({ ...prev, description: e.target.value }))} /></div>
            <button type="submit" className="btn btn-primary">💾 Save company profile</button>
          </form>
          <div className="card glass">
            <div className="card-header"><h3>🛡️ Verification centre</h3></div>
            <div className="transport-verification">
              <div><strong>Status</strong><span>{profile.verified ? '✅ Verified transport company' : '⏳ Pending administrator review'}</span></div>
              <div><strong>Licence</strong><span>{profile.licenseNumber || 'Not submitted'}</span></div>
              <div><strong>TIN</strong><span>{profile.tinNumber || 'Not submitted'}</span></div>
              <div><strong>Service areas</strong><span>{profile.serviceAreas.length > 0 ? profile.serviceAreas.join(', ') : 'Not set'}</span></div>
              <div><strong>Completed jobs</strong><span>{profile.completedJobs}</span></div>
              <div><strong>Rating</strong><span><StarRatingDisplay value={profile.rating} /> ({profile.rating.toFixed(1)})</span></div>
            </div>
          </div>
          <div className="card glass">
            <div className="card-header"><h3>🧾 Recent transport records</h3><button className="btn btn-secondary" onClick={() => setTab('earnings')}>Earnings</button></div>
            {jobs.length === 0 ? <p className="transport-empty">No transport jobs yet.</p> : (
              <div className="transport-grid">{jobs.slice(0, 3).map(renderDispatchCard)}</div>
            )}
          </div>
        </>
      )}
    </main>
  );
};

export default TransporterDashboard;
