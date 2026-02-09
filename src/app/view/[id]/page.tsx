import { getTerritoryById } from '@/lib/dispenserState';
import { notFound } from 'next/navigation';
import ViewTerritoryClient from './view-client';

// Server Component
export default async function ViewTerritoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idString } = await params;
    const id = parseInt(idString);

    if (isNaN(id)) {
        return notFound();
    }

    const territory = getTerritoryById(id);

    if (!territory) {
        return notFound();
    }

    // Pass data to client component for interactivity (dialogs, etc.)
    return <ViewTerritoryClient territory={territory} />;
}
