import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position").notNull(), // GK, DEF, MID, FWD
  club: text("club").notNull(),
  clubShortName: text("club_short_name").notNull(),
  totalPoints: integer("total_points").notNull().default(0),
  price: real("price").notNull(),
  form: real("form").notNull().default(0),
  selected: real("selected").notNull().default(0),
  goalsScored: integer("goals_scored").notNull().default(0),
  assists: integer("assists").notNull().default(0),
  cleanSheets: integer("clean_sheets").notNull().default(0),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
