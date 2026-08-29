import {
  useListLeagues,
  useGetLeagueLeaderboard,
  getListLeaguesQueryKey,
  getGetLeagueLeaderboardQueryKey,
  useCreateLeague,
  useJoinLeague,
  useGetTeamPlayers,
  getGetTeamPlayersQueryKey,
  useGetTeam,
  getGetTeamQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Trophy, ChevronRight, Plus, Copy, Check, Medal, ShieldHalf, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth";
import { useLeagueContext } from "@/contexts/league";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";

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
  const { data: team } = useGetTeam(teamId, { query: { enabled: teamId > 0, queryKey: getGetTeamQueryKey(teamId) } });
  const { data: players, isLoading } = useGetTeamPlayers(teamId, {
    query: { enabled: teamId > 0, queryKey: getGetTeamPlayersQueryKey(teamId) },
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

const COMPETITIONS = [
  { id: "premier-league", name: "Premier League", image: "/league-premier.png", available: true },
  { id: "serie-a", name: "Serie A", image: "/league-seriea.png", available: true },
  { id: "la-liga", name: "La Liga", image: "/league-laliga.png", available: false },
  { id: "bundesliga", name: "Bundesliga", image: "/league-bundesliga.png", available: false },
  { id: "ligue-1", name: "Ligue 1", image: "/league-ligue1.png", available: false },
];

const CREATE_STEP_LABELS = [
  "Competition",
  "Name and description",
  "Members and entry fee",
  "Prizes and privacy",
  "Review and create",
];

export function Leagues() {
  const [location] = useLocation();
  const { refresh } = useAuth();
  const { activeLeagueId: selectedLeagueId, setActiveLeagueId: setSelectedLeagueId } = useLeagueContext();

  const { data: leagues, isLoading } = useListLeagues();

  const { data: leaderboard, isLoading: isLoadingLeaderboard } =
    useGetLeagueLeaderboard(selectedLeagueId ?? 0, {
      query: { enabled: selectedLeagueId !== null && selectedLeagueId > 0, queryKey: getGetLeagueLeaderboardQueryKey(selectedLeagueId ?? 0) },
    });

  const selectedLeague = leagues?.find((l) => l.id === selectedLeagueId);

  const queryClient = useQueryClient();
  const createLeague = useCreateLeague();
  const joinLeague = useJoinLeague();

  // Wizard state
  const [createStep, setCreateStep] = useState(1);
  const [competitionKey, setCompetitionKey] = useState<"premier-league" | "serie-a" | "">("");
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [maxUnlimited, setMaxUnlimited] = useState(true);
  const [maxCount, setMaxCount] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [prize1st, setPrize1st] = useState("");
  const [prize2nd, setPrize2nd] = useState("");
  const [prize3rd, setPrize3rd] = useState("");
  const [showPrize2, setShowPrize2] = useState(false);
  const [showPrize3, setShowPrize3] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdLeague, setCreatedLeague] = useState<{ id: number; name: string; code: string } | null>(null);

  const resetCreateForm = () => {
    setCreateStep(1);
    setCompetitionKey("");
    setCreateName(""); setCreateDesc("");
    setMaxUnlimited(true); setMaxCount("");
    setEntryFee(""); setPrize1st(""); setPrize2nd(""); setPrize3rd("");
    setShowPrize2(false); setShowPrize3(false); setIsPublic(false);
  };

  useEffect(() => {
    const query = location.split("?")[1]?.split("#")[0] ?? "";
    const shouldOpenCreateWizard = new URLSearchParams(query).get("create") === "1";
    if (shouldOpenCreateWizard) {
      setCreatedLeague(null);
      resetCreateForm();
      setIsCreateOpen(true);
    }
  }, [location]);

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const [viewingTeam, setViewingTeam] = useState<{
    teamId: number; teamName: string; managerName: string;
  } | null>(null);

  const canContinue = () => {
    if (createStep === 1) return competitionKey !== "";
    if (createStep === 2) return createName.trim().length > 0;
    if (createStep === 3) return maxUnlimited || (parseInt(maxCount, 10) > 1);
    return true;
  };

  const handleNext = () => {
    if (canContinue() && createStep < 5) {
      setCreateStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (createStep > 1) {
      setCreateStep(prev => prev - 1);
    }
  };

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (competitionKey !== "premier-league" && competitionKey !== "serie-a") return;
    createLeague.mutate(
      {
        data: {
          name: createName,
          competitionKey: competitionKey,
          description: createDesc || undefined,
          maxMembers: (!maxUnlimited && maxCount) ? parseInt(maxCount, 10) : null,
          entryFee: entryFee.trim() || "Free",
          prize1st: prize1st.trim() || undefined,
          prize2nd: (showPrize2 && prize2nd.trim()) ? prize2nd.trim() : undefined,
          prize3rd: (showPrize3 && prize3rd.trim()) ? prize3rd.trim() : undefined,
          isPublic,
        },
      },
      {
        onSuccess: (newLeague) => {
          queryClient.invalidateQueries({ queryKey: getListLeaguesQueryKey() });
          void refresh();
          setSelectedLeagueId(newLeague.id);
          setCreatedLeague({ id: newLeague.id, name: newLeague.name, code: newLeague.code ?? "" });
          resetCreateForm();
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
      { id: 0, data: { code: joinCode.trim().toUpperCase() } },
      {
        onSuccess: (league) => {
          queryClient.invalidateQueries({ queryKey: getListLeaguesQueryKey() });
          void refresh();
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
              if (!o) { resetCreateForm(); }
              setIsCreateOpen(o);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => { setCreatedLeague(null); resetCreateForm(); setIsCreateOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Create League
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden gap-0">
              {/* Dialog header */}
              <div style={{
                background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                padding: "20px 24px 16px",
              }}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <Trophy className="w-4 h-4 text-primary" />
                    {createdLeague ? "League Created!" : "Create a League"}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    {createdLeague
                      ? "Your league has been created. Copy the invite code or view the league."
                      : "Configure the competition, details, entry settings, prizes, and privacy for your league."}
                  </DialogDescription>
                </DialogHeader>
              </div>

              {createdLeague ? (
                <div className="p-6 space-y-5">
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
                <div className="flex flex-col h-full max-h-[75vh]">
                  {/* Step indicator */}
                  <div
                    className="px-6 pt-5 pb-3 bg-card border-b border-border"
                    data-testid="step-indicator"
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={CREATE_STEP_LABELS.length}
                    aria-valuenow={createStep}
                    aria-valuetext={`Step ${createStep} of ${CREATE_STEP_LABELS.length}: ${CREATE_STEP_LABELS[createStep - 1]}`}
                  >
                    <span className="sr-only">
                      Step {createStep} of {CREATE_STEP_LABELS.length}: {CREATE_STEP_LABELS[createStep - 1]}
                    </span>
                    <div className="flex justify-between items-center gap-2 relative" aria-hidden="true">
                      <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-secondary/50 -z-10" />
                      {[1, 2, 3, 4, 5].map((step) => (
                        <div key={step} className="flex flex-col items-center gap-1 bg-card px-1">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                            createStep === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                            createStep > step ? "bg-primary text-primary-foreground" :
                            "bg-secondary text-muted-foreground"
                          }`} aria-current={createStep === step ? "step" : undefined}>
                            {createStep > step ? <Check className="w-3 h-3" /> : step}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <ScrollArea className="flex-1 p-6">
                    {createStep === 1 && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div>
                          <h3 className="text-lg font-bold">Select Competition</h3>
                          <p className="text-sm text-muted-foreground">Choose the tournament for this league.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {COMPETITIONS.map((comp) => {
                            const isSelected = competitionKey === comp.id;
                            return (
                              <button
                                type="button"
                                key={comp.id}
                                data-testid={`competition-card-${comp.id}`}
                                aria-pressed={comp.available ? isSelected : undefined}
                                aria-label={`${comp.name}${comp.available ? "" : ", coming soon"}`}
                                disabled={!comp.available}
                                onClick={() => {
                                  if (comp.available) {
                                    setCompetitionKey(comp.id as "premier-league" | "serie-a");
                                  }
                                }}
                                className={`relative rounded-xl border-2 p-3 transition-all flex flex-col items-center gap-2 text-center overflow-hidden
                                  ${comp.available ? "cursor-pointer hover:border-primary/50" : "opacity-60 grayscale cursor-not-allowed disabled:pointer-events-none"}
                                  ${comp.available
                                    ? (isSelected ? "border-primary bg-[#806d32]" : "border-border bg-[#685526]")
                                    : (isSelected ? "border-primary bg-primary/5" : "border-border bg-card")}
                                `}
                              >
                                {isSelected && (
                                  <div className="absolute top-2 right-2 w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3" />
                                  </div>
                                )}
                                <div className="h-12 w-full flex items-center justify-center">
                                  <img src={comp.image} alt={comp.name} className="max-h-full max-w-[80%] object-contain drop-shadow-md" />
                                </div>
                                <span className="font-semibold text-sm">{comp.name}</span>
                                {!comp.available && (
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-sm">
                                    Coming soon
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {createStep === 2 && (
                      <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div>
                          <h3 className="text-lg font-bold">Name & Description</h3>
                          <p className="text-sm text-muted-foreground">Give your league an identity.</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lname" className="text-sm font-semibold">League Name <span className="text-destructive">*</span></Label>
                          <Input
                            id="lname"
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                            placeholder="e.g. Office WC 2026"
                            autoFocus
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="desc" className="text-sm font-semibold">
                            Description <span className="text-muted-foreground font-normal">(optional)</span>
                          </Label>
                          <Textarea
                            id="desc"
                            value={createDesc}
                            onChange={(e) => setCreateDesc(e.target.value)}
                            placeholder="Rules, trash talk, context for the league..."
                            rows={3}
                            className="resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {createStep === 3 && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div>
                          <h3 className="text-lg font-bold">Stakes & Limits</h3>
                          <p className="text-sm text-muted-foreground">Set the rules of entry.</p>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold">Max Members</Label>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setMaxUnlimited(true)}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                                maxUnlimited ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                              }`}
                            >
                              Unlimited
                            </button>
                            <button
                              type="button"
                              onClick={() => { setMaxUnlimited(false); if (!maxCount) setMaxCount("10"); }}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                                !maxUnlimited ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                              }`}
                            >
                              Set limit
                            </button>
                            {!maxUnlimited && (
                              <Input
                                type="number"
                                min={2}
                                max={500}
                                value={maxCount}
                                onChange={(e) => setMaxCount(e.target.value)}
                                placeholder="e.g. 10"
                                className="w-24 font-mono"
                                autoFocus
                              />
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="fee" className="text-sm font-semibold">Entry Fee</Label>
                          <Input
                            id="fee"
                            value={entryFee}
                            onChange={(e) => setEntryFee(e.target.value)}
                            placeholder="Free"
                          />
                          <p className="text-xs text-muted-foreground">Leave blank for free. Type any amount, e.g. "$20" or "£10".</p>
                        </div>
                      </div>
                    )}

                    {createStep === 4 && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div>
                          <h3 className="text-lg font-bold">Prizes & Privacy</h3>
                          <p className="text-sm text-muted-foreground">What are they playing for?</p>
                        </div>

                        <div className="space-y-3 p-4 bg-secondary/20 rounded-xl border border-border">
                          <div className="flex items-center gap-3">
                            <span className="w-12 text-center text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 py-1 rounded">1st</span>
                            <Input value={prize1st} onChange={(e) => setPrize1st(e.target.value)} placeholder="e.g. $100 or Winner's Trophy" className="bg-card" />
                          </div>

                          {showPrize2 && (
                            <div className="flex items-center gap-3">
                              <span className="w-12 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-400/10 py-1 rounded">2nd</span>
                              <Input value={prize2nd} onChange={(e) => setPrize2nd(e.target.value)} placeholder="e.g. $50" className="bg-card" />
                            </div>
                          )}

                          {showPrize3 && (
                            <div className="flex items-center gap-3">
                              <span className="w-12 text-center text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-700/10 py-1 rounded">3rd</span>
                              <Input value={prize3rd} onChange={(e) => setPrize3rd(e.target.value)} placeholder="e.g. $25" className="bg-card" />
                            </div>
                          )}

                          <div className="flex gap-2 pt-1">
                            {!showPrize2 && (
                              <button type="button" onClick={() => setShowPrize2(true)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                                <Plus className="w-3 h-3" /> Add 2nd place
                              </button>
                            )}
                            {showPrize2 && !showPrize3 && (
                              <button type="button" onClick={() => setShowPrize3(true)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                                <Plus className="w-3 h-3" /> Add 3rd place
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl border border-border">
                          <div>
                            <Label htmlFor="league-privacy" className="text-sm font-semibold">
                              {isPublic ? "Public League" : "Private (invite only)"}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {isPublic ? "Anyone can find and join." : "Only people with the invite code."}
                            </p>
                          </div>
                          <Switch id="league-privacy" checked={isPublic} onCheckedChange={setIsPublic} />
                        </div>
                      </div>
                    )}

                    {createStep === 5 && (
                      <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div>
                          <h3 className="text-lg font-bold">Review & Create</h3>
                          <p className="text-sm text-muted-foreground">Ready to kick off?</p>
                        </div>

                        <div className="space-y-4 rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-card rounded-lg border flex items-center justify-center p-1 shrink-0">
                              <img src={COMPETITIONS.find(c => c.id === competitionKey)?.image} alt="" className="max-w-full max-h-full object-contain" />
                            </div>
                            <div>
                              <div className="font-bold text-lg leading-tight">{createName}</div>
                              <div className="text-sm text-muted-foreground">{COMPETITIONS.find(c => c.id === competitionKey)?.name}</div>
                            </div>
                          </div>

                          {createDesc && (
                            <p className="text-sm italic text-muted-foreground border-l-2 border-primary/30 pl-3">"{createDesc}"</p>
                          )}

                          <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
                            <div>
                              <div className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">Entry</div>
                              <div className="font-medium">{entryFee || "Free"}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">Capacity</div>
                              <div className="font-medium">{maxUnlimited ? "Unlimited" : `${maxCount} teams max`}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">Privacy</div>
                              <div className="font-medium flex items-center gap-1.5">
                                {isPublic ? "Public" : "Private"}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">Prizes</div>
                              {prize1st || prize2nd || prize3rd ? (
                                <div className="space-y-1 font-medium">
                                  {prize1st && <div>1st: {prize1st}</div>}
                                  {showPrize2 && prize2nd && <div>2nd: {prize2nd}</div>}
                                  {showPrize3 && prize3rd && <div>3rd: {prize3rd}</div>}
                                </div>
                              ) : (
                                <div className="font-medium">None specified</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </ScrollArea>

                  {/* Footer actions */}
                  <div className="p-4 bg-card border-t border-border flex items-center justify-between gap-3">
                    {createStep > 1 ? (
                      <Button type="button" variant="outline" onClick={handleBack} data-testid="action-back">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                    ) : (
                      <div /> /* spacer */
                    )}

                    {createStep < 5 ? (
                      <Button type="button" onClick={handleNext} disabled={!canContinue()} data-testid="action-continue">
                        Continue <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    ) : (
                      <Button type="button" onClick={handleCreate} disabled={createLeague.isPending} data-testid="action-create-league">
                        {createLeague.isPending
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                          : "Create League"}
                      </Button>
                    )}
                  </div>
                </div>
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
                  <CardContent className="p-4 pt-0 space-y-2">
                    {/* Stakes row: entry fee + prizes */}
                    {((league.entryFee && league.entryFee !== "Free") || league.prize1st) && (
                      <div className="flex flex-wrap gap-1.5">
                        {league.entryFee && league.entryFee !== "Free" && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                            padding: "2px 7px", borderRadius: 99,
                            background: "rgba(251,191,36,0.12)",
                            border: "1px solid rgba(251,191,36,0.35)",
                            color: "#fbbf24",
                          }}>
                            💰 {league.entryFee}
                          </span>
                        )}
                        {league.prize1st && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                            padding: "2px 7px", borderRadius: 99,
                            background: "rgba(245,158,11,0.1)",
                            border: "1px solid rgba(245,158,11,0.3)",
                            color: "#f59e0b",
                          }}>
                            🥇 {league.prize1st}
                          </span>
                        )}
                        {league.prize2nd && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                            padding: "2px 7px", borderRadius: 99,
                            background: "rgba(148,163,184,0.1)",
                            border: "1px solid rgba(148,163,184,0.22)",
                            color: "#94a3b8",
                          }}>
                            🥈 {league.prize2nd}
                          </span>
                        )}
                        {league.prize3rd && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                            padding: "2px 7px", borderRadius: 99,
                            background: "rgba(205,127,50,0.1)",
                            border: "1px solid rgba(205,127,50,0.25)",
                            color: "#cd7f32",
                          }}>
                            🥉 {league.prize3rd}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {league.teamCount}
                        {league.maxMembers ? ` / ${league.maxMembers}` : ""}
                        {" "}{league.teamCount === 1 ? "team" : "teams"}
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
