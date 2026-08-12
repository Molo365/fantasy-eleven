---
name: Railway vs dev DB separation
description: Railway production and Replit dev are entirely separate Postgres instances — team IDs, row counts, and schema state differ; a fix in one never applies to the other automatically.
---

## Rule
When running any psql fix (`UPDATE`, `ALTER TABLE`, `CREATE INDEX`), explicitly identify which database you are targeting:
- `psql "$DATABASE_URL"` → Replit dev Neon DB
- `psql "$RAILWAY_DATABASE_URL_PUBLIC"` → Railway production (public TCP proxy URL required; the internal `postgres.railway.internal` address is unreachable from outside Railway's network)

Verify the fix applied to the intended database by querying after the change.

**Why:** A budget reset ran against `$DATABASE_URL` (dev) and returned the correct value from `localhost:8080`, leading to a false "fixed" conclusion. The Railway production app was still serving the stale value because its own database was never touched. The two databases have different team IDs (dev: 12, 13 — production: 1, 2).

**How to apply:** Before any data fix for a production complaint, run the query against `$RAILWAY_DATABASE_URL_PUBLIC` first, not `$DATABASE_URL`. Confirm both environments if both need updating.
