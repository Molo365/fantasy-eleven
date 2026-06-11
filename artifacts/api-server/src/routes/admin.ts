import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, count, sql, isNotNull } from "drizzle-orm";
import {
  db, usersTable, playersTable, gameweeksTable, fixturesTable,
  teamsTable, teamPlayersTable, leaguesTable, leagueTeamsTable, activityTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { clearAndSyncWorldCupPlayers, syncZafronixPlayers } from "../lib/apiSports";
import { processGameweekScoring } from "../lib/scoring";

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

  // Get teams linked to user accounts
  const teams = await db
    .select({ userId: teamsTable.userId, totalPoints: teamsTable.totalPoints })
    .from(teamsTable)
    .where(isNotNull(teamsTable.userId));

  const userTeams = new Map<number, { squadSubmitted: boolean; totalPoints: number }>();
  for (const t of teams) {
    if (t.userId == null) continue;
    const prev = userTeams.get(t.userId);
    userTeams.set(t.userId, {
      squadSubmitted: true,
      totalPoints: (prev?.totalPoints ?? 0) + t.totalPoints,
    });
  }

  const result = users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    squadSubmitted: userTeams.get(u.id)?.squadSubmitted ?? false,
    totalPoints: userTeams.get(u.id)?.totalPoints ?? 0,
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

// ── Leagues ───────────────────────────────────────────────────────────────────

router.get("/admin/leagues", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id:        leaguesTable.id,
      name:      leaguesTable.name,
      code:      leaguesTable.code,
      createdAt: leaguesTable.createdAt,
      memberCount: count(leagueTeamsTable.teamId),
    })
    .from(leaguesTable)
    .leftJoin(leagueTeamsTable, eq(leaguesTable.id, leagueTeamsTable.leagueId))
    .groupBy(leaguesTable.id)
    .orderBy(leaguesTable.id);

  res.json(rows.map(l => ({
    ...l,
    memberCount: Number(l.memberCount),
    createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
  })));
});

router.delete("/admin/leagues/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(leagueTeamsTable).where(eq(leagueTeamsTable.leagueId, id));
  await db.delete(leaguesTable).where(eq(leaguesTable.id, id));
  req.log.info({ leagueId: id }, "Admin deleted league");
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

const WC_2026_GAMEWEEKS = [
  { number: 1, name: "Group Stage Round 1", round: "group", startDate: "2026-06-11", endDate: "2026-06-14" },
  { number: 2, name: "Group Stage Round 2", round: "group", startDate: "2026-06-15", endDate: "2026-06-19" },
  { number: 3, name: "Group Stage Round 3", round: "group", startDate: "2026-06-20", endDate: "2026-06-26" },
  { number: 4, name: "Round of 32",         round: "r32",   startDate: "2026-06-27", endDate: "2026-07-02" },
  { number: 5, name: "Quarter Finals",      round: "qf",    startDate: "2026-07-04", endDate: "2026-07-05" },
  { number: 6, name: "Semi Finals",         round: "sf",    startDate: "2026-07-08", endDate: "2026-07-09" },
  { number: 7, name: "Final",               round: "final", startDate: "2026-07-19", endDate: "2026-07-19" },
];

function serializeGwAdmin(g: { id: number; number: number; name: string; round: string; status: string; startDate: Date | string; endDate: Date | string; createdAt: Date | string; averagePoints: number | null; highestPoints: number | null }) {
  return {
    ...g,
    startDate: g.startDate instanceof Date ? g.startDate.toISOString() : g.startDate,
    endDate: g.endDate instanceof Date ? g.endDate.toISOString() : g.endDate,
    createdAt: g.createdAt instanceof Date ? g.createdAt.toISOString() : g.createdAt,
  };
}

router.post("/admin/gameweeks", requireAdmin, async (req, res): Promise<void> => {
  const { name, startDate, endDate, round = "group" } = req.body as Record<string, string>;
  if (!name || !startDate || !endDate) {
    res.status(400).json({ error: "name, startDate, and endDate are required" });
    return;
  }
  const existing = await db.select({ n: gameweeksTable.number }).from(gameweeksTable);
  const maxNum = existing.reduce((m, r) => Math.max(m, r.n), 0);
  const [gw] = await db.insert(gameweeksTable).values({
    number: maxNum + 1,
    name,
    round,
    status: "upcoming",
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  }).returning();
  req.log.info({ gameweekId: gw.id, name }, "Admin created gameweek");
  res.status(201).json(serializeGwAdmin(gw));
});

router.post("/admin/gameweeks/auto-create", requireAdmin, async (req, res): Promise<void> => {
  const existing = await db.select({ number: gameweeksTable.number }).from(gameweeksTable);
  const existingNums = new Set(existing.map(r => r.number));
  let created = 0, skipped = 0;
  const inserted: ReturnType<typeof serializeGwAdmin>[] = [];
  for (const gw of WC_2026_GAMEWEEKS) {
    if (existingNums.has(gw.number)) { skipped++; continue; }
    const [row] = await db.insert(gameweeksTable).values({
      number: gw.number,
      name: gw.name,
      round: gw.round,
      status: "upcoming",
      startDate: new Date(gw.startDate),
      endDate: new Date(gw.endDate),
    }).returning();
    inserted.push(serializeGwAdmin(row));
    created++;
  }
  req.log.info({ created, skipped }, "Admin auto-created WC 2026 gameweeks");
  res.json({ created, skipped, gameweeks: inserted });
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

  // Run the scoring engine first
  const scoring = await processGameweekScoring(id);

  // Mark the gameweek as finished
  const [updated] = await db.update(gameweeksTable)
    .set({ status: "finished" })
    .where(eq(gameweeksTable.id, id))
    .returning();

  req.log.info({ gameweekId: id, ...scoring }, "Admin processed gameweek with scoring");
  res.json({ gameweek: updated, scoring });
});

// ── Danger Zone ───────────────────────────────────────────────────────────────

router.post("/admin/sync-players", requireAdmin, async (req, res): Promise<void> => {
  req.log.info("Admin triggered WC player sync");
  const result = await clearAndSyncWorldCupPlayers();
  req.log.info(result, "WC player sync complete via admin");
  res.json({ ok: true, ...result });
});

router.post("/admin/sync-zafronix", requireAdmin, async (req, res): Promise<void> => {
  try {
    req.log.info("Admin triggered Zafronix WC player sync");
    const result = await syncZafronixPlayers();
    req.log.info(result, "Zafronix WC player sync complete via admin");
    res.json({ ok: true, ...result });
  } catch (err) {
    req.log.error({ err }, "Zafronix player sync failed");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/admin/wipe-test-data", requireAdmin, async (req, res): Promise<void> => {
  // 1. Clear activity log
  await db.delete(activityTable);
  // 2. Remove all league memberships, then all leagues
  await db.delete(leagueTeamsTable);
  await db.delete(leaguesTable);
  // 3. Remove all squad selections
  await db.delete(teamPlayersTable);
  // 4. Reset team points, budget, captain, and name back to defaults
  await db.execute(sql`
    UPDATE teams
    SET budget           = 100,
        total_points     = 0,
        captain_id       = NULL,
        vice_captain_id  = NULL,
        name             = 'My Team',
        manager_name     = 'Manager'
  `);
  req.log.warn("Admin wiped test data: leagues, squad selections, points, and team names reset");
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
