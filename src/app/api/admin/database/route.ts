import { NextResponse } from 'next/server';
import { getDataBackend, setDataBackend, type DataBackend } from '@/lib/dispenserState';

// always read the live backend, never a cached render
export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({ backend: getDataBackend() });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const backend = body.backend as DataBackend;

        if (backend !== 'local' && backend !== 'neon') {
            return NextResponse.json(
                { error: 'Backend must be "local" or "neon".' },
                { status: 400 }
            );
        }

        setDataBackend(backend);
        return NextResponse.json({ success: true, backend });
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }
}
