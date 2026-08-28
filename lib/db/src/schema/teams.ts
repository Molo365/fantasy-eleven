import { pgTable, text, serial, integer, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  competitionKey: text("competition_key").notNull().default("premier-league"),
  name: text("name").notNull(),
  managerName: text("manager_name").notNull(),
  totalPoints: integer("total_points").notNull().default(0),
  gameweekPoints: integer("gameweek_points").notNull().default(0),
  budget: real("budget").notNull().default(100),
  captainId: integer("captain_id"),
  viceCaptainId: integer("vice_captain_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("teams_user_competition_uq").on(table.userId, table.competitionKey),
]);

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
