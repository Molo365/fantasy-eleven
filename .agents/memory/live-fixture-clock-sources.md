---
name: Live fixture clock sources
description: Why live fixture status is shown without an elapsed match minute.
---

Use FPL's `started`, `finished`, and `finished_provisional` flags for the live state, but do not display an elapsed minute unless a real in-progress payload has been verified.

**Why:** FPL's `minutes` field was observed only as `0` for scheduled and `90` for finished fixtures. ESPN consumers reference `displayClock`, but the unofficial Premier League scoreboard endpoint returned HTTP 403 from this environment and no live payload could be validated.

**How to apply:** Render a clear status-only LIVE indicator. Treat an ESPN clock as an optional future enhancement requiring live-payload verification and a deliberate fallback strategy, not as a dependable primary fixture field.