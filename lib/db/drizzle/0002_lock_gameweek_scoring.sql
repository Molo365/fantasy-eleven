-- Migration 0002: immutable per-gameweek lineups and score locking
--
-- Existing score rows are intentionally preserved. Their current squad is used
-- only as a non-reconstructive lineage snapshot before GW1 is locked.
BEGIN;
--> statement-breakpoint
ALTER TABLE "gameweeks" ADD COLUMN IF NOT EXISTS "locked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "gameweeks" ADD COLUMN IF NOT EXISTS "lineup_snapshotted_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gameweek_team_lineup_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"gameweek_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"slot" integer NOT NULL,
	"is_captain" boolean DEFAULT false NOT NULL,
	"is_vice_captain" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gameweek_team_lineup_players_gameweek_id_team_id_slot_unique" UNIQUE("gameweek_id","team_id","slot"),
	CONSTRAINT "gameweek_team_lineup_players_gameweek_id_team_id_player_id_unique" UNIQUE("gameweek_id","team_id","player_id")
);
--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM "team_players"
		GROUP BY "team_id", "slot"
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot lock gameweek scoring: duplicate squad slots exist. Resolve duplicate team_players rows before retrying.';
	END IF;
	IF EXISTS (
		SELECT 1
		FROM "team_players"
		GROUP BY "team_id", "player_id"
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot lock gameweek scoring: duplicate squad players exist. Resolve duplicate team_players rows before retrying.';
	END IF;
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'gameweek_team_lineup_players_gameweek_id_gameweeks_id_fk'
	) THEN
		ALTER TABLE "gameweek_team_lineup_players"
			ADD CONSTRAINT "gameweek_team_lineup_players_gameweek_id_gameweeks_id_fk"
			FOREIGN KEY ("gameweek_id") REFERENCES "public"."gameweeks"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'team_players_team_id_slot_unique'
	) THEN
		ALTER TABLE "team_players"
			ADD CONSTRAINT "team_players_team_id_slot_unique"
			UNIQUE ("team_id", "slot");
	END IF;
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'team_players_team_id_player_id_unique'
	) THEN
		ALTER TABLE "team_players"
			ADD CONSTRAINT "team_players_team_id_player_id_unique"
			UNIQUE ("team_id", "player_id");
	END IF;
END $$;
--> statement-breakpoint
INSERT INTO "gameweek_team_lineup_players" (
	"gameweek_id",
	"team_id",
	"player_id",
	"slot",
	"is_captain",
	"is_vice_captain"
)
SELECT
	"scores"."gameweek_id",
	"squad"."team_id",
	"squad"."player_id",
	"squad"."slot",
	COALESCE("squad"."player_id" = "teams"."captain_id", false),
	COALESCE("squad"."player_id" = "teams"."vice_captain_id", false)
FROM "gameweek_team_scores" AS "scores"
INNER JOIN "team_players" AS "squad" ON "squad"."team_id" = "scores"."team_id"
INNER JOIN "teams" ON "teams"."id" = "scores"."team_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "gameweeks"
SET "lineup_snapshotted_at" = COALESCE("lineup_snapshotted_at", NOW())
WHERE EXISTS (
	SELECT 1
	FROM "gameweek_team_scores"
	WHERE "gameweek_team_scores"."gameweek_id" = "gameweeks"."id"
);
--> statement-breakpoint
UPDATE "gameweeks"
SET
	"status" = 'finished',
	"locked_at" = COALESCE("locked_at", NOW())
WHERE "number" = 1;
--> statement-breakpoint
UPDATE "teams" AS "team"
SET "total_points" = COALESCE((
	SELECT SUM("scores"."points")
	FROM "gameweek_team_scores" AS "scores"
	INNER JOIN "gameweeks" AS "gameweek"
		ON "gameweek"."id" = "scores"."gameweek_id"
	WHERE "scores"."team_id" = "team"."id"
		AND "gameweek"."locked_at" IS NOT NULL
), 0);
--> statement-breakpoint
COMMIT;