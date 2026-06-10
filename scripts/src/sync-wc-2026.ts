/**
 * sync-wc-2026.ts — Fetch WC 2026 players from API-Sports (league=1, season=2026)
 * and upsert into the players table with real photo URLs.
 *
 * Run: pnpm --filter @workspace/scripts run sync-wc-2026
 */

import { db, playersTable } from "@workspace/db";
import { sql, count } from "drizzle-orm";

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1;
const SEASONS = [2026, 2022]; // try 2026 first, fall back to 2022 like the server does

const NATION_CODE: Record<string, string> = {
  "France":"FRA","Brazil":"BRA","Argentina":"ARG","England":"ENG",
  "Spain":"ESP","Portugal":"POR","Germany":"GER","Netherlands":"NED",
  "Belgium":"BEL","Croatia":"CRO","Morocco":"MAR","Italy":"ITA",
  "Uruguay":"URU","Denmark":"DEN","Switzerland":"SUI","Senegal":"SEN",
  "Mexico":"MEX","United States":"USA","USA":"USA","Japan":"JPN",
  "South Korea":"KOR","Korea Republic":"KOR","Australia":"AUS",
  "Poland":"POL","Serbia":"SRB","Ecuador":"ECU","Cameroon":"CMR",
  "Ghana":"GHA","Qatar":"QAT","Iran":"IRN","Saudi Arabia":"KSA",
  "Tunisia":"TUN","Canada":"CAN","Costa Rica":"CRC","Wales":"WAL",
  "Colombia":"COL","Peru":"PER","Chile":"CHI","Paraguay":"PAR",
  "Nigeria":"NGA","Ivory Coast":"CIV","Egypt":"EGY","Algeria":"ALG",
  "Burkina Faso":"BFA","DR Congo":"COD","Iraq":"IRQ","Jordan":"JOR",
  "Norway":"NOR","Austria":"AUT","Turkey":"TUR","Greece":"GRE",
  "Scotland":"SCO","Sweden":"SWE","Ukraine":"UKR","Slovakia":"SVK",
  "Hungary":"HUN","Romania":"ROU","Ireland":"IRL","Iceland":"ISL",
  "New Zealand":"NZL","Panama":"PAN","Honduras":"HON","Bolivia":"BOL",
  "Venezuela":"VEN","Indonesia":"IDN","Uzbekistan":"UZB",
};

function toCode(nation: string): string {
  return NATION_CODE[nation] ?? (nation.replace(/[^A-Z]/g,"").slice(0,3) || nation.slice(0,3).toUpperCase());
}

const TIER1 = new Set(["France","Brazil","Argentina","England","Spain","Portugal","Germany","Netherlands","Belgium"]);
const TIER2 = new Set(["Croatia","Morocco","Italy","Uruguay","Denmark","Switzerland","Senegal","Mexico","United States","USA","Japan","South Korea","Korea Republic","Australia","Poland","Serbia","Colombia","Norway"]);

type Pos = "GK"|"DEF"|"MID"|"FWD";
const PRICE_RANGES: Record<Pos,{t1:[number,number];t2:[number,number];t3:[number,number]}> = {
  GK:  {t1:[5.0,6.0],t2:[4.5,5.5],t3:[4.0,5.0]},
  DEF: {t1:[5.5,7.5],t2:[4.5,6.5],t3:[4.0,5.5]},
  MID: {t1:[6.5,9.5],t2:[5.5,8.0],t3:[5.0,6.5]},
  FWD: {t1:[8.0,12.0],t2:[6.5,9.5],t3:[6.0,8.0]},
};
const STAR: Record<string,number> = {
  "Kylian Mbappé":13.5,"Erling Haaland":14.0,"Vinicius Junior":13.0,
  "Vinícius Júnior":13.0,"Jude Bellingham":11.5,"Lionel Messi":12.5,
  "Cristiano Ronaldo":10.0,"Lamine Yamal":11.0,"Bukayo Saka":10.5,
  "Phil Foden":10.0,"Kevin De Bruyne":10.5,"Pedri":9.5,"Rodri":9.0,
  "Florian Wirtz":9.5,"Jamal Musiala":9.0,"Julián Álvarez":9.0,
  "Lautaro Martínez":10.0,"Raphinha":9.5,"Jonathan David":9.5,
  "Darwin Núñez":9.0,"Harry Kane":11.0,"Son Heung-min":9.5,"Mohamed Salah":11.5,
};
function assignPrice(name: string, pos: Pos, nation: string): number {
  if (STAR[name] !== undefined) return STAR[name];
  const r = PRICE_RANGES[pos];
  const [lo,hi] = TIER1.has(nation) ? r.t1 : TIER2.has(nation) ? r.t2 : r.t3;
  return parseFloat((lo + Math.random()*(hi-lo)).toFixed(1));
}

