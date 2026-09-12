'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { geometryBounds, pointInGeometry, type TerritoryGeometry } from '@/lib/geo';

export interface MapShape {
    id: number;
    name: string;
    geometry: TerritoryGeometry;
    color?: string;
    status?: 'available' | 'assigned' | 'inactive';
}

export interface MapLandmark {
    id: number;
    name: string;
    color?: string;
    lng: number;
    lat: number;
}

interface LiveMapProps {
    shapes: MapShape[];
    landmarks?: MapLandmark[];
    highlightId?: number;
    colorBy?: 'status' | 'highlight';
    showLocation?: boolean;
    onSelect?: (id: number) => void;
    className?: string;
    interactive?: boolean;
    /** Tailwind placement classes for the basemap toggle, so pages can keep it clear of their own chips */
    layersClass?: string;
}

type Basemap = 'streets' | 'satellite';

const STATUS_COLORS = { available: '#059669', assigned: '#d97706', inactive: '#94a3b8' };
const HIGHLIGHT_COLOR = '#4f46e5';
const NEUTRAL_COLOR = '#64748b';
const BASEMAP_KEY = 'md-basemap';

function shapeColor(shape: MapShape, highlightId: number | undefined, colorBy: 'status' | 'highlight') {
    if (shape.id === highlightId) return HIGHLIGHT_COLOR;
    if (colorBy === 'status') return STATUS_COLORS[shape.status || 'available'];
    return shape.color || NEUTRAL_COLOR;
}

// GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
function toLatLngs(geometry: TerritoryGeometry): [number, number][][] {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    return polygons.map((polygon) => polygon[0].map(([lng, lat]) => [lat, lng] as [number, number]));
}

