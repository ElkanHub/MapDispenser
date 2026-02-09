import { NextResponse } from 'next/server';
import { assignSpecificTerritory } from '@/lib/dispenserState';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id } = body;

        if (typeof id !== 'number') {
            return NextResponse.json(
                { error: 'Invalid territory ID' },
                { status: 400 }
            );
        }

        const success = assignSpecificTerritory(id);

        if (!success) {
            return NextResponse.json(
                { error: 'Territory not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }
}
