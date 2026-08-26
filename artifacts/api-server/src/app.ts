import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const PgSession = connectPgSimple(session);

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const app: Express = express();
const configuredCorsOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

// Trust Replit's reverse proxy so secure cookies work over HTTPS in production
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors((req, callback) => {
  const origin = req.header("Origin");
  if (!origin) {
    callback(null, { origin: false, credentials: false });
    return;
  }

  let isSameOrigin = false;
  try {
    const originHost = new URL(origin).host;
    const forwardedHost = req.header("x-forwarded-host")?.split(",")[0]?.trim();
    isSameOrigin = originHost === (forwardedHost || req.header("host"));
  } catch {
    isSameOrigin = false;
  }

  const isAllowed = isSameOrigin || configuredCorsOrigins.has(origin);
  callback(null, {
    origin: isAllowed ? origin : false,
    credentials: isAllowed,
  });
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create session table if missing (inline SQL — avoids esbuild-bundled file path issue)
pgPool.query(`
  CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
  );
  CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
`).catch((err: Error) => logger.error({ err }, "Failed to ensure session table"));

app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: "session",
    }),
    name: "fanta11.sid",
    secret: process.env.SESSION_SECRET ?? "fanta11-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

app.use("/api", router);

// ── Global error handler ──────────────────────────────────────────────────────
// Catches any error passed via next(err) — including those forwarded by
// asyncHandler — and logs the full Postgres error detail so error codes
// (e.g. 42703 "column does not exist", 08006 "connection failure") are always
// visible in production logs rather than being swallowed as generic failures.
app.use((err: Error & { code?: string; detail?: string; cause?: unknown }, req: Request, res: Response, _next: NextFunction): void => {
  const pgCode   = err.code;                         // e.g. "42703", "23505"
  const pgDetail = err.detail;                       // Postgres DETAIL field
  const cause    = err.cause;                        // nested cause if any
  req.log.error({ err, pgCode, pgDetail, cause }, "Unhandled route error");
  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal server error",
      ...(process.env.NODE_ENV !== "production" && { message: err.message, pgCode }),
    });
  }
});

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.join(path.dirname(process.argv[1]), "../../fanta11/dist/public");
console.log("Frontend dist path:", frontendDist);
app.use(express.static(frontendDist));
app.get("*path", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(frontendDist, "index.html"));
});

export default app;
