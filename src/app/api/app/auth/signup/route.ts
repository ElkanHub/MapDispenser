import { NextResponse } from 'next/server';
import { countUsers, createUser, findUserByEmail, getSettings, saveSettings, type Role, type UserStatus } from '@/lib/appState';
import { createSession, hashPassword } from '@/lib/auth';

const normalizeCode = (value: unknown) => String(value || '').trim().toUpperCase();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const name = String(body.name || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        if (!name || !email.includes('@') || password.length < 6) {
            return NextResponse.json({ error: 'Enter your name, a valid email, and a password of at least 6 characters.' }, { status: 400 });
        }
        if (await findUserByEmail(email)) {
            return NextResponse.json({ error: 'An account with this email already exists. Sign in instead.' }, { status: 409 });
        }

        let role: Role = 'publisher';
        let status: UserStatus = 'pending';

        if ((await countUsers()) === 0) {
            // First account: congregation setup. This person becomes the territory servant.
            const congregationName = String(body.congregationName || '').trim();
            const joinCode = normalizeCode(body.joinCode);
            const teamCode = normalizeCode(body.teamCode);
            if (!congregationName || !joinCode || !teamCode) {
                return NextResponse.json({ error: 'Set the congregation name, a join code, and a team code.' }, { status: 400 });
            }
            await saveSettings({ congregation_name: congregationName, join_code: joinCode, team_code: teamCode });
            role = 'territory_servant';
            status = 'active';
        } else {
            const settings = await getSettings();
            if (!settings || normalizeCode(body.joinCode) !== normalizeCode(settings.join_code)) {
                return NextResponse.json({ error: 'That congregation code is not recognized.' }, { status: 403 });
            }
            const teamCode = normalizeCode(body.teamCode);
            if (teamCode) {
                if (teamCode !== normalizeCode(settings.team_code)) {
                    return NextResponse.json({ error: 'That territory-team code is not recognized. Leave it empty to join as a publisher.' }, { status: 403 });
                }
                role = 'territory_team';
                status = 'active';
            }
        }

        const user = await createUser({ name, email, password_hash: hashPassword(password), role, status });
        await createSession({ userId: user.id, name: user.name, role: user.role });
        return NextResponse.json({ success: true, role: user.role, status: user.status });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Sign up failed.' }, { status: 500 });
    }
}
