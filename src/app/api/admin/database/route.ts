import { NextResponse } from 'next/server';
import { getDataBackend, setDataBackend, getTerritories, type DataBackend } from '@/lib/dispenserState';

// always read the live backend, never a cached render
export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({ backend: getDataBackend() });
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const backend = body?.backend as DataBackend | undefined;

    if (backend !== 'local' && backend !== 'neon') {
        return NextResponse.json(
            { error: 'Backend must be "local" or "neon".' },
            { status: 400 }
        );
    }

    const previous = getDataBackend();
    setDataBackend(backend);

    // Prove the new source actually answers before confirming the switch
    try {
        const territories = await getTerritories();
        return NextResponse.json({ success: true, backend, count: territories.length });
    } catch (error) {
        setDataBackend(previous);
        return NextResponse.json(
            { error: `Switched back to ${previous}: ${backend} is not reachable. ${error instanceof Error ? error.message : ''}`.trim() },
            { status: 502 }
        );
    }
}
