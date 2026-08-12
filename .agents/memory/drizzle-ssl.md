---
name: Drizzle pool SSL must match session pool
description: The Drizzle DB pool needs ssl:{rejectUnauthorized:false} in production; the session pool in app.ts already has it — keep them in sync.
---

## Rule
`lib/db/src/index.ts` Pool config must include:
```typescript
ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
```

**Why:** Railway (and most cloud Postgres providers) use self-signed or internally-signed TLS certs. Node's default TLS verification rejects these, so every Drizzle query fails with a connection error in production while local dev works fine. The session pool in `app.ts` already has this guard — the Drizzle pool must match it exactly or production DB queries silently fail while sessions appear to work.

**How to apply:** Any time a new Pool is created for Drizzle in this project, copy the ssl conditional from `app.ts:14`.
