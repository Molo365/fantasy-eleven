import {
  useGetLiveFixtures,
  getGetLiveFixturesQueryKey,
  type LiveFixture,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar } from "lucide-react";
import { useEffect } from "react";
import { format } from "date-fns";

type Fixture = LiveFixture;

function groupByDate(fixtures: Fixture[]): Array<{ date: string; items: Fixture[] }> {
  const map = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const list = map.get(f.date) ?? [];
    list.push(f);
    map.set(f.date, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, items]) => ({ date, items }));
}

function TeamSide({
  name,
  logo,
  align,
}: {
  name: string;
  logo: string | null | undefined;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex-1 flex items-center gap-2 sm:gap-3 min-w-0 ${
        align === "right" ? "justify-end flex-row-reverse text-right" : "justify-start text-left"
      }`}
    >
      {logo ? (
        <img src={logo} alt={name} className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0" />
      ) : (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-secondary shrink-0" />
      )}
      <span className="font-medium text-sm sm:text-base truncate">{name}</span>
    </div>
  );
}

export function Fixtures() {
  const { data: fixtures, isLoading, isError } = useGetLiveFixtures({
    query: { queryKey: getGetLiveFixturesQueryKey(), refetchInterval: 60_000 },
  });

  // Load the API-Sports widget script once, after the widget containers are mounted
  useEffect(() => {
    const existing = document.querySelector('script[src*="widgets.api-sports.io"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://widgets.api-sports.io/2.0.3/widgets.js";
      script.type = "module";
      document.body.appendChild(script);
    }
  }, []);

  const API_KEY = import.meta.env.VITE_API_SPORTS_KEY ?? "";

  const groups = fixtures ? groupByDate(fixtures) : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fixtures</h1>
        <p className="text-muted-foreground mt-1">World Cup 2026 match schedule and live scores</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <Card className="border-border">
          <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <Calendar className="w-12 h-12 mb-4 opacity-20" />
            <p>Couldn't load fixtures right now. Please try again shortly.</p>
          </CardContent>
        </Card>
      ) : groups.length > 0 ? (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.date} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground px-1">
                {format(new Date(group.date), "EEEE, d MMMM yyyy")}
              </h2>
              <Card className="border-border overflow-hidden">
                <CardContent className="p-0 divide-y divide-border">
                  {group.items.map((fixture) => (
                    <div
                      key={fixture.id}
                      className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4 hover:bg-secondary/10 transition-colors"
                    >
                      <TeamSide name={fixture.homeTeam} logo={fixture.homeLogo} align="right" />

                      <div className="flex flex-col items-center justify-center min-w-[88px] sm:min-w-[110px] shrink-0">
                        {fixture.status === "scheduled" ? (
                          <div className="bg-secondary px-3 py-1.5 rounded-md font-mono text-sm border border-border">
                            {format(new Date(fixture.kickoff), "HH:mm")}
                          </div>
                        ) : (
                          <div
                            className={`px-3 py-1.5 rounded-md font-mono text-lg sm:text-xl font-bold flex gap-2 sm:gap-3 border ${
                              fixture.status === "live"
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-secondary border-border"
                            }`}
                          >
                            <span>{fixture.homeScore ?? "-"}</span>
                            <span className="text-muted-foreground font-sans text-sm self-center">
                              -
                            </span>
                            <span>{fixture.awayScore ?? "-"}</span>
                          </div>
                        )}
                        {fixture.status === "live" && (
                          <Badge
                            variant="destructive"
                            className="mt-1.5 text-[10px] uppercase font-bold animate-pulse"
                          >
                            {fixture.elapsed != null ? `${fixture.elapsed}'` : "Live"}
                          </Badge>
                        )}
                        {fixture.status === "finished" && (
                          <span className="text-xs text-muted-foreground mt-1.5 font-medium uppercase">
                            FT
                          </span>
                        )}
                        {fixture.status === "scheduled" && fixture.venue && (
                          <span className="text-[10px] text-muted-foreground mt-1.5 text-center truncate max-w-[110px]">
                            {fixture.venue}
                          </span>
                        )}
                      </div>

                      <TeamSide name={fixture.awayTeam} logo={fixture.awayLogo} align="left" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <Calendar className="w-12 h-12 mb-4 opacity-20" />
            <p>No fixtures available right now.</p>
          </CardContent>
        </Card>
      )}

      {/* ── API-Sports Live Widgets ── */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold tracking-tight">Live Scores &amp; Standings</h2>

        <div className="rounded-xl overflow-hidden">
          <div
            id="wg-api-football-games"
            data-host="v3.football.api-sports.io"
            data-key={API_KEY}
            data-league="1"
            data-season="2026"
            data-theme="dark"
            data-refresh="60"
            data-show-toolbar="true"
            data-show-errors="false"
            data-show-logos="true"
            data-modal-game="true"
            data-modal-standings="true"
            data-modal-show-logos="true"
          />
        </div>

        <div className="rounded-xl overflow-hidden">
          <div
            id="wg-api-football-standings"
            data-host="v3.football.api-sports.io"
            data-key={API_KEY}
            data-league="1"
            data-season="2026"
            data-theme="dark"
            data-show-errors="false"
            data-show-logos="true"
          />
        </div>
      </div>
    </div>
  );
}
