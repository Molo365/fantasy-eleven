import { db, playersTable } from "@workspace/db";
import { count } from "drizzle-orm";
import { logger } from "./logger";

const API_BASE = "https://v3.football.api-sports.io";
const WORLD_CUP_LEAGUE_ID = 1; // FIFA World Cup
const WORLD_CUP_SEASON = 2022; // Most recent WC on free plan (2022 Qatar)

type ApiSportsPlayer = {
  player: {
    id: number;
    name: string;
    nationality: string;
    photo: string;
  };
  statistics: Array<{
    team: {
      id: number;
      name: string;
    };
    games: {
      position: string;
    };
    goals: {
      total: number | null;
      assists: number | null;
    };
  }>;
};

const POSITION_MAP: Record<string, string> = {
  Goalkeeper: "GK",
  Defender: "DEF",
  Midfielder: "MID",
  Attacker: "FWD",
};

function priceByPosition(pos: string): number {
  const bases: Record<string, number> = { GK: 5.0, DEF: 5.5, MID: 6.0, FWD: 7.0 };
  const spreads: Record<string, number> = { GK: 2, DEF: 3, MID: 5, FWD: 6 };
  return parseFloat(((bases[pos] ?? 5.0) + Math.random() * (spreads[pos] ?? 2)).toFixed(1));
}

function shortName(teamName: string): string {
  const words = teamName.trim().replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return teamName.slice(0, 3).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  // For 2-word names return first 3 letters of each word's initials sensibly
  return words.map(w => w[0]).join("").toUpperCase().slice(0, 3);
}

async function apiFetch(path: string): Promise<unknown> {
  const key = process.env.API_SPORTS_KEY;
  if (!key) throw new Error("API_SPORTS_KEY not set");

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": key },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API-Sports HTTP ${res.status}: ${body}`);
  }

  const json = await res.json() as {
    response: unknown;
    paging: { current: number; total: number };
    errors: unknown;
  };

  const errors = json.errors;
  if (errors && typeof errors === "object" && Object.keys(errors).length > 0) {
    throw new Error(`API-Sports error: ${JSON.stringify(errors)}`);
  }

  return json;
}

async function fetchPlayersPage(page: number): Promise<{ players: ApiSportsPlayer[]; totalPages: number }> {
  const json = await apiFetch(
    `/players?league=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}&page=${page}`
  ) as { response: ApiSportsPlayer[]; paging: { current: number; total: number } };

  return {
    players: json.response ?? [],
    totalPages: json.paging?.total ?? 1,
  };
}

export async function syncWorldCupPlayers(): Promise<{ inserted: number; skipped: number }> {
  logger.info({ league: WORLD_CUP_LEAGUE_ID, season: WORLD_CUP_SEASON }, "Starting World Cup player sync");

  let allPlayers: ApiSportsPlayer[] = [];

  try {
    const first = await fetchPlayersPage(1);
    allPlayers = [...first.players];

    for (let p = 2; p <= first.totalPages; p++) {
      const page = await fetchPlayersPage(p);
      allPlayers = [...allPlayers, ...page.players];
      await new Promise(r => setTimeout(r, 150)); // respect rate limit
    }

    logger.info({ count: allPlayers.length }, "Fetched players from API-Sports");
  } catch (err) {
    logger.warn({ err }, "API-Sports fetch failed — falling back to curated squad");
    return seedFallbackPlayers();
  }

  if (allPlayers.length === 0) {
    logger.warn("API-Sports returned 0 players — falling back to curated squad");
    return seedFallbackPlayers();
  }

  return upsertPlayers(allPlayers);
}

