import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const migrations = [
  { name: "0002_lock_gameweek_scoring" },
  { name: "0003_player_active" },
  { name: "0004_gameweek_lineup_points" },
  { name: "0005_league_competition" },
  { name: "0006_player_competition" },
  // Keep the competition-team migration development-only until the user
  // explicitly approves applying the verified migration to production.
  { name: "0007_competition_teams", developmentOnly: true },
  // Keep gameweek competition scoping gated until its production preflight and
  // deployment have been explicitly approved.
  { name: "0008_gameweek_competition", developmentOnly: true },
  { name: "0009_gameweek_player_fixture_scores" },
  { name: "0010_gameweek_player_scoring_state" },
].map(({ name, developmentOnly = false }) => ({
  name,
  developmentOnly,
  path: fileURLToPath(new URL(`../../lib/db/drizzle/${name}.sql`, import.meta.url)),
}));
const allowCompetitionTeamsMigrationInProduction =
  process.env.ALLOW_PRODUCTION_COMPETITION_TEAMS_MIGRATION === "true";
const allowGameweekCompetitionMigrationInProduction =
  process.env.ALLOW_PRODUCTION_GAMEWEEK_COMPETITION_MIGRATION === "true";
const productionMigrationAllowed = (name: string): boolean =>
  (name === "0007_competition_teams" && allowCompetitionTeamsMigrationInProduction) ||
  (name === "0008_gameweek_competition" && allowGameweekCompetitionMigrationInProduction);
const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "application_migrations" (
      "name" text PRIMARY KEY NOT NULL,
      "applied_at" timestamp with time zone NOT NULL DEFAULT now()
    )
  `);
  await client.query("SELECT pg_advisory_lock($1)", [760_110_002]);

  for (const migration of migrations) {
    if (
      migration.developmentOnly &&
      process.env.NODE_ENV === "production" &&
      !productionMigrationAllowed(migration.name)
    ) {
      console.info(`Skipping development-only database migration ${migration.name} in production.`);
      continue;
    }
    const applied = await client.query<{ name: string }>(
      'SELECT "name" FROM "application_migrations" WHERE "name" = $1',
      [migration.name],
    );
    if (applied.rowCount !== 0) {
      console.info(`Database migration ${migration.name} is already applied.`);
      continue;
    }

    if (migration.name === "0002_lock_gameweek_scoring") {
      const duplicateSlots = await client.query(`
        SELECT 1 FROM "team_players"
        GROUP BY "team_id", "slot"
        HAVING COUNT(*) > 1
        LIMIT 1
      `);
      const duplicatePlayers = await client.query(`
        SELECT 1 FROM "team_players"
        GROUP BY "team_id", "player_id"
        HAVING COUNT(*) > 1
        LIMIT 1
      `);
      if (duplicateSlots.rowCount || duplicatePlayers.rowCount) {
        throw new Error(
          "Cannot apply locked scoring migration: duplicate squad slots or players exist. Resolve the duplicate team_players rows before retrying.",
        );
      }
    }

    const migrationSql = await readFile(migration.path, "utf8");
    await client.query("BEGIN");
    try {
      await client.query(migrationSql);
      await client.query(
        'INSERT INTO "application_migrations" ("name") VALUES ($1)',
        [migration.name],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    console.info(`Applied database migration ${migration.name}.`);
  }
} finally {
  await client.query("SELECT pg_advisory_unlock($1)", [760_110_002]).catch(() => undefined);
  client.release();
  await pool.end();
}