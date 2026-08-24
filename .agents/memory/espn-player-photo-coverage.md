---
name: ESPN player-photo coverage
description: Limits of ESPN’s Premier League roster endpoint as a player-image source.
---

ESPN’s `eng.1` team roster endpoint can provide stable athlete IDs and enough name data for many same-club player matches, but use only the explicit `headshot.href` value when it exists. Do not manufacture the otherwise predictable ESPN CDN URL from an athlete ID.

**Why:** In a live Premier League roster comparison, direct full-name matching plus conservative short-name matching could identify 463 of 609 FPL elements, yet only 32 of those matches supplied an ESPN headshot. Direct CDN requests constructed from high-profile athletes’ ESPN IDs returned 404, including the player whose FPL image was unavailable.

**How to apply:** ESPN may be an optional, coverage-limited third fallback only when the sync receives a real headshot URL. It cannot replace FPL images generally or repair missing images for players without an ESPN-provided URL; choose another image source if broad fallback coverage is required.