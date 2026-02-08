import { NextResponse } from 'next/server';
import { getStats } from '@/lib/dispenserState';

export async function GET() {
    const stats = getStats();
    return NextResponse.json(stats);
}
