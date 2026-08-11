import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ponytail: writes into public/maps — fine for a self-hosted/local admin.
// Move to object storage (S3/Vercel Blob) if this ever runs on a read-only serverless FS.
export async function POST(request: Request) {
    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File) || !file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Upload a single image file.' }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image must be under 8MB.' }, { status: 400 });
    }

    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const slug = String(form.get('name') || 'map').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'map';
    const fileName = `${slug}.${ext}`;
    const dir = path.join(process.cwd(), 'public', 'maps');

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ url: `/maps/${fileName}` });
}
