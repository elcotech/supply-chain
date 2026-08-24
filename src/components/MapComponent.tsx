import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  html: '<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));">🏗️</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -28],
});

const selectedSupplierIcon = L.divIcon({
  className: 'supplier-marker-selected',
  html: '<div style="font-size:34px;filter:drop-shadow(0 2px 6px rgba(46,204,113,.6));">🏗️</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -34],
});

const userIcon = L.divIcon({
  className: 'user-marker',
  html: '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,.3),0 2px 8px rgba(0,0,0,.3);"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
});

const accuracyCircleOptions: L.CircleOptions = {
  color: '#3b82f6',
  fillColor: '#3b82f6',
  fillOpacity: 0.08,
  weight: 1,
  opacity: 0.25,
  radius: 100,
};

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
  'Shashemene': [7.2000, 38.6000],
};

interface RouteResult {
  distanceKm: number;
  durationMin: number;
  coordinates: [number, number][];
}

interface MapComponentProps {
  companies: Company[];
  materials: Material[];
  currentUser: User | null;
  onClose: () => void;
  onSelectSupplier?: (company: Company) => void;
  autoRouteSupplierId?: string | null;
  onRouteShown?: () => void;
}

const MapComponent: React.FC<MapComponentProps> = ({
  companies,
  materials,
  currentUser,
  onClose,
  onSelectSupplier,
  autoRouteSupplierId,
  onRouteShown,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isDistanceLoading, setIsDistanceLoading] = useState(false);
  const [companyMaterials, setCompanyMaterials] = useState<Material[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [geoLocationStatus, setGeoLocationStatus] = useState<'requesting' | 'granted' | 'denied' | 'error'>('requesting');

  // Refs for guaranteed cleanup without stale closures
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const supplierMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const userPositionRef = useRef<{ lat: number; lng: number; accuracy: number }>({
    lat: currentUser?.lat || 9.0320,
    lng: currentUser?.lng || 38.7469,
    accuracy: 0,
  });
  const currentCompanyIdRef = useRef<string | null>(null);

  const getCoords = useCallback((company: Company): { lat: number; lng: number } => {
    if (company.lat && company.lng && company.lat !== 0 && company.lng !== 0) {
      return { lat: company.lat, lng: company.lng };
    }
    const city = company.city || 'Addis Ababa';
    const center = cityCoords[city] || cityCoords['Addis Ababa'];
    return { lat: center[0], lng: center[1] };
  }, []);

  const getUserPosition = useCallback(() => ({ ...userPositionRef.current }), []);

  // Remove ALL overlays from map — no stale closure issues
  const clearAllOverlays = useCallback(() => {
    if (overlayGroupRef.current && leafletMap.current) {
      leafletMap.current.removeLayer(overlayGroupRef.current);
      overlayGroupRef.current = null;
    }
    userMarkerRef.current = null;
    accuracyCircleRef.current = null;
    setRouteInfo(null);
    setDistance(null);
  }, []);

  // Browser Geolocation — watches real-time position
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoLocationStatus('error');
      return;
    }
    setGeoLocationStatus('requesting');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        userPositionRef.current = { lat: latitude, lng: longitude, accuracy };
        setGeoLocationStatus('granted');

        // Live-update user marker and accuracy circle on the map
        if (leafletMap.current && userMarkerRef.current) {
          userMarkerRef.current.setLatLng([latitude, longitude]);
        }
        if (leafletMap.current && accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng([latitude, longitude]);
          accuracyCircleRef.current.setRadius(accuracy);
        }
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        if (error.code === error.PERMISSION_DENIED) setGeoLocationStatus('denied');
        else setGeoLocationStatus('error');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // OSRM routing — returns road-following route with accurate distance
  const fetchRoute = useCallback(async (
    originLat: number, originLng: number, destLat: number, destLng: number
  ): Promise<RouteResult | null> => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );
        return {
          distanceKm: route.distance / 1000,
          durationMin: route.duration / 60,
          coordinates,
        };
      }
    } catch (err) {
      console.error('OSRM route fetch failed:', err);
    }
    return null;
  }, []);

  // Draw route for a supplier — clears everything first, then draws fresh
  const drawRouteForSupplier = useCallback(async (company: Company) => {
    const map = leafletMap.current;
    if (!map) return;

    setIsRouteLoading(true);
    setIsDistanceLoading(true);

    // Step 1: CLEAR ALL previous overlays
    clearAllOverlays();
    const group = L.layerGroup().addTo(map);
    overlayGroupRef.current = group;

    const origin = getUserPosition();
    const dest = getCoords(company);

    // Step 2: Add fresh user location marker
    const uMarker = L.marker([origin.lat, origin.lng], { icon: userIcon })
      .bindPopup(`
        <strong>\ud83d\udccd Your Location</strong><br/>
        Lat: ${origin.lat.toFixed(6)}<br/>
        Lng: ${origin.lng.toFixed(6)}<br/>
        <small>${origin.accuracy > 0 ? `Accuracy: \u00b1${origin.accuracy.toFixed(0)}m` : 'GPS accuracy pending'}</small>
      `)
      .addTo(group);
    userMarkerRef.current = uMarker;

    // Step 3: Add accuracy circle if available
    if (origin.accuracy > 0) {
      const circle = L.circle([origin.lat, origin.lng], {
        ...accuracyCircleOptions,
        radius: origin.accuracy,
      }).addTo(group);
      accuracyCircleRef.current = circle;
    }

    // Step 4: Fetch OSRM route (road-following, NOT straight line)
    const route = await fetchRoute(origin.lat, origin.lng, dest.lat, dest.lng);

    if (route) {
      // Draw green route polyline
      L.polyline(route.coordinates as L.LatLngExpression[], {
        color: '#22c55e',
        weight: 5,
        opacity: 0.85,
        smoothFactor: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);

      // Destination marker
      const destIcon = L.divIcon({
        className: 'route-dest-marker',
        html: '<div style="font-size:22px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));">\ud83d\udccd</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });
      L.marker([dest.lat, dest.lng], { icon: destIcon })
        .bindPopup(`<strong>${company.name}</strong><br/>Destination`)
        .addTo(group);

      // Fit map to show both points
      const bounds = L.latLngBounds([
        [origin.lat, origin.lng],
        [dest.lat, dest.lng],
      ]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });

      setDistance(route.distanceKm);
      setRouteInfo({ distance: route.distanceKm, duration: route.durationMin });
    } else {
      // OSRM failed — draw dashed fallback line with haversine distance
      L.polyline(
        [[origin.lat, origin.lng], [dest.lat, dest.lng]] as L.LatLngExpression[],
        { color: '#ef4444', weight: 3, opacity: 0.7, dashArray: '8, 8' }
      ).addTo(group);

      const R = 6371;
      const dLat = ((dest.lat - origin.lat) * Math.PI) / 180;
      const dLng = ((dest.lng - origin.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((origin.lat * Math.PI) / 180) *
          Math.cos((dest.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const haversineKm = R * c;

      setDistance(haversineKm);
      setRouteInfo({ distance: haversineKm, duration: haversineKm * 1.2 });

      const bounds = L.latLngBounds([
        [origin.lat, origin.lng],
        [dest.lat, dest.lng],
      ]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }

    setIsRouteLoading(false);
    setIsDistanceLoading(false);
  }, [clearAllOverlays, fetchRoute, getCoords, getUserPosition]);

  // Handle supplier click — clears previous, draws new
  const handleSupplierSelect = useCallback(async (company: Company) => {
    if (company.id === currentCompanyIdRef.current) return;

    // Highlight the selected supplier marker
    supplierMarkersRef.current.forEach((marker, id) => {
      marker.setIcon(id === company.id ? selectedSupplierIcon : supplierIcon);
    });

    currentCompanyIdRef.current = company.id;
    setSelectedCompany(company);
    setCompanyMaterials(materials.filter((m) => m.companyId === company.id));

    // Draw fresh route (clears everything first)
    await drawRouteForSupplier(company);

    if (onSelectSupplier) onSelectSupplier(company);
  }, [materials, drawRouteForSupplier, onSelectSupplier]);

  // Auto-route when supplier ID is passed (e.g., from product row click)
  useEffect(() => {
    if (autoRouteSupplierId && companies.length > 0) {
      const company = companies.find((c) => c.id === autoRouteSupplierId);
      if (company && company.id !== currentCompanyIdRef.current) {
        handleSupplierSelect(company);
        if (onRouteShown) onRouteShown();
      }
    }
  }, [autoRouteSupplierId, companies, onRouteShown, handleSupplierSelect]);

  // Initialize map once on mount
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const initPos = getUserPosition();

    const map = L.map(mapRef.current, {
      center: [initPos.lat, initPos.lng],
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    leafletMap.current = map;

    // Place supplier markers
    const allLatLngs: L.LatLngExpression[] = [];

    companies.forEach((company) => {
      const { lat, lng } = getCoords(company);
      const marker = L.marker([lat, lng], { icon: supplierIcon }).addTo(map);
      const productCount = materials.filter((m) => m.companyId === company.id).length;

      marker.bindPopup(`
        <div style="min-width:200px;font-family:system-ui,sans-serif;line-height:1.5;">
          <strong style="font-size:15px;color:#1a4a6f;">${company.name}</strong><br/>
          \ud83d\udccd ${company.location || company.city}<br/>
          \u2b50 ${company.rating || 'N/A'}/5 &nbsp;|&nbsp; \ud83d\udce6 ${productCount} products<br/>
          ${company.tinNumber ? '\u2705 Verified' : '\u23f3 Pending'}<br/>
          <button onclick="window.__selectSupplier('${company.id}')"
            style="margin-top:8px;padding:6px 14px;background:#1a4a6f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">
            \ud83d\uddfa\ufe0f Show Route
          </button>
        </div>
      `);

      marker.on('click', () => {
        handleSupplierSelect(company);
      });

      supplierMarkersRef.current.set(company.id, marker);
      allLatLngs.push([lat, lng]);
    });

    // Initial user location marker
    const userM = L.marker([initPos.lat, initPos.lng], { icon: userIcon }).addTo(map);
    userM.bindPopup(`
      <strong>\ud83d\udccd Your Location</strong><br/>
      ${currentUser?.address || 'Location pending'}<br/>
      <small>Requesting GPS access\u2026</small>
    `);
    userMarkerRef.current = userM;
    allLatLngs.push([initPos.lat, initPos.lng]);

    if (allLatLngs.length > 0) {
      map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40] });
    }

    (window as any).__selectSupplier = (companyId: string) => {
      const company = companies.find((c) => c.id === companyId);
      if (company) handleSupplierSelect(company);
    };

    return () => {
      map.remove();
      leafletMap.current = null;
      supplierMarkersRef.current.clear();
      overlayGroupRef.current = null;
      userMarkerRef.current = null;
      delete (window as any).__selectSupplier;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleViewProducts = () => {
    if (selectedCompany && onSelectSupplier) {
      onSelectSupplier(selectedCompany);
      onClose();
    }
  };

  const handleRefreshRoute = async () => {
    if (!selectedCompany) return;
    await drawRouteForSupplier(selectedCompany);
  };

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          userPositionRef.current = { lat: latitude, lng: longitude, accuracy };
          if (leafletMap.current) {
            leafletMap.current.setView([latitude, longitude], 14, { animate: true });
          }
          if (selectedCompany) drawRouteForSupplier(selectedCompany);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  return (
    <div className="map-modal-overlay" onClick={onClose}>
      <div className="map-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="map-modal-header">
          <h2>🗺️ Supplier Locations — Ethiopia</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.6 }}>
              {geoLocationStatus === 'granted' && '🟢 GPS Active'}
              {geoLocationStatus === 'requesting' && '🟡 Requesting GPS…'}
              {geoLocationStatus === 'denied' && '🔴 GPS Denied — using default'}
              {geoLocationStatus === 'error' && '🔴 GPS Error — using default'}
            </span>
            <button
              className="map-modal-close"
              onClick={handleLocateMe}
              title="Center on my location"
              style={{ fontSize: 16, padding: '4px 8px' }}
            >
              📍
            </button>
            <button className="map-modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="map-container-inner">
          <div ref={mapRef} style={{ height: '100%', width: '100%' }}></div>

          {isRouteLoading && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(15,23,42,0.85)',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: 20,
                fontSize: 13,
                zIndex: 1000,
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              Calculating route via OSRM…
            </div>
          )}
        </div>

        {selectedCompany && (
          <div className="supplier-detail-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0 }}>{selectedCompany.name}</h3>
                <p style={{ margin: '2px 0 0', opacity: 0.6, fontSize: 13 }}>
                  📍 {selectedCompany.location || selectedCompany.city}
                  {' '}&nbsp;|&nbsp;⭐ {selectedCompany.rating || 'N/A'}/5
                  {' '}&nbsp;|&nbsp;📦 {companyMaterials.length} items
                </p>
              </div>
              <button
                onClick={handleRefreshRoute}
                disabled={isRouteLoading}
                style={{
                  background: 'rgba(46,204,113,0.15)',
                  border: '1px solid rgba(46,204,113,0.3)',
                  color: '#22c55e',
                  padding: '4px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
                title="Recalculate route from your current location"
              >
                🔄 Refresh Route
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {isDistanceLoading ? (
                <div style={{ background: 'rgba(59,130,246,0.1)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid #3b82f6', fontSize: 13 }}>
                  Calculating distance…
                </div>
              ) : distance !== null ? (
                <div style={{ background: 'rgba(59,130,246,0.1)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid #3b82f6', fontSize: 13 }}>
                  🚗 <strong>{distance.toFixed(1)} km</strong> road distance
                </div>
              ) : null}

              {routeInfo && (
                <div style={{ background: 'rgba(46,204,113,0.1)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid #22c55e', fontSize: 13 }}>
                  ⏱️ <strong>{Math.round(routeInfo.duration)} min</strong> estimated drive
                </div>
              )}

              {userPositionRef.current.accuracy > 0 && (
                <div style={{ background: 'rgba(168,85,247,0.1)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid #a855f7', fontSize: 13 }}>
                  📡 GPS accuracy: <strong>±{userPositionRef.current.accuracy.toFixed(0)}m</strong>
                </div>
              )}
            </div>

            {companyMaterials.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <strong style={{ fontSize: 13 }}>Available Products:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                  {companyMaterials.slice(0, 5).map((m) => (
                    <li key={m.id}>
                      {m.name} — {m.price.toLocaleString()} ETB/{m.unit}
                    </li>
                  ))}
                  {companyMaterials.length > 5 && <li>+{companyMaterials.length - 5} more</li>}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={handleViewProducts} style={{ flex: 1 }}>
                View All Products
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  clearAllOverlays();
                  setSelectedCompany(null);
                  setCompanyMaterials([]);
                  currentCompanyIdRef.current = null;
                  supplierMarkersRef.current.forEach((marker) => marker.setIcon(supplierIcon));
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapComponent;
