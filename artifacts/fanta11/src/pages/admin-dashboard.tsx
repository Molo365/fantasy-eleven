import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { Loader2, Shield, Users, LayoutGrid, BarChart2, Trash2, AlertTriangle, ChevronRight, Pencil, Check, X, LogOut, Trophy } from "lucide-react";

const ADMIN_EMAIL = "domenicg@gmx.com";
const API = "/api/admin";

type Stats = { userCount: number; teamCount: number; processedCount: number };
type AdminUser = { id: number; username: string; email: string; displayName: string; createdAt: string; squadSubmitted: boolean; totalPoints: number };
type AdminPlayer = { id: number; name: string; club: string; clubShortName: string; position: string; price: number; totalPoints: number };
type AdminGameweek = { id: number; number: number; name: string; round: string; status: string; startDate: string; endDate: string };
type AdminLeague = { id: number; name: string; code: string; memberCount: number; createdAt: string };

type Tab = "users" | "players" | "gameweeks" | "leagues";

type ConfirmDialog = {
  open: boolean;
  title: string;
  message: string;
  danger?: boolean;
  onConfirm: () => void;
};

type EditPlayer = { id: number; name: string; club: string; clubShortName: string; position: string; price: string };

const CLOSED_CONFIRM: ConfirmDialog = { open: false, title: "", message: "", onConfirm: () => {} };

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100vh",
    background: "#08111e",
    color: "#e2e8f0",
    fontFamily: "'Inter', sans-serif",
  } as React.CSSProperties,
  topbar: {
    background: "#0d1b2e",
    borderBottom: "1px solid #1e3550",
    padding: "0 24px",
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,
  topbarLeft: { display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
  topbarTitle: { fontWeight: 700, fontSize: 15, color: "#f1f5f9", letterSpacing: "0.03em" } as React.CSSProperties,
  topbarDot: { color: "#475569", margin: "0 6px" },
  topbarSub: { color: "#64748b", fontSize: 13 },
  signOutBtn: {
    display: "flex", alignItems: "center", gap: 6,
    background: "transparent", border: "1px solid #1e3550",
    color: "#94a3b8", padding: "6px 14px", borderRadius: 6,
    cursor: "pointer", fontSize: 13, fontWeight: 500,
    transition: "all 0.15s",
  } as React.CSSProperties,
  body: { padding: "28px 28px", maxWidth: 1200, margin: "0 auto" } as React.CSSProperties,
  sectionLabel: {
    display: "flex", alignItems: "center", gap: 8,
    fontSize: 12, fontWeight: 700, letterSpacing: "0.12em",
    textTransform: "uppercase" as const, color: "#64748b",
    marginBottom: 16,
  },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 32 } as React.CSSProperties,
  statCard: {
    background: "#0d1b2e", border: "1px solid #1e3550",
    borderRadius: 10, padding: "20px 20px",
    display: "flex", alignItems: "center", gap: 16,
  } as React.CSSProperties,
  statIcon: {
    width: 44, height: 44, borderRadius: 10,
    background: "rgba(6,182,212,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,
  statNum: { fontSize: 30, fontWeight: 800, color: "#f1f5f9", lineHeight: 1 },
  statLabel: { fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#64748b", marginBottom: 4 },
  dangerSection: {
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.04)",
    borderRadius: 10, padding: "18px 20px",
    marginBottom: 32,
  } as React.CSSProperties,
  dangerLabel: {
    display: "flex", alignItems: "center", gap: 8,
    fontSize: 12, fontWeight: 700, letterSpacing: "0.12em",
    textTransform: "uppercase" as const, color: "#ef4444",
    marginBottom: 14,
  },
  dangerBtns: { display: "flex", gap: 12 } as React.CSSProperties,
  btnOutlineDanger: {
    background: "transparent", border: "1px solid #ef4444",
    color: "#ef4444", padding: "8px 18px", borderRadius: 6,
    cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
  } as React.CSSProperties,
  btnSolidDanger: {
    background: "#ef4444", border: "1px solid #ef4444",
    color: "#fff", padding: "8px 18px", borderRadius: 6,
    cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
  } as React.CSSProperties,
  tabsRow: { display: "flex", gap: 2, marginBottom: 0, borderBottom: "1px solid #1e3550" } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    padding: "10px 18px", cursor: "pointer", fontSize: 12, fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase",
    borderBottom: active ? "2px solid #06b6d4" : "2px solid transparent",
    color: active ? "#06b6d4" : "#64748b",
    background: "transparent", border: "none",
    transition: "all 0.15s",
  }),
  badge: (color: string): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 4,
    fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase",
    background: color === "active" ? "rgba(34,197,94,0.15)" : color === "finished" ? "rgba(100,116,139,0.2)" : "rgba(234,179,8,0.15)",
    color: color === "active" ? "#22c55e" : color === "finished" ? "#94a3b8" : "#eab308",
    border: `1px solid ${color === "active" ? "rgba(34,197,94,0.3)" : color === "finished" ? "rgba(100,116,139,0.3)" : "rgba(234,179,8,0.3)"}`,
  }),
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: {
    padding: "10px 14px", textAlign: "left" as const,
    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
    textTransform: "uppercase" as const, color: "#475569",
    borderBottom: "1px solid #1e3550",
  },
  td: {
    padding: "10px 14px", borderBottom: "1px solid #0f2035",
    verticalAlign: "middle" as const,
  },
  trashBtn: {
    background: "transparent", border: "none",
    color: "#ef4444", cursor: "pointer", padding: 4, borderRadius: 4,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  } as React.CSSProperties,
  editBtn: {
    background: "transparent", border: "none",
    color: "#06b6d4", cursor: "pointer", padding: 4, borderRadius: 4,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  } as React.CSSProperties,
  actionBtn: (variant: "teal" | "gray"): React.CSSProperties => ({
    background: variant === "teal" ? "rgba(6,182,212,0.12)" : "rgba(100,116,139,0.12)",
    border: `1px solid ${variant === "teal" ? "rgba(6,182,212,0.3)" : "rgba(100,116,139,0.3)"}`,
    color: variant === "teal" ? "#06b6d4" : "#94a3b8",
    padding: "4px 10px", borderRadius: 5, cursor: "pointer",
    fontSize: 11, fontWeight: 600, transition: "all 0.15s",
  }),
  input: {
    background: "#0d1b2e", border: "1px solid #1e3550",
    color: "#f1f5f9", padding: "4px 8px", borderRadius: 4,
    fontSize: 12, width: "100%", outline: "none",
  } as React.CSSProperties,
  modalOverlay: {
    position: "fixed" as const, inset: 0,
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(3px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999,
  },
  modalCard: {
    background: "#0d1b2e", border: "1px solid #1e3550",
    borderRadius: 12, padding: 28, maxWidth: 420, width: "90%",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  } as React.CSSProperties,
};

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmModal({ dialog, onClose }: { dialog: ConfirmDialog; onClose: () => void }) {
  if (!dialog.open) return null;
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalCard} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <AlertTriangle size={20} color={dialog.danger ? "#ef4444" : "#eab308"} />
          <span style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>{dialog.title}</span>
        </div>
        <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{dialog.message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ ...S.signOutBtn, border: "1px solid #1e3550" }}>Cancel</button>
          <button
            onClick={() => { dialog.onConfirm(); onClose(); }}
            style={dialog.danger ? S.btnSolidDanger : { ...S.btnSolidDanger, background: "#06b6d4", borderColor: "#06b6d4" }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Player Modal ────────────────────────────────────────────────────────

function EditPlayerModal({
  player,
  onSave,
  onClose,
}: {
  player: EditPlayer | null;
  onSave: (p: EditPlayer) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EditPlayer | null>(player);
  useEffect(() => { setForm(player); }, [player]);
  if (!form) return null;

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalCard} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>Edit Player</span>
          <button style={S.trashBtn} onClick={onClose}><X size={16} /></button>
        </div>
        {(["name", "club", "clubShortName", "position", "price"] as const).map(field => (
          <div key={field} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
              {field === "clubShortName" ? "Club Short" : field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
            <input
              style={S.input}
              value={form[field]}
              onChange={e => setForm(f => f ? { ...f, [field]: e.target.value } : f)}
            />
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ ...S.signOutBtn }}>Cancel</button>
          <button onClick={() => { onSave(form); onClose(); }} style={{ ...S.btnSolidDanger, background: "#06b6d4", borderColor: "#06b6d4" }}>
            <Check size={14} style={{ marginRight: 4 }} />Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Gameweek Modal ────────────────────────────────────────────────────

type CreateGwForm = { name: string; startDate: string; endDate: string };

function CreateGameweekModal({
  open, loading, error, form, onFormChange, onSubmit, onClose,
}: {
  open: boolean; loading: boolean; error: string | null;
  form: CreateGwForm;
  onFormChange: (f: CreateGwForm) => void;
  onSubmit: () => void; onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalCard} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>Create Gameweek</span>
          <button style={S.trashBtn} onClick={onClose}><X size={16} /></button>
        </div>
        {(["name", "startDate", "endDate"] as const).map(field => (
          <div key={field} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
              {field === "startDate" ? "Start Date" : field === "endDate" ? "End Date" : "Name"}
            </label>
            <input
              style={S.input}
              type={field === "startDate" || field === "endDate" ? "date" : "text"}
              value={form[field]}
              placeholder={field === "name" ? "e.g. Group Stage Round 1" : undefined}
              onChange={e => onFormChange({ ...form, [field]: e.target.value })}
            />
          </div>
        ))}
        {error && <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ ...S.signOutBtn }}>Cancel</button>
          <button
            onClick={onSubmit}
            disabled={loading}
            style={{ ...S.btnSolidDanger, background: "#06b6d4", borderColor: "#06b6d4", opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const { authState, logout } = useAuth();
  const [, navigate] = useLocation();

  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [gameweeks, setGameweeks] = useState<AdminGameweek[]>([]);
  const [leagues, setLeagues] = useState<AdminLeague[]>([]);
  const [tab, setTab] = useState<Tab>("users");
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<ConfirmDialog>(CLOSED_CONFIRM);
  const [editPlayer, setEditPlayer] = useState<EditPlayer | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncingZ, setSyncingZ] = useState(false);
  const [syncResultZ, setSyncResultZ] = useState<string | null>(null);
  const [scoringResult, setScoringResult] = useState<{
    gwName: string;
    fixturesProcessed: number;
    playersUpdated: number;
    teamsUpdated: number;
    totalPointsAwarded: number;
    warning?: string;
  } | null>(null);
  const [processingGwId, setProcessingGwId] = useState<number | null>(null);
  const [createGwOpen, setCreateGwOpen] = useState(false);
  const [createGwForm, setCreateGwForm] = useState<CreateGwForm>({ name: "", startDate: "", endDate: "" });
  const [createGwLoading, setCreateGwLoading] = useState(false);
  const [createGwError, setCreateGwError] = useState<string | null>(null);
  const [autoCreating, setAutoCreating] = useState(false);
  const [autoCreateResult, setAutoCreateResult] = useState<{ created: number; skipped: number } | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authState.status === "loading") return;
    if (authState.status === "unauthenticated" || authState.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      navigate("/");
    }
  }, [authState, navigate]);

  // ── Fetch helpers ───────────────────────────────────────────────────────────
  const apiFetch = useCallback(async (path: string, opts?: RequestInit) => {
    const res = await fetch(`${API}${path}`, { credentials: "include", ...opts });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, p, g, l] = await Promise.all([
        apiFetch("/stats") as Promise<Stats>,
        apiFetch("/users") as Promise<AdminUser[]>,
        apiFetch("/players") as Promise<AdminPlayer[]>,
        apiFetch("/gameweeks") as Promise<AdminGameweek[]>,
        apiFetch("/leagues") as Promise<AdminLeague[]>,
      ]);
      setStats(s);
      setUsers(u);
      setPlayers(p);
      setGameweeks(g);
      setLeagues(l);
    } catch (err) {
      console.error("Admin load error", err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (authState.status === "authenticated" && authState.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      loadAll();
    }
  }, [authState, loadAll]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const deleteUser = (id: number) => {
    setConfirm({
      open: true, danger: true,
      title: "Delete User",
      message: "This will permanently remove the user and all associated data. Are you sure?",
      onConfirm: async () => {
        await apiFetch(`/users/${id}`, { method: "DELETE" });
        setUsers(u => u.filter(x => x.id !== id));
        setStats(s => s ? { ...s, userCount: s.userCount - 1 } : s);
      },
    });
  };

  const deletePlayer = (id: number) => {
    setConfirm({
      open: true, danger: true,
      title: "Delete Player",
      message: "This will remove the player from the pool and all squads. Continue?",
      onConfirm: async () => {
        await apiFetch(`/players/${id}`, { method: "DELETE" });
        setPlayers(p => p.filter(x => x.id !== id));
      },
    });
  };

  const savePlayer = async (p: EditPlayer) => {
    const updated = await apiFetch(`/players/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: p.name, club: p.club, clubShortName: p.clubShortName, position: p.position, price: parseFloat(p.price) }),
    }) as AdminPlayer;
    setPlayers(ps => ps.map(x => x.id === updated.id ? updated : x));
  };

  const activateGameweek = (id: number, name: string) => {
    setConfirm({
      open: true,
      title: "Activate Gameweek",
      message: `Set "${name}" as the active gameweek? Any currently active gameweek will be reset to upcoming.`,
      onConfirm: async () => {
        await apiFetch(`/gameweeks/${id}/activate`, { method: "POST" });
        setGameweeks(gs => gs.map(g => g.id === id ? { ...g, status: "active" } : g.status === "active" ? { ...g, status: "upcoming" } : g));
      },
    });
  };

  const processGameweek = (id: number, name: string) => {
    setConfirm({
      open: true,
      title: "Process Gameweek",
      message: `Fetch live scores from API-Sports, award points to all players, and update every manager's score for "${name}"?`,
      onConfirm: async () => {
        setScoringResult(null);
        setProcessingGwId(id);
        try {
          const result = await apiFetch(`/gameweeks/${id}/process`, { method: "POST" }) as {
            gameweek: AdminGameweek;
            scoring: { fixturesProcessed: number; playersUpdated: number; teamsUpdated: number; totalPointsAwarded: number; warning?: string };
          };
          setGameweeks(gs => gs.map(g => g.id === id ? { ...g, status: "finished" } : g));
          setStats(s => s ? { ...s, processedCount: s.processedCount + 1 } : s);
          setScoringResult({ gwName: name, ...result.scoring });
          setTab("gameweeks");
        } finally {
          setProcessingGwId(null);
        }
      },
    });
  };

  const submitCreateGameweek = async () => {
    if (!createGwForm.name || !createGwForm.startDate || !createGwForm.endDate) {
      setCreateGwError("All fields are required");
      return;
    }
    setCreateGwLoading(true);
    setCreateGwError(null);
    try {
      const gw = await apiFetch("/gameweeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createGwForm.name,
          startDate: new Date(createGwForm.startDate).toISOString(),
          endDate: new Date(createGwForm.endDate).toISOString(),
        }),
      }) as AdminGameweek;
      setGameweeks(gs => [...gs, gw].sort((a, b) => a.number - b.number));
      setCreateGwOpen(false);
      setCreateGwForm({ name: "", startDate: "", endDate: "" });
    } catch (err) {
      setCreateGwError(String(err));
    } finally {
      setCreateGwLoading(false);
    }
  };

  const autoCreateGameweeks = async () => {
    setAutoCreating(true);
    setAutoCreateResult(null);
    try {
      const result = await apiFetch("/gameweeks/auto-create", { method: "POST" }) as { created: number; skipped: number; gameweeks: AdminGameweek[] };
      const g = await apiFetch("/gameweeks") as AdminGameweek[];
      setGameweeks(g);
      setAutoCreateResult({ created: result.created, skipped: result.skipped });
    } catch (err) {
      console.error("Auto-create WC 2026 failed", err);
    } finally {
      setAutoCreating(false);
    }
  };

  const deleteLeague = (id: number, name: string) => {
    setConfirm({
      open: true, danger: true,
      title: "Delete League",
      message: `Delete "${name}" and remove all its members? This cannot be undone.`,
      onConfirm: async () => {
        await apiFetch(`/leagues/${id}`, { method: "DELETE" });
        setLeagues(ls => ls.filter(x => x.id !== id));
      },
    });
  };

  const wipeTestData = () => {
    setConfirm({
      open: true, danger: true,
      title: "Wipe Test Data",
      message: "This will clear all squad selections and reset team budgets to £100m. Players and gameweeks are preserved. Continue?",
      onConfirm: async () => {
        await apiFetch("/wipe-test-data", { method: "POST" });
        await loadAll();
      },
    });
  };

  const syncWCPlayers = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const json = await apiFetch("/sync-players", { method: "POST" }) as { ok: boolean; cleared: number; inserted: number; skipped: number; nations: number };
      setSyncResult(`✓ Synced ${json.inserted} players from ${json.nations} nations (cleared ${json.cleared} old)`);
      await loadAll();
    } catch (e) {
      setSyncResult(`✗ Sync failed: ${String(e)}`);
    } finally {
      setSyncing(false);
    }
  };

  const syncZafronix = async () => {
    setSyncingZ(true);
    setSyncResultZ(null);
    try {
      const json = await apiFetch("/sync-zafronix", { method: "POST" }) as { ok: boolean; cleared: number; inserted: number; skipped: number; nations: number };
      setSyncResultZ(`✓ Synced ${json.inserted} players from ${json.nations} nations (cleared ${json.cleared} old)`);
      await loadAll();
    } catch (e) {
      setSyncResultZ(`✗ Sync failed: ${String(e)}`);
    } finally {
      setSyncingZ(false);
    }
  };

  const fullReset = () => {
    setConfirm({
      open: true, danger: true,
      title: "⚠ Full Database Reset",
      message: "This will DELETE all users (except you), all players, gameweeks, teams, leagues, and fixtures. This is irreversible. Are you absolutely sure?",
      onConfirm: async () => {
        await apiFetch("/reset", { method: "POST" });
        await loadAll();
      },
    });
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (authState.status === "loading" || loading) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "#06b6d4" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (authState.status !== "authenticated" || authState.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return null;
  }

  const posColor: Record<string, string> = { GK: "#f59e0b", DEF: "#22c55e", MID: "#06b6d4", FWD: "#f97316" };

  return (
    <div style={S.page}>
      <style>{`
        button:hover { opacity: 0.85; }
        tr:hover td { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #08111e; }
        ::-webkit-scrollbar-thumb { background: #1e3550; border-radius: 3px; }
      `}</style>

      {/* Top bar */}
      <div style={S.topbar}>
        <div style={S.topbarLeft}>
          <Shield size={18} color="#06b6d4" />
          <span style={S.topbarTitle}>ADMIN PANEL</span>
          <span style={S.topbarDot}>·</span>
          <span style={S.topbarSub}>Fanta11</span>
        </div>
        <button style={S.signOutBtn} onClick={handleSignOut}>
          <LogOut size={14} />
          Sign out
        </button>
      </div>

      <div style={S.body}>

        {/* Site Statistics */}
        <div style={S.sectionLabel}>
          <BarChart2 size={14} />
          Site Statistics
        </div>
        <div style={S.statsRow}>
          {[
            { label: "Total Users",     value: stats?.userCount ?? 0,      Icon: Users },
            { label: "Total Squads",    value: stats?.teamCount ?? 0,      Icon: LayoutGrid },
            { label: "Gameweeks Processed", value: stats?.processedCount ?? 0, Icon: BarChart2 },
          ].map(({ label, value, Icon }) => (
            <div key={label} style={S.statCard}>
              <div style={S.statIcon}><Icon size={20} color="#06b6d4" /></div>
              <div>
                <div style={S.statLabel}>{label}</div>
                <div style={S.statNum}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Sync Players */}
        <div style={{ ...S.dangerLabel, color: "#06b6d4", borderColor: "#0e4c5e" }}>
          <span style={{ fontSize: 14 }}>⚽</span>
          WC Players
        </div>
        <div style={{ ...S.dangerSection, borderColor: "#0e4c5e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              style={{ ...S.btnSolidDanger, background: "#0891b2", borderColor: "#06b6d4", opacity: syncing ? 0.7 : 1, cursor: syncing ? "not-allowed" : "pointer", minWidth: 180 }}
              onClick={syncWCPlayers}
              disabled={syncing}
            >
              {syncing ? "⟳ Syncing from API…" : "⟳ Sync WC Players"}
            </button>
            {syncResult && (
              <span style={{ fontSize: 12, color: syncResult.startsWith("✓") ? "#4ade80" : "#f87171" }}>
                {syncResult}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <button
              style={{ ...S.btnSolidDanger, background: "#7c3aed", borderColor: "#a78bfa", opacity: syncingZ ? 0.7 : 1, cursor: syncingZ ? "not-allowed" : "pointer", minWidth: 180 }}
              onClick={syncZafronix}
              disabled={syncingZ}
            >
              {syncingZ ? "⟳ Syncing from Zafronix…" : "⟳ Sync from Zafronix"}
            </button>
            {syncResultZ && (
              <span style={{ fontSize: 12, color: syncResultZ.startsWith("✓") ? "#4ade80" : "#f87171" }}>
                {syncResultZ}
              </span>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div style={S.dangerLabel}>
          <AlertTriangle size={14} />
          Danger Zone
        </div>
        <div style={S.dangerSection}>
          <div style={S.dangerBtns}>
            <button style={S.btnOutlineDanger} onClick={wipeTestData}>Wipe Test Data</button>
            <button style={S.btnSolidDanger} onClick={fullReset}>Full Database Reset</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={S.tabsRow}>
          {(["users", "players", "gameweeks", "leagues"] as Tab[]).map(t => {
            const counts: Record<Tab, number> = { users: users.length, players: players.length, gameweeks: gameweeks.length, leagues: leagues.length };
            return (
              <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
                {t}&nbsp;
                <span style={{ opacity: 0.6 }}>({counts[t]})</span>
              </button>
            );
          })}
        </div>

        {/* Tables */}
        <div style={{ marginTop: 1, background: "#0d1b2e", border: "1px solid #1e3550", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>

            {/* ── USERS ── */}
            {tab === "users" && (
              <table style={S.table}>
                <thead>
                  <tr style={{ background: "#0a1628" }}>
                    {["ID", "Username", "Email", "Squad Submitted", "Total Points", "Joined", "Delete"].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ ...S.td, color: "#475569", fontFamily: "monospace" }}>{u.id}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{u.username}</td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>{u.email}</td>
                      <td style={S.td}>
                        {u.squadSubmitted ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#22c55e" }}>
                            <Check size={13} />Yes
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>No</span>
                        )}
                      </td>
                      <td style={{ ...S.td, fontFamily: "monospace", color: "#06b6d4", fontWeight: 600 }}>{u.totalPoints}</td>
                      <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>
                        {new Date(u.createdAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })}
                      </td>
                      <td style={S.td}>
                        {u.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() && (
                          <button style={S.trashBtn} onClick={() => deleteUser(u.id)} title="Delete user">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={7} style={{ ...S.td, textAlign: "center", color: "#475569", padding: 32 }}>No users found</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {/* ── PLAYERS ── */}
            {tab === "players" && (
              <table style={S.table}>
                <thead>
                  <tr style={{ background: "#0a1628" }}>
                    {["ID", "Name", "Club", "Position", "Price", "Points", "Edit", "Delete"].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map(p => (
                    <tr key={p.id}>
                      <td style={{ ...S.td, color: "#475569", fontFamily: "monospace" }}>{p.id}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", background: "#0a1628", padding: "2px 6px", borderRadius: 4, marginRight: 6 }}>
                          {p.clubShortName}
                        </span>
                        {p.club}
                      </td>
                      <td style={S.td}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 4,
                          fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                          background: `${posColor[p.position] ?? "#94a3b8"}22`,
                          color: posColor[p.position] ?? "#94a3b8",
                          border: `1px solid ${posColor[p.position] ?? "#94a3b8"}44`,
                        }}>
                          {p.position}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 600, color: "#06b6d4" }}>£{p.price.toFixed(1)}m</td>
                      <td style={{ ...S.td, fontFamily: "monospace", color: "#94a3b8" }}>{p.totalPoints}</td>
                      <td style={S.td}>
                        <button style={S.editBtn} onClick={() => setEditPlayer({ id: p.id, name: p.name, club: p.club, clubShortName: p.clubShortName, position: p.position, price: String(p.price) })} title="Edit player">
                          <Pencil size={14} />
                        </button>
                      </td>
                      <td style={S.td}>
                        <button style={S.trashBtn} onClick={() => deletePlayer(p.id)} title="Delete player">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {players.length === 0 && (
                    <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: "#475569", padding: 32 }}>No players found</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {/* ── GAMEWEEKS ── */}
            {tab === "gameweeks" && (
              <>
                {/* Toolbar */}
                <div style={{ display: "flex", gap: 10, padding: "16px 16px 14px", alignItems: "center", flexWrap: "wrap" as const, borderBottom: "1px solid #1e3550" }}>
                  <button
                    style={{ ...S.actionBtn("teal"), padding: "7px 16px", fontSize: 12 }}
                    onClick={() => { setCreateGwError(null); setCreateGwOpen(true); }}
                  >
                    + Create Gameweek
                  </button>
                  <button
                    style={{ ...S.actionBtn("gray"), padding: "7px 16px", fontSize: 12, opacity: autoCreating ? 0.6 : 1, cursor: autoCreating ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
                    onClick={() => !autoCreating && autoCreateGameweeks()}
                    disabled={autoCreating}
                  >
                    {autoCreating
                      ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Creating…</>
                      : "⚡ Auto-Create WC 2026"
                    }
                  </button>
                  {autoCreateResult && (
                    <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
                      ✓ Created {autoCreateResult.created}, skipped {autoCreateResult.skipped}
                    </span>
                  )}
                </div>

                {/* Scoring result banner */}
                {scoringResult && (
                  <div style={{
                    margin: "16px 16px 0",
                    borderRadius: 10,
                    border: scoringResult.warning && scoringResult.fixturesProcessed === 0
                      ? "1px solid rgba(234,179,8,0.4)"
                      : "1px solid rgba(34,197,94,0.35)",
                    background: scoringResult.warning && scoringResult.fixturesProcessed === 0
                      ? "rgba(234,179,8,0.06)"
                      : "rgba(34,197,94,0.06)",
                    padding: "14px 18px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: scoringResult.warning && scoringResult.fixturesProcessed === 0 ? "#eab308" : "#22c55e" }}>
                        {scoringResult.warning && scoringResult.fixturesProcessed === 0 ? "⚠ Scoring Notice" : "✓ Gameweek Processed"}
                      </span>
                      <button style={{ ...S.trashBtn, color: "#475569" }} onClick={() => setScoringResult(null)}>
                        <X size={14} />
                      </button>
                    </div>
                    {scoringResult.warning ? (
                      <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>{scoringResult.warning}</p>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                        {[
                          { label: "Matches", value: scoringResult.fixturesProcessed },
                          { label: "Players Scored", value: scoringResult.playersUpdated },
                          { label: "Teams Updated", value: scoringResult.teamsUpdated },
                          { label: "Total Pts Awarded", value: scoringResult.totalPointsAwarded },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ textAlign: "center" as const, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 8px" }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#22c55e", lineHeight: 1 }}>{value}</div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginTop: 4 }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Processing spinner */}
                {processingGwId && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", color: "#06b6d4", fontSize: 13 }}>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Fetching match data and calculating scores… this may take a minute.
                  </div>
                )}

                <table style={S.table}>
                  <thead>
                    <tr style={{ background: "#0a1628" }}>
                      {["GW", "Name", "Status", "Activate", "Process Gameweek"].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gameweeks.map(g => (
                      <tr key={g.id}>
                        <td style={{ ...S.td, color: "#475569", fontFamily: "monospace" }}>{g.number}</td>
                        <td style={{ ...S.td, fontWeight: 600 }}>{g.name}</td>
                        <td style={S.td}>
                          <span style={S.badge(g.status)}>{g.status}</span>
                        </td>
                        <td style={S.td}>
                          {g.status !== "active" && g.status !== "finished" && (
                            <button style={S.actionBtn("teal")} onClick={() => activateGameweek(g.id, g.name)}>
                              <ChevronRight size={11} style={{ marginRight: 3 }} />Activate
                            </button>
                          )}
                          {g.status === "active" && (
                            <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>● Active</span>
                          )}
                          {g.status === "finished" && (
                            <span style={{ fontSize: 11, color: "#475569" }}>—</span>
                          )}
                        </td>
                        <td style={S.td}>
                          <button
                            style={{
                              ...S.actionBtn("gray"),
                              opacity: processingGwId ? 0.5 : 1,
                              cursor: processingGwId ? "not-allowed" : "pointer",
                              display: "inline-flex", alignItems: "center", gap: 5,
                            }}
                            onClick={() => !processingGwId && processGameweek(g.id, g.name)}
                            disabled={!!processingGwId}
                          >
                            {processingGwId === g.id
                              ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />Scoring…</>
                              : <>⚡ Process Gameweek</>
                            }
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* ── LEAGUES ── */}
            {tab === "leagues" && (
              <table style={S.table}>
                <thead>
                  <tr style={{ background: "#0a1628" }}>
                    {["ID", "League Name", "Invite Code", "Members", "Created", "Delete"].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leagues.map(l => (
                    <tr key={l.id}>
                      <td style={{ ...S.td, color: "#475569", fontFamily: "monospace" }}>{l.id}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <Trophy size={13} color="#06b6d4" style={{ flexShrink: 0 }} />
                          {l.name}
                        </span>
                      </td>
                      <td style={S.td}>
                        <span style={{
                          fontFamily: "monospace", fontSize: 12, fontWeight: 700,
                          letterSpacing: "0.1em", background: "#0a1628",
                          border: "1px solid #1e3550", padding: "2px 8px", borderRadius: 4,
                          color: "#94a3b8",
                        }}>
                          {l.code}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontFamily: "monospace", color: "#06b6d4", fontWeight: 600 }}>
                        {l.memberCount}
                      </td>
                      <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>
                        {new Date(l.createdAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })}
                      </td>
                      <td style={S.td}>
                        <button style={S.trashBtn} onClick={() => deleteLeague(l.id, l.name)} title="Delete league">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {leagues.length === 0 && (
                    <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", color: "#475569", padding: 32 }}>No leagues found</td></tr>
                  )}
                </tbody>
              </table>
            )}

          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal dialog={confirm} onClose={() => setConfirm(CLOSED_CONFIRM)} />
      <EditPlayerModal
        player={editPlayer}
        onSave={savePlayer}
        onClose={() => setEditPlayer(null)}
      />
      <CreateGameweekModal
        open={createGwOpen}
        loading={createGwLoading}
        error={createGwError}
        form={createGwForm}
        onFormChange={setCreateGwForm}
        onSubmit={submitCreateGameweek}
        onClose={() => setCreateGwOpen(false)}
      />
    </div>
  );
}
