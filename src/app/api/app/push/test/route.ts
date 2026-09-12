import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPushPublicKey, sendPushToUsers } from '@/lib/push';

// Sends a notification to the caller's own devices, so people can verify
// their setup without waiting for a real event.
export async function POST() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    if (!getPushPublicKey()) return NextResponse.json({ error: 'Push is not configured on this server.' }, { status: 503 });

    await sendPushToUsers([session.userId], {
        title: 'Notifications are working 🎉',
        body: `Hi ${session.name.split(' ')[0]} — you'll be told here when something needs your attention.`,
        url: '/',
    });
    return NextResponse.json({ success: true });
}
