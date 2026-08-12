// Temporary diagnostic — delete after debugging
// Run: node --loader /home/runner/workspace/lib/db/node_modules/tsx/dist/esm/index.cjs artifacts/api-server/test-drizzle-insert.mjs
// OR: node test-drizzle-insert.mjs

import pg from "../../lib/db/node_modules/pg/lib/index.js";
import { drizzle } from "../../lib/db/node_modules/drizzle-orm/node-postgres/index.js";
import { pgTable, text, serial, integer, real, timestamp, boolean } from "../../lib/db/node_modules/drizzle-orm/pg-core/index.js";

const { Pool } = pg;

// Recreate the playersTable schema exactly as in lib/db/src/schema/players.ts
const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  externalId: integer("external_id"),
  name: text("name").notNull(),
  position: text("position").notNull(),
  club: text("club").notNull(),
  clubShortName: text("club_short_name").notNull(),
  nationality: text("nationality"),
  totalPoints: integer("total_points").notNull().default(0),
  price: real("price").notNull(),
  form: real("form").notNull().default(0),
  selected: real("selected").notNull().default(0),
  goalsScored: integer("goals_scored").notNull().default(0),
  assists: integer("assists").notNull().default(0),
  cleanSheets: integer("clean_sheets").notNull().default(0),
  imageUrl: text("image_url"),
  crestUrl: text("crest_url"),
  cachedFromApi: boolean("cached_from_api").notNull().default(false),
  cachedAt: timestamp("cached_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

console.log("Testing Drizzle insert with imageUrl + crestUrl...");
try {
  const result = await db.insert(playersTable).values({
    externalId: 99999,
    name: "Test Player",
    position: "GK",
    club: "Arsenal",
    clubShortName: "ARS",
    nationality: "premier_league",
    price: 5.5,
    totalPoints: 0,
    imageUrl: "https://resources.premierleague.com/premierleague/photos/players/110x140/p154561.png",
    crestUrl: "https://resources.premierleague.com/premierleague/badges/70/t3.png",
    cachedFromApi: true,
    cachedAt: new Date(),
  }).returning({ id: playersTable.id });
  console.log("INSERT succeeded:", result);

  // Clean up
  const { eq } = await import("../../lib/db/node_modules/drizzle-orm/index.js");
  await db.delete(playersTable).where(eq(playersTable.externalId, 99999));
  console.log("Cleanup done.");
} catch (err) {
  console.error("INSERT FAILED:", err);
}

await pool.end();
