'use client';

import { useEffect, useState } from 'react';
import { Territory } from '@/lib/dispenserState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from 'lucide-react';

export default function AdminPage() {
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 icon-text-gap">Territory Admin</h1>
                        <p className="text-slate-500">Manage availability and view status</p>
                    </div>
                    <div className="flex gap-2">
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
                        <Button onClick={fetchTerritories} variant="outline" size="icon">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4">
                    {territories.map((territory) => (
                        <Card key={territory.id} className="overflow-hidden">
                            <div className="flex items-center p-6 gap-4">
                                <div className="h-16 w-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200">
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
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            const url = `${window.location.origin}/view/${territory.id}`;
                                            navigator.clipboard.writeText(url);
                                            // Optional: Add toast notification here
                                        }}
                                        title="Copy Link"
                                    >
                                        Share
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
            </div>
        </div>
    );
}
