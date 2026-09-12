import { NextResponse } from 'next/server';
import { getSettings, listCheckouts, listLandmarks, listUsers } from '@/lib/appState';
import { requireSession } from '@/lib/auth';
import { getTerritories } from '@/lib/dispenserState';

export const dynamic = 'force-dynamic';

// Everything the admin screens need in one call: territories with live holder
// info, the people list, codes, and recent activity.
export async function GET() {
    const session = await requireSession(true);
    if (!session) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });

    const [territories, users, checkouts, settings, landmarks] = await Promise.all([
        getTerritories(),
        listUsers(),
        listCheckouts(),
        getSettings(),
        listLandmarks(),
    ]);

    const usersById = new Map(users.map((user) => [user.id, user]));
    const active = checkouts.filter((checkout) => checkout.status === 'active');
    const activeByTerritory = new Map(active.map((checkout) => [checkout.territory_id, checkout]));
    const territoriesById = new Map(territories.map((territory) => [territory.id, territory]));

    const holderName = (checkout: { user_id: number | null; holder_name: string }) =>
        (checkout.user_id && usersById.get(checkout.user_id)?.name) || checkout.holder_name || 'Link holder';

    const decorated = territories.map((territory) => {
        const checkout = activeByTerritory.get(territory.id);
        return {
            ...territory,
            checkout: checkout ? {
                id: checkout.id,
                token: checkout.token,
                user_id: checkout.user_id,
                holder: holderName(checkout),
                assigned_at: checkout.assigned_at,
            } : null,
            // new model wins over the legacy anonymous counter for status display
            status: !territory.active ? 'inactive' : checkout ? 'assigned' : 'available',
        };
    });

    const activity = checkouts.slice(0, 10).map((checkout) => ({
        id: checkout.id,
        territory: territoriesById.get(checkout.territory_id)?.territory_name || `#${checkout.territory_id}`,
        holder: holderName(checkout),
        status: checkout.status,
        assigned_at: checkout.assigned_at,
        ended_at: checkout.ended_at,
    }));

    const usersWithHolds = users.map((user) => ({
        ...user,
        territory: (() => {
            const hold = active.find((checkout) => checkout.user_id === user.id);
            return hold ? {
                checkoutId: hold.id,
                id: hold.territory_id,
                name: territoriesById.get(hold.territory_id)?.territory_name || `#${hold.territory_id}`,
            } : null;
        })(),
    }));

    const activeTerritories = decorated.filter((territory) => territory.active);
    return NextResponse.json({
        territories: decorated,
        users: usersWithHolds,
        activity,
        settings,
        landmarks,
        stats: {
            total: territories.length,
            available: activeTerritories.filter((territory) => territory.status === 'available').length,
            assigned: activeTerritories.filter((territory) => territory.status === 'assigned').length,
            inactive: territories.length - activeTerritories.length,
            withMap: territories.filter((territory) => territory.geometry).length,
        },
    });
}
