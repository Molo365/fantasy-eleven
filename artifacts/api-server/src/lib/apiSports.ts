import { db, playersTable } from "@workspace/db";
import { count } from "drizzle-orm";
import { logger } from "./logger";

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1; // FIFA World Cup
// Free plan allows 2022-2024; try 2026 first in case tournament data is live
const SEASONS_TO_TRY = [2026, 2022];

// ─── Pricing ──────────────────────────────────────────────────────────────────

const TIER1_NATIONS = new Set([
  "France", "Brazil", "Argentina", "England", "Spain",
  "Portugal", "Germany", "Netherlands", "Belgium",
]);
const TIER2_NATIONS = new Set([
  "Croatia", "Morocco", "Italy", "Uruguay", "Denmark",
  "Switzerland", "Senegal", "Mexico", "USA", "Japan",
  "South Korea", "Australia", "Poland", "Serbia",
]);

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
};

type Pos = "GK" | "DEF" | "MID" | "FWD";

const PRICE_RANGES: Record<Pos, { t1: [number, number]; t2: [number, number]; t3: [number, number] }> = {
  GK:  { t1: [5.0, 6.0], t2: [4.5, 5.5], t3: [4.0, 5.0] },
  DEF: { t1: [5.5, 7.0], t2: [4.5, 6.0], t3: [4.0, 5.5] },
  MID: { t1: [6.5, 9.0], t2: [5.5, 7.5], t3: [5.0, 6.5] },
  FWD: { t1: [8.0, 12.0], t2: [6.5, 9.0], t3: [6.0, 7.5] },
};

function assignPrice(name: string, pos: Pos, nat: string): number {
  if (STAR_PRICES[name]) return STAR_PRICES[name];
  const tiers = PRICE_RANGES[pos];
  const range = TIER1_NATIONS.has(nat) ? tiers.t1
    : TIER2_NATIONS.has(nat) ? tiers.t2
    : tiers.t3;
  return parseFloat((range[0] + Math.random() * (range[1] - range[0])).toFixed(1));
}

// ─── API helpers ─────────────────────────────────────────────────────────────

type ApiPlayer = {
  player: { id: number; name: string; nationality: string; photo: string };
  statistics: Array<{
    team: { id: number; name: string };
    games: { position: string };
    goals: { total: number | null; assists: number | null };
  }>;
};

const POSITION_MAP: Record<string, Pos> = {
  Goalkeeper: "GK", Defender: "DEF", Midfielder: "MID", Attacker: "FWD",
};

const SHORT_OVERRIDES: Record<string, string> = {
  "Real Madrid": "RMA", "Barcelona": "BAR", "Man City": "MCI",
  "Manchester City": "MCI", "Liverpool": "LIV", "Arsenal": "ARS",
  "Chelsea": "CHE", "Man United": "MUN", "Manchester United": "MUN",
  "Bayern Munich": "BAY", "AC Milan": "ACM", "Inter Milan": "INT",
  "Atletico Madrid": "ATM", "PSG": "PSG", "Paris Saint-Germain": "PSG",
  "Tottenham": "TOT", "Borussia Dortmund": "BVB",
  "Al-Nassr": "ANS", "Al-Hilal": "AHI", "Inter Miami": "MIA",
  "Newcastle": "NEW", "Aston Villa": "AVL",
};

function toShortName(club: string): string {
  if (SHORT_OVERRIDES[club]) return SHORT_OVERRIDES[club];
  const words = club.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return club.slice(0, 3).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map(w => w[0]).join("").toUpperCase().slice(0, 3);
}

