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

        // groups: one call can put several people on the same territory
        const userIds: number[] = Array.isArray(body.userIds)
            ? body.userIds.map(Number)
            : body.userId ? [Number(body.userId)] : [];

        const created = [];
        const errors: string[] = [];

        if (userIds.length) {
            for (const userId of userIds) {
                const user = await getUserById(userId);
                if (!user) {
                    errors.push('One person no longer has an account.');
                    continue;
                }
                const result = await createCheckout({ territoryId, userId: user.id, holderName: user.name, assignedBy: session.name });
                if ('error' in result) {
                    errors.push(`${user.name}: ${result.error}`);
                    continue;
                }
                created.push({ ...result, holder_name: user.name });
                await sendPushToUsers([user.id], {
                    title: 'Territory assigned to you 🗺️',
                    body: `${territory.territory_name} is yours — tap to open your map.`,
                    url: '/home',
                });
            }
        } else {
            const holderName = String(body.holderName || '').trim();
            const result = await createCheckout({ territoryId, userId: null, holderName, assignedBy: session.name });
            if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 });
            created.push(result);
        }

        if (!created.length) {
            return NextResponse.json({ error: errors.join(' ') || 'Nobody could be assigned.' }, { status: 409 });
        }

        return NextResponse.json({ success: true, checkouts: created, checkout: created[0], errors });
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
