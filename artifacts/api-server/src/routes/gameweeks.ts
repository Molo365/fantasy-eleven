import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, gameweeksTable, fixturesTable } from "@workspace/db";
import type { Gameweek, Fixture } from "@workspace/db";
import {
  GetGameweekFixturesParams,
  ListGameweeksResponse,
  GetCurrentGameweekResponse,
  GetGameweekFixturesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeGw(gw: Gameweek) {
  return {
    ...gw,
    startDate: gw.startDate instanceof Date ? gw.startDate.toISOString() : gw.startDate,
    endDate: gw.endDate instanceof Date ? gw.endDate.toISOString() : gw.endDate,
    createdAt: gw.createdAt instanceof Date ? gw.createdAt.toISOString() : gw.createdAt,
  };
}

function serializeFixture(f: Fixture) {
  return {
    ...f,
    kickoff: f.kickoff instanceof Date ? f.kickoff.toISOString() : f.kickoff,
    createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
  };
}

router.get("/gameweeks", async (_req, res): Promise<void> => {
  const rows = await db.select().from(gameweeksTable).orderBy(gameweeksTable.number);
  res.json(ListGameweeksResponse.parse(rows.map(serializeGw)));
});

router.get("/gameweeks/current", async (_req, res): Promise<void> => {
  const [active] = await db
    .select()
    .from(gameweeksTable)
    .where(eq(gameweeksTable.status, "active"))
    .limit(1);
  const gw = active ?? (await db.select().from(gameweeksTable).orderBy(gameweeksTable.number).limit(1))[0];
  if (!gw) {
    res.status(404).json({ error: "No gameweek found" });
    return;
  }
  const fixtures = await db.select().from(fixturesTable).where(eq(fixturesTable.gameweekId, gw.id));
  res.json(GetCurrentGameweekResponse.parse({
    ...serializeGw(gw),
    fixtures: fixtures.map(serializeFixture),
  }));
});

router.get("/gameweeks/:id/fixtures", async (req, res): Promise<void> => {
  const params = GetGameweekFixturesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const fixtures = await db
    .select()
    .from(fixturesTable)
    .where(eq(fixturesTable.gameweekId, params.data.id));
  res.json(GetGameweekFixturesResponse.parse(fixtures.map(serializeFixture)));
});

export default router;
