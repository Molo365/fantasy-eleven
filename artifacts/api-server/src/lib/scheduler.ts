import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db, gameweeksTable } from "@workspace/db";
import { logger } from "./logger";
import { processFplGameweekScoring } from "./scoring";

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let isRunning = false;

async function runFplScoring(): Promise<void> {
  if (isRunning) {
    logger.info("scheduler: previous FPL scoring run still in progress — skipping this tick");
    return;
  }

  isRunning = true;
  const startedAt = new Date().toISOString();

  try {
    // Only active, unlocked gameweeks receive provisional FPL refreshes.
    const activeGws = await db
      .select({ id: gameweeksTable.id, fplGameweekNumber: gameweeksTable.fplGameweekNumber })
      .from(gameweeksTable)
      .where(and(
        eq(gameweeksTable.status, "active"),
        isNull(gameweeksTable.lockedAt),
        isNotNull(gameweeksTable.fplGameweekNumber),
      ));

    if (activeGws.length === 0) {
      logger.info({ startedAt }, "scheduler: no active FPL gameweeks found — skipping");
      return;
    }

    logger.info(
      { startedAt, gameweekIds: activeGws.map((g) => g.id) },
      "scheduler: starting FPL scoring run",
    );

    for (const gw of activeGws) {
      try {
        const result = await processFplGameweekScoring(gw.id);
        logger.info(
          { startedAt, gameweekId: gw.id, fplGw: gw.fplGameweekNumber, ...result },
          "scheduler: FPL scoring succeeded",
        );
      } catch (err) {
        logger.error(
          { startedAt, gameweekId: gw.id, fplGw: gw.fplGameweekNumber, err },
          "scheduler: FPL scoring failed for gameweek",
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
  logger.info({ intervalMs: INTERVAL_MS }, "scheduler: FPL auto-scoring started");
  setInterval(() => {
    runFplScoring().catch((err) =>
      logger.error({ err }, "scheduler: unexpected error in runFplScoring"),
    );
  }, INTERVAL_MS);
}
