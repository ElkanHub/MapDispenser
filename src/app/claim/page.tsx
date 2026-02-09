'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ClaimPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isExhausted, setIsExhausted] = useState(false);

    useEffect(() => {
        const claimTerritory = async () => {
            try {
                const response = await fetch('/api/assign');

                if (response.ok) {
                    const data = await response.json();
                    router.replace(`/view/${data.territory.id}`);
                } else {
                    const data = await response.json();
                    if (data.exhausted) {
                        setIsExhausted(true);
                    } else {
                        setError(data.error || 'Failed to assign territory');
                    }
                }
            } catch (err) {
                setError('Network error occurred');
            }
        };

        claimTerritory();
    }, [router]);

    if (isExhausted) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-red-200 shadow-xl">
                    <CardHeader className="bg-red-50 text-center pb-6">
                        <div className="mx-auto bg-red-100 p-3 rounded-full w-fit mb-4">
                            <AlertCircle className="h-8 w-8 text-red-600" />
                        </div>
                        <CardTitle className="text-2xl text-red-700">All Territories Assigned</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center p-6 space-y-4">
                        <p className="text-slate-600">
                            There are no more territories available at this time.
                            Please contact the event organizer.
                        </p>
                        <Button onClick={() => router.push('/')} variant="outline" className="w-full">
                            Back to Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-red-200">
                    <CardContent className="flex flex-col items-center p-8 text-center">
                        <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
                        <h2 className="text-lg font-bold text-slate-800 mb-2">Error</h2>
                        <p className="text-slate-600 mb-6">{error}</p>
                        <Button onClick={() => window.location.reload()}>Try Again</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
            <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-slate-700">Assigning your territory...</h2>
            <p className="text-slate-500 mt-2">Please wait a moment</p>
        </div>
    );
}
