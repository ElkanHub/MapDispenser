'use client';

import Link from 'next/link';
import { ArrowLeft, Navigation } from 'lucide-react';

import LiveMap from '@/components/live-map';
import { navigateUrl, type PanelTerritory } from '@/components/territory-panel';
import { Button } from '@/components/ui/button';

// Full-screen live map: pulsing boundary, live location dot, navigate handoff.
export default function LiveMapScreen({ territory, backHref }: { territory: PanelTerritory; backHref: string }) {
    const navUrl = navigateUrl(territory);

    return (
        <div className="fixed inset-0 bg-slate-100">
            {territory.geometry ? (
                <LiveMap
                    shapes={[{ id: territory.id, name: territory.territory_name, geometry: territory.geometry, color: territory.color }]}
                    highlightId={territory.id}
                    showLocation
                    className="h-full w-full"
                />
            ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
                    This territory has no map shape yet. Ask the territory servant to import the KMZ file.
                </div>
            )}

            <Link
                href={backHref}
                aria-label="Back"
                className="absolute left-3 top-3 z-[600] flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md active:scale-95"
            >
                <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="absolute inset-x-0 bottom-0 z-[600] p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
                <div className="mx-auto flex w-full max-w-md items-center gap-3">
                    <div className="flex-1 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                        <p className="text-sm font-bold text-slate-900">{territory.territory_name}</p>
                        <p className="text-xs text-slate-500">Stay within the pulsing boundary</p>
                    </div>
                    {navUrl && (
                        <Button className="gap-2 py-6 shadow-lg" onClick={() => window.open(navUrl, '_blank', 'noopener,noreferrer')}>
                            <Navigation className="h-4 w-4" />
                            Navigate
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
