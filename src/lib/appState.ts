import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { neon } from '@neondatabase/serverless';

import { getDataBackend, assignSpecificTerritory } from './dispenserState';
import { ensureNeonAppSchema } from './schema';

export type Role = 'publisher' | 'territory_team' | 'territory_servant';
export type UserStatus = 'pending' | 'active';
export type CheckoutStatus = 'active' | 'returned' | 'cleared';

export interface CongregationSettings {
    congregation_name: string;
    join_code: string;
    team_code: string;
}

export interface AppUser {
    id: number;
    name: string;
    email: string;
    role: Role;
    status: UserStatus;
    created_at: string;
    password_hash: string;
}

export type SafeUser = Omit<AppUser, 'password_hash'>;

export interface Checkout {
    id: number;
    territory_id: number;
    user_id: number | null;
    holder_name: string;
    token: string;
    status: CheckoutStatus;
    assigned_by: string;
    assigned_at: string;
    ended_at: string | null;
}

interface AppFileState {
    settings: CongregationSettings | null;
    users: AppUser[];
    checkouts: Checkout[];
    nextUserId: number;
    nextCheckoutId: number;
}

const appStatePath = path.join(process.cwd(), 'data', 'app-state.json');

function sql() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Neon backend requires DATABASE_URL.');
    return neon(url);
}

async function neonReady() {
    const db = sql();
    await ensureNeonAppSchema(db);
    return db;
}

// Read fresh on every call: the file is tiny and this keeps every worker honest.
function readLocal(): AppFileState {
    try {
        const state = JSON.parse(fs.readFileSync(appStatePath, 'utf8'));
        return {
            settings: state.settings || null,
            users: state.users || [],
            checkouts: state.checkouts || [],
            nextUserId: state.nextUserId || 1,
            nextCheckoutId: state.nextCheckoutId || 1,
        };
    } catch {
        return { settings: null, users: [], checkouts: [], nextUserId: 1, nextCheckoutId: 1 };
    }
}

function writeLocal(state: AppFileState) {
    fs.mkdirSync(path.dirname(appStatePath), { recursive: true });
    fs.writeFileSync(appStatePath, JSON.stringify(state, null, 2));
}

function generateToken(): string {
    return crypto.randomBytes(16).toString('base64url');
}

export function stripHash(user: AppUser): SafeUser {
    const safe = { ...user } as Partial<AppUser>;
    delete safe.password_hash;
    return safe as SafeUser;
}

// ---------------- congregation settings ----------------

export async function getSettings(): Promise<CongregationSettings | null> {
    if (getDataBackend() === 'neon') {
        const rows = await (await neonReady())`SELECT congregation_name, join_code, team_code FROM app_settings WHERE id = 1`;
        return rows.length ? (rows[0] as unknown as CongregationSettings) : null;
    }
    return readLocal().settings;
}

export async function saveSettings(settings: CongregationSettings) {
    if (getDataBackend() === 'neon') {
        await (await neonReady())`
            INSERT INTO app_settings (id, congregation_name, join_code, team_code)
            VALUES (1, ${settings.congregation_name}, ${settings.join_code}, ${settings.team_code})
            ON CONFLICT (id) DO UPDATE SET
                congregation_name = EXCLUDED.congregation_name,
                join_code = EXCLUDED.join_code,
                team_code = EXCLUDED.team_code`;
        return;
    }
    const state = readLocal();
    state.settings = settings;
    writeLocal(state);
}

// ---------------- users ----------------

export async function countUsers(): Promise<number> {
    if (getDataBackend() === 'neon') {
        const rows = await (await neonReady())`SELECT count(*)::int AS count FROM app_users`;
        return Number(rows[0]?.count || 0);
    }
    return readLocal().users.length;
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
    const normalized = email.trim().toLowerCase();
    if (getDataBackend() === 'neon') {
        const rows = await (await neonReady())`SELECT id, name, email, role, status, created_at::text, password_hash FROM app_users WHERE email = ${normalized}`;
        return rows.length ? normalizeUser(rows[0]) : null;
    }
    return readLocal().users.find((user) => user.email === normalized) || null;
}

export async function getUserById(id: number): Promise<AppUser | null> {
    if (getDataBackend() === 'neon') {
        const rows = await (await neonReady())`SELECT id, name, email, role, status, created_at::text, password_hash FROM app_users WHERE id = ${id}`;
        return rows.length ? normalizeUser(rows[0]) : null;
    }
    return readLocal().users.find((user) => user.id === id) || null;
}

function normalizeUser(row: Record<string, unknown>): AppUser {
    return {
        id: Number(row.id),
        name: String(row.name),
        email: String(row.email),
        role: row.role as Role,
        status: row.status as UserStatus,
        created_at: String(row.created_at),
        password_hash: String(row.password_hash),
    };
}

export async function createUser(input: { name: string; email: string; password_hash: string; role: Role; status: UserStatus }): Promise<AppUser> {
    const email = input.email.trim().toLowerCase();

    if (getDataBackend() === 'neon') {
        const rows = await (await neonReady())`
            INSERT INTO app_users (name, email, password_hash, role, status)
            VALUES (${input.name.trim()}, ${email}, ${input.password_hash}, ${input.role}, ${input.status})
            RETURNING id, name, email, role, status, created_at::text, password_hash`;
        return normalizeUser(rows[0]);
    }

    const state = readLocal();
    const user: AppUser = {
        id: state.nextUserId,
        name: input.name.trim(),
        email,
        password_hash: input.password_hash,
        role: input.role,
        status: input.status,
        created_at: new Date().toISOString(),
    };
    state.users.push(user);
    state.nextUserId += 1;
    writeLocal(state);
    return user;
}

