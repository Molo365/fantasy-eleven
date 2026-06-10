import { Router, type IRouter } from "express";
import { eq, count, inArray } from "drizzle-orm";
import { db, leaguesTable, leagueTeamsTable, teamsTable, usersTable } from "@workspace/db";
import {
  CreateLeagueBody,
  GetLeagueParams,
  GetLeagueLeaderboardParams,
  JoinLeagueParams,
  JoinLeagueBody,
  ListLeaguesResponse,
  GetLeagueResponse,
  GetLeagueLeaderboardResponse,
  JoinLeagueResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function randomCode(len = 6) {
  return Math.random().toString(36).toUpperCase().slice(2, 2 + len);
}

function serializeLeague(l: typeof leaguesTable.$inferSelect) {
  return {
    ...l,
    createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
  };
}

async function getTeamCount(leagueId: number): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(leagueTeamsTable)
    .where(eq(leagueTeamsTable.leagueId, leagueId));
  return Number(value);
}

router.get("/leagues", async (_req, res): Promise<void> => {
  const leagues = await db.select().from(leaguesTable);
  const result = await Promise.all(
    leagues.map(async (l) => ({
      ...serializeLeague(l),
      teamCount: await getTeamCount(l.id),
    }))
  );
  res.json(ListLeaguesResponse.parse(result));
});

router.post("/leagues", async (req, res): Promise<void> => {
  const parsed = CreateLeagueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [league] = await db
    .insert(leaguesTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      code: randomCode(),
    })
    .returning();
  res.status(201).json(GetLeagueResponse.parse({ ...serializeLeague(league), teamCount: 0 }));
});

router.get("/leagues/:id", async (req, res): Promise<void> => {
  const params = GetLeagueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [league] = await db
    .select()
    .from(leaguesTable)
    .where(eq(leaguesTable.id, params.data.id));
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }
  res.json(
    GetLeagueResponse.parse({ ...serializeLeague(league), teamCount: await getTeamCount(league.id) })
  );
});

router.get("/leagues/:id/leaderboard", async (req, res): Promise<void> => {
  const params = GetLeagueLeaderboardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const members = await db
    .select({ teamId: leagueTeamsTable.teamId })
    .from(leagueTeamsTable)
    .where(eq(leagueTeamsTable.leagueId, params.data.id));
  const teamIds = members.map((m) => m.teamId);
  if (!teamIds.length) {
    res.json([]);
    return;
  }
  const rows = await db
    .select({
      id:              teamsTable.id,
      totalPoints:     teamsTable.totalPoints,
      teamName:        teamsTable.name,
      managerName:     teamsTable.managerName,
      userDisplayName: usersTable.displayName,
      username:        usersTable.username,
    })
    .from(teamsTable)
    .leftJoin(usersTable, eq(teamsTable.userId, usersTable.id))
    .where(inArray(teamsTable.id, teamIds));

  const ranked = rows
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((t, i) => ({
      rank:          i + 1,
      teamId:        t.id,
      teamName:      t.userDisplayName ?? t.teamName,
      managerName:   t.username        ?? t.managerName,
      totalPoints:   t.totalPoints,
      gameweekPoints: 0,
    }));
  res.json(GetLeagueLeaderboardResponse.parse(ranked));
});

/**
 * POST /leagues/:id/join
 *
 * Supports two modes:
 *  1. Join by league ID  — send { teamId } with a valid :id in the path
 *  2. Join by invite code — send { teamId, code } with :id = 0
 *     The backend looks up the league by code from the request body.
 */
router.post("/leagues/:id/join", async (req, res): Promise<void> => {
  const params = JoinLeagueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = JoinLeagueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let league: typeof leaguesTable.$inferSelect | undefined;

  // Mode 2: look up by code when provided
  if (parsed.data.code) {
    const [found] = await db
      .select()
      .from(leaguesTable)
      .where(eq(leaguesTable.code, parsed.data.code));
    league = found;
  } else {
    const [found] = await db
      .select()
      .from(leaguesTable)
      .where(eq(leaguesTable.id, params.data.id));
    league = found;
  }

  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  await db
    .insert(leagueTeamsTable)
    .values({ leagueId: league.id, teamId: parsed.data.teamId })
    .onConflictDoNothing();

  res.json(
    JoinLeagueResponse.parse({ ...serializeLeague(league), teamCount: await getTeamCount(league.id) })
  );
});

export default router;