const POS_MAP: Record<string,Pos> = {
  Goalkeeper:"GK", Defender:"DEF", Midfielder:"MID", Attacker:"FWD",
};

type ApiPlayer = {
  player: { id:number; name:string; photo:string };
  statistics: Array<{ team:{ id:number; name:string }; games:{ position:string|null } }>;
};

async function fetchPage(season: number, page: number): Promise<{ players: ApiPlayer[]; totalPages: number }> {
  const key = process.env.API_SPORTS_KEY;
  if (!key) throw new Error("API_SPORTS_KEY not set");
  const url = `${API_BASE}/players?league=${WC_LEAGUE_ID}&season=${season}&page=${page}`;
  console.log(`  → GET ${url}`);
  const res = await fetch(url, { headers: { "x-apisports-key": key } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as {
    response: ApiPlayer[];
    paging: { current: number; total: number };
    errors: unknown;
  };
  if (json.errors && typeof json.errors === "object" && Object.keys(json.errors as object).length > 0) {
    throw new Error(`API errors: ${JSON.stringify(json.errors)}`);
  }
  return { players: json.response ?? [], totalPages: json.paging?.total ?? 1 };
}

async function main() {
  const key = process.env.API_SPORTS_KEY;
  if (!key) { console.error("❌  API_SPORTS_KEY not set"); process.exit(1); }

  // 1. Clear existing players
  const [{ before }] = await db.select({ before: count() }).from(playersTable);
  console.log(`\n🗑  Clearing ${before} existing players…`);
  await db.execute(sql`TRUNCATE players RESTART IDENTITY CASCADE`);

  // 2. Fetch from API-Sports — try 2026 first, fall back to 2022
  let all: ApiPlayer[] = [];
  let usedSeason = 0;

  for (const season of SEASONS) {
    try {
      console.log(`\n📡 Fetching WC ${season} players (league=${WC_LEAGUE_ID})…`);
      const seasonPlayers: ApiPlayer[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        if (page > 1) await new Promise(r => setTimeout(r, 350));
        const result = await fetchPage(season, page);
        seasonPlayers.push(...result.players);
        totalPages = result.totalPages;
        console.log(`  Page ${page}/${totalPages} — ${result.players.length} players`);
        page++;
      } while (page <= totalPages);

      if (seasonPlayers.length === 0) {
        console.log(`  ⚠ No players returned for ${season}, trying next season…`);
        continue;
      }

      all = seasonPlayers;
      usedSeason = season;
      console.log(`\n✅ Fetched ${all.length} players from season ${season}`);
      break;
    } catch (err) {
      console.warn(`  ⚠ Season ${season} failed:`, err);
    }
  }

  if (all.length === 0) {
    console.log("\n⚠️  Zero players returned from all seasons — data may not be available yet.");
    process.exit(0);
  }

  // 3. Insert into DB with photo URL constructed from API-Sports player ID
  let inserted = 0, skipped = 0;
  const nationsSeen = new Set<string>();
  const now = new Date();

  for (const entry of all) {
    const stat = entry.statistics?.[0];
    if (!stat) { skipped++; continue; }

    const rawPos = stat.games?.position ?? "";
    const pos = POS_MAP[rawPos];
    if (!pos) { skipped++; continue; }

    const nationName = stat.team.name;
    const nationCode = toCode(nationName);
    nationsSeen.add(nationName);

    try {
      await db.insert(playersTable).values({
        externalId: entry.player.id,
        name: entry.player.name,
        position: pos,
        club: nationName,
        clubShortName: nationCode,
        nationality: nationName,
        price: assignPrice(entry.player.name, pos, nationName),
        totalPoints: 0,
        imageUrl: entry.player.id
          ? `https://media.api-sports.io/football/players/${entry.player.id}.png`
          : (entry.player.photo || null),
        cachedFromApi: true,
        cachedAt: now,
      }).onConflictDoNothing();
      inserted++;
    } catch (err) {
      console.warn(`  ⚠ Failed to insert ${entry.player.name}:`, err);
      skipped++;
    }
  }

  console.log(`\n🎉 Done! (season ${usedSeason})`);
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Skipped  : ${skipped}`);
  console.log(`   Nations  : ${nationsSeen.size}`);
  console.log(`   Nations  : ${[...nationsSeen].sort().join(", ")}`);

  process.exit(0);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
