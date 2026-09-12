'use client';

import { WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function OfflinePage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 text-slate-500">
                <WifiOff className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">You&apos;re offline</h1>
            <p className="mt-2 max-w-xs text-sm text-slate-500">
                This page isn&apos;t saved on your phone yet. Screens you&apos;ve opened before — like your territory and its map — still work offline.
            </p>
            <Button className="mt-6" onClick={() => window.location.reload()}>Try again</Button>
        </div>
    );
}
