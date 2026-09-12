import { NextResponse } from 'next/server';
import { countUsers, getSettings } from '@/lib/appState';

export const dynamic = 'force-dynamic';

// Public: tells the login/signup screens whether this is a fresh install.
export async function GET() {
    const [users, settings] = await Promise.all([countUsers(), getSettings()]);
    return NextResponse.json({
        needsSetup: users === 0,
        congregationName: settings?.congregation_name || null,
    });
}
