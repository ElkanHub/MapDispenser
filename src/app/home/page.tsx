'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Hand, Info, Loader2, MapPinned, ShieldCheck } from 'lucide-react';

import { RoleNav, SignOutButton } from '@/components/app-nav';
import PushCard from '@/components/push-card';
import ThemeToggle from '@/components/theme-toggle';
import TerritoryPanel, { type PanelTerritory } from '@/components/territory-panel';
import { Button } from '@/components/ui/button';

interface MeResponse {
    user: { id: number; name: string; role: string; status: string };
    congregationName: string;
}

interface AssignmentResponse {
    pending?: boolean;
    none?: boolean;
    requested?: boolean;
    checkout?: { id: number; assigned_at: string; token: string };
    territory?: PanelTerritory;
}

export default function HomePage() {
    const router = useRouter();
    const [me, setMe] = useState<MeResponse | null>(null);
    const [assignment, setAssignment] = useState<AssignmentResponse | null>(null);
    const [update, setUpdate] = useState<{ title: string; message: string } | null>(null);
    const [asking, setAsking] = useState(false);

    const toggleRequest = async (on: boolean) => {
        setAsking(true);
        try {
            const res = await fetch('/api/app/request-territory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ on }),
            });
            if (res.ok) setAssignment((prev) => (prev ? { ...prev, requested: on } : prev));
        } finally {
            setAsking(false);
        }
    };

    useEffect(() => {
        (async () => {
            const meRes = await fetch('/api/app/me');
            if (meRes.status === 401) {
                router.replace('/login');
                return;
            }
            setMe(await meRes.json());
            const [assignmentRes, updateRes] = await Promise.all([
                fetch('/api/app/my-assignment'),
                fetch('/api/system-update'),
            ]);
            if (assignmentRes.ok) setAssignment(await assignmentRes.json());
            if (updateRes.ok) {
                const data = await updateRes.json();
                if (!data.no_update) setUpdate(data);
            }
        })().catch(() => {});
    }, [router]);

    if (!me || !assignment) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const isAdmin = me.user.role !== 'publisher';

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <header className="mx-auto flex w-full max-w-md items-center gap-2 px-4 pb-1 pt-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                    <MapPinned className="h-4.5 w-4.5" />
                </div>
                <span className="font-bold text-slate-900">MapDispenser</span>
                {me.congregationName && (
                    <span className="rounded-full bg-slate-200/70 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {me.congregationName}
                    </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                    {isAdmin && (
                        <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                            <ShieldCheck className="h-3.5 w-3.5" />Desk
                        </Link>
                    )}
                    <ThemeToggle />
                    <SignOutButton />
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
                <PushCard />
                {update && (
                    <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <Info className="h-5 w-5 shrink-0 text-blue-600" />
                        <div>
                            <p className="text-sm font-semibold text-blue-900">{update.title}</p>
                            <p className="mt-0.5 text-sm text-blue-800">{update.message}</p>
                        </div>
                    </div>
                )}

                {assignment.pending && (
                    <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
                        <Clock className="h-10 w-10 text-amber-500" />
                        <h2 className="text-lg font-bold text-amber-900">Waiting for approval</h2>
                        <p className="text-sm text-amber-800">
                            Hi {me.user.name.split(' ')[0]} — your account is created. The territory servant just needs to approve it before you can see territory maps.
                        </p>
                    </div>
                )}

                {assignment.none && (
                    <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <MapPinned className="h-10 w-10 text-slate-300" />
                        <h2 className="text-lg font-bold text-slate-900">No territory assigned yet</h2>
                        <p className="text-sm text-slate-500">
                            When the territory servant assigns you one, it appears here with its live map.
                        </p>
                        {assignment.requested ? (
                            <>
                                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-bold text-amber-800">
                                    <Hand className="h-3.5 w-3.5" />
                                    Request sent — your territory servant can see it
                                </span>
                                <button
                                    type="button"
                                    disabled={asking}
                                    onClick={() => toggleRequest(false)}
                                    className="text-xs font-medium text-slate-400 underline-offset-2 hover:underline"
                                >
                                    {asking ? 'One moment…' : 'Cancel request'}
                                </button>
                            </>
                        ) : (
                            <Button className="mt-1 gap-2" disabled={asking} onClick={() => toggleRequest(true)}>
                                {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                                Ask for a territory
                            </Button>
                        )}
                    </div>
                )}

                {assignment.territory && assignment.checkout && (
                    <TerritoryPanel
                        territory={assignment.territory}
                        holderLabel="Assigned to you"
                        assignedAt={assignment.checkout.assigned_at}
                        liveMapHref="/map"
                    />
                )}
            </main>

            <RoleNav />
        </div>
    );
}
