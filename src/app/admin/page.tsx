'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, MapPinned, Upload } from 'lucide-react';

import { SignOutButton } from '@/components/app-nav';
import LiveMap from '@/components/live-map';
import { fetchOverview, type AdminOverview } from '@/lib/adminData';

const STATUS_STYLES: Record<string, string> = {
    active: 'bg-amber-100 text-amber-800',
    returned: 'bg-emerald-100 text-emerald-800',
    cleared: 'bg-slate-200 text-slate-600',
};

export default function AdminDeskPage() {
    const router = useRouter();
    const [data, setData] = useState<AdminOverview | null>(null);

    useEffect(() => {
        fetchOverview().then(setData).catch(() => router.replace('/login'));
    }, [router]);

    if (!data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const mapped = data.territories.filter((territory) => territory.geometry);
    const tiles = [
        { label: 'Territories', value: data.stats.total, tone: 'text-slate-900' },
        { label: 'Checked out', value: data.stats.assigned, tone: 'text-amber-600' },
        { label: 'Available', value: data.stats.available, tone: 'text-emerald-600' },
        { label: 'Inactive', value: data.stats.inactive, tone: 'text-slate-400' },
    ];

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto w-full max-w-2xl p-4">
                <header className="flex items-center gap-2 pb-4 pt-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                        <MapPinned className="h-4.5 w-4.5" />
                    </div>
                    <div>
                        <h1 className="font-bold leading-tight text-slate-900">Territory desk</h1>
                        {data.settings && <p className="text-xs text-slate-500">{data.settings.congregation_name}</p>}
                    </div>
                    <SignOutButton className="ml-auto" />
                </header>

                <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {tiles.map((tile) => (
                        <div key={tile.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className={`text-2xl font-extrabold ${tile.tone}`}>{tile.value}</p>
                            <p className="mt-0.5 text-xs font-medium text-slate-500">{tile.label}</p>
                        </div>
                    ))}
                </section>

                <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {mapped.length ? (
                        <div className="relative">
                            <LiveMap
                                shapes={mapped.map((territory) => ({
                                    id: territory.id,
                                    name: territory.territory_name,
                                    geometry: territory.geometry!,
                                    status: territory.status,
                                }))}
                                colorBy="status"
                                onSelect={(id) => router.push(`/admin/territories?focus=${id}`)}
                                className="h-72 w-full sm:h-96"
                            />
                            <div className="absolute bottom-2 left-2 z-[600] flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/95 p-2 text-[11px] font-medium text-slate-600 shadow">
                                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Checked out</span>
                                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />Available</span>
                                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />Inactive</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 p-8 text-center">
                            <Upload className="h-8 w-8 text-slate-300" />
                            <p className="text-sm text-slate-500">No territory shapes yet. Import your Google Earth KMZ to light this map up.</p>
                            <Link href="/admin/import" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Import KMZ</Link>
                        </div>
                    )}
                    {mapped.length > 0 && mapped.length < data.stats.total && (
                        <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                            {data.stats.total - mapped.length} territories have no shape yet — <Link href="/admin/import" className="font-semibold text-indigo-600">import the KMZ</Link> to add them.
                        </p>
                    )}
                </section>

                <section className="mt-4">
                    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent activity</h2>
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
                        {data.activity.length === 0 && <p className="p-4 text-sm text-slate-500">Nothing yet — assign the first territory from the Territories tab.</p>}
                        {data.activity.map((event) => (
                            <div key={event.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-900">{event.territory} → {event.holder}</p>
                                    <p className="text-xs text-slate-500">
                                        {new Date(event.assigned_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[event.status] || STATUS_STYLES.cleared}`}>
                                    {event.status === 'active' ? 'out' : event.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                <p className="mt-6 text-center text-xs text-slate-400">
                    QR dispenser lives at <Link href="/dispenser" className="font-semibold text-indigo-600">/dispenser</Link> for group check-outs.
                </p>
            </div>
        </div>
    );
}
