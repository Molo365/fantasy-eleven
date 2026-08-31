---
name: Live scoring snapshots
description: Durable rules for provisional provider scoring, partial payloads, and season-total preservation.
---

Persist provisional provider contributions per gameweek, player, and external fixture. Update only rows present in a live payload; retain omitted rows. A finished fixture may replace its live snapshot only after complete lineup/player-stat coverage is verified.

**Why:** Provider live player statistics can be empty, partial, delayed, or temporarily regress. Recomputing a whole gameweek directly from one poll can erase known points, break double-gameweeks, or misapply captain multipliers.

**How to apply:** Aggregate display scores from persisted fixture snapshots. Keep explicit zero-minute rows so non-participation differs from missing data. Capture each player's pre-gameweek season total once, then replace only that gameweek's provisional component on subsequent polls and finalization.