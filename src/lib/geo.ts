// Small geometry helpers shared by the map screens and the KMZ importer.
// Coordinates follow GeoJSON order: [lng, lat].

export interface PolygonGeometry {
    type: 'Polygon';
    coordinates: number[][][];
}

export interface MultiPolygonGeometry {
    type: 'MultiPolygon';
    coordinates: number[][][][];
}

export type TerritoryGeometry = PolygonGeometry | MultiPolygonGeometry;

function polygonRings(geometry: TerritoryGeometry): number[][][] {
    return geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((polygon) => polygon[0]);
}

export function geometryCentroid(geometry: TerritoryGeometry): [number, number] {
    let lng = 0;
    let lat = 0;
    let count = 0;
    for (const ring of polygonRings(geometry)) {
        for (const [x, y] of ring) {
            lng += x;
            lat += y;
            count += 1;
        }
    }
    return count ? [lng / count, lat / count] : [0, 0];
}

export function geometryBounds(geometry: TerritoryGeometry): [[number, number], [number, number]] {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const ring of polygonRings(geometry)) {
        for (const [x, y] of ring) {
            if (x < minLng) minLng = x;
            if (y < minLat) minLat = y;
            if (x > maxLng) maxLng = x;
            if (y > maxLat) maxLat = y;
        }
    }
    return [[minLng, minLat], [maxLng, maxLat]];
}

// Ray casting, outer rings only — territory holes are not a thing in this app.
export function pointInGeometry(lng: number, lat: number, geometry: TerritoryGeometry): boolean {
    for (const ring of polygonRings(geometry)) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i];
            const [xj, yj] = ring[j];
            if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        if (inside) return true;
    }
    return false;
}

export function isTerritoryGeometry(value: unknown): value is TerritoryGeometry {
    const candidate = value as TerritoryGeometry | null;
    return Boolean(candidate
        && (candidate.type === 'Polygon' || candidate.type === 'MultiPolygon')
        && Array.isArray(candidate.coordinates)
        && candidate.coordinates.length > 0);
}
