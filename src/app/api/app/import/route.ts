import { NextResponse } from 'next/server';
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

        const placemarks = await parseKmzOrKml(Buffer.from(await file.arrayBuffer()), file.name);
        if (!placemarks.length) {
            return NextResponse.json({ error: 'No polygons found in this file. Draw territories as polygons in Google Earth, then export again.' }, { status: 400 });
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

        return NextResponse.json({ items, existing: territories.length });
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
        return NextResponse.json({ success: true, updated, created: created.length });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed.' }, { status: 400 });
    }
}
