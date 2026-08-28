ALTER TABLE "teams"
ADD COLUMN IF NOT EXISTS "competition_key" text;

UPDATE "teams"
SET "competition_key" = 'premier-league'
WHERE "competition_key" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "teams"
    WHERE "user_id" IS NOT NULL
    GROUP BY "user_id", "competition_key"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot apply competition team migration: a user has multiple teams for the same competition.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "league_teams" lt
    LEFT JOIN "teams" t ON t."id" = lt."team_id"
    WHERE t."id" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot apply competition team migration: league_teams contains orphan team references.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "league_teams"
    GROUP BY "league_id", "team_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot apply competition team migration: duplicate league memberships exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "league_teams" lt
    INNER JOIN "teams" t ON t."id" = lt."team_id"
    INNER JOIN "leagues" l ON l."id" = lt."league_id"
    WHERE t."competition_key" <> l."competition_key"
  ) THEN
    RAISE EXCEPTION
      'Cannot apply competition team migration: a team is linked to a league from another competition.';
  END IF;
END
$$;

ALTER TABLE "teams"
ALTER COLUMN "competition_key" SET DEFAULT 'premier-league';

ALTER TABLE "teams"
ALTER COLUMN "competition_key" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "teams_user_competition_uq"
ON "teams" ("user_id", "competition_key");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'league_teams_team_id_teams_id_fk'
  ) THEN
    ALTER TABLE "league_teams"
    ADD CONSTRAINT "league_teams_team_id_teams_id_fk"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "league_teams_league_team_uq"
ON "league_teams" ("league_id", "team_id");