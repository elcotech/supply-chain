import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  html: '',
  iconSize: [40, 40],
  popupAnchor: [0, -20]
});

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string, city?: string) => void;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  autoLocate?: boolean;
  onClose: () => void;
}

const MapPicker: React.FC<MapPickerProps> = ({ onLocationSelect, initialLat, initialLng, initialAddress, autoLocate = false, onClose }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<string>(initialAddress || '');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>(
    initialLat && initialLng ? [initialLat, initialLng] : null
  );
  const [locateStatus, setLocateStatus] = useState<'idle' | 'locating' | 'granted' | 'denied' | 'unavailable' | 'timeout' | 'unsupported'>('idle');
  const locateTimeoutRef = useRef<number | null>(null);

  const getAddress = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await response.json();
      if (data && data.display_name) {
        setSelectedAddress(data.display_name);
        const parts = data.address || {};
        setSelectedCity(parts.city || parts.town || parts.village || parts.municipality || parts.state || '');
      }
    } catch (error) {
      console.warn('Reverse geocoding failed', error);
    }
  }, []);

  const placeMarker = useCallback((lat: number, lng: number) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], { icon: pickerIcon, draggable: true }).addTo(leafletMap.current!);
      markerRef.current = marker;
      marker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        setSelectedPoint([pos.lat, pos.lng]);
        getAddress(pos.lat, pos.lng);
      });
    }
    setSelectedPoint([lat, lng]);
    getAddress(lat, lng);
  }, [getAddress]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateStatus('unsupported');
      return;
    }
    setLocateStatus('locating');
    if (locateTimeoutRef.current) window.clearTimeout(locateTimeoutRef.current);
    const timeoutId = window.setTimeout(() => {
      setLocateStatus('timeout');
    }, 10000);
    locateTimeoutRef.current = timeoutId;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (locateTimeoutRef.current) window.clearTimeout(locateTimeoutRef.current);
        const { latitude, longitude } = position.coords;
        leafletMap.current?.setView([latitude, longitude], 16);
        placeMarker(latitude, longitude);
        setLocateStatus('granted');
      },
      (error) => {
        if (locateTimeoutRef.current) window.clearTimeout(locateTimeoutRef.current);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocateStatus('denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocateStatus('unavailable');
            break;
          case error.TIMEOUT:
            setLocateStatus('timeout');
            break;
          default:
            setLocateStatus('unavailable');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [placeMarker]);

  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}, Ethiopia&format=json&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const latNum = parseFloat(data[0].lat);
        const lngNum = parseFloat(data[0].lon);
        if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return;
        leafletMap.current?.setView([latNum, lngNum], 16);
        placeMarker(latNum, lngNum);
      }
    } catch (error) {
      console.warn('Location search failed', error);
    }
  }, [placeMarker]);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const center: [number, number] = initialLat && initialLng ? [initialLat, initialLng] : [9.0320, 38.7469];
    leafletMap.current = L.map(mapRef.current).setView(center, 16);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSRM</a> & CartoDB',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(leafletMap.current);

    if (initialLat && initialLng) {
      const marker = L.marker([initialLat, initialLng], { icon: pickerIcon, draggable: true }).addTo(leafletMap.current);
      markerRef.current = marker;
      getAddress(initialLat, initialLng);
    }

    leafletMap.current.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      placeMarker(lat, lng);
    });

    return () => {
      if (leafletMap.current) {
        leafletMap.current.off('click');
        leafletMap.current.remove();
      }
      leafletMap.current = null;
      markerRef.current = null;
      if (locateTimeoutRef.current) window.clearTimeout(locateTimeoutRef.current);
    };
  }, [initialLat, initialLng, getAddress, placeMarker]);

  useEffect(() => {
    if (!autoLocate) return;
    const timer = window.setTimeout(() => handleLocateMe(), 350);
    return () => window.clearTimeout(timer);
  }, [autoLocate, handleLocateMe]);

  const handleConfirm = () => {
    const markerPoint = markerRef.current?.getLatLng();
    const center = leafletMap.current?.getCenter();
    const point = markerPoint ? [markerPoint.lat, markerPoint.lng] as [number, number]
      : center ? [center.lat, center.lng] as [number, number]
      : selectedPoint;
    if (!point) return;
    const address = selectedAddress || `Selected map location (${point[0].toFixed(5)}, ${point[1].toFixed(5)})`;
    onLocationSelect(point[0], point[1], address, selectedCity);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void searchLocation(searchTerm);
  };

  return (
    <div className="map-picker-overlay" onClick={onClose}>
      <div className="map-picker-content" onClick={e => e.stopPropagation()}>
        <div className="map-picker-header">
          <h2> Select Supplier Location</h2>
          <button className="map-picker-close" onClick={onClose} aria-label="Close map">[X]</button>
        </div>
        <div style={{ padding: '10px 24px', fontSize: 13, color: 'var(--text-light)' }}>
          Tap anywhere on the map or drag the pin. We fill the address and coordinates for you.
        </div>
        
        <div className="map-picker-search">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search town, street or area..."
              className="search-input"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="btn-primary">Search</button>
            <button
              type="button"
              className="btn-locate-me"
              onClick={handleLocateMe}
              disabled={locateStatus === 'locating'}
            >
              {locateStatus === 'locating' ? 'Locating...' : 'Use my current location'}
            </button>
          </form>
        </div>

        {locateStatus === 'denied' && (
          <div className="locate-me-notice danger">
             Location permission was denied. Allow location in your browser settings, or click the map to pick your location manually.
          </div>
        )}
        {locateStatus === 'unavailable' && (
          <div className="locate-me-notice warning">
            [!] Your current position is unavailable. You can still click the map to select a location.
          </div>
        )}
        {locateStatus === 'timeout' && (
          <div className="locate-me-notice warning">
             Locating timed out. Position may be weak - check GPS/Wi-Fi, or click the map to select a location.
          </div>
        )}
        {locateStatus === 'unsupported' && (
          <div className="locate-me-notice warning">
             This browser does not support geolocation. Click the map to select a location instead.
          </div>
        )}

        <div className="map-picker-container">
          <div ref={mapRef} style={{ height: 'clamp(200px, 42vh, 400px)', width: '100%' }}></div>
        </div>

        <div className="map-picker-info">
          <p><strong>Selected location</strong></p>
          <p className="selected-address">{selectedAddress || 'Click the map, or use your current location'}</p>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-light)' }}>
            {selectedPoint
              ? `${Math.abs(selectedPoint[0]).toFixed(6)}° ${selectedPoint[0] >= 0 ? 'N' : 'S'}, ${Math.abs(selectedPoint[1]).toFixed(6)}° ${selectedPoint[1] >= 0 ? 'E' : 'W'}${selectedCity ? ` - ${selectedCity}` : ''}`
              : 'Coordinates will appear here as soon as you pick a point'}
          </p>
        </div>

        <div className="map-picker-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirm}>Use this location</button>
        </div>
      </div>
    </div>
  );
};

export default MapPicker;