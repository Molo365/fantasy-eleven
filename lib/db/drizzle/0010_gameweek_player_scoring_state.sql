CREATE TABLE IF NOT EXISTS "gameweek_player_scoring_state" (
  "id" serial PRIMARY KEY NOT NULL,
  "gameweek_id" integer NOT NULL,
  "player_id" integer NOT NULL,
  "baseline_total_points" integer DEFAULT 0 NOT NULL,
  "current_points" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "gameweek_player_scoring_state_gameweek_id_gameweeks_id_fk"
    FOREIGN KEY ("gameweek_id")
    REFERENCES "public"."gameweeks"("id")
    ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "gameweek_player_scoring_state_gameweek_player_uq"
ON "gameweek_player_scoring_state" ("gameweek_id", "player_id");