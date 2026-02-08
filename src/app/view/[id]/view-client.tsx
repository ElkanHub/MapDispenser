'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Territory } from '@/lib/dispenserState';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Download, ExternalLink, CheckCircle2 } from 'lucide-react';

export default function ViewTerritoryClient({ territory }: { territory: Territory }) {
    const [showDownloadDialog, setShowDownloadDialog] = useState(false);

    // Auto-trigger download modal after a short delay
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowDownloadDialog(true);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = territory.map_image_url;
        link.download = `${territory.territory_name.replace(/\s+/g, '_')}_map.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowDownloadDialog(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center">

            <div className="w-full max-w-md text-center mb-6 animate-in slide-in-from-top-4 duration-700">
                <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                    <CheckCircle2 className="h-6 w-6" />
                    <span className="font-bold text-lg">Assigned Successfully</span>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Your Territory</h1>
            </div>

            <Card className="w-full max-w-md shadow-2xl overflow-hidden border-2 border-slate-100">
                <div className="relative aspect-video w-full bg-slate-100">
                    {/* In a real app, use next/image with proper setup. For now, img is safer for local files without config. */}
                    <img
                        src={territory.map_image_url}
                        alt={`Map of ${territory.territory_name}`}
                        className="object-cover w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                        <div className="text-white">
                            <h2 className="text-2xl font-bold">{territory.territory_name}</h2>
                            <p className="text-slate-200">Territory #{territory.id}</p>
                        </div>
                    </div>
                </div>

                <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-indigo-500" />
                            Description
                        </h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            {territory.map_description}
                        </p>
                    </div>
                </CardContent>

                <CardFooter className="p-6 bg-slate-50 flex flex-col gap-3">
                    <Button
                        className="w-full gap-2 text-lg py-6"
                        onClick={() => window.open(territory.map_link, '_blank')}
                    >
                        <ExternalLink className="h-5 w-5" />
                        Open in Google Maps
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={handleDownload}
                    >
                        <Download className="h-4 w-4" />
                        Download Map Image
                    </Button>
                </CardFooter>
            </Card>

            {/* Download Alert Dialog */}
            <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save your map?</DialogTitle>
                        <DialogDescription>
                            Would you like to download the map image for {territory.territory_name} to your device?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 sm:justify-end">
                        <Button variant="ghost" onClick={() => setShowDownloadDialog(false)}>Cancel</Button>
                        <Button onClick={handleDownload} className="gap-2">
                            <Download className="h-4 w-4" />
                            Download
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
