import { NextResponse } from 'next/server';
import { resetAssignments } from '@/lib/dispenserState';

export async function POST() {
    await resetAssignments();
    return NextResponse.json({ success: true, message: 'System reset successfully' });
}
