ALTER TABLE "gameweeks"
ADD COLUMN IF NOT EXISTS "competition_key" text;

UPDATE "gameweeks"
SET "competition_key" = CASE
  WHEN "fpl_gameweek_number" IS NOT NULL THEN 'premier-league'
  ELSE 'world-cup-2026'
END
WHERE "competition_key" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "gameweek_team_scores" gts
    INNER JOIN "gameweeks" g ON g."id" = gts."gameweek_id"
    INNER JOIN "teams" t ON t."id" = gts."team_id"
    WHERE t."competition_key" <> g."competition_key"
  ) THEN
    RAISE EXCEPTION
      'Cannot apply gameweek competition migration: score rows cross competition boundaries.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "gameweek_team_lineup_players" glp
    INNER JOIN "gameweeks" g ON g."id" = glp."gameweek_id"
    INNER JOIN "teams" t ON t."id" = glp."team_id"
    WHERE t."competition_key" <> g."competition_key"
  ) THEN
    RAISE EXCEPTION
      'Cannot apply gameweek competition migration: lineup rows cross competition boundaries.';
  END IF;
END
$$;

ALTER TABLE "gameweeks"
ALTER COLUMN "competition_key" SET NOT NULL;

ALTER TABLE "gameweeks"
DROP CONSTRAINT IF EXISTS "gameweeks_number_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "gameweeks_competition_number_uq"
ON "gameweeks" ("competition_key", "number");