export async function listUsers(): Promise<SafeUser[]> {
    if (getDataBackend() === 'neon') {
        const rows = await (await neonReady())`SELECT id, name, email, role, status, created_at::text FROM app_users ORDER BY created_at ASC`;
        return rows.map((row) => {
            const { id, name, email, role, status, created_at } = normalizeUser({ ...row, password_hash: '' });
            return { id, name, email, role, status, created_at };
        });
    }
    return readLocal().users.map(stripHash);
}

export async function updateUser(id: number, changes: Partial<Pick<AppUser, 'role' | 'status' | 'password_hash' | 'name'>>): Promise<boolean> {
    if (getDataBackend() === 'neon') {
        const db = await neonReady();
        const existing = await getUserById(id);
        if (!existing) return false;
        await db`UPDATE app_users SET
            role = ${changes.role ?? existing.role},
            status = ${changes.status ?? existing.status},
            password_hash = ${changes.password_hash ?? existing.password_hash},
            name = ${changes.name ?? existing.name}
            WHERE id = ${id}`;
        return true;
    }

    const state = readLocal();
    const user = state.users.find((item) => item.id === id);
    if (!user) return false;
    Object.assign(user, changes);
    writeLocal(state);
    return true;
}

export async function deleteUser(id: number): Promise<boolean> {
    if (getDataBackend() === 'neon') {
        const rows = await (await neonReady())`DELETE FROM app_users WHERE id = ${id} RETURNING id`;
        return rows.length > 0;
    }
    const state = readLocal();
    const before = state.users.length;
    state.users = state.users.filter((user) => user.id !== id);
    // their active checkout stays but loses the account link, like ON DELETE SET NULL
    state.checkouts = state.checkouts.map((checkout) =>
        checkout.user_id === id ? { ...checkout, user_id: null } : checkout);
    writeLocal(state);
    return state.users.length < before;
}

// ---------------- checkouts (user-bound assignments) ----------------

function normalizeCheckout(row: Record<string, unknown>): Checkout {
    return {
        id: Number(row.id),
        territory_id: Number(row.territory_id),
        user_id: row.user_id === null || row.user_id === undefined ? null : Number(row.user_id),
        holder_name: String(row.holder_name || ''),
        token: String(row.token),
        status: row.status as CheckoutStatus,
        assigned_by: String(row.assigned_by || ''),
        assigned_at: String(row.assigned_at),
        ended_at: row.ended_at ? String(row.ended_at) : null,
    };
}

export async function listCheckouts(): Promise<Checkout[]> {
    if (getDataBackend() === 'neon') {
        const rows = await (await neonReady())`
            SELECT id, territory_id, user_id, holder_name, token, status, assigned_by, assigned_at::text, ended_at::text
            FROM checkouts ORDER BY assigned_at DESC`;
        return rows.map(normalizeCheckout);
    }
    return [...readLocal().checkouts].sort((a, b) => b.assigned_at.localeCompare(a.assigned_at));
}

export async function getActiveCheckouts(): Promise<Checkout[]> {
    return (await listCheckouts()).filter((checkout) => checkout.status === 'active');
}

export async function getCheckoutByToken(token: string): Promise<Checkout | null> {
    return (await listCheckouts()).find((checkout) => checkout.token === token) || null;
}

export async function getActiveCheckoutForUser(userId: number): Promise<Checkout | null> {
    return (await getActiveCheckouts()).find((checkout) => checkout.user_id === userId) || null;
}

export async function createCheckout(input: {
    territoryId: number;
    userId?: number | null;
    holderName: string;
    assignedBy: string;
}): Promise<Checkout | { error: string }> {
    const active = await getActiveCheckouts();
    if (active.some((checkout) => checkout.territory_id === input.territoryId)) {
        return { error: 'This territory is already checked out. Clear it first.' };
    }
    if (input.userId && active.some((checkout) => checkout.user_id === input.userId)) {
        return { error: 'This person already holds a territory. Clear it first.' };
    }

    const token = generateToken();

    let checkout: Checkout;
    if (getDataBackend() === 'neon') {
        const rows = await (await neonReady())`
            INSERT INTO checkouts (territory_id, user_id, holder_name, token, assigned_by)
            VALUES (${input.territoryId}, ${input.userId || null}, ${input.holderName}, ${token}, ${input.assignedBy})
            RETURNING id, territory_id, user_id, holder_name, token, status, assigned_by, assigned_at::text, ended_at::text`;
        checkout = normalizeCheckout(rows[0]);
    } else {
        const state = readLocal();
        checkout = {
            id: state.nextCheckoutId,
            territory_id: input.territoryId,
            user_id: input.userId || null,
            holder_name: input.holderName,
            token,
            status: 'active',
            assigned_by: input.assignedBy,
            assigned_at: new Date().toISOString(),
            ended_at: null,
        };
        state.checkouts.push(checkout);
        state.nextCheckoutId += 1;
        writeLocal(state);
    }

    // keep the legacy assignment counters truthful for the old dashboard/stats
    await assignSpecificTerritory(input.territoryId);
    return checkout;
}

export async function endCheckout(checkoutId: number, status: 'returned' | 'cleared'): Promise<boolean> {
    if (getDataBackend() === 'neon') {
        const rows = await (await neonReady())`
            UPDATE checkouts SET status = ${status}, ended_at = now()
            WHERE id = ${checkoutId} AND status = 'active' RETURNING id`;
        return rows.length > 0;
    }
    const state = readLocal();
    const checkout = state.checkouts.find((item) => item.id === checkoutId && item.status === 'active');
    if (!checkout) return false;
    checkout.status = status;
    checkout.ended_at = new Date().toISOString();
    writeLocal(state);
    return true;
}
