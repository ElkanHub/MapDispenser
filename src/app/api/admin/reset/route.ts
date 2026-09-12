import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { resetAssignments } from '@/lib/dispenserState';

export async function POST() {
    const session = await requireSession(true);
    if (!session) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });

    await resetAssignments();
    return NextResponse.json({ success: true, message: 'System reset successfully' });
}
