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

// ── Helpers ─────────────────────────────────────────────────────────────────

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
    const subcode = code.split("-")[1];
    const base = 0x1F3F4;
    const tag = (s: string) => [...s.toLowerCase()].map((c) => String.fromCodePoint(0xE0000 + c.charCodeAt(0))).join("");
    const gb = String.fromCodePoint(0x1F1EC) + String.fromCodePoint(0x1F1E7);
    return gb.length > 0 ? (code === "GB-ENG" ? "🏴󠁧󠁢󠁥󠁮󠁧󠁿" : code === "GB-SCT" ? "🏴󠁧󠁢󠁳󠁣󠁴󠁿" : "🏴󠁧󠁢󠁷󠁬󠁳󠁿") : "🏴";
  }
  return [...code].map((c) => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
}

const POS_COLORS: Record<string, string> = {
  GK: "#f59e0b",
  DEF: "#06b6d4",
  MID: "#a78bfa",
  FWD: "#22c55e",
};

const STATUS_SORT: Record<string, number> = { live: 0, scheduled: 1, finished: 2 };

const CARD: React.CSSProperties = {
  background: "rgba(8,17,40,0.68)",
  border: "1px solid rgba(255,255,255,0.07)",
  backdropFilter: "blur(12px)",
  borderRadius: 16,
  overflow: "hidden",
};

