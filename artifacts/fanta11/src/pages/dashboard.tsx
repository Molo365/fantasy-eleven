import { useGetDashboardSummary, useGetRecentActivity } from "@workspace/api-client-react";
import { Trophy, TrendingUp, Users, Wallet, Activity as ActivityIcon, Zap, ShieldHalf } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { Link } from "wouter";

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

export function Dashboard() {
  const { authState } = useAuth();
  const teamId = authState.status === "authenticated" ? (authState.user.teamId ?? undefined) : undefined;

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary(
    { teamId },
    { query: { enabled: authState.status === "authenticated" } }
  );
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity(
    { teamId, limit: 10 },
    { query: { enabled: authState.status === "authenticated" } }
  );

  if (isLoadingSummary || isLoadingActivity || authState.status === "loading") {
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
      sub: `Total: ${summary?.teamPoints ?? 0} pts`,
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Hero section with stadium background ── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          backgroundImage: "url('/stadium.png')",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          minHeight: 260,
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

        <div className="relative z-10 px-6 pt-8 pb-0">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} color="#06b6d4" style={{ filter: "drop-shadow(0 0 6px #06b6d4)" }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#06b6d4" }}>
                Live Overview
              </span>
            </div>
            <h1
              className="text-4xl font-black tracking-tight"
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.6)", color: "#f1f5f9" }}
            >
              Command Center
            </h1>
            <p style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>Live match week overview</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-6">
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
                <div className="p-5 relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569" }}>
                      {label}
                    </span>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${accent}18`, border: `1px solid ${accent}33` }}
                    >
                      <Icon size={16} style={{ color: accent, filter: `drop-shadow(0 0 4px ${accent})` }} />
                    </div>
                  </div>
                  <div
                    className="font-black leading-none tracking-tight"
                    style={{
                      fontSize: smallValue ? 22 : 32,
                      fontFamily: smallValue ? "inherit" : "monospace",
                      color: "#f1f5f9",
                      textShadow: "0 1px 8px rgba(0,0,0,0.4)",
                    }}
                  >
                    {value}
                  </div>
                  <div style={{ fontSize: 11, color: accent, marginTop: 6, fontWeight: 600 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── No squad prompt OR bottom section ── */}
      {!hasSquad ? (
        <NoSquadPrompt />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Activity Feed */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ActivityIcon className="text-primary h-5 w-5" style={{ filter: "drop-shadow(0 0 6px #06b6d4)" }} />
              Live Activity Feed
            </h2>
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "rgba(8,17,40,0.6)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(8px)",
              }}
            >
              {activity && activity.length > 0 ? (
                activity.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/[0.03]"
                    style={{ borderBottom: idx < activity.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                  >
                    <div>
                      <div className="font-bold text-sm text-foreground">{item.playerName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                    </div>
                    <div
                      className="font-mono font-bold text-sm px-3 py-1 rounded-lg"
                      style={{
                        color: "#06b6d4",
                        background: "rgba(6,182,212,0.1)",
                        border: "1px solid rgba(6,182,212,0.2)",
                        textShadow: "0 0 8px rgba(6,182,212,0.5)",
                      }}
                    >
                      +{item.points}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center" style={{ color: "#475569" }}>
                  No recent activity to display.
                </div>
              )}
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
  );
}
