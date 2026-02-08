import fs from 'fs';
import path from 'path';

// Define Territory type
export interface Territory {
    id: number;
    territory_name: string;
    map_link: string;
    map_image_url: string;
    map_description: string;
    active: boolean;
}

export interface Assignment {
    territoryId: number;
    assignedAt: string;
}

// In-memory state
// NOTE: This resets on server restart. For persistent storage, use a database.
let assignedTerritoryIds: Set<number> = new Set();
let assignments: Assignment[] = [];
let territoriesCache: Territory[] | null = null;
let isInitialized = false;

// Initialize data from JSON file
function initializeData() {
    if (isInitialized) return;

    try {
        const filePath = path.join(process.cwd(), 'data', 'territories.json');
        const fileContents = fs.readFileSync(filePath, 'utf8');
        territoriesCache = JSON.parse(fileContents);
        isInitialized = true;
        console.log(`Loaded ${territoriesCache?.length} territories`);
    } catch (error) {
        console.error("Failed to load territories:", error);
        territoriesCache = [];
    }
}

// Get all territories, optionally filtering by active status
export function getTerritories(): Territory[] {
    if (!isInitialized) initializeData();
    return territoriesCache || [];
}

// Get dispenser stats
export function getStats() {
    if (!isInitialized) initializeData();

    const allTerritories = getTerritories();
    const activeTerritories = allTerritories.filter(t => t.active);
    const totalActive = activeTerritories.length;
    const assignedCount = assignedTerritoryIds.size;
    const remaining = Math.max(0, totalActive - assignedCount);

    return {
        total: totalActive,
        assigned: assignedCount,
        remaining,
        isExhausted: remaining === 0
    };
}

// Atomically assign the next available territory
export function assignNextTerritory(): Territory | null {
    if (!isInitialized) initializeData();

    const allTerritories = getTerritories();

    // Filter for active and unassigned territories
    const available = allTerritories.filter(t =>
        t.active && !assignedTerritoryIds.has(t.id)
    );

    if (available.length === 0) {
        return null;
    }

    // Simple strategy: take the first one
    // In a real high-concurrency scenario with potential race conditions between
    // the filter and the assignment, we might need a mutex. 
    // However, Node.js is single-threaded, so this synchronous function 
    // will execute atomically per request if not using await inside the critical section.

    const nextTerritory = available[0];

    // Mark as assigned
    assignedTerritoryIds.add(nextTerritory.id);
    assignments.push({
        territoryId: nextTerritory.id,
        assignedAt: new Date().toISOString()
    });

    return nextTerritory;
}

// Get a specific territory by ID
export function getTerritoryById(id: number): Territory | undefined {
    if (!isInitialized) initializeData();
    return getTerritories().find(t => t.id === id);
}

// Toggle territory active status (Admin function)
export function toggleTerritoryActive(id: number): boolean {
    if (!isInitialized) initializeData();

    const territory = territoriesCache?.find(t => t.id === id);
    if (territory) {
        territory.active = !territory.active;

        // If we deactivate a territory that was assigned, do we unassign it?
        // For now, let's keep potential assignments but remove it from the pool.
        // Ideally we might want to update the JSON file here if we want persistence across restarts
        return true;
    }
    return false;
}

// Reset all assignments (Admin function)
export function resetAssignments() {
    assignedTerritoryIds = new Set();
    assignments = [];
    return true;
}
