'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Hand, KeyRound, Loader2, MapPinned, MessageCircle, RotateCcw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { fetchOverview, shareOnWhatsApp, ROLE_LABELS, type AdminOverview, type AdminUser } from '@/lib/adminData';

const AVATAR_COLORS = ['bg-indigo-500', 'bg-emerald-600', 'bg-amber-500', 'bg-rose-500', 'bg-sky-600', 'bg-violet-500'];

function initials(name: string) {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
}

export default function PeoplePage() {
    const router = useRouter();
    const [data, setData] = useState<AdminOverview | null>(null);
    const [myRole, setMyRole] = useState('');
    const [error, setError] = useState('');

    const reload = () => fetchOverview().then(setData).catch(() => router.replace('/login'));

    useEffect(() => {
        reload();
        fetch('/api/app/me').then((res) => res.json()).then((body) => setMyRole(body.user?.role || '')).catch(() => {});
        // near-real-time: territory requests light up without a manual refresh
        const interval = setInterval(reload, 8000);
        return () => clearInterval(interval);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const act = async (payload: Record<string, unknown>) => {
        setError('');
        const res = await fetch('/api/app/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) setError((await res.json()).error || 'That did not work.');
        await reload();
    };

    const rotateCode = async (kind: 'join' | 'team') => {
        const label = kind === 'join' ? 'join code' : 'territory-team code';
        const code = prompt(`New ${label} (share it after changing — the old one stops working):`);
        if (!code) return;
        const res = await fetch('/api/app/codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind, code }),
        });
        if (!res.ok) setError((await res.json()).error || 'Could not change the code.');
        await reload();
    };

    if (!data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const isServant = myRole === 'territory_servant';
    const pending = data.users.filter((user) => user.status === 'pending');
    // people asking for a territory float to the top, highlighted
    const active = [...data.users.filter((user) => user.status === 'active')]
        .sort((a, b) => Number(Boolean(b.requested_at)) - Number(Boolean(a.requested_at)));

    const codeRow = (label: string, code: string, kind: 'join' | 'team', shareLine: string) => (
        <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="truncate font-mono text-base font-bold tracking-widest text-slate-900">{code || '—'}</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-emerald-700" onClick={() => shareOnWhatsApp(shareLine)}>
                <MessageCircle className="h-3.5 w-3.5" />Share
            </Button>
            {isServant && (
                <Button size="sm" variant="outline" className="gap-1.5 text-amber-700" onClick={() => rotateCode(kind)}>
                    <RotateCcw className="h-3.5 w-3.5" />Rotate
                </Button>
            )}
        </div>
    );

    const userRow = (user: AdminUser, index: number) => (
        <div key={user.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${user.requested_at ? 'bg-amber-50 ring-2 ring-inset ring-amber-300' : ''}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}>
                {initials(user.name)}
            </span>
            <div className="min-w-0 flex-1 basis-40">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900">
                    {user.name}
                    {user.requested_at && (
                        <span className="inline-flex shrink-0 animate-pulse items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            <Hand className="h-3 w-3" />asking
                        </span>
                    )}
                </p>
                <p className="truncate text-xs text-slate-500">
                    {ROLE_LABELS[user.role]}
                    {user.territory ? <> · holds <span className="font-semibold">{user.territory.name}</span></> : ' · no territory'}
                </p>
            </div>
            {user.requested_at && !user.territory && (
                <Link href={`/admin/territories?for=${user.id}`}>
                    <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700"><MapPinned className="h-3.5 w-3.5" />Give territory</Button>
                </Link>
            )}
            {user.status === 'pending' ? (
                isServant && (
                    <Button size="sm" className="gap-1.5" onClick={() => act({ action: 'approve', id: user.id })}>
                        <Check className="h-3.5 w-3.5" />Approve
                    </Button>
                )
            ) : isServant && (
                <div className="ml-auto flex items-center gap-1.5">
                    <select
                        aria-label={`Role for ${user.name}`}
                        value={user.role}
                        onChange={(event) => act({ action: 'role', id: user.id, role: event.target.value })}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
                    >
                        <option value="publisher">Publisher</option>
                        <option value="territory_team">Team</option>
                        <option value="territory_servant">Servant</option>
                    </select>
                    <button
                        type="button"
                        aria-label={`Reset password for ${user.name}`}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-slate-800"
                        onClick={() => {
                            const password = prompt(`New temporary password for ${user.name} (share it with them privately):`);
                            if (password) act({ action: 'password', id: user.id, password });
                        }}
                    >
                        <KeyRound className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        aria-label={`Remove ${user.name}`}
                        className="rounded-lg border border-slate-200 p-1.5 text-red-500 hover:text-red-700"
                        onClick={() => {
                            if (confirm(`Remove ${user.name}'s account? Their active territory link keeps working until cleared.`)) {
                                act({ action: 'remove', id: user.id });
                            }
                        }}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto w-full max-w-2xl p-4">
                <header className="flex items-baseline justify-between pb-3 pt-1">
                    <h1 className="text-xl font-bold text-slate-900">People</h1>
                    <span className="text-xs font-medium text-slate-500">{data.users.length} members</span>
                </header>

                {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                {data.settings && (
                    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Congregation codes</p>
                        {codeRow('Join code — for everyone', data.settings.join_code, 'join',
                            `Join ${data.settings.congregation_name} on MapDispenser: sign up at ${window.location.origin}/signup with code ${data.settings.join_code}`)}
                        <div className="border-t border-slate-100" />
                        {codeRow('Territory-team code — for helpers', data.settings.team_code, 'team',
                            `Territory team code for ${data.settings.congregation_name}: ${data.settings.team_code} (enter it under "Part of the territory team?" when signing up)`)}
                    </section>
                )}

                {pending.length > 0 && (
                    <section className="mt-4">
                        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-amber-600">Waiting for approval</h2>
                        <div className="divide-y divide-slate-100 rounded-xl border border-amber-200 bg-white shadow-sm">
                            {pending.map(userRow)}
                        </div>
                    </section>
                )}

                <section className="mt-4">
                    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Members</h2>
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
                        {active.length === 0 && <p className="p-4 text-sm text-slate-500">Nobody yet — share the join code above on WhatsApp.</p>}
                        {active.map(userRow)}
                    </div>
                </section>
            </div>
        </div>
    );
}
