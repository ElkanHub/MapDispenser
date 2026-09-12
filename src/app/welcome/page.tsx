'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { enablePush } from '@/lib/pwaClient';

const PERKS = [
    'Live map of your territory with your position on it',
    'Works offline once your territory is loaded',
    'One-tap navigation with Google Maps',
];

export default function WelcomePage() {
    const router = useRouter();
    const [me, setMe] = useState<{ name: string; role: string; congregation: string } | null>(null);
    const [going, setGoing] = useState(false);

    const go = async () => {
        if (!me || going) return;
        setGoing(true);
        // best moment to ask: a deliberate tap, before they're busy in the app
        await enablePush();
        router.replace(me.role === 'publisher' ? '/home' : '/admin');
    };

    useEffect(() => {
        fetch('/api/app/me')
            .then(async (res) => {
                if (!res.ok) throw new Error();
                const body = await res.json();
                setMe({ name: body.user.name, role: body.user.role, congregation: body.congregationName });
            })
            .catch(() => router.replace('/login'));
    }, [router]);

    if (!me) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-600 to-indigo-800 p-6 text-center">
            <img
                src="/icons/icon-192x192.png"
                alt="MapDispenser"
                className="animate-in zoom-in-50 fade-in h-24 w-24 rounded-3xl shadow-2xl duration-700"
            />
            <h1 className="animate-in fade-in slide-in-from-bottom-3 mt-6 text-3xl font-extrabold tracking-tight text-white duration-700" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
                Welcome, {me.name.split(' ')[0]}!
            </h1>
            {me.congregation && (
                <p className="animate-in fade-in mt-2 rounded-full bg-white/15 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-indigo-100 duration-700" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
                    {me.congregation} congregation
                </p>
            )}

            <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
                {PERKS.map((perk, index) => (
                    <div
                        key={perk}
                        className="animate-in fade-in slide-in-from-bottom-4 flex items-center gap-3 rounded-xl bg-white/10 p-3 text-left text-sm font-medium text-white duration-500"
                        style={{ animationDelay: `${450 + index * 150}ms`, animationFillMode: 'both' }}
                    >
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                        {perk}
                    </div>
                ))}
            </div>

            <Button
                className="animate-in fade-in mt-10 w-full max-w-xs bg-white py-6 text-base font-bold text-indigo-700 shadow-xl hover:bg-indigo-50 duration-500"
                style={{ animationDelay: '950ms', animationFillMode: 'both' }}
                onClick={go}
                disabled={going}
            >
                {going ? <Loader2 className="h-5 w-5 animate-spin" /> : "Let's go"}
            </Button>
            <p className="animate-in fade-in mt-3 text-xs text-indigo-200 duration-500" style={{ animationDelay: '1100ms', animationFillMode: 'both' }}>
                We&apos;ll ask to send you notifications — say yes to know when a territory is yours.
            </p>
        </div>
    );
}
