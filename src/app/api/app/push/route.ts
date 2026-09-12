import { NextResponse } from 'next/server';
import { removePushSubscription, savePushSubscription } from '@/lib/appState';
import { getSession } from '@/lib/auth';
import { getPushPublicKey } from '@/lib/push';

export const dynamic = 'force-dynamic';

// The client needs the VAPID public key to subscribe.
export async function GET() {
    const publicKey = getPushPublicKey();
    return NextResponse.json(publicKey ? { publicKey } : { disabled: true });
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    try {
        const body = await request.json();
        const subscription = body.subscription;
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
            return NextResponse.json({ error: 'Invalid subscription.' }, { status: 400 });
        }
        await savePushSubscription(session.userId, subscription);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
}

export async function DELETE(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    try {
        const body = await request.json();
        if (body.endpoint) await removePushSubscription(String(body.endpoint));
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
}
