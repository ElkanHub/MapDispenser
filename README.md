# MapDispenser

A Next.js app for a congregation's territory work: import territory polygons from a Google Earth KMZ, see them on a live map, assign territories to people (or hand out magic links), and track who holds what.

## How it fits together

- **One congregation per deployment.** The first account created becomes the **territory servant** and sets the congregation name plus two codes.
- **Join code** — anyone signing up enters it to join as a **publisher** (pending until approved).
- **Territory-team code** — entered under "Part of the territory team?" during signup; grants the admin screens immediately.
- **Assignments** are checkouts: one active holder per territory, one territory per person. Every checkout gets a **magic link** (`/t/<token>`) that works without an account and stops working when the territory is cleared.

## Screens

| Route | Who | What |
| --- | --- | --- |
| `/login`, `/signup` | everyone | Email + password; signup binds via the codes. First-ever signup runs congregation setup. |
| `/home` | publisher | Current assignment, description, offline map image, live-map + navigate buttons. |
| `/map` | publisher | Full-screen live map: pulsing boundary, live GPS dot, inside/outside banner, Google Maps navigation handoff. |
| `/t/<token>` (+ `/map`) | link holders | Same territory view + live map, no account needed. |
| `/admin` | team/servant | Desk: status tiles, whole-congregation map colored by status, recent activity. |
| `/admin/territories` | team/servant | Assign (person or magic link), copy/WhatsApp the link, clear. |
| `/admin/people` | team/servant | Codes (share/rotate), approve signups, roles, password resets, remove. |
| `/admin/import` | team/servant | Upload the Google Earth KMZ/KML → preview matched placemarks → import. |
| `/admin/tools` | team/servant | The legacy dashboard: activate/deactivate, JSON upload, backend switch, card editing. |
| `/dispenser` + `/claim` | public | QR self-serve: scanning checks out the next free territory as a magic link. |

## KMZ import rules

Placemarks match territories **by name** (case-insensitive) — name your Google Earth polygons exactly like the territory names (`KHT 1`, …). Matched placemarks update the boundary and color in place; unmatched ones create new territories; re-importing never touches assignment history. **Point placemarks import as landmarks** — pins with always-on labels drawn on every map to help people orient (re-importing moves pins by name, never duplicates). Lines are skipped.

Every interactive map also has a basemap toggle: normal street map (OpenStreetMap) or satellite imagery with place labels (Esri). The choice is remembered per device.

## Data model

`territories` keep the original card fields (`map_link`, `map_image_url`, `map_description`) — the image doubles as the offline copy — plus `geometry` (GeoJSON, from the KMZ) and `color`. The account layer adds `app_settings` (congregation + codes), `app_users`, and `checkouts` (holder, token, status, timestamps). The legacy anonymous `assignments` table still records every checkout so historical counters keep working.

## Backends

- **Local (default):** everything in `data/*.json`. `data/app-state.json` (accounts) and `data/auth-secret` are per-deployment and git-ignored. Fine for a single self-hosted box; not for serverless.
- **Neon Postgres:** set `DATABASE_URL` (and switch in `/admin/tools`, or set `TERRITORY_DATA_BACKEND=neon`). The account/geometry schema is created automatically on first use; `node scripts/init-neon.mjs` seeds the base territory tables from `data/territories.json`.

Environment variables:

```bash
DATABASE_URL=postgres://...        # Neon mode
TERRITORY_DATA_BACKEND=neon        # optional; local is the default
AUTH_SECRET=some-long-random-text  # required on hosts with a read-only filesystem
```

## First-run checklist

1. Deploy, open `/signup` — create your account (this makes you territory servant) and set the two codes.
2. `/admin/import` — upload your KMZ.
3. `/admin/people` — share the join code on WhatsApp; approve people as they sign up.
4. `/admin/territories` — assign, share links, clear when returned.

## Development

```bash
npm install
npm run dev
```

Run checks before committing:

```bash
npm run lint
npm run build
```
