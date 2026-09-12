import { NextResponse } from 'next/server';
import { createCheckout, getActiveCheckouts } from '@/lib/appState';
import { getTerritories } from '@/lib/dispenserState';

export const dynamic = 'force-dynamic';

// QR claim: checks out the next free territory as a magic-link assignment.
export async function GET() {
    const [territories, active] = await Promise.all([getTerritories(), getActiveCheckouts()]);
    const held = new Set(active.map((checkout) => checkout.territory_id));
    const next = territories.find((territory) => territory.active && !held.has(territory.id));

    if (!next) {
        return NextResponse.json(
            { error: 'All territories assigned', exhausted: true },
            { status: 410 } // 410 Gone
        );
    }

    const checkout = await createCheckout({ territoryId: next.id, holderName: 'QR claim', assignedBy: 'QR dispenser' });
    if ('error' in checkout) {
        return NextResponse.json({ error: checkout.error, exhausted: false }, { status: 409 });
    }

    return NextResponse.json({ territory: next, token: checkout.token });
}
