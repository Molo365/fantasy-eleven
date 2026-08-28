import { Router, type IRouter } from "express";
import { GetLiveFixturesResponse } from "@workspace/api-zod";
import { getSerieAFixtures } from "../lib/apiSports";

const router: IRouter = Router();

// ─── Two-tier cache strategy ────────────────────────────────────────────────
//
// Team names (from bootstrap-static) almost never change mid-season: cache
// them for 24 h so they are fetched at most once per server instance.
//
// Mapped fixture results change during live play: a 60-second TTL matches the
// client polling cadence so status and score transitions do not remain stale.
// On a typical refresh only /api/fixtures/ hits the network (~50 KB vs ~800 KB
// for bootstrap-static), eliminating the main source of 10–20 s load times.

type FplTeam    = { id: number; name: string; short_name: string; code: number };
type FplFixture = {
  id: number;
  event: number | null;
  kickoff_time: string | null;
  finished: boolean;
  finished_provisional: boolean;
  started: boolean;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
};

type FixtureLeague = {
  key: string;
  name: string;
  provider: "fpl" | "serie-a";
};

// Keep provider-specific details behind a league registry so adding another
// league later does not require changing the route or the response shape.
const fixtureLeagues: Record<string, FixtureLeague> = {
  "premier-league": {
    key: "premier-league",
    name: "Premier League",
    provider: "fpl",
  },
  "serie-a": {
    key: "serie-a",
    name: "Serie A",
    provider: "serie-a",
  },
};
const DEFAULT_LEAGUE_KEY = "premier-league";

// Team metadata cache: 24-hour TTL
let teamNameCache: {
  at: number;
  map: Map<number, { name: string; code: number }>;
} | null = null;
const TEAM_NAME_TTL_MS = 24 * 60 * 60 * 1000;

// Mapped-fixtures cache: 60-second TTL per league
const fixtureCache = new Map<string, { at: number; data: unknown[] }>();
const FIXTURE_TTL_MS = 60 * 1000;

async function getTeamNames(): Promise<Map<number, { name: string; code: number }>> {
  if (teamNameCache && Date.now() - teamNameCache.at < TEAM_NAME_TTL_MS) {
    return teamNameCache.map;
  }
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  if (!res.ok) throw new Error(`FPL bootstrap HTTP ${res.status}`);
  const { teams } = await res.json() as { teams: FplTeam[] };
  const map = new Map(teams.map(t => [t.id, { name: t.name, code: t.code }]));
  teamNameCache = { at: Date.now(), map };
  return map;
}

async function fetchFplFixtures(league: FixtureLeague): Promise<unknown[]> {
  const cached = fixtureCache.get(league.key);
  if (cached && Date.now() - cached.at < FIXTURE_TTL_MS) {
    return cached.data;
  }

  // Team names and raw fixtures fetched in parallel.
  // getTeamNames() returns instantly from cache on all but the first call
  // (or after a 24 h expiry), so the only network cost on typical refreshes
  // is the small /api/fixtures/ payload.
  const [teamById, fixturesRes] = await Promise.all([
    getTeamNames(),
    fetch("https://fantasy.premierleague.com/api/fixtures/"),
  ]);

  if (!fixturesRes.ok) throw new Error(`FPL fixtures HTTP ${fixturesRes.status}`);
  const rawFixtures = await fixturesRes.json() as FplFixture[];

  const mapped = rawFixtures
    .filter(f => f.kickoff_time != null)
    .map(f => {
      const kickoff = f.kickoff_time!;
      const date = kickoff.slice(0, 10);

      let status: "scheduled" | "live" | "finished";
      if (f.finished || f.finished_provisional) status = "finished";
      else if (f.started)  status = "live";
      else                 status = "scheduled";

      const homeTeam = teamById.get(f.team_h);
      const awayTeam = teamById.get(f.team_a);

      return {
        id: f.id,
        date,
        kickoff,
        status,
        leagueKey: league.key,
        gameweekNumber: f.event,
        round: f.event != null ? `Gameweek ${f.event}` : "TBC",
        venue: null,
        elapsed: null,
        homeTeam: homeTeam?.name ?? `Team ${f.team_h}`,
        awayTeam: awayTeam?.name ?? `Team ${f.team_a}`,
        homeLogo: homeTeam
          ? `https://resources.premierleague.com/premierleague/badges/70/t${homeTeam.code}.png`
          : null,
        awayLogo: awayTeam
          ? `https://resources.premierleague.com/premierleague/badges/70/t${awayTeam.code}.png`
          : null,
        homeScore: f.team_h_score ?? null,
        awayScore: f.team_a_score ?? null,
      };
    });

  fixtureCache.set(league.key, { at: Date.now(), data: mapped });
  return mapped;
}

async function fetchFixturesForLeague(league: FixtureLeague): Promise<unknown[]> {
  switch (league.provider) {
    case "fpl":
      return fetchFplFixtures(league);
    case "serie-a":
      return getSerieAFixtures();
  }
}

// ─── Route ──────────────────────────────────────────────────────────────────

router.get("/fixtures", async (req, res): Promise<void> => {
  try {
    const requestedLeagueKey = typeof req.query.leagueKey === "string"
      ? req.query.leagueKey
      : DEFAULT_LEAGUE_KEY;
    const league = fixtureLeagues[requestedLeagueKey];
    if (!league) {
      res.status(400).json({ error: `Unknown fixture league: ${requestedLeagueKey}` });
      return;
    }

    const fixtures = await fetchFixturesForLeague(league);
    res.json(GetLiveFixturesResponse.parse(fixtures));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch fixtures");
    res.status(502).json({ error: "Failed to fetch fixtures" });
  }
});

export default router;
