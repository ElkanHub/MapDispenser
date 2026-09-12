// Neon schema for the account/assignment layer, applied lazily so the app
// works against a fresh database without a separate migration step.

type NeonClient = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;

let ensured = false;

export async function ensureNeonAppSchema(sql: NeonClient) {
    if (ensured) return;

    await sql`ALTER TABLE territories ADD COLUMN IF NOT EXISTS geometry jsonb`;
    await sql`ALTER TABLE territories ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT ''`;

    await sql`CREATE TABLE IF NOT EXISTS app_settings (
        id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        congregation_name text NOT NULL DEFAULT '',
        join_code text NOT NULL DEFAULT '',
        team_code text NOT NULL DEFAULT ''
    )`;

    await sql`CREATE TABLE IF NOT EXISTS app_users (
        id bigserial PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        role text NOT NULL DEFAULT 'publisher',
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS requested_at timestamptz`;

    await sql`CREATE TABLE IF NOT EXISTS checkouts (
        id bigserial PRIMARY KEY,
        territory_id int NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
        user_id bigint REFERENCES app_users(id) ON DELETE SET NULL,
        holder_name text NOT NULL DEFAULT '',
        token text NOT NULL UNIQUE,
        status text NOT NULL DEFAULT 'active',
        assigned_by text NOT NULL DEFAULT '',
        assigned_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz
    )`;
    await sql`CREATE INDEX IF NOT EXISTS checkouts_territory_idx ON checkouts(territory_id)`;
    await sql`CREATE INDEX IF NOT EXISTS checkouts_user_idx ON checkouts(user_id)`;

    await sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
        id bigserial PRIMARY KEY,
        user_id bigint NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        endpoint text NOT NULL UNIQUE,
        p256dh text NOT NULL,
        auth text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS landmarks (
        id bigserial PRIMARY KEY,
        name text NOT NULL,
        description text NOT NULL DEFAULT '',
        color text NOT NULL DEFAULT '',
        lng double precision NOT NULL,
        lat double precision NOT NULL
    )`;

    ensured = true;
}