async function upsertPlayers(allPlayers: ApiSportsPlayer[]): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  const now = new Date();

  for (const p of allPlayers) {
    const stats = p.statistics?.[0];
    if (!stats) { skipped++; continue; }

    const rawPos = stats.games?.position ?? "";
    const position = POSITION_MAP[rawPos];
    if (!position) { skipped++; continue; }

    const teamName = stats.team?.name ?? "Unknown";
    const goals = stats.goals?.total ?? 0;
    const assists = stats.goals?.assists ?? 0;

    await db
      .insert(playersTable)
      .values({
        externalId: p.player.id,
        name: p.player.name,
        position,
        club: teamName,
        clubShortName: shortName(teamName),
        nationality: p.player.nationality ?? null,
        totalPoints: goals * 4 + assists * 3,
        price: priceByPosition(position),
        goalsScored: goals,
        assists,
        imageUrl: p.player.photo || null,
        cachedFromApi: true,
        cachedAt: now,
      })
      .onConflictDoNothing();

    inserted++;
  }

  logger.info({ inserted, skipped }, "World Cup player sync complete");
  return { inserted, skipped };
}

export async function getPlayerCount(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(playersTable);
  return row?.value ?? 0;
}

export async function ensurePlayersSeeded(): Promise<void> {
  const n = await getPlayerCount();
  if (n === 0) {
    logger.info("Players table empty — seeding from API-Sports");
    await syncWorldCupPlayers();
  }
}

