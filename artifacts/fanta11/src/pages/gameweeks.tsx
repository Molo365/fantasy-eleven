import { useState, useEffect } from "react";
import { History, Trophy, Shield, AlertCircle, Loader2 } from "lucide-react";
import {
  useListFinishedGameweeks,
  useGetGameweekHistory,
  getGetGameweekHistoryQueryKey,
  GameweekHistoryLineupPlayer,
  GameweekHistoryLeaderboardEntry
} from "@workspace/api-client-react";
import { getPremierLeaguePhotoUrl } from "@/lib/player-photo";

const POS_COLORS: Record<string, string> = {
  GK: "#f59e0b",
  DEF: "#06b6d4",
  MID: "#a78bfa",
  FWD: "#22c55e",
};

function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-xl flex flex-col justify-center transition-all hover:bg-white/5" style={{ background: "rgba(8,17,40,0.68)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <span className="text-[10px] text-blue-300/60 font-bold uppercase tracking-widest">{label}</span>
      <span className="text-lg font-black text-white mt-1">{value}</span>
    </div>
  );
}

function HistoryPlayerCard({ p }: { p: GameweekHistoryLineupPlayer }) {
  const [photoState, setPhotoState] = useState<"primary" | "premier-league" | "failed">("primary");
  useEffect(() => setPhotoState("primary"), [p.imageUrl]);
  const premierLeagueUrl = getPremierLeaguePhotoUrl(p.imageUrl);
  const photoSrc = photoState === "primary"
    ? p.imageUrl
    : photoState === "premier-league"
      ? premierLeagueUrl
      : null;
  const posColor  = POS_COLORS[p.position] ?? "#64748b";
  const showPhoto = !!photoSrc;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors" style={{
      background: "rgba(26,44,84,0.42)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div className="relative w-10 h-10 flex-shrink-0">
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-black text-[10px] tracking-wider"
             style={{ border: `2px solid ${posColor}`, background: showPhoto ? "#0a1628" : `${posColor}2e`, color: posColor }}>
          {showPhoto ? (
            <img src={photoSrc!} alt={p.name} loading="lazy"
                 onError={() => setPhotoState(c => c === "primary" && premierLeagueUrl ? "premier-league" : "failed")}
                 className="w-full h-full object-cover object-top" />
          ) : playerInitials(p.name)}
        </div>
        {p.crestUrl && (
          <img src={p.crestUrl} alt="" loading="lazy"
               className="absolute -bottom-1 -right-1 w-4 h-4 object-contain rounded-full p-[2px]"
               style={{ background: "rgba(5,12,30,0.9)", border: "1px solid rgba(255,255,255,0.12)" }} />
        )}
        {p.isCaptain && (
          <div className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full font-black text-[8px] bg-amber-500 text-black z-10 shadow-sm">C</div>
        )}
        {p.isViceCaptain && !p.isCaptain && (
          <div className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full font-black text-[8px] bg-slate-500 text-white z-10 shadow-sm">V</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-slate-200 truncate">{p.name}</div>
        <div className="text-[10px] font-black tracking-widest mt-0.5" style={{ color: posColor }}>{p.position}</div>
      </div>
      <div className="text-right flex-shrink-0">
        {p.points !== null && p.points !== undefined ? (
          <div className="tabular-nums font-black text-sm" style={{ color: p.points > 0 ? "#22c55e" : "#8fa3c9" }}>
            {p.points} <span className="text-[10px] text-slate-400 font-bold ml-0.5">pts</span>
          </div>
        ) : (
          <div className="text-slate-500 font-black px-2 opacity-60">—</div>
        )}
      </div>
    </div>
  );
}

function LeaderboardRow({ entry }: { entry: GameweekHistoryLeaderboardEntry }) {
  const isMe = entry.isCurrentUserTeam;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isMe ? 'ring-1 ring-blue-500/50 bg-blue-500/15 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : 'hover:bg-white/5 bg-transparent'}`}>
      <div className="w-8 text-center flex-shrink-0">
        <span className={`font-black ${entry.rank === 1 ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : entry.rank === 2 ? 'text-slate-300' : entry.rank === 3 ? 'text-amber-700' : 'text-slate-500'}`}>
          {entry.rank}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-bold text-sm truncate ${isMe ? 'text-white' : 'text-slate-200'}`}>{entry.teamName}</div>
        <div className={`text-[10px] truncate ${isMe ? 'text-blue-300/80 font-bold' : 'text-slate-400 font-medium'}`}>@{entry.managerName}</div>
      </div>
      <div className={`text-right flex-shrink-0 font-black tabular-nums text-sm ${isMe ? 'text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]' : 'text-blue-300/80'}`}>
        {entry.points} <span className="text-[10px] font-bold text-slate-500 ml-0.5">pts</span>
      </div>
    </div>
  );
}

export function Gameweeks() {
  const { data: gameweeks, isLoading: isGwLoading, isError: isGwError } = useListFinishedGameweeks();
  const [selectedGwId, setSelectedGwId] = useState<number | null>(null);

  useEffect(() => {
    if (gameweeks && gameweeks.length > 0 && selectedGwId === null) {
      const latest = [...gameweeks].sort((a, b) => b.number - a.number)[0];
      setSelectedGwId(latest.id);
    }
  }, [gameweeks, selectedGwId]);

  const { data: history, isLoading: isHistoryLoading, isError: isHistoryError } = useGetGameweekHistory(
    selectedGwId!,
    { query: { enabled: !!selectedGwId, queryKey: selectedGwId ? getGetGameweekHistoryQueryKey(selectedGwId) : [] } }
  );

  if (isGwError) {
    return (
      <div className="p-8 text-center text-red-400 bg-red-500/10 rounded-xl border border-red-500/20 max-w-md mx-auto mt-10">
        <AlertCircle className="mx-auto mb-3" size={32} />
        <p className="font-bold">Failed to load gameweeks</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-white drop-shadow-md flex items-center gap-3">
          <History className="text-blue-400" size={28} />
          Gameweek History
        </h1>
        <p className="text-blue-300/60 text-sm mt-2 font-medium tracking-wide">
          Review past performance, final lineups, and standings.
        </p>
      </div>

      {isGwLoading && (
        <div className="flex gap-3 overflow-x-hidden pb-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="w-24 h-10 rounded-xl bg-white/10 animate-pulse border border-white/5" />)}
        </div>
      )}

      {gameweeks && gameweeks.length === 0 && (
        <div className="p-12 text-center rounded-2xl mt-8 animate-in zoom-in-95 duration-500" style={{ background: "rgba(8,17,40,0.68)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <History className="mx-auto mb-5 text-blue-500/40" size={48} />
          <h3 className="text-xl font-black text-white mb-2 tracking-wide">No History Yet</h3>
          <p className="text-blue-200/60 max-w-md mx-auto text-sm font-medium">Finished gameweeks will appear here. Check back after the current gameweek concludes to view final standings.</p>
        </div>
      )}

      {gameweeks && gameweeks.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] animate-in fade-in duration-700">
          {gameweeks.slice().sort((a, b) => b.number - a.number).map((gw) => {
            const isSelected = gw.id === selectedGwId;
            return (
              <button
                key={gw.id}
                onClick={() => setSelectedGwId(gw.id)}
                className={`
                  snap-start whitespace-nowrap px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-300 flex-shrink-0
                  ${isSelected
                    ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-400'
                    : 'bg-white/5 text-blue-300/60 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'
                  }
                `}
              >
                GW {gw.number}
              </button>
            );
          })}
        </div>
      )}

      {selectedGwId && isHistoryLoading && (
        <div className="py-20 flex flex-col items-center justify-center text-blue-500/50">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p className="font-black uppercase tracking-widest text-xs">Loading Gameweek...</p>
        </div>
      )}

      {isHistoryError && !isHistoryLoading && (
         <div className="p-8 text-center text-red-400 bg-red-500/10 rounded-xl border border-red-500/20 max-w-md mx-auto mt-6">
           <AlertCircle className="mx-auto mb-3" size={32} />
           <p className="font-bold">Failed to load this gameweek's history.</p>
         </div>
      )}

      {history && !isHistoryLoading && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Round" value={history.gameweek.name} />
            <StatCard label="Status" value={history.gameweek.status} />
            <StatCard label="Avg Points" value={history.gameweek.averagePoints ?? "—"} />
            <StatCard label="Top Score" value={history.gameweek.highestPoints ?? "—"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-4">
               <div className="flex items-center justify-between">
                 <h2 className="text-lg font-black uppercase tracking-widest text-slate-200 flex items-center gap-2">
                   <Shield className="text-blue-400" size={20} />
                   Your Lineup
                 </h2>
                 {history.myTeam && (
                   <div className="text-sm font-black text-white bg-blue-600 px-3 py-1 rounded-lg border border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                     {history.myTeam.totalPoints} pts
                   </div>
                 )}
               </div>

               {history.myTeam && history.myTeam.players.length > 0 ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {history.myTeam.players.slice().sort((a, b) => a.slot - b.slot).map(p => <HistoryPlayerCard p={p} key={p.playerId} />)}
                 </div>
               ) : (
                 <div className="p-10 text-center rounded-2xl" style={{ background: "rgba(8,17,40,0.68)", border: "1px solid rgba(255,255,255,0.07)" }}>
                   <Shield className="mx-auto mb-4 text-slate-600" size={40} />
                   <p className="text-slate-300 font-bold text-lg mb-1">No Lineup Found</p>
                   <p className="text-slate-500 font-medium text-sm">You didn't have a team submitted for this gameweek.</p>
                 </div>
               )}
            </div>

            <div className="flex flex-col gap-4">
               <div className="flex items-center justify-between">
                 <h2 className="text-lg font-black uppercase tracking-widest text-slate-200 flex items-center gap-2">
                   <Trophy className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" size={20} />
                   Leaderboard
                 </h2>
               </div>

               <div className="rounded-2xl p-2 flex flex-col gap-1 overflow-hidden" style={{ background: "rgba(8,17,40,0.68)", border: "1px solid rgba(255,255,255,0.07)" }}>
                 {history.leaderboard.length > 0 ? (
                   history.leaderboard.map(entry => <LeaderboardRow entry={entry} key={entry.teamId} />)
                 ) : (
                   <div className="p-8 text-center text-slate-500 text-sm font-medium">
                     No leaderboard data available for this round.
                   </div>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
