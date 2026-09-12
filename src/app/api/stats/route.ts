import { NextResponse } from 'next/server';
import { getActiveCheckouts } from '@/lib/appState';
import { getStats } from '@/lib/dispenserState';

export const dynamic = 'force-dynamic';

export async function GET() {
    const [stats, active] = await Promise.all([getStats(), getActiveCheckouts()]);

    // Availability now follows live checkouts, not the legacy anonymous history;
    // totalAssignments stays as the all-time counter it always was.
    const held = new Set(active.map((checkout) => checkout.territory_id));
    const assigned = Math.min(stats.active, held.size);
    const remaining = Math.max(0, stats.active - assigned);

    return NextResponse.json({ ...stats, assigned, remaining, isExhausted: remaining === 0 });
}
