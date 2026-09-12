'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Check, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { enablePush, pushSupported } from '@/lib/pwaClient';

type PushState = 'unsupported' | 'ask' | 'enabled' | 'denied';

// One card, three moods: ask to turn on, confirm it's on (with a test
// button where useful), or explain that the browser has it blocked.
export default function PushCard({ withTest = false }: { withTest?: boolean }) {
    const [state, setState] = useState<PushState | null>(null);
    const [busy, setBusy] = useState(false);
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser permission state on mount
        setState(!pushSupported() ? 'unsupported'
            : Notification.permission === 'granted' ? 'enabled'
            : Notification.permission === 'denied' ? 'denied'
            : 'ask');
    }, []);

    const turnOn = async () => {
        setBusy(true);
        const result = await enablePush();
        setState(result === 'enabled' ? 'enabled' : result === 'denied' ? 'denied' : 'unsupported');
        setBusy(false);
    };

    const sendTest = async () => {
        setBusy(true);
        setTestMessage('');
        try {
            // make sure this device is actually registered before testing
            await enablePush();
            const res = await fetch('/api/app/push/test', { method: 'POST' });
            setTestMessage(res.ok ? 'Sent — check your notifications.' : (await res.json()).error || 'Could not send.');
        } catch {
            setTestMessage('Could not send.');
        } finally {
            setBusy(false);
        }
    };

    if (state === null || state === 'unsupported') return null;

    if (state === 'ask') {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3.5">
                <Bell className="h-5 w-5 shrink-0 text-indigo-600" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-indigo-900">Turn on notifications</p>
                    <p className="text-xs text-indigo-800">Know the moment something needs your attention.</p>
                </div>
                <Button size="sm" disabled={busy} onClick={turnOn}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Turn on'}
                </Button>
            </div>
        );
    }

    if (state === 'denied') {
        if (!withTest) return null;
        return (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                <BellOff className="h-5 w-5 shrink-0 text-slate-400" />
                <p className="text-xs text-slate-500">Notifications are blocked for this app — allow them in your phone&apos;s browser/app settings to get alerts.</p>
            </div>
        );
    }

    // enabled
    if (!withTest) return null;
    return (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
            <BellRing className="h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Notifications are on</p>
                {testMessage && <p className="text-xs text-emerald-700">{testMessage}</p>}
            </div>
            <Button size="sm" variant="outline" disabled={busy} onClick={sendTest} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Send test
            </Button>
        </div>
    );
}
