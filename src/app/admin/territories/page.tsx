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

interface NewLink {
    holder: string;
    link: string;
}

function TerritoriesScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const focusId = Number(searchParams.get('focus')) || null;
    const forId = Number(searchParams.get('for')) || null;
    const [data, setData] = useState<AdminOverview | null>(null);
    const [assignTarget, setAssignTarget] = useState<AdminTerritory | null>(null);
    const [picked, setPicked] = useState<number[]>([]);
    const [linkName, setLinkName] = useState('');
    const [busy, setBusy] = useState(false);
    const [sheetError, setSheetError] = useState('');
    const [done, setDone] = useState<{ territory: string; links: NewLink[] } | null>(null);
    const [copiedKey, setCopiedKey] = useState('');
    const focusRef = useRef<HTMLDivElement | null>(null);

    const reload = () => fetchOverview().then(setData).catch(() => router.replace('/login'));
    useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { focusRef.current?.scrollIntoView({ block: 'center' }); }, [data]);

    const copy = async (key: string, link: string) => {
        try {
            await navigator.clipboard.writeText(link);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(''), 2000);
        } catch {
            alert(link);
        }
    };

    const openSheet = (territory: AdminTerritory) => {
        setAssignTarget(territory);
        setPicked([]);
        setDone(null);
        setSheetError('');
    };

    const assign = async (territory: AdminTerritory, userIds: number[], holderName?: string) => {
        setBusy(true);
        setSheetError('');
        try {
            const res = await fetch('/api/app/checkouts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ territoryId: territory.id, userIds: userIds.length ? userIds : undefined, holderName }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || 'Could not assign.');
            if (body.errors?.length) setSheetError(body.errors.join(' '));
            setDone({
                territory: territory.territory_name,
                links: (body.checkouts || []).map((checkout: { holder_name?: string; token: string }) => ({
                    holder: checkout.holder_name || holderName || 'link holder',
                    link: tokenLink(checkout.token),
                })),
            });
            setLinkName('');
            setPicked([]);
            await reload();
        } catch (error) {
            setSheetError(error instanceof Error ? error.message : 'Could not assign.');
        } finally {
            setBusy(false);
        }
    };

    const clear = async (territory: AdminTerritory, checkout: { id: number; holder: string }) => {
        if (!confirm(`Clear ${territory.territory_name} from ${checkout.holder}? Their link stops working.`)) return;
        const res = await fetch('/api/app/checkouts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutId: checkout.id, status: 'returned' }),
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
                            <p className="text-xs text-amber-800">Tap Assign on any territory below.</p>
                        </div>
                        <button type="button" onClick={() => router.replace('/admin/territories')} className="text-xs font-semibold text-amber-700 underline-offset-2 hover:underline">Cancel</button>
                    </div>
                )}

                <div className="flex flex-col gap-2.5">
                    {data.territories.map((territory) => {
                        const chip = CHIP[territory.status];
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
                                        {territory.checkouts.length
                                            ? `${territory.checkouts.length} holder${territory.checkouts.length === 1 ? '' : 's'}`
                                            : territory.lastAssignedAt
                                                ? `last out ${new Date(territory.lastAssignedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
                                                : 'never assigned'}
                                    </span>
                                </div>

                                {territory.checkouts.length > 0 && (
                                    <div className="mt-2.5 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/60">
                                        {territory.checkouts.map((checkout) => {
                                            const link = tokenLink(checkout.token);
                                            const key = `co-${checkout.id}`;
                                            return (
                                                <div key={checkout.id} className="flex items-center gap-2 px-3 py-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold text-slate-800">{checkout.holder}</p>
                                                        <p className="text-[11px] text-slate-500">out {daysOut(checkout.assigned_at)}</p>
                                                    </div>
                                                    <button type="button" aria-label={`Copy link for ${checkout.holder}`} onClick={() => copy(key, link)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 active:scale-95">
                                                        {copiedKey === key ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                                    </button>
                                                    <button type="button" aria-label={`WhatsApp link for ${checkout.holder}`} onClick={() => shareOnWhatsApp(shareText(territory.territory_name, link))} className="rounded-lg border border-slate-200 bg-white p-2 text-emerald-700 active:scale-95">
                                                        <MessageCircle className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button type="button" aria-label={`Clear ${checkout.holder}`} onClick={() => clear(territory, checkout)} className="rounded-lg border border-slate-200 bg-white p-2 text-red-600 active:scale-95">
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {territory.status !== 'inactive' && (
                                    <div className="mt-2.5 flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant={territory.checkouts.length ? 'outline' : 'default'}
                                            className={`gap-1.5 ${forUser ? 'bg-amber-600 text-white hover:bg-amber-700' : ''}`}
                                            disabled={busy}
                                            onClick={() => {
                                                // direct mode: a person was already chosen on the People tab
                                                if (forUser) {
                                                    setDone(null);
                                                    setSheetError('');
                                                    setAssignTarget(territory);
                                                    assign(territory, [forUser.id]);
                                                } else {
                                                    openSheet(territory);
                                                }
                                            }}
                                        >
                                            {busy && forUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                                            {forUser ? `Assign to ${forUser.name.split(' ')[0]}` : territory.checkouts.length ? 'Add people' : 'Assign'}
                                        </Button>
                                    </div>
                                )}
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
                            <div className="space-y-4">
                                <div className="text-center">
                                    <Check className="mx-auto h-10 w-10 rounded-full bg-emerald-100 p-2 text-emerald-700" />
                                    <p className="mt-2 font-bold text-slate-900">{done.territory} assigned</p>
                                    <p className="mt-1 text-sm text-slate-500">Share each person&apos;s link so they can open the map.</p>
                                </div>
                                {sheetError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{sheetError}</p>}
                                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                                    {done.links.map((entry, index) => (
                                        <div key={index} className="flex items-center gap-2 px-3 py-2.5">
                                            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{entry.holder}</p>
                                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(`done-${index}`, entry.link)}>
                                                {copiedKey === `done-${index}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                                {copiedKey === `done-${index}` ? 'Copied' : 'Copy'}
                                            </Button>
                                            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => shareOnWhatsApp(shareText(done.territory, entry.link))}>
                                                <MessageCircle className="h-3.5 w-3.5" />Send
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <Button variant="ghost" className="w-full" onClick={() => { setAssignTarget(null); if (forId) router.replace('/admin/territories'); }}>Done</Button>
                            </div>
                        ) : (
                            <>
                                <h2 className="font-bold text-slate-900">Assign {assignTarget.territory_name} to…</h2>
                                <p className="mt-0.5 text-sm text-slate-500">Tick everyone working this territory together, or create a link for someone without an account.</p>
                                {sheetError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{sheetError}</p>}

                                <div className="mt-3 divide-y divide-slate-100">
                                    {freeUsers.map((user) => {
                                        const checked = picked.includes(user.id);
                                        return (
                                            <label key={user.id} className={`flex cursor-pointer items-center gap-3 py-3 ${user.requested_at ? 'rounded-lg bg-amber-50 px-2 -mx-2' : ''}`}>
                                                <input
                                                    id={`assign-user-${user.id}`}
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => setPicked((prev) => checked ? prev.filter((id) => id !== user.id) : [...prev, user.id])}
                                                    className="h-5 w-5 accent-indigo-600"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900">
                                                        {user.name}
                                                        {user.requested_at && <span className="animate-pulse rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">asking</span>}
                                                    </p>
                                                    <p className="text-xs text-slate-500">no territory</p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                    {heldUsers.map((user) => (
                                        <div key={user.id} className="flex items-center gap-3 py-3 opacity-60">
                                            <span className="h-5 w-5" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                                                <p className="text-xs text-slate-500">holds {user.territory?.name} — clear first</p>
                                            </div>
                                        </div>
                                    ))}
                                    {freeUsers.length === 0 && heldUsers.length === 0 && (
                                        <p className="py-3 text-sm text-slate-500">No approved members yet — share the congregation code from the People tab, or use a magic link below.</p>
                                    )}
                                </div>

                                {picked.length > 0 && (
                                    <Button className="mt-3 w-full gap-2 py-5" disabled={busy} onClick={() => assign(assignTarget, picked)}>
                                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                        Assign to {picked.length} {picked.length === 1 ? 'person' : 'people'}
                                    </Button>
                                )}

                                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Link2 className="h-4 w-4 text-indigo-500" />Magic link only</p>
                                    <p className="mt-0.5 text-xs text-slate-500">Creates a shareable link — no account needed. The link dies when that holder is cleared.</p>
                                    <div className="mt-2.5 flex gap-2">
                                        <input
                                            id="magic-link-name"
                                            value={linkName}
                                            onChange={(event) => setLinkName(event.target.value)}
                                            placeholder="Holder's name"
                                            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                        />
                                        <Button size="sm" disabled={busy || !linkName.trim()} onClick={() => assign(assignTarget, [], linkName.trim())}>
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
