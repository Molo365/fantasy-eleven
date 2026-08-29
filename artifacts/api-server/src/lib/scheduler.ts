import { and, eq, isNull } from "drizzle-orm";
import { db, gameweeksTable } from "@workspace/db";
import { logger } from "./logger";
import { processFplGameweekScoring, processGameweekScoring } from "./scoring";

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let isRunning = false;

const scorersByCompetition: Record<string, typeof processFplGameweekScoring> = {
  "premier-league": processFplGameweekScoring,
  "world-cup-2026": processGameweekScoring,
};

async function runScoring(): Promise<void> {
  if (isRunning) {
    logger.info("scheduler: previous scoring run still in progress — skipping this tick");
    return;
  }

  isRunning = true;
  const startedAt = new Date().toISOString();

  try {
    // Query all active competition-scoped gameweeks; the dispatch registry
    // decides which provider-specific scorer owns each competition.
    const activeGws = await db
      .select({
        id: gameweeksTable.id,
        competitionKey: gameweeksTable.competitionKey,
        fplGameweekNumber: gameweeksTable.fplGameweekNumber,
      })
      .from(gameweeksTable)
      .where(and(
        eq(gameweeksTable.status, "active"),
        isNull(gameweeksTable.lockedAt),
      ));

    if (activeGws.length === 0) {
      logger.info({ startedAt }, "scheduler: no active gameweeks found — skipping");
      return;
    }

    logger.info(
      { startedAt, gameweekIds: activeGws.map((g) => g.id) },
      "scheduler: starting competition scoring run",
    );

    for (const gw of activeGws) {
      const scorer = scorersByCompetition[gw.competitionKey];
      if (!scorer) {
        logger.info(
          { startedAt, gameweekId: gw.id, competitionKey: gw.competitionKey },
          "scheduler: no scorer registered for active competition — skipping",
        );
        continue;
      }
      try {
        const result = await scorer(gw.id);
        logger.info(
          {
            startedAt,
            gameweekId: gw.id,
            competitionKey: gw.competitionKey,
            fplGw: gw.fplGameweekNumber,
            ...result,
          },
          "scheduler: competition scoring succeeded",
        );
      } catch (err) {
        logger.error(
          {
            startedAt,
            gameweekId: gw.id,
            competitionKey: gw.competitionKey,
            fplGw: gw.fplGameweekNumber,
            err,
          },
          "scheduler: competition scoring failed for gameweek",
        );
      }
    }
  } catch (err) {
    logger.error({ startedAt, err }, "scheduler: failed to query active gameweeks");
  } finally {
    isRunning = false;
  }
}

export function startScheduler(): void {
  logger.info(
    { intervalMs: INTERVAL_MS, competitions: Object.keys(scorersByCompetition) },
    "scheduler: competition auto-scoring started",
  );
  setInterval(() => {
    runScoring().catch((err) =>
      logger.error({ err }, "scheduler: unexpected error in runScoring"),
    );
  }, INTERVAL_MS);
}
