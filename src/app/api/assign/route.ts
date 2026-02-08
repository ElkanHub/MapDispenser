import { NextResponse } from 'next/server';
import { assignNextTerritory, getStats } from '@/lib/dispenserState';

export async function GET() {
    // Add a small artificial delay to simulate processing time if needed
    // await new Promise(resolve => setTimeout(resolve, 500));

    const stats = getStats();

    if (stats.remaining === 0) {
        return NextResponse.json(
            { error: 'All territories assigned', exhausted: true },
            { status: 410 } // 410 Gone
        );
    }

    const territory = assignNextTerritory();

    if (!territory) {
        return NextResponse.json(
            { error: 'Failed to assign territory', exhausted: true },
            { status: 500 }
        );
    }

    return NextResponse.json({ territory });
}
