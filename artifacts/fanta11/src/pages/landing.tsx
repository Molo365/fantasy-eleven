import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import logoSrc from "../assets/logo.png";

type View = "landing" | "login" | "signup";

/* ─── Auth card (shared by login + signup) ───────────────────────────── */
function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, backgroundImage: "url('/hero.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(6,12,30,0.70)" }} />
      <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 1rem" }}>
        <div style={{ marginBottom: "1.5rem", filter: "drop-shadow(0 0 28px rgba(59,130,246,0.7))" }}>
          <img src={logoSrc} alt="FANTA11" style={{ width: 80, height: 80, objectFit: "contain" }} />
        </div>
        <div style={{ width: "100%", maxWidth: 420, borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", padding: "2rem", background: "rgba(10,20,45,0.82)", backdropFilter: "blur(20px)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Sign In page ───────────────────────────────────────────────────── */
function LoginPage({ onBack, onGoSignup }: { onBack: () => void; onGoSignup: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try { await login(email, password); }
    catch (err) { setError(err instanceof Error ? err.message : "Login failed"); }
    finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.75rem 1rem", borderRadius: 12, fontSize: 14,
    color: "#fff", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "rgba(147,197,253,0.6)",
    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6,
  };

  return (
    <AuthCard>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ margin: 0, color: "#fff", fontSize: 22, fontWeight: 900 }}>Welcome back</h1>
        <p style={{ margin: "6px 0 0", color: "rgba(147,197,253,0.5)", fontSize: 13 }}>Sign in to your FANTA11 account</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email</label>
          <input data-testid="input-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="email" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Password</label>
          <input data-testid="input-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="current-password" style={inputStyle} />
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "8px 14px", margin: "0 0 12px" }}>{error}</p>}
        <button data-testid="button-login" type="submit" disabled={loading}
          style={{ width: "100%", padding: "0.875rem", borderRadius: 12, background: "#2563eb", border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 4 }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <p style={{ textAlign: "center", fontSize: 13, color: "rgba(147,197,253,0.5)", marginTop: 20 }}>
        Don't have an account?{" "}
        <button onClick={onGoSignup} style={{ background: "none", border: "none", color: "#60a5fa", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Create one free</button>
      </p>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.3)", background: "none", border: "none", fontSize: 12, cursor: "pointer", margin: "16px auto 0" }}>
        ← Back to home
      </button>
    </AuthCard>
  );
}

/* ─── Sign Up page ───────────────────────────────────────────────────── */
function SignupPage({ onBack, onGoLogin }: { onBack: () => void; onGoLogin: () => void }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ displayName: "", username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try { await register(form.displayName, form.username, form.email, form.password); }
    catch (err) { setError(err instanceof Error ? err.message : "Registration failed"); }
    finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.75rem 1rem", borderRadius: 12, fontSize: 14,
    color: "#fff", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "rgba(147,197,253,0.6)",
    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6,
  };

  return (
    <AuthCard>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: "#fff", fontSize: 22, fontWeight: 900 }}>Create your account</h1>
        <p style={{ margin: "6px 0 0", color: "rgba(147,197,253,0.5)", fontSize: 13 }}>Join thousands of FANTA11 managers</p>
      </div>
      <form onSubmit={handleSubmit}>
        {[
          { label: "Full Name", field: "displayName" as const, type: "text",     placeholder: "Pep Guardiola",         testid: "input-display-name", ac: "name" },
          { label: "Username",  field: "username"    as const, type: "text",     placeholder: "pepguardiola",          testid: "input-username",     ac: "username" },
          { label: "Email",     field: "email"       as const, type: "email",    placeholder: "you@example.com",       testid: "input-email",        ac: "email" },
          { label: "Password",  field: "password"    as const, type: "password", placeholder: "At least 6 characters", testid: "input-password",     ac: "new-password" },
        ].map(({ label, field, type, placeholder, testid, ac }) => (
          <div key={field} style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{label}</label>
            <input data-testid={testid} type={type} value={form[field]} onChange={set(field)} required placeholder={placeholder} autoComplete={ac} style={inputStyle} />
          </div>
        ))}
        {error && <p style={{ color: "#f87171", fontSize: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "8px 14px", margin: "0 0 12px" }}>{error}</p>}
        <button data-testid="button-signup" type="submit" disabled={loading}
          style={{ width: "100%", padding: "0.875rem", borderRadius: 12, background: "#2563eb", border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 4 }}>
          {loading ? "Creating account…" : "Get Started Free"}
        </button>
      </form>
      <p style={{ textAlign: "center", fontSize: 13, color: "rgba(147,197,253,0.5)", marginTop: 20 }}>
        Already have an account?{" "}
        <button onClick={onGoLogin} style={{ background: "none", border: "none", color: "#60a5fa", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Sign in</button>
      </p>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.3)", background: "none", border: "none", fontSize: 12, cursor: "pointer", margin: "14px auto 0" }}>
        ← Back to home
      </button>
    </AuthCard>
  );
}

/* ─── Landing page ───────────────────────────────────────────────────── */
export function LandingPage() {
  const [view, setView] = useState<View>("landing");

  if (view === "login")  return <LoginPage  onBack={() => setView("landing")} onGoSignup={() => setView("signup")} />;
  if (view === "signup") return <SignupPage onBack={() => setView("landing")} onGoLogin={() => setView("login")} />;

  const shadow = "0 2px 12px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,1)";

  return (
    <div style={{ position: "fixed", inset: 0, backgroundImage: "url('/hero.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>

      {/* ── Navbar ── */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 48px", zIndex: 10 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logoSrc} alt="FANTA11" style={{ width: 38, height: 38, objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(59,130,246,0.8))" }} />
          <span style={{ fontWeight: 900, color: "#fff", fontSize: 18, letterSpacing: "0.18em", textTransform: "uppercase", textShadow: shadow }}>
            FANTA11
          </span>
        </div>
        {/* Sign In button */}
        <button
          data-testid="button-nav-login"
          onClick={() => setView("login")}
          style={{ padding: "8px 22px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          Sign In
        </button>
      </div>

      {/* ── Bottom section: buttons + stats ── */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 36, gap: 28, zIndex: 10 }}>

        {/* Slogan */}
        <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#fff", textAlign: "center", textShadow: "0 2px 12px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,1)", letterSpacing: "0.01em" }}>
          Build Your Dream Team. Dominate Gameweek.
        </p>

        {/* CTA buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            data-testid="button-get-started"
            onClick={() => setView("signup")}
            style={{ padding: "14px 36px", borderRadius: 18, background: "#2563eb", border: "none", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", boxShadow: "0 8px 32px rgba(37,99,235,0.55)" }}
          >
            Get Started Free
          </button>
          <button
            data-testid="button-login"
            onClick={() => setView("login")}
            style={{ padding: "14px 36px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.35)", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
          >
            Sign In
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "8px 0", width: "100%", padding: "0 12px", boxSizing: "border-box" }}>
          {[
            { icon: "🏆", value: "5",    label: "Leagues" },
            { icon: "📅", value: "38",   label: "Gameweeks" },
            { icon: "⚽", value: "500+", label: "Players" },
          ].map(({ icon, value, label }, i, arr) => (
            <div key={label} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px" }}>
                <span style={{ fontSize: 26, filter: "sepia(1) saturate(5) hue-rotate(5deg)" }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1, textShadow: shadow }}>{value}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#d4a843", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3 }}>{label}</div>
                </div>
              </div>
              {i < arr.length - 1 && <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.2)" }} />}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
