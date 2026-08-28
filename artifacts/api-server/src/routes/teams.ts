import { Router, type IRouter } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db, teamsTable, teamPlayersTable, playersTable } from "@workspace/db";
import {
  CreateTeamBody,
  UpdateTeamBody,
  UpdateTeamParams,
  GetTeamParams,
  GetTeamPlayersParams,
  AddPlayerToTeamParams,
  AddPlayerToTeamBody,
  RemovePlayerFromTeamParams,
  GetTeamPlayersResponseItem,
  ListTeamsResponse,
  GetTeamResponse,
  GetTeamPlayersResponse,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/asyncHandler";

const router: IRouter = Router();

class RouteError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function respondWithRouteError(res: Parameters<Parameters<typeof asyncHandler>[0]>[1], error: unknown) {
  if (!(error instanceof RouteError)) throw error;
  res.status(error.status).json({ error: error.message });
}

function serializeTeam(team: { createdAt: Date; [key: string]: unknown }) {
  return { ...team, createdAt: team.createdAt.toISOString() };
}

router.get("/teams", asyncHandler(async (_req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.totalPoints);
  res.json(ListTeamsResponse.parse(teams.map(serializeTeam)));
}));

router.post("/teams", asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [team] = await db.insert(teamsTable).values({
    name: parsed.data.name,
    managerName: parsed.data.managerName,
    userId,
    competitionKey: parsed.data.competitionKey,
  }).returning();
  res.status(201).json(GetTeamResponse.parse(serializeTeam(team)));
}));

router.get("/teams/:id", asyncHandler(async (req, res) => {
  const params = GetTeamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, params.data.id));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  res.json(GetTeamResponse.parse(serializeTeam(team)));
}));

router.patch("/teams/:id", asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const params = UpdateTeamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined)          updateData.name          = parsed.data.name;
  if (parsed.data.captainId !== undefined)     updateData.captainId     = parsed.data.captainId;
  if (parsed.data.viceCaptainId !== undefined) updateData.viceCaptainId = parsed.data.viceCaptainId;

  try {
    const team = await db.transaction(async (tx) => {
      const [ownedTeam] = await tx
        .select()
        .from(teamsTable)
        .where(and(
          eq(teamsTable.id, params.data.id),
          eq(teamsTable.userId, userId),
        ))
        .for("update");
      if (!ownedTeam) throw new RouteError(404, "Team not found");

      const leadersChanged = parsed.data.captainId !== undefined
        || parsed.data.viceCaptainId !== undefined;
      const effectiveCaptainId = parsed.data.captainId !== undefined
        ? parsed.data.captainId
        : ownedTeam.captainId;
      const effectiveViceCaptainId = parsed.data.viceCaptainId !== undefined
        ? parsed.data.viceCaptainId
        : ownedTeam.viceCaptainId;

      if (
        effectiveCaptainId != null
        && effectiveViceCaptainId != null
        && effectiveCaptainId === effectiveViceCaptainId
      ) {
        throw new RouteError(400, "Captain and vice-captain must be different players");
      }

      const effectiveLeaderIds = [
        effectiveCaptainId,
        effectiveViceCaptainId,
      ].filter((id): id is number => id != null);
      if (leadersChanged && effectiveLeaderIds.length > 0) {
        const validLeaders = await tx
          .select({ playerId: teamPlayersTable.playerId })
          .from(teamPlayersTable)
          .innerJoin(playersTable, eq(teamPlayersTable.playerId, playersTable.id))
          .where(and(
            eq(teamPlayersTable.teamId, ownedTeam.id),
            eq(playersTable.competitionKey, ownedTeam.competitionKey),
            inArray(teamPlayersTable.playerId, effectiveLeaderIds),
          ));
        const validIds = new Set(validLeaders.map((leader) => leader.playerId));
        if (effectiveLeaderIds.some((id) => !validIds.has(id))) {
          throw new RouteError(400, "Captain and vice-captain must belong to this competition squad");
        }
      }

      if (Object.keys(updateData).length === 0) return ownedTeam;
      const [updatedTeam] = await tx
        .update(teamsTable)
        .set(updateData)
        .where(eq(teamsTable.id, ownedTeam.id))
        .returning();
      return updatedTeam;
    });
    res.json(GetTeamResponse.parse(serializeTeam(team)));
  } catch (error) {
    respondWithRouteError(res, error);
  }
}));

