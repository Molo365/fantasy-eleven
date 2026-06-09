import { useState } from "react";
import { useGetTeam, useGetTeamPlayers, useRemovePlayerFromTeam, getGetTeamPlayersQueryKey, useUpdateTeam, getGetTeamQueryKey, useListPlayers, useAddPlayerToTeam } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X, Search, Star } from "lucide-react";
import { ListPlayersPosition } from "@workspace/api-zod";
import { ScrollArea } from "@/components/ui/scroll-area";

// Electric blue — used for ALL circle borders
const BLUE = "#00d4ff";
const BLUE_GLOW = "0 0 14px rgba(0,212,255,0.6), 0 0 32px rgba(0,212,255,0.25)";
const BLUE_GLOW_STRONG = "0 0 20px rgba(0,212,255,0.8), 0 0 50px rgba(0,212,255,0.3)";

// Position accent colors — used only inside circles as subtle gradient tint
const POS_COLOR: Record<string, string> = {
  GK:  "#f59e0b",
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

  // Original order determines slot numbering (GK=1, DEF=2-5, MID=6-9, FWD=10-11)
  const pitchLayout = [
    { position: "GK",  count: 1 },
    { position: "DEF", count: 4 },
    { position: "MID", count: 4 },
    { position: "FWD", count: 2 },
  ];

  // Pre-compute starting slot per row
  const rows = pitchLayout.map((row, rowIndex) => ({
    ...row,
    startSlot: pitchLayout.slice(0, rowIndex).reduce((acc, r) => acc + r.count, 0) + 1,
  }));

  // Display portrait (attacking bottom→top): FWD at top, GK at bottom
  const displayRows = [...rows].reverse();

  const posColor = (pos: string) => POS_COLOR[pos] ?? "#94a3b8";

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Squad Builder</h1>
          <p className="text-muted-foreground mt-1">Manage your starting 11</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-1">Budget</div>
          <div style={{ fontSize: 26, fontFamily: "monospace", fontWeight: 800, color: BLUE, letterSpacing: "-0.02em", textShadow: `0 0 20px ${BLUE}80` }}>
            £{team?.budget?.toFixed(1) ?? "0.0"}m
          </div>
        </div>
      </div>

      {/* Portrait pitch — fills remaining vertical space, centred and capped in width */}
      <div className="flex-1 min-h-0 flex justify-center">
        <div
          className="relative rounded-2xl overflow-hidden w-full"
          style={{
            maxWidth: 480,
            minHeight: 480,
            border: `1px solid rgba(0,212,255,0.15)`,
            boxShadow: `0 0 60px rgba(0,0,0,0.7) inset, 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,255,0.08)`,
          }}
        >
          {/* Rotated pitch background — landscape → portrait */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: "160%",
              height: "160%",
              top: "-30%",
              left: "-30%",
              backgroundImage: "url('/pitch.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              transform: "rotate(90deg)",
              transformOrigin: "center",
            }}
          />

          {/* Vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.52) 100%)" }}
          />

          {/* Player rows: FWD (top) → GK (bottom) */}
          <div className="relative z-10 h-full flex flex-col justify-between py-5 px-2">
            {displayRows.map((row) => (
              <div key={row.position} className="flex justify-center items-end gap-2 sm:gap-6 w-full">
                {[...Array(row.count)].map((_, i) => {
                  const slot = row.startSlot + i;
                  const playerRecord = teamPlayers?.find((p) => p.slot === slot);
                  const pc = posColor(row.position);
                  const isCaptain = team?.captainId === playerRecord?.playerId;
                  const isVice = team?.viceCaptainId === playerRecord?.playerId && !isCaptain;

                  return (
                    <div key={slot} className="flex flex-col items-center" style={{ gap: 4, minWidth: 64 }}>
                      {playerRecord ? (
                        /* ── Filled slot ── */
                        <div className="relative group flex flex-col items-center" style={{ gap: 4 }}>
                          {/* Captain / Vice badge */}
                          {isCaptain && (
                            <div className="absolute -top-2 -right-1 z-20 w-5 h-5 rounded-full flex items-center justify-center text-xs font-black"
                              style={{ background: "#f59e0b", color: "#000", boxShadow: "0 0 8px rgba(245,158,11,0.9)", border: "1.5px solid rgba(255,255,255,0.4)", fontSize: 9 }}
                            >C</div>
                          )}
                          {isVice && (
                            <div className="absolute -top-2 -right-1 z-20 w-5 h-5 rounded-full flex items-center justify-center text-xs font-black"
                              style={{ background: "#94a3b8", color: "#0a0f1e", boxShadow: "0 0 6px rgba(148,163,184,0.7)", border: "1.5px solid rgba(255,255,255,0.3)", fontSize: 9 }}
                            >V</div>
                          )}

                          {/* Circle — electric blue border */}
                          <div
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center cursor-pointer transition-transform group-hover:scale-110"
                            style={{
                              background: `linear-gradient(145deg, rgba(8,17,40,0.90) 0%, ${pc}18 100%)`,
                              border: `2.5px solid ${BLUE}`,
                              boxShadow: BLUE_GLOW,
                              backdropFilter: "blur(8px)",
                            }}
                          >
                            {/* National code inside */}
                            <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: "0.05em" }}>
                              {playerRecord.player.clubShortName}
                            </span>
                            {/* Position mini-badge */}
                            <span style={{ fontSize: 8, color: pc, fontWeight: 700, letterSpacing: "0.1em", marginTop: 1 }}>
                              {row.position}
                            </span>
                          </div>

                          {/* Name & price BELOW circle */}
                          <div className="flex flex-col items-center" style={{ gap: 1, maxWidth: 72 }}>
                            <span
                              className="text-center font-bold text-white leading-tight"
                              style={{ fontSize: 9, maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
                            >
                              {playerRecord.player.name}
                            </span>
                            <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700, color: BLUE, textShadow: `0 0 6px ${BLUE}80` }}>
                              £{playerRecord.player.price.toFixed(1)}m
                            </span>
                          </div>

                          {/* Hover action bar */}
                          <div
                            className="absolute -bottom-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto flex z-50 rounded-lg overflow-hidden"
                            style={{ background: "rgba(8,17,40,0.96)", border: `1px solid ${BLUE}44`, backdropFilter: "blur(12px)", boxShadow: "0 4px 20px rgba(0,0,0,0.6)" }}
                          >
                            <button onClick={() => handleSetCaptain(playerRecord.playerId)}
                              className="px-2.5 py-1.5 text-xs font-bold transition-colors hover:bg-yellow-500/20"
                              style={{ color: "#f59e0b", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
                              <Star className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleSetViceCaptain(playerRecord.playerId)}
                              className="px-2.5 py-1.5 text-xs font-bold transition-colors hover:bg-slate-400/20"
                              style={{ color: "#94a3b8", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
                              V
                            </button>
                            <button onClick={() => handleRemove(playerRecord.playerId)}
                              className="px-2.5 py-1.5 text-xs font-bold transition-colors hover:bg-red-500/20"
                              style={{ color: "#ef4444" }}>
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── Empty slot ── */
                        <Dialog
                          open={activeSlot?.slot === slot}
                          onOpenChange={(open) => !open && setActiveSlot(null)}
                        >
                          <DialogTrigger asChild>
                            <button
                              onClick={() => setActiveSlot({ position: row.position, slot })}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all cursor-pointer"
                              style={{
                                background: "rgba(0,0,0,0.30)",
                                border: `2px solid ${BLUE}55`,
                                boxShadow: "0 0 10px rgba(0,0,0,0.4)",
                                backdropFilter: "blur(4px)",
                              }}
                              onMouseEnter={e => {
                                const el = e.currentTarget as HTMLButtonElement;
                                el.style.border = `2px solid ${BLUE}cc`;
                                el.style.boxShadow = BLUE_GLOW_STRONG;
                                el.style.background = "rgba(0,212,255,0.08)";
                              }}
                              onMouseLeave={e => {
                                const el = e.currentTarget as HTMLButtonElement;
                                el.style.border = `2px solid ${BLUE}55`;
                                el.style.boxShadow = "0 0 10px rgba(0,0,0,0.4)";
                                el.style.background = "rgba(0,0,0,0.30)";
                              }}
                            >
                              <Plus className="w-5 h-5" style={{ color: `${BLUE}88` }} />
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
                                        <div className="w-2 h-8 rounded-full shrink-0" style={{ background: pc, boxShadow: `0 0 6px ${pc}` }} />
                                        <div>
                                          <div className="font-bold text-sm">{p.name}</div>
                                          <div className="text-xs text-muted-foreground">{p.clubShortName} — {p.club}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div className="text-right">
                                          <div className="font-mono font-bold text-sm">£{p.price.toFixed(1)}m</div>
                                          <div className="text-xs font-mono" style={{ color: pc }}>{p.totalPoints} pts</div>
                                        </div>
                                        <Button size="sm" onClick={() => handleAddPlayer(p.id, slot)} disabled={addPlayer.isPending}>
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

                      {/* Position label row — only for empty slots (filled shows name/price) */}
                      {!playerRecord && (
                        <div
                          className="text-xs font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
                          style={{
                            background: `${pc}18`,
                            color: pc,
                            border: `1px solid ${pc}44`,
                            fontSize: 8,
                            letterSpacing: "0.12em",
                            textShadow: `0 0 8px ${pc}88`,
                          }}
                        >
                          {row.position}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
