import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import logoSrc from "../assets/logo.png";
import heroBg from "../assets/hero-bg.jpg";

type View = "landing" | "login" | "signup";

/* ─── Shared backdrop ─────────────────────────────────────────────────── */
function Backdrop() {
  return (
    <>
      <img
        src={heroBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center"
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,16,35,0.72) 0%, rgba(8,16,35,0.82) 100%)",
        }}
      />
    </>
  );
}

/* ─── Auth card wrapper ───────────────────────────────────────────────── */
function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden flex flex-col dark relative">
      <Backdrop />
      <div className="relative z-10 flex flex-col h-full items-center justify-center px-4">
        {/* Logo */}
        <div
          className="mb-6"
          style={{ filter: "drop-shadow(0 0 28px rgba(59,130,246,0.7))" }}
        >
          <img src={logoSrc} alt="FANTA11" className="w-24 h-24 object-contain" />
        </div>

        {/* Card */}
        <div
          className="w-full max-w-md rounded-2xl border border-white/10 p-8"
          style={{ background: "rgba(10,20,45,0.80)", backdropFilter: "blur(18px)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Sign In page ────────────────────────────────────────────────────── */
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
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      {/* Header */}
      <div className="text-center mb-7">
        <h1 className="text-2xl font-black text-white tracking-tight">Welcome back</h1>
        <p className="text-blue-300/50 text-sm mt-1">Sign in to your FANTA11 account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-blue-200/60 uppercase tracking-wider mb-1.5">
            Email
          </label>
          <input
            data-testid="input-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue-200/60 uppercase tracking-wider mb-1.5">
            Password
          </label>
          <input
            data-testid="input-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-red-400 flex-shrink-0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        <button
          data-testid="button-login"
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round"/></svg>
              Signing in…
            </span>
          ) : "Sign In"}
        </button>
      </form>

      {/* Divider + switch */}
      <div className="mt-6 flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/25 text-xs">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>
      <p className="text-center text-sm text-blue-300/50 mt-4">
        Don't have an account?{" "}
        <button onClick={onGoSignup} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
          Create one free
        </button>
      </p>

      <button
        onClick={onBack}
        className="flex items-center justify-center gap-1.5 text-white/30 hover:text-white/60 text-xs mt-5 mx-auto transition-colors"
      >
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to home
      </button>
    </AuthCard>
  );
}

/* ─── Sign Up page ────────────────────────────────────────────────────── */
function SignupPage({ onBack, onGoLogin }: { onBack: () => void; onGoLogin: () => void }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ displayName: "", username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form.displayName, form.username, form.email, form.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { label: "Full Name",  field: "displayName" as const, type: "text",     placeholder: "Pep Guardiola",          testid: "input-display-name" },
    { label: "Username",   field: "username"    as const, type: "text",     placeholder: "pepguardiola",           testid: "input-username" },
    { label: "Email",      field: "email"       as const, type: "email",    placeholder: "you@example.com",        testid: "input-email" },
    { label: "Password",   field: "password"    as const, type: "password", placeholder: "At least 6 characters",  testid: "input-password" },
  ];

  return (
    <AuthCard>
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-black text-white tracking-tight">Create your account</h1>
        <p className="text-blue-300/50 text-sm mt-1">Join thousands of FANTA11 managers</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {fields.map(({ label, field, type, placeholder, testid }) => (
          <div key={field}>
            <label className="block text-xs font-semibold text-blue-200/60 uppercase tracking-wider mb-1.5">
              {label}
            </label>
            <input
              data-testid={testid}
              type={type}
              value={form[field]}
              onChange={set(field)}
              required
              placeholder={placeholder}
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
            />
          </div>
        ))}

        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-red-400 flex-shrink-0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        <button
          data-testid="button-signup"
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round"/></svg>
              Creating account…
            </span>
          ) : "Get Started Free"}
        </button>
      </form>

      {/* Divider + switch */}
      <div className="mt-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/25 text-xs">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>
      <p className="text-center text-sm text-blue-300/50 mt-4">
        Already have an account?{" "}
        <button onClick={onGoLogin} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
          Sign in
        </button>
      </p>

      <button
        onClick={onBack}
        className="flex items-center justify-center gap-1.5 text-white/30 hover:text-white/60 text-xs mt-4 mx-auto transition-colors"
      >
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to home
      </button>
    </AuthCard>
  );
}

/* ─── Landing hero ────────────────────────────────────────────────────── */
export function LandingPage() {
  const [view, setView] = useState<View>("landing");

  if (view === "login")  return <LoginPage  onBack={() => setView("landing")} onGoSignup={() => setView("signup")} />;
  if (view === "signup") return <SignupPage onBack={() => setView("landing")} onGoLogin={() => setView("login")} />;

  return (
    <div className="h-screen overflow-hidden flex flex-col dark relative">
      {/* Full-screen hero image */}
      <img
        src={heroBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center"
        aria-hidden
      />
      {/* Bottom gradient — covers the stats baked into the image */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: "30%",
          background: "linear-gradient(to bottom, transparent 0%, rgba(8,16,35,0.9) 55%, rgba(8,16,35,1) 100%)",
        }}
      />

      {/* Content layer */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Nav */}
        <header className="flex items-center px-6 md:px-10 py-4 flex-shrink-0 gap-5">
          <div className="flex items-center gap-2.5">
            <img src={logoSrc} alt="FANTA11" className="w-8 h-8 object-contain" />
            <span
              className="font-black text-white tracking-[0.15em] text-base uppercase"
              style={{ textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" }}
            >FANTA11</span>
          </div>
          <button
            data-testid="button-nav-login"
            onClick={() => setView("login")}
            className="text-sm font-semibold text-white/80 hover:text-white transition-colors"
          >
            Sign In
          </button>
        </header>

        {/* Stats bar pinned to the bottom */}
        <div className="mt-auto flex-shrink-0 flex items-center justify-center gap-10 pb-6 pt-3">
          {[
            { icon: "🏆", value: "5",    label: "Leagues" },
            { icon: "📅", value: "38",   label: "Gameweeks" },
            { icon: "⚽", value: "500+", label: "Players" },
          ].map(({ icon, value, label }, i, arr) => (
            <div key={label} className="flex items-center gap-10">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl" style={{ filter: "sepia(1) saturate(3) hue-rotate(5deg)" }}>{icon}</span>
                <div>
                  <div className="text-xl font-black text-white leading-none">{value}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#d4a843" }}>{label}</div>
                </div>
              </div>
              {i < arr.length - 1 && <div className="w-px h-8 bg-white/15" />}
            </div>
          ))}
        </div>

        {/* Invisible clickable zones — positioned as % of full viewport */}
        <div className="absolute inset-0 pointer-events-none">
          <button
            data-testid="button-get-started"
            onClick={() => setView("signup")}
            aria-label="Get Started Free"
            className="absolute cursor-pointer rounded-xl pointer-events-auto opacity-0 hover:opacity-20 hover:bg-blue-400 transition-opacity"
            style={{ left: "34%", top: "79%", width: "12%", height: "7%" }}
          />
          <button
            data-testid="button-login"
            onClick={() => setView("login")}
            aria-label="Sign In"
            className="absolute cursor-pointer rounded-xl pointer-events-auto opacity-0 hover:opacity-20 hover:bg-white transition-opacity"
            style={{ left: "50%", top: "79%", width: "9%", height: "7%" }}
          />
        </div>
      </div>
    </div>
  );
}
