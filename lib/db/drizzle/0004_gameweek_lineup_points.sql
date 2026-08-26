-- Historical lineup points remain nullable so gameweeks locked before this
-- migration can still be displayed without inventing a per-player breakdown.
ALTER TABLE "gameweek_team_lineup_players"
ADD COLUMN IF NOT EXISTS "points" integer;