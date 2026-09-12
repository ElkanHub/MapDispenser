'use client';

import { use, useEffect, useState } from 'react';
import { Link2Off, Loader2 } from 'lucide-react';

import TerritoryPanel, { type PanelTerritory } from '@/components/territory-panel';

interface TokenData {
    checkout: { holder_name: string; assigned_at: string };
    territory: PanelTerritory;
}

export default function TokenViewPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const [data, setData] = useState<TokenData | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`/api/app/t/${token}`)
            .then(async (res) => {
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || 'This territory link does not work.');
                setData(body);
            })
            .catch((fetchError) => setError(fetchError instanceof Error ? fetchError.message : 'This territory link does not work.'));
    }, [token]);

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
                <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <Link2Off className="h-10 w-10 text-slate-300" />
                    <h1 className="text-lg font-bold text-slate-900">Link no longer active</h1>
                    <p className="text-sm text-slate-500">{error}</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
            <div className="mx-auto w-full max-w-md py-4">
                <TerritoryPanel
                    territory={data.territory}
                    holderLabel={data.checkout.holder_name ? `Assigned to ${data.checkout.holder_name}` : 'Assigned to you'}
                    assignedAt={data.checkout.assigned_at}
                    liveMapHref={`/t/${token}/map`}
                />
                <p className="mt-5 text-center text-xs text-slate-400">
                    Keep this link — it works until the territory is returned.
                </p>
            </div>
        </div>
    );
}
