import { useState } from "react";
import { useGetTeam, useGetTeamPlayers, useRemovePlayerFromTeam, getGetTeamPlayersQueryKey, useUpdateTeam, getGetTeamQueryKey, useListPlayers, useAddPlayerToTeam } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X, Search } from "lucide-react";
import { ListPlayersPosition } from "@workspace/api-zod";
import { ScrollArea } from "@/components/ui/scroll-area";

export function SquadBuilder() {
  const teamId = 1; // MVP hardcoded
  const { data: team, isLoading: isLoadingTeam } = useGetTeam(teamId, { query: { enabled: !!teamId, queryKey: getGetTeamQueryKey(teamId) } });
  const { data: teamPlayers, isLoading: isLoadingPlayers } = useGetTeamPlayers(teamId, { query: { enabled: !!teamId, queryKey: getGetTeamPlayersQueryKey(teamId) } });
  const removePlayer = useRemovePlayerFromTeam();
  const updateTeam = useUpdateTeam();
  const addPlayer = useAddPlayerToTeam();
  const queryClient = useQueryClient();

  const [activeSlot, setActiveSlot] = useState<{ position: string, slot: number } | null>(null);
  const [search, setSearch] = useState("");

  const { data: availablePlayers, isLoading: isLoadingAvailable } = useListPlayers({
    position: activeSlot?.position as ListPlayersPosition,
    search: search || undefined
  }, { query: { enabled: !!activeSlot }});

  const handleRemove = (playerId: number) => {
    removePlayer.mutate({ id: teamId, playerId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTeamPlayersQueryKey(teamId) });
      }
    });
  };

  const handleSetCaptain = (playerId: number) => {
    updateTeam.mutate({ id: teamId, data: { captainId: playerId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(teamId) });
      }
    });
  };
  
  const handleSetViceCaptain = (playerId: number) => {
    updateTeam.mutate({ id: teamId, data: { viceCaptainId: playerId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(teamId) });
      }
    });
  };

  const handleAddPlayer = (playerId: number, slot: number) => {
    addPlayer.mutate({ id: teamId, data: { playerId, slot } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTeamPlayersQueryKey(teamId) });
        setActiveSlot(null);
      }
    });
  };

  if (isLoadingTeam || isLoadingPlayers) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  const pitchLayout = [
    { position: 'GK', count: 1 },
    { position: 'DEF', count: 4 },
    { position: 'MID', count: 4 },
    { position: 'FWD', count: 2 },
  ];

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Squad Builder</h1>
          <p className="text-muted-foreground mt-1">Manage your starting 11</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Budget Remaining</div>
          <div className="text-2xl font-mono font-bold text-primary">£{team?.budget?.toFixed(1) || "0.0"}m</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-green-900 rounded-xl border border-green-800 relative overflow-hidden flex items-center justify-center p-4">
        {/* Pitch Lines */}
        <div className="absolute inset-4 border-2 border-white/20 rounded"></div>
        <div className="absolute inset-x-4 top-1/2 border-t-2 border-white/20"></div>
        <div className="absolute top-1/2 left-1/2 w-32 h-32 -mt-16 -ml-16 border-2 border-white/20 rounded-full"></div>
        <div className="absolute top-4 left-1/2 w-64 h-32 -ml-32 border-2 border-t-0 border-white/20"></div>
        <div className="absolute bottom-4 left-1/2 w-64 h-32 -ml-32 border-2 border-b-0 border-white/20"></div>
        
        {/* Players */}
        <div className="relative z-10 w-full max-w-4xl h-full flex flex-col justify-between py-8">
          {pitchLayout.map((row, rowIndex) => (
            <div key={row.position} className="flex justify-center items-center gap-4 sm:gap-8 w-full">
              {[...Array(row.count)].map((_, i) => {
                const globalSlotIndex = pitchLayout.slice(0, rowIndex).reduce((acc, curr) => acc + curr.count, 0) + i + 1;
                const playerRecord = teamPlayers?.find(p => p.slot === globalSlotIndex);
                
                return (
                  <div key={globalSlotIndex} className="flex flex-col items-center relative">
                    {playerRecord ? (
                      <div className="relative group">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-card rounded-full border-2 border-primary flex items-center justify-center text-xs font-bold shadow-lg text-center p-1 leading-tight flex-col overflow-hidden transition-transform group-hover:scale-105 cursor-pointer">
                          <span className="truncate w-full block">{playerRecord.player.name}</span>
                          <span className="text-muted-foreground text-[10px] mt-0.5">{playerRecord.player.clubShortName}</span>
                          <span className="text-primary font-mono text-[10px]">{playerRecord.player.totalPoints}pts</span>
                        </div>
                        {team?.captainId === playerRecord.playerId && (
                          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 border-card z-10">C</div>
                        )}
                        {team?.viceCaptainId === playerRecord.playerId && team?.captainId !== playerRecord.playerId && (
                          <div className="absolute -top-2 -right-2 bg-secondary text-secondary-foreground w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 border-card z-10">V</div>
                        )}
                        
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto flex z-50 overflow-hidden">
                          <button onClick={() => handleSetCaptain(playerRecord.playerId)} className="px-3 py-2 hover:bg-muted text-xs font-medium border-r border-border">Cap</button>
                          <button onClick={() => handleSetViceCaptain(playerRecord.playerId)} className="px-3 py-2 hover:bg-muted text-xs font-medium border-r border-border">Vice</button>
                          <button onClick={() => handleRemove(playerRecord.playerId)} className="px-3 py-2 hover:bg-destructive hover:text-destructive-foreground text-xs font-medium text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <Dialog open={activeSlot?.slot === globalSlotIndex} onOpenChange={(open) => !open && setActiveSlot(null)}>
                        <DialogTrigger asChild>
                          <button onClick={() => setActiveSlot({ position: row.position, slot: globalSlotIndex })} className="w-16 h-16 sm:w-20 sm:h-20 bg-black/40 backdrop-blur-sm rounded-full border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 hover:bg-black/60 hover:border-primary transition-colors cursor-pointer shadow-inner">
                            <Plus className="w-6 h-6" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle>Select {row.position}</DialogTitle>
                          </DialogHeader>
                          <div className="relative my-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder="Search player name..." 
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              className="pl-9"
                            />
                          </div>
                          <ScrollArea className="h-[400px] pr-4">
                            {isLoadingAvailable ? (
                              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                            ) : availablePlayers?.length === 0 ? (
                              <div className="text-center p-8 text-muted-foreground">No players found</div>
                            ) : (
                              <div className="space-y-2">
                                {availablePlayers?.map((p) => (
                                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                                    <div>
                                      <div className="font-bold">{p.name}</div>
                                      <div className="text-sm text-muted-foreground">{p.clubShortName}</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <div className="font-mono font-bold">£{p.price.toFixed(1)}m</div>
                                        <div className="text-xs text-primary font-mono">{p.totalPoints} pts</div>
                                      </div>
                                      <Button size="sm" onClick={() => handleAddPlayer(p.id, globalSlotIndex)} disabled={addPlayer.isPending}>
                                        Add
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    )}
                    <div className="mt-2 text-xs font-bold bg-black/50 px-2 py-0.5 rounded text-white backdrop-blur-sm shadow-sm border border-white/10">
                      {row.position}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
