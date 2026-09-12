import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

import type { Role } from './appState';

export type { Role };

export interface Session {
    userId: number;
    name: string;
    role: Role;
}

const SESSION_COOKIE = 'md_session';
const SESSION_DAYS = 30;
const secretPath = path.join(process.cwd(), 'data', 'auth-secret');

let cachedSecret: Uint8Array | null = null;

// AUTH_SECRET env wins; otherwise a generated secret persisted next to the data
// files so local sessions survive restarts. Read-only hosts must set the env var.
function getSecret(): Uint8Array {
    if (cachedSecret) return cachedSecret;

    const fromEnv = process.env.AUTH_SECRET;
    if (fromEnv) {
        cachedSecret = new TextEncoder().encode(fromEnv);
        return cachedSecret;
    }

    try {
        cachedSecret = new TextEncoder().encode(fs.readFileSync(secretPath, 'utf8').trim());
        return cachedSecret;
    } catch {
        // fall through to generating one
    }

    const generated = crypto.randomBytes(32).toString('base64url');
    try {
        fs.mkdirSync(path.dirname(secretPath), { recursive: true });
        fs.writeFileSync(secretPath, generated);
    } catch {
        throw new Error('Set AUTH_SECRET: no env var found and the data directory is not writable.');
    }
    cachedSecret = new TextEncoder().encode(generated);
    return cachedSecret;
}

export function hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
}

export function generateToken(): string {
    return crypto.randomBytes(16).toString('base64url');
}

export async function createSession(session: Session) {
    const jwt = await new SignJWT({ uid: session.userId, name: session.name, role: session.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DAYS}d`)
        .sign(getSecret());

    (await cookies()).set(SESSION_COOKIE, jwt, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_DAYS * 24 * 60 * 60,
        path: '/',
    });
}

export async function destroySession() {
    (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, getSecret());
        if (typeof payload.uid !== 'number') return null;
        return {
            userId: payload.uid,
            name: String(payload.name || ''),
            role: (payload.role as Role) || 'publisher',
        };
    } catch {
        return null;
    }
}

export function isAdminRole(role: Role): boolean {
    return role === 'territory_servant' || role === 'territory_team';
}

// Route handlers call this; pages use getSession + redirect instead.
export async function requireSession(adminOnly = false): Promise<Session | null> {
    const session = await getSession();
    if (!session) return null;
    if (adminOnly && !isAdminRole(session.role)) return null;
    return session;
}
