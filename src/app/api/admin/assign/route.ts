import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { assignSpecificTerritory } from '@/lib/dispenserState';

export async function POST(request: Request) {
    const session = await requireSession(true);
    if (!session) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });

    try {
        const body = await request.json();
        const { id } = body;

        if (typeof id !== 'number') {
            return NextResponse.json(
                { error: 'Invalid territory ID' },
                { status: 400 }
            );
        }

        const success = await assignSpecificTerritory(id);

        if (!success) {
            return NextResponse.json(
                { error: 'Territory not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }
}
