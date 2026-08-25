---
name: Premier League photo source
description: Findings on using PremierLeague.com portraits with FPL-synced players.
---

Use the official Premier League 500px portrait route only when the player's
existing FPL photo code is known or the identity mapping is unambiguous:
`resources.premierleague.com/premierleague25/photos/players/500x500/{profileId}.png`.
The corresponding 40px route works for thumbnails; 250px returned 403 in
testing. The filename does not use the `p` prefix used by the legacy FPL route.

**Why:** The public `footballapi.pulselive.com` player endpoint is undocumented,
paginated, CORS-scoped to the Premier League website, and reported more entries
than it actually returned in its final pages. It is useful for discovery but not
a dependable full-roster source. In a production comparison, FPL's existing
photo code matched the PL profile/photo ID for 566 of 567 high-confidence
name matches. A João Pedro collision demonstrated that name-only matching can
select the wrong player.

**How to apply:** Prefer the stored/current FPL code as the PL portrait ID when
available, keep a fallback (legacy FPL URL or initials), and never automatically
assign a PL photo from a weak name match. Treat a non-200 image response as an
expected case, particularly for trialists or newly listed players.