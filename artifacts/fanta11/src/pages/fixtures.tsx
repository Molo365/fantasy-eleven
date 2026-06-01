import { useListGameweeks, useGetGameweekFixtures } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";

export function Fixtures() {
  const { data: gameweeks, isLoading: isLoadingGW } = useListGameweeks();
  const [selectedGwId, setSelectedGwId] = useState<number | null>(null);

  // Auto-select the current/next active gameweek
  useEffect(() => {
    if (gameweeks && gameweeks.length > 0 && !selectedGwId) {
      const activeGw = gameweeks.find(gw => gw.status === 'active') || gameweeks.find(gw => gw.status === 'upcoming') || gameweeks[gameweeks.length - 1];
      if (activeGw) setSelectedGwId(activeGw.id);
    }
  }, [gameweeks, selectedGwId]);

  const { data: fixtures, isLoading: isLoadingFixtures } = useGetGameweekFixtures(selectedGwId!, {
    query: { enabled: !!selectedGwId }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fixtures</h1>
        <p className="text-muted-foreground mt-1">Match schedules and live scores</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {isLoadingGW ? (
           <Loader2 className="w-6 h-6 animate-spin text-primary" />
        ) : (
          gameweeks?.map((gw) => (
            <button
              key={gw.id}
              onClick={() => setSelectedGwId(gw.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors border ${
                selectedGwId === gw.id 
                  ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              GW {gw.number}
              {gw.status === 'active' && <span className="ml-2 w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse"></span>}
            </button>
          ))
        )}
      </div>

      <Card className="border-border overflow-hidden">
        <CardHeader className="bg-secondary/30 border-b border-border">
          <CardTitle className="flex justify-between items-center text-lg">
            <span>Gameweek Fixtures</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingFixtures ? (
             <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : fixtures && fixtures.length > 0 ? (
            <div className="divide-y divide-border">
              {fixtures.map((fixture) => (
                <div key={fixture.id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between hover:bg-secondary/10 transition-colors gap-4">
                  <div className="flex-1 flex justify-end w-full sm:w-auto font-medium text-lg text-right truncate pr-4">
                    {fixture.homeTeam}
                  </div>
                  
                  <div className="flex flex-col items-center justify-center min-w-[120px] shrink-0">
                    {fixture.status === 'scheduled' ? (
                      <div className="bg-secondary px-4 py-2 rounded-md font-mono text-sm border border-border">
                        {format(new Date(fixture.kickoff), "HH:mm")}
                      </div>
                    ) : (
                      <div className={`px-4 py-2 rounded-md font-mono text-xl font-bold flex gap-3 border ${fixture.status === 'live' ? 'bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(var(--primary),0.2)]' : 'bg-secondary border-border'}`}>
                        <span>{fixture.homeScore ?? '-'}</span>
                        <span className="text-muted-foreground font-sans text-sm self-center">-</span>
                        <span>{fixture.awayScore ?? '-'}</span>
                      </div>
                    )}
                    {fixture.status === 'live' && (
                      <Badge variant="destructive" className="mt-2 text-[10px] uppercase font-bold animate-pulse">Live</Badge>
                    )}
                    {fixture.status === 'finished' && (
                      <span className="text-xs text-muted-foreground mt-2 font-medium uppercase">FT</span>
                    )}
                    {fixture.status === 'scheduled' && (
                       <span className="text-xs text-muted-foreground mt-2">{format(new Date(fixture.kickoff), "EEE, d MMM")}</span>
                    )}
                  </div>

                  <div className="flex-1 flex justify-start w-full sm:w-auto font-medium text-lg truncate pl-4">
                    {fixture.awayTeam}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <Calendar className="w-12 h-12 mb-4 opacity-20" />
              <p>No fixtures found for this gameweek.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
