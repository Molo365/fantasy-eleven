---
name: Zafronix WC API contract
description: How to pull World Cup squad data from the Zafronix API (non-obvious endpoint choice).
---

Base: `https://api.zafronix.com/fifa/worldcup/v1`. Auth: header `X-API-Key`
(server reads `ZAFRONIX_API_KEY` secret). Rate limit ~250/window.

**Use `/teams?tournament=2026`** — returns an array of teams, each with a full
`squad[]` of `{ jersey, name, position, born, ageAtTournament, club:{name,country}, goals, captain }`.
This is the only endpoint that gives current squads (48 teams, ~1254 players for 2026).
Positions are `GK/DF/MF/FW` → map to this app's `GK/DEF/MID/FWD`.

**Do NOT use `/teams` without `?tournament=`** (400) and **do NOT use `/players`** —
the players endpoint returns flat *historical* data defaulting to 1930, not squads.

**No price field** in squad data — any fantasy price must be assigned locally
(this app defaults to 5.0 unless told otherwise).
Player names may carry a `" (captain)"` suffix; strip it.