// ── Today's Matches column ───────────────────────────────────────────────────
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
      <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8" }}>
          Today's Matches
        </span>
        {liveCount > 0 && (
          <span
            className="animate-pulse px-1.5 py-0.5 rounded-full"
            style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", background: "rgba(239,68,68,0.18)", color: "#f87171", border: "1px solid rgba(239,68,68,0.35)" }}
          >
            {liveCount} Live
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 280 }}>
        {todayMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
            <span style={{ fontSize: 22 }}>⚽</span>
            <p style={{ fontSize: 12, color: "#475569" }}>No matches today</p>
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
                <div className="flex items-center gap-2">
                  {/* Home */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span style={{ fontSize: 15 }}>{toFlagEmoji(f.homeTeam)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.04em" }}>
                      {teamAbbrev(f.homeTeam)}
                    </span>
                  </div>

                  {/* Centre: time/score */}
                  <div className="flex flex-col items-center shrink-0" style={{ minWidth: 60, maxWidth: 80 }}>
                    {f.status === "scheduled" ? (
                      <span
                        className="px-2 py-0.5 rounded font-mono text-xs font-bold"
                        style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8" }}
                      >
                        {format(new Date(f.kickoff), "HH:mm")}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        {isLive && (
                          <span
                            className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
                            style={{ background: "#ef4444", boxShadow: "0 0 4px #ef4444" }}
                          />
                        )}
                        <span
                          className="font-mono text-sm font-black"
                          style={{ color: isLive ? "#f87171" : "#cbd5e1" }}
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
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
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

// ── My League column ─────────────────────────────────────────────────────────
function MyLeagueCard({ leagueId, leagueName, teamId }: { leagueId: number; leagueName: string | null; teamId: number | undefined }) {
  const { data: rows, isLoading } = useGetLeagueLeaderboard(leagueId, {
    query: { queryKey: getGetLeagueLeaderboardQueryKey(leagueId), enabled: leagueId > 0 },
  });

  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8" }}>
          My League{leagueName ? ` · ${leagueName}` : ""}
        </span>
        <Link href="/leagues" style={{ fontSize: 10, fontWeight: 700, color: "#06b6d4", textDecoration: "none" }}>
          View all →
        </Link>
      </div>

      <div className="flex-1 py-2 px-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
            ))}
          </div>
        ) : !rows?.length ? (
          <p className="text-center py-8" style={{ fontSize: 12, color: "#475569" }}>No members yet.</p>
        ) : (
          (rows as LeaderboardEntry[]).map((row) => {
            const isMe = row.teamId === teamId;
            const isFirst = row.rank === 1;
            return (
              <div
                key={row.teamId}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
                style={{
                  background: isMe ? "rgba(6,182,212,0.10)" : isFirst ? "rgba(245,158,11,0.06)" : "transparent",
                  border: isMe ? "1px solid rgba(6,182,212,0.22)" : "1px solid transparent",
                }}
              >
                <div
                  className="flex items-center justify-center shrink-0 rounded-full font-black"
                  style={{
                    width: 26, height: 26, fontSize: 11,
                    background: isFirst ? "#f59e0b" : "rgba(255,255,255,0.08)",
                    color: isFirst ? "#000" : "#64748b",
                  }}
                >
                  {row.rank}
                </div>
                <span className="flex-1 text-sm font-semibold truncate" style={{ color: isMe ? "#e2e8f0" : "#94a3b8" }}>
                  {row.managerName}
                  {isMe && <span className="ml-1.5 text-xs" style={{ color: "#06b6d4" }}>(you)</span>}
                </span>
                <span className="text-sm font-black tabular-nums" style={{ color: isMe ? "#06b6d4" : isFirst ? "#f59e0b" : "#cbd5e1" }}>
                  {row.totalPoints}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Top Performers column ────────────────────────────────────────────────────
function TopPerformersCard() {
  const { data: performers } = useGetDashboardTopPerformers({
    query: { queryKey: getGetDashboardTopPerformersQueryKey(), refetchInterval: 120_000 },
  });

  const MEDAL_STYLES = [
    { bg: "rgba(245,158,11,0.18)", border: "rgba(245,158,11,0.45)", pts: "#f59e0b" },
    { bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.18)", pts: "#e2e8f0" },
    { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)", pts: "#94a3b8" },
  ];

  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8" }}>
          Top Performers
        </span>
      </div>

      <div className="flex-1 py-2 px-2">
        {!performers?.length ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <span style={{ fontSize: 22 }}>🏆</span>
            <p style={{ fontSize: 12, color: "#475569" }}>No scores yet</p>
          </div>
        ) : (
          (performers as TopPerformer[]).map((p, i) => {
            const medal = MEDAL_STYLES[i] ?? MEDAL_STYLES[2];
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
                style={{ background: medal.bg, border: `1px solid ${medal.border}` }}
              >
                <div
                  className="flex items-center justify-center shrink-0 rounded-full"
                  style={{ width: 36, height: 36, background: "rgba(0,0,0,0.3)", border: `2px solid ${medal.border}`, fontSize: 16 }}
                >
                  ⚽
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "#f1f5f9" }}>{p.name}</p>
                  <p style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>
                    {p.nationality ?? "—"} · {p.position}
                  </p>
                </div>
                <span className="text-lg font-black tabular-nums" style={{ color: medal.pts }}>
                  {p.totalPoints}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Responsive grid styles (inline @media, not Tailwind breakpoints) ──────────
const DashboardResponsiveStyles = () => (
  <style>{`
    .dash-stat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
    .dash-tri-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
    .dash-skel-stat { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .dash-skel-tri { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
    .dash-squad-strip { display: flex; gap: 1rem; overflow-x: auto; }
    @media (min-width: 768px) {
      .dash-tri-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .dash-skel-tri { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (min-width: 1024px) {
      .dash-stat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .dash-skel-stat { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
  `}</style>
);

// ── Squad Strip ──────────────────────────────────────────────────────────────
function SquadStrip({ teamId }: { teamId: number }) {
  const { data: squad } = useGetDashboardSquad(
    { teamId },
    { query: { queryKey: getGetDashboardSquadQueryKey({ teamId }), enabled: teamId > 0 } }
  );

  if (!squad?.length) return null;

  return (
    <div style={{ ...CARD }}>
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8" }}>
          My Squad · Active Players This GW
        </span>
      </div>

      <div
        className="dash-squad-strip px-4 py-4"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {(squad as SquadPlayer[]).map((p) => {
          const posColor = POS_COLORS[p.position] ?? "#64748b";
          const hasPoints = p.points > 0;
          const lastName = p.name.includes(" ") ? p.name.split(" ").slice(-1)[0] : p.name;
          const natCode = p.nationality ? p.nationality.slice(0, 3).toUpperCase() : "—";

          return (
            <div key={p.playerId} className="flex flex-col items-center shrink-0" style={{ minWidth: 56 }}>
              <div
                className="relative flex items-center justify-center rounded-full font-black"
                style={{
                  width: 52, height: 52,
                  background: hasPoints ? `${posColor}18` : "rgba(15,23,42,0.8)",
                  border: `2.5px solid ${posColor}`,
                  fontSize: 11,
                  color: posColor,
                  letterSpacing: "0.04em",
                }}
              >
                {natCode}
                {p.isCaptain && (
                  <span
                    className="absolute -top-1 -right-1 flex items-center justify-center rounded-full font-black"
                    style={{ width: 16, height: 16, fontSize: 8, background: "#f59e0b", color: "#000" }}
                  >C</span>
                )}
                {p.isViceCaptain && !p.isCaptain && (
                  <span
                    className="absolute -top-1 -right-1 flex items-center justify-center rounded-full font-black"
                    style={{ width: 16, height: 16, fontSize: 8, background: "#64748b", color: "#fff" }}
                  >V</span>
                )}
              </div>
              <p className="mt-1.5 text-center font-semibold truncate" style={{ fontSize: 10, color: "#cbd5e1", maxWidth: 56 }}>
                {lastName}
              </p>
              <p className="font-black" style={{ fontSize: 10, color: hasPoints ? "#22c55e" : "#475569", marginTop: 1 }}>
                {p.points} pts
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── No Squad Prompt ──────────────────────────────────────────────────────────
function NoSquadPrompt() {
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ background: "rgba(8,17,40,0.6)", border: "1px solid rgba(255,255,255,0.06)", minHeight: 180 }}
    >
      <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}>
          <ShieldHalf size={28} style={{ color: "#3b82f6" }} />
        </div>
        <h2 className="text-xl font-black mb-2" style={{ color: "#f1f5f9" }}>No squad picked yet</h2>
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>Build your team of 11 players to compete.</p>
        <Link href="/squad">
          <button
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "#fff", boxShadow: "0 4px 20px rgba(59,130,246,0.35)" }}
          >
            <ShieldHalf size={15} /> Go to Squad Builder
          </button>
        </Link>
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export function Dashboard() {
  const { authState } = useAuth();
  const teamId = authState.status === "authenticated" ? (authState.user.teamId ?? undefined) : undefined;

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary(
    { teamId },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ teamId }), enabled: authState.status === "authenticated" } }
  );

  if (isLoadingSummary || authState.status === "loading") {
    return (
      <div className="space-y-5 animate-pulse w-full overflow-x-hidden">
        <DashboardResponsiveStyles />
        <div className="rounded-2xl" style={{ height: 200, background: "rgba(8,17,40,0.6)" }} />
        <div className="dash-skel-stat">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl" style={{ background: "rgba(8,17,40,0.5)" }} />)}
        </div>
        <div className="dash-skel-tri">
          {[...Array(3)].map((_, i) => <div key={i} className="h-64 rounded-xl" style={{ background: "rgba(8,17,40,0.5)" }} />)}
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
      subColor: "#22c55e",
      Icon: TrendingUp,
      accent: "#06b6d4",
    },
    {
      label: "Global Rank",
      value: summary?.globalRank != null ? `#${summary.globalRank.toLocaleString()}` : "—",
      sub: summary?.globalRank != null ? `of ${summary.leagueCount > 0 ? `${summary.leagueCount + 1} managers` : "managers"}` : "Pending",
      subColor: "#f59e0b",
      Icon: Trophy,
      accent: "#f59e0b",
      bigAccent: true,
    },
    {
      label: "Captain",
      value: summary?.captainName ?? "None",
      sub: `${summary?.captainPoints ?? 0} pts · ${summary?.captainName ? "ENG" : "—"}`,
      subColor: "#94a3b8",
      Icon: Users,
      accent: "#a78bfa",
      smallValue: true,
    },
    {
      label: "Budget",
      value: `£${(summary?.budgetRemaining ?? 100).toFixed(1)}m`,
      sub: "Available",
      subColor: "#94a3b8",
      Icon: Wallet,
      accent: "#22c55e",
    },
  ];

  return (
    <div
      style={{
        position: "relative",
        backgroundImage: "url('/stadium-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed",
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
      }}
    >
      <DashboardResponsiveStyles />
      <div style={{ position: "absolute", inset: 0, background: "rgba(4,8,20,0.72)", pointerEvents: "none", zIndex: 0 }} />

      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full overflow-x-hidden" style={{ position: "relative", zIndex: 1 }}>

        {/* ── Hero header ── */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ backgroundImage: "url('/stadium-bg.jpg')", backgroundSize: "cover", backgroundPosition: "center 30%", minHeight: 140 }}
        >
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(4,10,24,0.55) 0%, rgba(4,10,24,0.85) 60%, rgba(4,10,24,0.97) 100%)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.10) 0%, transparent 70%)" }} />

          <div className="relative z-10 px-4 sm:px-6 pt-6 pb-0">
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={13} color="#06b6d4" style={{ filter: "drop-shadow(0 0 5px #06b6d4)" }} />
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#06b6d4" }}>
                  Live Overview
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: "#f1f5f9", textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}>
                Command Center
              </h1>
              <p style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>{gwLabel}</p>
            </div>

            {/* Stat cards */}
            <div className="dash-stat-grid pb-6">
              {statCards.map(({ label, value, sub, subColor, Icon, accent, smallValue, bigAccent }) => (
                <div
                  key={label}
                  className="relative overflow-hidden rounded-xl transition-transform hover:-translate-y-0.5"
                  style={{
                    background: "rgba(8,17,40,0.76)",
                    backdropFilter: "blur(16px)",
                    border: `1px solid ${accent}28`,
                    boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 16px ${accent}0e`,
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}77, transparent)` }} />
                  <div className="absolute -top-5 -right-5 w-16 h-16 rounded-full opacity-15 pointer-events-none" style={{ background: accent, filter: "blur(16px)" }} />
                  <div className="p-4 relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: "#475569" }}>{label}</span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                        <Icon size={14} style={{ color: accent }} />
                      </div>
                    </div>
                    <div
                      className="font-black leading-none tracking-tight"
                      style={{ fontSize: smallValue ? 17 : 26, fontFamily: smallValue ? "inherit" : "monospace", color: bigAccent ? accent : "#f1f5f9" }}
                    >
                      {value}
                    </div>
                    <div style={{ fontSize: 10, color: subColor ?? "#94a3b8", marginTop: 5, fontWeight: 600 }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 3-column grid ── */}
        <div className="dash-tri-grid">
          <TodayMatchesCard />

          {summary?.firstLeagueId != null ? (
            <MyLeagueCard
              leagueId={summary.firstLeagueId}
              leagueName={summary.firstLeagueName ?? null}
              teamId={teamId}
            />
          ) : (
            <div style={{ ...CARD, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
              <div className="text-center px-4">
                <p style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>No league joined yet</p>
                <Link href="/leagues" style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4" }}>Browse leagues →</Link>
              </div>
            </div>
          )}

          <TopPerformersCard />
        </div>

        {/* ── Squad strip or no-squad prompt ── */}
        {hasSquad && teamId ? (
          <SquadStrip teamId={teamId} />
        ) : (
          <NoSquadPrompt />
        )}

      </div>
    </div>
  );
}
