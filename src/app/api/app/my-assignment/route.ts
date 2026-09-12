import { NextResponse } from 'next/server';
import { getActiveCheckoutForUser, getUserById, listLandmarks } from '@/lib/appState';
import { getSession } from '@/lib/auth';
import { getTerritoryById } from '@/lib/dispenserState';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    const user = await getUserById(session.userId);
    if (!user) return NextResponse.json({ error: 'Account no longer exists.' }, { status: 401 });
    if (user.status === 'pending') return NextResponse.json({ pending: true });

    const checkout = await getActiveCheckoutForUser(session.userId);
    if (!checkout) return NextResponse.json({ none: true, requested: Boolean(user.requested_at) });

    const territory = await getTerritoryById(checkout.territory_id);
    if (!territory) return NextResponse.json({ none: true, requested: Boolean(user.requested_at) });

    return NextResponse.json({
        checkout: { id: checkout.id, assigned_at: checkout.assigned_at, token: checkout.token },
        territory,
        landmarks: await listLandmarks(),
    });
}