async function seedFallbackPlayers(): Promise<{ inserted: number; skipped: number }> {
  const now = new Date();
  const fallback = [
    // Goalkeepers
    { name: "Yassine Bounou", pos: "GK", club: "Al-Hilal", nat: "Morocco", price: 5.5 },
    { name: "Alisson Becker", pos: "GK", club: "Liverpool", nat: "Brazil", price: 6.0 },
    { name: "Ederson", pos: "GK", club: "Man City", nat: "Brazil", price: 5.5 },
    { name: "Manuel Neuer", pos: "GK", club: "Bayern Munich", nat: "Germany", price: 5.0 },
    { name: "Thibaut Courtois", pos: "GK", club: "Real Madrid", nat: "Belgium", price: 6.0 },
    // Defenders
    { name: "Virgil van Dijk", pos: "DEF", club: "Liverpool", nat: "Netherlands", price: 7.0 },
    { name: "Achraf Hakimi", pos: "DEF", club: "PSG", nat: "Morocco", price: 7.5 },
    { name: "Ruben Dias", pos: "DEF", club: "Man City", nat: "Portugal", price: 6.5 },
    { name: "Antonio Rudiger", pos: "DEF", club: "Real Madrid", nat: "Germany", price: 6.0 },
    { name: "Theo Hernandez", pos: "DEF", club: "AC Milan", nat: "France", price: 7.5 },
    { name: "Joao Cancelo", pos: "DEF", club: "Barcelona", nat: "Portugal", price: 7.0 },
    { name: "Eder Militao", pos: "DEF", club: "Real Madrid", nat: "Brazil", price: 6.0 },
    { name: "Jules Kounde", pos: "DEF", club: "Barcelona", nat: "France", price: 6.5 },
    { name: "Alphonso Davies", pos: "DEF", club: "Bayern Munich", nat: "Canada", price: 7.0 },
    { name: "Kieran Trippier", pos: "DEF", club: "Newcastle", nat: "England", price: 6.5 },
    { name: "Reece James", pos: "DEF", club: "Chelsea", nat: "England", price: 6.5 },
    { name: "Ben White", pos: "DEF", club: "Arsenal", nat: "England", price: 6.0 },
    { name: "Raphael Varane", pos: "DEF", club: "Man United", nat: "France", price: 6.5 },
    { name: "Dayot Upamecano", pos: "DEF", club: "Bayern Munich", nat: "France", price: 6.0 },
    { name: "Lisandro Martinez", pos: "DEF", club: "Man United", nat: "Argentina", price: 6.0 },
    // Midfielders
    { name: "Jude Bellingham", pos: "MID", club: "Real Madrid", nat: "England", price: 11.0 },
    { name: "Pedri", pos: "MID", club: "Barcelona", nat: "Spain", price: 9.5 },
    { name: "Kevin De Bruyne", pos: "MID", club: "Man City", nat: "Belgium", price: 10.5 },
    { name: "Luka Modric", pos: "MID", club: "Real Madrid", nat: "Croatia", price: 8.5 },
    { name: "Rodri", pos: "MID", club: "Man City", nat: "Spain", price: 9.0 },
    { name: "Gavi", pos: "MID", club: "Barcelona", nat: "Spain", price: 8.5 },
    { name: "Eduardo Camavinga", pos: "MID", club: "Real Madrid", nat: "France", price: 8.0 },
    { name: "Declan Rice", pos: "MID", club: "Arsenal", nat: "England", price: 8.5 },
    { name: "Frenkie de Jong", pos: "MID", club: "Barcelona", nat: "Netherlands", price: 7.5 },
    { name: "Bruno Fernandes", pos: "MID", club: "Man United", nat: "Portugal", price: 9.0 },
    { name: "Phil Foden", pos: "MID", club: "Man City", nat: "England", price: 9.5 },
    { name: "Martin Odegaard", pos: "MID", club: "Arsenal", nat: "Norway", price: 8.5 },
    { name: "Federico Valverde", pos: "MID", club: "Real Madrid", nat: "Uruguay", price: 8.0 },
    { name: "Aurelien Tchouameni", pos: "MID", club: "Real Madrid", nat: "France", price: 7.5 },
    { name: "Ilkay Gundogan", pos: "MID", club: "Barcelona", nat: "Germany", price: 7.5 },
    // Forwards
    { name: "Kylian Mbappe", pos: "FWD", club: "Real Madrid", nat: "France", price: 13.5 },
    { name: "Erling Haaland", pos: "FWD", club: "Man City", nat: "Norway", price: 14.0 },
    { name: "Vinicius Junior", pos: "FWD", club: "Real Madrid", nat: "Brazil", price: 13.0 },
    { name: "Lionel Messi", pos: "FWD", club: "Inter Miami", nat: "Argentina", price: 12.5 },
    { name: "Cristiano Ronaldo", pos: "FWD", club: "Al-Nassr", nat: "Portugal", price: 10.0 },
    { name: "Lamine Yamal", pos: "FWD", club: "Barcelona", nat: "Spain", price: 11.0 },
    { name: "Bukayo Saka", pos: "FWD", club: "Arsenal", nat: "England", price: 10.5 },
    { name: "Rafael Leao", pos: "FWD", club: "AC Milan", nat: "Portugal", price: 9.5 },
    { name: "Antoine Griezmann", pos: "FWD", club: "Atletico Madrid", nat: "France", price: 9.5 },
    { name: "Marcus Rashford", pos: "FWD", club: "Man United", nat: "England", price: 9.0 },
    { name: "Gabriel Martinelli", pos: "FWD", club: "Arsenal", nat: "Brazil", price: 8.5 },
    { name: "Rodrygo", pos: "FWD", club: "Real Madrid", nat: "Brazil", price: 9.0 },
    { name: "Ferran Torres", pos: "FWD", club: "Barcelona", nat: "Spain", price: 8.0 },
    { name: "Richarlison", pos: "FWD", club: "Tottenham", nat: "Brazil", price: 8.5 },
    { name: "Cody Gakpo", pos: "FWD", club: "Liverpool", nat: "Netherlands", price: 8.5 },
  ];

  let inserted = 0;
  for (const p of fallback) {
    await db.insert(playersTable).values({
      name: p.name,
      position: p.pos,
      club: p.club,
      clubShortName: shortName(p.club),
      nationality: p.nat,
      price: p.price,
      totalPoints: 0,
      cachedFromApi: true,
      cachedAt: now,
    }).onConflictDoNothing();
    inserted++;
  }
  logger.info({ inserted }, "Fallback World Cup squad seeded");
  return { inserted, skipped: 0 };
}
