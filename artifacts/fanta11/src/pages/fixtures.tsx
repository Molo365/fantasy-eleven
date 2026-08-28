import {
  useGetLiveFixtures,
  getGetLiveFixturesQueryKey,
  type LiveFixture,
} from "@workspace/api-client-react";
import { Calendar, AlertCircle } from "lucide-react";
import { useEffect, useState, useMemo, useRef } from "react";
import { format } from "date-fns";

type Fixture = LiveFixture;

type FixtureLeagueKey = "premier-league" | "serie-a";

const FIXTURE_LEAGUES: Array<{
  key: FixtureLeagueKey;
  name: string;
  image: string;
}> = [
  {
    key: "premier-league",
    name: "Premier League",
    image: "/league-premier.png",
  },
  {
    key: "serie-a",
    name: "Serie A",
    image: "/league-seriea.png",
  },
];

const LAST_FIXTURE_LEAGUE_STORAGE_KEY = "fanta11:last-fixture-league";

function getInitialFixtureLeague(): FixtureLeagueKey {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(LAST_FIXTURE_LEAGUE_STORAGE_KEY);
    if (saved === "serie-a" || saved === "premier-league") return saved;
  }
  return "premier-league";
}

function parseLocal(dateStr: string) {
  const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d);
}

function groupByDate(fixtures: Fixture[]): Array<{ date: string; items: Fixture[] }> {
  const map = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const d = f.date.split("T")[0];
    const list = map.get(d) ?? [];
    list.push(f);
    map.set(d, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, items]) => {
      items.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
      return { date, items };
    });
}

