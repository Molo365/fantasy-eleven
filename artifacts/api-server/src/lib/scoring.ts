import { db, playersTable, teamsTable, teamPlayersTable, gameweeksTable, gameweekTeamLineupPlayersTable, gameweekTeamScoresTable, gameweekPlayerFixtureScoresTable, gameweekPlayerScoringStateTable, usersTable } from "@workspace/db";
import { and, eq, isNotNull, sql, sum, inArray } from "drizzle-orm";
import { logger } from "./logger";
import {
  SERIE_A_COMPETITION_KEY,
  SERIE_A_LEAGUE_ID,
  SERIE_A_SEASON,
} from "./apiSports";

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
  fixture: { id: number; date?: string; status: { short: string } };
  league?: { id: number; season: number };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
};

type PlayerStat = {
  player: { id: number; name: string };
  statistics: Array<{
    games?: { minutes?: number | null };
    goals?: {
      total: number | null;
      assists: number | null;
      conceded: number | null;
      owngoals: number | null;
    };
    cards?: { yellow: number | null; red: number | null };
  }>;
};

type FixtureTeamStats = {
  team: { id: number; name: string };
  players: PlayerStat[];
};

type FixtureLineup = {
  team: { id: number; name: string };
  startXI: Array<{ player: { id: number; name: string } }>;
  substitutes: Array<{ player: { id: number; name: string } }>;
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
  const mins = stat.games?.minutes ?? 0;
  if (mins === 0) return 0;

  let pts = mins >= 60 ? 2 : 1;

  const goals = stat.goals?.total ?? 0;
  pts += goals * (GOAL_PTS[position] ?? 4);

  const assists = stat.goals?.assists ?? 0;
  pts += assists * 3;

  if (cleanSheet) {
    pts += CLEAN_SHEET_PTS[position] ?? 0;
  }

  pts += (stat.cards?.yellow ?? 0) * -1;
  pts += (stat.cards?.red ?? 0) * -3;
  pts += (stat.goals?.owngoals ?? 0) * -2;

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

type ScoreAndPersistOptions = ScoringOptions & {
  preserveExistingScores?: boolean;
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

type PlayerEarnedValue = {
  pts: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
};
type PlayerEarned = Map<number, PlayerEarnedValue>;

type FixtureScoreUpdate = {
  fixtureExternalId: number;
  source: "live" | "finished";
  playerEarned: PlayerEarned;
};

function mergePlayerEarned(target: PlayerEarned, source: PlayerEarned): void {
  for (const [playerId, earned] of source) {
    const previous = target.get(playerId) ?? {
      pts: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
    };
    target.set(playerId, {
      pts: previous.pts + earned.pts,
      minutes: previous.minutes + earned.minutes,
      goals: previous.goals + earned.goals,
      assists: previous.assists + earned.assists,
      cleanSheets: previous.cleanSheets + earned.cleanSheets,
    });
  }
}

async function persistSerieAFixtureScores(
  gameweekId: number,
  updates: FixtureScoreUpdate[],
  replaceAll: boolean,
): Promise<PlayerEarned> {
  const rows = await db.transaction(async (tx) => {
    const [gameweek] = await tx
      .select()
      .from(gameweeksTable)
      .where(eq(gameweeksTable.id, gameweekId))
      .for("update");
    if (!gameweek) throw new Error(`Gameweek ${gameweekId} not found`);
    assertGameweekCanBeScored(gameweek);
    if (gameweek.competitionKey !== SERIE_A_COMPETITION_KEY) {
      throw new GameweekScoringConflictError(
        `Fixture score snapshots cannot be written for ${gameweek.competitionKey}.`,
      );
    }

    if (replaceAll) {
      await tx
        .delete(gameweekPlayerFixtureScoresTable)
        .where(eq(gameweekPlayerFixtureScoresTable.gameweekId, gameweekId));
    }

    for (const update of updates) {
      if (!replaceAll && update.source === "finished") {
        await tx
          .delete(gameweekPlayerFixtureScoresTable)
          .where(and(
            eq(gameweekPlayerFixtureScoresTable.gameweekId, gameweekId),
            eq(gameweekPlayerFixtureScoresTable.fixtureExternalId, update.fixtureExternalId),
          ));
      }

      const values = [...update.playerEarned].map(([playerId, earned]) => ({
        gameweekId,
        playerId,
        fixtureExternalId: update.fixtureExternalId,
        source: update.source,
        points: earned.pts,
        minutes: earned.minutes,
        goals: earned.goals,
        assists: earned.assists,
        cleanSheets: earned.cleanSheets,
        updatedAt: new Date(),
      }));
      if (values.length === 0) continue;

      await tx
        .insert(gameweekPlayerFixtureScoresTable)
        .values(values)
        .onConflictDoUpdate({
          target: [
            gameweekPlayerFixtureScoresTable.gameweekId,
            gameweekPlayerFixtureScoresTable.playerId,
            gameweekPlayerFixtureScoresTable.fixtureExternalId,
          ],
          set: update.source === "live"
            ? {
                source: update.source,
                points: sql`CASE WHEN ${gameweekPlayerFixtureScoresTable.minutes} > 0 AND excluded.minutes = 0 THEN ${gameweekPlayerFixtureScoresTable.points} ELSE excluded.points END`,
                minutes: sql`CASE WHEN ${gameweekPlayerFixtureScoresTable.minutes} > 0 AND excluded.minutes = 0 THEN ${gameweekPlayerFixtureScoresTable.minutes} ELSE excluded.minutes END`,
                goals: sql`CASE WHEN ${gameweekPlayerFixtureScoresTable.minutes} > 0 AND excluded.minutes = 0 THEN ${gameweekPlayerFixtureScoresTable.goals} ELSE excluded.goals END`,
                assists: sql`CASE WHEN ${gameweekPlayerFixtureScoresTable.minutes} > 0 AND excluded.minutes = 0 THEN ${gameweekPlayerFixtureScoresTable.assists} ELSE excluded.assists END`,
                cleanSheets: sql`CASE WHEN ${gameweekPlayerFixtureScoresTable.minutes} > 0 AND excluded.minutes = 0 THEN ${gameweekPlayerFixtureScoresTable.cleanSheets} ELSE excluded.clean_sheets END`,
                updatedAt: new Date(),
              }
            : {
                source: update.source,
                points: sql`excluded.points`,
                minutes: sql`excluded.minutes`,
                goals: sql`excluded.goals`,
                assists: sql`excluded.assists`,
                cleanSheets: sql`excluded.clean_sheets`,
                updatedAt: new Date(),
              },
        });
    }

    return tx
      .select()
      .from(gameweekPlayerFixtureScoresTable)
      .where(eq(gameweekPlayerFixtureScoresTable.gameweekId, gameweekId));
  });

  const aggregated: PlayerEarned = new Map();
  for (const row of rows) {
    mergePlayerEarned(aggregated, new Map([
      [row.playerId, {
        pts: row.points,
        minutes: row.minutes,
        goals: row.goals,
        assists: row.assists,
        cleanSheets: row.cleanSheets,
      }],
    ]));
  }
  return aggregated;
}

async function updateSerieAPlayerScoringState(
  gameweekId: number,
  playerEarned: PlayerEarned,
): Promise<Map<number, number>> {
  const playerIds = [...playerEarned.keys()];
  if (playerIds.length === 0) return new Map();

  return db.transaction(async (tx) => {
    const [gameweek] = await tx
      .select()
      .from(gameweeksTable)
      .where(eq(gameweeksTable.id, gameweekId))
      .for("update");
    if (!gameweek) throw new Error(`Gameweek ${gameweekId} not found`);
    assertGameweekCanBeScored(gameweek);
    if (gameweek.competitionKey !== SERIE_A_COMPETITION_KEY) {
      throw new GameweekScoringConflictError(
        `Serie A player scoring state cannot be written for ${gameweek.competitionKey}.`,
      );
    }

    const currentPlayers = await tx
      .select({
        id: playersTable.id,
        totalPoints: playersTable.totalPoints,
      })
      .from(playersTable)
      .where(inArray(playersTable.id, playerIds));
    const currentTotals = new Map(
      currentPlayers.map((player) => [player.id, player.totalPoints]),
    );

    for (const [playerId, earned] of playerEarned) {
      await tx
        .insert(gameweekPlayerScoringStateTable)
        .values({
          gameweekId,
          playerId,
          baselineTotalPoints: currentTotals.get(playerId) ?? 0,
          currentPoints: earned.pts,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            gameweekPlayerScoringStateTable.gameweekId,
            gameweekPlayerScoringStateTable.playerId,
          ],
          set: {
            currentPoints: earned.pts,
            updatedAt: new Date(),
          },
        });
    }

    const states = await tx
      .select()
      .from(gameweekPlayerScoringStateTable)
      .where(eq(gameweekPlayerScoringStateTable.gameweekId, gameweekId));
    return new Map(
      states.map((state) => [
        state.playerId,
        state.baselineTotalPoints + state.currentPoints,
      ]),
    );
  });
}

async function scoreAndPersistTeams(
  gameweekId: number,
  competitionKey: string,
  playerEarned: PlayerEarned,
  playerById: Map<number, string>,
  options: ScoreAndPersistOptions = {},
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
          points: gameweekTeamLineupPlayersTable.points,
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
    const teamSquads = new Map<number, Array<{ playerId: number; points: number | null; isCaptain: boolean; isViceCaptain: boolean }>>(
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
      const captainStateKnown = !captainEntry || captainEarned !== undefined;
      const captainPlayed = captainStateKnown && captainMinutes > 0;
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
        // A captain omitted from a partial payload is unknown, not a no-show.
        // Preserve both multiplier-sensitive rows until their state is known.
        const multiplierStateUnknown =
          Boolean(options.preserveExistingScores) &&
          !captainStateKnown &&
          (player.isCaptain || player.isViceCaptain);
        const hasFreshScore = earned !== undefined && !multiplierStateUnknown;
        const awardedPoints = hasFreshScore
          ? earned.pts * multiplier
          : options.preserveExistingScores
            ? player.points ?? 0
            : 0;
        points += awardedPoints;

        if (hasFreshScore || !options.preserveExistingScores) {
          await tx
            .update(gameweekTeamLineupPlayersTable)
            .set({ points: awardedPoints })
            .where(and(
              eq(gameweekTeamLineupPlayersTable.gameweekId, gameweekId),
              eq(gameweekTeamLineupPlayersTable.teamId, teamId),
              eq(gameweekTeamLineupPlayersTable.playerId, player.playerId),
            ));
        }
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

// ─── API-Sports scoring ────────────────────────────────────────────────────────

type ApiSportsScoringConfig = {
  competitionKey: string;
  competitionName: string;
  leagueId: number;
  season: number;
};

const WORLD_CUP_SCORING: ApiSportsScoringConfig = {
  competitionKey: WORLD_CUP_COMPETITION_KEY,
  competitionName: "World Cup",
  leagueId: WC_LEAGUE_ID,
  season: WC_SEASON,
};

const SERIE_A_SCORING: ApiSportsScoringConfig = {
  competitionKey: SERIE_A_COMPETITION_KEY,
  competitionName: "Serie A",
  leagueId: SERIE_A_LEAGUE_ID,
  season: SERIE_A_SEASON,
};

async function processApiSportsGameweekScoring(
  gameweekId: number,
  config: ApiSportsScoringConfig,
  options: ScoringOptions = {},
): Promise<ScoringResult> {
  // 1. Load the gameweek for date range
  const [gameweek] = await db
    .select()
    .from(gameweeksTable)
    .where(eq(gameweeksTable.id, gameweekId));

  if (!gameweek) throw new Error(`Gameweek ${gameweekId} not found`);
  assertGameweekCanBeScored(gameweek);
  if (gameweek.competitionKey !== config.competitionKey) {
    throw new GameweekScoringConflictError(
      `${config.competitionName} scoring cannot process ${gameweek.competitionKey} gameweek ${gameweek.number}.`,
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
    .where(eq(playersTable.competitionKey, config.competitionKey));

  const byExternalId = new Map<number, typeof allPlayers[0]>();
  const byNameLower = new Map<string, typeof allPlayers[0]>();
  for (const p of allPlayers) {
    if (p.externalId) byExternalId.set(p.externalId, p);
    byNameLower.set(p.name.toLowerCase(), p);
  }

  // 3. Fetch authoritative finished fixtures from API-Sports.
  let fixtureUrl = `/fixtures?league=${config.leagueId}&season=${config.season}&status=FT`;
  if (gameweek.startDate && gameweek.endDate) {
    const from = new Date(gameweek.startDate).toISOString().slice(0, 10);
    const toD = new Date(gameweek.endDate);
    toD.setDate(toD.getDate() + 1);
    const to = toD.toISOString().slice(0, 10);
    fixtureUrl += `&from=${from}&to=${to}`;
  }

  let finishedFixtures: ApiFixture[];
  try {
    finishedFixtures = await apiFetch<ApiFixture[]>(fixtureUrl);
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

  if (
    config.competitionKey === SERIE_A_COMPETITION_KEY &&
    options.finalize
  ) {
    const allFixturesUrl = fixtureUrl.replace("&status=FT", "");
    let allFixtures: ApiFixture[];
    try {
      allFixtures = await apiFetch<ApiFixture[]>(allFixturesUrl);
    } catch (err) {
      logger.warn({ err, gameweekId }, "Failed to verify Serie A fixtures before finalization");
      throw new GameweekScoringConflictError(
        "Serie A gameweek could not be finalized because fixture statuses could not be verified.",
      );
    }

    const unfinishedFixtures = allFixtures.filter(
      (fixture) => fixture.fixture.status.short !== "FT",
    );
    if (unfinishedFixtures.length > 0) {
      throw new GameweekScoringConflictError(
        `Serie A gameweek cannot be finalized while ${unfinishedFixtures.length} fixture(s) are still unfinished.`,
      );
    }

    // Use the same post-verification snapshot for final scoring so a fixture
    // cannot transition to FT between separate discovery calls and be omitted.
    finishedFixtures = allFixtures;
  }

  // Live scoring is Serie A-only and provisional. Finalization deliberately
  // ignores live fixtures so the finished-fixture calculation remains the
  // sole authoritative result.
  const isProvisionalSerieAScoring =
    config.competitionKey === SERIE_A_COMPETITION_KEY && !options.finalize;
  let liveFixtures: ApiFixture[] = [];
  let liveDiscoveryFailed = false;

  if (isProvisionalSerieAScoring) {
    try {
      const discoveredLiveFixtures = await apiFetch<ApiFixture[]>("/fixtures?live=all");
      const finishedFixtureIds = new Set(
        finishedFixtures.map((fixture) => fixture.fixture.id),
      );
      const windowStart = gameweek.startDate
        ? new Date(gameweek.startDate).getTime()
        : Number.NEGATIVE_INFINITY;
      const windowEnd = gameweek.endDate
        ? new Date(gameweek.endDate).getTime() + (2 * 24 * 60 * 60 * 1000) - 1
        : Number.POSITIVE_INFINITY;

      liveFixtures = discoveredLiveFixtures.filter((fixture) => {
        if (
          fixture.league?.id !== SERIE_A_LEAGUE_ID ||
          fixture.league.season !== SERIE_A_SEASON ||
          finishedFixtureIds.has(fixture.fixture.id)
        ) {
          return false;
        }

        if (!fixture.fixture.date) return true;
        const fixtureTime = new Date(fixture.fixture.date).getTime();
        return Number.isNaN(fixtureTime) ||
          (fixtureTime >= windowStart && fixtureTime <= windowEnd);
      });
    } catch (err) {
      liveDiscoveryFailed = true;
      logger.warn(
        { err, gameweekId },
        "Failed to discover live Serie A fixtures; continuing with finished fixtures",
      );
    }
  }

  if (!finishedFixtures?.length && !liveFixtures.length) {
    return {
      fixturesProcessed: 0,
      playersUpdated: 0,
      teamsUpdated: 0,
      totalPointsAwarded: 0,
      warning: liveDiscoveryFailed
        ? "Live Serie A fixture discovery failed and no finished fixtures were available."
        : isProvisionalSerieAScoring
          ? "No finished or live Serie A fixtures found for this gameweek's date range in API-Sports."
          : "No finished fixtures found for this gameweek's date range in API-Sports.",
    };
  }

  // Build a quick playerId -> name lookup for logging
  const playerById = new Map<number, string>();
  for (const p of allPlayers) playerById.set(p.id, p.name);

  const priorSerieAFixtureRows = config.competitionKey === SERIE_A_COMPETITION_KEY
    ? await db
        .select({
          fixtureExternalId: gameweekPlayerFixtureScoresTable.fixtureExternalId,
          playerId: gameweekPlayerFixtureScoresTable.playerId,
        })
        .from(gameweekPlayerFixtureScoresTable)
        .where(eq(gameweekPlayerFixtureScoresTable.gameweekId, gameweekId))
    : [];
  const priorPlayersByFixture = new Map<number, Set<number>>();
  for (const row of priorSerieAFixtureRows) {
    const players = priorPlayersByFixture.get(row.fixtureExternalId) ?? new Set<number>();
    players.add(row.playerId);
    priorPlayersByFixture.set(row.fixtureExternalId, players);
  }

  // 4. Process finished and live fixtures into one gameweek score. Missing
  // live data is skipped so it cannot erase the last known-good score.
  let playerEarned: PlayerEarned = new Map();
  const fixtureScoreUpdates: FixtureScoreUpdate[] = [];
  let finishedFixturesProcessed = 0;
  let finishedFixturesSkipped = 0;
  let liveFixturesProcessed = 0;
  let liveFixturesSkipped = 0;

  const fetchAndAccumulateFixture = async (
    fixture: ApiFixture,
    source: "finished" | "live",
  ): Promise<PlayerEarned | null> => {
    if (fixture.goals.home === null || fixture.goals.away === null) {
      logger.info(
        { gameweekId, fixtureId: fixture.fixture.id, source },
        "Fixture score is incomplete; preserving previous scores",
      );
      return null;
    }

    let teamStats: FixtureTeamStats[];
    try {
      teamStats = await apiFetch<FixtureTeamStats[]>(
        `/fixtures/players?fixture=${fixture.fixture.id}`,
      );
    } catch (err) {
      logger.warn(
        { err, gameweekId, fixtureId: fixture.fixture.id },
        `Failed to fetch ${source} player stats; preserving previous scores`,
      );
      return null;
    }

    if (!teamStats?.length) {
      logger.info(
        { gameweekId, fixtureId: fixture.fixture.id, source },
        "No player stats available for fixture; preserving previous scores",
      );
      return null;
    }

    let finishedLineups: FixtureLineup[] = [];
    if (
      source === "finished" &&
      config.competitionKey === SERIE_A_COMPETITION_KEY
    ) {
      await new Promise(r => setTimeout(r, 250));
      try {
        finishedLineups = await apiFetch<FixtureLineup[]>(
          `/fixtures/lineups?fixture=${fixture.fixture.id}`,
        );
      } catch (err) {
        logger.warn(
          { err, gameweekId, fixtureId: fixture.fixture.id },
          "Failed to fetch finished Serie A lineups; preserving previous scores",
        );
        return null;
      }
    }

    const homeCleanSheet = fixture.goals.away === 0;
    const awayCleanSheet = fixture.goals.home === 0;
    const homeApiTeamId = fixture.teams.home.id;
    const fixturePlayerEarned: PlayerEarned = new Map();
    const completeProviderPlayersByTeam = new Map<number, Set<number>>();

    for (const teamData of teamStats) {
      const isHome = teamData.team.id === homeApiTeamId;
      const cleanSheet = isHome ? homeCleanSheet : awayCleanSheet;
      const completeProviderPlayers = new Set<number>();

      for (const p of teamData.players) {
        const stat = p.statistics[0];
        if (
          !stat ||
          !stat.games ||
          !stat.goals ||
          !stat.cards
        ) {
          continue;
        }
        completeProviderPlayers.add(p.player.id);

        const dbPlayer =
          byExternalId.get(p.player.id) ??
          byNameLower.get(p.player.name.toLowerCase());

        if (!dbPlayer) continue;

        const pts = scorePlayer(stat, dbPlayer.position, cleanSheet);
        const minutes = stat.games.minutes ?? 0;

        const prev = fixturePlayerEarned.get(dbPlayer.id) ?? {
          pts: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0,
        };
        fixturePlayerEarned.set(dbPlayer.id, {
          pts: prev.pts + pts,
          minutes: prev.minutes + minutes,
          goals: prev.goals + (stat.goals.total ?? 0),
          assists: prev.assists + (stat.goals.assists ?? 0),
          cleanSheets: prev.cleanSheets + (cleanSheet && (dbPlayer.position === "GK" || dbPlayer.position === "DEF") ? 1 : 0),
        });
      }
      completeProviderPlayersByTeam.set(teamData.team.id, completeProviderPlayers);
    }

    if (fixturePlayerEarned.size === 0) {
      logger.info(
        { gameweekId, fixtureId: fixture.fixture.id, source },
        "Fixture returned no usable player stats; preserving previous scores",
      );
      return null;
    }

    if (
      source === "finished" &&
      config.competitionKey === SERIE_A_COMPETITION_KEY
    ) {
      const expectedPlayersByTeam = new Map<number, Set<number>>();
      for (const lineup of finishedLineups) {
        expectedPlayersByTeam.set(
          lineup.team.id,
          new Set([
            ...lineup.startXI.map(({ player }) => player.id),
            ...lineup.substitutes.map(({ player }) => player.id),
          ]),
        );
      }

      const homeExpectedPlayers = expectedPlayersByTeam.get(fixture.teams.home.id);
      const awayExpectedPlayers = expectedPlayersByTeam.get(fixture.teams.away.id);
      const homeCompletePlayers = completeProviderPlayersByTeam.get(fixture.teams.home.id);
      const awayCompletePlayers = completeProviderPlayersByTeam.get(fixture.teams.away.id);
      const missingProviderPlayers = [
        ...[...(homeExpectedPlayers ?? [])].filter(
          (playerId) => !homeCompletePlayers?.has(playerId),
        ),
        ...[...(awayExpectedPlayers ?? [])].filter(
          (playerId) => !awayCompletePlayers?.has(playerId),
        ),
      ];
      const priorPlayers = priorPlayersByFixture.get(fixture.fixture.id) ?? new Set<number>();
      const omittedPriorPlayers = [...priorPlayers].filter(
        (playerId) => !fixturePlayerEarned.has(playerId),
      );

      if (
        !homeExpectedPlayers ||
        !awayExpectedPlayers ||
        homeExpectedPlayers.size < 11 ||
        awayExpectedPlayers.size < 11 ||
        missingProviderPlayers.length > 0 ||
        omittedPriorPlayers.length > 0
      ) {
        logger.warn(
          {
            gameweekId,
            fixtureId: fixture.fixture.id,
            homeExpectedPlayers: homeExpectedPlayers?.size ?? 0,
            awayExpectedPlayers: awayExpectedPlayers?.size ?? 0,
            missingProviderPlayers: missingProviderPlayers.length,
            omittedPriorPlayers: omittedPriorPlayers.length,
          },
          "Finished fixture player stats are incomplete; preserving previous snapshot",
        );
        return null;
      }
    }

    return fixturePlayerEarned;
  };

  for (const fixture of finishedFixtures) {
    await new Promise(r => setTimeout(r, 250)); // stay within rate limits
    const fixturePlayerEarned = await fetchAndAccumulateFixture(fixture, "finished");
    if (fixturePlayerEarned) {
      if (config.competitionKey === SERIE_A_COMPETITION_KEY) {
        fixtureScoreUpdates.push({
          fixtureExternalId: fixture.fixture.id,
          source: "finished",
          playerEarned: fixturePlayerEarned,
        });
      } else {
        mergePlayerEarned(playerEarned, fixturePlayerEarned);
      }
      finishedFixturesProcessed++;
    } else {
      finishedFixturesSkipped++;
    }
  }

  for (const fixture of liveFixtures) {
    await new Promise(r => setTimeout(r, 250)); // stay within rate limits
    const fixturePlayerEarned = await fetchAndAccumulateFixture(fixture, "live");
    if (fixturePlayerEarned) {
      fixtureScoreUpdates.push({
        fixtureExternalId: fixture.fixture.id,
        source: "live",
        playerEarned: fixturePlayerEarned,
      });
      liveFixturesProcessed++;
    } else {
      liveFixturesSkipped++;
    }
  }

  const fixturesProcessed = finishedFixturesProcessed + liveFixturesProcessed;
  let serieASeasonTotals = new Map<number, number>();

  if (
    config.competitionKey === SERIE_A_COMPETITION_KEY &&
    options.finalize &&
    finishedFixturesSkipped > 0
  ) {
    throw new GameweekScoringConflictError(
      `Serie A gameweek cannot be finalized because ${finishedFixturesSkipped} finished fixture(s) lack usable player statistics.`,
    );
  }

  if (
    config.competitionKey === SERIE_A_COMPETITION_KEY &&
    fixtureScoreUpdates.length > 0
  ) {
    playerEarned = await persistSerieAFixtureScores(
      gameweekId,
      fixtureScoreUpdates,
      Boolean(options.finalize),
    );
    serieASeasonTotals = await updateSerieAPlayerScoringState(
      gameweekId,
      playerEarned,
    );
  }

  if (playerEarned.size === 0) {
    return {
      fixturesProcessed,
      playersUpdated: 0,
      teamsUpdated: 0,
      totalPointsAwarded: 0,
      warning: liveFixtures.length > 0
        ? "Live Serie A fixtures were found, but no usable player statistics were available; previous scores were preserved."
        : "No usable player statistics were available for the finished fixtures.",
    };
  }

  // 5. Freeze/persist the team scores before touching current player displays.
  // A concurrent finalization will reject this operation before mutable player
  // values can be reset, leaving the locked gameweek untouched.
  const { teamsUpdated } = await scoreAndPersistTeams(
    gameweekId,
    config.competitionKey,
    playerEarned,
    playerById,
    {
      ...options,
      preserveExistingScores: isProvisionalSerieAScoring,
    },
  );

  // 6. Update current player rows for the dashboard and squad views.
  const competitionPlayerIds = allPlayers.map((player) => player.id);
  if (competitionPlayerIds.length > 0) {
    if (config.competitionKey !== SERIE_A_COMPETITION_KEY) {
      await db
        .update(playersTable)
        .set({ totalPoints: 0 })
        .where(inArray(playersTable.id, competitionPlayerIds));
    }
    await db
      .update(teamPlayersTable)
      .set({ points: 0 })
      .where(inArray(teamPlayersTable.playerId, competitionPlayerIds));
  }

  let playersUpdated = 0;
  let totalPointsAwarded = 0;

  for (const [playerId, earned] of playerEarned) {
    const playerUpdate = config.competitionKey === SERIE_A_COMPETITION_KEY
      ? options.finalize
        ? {
            totalPoints: serieASeasonTotals.get(playerId) ?? earned.pts,
            goalsScored: sql`${playersTable.goalsScored} + ${earned.goals}`,
            assists: sql`${playersTable.assists} + ${earned.assists}`,
            cleanSheets: sql`${playersTable.cleanSheets} + ${earned.cleanSheets}`,
          }
        : {
            totalPoints: serieASeasonTotals.get(playerId) ?? earned.pts,
          }
      : {
          totalPoints: sql`${playersTable.totalPoints} + ${earned.pts}`,
          goalsScored: sql`${playersTable.goalsScored} + ${earned.goals}`,
          assists: sql`${playersTable.assists} + ${earned.assists}`,
          cleanSheets: sql`${playersTable.cleanSheets} + ${earned.cleanSheets}`,
        };

    await db
      .update(playersTable)
      .set(playerUpdate)
      .where(eq(playersTable.id, playerId));

    await db
      .update(teamPlayersTable)
      .set({ points: earned.pts })
      .where(eq(teamPlayersTable.playerId, playerId));

    playersUpdated++;
    totalPointsAwarded += earned.pts;
  }

  logger.info(
    {
      gameweekId,
      fixturesProcessed,
      finishedFixturesProcessed,
      finishedFixturesSkipped,
      liveFixturesProcessed,
      liveFixturesSkipped,
      playersUpdated,
      teamsUpdated,
      totalPointsAwarded,
    },
    `${config.competitionName} gameweek scoring complete`,
  );

  return {
    fixturesProcessed,
    playersUpdated,
    teamsUpdated,
    totalPointsAwarded,
    ...(liveDiscoveryFailed
      ? { warning: "Live Serie A fixture discovery failed; finished fixtures were still processed." }
      : finishedFixturesSkipped > 0 || liveFixturesSkipped > 0
        ? {
            warning:
              `${finishedFixturesSkipped} finished and ${liveFixturesSkipped} live fixture(s) ` +
              "had no usable player statistics; previous fixture snapshots were preserved.",
          }
        : {}),
  };
}

export async function processGameweekScoring(
  gameweekId: number,
  options: ScoringOptions = {},
): Promise<ScoringResult> {
  return processApiSportsGameweekScoring(gameweekId, WORLD_CUP_SCORING, options);
}

export async function processSerieAGameweekScoring(
  gameweekId: number,
  options: ScoringOptions = {},
): Promise<ScoringResult> {
  return processApiSportsGameweekScoring(gameweekId, SERIE_A_SCORING, options);
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
