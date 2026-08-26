import { useEffect, useState } from "react";
import grassImg from "@/assets/Grass.jpg";
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useGetLiveFixtures,
  getGetLiveFixturesQueryKey,
  useGetLeagueLeaderboard,
  getGetLeagueLeaderboardQueryKey,
  useGetDashboardTopPerformers,
  getGetDashboardTopPerformersQueryKey,
  useGetDashboardSquad,
  getGetDashboardSquadQueryKey,
  type LiveFixture,
  type LeaderboardEntry,
  type TopPerformer,
  type SquadPlayer,
} from "@workspace/api-client-react";
import { Trophy, TrendingUp, Users, Wallet, Zap, ShieldHalf } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { Link } from "wouter";
import { format } from "date-fns";
import { getPremierLeaguePhotoUrl } from "@/lib/player-photo";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ABBREV_MAP: Record<string, string> = {
  "United States": "USA", "United States of America": "USA",
  "South Korea": "KOR", "Korea Republic": "KOR", "Korea DPR": "PRK",
  "Czech Republic": "CZE", "Czechia": "CZE",
  "Bosnia and Herzegovina": "BIH", "Bosnia & Herzegovina": "BIH",
  "Saudi Arabia": "KSA", "Ivory Coast": "CIV", "DR Congo": "COD",
  "New Zealand": "NZL", "Costa Rica": "CRC", "Trinidad and Tobago": "TTO",
  "United Arab Emirates": "UAE",
};

function teamAbbrev(name: string): string {
  if (ABBREV_MAP[name]) return ABBREV_MAP[name];
  const words = name.split(/\s+/);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  if (words.length === 2) return (words[0].slice(0, 2) + words[1].slice(0, 1)).toUpperCase();
  return words.map((w) => w[0]).join("").slice(0, 3).toUpperCase();
}

const FLAG_MAP: Record<string, string> = {
  Afghanistan: "AF", Albania: "AL", Algeria: "DZ", Argentina: "AR", Australia: "AU",
  Austria: "AT", Bahrain: "BH", Belgium: "BE", Bolivia: "BO", Brazil: "BR",
  Bulgaria: "BG", Cameroon: "CM", Canada: "CA", Chile: "CL", China: "CN",
  Colombia: "CO", "Costa Rica": "CR", "Côte d'Ivoire": "CI", Croatia: "HR",
  Cuba: "CU", "Czech Republic": "CZ", Czechia: "CZ", Denmark: "DK",
  Ecuador: "EC", Egypt: "EG", England: "GB-ENG", Ethiopia: "ET", Finland: "FI",
  France: "FR", Germany: "DE", Ghana: "GH", Greece: "GR", Guatemala: "GT",
  Honduras: "HN", Hungary: "HU", Iceland: "IS", India: "IN", Indonesia: "ID",
  Iran: "IR", Iraq: "IQ", Israel: "IL", Italy: "IT", Jamaica: "JM",
  Japan: "JP", Jordan: "JO", Kazakhstan: "KZ", "Korea Republic": "KR",
  "South Korea": "KR", Kuwait: "KW", Lebanon: "LB", Libya: "LY",
  Mali: "ML", Mexico: "MX", Moldova: "MD", Montenegro: "ME", Morocco: "MA",
  "Netherlands": "NL", "New Zealand": "NZ", Nigeria: "NG", "North Macedonia": "MK",
  Norway: "NO", Oman: "OM", Panama: "PA", Paraguay: "PY", Peru: "PE",
  Philippines: "PH", Poland: "PL", Portugal: "PT", Qatar: "QA",
  Romania: "RO", Russia: "RU", "Saudi Arabia": "SA", Scotland: "GB-SCT",
  Senegal: "SN", Serbia: "RS", Slovakia: "SK", Slovenia: "SI",
  "South Africa": "ZA", Spain: "ES", Sweden: "SE", Switzerland: "CH",
  Syria: "SY", Thailand: "TH", Tunisia: "TN", Turkey: "TR", Türkiye: "TR",
  Ukraine: "UA", Uruguay: "UY", "United States": "US", "USA": "US",
  "United States of America": "US", Venezuela: "VE", Wales: "GB-WLS",
  Zambia: "ZM", Zimbabwe: "ZW", "Bosnia and Herzegovina": "BA",
  "Bosnia & Herzegovina": "BA", BIH: "BA",
  "Democratic Republic of the Congo": "CD", "Trinidad and Tobago": "TT",
  "United Arab Emirates": "AE",
};

