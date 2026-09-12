'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpFromDot, Check, Download, MoreVertical, Plus, SquareArrowOutUpRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { isStandalone, markInstallFlowDone } from '@/lib/pwaClient';

type Platform = 'android' | 'ios';

function StepCard({ number, title, children, visual }: { number: number; title: string; children: React.ReactNode; visual: React.ReactNode }) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" style={{ animationDelay: `${number * 120}ms`, animationFillMode: 'both', animationDuration: '500ms' }}>
            <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{number}</span>
                <p className="text-sm font-bold text-slate-900">{title}</p>
            </div>
            <div className="mt-3 flex items-center justify-center rounded-xl bg-slate-100 py-4">{visual}</div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">{children}</p>
        </div>
    );
}

// tiny phone-chrome mockups for the visuals
function BrowserBar({ highlight }: { highlight: 'menu' | 'none' }) {
    return (
        <div className="flex w-56 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-slate-300" />
            <div className="flex-1 rounded-full bg-slate-100 px-2 py-1 text-center text-[10px] text-slate-500">mapdispenser…</div>
            <span className={`rounded-full p-1 ${highlight === 'menu' ? 'animate-pulse bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400' : 'text-slate-400'}`}>
                <MoreVertical className="h-4 w-4" />
            </span>
        </div>
    );
}

