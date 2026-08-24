import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const migrationName = "0002_lock_gameweek_scoring";
const migrationPath = fileURLToPath(
  new URL("../../lib/db/drizzle/0002_lock_gameweek_scoring.sql", import.meta.url),
);
const migrationSql = await readFile(migrationPath, "utf8");
const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "application_migrations" (
      "name" text PRIMARY KEY NOT NULL,
      "applied_at" timestamp with time zone NOT NULL DEFAULT now()
    )
  `);
  await client.query("SELECT pg_advisory_lock($1)", [760_110_002]);

  const applied = await client.query<{ name: string }>(
    'SELECT "name" FROM "application_migrations" WHERE "name" = $1',
    [migrationName],
  );

  if (applied.rowCount === 0) {
    const duplicateSlots = await client.query(`
      SELECT 1
      FROM "team_players"
      GROUP BY "team_id", "slot"
      HAVING COUNT(*) > 1
      LIMIT 1
    `);
    const duplicatePlayers = await client.query(`
      SELECT 1
      FROM "team_players"
      GROUP BY "team_id", "player_id"
      HAVING COUNT(*) > 1
      LIMIT 1
    `);
    if (duplicateSlots.rowCount || duplicatePlayers.rowCount) {
      throw new Error(
        "Cannot apply locked scoring migration: duplicate squad slots or players exist. Resolve the duplicate team_players rows before retrying.",
      );
    }

    await client.query(migrationSql);
    await client.query(
      'INSERT INTO "application_migrations" ("name") VALUES ($1)',
      [migrationName],
    );
    console.info(`Applied database migration ${migrationName}.`);
  } else {
    console.info(`Database migration ${migrationName} is already applied.`);
  }
} finally {
  await client.query("SELECT pg_advisory_unlock($1)", [760_110_002]).catch(() => undefined);
  client.release();
  await pool.end();
}