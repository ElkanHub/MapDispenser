import { NextResponse } from 'next/server';
import { createCheckout, endCheckout, getUserById } from '@/lib/appState';
import { requireSession } from '@/lib/auth';
import { getTerritoryById } from '@/lib/dispenserState';

export async function POST(request: Request) {
    const session = await requireSession(true);
    if (!session) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });

    try {
        const body = await request.json();
        const territoryId = Number(body.territoryId);
        const territory = await getTerritoryById(territoryId);
        if (!territory) return NextResponse.json({ error: 'Territory not found.' }, { status: 404 });
        if (!territory.active) return NextResponse.json({ error: 'This territory is inactive. Activate it first.' }, { status: 400 });

        let userId: number | null = null;
        let holderName = String(body.holderName || '').trim();
        if (body.userId) {
            const user = await getUserById(Number(body.userId));
            if (!user) return NextResponse.json({ error: 'That person no longer has an account.' }, { status: 404 });
            userId = user.id;
            holderName = user.name;
        }

        const result = await createCheckout({ territoryId, userId, holderName, assignedBy: session.name });
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 });

        return NextResponse.json({ success: true, checkout: result });
    } catch {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
}

export async function PATCH(request: Request) {
    const session = await requireSession(true);
    if (!session) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });

    try {
        const body = await request.json();
        const status = body.status === 'returned' ? 'returned' : 'cleared';
        const success = await endCheckout(Number(body.checkoutId), status);
        if (!success) return NextResponse.json({ error: 'No active checkout with that id.' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
}
