'use client';

import { useEffect, useState } from 'react';
import { Territory } from '@/lib/dispenserState';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Download, ExternalLink, CheckCircle2, Share2, X, ImageOff, ZoomIn } from 'lucide-react';

export default function ViewTerritoryClient({ territory }: { territory: Territory }) {
    const [showLightbox, setShowLightbox] = useState(false);
    const [zoomed, setZoomed] = useState(false);
    const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [toast, setToast] = useState('');
    const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);

    // Prompt to save the map once the image is actually there, and only once per territory per device
    useEffect(() => {
        if (imageState !== 'ready') return;
        const key = `map-download-prompt-${territory.id}`;
        if (localStorage.getItem(key)) return;
        const timer = setTimeout(() => {
            setShowDownloadPrompt(true);
            localStorage.setItem(key, '1');
        }, 1500);
        return () => clearTimeout(timer);
    }, [imageState, territory.id]);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(''), 2500);
        return () => clearTimeout(timer);
    }, [toast]);

    // Lock background scroll and allow Escape to close while the lightbox is open
    useEffect(() => {
        if (!showLightbox) return;
        const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setShowLightbox(false);
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onKey);
        };
    }, [showLightbox]);

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = territory.map_image_url;
        link.download = `${territory.territory_name.replace(/\s+/g, '_')}_map.${territory.map_image_url.split('.').pop() || 'png'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleShare = async () => {
        const url = window.location.href;
        const shareData = { title: `Territory ${territory.territory_name}`, text: territory.map_description, url };

        // Native share sheet on mobile, clipboard everywhere else
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch {
                // user dismissed the sheet — fall through to copying
            }
        }

        try {
            await navigator.clipboard.writeText(url);
            setToast('Link copied to clipboard');
        } catch {
            setToast(url);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
            <div className="mx-auto flex w-full max-w-md flex-col gap-5 py-4">
                <div className="text-center">
                    <div className="mb-2 flex items-center justify-center gap-2 text-emerald-600">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-semibold uppercase tracking-wide">Assigned to you</span>
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{territory.territory_name}</h1>
                    <p className="mt-1 text-sm text-slate-500">Territory #{territory.id}</p>
                </div>

                <Card className="overflow-hidden border-slate-200 shadow-lg">
                    <button
                        type="button"
                        aria-label="Open full map"
                        className="relative block aspect-[4/3] w-full cursor-zoom-in bg-slate-100"
                        onClick={() => imageState === 'ready' && setShowLightbox(true)}
                    >
                        {imageState === 'error' ? (
                            <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                                <ImageOff className="h-8 w-8" />
                                <span className="text-sm">Map image unavailable</span>
                            </span>
                        ) : (
                            <>
                                {/* object-contain: maps must never be cropped */}
                                <img
                                    src={territory.map_image_url}
                                    alt={`Map of ${territory.territory_name}`}
                                    // ref catches images already loaded before hydration, when onLoad never fires
                                    ref={(node) => {
                                        if (node?.complete && node.naturalWidth > 0) setImageState('ready');
                                    }}
                                    onLoad={() => setImageState('ready')}
                                    onError={() => setImageState('error')}
                                    className={`h-full w-full object-contain transition-opacity duration-300 ${imageState === 'ready' ? 'opacity-100' : 'opacity-0'}`}
                                />
                                {imageState === 'loading' && <span className="absolute inset-0 animate-pulse bg-slate-200" />}
                                {imageState === 'ready' && (
                                    <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                                        <ZoomIn className="h-3.5 w-3.5" />Tap to enlarge
                                    </span>
                                )}
                            </>
                        )}
                    </button>

                    <CardContent className="space-y-2 p-5">
                        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                            <MapPin className="h-4 w-4 text-indigo-500" />
                            Description
                        </h2>
                        <p className="text-sm leading-relaxed text-slate-600">{territory.map_description || 'No description provided.'}</p>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3 bg-slate-50 p-5">
                        {territory.map_link && (
                            <Button className="w-full gap-2 py-6 text-base" onClick={() => window.open(territory.map_link, '_blank', 'noopener,noreferrer')}>
                                <ExternalLink className="h-5 w-5" />
                                Open in Google Maps
                            </Button>
                        )}
                        <div className="grid w-full grid-cols-2 gap-3">
                            <Button variant="outline" className="w-full gap-2" onClick={handleShare}>
                                <Share2 className="h-4 w-4" />Share
                            </Button>
                            <Button variant="outline" className="w-full gap-2" onClick={handleDownload} disabled={imageState === 'error'}>
                                <Download className="h-4 w-4" />Save map
                            </Button>
                        </div>
                    </CardFooter>
                </Card>

                <p className="text-center text-xs text-slate-400">Keep this link — it stays valid for your whole assignment.</p>
            </div>

            {showLightbox && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2" onClick={() => setShowLightbox(false)}>
                    <div className="h-full w-full overflow-auto overscroll-contain" onClick={(event) => event.stopPropagation()}>
                        {/* zoom toggle works on touch, where hover does not */}
                        <img
                            src={territory.map_image_url}
                            alt={`Map of ${territory.territory_name}`}
                            onClick={() => setZoomed((prev) => !prev)}
                            className={zoomed
                                ? 'w-[250%] max-w-none cursor-zoom-out'
                                : 'mx-auto h-full w-full cursor-zoom-in object-contain'}
                        />
                    </div>
                    <Button size="icon" className="absolute right-4 top-4 rounded-full border-0 bg-white/15 text-white hover:bg-white/25" onClick={() => setShowLightbox(false)}>
                        <X className="h-5 w-5" /><span className="sr-only">Close</span>
                    </Button>
                    <Button variant="outline" className="absolute bottom-6 left-1/2 -translate-x-1/2 gap-2" onClick={handleDownload}>
                        <Download className="h-4 w-4" />Save map
                    </Button>
                </div>
            )}

            <Dialog open={showDownloadPrompt} onOpenChange={setShowDownloadPrompt}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save your map?</DialogTitle>
                        <DialogDescription>
                            Download the map for {territory.territory_name} so you can open it later without this link or a network connection.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 sm:justify-end">
                        <Button variant="ghost" onClick={() => setShowDownloadPrompt(false)}>Not now</Button>
                        <Button className="gap-2" onClick={() => { handleDownload(); setShowDownloadPrompt(false); }}>
                            <Download className="h-4 w-4" />Download
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {toast && (
                <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>
            )}
        </div>
    );
}
