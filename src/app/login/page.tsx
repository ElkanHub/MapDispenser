'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, MapPinned } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { installFlowDone } from '@/lib/pwaClient';

export default function LoginPage() {
    const router = useRouter();
    const [congregation, setCongregation] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        fetch('/api/app/auth/bootstrap')
            .then((res) => res.json())
            .then((data) => {
                if (data.needsSetup) router.replace('/signup');
                else setCongregation(data.congregationName || '');
            })
            .catch(() => {});
    }, [router]);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const res = await fetch('/api/app/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Sign in failed.');
            if (installFlowDone()) {
                router.replace(data.role === 'publisher' ? '/home' : '/admin');
            } else {
                router.replace('/install');
            }
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Sign in failed.');
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-sm">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
                        <MapPinned className="h-7 w-7" />
                    </div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Welcome back</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {congregation ? `Sign in to ${congregation}'s territories` : 'Sign in to see your territory'}
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                        <input
                            id="login-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
                        <div className="relative">
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-16 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            />
                            <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute inset-y-0 right-3 text-xs font-semibold text-slate-400">
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </label>

                    {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                    <Button type="submit" disabled={busy} className="w-full py-6 text-base">
                        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign in'}
                    </Button>
                    <p className="text-center text-xs text-slate-400">Forgot your password? The territory servant can reset it for you.</p>
                </form>

                <Link href="/signup" className="mt-4 block">
                    <Button variant="outline" className="w-full py-6 text-base">
                        I&apos;m new — I have a congregation code
                    </Button>
                </Link>
            </div>
        </div>
    );
}
