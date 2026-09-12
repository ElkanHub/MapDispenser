import { redirect } from 'next/navigation';

import { getSession, isAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    redirect(isAdminRole(session.role) ? '/admin' : '/home');
}
