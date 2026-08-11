// Creates the schema in Neon and seeds it from data/territories.json.
// Run: node scripts/init-neon.mjs
import fs from 'fs';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL
    || fs.readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.+)$/m)?.[1].trim();
if (!url) throw new Error('DATABASE_URL not found in env or .env.local');

const sql = neon(url);

await sql`CREATE TABLE IF NOT EXISTS territories (
    id int PRIMARY KEY,
    territory_name text NOT NULL,
    map_link text DEFAULT '',
    map_image_url text DEFAULT '',
    map_description text DEFAULT '',
    active boolean NOT NULL DEFAULT true
)`;
await sql`CREATE TABLE IF NOT EXISTS assignments (
    id bigserial PRIMARY KEY,
    territory_id int NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
    assigned_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE TABLE IF NOT EXISTS system_updates (
    id bigserial PRIMARY KEY,
    title text NOT NULL,
    message text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
)`;

const raw = JSON.parse(fs.readFileSync('data/territories.json', 'utf8'));
const territories = raw.filter((r) => r.territory_name).map((r) => ({
    id: Number(r.id),
    territory_name: String(r.territory_name),
    map_link: String(r.map_link || ''),
    map_image_url: String(r.map_image_url || ''),
    map_description: String(r.map_description || ''),
    active: Boolean(r.active),
}));

await sql`
    INSERT INTO territories (id, territory_name, map_link, map_image_url, map_description, active)
    SELECT * FROM json_to_recordset(${JSON.stringify(territories)}::json)
        AS t(id int, territory_name text, map_link text, map_image_url text, map_description text, active boolean)
    ON CONFLICT (id) DO UPDATE SET
        territory_name = EXCLUDED.territory_name,
        map_link = EXCLUDED.map_link,
        map_image_url = EXCLUDED.map_image_url,
        map_description = EXCLUDED.map_description,
        active = EXCLUDED.active`;

const update = raw.find((r) => r.title && r.message);
if (update) {
    const existing = await sql`SELECT 1 FROM system_updates WHERE title = ${update.title}`;
    if (!existing.length) {
        await sql`INSERT INTO system_updates (title, message) VALUES (${update.title}, ${update.message})`;
    }
}

// ponytail: also the smoke test — if the schema or seed is wrong, these counts throw or read zero
const [{ count: t }] = await sql`SELECT count(*)::int FROM territories`;
const [{ count: a }] = await sql`SELECT count(*)::int FROM assignments`;
console.log(`territories=${t} assignments=${a} system_update=${update ? 'yes' : 'none'}`);
if (t !== territories.length) throw new Error(`expected ${territories.length} territories, got ${t}`);
