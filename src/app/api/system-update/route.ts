import { NextResponse } from 'next/server';
import { getSystemUpdate } from '@/lib/dispenserState';

export async function GET() {
    const update = getSystemUpdate();
    return NextResponse.json(update || { no_update: true });
}
