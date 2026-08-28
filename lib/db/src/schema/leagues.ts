import { pgTable, text, serial, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const leaguesTable = pgTable("leagues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  competitionKey: text("competition_key").notNull().default("premier-league"),
  code: text("code").notNull().unique(),
  maxMembers: integer("max_members"),
  entryFee: text("entry_fee").notNull().default("Free"),
  prize1st: text("prize_1st"),
  prize2nd: text("prize_2nd"),
  prize3rd: text("prize_3rd"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leagueTeamsTable = pgTable("league_teams", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leaguesTable.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("league_teams_league_team_uq").on(table.leagueId, table.teamId),
]);

export const insertLeagueSchema = createInsertSchema(leaguesTable).omit({ id: true, createdAt: true });
export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type League = typeof leaguesTable.$inferSelect;
export type LeagueTeam = typeof leagueTeamsTable.$inferSelect;
