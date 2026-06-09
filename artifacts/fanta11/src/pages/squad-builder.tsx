import { useState } from "react";
import { useGetTeam, useGetTeamPlayers, useRemovePlayerFromTeam, getGetTeamPlayersQueryKey, useUpdateTeam, getGetTeamQueryKey, useListPlayers, useAddPlayerToTeam } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X, Search, Star } from "lucide-react";
import { ListPlayersPosition } from "@workspace/api-zod";
import { ScrollArea } from "@/components/ui/scroll-area";

const POS_COLOR: Record<string, string> = {
  GK: "#f59e0b",
  DEF: "#22c55e",
  MID: "#06b6d4",
  FWD: "#f97316",
};

export function SquadBuilder() {
  const teamId = 1;
  const { data: team, isLoading: isLoadingTeam } = useGetTeam(teamId, { query: { enabled: !!teamId, queryKey: getGetTeamQueryKey(teamId) } });
  const { data: teamPlayers, isLoading: isLoadingPlayers } = useGetTeamPlayers(teamId, { query: { enabled: !!teamId, queryKey: getGetTeamPlayersQueryKey(teamId) } });
  const removePlayer = useRemovePlayerFromTeam();
  const updateTeam = useUpdateTeam();
  const addPlayer = useAddPlayerToTeam();
  const queryClient = useQueryClient();

  const [activeSlot, setActiveSlot] = useState<{ position: string; slot: number } | null>(null);
  const [search, setSearch] = useState("");

  const { data: availablePlayers, isLoading: isLoadingAvailable } = useListPlayers(
    { position: activeSlot?.position as ListPlayersPosition, search: search || undefined },
    { query: { enabled: !!activeSlot } }
  );

  const handleRemove = (playerId: number) => {
    removePlayer.mutate({ id: teamId, playerId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetTeamPlayersQueryKey(teamId) }),
    });
  };

  const handleSetCaptain = (playerId: number) => {
    updateTeam.mutate({ id: teamId, data: { captainId: playerId } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(teamId) }),
    });
  };

  const handleSetViceCaptain = (playerId: number) => {
    updateTeam.mutate({ id: teamId, data: { viceCaptainId: playerId } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(teamId) }),
    });
  };

  const handleAddPlayer = (playerId: number, slot: number) => {
    addPlayer.mutate({ id: teamId, data: { playerId, slot } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTeamPlayersQueryKey(teamId) });
        setActiveSlot(null);
      },
    });
  };

  if (isLoadingTeam || isLoadingPlayers) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  const pitchLayout = [
    { position: "GK", count: 1 },
    { position: "DEF", count: 4 },
    { position: "MID", count: 4 },
    { position: "FWD", count: 2 },
  ];

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Squad Builder</h1>
          <p className="text-muted-foreground mt-1">Manage your starting 11</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-1">Budget Remaining</div>
          <div style={{ fontSize: 28, fontFamily: "monospace", fontWeight: 800, color: "#06b6d4", letterSpacing: "-0.02em", textShadow: "0 0 20px rgba(6,182,212,0.5)" }}>
            £{team?.budget?.toFixed(1) ?? "0.0"}m
          </div>
        </div>
      </div>

      {/* Pitch */}
      <div
        className="flex-1 min-h-0 rounded-xl overflow-hidden relative flex items-center justify-center"
        style={{
          backgroundImage: "url('/pitch.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 0 60px rgba(0,0,0,0.6) inset, 0 8px 32px rgba(0,0,0,0.4)",
          minHeight: 420,
        }}
      >
        {/* Subtle dark vignette overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.45) 100%)",
          }}
        />

        {/* Players Grid */}
        <div className="relative z-10 w-full max-w-3xl h-full flex flex-col justify-between py-6 px-4" style={{ gap: 0 }}>
          {pitchLayout.map((row, rowIndex) => (
            <div key={row.position} className="flex justify-center items-center gap-4 sm:gap-10 w-full">
              {[...Array(row.count)].map((_, i) => {
                const globalSlotIndex =
                  pitchLayout.slice(0, rowIndex).reduce((acc, curr) => acc + curr.count, 0) + i + 1;
                const playerRecord = teamPlayers?.find((p) => p.slot === globalSlotIndex);
                const posColor = POS_COLOR[row.position] ?? "#94a3b8";
                const isCaptain = team?.captainId === playerRecord?.playerId;
                const isVice = team?.viceCaptainId === playerRecord?.playerId && !isCaptain;

                return (
                  <div key={globalSlotIndex} className="flex flex-col items-center gap-1.5">
                    {playerRecord ? (
                      <div className="relative group flex flex-col items-center">
                        {/* Captain / Vice badge */}
                        {isCaptain && (
                          <div
                            className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                            style={{
                              background: "#f59e0b",
                              color: "#000",
                              boxShadow: "0 0 10px rgba(245,158,11,0.8)",
                              border: "1.5px solid rgba(255,255,255,0.3)",
                            }}
                          >
                            C
                          </div>
                        )}
                        {isVice && (
                          <div
                            className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                            style={{
                              background: "#94a3b8",
                              color: "#0a0f1e",
                              boxShadow: "0 0 8px rgba(148,163,184,0.6)",
                              border: "1.5px solid rgba(255,255,255,0.3)",
                            }}
                          >
                            V
                          </div>
                        )}

                        {/* Player circle */}
                        <div
                          className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full flex flex-col items-center justify-center text-center cursor-pointer transition-transform group-hover:scale-110"
                          style={{
                            background: `linear-gradient(145deg, rgba(8,17,40,0.92), rgba(13,27,62,0.88))`,
                            border: `2px solid ${posColor}`,
                            boxShadow: `0 0 16px ${posColor}66, 0 0 40px ${posColor}22, inset 0 1px 0 rgba(255,255,255,0.08)`,
                            backdropFilter: "blur(8px)",
                            padding: "4px",
                          }}
                        >
                          <span
                            className="block font-bold leading-tight text-white"
                            style={{ fontSize: 9, lineHeight: 1.2, letterSpacing: "0.01em", maxWidth: 54, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          >
                            {playerRecord.player.name}
                          </span>
                          <span style={{ fontSize: 8, color: "#94a3b8", marginTop: 1 }}>
                            {playerRecord.player.clubShortName}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              fontFamily: "monospace",
                              color: posColor,
                              marginTop: 2,
                              textShadow: `0 0 6px ${posColor}`,
                            }}
                          >
                            £{playerRecord.player.price.toFixed(1)}m
                          </span>
                        </div>

                        {/* Hover action bar */}
                        <div
                          className="absolute -bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto flex z-50 rounded-lg overflow-hidden"
                          style={{
                            background: "rgba(8,17,40,0.95)",
                            border: "1px solid rgba(6,182,212,0.3)",
                            backdropFilter: "blur(12px)",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
                          }}
                        >
                          <button
                            onClick={() => handleSetCaptain(playerRecord.playerId)}
                            className="px-3 py-1.5 text-xs font-bold transition-colors hover:bg-yellow-500/20"
                            style={{ color: "#f59e0b", borderRight: "1px solid rgba(255,255,255,0.1)" }}
                          >
                            <Star className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleSetViceCaptain(playerRecord.playerId)}
                            className="px-3 py-1.5 text-xs font-bold transition-colors hover:bg-slate-400/20"
                            style={{ color: "#94a3b8", borderRight: "1px solid rgba(255,255,255,0.1)" }}
                          >
                            V
                          </button>
                          <button
                            onClick={() => handleRemove(playerRecord.playerId)}
                            className="px-3 py-1.5 text-xs font-bold transition-colors hover:bg-red-500/20"
                            style={{ color: "#ef4444" }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <Dialog
                        open={activeSlot?.slot === globalSlotIndex}
                        onOpenChange={(open) => !open && setActiveSlot(null)}
                      >
                        <DialogTrigger asChild>
                          <button
                            onClick={() => setActiveSlot({ position: row.position, slot: globalSlotIndex })}
                            className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center transition-all cursor-pointer group/empty"
                            style={{
                              background: "rgba(0,0,0,0.3)",
                              border: `2px dashed ${posColor}55`,
                              backdropFilter: "blur(4px)",
                              boxShadow: `0 0 12px rgba(0,0,0,0.4)`,
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLButtonElement).style.border = `2px dashed ${posColor}cc`;
                              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 16px ${posColor}33`;
                              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.5)";
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLButtonElement).style.border = `2px dashed ${posColor}55`;
                              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 12px rgba(0,0,0,0.4)";
                              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.3)";
                            }}
                          >
                            <Plus className="w-5 h-5" style={{ color: `${posColor}99` }} />
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
                              <div className="flex justify-center p-8">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                              </div>
                            ) : availablePlayers?.length === 0 ? (
                              <div className="text-center p-8 text-muted-foreground">No players found</div>
                            ) : (
                              <div className="space-y-2">
                                {availablePlayers?.map((p) => (
                                  <div
                                    key={p.id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="w-2 h-8 rounded-full shrink-0"
                                        style={{ background: posColor, boxShadow: `0 0 6px ${posColor}` }}
                                      />
                                      <div>
                                        <div className="font-bold text-sm">{p.name}</div>
                                        <div className="text-xs text-muted-foreground">{p.clubShortName}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <div className="font-mono font-bold text-sm">£{p.price.toFixed(1)}m</div>
                                        <div className="text-xs font-mono" style={{ color: posColor }}>{p.totalPoints} pts</div>
                                      </div>
                                      <Button
                                        size="sm"
                                        onClick={() => handleAddPlayer(p.id, globalSlotIndex)}
                                        disabled={addPlayer.isPending}
                                      >
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

                    {/* Position label */}
                    <div
                      className="text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                      style={{
                        background: `${posColor}18`,
                        color: posColor,
                        border: `1px solid ${posColor}44`,
                        fontSize: 9,
                        letterSpacing: "0.12em",
                        textShadow: `0 0 8px ${posColor}88`,
                      }}
                    >
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
