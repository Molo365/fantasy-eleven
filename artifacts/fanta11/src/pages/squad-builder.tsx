import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import {
  useGetTeam, useGetTeamPlayers, useRemovePlayerFromTeam,
  getGetTeamPlayersQueryKey, useUpdateTeam, getGetTeamQueryKey,
  useListPlayers, getListPlayersQueryKey, useAddPlayerToTeam,
  type TeamPlayer,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, X, Info, Star } from "lucide-react";
import { ListPlayersPosition } from "@workspace/api-client-react";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ─── National team kit colours ─────────────────────────────────── */
const KIT: Record<string, [string, string]> = {
  "Argentina":    ["#75AADB", "#FFFFFF"],
  "Australia":    ["#FFD700", "#006341"],
  "Belgium":      ["#CE1126", "#000000"],
  "Brazil":       ["#009C3B", "#FFD700"],
  "Cameroon":     ["#007A5E", "#CE1126"],
  "Canada":       ["#E8192C", "#FFFFFF"],
  "Colombia":     ["#FCD116", "#003087"],
  "Costa Rica":   ["#002B7F", "#CE1126"],
  "Croatia":      ["#FF2233", "#FFFFFF"],
  "Denmark":      ["#C60C30", "#FFFFFF"],
  "Ecuador":      ["#FFD100", "#003893"],
  "England":      ["#FFFFFF", "#CE1124"],
  "France":       ["#002395", "#FFFFFF"],
  "Germany":      ["#FFFFFF", "#000000"],
  "Ghana":        ["#006B3F", "#FCD116"],
  "Iran":         ["#239F40", "#FFFFFF"],
  "Japan":        ["#000080", "#FFFFFF"],
  "Mexico":       ["#006847", "#CE1126"],
  "Morocco":      ["#CC0001", "#006233"],
  "Netherlands":  ["#FF6400", "#FFFFFF"],
  "Norway":       ["#EF2B2D", "#FFFFFF"],
  "Poland":       ["#FFFFFF", "#DC143C"],
  "Portugal":     ["#006600", "#FF0000"],
  "Qatar":        ["#8D1B3D", "#FFFFFF"],
  "Saudi Arabia": ["#006C35", "#FFFFFF"],
  "Senegal":      ["#00853F", "#FDEF42"],
  "Serbia":       ["#C6363C", "#012169"],
  "South Korea":  ["#CE1126", "#003478"],
  "Spain":        ["#AA151B", "#F1BF00"],
  "Switzerland":  ["#FF0000", "#FFFFFF"],
  "Tunisia":      ["#E70013", "#FFFFFF"],
  "Uruguay":      ["#75AADB", "#FFFFFF"],
  "USA":          ["#B22234", "#FFFFFF"],
  "Wales":        ["#C8102E", "#003F87"],
};

const POS_COLOR: Record<string, string> = {
  GK: "#f59e0b", DEF: "#22c55e", MID: "#06b6d4", FWD: "#f97316",
};

function kitColors(club: string): [string, string] {
  return KIT[club] ?? ["#334155", "#94a3b8"];
}

/* ─── Jersey SVG ─────────────────────────────────────────────────── */
function Jersey({
  primary, secondary, label, size = 62,
}: {
  primary: string; secondary: string; label: string; size?: number;
}) {
  const h = Math.round(size * 1.15);
  return (
    <svg
      width={size} height={h} viewBox="0 0 100 115"
      style={{ display: "block", filter: "drop-shadow(0 5px 12px rgba(0,0,0,0.6))" }}
    >
      {/* Left sleeve */}
      <path d="M4,20 L26,9 L30,38 L10,44 Z" fill={primary} />
      {/* Right sleeve */}
      <path d="M96,20 L74,9 L70,38 L90,44 Z" fill={primary} />
      {/* Body */}
      <path d="M26,9 L34,4 L38,0 L62,0 L66,4 L74,9 L90,44 L90,113 L10,113 L10,44 Z" fill={primary} />
      {/* Collar */}
      <path d="M38,0 Q50,18 62,0 Z" fill={secondary} />
      {/* Sleeve trim */}
      <path d="M4,20 L26,9"  stroke={secondary} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <path d="M10,44 L30,38" stroke={secondary} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <path d="M96,20 L74,9"  stroke={secondary} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <path d="M90,44 L70,38" stroke={secondary} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      {/* Highlight sheen */}
      <path d="M26,9 L34,4 L38,0 L62,0 L66,4 L74,9 L90,44 L90,113 L10,113 L10,44 Z"
        fill="white" opacity="0.07" />
      {/* Code */}
      <text x="50" y="76" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize="17" fontWeight="900"
        fontFamily="system-ui, -apple-system, sans-serif"
        stroke="rgba(0,0,0,0.45)" strokeWidth="3.5" strokeLinejoin="round"
        paintOrder="stroke">
        {label}
      </text>
    </svg>
  );
}

