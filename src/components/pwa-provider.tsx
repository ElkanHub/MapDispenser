'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

// Captured for the install guide: Chrome fires this once, before any UI exists.
declare global {
    interface Window {
        __mdInstallPrompt?: { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null;
    }
}

export default function PwaProvider() {
    const [online, setOnline] = useState(true);
    const [backOnline, setBackOnline] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
    const [updating, setUpdating] = useState(false);
    const reloadedRef = useRef(false);

    // --- online / offline awareness ---
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the browser's live value on mount
        setOnline(navigator.onLine);
        const goOnline = () => {
            setOnline(true);
            setBackOnline(true);
            setTimeout(() => setBackOnline(false), 3000);
        };
        const goOffline = () => { setOnline(false); setBackOnline(false); };
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    // --- capture the native install prompt for the install guide ---
    useEffect(() => {
        const onPrompt = (event: Event) => {
            event.preventDefault();
            window.__mdInstallPrompt = event as unknown as Window['__mdInstallPrompt'];
            window.dispatchEvent(new Event('md-install-available'));
        };
        window.addEventListener('beforeinstallprompt', onPrompt);
        return () => window.removeEventListener('beforeinstallprompt', onPrompt);
    }, []);

    // --- service worker registration + update detection ---
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') return;
        if (!('serviceWorker' in navigator)) return;

        navigator.serviceWorker.register('/sw.js').then((registration) => {
            // an update was already waiting when the page opened
            if (registration.waiting && navigator.serviceWorker.controller) setWaitingWorker(registration.waiting);

            registration.addEventListener('updatefound', () => {
                const fresh = registration.installing;
                if (!fresh) return;
                fresh.addEventListener('statechange', () => {
                    if (fresh.state === 'installed' && navigator.serviceWorker.controller) {
                        setWaitingWorker(fresh);
                    }
                });
            });
        }).catch(() => {});

        const onControllerChange = () => {
            if (reloadedRef.current) return;
            reloadedRef.current = true;
            window.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    }, []);

    const applyUpdate = () => {
        setUpdating(true);
        waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
        // safety: if controllerchange never fires, reload anyway
        setTimeout(() => { if (!reloadedRef.current) window.location.reload(); }, 4000);
    };

    return (
        <>
            {!online && (
                <div className="fixed inset-x-0 top-0 z-[1000] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 pt-[max(env(safe-area-inset-top),8px)] text-sm font-semibold text-white">
                    <WifiOff className="h-4 w-4" />
                    You&apos;re offline — showing saved maps and data
                </div>
            )}
            {backOnline && (
                <div className="fixed inset-x-0 top-0 z-[1000] flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2 pt-[max(env(safe-area-inset-top),8px)] text-sm font-semibold text-white">
                    <Wifi className="h-4 w-4" />
                    You&apos;re back online
                </div>
            )}
            {waitingWorker && (
                <div className="fixed inset-x-3 bottom-4 z-[1000] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-indigo-200 bg-white p-3 pl-4 shadow-2xl">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">Update available</p>
                        <p className="text-xs text-slate-500">A new version of MapDispenser is ready.</p>
                    </div>
                    <button
                        type="button"
                        onClick={applyUpdate}
                        disabled={updating}
                        className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white active:scale-95 disabled:opacity-70"
                    >
                        <RefreshCw className={`h-4 w-4 ${updating ? 'animate-spin' : ''}`} />
                        {updating ? 'Updating…' : 'Update'}
                    </button>
                </div>
            )}
        </>
    );
}
