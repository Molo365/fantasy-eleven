-- Preserve existing leagues as Premier League leagues while enabling
-- competition-specific league creation going forward.
ALTER TABLE "leagues"
ADD COLUMN IF NOT EXISTS "competition_key" text NOT NULL DEFAULT 'premier-league';
