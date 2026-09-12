import { NextResponse } from 'next/server';
import { getSettings, getUserById, stripHash } from '@/lib/appState';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    const [user, settings] = await Promise.all([getUserById(session.userId), getSettings()]);
    if (!user) return NextResponse.json({ error: 'Account no longer exists.' }, { status: 401 });

    return NextResponse.json({
        user: stripHash(user),
        congregationName: settings?.congregation_name || '',
    });
}
