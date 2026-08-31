CREATE TABLE IF NOT EXISTS "gameweek_player_fixture_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "gameweek_id" integer NOT NULL,
  "player_id" integer NOT NULL,
  "fixture_external_id" integer NOT NULL,
  "source" text NOT NULL,
  "points" integer DEFAULT 0 NOT NULL,
  "minutes" integer DEFAULT 0 NOT NULL,
  "goals" integer DEFAULT 0 NOT NULL,
  "assists" integer DEFAULT 0 NOT NULL,
  "clean_sheets" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "gameweek_player_fixture_scores_gameweek_id_gameweeks_id_fk"
    FOREIGN KEY ("gameweek_id")
    REFERENCES "public"."gameweeks"("id")
    ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "gameweek_player_fixture_scores_gameweek_player_fixture_uq"
ON "gameweek_player_fixture_scores" ("gameweek_id", "player_id", "fixture_external_id");