import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useGetLiveFixtures,
  getGetLiveFixturesQueryKey,
  type LiveFixture,
} from "@workspace/api-client-react";
import { Trophy, TrendingUp, Users, Wallet, Zap, ShieldHalf, CalendarClock } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { Link } from "wouter";
import { format } from "date-fns";

function NoSquadPrompt() {
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0a1628 0%, #0d1b2e 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        minHeight: 240,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.10) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 flex flex-col items-center justify-center h-full py-16 px-6 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}
        >
          <ShieldHalf size={32} style={{ color: "#3b82f6", filter: "drop-shadow(0 0 8px #3b82f6)" }} />
        </div>
        <h2
          className="text-2xl font-black mb-2"
          style={{ color: "#f1f5f9", textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}
        >
          You haven't picked your squad yet
        </h2>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
          Build your team of 11 players and compete in the World Cup 2026 fantasy league.
        </p>
        <Link href="/squad">
          <button
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-100"
            style={{
              background: "linear-gradient(135deg, #2563eb, #3b82f6)",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(59,130,246,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
            }}
          >
            <ShieldHalf size={16} />
            Go to Squad Builder
          </button>
        </Link>
      </div>
    </div>
  );
}

const STATUS_SORT: Record<string, number> = { live: 0, scheduled: 1, finished: 2 };

function TodayMatches() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: fixtures } = useGetLiveFixtures({
    query: { queryKey: getGetLiveFixturesQueryKey(), refetchInterval: 60_000 },
  });

  // Compare using kickoff in local time so live/scheduled games aren't missed
  // due to UTC vs local date mismatch
  const todayMatches = (fixtures ?? [])
    .filter((f: LiveFixture) => format(new Date(f.kickoff), "yyyy-MM-dd") === today)
    .sort((a: LiveFixture, b: LiveFixture) => {
      const sDiff = (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9);
      if (sDiff !== 0) return sDiff;
      return a.kickoff.localeCompare(b.kickoff);
    });

  if (todayMatches.length === 0) return null;

  const liveCount = todayMatches.filter((f: LiveFixture) => f.status === "live").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">Today's Matches</h2>
        {liveCount > 0 && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse"
            style={{
              background: "rgba(239,68,68,0.18)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.35)",
            }}
          >
            {liveCount} Live
          </span>
        )}
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(8,17,40,0.6)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(8px)",
        }}
      >
        {todayMatches.map((fixture, i) => (
          <div
            key={fixture.id}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
            style={i < todayMatches.length - 1 ? { borderBottom: "1px solid rgba(255,255,255,0.05)" } : undefined}
          >
            {/* Home team */}
            <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
              <span className="text-sm font-medium truncate text-right" style={{ color: "#e2e8f0" }}>
                {fixture.homeTeam}
              </span>
              {fixture.homeLogo ? (
                <img
                  src={fixture.homeLogo}
                  alt={fixture.homeTeam}
                  className="w-6 h-6 object-contain shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
              )}
            </div>

            {/* Centre: score or kickoff */}
            <div className="flex flex-col items-center shrink-0" style={{ minWidth: 80 }}>
              {fixture.status === "scheduled" ? (
                <div
                  className="px-2.5 py-1 rounded-md font-mono text-sm"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#94a3b8",
                  }}
                >
                  {format(new Date(fixture.kickoff), "HH:mm")}
                </div>
              ) : (
                <div
                  className="px-3 py-1 rounded-md font-mono text-base font-bold flex gap-2"
                  style={
                    fixture.status === "live"
                      ? {
                          background: "rgba(239,68,68,0.12)",
                          border: "1px solid rgba(239,68,68,0.35)",
                          color: "#f87171",
                        }
                      : {
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "#e2e8f0",
                        }
                  }
                >
                  <span>{fixture.homeScore ?? 0}</span>
                  <span style={{ color: "#475569" }}>–</span>
                  <span>{fixture.awayScore ?? 0}</span>
                </div>
              )}

              {fixture.status === "live" && (
                <span
                  className="mt-1 px-1.5 py-0.5 rounded animate-pulse"
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase" as const,
                    background: "rgba(239,68,68,0.2)",
                    color: "#f87171",
                    border: "1px solid rgba(239,68,68,0.35)",
                  }}
                >
                  {fixture.elapsed != null ? `${fixture.elapsed}'` : "Live"}
                </span>
              )}
              {fixture.status === "finished" && (
                <span
                  className="mt-1"
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    color: "#475569",
                  }}
                >
                  FT
                </span>
              )}
            </div>

            {/* Away team */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              {fixture.awayLogo ? (
                <img
                  src={fixture.awayLogo}
                  alt={fixture.awayTeam}
                  className="w-6 h-6 object-contain shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
              )}
              <span className="text-sm font-medium truncate" style={{ color: "#e2e8f0" }}>
                {fixture.awayTeam}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { authState } = useAuth();
  const teamId = authState.status === "authenticated" ? (authState.user.teamId ?? undefined) : undefined;

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary(
    { teamId },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ teamId }), enabled: authState.status === "authenticated" } }
  );

  if (isLoadingSummary || authState.status === "loading") {
    return (
      <div className="space-y-6 animate-pulse">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ height: 280, background: "linear-gradient(135deg, #0a1628 0%, #0d1b2e 100%)" }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-secondary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const hasSquad = summary?.hasSquad ?? false;

  const statCards = [
    {
      label: "GW Points",
      value: String(summary?.gameweekPoints ?? 0),
      sub: "",
      Icon: TrendingUp,
      accent: "#06b6d4",
    },
    {
      label: "Global Rank",
      value: summary?.globalRank != null ? `#${summary.globalRank.toLocaleString()}` : "—",
      sub: summary?.globalRank != null ? "Based on total points" : "Pending",
      Icon: Trophy,
      accent: "#f59e0b",
    },
    {
      label: "Captain",
      value: summary?.captainName ?? "None Set",
      sub: summary?.captainPoints ? `${summary.captainPoints * 2} pts (×2)` : "0 pts",
      Icon: Users,
      accent: "#a78bfa",
      smallValue: true,
    },
    {
      label: "Budget",
      value: `£${(summary?.budgetRemaining ?? 100).toFixed(1)}m`,
      sub: "Available to spend",
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
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(4, 8, 20, 0.82)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Content */}
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ position: "relative", zIndex: 1 }}>

      {/* ── Hero section with stadium background ── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          backgroundImage: "url('/stadium-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          minHeight: 160,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(4,10,24,0.55) 0%, rgba(4,10,24,0.82) 60%, rgba(4,10,24,0.97) 100%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.12) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 px-4 sm:px-6 pt-5 sm:pt-8 pb-0">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} color="#06b6d4" style={{ filter: "drop-shadow(0 0 6px #06b6d4)" }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#06b6d4" }}>
                Live Overview
              </span>
            </div>
            <h1
              className="text-2xl sm:text-4xl font-black tracking-tight"
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.6)", color: "#f1f5f9" }}
            >
              Command Center
            </h1>
            <p style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>Live match week overview</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pb-6">
            {statCards.map(({ label, value, sub, Icon, accent, smallValue }) => (
              <div
                key={label}
                className="relative overflow-hidden rounded-xl group transition-transform hover:-translate-y-0.5"
                style={{
                  background: "rgba(8, 17, 40, 0.72)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: `1px solid ${accent}28`,
                  boxShadow: `0 0 0 0.5px rgba(255,255,255,0.04) inset, 0 4px 24px rgba(0,0,0,0.4), 0 0 20px ${accent}10`,
                }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
                />
                <div
                  className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-20 transition-opacity group-hover:opacity-30"
                  style={{ background: accent, filter: "blur(20px)" }}
                />
                <div className="p-3 sm:p-5 relative z-10">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
                      {label}
                    </span>
                    <div
                      className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${accent}18`, border: `1px solid ${accent}33` }}
                    >
                      <Icon size={13} className="sm:hidden" style={{ color: accent }} />
                      <Icon size={16} className="hidden sm:block" style={{ color: accent, filter: `drop-shadow(0 0 4px ${accent})` }} />
                    </div>
                  </div>
                  <div
                    className="font-black leading-none tracking-tight"
                    style={{
                      fontSize: smallValue ? 16 : 24,
                      fontFamily: smallValue ? "inherit" : "monospace",
                      color: "#f1f5f9",
                      textShadow: "0 1px 8px rgba(0,0,0,0.4)",
                    }}
                  >
                    {value}
                  </div>
                  <div style={{ fontSize: 10, color: accent, marginTop: 4, fontWeight: 600 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Today's Matches ── */}
      <TodayMatches />

      {/* ── No squad prompt OR bottom section ── */}
      {!hasSquad ? (
        <NoSquadPrompt />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Activity — empty state until tournament starts */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold">Match Activity</h2>
            <div
              className="rounded-xl flex flex-col items-center justify-center py-14 px-6 text-center"
              style={{
                background: "rgba(8,17,40,0.6)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.18)" }}
              >
                <CalendarClock size={26} style={{ color: "#06b6d4" }} />
              </div>
              <p className="font-semibold text-sm" style={{ color: "#94a3b8" }}>
                No match activity yet
              </p>
              <p className="text-xs mt-1.5 max-w-xs" style={{ color: "#475569" }}>
                No player activity this gameweek yet.
              </p>
            </div>
          </div>

          {/* Top Scorer */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Top Scorer</h2>
            <div
              className="rounded-xl p-6 text-center relative overflow-hidden"
              style={{
                background: "rgba(8,17,40,0.6)",
                border: "1px solid rgba(245,158,11,0.2)",
                boxShadow: "0 0 30px rgba(245,158,11,0.06)",
              }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 -mt-10 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)" }}
              />
              {summary?.topScorerName ? (
                <>
                  <div
                    className="relative w-24 h-24 mx-auto rounded-full flex items-center justify-center text-4xl mb-4"
                    style={{
                      background: "linear-gradient(135deg, rgba(8,17,40,0.9), rgba(13,27,62,0.9))",
                      border: "2px solid rgba(245,158,11,0.5)",
                      boxShadow: "0 0 20px rgba(245,158,11,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
                    }}
                  >
                    ⚽
                  </div>
                  <h3 className="font-bold text-xl">{summary.topScorerName}</h3>
                  <p
                    className="font-mono text-lg mt-1 font-bold"
                    style={{ color: "#f59e0b", textShadow: "0 0 12px rgba(245,158,11,0.5)" }}
                  >
                    {summary.topScorerPoints ?? 0} pts
                  </p>
                </>
              ) : (
                <div className="relative py-4 flex flex-col items-center gap-3">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
                    style={{ background: "rgba(245,158,11,0.08)", border: "1px dashed rgba(245,158,11,0.25)" }}
                  >
                    ⚽
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "#475569" }}>No gameweek data yet</p>
                  <p className="text-xs" style={{ color: "#334155" }}>Top scorer will appear once the tournament begins</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
    </div>
  );
}
