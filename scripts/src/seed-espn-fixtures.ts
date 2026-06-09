/**
 * seed-espn-fixtures.ts
 * Fetches real WC 2026 group-stage fixtures from ESPN's public API,
 * maps them to 3 gameweeks (GW1/GW2/GW3) and upserts into the DB.
 *
 * Run: pnpm --filter @workspace/scripts run seed-espn-fixtures
 */

import { db, gameweeksTable, fixturesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=100&dates=20260611-20260719";

type EspnEvent = {
  id: string;
  date: string;
  season: { slug: string };
  competitions: Array<{
    date: string;
    status: {
      type: { name: string; state: string; completed: boolean };
    };
    competitors: Array<{
      homeAway: "home" | "away";
      score?: string;
      team: { displayName: string; shortDisplayName: string };
    }>;
  }>;
};

function espnStatusToLocal(statusName: string): "scheduled" | "live" | "finished" {
  if (statusName === "STATUS_IN_PROGRESS") return "live";
  if (statusName === "STATUS_FULL_TIME" || statusName === "STATUS_FINAL") return "finished";
  return "scheduled";
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ESPN WC 2026 Fixture Seed");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("Fetching ESPN scoreboard…");
  const resp = await fetch(ESPN_URL);
  if (!resp.ok) throw new Error(`ESPN API ${resp.status}: ${resp.statusText}`);
  const json = (await resp.json()) as { events: EspnEvent[] };

  const allEvents = json.events ?? [];
  console.log(`Total ESPN events: ${allEvents.length}`);

  // Only keep group-stage events, sorted by date
  const groupStage = allEvents
    .filter((e) => e.season?.slug === "group-stage")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  console.log(`Group-stage events: ${groupStage.length}`);

  if (groupStage.length < 3) {
    throw new Error("Too few group-stage events — check ESPN API response.");
  }

  // Divide into 3 matchdays of equal size (24 each for 48-team WC)
  const batchSize = Math.ceil(groupStage.length / 3);
  const gw1Events = groupStage.slice(0, batchSize);
  const gw2Events = groupStage.slice(batchSize, batchSize * 2);
  const gw3Events = groupStage.slice(batchSize * 2);

  console.log(`GW1: ${gw1Events.length} matches | GW2: ${gw2Events.length} | GW3: ${gw3Events.length}\n`);

  const gwGroups = [
    { number: 1, name: "Group Stage — Matchday 1", events: gw1Events },
    { number: 2, name: "Group Stage — Matchday 2", events: gw2Events },
    { number: 3, name: "Group Stage — Matchday 3", events: gw3Events },
  ];

  // Clear existing gameweeks (fixtures cascade-delete)
  console.log("Clearing existing gameweeks and fixtures…");
  await db.execute(sql`TRUNCATE TABLE fixtures, gameweeks RESTART IDENTITY CASCADE`);

  for (const gw of gwGroups) {
    const dates = gw.events.map((e) => new Date(e.date));
    const startDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const endDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    // Push endDate to end of that calendar day (UTC)
    endDate.setUTCHours(23, 59, 59, 999);

    const [gameweek] = await db
      .insert(gameweeksTable)
      .values({
        number: gw.number,
        name: gw.name,
        round: "group",
        status: "upcoming",
        startDate,
        endDate,
      })
      .returning();

    const fixtureRows = gw.events.map((e) => {
      const comp = e.competitions[0];
      const home = comp.competitors.find((c) => c.homeAway === "home");
      const away = comp.competitors.find((c) => c.homeAway === "away");
      const status = espnStatusToLocal(comp.status.type.name);

      return {
        gameweekId: gameweek.id,
        homeTeam: home?.team.displayName ?? "TBD",
        awayTeam: away?.team.displayName ?? "TBD",
        homeScore: status !== "scheduled" ? Number(home?.score ?? 0) : null,
        awayScore: status !== "scheduled" ? Number(away?.score ?? 0) : null,
        kickoff: new Date(comp.date),
        status,
      };
    });

    await db.insert(fixturesTable).values(fixtureRows);

    console.log(`  ✔ GW${gw.number} inserted: ${fixtureRows.length} fixtures`);
    console.log(`     ${startDate.toDateString()} → ${endDate.toDateString()}`);
    const sample = fixtureRows[0];
    if (sample) {
      console.log(`     First: ${sample.homeTeam} vs ${sample.awayTeam} @ ${sample.kickoff.toISOString()}`);
    }
    console.log();
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Done. 3 gameweeks + ${groupStage.length} fixtures seeded.`);
  console.log("═══════════════════════════════════════════════════════════");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
