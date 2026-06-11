import { db, playersTable } from "@workspace/db";
import { count, sql } from "drizzle-orm";
import { logger } from "./logger";

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1;

// ─── Nation code map ──────────────────────────────────────────────────────────

const NATION_CODE: Record<string, string> = {
  "France":"FRA","Brazil":"BRA","Argentina":"ARG","England":"ENG",
  "Spain":"ESP","Portugal":"POR","Germany":"GER","Netherlands":"NED",
  "Belgium":"BEL","Croatia":"CRO","Morocco":"MAR","Italy":"ITA",
  "Uruguay":"URU","Denmark":"DEN","Switzerland":"SUI","Senegal":"SEN",
  "Mexico":"MEX","USA":"USA","Japan":"JPN","South Korea":"KOR",
  "Australia":"AUS","Poland":"POL","Serbia":"SRB","Ecuador":"ECU",
  "Cameroon":"CMR","Ghana":"GHA","Qatar":"QAT","Iran":"IRN",
  "Saudi Arabia":"KSA","Tunisia":"TUN","Canada":"CAN","Costa Rica":"CRC",
  "Wales":"WAL","Colombia":"COL","Peru":"PER","Chile":"CHI",
  "Paraguay":"PAR","Bolivia":"BOL","Venezuela":"VEN","Honduras":"HON",
  "Panama":"PAN","El Salvador":"SLV","Jamaica":"JAM","Cuba":"CUB",
  "Nigeria":"NGA","Ivory Coast":"CIV","Egypt":"EGY","Algeria":"ALG",
  "Mali":"MLI","Zambia":"ZAM","South Africa":"RSA","DR Congo":"COD",
  "Iraq":"IRQ","Jordan":"JOR","Syria":"SYR","Oman":"OMA","Bahrain":"BHR",
  "Kuwait":"KUW","Uzbekistan":"UZB","Indonesia":"IDN","New Zealand":"NZL",
  "Palestine":"PLE","Norway":"NOR","Austria":"AUT","Turkey":"TUR",
  "Czech Republic":"CZE","Greece":"GRE","Scotland":"SCO","Sweden":"SWE",
  "Ukraine":"UKR","Slovakia":"SVK","Hungary":"HUN","Romania":"ROU",
  "Ireland":"IRL","Iceland":"ISL","Finland":"FIN",
};

