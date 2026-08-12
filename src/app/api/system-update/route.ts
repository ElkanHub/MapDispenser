import { NextResponse } from 'next/server';
import { getSystemUpdate } from '@/lib/dispenserState';

// always read the live backend, never a cached render
export const dynamic = 'force-dynamic';

export async function GET() {
    const update = await getSystemUpdate();
    return NextResponse.json(update || { no_update: true });
}
