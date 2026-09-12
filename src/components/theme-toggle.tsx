'use client';

import { useEffect, useState } from 'react';
import { Moon, MoonStar, Sun } from 'lucide-react';

type ThemePref = 'system' | 'light' | 'dark';
const THEME_KEY = 'md-theme';
const ORDER: ThemePref[] = ['system', 'light', 'dark'];

export function applyTheme(pref: ThemePref) {
    const root = document.documentElement;
    if (pref === 'system') delete root.dataset.theme;
    else root.dataset.theme = pref;

    // keep the Android status bar in step when overriding the device setting
    let meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null;
    if (pref === 'system') {
        meta?.remove();
    } else {
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }
        meta.content = pref === 'dark' ? '#131314' : '#FDFCFF';
    }
}

// Cycles system → light → dark. The chip mirrors SignOutButton so the two sit
// together naturally in headers.
export default function ThemeToggle() {
    const [pref, setPref] = useState<ThemePref | null>(null);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(THEME_KEY) as ThemePref | null;
            // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the saved preference on mount
            setPref(saved === 'light' || saved === 'dark' ? saved : 'system');
        } catch {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- private mode fallback
            setPref('system');
        }
    }, []);

    if (pref === null) return null;

    const cycle = () => {
        const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
        setPref(next);
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
    };

    const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : MoonStar;
    const label = pref === 'system' ? 'Theme: automatic' : pref === 'light' ? 'Theme: light' : 'Theme: dark';

    return (
        <button
            type="button"
            onClick={cycle}
            aria-label={`${label} — tap to change`}
            title={label}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-800"
        >
            <Icon className="h-3.5 w-3.5" />
            {pref !== 'system' && <span className="sr-only">{label}</span>}
        </button>
    );
}
