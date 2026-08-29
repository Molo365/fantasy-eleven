import { db, playersTable, teamsTable, teamPlayersTable, gameweeksTable, gameweekTeamLineupPlayersTable, gameweekTeamScoresTable, usersTable } from "@workspace/db";
import { and, eq, isNotNull, sql, sum, inArray } from "drizzle-orm";
import { logger } from "./logger";

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;
const PREMIER_LEAGUE_COMPETITION_KEY = "premier-league";
const WORLD_CUP_COMPETITION_KEY = "world-cup-2026";

async function apiFetch<T>(path: string): Promise<T> {
  const key = process.env.API_SPORTS_KEY;
  if (!key) throw new Error("API_SPORTS_KEY not set");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": key },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  const json = await res.json() as { response: T; errors?: Record<string, string> };
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API errors: ${JSON.stringify(json.errors)}`);
  }
  return json.response;
}

// ─── Point values ──────────────────────────────────────────────────────────────

const GOAL_PTS: Record<string, number> = { FWD: 4, MID: 5, DEF: 6, GK: 6 };
const CLEAN_SHEET_PTS: Record<string, number> = { GK: 4, DEF: 4, MID: 1, FWD: 0 };

// ─── API types ─────────────────────────────────────────────────────────────────

type ApiFixture = {
  fixture: { id: number; status: { short: string } };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
};

type PlayerStat = {
  player: { id: number; name: string };
  statistics: Array<{
    games: { minutes: number | null };
    goals: {
      total: number | null;
      assists: number | null;
      conceded: number | null;
      owngoals: number | null;
    };
    cards: { yellow: number | null; red: number | null };
  }>;
};

type FixtureTeamStats = {
  team: { id: number; name: string };
  players: PlayerStat[];
};

type FplLiveResponse = {
  elements: Array<{
    id: number;
    stats: {
      minutes: number;
      goals_scored: number;
      assists: number;
      clean_sheets: number;
      own_goals: number;
      yellow_cards: number;
      red_cards: number;
      total_points: number;
    };
  }>;
};

// ─── Scoring logic ─────────────────────────────────────────────────────────────

function scorePlayer(
  stat: PlayerStat["statistics"][0],
  position: string,
  cleanSheet: boolean,
): number {
  const mins = stat.games.minutes ?? 0;
  if (mins === 0) return 0;

  let pts = mins >= 60 ? 2 : 1;

  const goals = stat.goals.total ?? 0;
  pts += goals * (GOAL_PTS[position] ?? 4);

  const assists = stat.goals.assists ?? 0;
  pts += assists * 3;

  if (cleanSheet) {
    pts += CLEAN_SHEET_PTS[position] ?? 0;
  }

  pts += (stat.cards.yellow ?? 0) * -1;
  pts += (stat.cards.red ?? 0) * -3;
  pts += (stat.goals.owngoals ?? 0) * -2;

  return pts;
}

// ─── Public result type ────────────────────────────────────────────────────────

export interface ScoringResult {
  fixturesProcessed: number;
  playersUpdated: number;
  teamsUpdated: number;
  totalPointsAwarded: number;
  warning?: string;
}

export class GameweekScoringConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameweekScoringConflictError";
  }
}

export type ScoringOptions = {
  finalize?: boolean;
};

function assertGameweekCanBeScored(gameweek: typeof gameweeksTable.$inferSelect): void {
  if (gameweek.lockedAt || gameweek.status === "finished") {
    throw new GameweekScoringConflictError(
      `Gameweek ${gameweek.number} is locked and cannot be scored again.`,
    );
  }
  if (gameweek.status !== "active") {
    throw new GameweekScoringConflictError(
      `Gameweek ${gameweek.number} must be active before it can be scored.`,
    );
  }
}

// ─── Shared: captain-multiplier loop + persist ─────────────────────────────────
//
// Called by both processGameweekScoring (WC) and processFplGameweekScoring (PL).
// Captures a lineup once, applies captain ×2 / VC ×2-if-captain-didn't-play,
// upserts provisional scores, and only totals locked historical gameweeks.

type PlayerEarned = Map<number, { pts: number; minutes: number; goals: number; assists: number; cleanSheets: number }>;

async function scoreAndPersistTeams(
  gameweekId: number,
  competitionKey: string,
  playerEarned: PlayerEarned,
  playerById: Map<number, string>,
  options: ScoringOptions = {},
): Promise<{ teamsUpdated: number }> {
  return db.transaction(async (tx) => {
    // Serialize snapshot creation/finalization so concurrent scheduler and admin
    // requests cannot race into different lineups or overwrite locked scores.
    const [gameweek] = await tx
      .select()
      .from(gameweeksTable)
      .where(eq(gameweeksTable.id, gameweekId))
      .for("update");

    if (!gameweek) throw new Error(`Gameweek ${gameweekId} not found`);
    assertGameweekCanBeScored(gameweek);
    if (gameweek.competitionKey !== competitionKey) {
      throw new GameweekScoringConflictError(
        `Gameweek ${gameweek.number} belongs to ${gameweek.competitionKey}, not ${competitionKey}.`,
      );
    }

    if (!gameweek.lineupSnapshottedAt) {
      const [capturedTeams, currentSquad] = await Promise.all([
        tx
          .select({ teamId: teamsTable.id })
          .from(teamsTable)
          .where(eq(teamsTable.competitionKey, competitionKey)),
        tx
          .select({
            teamId: teamPlayersTable.teamId,
            playerId: teamPlayersTable.playerId,
            slot: teamPlayersTable.slot,
            captainId: teamsTable.captainId,
            viceCaptainId: teamsTable.viceCaptainId,
          })
          .from(teamPlayersTable)
          .innerJoin(teamsTable, eq(teamPlayersTable.teamId, teamsTable.id))
          .where(eq(teamsTable.competitionKey, competitionKey)),
      ]);

      if (currentSquad.length > 0) {
        const occupiedSlots = new Set<string>();
        const selectedPlayers = new Set<string>();
        for (const entry of currentSquad) {
          const slotKey = `${entry.teamId}:${entry.slot}`;
          const playerKey = `${entry.teamId}:${entry.playerId}`;
          if (occupiedSlots.has(slotKey) || selectedPlayers.has(playerKey)) {
            throw new GameweekScoringConflictError(
              `Team ${entry.teamId} has an invalid squad with duplicate slots or players and cannot be snapshotted.`,
            );
          }
          occupiedSlots.add(slotKey);
          selectedPlayers.add(playerKey);
        }

        await tx
          .insert(gameweekTeamLineupPlayersTable)
          .values(currentSquad.map((entry) => ({
            gameweekId,
            teamId: entry.teamId,
            playerId: entry.playerId,
            slot: entry.slot,
            isCaptain: entry.playerId === entry.captainId,
            isViceCaptain: entry.playerId === entry.viceCaptainId,
          })))
          .onConflictDoNothing();
      }

      // Zero-score rows preserve the fact that every current team was included in
      // this first snapshot, even when it had no squad entries at the time.
      if (capturedTeams.length > 0) {
        await tx
          .insert(gameweekTeamScoresTable)
          .values(capturedTeams.map((team) => ({ gameweekId, teamId: team.teamId, points: 0 })))
          .onConflictDoNothing();
      }

      await tx
        .update(gameweeksTable)
        .set({ lineupSnapshottedAt: new Date() })
        .where(eq(gameweeksTable.id, gameweekId));
    }

    const [teamInfoRows, lineupRows] = await Promise.all([
      tx
        .select({ teamId: teamsTable.id, username: usersTable.username })
        .from(teamsTable)
        .leftJoin(usersTable, eq(teamsTable.userId, usersTable.id))
        .where(eq(teamsTable.competitionKey, competitionKey)),
      tx
        .select({
          teamId: gameweekTeamLineupPlayersTable.teamId,
          playerId: gameweekTeamLineupPlayersTable.playerId,
          isCaptain: gameweekTeamLineupPlayersTable.isCaptain,
          isViceCaptain: gameweekTeamLineupPlayersTable.isViceCaptain,
        })
        .from(gameweekTeamLineupPlayersTable)
        .where(eq(gameweekTeamLineupPlayersTable.gameweekId, gameweekId)),
    ]);

    const teamUsernames = new Map<number, string>();
    for (const row of teamInfoRows) {
      teamUsernames.set(row.teamId, row.username ?? `team#${row.teamId}`);
    }

    const capturedTeamRows = await tx
      .select({ teamId: gameweekTeamScoresTable.teamId })
      .from(gameweekTeamScoresTable)
      .where(eq(gameweekTeamScoresTable.gameweekId, gameweekId));
    const teamSquads = new Map<number, Array<{ playerId: number; isCaptain: boolean; isViceCaptain: boolean }>>(
      capturedTeamRows.map((team) => [team.teamId, []]),
    );
    for (const lineup of lineupRows) {
      teamSquads.get(lineup.teamId)!.push(lineup);
    }

    const scoredTeams: Array<{ teamId: number; points: number }> = [];
    for (const [teamId, squad] of teamSquads) {
      const captainEntry = squad.find((player) => player.isCaptain);
      const captainEarned = captainEntry ? playerEarned.get(captainEntry.playerId) : undefined;
      const captainMinutes = captainEarned?.minutes ?? 0;
      const captainPlayed = captainMinutes > 0;
      const captainName = captainEntry ? (playerById.get(captainEntry.playerId) ?? "Unknown") : "None";
      const captainRawPoints = captainEarned?.pts ?? 0;

      logger.info({
        gameweekId,
        teamId,
        username: teamUsernames.get(teamId) ?? `team#${teamId}`,
        captain: captainName,
        captainMinutes,
        captainRawPoints,
        captainPlayed,
      }, "Scoring team from frozen gameweek lineup");

      let points = 0;
      for (const player of squad) {
        const earned = playerEarned.get(player.playerId);
        const multiplier = player.isCaptain || (player.isViceCaptain && !captainPlayed) ? 2 : 1;
        const awardedPoints = (earned?.pts ?? 0) * multiplier;
        points += awardedPoints;

        await tx
          .update(gameweekTeamLineupPlayersTable)
          .set({ points: awardedPoints })
          .where(and(
            eq(gameweekTeamLineupPlayersTable.gameweekId, gameweekId),
            eq(gameweekTeamLineupPlayersTable.teamId, teamId),
            eq(gameweekTeamLineupPlayersTable.playerId, player.playerId),
          ));
      }

      await tx
        .insert(gameweekTeamScoresTable)
        .values({ gameweekId, teamId, points })
        .onConflictDoUpdate({
          target: [gameweekTeamScoresTable.gameweekId, gameweekTeamScoresTable.teamId],
          set: { points },
        });
      scoredTeams.push({ teamId, points });
    }

    const pointValues = scoredTeams.map((team) => team.points);
    const averagePoints = pointValues.length > 0
      ? Math.round(pointValues.reduce((total, points) => total + points, 0) / pointValues.length)
      : 0;
    const highestPoints = pointValues.length > 0 ? Math.max(...pointValues) : 0;

    await tx
      .update(gameweeksTable)
      .set({
        averagePoints,
        highestPoints,
        ...(options.finalize ? { status: "finished", lockedAt: new Date() } : {}),
      })
      .where(eq(gameweeksTable.id, gameweekId));

    // Run after the lock state has been written so a final score is included in
    // season totals, while active provisional scores remain separate.
    for (const scoredTeam of scoredTeams) {
      const [{ total }] = await tx
        .select({ total: sum(gameweekTeamScoresTable.points) })
        .from(gameweekTeamScoresTable)
        .innerJoin(gameweeksTable, eq(gameweekTeamScoresTable.gameweekId, gameweeksTable.id))
        .where(and(
          eq(gameweekTeamScoresTable.teamId, scoredTeam.teamId),
          isNotNull(gameweeksTable.lockedAt),
          eq(gameweeksTable.competitionKey, competitionKey),
        ));

      await tx
        .update(teamsTable)
        .set({ gameweekPoints: scoredTeam.points, totalPoints: Number(total ?? 0) })
        .where(eq(teamsTable.id, scoredTeam.teamId));
    }

    return { teamsUpdated: scoredTeams.filter((team) => team.points > 0).length };
  });
}

