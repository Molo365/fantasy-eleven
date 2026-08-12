---
name: Team budget cascade gap
description: ON DELETE CASCADE on team_players silently bypasses the API budget recalculation; direct player DELETEs leave team.budget stale.
---

## Rule
Any time players are deleted directly from the `players` table (FPL sync wipe, admin reset, manual SQL), the `team_players` rows cascade-delete automatically at DB level — the remove-player API route never runs, so its `budget = 100 - SUM(remaining)` recalculation never fires. The `teams.budget` column is left at whatever pre-deletion value it had.

**Why:** The remove-player route (`DELETE /teams/:id/players/slot/:slot` in `teams.ts`) recalculates budget correctly from remaining squad cost. The cascade bypasses this entirely.

**How to apply:** After any bulk player DELETE (especially the FPL sync's `DELETE FROM players WHERE nationality = 'premier_league'`), run a recalculation sweep:
```sql
UPDATE teams t
SET budget = 100 - COALESCE((
  SELECT SUM(p.price)
  FROM team_players tp
  JOIN players p ON p.id = tp.player_id
  WHERE tp.team_id = t.id
), 0);
```
This is safe to run any time — it converges to the correct value regardless of current state.
