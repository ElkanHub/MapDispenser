'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, History, Loader2, MapPinned, MessageCircle, Upload, UserPlus, X } from 'lucide-react';

import { SignOutButton } from '@/components/app-nav';
import LiveMap from '@/components/live-map';
import { Button } from '@/components/ui/button';
import { fetchOverview, shareOnWhatsApp, tokenLink, type AdminOverview, type AdminTerritory } from '@/lib/adminData';

const STATUS_STYLES: Record<string, string> = {
    active: 'bg-amber-100 text-amber-800',
    returned: 'bg-emerald-100 text-emerald-800',
    cleared: 'bg-slate-200 text-slate-600',
};

const CHIP: Record<AdminTerritory['status'], { label: string; className: string }> = {
    available: { label: 'Free', className: 'bg-emerald-100 text-emerald-800' },
    assigned: { label: 'Out', className: 'bg-amber-100 text-amber-800' },
    inactive: { label: 'Inactive', className: 'bg-slate-200 text-slate-500' },
};

function daysOut(since: string): string {
    const days = Math.floor((Date.now() - new Date(since).getTime()) / 86400000);
    return days <= 0 ? 'today' : days === 1 ? '1 day' : `${days} days`;
}

export default function AdminDeskPage() {
    const router = useRouter();
    const [data, setData] = useState<AdminOverview | null>(null);
    const dataRef = useRef<AdminOverview | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [showActivity, setShowActivity] = useState(false);
    const [copied, setCopied] = useState(false);

    const reload = async () => {
        try {
            const overview = await fetchOverview();
            dataRef.current = overview;
            setData(overview);
        } catch {
            router.replace('/login');
        }
    };

    // setState here only ever runs after the fetch resolves — not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    useEffect(() => { reload(); }, []);

    // stable identity so selecting a polygon never redraws or refits the map
    const handleSelect = useCallback((id: number) => {
        setShowActivity(false);
        setSelectedId(id);
    }, []);

    if (!data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const mapped = data.territories.filter((territory) => territory.geometry);
    const unmapped = data.stats.total - mapped.length;
    const selected = selectedId === null ? null : data.territories.find((territory) => territory.id === selectedId) || null;
    const selectedLink = selected?.checkout ? tokenLink(selected.checkout.token) : '';

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(selectedLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            alert(selectedLink);
        }
    };

    const clearSelected = async () => {
        if (!selected?.checkout) return;
        if (!confirm(`Clear ${selected.territory_name} from ${selected.checkout.holder}? Their link stops working.`)) return;
        const res = await fetch('/api/app/checkouts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutId: selected.checkout.id, status: 'returned' }),
        });
        if (!res.ok) alert((await res.json()).error || 'Could not clear.');
        await reload();
    };

    // No shapes yet: a plain onboarding view, the map takes over once a KMZ is in
    if (mapped.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50">
                <div className="mx-auto w-full max-w-md p-4">
                    <header className="flex items-center gap-2 pb-4 pt-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white"><MapPinned className="h-4.5 w-4.5" /></div>
                        <div>
                            <h1 className="font-bold leading-tight text-slate-900">Territory desk</h1>
                            {data.settings && <p className="text-xs text-slate-500">{data.settings.congregation_name}</p>}
                        </div>
                        <SignOutButton className="ml-auto" />
                    </header>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-2xl font-extrabold text-slate-900">{data.stats.total}</p><p className="mt-0.5 text-xs font-medium text-slate-500">Territories</p></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-2xl font-extrabold text-amber-600">{data.stats.assigned}</p><p className="mt-0.5 text-xs font-medium text-slate-500">Checked out</p></div>
                    </div>
                    <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <Upload className="h-8 w-8 text-slate-300" />
                        <p className="text-sm text-slate-500">No territory shapes yet. Import your Google Earth KMZ and this screen becomes the full congregation map.</p>
                        <Link href="/admin/import"><Button>Import KMZ</Button></Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-100">
            {/* the map IS the screen — everything else floats over it */}
            <LiveMap
                shapes={mapped.map((territory) => ({
                    id: territory.id,
                    name: territory.territory_name,
                    geometry: territory.geometry!,
                    status: territory.status,
                }))}
                landmarks={data.landmarks}
                colorBy="status"
                onSelect={handleSelect}
                layersClass="right-3 top-28"
                labelsClass="right-3 top-[10.5rem]"
                className="h-full w-full"
            />

            {/* top chips: identity + live counts */}
            <div className="pointer-events-none absolute inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[600] flex flex-col gap-2 px-3">
                <div className="flex items-center gap-2">
                    <span className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 py-1.5 pl-1.5 pr-3 shadow-md backdrop-blur">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white"><MapPinned className="h-3.5 w-3.5" /></span>
                        <span className="text-xs font-bold text-slate-900">{data.settings?.congregation_name || 'Territory desk'}</span>
                    </span>
                    <span className="ml-auto pointer-events-auto"><SignOutButton /></span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-amber-700 shadow backdrop-blur">{data.stats.assigned} out</span>
                    <span className="rounded-full border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-emerald-700 shadow backdrop-blur">{data.stats.available} free</span>
                    {data.stats.inactive > 0 && <span className="rounded-full border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-500 shadow backdrop-blur">{data.stats.inactive} inactive</span>}
                    {unmapped > 0 && (
                        <Link href="/admin/import" className="pointer-events-auto rounded-full border border-indigo-200 bg-indigo-50/95 px-2.5 py-1 text-[11px] font-bold text-indigo-700 shadow backdrop-blur">
                            {unmapped} unmapped →
                        </Link>
                    )}
                </div>
            </div>

            {/* activity toggle, above the tab bar */}
            <button
                type="button"
                onClick={() => { setSelectedId(null); setShowActivity((prev) => !prev); }}
                className="absolute bottom-24 right-3 z-[600] flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-md backdrop-blur active:scale-95"
                aria-label="Recent activity"
            >
                <History className="h-5 w-5" />
            </button>

            {showActivity && (
                <div className="absolute inset-x-3 bottom-24 z-[600] mx-auto max-w-md">
                    <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent activity</p>
                            <button type="button" onClick={() => setShowActivity(false)} aria-label="Close" className="text-slate-400"><X className="h-4 w-4" /></button>
                        </div>
                        {data.activity.length === 0 && <p className="p-4 text-sm text-slate-500">Nothing yet.</p>}
                        {data.activity.map((event) => (
                            <div key={event.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-2.5 last:border-0">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-900">{event.territory} → {event.holder}</p>
                                    <p className="text-xs text-slate-500">{new Date(event.assigned_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[event.status] || STATUS_STYLES.cleared}`}>
                                    {event.status === 'active' ? 'out' : event.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* tap a territory -> floating action card */}
            {selected && (
                <div className="absolute inset-x-3 bottom-24 z-[700] mx-auto max-w-md">
                    <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
                        <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${CHIP[selected.status].className}`}>{CHIP[selected.status].label}</span>
                            <p className="font-bold text-slate-900">{selected.territory_name}</p>
                            <button type="button" onClick={() => setSelectedId(null)} aria-label="Close" className="ml-auto rounded-full p-1 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                            {selected.checkout
                                ? <>{selected.checkout.holder} · out {daysOut(selected.checkout.assigned_at)}</>
                                : selected.map_description || 'Available'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {selected.status === 'available' && (
                                <Link href={`/admin/territories?focus=${selected.id}`}>
                                    <Button size="sm" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" />Assign</Button>
                                </Link>
                            )}
                            {selected.checkout && (
                                <>
                                    <Button size="sm" variant="outline" className="gap-1.5" onClick={copyLink}>
                                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy link'}
                                    </Button>
                                    <Button size="sm" variant="outline" className="gap-1.5 text-emerald-700" onClick={() => shareOnWhatsApp(`Territory ${selected.territory_name}\n${selectedLink}`)}>
                                        <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                                    </Button>
                                    <Button size="sm" variant="outline" className="gap-1.5 text-red-600" onClick={clearSelected}>
                                        <X className="h-3.5 w-3.5" />Clear
                                    </Button>
                                </>
                            )}
                            <Link href={`/admin/territories?focus=${selected.id}`} className="ml-auto self-center text-xs font-semibold text-indigo-600">Details →</Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
