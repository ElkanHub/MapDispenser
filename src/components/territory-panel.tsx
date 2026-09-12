'use client';

import Link from 'next/link';
import { CheckCircle2, Compass, ExternalLink, ImageOff, MapPin, Navigation } from 'lucide-react';

import LiveMap from '@/components/live-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { geometryCentroid, type TerritoryGeometry } from '@/lib/geo';

export interface PanelTerritory {
    id: number;
    territory_name: string;
    map_link: string;
    map_image_url: string;
    map_description: string;
    geometry?: TerritoryGeometry | null;
    color?: string;
}

export function navigateUrl(territory: PanelTerritory): string {
    if (territory.geometry) {
        const [lng, lat] = geometryCentroid(territory.geometry);
        return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    }
    return territory.map_link;
}

export default function TerritoryPanel({
    territory,
    holderLabel,
    assignedAt,
    liveMapHref,
}: {
    territory: PanelTerritory;
    holderLabel: string;
    assignedAt?: string;
    liveMapHref: string;
}) {
    const hasShape = Boolean(territory.geometry);
    const navUrl = navigateUrl(territory);

    return (
        <div className="flex w-full flex-col gap-5">
            <div className="text-center">
                <div className="mb-2 flex items-center justify-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-semibold uppercase tracking-wide">{holderLabel}</span>
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{territory.territory_name}</h1>
                {assignedAt && (
                    <p className="mt-1 text-sm text-slate-500">Checked out {new Date(assignedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
                )}
            </div>

            <Card className="overflow-hidden border-slate-200 py-0 shadow-lg">
                {hasShape ? (
                    <Link href={liveMapHref} className="relative block aspect-[4/3] w-full bg-slate-100">
                        <LiveMap
                            shapes={[{ id: territory.id, name: territory.territory_name, geometry: territory.geometry!, color: territory.color }]}
                            highlightId={territory.id}
                            interactive={false}
                            className="h-full w-full"
                        />
                        <span className="absolute bottom-3 right-3 z-[600] flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-[#fff]">
                            <Compass className="h-3.5 w-3.5" />Tap for live map
                        </span>
                    </Link>
                ) : territory.map_image_url ? (
                    <div className="relative block aspect-[4/3] w-full bg-slate-100">
                        {/* object-contain: maps must never be cropped */}
                        <img src={territory.map_image_url} alt={`Map of ${territory.territory_name}`} className="h-full w-full object-contain" />
                    </div>
                ) : (
                    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400">
                        <ImageOff className="h-8 w-8" />
                        <span className="text-sm">No map yet — ask the territory servant to import the KMZ</span>
                    </div>
                )}

                <CardContent className="space-y-2 p-5">
                    <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                        <MapPin className="h-4 w-4 text-indigo-500" />
                        Description
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-600">{territory.map_description || 'No description provided.'}</p>
                </CardContent>

                <CardFooter className="flex flex-col gap-3 bg-slate-50 p-5">
                    {hasShape && (
                        <Link href={liveMapHref} className="w-full">
                            <Button className="w-full gap-2 py-6 text-base">
                                <Compass className="h-5 w-5" />
                                Open live map
                            </Button>
                        </Link>
                    )}
                    <div className="grid w-full grid-cols-2 gap-3">
                        {navUrl && (
                            <Button variant={hasShape ? 'outline' : 'default'} className="w-full gap-2" onClick={() => window.open(navUrl, '_blank', 'noopener,noreferrer')}>
                                <Navigation className="h-4 w-4" />Navigate
                            </Button>
                        )}
                        {territory.map_link && (
                            <Button variant="outline" className="w-full gap-2" onClick={() => window.open(territory.map_link, '_blank', 'noopener,noreferrer')}>
                                <ExternalLink className="h-4 w-4" />Google Maps
                            </Button>
                        )}
                        {territory.map_image_url && (
                            <Button variant="outline" className={`w-full gap-2 ${!navUrl || !territory.map_link ? '' : 'col-span-2'}`} asChild>
                                <a href={territory.map_image_url} download={`${territory.territory_name.replace(/\s+/g, '_')}_map`}>Save map image</a>
                            </Button>
                        )}
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
