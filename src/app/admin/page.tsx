'use client';

import { useEffect, useState } from 'react';
import { Territory } from '@/lib/dispenserState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, HomeIcon, ChevronDown, ChevronRight, Info, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from 'next/link';

export default function AdminPage() {
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [previewTerritory, setPreviewTerritory] = useState<Territory | null>(null);
    const [systemUpdate, setSystemUpdate] = useState<{ title: string, message: string } | null>(null);
    const [isUpdateDismissed, setIsUpdateDismissed] = useState(false);

    const fetchSystemUpdate = async () => {
        try {
            const res = await fetch('/api/system-update');
            if (res.ok) {
                const data = await res.json();
                if (!data.no_update) {
                    setSystemUpdate(data);
                }
            }
        } catch (error) {
            console.error('Failed to fetch system update banner', error);
        }
    };

    const toggleGroupExpanded = (prefix: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [prefix]: prev[prefix] === undefined ? false : !prev[prefix]
        }));
    };

    const fetchTerritories = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/territories');
            if (res.ok) {
                setTerritories(await res.json());
            }
        } catch (error) {
            console.error('Failed to fetch territories', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTerritories();
        fetchSystemUpdate();
    }, []);

    const toggleActive = async (id: number) => {
        try {
            // Optimistic update
            setTerritories(prev => prev.map(t =>
                t.id === id ? { ...t, active: !t.active } : t
            ));

            const res = await fetch('/api/territories', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id }),
            });

            if (!res.ok) {
                // Revert on failure
                fetchTerritories();
            }
        } catch (error) {
            fetchTerritories();
        }
    };

    const toggleGroupActive = async (prefix: string, active: boolean) => {
        const groupIds = groupedTerritories[prefix].map(t => t.id);

        try {
            // Optimistic update
            setTerritories(prev => prev.map(t =>
                groupIds.includes(t.id) ? { ...t, active } : t
            ));

            const res = await fetch('/api/territories', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ids: groupIds, active }),
            });

            if (!res.ok) {
                fetchTerritories();
            }
        } catch (error) {
            fetchTerritories();
        }
    };

    const getPrefix = (name: string) => name.replace(/[\d\s]+$/, '');

    const groupedTerritories = territories.reduce((acc, territory) => {
        const prefix = getPrefix(territory.territory_name) || 'Other';
        if (!acc[prefix]) {
            acc[prefix] = [];
        }
        acc[prefix].push(territory);
        return acc;
    }, {} as Record<string, Territory[]>);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 icon-text-gap">Territory Admin</h1>
                        <p className="text-slate-500">Manage availability and view status</p>
                    </div>
                    <div className="flex gap-2">
                        <Link href="https://map-dispenser.vercel.app/"><Button> <HomeIcon />Back</Button></Link>
                        <Button
                            onClick={async () => {
                                if (confirm("Are you sure you want to RESET the entire system? This will clear all assignments.")) {
                                    await fetch('/api/admin/reset', { method: 'POST' });
                                    fetchTerritories();
                                }
                            }}
                            variant="destructive"
                        >
                            Reset System
                        </Button>
                        <Button onClick={() => { fetchTerritories(); fetchSystemUpdate(); }} variant="outline" size="icon">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                {systemUpdate && !isUpdateDismissed && (
                    <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900 shadow-sm relative pr-10">
                        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <AlertTitle className="text-blue-800 dark:text-blue-300 font-semibold">{systemUpdate.title}</AlertTitle>
                        <AlertDescription className="text-blue-700 dark:text-blue-400 mt-1">
                            {systemUpdate.message}
                        </AlertDescription>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900 rounded-full"
                            onClick={() => setIsUpdateDismissed(true)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </Alert>
                )}

                <div className="space-y-8">
                    {Object.entries(groupedTerritories).map(([prefix, groupTerritories]) => {
                        const isAllActive = groupTerritories.every(t => t.active);
                        const isExpanded = expandedGroups[prefix] !== false;

                        return (
                            <div key={prefix} className="space-y-4">
                                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                                    <div
                                        className="flex items-center gap-3 cursor-pointer select-none"
                                        onClick={() => toggleGroupExpanded(prefix)}
                                    >
                                        <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{prefix} Group</h2>
                                            <p className="text-sm text-slate-500">{groupTerritories.length} territories</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
                                        <span className="text-xs font-medium text-slate-500 uppercase">Group Status</span>
                                        <Switch
                                            checked={isAllActive}
                                            onCheckedChange={(checked) => toggleGroupActive(prefix, checked)}
                                        />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="grid gap-4 pl-4 border-l-2 border-slate-200 dark:border-slate-800">
                                        {groupTerritories.map((territory) => (
                                            <Card key={territory.id} className="overflow-hidden">
                                                <div className="flex items-center p-6 gap-4">
                                                    <div
                                                        className="h-16 w-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => setPreviewTerritory(territory)}
                                                    >
                                                        <img
                                                            src={territory.map_image_url}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="font-semibold text-lg truncate">{territory.territory_name}</h3>
                                                            <Badge variant="secondary" className="text-xs">#{territory.id}</Badge>
                                                            <Badge
                                                                variant={territory.isAssigned ? "default" : "outline"}
                                                                className={territory.isAssigned ? "bg-green-600 hover:bg-green-700" : "text-slate-500"}
                                                            >
                                                                {territory.isAssigned ? "Scanned" : "Unscanned"}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-slate-500 truncate">{territory.map_description}</p>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <Button
                                                            variant={copiedId === territory.id ? "secondary" : "ghost"}
                                                            size="sm"
                                                            onClick={async () => {
                                                                const url = `${window.location.origin}/view/${territory.id}`;

                                                                // 1. Copy to clipboard
                                                                navigator.clipboard.writeText(url).then(() => {
                                                                    setCopiedId(territory.id);
                                                                    setTimeout(() => setCopiedId(null), 2000);
                                                                }).catch(() => {
                                                                    alert(`Could not copy to clipboard. URL: ${url}`);
                                                                });

                                                                // 2. Trigger Assignment (Mark as Scanned)
                                                                try {
                                                                    const res = await fetch('/api/admin/assign', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ id: territory.id }),
                                                                    });
                                                                    if (res.ok) {
                                                                        // Refresh list to update badge
                                                                        fetchTerritories();
                                                                    }
                                                                } catch (e) {
                                                                    console.error("Failed to mark as assigned", e);
                                                                }
                                                            }}
                                                            title="Copy Link"
                                                            className="min-w-[70px]"
                                                        >
                                                            {copiedId === territory.id ? "Copied!" : "Share"}
                                                        </Button>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-xs font-medium text-slate-500 uppercase">Status</span>
                                                            <Switch
                                                                checked={territory.active}
                                                                onCheckedChange={() => toggleActive(territory.id)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Preview Modal */}
            {previewTerritory && (
                <div
                    className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-6"
                    onClick={() => setPreviewTerritory(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full p-1 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative bg-slate-100 dark:bg-slate-800 rounded-t-lg overflow-hidden flex-shrink-0 min-h-[40vh]">
                            <img
                                src={previewTerritory.map_image_url}
                                alt={previewTerritory.territory_name}
                                className="w-full h-full object-contain absolute inset-0"
                            />
                            <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-4 right-4 h-8 w-8 rounded-full p-0"
                                onClick={() => setPreviewTerritory(null)}
                            >
                                <span className="sr-only">Close</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </Button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="flex items-center gap-3 mb-3">
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{previewTerritory.territory_name}</h3>
                                <Badge variant="secondary">#{previewTerritory.id}</Badge>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
                                {previewTerritory.map_description}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
