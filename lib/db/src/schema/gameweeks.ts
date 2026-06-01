import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gameweeksTable = pgTable("gameweeks", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  status: text("status").notNull().default("upcoming"), // upcoming, active, finished
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  averagePoints: integer("average_points"),
  highestPoints: integer("highest_points"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export const insertGameweekSchema = createInsertSchema(gameweeksTable).omit({ id: true, createdAt: true });
export const insertFixtureSchema = createInsertSchema(fixturesTable).omit({ id: true, createdAt: true });
export type InsertGameweek = z.infer<typeof insertGameweekSchema>;
export type Gameweek = typeof gameweeksTable.$inferSelect;
export type Fixture = typeof fixturesTable.$inferSelect;
