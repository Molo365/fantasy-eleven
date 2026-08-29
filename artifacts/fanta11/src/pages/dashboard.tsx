import { useEffect, useState, type ReactNode } from "react";
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
  type DashboardSummary,
  type GetLiveFixturesParams,
} from "@workspace/api-client-react";
import { ChevronDown, Trophy, ShieldHalf } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useLeagueContext } from "@/contexts/league";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

const CARD: React.CSSProperties = {
  background: "rgba(8,17,40,0.68)",
  border: "1px solid rgba(255,255,255,0.07)",
  backdropFilter: "blur(12px)",
  borderRadius: 16,
  overflow: "hidden",
};

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);
    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

function ResponsiveDisclosure({
  title,
  count,
  liveCount,
  testId,
  desktopContent,
  mobileContent,
}: {
  title: string;
  count?: string;
  liveCount?: number;
  testId: string;
  desktopContent: ReactNode;
  mobileContent: ReactNode;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);

  if (isDesktop) return desktopContent;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-testid={testId}
      style={{ ...CARD, display: "flex", flexDirection: "column" }}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          style={{ color: "#e2e8f0", borderBottom: open ? "1px solid rgba(255,255,255,0.06)" : "none" }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#94a3b8]">
              {title}
            </span>
            {liveCount ? (
              <span
                className="animate-pulse rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em]"
                style={{ background: "rgba(239,68,68,0.18)", color: "#f87171", border: "1px solid rgba(239,68,68,0.35)" }}
              >
                {liveCount} Live
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            {count ? <span className="text-[10px] font-bold text-[#64748b]">{count}</span> : null}
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`text-[#7ab4ff] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>{mobileContent}</CollapsibleContent>
    </Collapsible>
  );
}

// ── Today's Matches column ────────────────────────────────────────────────────
function TodayMatchesCard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const fixtureParams: GetLiveFixturesParams = { leagueKey: "all" };
  const { data: fixtures } = useGetLiveFixtures(fixtureParams, {
    query: { queryKey: getGetLiveFixturesQueryKey(fixtureParams), refetchInterval: 60_000 },
  });

  const todayMatches = (fixtures ?? [])
    .filter((f: LiveFixture) => format(new Date(f.kickoff), "yyyy-MM-dd") === today)
    .sort((a: LiveFixture, b: LiveFixture) => a.kickoff.localeCompare(b.kickoff));

  const liveCount = todayMatches.filter((f: LiveFixture) => f.status === "live").length;

  const matchesBody = (
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
              key={`${f.leagueKey}-${f.id}`}
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
  );

  const desktopContent = (
    <div data-testid="card-today-matches" style={{ ...CARD, display: "flex", flexDirection: "column" }}>
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
      {matchesBody}
    </div>
  );

  return (
    <ResponsiveDisclosure
      title="Today's Matches"
      liveCount={liveCount}
      testId="card-today-matches"
      desktopContent={desktopContent}
      mobileContent={matchesBody}
    />
  );
}

// ── My League column ──────────────────────────────────────────────────────────
function MyLeagueCard({ leagueId, leagueName, teamId }: { leagueId: number; leagueName: string | null; teamId: number | undefined }) {
  const { data: rows, isLoading } = useGetLeagueLeaderboard(leagueId, {
    query: { queryKey: getGetLeagueLeaderboardQueryKey(leagueId), enabled: leagueId > 0 },
  });

  return (
    <div data-testid="card-league-standings" style={{ ...CARD, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8" }}>
          My League{leagueName ? ` · ${leagueName}` : ""}
        </span>
        <Link href="/leagues" style={{ fontSize: 10, fontWeight: 700, color: "#06b6d4", textDecoration: "none" }}>
          View all →
        </Link>
      </div>

      <div style={{ flex: 1, padding: 16 }}>
        {leagueId <= 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-6">
             <p className="text-[13px] text-[#5d7ba8] mb-3">You haven't joined a league yet.</p>
             <Link href="/leagues" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#06b6d4]/10 text-[#06b6d4] font-bold text-xs border border-[#06b6d4]/20 hover:bg-[#06b6d4]/20 transition-colors">
               Find a League →
             </Link>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:flex md:flex-col">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse" style={{ height: 112, borderRadius: 12, background: "rgba(255,255,255,0.05)" }} />
            ))}
          </div>
        ) : !rows?.length ? (
          <p style={{ textAlign: "center", padding: "32px 0", fontSize: 12, color: "#5d7ba8" }}>No members yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:flex md:flex-col md:gap-4">
            {(rows as LeaderboardEntry[]).map((row) => {
              const isMe = row.teamId === teamId;
              const isFirst = row.rank === 1;
              return (
                <div
                  key={row.teamId}
                  className="flex flex-row items-center gap-3 min-h-0 px-3 py-3 rounded-xl"
                  style={{
                    background: isFirst
                      ? "linear-gradient(135deg, #ffd873 0%, #e8a627 100%)"
                      : "linear-gradient(135deg, #1a2c54 0%, #101d3a 100%)",
                    border: isMe ? "1px solid rgba(6,182,212,0.7)" : isFirst ? "1px solid rgba(255,196,54,0.5)" : "1px solid rgba(93,156,236,0.3)",
                    boxShadow: isFirst ? "0 4px 20px rgba(255,196,54,0.25)" : "0 2px 12px rgba(0,0,0,0.3)",
                  }}
                >
                  <span className="shrink-0" style={{ fontSize: 11, fontWeight: 900, color: isFirst ? "#2a1900" : "#7ab4ff" }}>
                    {isFirst ? "🥇" : `#${row.rank}`}
                  </span>
                  <span className="truncate flex-1 min-w-0" style={{ fontSize: 14, fontWeight: 700, color: isFirst ? "#2a1900" : "#e2e8f0" }}>
                    {row.managerName}
                    {isMe && <span style={{ marginLeft: 6, fontSize: 11, color: isFirst ? "#7a5200" : "#06b6d4" }}>(you)</span>}
                  </span>
                  <span className="tabular-nums shrink-0" style={{ fontSize: 18, fontWeight: 900, color: isFirst ? "#2a1900" : isMe ? "#06b6d4" : "#f1f5f9" }}>
                    {row.totalPoints}
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
function TopPerformersCard({ competitionKey }: { competitionKey: string }) {
  const params = { competitionKey: (competitionKey === "serie-a" ? "serie-a" : "premier-league") as "serie-a" | "premier-league" };
  const { data: performers } = useGetDashboardTopPerformers(params, {
    query: { queryKey: getGetDashboardTopPerformersQueryKey(params), refetchInterval: 120_000 },
  });

  const MEDAL_STYLES = [
    { bg: "rgba(255,196,54,0.08)", pts: "#ffc436" },
    { bg: "rgba(255,255,255,0.06)", pts: "#e2e8f0" },
    { bg: "rgba(255,255,255,0.03)", pts: "#8fa3c9" },
  ];

  return (
    <div data-testid="card-top-performers" style={{ ...CARD, display: "flex", flexDirection: "column" }}>
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
          <div className="grid grid-cols-1 gap-2 md:flex md:flex-col md:gap-4">
            {(performers as TopPerformer[]).map((p, i) => {
              const medal = MEDAL_STYLES[i] ?? MEDAL_STYLES[2];
              const isTop = i === 0;
              return (
              <div
                key={p.id}
                className="flex flex-row items-center gap-3 min-h-0 px-3 py-2 rounded-xl md:py-3"
                style={{
                  background: isTop ? "linear-gradient(135deg, #ffd873 0%, #e8a627 100%)" : "linear-gradient(135deg, #1a2c54 0%, #101d3a 100%)",
                  border: isTop ? "1px solid rgba(255,196,54,0.5)" : "1px solid rgba(93,156,236,0.3)",
                  boxShadow: isTop ? "0 4px 20px rgba(255,196,54,0.25)" : "0 2px 12px rgba(0,0,0,0.3)",
                }}
              >
                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, borderRadius: "50%",
                    background: isTop ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.3)",
                    border: isTop ? "1px solid rgba(0,0,0,0.2)" : "2px solid rgba(255,255,255,0.12)",
                    fontSize: 16,
                  }}
                  className="h-8 w-8 md:h-9 md:w-9"
                >
                  {isTop ? "🔥" : "⚽"}
                </div>
                <div className="flex-1 min-w-0">
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
  const squadListContent = (
    <div
      className="flex flex-col gap-4 p-4 md:grid md:grid-cols-3"
      style={{ scrollbarWidth: "thin" }}
    >
      {squadList.map((p) => (
        <SquadPlayerCard key={p.playerId} p={p} />
      ))}
    </div>
  );

  const desktopContent = (
    <div data-testid="card-squad-strip" style={{ ...CARD }}>
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8" }}>
          My Squad · Active Players This GW
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#475569" }}>
          {squadList.length}/15
        </span>
      </div>
      {squadListContent}
    </div>
  );

  return (
    <ResponsiveDisclosure
      title="My Squad · Active Players This GW"
      count={`${squadList.length}/15`}
      testId="card-squad-strip"
      desktopContent={desktopContent}
      mobileContent={squadListContent}
    />
  );
}

// ── No Squad Prompt ───────────────────────────────────────────────────────────
function NoSquadPrompt() {
  return (
    <div
      data-testid="state-no-squad"
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

// ── Dashboard Strip ────────────────────────────────────────────────────────────
function CompetitionStripItem({
  competitionKey,
  team,
  summary,
  leagueName,
  isLoading,
  isActive,
  onClick
}: {
  competitionKey: string;
  team: { id: number } | undefined;
  summary: DashboardSummary | undefined;
  leagueName: string | null | undefined;
  isLoading: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const label = competitionKey === "premier-league" ? "Premier League" : "Serie A";
  const leagueMark = competitionKey === "premier-league" ? "PL" : "SA";
  const leagueMarkColor = competitionKey === "premier-league" ? "#7ab4ff" : "#22c55e";

  if (!team) {
     return (
        <button onClick={onClick} className={`flex-1 flex items-center justify-between rounded-xl p-3 md:min-h-[104px] md:p-4 text-left transition-all ${isActive ? 'bg-[#1a2c54] border-[#06b6d4]/50' : 'bg-[rgba(8,17,40,0.6)] border-[rgba(255,255,255,0.05)] hover:bg-[rgba(16,29,58,0.8)]'} border`} data-testid={`competition-strip-${competitionKey}`}>
         <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-black tracking-wider opacity-60"
              style={{ color: leagueMarkColor, background: `${leagueMarkColor}18`, border: `1px solid ${leagueMarkColor}35` }}
            >
              {leagueMark}
            </span>
           <div>
             <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#94a3b8]">{label}</p>
             <p className="text-sm font-semibold text-[#5d7ba8]">No team yet</p>
           </div>
         </div>
       </button>
     )
  }

  if (isLoading) {
      return <div className="flex-1 animate-pulse rounded-xl h-[68px] md:h-[104px]" style={{ background: "rgba(255,255,255,0.05)" }} />
  }

  return (
    <button
      onClick={onClick}
       className={`flex-1 rounded-xl p-3 md:min-h-[104px] md:p-4 flex items-center justify-between transition-all border ${
        isActive
          ? 'bg-gradient-to-r from-[#1a2c54] to-[#101d3a] border-[#06b6d4]/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
          : 'bg-[rgba(8,17,40,0.4)] border-[rgba(255,255,255,0.1)] hover:bg-[rgba(16,29,58,0.6)]'
      }`}
      data-testid={`competition-strip-${competitionKey}`}
    >
       <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-black tracking-wider"
            style={{ color: leagueMarkColor, background: `${leagueMarkColor}18`, border: `1px solid ${leagueMarkColor}35` }}
          >
            {leagueMark}
          </span>
          <div className="text-left flex flex-col justify-center">
              <p className={`text-[10px] font-extrabold uppercase tracking-widest ${isActive ? 'text-[#7ab4ff]' : 'text-[#64748b]'}`}>{label}</p>
              <p className="hidden md:block mt-0.5 max-w-[190px] truncate text-xs font-semibold text-[#e2e8f0]">
                {leagueName ?? "No league joined"}
              </p>
              <div className="flex items-center gap-3 mt-1 md:mt-2">
                <span className="text-sm font-bold text-[#e2e8f0]">
                  {summary?.globalRank ? `#${summary.globalRank.toLocaleString()} ` : "Unranked"}
                  <span className="text-[10px] font-medium text-[#64748b] ml-1">of {summary?.competitionTeamCount || 0}</span>
                </span>
                <div className="w-px h-3 bg-white/20" />
                <span className="text-sm font-black text-[#ffc436]">{summary?.teamPoints ?? 0} <span className="text-[10px] font-bold text-[#ffc436]/70 ml-0.5">PTS</span></span>
                <div className="w-px h-3 bg-white/20" />
                <span className="text-sm font-bold text-[#e2e8f0]">£{(summary?.budgetRemaining ?? 100).toFixed(1)}<span className="text-[10px] font-medium text-[#64748b] ml-0.5">m</span></span>
             </div>
          </div>
       </div>

       <div className="text-right hidden sm:block">
          <p className="text-[9px] font-bold text-[#64748b] uppercase tracking-widest mb-1">Next Kickoff</p>
          {summary?.nextKickoff ? (
             <span className="font-mono text-xs font-semibold text-[#f1f5f9] bg-black/30 px-2 py-1 rounded border border-white/10">
               {format(new Date(summary.nextKickoff), "MMM d, HH:mm")}
             </span>
          ) : (
             <span className="text-xs text-[#64748b]">—</span>
          )}
       </div>
    </button>
  )
}

function NoTeamPrompt({ competitionKey }: { competitionKey: string }) {
  const label = competitionKey === "premier-league" ? "Premier League" : "Serie A";
  return (
    <div data-testid={`state-no-team-${competitionKey}`} style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "rgba(8,17,40,0.6)", border: "1px solid rgba(255,255,255,0.06)", minHeight: 180 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.25)" }}>
          <Trophy size={28} style={{ color: "#06b6d4" }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8, color: "#f1f5f9" }}>No {label} Team</h2>
        <p style={{ color: "#5d7ba8", fontSize: 13, marginBottom: 20 }}>You are not participating in the {label} competition.</p>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export function Dashboard() {
  const { authState } = useAuth();
  const user = authState.status === "authenticated" ? authState.user : null;
  const { activeCompetitionKey, setActiveCompetitionKey, activeTeamId, activeLeagueId, activeLeague } = useLeagueContext();

  const plTeam = user?.teams.find((t) => t.competitionKey === "premier-league");
  const saTeam = user?.teams.find((t) => t.competitionKey === "serie-a");

  const { data: summaryPL, isLoading: isLoadingPL } = useGetDashboardSummary(
    { competitionKey: "premier-league" },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ competitionKey: "premier-league" }), enabled: !!plTeam } }
  );

  const { data: summarySA, isLoading: isLoadingSA } = useGetDashboardSummary(
    { competitionKey: "serie-a" },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ competitionKey: "serie-a" }), enabled: !!saTeam } }
  );

  if (authState.status === "loading") {
    return (
      <div
        className="animate-pulse"
        style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", maxWidth: "100%", overflow: "hidden", padding: 24 }}
      >
        <div style={{ display: "flex", gap: 12 }}>
           <div style={{ flex: 1, height: 68, borderRadius: 12, background: "rgba(8,17,40,0.5)" }} />
           <div style={{ flex: 1, height: 68, borderRadius: 12, background: "rgba(8,17,40,0.5)" }} />
        </div>
        <div style={{ display: "flex", gap: 16 }}>
           <div style={{ flex: 2, height: 400, borderRadius: 16, background: "rgba(8,17,40,0.6)" }} />
           <div style={{ flex: 1, height: 400, borderRadius: 16, background: "rgba(8,17,40,0.6)" }} />
        </div>
      </div>
    );
  }

  const activeSummary = activeCompetitionKey === "premier-league" ? summaryPL : summarySA;
  const hasSquad = activeSummary?.hasSquad ?? false;

  return (
    <div
      style={{
        position: "relative",
        background: "linear-gradient(180deg, #0a1530 0%, #132348 100%)",
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
        minHeight: "100dvh",
        paddingBottom: 40
      }}
    >
      <div
        className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6 w-full p-4 md:p-6"
        style={{ position: "relative", zIndex: 1, overflowX: "hidden", maxWidth: 1200, margin: "0 auto" }}
      >
        {/* Competition Strip */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
           <CompetitionStripItem
              competitionKey="premier-league"
              team={plTeam}
              summary={summaryPL}
              leagueName={summaryPL?.firstLeagueName}
              isLoading={isLoadingPL}
              isActive={activeCompetitionKey === "premier-league"}
              onClick={() => setActiveCompetitionKey("premier-league")}
           />
           <CompetitionStripItem
              competitionKey="serie-a"
              team={saTeam}
              summary={summarySA}
              leagueName={summarySA?.firstLeagueName}
              isLoading={isLoadingSA}
              isActive={activeCompetitionKey === "serie-a"}
              onClick={() => setActiveCompetitionKey("serie-a")}
           />
        </div>

        {/* Squad and standings */}
        <div className="grid gap-6 w-full items-start lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)]">
           <div className="order-2 flex flex-col gap-6 w-full min-w-0 lg:order-2" data-testid="dashboard-main-column">
             {!activeTeamId ? (
                <NoTeamPrompt competitionKey={activeCompetitionKey} />
             ) : !hasSquad ? (
                <NoSquadPrompt />
             ) : (
                <SquadStrip teamId={activeTeamId} />
             )}
           </div>
           <div className="order-1 flex flex-col gap-6 w-full min-w-0 lg:order-1" data-testid="dashboard-sidebar">
              <MyLeagueCard leagueId={activeLeagueId ?? 0} leagueName={activeLeague?.name ?? null} teamId={activeTeamId} />
           </div>
        </div>

        {/* Competition activity */}
        <div className="grid gap-6 w-full md:grid-cols-2">
          <TodayMatchesCard />
          <TopPerformersCard competitionKey={activeCompetitionKey} />
        </div>
      </div>
    </div>
  );
}