function toCode(nation: string): string {
  return NATION_CODE[nation] ?? (nation.replace(/[^A-Z]/g, "").slice(0, 3) || nation.slice(0, 3).toUpperCase());
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const TIER1 = new Set(["France","Brazil","Argentina","England","Spain","Portugal","Germany","Netherlands","Belgium"]);
const TIER2 = new Set(["Croatia","Morocco","Italy","Uruguay","Denmark","Switzerland","Senegal","Mexico","USA","Japan","South Korea","Australia","Poland","Serbia","Colombia","Norway"]);

const STAR: Record<string, number> = {
  "Kylian Mbappé":13.5,"Kylian Mbappe":13.5,"Erling Haaland":14.0,
  "Vinicius Junior":13.0,"Vinícius Junior":13.0,"Jude Bellingham":11.5,
  "Lionel Messi":12.5,"Cristiano Ronaldo":10.0,"Lamine Yamal":11.0,
  "Bukayo Saka":10.5,"Phil Foden":10.0,"Kevin De Bruyne":10.5,
  "Pedri":9.5,"Rodri":9.0,"Florian Wirtz":9.5,"Jamal Musiala":9.0,
  "Julián Álvarez":9.0,"Julian Alvarez":9.0,"Lautaro Martínez":10.0,
  "Lautaro Martinez":10.0,"Richarlison":9.0,"Raphinha":9.5,"Endrick":8.5,
  "Martin Ødegaard":9.0,"Jonathan David":9.5,"Darwin Núñez":9.0,
  "Harry Kane":11.0,"Son Heung-min":9.5,"Mohamed Salah":11.5,
};

type Pos = "GK" | "DEF" | "MID" | "FWD";
const PRICE_RANGES: Record<Pos,{t1:[number,number];t2:[number,number];t3:[number,number]}> = {
  GK:  {t1:[5.0,6.0],t2:[4.5,5.5],t3:[4.0,5.0]},
  DEF: {t1:[5.5,7.5],t2:[4.5,6.5],t3:[4.0,5.5]},
  MID: {t1:[6.5,9.5],t2:[5.5,8.0],t3:[5.0,6.5]},
  FWD: {t1:[8.0,12.0],t2:[6.5,9.5],t3:[6.0,8.0]},
};

function assignPrice(name: string, pos: Pos, nation: string): number {
  if (STAR[name] !== undefined) return STAR[name];
  const ranges = PRICE_RANGES[pos];
  const [lo,hi] = TIER1.has(nation) ? ranges.t1 : TIER2.has(nation) ? ranges.t2 : ranges.t3;
  return parseFloat((lo + Math.random() * (hi - lo)).toFixed(1));
}

// ─── API fetch helpers ────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const key = process.env.API_SPORTS_KEY;
  if (!key) throw new Error("API_SPORTS_KEY not set");
  const res = await fetch(`${API_BASE}${path}`, { headers: { "x-apisports-key": key } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  const json = await res.json() as { response: T; errors: unknown };
  if (json.errors && typeof json.errors === "object" && Object.keys(json.errors as object).length > 0) {
    throw new Error(`API errors: ${JSON.stringify(json.errors)}`);
  }
  return json.response;
}

async function apiFetchPaged<T>(path: string): Promise<{ response: T[]; paging: { current: number; total: number } }> {
  const key = process.env.API_SPORTS_KEY;
  if (!key) throw new Error("API_SPORTS_KEY not set");
  const res = await fetch(`${API_BASE}${path}`, { headers: { "x-apisports-key": key } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  const json = await res.json() as {
    response: T[];
    paging: { current: number; total: number };
    errors: unknown;
  };
  if (json.errors && typeof json.errors === "object" && Object.keys(json.errors as object).length > 0) {
    throw new Error(`API errors: ${JSON.stringify(json.errors)}`);
  }
  return { response: json.response ?? [], paging: json.paging ?? { current: 1, total: 1 } };
}

type ApiWCPlayer = {
  player: { id: number; name: string; photo: string };
  statistics: Array<{
    team: { id: number; name: string };
    games: { position: string | null };
  }>;
};

const POS_MAP: Record<string, Pos> = {
  Goalkeeper: "GK", Defender: "DEF", Midfielder: "MID", Attacker: "FWD",
};

/** Fetch all pages of /players?league=WC_LEAGUE_ID&season=SEASON */
export async function getWorldCupSquads(season: number): Promise<ApiWCPlayer[]> {
  const all: ApiWCPlayer[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    if (page > 1) await new Promise(r => setTimeout(r, 350)); // respect rate limit between pages
    logger.info({ season, page, totalPages }, "Fetching WC players page");
    const { response, paging } = await apiFetchPaged<ApiWCPlayer>(
      `/players?league=${WC_LEAGUE_ID}&season=${season}&page=${page}`
    );
    all.push(...response);
    totalPages = paging.total;
    page++;
  } while (page <= totalPages);

  logger.info({ season, total: all.length }, "getWorldCupSquads complete");
  return all;
}

// ─── Public sync functions ────────────────────────────────────────────────────

export async function clearAndSyncWorldCupPlayers(): Promise<{
  cleared: number; inserted: number; skipped: number; nations: number;
}> {
  const [{ before }] = await db.select({ before: count() }).from(playersTable);
  await db.execute(sql`TRUNCATE players RESTART IDENTITY CASCADE`);
  logger.info({ cleared: before }, "Cleared players table");
  const result = await syncWorldCupPlayers();
  return { cleared: Number(before), ...result };
}

export async function syncWorldCupPlayers(): Promise<{ inserted: number; skipped: number; nations: number }> {
  let apiInserted = 0, apiSkipped = 0;
  const nationsSeen = new Set<string>();

  for (const season of [2026, 2022]) {
    try {
      logger.info({ season }, "Fetching WC players via league/season endpoint");
      const players = await getWorldCupSquads(season);
      if (!players?.length) { logger.warn({ season }, "No players returned"); continue; }
      logger.info({ count: players.length, season }, "Got WC players — inserting into DB");

      const now = new Date();

      for (const entry of players) {
        const stat = entry.statistics?.[0];
        if (!stat) { apiSkipped++; continue; }

        const rawPos = stat.games?.position ?? "";
        const pos = POS_MAP[rawPos];
        if (!pos) { apiSkipped++; continue; }

        const nationName = stat.team.name;
        const nationCode = toCode(nationName);
        nationsSeen.add(nationName);

        const photoUrl = entry.player.id
          ? `https://media.api-sports.io/football/players/${entry.player.id}.png`
          : (entry.player.photo || null);

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
            imageUrl: photoUrl,
            cachedFromApi: true,
            cachedAt: now,
          }).onConflictDoNothing();
          apiInserted++;
        } catch { apiSkipped++; }
      }

      logger.info({ apiInserted, apiSkipped, nations: nationsSeen.size }, "API-Sports WC players done");
      break; // success — don't fall back to older season
    } catch (err) {
      logger.warn({ err, season }, "Season fetch failed, trying next");
    }
  }

  // Fill any nations missing from the API with curated fallback data
  const existing = await db.selectDistinct({ club: playersTable.club }).from(playersTable);
  const existingNations = new Set(existing.map(r => r.club));
  const { inserted: fbInserted, skipped: fbSkipped, nations: fbNations } =
    await seedFallbackMissing(existingNations);

  const total = {
    inserted: apiInserted + fbInserted,
    skipped: apiSkipped + fbSkipped,
    nations: nationsSeen.size + fbNations,
  };
  logger.info(total, "WC player sync complete (API + fallback gap-fill)");
  return total;
}

// ─── Fixtures ──────────────────────────────────────────────────────────────────

export type LiveFixtureDTO = {
  id: number;
  date: string;
  kickoff: string;
  status: "scheduled" | "live" | "finished";
  statusShort: string;
  elapsed: number | null;
  round: string;
  venue: string | null;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

type ApiFixture = {
  fixture: {
    id: number;
    date: string;
    venue: { name: string | null } | null;
    status: { short: string; elapsed: number | null };
  };
  league: { round: string };
  teams: {
    home: { name: string; logo: string | null };
    away: { name: string; logo: string | null };
  };
  goals: { home: number | null; away: number | null };
};

const LIVE_CODES = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT", "SUSP"]);
const FINISHED_CODES = new Set(["FT", "AET", "PEN", "WO"]);

function mapFixtureStatus(short: string): "scheduled" | "live" | "finished" {
  if (LIVE_CODES.has(short)) return "live";
  if (FINISHED_CODES.has(short)) return "finished";
  return "scheduled";
}

const fixturesCache = new Map<number, { at: number; data: LiveFixtureDTO[] }>();
const FIXTURES_TTL_MS = 30_000;

export async function getWorldCupFixtures(season: number): Promise<LiveFixtureDTO[]> {
  const cached = fixturesCache.get(season);
  if (cached && Date.now() - cached.at < FIXTURES_TTL_MS) {
    return cached.data;
  }
  const response = await apiFetch<ApiFixture[]>(`/fixtures?league=${WC_LEAGUE_ID}&season=${season}`);
  const data: LiveFixtureDTO[] = response
    .map((f) => ({
      id: f.fixture.id,
      date: f.fixture.date.slice(0, 10),
      kickoff: f.fixture.date,
      status: mapFixtureStatus(f.fixture.status.short),
      statusShort: f.fixture.status.short,
      elapsed: f.fixture.status.elapsed,
      round: f.league.round,
      venue: f.fixture.venue?.name ?? null,
      homeTeam: f.teams.home.name,
      awayTeam: f.teams.away.name,
      homeLogo: f.teams.home.logo,
      awayLogo: f.teams.away.logo,
      homeScore: f.goals.home,
      awayScore: f.goals.away,
    }))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  fixturesCache.set(season, { at: Date.now(), data });
  return data;
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

// ─── Curated fallback (~26 players × 32 nations ≈ 800+ players) ──────────────
// club = national team name; all real WC-calibre players

type FP = [string, Pos];
type FN = { name: string; players: FP[] };

const FALLBACK_NATIONS: FN[] = [
  { name:"Brazil", players:[
    ["Alisson Becker","GK"],["Ederson","GK"],["Weverton","GK"],
    ["Marquinhos","DEF"],["Thiago Silva","DEF"],["Danilo","DEF"],["Alex Sandro","DEF"],
    ["Gabriel Magalhães","DEF"],["Éder Militão","DEF"],["Alex Telles","DEF"],["Guilherme Arana","DEF"],
    ["Casemiro","MID"],["Lucas Paquetá","MID"],["Bruno Guimarães","MID"],["Fabinho","MID"],
    ["Fred","MID"],["Éverton Ribeiro","MID"],["Andreas Pereira","MID"],
    ["Vinicius Junior","FWD"],["Neymar","FWD"],["Richarlison","FWD"],["Gabriel Jesus","FWD"],
    ["Rodrygo","FWD"],["Raphinha","FWD"],["Pedro","FWD"],["Endrick","FWD"],
  ]},
  { name:"France", players:[
    ["Hugo Lloris","GK"],["Mike Maignan","GK"],["Alphonse Areola","GK"],
    ["Raphaël Varane","DEF"],["Lucas Hernandez","DEF"],["Théo Hernandez","DEF"],
    ["Jules Koundé","DEF"],["Benjamin Pavard","DEF"],["Ibrahima Konaté","DEF"],
    ["William Saliba","DEF"],["Jonathan Clauss","DEF"],
    ["N'Golo Kanté","MID"],["Aurélien Tchouaméni","MID"],["Adrien Rabiot","MID"],
    ["Eduardo Camavinga","MID"],["Youssouf Fofana","MID"],["Warren Zaïre-Emery","MID"],
    ["Kylian Mbappé","FWD"],["Olivier Giroud","FWD"],["Ousmane Dembélé","FWD"],
    ["Antoine Griezmann","FWD"],["Marcus Thuram","FWD"],["Randal Kolo Muani","FWD"],
    ["Kingsley Coman","FWD"],["Christopher Nkunku","FWD"],["Brayann Pereira","FWD"],
  ]},
  { name:"Argentina", players:[
    ["Emiliano Martínez","GK"],["Gerónimo Rulli","GK"],["Franco Armani","GK"],
    ["Cristian Romero","DEF"],["Lisandro Martínez","DEF"],["Nicolás Otamendi","DEF"],
    ["Nahuel Molina","DEF"],["Marcos Acuña","DEF"],["Nicolás Tagliafico","DEF"],
    ["Gonzalo Montiel","DEF"],["Germán Pezzella","DEF"],
    ["Rodrigo De Paul","MID"],["Leandro Paredes","MID"],["Enzo Fernández","MID"],
    ["Alexis Mac Allister","MID"],["Giovani Lo Celso","MID"],["Guido Rodríguez","MID"],
    ["Lionel Messi","FWD"],["Julián Álvarez","FWD"],["Lautaro Martínez","FWD"],
    ["Ángel Di María","FWD"],["Paulo Dybala","FWD"],["Alejandro Garnacho","FWD"],
    ["Nicolás González","FWD"],["Thiago Almada","FWD"],
  ]},
  { name:"England", players:[
    ["Jordan Pickford","GK"],["Nick Pope","GK"],["Aaron Ramsdale","GK"],
    ["Trent Alexander-Arnold","DEF"],["Kieran Trippier","DEF"],["Luke Shaw","DEF"],
    ["John Stones","DEF"],["Harry Maguire","DEF"],["Marc Guehi","DEF"],
    ["Ben Chilwell","DEF"],["Reece James","DEF"],
    ["Jude Bellingham","MID"],["Declan Rice","MID"],["Phil Foden","MID"],
    ["Mason Mount","MID"],["Bukayo Saka","MID"],["Conor Gallagher","MID"],
    ["James Maddison","MID"],["Jordan Henderson","MID"],
    ["Harry Kane","FWD"],["Marcus Rashford","FWD"],["Raheem Sterling","FWD"],
    ["Jarrod Bowen","FWD"],["Cole Palmer","FWD"],["Ivan Toney","FWD"],
    ["Callum Wilson","FWD"],
  ]},
  { name:"Spain", players:[
    ["Unai Simón","GK"],["David Raya","GK"],["Robert Sánchez","GK"],
    ["Dani Carvajal","DEF"],["Alejandro Balde","DEF"],["Aymeric Laporte","DEF"],
    ["Pau Cubarsí","DEF"],["Nacho","DEF"],["Robin Le Normand","DEF"],["Jesús Navas","DEF"],
    ["Pedri","MID"],["Rodri","MID"],["Fabián Ruiz","MID"],["Gavi","MID"],
    ["Dani Olmo","MID"],["Mikel Merino","MID"],["Martín Zubimendi","MID"],["Alex Baena","MID"],
    ["Álvaro Morata","FWD"],["Lamine Yamal","FWD"],["Nico Williams","FWD"],
    ["Mikel Oyarzabal","FWD"],["Yeremy Pino","FWD"],["Ferran Torres","FWD"],
    ["Bryan Zaragoza","FWD"],["Joselu","FWD"],
  ]},
  { name:"Portugal", players:[
    ["Rui Patrício","GK"],["Diogo Costa","GK"],["José Sá","GK"],
    ["João Cancelo","DEF"],["Rúben Dias","DEF"],["Pepe","DEF"],
    ["Danilo Pereira","DEF"],["Nuno Mendes","DEF"],["António Silva","DEF"],
    ["Gonçalo Inácio","DEF"],["Nelson Semedo","DEF"],
    ["Bruno Fernandes","MID"],["Bernardo Silva","MID"],["João Palhinha","MID"],
    ["Vitinha","MID"],["Rúben Neves","MID"],["Otávio","MID"],["Matheus Nunes","MID"],
    ["Cristiano Ronaldo","FWD"],["Gonçalo Ramos","FWD"],["Rafael Leão","FWD"],
    ["João Félix","FWD"],["Diogo Jota","FWD"],["Pedro Neto","FWD"],
    ["Francisco Conceição","FWD"],["Bruma","FWD"],
  ]},
  { name:"Germany", players:[
    ["Manuel Neuer","GK"],["Marc-André ter Stegen","GK"],["Kevin Trapp","GK"],
    ["Antonio Rüdiger","DEF"],["Joshua Kimmich","DEF"],["David Raum","DEF"],
    ["Nico Schlotterbeck","DEF"],["Matthias Ginter","DEF"],["Thilo Kehrer","DEF"],
    ["Benjamin Henrichs","DEF"],["Robin Gosens","DEF"],
    ["Ilkay Gündogan","MID"],["Leon Goretzka","MID"],["Kai Havertz","MID"],
    ["Leroy Sané","MID"],["Jamal Musiala","MID"],["Florian Wirtz","MID"],
    ["Julian Brandt","MID"],["Thomas Müller","MID"],
    ["Serge Gnabry","FWD"],["Niclas Füllkrug","FWD"],["Karim Adeyemi","FWD"],
    ["Deniz Undav","FWD"],["Maximilian Beier","FWD"],["Leroy Sané","FWD"],
    ["Robert Andrich","MID"],
  ]},
  { name:"Netherlands", players:[
    ["Remko Pasveer","GK"],["Bart Verbruggen","GK"],["Mark Flekken","GK"],
    ["Virgil van Dijk","DEF"],["Matthijs de Ligt","DEF"],["Stefan de Vrij","DEF"],
    ["Denzel Dumfries","DEF"],["Nathan Aké","DEF"],["Jurriën Timber","DEF"],
    ["Jeremie Frimpong","DEF"],["Daley Blind","DEF"],
    ["Frenkie de Jong","MID"],["Marten de Roon","MID"],["Xavi Simons","MID"],
    ["Teun Koopmeiners","MID"],["Ryan Gravenberch","MID"],["Tijjani Reijnders","MID"],
    ["Georginio Wijnaldum","MID"],
    ["Cody Gakpo","FWD"],["Memphis Depay","FWD"],["Donyell Malen","FWD"],
    ["Wout Weghorst","FWD"],["Steven Bergwijn","FWD"],["Noa Lang","FWD"],
    ["Brian Brobbey","FWD"],["Quinten Timber","MID"],
  ]},
  { name:"Belgium", players:[
    ["Thibaut Courtois","GK"],["Simon Mignolet","GK"],["Koen Casteels","GK"],
    ["Toby Alderweireld","DEF"],["Jan Vertonghen","DEF"],["Timothy Castagne","DEF"],
    ["Zeno Debast","DEF"],["Arthur Theate","DEF"],["Thomas Meunier","DEF"],["Axel Witsel","DEF"],
    ["Kevin De Bruyne","MID"],["Youri Tielemans","MID"],["Leandro Trossard","MID"],
    ["Amadou Onana","MID"],["Orel Mangala","MID"],["Charles De Ketelaere","MID"],
    ["Alexis Saelemaekers","MID"],["Hans Vanaken","MID"],
    ["Romelu Lukaku","FWD"],["Dries Mertens","FWD"],["Loïs Openda","FWD"],
    ["Jeremy Doku","FWD"],["Johan Bakayoko","FWD"],["Adnan Januzaj","FWD"],
    ["Michy Batshuayi","FWD"],
  ]},
  { name:"Croatia", players:[
    ["Dominik Livaković","GK"],["Ivica Ivušić","GK"],["Lovre Kalinić","GK"],
    ["Joško Gvardiol","DEF"],["Dejan Lovren","DEF"],["Josip Stanišić","DEF"],
    ["Borna Ćaleta-Car","DEF"],["Šime Vrsaljko","DEF"],["Martin Erlić","DEF"],["Borna Sosa","DEF"],
    ["Luka Modrić","MID"],["Marcelo Brozović","MID"],["Mateo Kovačić","MID"],
    ["Nikola Vlašić","MID"],["Mario Pašalić","MID"],["Ivan Perišić","MID"],
    ["Lovro Majer","MID"],["Kristijan Jakić","MID"],
    ["Andrej Kramarić","FWD"],["Bruno Petković","FWD"],["Ivan Budimir","FWD"],
    ["Marko Livaja","FWD"],["Luka Ivanušec","FWD"],
  ]},
  { name:"Morocco", players:[
    ["Yassine Bounou","GK"],["Munir Mohamedi","GK"],["Ahmed Reda Tagnaouti","GK"],
    ["Achraf Hakimi","DEF"],["Noussair Mazraoui","DEF"],["Romain Saïss","DEF"],
    ["Jawad El Yamiq","DEF"],["Nayef Aguerd","DEF"],["Achraf Dari","DEF"],
    ["Badr Benoun","DEF"],["Adam Masina","DEF"],
    ["Selim Amallah","MID"],["Azzedine Ounahi","MID"],["Sofyan Amrabat","MID"],
    ["Hakim Ziyech","MID"],["Bilal El Khannouss","MID"],["Abde Ezzalzouli","MID"],["Ilias Chair","MID"],
    ["Youssef En-Nesyri","FWD"],["Sofiane Boufal","FWD"],["Anass Zaroury","FWD"],
    ["Tarik Tissoudali","FWD"],["Ayoub El Kaabi","FWD"],["Ryan Mmaee","FWD"],
  ]},
  { name:"Denmark", players:[
    ["Kasper Schmeichel","GK"],["Oliver Christensen","GK"],["Frederik Rønnow","GK"],
    ["Simon Kjær","DEF"],["Andreas Christensen","DEF"],["Joachim Andersen","DEF"],
    ["Joakim Mæhle","DEF"],["Víctor Nelsson","DEF"],["Jens Stryger Larsen","DEF"],["Daniel Wass","DEF"],
    ["Christian Eriksen","MID"],["Pierre-Emile Højbjerg","MID"],["Thomas Delaney","MID"],
    ["Mikkel Damsgaard","MID"],["Andreas Skov Olsen","MID"],["Mathias Jensen","MID"],["Jesper Lindstrøm","MID"],
    ["Rasmus Højlund","FWD"],["Martin Braithwaite","FWD"],["Jonas Wind","FWD"],
    ["Kasper Dolberg","FWD"],["Andreas Cornelius","FWD"],
  ]},
  { name:"Switzerland", players:[
    ["Yann Sommer","GK"],["Gregor Kobel","GK"],["Jonas Omlin","GK"],
    ["Manuel Akanji","DEF"],["Fabian Schär","DEF"],["Ricardo Rodriguez","DEF"],
    ["Silvan Widmer","DEF"],["Nico Elvedi","DEF"],["Kevin Mbabu","DEF"],["Becir Omeragic","DEF"],
    ["Granit Xhaka","MID"],["Remo Freuler","MID"],["Denis Zakaria","MID"],
    ["Xherdan Shaqiri","MID"],["Michel Aebischer","MID"],["Steven Zuber","MID"],["Fabian Frei","MID"],
    ["Breel Embolo","FWD"],["Haris Seferović","FWD"],["Ruben Vargas","FWD"],
    ["Mario Gavranović","FWD"],["Christian Fassnacht","FWD"],
  ]},
  { name:"Senegal", players:[
    ["Édouard Mendy","GK"],["Alfred Gomis","GK"],["Seny Dieng","GK"],
    ["Kalidou Koulibaly","DEF"],["Youssouf Sabaly","DEF"],["Abdou Diallo","DEF"],
    ["Fodé Ballo-Touré","DEF"],["Moussa Niakhaté","DEF"],["Formose Mendy","DEF"],["Ismail Jakobs","DEF"],
    ["Idrissa Gana Gueye","MID"],["Cheikhou Kouyaté","MID"],["Nampalys Mendy","MID"],
    ["Pape Guèye","MID"],["Lamine Camara","MID"],
    ["Sadio Mané","FWD"],["Ismaila Sarr","FWD"],["Bamba Dieng","FWD"],
    ["Nicolas Jackson","FWD"],["Habib Diallo","FWD"],["Iliman Ndiaye","FWD"],
    ["Krepin Diatta","FWD"],["Adama Traoré","FWD"],
  ]},
  { name:"Mexico", players:[
    ["Guillermo Ochoa","GK"],["Rodolfo Cota","GK"],["Alfredo Talavera","GK"],
    ["Jorge Sánchez","DEF"],["César Montes","DEF"],["Johan Vásquez","DEF"],
    ["Gerardo Arteaga","DEF"],["Kevin Álvarez","DEF"],["Jesús Gallardo","DEF"],["Héctor Moreno","DEF"],
    ["Héctor Herrera","MID"],["Edson Álvarez","MID"],["Orbelín Pineda","MID"],
    ["Roberto Alvarado","MID"],["Chucky Lozano","MID"],["Uriel Antuna","MID"],["Luis Romo","MID"],
    ["Raúl Jiménez","FWD"],["Santiago Giménez","FWD"],["Henry Martín","FWD"],
    ["Alexis Vega","FWD"],["Rogelio Funes Mori","FWD"],
  ]},
  { name:"USA", players:[
    ["Matt Turner","GK"],["Zack Steffen","GK"],["Sean Johnson","GK"],
    ["Sergiño Dest","DEF"],["Tim Weah","DEF"],["Walker Zimmerman","DEF"],
    ["Miles Robinson","DEF"],["Antonee Robinson","DEF"],["DeAndre Yedlin","DEF"],["Joe Scally","DEF"],
    ["Tyler Adams","MID"],["Weston McKennie","MID"],["Yunus Musah","MID"],
    ["Christian Pulisic","MID"],["Brenden Aaronson","MID"],["Gio Reyna","MID"],
    ["Luca de la Torre","MID"],["Jordan Morris","MID"],
    ["Josh Sargent","FWD"],["Folarin Balogun","FWD"],["Ricardo Pepi","FWD"],
    ["Jesus Ferreira","FWD"],["Daryl Dike","FWD"],
  ]},
  { name:"Japan", players:[
    ["Shuichi Gonda","GK"],["Zion Suzuki","GK"],["Daniel Schmidt","GK"],
    ["Takehiro Tomiyasu","DEF"],["Maya Yoshida","DEF"],["Ko Itakura","DEF"],
    ["Hiroki Sakai","DEF"],["Miki Yamane","DEF"],["Yuto Nagatomo","DEF"],["Shogo Taniguchi","DEF"],
    ["Wataru Endo","MID"],["Hidemasa Morita","MID"],["Junya Ito","MID"],
    ["Kaoru Mitoma","MID"],["Daichi Kamada","MID"],["Takefusa Kubo","MID"],
    ["Ritsu Doan","MID"],["Ao Tanaka","MID"],
    ["Ayase Ueda","FWD"],["Genki Haraguchi","FWD"],["Yuya Osako","FWD"],
    ["Naoki Maeda","FWD"],["Shoya Nakajima","FWD"],
  ]},
  { name:"South Korea", players:[
    ["Kim Seung-gyu","GK"],["Jo Hyeon-woo","GK"],["Song Bum-keun","GK"],
    ["Kim Min-jae","DEF"],["Kim Young-gwon","DEF"],["Kim Jin-su","DEF"],
    ["Jung Seung-hyun","DEF"],["Kim Tae-hwan","DEF"],["Lee Ki-je","DEF"],
    ["Lee Jae-sung","MID"],["Jung Woo-young","MID"],["Son Heung-min","MID"],
    ["Lee Kang-in","MID"],["Hwang In-beom","MID"],["Paik Seung-ho","MID"],
    ["Na Sang-ho","MID"],["Kwon Chang-hoon","MID"],
    ["Hwang Hee-chan","FWD"],["Cho Gue-sung","FWD"],["Oh Hyeon-gyu","FWD"],
    ["Hwang Ui-jo","FWD"],["Lee Dong-jun","FWD"],
  ]},
  { name:"Australia", players:[
    ["Mat Ryan","GK"],["Andrew Redmayne","GK"],["Danny Vukovic","GK"],
    ["Harry Souttar","DEF"],["Miloš Degenek","DEF"],["Bailey Wright","DEF"],
    ["Joel King","DEF"],["Aziz Behich","DEF"],["Nathaniel Atkinson","DEF"],["Thomas Deng","DEF"],
    ["Aaron Mooy","MID"],["Jackson Irvine","MID"],["Keanu Baccus","MID"],
    ["Connor Metcalfe","MID"],["Riley McGree","MID"],["Ajdin Hrustic","MID"],["Martin Boyle","MID"],
    ["Mathew Leckie","FWD"],["Mitch Duke","FWD"],["Craig Goodwin","FWD"],
    ["Jamie Maclaren","FWD"],["Marco Tilio","FWD"],["Garang Kuol","FWD"],
  ]},
  { name:"Poland", players:[
    ["Wojciech Szczęsny","GK"],["Łukasz Fabiański","GK"],["Bartłomiej Drągowski","GK"],
    ["Kamil Glik","DEF"],["Jan Bednarek","DEF"],["Bartosz Bereszyński","DEF"],
    ["Matty Cash","DEF"],["Jakub Kiwior","DEF"],["Paweł Dawidowicz","DEF"],["Tymoteusz Puchacz","DEF"],
    ["Piotr Zieliński","MID"],["Grzegorz Krychowiak","MID"],["Mateusz Klich","MID"],
    ["Przemysław Frankowski","MID"],["Sebastian Szymański","MID"],["Jakub Kamiński","MID"],["Nicola Zalewski","MID"],
    ["Robert Lewandowski","FWD"],["Arkadiusz Milik","FWD"],["Karol Świderski","FWD"],
    ["Adam Buksa","FWD"],["Dawid Kownacki","FWD"],
  ]},
  { name:"Serbia", players:[
    ["Predrag Rajković","GK"],["Vanja Milinković-Savić","GK"],["Marko Dmitrović","GK"],
    ["Strahinja Pavlović","DEF"],["Nikola Milenković","DEF"],["Miloš Veljković","DEF"],
    ["Filip Mladenović","DEF"],["Strahinja Eraković","DEF"],["Srđan Babić","DEF"],
    ["Sergej Milinković-Savić","MID"],["Nemanja Gudelj","MID"],["Saša Lukić","MID"],
    ["Filip Kostić","MID"],["Ivan Ilić","MID"],["Andrija Živković","MID"],
    ["Lazar Samardzic","MID"],["Marko Grujić","MID"],["Dušan Tadić","MID"],
    ["Aleksandar Mitrović","FWD"],["Luka Jović","FWD"],["Dušan Vlahović","FWD"],
    ["Nemanja Radonjić","FWD"],
  ]},
  { name:"Uruguay", players:[
    ["Fernando Muslera","GK"],["Sergio Rochet","GK"],["Sebastian Sosa","GK"],
    ["Diego Godín","DEF"],["José María Giménez","DEF"],["Ronald Araújo","DEF"],
    ["Nahitan Nández","DEF"],["Mathías Olivera","DEF"],["Sebastián Coates","DEF"],["Matías Viña","DEF"],
    ["Federico Valverde","MID"],["Rodrigo Bentancur","MID"],["Lucas Torreira","MID"],
    ["Manuel Ugarte","MID"],["Giorgian de Arrascaeta","MID"],["Nicolás de la Cruz","MID"],["Gastón Pereiro","MID"],
    ["Darwin Núñez","FWD"],["Luis Suárez","FWD"],["Edinson Cavani","FWD"],
    ["Facundo Torres","FWD"],["Facundo Pellistri","FWD"],["Maxi Gómez","FWD"],
  ]},
  { name:"Ecuador", players:[
    ["Hernán Galíndez","GK"],["Alexander Domínguez","GK"],["Pedro Ortíz","GK"],
    ["Byron Castillo","DEF"],["Piero Hincapié","DEF"],["Félix Torres","DEF"],
    ["Jackson Porozo","DEF"],["Diego Palacios","DEF"],["Xavier Arreaga","DEF"],["Ángelo Preciado","DEF"],
    ["Moisés Caicedo","MID"],["Carlos Gruezo","MID"],["Jhegson Méndez","MID"],
    ["Ángel Mena","MID"],["Gonzalo Plata","MID"],["Jeremy Sarmiento","MID"],["Romario Ibarra","MID"],
    ["Enner Valencia","FWD"],["Michael Estrada","FWD"],["Djorkaeff Reasco","FWD"],
    ["Jordy Caicedo","FWD"],["Alan Minda","FWD"],
  ]},
  { name:"Canada", players:[
    ["Milan Borjan","GK"],["Maxime Crépeau","GK"],["James Pantemis","GK"],
    ["Alphonso Davies","DEF"],["Steven Vitória","DEF"],["Alistair Johnston","DEF"],
    ["Kamal Miller","DEF"],["Derek Cornelius","DEF"],["Sam Adekugbe","DEF"],["Joel Waterman","DEF"],
    ["Atiba Hutchinson","MID"],["Stephen Eustáquio","MID"],["Mark-Anthony Kaye","MID"],
    ["Jonathan Osorio","MID"],["Tajon Buchanan","MID"],["Ismaël Koné","MID"],["Liam Fraser","MID"],
    ["Jonathan David","FWD"],["Cyle Larin","FWD"],["Lucas Cavallini","FWD"],
    ["Richie Laryea","MID"],["Jacen Russell-Rowe","FWD"],
  ]},
  { name:"Colombia", players:[
    ["David Ospina","GK"],["Camilo Vargas","GK"],["Álvaro Montero","GK"],
    ["Davinson Sánchez","DEF"],["Yerry Mina","DEF"],["Daniel Muñoz","DEF"],
    ["Johan Mojica","DEF"],["Jhon Lucumí","DEF"],["Carlos Cuesta","DEF"],["Stefan Medina","DEF"],
    ["Wilmar Barrios","MID"],["Matheus Uribe","MID"],["James Rodríguez","MID"],
    ["Luis Díaz","MID"],["Juan Cuadrado","MID"],["Sebastián Villa","MID"],["Rafael Santos Borré","MID"],
    ["Radamel Falcao","FWD"],["Luis Muriel","FWD"],["Jhon Durán","FWD"],
    ["Miguel Ángel Borja","FWD"],["Alfredo Morelos","FWD"],
  ]},
  { name:"Norway", players:[
    ["Ørjan Nyland","GK"],["Rune Almenning Jarstein","GK"],["Sondre Rossbach","GK"],
    ["Kristoffer Ajer","DEF"],["Andreas Hanche-Olsen","DEF"],["Omar Elabdellaoui","DEF"],
    ["Julian Ryerson","DEF"],["Birger Meling","DEF"],["Leo Skiri Østigård","DEF"],["Stian Gregersen","DEF"],
    ["Sander Berge","MID"],["Martin Ødegaard","MID"],["Stefan Johansen","MID"],
    ["Mohamed Elyounoussi","MID"],["Patrick Berg","MID"],["Fredrik Aursnes","MID"],["Mathias Normann","MID"],
    ["Erling Haaland","FWD"],["Alexander Sørloth","FWD"],["Joshua King","FWD"],
    ["Ola Solbakken","FWD"],["Antonio Nusa","FWD"],["Jens Petter Hauge","FWD"],
  ]},
  { name:"Ghana", players:[
    ["Lawrence Ati-Zigi","GK"],["Joseph Wollacott","GK"],["Richard Ofori","GK"],
    ["Daniel Amartey","DEF"],["Alexander Djiku","DEF"],["Tariq Lamptey","DEF"],
    ["Baba Rahman","DEF"],["Gideon Mensah","DEF"],["Jonathan Mensah","DEF"],["Denis Odoi","DEF"],
    ["Thomas Partey","MID"],["Iddrisu Baba","MID"],["Jordan Ayew","MID"],
    ["Andre Ayew","MID"],["Osman Bukari","MID"],["Lawrence Agyekum","MID"],["Kudus Mohammed","MID"],
    ["Mohammed Kudus","FWD"],["Inaki Williams","FWD"],["Antoine Semenyo","FWD"],
    ["Felix Afena-Gyan","FWD"],["Ernest Nuamah","FWD"],
  ]},
  { name:"Cameroon", players:[
    ["André Onana","GK"],["Fabrice Ondoa","GK"],["Devis Epassy","GK"],
    ["Collins Fai","DEF"],["Michael Ngadeu-Ngadjui","DEF"],["Harold Moukoudi","DEF"],
    ["Nouhou","DEF"],["Jean-Charles Castelletto","DEF"],["Ambroise Oyongo","DEF"],["Nicolas Nkoulou","DEF"],
    ["Samuel Gouet","MID"],["Frank Zambo Anguissa","MID"],["Martin Hongla","MID"],
    ["Pierre Kunde","MID"],["Olivier Ntcham","MID"],["Gaël Ondoua","MID"],["Moumi Ngamaleu","MID"],
    ["Vincent Aboubakar","FWD"],["Bryan Mbeumo","FWD"],["Karl Toko Ekambi","FWD"],
    ["Christian Bassogog","FWD"],["Jean-Eric Maxim Choupo-Moting","FWD"],["Ignatius Ganago","FWD"],
  ]},
  { name:"Senegal", players:[] }, // already defined above — duplicate guard handled by onConflictDoNothing
  { name:"Saudi Arabia", players:[
    ["Mohammed Al-Owais","GK"],["Fawaz Al-Qarni","GK"],["Yasser Al-Mosailem","GK"],
    ["Saud Abdulhamid","DEF"],["Ali Al-Bulayhi","DEF"],["Hassan Tambakti","DEF"],
    ["Abdullah Madu","DEF"],["Mohammed Al-Breik","DEF"],["Abdulelah Al-Amri","DEF"],["Yasser Al-Shahrani","DEF"],
    ["Salman Al-Faraj","MID"],["Mohammed Kanno","MID"],["Ali Al-Hassan","MID"],
    ["Ahmed Al-Ghamdi","MID"],["Hattan Bahebri","MID"],["Abdullah Al-Hamdan","MID"],["Ali Al-Nimer","MID"],
    ["Salem Al-Dawsari","FWD"],["Firas Al-Buraikan","FWD"],["Marwan Al-Sahafi","FWD"],
    ["Tarik Hamad","FWD"],["Sami Al-Najei","FWD"],
  ]},
  { name:"Iran", players:[
    ["Alireza Beiranvand","GK"],["Hossein Hosseini","GK"],["Payam Niazmand","GK"],
    ["Shoja Khalilzadeh","DEF"],["Majid Hosseini","DEF"],["Milad Mohammadi","DEF"],
    ["Roozbeh Cheshmi","DEF"],["Ahmad Nourollahi","DEF"],["Hossein Kanaanizadegan","DEF"],["Sadegh Moharrami","DEF"],
    ["Saeid Ezatolahi","MID"],["Ali Gholizadeh","MID"],["Saman Ghoddos","MID"],
    ["Mehdi Torabi","MID"],["Alireza Jahanbakhsh","MID"],["Vahid Amiri","MID"],["Ahmad Nourollahi","MID"],
    ["Mehdi Taremi","FWD"],["Sardar Azmoun","FWD"],["Allahyar Sayyadmanesh","FWD"],
    ["Karim Ansarifard","FWD"],["Kouros Hosseini","FWD"],
  ]},
  { name:"Qatar", players:[
    ["Saad Al-Sheeb","GK"],["Meshaal Barsham","GK"],["Yousef Hassan","GK"],
    ["Pedro Miguel","DEF"],["Tarek Salman","DEF"],["Bassam Al-Rawi","DEF"],
    ["Assim Madibo","DEF"],["Mohammed Waad","DEF"],["Yusuf Abdurisag","DEF"],["Homam Ahmed","DEF"],
    ["Karim Boudiaf","MID"],["Abdulaziz Hatem","MID"],["Akram Afif","MID"],
    ["Hassan Al-Haydos","MID"],["Boualem Khoukhi","MID"],["Salem Al-Hajri","MID"],["Ismaeel Mohammad","MID"],
    ["Almoez Ali","FWD"],["Mohammed Muntari","FWD"],["Abdulrahim Ali","FWD"],
    ["Abdulaziz Al-Ansari","FWD"],
  ]},
  { name:"Tunisia", players:[
    ["Aymen Dahmen","GK"],["Farouk Ben Mustapha","GK"],["Béchir Ben Said","GK"],
    ["Dylan Bronn","DEF"],["Montassar Talbi","DEF"],["Wajdi Kechrida","DEF"],
    ["Ali Maaloul","DEF"],["Nader Ghandri","DEF"],["Hamza Mathlouthi","DEF"],["Bilel Ifa","DEF"],
    ["Aïssa Laïdouni","MID"],["Ellyes Skhiri","MID"],["Ferjani Sassi","MID"],
    ["Mohamed Ali Ben Romdhane","MID"],["Saif-Eddine Khaoui","MID"],["Hannibal Mejbri","MID"],
    ["Taha Yassine Khenissi","FWD"],["Wahbi Khazri","FWD"],["Youssef Msakni","FWD"],
    ["Seifeddine Jaziri","FWD"],["Issam Jebali","FWD"],
  ]},
  { name:"Costa Rica", players:[
    ["Keylor Navas","GK"],["Patrick Sequeira","GK"],["Esteban Alvarado","GK"],
    ["Bryan Oviedo","DEF"],["Keysher Fuller","DEF"],["Oscar Duarte","DEF"],
    ["Daniel Chacón","DEF"],["Kendall Waston","DEF"],["Carlos Martínez","DEF"],["Juan Pablo Vargas","DEF"],
    ["Celso Borges","MID"],["Yeltsin Tejeda","MID"],["Bryan Ruiz","MID"],
    ["Douglas Sequeira","MID"],["Rándall Leal","MID"],["Orlando Galo","MID"],
    ["Joel Campbell","FWD"],["Álvaro Zamora","FWD"],["Johan Venegas","FWD"],
    ["Anthony Contreras","FWD"],
  ]},
  { name:"Wales", players:[
    ["Wayne Hennessey","GK"],["Danny Ward","GK"],["Adam Davies","GK"],
    ["Ben Davies","DEF"],["Joe Rodon","DEF"],["Chris Mepham","DEF"],
    ["Connor Roberts","DEF"],["Ethan Ampadu","DEF"],["Neco Williams","DEF"],["Tom Lockyer","DEF"],
    ["Joe Allen","MID"],["Aaron Ramsey","MID"],["Matthew Smith","MID"],
    ["Dylan Levitt","MID"],["Harry Wilson","MID"],["Jonny Williams","MID"],
    ["Gareth Bale","FWD"],["Kieffer Moore","FWD"],["Mark Harris","FWD"],
    ["Dan James","FWD"],["Brennan Johnson","FWD"],
  ]},
  { name:"Poland", players:[] }, // duplicate guard
];

async function seedFallbackMissing(skip: Set<string> = new Set()): Promise<{ inserted: number; skipped: number; nations: number }> {
  const now = new Date();
  let inserted = 0;
  const seen = new Set<string>();
  let nations = 0;

  for (const nation of FALLBACK_NATIONS) {
    if (seen.has(nation.name) || !nation.players.length) continue;
    seen.add(nation.name);
    if (skip.has(nation.name)) continue; // already seeded from API
    const code = toCode(nation.name);
    nations++;
    for (const [name, pos] of nation.players) {
      try {
        await db.insert(playersTable).values({
          name, position: pos,
          club: nation.name, clubShortName: code, nationality: nation.name,
          price: assignPrice(name, pos, nation.name),
          totalPoints: 0, cachedFromApi: true, cachedAt: now,
        }).onConflictDoNothing();
        inserted++;
      } catch { /* skip */ }
    }
  }

  logger.info({ inserted, nations }, "Fallback gap-fill complete");
  return { inserted, skipped: 0, nations };
}
