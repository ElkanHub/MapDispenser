# Territory Dispenser

A Next.js app for distributing map territories by QR code, tracking assignment history, and managing territory availability from an admin dashboard.

## What The App Does

- `/` shows the public QR dispenser and live assignment totals.
- `/claim` assigns the next active, unassigned territory and redirects to its map page.
- `/view/[id]` shows the assigned territory, map image, download action, sharing, and Google Maps link.
- `/admin` is the operations dashboard for status, assignment counts, backend switching, territory uploads, group activation, resets, previews, and share links.

## Data Model

Territory records use this shape:

```json
{
  "id": 1,
  "territory_name": "KHT 1",
  "map_link": "https://maps.app.goo.gl/example",
  "map_image_url": "/maps/kht1.png",
  "map_description": "Description of the territory.",
  "active": true
}
```

Assignment history is stored separately so the app can report:

- whether a territory is `available`, `assigned`, or `inactive`
- how many times each territory has been assigned
- when it was last assigned
- total assignment events across all territories

## Local Database Mode

Local mode is the default.

- Territory definitions live in `data/territories.json`.
- Assignment history lives in `data/assignment-state.json`.
- Admin uploads replace the territory list in `data/territories.json`.
- Reset Assignments clears `data/assignment-state.json`.

This mode works without external services, but file writes are best for local/small deployments. Serverless hosts may not preserve local file changes between deployments.

## Supabase Mode

Supabase mode uses the Supabase REST API directly from server routes. No client-side Supabase key is required for normal app usage.

1. Create a Supabase project.
2. Run `docs/supabase-schema.sql` in the Supabase SQL editor.
3. Add these environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
TERRITORY_DATA_BACKEND=supabase
```

`TERRITORY_DATA_BACKEND` is optional. If omitted, the app starts in local mode and the admin dashboard can switch to Supabase at runtime.

The admin dashboard upload tool can seed Supabase with the same JSON format used by `data/territories.json`.

## API Routes

- `GET /api/stats` returns dashboard totals and backend status.
- `GET /api/territories` returns decorated territories with assignment status and counts.
- `PATCH /api/territories` toggles one territory or a group of territories.
- `POST /api/territories` uploads territories into the active backend.
- `GET /api/assign` assigns the next available territory.
- `POST /api/admin/assign` records an assignment for a specific territory.
- `POST /api/admin/reset` clears assignment history in the active backend.
- `GET /api/admin/database` returns the active backend.
- `POST /api/admin/database` switches between `local` and `supabase`.
- `GET /api/system-update` returns the active update banner.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Run checks before committing:

```bash
npm run lint
npm run build
```
