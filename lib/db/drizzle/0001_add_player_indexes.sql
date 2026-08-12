-- Migration 0001: back-fill columns added outside migrations, add player indexes
--
-- crest_url:            added to players manually in dev (not in 0000)
-- fpl_gameweek_number:  added to gameweeks manually in dev (not in 0000)
-- Four indexes on frequently-queried players columns.
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "crest_url" text;
--> statement-breakpoint
ALTER TABLE "gameweeks" ADD COLUMN IF NOT EXISTS "fpl_gameweek_number" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_total_points_idx" ON "players" ("total_points");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_nationality_idx" ON "players" ("nationality");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_position_idx" ON "players" ("position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_club_idx" ON "players" ("club");
