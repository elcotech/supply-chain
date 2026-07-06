import React, { useEffect, useRef, useState } from 'react';
import { Company, User, Material } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// Fallback city coordinates
const cityCoords: Record<string, [number, number]> = {
  'Addis Ababa': [9.0320, 38.7469],
  'Adama': [8.5400, 39.2700],
  'Bahir Dar': [11.6000, 37.3900],
  'Gondar': [12.6000, 37.4700],
  'Dessie': [11.1300, 39.6300],
  'Hawassa': [7.0500, 38.4800],
  'Jimma': [7.6700, 36.8300],
  'Jijiga': [9.3500, 42.8000],
  'Mekelle': [13.4900, 39.4800],
  'Dire Dawa': [9.5900, 41.8700],
  'Harar': [9.3100, 42.1200],
  'Nekemte': [9.0800, 36.5300],
  'Debre Markos': [10.3300, 37.7300],
  'Asosa': [10.0600, 34.5300],
  'Gambela': [8.2500, 34.5900],
  'Semera': [11.7900, 41.0100],
  'Debre Berhan': [9.6800, 39.5300],
  'Wolkite': [8.2800, 37.7900],
  'Bishoftu': [8.7400, 38.9800],
  'Shashemene': [7.2000, 38.6000]
};

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

  const getCoords = (company: Company): { lat: number; lng: number } => {
    let lat = company.lat;
    let lng = company.lng;
    const city = company.city || 'Addis Ababa';
    const center = cityCoords[city] || cityCoords['Addis Ababa'];
    // If coords are missing or too close to city center, use fallback
    if (!lat || !lng || (Math.abs(lat - center[0]) < 0.01 && Math.abs(lng - center[1]) < 0.01)) {
      return { lat: center[0], lng: center[1] };
    }
    return { lat, lng };
  };

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    leafletMap.current = L.map(mapRef.current).setView([9.0320, 38.7469], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSRM</a> & CartoDB',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(leafletMap.current);

    const latLngs: L.LatLngExpression[] = [];

    companies.forEach(company => {
      const { lat, lng } = getCoords(company);
      const marker = L.marker([lat, lng], { icon: supplierIcon }).addTo(leafletMap.current!);
      const productCount = materials.filter(m => m.companyId === company.id).length;
      
      marker.bindPopup(`
        <div style="min-width: 220px; font-family: Arial, sans-serif;">
          <strong style="font-size: 16px; color: #1a4a6f;">${company.name}</strong><br/>
          📍 ${company.location || company.city}<br/>
          ⭐ ${company.rating || 'N/A'}/5<br/>
          📦 ${productCount} products<br/>
          ${company.tinNumber ? '✅ Verified' : 'Pending'}<br/>
          <button onclick="window.selectSupplier('${company.id}')" style="margin-top: 8px; padding: 5px 10px; background: #1a4a6f; color: white; border: none; border-radius: 5px; cursor: pointer;">
            View Details
          </button>
        </div>
      `);
      
      marker.on('click', () => {
        setSelectedCompany(company);
        setCompanyMaterials(materials.filter(m => m.companyId === company.id));
        if (currentUser && currentUser.lat && currentUser.lng) {
          const R = 6371;
          const dLat = (lat - currentUser.lat) * Math.PI / 180;
          const dLon = (lng - currentUser.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(currentUser.lat * Math.PI/180) * Math.cos(lat * Math.PI/180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          setDistance(R * c);
        }
      });
      
      latLngs.push([lat, lng]);
    });

    if (currentUser && currentUser.lat && currentUser.lng) {
      const userMarker = L.marker([currentUser.lat, currentUser.lng], { icon: userIcon }).addTo(leafletMap.current);
      userMarker.bindPopup(`
        <strong>📍 Your Location</strong><br/>
        ${currentUser.address}<br/>
        ${currentUser.city}
      `);
      latLngs.push([currentUser.lat, currentUser.lng]);
    }

    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      leafletMap.current.fitBounds(bounds, { padding: [30, 30] });
    }
    
    (window as any).selectSupplier = (companyId: string) => {
      const company = companies.find(c => c.id === companyId);
      if (company) {
        setSelectedCompany(company);
        setCompanyMaterials(materials.filter(m => m.companyId === companyId));
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
            <p><strong>📍 Location:</strong> {selectedCompany.location || selectedCompany.city}</p>
            <p><strong>⭐ Rating:</strong> {selectedCompany.rating || 'N/A'}/5</p>
            <p><strong>📦 Products:</strong> {companyMaterials.length} items</p>
            {distance && <p><strong>🚗 Distance from you:</strong> {distance.toFixed(1)} km</p>}
            <div className="supplier-products">
              <strong>Available Products:</strong>
              <ul>
                {companyMaterials.slice(0, 5).map(m => (
                  <li key={m.id}>{m.name} - {m.price} ETB/{m.unit}</li>
                ))}
                {companyMaterials.length > 5 && <li>+{companyMaterials.length - 5} more</li>}
              </ul>
            </div>
            <button className="btn-primary" onClick={handleViewProducts}>View All Products</button>
            <button className="btn-secondary" onClick={() => setSelectedCompany(null)}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapComponent;