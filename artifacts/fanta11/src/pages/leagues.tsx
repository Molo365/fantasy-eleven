import { useListLeagues, useGetLeagueLeaderboard, getListLeaguesQueryKey, useCreateLeague, useJoinLeague } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Users, Trophy, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";

export function Leagues() {
  const { data: leagues, isLoading } = useListLeagues();
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);

  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useGetLeagueLeaderboard(selectedLeagueId!, {
    query: { enabled: !!selectedLeagueId }
  });

  const queryClient = useQueryClient();
  const createLeague = useCreateLeague();
  const joinLeague = useJoinLeague();

  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const teamId = 1;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createLeague.mutate({ data: { name: createName, description: createDesc } }, {
      onSuccess: (newLeague) => {
        queryClient.invalidateQueries({ queryKey: getListLeaguesQueryKey() });
        setIsCreateOpen(false);
        setCreateName("");
        setCreateDesc("");
        setSelectedLeagueId(newLeague.id);
      }
    });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    joinLeague.mutate({ id: 0, data: { teamId, code: joinCode } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeaguesQueryKey() });
        setIsJoinOpen(false);
        setJoinCode("");
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leagues</h1>
          <p className="text-muted-foreground mt-1">Compete against friends and the world</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Join League</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join a League</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleJoin} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="code">League Code</Label>
                  <Input id="code" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="e.g. x89y2" required />
                </div>
                <Button type="submit" className="w-full" disabled={joinLeague.isPending || !joinCode}>Join League</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Create League</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a League</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">League Name</Label>
                  <Input id="name" value={createName} onChange={e => setCreateName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description (Optional)</Label>
                  <Input id="desc" value={createDesc} onChange={e => setCreateDesc(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={createLeague.isPending || !createName}>Create League</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="md:col-span-1 space-y-4 overflow-y-auto pr-2 no-scrollbar">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : leagues?.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">You are not in any leagues yet.</div>
          ) : (
            leagues?.map((league) => (
              <Card 
                key={league.id} 
                className={`cursor-pointer transition-all hover:border-primary/50 ${selectedLeagueId === league.id ? 'border-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]' : 'border-border'}`}
                onClick={() => setSelectedLeagueId(league.id)}
              >
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-lg flex justify-between items-center">
                    {league.name}
                    {selectedLeagueId === league.id && <ChevronRight className="w-4 h-4 text-primary" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex justify-between items-center text-sm text-muted-foreground mt-2">
                    <span className="flex items-center"><Users className="w-4 h-4 mr-1.5" />{league.teamCount} teams</span>
                    {league.code && <span className="font-mono text-xs border px-1.5 py-0.5 rounded">Code: {league.code}</span>}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

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
                  <div className="flex justify-center items-center h-48"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : leaderboard?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No teams in this league yet.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {leaderboard?.map((entry) => (
                      <div key={entry.teamId} className={`flex items-center p-4 transition-colors hover:bg-secondary/30 ${entry.rank <= 3 ? 'bg-primary/5' : ''}`}>
                        <div className={`w-8 font-mono font-bold text-center ${entry.rank === 1 ? 'text-primary' : entry.rank === 2 ? 'text-muted-foreground' : entry.rank === 3 ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}>
                          {entry.rank}
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="font-bold text-foreground">{entry.teamName}</div>
                          <div className="text-sm text-muted-foreground">{entry.managerName}</div>
                        </div>
                        <div className="text-right pl-4">
                          <div className="font-mono font-bold text-xl text-primary">{entry.totalPoints}</div>
                          <div className="text-xs text-muted-foreground">GW: {entry.gameweekPoints || 0}</div>
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
