// ===== src/components/AdminSettings.tsx =====
// Administrator page for platform business rules: delivery fee model,
// delivery zones and the minimum-order requirement. Changes persist to
// localStorage and take effect immediately for all users.
import React, { useState } from 'react';
import { SystemSettings, DeliveryZone } from '../types';
import { ETHIOPIAN_CITIES } from '../constants';
import { formatCurrency } from '../utils';

interface AdminSettingsProps {
  settings: SystemSettings;
  onSave: (settings: SystemSettings) => void;
}

const numberField = (value: string): number => {
  const n = parseFloat(value);
  return isFinite(n) && n >= 0 ? n : 0;
};

const AdminSettings: React.FC<AdminSettingsProps> = ({ settings, onSave }) => {
  const [form, setForm] = useState<SystemSettings>(settings);
  const [newZoneCity, setNewZoneCity] = useState('Addis Ababa');
  const [newZoneFee, setNewZoneFee] = useState('500');
  const [savedFlash, setSavedFlash] = useState(false);

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

  return (
    <main className="main-content">
      <section className="admin-settings glass">
        <div className="admin-settings-header">
          <h1>⚙️ Platform Settings</h1>
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