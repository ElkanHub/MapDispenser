// Shared client-side types + fetch helper for the admin screens.
import type { TerritoryGeometry } from './geo';

export interface AdminTerritory {
    id: number;
    territory_name: string;
    map_link: string;
    map_image_url: string;
    map_description: string;
    active: boolean;
    geometry?: TerritoryGeometry | null;
    color?: string;
    status: 'available' | 'assigned' | 'inactive';
    lastAssignedAt?: string | null;
    assignmentCount?: number;
    checkout: {
        id: number;
        token: string;
        user_id: number | null;
        holder: string;
        assigned_at: string;
    } | null;
}

export interface AdminUser {
    id: number;
    name: string;
    email: string;
    role: 'publisher' | 'territory_team' | 'territory_servant';
    status: 'pending' | 'active';
    created_at: string;
    territory: { checkoutId: number; id: number; name: string } | null;
}

export interface AdminOverview {
    territories: AdminTerritory[];
    users: AdminUser[];
    activity: { id: number; territory: string; holder: string; status: string; assigned_at: string; ended_at: string | null }[];
    settings: { congregation_name: string; join_code: string; team_code: string } | null;
    stats: { total: number; available: number; assigned: number; inactive: number; withMap: number };
}

export async function fetchOverview(): Promise<AdminOverview> {
    const res = await fetch('/api/app/overview');
    if (!res.ok) throw new Error('overview');
    return res.json();
}

export function tokenLink(token: string): string {
    return `${window.location.origin}/t/${token}`;
}

export function shareOnWhatsApp(text: string) {
    // No number: WhatsApp opens with the message prefilled, sender picks the contact
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

export const ROLE_LABELS: Record<AdminUser['role'], string> = {
    publisher: 'Publisher',
    territory_team: 'Territory team',
    territory_servant: 'Territory servant',
};