function toFlagEmoji(name: string): string {
  const code = FLAG_MAP[name];
  if (!code) return "🏴";
  if (code.includes("-")) {
    return code === "GB-ENG" ? "🏴󠁧󠁢󠁥󠁮󠁧󠁿" : code === "GB-SCT" ? "🏴󠁧󠁢󠁳󠁣󠁴󠁿" : "🏴󠁧󠁢󠁷󠁬󠁳󠁿";
  }
  return [...code].map((c) => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
}

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

const STATUS_SORT: Record<string, number> = { live: 0, scheduled: 1, finished: 2 };

const CARD: React.CSSProperties = {
  background: "rgba(8,17,40,0.68)",
  border: "1px solid rgba(255,255,255,0.07)",
  backdropFilter: "blur(12px)",
  borderRadius: 16,
  overflow: "hidden",
};

// ── Today's Matches column ────────────────────────────────────────────────────
function TodayMatchesCard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: fixtures } = useGetLiveFixtures({
    query: { queryKey: getGetLiveFixturesQueryKey(), refetchInterval: 60_000 },
  });

  const todayMatches = (fixtures ?? [])
    .filter((f: LiveFixture) => format(new Date(f.kickoff), "yyyy-MM-dd") === today)
    .sort((a: LiveFixture, b: LiveFixture) => {
      const sDiff = (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9);
      return sDiff !== 0 ? sDiff : a.kickoff.localeCompare(b.kickoff);
    });

  const liveCount = todayMatches.filter((f: LiveFixture) => f.status === "live").length;

  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8" }}>
          Today's Matches
        </span>
        {liveCount > 0 && (
          <span
            className="animate-pulse"
            style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", background: "rgba(239,68,68,0.18)", color: "#f87171", border: "1px solid rgba(239,68,68,0.35)", padding: "2px 6px", borderRadius: 999 }}
          >
            {liveCount} Live
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", maxHeight: 280 }}>
        {todayMatches.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px" }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>⚽</span>
            <p style={{ fontSize: 12, color: "#5d7ba8", margin: 0 }}>No matches today</p>
          </div>
        ) : (
          todayMatches.map((f: LiveFixture, i) => {
            const isLive = f.status === "live";
            return (
              <div
                key={f.id}
                style={{
                  borderBottom: i < todayMatches.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  borderLeft: isLive ? "3px solid rgba(239,68,68,0.7)" : "3px solid transparent",
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Home */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 15 }}>{toFlagEmoji(f.homeTeam)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.04em" }}>
                      {teamAbbrev(f.homeTeam)}
                    </span>
                  </div>

                  {/* Centre: time/score */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    {f.status === "scheduled" ? (
                      <span
                        className="font-mono text-xs font-bold"
                        style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", padding: "2px 8px", borderRadius: 4 }}
                      >
                        {format(new Date(f.kickoff), "HH:mm")}
                      </span>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {isLive && (
                          <span
                            className="animate-pulse"
                            style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 4px #ef4444", flexShrink: 0, display: "inline-block" }}
                          />
                        )}
                        <span
                          className="font-mono font-black"
                          style={{ fontSize: 14, color: isLive ? "#f87171" : "#cbd5e1" }}
                        >
                          {f.homeScore ?? 0} - {f.awayScore ?? 0}
                        </span>
                      </div>
                    )}
                    {isLive && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#f87171", letterSpacing: "0.08em", marginTop: 2 }}>
                        LIVE · {f.elapsed != null ? `${f.elapsed}'` : "—"}
                      </span>
                    )}
                    {f.status === "finished" && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", marginTop: 2 }}>FT</span>
                    )}
                  </div>

                  {/* Away */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.04em" }}>
                      {teamAbbrev(f.awayTeam)}
                    </span>
                    <span style={{ fontSize: 15 }}>{toFlagEmoji(f.awayTeam)}</span>
                  </div>
                </div>

                {f.venue && (
                  <p style={{ fontSize: 10, color: "#475569", marginTop: 4, textAlign: "center", letterSpacing: "0.02em" }}>
                    {f.venue}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── My League column ──────────────────────────────────────────────────────────
function MyLeagueCard({ leagueId, leagueName, teamId }: { leagueId: number; leagueName: string | null; teamId: number | undefined }) {
  const { data: rows, isLoading } = useGetLeagueLeaderboard(leagueId, {
    query: { queryKey: getGetLeagueLeaderboardQueryKey(leagueId), enabled: leagueId > 0 },
  });

  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8" }}>
          My League{leagueName ? ` · ${leagueName}` : ""}
        </span>
        <Link href="/leagues" style={{ fontSize: 10, fontWeight: 700, color: "#06b6d4", textDecoration: "none" }}>
          View all →
        </Link>
      </div>

      <div style={{ flex: 1, padding: 16 }}>
        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse" style={{ height: 112, borderRadius: 12, background: "rgba(255,255,255,0.05)" }} />
            ))}
          </div>
        ) : !rows?.length ? (
          <p style={{ textAlign: "center", padding: "32px 0", fontSize: 12, color: "#5d7ba8" }}>No members yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
            {(rows as LeaderboardEntry[]).map((row) => {
              const isMe = row.teamId === teamId;
              const isFirst = row.rank === 1;
              return (
                <div
                  key={row.teamId}
                  style={{
                    display: "flex", flexDirection: "column", gap: 8,
                    minHeight: 112, padding: 16, borderRadius: 12,
                    background: isFirst
                      ? "linear-gradient(135deg, #ffd873 0%, #e8a627 100%)"
                      : "linear-gradient(135deg, #1a2c54 0%, #101d3a 100%)",
                    border: isMe ? "1px solid rgba(6,182,212,0.7)" : isFirst ? "1px solid rgba(255,196,54,0.5)" : "1px solid rgba(93,156,236,0.3)",
                    boxShadow: isFirst ? "0 4px 20px rgba(255,196,54,0.25)" : "0 2px 12px rgba(0,0,0,0.3)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: isFirst ? "#2a1900" : "#7ab4ff" }}>
                      {isFirst ? "🥇" : `#${row.rank}`}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: 18, fontWeight: 900, color: isFirst ? "#2a1900" : isMe ? "#06b6d4" : "#f1f5f9" }}>
                      {row.totalPoints}
                    </span>
                  </div>
                  <span className="truncate" style={{ fontSize: 14, fontWeight: 700, color: isFirst ? "#2a1900" : "#e2e8f0" }}>
                    {row.managerName}
                    {isMe && <span style={{ marginLeft: 6, fontSize: 11, color: isFirst ? "#7a5200" : "#06b6d4" }}>(you)</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Top Performers column ─────────────────────────────────────────────────────
function TopPerformersCard() {
  const { data: performers } = useGetDashboardTopPerformers({
    query: { queryKey: getGetDashboardTopPerformersQueryKey(), refetchInterval: 120_000 },
  });

  const MEDAL_STYLES = [
    { bg: "rgba(255,196,54,0.08)", pts: "#ffc436" },
    { bg: "rgba(255,255,255,0.06)", pts: "#e2e8f0" },
    { bg: "rgba(255,255,255,0.03)", pts: "#8fa3c9" },
  ];

  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8fa3c9" }}>
          Top Performers
        </span>
      </div>

      <div style={{ flex: 1, padding: 16 }}>
        {!performers?.length ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <p style={{ fontSize: 12, color: "#5d7ba8" }}>No scores yet</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            {(performers as TopPerformer[]).map((p, i) => {
              const medal = MEDAL_STYLES[i] ?? MEDAL_STYLES[2];
              const isTop = i === 0;
              return (
              <div
                key={p.id}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10,
                  minHeight: 132, padding: 16, borderRadius: 12,
                  background: isTop ? "linear-gradient(135deg, #ffd873 0%, #e8a627 100%)" : "linear-gradient(135deg, #1a2c54 0%, #101d3a 100%)",
                  border: isTop ? "1px solid rgba(255,196,54,0.5)" : "1px solid rgba(93,156,236,0.3)",
                  boxShadow: isTop ? "0 4px 20px rgba(255,196,54,0.25)" : "0 2px 12px rgba(0,0,0,0.3)",
                }}
              >
                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, borderRadius: "50%",
                    width: 36, height: 36,
                    background: isTop ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.3)",
                    border: isTop ? "1px solid rgba(0,0,0,0.2)" : "2px solid rgba(255,255,255,0.12)",
                    fontSize: 16,
                  }}
                >
                  {isTop ? "🔥" : "⚽"}
                </div>
                <div style={{ width: "100%", minWidth: 0 }}>
                  <p className="truncate" style={{ fontSize: 13, fontWeight: 800, color: isTop ? "#2a1900" : "#f1f5f9" }}>{p.name}</p>
                  <p style={{ fontSize: 10, color: isTop ? "#7a5200" : "#5d7ba8", marginTop: 3, fontWeight: 700 }}>{p.position}</p>
                </div>
                <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 900, color: isTop ? "#7a5200" : medal.pts }}>
                  {p.totalPoints} pts
                </span>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Squad Player Row ───────────────────────────────────────────────────────────
function SquadPlayerCard({ p }: { p: SquadPlayer }) {
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
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, minHeight: 48,
        padding: "8px 12px", borderRadius: 10,
        background: "rgba(26,44,84,0.42)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Photo and status badges */}
      <div style={{ position: "relative", width: 32, height: 32, flexShrink: 0 }}>
        <div
          style={{
            width: 32, height: 32,
            borderRadius: "50%",
            border: `2px solid ${posColor}`,
            overflow: "hidden",
            background: showPhoto ? "#0a1628" : `${posColor}2e`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 9, color: posColor, letterSpacing: "0.04em",
          }}
        >
          {showPhoto ? (
            <img
              src={photoSrc!}
              alt={p.name}
              loading="lazy"
              onError={() => setPhotoState((current) =>
                current === "primary" && premierLeagueUrl ? "premier-league" : "failed"
              )}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
            />
          ) : (
            <span style={{ color: posColor }}>{playerInitials(p.name)}</span>
          )}
        </div>

        {/* Club crest badge */}
        {p.crestUrl && (
          <img
            src={p.crestUrl}
            alt=""
            loading="lazy"
            style={{
              position: "absolute", bottom: -3, right: -4,
              width: 15, height: 15,
              objectFit: "contain",
              background: "rgba(5,12,30,0.9)",
              borderRadius: "50%",
              padding: 2,
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 2px 5px rgba(0,0,0,0.6)",
            }}
          />
        )}

        {/* Captain badge */}
        {p.isCaptain && (
          <span style={{ position: "absolute", top: -5, right: -5, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", fontWeight: 900, width: 15, height: 15, fontSize: 7, background: "#f59e0b", color: "#000", zIndex: 2 }}>
            C
          </span>
        )}
        {p.isViceCaptain && !p.isCaptain && (
          <span style={{ position: "absolute", top: -5, right: -5, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", fontWeight: 900, width: 15, height: 15, fontSize: 7, background: "#64748b", color: "#fff", zIndex: 2 }}>
            V
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="truncate" style={{ margin: 0, fontWeight: 700, fontSize: 12, color: "#e2e8f0" }}>
          {p.name}
        </p>
        <p style={{ margin: "3px 0 0", fontWeight: 800, fontSize: 9, color: posColor, letterSpacing: "0.08em" }}>
          {p.position}
        </p>
      </div>
      <span className="tabular-nums" style={{ fontWeight: 900, fontSize: 12, color: p.points > 0 ? "#22c55e" : "#8fa3c9" }}>
        {p.points} pts
      </span>
    </div>
  );
}

// ── Squad List ─────────────────────────────────────────────────────────────────
function SquadStrip({ teamId }: { teamId: number }) {
  const { data: squad } = useGetDashboardSquad(
    { teamId },
    { query: { queryKey: getGetDashboardSquadQueryKey({ teamId }), enabled: teamId > 0 } }
  );

  if (!squad?.length) return null;

  const squadList = squad as SquadPlayer[];

  return (
    <div style={{ ...CARD }}>
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8" }}>
          My Squad · Active Players This GW
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#475569" }}>
          {squadList.length}/15
        </span>
      </div>

      <div
        className="md:max-h-[280px] md:overflow-y-auto"
        style={{
          display: "flex", flexDirection: "column", gap: 16, padding: 16,
          scrollbarWidth: "thin",
        }}
      >
        {squadList.map((p) => (
          <SquadPlayerCard key={p.playerId} p={p} />
        ))}
      </div>
    </div>
  );
}

// ── No Squad Prompt ───────────────────────────────────────────────────────────
function NoSquadPrompt() {
  return (
    <div
      style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "rgba(8,17,40,0.6)", border: "1px solid rgba(255,255,255,0.06)", minHeight: 180 }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}>
          <ShieldHalf size={28} style={{ color: "#3b82f6" }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8, color: "#f1f5f9" }}>No squad picked yet</h2>
        <p style={{ color: "#5d7ba8", fontSize: 13, marginBottom: 20 }}>Build your team of 11 players to compete.</p>
        <Link href="/squad">
          <button
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, fontWeight: 700, fontSize: 14, background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "#fff", boxShadow: "0 4px 20px rgba(59,130,246,0.35)", border: "none", cursor: "pointer" }}
          >
            <ShieldHalf size={15} /> Go to Squad Builder
          </button>
        </Link>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export function Dashboard() {
  const { authState } = useAuth();
  const teamId = authState.status === "authenticated" ? (authState.user.teamId ?? undefined) : undefined;

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary(
    { teamId },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ teamId }), enabled: authState.status === "authenticated" } }
  );

  if (isLoadingSummary || authState.status === "loading") {
    return (
      <div
        className="animate-pulse"
        style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", maxWidth: "100%", overflow: "hidden" }}
      >
        <div style={{ height: 200, borderRadius: 16, background: "rgba(8,17,40,0.6)" }} />
        {/* Skeleton stat cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 112, borderRadius: 12, background: "rgba(8,17,40,0.5)" }} />
          ))}
        </div>
        {/* Skeleton 3-col */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 256, borderRadius: 12, background: "rgba(8,17,40,0.5)" }} />
          ))}
        </div>
      </div>
    );
  }

  const hasSquad = summary?.hasSquad ?? false;

  const gwLabel = summary?.currentGameweekNumber != null
    ? `Gameweek ${summary.currentGameweekNumber}${summary.currentGameweekName ? ` · ${summary.currentGameweekName}` : ""}`
    : "Live Match Week Overview";

  const statCards = [
    {
      label: "GW Points",
      value: String(summary?.gameweekPoints ?? 0),
      sub: summary?.gameweekPoints ? "↑ Active GW" : "",
      subColor: "#8fa3c9",
      Icon: TrendingUp,
      variant: "blue" as const,
    },
    {
      label: "Global Rank",
      value: summary?.globalRank != null ? `#${summary.globalRank.toLocaleString()}` : "—",
      sub: summary?.globalRank != null ? `of ${summary.leagueCount > 0 ? `${summary.leagueCount + 1} managers` : "managers"}` : "Pending",
      subColor: "#7a5200",
      Icon: Trophy,
      variant: "gold" as const,
    },
    {
      label: "Captain",
      value: summary?.captainName ?? "None",
      sub: `${summary?.captainPoints ?? 0} pts`,
      subColor: "#ffc436",
      Icon: Users,
      variant: "captain" as const,
      smallValue: true,
    },
    {
      label: "Budget",
      value: `£${(summary?.budgetRemaining ?? 100).toFixed(1)}m`,
      sub: "Available",
      subColor: "#8fa3c9",
      Icon: Wallet,
      variant: "blue" as const,
    },
  ];

  return (
    <div
      style={{
        position: "relative",
        background: "linear-gradient(180deg, #0a1530 0%, #132348 100%)",
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
      }}
    >
      {/* Content */}
      <div
        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 16, width: "100%", overflowX: "hidden" }}
      >
        {/* ── Hero header ── */}
        <div
          style={{
            position: "relative", borderRadius: 16, overflow: "hidden",
            backgroundImage: `linear-gradient(135deg, rgba(10,21,48,0.55) 0%, rgba(19,35,72,0.60) 100%), url(${grassImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            border: "1px solid rgba(122,180,255,0.3)",
            minHeight: 140,
          }}
        >
          {/* Gold radial glow — top-right */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 90% 10%, rgba(255,196,54,0.22) 0%, transparent 55%)" }} />
          {/* Blue radial glow — bottom-left */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 10% 90%, rgba(93,156,236,0.28) 0%, transparent 55%)" }} />

          <div style={{ position: "relative", zIndex: 10, padding: "24px 16px 0" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Zap size={13} color="#ffc436" style={{ filter: "drop-shadow(0 0 5px rgba(255,196,54,0.7))" }} />
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#ffc436" }}>
                  Live Overview
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", color: "#f1f5f9", textShadow: "0 2px 20px rgba(0,0,0,0.6)", margin: 0 }}>
                Command Center
              </h1>
              <p style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>{gwLabel}</p>
            </div>

            {/* ── Stat cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingBottom: 16 }}>
              {statCards.map(({ label, value, sub, subColor, Icon, variant, smallValue }) => {
                const isGold    = variant === "gold";
                const isCaptain = variant === "captain";
                const isBlue    = variant === "blue";

                const cardBg     = isGold ? "linear-gradient(135deg, #ffd873 0%, #e8a627 100%)" : "linear-gradient(135deg, #1a2c54 0%, #101d3a 100%)";
                const cardBorder = isGold ? "1px solid rgba(255,196,54,0.5)" : isCaptain ? "1px solid rgba(255,196,54,0.35)" : "1px solid rgba(93,156,236,0.3)";
                const cardShadow = isGold ? "0 4px 20px rgba(255,196,54,0.35)" : "0 2px 12px rgba(0,0,0,0.4)";
                const labelColor = isGold ? "#7a5200" : "#8fa3c9";
                const valueColor = isGold ? "#2a1900" : "#f1f5f9";

                const iconBg     = isGold ? "rgba(0,0,0,0.15)" : isCaptain ? "linear-gradient(135deg, #ffd873, #e8a627)" : "rgba(122,180,255,0.12)";
                const iconBorder = isGold ? "1px solid rgba(0,0,0,0.2)" : isCaptain ? "1px solid rgba(255,196,54,0.4)" : "1px solid rgba(122,180,255,0.25)";
                const iconColor  = isGold ? "#2a1900" : isCaptain ? "#2a1900" : "#7ab4ff";

                return (
                  <div
                    key={label}
                    style={{
                      position: "relative", overflow: "hidden", borderRadius: 10,
                      background: cardBg,
                      border: cardBorder,
                      boxShadow: cardShadow,
                      minHeight: 100,
                    }}
                  >
                    {/* Subtle top-edge shimmer for non-gold cards */}
                    {!isGold && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: isCaptain ? "linear-gradient(90deg, transparent, rgba(255,196,54,0.5), transparent)" : "linear-gradient(90deg, transparent, rgba(122,180,255,0.4), transparent)" }} />}
                    <div style={{ padding: "10px 12px", position: "relative", zIndex: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: labelColor }}>{label}</span>
                        <div style={{ width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: iconBg, border: iconBorder }}>
                          <Icon size={11} style={{ color: iconColor }} />
                        </div>
                      </div>
                      <div
                        className="font-black leading-none tracking-tight"
                        style={{ fontSize: smallValue ? 14 : 20, fontFamily: smallValue ? "inherit" : "monospace", color: valueColor }}
                      >
                        {value}
                      </div>
                      <div style={{ fontSize: 9, color: subColor ?? "#8fa3c9", marginTop: 4, fontWeight: 600 }}>{sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── My Squad ── */}
        {hasSquad && teamId ? (
          <SquadStrip teamId={teamId} />
        ) : (
          <NoSquadPrompt />
        )}

        {/* ── My League ── */}
        {summary?.firstLeagueId != null ? (
          <MyLeagueCard
            leagueId={summary.firstLeagueId}
            leagueName={summary.firstLeagueName ?? null}
            teamId={teamId}
          />
        ) : (
          <div style={{ ...CARD, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
            <div style={{ textAlign: "center", padding: "0 16px" }}>
              <p style={{ fontSize: 12, color: "#5d7ba8", marginBottom: 8 }}>No league joined yet</p>
              <Link href="/leagues" style={{ fontSize: 11, fontWeight: 700, color: "#7ab4ff" }}>Browse leagues →</Link>
            </div>
          </div>
        )}

        {/* ── Top Performers ── */}
        <TopPerformersCard />

        {/* ── Today's Matches ── */}
        <TodayMatchesCard />

      </div>
    </div>
  );
}
