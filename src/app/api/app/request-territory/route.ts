import { NextResponse } from 'next/server';
import { getActiveCheckoutForUser, getUserById, updateUser } from '@/lib/appState';
import { getSession } from '@/lib/auth';

// Publisher raises (or withdraws) a hand for a territory; admins see it highlighted.
export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    const user = await getUserById(session.userId);
    if (!user) return NextResponse.json({ error: 'Account no longer exists.' }, { status: 401 });
    if (user.status === 'pending') return NextResponse.json({ error: 'Your account is still waiting for approval.' }, { status: 403 });

    try {
        const body = await request.json();
        const on = Boolean(body.on);

        if (on && await getActiveCheckoutForUser(user.id)) {
            return NextResponse.json({ error: 'You already hold a territory.' }, { status: 409 });
        }

        await updateUser(user.id, { requested_at: on ? new Date().toISOString() : null });
        return NextResponse.json({ success: true, requested: on });
    } catch {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
}
