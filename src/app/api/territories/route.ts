import { NextResponse } from 'next/server';
import { getTerritories, toggleTerritoryActive, setTerritoriesActive, uploadTerritories } from '@/lib/dispenserState';

// always read the live backend, never a cached render
export const dynamic = 'force-dynamic';

export async function GET() {
    const territories = await getTerritories();
    return NextResponse.json(territories);
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();

        if (body.ids && Array.isArray(body.ids) && typeof body.active === 'boolean') {
            const success = await setTerritoriesActive(body.ids, body.active);
            if (!success) {
                return NextResponse.json(
                    { error: 'Failed to update territories' },
                    { status: 500 }
                );
            }
            return NextResponse.json({ success: true });
        }

        const { id } = body;

        if (typeof id !== 'number') {
            return NextResponse.json(
                { error: 'Invalid territory ID' },
                { status: 400 }
            );
        }

        const success = await toggleTerritoryActive(id);

        if (!success) {
            return NextResponse.json(
                { error: 'Territory not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const territories = Array.isArray(body) ? body : body.territories;

        if (!Array.isArray(territories)) {
            return NextResponse.json(
                { error: 'Upload must be a JSON array or { territories: [] }.' },
                { status: 400 }
            );
        }

        const count = await uploadTerritories(territories);
        return NextResponse.json({ success: true, count });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Invalid upload payload' },
            { status: 400 }
        );
    }
}
