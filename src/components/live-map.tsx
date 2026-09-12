'use client';

import { useEffect, useRef, useState } from 'react';
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

interface LiveMapProps {
    shapes: MapShape[];
    highlightId?: number;
    colorBy?: 'status' | 'highlight';
    showLocation?: boolean;
    onSelect?: (id: number) => void;
    className?: string;
    interactive?: boolean;
}

const STATUS_COLORS = { available: '#059669', assigned: '#d97706', inactive: '#94a3b8' };
const HIGHLIGHT_COLOR = '#4f46e5';
const NEUTRAL_COLOR = '#64748b';

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
    highlightId,
    colorBy = 'highlight',
    showLocation = false,
    onSelect,
    className = '',
    interactive = true,
}: LiveMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Leaflet.Map | null>(null);
    const leafletRef = useRef<typeof Leaflet | null>(null);
    const shapeLayerRef = useRef<Leaflet.LayerGroup | null>(null);
    const locationLayerRef = useRef<Leaflet.LayerGroup | null>(null);
    const followRef = useRef(true);
    const [inside, setInside] = useState<boolean | null>(null);
    const [locationError, setLocationError] = useState('');
    const positionRef = useRef<[number, number] | null>(null);

    const highlight = shapes.find((shape) => shape.id === highlightId);

    // Create the map once, then redraw polygons whenever the data changes.
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
                });
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; OpenStreetMap contributors',
                }).addTo(map);
                if (interactive) L.control.zoom({ position: 'bottomright' }).addTo(map);
                map.on('dragstart', () => { followRef.current = false; });
                mapRef.current = map;
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

            if (bounds) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
            else map.setView([0, 0], 2);
            // container mounts inside animated layouts; make sure sizing settles
            setTimeout(() => map.invalidateSize(), 50);
        })();

        return () => { cancelled = true; };
    }, [shapes, highlightId, colorBy, interactive, onSelect]);

    useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

    // Live position dot + inside/outside check against the highlighted territory.
    useEffect(() => {
        if (!showLocation || !navigator.geolocation) return;

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

            {showLocation && (
                <>
                    <button
                        type="button"
                        onClick={recenter}
                        aria-label="Center on my location"
                        className="absolute right-3 top-3 z-[500] flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-indigo-600 shadow-md active:scale-95"
                    >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" strokeLinecap="round" /></svg>
                    </button>

                    {highlight && inside !== null && (
                        <div className={`absolute left-1/2 top-3 z-[500] -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold shadow-md ${inside ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
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
