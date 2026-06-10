import {
  useListLeagues,
  useGetLeagueLeaderboard,
  getListLeaguesQueryKey,
  useCreateLeague,
  useJoinLeague,
  useGetTeamPlayers,
  useGetTeam,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Trophy, ChevronRight, Plus, Copy, Check, Medal, ShieldHalf } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth";
import { ScrollArea } from "@/components/ui/scroll-area";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-2 rounded-lg hover:bg-secondary/60 transition-colors" title="Copy code">
      {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
    </button>
  );
}

function InviteCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 font-mono text-xs border px-2 py-1 rounded hover:bg-secondary/60 transition-colors"
      title="Click to copy invite code"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {code}
    </button>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return (
    <span className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-mono font-bold text-sm text-muted-foreground">
      {rank}
    </span>
  );
}

/* ── Position metadata ─────────────────────────────────────────── */
const POS_COLOR: Record<string, string> = {
  GK: "#f59e0b", DEF: "#22c55e", MID: "#06b6d4", FWD: "#f43f5e",
};
const POS_ORDER = ["GK", "DEF", "MID", "FWD"];
const POS_LABEL: Record<string, string> = {
  GK: "Goalkeepers", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards",
};

/* ── Squad viewer dialog ───────────────────────────────────────── */
function SquadViewDialog({
  teamId,
  managerName,
  teamName,
  onClose,
}: {
  teamId: number;
  managerName: string;
  teamName: string;
  onClose: () => void;
}) {
  const { data: team } = useGetTeam(teamId, { query: { enabled: teamId > 0 } });
  const { data: players, isLoading } = useGetTeamPlayers(teamId, {
    query: { enabled: teamId > 0 },
  });

  const captainId   = team?.captainId   ?? null;
  const viceCaptainId = team?.viceCaptainId ?? null;

  // Group players by position, bench GK last
  const BENCH_SLOT = 15;
  const byPosition = POS_ORDER.map((pos) => ({
    pos,
    players: (players ?? []).filter((p) => p.player.position === pos && p.slot !== BENCH_SLOT),
  })).filter((g) => g.players.length > 0);
  const benchGk = (players ?? []).find((p) => p.slot === BENCH_SLOT);

  const totalValue = (players ?? []).reduce((sum, p) => sum + p.player.price, 0);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "20px 24px 16px",
        }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <ShieldHalf className="w-4 h-4 text-primary" />
              {teamName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-muted-foreground">
              Manager: <span className="font-semibold text-foreground">{managerName}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Squad value: <span className="font-mono font-bold text-sky-400">£{totalValue.toFixed(1)}m</span>
            </span>
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !players?.length ? (
            <div className="text-center py-14 text-muted-foreground">
              <ShieldHalf className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No players picked yet</p>
            </div>
          ) : (
            <div className="py-2">
              {byPosition.map(({ pos, players: group }) => (
                <div key={pos}>
                  {/* Position header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 20px 4px",
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                      textTransform: "uppercase", color: POS_COLOR[pos],
                      background: `${POS_COLOR[pos]}18`,
                      border: `1px solid ${POS_COLOR[pos]}33`,
                      borderRadius: 4, padding: "2px 7px",
                    }}>
                      {POS_LABEL[pos]}
                    </span>
                    <div style={{ flex: 1, height: 1, background: `${POS_COLOR[pos]}18` }} />
                  </div>

                  {/* Player rows */}
                  {group.map((tp) => {
                    const isCap  = tp.playerId === captainId;
                    const isVice = tp.playerId === viceCaptainId && !isCap;
                    return (
                      <div
                        key={tp.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto auto",
                          alignItems: "center",
                          gap: 12,
                          padding: "8px 20px",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        {/* Name + nation */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {tp.player.name}
                            </span>
                            {isCap && (
                              <span style={{
                                fontSize: 9, fontWeight: 900, background: "#f59e0b",
                                color: "#000", borderRadius: 99, padding: "1px 5px",
                                flexShrink: 0, boxShadow: "0 0 8px rgba(245,158,11,0.6)",
                              }}>C</span>
                            )}
                            {isVice && (
                              <span style={{
                                fontSize: 9, fontWeight: 900, background: "rgba(148,163,184,0.25)",
                                color: "#94a3b8", border: "1px solid rgba(148,163,184,0.4)",
                                borderRadius: 99, padding: "1px 5px", flexShrink: 0,
                              }}>V</span>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: "#64748b" }}>{tp.player.club}</span>
                        </div>

                        {/* Points */}
                        <div style={{ textAlign: "right", minWidth: 36 }}>
                          <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: POS_COLOR[pos] }}>
                            {tp.player.totalPoints} pts
                          </div>
                        </div>

                        {/* Price */}
                        <div style={{ textAlign: "right", minWidth: 44 }}>
                          <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#38bdf8" }}>
                            £{tp.player.price.toFixed(1)}m
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Bench GK */}
              {benchGk && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 20px 4px" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                      textTransform: "uppercase", color: "#64748b",
                      background: "rgba(100,116,139,0.12)",
                      border: "1px solid rgba(100,116,139,0.25)",
                      borderRadius: 4, padding: "2px 7px",
                    }}>
                      Bench GK
                    </span>
                    <div style={{ flex: 1, height: 1, background: "rgba(100,116,139,0.12)" }} />
                  </div>
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr auto auto",
                    alignItems: "center", gap: 12, padding: "8px 20px",
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {benchGk.player.name}
                      </div>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{benchGk.player.club}</span>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 36 }}>
                      <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: "#64748b" }}>
                        {benchGk.player.totalPoints} pts
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 44 }}>
                      <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#38bdf8" }}>
                        £{benchGk.player.price.toFixed(1)}m
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function Leagues() {
  const { authState } = useAuth();
  const myTeamId = authState.status === "authenticated" ? (authState.user.teamId ?? 0) : 0;

  const { data: leagues, isLoading } = useListLeagues();
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);

  // Auto-select first league that has members when the list loads
  useEffect(() => {
    if (leagues && leagues.length > 0 && selectedLeagueId === null) {
      const firstWithMembers = leagues.find((l) => (l.teamCount ?? 0) > 0) ?? leagues[0];
      setSelectedLeagueId(firstWithMembers.id);
    }
  }, [leagues, selectedLeagueId]);

  const { data: leaderboard, isLoading: isLoadingLeaderboard } =
    useGetLeagueLeaderboard(selectedLeagueId ?? 0, {
      query: { enabled: selectedLeagueId !== null && selectedLeagueId > 0 },
    });

  const selectedLeague = leagues?.find((l) => l.id === selectedLeagueId);

  const queryClient = useQueryClient();
  const createLeague = useCreateLeague();
  const joinLeague = useJoinLeague();

  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdLeague, setCreatedLeague] = useState<{ id: number; name: string; code: string } | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const [viewingTeam, setViewingTeam] = useState<{
    teamId: number; teamName: string; managerName: string;
  } | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createLeague.mutate(
      { data: { name: createName, description: createDesc } },
      {
        onSuccess: (newLeague) => {
          joinLeague.mutate(
            { id: 0, data: { teamId: myTeamId, code: newLeague.code ?? "" } },
            {
              onSettled: () => {
                queryClient.invalidateQueries({ queryKey: getListLeaguesQueryKey() });
              },
            }
          );
          setCreatedLeague({ id: newLeague.id, name: newLeague.name, code: newLeague.code ?? "" });
          setCreateName("");
          setCreateDesc("");
        },
      }
    );
  };

  const handleDismissCreated = () => {
    if (createdLeague) setSelectedLeagueId(createdLeague.id);
    setCreatedLeague(null);
    setIsCreateOpen(false);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");
    joinLeague.mutate(
      { id: 0, data: { teamId: myTeamId, code: joinCode.trim().toUpperCase() } },
      {
        onSuccess: (league) => {
          queryClient.invalidateQueries({ queryKey: getListLeaguesQueryKey() });
          setIsJoinOpen(false);
          setJoinCode("");
          setSelectedLeagueId(league.id);
        },
        onError: () => {
          setJoinError("Invalid code — check it and try again.");
        },
      }
    );
  };

  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col" style={{ position: "relative", zIndex: 0 }}>
      {/* Full-viewport background — fixed so it covers behind the sidebar & padding */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          backgroundImage: "url('/old-trafford.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* 85% dark overlay */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(5,10,20,0.85)" }} />
      </div>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leagues</h1>
          <p className="text-muted-foreground mt-1">Compete against friends and the world</p>
        </div>
        <div className="flex gap-2">
          {/* Join League */}
          <Dialog
            open={isJoinOpen}
            onOpenChange={(o) => {
              setIsJoinOpen(o);
              if (!o) { setJoinCode(""); setJoinError(""); }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">Join League</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Join a League</DialogTitle></DialogHeader>
              <form onSubmit={handleJoin} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Invite Code</Label>
                  <Input
                    id="code"
                    value={joinCode}
                    onChange={(e) => { setJoinCode(e.target.value); setJoinError(""); }}
                    placeholder="e.g. X89Y2Z"
                    className="font-mono uppercase tracking-widest"
                    required
                  />
                  {joinError && <p className="text-sm text-destructive">{joinError}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={joinLeague.isPending || !joinCode.trim()}>
                  {joinLeague.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Joining…</> : "Join League"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Create League */}
          <Dialog
            open={isCreateOpen}
            onOpenChange={(o) => {
              if (!o && createdLeague) { handleDismissCreated(); return; }
              setIsCreateOpen(o);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => { setCreatedLeague(null); setIsCreateOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Create League
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{createdLeague ? "League Created!" : "Create a League"}</DialogTitle>
              </DialogHeader>

              {createdLeague ? (
                <div className="space-y-5 pt-4">
                  <div className="text-center space-y-1">
                    <Trophy className="w-10 h-10 text-primary mx-auto mb-2" />
                    <p className="font-semibold text-lg">{createdLeague.name}</p>
                    <p className="text-sm text-muted-foreground">Share this code so friends can join:</p>
                  </div>
                  <div className="flex items-center justify-center gap-3 bg-secondary/40 rounded-xl p-5">
                    <span className="font-mono text-3xl font-bold tracking-widest">{createdLeague.code}</span>
                    <CopyButton text={createdLeague.code} />
                  </div>
                  <Button className="w-full" onClick={handleDismissCreated}>View League</Button>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="lname">League Name</Label>
                    <Input id="lname" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Office WC 2026" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desc">Description (optional)</Label>
                    <Input id="desc" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="e.g. Office bragging rights" />
                  </div>
                  <Button type="submit" className="w-full" disabled={createLeague.isPending || !createName.trim()}>
                    {createLeague.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create League"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* ── League list ──────────────────────────────────────── */}
        <div className="md:col-span-1 space-y-3 overflow-y-auto pr-2 no-scrollbar">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : !leagues?.length ? (
            <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
              <Trophy className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No leagues yet.</p>
              <p className="text-xs mt-1">Create one or join with a code!</p>
            </div>
          ) : (
            leagues.map((league) => {
              const isActive = selectedLeagueId === league.id;
              return (
                <Card
                  key={league.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    isActive ? "border-primary shadow-[0_0_15px_rgba(var(--primary),0.15)]" : "border-border"
                  }`}
                  onClick={() => setSelectedLeagueId(league.id)}
                >
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base flex justify-between items-center">
                      <span className="truncate">{league.name}</span>
                      {isActive && <ChevronRight className="w-4 h-4 text-primary shrink-0 ml-2" />}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex justify-between items-center text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {league.teamCount} {league.teamCount === 1 ? "team" : "teams"}
                      </span>
                      {league.code && <InviteCodeBadge code={league.code} />}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* ── Leaderboard ───────────────────────────────────────── */}
        <div className="md:col-span-2">
          {selectedLeagueId ? (
            <Card className="h-full flex flex-col border-border shadow-xl">
              <CardHeader className="border-b border-border bg-secondary/20 py-3 px-5">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-base">
                    <Trophy className="w-4 h-4 text-primary" />
                    {selectedLeague?.name ?? "Leaderboard"}
                  </span>
                  {selectedLeague?.code && (
                    <span className="flex items-center gap-1.5 font-mono text-xs border px-2 py-1 rounded text-muted-foreground font-normal">
                      <Copy className="w-3 h-3" />
                      {selectedLeague.code}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>

              {/* Column headers */}
              <div className="grid grid-cols-[40px_1fr_90px_90px] gap-2 px-5 py-2 border-b border-border bg-secondary/10 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div className="text-center">Rank</div>
                <div>Manager / Team</div>
                <div className="text-right">Total Pts</div>
                <div className="text-right">GW Pts</div>
              </div>

              <CardContent className="p-0 flex-1 overflow-y-auto no-scrollbar">
                {isLoadingLeaderboard ? (
                  <div className="flex justify-center items-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : !leaderboard?.length ? (
                  <div className="p-10 text-center text-muted-foreground">
                    <Medal className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No teams in this league yet.</p>
                    <p className="text-xs mt-1">Share the invite code to get people in!</p>
                    {selectedLeague?.code && (
                      <div className="mt-4 inline-flex items-center gap-2 bg-secondary/50 rounded-lg px-4 py-2">
                        <span className="font-mono font-bold tracking-widest">{selectedLeague.code}</span>
                        <CopyButton text={selectedLeague.code} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {leaderboard.map((entry) => (
                      <div
                        key={entry.teamId}
                        onClick={() => setViewingTeam({
                          teamId: entry.teamId,
                          teamName: entry.teamName,
                          managerName: entry.managerName,
                        })}
                        className={`grid grid-cols-[40px_1fr_90px_90px] gap-2 items-center px-5 py-3.5 transition-colors cursor-pointer hover:bg-secondary/40 active:bg-secondary/60 ${
                          entry.rank <= 3 ? "bg-primary/5" : ""
                        }`}
                      >
                        {/* Rank */}
                        <div className="flex justify-center">
                          <RankBadge rank={entry.rank} />
                        </div>

                        {/* Team / Manager */}
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {entry.teamName}
                          </div>
                          <div className="text-xs text-muted-foreground truncate hover:text-primary/80">
                            {entry.managerName}
                          </div>
                        </div>

                        {/* Total Points */}
                        <div className="text-right">
                          <div className="font-mono font-bold text-lg text-primary">{entry.totalPoints}</div>
                        </div>

                        {/* GW Points */}
                        <div className="text-right">
                          <div className="font-mono text-sm text-muted-foreground">{entry.gameweekPoints ?? 0}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-xl bg-secondary/10">
              <div className="text-center">
                <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Select a league to view its leaderboard</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Squad viewer — opens when a leaderboard row is clicked */}
    {viewingTeam && (
      <SquadViewDialog
        teamId={viewingTeam.teamId}
        teamName={viewingTeam.teamName}
        managerName={viewingTeam.managerName}
        onClose={() => setViewingTeam(null)}
      />
    )}
    </>
  );
}
