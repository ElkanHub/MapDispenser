import { NextResponse } from 'next/server';
import { upsertLandmarks } from '@/lib/appState';
import { requireSession } from '@/lib/auth';
import { getTerritories, setTerritoryGeometry, uploadTerritories, type Territory } from '@/lib/dispenserState';
import { isTerritoryGeometry } from '@/lib/geo';
import { parseKmzOrKml } from '@/lib/kml';

export const dynamic = 'force-dynamic';

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

// Step 1 — upload a KMZ/KML, get back a matched preview. Nothing is written yet.
export async function POST(request: Request) {
    const session = await requireSession(true);
    if (!session) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });

    try {
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File)) return NextResponse.json({ error: 'Attach a .kmz or .kml file.' }, { status: 400 });

        const { placemarks, points } = await parseKmzOrKml(Buffer.from(await file.arrayBuffer()), file.name);
        if (!placemarks.length && !points.length) {
            return NextResponse.json({ error: 'No polygons or pins found in this file. Draw territories as polygons in Google Earth, then export again.' }, { status: 400 });
        }

        const territories = await getTerritories();
        const byName = new Map(territories.map((territory) => [normalizeName(territory.territory_name), territory]));

        const items = placemarks.map((placemark, index) => {
            const match = placemark.name ? byName.get(normalizeName(placemark.name)) : undefined;
            return {
                key: index,
                name: placemark.name || `Unnamed ${index + 1}`,
                description: placemark.description,
                color: placemark.color,
                geometry: placemark.geometry,
                territoryId: match?.id ?? null,
                matchName: match?.territory_name ?? null,
                include: Boolean(placemark.name),
            };
        });

        const landmarks = points.map((point, index) => ({
            key: index,
            name: point.name || `Pin ${index + 1}`,
            description: point.description,
            color: point.color,
            lng: point.lng,
            lat: point.lat,
            include: true,
        }));

        return NextResponse.json({ items, landmarks, existing: territories.length });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not read that file.' }, { status: 400 });
    }
}

// Step 2 — apply the confirmed preview.
export async function PUT(request: Request) {
    const session = await requireSession(true);
    if (!session) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });

    try {
        const body = await request.json();
        const items = Array.isArray(body.items) ? body.items : [];

        let updated = 0;
        const created: Territory[] = [];
        const territories = await getTerritories();
        let nextId = territories.reduce((max, territory) => Math.max(max, territory.id), 0) + 1;

        for (const item of items) {
            if (!item.include || !isTerritoryGeometry(item.geometry)) continue;
            const color = String(item.color || '');

            if (item.territoryId) {
                if (await setTerritoryGeometry(Number(item.territoryId), item.geometry, color)) updated += 1;
            } else {
                created.push({
                    id: nextId++,
                    territory_name: String(item.name || '').trim() || `Territory ${nextId - 1}`,
                    map_link: '',
                    map_image_url: '',
                    map_description: String(item.description || ''),
                    active: true,
                    geometry: item.geometry,
                    color,
                });
            }
        }

        if (created.length) await uploadTerritories(created);

        const landmarks = (Array.isArray(body.landmarks) ? body.landmarks : [])
            .filter((landmark: { include?: boolean; name?: unknown; lng?: unknown; lat?: unknown }) =>
                landmark.include && landmark.name && Number.isFinite(Number(landmark.lng)) && Number.isFinite(Number(landmark.lat)))
            .map((landmark: { name: unknown; description?: unknown; color?: unknown; lng: unknown; lat: unknown }) => ({
                name: String(landmark.name).trim(),
                description: String(landmark.description || ''),
                color: String(landmark.color || ''),
                lng: Number(landmark.lng),
                lat: Number(landmark.lat),
            }));
        const pins = landmarks.length ? await upsertLandmarks(landmarks) : 0;

        return NextResponse.json({ success: true, updated, created: created.length, pins });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed.' }, { status: 400 });
    }
}
