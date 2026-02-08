import { getTerritoryById } from '@/lib/dispenserState';
import { notFound } from 'next/navigation';
import ViewTerritoryClient from './view-client';

// Server Component
export default function ViewTerritoryPage({ params }: { params: { id: string } }) {
    const id = parseInt(params.id);

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
