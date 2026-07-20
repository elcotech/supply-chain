import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const pickerIcon = L.divIcon({
  className: 'picker-marker',
  html: '📍',
  iconSize: [40, 40],
  popupAnchor: [0, -20]
});

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialLat?: number;
  initialLng?: number;
  onClose: () => void;
}

const MapPicker: React.FC<MapPickerProps> = ({ onLocationSelect, initialLat, initialLng, onClose }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>('');

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const center: [number, number] = initialLat && initialLng ? [initialLat, initialLng] : [9.0320, 38.7469];
    leafletMap.current = L.map(mapRef.current).setView(center, 16);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSRM</a> & CartoDB',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(leafletMap.current);

    // Add marker at initial position
    if (initialLat && initialLng) {
      const marker = L.marker([initialLat, initialLng], { icon: pickerIcon, draggable: true }).addTo(leafletMap.current);
      markerRef.current = marker;
      
      // Get address for initial position
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${initialLat}&lon=${initialLng}&format=json`)
        .then(res => res.json())
        .then(data => {
          if (data && data.display_name) {
            setSelectedAddress(data.display_name);
          }
        })
        .catch(console.warn);
    }

    // Click handler to place marker
    leafletMap.current.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      placeMarker(lat, lng);
    });

    // Search function
    (window as any).searchLocation = (query: string) => {
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}, Ethiopia&format=json&limit=1`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            const { lat, lon } = data[0];
            const latNum = parseFloat(lat);
            const lngNum = parseFloat(lon);
            leafletMap.current?.setView([latNum, lngNum], 16);
            placeMarker(latNum, lngNum);
          }
        })
        .catch(console.warn);
    };

    return () => {
      if (leafletMap.current) {
        leafletMap.current.off('click');
      }
    };
  }, [initialLat, initialLng]);

  const placeMarker = (lat: number, lng: number) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], { icon: pickerIcon, draggable: true }).addTo(leafletMap.current!);
      markerRef.current = marker;
      marker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        getAddress(pos.lat, pos.lng);
      });
    }

    getAddress(lat, lng);
  };

  const getAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await response.json();
      if (data && data.display_name) {
        setSelectedAddress(data.display_name);
      }
    } catch (error) {
      console.warn('Reverse geocoding failed', error);
    }
  };

  const handleConfirm = () => {
    if (markerRef.current) {
      const pos = markerRef.current.getLatLng();
      onLocationSelect(pos.lat, pos.lng, selectedAddress);
    }
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.querySelector('input') as HTMLInputElement;
    if (input && input.value) {
      (window as any).searchLocation(input.value);
    }
  };

  return (
    <div className="map-picker-overlay" onClick={onClose}>
      <div className="map-picker-content" onClick={e => e.stopPropagation()}>
        <div className="map-picker-header">
          <h2>📍 Select Location on Map</h2>
          <button className="map-picker-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="map-picker-search">
          <form onSubmit={handleSearch}>
            <input type="text" placeholder="Search for a location..." className="search-input" />
            <button type="submit" className="btn-primary">🔍 Search</button>
          </form>
        </div>

        <div className="map-picker-container">
          <div ref={mapRef} style={{ height: '400px', width: '100%' }}></div>
        </div>

        <div className="map-picker-info">
          <p><strong>📍 Selected Location:</strong></p>
          <p className="selected-address">{selectedAddress || 'Click on the map to select a location'}</p>
        </div>

        <div className="map-picker-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={!selectedAddress}>Confirm Location</button>
        </div>
      </div>
    </div>
  );
};

export default MapPicker;