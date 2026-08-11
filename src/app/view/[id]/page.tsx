import { getTerritoryById } from '@/lib/dispenserState';
import { notFound } from 'next/navigation';
import ViewTerritoryClient from './view-client';

// Shared links (WhatsApp, etc.) get a real title and map thumbnail
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const territory = await getTerritoryById(Number(id));
    if (!territory) return { title: 'Territory not found' };

    return {
        title: `Territory ${territory.territory_name}`,
        description: territory.map_description,
        openGraph: {
            title: `Territory ${territory.territory_name}`,
            description: territory.map_description,
            images: territory.map_image_url ? [territory.map_image_url] : [],
        },
    };
}

// Server Component
export default async function ViewTerritoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idString } = await params;
    const id = parseInt(idString);

    if (isNaN(id)) {
        return notFound();
    }

    const territory = await getTerritoryById(id);

    if (!territory) {
        return notFound();
    }

    // Pass data to client component for interactivity (dialogs, etc.)
    return <ViewTerritoryClient territory={territory} />;
}
