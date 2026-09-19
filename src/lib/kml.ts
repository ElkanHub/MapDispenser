import JSZip from 'jszip';
import { kml as kmlToGeoJson } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

import { isTerritoryGeometry, type TerritoryGeometry } from './geo';

export interface ParsedPlacemark {
    name: string;
    description: string;
    color: string;
    geometry: TerritoryGeometry;
}

export interface ParsedPoint {
    name: string;
    description: string;
    color: string;
    lng: number;
    lat: number;
}

export interface ParsedKml {
    placemarks: ParsedPlacemark[];
    points: ParsedPoint[];
}

// KML colors are aabbggrr; the app wants #rrggbb.
function kmlColorToHex(value: unknown): string {
    if (typeof value !== 'string') return '';
    const match = value.replace('#', '').match(/^[0-9a-fA-F]{8}$/) ? value.replace('#', '') : '';
    if (!match) {
        // togeojson may already emit css hex (#rrggbb)
        return /^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value) : '';
    }
    const bb = match.slice(2, 4);
    const gg = match.slice(4, 6);
    const rr = match.slice(6, 8);
    return `#${rr}${gg}${bb}`.toLowerCase();
}

function stripHtml(value: string): string {
    return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Google Earth users habitually outline territories with "Add Path" instead of
// "Add Polygon". A path that comes back to (or near) its start is clearly meant
// as an area, so rescue it as a polygon instead of silently dropping it.
function closedPathToPolygon(geometry: { type?: string; coordinates?: unknown }): TerritoryGeometry | null {
    if (geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return null;
    const coords = geometry.coordinates as number[][];
    if (coords.length < 4) return null;

    const first = coords[0];
    const last = coords[coords.length - 1];
    const lngs = coords.map((point) => point[0]);
    const lats = coords.map((point) => point[1]);
    const diagonal = Math.hypot(Math.max(...lngs) - Math.min(...lngs), Math.max(...lats) - Math.min(...lats));
    const gap = Math.hypot(first[0] - last[0], first[1] - last[1]);

    // closed, or nearly closed: within ~33m or 15% of the shape's own size
    if (gap > Math.max(0.0003, diagonal * 0.15)) return null;

    const ring = gap === 0 ? coords : [...coords, first];
    return { type: 'Polygon', coordinates: [ring] };
}

// Accepts a KMZ (zip with a .kml inside) or a bare KML file.
export async function parseKmzOrKml(buffer: Buffer, filename: string): Promise<ParsedKml> {
    let kmlText: string;

    if (filename.toLowerCase().endsWith('.kml') || buffer.subarray(0, 5).toString('utf8').startsWith('<?xml')) {
        kmlText = buffer.toString('utf8');
    } else {
        const zip = await JSZip.loadAsync(buffer);
        const entry = Object.values(zip.files).find((file) => !file.dir && file.name.toLowerCase().endsWith('.kml'));
        if (!entry) throw new Error('No .kml file found inside the KMZ.');
        kmlText = await entry.async('text');
    }

    const dom = new DOMParser().parseFromString(kmlText, 'text/xml');
    // togeojson expects a browser Document; xmldom's is structurally compatible
    const collection = kmlToGeoJson(dom as unknown as Document);

    const placemarks: ParsedPlacemark[] = [];
    const points: ParsedPoint[] = [];
    for (const feature of collection.features) {
        if (!feature.geometry) continue;

        const props = (feature.properties || {}) as Record<string, unknown>;
        // CDATA descriptions arrive as { "@type": "html", value: "..." }
        const rawDescription = props.description && typeof props.description === 'object'
            ? String((props.description as { value?: unknown }).value || '')
            : String(props.description || '');
        const name = String(props.name || '').trim();
        const description = stripHtml(rawDescription);

        // GeometryCollections from Google Earth folders: pull out the polygon/point
        const geometries = feature.geometry.type === 'GeometryCollection'
            ? feature.geometry.geometries
            : [feature.geometry];

        let polygon = geometries.find((g) => isTerritoryGeometry(g));
        if (!polygon) {
            for (const candidate of geometries) {
                const rescued = closedPathToPolygon(candidate as { type?: string; coordinates?: unknown });
                if (rescued) { polygon = rescued; break; }
            }
        }
        const point = geometries.find((g) => g.type === 'Point');

        if (polygon && isTerritoryGeometry(polygon)) {
            placemarks.push({
                name,
                description,
                color: kmlColorToHex(props.fill) || kmlColorToHex(props.stroke) || '',
                geometry: polygon,
            });
        } else if (point && point.type === 'Point' && Array.isArray(point.coordinates)) {
            const [lng, lat] = point.coordinates as number[];
            if (Number.isFinite(lng) && Number.isFinite(lat)) {
                points.push({
                    name,
                    description,
                    color: kmlColorToHex(props['icon-color']) || kmlColorToHex(props['marker-color']) || kmlColorToHex(props.stroke) || '',
                    lng,
                    lat,
                });
            }
        }
    }

    // Google Earth's "My Places" export often contains whole copies of the same
    // map several times over; collapse identical shapes so the preview is clean.
    const seen = new Set<string>();
    const uniquePlacemarks = placemarks.filter((placemark) => {
        const head = (placemark.geometry.coordinates as unknown[]).flat(3).slice(0, 8)
            .map((value) => Number(value).toFixed(5)).join(',');
        const key = `poly|${placemark.name.toLowerCase()}|${head}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const uniquePoints = points.filter((point) => {
        const key = `pin|${point.name.toLowerCase()}|${point.lng.toFixed(5)},${point.lat.toFixed(5)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return { placemarks: uniquePlacemarks, points: uniquePoints };
}
