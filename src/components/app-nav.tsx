'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Map, LayoutDashboard, MapPinned, Users, Upload, Wrench, LogOut } from 'lucide-react';

// One shared lookup per page load: every nav/screen asking for the role reuses it.
let rolePromise: Promise<string | null> | null = null;

export function useRole(): string | null | undefined {
    const [role, setRole] = useState<string | null | undefined>(undefined);
    useEffect(() => {
        rolePromise = rolePromise || fetch('/api/app/me')
            .then((res) => (res.ok ? res.json() : null))
            .then((body) => (body ? String(body.user.role) : null))
            .catch(() => null);
        rolePromise.then(setRole);
    }, []);
    return role;
}

// Bottom navigation for whoever is signed in — nothing for anonymous link holders.
export function RoleNav() {
    const role = useRole();
    if (!role) return null;
    return role === 'publisher' ? <PublisherNav /> : <AdminNav />;
}

function NavTab({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Home; active: boolean }) {
    return (
        <Link
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-semibold ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
            <Icon className="h-5 w-5" />
            {label}
        </Link>
    );
}

function NavBar({ tabs }: { tabs: { href: string; label: string; icon: typeof Home; exact?: boolean }[] }) {
    const pathname = usePathname();
    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-md items-stretch gap-1 px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1">
                {tabs.map((tab) => (
                    <NavTab
                        key={tab.href}
                        {...tab}
                        active={tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)}
                    />
                ))}
            </div>
        </nav>
    );
}

export function PublisherNav() {
    return <NavBar tabs={[
        { href: '/home', label: 'Home', icon: Home },
        { href: '/map', label: 'Map', icon: Map },
    ]} />;
}

export function AdminNav() {
    return <NavBar tabs={[
        { href: '/admin', label: 'Desk', icon: LayoutDashboard, exact: true },
        { href: '/admin/territories', label: 'Territories', icon: MapPinned },
        { href: '/admin/people', label: 'People', icon: Users },
        { href: '/admin/import', label: 'Import', icon: Upload },
        { href: '/admin/tools', label: 'Tools', icon: Wrench },
    ]} />;
}

export function SignOutButton({ className = '' }: { className?: string }) {
    const router = useRouter();
    return (
        <button
            type="button"
            onClick={async () => {
                await fetch('/api/app/auth/logout', { method: 'POST' });
                router.replace('/login');
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 ${className}`}
        >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
        </button>
    );
}
