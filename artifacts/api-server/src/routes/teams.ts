import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
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

function serializeTeam(team: { createdAt: Date; [key: string]: unknown }) {
  return { ...team, createdAt: team.createdAt.toISOString() };
}

router.get("/teams", asyncHandler(async (_req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.totalPoints);
  res.json(ListTeamsResponse.parse(teams.map(serializeTeam)));
}));

router.post("/teams", asyncHandler(async (req, res) => {
  const parsed = CreateTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.session.userId ?? null;
  const [team] = await db.insert(teamsTable).values({
    name: parsed.data.name,
    managerName: parsed.data.managerName,
    userId,
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

  const [team] = await db
    .update(teamsTable)
    .set(updateData)
    .where(eq(teamsTable.id, params.data.id))
    .returning();
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  res.json(GetTeamResponse.parse(serializeTeam(team)));
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
        name:          playersTable.name,
        position:      playersTable.position,
        club:          playersTable.club,
        clubShortName: playersTable.clubShortName,
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
  const [player] = await db.select().from(playersTable).where(and(
    eq(playersTable.id, parsed.data.playerId),
    eq(playersTable.active, true),
  ));
  if (!player) {
    res.status(404).json({ error: "Player not found or no longer available" });
    return;
  }
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, params.data.id));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  if (team.budget < player.price) {
    res.status(400).json({ error: "Insufficient budget" });
    return;
  }

  // Fetch existing squad once — used for both duplicate and club-limit checks
  const existingPlayers = await db
    .select({ club: playersTable.club, playerId: teamPlayersTable.playerId, slot: teamPlayersTable.slot })
    .from(teamPlayersTable)
    .innerJoin(playersTable, eq(teamPlayersTable.playerId, playersTable.id))
    .where(eq(teamPlayersTable.teamId, params.data.id));

  // Reject duplicate picks
  if (existingPlayers.some((ep) => ep.playerId === parsed.data.playerId)) {
    res.status(400).json({ error: "Player already in squad" });
    return;
  }
  if (existingPlayers.some((ep) => ep.slot === parsed.data.slot)) {
    res.status(400).json({ error: "This squad slot is already occupied" });
    return;
  }

  // Enforce max 3 players per club
  const nationCount = existingPlayers.filter((ep) => ep.club === player.club).length;
  if (nationCount >= 3) {
    res.status(400).json({ error: `Nation limit reached: max 3 players from ${player.club}` });
    return;
  }

  const [tp] = await db.insert(teamPlayersTable).values({
    teamId:        params.data.id,
    playerId:      parsed.data.playerId,
    slot:          parsed.data.slot,
    isCaptain:     parsed.data.isCaptain ?? false,
    isViceCaptain: parsed.data.isViceCaptain ?? false,
  }).onConflictDoNothing().returning();
  if (!tp) {
    res.status(409).json({ error: "The squad changed before this player could be added. Please try again." });
    return;
  }

  await db
    .update(teamsTable)
    .set({ budget: team.budget - player.price })
    .where(eq(teamsTable.id, params.data.id));

  res.status(201).json(GetTeamPlayersResponseItem.parse({ ...tp, player }));
}));

router.delete("/teams/:id/players/slot/:slot", asyncHandler(async (req, res) => {
  const params = RemovePlayerFromTeamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(teamPlayersTable)
    .where(and(
      eq(teamPlayersTable.teamId, params.data.id),
      eq(teamPlayersTable.slot, params.data.slot),
    ));

  const [{ totalCost }] = await db
    .select({ totalCost: sql<number>`COALESCE(SUM(${playersTable.price}), 0)` })
    .from(teamPlayersTable)
    .innerJoin(playersTable, eq(teamPlayersTable.playerId, playersTable.id))
    .where(eq(teamPlayersTable.teamId, params.data.id));

  await db
    .update(teamsTable)
    .set({ budget: 100 - totalCost })
    .where(eq(teamsTable.id, params.data.id));

  res.sendStatus(204);
}));

export default router;
