'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MapPin, Users, CheckCircle, AlertCircle } from 'lucide-react';

interface Stats {
  total: number;
  assigned: number;
  remaining: number;
  isExhausted: boolean;
}

export default function DispenserPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [origin, setOrigin] = useState('');

  // Get current origin for QR code link
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Poll for stats every 2 seconds
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const claimUrl = origin ? `${origin}/claim` : '';

  if (!stats) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  const percentAssigned = stats.total > 0 ? (stats.assigned / stats.total) * 100 : 0;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center md:flex-row md:gap-12 gap-8">

      {/* QR Code Section */}
      <div className="flex flex-col items-center gap-6">
        <Card className="w-full max-w-sm border-2 shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-900 text-white text-center pb-8 pt-8">
            <CardTitle className="text-2xl font-bold tracking-tight">Scan to Claim Territory</CardTitle>
            <CardDescription className="text-slate-300">Point your camera at the QR code below</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-8 bg-white">
            {stats.isExhausted ? (
              <div className="h-64 w-64 flex flex-col items-center justify-center text-center p-4 bg-red-50 rounded-xl border-2 border-red-100">
                <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-red-700">All Assigned</h3>
                <p className="text-sm text-red-600 mt-2">No more territories available.</p>
              </div>
            ) : (
              origin && (
                <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                  <QRCodeSVG
                    value={claimUrl}
                    size={256}
                    level="H"
                    includeMargin={true}
                    className="h-64 w-64"
                  />
                </div>
              )
            )}

            {!stats.isExhausted && (
              <div className="mt-6 text-center animate-bounce">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Ready to Scan</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats Section */}
      <div className="w-full max-w-sm flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Distribution Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-slate-500">Progress</span>
                <span className="text-indigo-600">{Math.round(percentAssigned)}%</span>
              </div>
              <Progress value={percentAssigned} className="h-3" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col items-center">
                <span className="text-3xl font-bold text-slate-900">{stats.assigned}</span>
                <span className="text-xs font-semibold text-slate-500 uppercase mt-1">Assigned</span>
              </div>
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex flex-col items-center">
                <span className="text-3xl font-bold text-indigo-600">{stats.remaining}</span>
                <span className="text-xs font-semibold text-indigo-500 uppercase mt-1">Remaining</span>
              </div>
            </div>

            <div className="flex items-center justify-center pt-2">
              {stats.isExhausted ? (
                <Badge variant="destructive" className="px-4 py-1 text-base">Distribution Complete</Badge>
              ) : (
                <Badge variant="outline" className="px-4 py-1 text-base border-green-200 bg-green-50 text-green-700">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </span>
                    Live
                  </span>
                </Badge>
              )}
            </div>

          </CardContent>
        </Card>

        <div className="text-center text-xs text-slate-400 mt-8">
          <p>Sequential QR Territory Server v1.0</p>
          <p className="mt-1">Use admin panel to reset.</p>
        </div>
      </div>
    </main>
  );
}
