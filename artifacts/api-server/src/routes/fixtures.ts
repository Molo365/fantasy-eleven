import { Router, type IRouter } from "express";
import { GetLiveFixturesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// ─── FPL fixtures cache (5-minute TTL) ────────────────────────────────────────

type CacheEntry = { at: number; data: unknown[] };
let fplCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

type FplTeam = { id: number; name: string; short_name: string };

type FplFixture = {
  id: number;
  event: number | null;        // gameweek number (null for unscheduled BGW fixtures)
  kickoff_time: string | null;
  finished: boolean;
  started: boolean;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
};

async function fetchFplFixtures(): Promise<unknown[]> {
  if (fplCache && Date.now() - fplCache.at < CACHE_TTL_MS) {
    return fplCache.data;
  }

  // Fetch bootstrap (team names) and fixtures in parallel
  const [bootstrapRes, fixturesRes] = await Promise.all([
    fetch("https://fantasy.premierleague.com/api/bootstrap-static/"),
    fetch("https://fantasy.premierleague.com/api/fixtures/"),
  ]);

  if (!bootstrapRes.ok) throw new Error(`FPL bootstrap HTTP ${bootstrapRes.status}`);
  if (!fixturesRes.ok) throw new Error(`FPL fixtures HTTP ${fixturesRes.status}`);

  const bootstrap = await bootstrapRes.json() as { teams: FplTeam[] };
  const rawFixtures = await fixturesRes.json() as FplFixture[];

  // Build team ID → name lookup
  const teamById = new Map<number, string>();
  for (const t of bootstrap.teams) teamById.set(t.id, t.name);

  const mapped = rawFixtures
    .filter(f => f.kickoff_time != null)
    .map(f => {
      const kickoff = f.kickoff_time!;
      const date = kickoff.slice(0, 10); // "YYYY-MM-DD"

      let status: "scheduled" | "live" | "finished";
      if (f.finished) status = "finished";
      else if (f.started) status = "live";
      else status = "scheduled";

      return {
        id: f.id,
        date,
        kickoff,
        status,
        round: f.event != null ? `Gameweek ${f.event}` : "TBC",
        venue: null,
        elapsed: null,
        homeTeam: teamById.get(f.team_h) ?? `Team ${f.team_h}`,
        awayTeam: teamById.get(f.team_a) ?? `Team ${f.team_a}`,
        homeLogo: null,
        awayLogo: null,
        homeScore: f.team_h_score ?? null,
        awayScore: f.team_a_score ?? null,
      };
    });

  fplCache = { at: Date.now(), data: mapped };
  return mapped;
}

// ─── Route ─────────────────────────────────────────────────────────────────────

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
