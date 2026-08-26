import { Router, type IRouter } from "express";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import {
  db,
  fixturesTable,
  gameweeksTable,
  gameweekTeamLineupPlayersTable,
  gameweekTeamScoresTable,
  playersTable,
  teamsTable,
} from "@workspace/db";
import type { Gameweek, Fixture } from "@workspace/db";
import {
  GetGameweekFixturesParams,
  GetGameweekHistoryParams,
  GetGameweekHistoryResponse,
  ListGameweeksResponse,
  ListFinishedGameweeksResponse,
  GetCurrentGameweekResponse,
  GetGameweekFixturesResponse,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/asyncHandler";

const router: IRouter = Router();

function serializeGw(gw: Gameweek) {
  return {
    ...gw,
    startDate: gw.startDate instanceof Date ? gw.startDate.toISOString() : gw.startDate,
    endDate: gw.endDate instanceof Date ? gw.endDate.toISOString() : gw.endDate,
    createdAt: gw.createdAt instanceof Date ? gw.createdAt.toISOString() : gw.createdAt,
  };
}

function serializeFixture(f: Fixture) {
  return {
    ...f,
    kickoff: f.kickoff instanceof Date ? f.kickoff.toISOString() : f.kickoff,
    createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
  };
}

router.get("/gameweeks", async (_req, res): Promise<void> => {
  const rows = await db.select().from(gameweeksTable).orderBy(gameweeksTable.number);
  res.json(ListGameweeksResponse.parse(rows.map(serializeGw)));
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
  res.json(GetCurrentGameweekResponse.parse({
    ...serializeGw(gw),
    fixtures: fixtures.map(serializeFixture),
  }));
});

router.get("/gameweeks/history", asyncHandler(async (_req, res) => {
  const rows = await db
    .select()
    .from(gameweeksTable)
    .where(and(
      eq(gameweeksTable.status, "finished"),
      isNotNull(gameweeksTable.lockedAt),
    ))
    .orderBy(desc(gameweeksTable.number));

  res.json(ListFinishedGameweeksResponse.parse(rows.map(serializeGw)));
}));

router.get("/gameweeks/:id/history", asyncHandler(async (req, res) => {
  const params = GetGameweekHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [gameweek] = await db
    .select()
    .from(gameweeksTable)
    .where(and(
      eq(gameweeksTable.id, params.data.id),
      eq(gameweeksTable.status, "finished"),
      isNotNull(gameweeksTable.lockedAt),
    ))
    .limit(1);

  if (!gameweek) {
    res.status(404).json({ error: "Finished gameweek not found" });
    return;
  }

  const [scoreRows, myTeamRows] = await Promise.all([
    db
      .select({
        teamId: gameweekTeamScoresTable.teamId,
        points: gameweekTeamScoresTable.points,
        teamName: teamsTable.name,
        managerName: teamsTable.managerName,
      })
      .from(gameweekTeamScoresTable)
      .leftJoin(teamsTable, eq(gameweekTeamScoresTable.teamId, teamsTable.id))
      .where(eq(gameweekTeamScoresTable.gameweekId, gameweek.id))
      .orderBy(desc(gameweekTeamScoresTable.points), asc(gameweekTeamScoresTable.teamId)),
    db
      .select({
        id: teamsTable.id,
        name: teamsTable.name,
        managerName: teamsTable.managerName,
      })
      .from(teamsTable)
      .where(eq(teamsTable.userId, userId))
      .limit(1),
  ]);

  const myTeam = myTeamRows[0] ?? null;
  const leaderboard = scoreRows.map((row, index) => ({
    rank: index + 1,
    teamId: row.teamId,
    teamName: row.teamName ?? `Team #${row.teamId}`,
    managerName: row.managerName ?? "Former manager",
    points: row.points,
    isCurrentUserTeam: row.teamId === myTeam?.id,
  }));

  let myTeamHistory: {
    teamId: number;
    teamName: string;
    managerName: string;
    totalPoints: number;
    players: Array<{
      playerId: number;
      slot: number;
      name: string;
      position: string;
      club: string;
      imageUrl: string | null;
      crestUrl: string | null;
      points: number | null;
      isCaptain: boolean;
      isViceCaptain: boolean;
    }>;
  } | undefined;

  if (myTeam) {
    const myScore = scoreRows.find((row) => row.teamId === myTeam.id);
    if (myScore) {
      const lineupRows = await db
        .select({
          playerId: gameweekTeamLineupPlayersTable.playerId,
          slot: gameweekTeamLineupPlayersTable.slot,
          points: gameweekTeamLineupPlayersTable.points,
          isCaptain: gameweekTeamLineupPlayersTable.isCaptain,
          isViceCaptain: gameweekTeamLineupPlayersTable.isViceCaptain,
          name: playersTable.name,
          position: playersTable.position,
          club: playersTable.club,
          imageUrl: playersTable.imageUrl,
          crestUrl: playersTable.crestUrl,
        })
        .from(gameweekTeamLineupPlayersTable)
        .leftJoin(playersTable, eq(gameweekTeamLineupPlayersTable.playerId, playersTable.id))
        .where(and(
          eq(gameweekTeamLineupPlayersTable.gameweekId, gameweek.id),
          eq(gameweekTeamLineupPlayersTable.teamId, myTeam.id),
        ))
        .orderBy(asc(gameweekTeamLineupPlayersTable.slot));

      myTeamHistory = {
        teamId: myTeam.id,
        teamName: myTeam.name,
        managerName: myTeam.managerName,
        totalPoints: myScore.points,
        players: lineupRows.map((row) => ({
          playerId: row.playerId,
          slot: row.slot,
          name: row.name ?? `Player #${row.playerId}`,
          position: row.position ?? "Unknown",
          club: row.club ?? "Unknown club",
          imageUrl: row.imageUrl,
          crestUrl: row.crestUrl,
          points: row.points,
          isCaptain: row.isCaptain,
          isViceCaptain: row.isViceCaptain,
        })),
      };
    }
  }

  res.json(GetGameweekHistoryResponse.parse({
    gameweek: serializeGw(gameweek),
    leaderboard,
    ...(myTeamHistory ? { myTeam: myTeamHistory } : {}),
  }));
}));

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
  res.json(GetGameweekFixturesResponse.parse(fixtures.map(serializeFixture)));
});

export default router;
