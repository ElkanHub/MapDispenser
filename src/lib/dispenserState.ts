import fs from 'fs';
import path from 'path';

import { neon } from '@neondatabase/serverless';

export type DataBackend = 'local' | 'neon';
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
const backendChoicePath = path.join(process.cwd(), 'data', 'backend.json');

function sql() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Neon backend requires DATABASE_URL.');
    return neon(url);
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

async function getNeonTerritories(): Promise<Territory[]> {
    const db = sql();
    const [territories, assignments] = await Promise.all([
        db`SELECT * FROM territories ORDER BY id ASC`,
        // ponytail: ::text keeps timestamps as sortable ISO strings, matching the local backend
        db`SELECT territory_id, assigned_at::text FROM assignments ORDER BY assigned_at DESC`,
    ]) as [Territory[], { territory_id: number; assigned_at: string }[]];

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

// ponytail: read the choice from disk on every call so it survives restarts and
// stays right across worker processes. It is one tiny file; the OS caches it.
export function getDataBackend(): DataBackend {
    try {
        const saved = JSON.parse(fs.readFileSync(backendChoicePath, 'utf8')).backend;
        if (saved === 'neon' || saved === 'local') return saved;
    } catch {
        // no choice saved yet — fall back to the environment default
    }
    return process.env.TERRITORY_DATA_BACKEND === 'neon' ? 'neon' : 'local';
}

export function setDataBackend(backend: DataBackend) {
    fs.mkdirSync(path.dirname(backendChoicePath), { recursive: true });
    fs.writeFileSync(backendChoicePath, JSON.stringify({ backend }, null, 2));
    // drop the local caches so switching back re-reads the files from disk
    localTerritoriesCache = null;
    localStateCache = null;
}

export async function getTerritories(): Promise<Territory[]> {
    return getDataBackend() === 'neon' ? getNeonTerritories() : getLocalTerritories();
}

export async function getSystemUpdate(): Promise<SystemUpdate | null> {
    if (getDataBackend() === 'local') {
        return getLocalSystemUpdate();
    }

    const updates = await sql()`SELECT title, message FROM system_updates WHERE active ORDER BY created_at DESC LIMIT 1` as unknown as SystemUpdate[];
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
        backend: getDataBackend(),
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

    if (getDataBackend() === 'neon') {
        await sql()`INSERT INTO assignments (territory_id, assigned_at) VALUES (${id}, ${assignedAt})`;
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
    if (getDataBackend() === 'neon') {
        const rows = await sql()`UPDATE territories SET active = NOT active WHERE id = ${id} RETURNING id`;
        return rows.length > 0;
    }

    const territories = getLocalTerritoriesBase();
    const territory = territories.find((item) => item.id === id);
    if (!territory) return false;
    territory.active = !territory.active;
    persistLocalTerritories(territories);
    return true;
}

export async function setTerritoriesActive(ids: number[], active: boolean): Promise<boolean> {
    if (getDataBackend() === 'neon') {
        const rows = await sql()`UPDATE territories SET active = ${active} WHERE id = ANY(${ids}) RETURNING id`;
        return rows.length > 0;
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
    if (getDataBackend() === 'neon') {
        await sql()`DELETE FROM assignments`;
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

    if (getDataBackend() === 'neon') {
        // ponytail: one statement, json_to_recordset expands the array server-side
        await sql()`
            INSERT INTO territories (id, territory_name, map_link, map_image_url, map_description, active)
            SELECT * FROM json_to_recordset(${JSON.stringify(normalized)}::json)
                AS t(id int, territory_name text, map_link text, map_image_url text, map_description text, active boolean)
            ON CONFLICT (id) DO UPDATE SET
                territory_name = EXCLUDED.territory_name,
                map_link = EXCLUDED.map_link,
                map_image_url = EXCLUDED.map_image_url,
                map_description = EXCLUDED.map_description,
                active = EXCLUDED.active`;
        return normalized.length;
    }

    // ponytail: merge by id like the neon upsert, so uploading one territory can't wipe the file
    const merged = getLocalTerritoriesBase();
    for (const territory of normalized) {
        const index = merged.findIndex((item) => item.id === territory.id);
        if (index === -1) merged.push(territory);
        else merged[index] = territory;
    }
    persistLocalTerritories(merged.sort((a, b) => a.id - b.id));
    return normalized.length;
}