/* Ghost outline jersey for empty slots */
function EmptyJersey({ posColor, size = 54 }: { posColor: string; size?: number }) {
  const h = Math.round(size * 1.15);
  return (
    <svg width={size} height={h} viewBox="0 0 100 115" style={{ display: "block" }}>
      <path d="M4,20 L26,9 L30,38 L10,44 Z"
        fill="rgba(0,0,0,0.22)" stroke={posColor} strokeWidth="2.5" strokeDasharray="6,4" />
      <path d="M96,20 L74,9 L70,38 L90,44 Z"
        fill="rgba(0,0,0,0.22)" stroke={posColor} strokeWidth="2.5" strokeDasharray="6,4" />
      <path d="M26,9 L34,4 L38,0 L62,0 L66,4 L74,9 L90,44 L90,113 L10,113 L10,44 Z"
        fill="rgba(0,0,0,0.22)" stroke={posColor} strokeWidth="2.5" strokeDasharray="6,4" />
      <text x="50" y="60" textAnchor="middle" dominantBaseline="middle"
        fill={posColor} fontSize="36" fontWeight="200">+</text>
    </svg>
  );
}

/* ─── Player name + price label ──────────────────────────────────── */
function PlayerLabel({
  name, price, isCaptain, isVice,
}: {
  name: string; price: number; isCaptain: boolean; isVice: boolean;
}) {
  const lastName = name.split(" ").pop() ?? name;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginTop: 3 }}>
      {(isCaptain || isVice) && (
        <div style={{
          background: isCaptain ? "#f59e0b" : "#94a3b8",
          color: isCaptain ? "#000" : "#0a0f1e",
          borderRadius: 99, fontSize: 7, fontWeight: 900,
          padding: "1px 5px", letterSpacing: "0.05em",
          boxShadow: isCaptain ? "0 0 8px rgba(245,158,11,0.7)" : "none",
        }}>
          {isCaptain ? "©" : "V"}
        </div>
      )}
      <div style={{
        background: "rgba(5,12,30,0.82)",
        backdropFilter: "blur(6px)",
        borderRadius: 4,
        padding: "2px 6px",
        maxWidth: 76,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        color: "white",
        fontSize: 9.5,
        fontWeight: 700,
        border: "1px solid rgba(255,255,255,0.07)",
        textAlign: "center" as const,
      }}>
        {lastName}
      </div>
      <div style={{
        background: "rgba(5,12,30,0.82)",
        backdropFilter: "blur(6px)",
        borderRadius: 4,
        padding: "1px 6px",
        color: "#38bdf8",
        fontSize: 9,
        fontWeight: 700,
        fontFamily: "monospace",
        border: "1px solid rgba(56,189,248,0.18)",
      }}>
        £{price.toFixed(1)}m
      </div>
    </div>
  );
}

/* ─── Stat row for info dialog ────────────────────────────────────── */
function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ fontSize: 11, color: "#64748b", width: 64, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 13, color: accent ? "#38bdf8" : undefined, fontFamily: accent ? "monospace" : undefined }}>
        {value}
      </span>
    </div>
  );
}

