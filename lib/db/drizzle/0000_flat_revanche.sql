CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" integer,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"club" text NOT NULL,
	"club_short_name" text NOT NULL,
	"nationality" text,
	"total_points" integer DEFAULT 0 NOT NULL,
	"price" real NOT NULL,
	"form" real DEFAULT 0 NOT NULL,
	"selected" real DEFAULT 0 NOT NULL,
	"goals_scored" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"clean_sheets" integer DEFAULT 0 NOT NULL,
	"image_url" text,
	"cached_from_api" boolean DEFAULT false NOT NULL,
	"cached_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"manager_name" text NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"gameweek_points" integer DEFAULT 0 NOT NULL,
	"budget" real DEFAULT 100 NOT NULL,
	"captain_id" integer,
	"vice_captain_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"slot" integer NOT NULL,
	"is_captain" boolean DEFAULT false NOT NULL,
	"is_vice_captain" boolean DEFAULT false NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"league_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"code" text NOT NULL,
	"max_members" integer,
	"entry_fee" text DEFAULT 'Free' NOT NULL,
	"prize_1st" text,
	"prize_2nd" text,
	"prize_3rd" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leagues_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fixtures" (
	"id" serial PRIMARY KEY NOT NULL,
	"gameweek_id" integer NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"kickoff" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gameweek_team_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"gameweek_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "gameweek_team_scores_gameweek_id_team_id_unique" UNIQUE("gameweek_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "gameweeks" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"round" text DEFAULT 'group' NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"average_points" integer,
	"highest_points" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gameweeks_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer,
	"player_id" integer,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"player_name" text NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "team_players" ADD CONSTRAINT "team_players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_players" ADD CONSTRAINT "team_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_teams" ADD CONSTRAINT "league_teams_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_gameweek_id_gameweeks_id_fk" FOREIGN KEY ("gameweek_id") REFERENCES "public"."gameweeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gameweek_team_scores" ADD CONSTRAINT "gameweek_team_scores_gameweek_id_gameweeks_id_fk" FOREIGN KEY ("gameweek_id") REFERENCES "public"."gameweeks"("id") ON DELETE cascade ON UPDATE no action;