import fs from 'fs';
import path from 'path';

export type DataBackend = 'local' | 'supabase';
export type TerritoryStatus = 'inactive' | 'available' | 'assigned';

export interface Territory {
    id: number;
    territory_name: string;
    map_link: string;
    map_image_url: string;
    map_description: string;
    active: boolean;
    isAssigned?: boolean;
    assignmentCount?: number;
    lastAssignedAt?: string | null;
    status?: TerritoryStatus;
}

export interface SystemUpdate {
    title: string;
    message: string;
}

export interface Assignment {
    territoryId: number;
    assignedAt: string;
}

export interface DashboardStats {
    total: number;
    active: number;
    inactive: number;
    assigned: number;
    remaining: number;
    totalAssignments: number;
    mostAssigned: Territory | null;
    recentlyAssigned: Territory[];
    isExhausted: boolean;
    backend: DataBackend;
}

interface LocalState {
    assignments: Assignment[];
}

interface RawTerritory {
    id?: number | string;
    territory_name?: string;
    map_link?: string;
    map_image_url?: string;
    map_description?: string;
    active?: boolean;
    title?: string;
    message?: string;
}

interface RawSystemUpdate {
    title: string;
    message: string;
}

const territoriesPath = path.join(process.cwd(), 'data', 'territories.json');
const localStatePath = path.join(process.cwd(), 'data', 'assignment-state.json');

let localTerritoriesCache: unknown[] | null = null;
let localStateCache: LocalState | null = null;
let activeBackend: DataBackend = process.env.TERRITORY_DATA_BACKEND === 'supabase' ? 'supabase' : 'local';

function getSupabaseConfig() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw new Error('Supabase backend requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.');
    }
    return { url: url.replace(/\/$/, ''), key };
}

async function supabaseFetch<T>(resource: string, init: RequestInit = {}): Promise<T> {
    const { url, key } = getSupabaseConfig();
    const headers = new Headers(init.headers);
    headers.set('apikey', key);
    headers.set('Authorization', `Bearer ${key}`);
    if (!headers.has('Content-Type') && init.body) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${url}/rest/v1/${resource}`, {
        ...init,
        headers,
        cache: 'no-store',
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Supabase request failed (${response.status}): ${body}`);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

function ensureLocalTerritories() {
    if (localTerritoriesCache) return;

    try {
        localTerritoriesCache = JSON.parse(fs.readFileSync(territoriesPath, 'utf8'));
    } catch (error) {
        console.error('Failed to load local territories:', error);
        localTerritoriesCache = [];
    }
}

function ensureLocalState() {
    if (localStateCache) return;

    try {
        localStateCache = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
    } catch {
        localStateCache = { assignments: [] };
        persistLocalState();
    }
}

function persistLocalState() {
    fs.mkdirSync(path.dirname(localStatePath), { recursive: true });
    fs.writeFileSync(localStatePath, JSON.stringify(localStateCache || { assignments: [] }, null, 2));
}

function persistLocalTerritories(territories: Territory[]) {
    const update = getLocalSystemUpdate();
    const payload: unknown[] = update ? [update, ...territories] : territories;
    fs.writeFileSync(territoriesPath, JSON.stringify(payload, null, 2));
    localTerritoriesCache = payload;
}

function getLocalSystemUpdate(): SystemUpdate | null {
    ensureLocalTerritories();
    const update = (localTerritoriesCache || []).find((item): item is RawSystemUpdate => {
        const candidate = item as RawTerritory;
        return typeof candidate?.title === 'string' && typeof candidate?.message === 'string';
    });
    return update ? { title: update.title, message: update.message } : null;
}

function decorateTerritories(territories: Territory[], assignments: Assignment[]): Territory[] {
    const counts = new Map<number, { count: number; lastAssignedAt: string | null }>();

    for (const assignment of assignments) {
        const current = counts.get(assignment.territoryId) || { count: 0, lastAssignedAt: null };
        current.count += 1;
        if (!current.lastAssignedAt || assignment.assignedAt > current.lastAssignedAt) {
            current.lastAssignedAt = assignment.assignedAt;
        }
        counts.set(assignment.territoryId, current);
    }

    return territories.map((territory) => {
        const assignment = counts.get(territory.id) || { count: 0, lastAssignedAt: null };
        const isAssigned = assignment.count > 0;
        const status: TerritoryStatus = !territory.active ? 'inactive' : isAssigned ? 'assigned' : 'available';

        return {
            ...territory,
            isAssigned,
            assignmentCount: assignment.count,
            lastAssignedAt: assignment.lastAssignedAt,
            status,
        };
    });
}

function getLocalTerritoriesBase(): Territory[] {
    ensureLocalTerritories();
    return (localTerritoriesCache || [])
        .filter((item): item is RawTerritory => Boolean((item as RawTerritory)?.territory_name))
        .map((item) => ({
        id: Number(item.id),
        territory_name: String(item.territory_name || ''),
        map_link: String(item.map_link || ''),
        map_image_url: String(item.map_image_url || ''),
        map_description: String(item.map_description || ''),
        active: Boolean(item.active),
    }));
}

async function getLocalTerritories(): Promise<Territory[]> {
    ensureLocalState();
    return decorateTerritories(getLocalTerritoriesBase(), localStateCache?.assignments || []);
}

