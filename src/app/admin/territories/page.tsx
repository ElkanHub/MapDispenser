'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Copy, Loader2, Link2, MessageCircle, UserPlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { fetchOverview, shareOnWhatsApp, tokenLink, type AdminOverview, type AdminTerritory } from '@/lib/adminData';

const CHIP: Record<AdminTerritory['status'], { label: string; className: string }> = {
    available: { label: 'Free', className: 'bg-emerald-100 text-emerald-800' },
    assigned: { label: 'Out', className: 'bg-amber-100 text-amber-800' },
    inactive: { label: 'Off', className: 'bg-slate-200 text-slate-500' },
};

function daysOut(since: string): string {
    const days = Math.floor((Date.now() - new Date(since).getTime()) / 86400000);
    return days <= 0 ? 'today' : days === 1 ? '1 day' : `${days} days`;
}

function shareText(name: string, link: string) {
    return `Territory ${name}\n${link}`;
}

function TerritoriesScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const focusId = Number(searchParams.get('focus')) || null;
    const forId = Number(searchParams.get('for')) || null;
    const [data, setData] = useState<AdminOverview | null>(null);
    const [assignTarget, setAssignTarget] = useState<AdminTerritory | null>(null);
    const [linkName, setLinkName] = useState('');
    const [busy, setBusy] = useState(false);
    const [sheetError, setSheetError] = useState('');
    const [done, setDone] = useState<{ holder: string; link: string; territory: string } | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const focusRef = useRef<HTMLDivElement | null>(null);

    const reload = () => fetchOverview().then(setData).catch(() => router.replace('/login'));
    useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { focusRef.current?.scrollIntoView({ block: 'center' }); }, [data]);

    const copy = async (id: number, link: string) => {
        try {
            await navigator.clipboard.writeText(link);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            alert(link);
        }
    };

    const assign = async (territory: AdminTerritory, userId?: number, holderName?: string) => {
        setBusy(true);
        setSheetError('');
        try {
            const res = await fetch('/api/app/checkouts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ territoryId: territory.id, userId, holderName }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || 'Could not assign.');
            setDone({
                holder: body.checkout.holder_name || 'link holder',
                link: tokenLink(body.checkout.token),
                territory: territory.territory_name,
            });
            setLinkName('');
            await reload();
        } catch (error) {
            setSheetError(error instanceof Error ? error.message : 'Could not assign.');
        } finally {
            setBusy(false);
        }
    };

    const clear = async (territory: AdminTerritory) => {
        if (!territory.checkout) return;
        if (!confirm(`Clear ${territory.territory_name} from ${territory.checkout.holder}? Their link stops working.`)) return;
        const res = await fetch('/api/app/checkouts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutId: territory.checkout.id, status: 'returned' }),
        });
        if (!res.ok) alert((await res.json()).error || 'Could not clear.');
        await reload();
    };

    if (!data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    // people asking for a territory come first in the assign sheet
    const freeUsers = [...data.users.filter((user) => user.status === 'active' && !user.territory)]
        .sort((a, b) => Number(Boolean(b.requested_at)) - Number(Boolean(a.requested_at)));
    const heldUsers = data.users.filter((user) => user.status === 'active' && user.territory);
    const forUser = forId ? data.users.find((user) => user.id === forId && user.status === 'active' && !user.territory) || null : null;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto w-full max-w-2xl p-4">
                <header className="flex items-baseline justify-between pb-3 pt-1">
                    <h1 className="text-xl font-bold text-slate-900">Territories</h1>
                    <span className="text-xs font-medium text-slate-500">{data.stats.assigned} out · {data.stats.available} free</span>
                </header>

                {forUser && (
                    <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5">
                        <span className="flex h-9 w-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-amber-500 text-white">👋</span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-amber-900">Choosing a territory for {forUser.name}</p>
                            <p className="text-xs text-amber-800">Tap Assign on any free territory below.</p>
                        </div>
                        <button type="button" onClick={() => router.replace('/admin/territories')} className="text-xs font-semibold text-amber-700 underline-offset-2 hover:underline">Cancel</button>
                    </div>
                )}

                <div className="flex flex-col gap-2.5">
                    {data.territories.map((territory) => {
                        const chip = CHIP[territory.status];
                        const link = territory.checkout ? tokenLink(territory.checkout.token) : '';
                        return (
                            <div
                                key={territory.id}
                                ref={territory.id === focusId ? focusRef : null}
                                className={`rounded-xl border bg-white p-3.5 shadow-sm ${territory.id === focusId ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.className}`}>{chip.label}</span>
                                    <span className="font-semibold text-slate-900">{territory.territory_name}</span>
                                    {!territory.geometry && <span className="text-[10px] font-medium uppercase text-slate-400">no shape</span>}
                                    <span className="ml-auto text-xs text-slate-500">
                                        {territory.checkout
                                            ? <>{territory.checkout.holder} · {daysOut(territory.checkout.assigned_at)}</>
                                            : territory.lastAssignedAt
                                                ? `last out ${new Date(territory.lastAssignedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
                                                : 'never assigned'}
                                    </span>
                                </div>

                                <div className="mt-2.5 flex flex-wrap gap-2">
                                    {territory.status === 'available' && (
                                        <Button
                                            size="sm"
                                            className={`gap-1.5 ${forUser ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                                            disabled={busy}
                                            onClick={() => {
                                                setDone(null);
                                                setSheetError('');
                                                setAssignTarget(territory);
                                                // direct mode: a person was already chosen on the People tab
                                                if (forUser) assign(territory, forUser.id);
                                            }}
                                        >
                                            {busy && forUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                                            {forUser ? `Assign to ${forUser.name.split(' ')[0]}` : 'Assign'}
                                        </Button>
                                    )}
                                    {territory.checkout && (
                                        <>
                                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(territory.id, link)}>
                                                {copiedId === territory.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                                {copiedId === territory.id ? 'Copied' : 'Copy link'}
                                            </Button>
                                            <Button size="sm" variant="outline" className="gap-1.5 text-emerald-700" onClick={() => shareOnWhatsApp(shareText(territory.territory_name, link))}>
                                                <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                                            </Button>
                                            <Button size="sm" variant="outline" className="gap-1.5 text-red-600" onClick={() => clear(territory)}>
                                                <X className="h-3.5 w-3.5" />Clear
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {assignTarget && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setAssignTarget(null)}>
                    <div
                        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />

                        {done ? (
                            <div className="space-y-4 text-center">
                                <Check className="mx-auto h-10 w-10 rounded-full bg-emerald-100 p-2 text-emerald-700" />
                                <div>
                                    <p className="font-bold text-slate-900">{done.territory} assigned to {done.holder}</p>
                                    <p className="mt-1 text-sm text-slate-500">Share the territory link so they can open the map.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button variant="outline" className="gap-2" onClick={() => copy(-1, done.link)}>
                                        <Copy className="h-4 w-4" />{copiedId === -1 ? 'Copied' : 'Copy link'}
                                    </Button>
                                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => shareOnWhatsApp(shareText(done.territory, done.link))}>
                                        <MessageCircle className="h-4 w-4" />WhatsApp
                                    </Button>
                                </div>
                                <Button variant="ghost" className="w-full" onClick={() => { setAssignTarget(null); if (forId) router.replace('/admin/territories'); }}>Done</Button>
                            </div>
                        ) : (
                            <>
                                <h2 className="font-bold text-slate-900">Assign {assignTarget.territory_name} to…</h2>
                                <p className="mt-0.5 text-sm text-slate-500">Pick a person, or create a link for someone without an account.</p>
                                {sheetError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{sheetError}</p>}

                                <div className="mt-3 divide-y divide-slate-100">
                                    {freeUsers.map((user) => (
                                        <div key={user.id} className={`flex items-center gap-3 py-3 ${user.requested_at ? 'rounded-lg bg-amber-50 px-2 -mx-2' : ''}`}>
                                            <div className="min-w-0 flex-1">
                                                <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900">
                                                    {user.name}
                                                    {user.requested_at && <span className="animate-pulse rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">asking</span>}
                                                </p>
                                                <p className="text-xs text-slate-500">no territory</p>
                                            </div>
                                            <Button size="sm" disabled={busy} onClick={() => assign(assignTarget, user.id)}>Assign</Button>
                                        </div>
                                    ))}
                                    {heldUsers.map((user) => (
                                        <div key={user.id} className="flex items-center gap-3 py-3 opacity-60">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                                                <p className="text-xs text-slate-500">holds {user.territory?.name}</p>
                                            </div>
                                            <span className="text-xs text-slate-400">clear first</span>
                                        </div>
                                    ))}
                                    {freeUsers.length === 0 && heldUsers.length === 0 && (
                                        <p className="py-3 text-sm text-slate-500">No approved members yet — share the congregation code from the People tab, or use a magic link below.</p>
                                    )}
                                </div>

                                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Link2 className="h-4 w-4 text-indigo-500" />Magic link only</p>
                                    <p className="mt-0.5 text-xs text-slate-500">Creates a shareable link — no account needed. The link dies when you clear the territory.</p>
                                    <div className="mt-2.5 flex gap-2">
                                        <input
                                            id="magic-link-name"
                                            value={linkName}
                                            onChange={(event) => setLinkName(event.target.value)}
                                            placeholder="Holder's name"
                                            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                        />
                                        <Button size="sm" disabled={busy || !linkName.trim()} onClick={() => assign(assignTarget, undefined, linkName.trim())}>
                                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TerritoriesPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>}>
            <TerritoriesScreen />
        </Suspense>
    );
}