function ScoreBlock({ fixture }: { fixture: Fixture }) {
  if (fixture.status === "scheduled") {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="bg-[#0f172a] px-3.5 py-1.5 rounded-lg border border-white/10 font-mono text-[13px] sm:text-sm font-bold text-slate-300 shadow-inner">
          {format(new Date(fixture.kickoff), "HH:mm")}
        </div>
        {fixture.venue && (
          <span className="text-[9px] text-blue-300/50 uppercase tracking-wider truncate max-w-[90px] sm:max-w-[110px] text-center">
            {fixture.venue}
          </span>
        )}
      </div>
    );
  }

  const isLive = fixture.status === "live";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-5 py-1 sm:py-1.5 rounded-lg border font-black text-lg sm:text-2xl tabular-nums shadow-md min-w-[72px] sm:min-w-[90px] ${
        isLive
          ? "bg-blue-600/20 border-blue-500/30 text-white shadow-[0_0_15px_rgba(37,99,235,0.15)]"
          : "bg-[#0f172a] border-white/10 text-slate-200"
      }`}>
        <span>{fixture.homeScore ?? 0}</span>
        <span className={`text-sm font-sans font-bold ${isLive ? "text-blue-400/50" : "text-slate-600"}`}>-</span>
        <span>{fixture.awayScore ?? 0}</span>
      </div>

      {isLive ? (
        <div
          data-testid={`status-live-${fixture.id}`}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
          LIVE
        </div>
      ) : (
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          FT
        </div>
      )}
    </div>
  );
}

function TeamSide({ name, logo, align }: { name: string; logo: string | null | undefined; align: "left" | "right" }) {
  const isRight = align === "right";
  return (
    <div className={`flex-1 flex items-center gap-2 sm:gap-3 min-w-0 ${isRight ? "justify-end" : "justify-start"}`}>
      {isRight && <span className="font-bold text-xs sm:text-[15px] leading-tight truncate text-right text-slate-200" title={name}>{name}</span>}
      {logo ? (
        <div className="w-7 h-7 sm:w-9 sm:h-9 flex-shrink-0 bg-white/5 rounded-full p-1 border border-white/10 flex items-center justify-center shadow-sm">
          <img src={logo} alt={name} className="w-full h-full object-contain drop-shadow-md" loading="lazy" />
        </div>
      ) : (
         <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/10 shrink-0 border border-white/10" />
      )}
      {!isRight && <span className="font-bold text-xs sm:text-[15px] leading-tight truncate text-left text-slate-200" title={name}>{name}</span>}
    </div>
  );
}

export function Fixtures() {
  const [activeLeagueKey, setActiveLeagueKey] = useState<FixtureLeagueKey>(getInitialFixtureLeague);
  const activeLeague = FIXTURE_LEAGUES.find((league) => league.key === activeLeagueKey)!;
  const { data: fixtures, isLoading, isError } = useGetLiveFixtures(
    { leagueKey: activeLeagueKey },
    {
      query: {
        queryKey: getGetLiveFixturesQueryKey({ leagueKey: activeLeagueKey }),
        refetchInterval: activeLeagueKey === "premier-league" ? 60_000 : 15 * 60_000,
      },
    }
  );

  const [selectedGw, setSelectedGw] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedGw(null);
    window.localStorage.setItem(LAST_FIXTURE_LEAGUE_STORAGE_KEY, activeLeagueKey);
  }, [activeLeagueKey]);

  const uniqueGameweeks = useMemo(() => {
    if (!fixtures) return [];
    const gws = new Set<number>();
    fixtures.forEach(f => {
      if (f.gameweekNumber !== null) gws.add(f.gameweekNumber);
    });
    return Array.from(gws).sort((a, b) => a - b);
  }, [fixtures]);

  useEffect(() => {
    if (fixtures && uniqueGameweeks.length > 0 && selectedGw === null) {
      const liveFixture = fixtures.find(f => f.status === "live");
      if (liveFixture && liveFixture.gameweekNumber) {
        setSelectedGw(liveFixture.gameweekNumber);
        return;
      }

      const now = Date.now();
      const upcomingFixtures = fixtures
        .filter((fixture) => fixture.gameweekNumber !== null && new Date(fixture.kickoff).getTime() >= now)
        .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

      if (upcomingFixtures[0]?.gameweekNumber != null) {
        setSelectedGw(upcomingFixtures[0].gameweekNumber);
        return;
      }

      const latestFinishedFixture = fixtures
        .filter((fixture) => fixture.gameweekNumber !== null && fixture.status === "finished")
        .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())[0];
      setSelectedGw(latestFinishedFixture?.gameweekNumber ?? uniqueGameweeks[0]);
    }
  }, [fixtures, uniqueGameweeks, selectedGw]);

  useEffect(() => {
    if (selectedGw && scrollContainerRef.current) {
      const selectedBtn = scrollContainerRef.current.querySelector(`[data-gw="${selectedGw}"]`);
      if (selectedBtn) {
        selectedBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedGw]);

  const gwFixtures = useMemo(() => {
    if (!fixtures || selectedGw === null) return [];
    return fixtures.filter(f => f.gameweekNumber === selectedGw);
  }, [fixtures, selectedGw]);

  const groups = useMemo(() => {
    return groupByDate(gwFixtures);
  }, [gwFixtures]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-10">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-white drop-shadow-md flex items-center gap-3">
          <Calendar className="text-blue-400" size={28} />
          Fixtures & Results
        </h1>
        <p className="text-blue-300/60 text-sm mt-2 font-medium tracking-wide">
          Match schedules, live scores, and past results.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
        {FIXTURE_LEAGUES.map((league) => {
          const isSelected = activeLeagueKey === league.key;
          return (
            <button
              type="button"
              key={league.key}
              data-testid={`fixture-competition-${league.key}`}
              aria-pressed={isSelected}
              aria-label={league.name}
              onClick={() => setActiveLeagueKey(league.key)}
              className={`relative rounded-xl border-2 p-3 transition-all flex items-center gap-3 text-left overflow-hidden cursor-pointer hover:border-primary/50 ${
                isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px]">
                  ✓
                </div>
              )}
              <div className="h-10 w-14 flex items-center justify-center flex-shrink-0">
                <img src={league.image} alt="" className="max-h-full max-w-full object-contain drop-shadow-md" />
              </div>
              <span className="font-semibold text-sm">{league.name}</span>
            </button>
          );
        })}
      </div>

      {isError && (
        <div className="p-8 text-center text-red-400 bg-red-500/10 rounded-xl border border-red-500/20 max-w-md mx-auto mt-10">
          <AlertCircle className="mx-auto mb-3" size={32} />
          <p className="font-bold">Failed to load fixtures</p>
        </div>
      )}

      {isLoading && !fixtures ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex gap-3 overflow-x-hidden pb-2">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="w-24 h-10 rounded-xl bg-white/5 animate-pulse border border-white/5" />)}
          </div>
          <div className="space-y-4">
            <div className="w-48 h-5 bg-white/5 animate-pulse rounded" />
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-4">
              {[1, 2, 3].map(i => (
                 <div key={i} className="h-16 bg-white/5 animate-pulse rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] animate-in fade-in duration-700"
        >
          {uniqueGameweeks.map((gw) => {
            const isSelected = gw === selectedGw;
            return (
              <button
                key={gw}
                data-gw={gw}
                data-testid={`button-gameweek-${gw}`}
                onClick={() => setSelectedGw(gw)}
                className={`
                  snap-start whitespace-nowrap px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-300 flex-shrink-0
                  ${isSelected
                    ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-400'
                    : 'bg-white/5 text-blue-300/60 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'
                  }
                `}
              >
                GW {gw}
              </button>
            );
          })}
        </div>
      )}

      {selectedGw !== null && !isLoading && groups.length === 0 ? (
        <div className="p-12 text-center rounded-2xl mt-8 animate-in zoom-in-95 duration-500" style={{ background: "rgba(8,17,40,0.68)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Calendar className="mx-auto mb-5 text-blue-500/40" size={48} />
          <h3 className="text-xl font-black text-white mb-2 tracking-wide">No Fixtures</h3>
          <p className="text-blue-200/60 max-w-md mx-auto text-sm font-medium">No matches found for Gameweek {selectedGw}.</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-700">
          {groups.map((group) => (
            <div key={group.date} className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-300/70 px-2 py-1 flex items-center gap-2 drop-shadow-sm">
                <Calendar size={14} className="text-blue-500/60" />
                {format(parseLocal(group.date), "EEEE, d MMMM yyyy")}
              </h2>
              <div
                className="rounded-2xl overflow-hidden flex flex-col backdrop-blur-md shadow-xl"
                style={{
                  background: "rgba(8,17,40,0.68)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05), 0 10px 30px -10px rgba(0,0,0,0.5)"
                }}
              >
                {group.items.map((fixture) => (
                  <div
                    key={fixture.id}
                    data-testid={`fixture-${fixture.id}`}
                    className="flex items-center justify-between p-3 sm:p-5 hover:bg-white/[0.03] transition-colors border-b border-white/[0.06] last:border-0 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/[0.03] to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    <TeamSide name={fixture.homeTeam} logo={fixture.homeLogo} align="right" />

                    <div className="flex flex-col items-center justify-center min-w-[100px] sm:min-w-[130px] shrink-0 px-2 relative z-10">
                      <ScoreBlock fixture={fixture} />
                    </div>

                    <TeamSide name={fixture.awayTeam} logo={fixture.awayLogo} align="left" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
