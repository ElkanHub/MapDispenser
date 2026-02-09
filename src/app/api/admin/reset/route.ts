import { NextResponse } from 'next/server';
import { resetAssignments } from '@/lib/dispenserState';

export async function POST() {
    resetAssignments();
    return NextResponse.json({ success: true, message: 'System reset successfully' });
}
