/**
 * seed-espn-players.ts
 * Fetches World Cup 2026 squads from ESPN's free public API (no key required).
 * Falls back to curated data for the 6 nations not in ESPN's coverage.
 *
 * Run: pnpm --filter @workspace/scripts run seed-espn-players
 */

import { db, playersTable, teamsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

// ─── ESPN WC 2026 team map (26 of 32 nations available) ────────────────────

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

/** ESPN team id → { displayName, code } */
const ESPN_TEAMS: Array<{ id: number; name: string; code: string }> = [
  { id: 202,  name: "Argentina",    code: "ARG" },
  { id: 628,  name: "Australia",    code: "AUS" },
  { id: 459,  name: "Belgium",      code: "BEL" },
  { id: 205,  name: "Brazil",       code: "BRA" },
  { id: 206,  name: "Canada",       code: "CAN" },
  { id: 477,  name: "Croatia",      code: "CRO" },
  { id: 209,  name: "Ecuador",      code: "ECU" },
  { id: 448,  name: "England",      code: "ENG" },
  { id: 478,  name: "France",       code: "FRA" },
  { id: 481,  name: "Germany",      code: "GER" },
  { id: 4469, name: "Ghana",        code: "GHA" },
  { id: 469,  name: "Iran",         code: "IRN" },
  { id: 627,  name: "Japan",        code: "JPN" },
  { id: 203,  name: "Mexico",       code: "MEX" },
  { id: 2869, name: "Morocco",      code: "MAR" },
  { id: 449,  name: "Netherlands",  code: "NED" },
  { id: 482,  name: "Portugal",     code: "POR" },
  { id: 4398, name: "Qatar",        code: "QAT" },
  { id: 655,  name: "Saudi Arabia", code: "KSA" },
  { id: 654,  name: "Senegal",      code: "SEN" },
  { id: 451,  name: "South Korea",  code: "KOR" },
  { id: 164,  name: "Spain",        code: "ESP" },
  { id: 475,  name: "Switzerland",  code: "SUI" },
  { id: 659,  name: "Tunisia",      code: "TUN" },
  { id: 660,  name: "USA",          code: "USA" },
  { id: 212,  name: "Uruguay",      code: "URU" },
];

// ─── Pricing ────────────────────────────────────────────────────────────────

const TIER1 = new Set(["Argentina","Brazil","England","France","Germany","Netherlands","Portugal","Spain","Belgium"]);
const TIER2 = new Set(["Australia","Canada","Croatia","Denmark","Ecuador","Japan","Mexico","Morocco","Poland","Saudi Arabia","Senegal","Serbia","South Korea","Switzerland","Uruguay","USA"]);

const STAR: Record<string, number> = {
  "Lionel Messi": 12.5, "Julián Álvarez": 9.5, "Lautaro Martínez": 9.0, "Emiliano Martínez": 6.0,
  "Vinicius Junior": 13.0, "Raphinha": 9.5, "Rodrygo": 9.0, "Alisson Becker": 6.0, "Ederson": 5.5,
  "Kylian Mbappé": 13.5, "Antoine Griezmann": 9.0, "Ousmane Dembélé": 8.5, "Hugo Lloris": 5.5, "Mike Maignan": 5.5,
  "Harry Kane": 11.0, "Bukayo Saka": 10.5, "Jude Bellingham": 11.5, "Phil Foden": 10.0, "Declan Rice": 8.5,
  "Jordan Pickford": 5.0,
  "Álvaro Morata": 8.0, "Lamine Yamal": 11.0, "Pedri": 9.5, "Rodri": 9.0, "Unai Simón": 5.0,
  "Manuel Neuer": 5.0, "Jamal Musiala": 9.0, "Florian Wirtz": 9.0,
  "Cristiano Ronaldo": 9.5, "Bruno Fernandes": 9.0, "Rafael Leão": 9.5, "Diogo Costa": 5.0,
  "Virgil van Dijk": 7.0, "Cody Gakpo": 8.5, "Xavi Simons": 8.5, "Bart Verbruggen": 5.0,
  "Thibaut Courtois": 6.0, "Kevin De Bruyne": 10.5, "Romelu Lukaku": 8.5,
  "Luka Modrić": 8.5, "Joško Gvardiol": 7.0, "Andrej Kramarić": 8.0, "Dominik Livaković": 5.0,
  "Christian Pulisic": 8.5, "Folarin Balogun": 7.5, "Matt Turner": 4.5,
  "Kaoru Mitoma": 8.0, "Takefusa Kubo": 7.5,
  "Achraf Hakimi": 8.0, "Hakim Ziyech": 7.5, "Youssef En-Nesyri": 8.0,
  "Sadio Mané": 8.5, "Nicolas Jackson": 8.0, "Édouard Mendy": 5.0,
  "Alphonso Davies": 7.5, "Jonathan David": 9.0,
  "Moisés Caicedo": 8.0, "Enner Valencia": 7.5,
  "Federico Valverde": 8.5, "Darwin Núñez": 9.0,
  "Granit Xhaka": 7.0, "Breel Embolo": 7.5,
  "Robert Lewandowski": 9.5,
  "Rasmus Højlund": 8.5, "Christian Eriksen": 7.5,
  "Aleksandar Mitrović": 9.0, "Dušan Vlahović": 8.5,
  "Son Heung-min": 9.5, "Kim Min-jae": 7.0,
  "Mohammed Kudus": 7.5, "Thomas Partey": 7.0,
  "André Onana": 5.5, "Bryan Mbeumo": 7.5, "Vincent Aboubakar": 7.0,
  "Mehdi Taremi": 7.5, "Sardar Azmoun": 7.0,
  "Keylor Navas": 5.0, "Joel Campbell": 6.5,
  "Guillermo Ochoa": 4.5, "Santiago Giménez": 8.0, "Raúl Jiménez": 7.5,
  "Salem Al-Dawsari": 6.5,
  "Robert Lewandowski": 9.5, "Piotr Zieliński": 7.5,
};

type Pos = "GK" | "DEF" | "MID" | "FWD";

const RANGES: Record<Pos, { t1: [number,number]; t2: [number,number]; t3: [number,number] }> = {
  GK:  { t1:[5.0,6.0], t2:[4.5,5.5], t3:[4.0,5.0] },
  DEF: { t1:[5.5,7.5], t2:[4.5,6.5], t3:[4.0,5.5] },
  MID: { t1:[6.5,9.5], t2:[5.5,8.0], t3:[5.0,6.5] },
  FWD: { t1:[8.0,12.0], t2:[6.5,9.5], t3:[6.0,8.0] },
};

function assignPrice(name: string, pos: Pos, nation: string): number {
  if (STAR[name] !== undefined) return STAR[name];
  const [lo, hi] = TIER1.has(nation) ? RANGES[pos].t1 : TIER2.has(nation) ? RANGES[pos].t2 : RANGES[pos].t3;
  return parseFloat((lo + Math.random() * (hi - lo)).toFixed(1));
}

// ESPN position abbreviation → our schema
const POS_MAP: Record<string, Pos> = {
  G: "GK", GK: "GK",
  D: "DEF", DF: "DEF",
  M: "MID", MF: "MID",
  F: "FWD", FW: "FWD", A: "FWD",
};

// ─── ESPN fetch helpers ──────────────────────────────────────────────────────

interface EspnAthlete {
  fullName: string;
  displayName: string;
  position?: { abbreviation?: string; name?: string };
  headshot?: { href?: string };
}

interface EspnRosterResponse {
  athletes: EspnAthlete[];
  team: { displayName: string };
}

async function fetchRoster(teamId: number): Promise<EspnRosterResponse | null> {
  try {
    const url = `${ESPN_BASE}/teams/${teamId}/roster`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FANTA11/1.0)" },
    });
    if (!res.ok) {
      console.log(`    ⚠ HTTP ${res.status} for team ${teamId}`);
      return null;
    }
    return res.json() as Promise<EspnRosterResponse>;
  } catch (err) {
    console.log(`    ⚠ Fetch error for team ${teamId}: ${err}`);
    return null;
  }
}

