import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Company, User, Material, SystemSettings } from '../types';
import { computeDeliveryFee, CartSelectionLine } from '../utils';
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
  html: '<div class="escon-pin escon-pin-supplier"><span>S</span></div>',
  iconSize: [34, 42],
  iconAnchor: [17, 42],
  popupAnchor: [0, -38],
});

const selectedSupplierIcon = L.divIcon({
  className: 'supplier-marker-selected',
  html: '<div class="escon-pin escon-pin-selected"><span>S</span></div>',
  iconSize: [40, 48],
  iconAnchor: [20, 48],
  popupAnchor: [0, -44],
});

const userIcon = L.divIcon({
  className: 'user-marker',
  html: '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,.3),0 2px 8px rgba(0,0,0,.3);"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
});

const projectIcon = L.divIcon({
  className: 'project-location-marker',
  html: '<div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:#7c3aed;color:#fff;border:3px solid #fff;border-radius:8px;box-shadow:0 0 0 4px rgba(124,58,237,.3),0 3px 10px rgba(0,0,0,.4);font-size:12px;font-weight:800;">P</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
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

interface SupplierMapRow {
  company: Company;
  coords: { lat: number; lng: number };
  distanceKm: number;
  materials: Material[];
  matchingMaterials: Material[];
  matchesMaterial: boolean;
  inRadius: boolean;
}

interface MapComponentProps {
  companies: Company[];
  materials: Material[];
  currentUser: User | null;
  onClose: () => void;
  onSelectSupplier?: (company: Company) => void;
  /** Lets the supplier who owns this marker edit their profile, location and pin. */
  onEditCompany?: (company: Company) => void;
  /** Add several listed products to the cart in one atomic, single-supplier add. */
  onSelectProducts?: (items: CartSelectionLine[], distanceKm: number | null) => void;
  autoRouteSupplierId?: string | null;
  /**
   * Bumped by the parent every time a route is explicitly requested. It lets the
   * map re-draw the route even when the *same* supplier is requested again, so a
   * second click always refreshes the line from the current position.
   */
  routeRequestId?: number;
  /** Fired after a route has been drawn, with the supplier it points to. */
  onRouteShown?: (companyId: string) => void;
  /** Platform delivery rules used when a supplier has not published a rate. */
  settings?: SystemSettings;
  /**
   * Reports a meaningful GPS fix so the rest of the app measures from the same
   * position the map is drawing from. Called on the first fix and again only
   * when the buyer moves (50 m) or accuracy improves substantially.
   */
  onLocationFix?: (coords: { lat: number; lng: number; accuracy: number }) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({
  companies,
  materials,
  currentUser,
  onClose,
  onSelectSupplier,
  onEditCompany,
  onSelectProducts,
  autoRouteSupplierId,
  routeRequestId = 0,
  onRouteShown,
  settings,
  onLocationFix,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isDistanceLoading, setIsDistanceLoading] = useState(false);
  const [companyMaterials, setCompanyMaterials] = useState<Material[]>([]);
  /** Material id -> quantity chosen in the supplier's Available Products list. */
  const [productSelection, setProductSelection] = useState<Record<string, number>>({});
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [transportCost, setTransportCost] = useState<number | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [geoLocationStatus, setGeoLocationStatus] = useState<'requesting' | 'granted' | 'denied' | 'error' | 'timeout' | 'unsupported'>('requesting');
  const [locateMeMsg, setLocateMeMsg] = useState<string | null>(null);
  // The Leaflet instance is created in a mount effect that runs *after* the
  // auto-route effect, so routing waits for this flag instead of silently
  // bailing out on a map that does not exist yet.
  const [isMapReady, setIsMapReady] = useState(false);
  // React 18 StrictMode mounts, unmounts and remounts the map in development.
  // A monotonically increasing generation makes the auto-route effect run again
  // against the new Leaflet instance instead of being skipped by its dedupe ref.
  const [mapGeneration, setMapGeneration] = useState(0);
  const mapGenerationRef = useRef(0);
  const [materialQuery, setMaterialQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState<number | 'all'>('all');
  const [showWarehouses, setShowWarehouses] = useState(true);
  const [isSettingProject, setIsSettingProject] = useState(false);
  const [projectLocation, setProjectLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 9.0320, lng: 38.7469 });
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [compareFees, setCompareFees] = useState<Record<string, number | null>>({});

  // Refs for guaranteed cleanup without stale closures
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const supplierMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const projectMarkerRef = useRef<L.Marker | null>(null);
  const isSettingProjectRef = useRef(false);
  // True only once the map has a trustworthy origin: the saved buyer pin or a
  // live GPS fix. Without it we refuse to invent an Addis distance, because the
  // search list and product page show "-" instead of that fake measurement.
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
  const drawnGenerationRef = useRef<number>(-1);
  // Every redraw gets a sequence number. A slow OSRM reply from an older click
  // can no longer overwrite the line and figures belonging to a newer click.
  const routeSeqRef = useRef(0);

  const getCoords = useCallback((company: Company): { lat: number; lng: number } => {
    if (company.lat && company.lng && company.lat !== 0 && company.lng !== 0) {
      return { lat: company.lat, lng: company.lng };
    }
    const city = company.city || 'Addis Ababa';
    const center = cityCoords[city] || cityCoords['Addis Ababa'];
    return { lat: center[0], lng: center[1] };
  }, []);

  const getUserPosition = useCallback(() => ({ ...userPositionRef.current }), []);

  const straightLineKm = useCallback((a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const raw = Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const h = Math.min(1, Math.max(0, raw));
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }, []);

  const savedOrigin = hasRealPosition(currentUser) ? { lat: currentUser.lat, lng: currentUser.lng } : null;
  const hasSavedOrigin = savedOrigin !== null;
  const distanceOrigin = projectLocation || savedOrigin || mapCenter;
  const originLabel = projectLocation ? 'Project location' : savedOrigin ? 'Saved location' : 'Map centre';

  const supplierRows = useMemo<SupplierMapRow[]>(() => {
    const query = materialQuery.trim().toLowerCase();
    return companies.map((company) => {
      const coords = getCoords(company);
      const companyMaterials = materials.filter((m) => m.companyId === company.id);
      const matchingMaterials = query
        ? companyMaterials.filter((m) =>
            [m.name, m.category, m.description].some((value) => (value || '').toLowerCase().includes(query)))
        : companyMaterials;
      const distanceKm = straightLineKm(distanceOrigin, coords);
      return {
        company,
        coords,
        distanceKm,
        materials: companyMaterials,
        matchingMaterials,
        matchesMaterial: !query || matchingMaterials.length > 0,
        inRadius: radiusKm === 'all' || distanceKm <= radiusKm,
      };
    });
  }, [companies, materials, materialQuery, radiusKm, distanceOrigin, getCoords, straightLineKm]);

  const visibleSupplierRows = useMemo(
    () => supplierRows.filter((row) => row.matchesMaterial && row.inRadius),
    [supplierRows]
  );

  const visibleComparedRows = useMemo(
    () => visibleSupplierRows.filter((row) => comparedIds.includes(row.company.id)).slice(0, 3),
    [visibleSupplierRows, comparedIds]
  );

  const buildSupplierPopup = (row: SupplierMapRow) => `
    <div style="min-width:200px;font-family:system-ui,sans-serif;line-height:1.5;">
      <strong style="font-size:15px;color:#1a4a6f;">${row.company.name}</strong><br/>
      Warehouse: ${row.company.location || row.company.city}<br/>
      Distance: ${row.distanceKm.toFixed(1)} km (straight line)<br/>
      * ${row.company.rating || 'N/A'}/5 &nbsp;|&nbsp;  ${row.materials.length} products<br/>
      ${row.company.tinNumber ? '[OK] Verified' : '... Pending'}<br/>
      <button onclick="window.__selectSupplier('${row.company.id}')"
        style="margin-top:8px;padding:6px 14px;background:#1a4a6f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">
         Show Route
      </button>
    </div>
  `;

  const averagePriceForRow = (row: SupplierMapRow) => row.materials.length === 0
    ? null
    : row.materials.reduce((sum, m) => sum + m.price, 0) / row.materials.length;

  useEffect(() => {
    onLocationFixRef.current = onLocationFix;
  }, [onLocationFix]);

  useEffect(() => {
    isSettingProjectRef.current = isSettingProject;
    const container = leafletMap.current?.getContainer();
    if (container) container.style.cursor = isSettingProject ? 'crosshair' : '';
  }, [isSettingProject, isMapReady]);

  // Remove ALL overlays from map - no stale closure issues
  const clearAllOverlays = useCallback(() => {
    if (overlayGroupRef.current && leafletMap.current) {
      leafletMap.current.removeLayer(overlayGroupRef.current);
      overlayGroupRef.current = null;
    }
    // The first "Your Location" marker is placed straight on the map (before any
    // route exists), so it has to be dropped explicitly - otherwise a leftover
    // marker survives the next redraw.
    if (userMarkerRef.current && leafletMap.current) {
      leafletMap.current.removeLayer(userMarkerRef.current);
    }
    userMarkerRef.current = null;
    accuracyCircleRef.current = null;
    setRouteInfo(null);
    setDistance(null);
    setTransportCost(null);
  }, []);

  // Browser Geolocation - watches real-time position
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

  // OSRM routing - returns road-following route with accurate distance. Two
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

  // Draw route for a supplier - clears everything first, then draws fresh
  const drawRouteForSupplier = useCallback(async (company: Company) => {
    const map = leafletMap.current;
    if (!map) return;

    const seq = ++routeSeqRef.current;
    const isCurrent = () =>
      seq === routeSeqRef.current &&
      leafletMap.current === map &&
      overlayGroupRef.current !== null;

    setIsRouteLoading(true);
    setIsDistanceLoading(true);
    setLocateMeMsg(null);

    // Step 1: CLEAR ALL previous overlays, then create the new layer. Both the
    // old line and its markers disappear before anything new is added.
    clearAllOverlays();
    const group = L.layerGroup().addTo(map);
    overlayGroupRef.current = group;

    const origin = getUserPosition();
    const dest = getCoords(company);
    const hasOrigin = hasOriginRef.current;

    const destinationIcon = L.divIcon({
      className: 'route-dest-marker',
      html: '<div class="escon-pin escon-pin-dest"><span>TO</span></div>',
      iconSize: [36, 44],
      iconAnchor: [18, 44],
      popupAnchor: [0, -40],
    });
    L.marker([dest.lat, dest.lng], { icon: destinationIcon })
      .bindPopup(`<strong>${company.name}</strong><br/>Delivery destination`)
      .addTo(group);

    if (!hasOrigin) {
      // Keep a visible link between the supplier and the map centre instead of
      // drawing nothing, but never charge from the Addis default pin.
      L.polyline([[origin.lat, origin.lng], [dest.lat, dest.lng]], {
        color: '#94a3b8',
        weight: 3,
        opacity: 0.8,
        dashArray: '6, 8',
      }).addTo(group);
      map.fitBounds(L.latLngBounds([[origin.lat, origin.lng], [dest.lat, dest.lng]]), {
        padding: [60, 60],
        maxZoom: 14,
      });
      if (isCurrent()) {
        setDistance(null);
        setRouteInfo(null);
        setTransportCost(null);
        setLocateMeMsg('Set your location with Locate Me to measure the road distance and transport cost.');
        setIsRouteLoading(false);
        setIsDistanceLoading(false);
      }
      return;
    }

    // Step 2: Add fresh user location marker
    const uMarker = L.marker([origin.lat, origin.lng], { icon: userIcon })
      .bindPopup(`
        <strong>Delivery destination (your location)</strong><br/>
        Lat: ${Math.abs(origin.lat).toFixed(6)}° ${origin.lat >= 0 ? 'N' : 'S'}<br/>
        Lng: ${Math.abs(origin.lng).toFixed(6)}° ${origin.lng >= 0 ? 'E' : 'W'}<br/>
        <small>${origin.accuracy > 0 ? `Accuracy: ±${origin.accuracy.toFixed(0)} m` : 'Saved location'}</small>
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
    if (!isCurrent()) return;

    const bounds = L.latLngBounds([[origin.lat, origin.lng], [dest.lat, dest.lng]]);

    if (route) {
      // A wide pale casing keeps the road line readable over dark map tiles.
      L.polyline(route.coordinates as L.LatLngExpression[], {
        color: '#ffffff',
        weight: 9,
        opacity: 0.55,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(group);
      L.polyline(route.coordinates as L.LatLngExpression[], {
        color: '#16a34a',
        weight: 6,
        opacity: 0.95,
        smoothFactor: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);
      setDistance(route.distanceKm);
      setRouteInfo({ distance: route.distanceKm, duration: route.durationMin });
    } else {
      // OSRM failed - draw a clearly labelled straight fallback so the route is
      // still visible, with an estimated distance instead of a blank map.
      L.polyline([[origin.lat, origin.lng], [dest.lat, dest.lng]], {
        color: '#f97316',
        weight: 4,
        opacity: 0.9,
        dashArray: '10, 8',
      }).addTo(group);
      const R = 6371;
      const dLat = ((dest.lat - origin.lat) * Math.PI) / 180;
      const dLng = ((dest.lng - origin.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((origin.lat * Math.PI) / 180) *
          Math.cos((dest.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const estimateKm = R * c;
      setDistance(estimateKm);
      setRouteInfo({ distance: estimateKm, duration: estimateKm * 1.3 });
      setLocateMeMsg('Routing service unavailable  showing an approximate straight-line distance.');
    }

    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    setIsRouteLoading(false);
    setIsDistanceLoading(false);
  }, [clearAllOverlays, fetchRoute, getCoords, getUserPosition]);

  // Handle supplier click - always clears the previous route and draws a fresh
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
    setProductSelection({});

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
  // that pin changes - a location refresh, a manual pin, a login - move the
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

  const toggleCompare = (id: string) => {
    setComparedIds((prev) => {
      const visible = prev.filter((pid) => visibleSupplierRows.some((row) => row.company.id === pid)).slice(0, 3);
      if (visible.includes(id)) return visible.filter((pid) => pid !== id);
      if (visible.length >= 3) return visible;
      return [...visible, id];
    });
  };

  const handleSupplierRowSelect = (row: SupplierMapRow) => {
    const map = leafletMap.current;
    const marker = supplierMarkersRef.current.get(row.company.id);
    if (marker && map && !map.hasLayer(marker)) marker.addTo(map);
    marker?.openPopup();
    selectSupplierRef.current(row.company);
  };

  const clearProjectLocation = () => {
    setProjectLocation(null);
    setIsSettingProject(false);
  };

  // Auto-route whenever a destination is requested (product row click, the map
  // being opened, or a new request for the supplier already shown). Re-running
  // always redraws from scratch, so the previous route is never left behind.
  useEffect(() => {
    if (!isMapReady || !autoRouteSupplierId || companies.length === 0) return;
    const company = companies.find((c) => c.id === autoRouteSupplierId);
    if (!company) return;
    const alreadyDrawn = mapGeneration === drawnGenerationRef.current &&
      drawnRequestRef.current === routeRequestId &&
      company.id === currentCompanyIdRef.current;
    if (alreadyDrawn) return;
    drawnGenerationRef.current = mapGeneration;
    drawnRequestRef.current = routeRequestId;
    void handleSupplierSelect(company);
  }, [isMapReady, mapGeneration, autoRouteSupplierId, companies, handleSupplierSelect, routeRequestId]);

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
    const initialCenter = map.getCenter();
    setMapCenter({ lat: initialCenter.lat, lng: initialCenter.lng });
    map.on('moveend', () => {
      const center = map.getCenter();
      setMapCenter({ lat: center.lat, lng: center.lng });
    });
    map.on('click', (event: L.LeafletMouseEvent) => {
      if (!isSettingProjectRef.current) return;
      setProjectLocation({ lat: event.latlng.lat, lng: event.latlng.lng });
    });
    const generation = mapGenerationRef.current + 1;
    mapGenerationRef.current = generation;
    setMapGeneration(generation);
    setIsMapReady(true);
    // The modal animates in; let the container reach its final size before
    // Leaflet calculates the tile grid, otherwise the first view is offset.
    window.setTimeout(() => map.invalidateSize(), 0);

    // Place supplier markers
    const allLatLngs: L.LatLngExpression[] = [];

    companies.forEach((company) => {
      const { lat, lng } = getCoords(company);
      const marker = L.marker([lat, lng], { icon: supplierIcon }).addTo(map);
      const initialRow = supplierRows.find((row) => row.company.id === company.id);

      marker.bindPopup(initialRow
        ? buildSupplierPopup(initialRow)
        : `<strong>${company.name}</strong><br/>Warehouse: ${company.location || company.city}`);

      marker.on('click', () => {
        selectSupplierRef.current(company);
      });

      supplierMarkersRef.current.set(company.id, marker);
      allLatLngs.push([lat, lng]);
    });

    // Initial user location marker
    const userM = L.marker([initPos.lat, initPos.lng], { icon: userIcon }).addTo(map);
    userM.bindPopup(`
      <strong> Your Location</strong><br/>
      ${currentUser?.address || 'Location pending'}<br/>
      <small>Requesting GPS access...</small>
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
      // Invalidate in-flight route responses and all auto-route dedupe keys;
      // StrictMode's second mount must draw the line again from scratch.
      routeSeqRef.current += 1;
      drawnRequestRef.current = -1;
      drawnGenerationRef.current = -1;
      currentCompanyIdRef.current = null;
      selectedCompanyRef.current = null;
      hasGpsFixRef.current = false;
      if (projectMarkerRef.current) {
        map.removeLayer(projectMarkerRef.current);
        projectMarkerRef.current = null;
      }
      map.remove();
      leafletMap.current = null;
      markers.clear();
      overlayGroupRef.current = null;
      userMarkerRef.current = null;
      accuracyCircleRef.current = null;
      delete (window as any).__selectSupplier;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = leafletMap.current;
    if (!isMapReady || !map) return;
    supplierRows.forEach((row) => {
      supplierMarkersRef.current.get(row.company.id)?.setPopupContent(buildSupplierPopup(row));
    });
    const visibleIds = new Set(visibleSupplierRows.map((row) => row.company.id));
    supplierMarkersRef.current.forEach((marker, id) => {
      const shouldShow = showWarehouses && visibleIds.has(id);
      if (shouldShow && !map.hasLayer(marker)) marker.addTo(map);
      if (!shouldShow && map.hasLayer(marker)) map.removeLayer(marker);
    });
  }, [isMapReady, supplierRows, visibleSupplierRows, showWarehouses]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!isMapReady || !map) return;
    if (projectMarkerRef.current) {
      map.removeLayer(projectMarkerRef.current);
      projectMarkerRef.current = null;
    }
    if (!projectLocation) return;
    const marker = L.marker([projectLocation.lat, projectLocation.lng], { icon: projectIcon })
      .bindPopup(`
        <strong>Project location</strong><br/>
        Lat: ${projectLocation.lat.toFixed(6)}<br/>
        Lng: ${projectLocation.lng.toFixed(6)}
      `)
      .addTo(map);
    projectMarkerRef.current = marker;
  }, [isMapReady, projectLocation]);

  // The detail panel changes the map container width after Leaflet has already
  // measured it. Without invalidation the polyline can be fitted to a stale
  // viewport and appear outside the visible area.
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !leafletMap.current) return;
    const map = leafletMap.current;
    const invalidate = () => map.invalidateSize();
    const timer = window.setTimeout(invalidate, 80);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(invalidate);
      observer.observe(mapRef.current);
    }
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [isMapReady, selectedCompany]);

  // Turn the freshly measured distance into the same transport estimate the
  // cart uses: a supplier's published start/per-km rate wins, otherwise the
  // platform delivery settings provide the fallback.
  useEffect(() => {
    if (distance === null || !selectedCompany) {
      setTransportCost(null);
      return;
    }
    let cancelled = false;
    const supplierFees = companyMaterials
      .map(material => material.delivery)
      .filter((rate): rate is NonNullable<Material['delivery']> =>
        Boolean(rate && rate.offered && Number.isFinite(rate.perKm)))
      .map(rate => (rate.startFee || 0) + (rate.perKm || 0) * distance);
    if (supplierFees.length > 0) {
      setTransportCost(Math.round(Math.max(...supplierFees) * 100) / 100);
      return;
    }
    if (!settings) return;
    const weightTons = Math.max(
      0.001,
      companyMaterials.reduce((sum, material) =>
        sum + Math.max(0, material.specifications?.weightPerUnit || 0) * Math.max(1, material.minOrder || 1), 0) / 1000
    );
    const origin = userPositionRef.current;
    void computeDeliveryFee({
      supplierLat: getCoords(selectedCompany).lat,
      supplierLng: getCoords(selectedCompany).lng,
      customerLat: origin.lat,
      customerLng: origin.lng,
      customerCity: currentUser?.city || null,
      weightTons,
      orderSubtotal: companyMaterials.reduce((sum, material) => sum + material.price, 0),
      distanceKm: distance,
      settings,
    }).then(fee => {
      if (!cancelled) setTransportCost(fee);
    }).catch(() => {
      if (!cancelled) setTransportCost(null);
    });
    return () => { cancelled = true; };
  }, [distance, selectedCompany, companyMaterials, settings, currentUser?.city, getCoords]);

  useEffect(() => {
    if (visibleComparedRows.length === 0) {
      setCompareFees({});
      return;
    }
    let cancelled = false;
    const next: Record<string, number | null> = {};
    const jobs = visibleComparedRows.map(async (row) => {
      const supplierFees = row.materials
        .map(material => material.delivery)
        .filter((rate): rate is NonNullable<Material['delivery']> =>
          Boolean(rate && rate.offered && Number.isFinite(rate.perKm)))
        .map(rate => (rate.startFee || 0) + (rate.perKm || 0) * row.distanceKm);
      if (supplierFees.length > 0) {
        next[row.company.id] = Math.round(Math.max(...supplierFees) * 100) / 100;
        return;
      }
      if (!settings) {
        next[row.company.id] = null;
        return;
      }
      const weightTons = Math.max(
        0.001,
        row.materials.reduce((sum, material) =>
          sum + Math.max(0, material.specifications?.weightPerUnit || 0) * Math.max(1, material.minOrder || 1), 0) / 1000
      );
      const orderSubtotal = row.materials.reduce((sum, material) => sum + material.price, 0);
      try {
        const fee = await computeDeliveryFee({
          supplierLat: row.coords.lat,
          supplierLng: row.coords.lng,
          customerLat: distanceOrigin.lat,
          customerLng: distanceOrigin.lng,
          customerCity: projectLocation || !hasSavedOrigin ? null : (currentUser?.city || null),
          weightTons,
          orderSubtotal,
          distanceKm: row.distanceKm,
          settings,
        });
        next[row.company.id] = fee;
      } catch {
        next[row.company.id] = null;
      }
    });
    void Promise.all(jobs).then(() => {
      if (!cancelled) setCompareFees(next);
    });
    return () => { cancelled = true; };
  }, [visibleComparedRows, settings, distanceOrigin.lat, distanceOrigin.lng, projectLocation, hasSavedOrigin, currentUser?.city]);

  const handleViewProducts = () => {
    if (selectedCompany && onSelectSupplier) {
      onSelectSupplier(selectedCompany);
      onClose();
    }
  };

  // Guests may still tick items: the parent turns that into a sign-in prompt,
  // exactly as the old single-product "Add to cart" button did.
  const canOrder = !currentUser || currentUser.userType === 'customer';
  const availableMaterials = companyMaterials.filter(m => (m.quantity || 0) > 0);
  const selectedItems: CartSelectionLine[] = availableMaterials
    .filter(m => (productSelection[m.id] || 0) > 0)
    .map(m => ({
      material: m,
      quantity: Math.min(productSelection[m.id], m.quantity),
      includeDelivery: true,
      supplierName: selectedCompany?.name || '',
      distanceKm: distance ?? undefined,
    }));
  const selectedUnits = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedTotal = selectedItems.reduce((sum, item) => sum + item.quantity * item.material.price, 0);

  const setProductQuantity = (material: Material, quantity: number) => {
    setProductSelection(prev => {
      const next = { ...prev };
      const capped = Math.min(Math.max(0, Math.floor(quantity) || 0), Math.max(0, material.quantity || 0));
      if (capped === 0) delete next[material.id];
      else next[material.id] = capped;
      return next;
    });
  };

  const handleAddSelected = () => {
    if (!onSelectProducts || selectedItems.length === 0) return;
    onSelectProducts(selectedItems, distance);
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
        setLocateMeMsg(' Your location is now centered on the map.');
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoLocationStatus('denied');
          setLocateMeMsg(' Location permission denied. Please enable it in your browser settings, then tap Locate Me again.');
        } else if (error.code === error.TIMEOUT) {
          setGeoLocationStatus('timeout');
          setLocateMeMsg(' Locating timed out. GPS signal may be weak - check location services and retry.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGeoLocationStatus('error');
          setLocateMeMsg('[!] Your position is unavailable right now. Check GPS/Wi-Fi and retry.');
        } else {
          setGeoLocationStatus('error');
          setLocateMeMsg('[!] Could not determine your location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="map-modal-overlay" onClick={onClose}>
      <div className="map-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="map-modal-header">
          <h2> Supplier Locations - Ethiopia</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.6 }}>
              {geoLocationStatus === 'granted' && ' GPS Active'}
              {geoLocationStatus === 'requesting' && ' Requesting GPS...'}
              {(geoLocationStatus === 'denied' || geoLocationStatus === 'error' || geoLocationStatus === 'timeout') &&
                (hasRealPosition(currentUser)
                  ? ' Using your saved location'
                  : ' Set your location to measure')}
              {geoLocationStatus === 'unsupported' && ' GPS Unsupported'}
            </span>
            <button
              className="locate-me-btn"
              onClick={handleLocateMe}
              title="Center map on my current location"
            >
               Locate Me
            </button>
            <button className="map-modal-close" onClick={onClose}>[X]</button>
          </div>
        </div>

        <div className="map-product-picker" style={{ margin: 0, padding: '10px 14px', borderBottom: '1px solid var(--glass-border)' }}>
          <div className="map-product-picker-head" style={{ flexWrap: 'wrap' }}>
            <strong>Map tools</strong>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="map-product-action"
                aria-pressed={isSettingProject}
                onClick={() => setIsSettingProject((active) => !active)}
                style={{ color: isSettingProject ? '#c4b5fd' : undefined, fontWeight: isSettingProject ? 700 : undefined }}
              >
                {isSettingProject ? 'Click map to set project' : 'Set project location'}
              </button>
              <button
                type="button"
                className="map-product-action"
                onClick={clearProjectLocation}
                disabled={!projectLocation}
              >
                Clear
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <input
              type="text"
              value={materialQuery}
              onChange={(event) => setMaterialQuery(event.target.value)}
              placeholder="Search material by name, category or description"
              aria-label="Search materials on the map"
              style={{
                flex: '1 1 180px',
                minWidth: 0,
                boxSizing: 'border-box',
                padding: '5px 8px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 12,
              }}
            />
            <select
              value={radiusKm}
              onChange={(event) => setRadiusKm(event.target.value === 'all' ? 'all' : Number(event.target.value))}
              aria-label="Nearby radius"
              style={{
                flex: '0 0 104px',
                padding: '5px 6px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 12,
              }}
            >
              <option value="all">All</option>
              <option value={10}>10 km</option>
              <option value={25}>25 km</option>
              <option value={50}>50 km</option>
              <option value={100}>100 km</option>
            </select>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showWarehouses}
                onChange={(event) => setShowWarehouses(event.target.checked)}
                aria-label="Warehouse locations"
              />
              Warehouse locations
            </label>
          </div>
          <div style={{ fontSize: 10, opacity: 0.75, marginTop: 4 }}>
            Origin: {originLabel}
            {projectLocation ? ` - ${projectLocation.lat.toFixed(5)}, ${projectLocation.lng.toFixed(5)}` : ''}
            {showWarehouses ? ' - Supplier pins are warehouse locations' : ' - Warehouse pins hidden'}
          </div>
          <div className="map-product-list" style={{ maxHeight: 130, overflowY: 'auto', marginTop: 8 }}>
            {visibleSupplierRows.length === 0 ? (
              <div style={{ padding: 8, fontSize: 11, opacity: 0.7 }}>No suppliers match this material and radius.</div>
            ) : visibleSupplierRows.map((row) => (
              <div key={row.company.id} className="map-product-row">
                <label className="map-product-check">
                  <input
                    type="checkbox"
                    checked={comparedIds.includes(row.company.id)}
                    disabled={!comparedIds.includes(row.company.id) && visibleComparedRows.length >= 3}
                    onChange={() => toggleCompare(row.company.id)}
                    aria-label={`Compare ${row.company.name}`}
                  />
                </label>
                <div className="map-product-info">
                  <span className="map-product-name">{row.company.name}</span>
                  <span className="map-product-price" style={{ whiteSpace: 'normal', fontWeight: 400 }}>
                    Warehouse: {row.company.location || row.company.city}
                  </span>
                </div>
                <span className="map-product-distance">{row.distanceKm.toFixed(1)} km</span>
                <button
                  type="button"
                  className="map-product-action"
                  onClick={() => handleSupplierRowSelect(row)}
                >
                  Show route
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="map-product-picker-head">
              <strong>Compare nearby suppliers</strong>
              <span style={{ fontSize: 10, opacity: 0.7 }}>Tick up to 3</span>
            </div>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse', fontSize: 11, marginTop: 4 }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>Supplier</th>
                    <th style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>Warehouse</th>
                    <th style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>Distance</th>
                    <th style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>Products</th>
                    <th style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>Avg price</th>
                    <th style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>Transport</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleComparedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 6, opacity: 0.7 }}>Tick suppliers above to compare.</td>
                    </tr>
                  ) : visibleComparedRows.map((row) => {
                    const fee = compareFees[row.company.id];
                    const averagePrice = averagePriceForRow(row);
                    return (
                      <tr key={row.company.id}>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>{row.company.name}</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>
                          {row.company.location || row.company.city}
                        </td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>
                          {row.distanceKm.toFixed(1)} km
                        </td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>
                          {row.materials.length}
                        </td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>
                          {averagePrice === null ? '-' : `${Math.round(averagePrice).toLocaleString()} ETB`}
                        </td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>
                          {fee === null || fee === undefined ? '-' : `${fee.toLocaleString()} ETB`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}></span>
              Calculating route via OSRM...
            </div>
          )}
        </div>

        {selectedCompany && (
          <div className="supplier-detail-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>{selectedCompany.name}</h3>
                <p style={{ margin: '2px 0 0', opacity: 0.6, fontSize: 13 }}>
                   {selectedCompany.location || selectedCompany.city}
                  {' '}&nbsp;|&nbsp;* {selectedCompany.rating || 'N/A'}/5
                  {' '}&nbsp;|&nbsp; {companyMaterials.length} items
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
                  Refresh Route
               </button>
               {onEditCompany && currentUser?.userType === 'company' && selectedCompany.userId === currentUser.id && (
                 <button
                   type="button"
                   style={{
                     background: 'rgba(59,130,246,0.15)',
                     border: '1px solid rgba(59,130,246,0.3)',
                     color: '#93c5fd',
                     padding: '4px 10px',
                     borderRadius: 6,
                     cursor: 'pointer',
                     fontSize: 12,
                     whiteSpace: 'nowrap',
                   }}
                   title="Edit your business profile, address and GPS location"
                   onClick={() => onEditCompany(selectedCompany)}
                 >
                   Edit my business
                 </button>
               )}
             </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {isDistanceLoading ? (
                <div style={{ background: 'rgba(59,130,246,0.1)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid #3b82f6', fontSize: 13 }}>
                  Calculating distance...
                </div>
              ) : distance !== null ? (
                <div style={{ background: 'rgba(59,130,246,0.1)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid #3b82f6', fontSize: 13 }}>
                   <strong>{distance.toFixed(1)} km</strong> road distance
                </div>
              ) : null}

               {routeInfo && (
                 <div style={{ background: 'rgba(46,204,113,0.1)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid #22c55e', fontSize: 13 }}>
                    <strong>{Math.round(routeInfo.duration)} min</strong> estimated drive
                 </div>
               )}

               {transportCost !== null && (
                 <div style={{ background: 'rgba(245,158,11,0.12)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid #f59e0b', fontSize: 13 }}>
                    <strong>{transportCost.toLocaleString()} ETB</strong> estimated transport
                 </div>
               )}

              {userPositionRef.current.accuracy > 0 && (
                <div style={{ background: 'rgba(168,85,247,0.1)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid #a855f7', fontSize: 13 }}>
                   GPS accuracy: <strong>+/-{userPositionRef.current.accuracy.toFixed(0)}m</strong>
                </div>
              )}
            </div>

            {companyMaterials.length > 0 && (
              <div className="map-product-picker">
                <div className="map-product-picker-head">
                  <strong>Available Products</strong>
                  <div>
                    <button
                      type="button"
                      className="map-product-action"
                      disabled={!canOrder || availableMaterials.length === 0}
                      onClick={() => setProductSelection(Object.fromEntries(availableMaterials.map(m => [m.id, 1])))}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="map-product-action"
                      disabled={selectedItems.length === 0}
                      onClick={() => setProductSelection({})}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="map-product-list">
                  {companyMaterials.map(m => {
                    const quantity = productSelection[m.id] || 0;
                    const outOfStock = (m.quantity || 0) <= 0;
                    const disabled = outOfStock || !canOrder;
                    return (
                      <div key={m.id} className={'map-product-row' + (quantity > 0 ? ' selected' : '')}>
                        <label className="map-product-check">
                          <input
                            type="checkbox"
                            checked={quantity > 0}
                            disabled={disabled}
                            onChange={event => setProductQuantity(m, event.target.checked ? 1 : 0)}
                            aria-label={'Select ' + m.name}
                          />
                        </label>
                        <div className="map-product-info">
                          <span className="map-product-name">{m.name}</span>
                          <span className="map-product-price">
                            {m.price.toLocaleString()} ETB/{m.unit}
                            {outOfStock ? ' - Out of stock' : ''}
                          </span>
                        </div>
                        <span className="map-product-distance">
                          {distance !== null
                            ? distance.toFixed(1) + ' km'
                            : isDistanceLoading ? 'Measuring...' : 'Delivery'}
                        </span>
                        <div className="map-product-qty">
                          <button
                            type="button"
                            disabled={disabled || quantity === 0}
                            onClick={() => setProductQuantity(m, quantity - 1)}
                            aria-label={'Decrease quantity of ' + m.name}
                          >-</button>
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, m.quantity || 0)}
                            value={quantity || 1}
                            disabled={disabled || quantity === 0}
                            onChange={event => setProductQuantity(m, Math.floor(Number(event.target.value)))}
                            aria-label={'Quantity of ' + m.name}
                          />
                          <button
                            type="button"
                            disabled={disabled || quantity === 0 || quantity >= (m.quantity || 0)}
                            onClick={() => setProductQuantity(m, quantity + 1)}
                            aria-label={'Increase quantity of ' + m.name}
                          >+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="map-product-picker-foot">
                  <span>
                    {selectedItems.length > 0
                      ? `${selectedUnits} unit(s) in ${selectedItems.length} item(s) - ${selectedTotal.toLocaleString()} ETB`
                      : canOrder
                        ? 'Tick the products you want, then add them together to the cart.'
                        : currentUser?.userType === 'company'
                          ? 'Manage products, prices and stock in your supplier workspace.'
                          : 'Sign in as a customer to order from this supplier.'}
                  </span>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!canOrder || selectedItems.length === 0}
                    onClick={handleAddSelected}
                  >
                    Add selected to cart
                  </button>
                </div>
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
                  setProductSelection({});
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
