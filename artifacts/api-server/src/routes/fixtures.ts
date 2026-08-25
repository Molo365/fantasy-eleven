import { Router, type IRouter } from "express";
import { GetLiveFixturesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Two-tier cache strategy ────────────────────────────────────────────────
//
// Team names (from bootstrap-static) almost never change mid-season: cache
// them for 24 h so they are fetched at most once per server instance.
//
// Mapped fixture results change every few minutes: 5-min TTL as before.
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

// Team metadata cache: 24-hour TTL
let teamNameCache: {
  at: number;
  map: Map<number, { name: string; code: number }>;
} | null = null;
const TEAM_NAME_TTL_MS = 24 * 60 * 60 * 1000;

// Mapped-fixtures cache: 5-minute TTL
let fixtureCache: { at: number; data: unknown[] } | null = null;
const FIXTURE_TTL_MS = 5 * 60 * 1000;

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

async function fetchFplFixtures(): Promise<unknown[]> {
  if (fixtureCache && Date.now() - fixtureCache.at < FIXTURE_TTL_MS) {
    return fixtureCache.data;
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

  fixtureCache = { at: Date.now(), data: mapped };
  return mapped;
}

// ─── Route ──────────────────────────────────────────────────────────────────

router.get("/fixtures", async (req, res): Promise<void> => {
  try {
    const fixtures = await fetchFplFixtures();
    res.json(GetLiveFixturesResponse.parse(fixtures));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch fixtures from FPL API");
    res.status(502).json({ error: "Failed to fetch fixtures" });
  }
});

export default router;
