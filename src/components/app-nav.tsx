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

interface Tab {
    href: string;
    label: string;
    icon: typeof Home;
    exact?: boolean;
    also?: string[]; // extra paths that light this tab up
}

function NavTab({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Home; active: boolean }) {
    // M3 bottom bar: the active destination is a tonal pill behind the icon,
    // with the label always visible underneath.
    return (
        <Link
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium ${active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
            <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors duration-300 ${active ? 'bg-tonal text-on-tonal' : ''}`}>
                <Icon className="h-5 w-5" />
            </span>
            {label}
        </Link>
    );
}

function NavBar({ tabs }: { tabs: Tab[] }) {
    const pathname = usePathname();
    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 bg-slate-100/95 backdrop-blur">
            <div className="mx-auto flex max-w-md items-stretch gap-0.5 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
                {tabs.map((tab) => (
                    <NavTab
                        key={tab.href}
                        href={tab.href}
                        label={tab.label}
                        icon={tab.icon}
                        active={(tab.exact ? pathname === tab.href : pathname.startsWith(tab.href))
                            || Boolean(tab.also?.some((path) => pathname.startsWith(path)))}
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
    // team members work territories too: "Mine" is their own assignment + live map
    return <NavBar tabs={[
        { href: '/admin', label: 'Desk', icon: LayoutDashboard, exact: true },
        { href: '/admin/territories', label: 'Territories', icon: MapPinned },
        { href: '/admin/people', label: 'People', icon: Users },
        { href: '/admin/import', label: 'Import', icon: Upload },
        { href: '/home', label: 'Mine', icon: Map, also: ['/map'] },
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