export default function LiveMap({
    shapes,
    landmarks = [],
    highlightId,
    colorBy = 'highlight',
    showLocation = false,
    onSelect,
    className = '',
    interactive = true,
    layersClass = 'right-3 top-[max(env(safe-area-inset-top),12px)]',
}: LiveMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Leaflet.Map | null>(null);
    const leafletRef = useRef<typeof Leaflet | null>(null);
    const shapeLayerRef = useRef<Leaflet.LayerGroup | null>(null);
    const locationLayerRef = useRef<Leaflet.LayerGroup | null>(null);
    const tilesRef = useRef<{ streets: Leaflet.TileLayer; satellite: Leaflet.TileLayer; labels: Leaflet.TileLayer } | null>(null);
    const followRef = useRef(true);
    const [inside, setInside] = useState<boolean | null>(null);
    const [locationError, setLocationError] = useState('');
    const positionRef = useRef<[number, number] | null>(null);
    const [basemap, setBasemap] = useState<Basemap>('streets');
    const basemapRef = useRef<Basemap>('streets');

    const highlight = shapes.find((shape) => shape.id === highlightId);

    // remembered per device
    useEffect(() => {
        try {
            if (localStorage.getItem(BASEMAP_KEY) === 'satellite') setBasemap('satellite');
        } catch { /* private mode */ }
    }, []);

    const applyBasemap = useCallback((L: typeof Leaflet, map: Leaflet.Map) => {
        if (!tilesRef.current) {
            tilesRef.current = {
                streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; OpenStreetMap',
                }),
                satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    maxZoom: 19,
                    attribution: '&copy; Esri',
                }),
                // place names on top of imagery, so satellite still reads like a map
                labels: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
                    maxZoom: 19,
                }),
            };
        }
        const tiles = tilesRef.current;
        if (basemapRef.current === 'satellite') {
            map.removeLayer(tiles.streets);
            tiles.satellite.addTo(map);
            tiles.labels.addTo(map);
        } else {
            map.removeLayer(tiles.satellite);
            map.removeLayer(tiles.labels);
            tiles.streets.addTo(map);
        }
    }, []);

    useEffect(() => {
        basemapRef.current = basemap;
        try { localStorage.setItem(BASEMAP_KEY, basemap); } catch { /* private mode */ }
        const L = leafletRef.current;
        const map = mapRef.current;
        if (L && map) applyBasemap(L, map);
    }, [basemap, applyBasemap]);

    // Create the map once, then redraw polygons + pins whenever the data changes.
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const L = leafletRef.current || (await import('leaflet')).default;
            if (cancelled || !containerRef.current) return;
            leafletRef.current = L;

            if (!mapRef.current) {
                const map = L.map(containerRef.current, {
                    zoomControl: false,
                    attributionControl: true,
                    dragging: interactive,
                    scrollWheelZoom: interactive,
                    touchZoom: interactive,
                    doubleClickZoom: interactive,
                    keyboard: interactive,
                    // Google-Earth-feel gestures: fractional pinch zoom, no rubber-banding
                    zoomSnap: 0.25,
                    zoomDelta: 0.5,
                    wheelPxPerZoomLevel: 120,
                    bounceAtZoomLimits: false,
                    inertia: true,
                });
                map.attributionControl.setPrefix('');
                map.on('dragstart', () => { followRef.current = false; });
                mapRef.current = map;
                applyBasemap(L, map);
            }

            const map = mapRef.current;
            shapeLayerRef.current?.remove();
            const layer = L.layerGroup().addTo(map);
            shapeLayerRef.current = layer;

            let bounds: Leaflet.LatLngBounds | null = null;
            for (const shape of shapes) {
                const isHighlight = shape.id === highlightId;
                const color = shapeColor(shape, highlightId, colorBy);
                const polygon = L.polygon(toLatLngs(shape.geometry), {
                    color,
                    weight: isHighlight ? 3 : 2,
                    fillColor: color,
                    fillOpacity: isHighlight ? 0.25 : 0.15,
                    className: isHighlight ? 'territory-pulse' : '',
                }).addTo(layer);

                polygon.bindTooltip(shape.name, { direction: 'center', className: 'territory-label', permanent: shapes.length > 1 && !highlightId });
                if (onSelect) polygon.on('click', () => onSelect(shape.id));

                const box = polygon.getBounds();
                const fitThis = highlightId ? isHighlight : true;
                if (fitThis) bounds = bounds ? bounds.extend(box) : L.latLngBounds(box.getSouthWest(), box.getNorthEast());
            }

            // landmarks from the KMZ: small pins with always-on labels
            for (const landmark of landmarks) {
                const pin = L.circleMarker([landmark.lat, landmark.lng], {
                    radius: 5.5,
                    color: '#ffffff',
                    weight: 2,
                    fillColor: landmark.color || '#334155',
                    fillOpacity: 1,
                }).addTo(layer);
                pin.bindTooltip(landmark.name, { direction: 'top', offset: [0, -8], permanent: true, className: 'landmark-label' });
                if (!shapes.length) {
                    const spot = L.latLng(landmark.lat, landmark.lng);
                    bounds = bounds ? bounds.extend(spot) : L.latLngBounds(spot, spot);
                }
            }

            if (bounds) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
            else map.setView([0, 0], 2);
            // container mounts inside animated layouts; make sure sizing settles
            setTimeout(() => map.invalidateSize(), 50);
        })();

        return () => { cancelled = true; };
    }, [shapes, landmarks, highlightId, colorBy, interactive, onSelect, applyBasemap]);

    useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; tilesRef.current = null; }, []);

    // Live position dot + inside/outside check against the highlighted territory.
    useEffect(() => {
        if (!showLocation) return;
        // Browsers only grant geolocation on HTTPS (or localhost); say so instead of failing silently
        if (!window.isSecureContext) {
            setLocationError('Location needs a secure (https://) address — open the app over HTTPS.');
            return;
        }
        if (!navigator.geolocation) {
            setLocationError('This browser has no location support.');
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const L = leafletRef.current;
                const map = mapRef.current;
                if (!L || !map) return;

                const { latitude, longitude, accuracy } = position.coords;
                positionRef.current = [latitude, longitude];
                setLocationError('');

                locationLayerRef.current?.remove();
                const layer = L.layerGroup().addTo(map);
                locationLayerRef.current = layer;
                L.circle([latitude, longitude], { radius: Math.min(accuracy, 120), color: '#2563eb', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.12 }).addTo(layer);
                L.circleMarker([latitude, longitude], { radius: 7, color: '#ffffff', weight: 2.5, fillColor: '#2563eb', fillOpacity: 1, className: 'location-dot' }).addTo(layer);

                if (highlight) setInside(pointInGeometry(longitude, latitude, highlight.geometry));
            },
            (error) => {
                setLocationError(error.code === error.PERMISSION_DENIED
                    ? 'Allow location access to see yourself on the map.'
                    : 'Waiting for a GPS fix…');
            },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
        );

        return () => {
            navigator.geolocation.clearWatch(watchId);
            locationLayerRef.current?.remove();
        };
        // highlight identity is what matters for the inside check
    }, [showLocation, highlightId, shapes]); // eslint-disable-line react-hooks/exhaustive-deps

    const recenter = () => {
        const map = mapRef.current;
        if (!map) return;
        followRef.current = true;
        if (positionRef.current) {
            map.setView(positionRef.current, Math.max(map.getZoom(), 16));
        } else if (highlight) {
            const [[minLng, minLat], [maxLng, maxLat]] = geometryBounds(highlight.geometry);
            map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [30, 30] });
        }
    };

    return (
        <div className={`relative overflow-hidden ${className}`}>
            <div ref={containerRef} className="absolute inset-0 z-0" />

            {interactive && (
                <button
                    type="button"
                    onClick={() => setBasemap((prev) => (prev === 'streets' ? 'satellite' : 'streets'))}
                    aria-label={basemap === 'streets' ? 'Switch to satellite view' : 'Switch to map view'}
                    className={`absolute z-[500] flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 shadow-md backdrop-blur active:scale-95 ${basemap === 'satellite' ? 'bg-slate-800 text-white' : 'bg-white/95 text-slate-700'} ${layersClass}`}
                >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                        <path d="M12 3 2.5 8 12 13l9.5-5L12 3Z" />
                        <path d="m4.4 12-1.9 1 9.5 5 9.5-5-1.9-1" />
                        <path d="m4.4 16-1.9 1 9.5 5 9.5-5-1.9-1" />
                    </svg>
                </button>
            )}

            {showLocation && (
                <>
                    <button
                        type="button"
                        onClick={recenter}
                        aria-label="Center on my location"
                        className="absolute right-3 top-[max(env(safe-area-inset-top),12px)] z-[500] flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-indigo-600 shadow-md backdrop-blur active:scale-95"
                    >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" strokeLinecap="round" /></svg>
                    </button>

                    {highlight && inside !== null && (
                        <div className={`pointer-events-none absolute left-1/2 top-[max(env(safe-area-inset-top),12px)] z-[500] -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold shadow-md ${inside ? 'bg-emerald-600 text-white' : 'bg-white/95 text-slate-700 border border-slate-200 backdrop-blur'}`}>
                            {inside ? `You're inside ${highlight.name}` : `You're outside ${highlight.name}`}
                        </div>
                    )}
                    {locationError && (
                        <div className="absolute bottom-3 left-1/2 z-[500] -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/85 px-4 py-2 text-xs text-white">
                            {locationError}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
