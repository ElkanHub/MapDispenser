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

        const polygon = geometries.find((g) => isTerritoryGeometry(g));
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

    return { placemarks, points };
}
