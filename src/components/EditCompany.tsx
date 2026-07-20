import React, { useState } from 'react';
import { Company, User } from '../types';
import { ETHIOPIAN_CITIES } from '../constants';
import MapPicker from './MapPicker';

interface EditCompanyProps {
  company: Company;
  user: User;
  onSave: (company: Company, user: User) => void;
  onClose: () => void;
}

const EditCompany: React.FC<EditCompanyProps> = ({ company, user, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: company.name,
    description: company.description,
    location: company.location,
    city: company.city,
    phone: user.phone,
    email: user.email,
    website: company.website || '',
    workingHours: company.workingHours || 'Mon-Fri 8:00 AM - 5:00 PM',
    tinNumber: company.tinNumber,
    businessLicense: company.businessLicense,
    vatNumber: company.vatNumber,
    tradeLicenseExpiry: company.tradeLicenseExpiry,
    lat: company.lat,
    lng: company.lng,
  });

  const [showMapPicker, setShowMapPicker] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationSelect = (lat: number, lng: number, address: string) => {
    setFormData(prev => ({
      ...prev,
      lat,
      lng,
      location: address.split(',').slice(0, 2).join(',') || address
    }));
    setShowMapPicker(false);
    setAlert({ message: '📍 Location updated on map!', type: 'success' });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updatedCompany: Company = {
      ...company,
      name: formData.name,
      description: formData.description,
      location: formData.location,
      city: formData.city,
      lat: formData.lat,
      lng: formData.lng,
      tinNumber: formData.tinNumber,
      businessLicense: formData.businessLicense,
      vatNumber: formData.vatNumber,
      tradeLicenseExpiry: formData.tradeLicenseExpiry,
      website: formData.website,
      workingHours: formData.workingHours,
    };

    const updatedUser: User = {
      ...user,
      phone: formData.phone,
      email: formData.email,
      address: formData.location,
      city: formData.city,
      lat: formData.lat,
      lng: formData.lng,
    };

    onSave(updatedCompany, updatedUser);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-company-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ Edit Company Profile</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="edit-company-form">
          <div className="form-section">
            <h3>🏢 Company Information</h3>
            <div className="form-group">
              <label>Company Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={3} />
            </div>
          </div>

          <div className="form-section">
            <h3>📍 Location</h3>
            <div className="form-group">
              <label>City *</label>
              <select name="city" value={formData.city} onChange={handleChange} required>
                {ETHIOPIAN_CITIES.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Address / Location</label>
              <input type="text" name="location" value={formData.location} onChange={handleChange} />
            </div>
            <button type="button" className="btn-secondary" onClick={() => setShowMapPicker(true)}>
              🗺️ Select Location on Map
            </button>
            <div className="location-preview">
              <small>📍 Lat: {formData.lat.toFixed(6)}, Lng: {formData.lng.toFixed(6)}</small>
            </div>
          </div>

          <div className="form-section">
            <h3>📞 Contact Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Website</label>
                <input type="url" name="website" value={formData.website} onChange={handleChange} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label>Working Hours</label>
                <input type="text" name="workingHours" value={formData.workingHours} onChange={handleChange} placeholder="Mon-Fri 8:00 AM - 5:00 PM" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>📋 Legal & Compliance</h3>
            <div className="form-row">
              <div className="form-group">
                <label>TIN Number</label>
                <input type="text" name="tinNumber" value={formData.tinNumber} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Business License</label>
                <input type="text" name="businessLicense" value={formData.businessLicense} onChange={handleChange} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>VAT Number</label>
                <input type="text" name="vatNumber" value={formData.vatNumber} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Trade License Expiry</label>
                <input type="date" name="tradeLicenseExpiry" value={formData.tradeLicenseExpiry} onChange={handleChange} />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">💾 Save Changes</button>
          </div>
        </form>

        {showMapPicker && (
          <MapPicker
            onLocationSelect={handleLocationSelect}
            initialLat={formData.lat}
            initialLng={formData.lng}
            onClose={() => setShowMapPicker(false)}
          />
        )}
      </div>
    </div>
  );
};

export default EditCompany;