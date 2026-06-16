import { db, playersTable, teamsTable, teamPlayersTable, gameweeksTable, gameweekTeamScoresTable, usersTable } from "@workspace/db";
import { eq, sql, sum } from "drizzle-orm";
import { logger } from "./logger";

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;

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

// ─── Main scoring function ─────────────────────────────────────────────────────

export async function processGameweekScoring(gameweekId: number): Promise<ScoringResult> {
  // 1. Load the gameweek for date range
  const [gameweek] = await db
    .select()
    .from(gameweeksTable)
    .where(eq(gameweeksTable.id, gameweekId));

  if (!gameweek) throw new Error(`Gameweek ${gameweekId} not found`);

  // 1b. Reset in order: players first, then team_players
  await db.update(playersTable).set({ totalPoints: 0 });
  await db.update(teamPlayersTable).set({ points: 0 });

  // 2. Pre-load all our players for position lookup (external id + name)
  const allPlayers = await db
    .select({
      id: playersTable.id,
      externalId: playersTable.externalId,
      name: playersTable.name,
      position: playersTable.position,
    })
    .from(playersTable);

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
      warning: "Could not reach API-Sports. Gameweek marked as finished without live scoring.",
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
  // dbPlayerId -> { pts, minutes, goals, assists, cleanSheets }
  const playerEarned = new Map<number, {
    pts: number; minutes: number; goals: number; assists: number; cleanSheets: number;
  }>();

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

  // 5. Update player rows in DB
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

    // Write fresh gameweek points to every team_players row for this player
    await db
      .update(teamPlayersTable)
      .set({ points: earned.pts })
      .where(eq(teamPlayersTable.playerId, playerId));

    playersUpdated++;
    totalPointsAwarded += earned.pts;
  }

  // 6. Calculate and store each team's gameweek score
  // Load team → username mapping for logging
  const teamInfoRows = await db
    .select({
      teamId:   teamsTable.id,
      username: usersTable.username,
    })
    .from(teamsTable)
    .leftJoin(usersTable, eq(teamsTable.userId, usersTable.id));

  const teamUsernames = new Map<number, string>();
  for (const row of teamInfoRows) {
    teamUsernames.set(row.teamId, row.username ?? `team#${row.teamId}`);
  }

  const allTeamPlayers = await db
    .select({
      teamId:        teamPlayersTable.teamId,
      playerId:      teamPlayersTable.playerId,
      isCaptain:     teamPlayersTable.isCaptain,
      isViceCaptain: teamPlayersTable.isViceCaptain,
    })
    .from(teamPlayersTable);

  // Group by team
  const teamSquads = new Map<number, Array<{ playerId: number; isCaptain: boolean; isViceCaptain: boolean }>>();
  for (const tp of allTeamPlayers) {
    if (!teamSquads.has(tp.teamId)) teamSquads.set(tp.teamId, []);
    teamSquads.get(tp.teamId)!.push({ playerId: tp.playerId, isCaptain: tp.isCaptain, isViceCaptain: tp.isViceCaptain });
  }

  let teamsUpdated = 0;

  for (const [teamId, squad] of teamSquads) {
    const captainEntry    = squad.find(p => p.isCaptain);
    const captainEarned   = captainEntry ? playerEarned.get(captainEntry.playerId) : undefined;
    const captainMinutes  = captainEarned?.minutes ?? 0;
    const captainPlayed   = captainMinutes > 0;
    const captainName     = captainEntry ? (playerById.get(captainEntry.playerId) ?? "Unknown") : "None";
    const captainRawPts   = captainEarned?.pts ?? 0;
    const username        = teamUsernames.get(teamId) ?? `team#${teamId}`;

    console.log(
      `[SCORING] user=${username} | captain=${captainName} | minutes=${captainMinutes}` +
      ` | raw_pts=${captainRawPts} | after_x2=${captainRawPts * 2}` +
      ` | captain_played=${captainPlayed}`,
    );

    let gwPts = 0;
    for (const { playerId, isCaptain, isViceCaptain } of squad) {
      const earned = playerEarned.get(playerId);
      if (!earned || earned.pts === 0) continue;
      let multiplier = 1;
      if (isCaptain) multiplier = 2;
      else if (isViceCaptain && !captainPlayed) multiplier = 2;
      gwPts += earned.pts * multiplier;
    }

    // Upsert this gameweek's score for the team — idempotent on reprocess
    await db
      .insert(gameweekTeamScoresTable)
      .values({ gameweekId, teamId, points: gwPts })
      .onConflictDoUpdate({
        target: [gameweekTeamScoresTable.gameweekId, gameweekTeamScoresTable.teamId],
        set: { points: gwPts },
      });

    // Recompute totalPoints as the sum of ALL gameweek scores for this team
    const [{ total }] = await db
      .select({ total: sum(gameweekTeamScoresTable.points) })
      .from(gameweekTeamScoresTable)
      .where(eq(gameweekTeamScoresTable.teamId, teamId));

    await db
      .update(teamsTable)
      .set({
        gameweekPoints: gwPts,
        totalPoints: Number(total ?? 0),
      })
      .where(eq(teamsTable.id, teamId));

    if (gwPts > 0) teamsUpdated++;
  }

  // 7. Update gameweek aggregate stats
  const gwPointsList = [...teamSquads.keys()].map(teamId => {
    const squad = teamSquads.get(teamId)!;
    const capEntry = squad.find(p => p.isCaptain);
    const capPlayed = capEntry
      ? (playerEarned.get(capEntry.playerId)?.pts ?? 0) > 0
      : false;
    let pts = 0;
    for (const { playerId, isCaptain, isViceCaptain } of squad) {
      const earned = playerEarned.get(playerId);
      if (!earned) continue;
      let mult = 1;
      if (isCaptain) mult = 2;
      else if (isViceCaptain && !capPlayed) mult = 2;
      pts += earned.pts * mult;
    }
    return pts;
  }).filter(p => p > 0);

  if (gwPointsList.length > 0) {
    const avg = Math.round(gwPointsList.reduce((a, b) => a + b, 0) / gwPointsList.length);
    const highest = Math.max(...gwPointsList);
    await db
      .update(gameweeksTable)
      .set({ averagePoints: avg, highestPoints: highest })
      .where(eq(gameweeksTable.id, gameweekId));
  }

  logger.info(
    { gameweekId, fixturesProcessed, playersUpdated, teamsUpdated, totalPointsAwarded },
    "Gameweek scoring complete",
  );

  return { fixturesProcessed, playersUpdated, teamsUpdated, totalPointsAwarded };
}
