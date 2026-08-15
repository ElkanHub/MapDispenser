'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Territory, type DataBackend, type DashboardStats } from '@/lib/dispenserState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    BarChart3,
    ChevronDown,
    ChevronRight,
    Copy,
    Database,
    HomeIcon,
    Info,
    Loader2,
    MapPinned,
    MessageCircle,
    Pencil,
    Plus,
    RefreshCw,
    Upload,
    X
} from 'lucide-react';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export default function AdminPage() {
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    // null until the server tells us — never assume 'local', that reads as a flip back
    const [backend, setBackend] = useState<DataBackend | null>(null);
    const [backendError, setBackendError] = useState('');
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [previewTerritory, setPreviewTerritory] = useState<Territory | null>(null);
    const [systemUpdate, setSystemUpdate] = useState<{ title: string, message: string } | null>(null);
    const [isUpdateDismissed, setIsUpdateDismissed] = useState(false);
    const [uploadText, setUploadText] = useState('');
    const [uploadState, setUploadState] = useState<UploadState>('idle');
    const [uploadMessage, setUploadMessage] = useState('');

    const fetchSystemUpdate = async () => {
        try {
            const res = await fetch('/api/system-update');
            if (res.ok) {
                const data = await res.json();
                setSystemUpdate(data.no_update ? null : data);
            }
        } catch (error) {
            console.error('Failed to fetch system update banner', error);
        }
    };

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const [territoriesRes, statsRes, databaseRes] = await Promise.all([
                fetch('/api/territories'),
                fetch('/api/stats'),
                fetch('/api/admin/database'),
            ]);

            if (territoriesRes.ok) {
                setTerritories(await territoriesRes.json());
                setBackendError('');
            } else {
                setBackendError('Could not read territories from the active database.');
            }
            if (statsRes.ok) setStats(await statsRes.json());
            if (databaseRes.ok) {
                const data = await databaseRes.json();
                setBackend(data.backend);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
        fetchSystemUpdate();
    }, []);

    const groupedTerritories = useMemo(() => {
        const getPrefix = (name: string) => name.replace(/[\d\s]+$/, '') || 'Other';

        return territories.reduce((acc, territory) => {
            const prefix = getPrefix(territory.territory_name);
            if (!acc[prefix]) acc[prefix] = [];
            acc[prefix].push(territory);
            return acc;
        }, {} as Record<string, Territory[]>);
    }, [territories]);

    const setDatabaseBackend = async (nextBackend: DataBackend) => {
        const previous = backend;
        setBackend(nextBackend);
        const res = await fetch('/api/admin/database', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backend: nextBackend }),
        });

        if (!res.ok) {
            setBackend(previous);
            const data = await res.json().catch(() => ({}));
            setUploadState('error');
            setUploadMessage(data.error || 'Could not switch database backend.');
            return;
        }

        await fetchDashboard();
    };

    const toggleActive = async (id: number) => {
        setTerritories((prev) => prev.map((territory) =>
            territory.id === id ? { ...territory, active: !territory.active } : territory
        ));

        const res = await fetch('/api/territories', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });

        if (!res.ok) fetchDashboard();
        else fetchDashboard();
    };

    const toggleGroupActive = async (prefix: string, active: boolean) => {
        const groupIds = groupedTerritories[prefix].map((territory) => territory.id);
        setTerritories((prev) => prev.map((territory) =>
            groupIds.includes(territory.id) ? { ...territory, active } : territory
        ));

        const res = await fetch('/api/territories', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: groupIds, active }),
        });

        if (!res.ok) fetchDashboard();
        else fetchDashboard();
    };

    const markAssigned = async (id: number) => {
        const res = await fetch('/api/admin/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        if (res.ok) fetchDashboard();
    };

    const markAssignedAndShare = async (territory: Territory) => {
        const url = `${window.location.origin}/view/${territory.id}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopiedId(territory.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            alert(`Could not copy to clipboard. URL: ${url}`);
        }
        await markAssigned(territory.id);
    };

    const shareToWhatsApp = (territory: Territory) => {
        const url = `${window.location.origin}/view/${territory.id}`;
        const text = encodeURIComponent(`${territory.territory_name}\n${url}`);
        // No number: WhatsApp opens with the message prefilled, sender picks the contact
        window.open(`https://wa.me/?text=${text}`, '_blank');
        markAssigned(territory.id);
    };

    const handleUploadFile = async (file: File | undefined) => {
        if (!file) return;
        setUploadText(await file.text());
    };

    const uploadTerritories = async () => {
        setUploadState('uploading');
        setUploadMessage('');

        try {
            const parsed = JSON.parse(uploadText);
            const res = await fetch('/api/territories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Upload failed.');
            }

            setUploadState('success');
            setUploadMessage(`Uploaded ${data.count} territories into ${backend}.`);
            setUploadText('');
            await fetchDashboard();
        } catch (error) {
            setUploadState('error');
            setUploadMessage(error instanceof Error ? error.message : 'Invalid JSON upload.');
        }
    };

    const statCards = [
        { label: 'Total', value: stats?.total ?? 0, tone: 'text-slate-900' },
        { label: 'Available', value: stats?.remaining ?? 0, tone: 'text-emerald-700' },
        { label: 'Assigned', value: stats?.assigned ?? 0, tone: 'text-blue-700' },
        { label: 'Assignment Events', value: stats?.totalAssignments ?? 0, tone: 'text-violet-700' },
    ];

    return (
        <div className="min-h-screen bg-zinc-50 text-zinc-950 p-4 sm:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                            <BarChart3 className="h-4 w-4" />
                            Live territory operations
                        </div>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight">Territory Dashboard</h1>
                        <p className="mt-1 text-sm text-zinc-500">Track assignment history, manage availability, and upload territory records.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/"><Button variant="outline"><HomeIcon />Home</Button></Link>
                        <Link href="/admin/territory"><Button><Plus />Add Territory</Button></Link>
                        <Button
                            onClick={async () => {
                                if (confirm('Reset all assignment history for the active database?')) {
                                    await fetch('/api/admin/reset', { method: 'POST' });
                                    fetchDashboard();
                                }
                            }}
                            variant="destructive"
                        >
                            Reset Assignments
                        </Button>
                        <Button onClick={() => { fetchDashboard(); fetchSystemUpdate(); }} variant="outline" size="icon">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </header>

                {systemUpdate && !isUpdateDismissed && (
                    <Alert className="relative border-blue-200 bg-blue-50 pr-10">
                        <Info className="h-5 w-5 text-blue-600" />
                        <AlertTitle className="text-blue-900">{systemUpdate.title}</AlertTitle>
                        <AlertDescription className="text-blue-800">{systemUpdate.message}</AlertDescription>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2 h-8 w-8 text-blue-700"
                            onClick={() => setIsUpdateDismissed(true)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </Alert>
                )}

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {statCards.map((card) => (
                        <Card key={card.label}>
                            <CardContent className="p-5">
                                <p className="text-sm font-medium text-zinc-500">{card.label}</p>
                                <p className={`mt-2 text-3xl font-bold ${card.tone}`}>{card.value}</p>
                            </CardContent>
                        </Card>
                    ))}
                </section>

                <section className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Database Source</CardTitle>
                            <CardDescription>Switch between the local JSON store and the Neon Postgres database.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between rounded-md border border-zinc-200 p-4">
                                <div>
                                    <p className="font-medium">Neon database</p>
                                    <p className="text-sm text-zinc-500">Current: {backend ?? 'checking…'}</p>
                                    {backendError && <p className="text-sm text-red-600">{backendError}</p>}
                                </div>
                                <Switch
                                    checked={backend === 'neon'}
                                    disabled={backend === null}
                                    onCheckedChange={(checked) => setDatabaseBackend(checked ? 'neon' : 'local')}
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-md border border-zinc-200 p-4">
                                    <p className="text-sm text-zinc-500">Most assigned</p>
                                    <p className="mt-1 font-semibold">{stats?.mostAssigned?.territory_name || 'None yet'}</p>
                                    <p className="text-sm text-zinc-500">{stats?.mostAssigned?.assignmentCount || 0} assignments</p>
                                </div>
                                <div className="rounded-md border border-zinc-200 p-4">
                                    <p className="text-sm text-zinc-500">Inactive</p>
                                    <p className="mt-1 text-2xl font-bold">{stats?.inactive || 0}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Bulk Upload</CardTitle>
                            <CardDescription>Bulk import. For one territory at a time use Add Territory. JSON array with id, territory_name, map_link, map_image_url, map_description, and active.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <input
                                type="file"
                                accept="application/json,.json"
                                onChange={(event) => handleUploadFile(event.target.files?.[0])}
                                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                            />
                            <textarea
                                value={uploadText}
                                onChange={(event) => setUploadText(event.target.value)}
                                placeholder='[{"id":1,"territory_name":"KHT 1","map_link":"https://...","map_image_url":"/maps/kht1.png","map_description":"...","active":true}]'
                                className="min-h-28 w-full rounded-md border border-zinc-200 bg-white p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-zinc-300"
                            />
                            <div className="flex items-center justify-between gap-3">
                                <p className={`text-sm ${uploadState === 'error' ? 'text-red-600' : 'text-zinc-500'}`}>{uploadMessage || `Target database: ${backend ?? '…'}`}</p>
                                <Button onClick={uploadTerritories} disabled={!uploadText || uploadState === 'uploading'}>
                                    {uploadState === 'uploading' ? <Loader2 className="animate-spin" /> : <Upload />}
                                    Upload
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Territories</h2>
                        <Badge variant="outline">{territories.length} records</Badge>
                    </div>

                    {Object.entries(groupedTerritories).map(([prefix, groupTerritories]) => {
                        const isAllActive = groupTerritories.every((territory) => territory.active);
                        const isExpanded = expandedGroups[prefix] !== false;

                        return (
                            <div key={prefix} className="space-y-3">
                                <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-white p-4">
                                    <button
                                        className="flex min-w-0 items-center gap-3 text-left"
                                        onClick={() => setExpandedGroups((prev) => ({ ...prev, [prefix]: prev[prefix] === undefined ? false : !prev[prefix] }))}
                                    >
                                        {isExpanded ? <ChevronDown className="h-5 w-5 text-zinc-500" /> : <ChevronRight className="h-5 w-5 text-zinc-500" />}
                                        <span>
                                            <span className="block font-semibold">{prefix} Group</span>
                                            <span className="block text-sm text-zinc-500">{groupTerritories.length} territories</span>
                                        </span>
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-medium uppercase text-zinc-500">Group active</span>
                                        <Switch checked={isAllActive} onCheckedChange={(checked) => toggleGroupActive(prefix, checked)} />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {groupTerritories.map((territory) => (
                                            <Card key={territory.id}>
                                                <CardContent className="flex gap-4 p-4">
                                                    <button
                                                        className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100"
                                                        onClick={() => setPreviewTerritory(territory)}
                                                    >
                                                        <img src={territory.map_image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
                                                    </button>

                                                    <div className="min-w-0 flex-1 space-y-3">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <h3 className="truncate font-semibold">{territory.territory_name}</h3>
                                                                <Badge variant="secondary">#{territory.id}</Badge>
                                                                <Badge variant={territory.status === 'assigned' ? 'default' : territory.status === 'inactive' ? 'destructive' : 'outline'}>
                                                                    {territory.status}
                                                                </Badge>
                                                            </div>
                                                            <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{territory.map_description}</p>
                                                        </div>

                                                        <div className="grid gap-2 text-sm sm:grid-cols-3">
                                                            <span><strong>{territory.assignmentCount || 0}</strong> assignments</span>
                                                            <span className="truncate sm:col-span-2">{territory.lastAssignedAt ? new Date(territory.lastAssignedAt).toLocaleString() : 'Never assigned'}</span>
                                                        </div>

                                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                                            <div className="flex gap-2">
                                                                <Button variant="outline" size="sm" onClick={() => markAssignedAndShare(territory)}>
                                                                    <Copy />
                                                                    {copiedId === territory.id ? 'Copied' : 'Share'}
                                                                </Button>
                                                                <Button variant="outline" size="sm" className="text-emerald-700" onClick={() => shareToWhatsApp(territory)}>
                                                                    <MessageCircle />
                                                                    WhatsApp
                                                                </Button>
                                                                <Button variant="ghost" size="sm" onClick={() => setPreviewTerritory(territory)}>
                                                                    <MapPinned />
                                                                    Preview
                                                                </Button>
                                                                <Link href={`/admin/territory?id=${territory.id}`}>
                                                                    <Button variant="ghost" size="sm"><Pencil />Edit</Button>
                                                                </Link>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-medium uppercase text-zinc-500">Active</span>
                                                                <Switch checked={territory.active} onCheckedChange={() => toggleActive(territory.id)} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </section>
            </div>

            {previewTerritory && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    onClick={() => setPreviewTerritory(null)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="relative h-[48vh] bg-zinc-100">
                            <img src={previewTerritory.map_image_url} alt={previewTerritory.territory_name} className="h-full w-full object-contain" />
                            <Button className="absolute right-4 top-4" variant="destructive" size="icon" onClick={() => setPreviewTerritory(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="space-y-3 p-5">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-2xl font-bold">{previewTerritory.territory_name}</h3>
                                <Badge variant="secondary">#{previewTerritory.id}</Badge>
                                <Badge variant="outline">{previewTerritory.assignmentCount || 0} assignments</Badge>
                            </div>
                            <p className="text-zinc-600">{previewTerritory.map_description}</p>
                            <a href={previewTerritory.map_link} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm font-medium text-blue-700 hover:underline">
                                View on Google Maps
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
