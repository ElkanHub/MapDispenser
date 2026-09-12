import { NextResponse } from 'next/server';
import { countUsers, getSettings } from '@/lib/appState';

export const dynamic = 'force-dynamic';

// Public: tells the login/signup screens whether this is a fresh install.
export async function GET() {
    try {
        const [users, settings] = await Promise.all([countUsers(), getSettings()]);
        return NextResponse.json({
            needsSetup: users === 0,
            congregationName: settings?.congregation_name || null,
        });
    } catch (error) {
        // surface the real reason (bad DATABASE_URL, backend misconfig) instead
        // of letting the signup screen guess the wrong mode
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Database not reachable.' },
            { status: 500 }
        );
    }
}
