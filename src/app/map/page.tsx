'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import LiveMapScreen from '@/components/live-map-screen';
import type { MapLandmark } from '@/components/live-map';
import type { PanelTerritory } from '@/components/territory-panel';

export default function MyMapPage() {
    const router = useRouter();
    const [territory, setTerritory] = useState<PanelTerritory | null>(null);
    const [landmarks, setLandmarks] = useState<MapLandmark[]>([]);

    useEffect(() => {
        fetch('/api/app/my-assignment')
            .then((res) => {
                if (res.status === 401) throw new Error('login');
                return res.json();
            })
            .then((data) => {
                if (data.territory) {
                    setTerritory(data.territory);
                    setLandmarks(data.landmarks || []);
                } else {
                    router.replace('/home');
                }
            })
            .catch(() => router.replace('/login'));
    }, [router]);

    if (!territory) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return <LiveMapScreen territory={territory} landmarks={landmarks} backHref="/home" />;
}
