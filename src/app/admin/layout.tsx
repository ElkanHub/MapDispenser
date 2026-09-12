import { redirect } from 'next/navigation';

import { AdminNav } from '@/components/app-nav';
import { getSession, isAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!isAdminRole(session.role)) redirect('/home');

    return (
        <div className="pb-20">
            {children}
            <AdminNav />
        </div>
    );
}
