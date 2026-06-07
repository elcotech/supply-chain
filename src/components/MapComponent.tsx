// src/components/MapComponent.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Company, User, Material } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const supplierIcon = L.divIcon({
  className: 'supplier-marker',
  html: '🏗️',
  iconSize: [30, 30],
  popupAnchor: [0, -15]
});

const userIcon = L.divIcon({
  className: 'user-marker',
  html: '📍',
  iconSize: [25, 25],
  popupAnchor: [0, -12]
});

interface MapComponentProps {
  companies: Company[];
  materials: Material[];
  currentUser: User | null;
  onClose: () => void;
  onSelectSupplier?: (company: Company) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({ 
  companies, 
  materials, 
  currentUser, 
  onClose,
  onSelectSupplier 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [companyMaterials, setCompanyMaterials] = useState<Material[]>([]);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Center on Addis Ababa
    leafletMap.current = L.map(mapRef.current).setView([9.0320, 38.7469], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSRM</a> & CartoDB',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(leafletMap.current);

    const latLngs: L.LatLngExpression[] = [];

    // Add markers for each company
    companies.forEach(company => {
      if (company.lat && company.lng) {
        const marker = L.marker([company.lat, company.lng], { icon: supplierIcon }).addTo(leafletMap.current!);
        
        const productCount = materials.filter(m => m.companyId === company.id).length;
        
        marker.bindPopup(`
          <div style="min-width: 200px; font-family: Arial, sans-serif;">
            <strong style="font-size: 16px; color: #1a4a6f;">${company.name}</strong><br/>
            📍 ${company.city}<br/>
            ⭐ ${company.rating || '4.5'}/5<br/>
            📦 ${productCount} products<br/>
            📞 ${company.tinNumber ? '✅ Verified' : 'Pending'}<br/>
            <button onclick="window.selectSupplier('${company.id}')" style="margin-top: 8px; padding: 5px 10px; background: #1a4a6f; color: white; border: none; border-radius: 5px; cursor: pointer;">
              View Details
            </button>
          </div>
        `);
        
        marker.on('click', () => {
          setSelectedCompany(company);
          const mats = materials.filter(m => m.companyId === company.id);
          setCompanyMaterials(mats);
          
          if (currentUser && currentUser.lat && currentUser.lng) {
            const R = 6371;
            const dLat = (company.lat - currentUser.lat) * Math.PI / 180;
            const dLon = (company.lng - currentUser.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(currentUser.lat * Math.PI/180) * Math.cos(company.lat * Math.PI/180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const dist = R * c;
            setDistance(dist);
          }
        });
        
        latLngs.push([company.lat, company.lng]);
      }
    });

    // Add user marker if logged in
    if (currentUser && currentUser.lat && currentUser.lng) {
      const userMarker = L.marker([currentUser.lat, currentUser.lng], { icon: userIcon }).addTo(leafletMap.current);
      userMarker.bindPopup(`
        <strong>📍 Your Location</strong><br/>
        ${currentUser.address}<br/>
        ${currentUser.city}
      `);
      latLngs.push([currentUser.lat, currentUser.lng]);
    }

    // Fit bounds to show all markers (fix: use L.latLngBounds)
    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      leafletMap.current.fitBounds(bounds);
    }
    
    // Expose selectSupplier to global for button clicks
    (window as any).selectSupplier = (companyId: string) => {
      const company = companies.find(c => c.id === companyId);
      if (company) {
        setSelectedCompany(company);
        const mats = materials.filter(m => m.companyId === companyId);
        setCompanyMaterials(mats);
        if (onSelectSupplier) onSelectSupplier(company);
      }
    };
    
  }, [companies, materials, currentUser, onSelectSupplier]);

  const handleViewProducts = () => {
    if (selectedCompany && onSelectSupplier) {
      onSelectSupplier(selectedCompany);
      onClose();
    }
  };

  return (
    <div className="map-modal-overlay" onClick={onClose}>
      <div className="map-modal-content" onClick={e => e.stopPropagation()}>
        <div className="map-modal-header">
          <h2>🗺️ Supplier Locations in Ethiopia</h2>
          <button className="map-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="map-container-inner">
          <div ref={mapRef} style={{ height: '500px', width: '100%' }}></div>
        </div>
        
        {selectedCompany && (
          <div className="supplier-detail-panel">
            <h3>{selectedCompany.name}</h3>
            <p><strong>📍 Location:</strong> {selectedCompany.city}</p>
            <p><strong>⭐ Rating:</strong> {selectedCompany.rating || '4.5'}/5</p>
            <p><strong>📦 Products:</strong> {companyMaterials.length} items</p>
            {distance && (
              <p><strong>🚗 Distance from you:</strong> {distance.toFixed(1)} km</p>
            )}
            <div className="supplier-products">
              <strong>Available Products:</strong>
              <ul>
                {companyMaterials.slice(0, 5).map(m => (
                  <li key={m.id}>{m.name} - {m.price} ETB/{m.unit}</li>
                ))}
                {companyMaterials.length > 5 && <li>+{companyMaterials.length - 5} more</li>}
              </ul>
            </div>
            <button className="btn-primary" onClick={handleViewProducts}>
              View All Products
            </button>
            <button className="btn-secondary" onClick={() => setSelectedCompany(null)}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapComponent;