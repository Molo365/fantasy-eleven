-- Migration: add crest_url column (added manually earlier; recorded here for tracking)
--            and four indexes on commonly-queried players columns
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "crest_url" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_total_points_idx" ON "players" ("total_points");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_nationality_idx" ON "players" ("nationality");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_position_idx" ON "players" ("position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_club_idx" ON "players" ("club");
