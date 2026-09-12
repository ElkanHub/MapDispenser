import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/appState';
import { requireSession } from '@/lib/auth';

export async function POST(request: Request) {
    const session = await requireSession(true);
    if (!session) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });
    if (session.role !== 'territory_servant') {
        return NextResponse.json({ error: 'Only the territory servant can change codes.' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const settings = await getSettings();
        if (!settings) return NextResponse.json({ error: 'Congregation not set up yet.' }, { status: 400 });

        const code = String(body.code || '').trim().toUpperCase();
        if (code.length < 4) return NextResponse.json({ error: 'Codes need at least 4 characters.' }, { status: 400 });

        if (body.kind === 'join') settings.join_code = code;
        else if (body.kind === 'team') settings.team_code = code;
        else return NextResponse.json({ error: 'Unknown code kind.' }, { status: 400 });

        await saveSettings(settings);
        return NextResponse.json({ success: true, settings });
    } catch {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
}
