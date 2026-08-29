import { boolean, pgTable, text, serial, integer, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gameweeksTable = pgTable("gameweeks", {
  id: serial("id").primaryKey(),
  competitionKey: text("competition_key").notNull(),
  number: integer("number").notNull(),
  name: text("name").notNull().default(""),        // e.g. "Group Stage 1", "Round of 16"
  round: text("round").notNull().default("group"), // group | r16 | qf | sf | final
  status: text("status").notNull().default("upcoming"), // upcoming, active, finished
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lineupSnapshottedAt: timestamp("lineup_snapshotted_at", { withTimezone: true }),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  averagePoints: integer("average_points"),
  highestPoints: integer("highest_points"),
  fplGameweekNumber: integer("fpl_gameweek_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("gameweeks_competition_number_uq").on(table.competitionKey, table.number),
]);

export const fixturesTable = pgTable("fixtures", {
  id: serial("id").primaryKey(),
  gameweekId: integer("gameweek_id").notNull().references(() => gameweeksTable.id, { onDelete: "cascade" }),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  kickoff: timestamp("kickoff", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, live, finished
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameweekTeamScoresTable = pgTable("gameweek_team_scores", {
  id: serial("id").primaryKey(),
  gameweekId: integer("gameweek_id").notNull().references(() => gameweeksTable.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull(),
  points: integer("points").notNull().default(0),
}, (t) => [
  unique().on(t.gameweekId, t.teamId),
]);

// Immutable player selections captured on the first scoring pass for a gameweek.
// playerId and teamId intentionally have no foreign keys so historical scoring
// remains readable even if an administrator later removes a player or team.
export const gameweekTeamLineupPlayersTable = pgTable("gameweek_team_lineup_players", {
  id: serial("id").primaryKey(),
  gameweekId: integer("gameweek_id").notNull().references(() => gameweeksTable.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull(),
  playerId: integer("player_id").notNull(),
  slot: integer("slot").notNull(),
  points: integer("points"),
  isCaptain: boolean("is_captain").notNull().default(false),
  isViceCaptain: boolean("is_vice_captain").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.gameweekId, t.teamId, t.slot),
  unique().on(t.gameweekId, t.teamId, t.playerId),
]);

export const insertGameweekSchema = createInsertSchema(gameweeksTable).omit({
  id: true,
  createdAt: true,
  lockedAt: true,
  lineupSnapshottedAt: true,
});
export const insertFixtureSchema = createInsertSchema(fixturesTable).omit({ id: true, createdAt: true });
export type InsertGameweek = z.infer<typeof insertGameweekSchema>;
export type Gameweek = typeof gameweeksTable.$inferSelect;
export type Fixture = typeof fixturesTable.$inferSelect;
export type GameweekTeamLineupPlayer = typeof gameweekTeamLineupPlayersTable.$inferSelect;