// ─── WC scoring (API-Sports) ───────────────────────────────────────────────────

export async function processGameweekScoring(
  gameweekId: number,
  options: ScoringOptions = {},
): Promise<ScoringResult> {
  // 1. Load the gameweek for date range
  const [gameweek] = await db
    .select()
    .from(gameweeksTable)
    .where(eq(gameweeksTable.id, gameweekId));

  if (!gameweek) throw new Error(`Gameweek ${gameweekId} not found`);
  assertGameweekCanBeScored(gameweek);
  if (gameweek.competitionKey !== WORLD_CUP_COMPETITION_KEY) {
    throw new GameweekScoringConflictError(
      `World Cup scoring cannot process ${gameweek.competitionKey} gameweek ${gameweek.number}.`,
    );
  }

  // 2. Pre-load all our players for position lookup (external id + name)
  const allPlayers = await db
    .select({
      id: playersTable.id,
      externalId: playersTable.externalId,
      name: playersTable.name,
      position: playersTable.position,
    })
    .from(playersTable)
    .where(eq(playersTable.competitionKey, WORLD_CUP_COMPETITION_KEY));

  const byExternalId = new Map<number, typeof allPlayers[0]>();
  const byNameLower = new Map<string, typeof allPlayers[0]>();
  for (const p of allPlayers) {
    if (p.externalId) byExternalId.set(p.externalId, p);
    byNameLower.set(p.name.toLowerCase(), p);
  }

  // 3. Fetch finished fixtures from API-Sports
  let fixtureUrl = `/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&status=FT`;
  if (gameweek.startDate && gameweek.endDate) {
    const from = new Date(gameweek.startDate).toISOString().slice(0, 10);
    const toD = new Date(gameweek.endDate);
    toD.setDate(toD.getDate() + 1);
    const to = toD.toISOString().slice(0, 10);
    fixtureUrl += `&from=${from}&to=${to}`;
  }

  let fixtures: ApiFixture[];
  try {
    fixtures = await apiFetch<ApiFixture[]>(fixtureUrl);
  } catch (err) {
    logger.warn({ err }, "Failed to fetch fixtures from API-Sports");
    return {
      fixturesProcessed: 0,
      playersUpdated: 0,
      teamsUpdated: 0,
      totalPointsAwarded: 0,
      warning: "Could not reach API-Sports. The gameweek remains active and unlocked.",
    };
  }

  if (!fixtures?.length) {
    return {
      fixturesProcessed: 0,
      playersUpdated: 0,
      teamsUpdated: 0,
      totalPointsAwarded: 0,
      warning: "No finished fixtures found for this gameweek's date range in API-Sports.",
    };
  }

  // Build a quick playerId -> name lookup for logging
  const playerById = new Map<number, string>();
  for (const p of allPlayers) playerById.set(p.id, p.name);

  // 4. Process each fixture — collect per-player earned points
  const playerEarned: PlayerEarned = new Map();
  let fixturesProcessed = 0;

  for (const fix of fixtures) {
    const homeGoals = fix.goals.home ?? 0;
    const awayGoals = fix.goals.away ?? 0;
    const homeCleanSheet = awayGoals === 0;
    const awayCleanSheet = homeGoals === 0;

    await new Promise(r => setTimeout(r, 250)); // stay within rate limits

    let teamStats: FixtureTeamStats[];
    try {
      teamStats = await apiFetch<FixtureTeamStats[]>(
        `/fixtures/players?fixture=${fix.fixture.id}`,
      );
    } catch (err) {
      logger.warn({ err, fixtureId: fix.fixture.id }, "Failed to fetch player stats, skipping fixture");
      continue;
    }

    if (!teamStats?.length) continue;

    const homeApiTeamId = fix.teams.home.id;

    for (const teamData of teamStats) {
      const isHome = teamData.team.id === homeApiTeamId;
      const cleanSheet = isHome ? homeCleanSheet : awayCleanSheet;

      for (const p of teamData.players) {
        const stat = p.statistics[0];
        if (!stat) continue;

        const dbPlayer =
          byExternalId.get(p.player.id) ??
          byNameLower.get(p.player.name.toLowerCase());

        if (!dbPlayer) continue;

        const pts = scorePlayer(stat, dbPlayer.position, cleanSheet);
        if (pts === 0 && (stat.games.minutes ?? 0) === 0) continue;

        const prev = playerEarned.get(dbPlayer.id) ?? {
          pts: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0,
        };
        playerEarned.set(dbPlayer.id, {
          pts: prev.pts + pts,
          minutes: prev.minutes + (stat.games.minutes ?? 0),
          goals: prev.goals + (stat.goals.total ?? 0),
          assists: prev.assists + (stat.goals.assists ?? 0),
          cleanSheets: prev.cleanSheets + (cleanSheet && (dbPlayer.position === "GK" || dbPlayer.position === "DEF") ? 1 : 0),
        });
      }
    }
    fixturesProcessed++;
  }

  // 5. Freeze/persist the team scores before touching current player displays.
  // A concurrent finalization will reject this operation before mutable player
  // values can be reset, leaving the locked gameweek untouched.
  const { teamsUpdated } = await scoreAndPersistTeams(
    gameweekId,
    WORLD_CUP_COMPETITION_KEY,
    playerEarned,
    playerById,
    options,
  );

  // 6. Update current player rows for the dashboard and squad views.
  const worldCupPlayerIds = allPlayers.map((player) => player.id);
  if (worldCupPlayerIds.length > 0) {
    await db
      .update(playersTable)
      .set({ totalPoints: 0 })
      .where(inArray(playersTable.id, worldCupPlayerIds));
    await db
      .update(teamPlayersTable)
      .set({ points: 0 })
      .where(inArray(teamPlayersTable.playerId, worldCupPlayerIds));
  }

  let playersUpdated = 0;
  let totalPointsAwarded = 0;

  for (const [playerId, earned] of playerEarned) {
    await db
      .update(playersTable)
      .set({
        totalPoints:  sql`${playersTable.totalPoints}  + ${earned.pts}`,
        goalsScored:  sql`${playersTable.goalsScored}  + ${earned.goals}`,
        assists:      sql`${playersTable.assists}       + ${earned.assists}`,
        cleanSheets:  sql`${playersTable.cleanSheets}  + ${earned.cleanSheets}`,
      })
      .where(eq(playersTable.id, playerId));

    await db
      .update(teamPlayersTable)
      .set({ points: earned.pts })
      .where(eq(teamPlayersTable.playerId, playerId));

    playersUpdated++;
    totalPointsAwarded += earned.pts;
  }

  logger.info(
    { gameweekId, fixturesProcessed, playersUpdated, teamsUpdated, totalPointsAwarded },
    "Gameweek scoring complete",
  );

  return { fixturesProcessed, playersUpdated, teamsUpdated, totalPointsAwarded };
}

