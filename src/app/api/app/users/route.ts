import { NextResponse } from 'next/server';
import { deleteUser, getUserById, updateUser, type Role } from '@/lib/appState';
import { hashPassword, requireSession } from '@/lib/auth';
import { sendPushToUsers } from '@/lib/push';

const ROLES: Role[] = ['publisher', 'territory_team', 'territory_servant'];

export async function POST(request: Request) {
    const session = await requireSession(true);
    if (!session) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });

    try {
        const body = await request.json();
        const id = Number(body.id);
        const target = await getUserById(id);
        if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

        // only the territory servant manages people; team members read but don't write
        if (session.role !== 'territory_servant') {
            return NextResponse.json({ error: 'Only the territory servant can manage people.' }, { status: 403 });
        }

        switch (body.action) {
            case 'approve':
                await updateUser(id, { status: 'active' });
                await sendPushToUsers([id], {
                    title: 'Account approved ✅',
                    body: 'Welcome aboard — you can now see your territory when one is assigned.',
                    url: '/home',
                });
                break;
            case 'role': {
                const role = body.role as Role;
                if (!ROLES.includes(role)) return NextResponse.json({ error: 'Unknown role.' }, { status: 400 });
                if (id === session.userId && role !== 'territory_servant') {
                    return NextResponse.json({ error: 'You cannot demote yourself.' }, { status: 400 });
                }
                await updateUser(id, { role, status: 'active' });
                break;
            }
            case 'password': {
                const password = String(body.password || '');
                if (password.length < 6) return NextResponse.json({ error: 'New password needs at least 6 characters.' }, { status: 400 });
                await updateUser(id, { password_hash: hashPassword(password) });
                break;
            }
            case 'remove':
                if (id === session.userId) return NextResponse.json({ error: 'You cannot remove yourself.' }, { status: 400 });
                await deleteUser(id);
                break;
            default:
                return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
}