async function apiFetch(path: string): Promise<unknown> {
  const key = process.env.API_SPORTS_KEY;
  if (!key) throw new Error("API_SPORTS_KEY not set");
  const res = await fetch(`${API_BASE}${path}`, { headers: { "x-apisports-key": key } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as { response: unknown; paging: { current: number; total: number }; errors: unknown };
  const errs = json.errors;
  if (errs && typeof errs === "object" && Object.keys(errs).length > 0) {
    throw new Error(JSON.stringify(errs));
  }
  return json;
}

async function fetchSeason(season: number): Promise<ApiPlayer[]> {
  const first = await apiFetch(`/players?league=${WC_LEAGUE_ID}&season=${season}&page=1`) as {
    response: ApiPlayer[]; paging: { current: number; total: number };
  };
  const all = [...(first.response ?? [])];
  for (let p = 2; p <= (first.paging?.total ?? 1); p++) {
    const page = await apiFetch(`/players?league=${WC_LEAGUE_ID}&season=${season}&page=${p}`) as { response: ApiPlayer[] };
    all.push(...(page.response ?? []));
    await new Promise(r => setTimeout(r, 150));
  }
  return all;
}

async function insertPlayers(apiPlayers: ApiPlayer[]): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0, skipped = 0;
  const now = new Date();
  for (const p of apiPlayers) {
    const stats = p.statistics?.[0];
    if (!stats) { skipped++; continue; }
    const pos = POSITION_MAP[stats.games?.position ?? ""];
    if (!pos) { skipped++; continue; }
    const nat = p.player.nationality ?? "Unknown";
    await db.insert(playersTable).values({
      externalId: p.player.id,
      name: p.player.name,
      position: pos,
      club: stats.team.name,
      clubShortName: toShortName(stats.team.name),
      nationality: nat,
      price: assignPrice(p.player.name, pos, nat),
      totalPoints: 0,
      goalsScored: stats.goals?.total ?? 0,
      assists: stats.goals?.assists ?? 0,
      imageUrl: p.player.photo || null,
      cachedFromApi: true,
      cachedAt: now,
    }).onConflictDoNothing();
    inserted++;
  }
  return { inserted, skipped };
}

export async function syncWorldCupPlayers(): Promise<{ inserted: number; skipped: number }> {
  for (const season of SEASONS_TO_TRY) {
    try {
      logger.info({ season }, "Fetching WC players from API-Sports");
      const players = await fetchSeason(season);
      if (players.length === 0) continue;
      logger.info({ count: players.length, season }, "Fetched players");
      const result = await insertPlayers(players);
      logger.info(result, "WC player sync complete");
      return result;
    } catch (err) {
      logger.warn({ err, season }, "API-Sports fetch failed");
    }
  }
  logger.warn("All API-Sports seasons failed — seeding curated WC squad");
  return seedFallback();
}

export async function getPlayerCount(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(playersTable);
  return row?.value ?? 0;
}

export async function ensurePlayersSeeded(): Promise<void> {
  if ((await getPlayerCount()) === 0) {
    logger.info("Players table empty — seeding from API-Sports");
    await syncWorldCupPlayers();
  }
}

// ─── Curated fallback ─────────────────────────────────────────────────────────

async function seedFallback(): Promise<{ inserted: number; skipped: number }> {
  const now = new Date();
  const fallback = [
    { name: "Alisson Becker",     pos: "GK",  club: "Liverpool",        nat: "Brazil",      price: 6.0 },
    { name: "Ederson",            pos: "GK",  club: "Man City",         nat: "Brazil",      price: 5.5 },
    { name: "Thibaut Courtois",   pos: "GK",  club: "Real Madrid",      nat: "Belgium",     price: 6.0 },
    { name: "Manuel Neuer",       pos: "GK",  club: "Bayern Munich",    nat: "Germany",     price: 5.0 },
    { name: "Yassine Bounou",     pos: "GK",  club: "Al-Hilal",         nat: "Morocco",     price: 5.5 },
    { name: "Virgil van Dijk",    pos: "DEF", club: "Liverpool",        nat: "Netherlands", price: 7.0 },
    { name: "Achraf Hakimi",      pos: "DEF", club: "PSG",              nat: "Morocco",     price: 7.5 },
    { name: "Ruben Dias",         pos: "DEF", club: "Man City",         nat: "Portugal",    price: 6.5 },
    { name: "Antonio Rudiger",    pos: "DEF", club: "Real Madrid",      nat: "Germany",     price: 6.0 },
    { name: "Theo Hernandez",     pos: "DEF", club: "AC Milan",         nat: "France",      price: 7.5 },
    { name: "Alphonso Davies",    pos: "DEF", club: "Bayern Munich",    nat: "Canada",      price: 7.0 },
    { name: "Trent Alexander-Arnold", pos: "DEF", club: "Real Madrid",  nat: "England",     price: 7.0 },
    { name: "Jules Kounde",       pos: "DEF", club: "Barcelona",        nat: "France",      price: 6.5 },
    { name: "Lisandro Martinez",  pos: "DEF", club: "Man United",       nat: "Argentina",   price: 6.5 },
    { name: "Reece James",        pos: "DEF", club: "Chelsea",          nat: "England",     price: 6.5 },
    { name: "Jude Bellingham",    pos: "MID", club: "Real Madrid",      nat: "England",     price: 11.5 },
    { name: "Kevin De Bruyne",    pos: "MID", club: "Man City",         nat: "Belgium",     price: 10.5 },
    { name: "Pedri",              pos: "MID", club: "Barcelona",        nat: "Spain",       price: 9.5 },
    { name: "Rodri",              pos: "MID", club: "Man City",         nat: "Spain",       price: 9.0 },
    { name: "Phil Foden",         pos: "MID", club: "Man City",         nat: "England",     price: 10.0 },
    { name: "Bruno Fernandes",    pos: "MID", club: "Man United",       nat: "Portugal",    price: 9.0 },
    { name: "Declan Rice",        pos: "MID", club: "Arsenal",          nat: "England",     price: 8.5 },
    { name: "Gavi",               pos: "MID", club: "Barcelona",        nat: "Spain",       price: 8.5 },
    { name: "Jamal Musiala",      pos: "MID", club: "Bayern Munich",    nat: "Germany",     price: 9.0 },
    { name: "Florian Wirtz",      pos: "MID", club: "Bayer Leverkusen", nat: "Germany",     price: 8.5 },
    { name: "Kylian Mbappe",      pos: "FWD", club: "Real Madrid",      nat: "France",      price: 13.5 },
    { name: "Erling Haaland",     pos: "FWD", club: "Man City",         nat: "Norway",      price: 14.0 },
    { name: "Vinicius Junior",    pos: "FWD", club: "Real Madrid",      nat: "Brazil",      price: 13.0 },
    { name: "Lionel Messi",       pos: "FWD", club: "Inter Miami",      nat: "Argentina",   price: 12.5 },
    { name: "Cristiano Ronaldo",  pos: "FWD", club: "Al-Nassr",         nat: "Portugal",    price: 10.0 },
    { name: "Lamine Yamal",       pos: "FWD", club: "Barcelona",        nat: "Spain",       price: 11.0 },
    { name: "Bukayo Saka",        pos: "FWD", club: "Arsenal",          nat: "England",     price: 10.5 },
    { name: "Raphinha",           pos: "FWD", club: "Barcelona",        nat: "Brazil",      price: 9.5 },
    { name: "Julian Alvarez",     pos: "FWD", club: "Atletico Madrid",  nat: "Argentina",   price: 9.0 },
    { name: "Cody Gakpo",         pos: "FWD", club: "Liverpool",        nat: "Netherlands", price: 8.5 },
  ] as const;

  let inserted = 0;
  for (const p of fallback) {
    await db.insert(playersTable).values({
      name: p.name, position: p.pos, club: p.club,
      clubShortName: toShortName(p.club), nationality: p.nat,
      price: p.price, totalPoints: 0,
      cachedFromApi: true, cachedAt: now,
    }).onConflictDoNothing();
    inserted++;
  }
  logger.info({ inserted }, "Fallback WC squad seeded");
  return { inserted, skipped: 0 };
}