function MenuSheet({ rows, highlightIndex, highlightIcon }: { rows: string[]; highlightIndex: number; highlightIcon: React.ReactNode }) {
    return (
        <div className="w-56 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md">
            {rows.map((row, index) => (
                <div key={row} className={`flex items-center gap-2 px-3 py-2 text-[11px] ${index === highlightIndex ? 'animate-pulse bg-indigo-50 font-bold text-indigo-800 ring-2 ring-inset ring-indigo-400' : 'text-slate-500'} ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                    {index === highlightIndex && highlightIcon}
                    {row}
                </div>
            ))}
        </div>
    );
}

function SafariBar() {
    return (
        <div className="flex w-56 items-center justify-around rounded-xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm text-slate-400">
            <span className="text-xs">‹</span>
            <span className="text-xs">›</span>
            <span className="animate-pulse rounded-full bg-indigo-100 p-1.5 text-indigo-700 ring-2 ring-indigo-400">
                <ArrowUpFromDot className="h-4 w-4" />
            </span>
            <span className="text-xs">▢</span>
            <span className="text-xs">❐</span>
        </div>
    );
}

function HomeScreen() {
    return (
        <div className="grid w-56 grid-cols-4 gap-3 rounded-xl bg-slate-700 p-3">
            {[0, 1, 2].map((index) => <div key={index} className="aspect-square rounded-xl bg-slate-500/60" />)}
            <div className="flex flex-col items-center">
                <img src="/icons/icon-192x192.png" alt="MapDispenser icon" className="aspect-square w-full animate-pulse rounded-xl ring-2 ring-amber-300" />
            </div>
        </div>
    );
}

export default function InstallPage() {
    const router = useRouter();
    const [platform, setPlatform] = useState<Platform | null>(null);
    const [canPrompt, setCanPrompt] = useState(false);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        // already running as the installed app — nothing to teach
        if (isStandalone()) {
            markInstallFlowDone();
            router.replace('/welcome');
            return;
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time device detection on mount
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) setPlatform('ios');
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a window global set before mount
        setCanPrompt(Boolean(window.__mdInstallPrompt));
        const onAvailable = () => setCanPrompt(true);
        const onInstalled = () => { setInstalled(true); markInstallFlowDone(); };
        window.addEventListener('md-install-available', onAvailable);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('md-install-available', onAvailable);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, [router]);

    const nativeInstall = async () => {
        const prompt = window.__mdInstallPrompt;
        if (!prompt) return;
        await prompt.prompt();
        const choice = await prompt.userChoice;
        window.__mdInstallPrompt = null;
        setCanPrompt(false);
        if (choice.outcome === 'accepted') setInstalled(true);
    };

    const finish = () => {
        markInstallFlowDone();
        router.replace('/welcome');
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto w-full max-w-md p-4 pb-10">
                <div className="animate-in fade-in zoom-in-95 pt-6 text-center duration-500">
                    <img src="/icons/icon-192x192.png" alt="MapDispenser" className="mx-auto h-20 w-20 rounded-3xl shadow-lg shadow-indigo-600/30" />
                    <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">Put MapDispenser on your phone</h1>
                    <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
                        One quick step before you continue: install the app so it opens from your home screen and your maps work even without internet.
                    </p>
                </div>

                {installed ? (
                    <div className="animate-in fade-in zoom-in-95 mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center duration-500">
                        <Check className="mx-auto h-10 w-10 rounded-full bg-emerald-600 p-2 text-white" />
                        <p className="mt-3 font-bold text-emerald-900">Installed!</p>
                        <p className="mt-1 text-sm text-emerald-800">Open <b>MapDispenser</b> from your home screen from now on.</p>
                        <Button className="mt-4 w-full py-6 text-base" onClick={finish}>Continue</Button>
                    </div>
                ) : (
                    <>
                        <p className="mt-7 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Which phone are you using?</p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPlatform('android')}
                                className={`rounded-2xl border-2 p-4 text-center transition-all ${platform === 'android' ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-slate-200 bg-white'}`}
                            >
                                <span className="text-3xl">🤖</span>
                                <p className="mt-1.5 text-sm font-bold text-slate-900">Android</p>
                                <p className="text-[11px] text-slate-500">Chrome</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPlatform('ios')}
                                className={`rounded-2xl border-2 p-4 text-center transition-all ${platform === 'ios' ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-slate-200 bg-white'}`}
                            >
                                <span className="text-3xl"></span>
                                <p className="mt-1.5 text-sm font-bold text-slate-900">iPhone</p>
                                <p className="text-[11px] text-slate-500">Safari</p>
                            </button>
                        </div>

                        {platform === 'android' && (
                            <div className="mt-5 flex flex-col gap-3">
                                {canPrompt && (
                                    <Button className="animate-in fade-in w-full gap-2 py-6 text-base duration-500" onClick={nativeInstall}>
                                        <Download className="h-5 w-5" />
                                        Install now — one tap
                                    </Button>
                                )}
                                {canPrompt && <p className="text-center text-xs text-slate-400">or do it manually:</p>}
                                <StepCard number={1} title="Open Chrome's menu" visual={<BrowserBar highlight="menu" />}>
                                    Tap the <b>three dots ⋮</b> at the top-right corner of Chrome.
                                </StepCard>
                                <StepCard number={2} title="Tap 'Add to Home screen'" visual={<MenuSheet rows={['New tab', 'Add to Home screen', 'Settings']} highlightIndex={1} highlightIcon={<Plus className="h-3.5 w-3.5" />} />}>
                                    In the menu, choose <b>Add to Home screen</b> (on some phones it says <b>Install app</b>).
                                </StepCard>
                                <StepCard number={3} title="Confirm the install" visual={
                                    <div className="w-56 rounded-xl border border-slate-300 bg-white p-3 shadow-md">
                                        <div className="flex items-center gap-2"><img src="/icons/icon-192x192.png" alt="" className="h-8 w-8 rounded-lg" /><span className="text-xs font-bold text-slate-800">MapDispenser</span></div>
                                        <div className="mt-2 flex justify-end gap-2 text-[11px]"><span className="px-2 py-1 text-slate-400">Cancel</span><span className="animate-pulse rounded-full bg-indigo-600 px-3 py-1 font-bold text-white ring-2 ring-indigo-300">Install</span></div>
                                    </div>
                                }>
                                    Tap <b>Install</b> (or <b>Add</b>) in the box that pops up.
                                </StepCard>
                                <StepCard number={4} title="Open it from your home screen" visual={<HomeScreen />}>
                                    The MapDispenser icon appears on your home screen. <b>Always open the app from there</b> — it&apos;s faster and works offline.
                                </StepCard>
                            </div>
                        )}

                        {platform === 'ios' && (
                            <div className="mt-5 flex flex-col gap-3">
                                <StepCard number={1} title="Make sure you're in Safari" visual={
                                    <div className="flex w-56 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 shadow-sm">
                                        <SquareArrowOutUpRight className="h-4 w-4 text-indigo-600" />Open this page in Safari
                                    </div>
                                }>
                                    Installing only works from <b>Safari</b>. If you opened this link in another app, tap its menu and choose <b>Open in Safari</b> first.
                                </StepCard>
                                <StepCard number={2} title="Tap the Share button" visual={<SafariBar />}>
                                    Tap the <b>Share</b> button — the square with the arrow pointing up, at the bottom of Safari.
                                </StepCard>
                                <StepCard number={3} title="Tap 'Add to Home Screen'" visual={<MenuSheet rows={['Copy', 'Add to Home Screen', 'Add Bookmark']} highlightIndex={1} highlightIcon={<Plus className="h-3.5 w-3.5" />} />}>
                                    Scroll down the share sheet and choose <b>Add to Home Screen</b>.
                                </StepCard>
                                <StepCard number={4} title="Tap Add — done!" visual={<HomeScreen />}>
                                    Tap <b>Add</b> at the top right. MapDispenser now lives on your home screen — <b>open it from there</b> every time.
                                </StepCard>
                            </div>
                        )}

                        {platform && (
                            <div className="mt-6 flex flex-col gap-2">
                                <Button className="w-full py-6 text-base" onClick={finish}>
                                    <Check className="h-5 w-5" />
                                    I&apos;ve installed it — continue
                                </Button>
                                <button type="button" onClick={finish} className="py-2 text-center text-xs font-medium text-slate-400 underline-offset-2 hover:underline">
                                    Skip for now, continue in the browser
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
