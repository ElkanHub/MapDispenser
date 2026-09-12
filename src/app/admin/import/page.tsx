'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileUp, Loader2, MapPin, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import LiveMap from '@/components/live-map';
import type { TerritoryGeometry } from '@/lib/geo';

interface PreviewItem {
    key: number;
    name: string;
    description: string;
    color: string;
    geometry: TerritoryGeometry;
    territoryId: number | null;
    matchName: string | null;
    include: boolean;
}

interface PreviewLandmark {
    key: number;
    name: string;
    description: string;
    color: string;
    lng: number;
    lat: number;
    include: boolean;
}

export default function ImportPage() {
    const [fileName, setFileName] = useState('');
    const [items, setItems] = useState<PreviewItem[] | null>(null);
    const [pins, setPins] = useState<PreviewLandmark[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<{ updated: number; created: number; pins: number } | null>(null);

    const upload = async (file: File | undefined) => {
        if (!file) return;
        setBusy(true);
        setError('');
        setResult(null);
        setItems(null);
        setFileName(file.name);
        try {
            const body = new FormData();
            body.append('file', file);
            const res = await fetch('/api/app/import', { method: 'POST', body });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not read that file.');
            setItems(data.items);
            setPins(data.landmarks || []);
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Could not read that file.');
        } finally {
            setBusy(false);
        }
    };

    const apply = async () => {
        if (!items) return;
        setBusy(true);
        setError('');
        try {
            const res = await fetch('/api/app/import', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, landmarks: pins }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Import failed.');
            setResult({ updated: data.updated, created: data.created, pins: data.pins || 0 });
            setItems(null);
            setPins([]);
        } catch (applyError) {
            setError(applyError instanceof Error ? applyError.message : 'Import failed.');
        } finally {
            setBusy(false);
        }
    };

    const included = items?.filter((item) => item.include) ?? [];

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto w-full max-w-2xl p-4">
                <header className="pb-3 pt-1">
                    <h1 className="text-xl font-bold text-slate-900">Import from Google Earth</h1>
                    <p className="mt-0.5 text-sm text-slate-500">
                        Upload the same KMZ you use in Google Earth. Placemarks match territories by name; boundaries update in place and assignment history is kept.
                    </p>
                </header>

                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center hover:border-indigo-400">
                    <FileUp className="h-8 w-8 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">{fileName || 'Choose a .kmz or .kml file'}</span>
                    <span className="text-xs text-slate-400">Google Earth → your project → Export as KMZ</span>
                    <input
                        id="kmz-file"
                        type="file"
                        accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml"
                        className="hidden"
                        onChange={(event) => upload(event.target.files?.[0])}
                    />
                </label>

                {busy && !items && (
                    <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />Reading file…
                    </p>
                )}
                {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                {result && (
                    <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                        <p className="font-bold text-emerald-900">
                            Imported — {result.updated} updated{result.created ? `, ${result.created} new` : ''}{result.pins ? `, ${result.pins} pins` : ''}
                        </p>
                        <p className="text-sm text-emerald-800">The live maps now use these boundaries.</p>
                        <div className="mt-1 flex gap-2">
                            <Link href="/admin"><Button variant="outline" size="sm">See the map</Button></Link>
                            <Link href="/admin/territories"><Button size="sm">Go to territories</Button></Link>
                        </div>
                    </div>
                )}

                {items && (
                    <>
                        {(included.length > 0 || pins.some((pin) => pin.include)) && (
                            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                                <LiveMap
                                    shapes={included.map((item) => ({ id: item.key, name: item.name, geometry: item.geometry, color: item.color || undefined }))}
                                    landmarks={pins.filter((pin) => pin.include).map((pin) => ({ id: pin.key, name: pin.name, color: pin.color || undefined, lng: pin.lng, lat: pin.lat }))}
                                    className="h-72 w-full"
                                />
                            </div>
                        )}

                        <section className="mt-4">
                            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {items.length} placemarks found
                            </h2>
                            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
                                {items.map((item) => (
                                    <label key={item.key} className="flex cursor-pointer items-center gap-3 px-4 py-3">
                                        <input
                                            id={`import-item-${item.key}`}
                                            type="checkbox"
                                            checked={item.include}
                                            onChange={() => setItems((prev) => prev!.map((entry) =>
                                                entry.key === item.key ? { ...entry, include: !entry.include } : entry))}
                                            className="h-4 w-4 accent-indigo-600"
                                        />
                                        <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-slate-300" style={{ background: item.color || '#64748b' }} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                                            {item.description && <p className="truncate text-xs text-slate-500">{item.description}</p>}
                                        </div>
                                        {item.territoryId ? (
                                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">updates {item.matchName}</span>
                                        ) : (
                                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">new</span>
                                        )}
                                    </label>
                                ))}
                            </div>
                        </section>

                        {pins.length > 0 && (
                            <section className="mt-4">
                                <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {pins.length} pins (landmarks)
                                </h2>
                                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
                                    {pins.map((pin) => (
                                        <label key={pin.key} className="flex cursor-pointer items-center gap-3 px-4 py-3">
                                            <input
                                                id={`import-pin-${pin.key}`}
                                                type="checkbox"
                                                checked={pin.include}
                                                onChange={() => setPins((prev) => prev.map((entry) =>
                                                    entry.key === pin.key ? { ...entry, include: !entry.include } : entry))}
                                                className="h-4 w-4 accent-indigo-600"
                                            />
                                            <MapPin className="h-4 w-4 shrink-0" style={{ color: pin.color || '#334155' }} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-slate-900">{pin.name}</p>
                                                {pin.description && <p className="truncate text-xs text-slate-500">{pin.description}</p>}
                                            </div>
                                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-800">landmark</span>
                                        </label>
                                    ))}
                                </div>
                            </section>
                        )}

                        <Button className="mt-4 w-full gap-2 py-6 text-base" disabled={busy || (included.length === 0 && !pins.some((pin) => pin.include))} onClick={apply}>
                            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                            Import {included.length > 0 && `${included.length} territor${included.length === 1 ? 'y' : 'ies'}`}
                            {included.length > 0 && pins.some((pin) => pin.include) && ' + '}
                            {pins.some((pin) => pin.include) && `${pins.filter((pin) => pin.include).length} pins`}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
