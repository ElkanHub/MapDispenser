import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/appState';
import { createSession, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        const user = email ? await findUserByEmail(email) : null;
        if (!user || !verifyPassword(password, user.password_hash)) {
            return NextResponse.json({ error: 'Wrong email or password.' }, { status: 401 });
        }

        await createSession({ userId: user.id, name: user.name, role: user.role });
        return NextResponse.json({ success: true, role: user.role, status: user.status });
    } catch {
        return NextResponse.json({ error: 'Sign in failed.' }, { status: 500 });
    }
}
