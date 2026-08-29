---
name: Ad-hoc tsx integration scripts
description: How to avoid module-format failures in temporary TypeScript verification scripts.
---

Temporary TypeScript integration scripts created outside an ESM package should use an async `main()` entry function rather than top-level `await`.

**Why:** `tsx` can compile scripts under `/tmp` as CommonJS even when the workspace packages use ESM, causing top-level-await transforms to fail before the application code runs.

**How to apply:** For one-off database or scoring verification scripts outside a package directory, call the awaited work inside `async function main()` and set `process.exitCode` in a terminal catch handler.