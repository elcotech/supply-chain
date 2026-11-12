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

const hasRealPosition = (user: User | null): user is User & { lat: number; lng: number } =>
  !!user && Number.isFinite(user.lat) && Number.isFinite(user.lng) &&
  !(user.lat === 0 && user.lng === 0);

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
  /** Add a listed product to the cart, carrying the measured route distance. */
  onSelectProduct?: (material: Material, distanceKm: number | null) => void;
  autoRouteSupplierId?: string | null;
  /**
   * Bumped by the parent every time a route is explicitly requested. It lets the
   * map re-draw the route even when the *same* supplier is requested again, so a
   * second click always refreshes the line from the current position.
   */
  routeRequestId?: number;
  /** Fired after a route has been drawn, with the supplier it points to. */
  onRouteShown?: (companyId: string) => void;
  /**
   * Reports a meaningful GPS fix so the rest of the app measures from the same
   * position the map is drawing from. Called on the first fix and again only
   * when the buyer moves (≈50 m) or accuracy improves substantially.
   */
  onLocationFix?: (coords: { lat: number; lng: number; accuracy: number }) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({
  companies,
  materials,
  currentUser,
  onClose,
  onSelectSupplier,
  onSelectProduct,
  autoRouteSupplierId,
  routeRequestId = 0,
  onRouteShown,
  onLocationFix,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isDistanceLoading, setIsDistanceLoading] = useState(false);
  const [companyMaterials, setCompanyMaterials] = useState<Material[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [geoLocationStatus, setGeoLocationStatus] = useState<'requesting' | 'granted' | 'denied' | 'error' | 'timeout' | 'unsupported'>('requesting');
  const [locateMeMsg, setLocateMeMsg] = useState<string | null>(null);
  // The Leaflet instance is created in a mount effect that runs *after* the
  // auto-route effect, so routing waits for this flag instead of silently
  // bailing out on a map that does not exist yet.
  const [isMapReady, setIsMapReady] = useState(false);

  // Refs for guaranteed cleanup without stale closures
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const supplierMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  // True only once the map has a trustworthy origin: the saved buyer pin or a
  // live GPS fix. Without it we refuse to invent an Addis distance, because the
  // search list and product page show "—" instead of that fake measurement.
  const hasOriginRef = useRef(hasRealPosition(currentUser));
  const userPositionRef = useRef<{ lat: number; lng: number; accuracy: number }>(
    hasRealPosition(currentUser)
      ? { lat: currentUser.lat, lng: currentUser.lng, accuracy: 0 }
      : { lat: 9.0320, lng: 38.7469, accuracy: 0 }
  );
  // Tells the parent about real GPS fixes so the product page, cart and proforma
  // all re-measure from the same origin the map uses. The callback lives in a ref
  // because the watcher is installed once (empty deps) and must not go stale.
  const onLocationFixRef = useRef(onLocationFix);
  const reportedLocationRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const reportLocationFix = useCallback((lat: number, lng: number, accuracy: number) => {
    const last = reportedLocationRef.current;
    const moved = !last ||
      Math.abs(last.lat - lat) > 0.0005 ||
      Math.abs(last.lng - lng) > 0.0005;
    // A much tighter accuracy is worth reporting even when the pin barely moved.
    const clearer = !!last && accuracy > 0 && (last.accuracy <= 0 || accuracy < last.accuracy * 0.7);
    if (!moved && !clearer) return;
    reportedLocationRef.current = { lat, lng, accuracy };
    onLocationFixRef.current?.({ lat, lng, accuracy });
  }, []);
  const currentCompanyIdRef = useRef<string | null>(null);
  // Latest route drawer, so the geolocation watcher can refresh an already drawn
  // route once the real GPS position is known (declared after that watcher).
  const drawRouteRef = useRef<((company: Company) => Promise<void>) | null>(null);
  const selectedCompanyRef = useRef<Company | null>(null);
  const hasGpsFixRef = useRef(false);
  const drawnRequestRef = useRef<number>(-1);

  const getCoords = useCallback((company: Company): { lat: number; lng: number } => {
    if (company.lat && company.lng && company.lat !== 0 && company.lng !== 0) {
      return { lat: company.lat, lng: company.lng };
    }
    const city = company.city || 'Addis Ababa';
    const center = cityCoords[city] || cityCoords['Addis Ababa'];
    return { lat: center[0], lng: center[1] };
  }, []);

  const getUserPosition = useCallback(() => ({ ...userPositionRef.current }), []);

  useEffect(() => {
    onLocationFixRef.current = onLocationFix;
  }, [onLocationFix]);

  // Remove ALL overlays from map — no stale closure issues
  const clearAllOverlays = useCallback(() => {
    if (overlayGroupRef.current && leafletMap.current) {
      leafletMap.current.removeLayer(overlayGroupRef.current);
      overlayGroupRef.current = null;
    }
    // The first "Your Location" marker is placed straight on the map (before any
    // route exists), so it has to be dropped explicitly — otherwise a leftover
    // marker survives the next redraw.
    if (userMarkerRef.current && leafletMap.current) {
      leafletMap.current.removeLayer(userMarkerRef.current);
    }
    userMarkerRef.current = null;
    accuracyCircleRef.current = null;
    setRouteInfo(null);
    setDistance(null);
  }, []);

  // Browser Geolocation — watches real-time position
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoLocationStatus('unsupported');
      return;
    }
    setGeoLocationStatus('requesting');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        userPositionRef.current = { lat: latitude, lng: longitude, accuracy };
        hasOriginRef.current = true;
        setGeoLocationStatus('granted');
        reportLocationFix(latitude, longitude, accuracy);

        // Live-update user marker and accuracy circle on the map
        if (leafletMap.current && userMarkerRef.current) {
          userMarkerRef.current.setLatLng([latitude, longitude]);
        }
        if (leafletMap.current && accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng([latitude, longitude]);
          accuracyCircleRef.current.setRadius(accuracy);
        }

        // First real fix: if a route is already on screen it was built from the
        // registered address (or the Addis default), so redraw it from "my
        // current location" to the destination. Runs once per mount/selection.
        if (!hasGpsFixRef.current) {
          hasGpsFixRef.current = true;
          const active = selectedCompanyRef.current;
          if (active) drawRouteRef.current?.(active);
        }
      },
      (error) => {
        console.warn('Geolocation error:', error.code, error.message);
        if (error.code === error.PERMISSION_DENIED) setGeoLocationStatus('denied');
        else if (error.code === error.TIMEOUT) setGeoLocationStatus('timeout');
        else setGeoLocationStatus('error');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [reportLocationFix]);

  // OSRM routing — returns road-following route with accurate distance. Two
  // independent public servers are tried so one slow/blocked endpoint does not
  // silently fall back to a straight line.
  const fetchRoute = useCallback(async (
    originLat: number, originLng: number, destLat: number, destLng: number
  ): Promise<RouteResult | null> => {
    const endpoints = [
      'https://router.project-osrm.org/route/v1/driving',
      'https://routing.openstreetmap.de/routed-car/route/v1/driving',
    ];
    for (const endpoint of endpoints) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 12000);
      try {
        const url = `${endpoint}/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('Routing server returned ' + response.status);
        const data = await response.json();
        const route = data?.routes?.[0];
        if (route?.geometry?.coordinates?.length) {
          const coordinates: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          return {
            distanceKm: route.distance / 1000,
            durationMin: route.duration / 60,
            coordinates,
          };
        }
        throw new Error('No route found');
      } catch (err) {
        console.warn('OSRM route fetch failed for ' + endpoint, err);
      } finally {
        window.clearTimeout(timer);
      }
    }
    return null;
  }, []);

  // Draw route for a supplier — clears everything first, then draws fresh
  const drawRouteForSupplier = useCallback(async (company: Company) => {
    const map = leafletMap.current;
    if (!map) return;

    setIsRouteLoading(true);
    setIsDistanceLoading(true);
    setLocateMeMsg(null);

    // Step 1: CLEAR ALL previous overlays
    clearAllOverlays();
    const group = L.layerGroup().addTo(map);
    overlayGroupRef.current = group;

    const origin = getUserPosition();
    const dest = getCoords(company);

    // No saved pin and no GPS fix yet: measure nothing rather than charging from
    // the Addis default. The watcher redraws automatically on the first fix.
    if (!hasOriginRef.current) {
      setIsRouteLoading(false);
      setIsDistanceLoading(false);
      setDistance(null);
      setRouteInfo(null);
      setLocateMeMsg('📍 Set your location to measure the road distance (tap Locate Me).');
      return;
    }

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

  // Handle supplier click — always clears the previous route and draws a fresh
  // one, even when the same supplier is picked again.
  const handleSupplierSelect = useCallback(async (company: Company) => {
    // Highlight the selected supplier marker
    supplierMarkersRef.current.forEach((marker, id) => {
      marker.setIcon(id === company.id ? selectedSupplierIcon : supplierIcon);
    });

    currentCompanyIdRef.current = company.id;
    selectedCompanyRef.current = company;
    setSelectedCompany(company);
    setCompanyMaterials(materials.filter((m) => m.companyId === company.id));

    // Draw fresh route (clears everything first)
    await drawRouteForSupplier(company);

    // Selecting a supplier only opens its route and product drawer. Navigating
    // away is reserved for the explicit "View All Products" action; doing it
    // here made the map close itself as soon as the auto-route completed.
    if (onRouteShown) onRouteShown(company.id);
  }, [materials, drawRouteForSupplier, onRouteShown]);

  // Keep the latest drawer reachable from the geolocation watcher.
  useEffect(() => {
    drawRouteRef.current = drawRouteForSupplier;
  }, [drawRouteForSupplier]);

  // The search list and product page measure from the saved buyer pin. Whenever
  // that pin changes — a location refresh, a manual pin, a login — move the
  // map's origin to the same point and redraw, so pre-click and post-click
  // distances agree. Live GPS fixes take precedence over a saved pin.
  useEffect(() => {
    if (hasGpsFixRef.current) return;
    if (!hasRealPosition(currentUser)) return;
    const next = { lat: currentUser.lat, lng: currentUser.lng, accuracy: 0 };
    const prev = userPositionRef.current;
    if (hasOriginRef.current &&
      Math.abs(prev.lat - next.lat) < 1e-9 &&
      Math.abs(prev.lng - next.lng) < 1e-9) return;
    userPositionRef.current = next;
    hasOriginRef.current = true;
    const active = selectedCompanyRef.current;
    if (active) void drawRouteRef.current?.(active);
  }, [currentUser]);

  // Marker clicks are wired up in the mount effect (empty deps), so they go
  // through this ref to always reach the current selection logic.
  const selectSupplierRef = useRef<(company: Company) => void>(() => {});
  useEffect(() => {
    selectSupplierRef.current = (company: Company) => { handleSupplierSelect(company); };
  }, [handleSupplierSelect]);

  // Auto-route whenever a destination is requested (product row click, the map
  // being opened, or a new request for the supplier already shown). Re-running
  // always redraws from scratch, so the previous route is never left behind.
  useEffect(() => {
    if (!isMapReady || !autoRouteSupplierId || companies.length === 0) return;
    const company = companies.find((c) => c.id === autoRouteSupplierId);
    if (!company) return;
    const alreadyDrawn = drawnRequestRef.current === routeRequestId &&
      company.id === currentCompanyIdRef.current;
    if (alreadyDrawn) return;
    drawnRequestRef.current = routeRequestId;
    handleSupplierSelect(company);
  }, [isMapReady, autoRouteSupplierId, companies, handleSupplierSelect, routeRequestId]);

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
    setIsMapReady(true);
    // The modal animates in; let the container reach its final size before
    // Leaflet calculates the tile grid, otherwise the first view is offset.
    window.setTimeout(() => map.invalidateSize(), 0);

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
        selectSupplierRef.current(company);
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
      if (company) selectSupplierRef.current(company);
    };

    const markers = supplierMarkersRef.current;

    return () => {
      map.remove();
      leafletMap.current = null;
      markers.clear();
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
    if (!navigator.geolocation) {
      setGeoLocationStatus('unsupported');
      setLocateMeMsg('This browser does not support geolocation.');
      return;
    }
    setGeoLocationStatus('requesting');
    setLocateMeMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        userPositionRef.current = { lat: latitude, lng: longitude, accuracy };
        hasOriginRef.current = true;
        hasGpsFixRef.current = true;
        setGeoLocationStatus('granted');
        reportLocationFix(latitude, longitude, accuracy);
        if (leafletMap.current) {
          leafletMap.current.setView([latitude, longitude], 14, { animate: true });
        }
        if (selectedCompany) drawRouteForSupplier(selectedCompany);
        setLocateMeMsg('📍 Your location is now centered on the map.');
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoLocationStatus('denied');
          setLocateMeMsg('⛔ Location permission denied. Please enable it in your browser settings, then tap Locate Me again.');
        } else if (error.code === error.TIMEOUT) {
          setGeoLocationStatus('timeout');
          setLocateMeMsg('⏳ Locating timed out. GPS signal may be weak — check location services and retry.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGeoLocationStatus('error');
          setLocateMeMsg('⚠️ Your position is unavailable right now. Check GPS/Wi-Fi and retry.');
        } else {
          setGeoLocationStatus('error');
          setLocateMeMsg('⚠️ Could not determine your location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
              {(geoLocationStatus === 'denied' || geoLocationStatus === 'error' || geoLocationStatus === 'timeout') &&
                (hasRealPosition(currentUser)
                  ? '🟠 Using your saved location'
                  : '🔴 Set your location to measure')}
              {geoLocationStatus === 'unsupported' && '⚪ GPS Unsupported'}
            </span>
            <button
              className="locate-me-btn"
              onClick={handleLocateMe}
              title="Center map on my current location"
            >
              🎯 Locate Me
            </button>
            <button className="map-modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="map-container-inner">
          <div ref={mapRef} style={{ height: '100%', width: '100%' }}></div>

          {locateMeMsg && (
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                right: '50%',
                background: 'rgba(15,23,42,0.9)',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 13,
                zIndex: 1000,
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              }}
            >
              {locateMeMsg}
            </div>
          )}

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
                <ul className="map-product-list">
                  {companyMaterials.slice(0, 6).map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="map-product-link"
                        disabled={isDistanceLoading}
                        onClick={() => {
                          onSelectProduct?.(m, distance);
                          onClose();
                        }}
                        title={'Add ' + m.name + ' to cart' + (distance !== null ? ' with ' + distance.toFixed(1) + ' km delivery' : '')}
                      >
                        <span className="map-product-name">{m.name}</span>
                        <span className="map-product-distance">
                          {distance !== null ? distance.toFixed(1) + ' km' : isDistanceLoading ? 'Measuring…' : 'Add to cart'}
                        </span>
                        <span className="map-product-price">
                          {m.price.toLocaleString()} ETB/{m.unit}
                          <span aria-hidden="true">›</span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {companyMaterials.length > 6 && (
                    <li className="map-product-more">+{companyMaterials.length - 6} more products</li>
                  )}
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