router.get("/teams/:id/players", asyncHandler(async (req, res) => {
  const params = GetTeamPlayersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select({
      id:            teamPlayersTable.id,
      teamId:        teamPlayersTable.teamId,
      playerId:      teamPlayersTable.playerId,
      slot:          teamPlayersTable.slot,
      isCaptain:     teamPlayersTable.isCaptain,
      isViceCaptain: teamPlayersTable.isViceCaptain,
      player: {
        id:            playersTable.id,
        competitionKey: playersTable.competitionKey,
        name:          playersTable.name,
        position:      playersTable.position,
        club:          playersTable.club,
        clubShortName: playersTable.clubShortName,
        nationality:   playersTable.nationality,
        totalPoints:   playersTable.totalPoints,
        price:         playersTable.price,
        form:          playersTable.form,
        selected:      playersTable.selected,
        goalsScored:   playersTable.goalsScored,
        assists:       playersTable.assists,
        cleanSheets:   playersTable.cleanSheets,
        imageUrl:      playersTable.imageUrl,
        crestUrl:      playersTable.crestUrl,
      },
    })
    .from(teamPlayersTable)
    .innerJoin(playersTable, eq(teamPlayersTable.playerId, playersTable.id))
    .where(eq(teamPlayersTable.teamId, params.data.id))
    .orderBy(teamPlayersTable.slot);
  res.json(GetTeamPlayersResponse.parse(rows));
}));

router.post("/teams/:id/players", asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const params = AddPlayerToTeamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddPlayerToTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [team] = await tx
        .select()
        .from(teamsTable)
        .where(and(
          eq(teamsTable.id, params.data.id),
          eq(teamsTable.userId, userId),
        ))
        .for("update");
      if (!team) throw new RouteError(404, "Team not found");

      const [player] = await tx.select().from(playersTable).where(and(
        eq(playersTable.id, parsed.data.playerId),
        eq(playersTable.active, true),
      ));
      if (!player) throw new RouteError(404, "Player not found or no longer available");
      if (team.competitionKey !== player.competitionKey) {
        throw new RouteError(409, "Player and team competitions do not match");
      }
      if (team.budget < player.price) throw new RouteError(400, "Insufficient budget");

      const existingPlayers = await tx
        .select({ club: playersTable.club, playerId: teamPlayersTable.playerId, slot: teamPlayersTable.slot })
        .from(teamPlayersTable)
        .innerJoin(playersTable, eq(teamPlayersTable.playerId, playersTable.id))
        .where(eq(teamPlayersTable.teamId, params.data.id));

      if (existingPlayers.some((ep) => ep.playerId === parsed.data.playerId)) {
        throw new RouteError(400, "Player already in squad");
      }
      if (existingPlayers.some((ep) => ep.slot === parsed.data.slot)) {
        throw new RouteError(400, "This squad slot is already occupied");
      }
      const clubCount = existingPlayers.filter((ep) => ep.club === player.club).length;
      if (clubCount >= 3) {
        throw new RouteError(400, `Club limit reached: max 3 players from ${player.club}`);
      }

      const [teamPlayer] = await tx.insert(teamPlayersTable).values({
        teamId: params.data.id,
        playerId: parsed.data.playerId,
        slot: parsed.data.slot,
        isCaptain: parsed.data.isCaptain ?? false,
        isViceCaptain: parsed.data.isViceCaptain ?? false,
      }).onConflictDoNothing().returning();
      if (!teamPlayer) {
        throw new RouteError(409, "The squad changed before this player could be added. Please try again.");
      }

      await tx
        .update(teamsTable)
        .set({ budget: team.budget - player.price })
        .where(eq(teamsTable.id, team.id));
      return { teamPlayer, player };
    });
    res.status(201).json(GetTeamPlayersResponseItem.parse({
      ...result.teamPlayer,
      player: result.player,
    }));
  } catch (error) {
    respondWithRouteError(res, error);
  }
}));

router.delete("/teams/:id/players/slot/:slot", asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const params = RemovePlayerFromTeamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      const [ownedTeam] = await tx
        .select({ id: teamsTable.id })
        .from(teamsTable)
        .where(and(
          eq(teamsTable.id, params.data.id),
          eq(teamsTable.userId, userId),
        ))
        .for("update");
      if (!ownedTeam) throw new RouteError(404, "Team not found");

      await tx
        .delete(teamPlayersTable)
        .where(and(
          eq(teamPlayersTable.teamId, params.data.id),
          eq(teamPlayersTable.slot, params.data.slot),
        ));

      const [{ totalCost }] = await tx
        .select({ totalCost: sql<number>`COALESCE(SUM(${playersTable.price}), 0)` })
        .from(teamPlayersTable)
        .innerJoin(playersTable, eq(teamPlayersTable.playerId, playersTable.id))
        .where(eq(teamPlayersTable.teamId, params.data.id));

      await tx
        .update(teamsTable)
        .set({ budget: 100 - totalCost })
        .where(eq(teamsTable.id, params.data.id));
    });
    res.sendStatus(204);
  } catch (error) {
    respondWithRouteError(res, error);
  }
}));

export default router;
