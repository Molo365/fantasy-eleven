import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useListLeagues, type League } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";

type LeagueContextValue = {
  leagues: League[];
  isLoading: boolean;
  activeLeagueId: number | null;
  activeLeague: League | null;
  activeCompetitionKey: string;
  activeCompetitionLabel: string;
  activeTeamId: number;
  setActiveLeagueId: (leagueId: number) => void;
};

const LeagueContext = createContext<LeagueContextValue | null>(null);

const COMPETITION_LABELS: Record<string, string> = {
  "premier-league": "Premier League",
  "serie-a": "Serie A",
};

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const { authState } = useAuth();
  const { data, isLoading } = useListLeagues();
  const leagues = data ?? [];
  const user = authState.status === "authenticated" ? authState.user : null;
  const storageKey = user ? `fanta11.activeLeagueId.${user.id}` : null;
  const [activeLeagueId, setActiveLeagueIdState] = useState<number | null>(null);

  useEffect(() => {
    if (!storageKey) {
      setActiveLeagueIdState(null);
      return;
    }
    const stored = Number(window.localStorage.getItem(storageKey));
    setActiveLeagueIdState(Number.isInteger(stored) && stored > 0 ? stored : null);
  }, [storageKey]);

  const setActiveLeagueId = useCallback((leagueId: number) => {
    setActiveLeagueIdState(leagueId);
    if (storageKey) window.localStorage.setItem(storageKey, String(leagueId));
  }, [storageKey]);

  useEffect(() => {
    if (!user || leagues.length === 0) return;
    if (activeLeagueId && leagues.some((league) => league.id === activeLeagueId)) return;
    const preferred = leagues.find((league) => league.isMember) ?? leagues[0];
    setActiveLeagueId(preferred.id);
  }, [activeLeagueId, leagues, setActiveLeagueId, user]);

  const value = useMemo<LeagueContextValue>(() => {
    const activeLeague = leagues.find((league) => league.id === activeLeagueId) ?? null;
    const primaryTeam = user?.teams.find((team) => team.id === user.teamId) ?? user?.teams[0];
    const activeCompetitionKey = activeLeague?.competitionKey ?? primaryTeam?.competitionKey ?? "premier-league";
    const competitionTeam = user?.teams.find((team) => team.competitionKey === activeCompetitionKey);
    return {
      leagues,
      isLoading,
      activeLeagueId,
      activeLeague,
      activeCompetitionKey,
      activeCompetitionLabel: COMPETITION_LABELS[activeCompetitionKey] ?? activeCompetitionKey,
      activeTeamId: competitionTeam?.id ?? 0,
      setActiveLeagueId,
    };
  }, [activeLeagueId, isLoading, leagues, setActiveLeagueId, user]);

  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeagueContext() {
  const context = useContext(LeagueContext);
  if (!context) throw new Error("useLeagueContext must be used within LeagueProvider");
  return context;
}