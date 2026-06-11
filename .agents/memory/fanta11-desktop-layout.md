---
name: Fanta11 desktop layout sizing
description: Why viewport-width-based element sizing in fanta11 pages must account for the fixed sidebar, or rows clip at md widths.
---

# Fanta11 desktop layout sizing

The desktop shell (`src/components/layout.tsx`) has a **fixed 288px sidebar** (`md:ml-72`) plus `md:p-8` (64px total) main padding. So the actual content width at viewport `vw` (md+) is roughly `vw - 288 - 64`, NOT `vw`.

**Rule:** Any per-page responsive sizing formula based on `window.innerWidth` (e.g. fitting N items across a row) must subtract the sidebar + padding. Otherwise it overshoots.

**Why:** The squad-builder desktop pitch sized circular player photos with `(vw - 56) / 5`, ignoring the sidebar. Slot wrappers have `flexShrink: 0` and the pitch container is `overflow-hidden`, so the widest rows (5 players) clipped on both sides at ~768–890px viewports. The formula always resolved to the 64px cap because it didn't see the missing 352px.

**How to apply:** When computing a size to fit a fixed-count row inside a page, budget width as `vw - 352 - innerPadding - totalGaps`, clamp to a sensible min/max, and prefer tighter gaps at the `sm`/`md` breakpoints with generous gaps only at `lg+`. The desktop pitch uses `Math.min(64, Math.max(44, Math.floor((vw - 540) / 5)))` with `gap-2 sm:gap-3 lg:gap-8`.
