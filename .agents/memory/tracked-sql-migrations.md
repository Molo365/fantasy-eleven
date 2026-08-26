---
name: Tracked SQL migrations
description: How to safely apply new SQL migrations without losing the app-owned migration ledger.
---

Every new numbered SQL migration must also be registered with the app's explicit migration runner. Do not force a Drizzle schema push when it proposes deleting the app-owned migration tracking table.

**Why:** Drizzle does not own that tracking table and may classify it as removable schema drift. Forcing the push would destroy migration history, while an unregistered SQL file would never reach production.

**How to apply:** Keep migrations idempotent where practical, add them to the tracked runner in order, and execute that runner before deploying API code that reads the new schema.