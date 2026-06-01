import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, gameweeksTable, fixturesTable } from "@workspace/db";
import {
  GetGameweekFixturesParams,
  ListGameweeksResponse,
  GetCurrentGameweekResponse,
  GetGameweekFixturesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/gameweeks", async (_req, res): Promise<void> => {
  const rows = await db.select().from(gameweeksTable).orderBy(gameweeksTable.number);
  res.json(ListGameweeksResponse.parse(rows));
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
  res.json(GetCurrentGameweekResponse.parse({ ...gw, fixtures }));
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
  res.json(GetGameweekFixturesResponse.parse(fixtures));
});

export default router;
