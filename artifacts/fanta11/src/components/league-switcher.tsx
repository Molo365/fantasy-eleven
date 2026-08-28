import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeagueContext } from "@/contexts/league";

export function LeagueSwitcher({ className = "" }: { className?: string }) {
  const {
    leagues,
    activeLeagueId,
    activeCompetitionLabel,
    setActiveLeagueId,
  } = useLeagueContext();

  if (leagues.length === 0) {
    return (
      <div className={`rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm ${className}`}>
        {activeCompetitionLabel}
      </div>
    );
  }

  return (
    <Select
      value={activeLeagueId ? String(activeLeagueId) : undefined}
      onValueChange={(value) => setActiveLeagueId(Number(value))}
    >
      <SelectTrigger className={`min-w-[220px] bg-secondary border-border ${className}`}>
        <SelectValue placeholder="Select active league" />
      </SelectTrigger>
      <SelectContent>
        {leagues.map((league) => (
          <SelectItem key={league.id} value={String(league.id)}>
            {league.name} · {league.competitionKey === "serie-a" ? "Serie A" : "Premier League"}
            {!league.isMember ? " (view only)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}