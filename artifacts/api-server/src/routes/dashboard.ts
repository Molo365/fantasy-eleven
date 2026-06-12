import { Router, type IRouter } from "express";
import { eq, desc, and, or } from "drizzle-orm";
import { db, teamsTable, teamPlayersTable, playersTable, leagueTeamsTable, activityTable, gameweeksTable, gameweekTeamScoresTable } from "@workspace/db";
import {
  GetDashboardSummaryQueryParams,
  GetRecentActivityQueryParams,
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
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

  if (teamIdNum) {
    [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamIdNum));
    const playerRows = await db.select().from(teamPlayersTable).where(eq(teamPlayersTable.teamId, teamIdNum));
    playerCount = playerRows.length;
    const leagueRows = await db.select().from(leagueTeamsTable).where(eq(leagueTeamsTable.teamId, teamIdNum));
    leagueCount = leagueRows.length;
    if (team?.captainId) {
      [captain] = await db.select().from(playersTable).where(eq(playersTable.id, team.captainId));
    }
  }

  const allTeams = await db.select().from(teamsTable).orderBy(desc(teamsTable.totalPoints));
  const globalRank = team ? allTeams.findIndex((t) => t.id === team!.id) + 1 : 0;

  const topPlayer = await db.select().from(playersTable).orderBy(desc(playersTable.totalPoints)).limit(1);
  const hasRealPoints = (topPlayer[0]?.totalPoints ?? 0) > 0;

  // Look up the active gameweek score for this team
  let gameweekPoints = 0;
  if (teamIdNum) {
    // Use active gameweek, or fall back to the most recently finished one
    const [currentGw] = await db
      .select({ id: gameweeksTable.id, status: gameweeksTable.status })
      .from(gameweeksTable)
      .where(or(eq(gameweeksTable.status, "active"), eq(gameweeksTable.status, "finished")))
      .orderBy(desc(gameweeksTable.id))
      .limit(1);
    if (currentGw) {
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
    })
  );
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