// ─── FPL live scoring (Premier League) ────────────────────────────────────────

export async function processFplGameweekScoring(
  gameweekId: number,
  options: ScoringOptions = {},
): Promise<ScoringResult> {
  // 1. Load gameweek — fplGameweekNumber must be set
  const [gameweek] = await db
    .select()
    .from(gameweeksTable)
    .where(eq(gameweeksTable.id, gameweekId));

  if (!gameweek) throw new Error(`Gameweek ${gameweekId} not found`);
  assertGameweekCanBeScored(gameweek);
  if (gameweek.competitionKey !== PREMIER_LEAGUE_COMPETITION_KEY) {
    throw new GameweekScoringConflictError(
      `FPL scoring cannot process ${gameweek.competitionKey} gameweek ${gameweek.number}.`,
    );
  }
  if (!gameweek.fplGameweekNumber) {
    throw new Error(
      `Gameweek ${gameweekId} has no FPL gameweek number set. ` +
      `Edit the gameweek row in the admin panel to set it.`,
    );
  }

  // 2. Load only Premier League players.
  const plPlayers = await db
    .select({
      id:         playersTable.id,
      externalId: playersTable.externalId,
      name:       playersTable.name,
      position:   playersTable.position,
    })
    .from(playersTable)
    .where(eq(playersTable.competitionKey, PREMIER_LEAGUE_COMPETITION_KEY));

  const byExternalId = new Map<number, typeof plPlayers[0]>();
  const playerById   = new Map<number, string>();
  for (const p of plPlayers) {
    if (p.externalId) byExternalId.set(p.externalId, p);
    playerById.set(p.id, p.name);
  }

  // 3. Fetch FPL live endpoint — no API key required
  const fplUrl = `https://fantasy.premierleague.com/api/event/${gameweek.fplGameweekNumber}/live/`;
  let fplData: FplLiveResponse;
  try {
    const res = await fetch(fplUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fplData = await res.json() as FplLiveResponse;
  } catch (err) {
    logger.warn({ err, fplUrl }, "Failed to fetch FPL live data");
    return {
      fixturesProcessed: 0,
      playersUpdated: 0,
      teamsUpdated: 0,
      totalPointsAwarded: 0,
      warning: `Could not reach FPL API (GW ${gameweek.fplGameweekNumber}): ${String(err)}`,
    };
  }

  // 4. Build playerEarned map from FPL pre-calculated points
  //    total_points = FPL's official score for this specific gameweek
  //    minutes      = needed for the captain-played check in scoreAndPersistTeams
  const playerEarned: PlayerEarned = new Map();

  for (const element of fplData.elements) {
    const dbPlayer = byExternalId.get(element.id);
    if (!dbPlayer) continue;

    const { total_points, minutes, goals_scored, assists, clean_sheets } = element.stats;
    if (total_points === 0 && minutes === 0) continue;

    playerEarned.set(dbPlayer.id, {
      pts:         total_points,
      minutes,
      goals:       goals_scored,
      assists,
      cleanSheets: clean_sheets,
    });
  }

  // 5. Persist frozen gameweek scores before mutating current player displays.
  // The score transaction re-checks the gameweek lock after the FPL response
  // has been fetched, protecting against a concurrent admin finalization.
  const { teamsUpdated } = await scoreAndPersistTeams(
    gameweekId,
    PREMIER_LEAGUE_COMPETITION_KEY,
    playerEarned,
    playerById,
    options,
  );

  // 6. Write current PL player + teamPlayers rows.
  const plPlayerIds = plPlayers.map(p => p.id);
  if (plPlayerIds.length > 0) {
    await db.update(playersTable).set({ totalPoints: 0 }).where(inArray(playersTable.id, plPlayerIds));
    await db.update(teamPlayersTable).set({ points: 0 }).where(inArray(teamPlayersTable.playerId, plPlayerIds));
  }

  let playersUpdated = 0;
  let totalPointsAwarded = 0;

  for (const [playerId, earned] of playerEarned) {
    await db
      .update(playersTable)
      .set({
        totalPoints: sql`${playersTable.totalPoints} + ${earned.pts}`,
        goalsScored: sql`${playersTable.goalsScored} + ${earned.goals}`,
        assists:     sql`${playersTable.assists}      + ${earned.assists}`,
        cleanSheets: sql`${playersTable.cleanSheets}  + ${earned.cleanSheets}`,
      })
      .where(eq(playersTable.id, playerId));

    await db
      .update(teamPlayersTable)
      .set({ points: earned.pts })
      .where(eq(teamPlayersTable.playerId, playerId));

    playersUpdated++;
    totalPointsAwarded += earned.pts;
  }

  logger.info(
    { gameweekId, fplGw: gameweek.fplGameweekNumber, playersUpdated, teamsUpdated, totalPointsAwarded },
    "FPL gameweek scoring complete",
  );

  return {
    fixturesProcessed: 1, // one FPL live endpoint call
    playersUpdated,
    teamsUpdated,
    totalPointsAwarded,
  };
}
