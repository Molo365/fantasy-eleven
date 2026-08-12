---
name: asyncHandler pattern for Express 4 routes
description: Express 4 does not catch async route errors automatically; wrap handlers with asyncHandler so Postgres errors reach the global error middleware and appear in logs.
---

## Rule
All async route handlers must be wrapped with `asyncHandler` from `artifacts/api-server/src/lib/asyncHandler.ts`:
```typescript
router.get("/foo", asyncHandler(async (req, res) => {
  const rows = await db.select()...  // throws → next(err) → error middleware → pino log
}));
```

**Why:** In Express 4, an unhandled rejection inside `async (req, res) => {}` becomes a silent process-level unhandled rejection. The global error middleware (`app.ts`) never sees it. Postgres errors (e.g. `42703 column does not exist`, `23505 unique violation`) vanish from logs, making production debugging impossible.

**How to apply:**
- Applied to: `players.ts`, `teams.ts`, `dashboard.ts`
- Routes with their own try/catch (e.g. `players/sync`) do NOT need it — they handle errors explicitly
- Global error middleware in `app.ts` logs `pgCode`, `pgDetail`, and `cause` for any error that reaches it
- `process.on('unhandledRejection', ...)` in `index.ts` is a safety net for anything that escapes Express
