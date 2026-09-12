'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2, MapPinned } from 'lucide-react';

import { Button } from '@/components/ui/button';

const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const codeClass = `${inputClass} font-mono uppercase tracking-widest`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            {children}
        </label>
    );
}

export default function SignupPage() {
    const router = useRouter();
    const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
    const [showTeam, setShowTeam] = useState(false);

    const [joinCode, setJoinCode] = useState('');
    const [teamCode, setTeamCode] = useState('');
    const [congregationName, setCongregationName] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [bootError, setBootError] = useState('');

    // Never guess the mode: setup vs join comes from the server, and a failed
    // check is shown as an error instead of silently rendering the join form.
    const loadBootstrap = () => {
        setBootError('');
        setNeedsSetup(null);
        fetch('/api/app/auth/bootstrap')
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Could not reach the server.');
                setNeedsSetup(Boolean(data.needsSetup));
            })
            .catch((bootstrapError) => {
                setBootError(bootstrapError instanceof Error ? bootstrapError.message : 'Could not reach the server.');
            });
    };
    useEffect(loadBootstrap, []);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const res = await fetch('/api/app/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, joinCode, teamCode, congregationName }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Sign up failed.');
            // compulsory once: walk them through installing the app first
            router.replace('/install');
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Sign up failed.');
            setBusy(false);
        }
    };

    if (bootError) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
                <div className="w-full max-w-sm space-y-4 rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
                    <h1 className="text-lg font-bold text-slate-900">Can&apos;t check the database</h1>
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-700">{bootError}</p>
                    <p className="text-xs text-slate-500">
                        Usually this means the app is set to the Neon backend but DATABASE_URL is missing or wrong (check your host&apos;s environment variables, or a leftover data/backend.json).
                    </p>
                    <Button className="w-full" onClick={loadBootstrap}>Try again</Button>
                </div>
            </div>
        );
    }

    if (needsSetup === null) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 py-10">
            <div className="w-full max-w-sm">
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
                        <MapPinned className="h-7 w-7" />
                    </div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                        {needsSetup ? 'Set up your congregation' : 'Join your congregation'}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {needsSetup
                            ? 'You are the first account: you become the territory servant and choose the codes your congregation will use.'
                            : 'Enter the code your territory servant shared with you.'}
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    {needsSetup ? (
                        <>
                            <Field label="Congregation name">
                                <input id="setup-congregation" required value={congregationName} onChange={(event) => setCongregationName(event.target.value)} className={inputClass} placeholder="e.g. Maryland" />
                            </Field>
                            <Field label="Join code (for everyone)">
                                <input id="setup-join-code" required value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} className={codeClass} placeholder="e.g. MARYLAND-24" />
                            </Field>
                            <Field label="Territory-team code (for helpers)">
                                <input id="setup-team-code" required value={teamCode} onChange={(event) => setTeamCode(event.target.value.toUpperCase())} className={codeClass} placeholder="e.g. TT-QUARRY" />
                            </Field>
                            <div className="border-t border-slate-100" />
                        </>
                    ) : (
                        <Field label="Congregation code">
                            <input id="signup-join-code" required value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} className={codeClass} placeholder="ASK YOUR TERRITORY SERVANT" />
                        </Field>
                    )}

                    <Field label="Full name">
                        <input id="signup-name" required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Email">
                        <input id="signup-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Password (6+ characters)">
                        <input id="signup-password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
                    </Field>

                    {!needsSetup && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <button type="button" onClick={() => setShowTeam((prev) => !prev)} className="flex w-full items-center justify-between text-left">
                                <span>
                                    <span className="block text-sm font-semibold text-slate-800">Part of the territory team?</span>
                                    <span className="block text-xs text-slate-500">Enter the team code to get territory tools.</span>
                                </span>
                                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showTeam ? 'rotate-180' : ''}`} />
                            </button>
                            {showTeam && (
                                <input
                                    id="signup-team-code"
                                    value={teamCode}
                                    onChange={(event) => setTeamCode(event.target.value.toUpperCase())}
                                    className={`${codeClass} mt-3`}
                                    placeholder="TEAM CODE (OPTIONAL)"
                                />
                            )}
                        </div>
                    )}

                    {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                    <Button type="submit" disabled={busy} className="w-full py-6 text-base">
                        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : needsSetup ? 'Create congregation & account' : 'Create account'}
                    </Button>
                </form>

                <p className="mt-4 text-center text-sm text-slate-500">
                    Already have an account? <Link href="/login" className="font-semibold text-indigo-600">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