/* ─── Squad Builder page ─────────────────────────────────────────── */
export function SquadBuilder() {
  const { authState } = useAuth();
  const TEAM_ID = authState.status === "authenticated" ? (authState.user.teamId ?? 0) : 0;
  const qc = useQueryClient();

  const { data: team,        isLoading: loadingTeam }    = useGetTeam(TEAM_ID,    { query: { enabled: TEAM_ID > 0, queryKey: getGetTeamQueryKey(TEAM_ID) } });
  const { data: teamPlayers, isLoading: loadingPlayers } = useGetTeamPlayers(TEAM_ID, { query: { enabled: TEAM_ID > 0, queryKey: getGetTeamPlayersQueryKey(TEAM_ID) } });

  const removeMut  = useRemovePlayerFromTeam();
  const updateMut  = useUpdateTeam();
  const addMut     = useAddPlayerToTeam();

  const [picker,     setPicker]     = useState<{ position: string; slot: number } | null>(null);
  const [search,     setSearch]     = useState("");
  const [infoPlayer, setInfoPlayer] = useState<TeamPlayer | null>(null);

  const { data: available, isLoading: loadingAvail } = useListPlayers(
    {
      position: picker?.position as ListPlayersPosition,
      search: search || undefined,
    },
    {
      query: {
        enabled: !!picker,
        queryKey: getListPlayersQueryKey({
          position: picker?.position as ListPlayersPosition,
          search: search || undefined,
        }),
      },
    },
  );

  const refreshPlayers = () => {
    qc.invalidateQueries({ queryKey: getGetTeamPlayersQueryKey(TEAM_ID) });
    qc.invalidateQueries({ queryKey: getGetTeamQueryKey(TEAM_ID) });
  };
  const refreshTeam = () => qc.invalidateQueries({ queryKey: getGetTeamQueryKey(TEAM_ID) });

  /* Nation counts from current squad (club field = nation) */
  const nationCounts: Record<string, number> = {};
  for (const tp of teamPlayers ?? []) {
    const nation = tp.player.club;
    nationCounts[nation] = (nationCounts[nation] ?? 0) + 1;
  }

  if (loadingTeam || loadingPlayers) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  /* Slot layout — 14 on pitch + 1 bench GK = 15 total
     Slots 1: GK, 2-6: DEF, 7-11: MID, 12-14: FWD, 15: bench GK */
  const pitchLayout = [
    { position: "GK",  count: 1 },
    { position: "DEF", count: 5 },
    { position: "MID", count: 5 },
    { position: "FWD", count: 3 },
  ];
  const rows = pitchLayout.map((row, ri) => ({
    ...row,
    startSlot: pitchLayout.slice(0, ri).reduce((acc, r) => acc + r.count, 0) + 1,
  }));
  const BENCH_GK_SLOT = 15;

  return (
    <div className="flex flex-col gap-2" style={{ height: "calc(100vh - 60px)" }}>

      {/* ── Header bar ── */}
      <div className="shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Squad Builder</h1>
          <p className="text-xs text-muted-foreground">2 GK · 5 DEF · 5 MID · 3 FWD · World Cup 2026</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Budget</div>
          <div style={{ fontSize: 22, fontFamily: "monospace", fontWeight: 800, color: "#38bdf8", textShadow: "0 0 16px rgba(56,189,248,0.45)" }}>
            £{team?.budget?.toFixed(1) ?? "0.0"}m
          </div>
        </div>
      </div>

      {/* ── Pitch ── */}
      <div
        className="flex-1 min-h-0 rounded-xl overflow-hidden relative"
        style={{
          minHeight: 500,
          backgroundImage: "url('/pitch.png')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 8px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Top + bottom gradient overlays for readability */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.0) 18%, rgba(0,0,0,0.0) 82%, rgba(0,0,0,0.32) 100%)",
        }} />

        {/* Player rows — FWD at top, GK at bottom */}
        <div className="relative z-10 h-full flex flex-col justify-between py-4 px-1">
          {rows.map((row) => {
            const pc = POS_COLOR[row.position] ?? "#94a3b8";
            return (
              <div key={row.position} className="flex justify-center items-start gap-2 sm:gap-4">
                {Array.from({ length: row.count }, (_, i) => {
                  const slot      = row.startSlot + i;
                  const rec       = teamPlayers?.find((p) => p.slot === slot) ?? null;
                  const isCaptain = team?.captainId    === rec?.playerId;
                  const isVice    = team?.viceCaptainId === rec?.playerId && !isCaptain;
                  const [kPri, kSec] = rec ? kitColors(rec.player.club) : ["#1e293b", "#334155"];

                  return (
                    <div key={slot} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 56, maxWidth: 78 }}>
                      {rec ? (
                        /* Filled slot */
                        <div
                          className="relative group"
                          style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}
                        >
                          {/* Remove X */}
                          <button
                            className="absolute -top-1 -right-1 z-20 w-[18px] h-[18px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: "#ef4444", boxShadow: "0 0 8px rgba(239,68,68,0.7)", border: "1.5px solid rgba(255,255,255,0.3)" }}
                            onClick={() => removeMut.mutate({ id: TEAM_ID, playerId: rec.playerId }, { onSuccess: refreshPlayers })}
                          >
                            <X style={{ width: 9, height: 9, color: "white" }} />
                          </button>

                          {/* Info i */}
                          <button
                            className="absolute -top-1 -left-1 z-20 w-[18px] h-[18px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: "#0ea5e9", boxShadow: "0 0 8px rgba(14,165,233,0.7)", border: "1.5px solid rgba(255,255,255,0.3)" }}
                            onClick={() => setInfoPlayer(rec)}
                          >
                            <Info style={{ width: 9, height: 9, color: "white" }} />
                          </button>

                          {/* Jersey */}
                          <div
                            className="cursor-pointer transition-transform group-hover:scale-110"
                            onClick={() => setInfoPlayer(rec)}
                          >
                            <Jersey primary={kPri} secondary={kSec} label={rec.player.clubShortName ?? ""} />
                          </div>

                          {/* Name + price */}
                          <PlayerLabel
                            name={rec.player.name}
                            price={rec.player.price}
                            isCaptain={isCaptain}
                            isVice={isVice}
                          />
                        </div>
                      ) : (
                        /* Empty slot */
                        <button
                          onClick={() => { setPicker({ position: row.position, slot }); setSearch(""); }}
                          className="transition-transform hover:scale-105"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexDirection: "column", alignItems: "center" }}
                        >
                          <EmptyJersey posColor={pc} />
                          <div style={{
                            marginTop: 4,
                            background: `${pc}22`,
                            color: pc,
                            border: `1px solid ${pc}44`,
                            borderRadius: 4,
                            padding: "1px 7px",
                            fontSize: 8.5,
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                          }}>
                            {row.position}
                          </div>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bench ── */}
      {(() => {
        const benchRec = teamPlayers?.find((p) => p.slot === BENCH_GK_SLOT) ?? null;
        const isCaptain = team?.captainId === benchRec?.playerId;
        const isVice    = team?.viceCaptainId === benchRec?.playerId && !isCaptain;
        const [kPri, kSec] = benchRec ? kitColors(benchRec.player.club) : ["#1e293b", "#334155"];
        const pc = POS_COLOR["GK"];
        return (
          <div className="shrink-0 rounded-xl overflow-hidden" style={{
            background: "linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(5,15,30,0.96) 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}>
            <div className="flex items-center gap-3 px-4 py-2">
              <div style={{
                fontSize: 8.5, fontWeight: 800, letterSpacing: "0.18em",
                color: "#64748b", textTransform: "uppercase",
                borderRight: "1px solid rgba(255,255,255,0.08)",
                paddingRight: 12, whiteSpace: "nowrap",
              }}>
                Bench
              </div>
              <div className="flex items-center gap-1.5">
                <div style={{ fontSize: 8, color: "#64748b", fontWeight: 700 }}>GK 2</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {benchRec ? (
                    <div className="relative group" style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
                      <button
                        className="absolute -top-1 -right-1 z-20 w-[16px] h-[16px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "#ef4444", boxShadow: "0 0 8px rgba(239,68,68,0.7)", border: "1.5px solid rgba(255,255,255,0.3)" }}
                        onClick={() => removeMut.mutate({ id: TEAM_ID, playerId: benchRec.playerId }, { onSuccess: refreshPlayers })}
                      >
                        <X style={{ width: 8, height: 8, color: "white" }} />
                      </button>
                      <button
                        className="absolute -top-1 -left-1 z-20 w-[16px] h-[16px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "#0ea5e9", boxShadow: "0 0 8px rgba(14,165,233,0.7)", border: "1.5px solid rgba(255,255,255,0.3)" }}
                        onClick={() => setInfoPlayer(benchRec)}
                      >
                        <Info style={{ width: 8, height: 8, color: "white" }} />
                      </button>
                      <div className="cursor-pointer transition-transform group-hover:scale-110" onClick={() => setInfoPlayer(benchRec)}>
                        <Jersey primary={kPri} secondary={kSec} label={benchRec.player.clubShortName ?? ""} size={44} />
                      </div>
                      <PlayerLabel name={benchRec.player.name} price={benchRec.player.price} isCaptain={isCaptain} isVice={isVice} />
                    </div>
                  ) : (
                    <button
                      onClick={() => { setPicker({ position: "GK", slot: BENCH_GK_SLOT }); setSearch(""); }}
                      className="transition-transform hover:scale-105"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexDirection: "column", alignItems: "center" }}
                    >
                      <EmptyJersey posColor={pc} size={44} />
                      <div style={{
                        marginTop: 3, background: `${pc}22`, color: pc,
                        border: `1px solid ${pc}44`, borderRadius: 4,
                        padding: "1px 6px", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em",
                      }}>GK</div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Captain quick-set strip ── */}
      {(teamPlayers?.length ?? 0) > 0 && (
        <div className="shrink-0 flex gap-1 pt-0.5 overflow-x-auto">
          {teamPlayers?.map((rec) => {
            const isCap  = team?.captainId    === rec.playerId;
            const isVice = team?.viceCaptainId === rec.playerId;
            const lastName = rec.player.name.split(" ").pop() ?? rec.player.name;
            return (
              <button
                key={rec.playerId}
                onClick={() => updateMut.mutate({ id: TEAM_ID, data: { captainId: rec.playerId } }, { onSuccess: refreshTeam })}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full transition-all"
                style={{
                  background: isCap ? "#f59e0b22" : isVice ? "#94a3b822" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${isCap ? "#f59e0b55" : isVice ? "#94a3b855" : "rgba(255,255,255,0.08)"}`,
                  color: isCap ? "#f59e0b" : isVice ? "#94a3b8" : "#64748b",
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                {isCap ? "© " : isVice ? "V " : <Star style={{ width: 9, height: 9, marginRight: 2 }} />}
                {lastName}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Player picker dialog ── */}
      <Dialog open={!!picker} onOpenChange={(open) => { if (!open) setPicker(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Select {picker?.position}</DialogTitle>
          </DialogHeader>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search player…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <ScrollArea className="h-[360px] mt-3 pr-3">
            {loadingAvail ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (available?.length ?? 0) === 0 ? (
              <div className="text-center p-8 text-muted-foreground">No players found</div>
            ) : (
              <div className="space-y-1.5">
                {available?.map((p) => {
                  const pc = POS_COLOR[picker?.position ?? ""] ?? "#94a3b8";
                  const [kPri, kSec] = kitColors(p.club);
                  const nationFull = (nationCounts[p.club] ?? 0) >= 3;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-secondary/40 transition-colors"
                      style={nationFull ? { opacity: 0.55 } : undefined}
                    >
                      <div className="flex items-center gap-2.5">
                        <div style={{ width: 28, flexShrink: 0 }}>
                          <Jersey primary={kPri} secondary={kSec} label={p.clubShortName ?? ""} size={28} />
                        </div>
                        <div>
                          <div className="font-bold text-sm leading-tight">{p.name}</div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">{p.club}</span>
                            {nationFull && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                                background: "rgba(239,68,68,0.15)", color: "#ef4444",
                                border: "1px solid rgba(239,68,68,0.3)",
                                borderRadius: 4, padding: "0px 5px",
                              }}>
                                3/3 nation limit
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono font-bold text-sm">£{p.price.toFixed(1)}m</div>
                          <div className="text-xs font-mono" style={{ color: pc }}>{p.totalPoints} pts</div>
                        </div>
                        <Button
                          size="sm"
                          disabled={addMut.isPending || nationFull}
                          onClick={() => {
                            if (!picker || nationFull) return;
                            addMut.mutate(
                              { id: TEAM_ID, data: { playerId: p.id, slot: picker.slot } },
                              { onSuccess: () => { refreshPlayers(); setPicker(null); } },
                            );
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Player info dialog ── */}
      <Dialog open={!!infoPlayer} onOpenChange={(open) => { if (!open) setInfoPlayer(null); }}>
        <DialogContent className="sm:max-w-[320px]">
          {infoPlayer && (() => {
            const rec    = infoPlayer;
            const isCap  = team?.captainId    === rec.playerId;
            const isVice = team?.viceCaptainId === rec.playerId && !isCap;
            const [kPri, kSec] = kitColors(rec.player.club);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{rec.player.name}</DialogTitle>
                </DialogHeader>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginTop: 8 }}>
                  <Jersey primary={kPri} secondary={kSec} label={rec.player.clubShortName ?? ""} size={72} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    <StatRow label="Nation"   value={rec.player.club} />
                    <StatRow label="Position" value={rec.player.position} />
                    <StatRow label="Price"    value={`£${rec.player.price.toFixed(1)}m`} accent />
                    <StatRow label="Points"   value={`${rec.player.totalPoints} pts`} />
                    <StatRow label="Role"     value={isCap ? "Captain" : isVice ? "Vice" : "—"} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <Button size="sm" variant="outline"
                    onClick={() => { updateMut.mutate({ id: TEAM_ID, data: { captainId: rec.playerId } }, { onSuccess: refreshTeam }); setInfoPlayer(null); }}>
                    <Star className="w-3 h-3 mr-1" /> Captain
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => { updateMut.mutate({ id: TEAM_ID, data: { viceCaptainId: rec.playerId } }, { onSuccess: refreshTeam }); setInfoPlayer(null); }}>
                    Vice
                  </Button>
                  <Button size="sm" variant="destructive" style={{ marginLeft: "auto" }}
                    onClick={() => { removeMut.mutate({ id: TEAM_ID, playerId: rec.playerId }, { onSuccess: refreshPlayers }); setInfoPlayer(null); }}>
                    <X className="w-3 h-3 mr-1" /> Remove
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
