import { pgTable, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { playersTable } from "./players";

export const teamPlayersTable = pgTable("team_players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  slot: integer("slot").notNull(),
  isCaptain: boolean("is_captain").notNull().default(false),
  isViceCaptain: boolean("is_vice_captain").notNull().default(false),
  points: integer("points").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamPlayerSchema = createInsertSchema(teamPlayersTable).omit({ id: true, createdAt: true });
export type InsertTeamPlayer = z.infer<typeof insertTeamPlayerSchema>;
export type TeamPlayer = typeof teamPlayersTable.$inferSelect;
