import { Router, type IRouter } from "express";
import { eq, desc, and, or, count, gt } from "drizzle-orm";
import { db, teamsTable, teamPlayersTable, playersTable, leagueTeamsTable, leaguesTable, activityTable, gameweeksTable, gameweekTeamScoresTable } from "@workspace/db";
import {
  GetDashboardSummaryQueryParams,
  GetRecentActivityQueryParams,
  GetDashboardSummaryResponse,
  GetDashboardTopPerformersQueryParams,
  GetRecentActivityResponse,
  GetDashboardTopPerformersResponse,
  GetDashboardSquadQueryParams,
  GetDashboardSquadResponse,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/asyncHandler";
import { getNextKickoffForLeague } from "./fixtures";

const router: IRouter = Router();

router.get("/dashboard/summary", asyncHandler(async (req, res) => {
  const parsed = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { competitionKey } = parsed.data;

  // ── Phase 1: queries independent of each other ───────────────────────────
  const [teamRows, topPlayerRows, currentGwRows, competitionTeamRows, nextKickoff] = await Promise.all([
    db
      .select()
      .from(teamsTable)
      .where(and(
        eq(teamsTable.userId, userId),
        eq(teamsTable.competitionKey, competitionKey),
      ))
      .limit(1),
    db
      .select()
      .from(playersTable)
      .where(eq(playersTable.competitionKey, competitionKey))
      .orderBy(desc(playersTable.totalPoints))
      .limit(1),
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
    db
      .select({ total: count() })
      .from(teamsTable)
      .where(eq(teamsTable.competitionKey, competitionKey)),
    getNextKickoffForLeague(competitionKey),
  ]);

  const team      = teamRows[0] ?? null;
  const teamIdNum = team?.id ?? null;
  const topPlayer = topPlayerRows[0] ?? null;
  const currentGw = currentGwRows[0] ?? null;
  const competitionTeamCount = Number(competitionTeamRows[0]?.total ?? 0);

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
        .where(and(
          eq(teamsTable.competitionKey, competitionKey),
          gt(teamsTable.totalPoints, team.totalPoints),
        )),

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
      competitionTeamCount,
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
      nextKickoff,
    })
  );
}));

router.get("/dashboard/top-performers", asyncHandler(async (req, res) => {
  const parsed = GetDashboardTopPerformersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { competitionKey } = parsed.data;

  const players = await db
    .select({
      id:          playersTable.id,
      name:        playersTable.name,
      nationality: playersTable.nationality,
      position:    playersTable.position,
      totalPoints: playersTable.totalPoints,
    })
    .from(playersTable)
    .where(eq(playersTable.competitionKey, competitionKey))
    .orderBy(desc(playersTable.totalPoints))
    .limit(3);

  res.json(GetDashboardTopPerformersResponse.parse(players));
}));

router.get("/dashboard/squad", asyncHandler(async (req, res) => {
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
      // Use players.total_points (accumulated season points) — same source as Squad Builder.
      // team_players.points is the per-GW tally which starts at 0 each gameweek.
      points:        playersTable.totalPoints,
      name:          playersTable.name,
      position:      playersTable.position,
      imageUrl:      playersTable.imageUrl,
      crestUrl:      playersTable.crestUrl,
    })
    .from(teamPlayersTable)
    .innerJoin(playersTable, eq(teamPlayersTable.playerId, playersTable.id))
    .where(eq(teamPlayersTable.teamId, teamId))
    .orderBy(teamPlayersTable.slot);

  res.json(GetDashboardSquadResponse.parse(rows));
}));

router.get("/dashboard/activity", asyncHandler(async (req, res) => {
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
}));

export default router;
