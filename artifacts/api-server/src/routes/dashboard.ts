import { Router, type IRouter } from "express";
import { eq, desc, and, or, count, gt } from "drizzle-orm";
import { db, teamsTable, teamPlayersTable, playersTable, leagueTeamsTable, leaguesTable, activityTable, gameweeksTable, gameweekTeamScoresTable } from "@workspace/db";
import {
  GetDashboardSummaryQueryParams,
  GetRecentActivityQueryParams,
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetDashboardTopPerformersResponse,
  GetDashboardSquadQueryParams,
  GetDashboardSquadResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const parsed = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { teamId } = parsed.data;
  const teamIdNum = teamId ? Number(teamId) : null;

  // ── Phase 1: queries independent of each other ───────────────────────────
  const [teamRows, topPlayerRows, currentGwRows] = await Promise.all([
    teamIdNum
      ? db.select().from(teamsTable).where(eq(teamsTable.id, teamIdNum))
      : Promise.resolve([] as (typeof teamsTable.$inferSelect)[]),
    db.select().from(playersTable).orderBy(desc(playersTable.totalPoints)).limit(1),
    db.select({
        id:     gameweeksTable.id,
        status: gameweeksTable.status,
        name:   gameweeksTable.name,
        number: gameweeksTable.number,
      })
      .from(gameweeksTable)
      .where(or(eq(gameweeksTable.status, "active"), eq(gameweeksTable.status, "finished")))
      .orderBy(desc(gameweeksTable.id))
      .limit(1),
  ]);

  const team      = teamRows[0] ?? null;
  const topPlayer = topPlayerRows[0] ?? null;
  const currentGw = currentGwRows[0] ?? null;

  // ── Phase 2: queries that depend on team / currentGw (still parallel) ────
  let playerCount   = 0;
  let leagueCount   = 0;
  let captain: typeof playersTable.$inferSelect | null = null;
  let firstLeagueId:   number | null = null;
  let firstLeagueName: string | null = null;
  let globalRank   = 0;
  let gameweekPoints = 0;

  if (team && teamIdNum) {
    const [playerRows, leagueRows, rankRows, captainRows, gwScoreRows] = await Promise.all([
      // Count squad slots
      db.select({ id: teamPlayersTable.playerId })
        .from(teamPlayersTable)
        .where(eq(teamPlayersTable.teamId, teamIdNum)),

      // League memberships
      db.select({ leagueId: leagueTeamsTable.leagueId, name: leaguesTable.name })
        .from(leagueTeamsTable)
        .leftJoin(leaguesTable, eq(leagueTeamsTable.leagueId, leaguesTable.id))
        .where(eq(leagueTeamsTable.teamId, teamIdNum))
        .orderBy(leagueTeamsTable.leagueId)
        .limit(10),

      // Global rank: COUNT teams with strictly more points → rank = count + 1
      db.select({ ahead: count() })
        .from(teamsTable)
        .where(gt(teamsTable.totalPoints, team.totalPoints)),

      // Captain
      team.captainId
        ? db.select().from(playersTable).where(eq(playersTable.id, team.captainId)).limit(1)
        : Promise.resolve([] as (typeof playersTable.$inferSelect)[]),

      // Gameweek score for this team
      currentGw
        ? db.select({ points: gameweekTeamScoresTable.points })
            .from(gameweekTeamScoresTable)
            .where(and(
              eq(gameweekTeamScoresTable.gameweekId, currentGw.id),
              eq(gameweekTeamScoresTable.teamId, teamIdNum),
            ))
            .limit(1)
        : Promise.resolve([] as { points: number }[]),
    ]);

    playerCount = playerRows.length;
    leagueCount = leagueRows.length;
    if (leagueRows[0]) {
      firstLeagueId   = leagueRows[0].leagueId;
      firstLeagueName = leagueRows[0].name ?? null;
    }
    globalRank     = Number(rankRows[0]?.ahead ?? 0) + 1;
    captain        = captainRows[0] ?? null;
    gameweekPoints = gwScoreRows[0]?.points ?? 0;
  }

  const hasRealPoints = (topPlayer?.totalPoints ?? 0) > 0;

  res.json(
    GetDashboardSummaryResponse.parse({
      teamPoints:           team?.totalPoints ?? 0,
      gameweekPoints,
      globalRank:           playerCount > 0 ? (globalRank || null) : null,
      leagueCount,
      playerCount,
      budgetRemaining:      team?.budget ?? 100,
      hasSquad:             playerCount > 0,
      captainName:          captain?.name ?? null,
      captainPoints:        captain?.totalPoints ?? null,
      topScorerName:        hasRealPoints ? (topPlayer?.name ?? null) : null,
      topScorerPoints:      hasRealPoints ? (topPlayer?.totalPoints ?? null) : null,
      firstLeagueId,
      firstLeagueName,
      currentGameweekName:   currentGw?.name ?? null,
      currentGameweekNumber: currentGw?.number ?? null,
    })
  );
});

router.get("/dashboard/top-performers", async (req, res): Promise<void> => {
  const players = await db
    .select({
      id:          playersTable.id,
      name:        playersTable.name,
      nationality: playersTable.nationality,
      position:    playersTable.position,
      totalPoints: playersTable.totalPoints,
    })
    .from(playersTable)
    .orderBy(desc(playersTable.totalPoints))
    .limit(3);

  res.json(GetDashboardTopPerformersResponse.parse(players));
});

router.get("/dashboard/squad", async (req, res): Promise<void> => {
  const parsed = GetDashboardSquadQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { teamId } = parsed.data;

  const rows = await db
    .select({
      playerId:      teamPlayersTable.playerId,
      slot:          teamPlayersTable.slot,
      isCaptain:     teamPlayersTable.isCaptain,
      isViceCaptain: teamPlayersTable.isViceCaptain,
      points:        teamPlayersTable.points,
      name:          playersTable.name,
      nationality:   playersTable.nationality,
      position:      playersTable.position,
    })
    .from(teamPlayersTable)
    .innerJoin(playersTable, eq(teamPlayersTable.playerId, playersTable.id))
    .where(eq(teamPlayersTable.teamId, teamId))
    .orderBy(teamPlayersTable.slot);

  res.json(GetDashboardSquadResponse.parse(rows));
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const parsed = GetRecentActivityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { limit = 10 } = parsed.data;
  const rows = await db
    .select()
    .from(activityTable)
    .orderBy(desc(activityTable.createdAt))
    .limit(limit);
  res.json(
    GetRecentActivityResponse.parse(
      rows.map((r) => ({
        id:          r.id,
        type:        r.type,
        description: r.description,
        playerName:  r.playerName,
        points:      r.points,
        timestamp:   r.createdAt.toISOString(),
      }))
    )
  );
});

export default router;
