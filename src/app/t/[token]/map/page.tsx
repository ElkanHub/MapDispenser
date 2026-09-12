'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import LiveMapScreen from '@/components/live-map-screen';
import type { MapLandmark } from '@/components/live-map';
import type { PanelTerritory } from '@/components/territory-panel';

export default function TokenMapPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const router = useRouter();
    const [territory, setTerritory] = useState<PanelTerritory | null>(null);
    const [landmarks, setLandmarks] = useState<MapLandmark[]>([]);

    useEffect(() => {
        fetch(`/api/app/t/${token}`)
            .then(async (res) => {
                const body = await res.json();
                if (!res.ok) throw new Error();
                setTerritory(body.territory);
                setLandmarks(body.landmarks || []);
            })
            .catch(() => router.replace(`/t/${token}`));
    }, [token, router]);

    if (!territory) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return <LiveMapScreen territory={territory} landmarks={landmarks} backHref={`/t/${token}`} />;
}
