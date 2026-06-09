/**
 * seed-wc2026.ts
 * Seeds the database with FIFA World Cup 2026 player pool and gameweek schedule.
 *
 * Run: pnpm --filter @workspace/scripts run seed-wc2026
 *
 * Strategy:
 *  1. Fetch players from API-Sports (league 1, season 2026 → 2022 fallback)
 *  2. Assign quality-tiered fantasy prices (GK £4-6m, DEF £4-7m, MID £5-9m, FWD £6-12m)
 *  3. Clear and re-seed players table (preserving team_players references)
 *  4. Clear and re-seed gameweeks with WC 2026 schedule
 *  5. Reset all team budgets to £100m
 */

import { db, playersTable, gameweeksTable, fixturesTable, teamsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1;

// ─── Pricing tiers ────────────────────────────────────────────────────────────

/** Nations whose players command premium prices */
const TIER1_NATIONS = new Set([
  "France", "Brazil", "Argentina", "England", "Spain",
  "Portugal", "Germany", "Netherlands", "Belgium",
]);
const TIER2_NATIONS = new Set([
  "Croatia", "Morocco", "Italy", "Uruguay", "Denmark",
  "Switzerland", "Senegal", "Mexico", "USA", "Japan",
  "South Korea", "Australia", "Poland", "Serbia",
]);

/** Star players get a fixed override price */
const STAR_PRICES: Record<string, number> = {
  "Kylian Mbappé": 13.5, "Kylian Mbappe": 13.5,
  "Erling Haaland": 14.0,
  "Vinicius Junior": 13.0, "Vinícius Junior": 13.0,
  "Jude Bellingham": 11.5,
  "Lionel Messi": 12.5,
  "Cristiano Ronaldo": 10.0,
  "Lamine Yamal": 11.0,
  "Bukayo Saka": 10.5,
  "Phil Foden": 10.0,
  "Kevin De Bruyne": 10.5,
  "Pedri": 9.5,
  "Rodri": 9.0,
  "Gavi": 8.5,
};

type PositionKey = "GK" | "DEF" | "MID" | "FWD";

const PRICE_RANGES: Record<PositionKey, { t1: [number, number]; t2: [number, number]; t3: [number, number] }> = {
  GK:  { t1: [5.0, 6.0], t2: [4.5, 5.5], t3: [4.0, 5.0] },
  DEF: { t1: [5.5, 7.0], t2: [4.5, 6.0], t3: [4.0, 5.5] },
  MID: { t1: [6.5, 9.0], t2: [5.5, 7.5], t3: [5.0, 6.5] },
  FWD: { t1: [8.0, 12.0], t2: [6.5, 9.0], t3: [6.0, 7.5] },
};

function assignPrice(name: string, position: PositionKey, nationality: string): number {
  if (STAR_PRICES[name]) return STAR_PRICES[name];
  const range = TIER1_NATIONS.has(nationality)
    ? PRICE_RANGES[position].t1
    : TIER2_NATIONS.has(nationality)
    ? PRICE_RANGES[position].t2
    : PRICE_RANGES[position].t3;
  const price = range[0] + Math.random() * (range[1] - range[0]);
  return parseFloat(price.toFixed(1));
}

// ─── API-Sports helpers ───────────────────────────────────────────────────────

type ApiPlayer = {
  player: { id: number; name: string; nationality: string; photo: string };
  statistics: Array<{
    team: { id: number; name: string };
    games: { position: string };
    goals: { total: number | null; assists: number | null };
  }>;
};

const POSITION_MAP: Record<string, PositionKey> = {
  Goalkeeper: "GK", Defender: "DEF", Midfielder: "MID", Attacker: "FWD",
};

function toShortName(club: string): string {
  const OVERRIDES: Record<string, string> = {
    "Real Madrid": "RMA", "Barcelona": "BAR", "Man City": "MCI",
    "Manchester City": "MCI", "Liverpool": "LIV", "Arsenal": "ARS",
    "Chelsea": "CHE", "Man United": "MUN", "Manchester United": "MUN",
    "Bayern Munich": "BAY", "AC Milan": "ACM", "Inter Milan": "INT",
    "Atletico Madrid": "ATM", "PSG": "PSG", "Paris Saint-Germain": "PSG",
    "Juventus": "JUV", "Tottenham": "TOT", "Borussia Dortmund": "BVB",
    "Al-Nassr": "ANS", "Al-Hilal": "AHI", "Inter Miami": "MIA",
    "Newcastle": "NEW", "Aston Villa": "AVL",
  };
  if (OVERRIDES[club]) return OVERRIDES[club];
  const words = club.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return club.slice(0, 3).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map(w => w[0]).join("").toUpperCase().slice(0, 3);
}

async function apiGet(path: string): Promise<unknown> {
  const key = process.env.API_SPORTS_KEY;
  if (!key) throw new Error("API_SPORTS_KEY env var not set");

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": key },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from API-Sports`);

  const json = await res.json() as {
    response: unknown;
    paging: { current: number; total: number };
    errors: unknown;
  };

  const errs = json.errors;
  if (errs && typeof errs === "object" && Object.keys(errs).length > 0) {
    throw new Error(JSON.stringify(errs));
  }
  return json;
}

async function fetchAllPlayers(season: number): Promise<ApiPlayer[]> {
  console.log(`  Fetching season ${season} page 1…`);
  const first = await apiGet(`/players?league=${WC_LEAGUE_ID}&season=${season}&page=1`) as {
    response: ApiPlayer[]; paging: { current: number; total: number };
  };

  const players = [...(first.response ?? [])];
  const total = first.paging?.total ?? 1;

  for (let p = 2; p <= total; p++) {
    console.log(`  Fetching page ${p}/${total}…`);
    const page = await apiGet(`/players?league=${WC_LEAGUE_ID}&season=${season}&page=${p}`) as {
      response: ApiPlayer[];
    };
    players.push(...(page.response ?? []));
    await new Promise(r => setTimeout(r, 200)); // rate-limit safety
  }

  return players;
}

// ─── Curated WC 2026 player pool (fallback) ───────────────────────────────────

type CuratedPlayer = {
  name: string; pos: PositionKey; club: string; nat: string; price: number;
  goals?: number; assists?: number;
};

const CURATED_PLAYERS: CuratedPlayer[] = [
  // ── GK ──
  { name: "Alisson Becker",    pos: "GK", club: "Liverpool",       nat: "Brazil",      price: 6.0 },
  { name: "Ederson",           pos: "GK", club: "Man City",        nat: "Brazil",      price: 5.5 },
  { name: "Thibaut Courtois",  pos: "GK", club: "Real Madrid",     nat: "Belgium",     price: 6.0 },
  { name: "Manuel Neuer",      pos: "GK", club: "Bayern Munich",   nat: "Germany",     price: 5.0 },
  { name: "Yassine Bounou",    pos: "GK", club: "Al-Hilal",        nat: "Morocco",     price: 5.5 },
  { name: "Jordan Pickford",   pos: "GK", club: "Everton",         nat: "England",     price: 5.0 },
  { name: "Mike Maignan",      pos: "GK", club: "AC Milan",        nat: "France",      price: 5.5 },
  { name: "Unai Simon",        pos: "GK", club: "Athletic Bilbao", nat: "Spain",       price: 5.0 },
  { name: "Diogo Costa",       pos: "GK", club: "Porto",           nat: "Portugal",    price: 5.0 },
  { name: "David Raya",        pos: "GK", club: "Arsenal",         nat: "Spain",       price: 5.0 },
  // ── DEF ──
  { name: "Virgil van Dijk",   pos: "DEF", club: "Liverpool",      nat: "Netherlands", price: 7.0 },
  { name: "Achraf Hakimi",     pos: "DEF", club: "PSG",            nat: "Morocco",     price: 7.5 },
  { name: "Ruben Dias",        pos: "DEF", club: "Man City",       nat: "Portugal",    price: 6.5 },
  { name: "Antonio Rudiger",   pos: "DEF", club: "Real Madrid",    nat: "Germany",     price: 6.0 },
  { name: "Theo Hernandez",    pos: "DEF", club: "AC Milan",       nat: "France",      price: 7.5 },
  { name: "Joao Cancelo",      pos: "DEF", club: "Barcelona",      nat: "Portugal",    price: 7.0 },
  { name: "Alphonso Davies",   pos: "DEF", club: "Bayern Munich",  nat: "Canada",      price: 7.0 },
  { name: "Reece James",       pos: "DEF", club: "Chelsea",        nat: "England",     price: 6.5 },
  { name: "Ben White",         pos: "DEF", club: "Arsenal",        nat: "England",     price: 6.0 },
  { name: "Jules Kounde",      pos: "DEF", club: "Barcelona",      nat: "France",      price: 6.5 },
  { name: "Dayot Upamecano",   pos: "DEF", club: "Bayern Munich",  nat: "France",      price: 6.0 },
  { name: "Raphael Varane",    pos: "DEF", club: "Como",           nat: "France",      price: 6.0 },
  { name: "Lisandro Martinez", pos: "DEF", club: "Man United",     nat: "Argentina",   price: 6.5 },
  { name: "Eder Militao",      pos: "DEF", club: "Real Madrid",    nat: "Brazil",      price: 6.0 },
  { name: "Danilo",            pos: "DEF", club: "Juventus",       nat: "Brazil",      price: 5.5 },
  { name: "Kieran Trippier",   pos: "DEF", club: "Newcastle",      nat: "England",     price: 6.5 },
  { name: "Trent Alexander-Arnold", pos: "DEF", club: "Real Madrid", nat: "England",  price: 7.0 },
  { name: "Carvajal",          pos: "DEF", club: "Real Madrid",    nat: "Spain",       price: 6.5 },
  { name: "Alejandro Grimaldo",pos: "DEF", club: "Bayer Leverkusen", nat: "Spain",    price: 6.5 },
  { name: "Cristian Romero",   pos: "DEF", club: "Tottenham",      nat: "Argentina",   price: 6.0 },
  // ── MID ──
  { name: "Jude Bellingham",   pos: "MID", club: "Real Madrid",    nat: "England",     price: 11.5 },
  { name: "Kevin De Bruyne",   pos: "MID", club: "Man City",       nat: "Belgium",     price: 10.5 },
  { name: "Pedri",             pos: "MID", club: "Barcelona",      nat: "Spain",       price: 9.5 },
  { name: "Rodri",             pos: "MID", club: "Man City",       nat: "Spain",       price: 9.0 },
  { name: "Gavi",              pos: "MID", club: "Barcelona",      nat: "Spain",       price: 8.5 },
  { name: "Phil Foden",        pos: "MID", club: "Man City",       nat: "England",     price: 10.0 },
  { name: "Luka Modric",       pos: "MID", club: "Real Madrid",    nat: "Croatia",     price: 8.5 },
  { name: "Bruno Fernandes",   pos: "MID", club: "Man United",     nat: "Portugal",    price: 9.0 },
  { name: "Martin Odegaard",   pos: "MID", club: "Arsenal",        nat: "Norway",      price: 8.5 },
  { name: "Declan Rice",       pos: "MID", club: "Arsenal",        nat: "England",     price: 8.5 },
  { name: "Federico Valverde", pos: "MID", club: "Real Madrid",    nat: "Uruguay",     price: 8.0 },
  { name: "Eduardo Camavinga", pos: "MID", club: "Real Madrid",    nat: "France",      price: 8.0 },
  { name: "Aurelien Tchouameni", pos: "MID", club: "Real Madrid",  nat: "France",      price: 7.5 },
  { name: "Frenkie de Jong",   pos: "MID", club: "Barcelona",      nat: "Netherlands", price: 7.5 },
  { name: "Ilkay Gundogan",    pos: "MID", club: "Barcelona",      nat: "Germany",     price: 7.5 },
  { name: "Leandro Paredes",   pos: "MID", club: "Roma",           nat: "Argentina",   price: 6.5 },
  { name: "Enzo Fernandez",    pos: "MID", club: "Chelsea",        nat: "Argentina",   price: 8.0 },
  { name: "Alexis Mac Allister", pos: "MID", club: "Liverpool",    nat: "Argentina",   price: 7.5 },
  { name: "Jamal Musiala",     pos: "MID", club: "Bayern Munich",  nat: "Germany",     price: 9.0 },
  { name: "Florian Wirtz",     pos: "MID", club: "Bayer Leverkusen", nat: "Germany",   price: 8.5 },
  // ── FWD ──
  { name: "Kylian Mbappe",     pos: "FWD", club: "Real Madrid",    nat: "France",      price: 13.5 },
  { name: "Erling Haaland",    pos: "FWD", club: "Man City",       nat: "Norway",      price: 14.0 },
  { name: "Vinicius Junior",   pos: "FWD", club: "Real Madrid",    nat: "Brazil",      price: 13.0 },
  { name: "Lionel Messi",      pos: "FWD", club: "Inter Miami",    nat: "Argentina",   price: 12.5 },
  { name: "Cristiano Ronaldo", pos: "FWD", club: "Al-Nassr",       nat: "Portugal",    price: 10.0 },
  { name: "Lamine Yamal",      pos: "FWD", club: "Barcelona",      nat: "Spain",       price: 11.0 },
  { name: "Bukayo Saka",       pos: "FWD", club: "Arsenal",        nat: "England",     price: 10.5 },
  { name: "Raphinha",          pos: "FWD", club: "Barcelona",      nat: "Brazil",      price: 9.5 },
  { name: "Antoine Griezmann", pos: "FWD", club: "Atletico Madrid", nat: "France",     price: 9.5 },
  { name: "Ousmane Dembele",   pos: "FWD", club: "PSG",            nat: "France",      price: 9.0 },
  { name: "Marcus Rashford",   pos: "FWD", club: "Aston Villa",    nat: "England",     price: 8.5 },
  { name: "Gabriel Martinelli", pos: "FWD", club: "Arsenal",       nat: "Brazil",      price: 8.5 },
  { name: "Rodrygo",           pos: "FWD", club: "Real Madrid",    nat: "Brazil",      price: 9.0 },
  { name: "Richarlison",       pos: "FWD", club: "Tottenham",      nat: "Brazil",      price: 8.5 },
  { name: "Cody Gakpo",        pos: "FWD", club: "Liverpool",      nat: "Netherlands", price: 8.5 },
  { name: "Rafael Leao",       pos: "FWD", club: "AC Milan",       nat: "Portugal",    price: 9.5 },
  { name: "Niclas Fullkrug",   pos: "FWD", club: "West Ham",       nat: "Germany",     price: 7.5 },
  { name: "Julian Alvarez",    pos: "FWD", club: "Atletico Madrid", nat: "Argentina",   price: 9.0 },
  { name: "Alvaro Morata",     pos: "FWD", club: "AC Milan",       nat: "Spain",       price: 8.0 },
  { name: "Ferran Torres",     pos: "FWD", club: "Barcelona",      nat: "Spain",       price: 7.5 },
];

// ─── WC 2026 Schedule ─────────────────────────────────────────────────────────

const WC_GAMEWEEKS = [
  {
    number: 1, name: "Group Stage — Week 1", round: "group", status: "active",
    startDate: new Date("2026-06-11T00:00:00Z"),
    endDate:   new Date("2026-06-17T23:59:59Z"),
    fixtures: [
      { home: "Mexico", away: "USA",         kickoff: new Date("2026-06-11T20:00:00Z") },
      { home: "Brazil", away: "Croatia",     kickoff: new Date("2026-06-12T18:00:00Z") },
      { home: "France", away: "Poland",      kickoff: new Date("2026-06-13T18:00:00Z") },
      { home: "Argentina", away: "Iceland",  kickoff: new Date("2026-06-13T21:00:00Z") },
      { home: "Spain", away: "Morocco",      kickoff: new Date("2026-06-14T18:00:00Z") },
      { home: "England", away: "Serbia",     kickoff: new Date("2026-06-14T21:00:00Z") },
      { home: "Germany", away: "Japan",      kickoff: new Date("2026-06-15T18:00:00Z") },
      { home: "Portugal", away: "South Korea", kickoff: new Date("2026-06-15T21:00:00Z") },
    ],
  },
  {
    number: 2, name: "Group Stage — Week 2", round: "group", status: "upcoming",
    startDate: new Date("2026-06-18T00:00:00Z"),
    endDate:   new Date("2026-06-24T23:59:59Z"),
    fixtures: [
      { home: "USA",    away: "Canada",      kickoff: new Date("2026-06-18T20:00:00Z") },
      { home: "Croatia", away: "Argentina",  kickoff: new Date("2026-06-19T18:00:00Z") },
      { home: "Brazil", away: "Nigeria",     kickoff: new Date("2026-06-19T21:00:00Z") },
      { home: "France", away: "Switzerland", kickoff: new Date("2026-06-20T18:00:00Z") },
      { home: "Morocco", away: "Belgium",    kickoff: new Date("2026-06-21T18:00:00Z") },
      { home: "Spain",  away: "Germany",     kickoff: new Date("2026-06-21T21:00:00Z") },
      { home: "England", away: "Denmark",    kickoff: new Date("2026-06-22T18:00:00Z") },
      { home: "Netherlands", away: "Senegal", kickoff: new Date("2026-06-22T21:00:00Z") },
    ],
  },
  {
    number: 3, name: "Group Stage — Week 3", round: "group", status: "upcoming",
    startDate: new Date("2026-06-25T00:00:00Z"),
    endDate:   new Date("2026-07-02T23:59:59Z"),
    fixtures: [
      { home: "Mexico", away: "Canada",      kickoff: new Date("2026-06-25T20:00:00Z") },
      { home: "Poland", away: "Switzerland", kickoff: new Date("2026-06-26T18:00:00Z") },
      { home: "Argentina", away: "Nigeria",  kickoff: new Date("2026-06-26T21:00:00Z") },
      { home: "Brazil", away: "Croatia",     kickoff: new Date("2026-06-27T18:00:00Z") },
      { home: "Belgium", away: "Spain",      kickoff: new Date("2026-06-28T18:00:00Z") },
      { home: "England", away: "Germany",    kickoff: new Date("2026-06-29T18:00:00Z") },
      { home: "South Korea", away: "Japan",  kickoff: new Date("2026-07-01T18:00:00Z") },
      { home: "Portugal", away: "Senegal",   kickoff: new Date("2026-07-01T21:00:00Z") },
    ],
  },
  {
    number: 4, name: "Round of 16", round: "r16", status: "upcoming",
    startDate: new Date("2026-07-03T00:00:00Z"),
    endDate:   new Date("2026-07-06T23:59:59Z"),
    fixtures: [
      { home: "1A", away: "2B", kickoff: new Date("2026-07-03T18:00:00Z") },
      { home: "1B", away: "2A", kickoff: new Date("2026-07-03T21:00:00Z") },
      { home: "1C", away: "2D", kickoff: new Date("2026-07-04T18:00:00Z") },
      { home: "1D", away: "2C", kickoff: new Date("2026-07-04T21:00:00Z") },
      { home: "1E", away: "2F", kickoff: new Date("2026-07-05T18:00:00Z") },
      { home: "1F", away: "2E", kickoff: new Date("2026-07-05T21:00:00Z") },
      { home: "1G", away: "2H", kickoff: new Date("2026-07-06T18:00:00Z") },
      { home: "1H", away: "2G", kickoff: new Date("2026-07-06T21:00:00Z") },
    ],
  },
  {
    number: 5, name: "Quarter Finals", round: "qf", status: "upcoming",
    startDate: new Date("2026-07-09T00:00:00Z"),
    endDate:   new Date("2026-07-12T23:59:59Z"),
    fixtures: [
      { home: "QF1", away: "QF2", kickoff: new Date("2026-07-09T20:00:00Z") },
      { home: "QF3", away: "QF4", kickoff: new Date("2026-07-10T20:00:00Z") },
      { home: "QF5", away: "QF6", kickoff: new Date("2026-07-11T20:00:00Z") },
      { home: "QF7", away: "QF8", kickoff: new Date("2026-07-12T20:00:00Z") },
    ],
  },
  {
    number: 6, name: "Semi Finals", round: "sf", status: "upcoming",
    startDate: new Date("2026-07-14T00:00:00Z"),
    endDate:   new Date("2026-07-15T23:59:59Z"),
    fixtures: [
      { home: "SF1", away: "SF2", kickoff: new Date("2026-07-14T20:00:00Z") },
      { home: "SF3", away: "SF4", kickoff: new Date("2026-07-15T20:00:00Z") },
    ],
  },
  {
    number: 7, name: "Final", round: "final", status: "upcoming",
    startDate: new Date("2026-07-19T00:00:00Z"),
    endDate:   new Date("2026-07-19T23:59:59Z"),
    fixtures: [
      { home: "TBD", away: "TBD", kickoff: new Date("2026-07-19T20:00:00Z") },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  FIFA World Cup 2026 — Database Seeder");
  console.log("═══════════════════════════════════════════\n");

  // ── 1. Fetch players ────────────────────────────────────────────────────────
  let apiPlayers: ApiPlayer[] = [];
  const seasons = [2026, 2022];

  for (const season of seasons) {
    try {
      console.log(`Trying API-Sports season ${season}…`);
      apiPlayers = await fetchAllPlayers(season);
      if (apiPlayers.length > 0) {
        console.log(`✔ Fetched ${apiPlayers.length} players from API-Sports (season ${season})\n`);
        break;
      }
      console.log(`  → 0 players returned for season ${season}, trying next…\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  → API-Sports error for season ${season}: ${msg}`);
      if (season === seasons[seasons.length - 1]) {
        console.log("  → All seasons failed, using curated player pool\n");
      }
    }
  }

  // ── 2. Prepare player rows ──────────────────────────────────────────────────
  type PlayerRow = {
    externalId?: number;
    name: string;
    position: string;
    club: string;
    clubShortName: string;
    nationality: string | null;
    price: number;
    totalPoints: number;
    goalsScored: number;
    assists: number;
    imageUrl: string | null;
    cachedFromApi: boolean;
    cachedAt: Date;
  };

  const now = new Date();
  let playerRows: PlayerRow[] = [];

  if (apiPlayers.length > 0) {
    console.log("Mapping API players to DB rows…");
    let skipped = 0;
    for (const p of apiPlayers) {
      const stats = p.statistics?.[0];
      if (!stats) { skipped++; continue; }
      const position = POSITION_MAP[stats.games?.position ?? ""];
      if (!position) { skipped++; continue; }

      const nat = p.player.nationality ?? "Unknown";
      playerRows.push({
        externalId: p.player.id,
        name: p.player.name,
        position,
        club: stats.team.name,
        clubShortName: toShortName(stats.team.name),
        nationality: nat,
        price: assignPrice(p.player.name, position, nat),
        totalPoints: 0,
        goalsScored: stats.goals?.total ?? 0,
        assists: stats.goals?.assists ?? 0,
        imageUrl: p.player.photo || null,
        cachedFromApi: true,
        cachedAt: now,
      });
    }
    console.log(`✔ Mapped ${playerRows.length} players (${skipped} skipped — no position)\n`);
  } else {
    console.log("Using curated WC 2026 player pool…");
    playerRows = CURATED_PLAYERS.map(p => ({
      name: p.name,
      position: p.pos,
      club: p.club,
      clubShortName: toShortName(p.club),
      nationality: p.nat,
      price: p.price,
      totalPoints: 0,
      goalsScored: p.goals ?? 0,
      assists: p.assists ?? 0,
      imageUrl: null,
      cachedFromApi: true,
      cachedAt: now,
    }));
    console.log(`✔ Prepared ${playerRows.length} curated players\n`);
  }

  // ── 3. Clear & re-seed players ─────────────────────────────────────────────
  console.log("Clearing existing player data…");
  await db.execute(sql`DELETE FROM team_players`);
  await db.execute(sql`DELETE FROM players`);
  await db.execute(sql`ALTER SEQUENCE players_id_seq RESTART WITH 1`);

  console.log(`Inserting ${playerRows.length} players…`);
  const BATCH = 50;
  for (let i = 0; i < playerRows.length; i += BATCH) {
    await db.insert(playersTable).values(playerRows.slice(i, i + BATCH));
  }
  console.log(`✔ Players seeded\n`);

  // ── 4. Clear & re-seed gameweeks ───────────────────────────────────────────
  console.log("Clearing existing gameweeks & fixtures…");
  await db.execute(sql`DELETE FROM fixtures`);
  await db.execute(sql`DELETE FROM gameweeks`);
  await db.execute(sql`ALTER SEQUENCE gameweeks_id_seq RESTART WITH 1`);
  await db.execute(sql`ALTER SEQUENCE fixtures_id_seq RESTART WITH 1`);

  console.log("Seeding World Cup 2026 gameweeks…");
  for (const gw of WC_GAMEWEEKS) {
    const [inserted] = await db
      .insert(gameweeksTable)
      .values({
        number: gw.number,
        name: gw.name,
        round: gw.round,
        status: gw.status,
        startDate: gw.startDate,
        endDate: gw.endDate,
      })
      .returning({ id: gameweeksTable.id });

    await db.insert(fixturesTable).values(
      gw.fixtures.map(f => ({
        gameweekId: inserted.id,
        homeTeam: f.home,
        awayTeam: f.away,
        kickoff: f.kickoff,
        status: "scheduled" as const,
      }))
    );
    console.log(`  ✔ GW${gw.number}: ${gw.name} (${gw.fixtures.length} fixtures)`);
  }
  console.log();

  // ── 5. Reset team budgets to £100m ─────────────────────────────────────────
  console.log("Resetting all team budgets to £100m…");
  await db.execute(sql`UPDATE teams SET budget = 100, captain_id = NULL, vice_captain_id = NULL`);
  console.log("✔ Team budgets reset\n");

  // ── Summary ─────────────────────────────────────────────────────────────────
  const pResult = await db.execute(sql`SELECT COUNT(*)::int AS count FROM players`) as unknown as { rows: [{ count: number }] };
  const gwResult = await db.execute(sql`SELECT COUNT(*)::int AS count FROM gameweeks`) as unknown as { rows: [{ count: number }] };
  const pCount = pResult.rows[0].count;
  const gwCount = gwResult.rows[0].count;

  console.log("═══════════════════════════════════════════");
  console.log(`  Seed complete!`);
  console.log(`  Players:   ${pCount}`);
  console.log(`  Gameweeks: ${gwCount}`);
  console.log(`  Budget:    £100m per team`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
