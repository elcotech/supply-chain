// src/components/MapComponent.tsx
import React, { useEffect, useRef } from 'react';
import { Company, User } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapComponentProps {
  companies: Company[];
  currentUser: User | null;
  onClose: () => void;
}

const MapComponent: React.FC<MapComponentProps> = ({ companies, currentUser, onClose }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Center on Addis Ababa
    leafletMap.current = L.map(mapRef.current).setView([9.0320, 38.7469], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(leafletMap.current);

    // Add markers for each company
    companies.forEach(company => {
      const marker = L.marker([company.lat, company.lng]).addTo(leafletMap.current!);
      marker.bindPopup(`
        <strong>${company.name}</strong><br/>
        📍 ${company.city}<br/>
        ⭐ ${company.rating || 'N/A'}<br/>
        📦 ${company.totalOrders} orders
      `);
    });

    // Add user marker if logged in
    if (currentUser && currentUser.lat && currentUser.lng) {
      const userMarker = L.marker([currentUser.lat, currentUser.lng], {
        icon: L.divIcon({ className: 'user-marker', html: '📍', iconSize: [20, 20] })
      }).addTo(leafletMap.current);
      userMarker.bindPopup(`<strong>You</strong><br/>${currentUser.address}`);
    }

    // Fit bounds to show all markers
    const latLngs: L.LatLngExpression[] = companies.map(c => [c.lat, c.lng]);
    if (currentUser && currentUser.lat && currentUser.lng) {
      latLngs.push([currentUser.lat, currentUser.lng]);
    }
    if (latLngs.length) {
      leafletMap.current.fitBounds(L.latLngBounds(latLngs));
    }
  }, [companies, currentUser]);

  return (
    <div className="map-modal-overlay" onClick={onClose}>
      <div className="map-modal-content" onClick={e => e.stopPropagation()}>
        <div className="map-modal-header">
          <h2>🗺️ Supplier Locations</h2>
          <button className="map-modal-close" onClick={onClose}>✕</button>
        </div>
        <div ref={mapRef} className="map-container-inner" style={{ height: '500px', width: '100%' }}></div>
      </div>
    </div>
  );
};

export default MapComponent;