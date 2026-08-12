---
name: Migration 0001 covers crest_url and fpl_gameweek_number
description: Both columns were added via raw ALTER TABLE outside the migration system; 0001 back-fills them with IF NOT EXISTS and adds four player indexes.
---

## What 0001 contains
`lib/db/drizzle/0001_add_player_indexes.sql`:
1. `ALTER TABLE players ADD COLUMN IF NOT EXISTS crest_url text`
2. `ALTER TABLE gameweeks ADD COLUMN IF NOT EXISTS fpl_gameweek_number integer`
3. Four indexes: `players_total_points_idx`, `players_nationality_idx`, `players_position_idx`, `players_club_idx`

## Applied to
- Dev Neon DB (`$DATABASE_URL`): applied via `psql "$DATABASE_URL" -f ...`
- Railway production (`$RAILWAY_DATABASE_URL_PUBLIC`): applied via `psql "$RAILWAY_DATABASE_URL_PUBLIC" -f ...`

**Why:** Drizzle generates explicit column lists in SELECT (never `SELECT *`). Any column in the schema but missing from the DB causes `ERROR 42703: column does not exist` on every query against that table — breaking all routes that touch players or gameweeks.

**How to apply:** When adding columns outside the migration workflow in future, always create a migration file immediately and apply it to both dev and Railway production. Check `lib/db/drizzle/` for the next sequence number.
