import {
  useListLeagues,
  useGetLeagueLeaderboard,
  getListLeaguesQueryKey,
  useCreateLeague,
  useJoinLeague,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Trophy, ChevronRight, Plus, Copy, Check } from "lucide-react";
import { useState } from "react";
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

const MY_TEAM_ID = 1;

function InviteCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={(e) => { e.stopPropagation(); copy(); }}
      className="flex items-center gap-1.5 font-mono text-xs border px-2 py-1 rounded hover:bg-secondary/60 transition-colors"
      title="Click to copy invite code"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {code}
    </button>
  );
}

export function Leagues() {
  const { data: leagues, isLoading } = useListLeagues();
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);

  const { data: leaderboard, isLoading: isLoadingLeaderboard } =
    useGetLeagueLeaderboard(selectedLeagueId!, {
      query: { enabled: !!selectedLeagueId },
    });

  const queryClient = useQueryClient();
  const createLeague = useCreateLeague();
  const joinLeague = useJoinLeague();

  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdLeague, setCreatedLeague] = useState<{
    id: number;
    name: string;
    code: string;
  } | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createLeague.mutate(
      { data: { name: createName, description: createDesc } },
      {
        onSuccess: (newLeague) => {
          // Auto-join the creator then refresh
          joinLeague.mutate(
            { id: 0, data: { teamId: MY_TEAM_ID, code: newLeague.code ?? "" } },
            {
              onSettled: () => {
                queryClient.invalidateQueries({ queryKey: getListLeaguesQueryKey() });
              },
            }
          );
          setCreatedLeague({
            id: newLeague.id,
            name: newLeague.name,
            code: newLeague.code ?? "",
          });
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
      { id: 0, data: { teamId: MY_TEAM_ID, code: joinCode.trim().toUpperCase() } },
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
    <div className="space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leagues</h1>
          <p className="text-muted-foreground mt-1">Compete against friends and the world</p>
        </div>
        <div className="flex gap-2">
          {/* ── Join League ─────────────────────────────────────── */}
          <Dialog open={isJoinOpen} onOpenChange={(o) => { setIsJoinOpen(o); if (!o) { setJoinCode(""); setJoinError(""); } }}>
            <DialogTrigger asChild>
              <Button variant="outline">Join League</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join a League</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleJoin} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Invite Code</Label>
                  <Input
                    id="code"
                    value={joinCode}
                    onChange={(e) => { setJoinCode(e.target.value); setJoinError(""); }}
                    placeholder="e.g. X89Y2Z"
                    className="font-mono uppercase"
                    required
                  />
                  {joinError && <p className="text-sm text-destructive">{joinError}</p>}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={joinLeague.isPending || !joinCode.trim()}
                >
                  {joinLeague.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Joining…</>
                  ) : "Join League"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* ── Create League ────────────────────────────────────── */}
          <Dialog open={isCreateOpen} onOpenChange={(o) => { if (!o && !createdLeague) setIsCreateOpen(false); else setIsCreateOpen(o); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setCreatedLeague(null); setIsCreateOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Create League
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {createdLeague ? "League Created!" : "Create a League"}
                </DialogTitle>
              </DialogHeader>

              {createdLeague ? (
                /* ── Success state ── */
                <div className="space-y-5 pt-4">
                  <div className="text-center space-y-1">
                    <Trophy className="w-10 h-10 text-primary mx-auto mb-2" />
                    <p className="font-semibold text-lg">{createdLeague.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Share this code with friends so they can join:
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 bg-secondary/40 rounded-xl p-5">
                    <span className="font-mono text-3xl font-bold tracking-widest">
                      {createdLeague.code}
                    </span>
                    <CopyButton text={createdLeague.code} />
                  </div>
                  <Button className="w-full" onClick={handleDismissCreated}>
                    View League
                  </Button>
                </div>
              ) : (
                /* ── Create form ── */
                <form onSubmit={handleCreate} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="lname">League Name</Label>
                    <Input
                      id="lname"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="e.g. Office World Cup 2026"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desc">Description (optional)</Label>
                    <Input
                      id="desc"
                      value={createDesc}
                      onChange={(e) => setCreateDesc(e.target.value)}
                      placeholder="e.g. Office bragging rights"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createLeague.isPending || !createName.trim()}
                  >
                    {createLeague.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                    ) : "Create League"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* ── League list ─────────────────────────────────────────── */}
        <div className="md:col-span-1 space-y-4 overflow-y-auto pr-2 no-scrollbar">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !leagues?.length ? (
            <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
              <Trophy className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No leagues yet.</p>
              <p className="text-xs mt-1">Create one or join with a code!</p>
            </div>
          ) : (
            leagues.map((league) => (
              <Card
                key={league.id}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  selectedLeagueId === league.id
                    ? "border-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                    : "border-border"
                }`}
                onClick={() => setSelectedLeagueId(league.id)}
              >
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base flex justify-between items-center">
                    <span className="truncate">{league.name}</span>
                    {selectedLeagueId === league.id && (
                      <ChevronRight className="w-4 h-4 text-primary shrink-0 ml-2" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex justify-between items-center text-sm text-muted-foreground mt-1">
                    <span className="flex items-center">
                      <Users className="w-4 h-4 mr-1.5" />
                      {league.teamCount} {league.teamCount === 1 ? "team" : "teams"}
                    </span>
                    {league.code && <InviteCodeBadge code={league.code} />}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* ── Leaderboard ──────────────────────────────────────────── */}
        <div className="md:col-span-2">
          {selectedLeagueId ? (
            <Card className="h-full flex flex-col border-border shadow-xl">
              <CardHeader className="border-b border-border bg-secondary/20">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto no-scrollbar">
                {isLoadingLeaderboard ? (
                  <div className="flex justify-center items-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : !leaderboard?.length ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p>No teams in this league yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {leaderboard.map((entry) => (
                      <div
                        key={entry.teamId}
                        className={`flex items-center p-4 transition-colors hover:bg-secondary/30 ${
                          entry.rank <= 3 ? "bg-primary/5" : ""
                        }`}
                      >
                        <div
                          className={`w-8 font-mono font-bold text-center text-lg ${
                            entry.rank === 1
                              ? "text-yellow-500"
                              : entry.rank === 2
                              ? "text-slate-400"
                              : entry.rank === 3
                              ? "text-amber-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="font-bold text-foreground">{entry.teamName}</div>
                          <div className="text-sm text-muted-foreground">{entry.managerName}</div>
                        </div>
                        <div className="text-right pl-4">
                          <div className="font-mono font-bold text-xl text-primary">
                            {entry.totalPoints}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            GW: {entry.gameweekPoints ?? 0}
                          </div>
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
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="p-2 rounded-lg hover:bg-secondary/60 transition-colors"
      title="Copy code"
    >
      {copied ? (
        <Check className="w-5 h-5 text-green-500" />
      ) : (
        <Copy className="w-5 h-5 text-muted-foreground" />
      )}
    </button>
  );
}
