'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Territory } from '@/lib/dispenserState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, ImageIcon, Loader2, Save } from 'lucide-react';

const EMPTY = { id: '', territory_name: '', map_link: '', map_image_url: '', map_description: '', active: true };

function TerritoryForm() {
    const router = useRouter();
    const editId = useSearchParams().get('id');

    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        fetch('/api/territories')
            .then((res) => res.json())
            .then((territories: Territory[]) => {
                if (editId) {
                    const existing = territories.find((territory) => territory.id === Number(editId));
                    if (existing) setForm({ ...existing, id: String(existing.id) });
                } else {
                    const nextId = territories.reduce((max, territory) => Math.max(max, territory.id), 0) + 1;
                    setForm((prev) => ({ ...prev, id: String(nextId) }));
                }
            })
            .catch(() => setError('Could not load existing territories.'))
            .finally(() => setLoaded(true));
    }, [editId]);

    const set = (key: keyof typeof EMPTY, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }));

    const uploadImage = async (file: File | undefined) => {
        if (!file) return;
        setUploading(true);
        setError('');
        try {
            const body = new FormData();
            body.append('file', file);
            body.append('name', form.territory_name || `territory-${form.id}`);
            const res = await fetch('/api/upload-image', { method: 'POST', body });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Image upload failed.');
            set('map_image_url', data.url);
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed.');
        } finally {
            setUploading(false);
        }
    };

    const save = async () => {
        if (!Number(form.id) || !form.territory_name.trim()) {
            setError('Territory number and name are required.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/territories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([{ ...form, id: Number(form.id) }]),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Save failed.');
            router.push('/admin');
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Save failed.');
            setSaving(false);
        }
    };

    const field = 'w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200';

    return (
        <div className="min-h-screen bg-zinc-50 p-4 text-zinc-950 sm:p-6">
            <div className="mx-auto max-w-3xl space-y-6">
                <div className="flex items-center gap-3">
                    <Link href="/admin"><Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{editId ? 'Edit Territory' : 'Add Territory'}</h1>
                        <p className="text-sm text-zinc-500">Fill in the details, attach the map image, and save.</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Territory details</CardTitle>
                        <CardDescription>The number must be unique. Saving an existing number updates that territory.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                            <label className="space-y-1.5">
                                <span className="text-sm font-medium">Number</span>
                                <input className={field} type="number" min={1} value={form.id} onChange={(event) => set('id', event.target.value)} disabled={Boolean(editId)} />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-sm font-medium">Territory name</span>
                                <input className={field} value={form.territory_name} onChange={(event) => set('territory_name', event.target.value)} placeholder="KHT 12" />
                            </label>
                        </div>

                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium">Google Maps link</span>
                            <input className={field} type="url" value={form.map_link} onChange={(event) => set('map_link', event.target.value)} placeholder="https://maps.app.goo.gl/..." />
                        </label>

                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium">Description</span>
                            <textarea className={`${field} min-h-28`} value={form.map_description} onChange={(event) => set('map_description', event.target.value)} placeholder="Boundaries, landmarks, and anything the publisher should know." />
                        </label>

                        <div className="space-y-2">
                            <span className="text-sm font-medium">Map image</span>
                            <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                                <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
                                    {form.map_image_url
                                        ? <img src={form.map_image_url} alt="Map preview" className="h-full w-full object-contain" />
                                        : <ImageIcon className="h-8 w-8 text-zinc-400" />}
                                </div>
                                <div className="space-y-2">
                                    <input className={field} value={form.map_image_url} onChange={(event) => set('map_image_url', event.target.value)} placeholder="/maps/kht12.png" />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(event) => uploadImage(event.target.files?.[0])}
                                        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                                    />
                                    <p className="text-xs text-zinc-500">{uploading ? 'Uploading image…' : 'Upload a file, or paste a path/URL above.'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-md border border-zinc-200 p-4">
                            <div>
                                <p className="font-medium">Active</p>
                                <p className="text-sm text-zinc-500">Inactive territories are never handed out.</p>
                            </div>
                            <Switch checked={form.active} onCheckedChange={(checked) => set('active', checked)} />
                        </div>

                        {error && <p className="text-sm text-red-600">{error}</p>}

                        <div className="flex justify-end gap-2">
                            <Link href="/admin"><Button variant="outline">Cancel</Button></Link>
                            <Button onClick={save} disabled={saving || uploading || !loaded}>
                                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                                {editId ? 'Save changes' : 'Add territory'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function TerritoryFormPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-50 p-6 text-zinc-500">Loading…</div>}>
            <TerritoryForm />
        </Suspense>
    );
}
