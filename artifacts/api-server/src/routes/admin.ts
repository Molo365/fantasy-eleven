import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, count, sql } from "drizzle-orm";
import {
  db, usersTable, playersTable, gameweeksTable, fixturesTable,
  teamsTable, teamPlayersTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

const ADMIN_EMAIL = "domenicg@gmx.com";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [[{ userCount }], [{ teamCount }], [{ processedCount }]] = await Promise.all([
    db.select({ userCount: count() }).from(usersTable),
    db.select({ teamCount: count() }).from(teamsTable),
    db.select({ processedCount: count() }).from(gameweeksTable).where(eq(gameweeksTable.status, "finished")),
  ]);
  res.json({ userCount, teamCount, processedCount });
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      displayName: usersTable.displayName,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.id);

  // Count squads per user via teams
  const teamCounts = await db
    .select({ userId: sql<number>`${teamsTable.id}`, count: count() })
    .from(teamsTable)
    .groupBy(teamsTable.id);

  const tcMap = new Map(teamCounts.map(t => [t.userId, t.count]));

  const result = users.map(u => ({
    ...u,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    squadCount: tcMap.get(u.id) ?? 0,
  }));
  res.json(result);
});

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  req.log.info({ userId: id }, "Admin deleted user");
  res.json({ ok: true });
});

// ── Players ───────────────────────────────────────────────────────────────────

router.get("/admin/players", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(playersTable).orderBy(playersTable.id);
  res.json(rows.map(p => ({
    ...p,
    cachedAt: p.cachedAt instanceof Date ? p.cachedAt.toISOString() : p.cachedAt,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  })));
});

router.patch("/admin/players/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, club, clubShortName, position, price } = req.body as Record<string, string | number>;
  const updates: Record<string, string | number> = {};
  if (name) updates.name = name as string;
  if (club) updates.club = club as string;
  if (clubShortName) updates.clubShortName = clubShortName as string;
  if (position) updates.position = position as string;
  if (price !== undefined) updates.price = Number(price);
  const [updated] = await db.update(playersTable).set(updates).where(eq(playersTable.id, id)).returning();
  req.log.info({ playerId: id }, "Admin updated player");
  res.json(updated);
});

router.delete("/admin/players/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(teamPlayersTable).where(eq(teamPlayersTable.playerId, id));
  await db.delete(playersTable).where(eq(playersTable.id, id));
  req.log.info({ playerId: id }, "Admin deleted player");
  res.json({ ok: true });
});

// ── Gameweeks ─────────────────────────────────────────────────────────────────

router.get("/admin/gameweeks", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(gameweeksTable).orderBy(gameweeksTable.number);
  res.json(rows.map(g => ({
    ...g,
    startDate: g.startDate instanceof Date ? g.startDate.toISOString() : g.startDate,
    endDate: g.endDate instanceof Date ? g.endDate.toISOString() : g.endDate,
    createdAt: g.createdAt instanceof Date ? g.createdAt.toISOString() : g.createdAt,
  })));
});

router.post("/admin/gameweeks/:id/activate", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  // Deactivate all, then activate the target
  await db.update(gameweeksTable)
    .set({ status: "upcoming" })
    .where(eq(gameweeksTable.status, "active"));
  const [updated] = await db.update(gameweeksTable)
    .set({ status: "active" })
    .where(eq(gameweeksTable.id, id))
    .returning();
  req.log.info({ gameweekId: id }, "Admin activated gameweek");
  res.json(updated);
});

router.post("/admin/gameweeks/:id/process", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [updated] = await db.update(gameweeksTable)
    .set({ status: "finished" })
    .where(eq(gameweeksTable.id, id))
    .returning();
  req.log.info({ gameweekId: id }, "Admin processed gameweek");
  res.json(updated);
});

// ── Danger Zone ───────────────────────────────────────────────────────────────

router.post("/admin/wipe-test-data", requireAdmin, async (req, res): Promise<void> => {
  // Remove all team_players and reset team budgets; keep users + core data
  await db.delete(teamPlayersTable);
  await db.execute(sql`UPDATE teams SET budget = 100, captain_id = NULL, vice_captain_id = NULL, total_points = 0`);
  req.log.warn("Admin wiped test data");
  res.json({ ok: true });
});

router.post("/admin/reset", requireAdmin, async (req, res): Promise<void> => {
  // Full reset: wipe everything except the admin user themselves
  const adminUserId = req.session.userId!;
  await db.execute(sql`DELETE FROM activity`);
  await db.execute(sql`DELETE FROM team_players`);
  await db.execute(sql`DELETE FROM league_teams`);
  await db.execute(sql`DELETE FROM teams`);
  await db.execute(sql`DELETE FROM fixtures`);
  await db.execute(sql`DELETE FROM gameweeks`);
  await db.execute(sql`DELETE FROM players`);
  await db.execute(sql`DELETE FROM leagues`);
  await db.execute(sql`DELETE FROM users WHERE id != ${adminUserId}`);
  req.log.warn({ adminUserId }, "Admin triggered full database reset");
  res.json({ ok: true });
});

export default router;
