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
                className="absolute left-3 top-[max(env(safe-area-inset-top),12px)] z-[600] flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur active:scale-95"
            >
                <ArrowLeft className="h-5 w-5" />
            </Link>

            {/* compact floating chips — the map stays visible and touchable around them */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[600] p-3 pb-[max(env(safe-area-inset-bottom),12px)]">
                <div className="mx-auto flex w-full max-w-md items-center justify-center gap-2">
                    <span className="pointer-events-auto rounded-full border border-slate-200 bg-white/95 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg backdrop-blur">
                        {territory.territory_name}
                    </span>
                    {navUrl && (
                        <Button
                            className="pointer-events-auto gap-2 rounded-full px-5 py-2.5 shadow-lg"
                            onClick={() => window.open(navUrl, '_blank', 'noopener,noreferrer')}
                        >
                            <Navigation className="h-4 w-4" />
                            Navigate
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
