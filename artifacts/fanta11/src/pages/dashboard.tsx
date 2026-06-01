import { useGetDashboardSummary, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, Users, Wallet, Activity as ActivityIcon } from "lucide-react";

export function Dashboard() {
  // Hardcoded teamId for this MVP
  const teamId = 1;
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({ teamId });
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity({ teamId, limit: 10 });

  if (isLoadingSummary || isLoadingActivity) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-secondary rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-secondary rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground mt-1">Live match week overview</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-card-border overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              GW Points
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-foreground">
              {summary?.gameweekPoints || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total: {summary?.teamPoints || 0} pts
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Global Rank
              <Trophy className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-foreground">
              #{summary?.globalRank?.toLocaleString() || "-"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Top 1%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Captain
              <Users className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {summary?.captainName || "None Set"}
            </div>
            <p className="text-xs text-primary font-mono mt-1">
              {summary?.captainPoints ? `${summary.captainPoints * 2} pts (x2)` : "0 pts"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              Budget
              <Wallet className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-foreground">
              £{summary?.budgetRemaining?.toFixed(1) || "0.0"}m
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Available to spend
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
           <h2 className="text-xl font-bold flex items-center gap-2">
             <ActivityIcon className="text-primary h-5 w-5" /> Live Activity Feed
           </h2>
           <Card className="border-card-border">
             <div className="divide-y divide-border">
               {activity && activity.length > 0 ? (
                 activity.map((item) => (
                   <div key={item.id} className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                     <div>
                       <div className="font-bold">{item.playerName}</div>
                       <div className="text-sm text-muted-foreground">{item.description}</div>
                     </div>
                     <div className="font-mono text-primary font-bold">
                       +{item.points}
                     </div>
                   </div>
                 ))
               ) : (
                 <div className="p-8 text-center text-muted-foreground">
                   No recent activity to display.
                 </div>
               )}
             </div>
           </Card>
        </div>
        
        <div className="space-y-4">
           {/* Fixtures Placeholder */}
           <h2 className="text-xl font-bold">Top Scorer</h2>
           <Card className="border-card-border p-6 text-center">
              <div className="w-24 h-24 mx-auto rounded-full bg-secondary border-2 border-primary mb-4 flex items-center justify-center text-2xl">
                ⚽
              </div>
              <h3 className="font-bold text-xl">{summary?.topScorerName || "N/A"}</h3>
              <p className="text-primary font-mono text-lg mt-1">{summary?.topScorerPoints || 0} pts</p>
           </Card>
        </div>
      </div>
    </div>
  );
}
