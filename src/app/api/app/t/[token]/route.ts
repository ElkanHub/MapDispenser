import { NextResponse } from 'next/server';
import { getCheckoutByToken } from '@/lib/appState';
import { getTerritoryById } from '@/lib/dispenserState';

export const dynamic = 'force-dynamic';

// Public: magic-link data. The token is the credential.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const checkout = await getCheckoutByToken(token);
    if (!checkout) return NextResponse.json({ error: 'This territory link does not exist.' }, { status: 404 });
    if (checkout.status !== 'active') {
        return NextResponse.json({ revoked: true, error: 'This territory has been returned. Ask for a new link.' }, { status: 410 });
    }

    const territory = await getTerritoryById(checkout.territory_id);
    if (!territory) return NextResponse.json({ error: 'Territory not found.' }, { status: 404 });

    return NextResponse.json({
        checkout: { holder_name: checkout.holder_name, assigned_at: checkout.assigned_at },
        territory,
    });
}
