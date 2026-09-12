import { NextResponse } from 'next/server';
import { createCheckout, endCheckout, getUserById, listCheckouts } from '@/lib/appState';
import { requireSession } from '@/lib/auth';
import { getTerritoryById } from '@/lib/dispenserState';
import { sendPushToUsers } from '@/lib/push';

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

        if (userId) {
            await sendPushToUsers([userId], {
                title: 'Territory assigned to you 🗺️',
                body: `${territory.territory_name} is yours — tap to open your map.`,
                url: '/home',
            });
        }

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
        const checkoutId = Number(body.checkoutId);
        const checkout = (await listCheckouts()).find((item) => item.id === checkoutId);
        const success = await endCheckout(checkoutId, status);
        if (!success) return NextResponse.json({ error: 'No active checkout with that id.' }, { status: 404 });

        if (checkout?.user_id) {
            const territory = await getTerritoryById(checkout.territory_id);
            await sendPushToUsers([checkout.user_id], {
                title: 'Territory returned',
                body: `${territory?.territory_name || 'Your territory'} has been cleared from you. Its link no longer works.`,
                url: '/home',
            });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
}
