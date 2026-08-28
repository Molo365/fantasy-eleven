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
  setActiveLeagueId: (leagueId: number | null) => void;
  setActiveCompetitionKey: (key: string) => void;
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

  const [activeLeagueIdState, setActiveLeagueIdState] = useState<number | null>(null);
  const [explicitCompetitionKey, setExplicitCompetitionKey] = useState<string | null>(null);

  useEffect(() => {
    if (!storageKey) {
      setActiveLeagueIdState(null);
      return;
    }
    const stored = Number(window.localStorage.getItem(storageKey));
    setActiveLeagueIdState(Number.isInteger(stored) && stored > 0 ? stored : null);
  }, [storageKey]);

  const setActiveLeagueId = useCallback((leagueId: number | null) => {
    setActiveLeagueIdState(leagueId);
    if (leagueId !== null) {
      if (storageKey) window.localStorage.setItem(storageKey, String(leagueId));
      // Clear explicit constraint when picking a specific league so we infer the competition from the league itself
      setExplicitCompetitionKey(null);
    }
  }, [storageKey]);

  const setActiveCompetitionKey = useCallback((key: string) => {
    setExplicitCompetitionKey(key);
  }, []);

  useEffect(() => {
    if (!user || leagues.length === 0) return;

    let currentLeague = activeLeagueIdState ? leagues.find((l) => l.id === activeLeagueIdState) : null;

    if (currentLeague && explicitCompetitionKey && currentLeague.competitionKey !== explicitCompetitionKey) {
        // Active league doesn't match explicitly requested competition, reset it for the search
        currentLeague = null;
    } else if (currentLeague) {
        // Valid active league found that matches constraints
        return;
    }

    const candidates = explicitCompetitionKey
      ? leagues.filter(l => l.competitionKey === explicitCompetitionKey)
      : leagues;

    if (candidates.length === 0) {
        if (activeLeagueIdState !== null) {
            setActiveLeagueIdState(null);
        }
        return;
    }

    const preferred = candidates.find((league) => league.isMember) ?? candidates[0];
    setActiveLeagueIdState(preferred.id);
    if (storageKey) window.localStorage.setItem(storageKey, String(preferred.id));
  }, [activeLeagueIdState, leagues, user, explicitCompetitionKey, storageKey]);

  const value = useMemo<LeagueContextValue>(() => {
    const activeLeague = activeLeagueIdState ? (leagues.find((league) => league.id === activeLeagueIdState) ?? null) : null;
    const primaryTeam = user?.teams.find((team) => team.id === user.teamId) ?? user?.teams[0];
    const activeCompetitionKey = explicitCompetitionKey ?? activeLeague?.competitionKey ?? primaryTeam?.competitionKey ?? "premier-league";
    const competitionTeam = user?.teams.find((team) => team.competitionKey === activeCompetitionKey);
    return {
      leagues,
      isLoading,
      activeLeagueId: activeLeagueIdState,
      activeLeague,
      activeCompetitionKey,
      activeCompetitionLabel: COMPETITION_LABELS[activeCompetitionKey] ?? activeCompetitionKey,
      activeTeamId: competitionTeam?.id ?? 0,
      setActiveLeagueId,
      setActiveCompetitionKey,
    };
  }, [activeLeagueIdState, explicitCompetitionKey, isLoading, leagues, setActiveLeagueId, setActiveCompetitionKey, user]);

  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeagueContext() {
  const context = useContext(LeagueContext);
  if (!context) throw new Error("useLeagueContext must be used within LeagueProvider");
  return context;
}