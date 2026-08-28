---
name: API-Football Serie A roster source
description: External feed behavior that determines how Serie A player syncs must merge API-Football endpoints safely.
---

Treat `/players/squads?team=...` as the authoritative current roster for Serie A. Use paginated `/players?league=135&season=...` only to enrich those squad records with nationality and fuller names; it returns fewer players than the combined squads, and nationality may be absent.

**Why:** A live 2026 comparison found squad players missing from the league-player feed, while the squad endpoint itself does not include nationality. Birth country is not a safe substitute for nationality.

**How to apply:** Build the roster from all league teams and their squads, validate completeness before writes, then left-join league-player enrichment by API player ID. Keep unmatched nationality as `null`.