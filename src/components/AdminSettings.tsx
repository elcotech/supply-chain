// ===== src/components/AdminSettings.tsx =====
// Administrator page for platform business rules: delivery fee model,
// delivery zones and the minimum-order requirement. Changes persist to
// localStorage and take effect immediately for all users.
import React, { useState } from 'react';
import { SystemSettings, DeliveryZone, User, Company, Material } from '../types';
import { ETHIOPIAN_CITIES } from '../constants';
import { formatCurrency } from '../utils';

interface AdminSettingsProps {
  settings: SystemSettings;
  onSave: (settings: SystemSettings) => void;
  users?: User[];
  companies?: Company[];
  materials?: Material[];
  onDeleteUser?: (userId: string) => void;
  onUpdateUser?: (user: User) => void;
  onDeleteCompany?: (companyId: string) => void;
  onEditCompany?: (company: Company) => void;
  onEditMaterial?: (material: Material) => void;
  onDeleteMaterial?: (materialId: string) => void;
}

const numberField = (value: string): number => {
  const n = parseFloat(value);
  return isFinite(n) && n >= 0 ? n : 0;
};

const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings,
  onSave,
  users = [],
  companies = [],
  materials = [],
  onDeleteUser,
  onUpdateUser,
  onDeleteCompany,
  onEditCompany,
  onEditMaterial,
  onDeleteMaterial,
}) => {
  const [form, setForm] = useState<SystemSettings>(settings);
  const [newZoneCity, setNewZoneCity] = useState('Addis Ababa');
  const [newZoneFee, setNewZoneFee] = useState('500');
  const [savedFlash, setSavedFlash] = useState(false);
  const [catalogueQuery, setCatalogueQuery] = useState('');
  const [locationUserId, setLocationUserId] = useState<string | null>(null);
  const [locationDraft, setLocationDraft] = useState({
    address: '',
    city: 'Addis Ababa',
    lat: '',
    lng: '',
  });

  const startLocationEdit = (user: User) => {
    setLocationUserId(user.id);
    setLocationDraft({
      address: user.address || '',
      city: user.city || 'Addis Ababa',
      lat: Number.isFinite(user.lat) ? String(user.lat) : '',
      lng: Number.isFinite(user.lng) ? String(user.lng) : '',
    });
  };

  const saveLocation = (user: User) => {
    if (!onUpdateUser) return;
    const lat = parseFloat(locationDraft.lat);
    const lng = parseFloat(locationDraft.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      alert('Enter a valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }
    onUpdateUser({
      ...user,
      address: locationDraft.address.trim() || user.address,
      city: locationDraft.city || user.city,
      lat,
      lng,
    });
    setLocationUserId(null);
  };

  const d = form.delivery;

  const updateD = (patch: Partial<SystemSettings['delivery']>) =>
    setForm(prev => ({ ...prev, delivery: { ...prev.delivery, ...patch } }));

  const updateZone = (id: string, patch: Partial<DeliveryZone>) =>
    setForm(prev => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        zones: prev.delivery.zones.map(z => (z.id === id ? { ...z, ...patch } : z)),
      },
    }));

  const removeZone = (id: string) =>
    setForm(prev => ({
      ...prev,
      delivery: { ...prev.delivery, zones: prev.delivery.zones.filter(z => z.id !== id) },
    }));

  const addZone = () => {
    const fee = numberField(newZoneFee);
    const existing = form.delivery.zones.find(z => z.name === newZoneCity);
    if (existing) {
      alert('A zone for ' + newZoneCity + ' already exists — edit it instead.');
      return;
    }
    const zone: DeliveryZone = {
      id: 'zone-' + Date.now().toString(),
      name: newZoneCity,
      cities: [newZoneCity],
      fee,
    };
    setForm(prev => ({
      ...prev,
      delivery: { ...prev.delivery, zones: [...prev.delivery.zones, zone] },
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  };

  const previewTests = [
    { label: '1 tonne × 100 km', fee: d.distanceBaseFee + 100 * d.distancePerKmPerTon * 1 },
    { label: '5 tonnes × 100 km', fee: d.distanceBaseFee + 100 * d.distancePerKmPerTon * 5 },
    { label: '1 tonne × 250 km', fee: d.distanceBaseFee + 250 * d.distancePerKmPerTon * 1 },
  ];

  const query = catalogueQuery.trim().toLowerCase();
  const filteredMaterials = query
    ? materials.filter(material =>
        material.name.toLowerCase().includes(query) ||
        material.category.toLowerCase().includes(query) ||
        (companies.find(company => company.id === material.companyId)?.name || '').toLowerCase().includes(query)
      )
    : materials;

  return (
    <main className="main-content">
      <section className="admin-settings glass">
        <div className="admin-settings-header">
          <h1>⚙️ Welcome — Platform Settings</h1>
          <p>Configure business rules that apply to every user. Changes save instantly to your device and take effect immediately.</p>
          {savedFlash && <div className="alert alert-success">✅ Settings saved and applied immediately.</div>}
        </div>

        <form onSubmit={handleSave} className="settings-form">
          <div className="settings-card">
            <h2>💰 Delivery Fee</h2>

            <div className="settings-field">
              <label>Pricing model</label>
              <select
                value={d.mode}
                onChange={e => updateD({ mode: e.target.value as 'distance-based' | 'fixed' })}
              >
                <option value="distance-based">Distance-based (base + per-km-per-tonne)</option>
                <option value="fixed">Fixed flat fee per order</option>
              </select>
            </div>

            {d.mode === 'fixed' ? (
              <div className="settings-field">
                <label>Fixed delivery fee (ETB)</label>
                <input
                  type="number" min="0" step="50"
                  value={d.fixedFee}
                  onChange={e => updateD({ fixedFee: numberField(e.target.value) })}
                />
                <small>Every single-supplier order is charged this flat fee.</small>
              </div>
            ) : (
              <div className="settings-row-grid">
                <div className="settings-field">
                  <label>Base fee (ETB)</label>
                  <input
                    type="number" min="0" step="50"
                    value={d.distanceBaseFee}
                    onChange={e => updateD({ distanceBaseFee: numberField(e.target.value) })}
                  />
                </div>
                <div className="settings-field">
                  <label>Per km per tonne (ETB)</label>
                  <input
                    type="number" min="0" step="1"
                    value={d.distancePerKmPerTon}
                    onChange={e => updateD({ distancePerKmPerTon: numberField(e.target.value) })}
                  />
                </div>
              </div>
            )}

            <div className="settings-field">
              <label>Free delivery threshold (ETB) — 0 disables</label>
              <input
                type="number" min="0" step="100"
                value={d.freeDeliveryThreshold}
                onChange={e => updateD({ freeDeliveryThreshold: numberField(e.target.value) })}
              />
              <small>When goods subtotal reaches this value, delivery is free.</small>
            </div>

            {d.mode !== 'fixed' && previewTests.length > 0 && (
              <div className="fee-preview">
                <strong>Sample calculations (distance-based):</strong>
                <ul>
                  {previewTests.map(t => (
                    <li key={t.label}>
                      <span>{t.label}:</span>
                      <span>{formatCurrency(t.fee)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="settings-card">
            <h2>📍 Delivery Zones</h2>
            <p className="settings-hint">
              A zone overrides the delivery fee for the matched city / area.
              Keep zones empty to use the pricing model above.
            </p>

            {form.delivery.zones.length === 0 && (
              <p className="settings-empty">No zones configured.</p>
            )}
            {form.delivery.zones.map(zone => (
              <div key={zone.id} className="zone-row">
                <div className="zone-fields">
                  <div className="zone-name">{zone.name}</div>
                  <div className="zone-cities">
                    {zone.cities.map((city, idx) => (
                      <select
                        key={idx}
                        className="zone-city-select"
                        value={city}
                        onChange={e => {
                          const cities = [...zone.cities];
                          cities[idx] = e.target.value;
                          updateZone(zone.id, { cities, name: cities.join(', ') });
                        }}
                      >
                        <option value="">—</option>
                        {ETHIOPIAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ))}
                    <button
                      type="button" className="btn-icon add"
                      title="Add city to zone"
                      onClick={() => {
                        const candidates = ETHIOPIAN_CITIES.filter(c => !zone.cities.includes(c));
                        if (candidates.length === 0) return;
                        const cities = [...zone.cities, candidates[0]];
                        updateZone(zone.id, { cities, name: cities.join(', ') });
                      }}
                    >+</button>
                  </div>
                </div>
                <div className="zone-fee">
                  <input
                    type="number" min="0" step="50"
                    value={zone.fee}
                    onChange={e => updateZone(zone.id, { fee: numberField(e.target.value) })}
                    title="Zone delivery fee (ETB)"
                  />
                  <button type="button" className="btn-icon danger" onClick={() => removeZone(zone.id)}>🗑️</button>
                </div>
              </div>
            ))}

            <div className="zone-add">
              <select value={newZoneCity} onChange={e => setNewZoneCity(e.target.value)}>
                {ETHIOPIAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="number" min="0" step="50" placeholder="Fee (ETB)"
                value={newZoneFee}
                onChange={e => setNewZoneFee(e.target.value)}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={addZone}>➕ Add Zone</button>
            </div>
          </div>

          <div className="settings-card">
            <h2>⚖️ Minimum Order Value</h2>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={form.minOrder.enabled}
                onChange={e => setForm(prev => ({ ...prev, minOrder: { ...prev.minOrder, enabled: e.target.checked } }))}
              />
              Enforce a minimum order value
            </label>
            {form.minOrder.enabled && (
              <div className="settings-field">
                <label>Minimum goods subtotal (ETB)</label>
                <input
                  type="number" min="0" step="100"
                  value={form.minOrder.amount}
                  onChange={e => setForm(prev => ({ ...prev, minOrder: { ...prev.minOrder, amount: numberField(e.target.value) } }))}
                />
                <small>
                  Customers below this amount see a warning in their cart and cannot confirm the order.
                </small>
              </div>
            )}
          </div>

          <div className="settings-card">
            <h2>VAT</h2>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={form.vat.enabled}
                onChange={e => setForm(prev => ({ ...prev, vat: { ...prev.vat, enabled: e.target.checked } }))}
              />
              Charge VAT on the goods subtotal
            </label>
            {form.vat.enabled && (
              <div className="settings-field">
                <label>VAT rate (%)</label>
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={form.vat.rate}
                  onChange={e => setForm(prev => ({ ...prev, vat: { ...prev.vat, rate: Math.min(100, numberField(e.target.value)) } }))}
                />
                <small>
                  VAT is calculated once on the whole net goods subtotal when the
                  cart becomes a proforma or purchase. Delivery is not taxed.
                </small>
              </div>
            )}
          </div>

          <div className="settings-card">
            <h2>Accounts</h2>
            <p className="settings-hint">
              Delete a customer, supplier or any non-administrator account. Deleting a
              supplier also removes its company profile and products.
            </p>
            {users.length === 0 && <p className="settings-empty">No accounts yet.</p>}
            <div className="admin-data-list">
              {users.map(user => (
                <div key={user.id} className="admin-data-row">
                  <div className="admin-data-main">
                    <strong>{user.name}</strong>
                    <small>{user.email} · {user.userType}{user.companyName ? ' · ' + user.companyName : ''}</small>
                    <small>📍 {user.address || 'No address'}, {user.city || 'No city'} · {Number.isFinite(user.lat) && Number.isFinite(user.lng) ? `${Number(user.lat).toFixed(5)}, ${Number(user.lng).toFixed(5)}` : 'location not set'}</small>
                  </div>
                  <div className="admin-data-actions">
                    {onUpdateUser && (
                      <button type="button" className="btn-icon" onClick={() => startLocationEdit(user)}>Location</button>
                    )}
                    {user.userType !== 'admin' && onDeleteUser && (
                      <button type="button" className="btn-icon danger" onClick={() => onDeleteUser(user.id)}>Delete</button>
                    )}
                    {user.userType === 'admin' && <span className="admin-data-protected">Protected</span>}
                  </div>
                  {locationUserId === user.id && (
                    <div className="admin-location-edit">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Address"
                        value={locationDraft.address}
                        onChange={e => setLocationDraft(prev => ({ ...prev, address: e.target.value }))}
                      />
                      <select
                        className="form-select"
                        value={locationDraft.city}
                        onChange={e => setLocationDraft(prev => ({ ...prev, city: e.target.value }))}
                      >
                        {ETHIOPIAN_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                      </select>
                      <input
                        type="number"
                        step="any"
                        className="form-input"
                        placeholder="Latitude"
                        value={locationDraft.lat}
                        onChange={e => setLocationDraft(prev => ({ ...prev, lat: e.target.value }))}
                      />
                      <input
                        type="number"
                        step="any"
                        className="form-input"
                        placeholder="Longitude"
                        value={locationDraft.lng}
                        onChange={e => setLocationDraft(prev => ({ ...prev, lng: e.target.value }))}
                      />
                      <div className="admin-location-actions">
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => saveLocation(user)}>Save location</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLocationUserId(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="settings-card">
            <h2>Suppliers</h2>
            <p className="settings-hint">
              Edit a supplier profile or delete it together with its products.
            </p>
            {companies.length === 0 && <p className="settings-empty">No supplier profiles yet.</p>}
            <div className="admin-data-list">
              {companies.map(company => {
                const productCount = materials.filter(material => material.companyId === company.id).length;
                return (
                  <div key={company.id} className="admin-data-row">
                    <div className="admin-data-main">
                      <strong>{company.name}</strong>
                      <small>{company.city || 'No city'} · {productCount} product{productCount === 1 ? '' : 's'}</small>
                    </div>
                    <div className="admin-data-actions">
                      {onEditCompany && <button type="button" className="btn-icon" onClick={() => onEditCompany(company)}>Edit</button>}
                      {onDeleteCompany && <button type="button" className="btn-icon danger" onClick={() => onDeleteCompany(company.id)}>Delete</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="settings-card">
            <h2>Products</h2>
            <p className="settings-hint">
              Every product field is editable. Search the catalogue, then edit or delete a line.
            </p>
            <input
              type="search"
              className="form-input"
              placeholder="Search products or suppliers…"
              value={catalogueQuery}
              onChange={e => setCatalogueQuery(e.target.value)}
            />
            {filteredMaterials.length === 0 && <p className="settings-empty">No products match.</p>}
            <div className="admin-data-list">
              {filteredMaterials.map(material => {
                const company = companies.find(c => c.id === material.companyId);
                return (
                  <div key={material.id} className="admin-data-row">
                    <div className="admin-data-main">
                      <strong>{material.name}</strong>
                      <small>{company?.name || 'Unknown supplier'} · {formatCurrency(material.price)} · {material.quantity} {material.unit}</small>
                    </div>
                    <div className="admin-data-actions">
                      {onEditMaterial && <button type="button" className="btn-icon" onClick={() => onEditMaterial(material)}>Edit</button>}
                      {onDeleteMaterial && <button type="button" className="btn-icon danger" onClick={() => onDeleteMaterial(material.id)}>Delete</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="settings-actions">
            <button type="submit" className="btn btn-primary">💾 Save Settings</button>
            <button type="button" className="btn btn-secondary" onClick={() => setForm(settings)}>↩️ Reset to Last Saved</button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default AdminSettings;