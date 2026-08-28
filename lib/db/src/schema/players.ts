import { pgTable, text, serial, integer, real, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id:            serial("id").primaryKey(),
  externalId:    integer("external_id"),
  competitionKey: text("competition_key").notNull(),
  name:          text("name").notNull(),
  position:      text("position").notNull(), // GK, DEF, MID, FWD
  club:          text("club").notNull(),
  clubShortName: text("club_short_name").notNull(),
  nationality:   text("nationality"),
  totalPoints:   integer("total_points").notNull().default(0),
  price:         real("price").notNull(),
  form:          real("form").notNull().default(0),
  selected:      real("selected").notNull().default(0),
  goalsScored:   integer("goals_scored").notNull().default(0),
  assists:       integer("assists").notNull().default(0),
  cleanSheets:   integer("clean_sheets").notNull().default(0),
  imageUrl:      text("image_url"),
  crestUrl:      text("crest_url"),
  cachedFromApi: boolean("cached_from_api").notNull().default(false),
  active:        boolean("active").notNull().default(true),
  cachedAt:      timestamp("cached_at", { withTimezone: true }),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Indexes for the most common query patterns:
  //   ORDER BY total_points DESC  — every /players and /dashboard/top-performers call
  //   WHERE competition_key = ?   — competition-scoped player pools and syncs
  //   WHERE position = ?          — player list filters (GK/DEF/MID/FWD)
  //   WHERE club = ?              — club filter, SELECT DISTINCT club
  index("players_total_points_idx").on(table.totalPoints),
  index("players_competition_key_idx").on(table.competitionKey),
  uniqueIndex("players_competition_external_id_uq").on(table.competitionKey, table.externalId),
  index("players_nationality_idx").on(table.nationality),
  index("players_position_idx").on(table.position),
  index("players_club_idx").on(table.club),
]);

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