// ─── Curated fallback for 6 nations not in ESPN ─────────────────────────────

type FP = [string, Pos];
const CURATED_FALLBACK: Array<{ name: string; code: string; squad: FP[] }> = [
  { name: "Poland", code: "POL", squad: [
    ["Wojciech Szczęsny","GK"],["Łukasz Fabiański","GK"],["Bartłomiej Drągowski","GK"],
    ["Kamil Glik","DEF"],["Jan Bednarek","DEF"],["Jakub Kiwior","DEF"],
    ["Bartosz Bereszyński","DEF"],["Matty Cash","DEF"],["Paweł Dawidowicz","DEF"],
    ["Tymoteusz Puchacz","DEF"],["Mateusz Wieteska","DEF"],
    ["Piotr Zieliński","MID"],["Grzegorz Krychowiak","MID"],["Sebastian Szymański","MID"],
    ["Przemysław Frankowski","MID"],["Jakub Kamiński","MID"],["Nicola Zalewski","MID"],
    ["Mateusz Klich","MID"],["Kacper Urbański","MID"],
    ["Robert Lewandowski","FWD"],["Arkadiusz Milik","FWD"],["Karol Świderski","FWD"],["Adam Buksa","FWD"],
  ]},
  { name: "Denmark", code: "DEN", squad: [
    ["Kasper Schmeichel","GK"],["Oliver Christensen","GK"],["Frederik Rønnow","GK"],
    ["Simon Kjær","DEF"],["Andreas Christensen","DEF"],["Joachim Andersen","DEF"],
    ["Joakim Mæhle","DEF"],["Víctor Nelsson","DEF"],["Alexander Bah","DEF"],
    ["Jens Stryger Larsen","DEF"],["Daniel Wass","DEF"],
    ["Christian Eriksen","MID"],["Pierre-Emile Højbjerg","MID"],["Thomas Delaney","MID"],
    ["Mikkel Damsgaard","MID"],["Andreas Skov Olsen","MID"],["Jesper Lindstrøm","MID"],
    ["Mathias Jensen","MID"],["Albert Grønbæk","MID"],
    ["Rasmus Højlund","FWD"],["Jonas Wind","FWD"],["Kasper Dolberg","FWD"],["Andreas Cornelius","FWD"],
  ]},
  { name: "Serbia", code: "SRB", squad: [
    ["Predrag Rajković","GK"],["Vanja Milinković-Savić","GK"],["Marko Dmitrović","GK"],
    ["Strahinja Pavlović","DEF"],["Nikola Milenković","DEF"],["Miloš Veljković","DEF"],
    ["Strahinja Eraković","DEF"],["Filip Mladenović","DEF"],["Srđan Babić","DEF"],
    ["Nemanja Gudelj","DEF"],["Miloš Spajić","DEF"],
    ["Sergej Milinković-Savić","MID"],["Saša Lukić","MID"],["Filip Kostić","MID"],
    ["Ivan Ilić","MID"],["Dušan Tadić","MID"],["Lazar Samardžić","MID"],
    ["Marko Grujić","MID"],["Andrija Živković","MID"],
    ["Aleksandar Mitrović","FWD"],["Dušan Vlahović","FWD"],["Luka Jović","FWD"],["Nemanja Radonjić","FWD"],
  ]},
  { name: "Cameroon", code: "CMR", squad: [
    ["André Onana","GK"],["Devis Epassy","GK"],["Simon Omossola","GK"],
    ["Collins Fai","DEF"],["Michael Ngadeu-Ngadjui","DEF"],["Nouhou","DEF"],
    ["Jean-Charles Castelletto","DEF"],["Harold Moukoudi","DEF"],["Ambroise Oyongo","DEF"],
    ["Nicolas Nkoulou","DEF"],["Enzo Ebosse","DEF"],
    ["Frank Zambo Anguissa","MID"],["Samuel Gouet","MID"],["Martin Hongla","MID"],
    ["Pierre Kunde","MID"],["Olivier Ntcham","MID"],["Gaël Ondoua","MID"],
    ["Moumi Ngamaleu","MID"],["James Léa Siliki","MID"],
    ["Vincent Aboubakar","FWD"],["Bryan Mbeumo","FWD"],["Karl Toko Ekambi","FWD"],["Jean-Pierre Nsame","FWD"],
  ]},
  { name: "Costa Rica", code: "CRC", squad: [
    ["Keylor Navas","GK"],["Patrick Sequeira","GK"],["Esteban Alvarado","GK"],
    ["Bryan Oviedo","DEF"],["Keysher Fuller","DEF"],["Oscar Duarte","DEF"],
    ["Kendall Waston","DEF"],["Carlos Martínez","DEF"],["Juan Pablo Vargas","DEF"],
    ["Ronald Matarrita","DEF"],["Francisco Calvo","DEF"],
    ["Celso Borges","MID"],["Bryan Ruiz","MID"],["Yeltsin Tejeda","MID"],
    ["Rándall Leal","MID"],["Douglas Sequeira","MID"],["Orlando Galo","MID"],
    ["Anthony Hernández","MID"],["Jefferson Brenes","MID"],
    ["Joel Campbell","FWD"],["Johan Venegas","FWD"],["Anthony Contreras","FWD"],["Manfred Ugalde","FWD"],
  ]},
  { name: "Wales", code: "WAL", squad: [
    ["Wayne Hennessey","GK"],["Danny Ward","GK"],["Adam Davies","GK"],
    ["Ben Davies","DEF"],["Joe Rodon","DEF"],["Chris Mepham","DEF"],
    ["Connor Roberts","DEF"],["Ethan Ampadu","DEF"],["Neco Williams","DEF"],
    ["Tom Lockyer","DEF"],["Ben Cabango","DEF"],
    ["Aaron Ramsey","MID"],["Joe Allen","MID"],["Harry Wilson","MID"],
    ["Dylan Levitt","MID"],["Matthew Smith","MID"],["Jonny Williams","MID"],
    ["Rubin Colwill","MID"],["Dan James","MID"],
    ["Gareth Bale","FWD"],["Kieffer Moore","FWD"],["Brennan Johnson","FWD"],["Mark Harris","FWD"],
  ]},
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FIFA World Cup 2026 — ESPN Player Seed");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log("Clearing existing players & team rosters…");
  await db.execute(sql`DELETE FROM team_players`);
  await db.execute(sql`DELETE FROM players`);
  await db.execute(sql`ALTER SEQUENCE players_id_seq RESTART WITH 1`);
  console.log("✔ Cleared\n");

  const now = new Date();
  let totalInserted = 0;
  let teamsSeeded = 0;

  // ── ESPN teams ─────────────────────────────────────────────────────────────
  console.log(`Fetching ${ESPN_TEAMS.length} team rosters from ESPN…\n`);

  for (const team of ESPN_TEAMS) {
    process.stdout.write(`  ${team.code} ${team.name}… `);

    // small delay to be polite to ESPN's servers
    await new Promise(r => setTimeout(r, 300));

    const roster = await fetchRoster(team.id);
    if (!roster?.athletes?.length) {
      console.log("SKIPPED (no data)");
      continue;
    }

    const rows: Array<{
      name: string; position: string; club: string; clubShortName: string;
      nationality: string; price: number; totalPoints: number; form: number;
      selected: number; goalsScored: number; assists: number; cleanSheets: number;
      imageUrl: string | null; cachedFromApi: boolean; cachedAt: Date;
    }> = [];

    for (const athlete of roster.athletes) {
      const espnPos = athlete.position?.abbreviation?.toUpperCase() ?? "";
      const pos: Pos | undefined = POS_MAP[espnPos];
      if (!pos) continue; // skip players with unknown position

      rows.push({
        name: athlete.displayName || athlete.fullName,
        position: pos,
        club: team.name,
        clubShortName: team.code,
        nationality: team.name,
        price: assignPrice(athlete.displayName || athlete.fullName, pos, team.name),
        totalPoints: 0,
        form: 0,
        selected: 0,
        goalsScored: 0,
        assists: 0,
        cleanSheets: 0,
        imageUrl: athlete.headshot?.href ?? null,
        cachedFromApi: true,
        cachedAt: now,
      });
    }

    if (rows.length === 0) {
      console.log("SKIPPED (no mapped positions)");
      continue;
    }

    await db.insert(playersTable).values(rows);
    totalInserted += rows.length;
    teamsSeeded++;
    console.log(`${rows.length} players`);
  }

  // ── Curated fallback nations ────────────────────────────────────────────────
  console.log(`\nSeeding ${CURATED_FALLBACK.length} fallback nations (not in ESPN)…\n`);

  for (const { name, code, squad } of CURATED_FALLBACK) {
    const rows = squad.map(([playerName, pos]) => ({
      name: playerName,
      position: pos as string,
      club: name,
      clubShortName: code,
      nationality: name,
      price: assignPrice(playerName, pos, name),
      totalPoints: 0,
      form: 0,
      selected: 0,
      goalsScored: 0,
      assists: 0,
      cleanSheets: 0,
      imageUrl: null as string | null,
      cachedFromApi: false,
      cachedAt: now,
    }));
    await db.insert(playersTable).values(rows);
    totalInserted += rows.length;
    teamsSeeded++;
    console.log(`  ${code} ${name}: ${rows.length} players (curated)`);
  }

  // ── Reset budgets ──────────────────────────────────────────────────────────
  console.log("\nResetting team budgets to £100m…");
  await db.execute(sql`UPDATE teams SET budget = 100, captain_id = NULL, vice_captain_id = NULL`);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Done. ${totalInserted} players across ${teamsSeeded} nations seeded.`);
  console.log("═══════════════════════════════════════════════════════════════");
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
