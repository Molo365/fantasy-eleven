import { Router, type IRouter } from "express";
import { and, eq, count, desc, inArray, sql } from "drizzle-orm";
import { db, leaguesTable, leagueTeamsTable, teamsTable, usersTable, gameweeksTable, gameweekTeamScoresTable } from "@workspace/db";
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
import { getOrCreateCompetitionTeam } from "../lib/competitionTeam";

const router: IRouter = Router();

function randomCode(len = 6) {
  return Math.random().toString(36).toUpperCase().slice(2, 2 + len);
}

function serializeLeague(l: typeof leaguesTable.$inferSelect) {
  return {
    ...l,
    entryFee: l.entryFee ?? "Free",
    isPublic: l.isPublic ?? false,
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

async function getUserMemberships(userId: number | undefined) {
  if (!userId) return new Map<number, number>();
  const memberships = await db
    .select({
      leagueId: leagueTeamsTable.leagueId,
      teamId: leagueTeamsTable.teamId,
    })
    .from(leagueTeamsTable)
    .innerJoin(teamsTable, eq(leagueTeamsTable.teamId, teamsTable.id))
    .where(eq(teamsTable.userId, userId));
  return new Map(memberships.map((membership) => [membership.leagueId, membership.teamId]));
}

router.get("/leagues", async (req, res): Promise<void> => {
  const leagues = await db.select().from(leaguesTable);
  const memberships = await getUserMemberships(req.session.userId);
  const result = await Promise.all(
    leagues.map(async (l) => ({
      ...serializeLeague(l),
      teamCount: await getTeamCount(l.id),
      isMember: memberships.has(l.id),
      myTeamId: memberships.get(l.id) ?? null,
    }))
  );
  res.json(ListLeaguesResponse.parse(result));
});

router.post("/leagues", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateLeagueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const { league, team } = await db.transaction(async (tx) => {
    const [createdLeague] = await tx
      .insert(leaguesTable)
      .values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        competitionKey: parsed.data.competitionKey,
        code: randomCode(),
        maxMembers: parsed.data.maxMembers ?? null,
        entryFee: parsed.data.entryFee ?? "Free",
        prize1st: parsed.data.prize1st ?? null,
        prize2nd: parsed.data.prize2nd ?? null,
        prize3rd: parsed.data.prize3rd ?? null,
        isPublic: parsed.data.isPublic ?? false,
      })
      .returning();
    const competitionTeam = await getOrCreateCompetitionTeam(
      tx,
      userId,
      createdLeague.competitionKey,
      user.displayName,
    );
    await tx.insert(leagueTeamsTable).values({
      leagueId: createdLeague.id,
      teamId: competitionTeam.id,
    });
    return { league: createdLeague, team: competitionTeam };
  });
  res.status(201).json(GetLeagueResponse.parse({
    ...serializeLeague(league),
    teamCount: 1,
    isMember: true,
    myTeamId: team.id,
  }));
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
  const memberships = await getUserMemberships(req.session.userId);
  res.json(GetLeagueResponse.parse({
    ...serializeLeague(league),
    teamCount: await getTeamCount(league.id),
    isMember: memberships.has(league.id),
    myTeamId: memberships.get(league.id) ?? null,
  }));
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
  // Find the active gameweek for this league's competition so its per-team score
  // cannot be taken from another competition running at the same time.
  const [activeGw] = await db
    .select({ id: gameweeksTable.id })
    .from(gameweeksTable)
    .innerJoin(leaguesTable, eq(leaguesTable.competitionKey, gameweeksTable.competitionKey))
    .where(and(
      eq(leaguesTable.id, params.data.id),
      eq(gameweeksTable.status, "active"),
    ))
    .orderBy(desc(gameweeksTable.id))
    .limit(1);

  const rows = await db
    .select({
      id:              teamsTable.id,
      // Include the active game's provisional score so leaderboard totals reflect
      // the current standings while preserving locked season totals in the DB.
      totalPoints:     sql<number>`${teamsTable.totalPoints} + coalesce(${gameweekTeamScoresTable.points}, 0)`,
      teamName:        teamsTable.name,
      managerName:     teamsTable.managerName,
      userDisplayName: usersTable.displayName,
      username:        usersTable.username,
      gameweekPoints:  gameweekTeamScoresTable.points,
    })
    .from(teamsTable)
    .leftJoin(usersTable, eq(teamsTable.userId, usersTable.id))
    .leftJoin(
      gameweekTeamScoresTable,
      and(
        eq(gameweekTeamScoresTable.teamId, teamsTable.id),
        activeGw ? eq(gameweekTeamScoresTable.gameweekId, activeGw.id) : eq(gameweekTeamScoresTable.gameweekId, -1),
      ),
    )
    .where(inArray(teamsTable.id, teamIds));

  const ranked = rows
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((t, i) => ({
      rank:           i + 1,
      teamId:         t.id,
      teamName:       t.userDisplayName ?? t.teamName,
      managerName:    t.username        ?? t.managerName,
      totalPoints:    t.totalPoints,
      gameweekPoints: t.gameweekPoints  ?? 0,
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
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
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

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  let submittedTeam: typeof teamsTable.$inferSelect | undefined;
  if (parsed.data.teamId !== undefined) {
    [submittedTeam] = await db
      .select()
      .from(teamsTable)
      .where(eq(teamsTable.id, parsed.data.teamId));
    if (!submittedTeam || submittedTeam.userId !== userId) {
      res.status(403).json({ error: "The submitted team does not belong to the authenticated user" });
      return;
    }
    if (submittedTeam.competitionKey !== league.competitionKey) {
      res.status(409).json({
        error: `A ${submittedTeam.competitionKey} team cannot join a ${league.competitionKey} league`,
      });
      return;
    }
  }

  const team = await db.transaction(async (tx) => {
    const competitionTeam = submittedTeam ?? await getOrCreateCompetitionTeam(
      tx,
      userId,
      league.competitionKey,
      user.displayName,
    );
    await tx
      .insert(leagueTeamsTable)
      .values({ leagueId: league.id, teamId: competitionTeam.id })
      .onConflictDoNothing();
    return competitionTeam;
  });

  res.json(JoinLeagueResponse.parse({
    ...serializeLeague(league),
    teamCount: await getTeamCount(league.id),
    isMember: true,
    myTeamId: team.id,
  }));
});

export default router;
