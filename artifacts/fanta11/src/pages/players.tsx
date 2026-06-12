import { useState } from "react";
import { useListPlayers, useGetTopPlayers, useGetPlayerNations } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, TrendingUp, Star } from "lucide-react";
import { ListPlayersPosition } from "@workspace/api-zod";

export function Players() {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<string>("ALL");
  const [nation, setNation] = useState<string>("ALL");

  const { data: nations } = useGetPlayerNations();

  const { data: players, isLoading } = useListPlayers({ 
    search: search || undefined,
    position: position !== "ALL" ? (position as ListPlayersPosition) : undefined,
    club: nation !== "ALL" ? nation : undefined,
    limit: 100,
  });

  const { data: topPlayers, isLoading: isLoadingTop } = useGetTopPlayers({ limit: 3 });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Player Pool</h1>
        <p className="text-muted-foreground mt-1">Discover, analyze, and recruit</p>
      </div>

      <style>{`
        .players-top-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
        @media (max-width: 767px) { .players-top-grid { grid-template-columns: minmax(0, 1fr); } }
        @media (min-width: 768px) { .players-top-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      `}</style>
      <div className="players-top-grid">
        {isLoadingTop ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-32 bg-secondary rounded-lg animate-pulse" />)
        ) : (
          topPlayers?.map((player, index) => (
            <Card key={player.id} className="border-primary/20 bg-primary/5 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 text-9xl text-primary/10 font-bold italic tracking-tighter group-hover:scale-110 transition-transform">
                {index + 1}
              </div>
              <CardHeader className="pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-primary fill-primary" /> Top Performer</span>
                  <Badge variant="outline" className="font-mono">{player.position}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-2xl font-bold truncate">{player.name}</div>
                <div className="flex justify-between items-end mt-2">
                  <div className="text-sm text-muted-foreground">{player.club}</div>
                  <div className="text-xl font-mono text-primary font-bold">{player.totalPoints} <span className="text-sm font-sans font-normal text-muted-foreground">pts</span></div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search players by name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
          <Select value={nation} onValueChange={setNation}>
            <SelectTrigger className="w-[180px] bg-secondary border-none">
              <SelectValue placeholder="Nation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Nations</SelectItem>
              {nations?.map(n => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger className="w-[160px] bg-secondary border-none">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Positions</SelectItem>
              <SelectItem value="GK">Goalkeepers</SelectItem>
              <SelectItem value="DEF">Defenders</SelectItem>
              <SelectItem value="MID">Midfielders</SelectItem>
              <SelectItem value="FWD">Forwards</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="w-[250px]">Player</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Pos</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Selected</TableHead>
                <TableHead className="text-right">Form</TableHead>
                <TableHead className="text-right">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell>
                </TableRow>
              ) : players?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">No players found matching your criteria.</TableCell>
                </TableRow>
              ) : (
                players?.map((player) => (
                  <TableRow key={player.id} className="hover:bg-secondary/30 transition-colors group">
                    <TableCell className="font-medium">
                      {player.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{player.clubShortName || player.club}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">{player.position}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">£{player.price.toFixed(1)}m</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{player.selected?.toFixed(1) || "0.0"}%</TableCell>
                    <TableCell className="text-right font-mono">
                      {player.form && player.form >= 5 ? (
                        <span className="text-primary flex items-center justify-end gap-1"><TrendingUp className="w-3 h-3" /> {player.form.toFixed(1)}</span>
                      ) : (
                        <span className="text-muted-foreground">{player.form?.toFixed(1) || "0.0"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-foreground">{player.totalPoints}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
