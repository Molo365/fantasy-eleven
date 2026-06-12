import { Router, type IRouter } from "express";
import { eq, desc, and, or } from "drizzle-orm";
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

  let team = null;
  let playerCount = 0;
  let leagueCount = 0;
  let captain = null;
  let firstLeagueId: number | null = null;
  let firstLeagueName: string | null = null;

  if (teamIdNum) {
    [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamIdNum));
    const playerRows = await db.select().from(teamPlayersTable).where(eq(teamPlayersTable.teamId, teamIdNum));
    playerCount = playerRows.length;
    const leagueRows = await db
      .select({ leagueId: leagueTeamsTable.leagueId, name: leaguesTable.name })
      .from(leagueTeamsTable)
      .leftJoin(leaguesTable, eq(leagueTeamsTable.leagueId, leaguesTable.id))
      .where(eq(leagueTeamsTable.teamId, teamIdNum))
      .orderBy(leagueTeamsTable.leagueId)
      .limit(10);
    leagueCount = leagueRows.length;
    if (leagueRows[0]) {
      firstLeagueId = leagueRows[0].leagueId;
      firstLeagueName = leagueRows[0].name ?? null;
    }
    if (team?.captainId) {
      [captain] = await db.select().from(playersTable).where(eq(playersTable.id, team.captainId));
    }
  }

  const allTeams = await db.select().from(teamsTable).orderBy(desc(teamsTable.totalPoints));
  const globalRank = team ? allTeams.findIndex((t) => t.id === team!.id) + 1 : 0;

  const topPlayer = await db.select().from(playersTable).orderBy(desc(playersTable.totalPoints)).limit(1);
  const hasRealPoints = (topPlayer[0]?.totalPoints ?? 0) > 0;

  let gameweekPoints = 0;
  let currentGameweekName: string | null = null;
  let currentGameweekNumber: number | null = null;

  const [currentGw] = await db
    .select({ id: gameweeksTable.id, status: gameweeksTable.status, name: gameweeksTable.name, number: gameweeksTable.number })
    .from(gameweeksTable)
    .where(or(eq(gameweeksTable.status, "active"), eq(gameweeksTable.status, "finished")))
    .orderBy(desc(gameweeksTable.id))
    .limit(1);

  if (currentGw) {
    currentGameweekName = currentGw.name ?? null;
    currentGameweekNumber = currentGw.number ?? null;
    if (teamIdNum) {
      const [gwScore] = await db
        .select({ points: gameweekTeamScoresTable.points })
        .from(gameweekTeamScoresTable)
        .where(and(
          eq(gameweekTeamScoresTable.gameweekId, currentGw.id),
          eq(gameweekTeamScoresTable.teamId, teamIdNum),
        ))
        .limit(1);
      gameweekPoints = gwScore?.points ?? 0;
    }
  }

  res.json(
    GetDashboardSummaryResponse.parse({
      teamPoints: team?.totalPoints ?? 0,
      gameweekPoints,
      globalRank: playerCount > 0 ? (globalRank || null) : null,
      leagueCount,
      playerCount,
      budgetRemaining: team?.budget ?? 100,
      hasSquad: playerCount > 0,
      captainName: captain?.name ?? null,
      captainPoints: captain?.totalPoints ?? null,
      topScorerName: hasRealPoints ? (topPlayer[0]?.name ?? null) : null,
      topScorerPoints: hasRealPoints ? (topPlayer[0]?.totalPoints ?? null) : null,
      firstLeagueId,
      firstLeagueName,
      currentGameweekName,
      currentGameweekNumber,
    })
  );
});

router.get("/dashboard/top-performers", async (req, res): Promise<void> => {
  const players = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      nationality: playersTable.nationality,
      position: playersTable.position,
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
      playerId: teamPlayersTable.playerId,
      slot: teamPlayersTable.slot,
      isCaptain: teamPlayersTable.isCaptain,
      isViceCaptain: teamPlayersTable.isViceCaptain,
      points: teamPlayersTable.points,
      name: playersTable.name,
      nationality: playersTable.nationality,
      position: playersTable.position,
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
        id: r.id,
        type: r.type,
        description: r.description,
        playerName: r.playerName,
        points: r.points,
        timestamp: r.createdAt.toISOString(),
      }))
    )
  );
});

export default router;