async function getSupabaseTerritories(): Promise<Territory[]> {
    const [territories, assignments] = await Promise.all([
        supabaseFetch<Territory[]>('territories?select=*&order=id.asc'),
        supabaseFetch<{ territory_id: number; assigned_at: string }[]>('assignments?select=territory_id,assigned_at&order=assigned_at.desc'),
    ]);

    return decorateTerritories(
        territories.map((territory) => ({
            id: Number(territory.id),
            territory_name: territory.territory_name,
            map_link: territory.map_link,
            map_image_url: territory.map_image_url,
            map_description: territory.map_description,
            active: Boolean(territory.active),
        })),
        assignments.map((assignment) => ({
            territoryId: Number(assignment.territory_id),
            assignedAt: assignment.assigned_at,
        }))
    );
}

export function getDataBackend(): DataBackend {
    return activeBackend;
}

export function setDataBackend(backend: DataBackend) {
    activeBackend = backend;
}

export async function getTerritories(): Promise<Territory[]> {
    return activeBackend === 'supabase' ? getSupabaseTerritories() : getLocalTerritories();
}

export async function getSystemUpdate(): Promise<SystemUpdate | null> {
    if (activeBackend === 'local') {
        return getLocalSystemUpdate();
    }

    const updates = await supabaseFetch<SystemUpdate[]>('system_updates?select=title,message&active=eq.true&order=created_at.desc&limit=1');
    return updates[0] || null;
}

export async function getStats(): Promise<DashboardStats> {
    const allTerritories = await getTerritories();
    const activeTerritories = allTerritories.filter((territory) => territory.active);
    const assignedTerritories = activeTerritories.filter((territory) => territory.isAssigned);
    const remaining = Math.max(0, activeTerritories.length - assignedTerritories.length);
    const totalAssignments = allTerritories.reduce((sum, territory) => sum + (territory.assignmentCount || 0), 0);
    const mostAssigned = [...allTerritories].sort((a, b) => (b.assignmentCount || 0) - (a.assignmentCount || 0))[0] || null;
    const recentlyAssigned = allTerritories
        .filter((territory) => territory.lastAssignedAt)
        .sort((a, b) => String(b.lastAssignedAt).localeCompare(String(a.lastAssignedAt)))
        .slice(0, 5);

    return {
        total: allTerritories.length,
        active: activeTerritories.length,
        inactive: allTerritories.length - activeTerritories.length,
        assigned: assignedTerritories.length,
        remaining,
        totalAssignments,
        mostAssigned: mostAssigned && (mostAssigned.assignmentCount || 0) > 0 ? mostAssigned : null,
        recentlyAssigned,
        isExhausted: remaining === 0,
        backend: activeBackend,
    };
}

export async function assignNextTerritory(): Promise<Territory | null> {
    const available = (await getTerritories()).filter((territory) => territory.active && !territory.isAssigned);
    const nextTerritory = available[0];

    if (!nextTerritory) return null;

    await recordAssignment(nextTerritory.id);
    return { ...nextTerritory, isAssigned: true, assignmentCount: (nextTerritory.assignmentCount || 0) + 1, status: 'assigned' };
}

export async function assignSpecificTerritory(id: number): Promise<boolean> {
    const territory = (await getTerritories()).find((item) => item.id === id);
    if (!territory) return false;

    await recordAssignment(id);
    return true;
}

async function recordAssignment(id: number) {
    const assignedAt = new Date().toISOString();

    if (activeBackend === 'supabase') {
        await supabaseFetch('assignments', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ territory_id: id, assigned_at: assignedAt }),
        });
        return;
    }

    ensureLocalState();
    localStateCache?.assignments.push({ territoryId: id, assignedAt });
    persistLocalState();
}

export async function getTerritoryById(id: number): Promise<Territory | undefined> {
    return (await getTerritories()).find((territory) => territory.id === id);
}

export async function toggleTerritoryActive(id: number): Promise<boolean> {
    if (activeBackend === 'supabase') {
        const territory = (await getTerritories()).find((item) => item.id === id);
        if (!territory) return false;
        await supabaseFetch(`territories?id=eq.${id}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ active: !territory.active }),
        });
        return true;
    }

    const territories = getLocalTerritoriesBase();
    const territory = territories.find((item) => item.id === id);
    if (!territory) return false;
    territory.active = !territory.active;
    persistLocalTerritories(territories);
    return true;
}

export async function setTerritoriesActive(ids: number[], active: boolean): Promise<boolean> {
    if (activeBackend === 'supabase') {
        await supabaseFetch(`territories?id=in.(${ids.join(',')})`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ active }),
        });
        return true;
    }

    const territories = getLocalTerritoriesBase();
    let updated = false;
    for (const territory of territories) {
        if (ids.includes(territory.id)) {
            territory.active = active;
            updated = true;
        }
    }
    if (updated) persistLocalTerritories(territories);
    return updated;
}

export async function resetAssignments() {
    if (activeBackend === 'supabase') {
        await supabaseFetch('assignments?id=not.is.null', {
            method: 'DELETE',
            headers: { Prefer: 'return=minimal' },
        });
        return true;
    }

    localStateCache = { assignments: [] };
    persistLocalState();
    return true;
}

export async function uploadTerritories(territories: Territory[]) {
    const normalized = territories.map((territory) => ({
        id: Number(territory.id),
        territory_name: String(territory.territory_name || '').trim(),
        map_link: String(territory.map_link || '').trim(),
        map_image_url: String(territory.map_image_url || '').trim(),
        map_description: String(territory.map_description || '').trim(),
        active: Boolean(territory.active),
    })).filter((territory) => territory.id && territory.territory_name);

    if (activeBackend === 'supabase') {
        await supabaseFetch('territories?on_conflict=id', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(normalized),
        });
        return normalized.length;
    }

    persistLocalTerritories(normalized);
    return normalized.length;
}
