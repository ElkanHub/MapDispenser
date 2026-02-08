import { NextResponse } from 'next/server';
import { getTerritories, toggleTerritoryActive } from '@/lib/dispenserState';

export async function GET() {
    const territories = getTerritories();
    return NextResponse.json(territories);
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id } = body;

        if (typeof id !== 'number') {
            return NextResponse.json(
                { error: 'Invalid territory ID' },
                { status: 400 }
            );
        }

        const success = toggleTerritoryActive(id);

        if (!success) {
            return NextResponse.json(
                { error: 'Territory not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }
}
