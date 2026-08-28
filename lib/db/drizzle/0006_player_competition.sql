-- Give every player a real competition discriminator. Existing Premier League
-- rows used nationality='premier_league' as a tag; all other legacy rows were
-- created by the World Cup seed/sync paths.
ALTER TABLE "players"
ADD COLUMN IF NOT EXISTS "competition_key" text;

UPDATE "players"
SET "competition_key" = 'premier-league'
WHERE "competition_key" IS NULL
  AND "nationality" = 'premier_league';

UPDATE "players"
SET "competition_key" = 'world-cup-2026'
WHERE "competition_key" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "players"
    WHERE "external_id" IS NOT NULL
    GROUP BY "competition_key", "external_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot apply player competition migration: duplicate external_id values exist within a competition. Resolve duplicates before retrying.';
  END IF;
END
$$;

UPDATE "players"
SET "nationality" = NULL
WHERE "nationality" = 'premier_league';

ALTER TABLE "players"
ALTER COLUMN "competition_key" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "players_competition_key_idx"
ON "players" ("competition_key");

CREATE UNIQUE INDEX IF NOT EXISTS "players_competition_external_id_uq"
ON "players" ("competition_key", "external_id");