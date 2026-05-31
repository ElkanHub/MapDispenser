import { NextResponse } from 'next/server';
import { assignNextTerritory, getStats } from '@/lib/dispenserState';

export async function GET() {
    const stats = await getStats();

    if (stats.remaining === 0) {
        return NextResponse.json(
            { error: 'All territories assigned', exhausted: true },
            { status: 410 } // 410 Gone
        );
    }

    const territory = await assignNextTerritory();

    if (!territory) {
        return NextResponse.json(
            { error: 'Failed to assign territory', exhausted: true },
            { status: 500 }
        );
    }

    return NextResponse.json({ territory });
}
