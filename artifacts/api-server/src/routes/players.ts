import { Router, type IRouter } from "express";
import { ilike, eq, desc, and } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import {
  ListPlayersQueryParams,
  GetPlayerParams,
  GetTopPlayersQueryParams,
  ListPlayersResponse,
  GetPlayerResponse,
  GetTopPlayersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/players/top", async (req, res): Promise<void> => {
  const parsed = GetTopPlayersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { position, limit = 10 } = parsed.data;
  let query = db.select().from(playersTable).orderBy(desc(playersTable.totalPoints));
  const conditions = position ? [eq(playersTable.position, position)] : [];
  const rows = await db
    .select()
    .from(playersTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(playersTable.totalPoints))
    .limit(limit);
  res.json(GetTopPlayersResponse.parse(rows));
});

router.get("/players", async (req, res): Promise<void> => {
  const parsed = ListPlayersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { position, club, search, limit = 50, offset = 0 } = parsed.data;
  const conditions = [];
  if (position) conditions.push(eq(playersTable.position, position));
  if (club) conditions.push(eq(playersTable.club, club));
  if (search) conditions.push(ilike(playersTable.name, `%${search}%`));

  const rows = await db
    .select()
    .from(playersTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(playersTable.totalPoints))
    .limit(limit)
    .offset(offset);
  res.json(ListPlayersResponse.parse(rows));
});

router.get("/players/:id", async (req, res): Promise<void> => {
  const params = GetPlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, params.data.id));
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(GetPlayerResponse.parse(player));
});

export default router;
