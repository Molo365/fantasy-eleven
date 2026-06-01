import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import logoSrc from "../assets/logo.png";

type View = "landing" | "login" | "signup";

/* ─── Shared full-screen backdrop ────────────────────────────────────── */
function Backdrop() {
  return (
    <>
      {/* background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero.jpg')" }}
      />
      {/* blur layer: blurs the image behind it, erasing baked-in text */}
      <div
        className="absolute inset-0"
        style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      />
      {/* dark colour tint on top of blur */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(170deg, rgba(6,12,30,0.55) 0%, rgba(6,12,30,0.50) 40%, rgba(6,12,30,0.80) 100%)",
        }}
      />
    </>
  );
}

/* ─── Auth card wrapper (Sign In / Sign Up pages) ────────────────────── */
function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden flex flex-col dark relative">
      <Backdrop />
      <div className="relative z-10 flex flex-col h-full items-center justify-center px-4">
        <div className="mb-6" style={{ filter: "drop-shadow(0 0 28px rgba(59,130,246,0.7))" }}>
          <img src={logoSrc} alt="FANTA11" className="w-24 h-24 object-contain" />
        </div>
        <div
          className="w-full max-w-md rounded-2xl border border-white/10 p-8"
          style={{ background: "rgba(10,20,45,0.82)", backdropFilter: "blur(20px)" }}
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
    try { await login(email, password); }
    catch (err) { setError(err instanceof Error ? err.message : "Login failed"); }
    finally { setLoading(false); }
  };

  return (
    <AuthCard>
      <div className="text-center mb-7">
        <h1 className="text-2xl font-black text-white tracking-tight">Welcome back</h1>
        <p className="text-blue-300/50 text-sm mt-1">Sign in to your FANTA11 account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: "Email", id: "email", type: "email", value: email, onChange: (v: string) => setEmail(v), placeholder: "you@example.com", testid: "input-email" },
          { label: "Password", id: "password", type: "password", value: password, onChange: (v: string) => setPassword(v), placeholder: "••••••••", testid: "input-password" },
        ].map(({ label, id, type, value, onChange, placeholder, testid }) => (
          <div key={id}>
            <label className="block text-xs font-semibold text-blue-200/60 uppercase tracking-wider mb-1.5">{label}</label>
            <input
              data-testid={testid}
              type={type}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              required
              placeholder={placeholder}
              autoComplete={type === "password" ? "current-password" : "email"}
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
            />
          </div>
        ))}
        {error && (
          <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-2.5">{error}</p>
        )}
        <button
          data-testid="button-login"
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 mt-1"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
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
      <button onClick={onBack} className="flex items-center justify-center gap-1.5 text-white/30 hover:text-white/60 text-xs mt-5 mx-auto transition-colors">
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
    try { await register(form.displayName, form.username, form.email, form.password); }
    catch (err) { setError(err instanceof Error ? err.message : "Registration failed"); }
    finally { setLoading(false); }
  };

  return (
    <AuthCard>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-black text-white tracking-tight">Create your account</h1>
        <p className="text-blue-300/50 text-sm mt-1">Join thousands of FANTA11 managers</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {[
          { label: "Full Name",  field: "displayName" as const, type: "text",     placeholder: "Pep Guardiola",         testid: "input-display-name",  autocomplete: "name" },
          { label: "Username",   field: "username"    as const, type: "text",     placeholder: "pepguardiola",          testid: "input-username",      autocomplete: "username" },
          { label: "Email",      field: "email"       as const, type: "email",    placeholder: "you@example.com",       testid: "input-email",         autocomplete: "email" },
          { label: "Password",   field: "password"    as const, type: "password", placeholder: "At least 6 characters", testid: "input-password",      autocomplete: "new-password" },
        ].map(({ label, field, type, placeholder, testid, autocomplete }) => (
          <div key={field}>
            <label className="block text-xs font-semibold text-blue-200/60 uppercase tracking-wider mb-1.5">{label}</label>
            <input
              data-testid={testid}
              type={type}
              value={form[field]}
              onChange={set(field)}
              required
              placeholder={placeholder}
              autoComplete={autocomplete}
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
            />
          </div>
        ))}
        {error && (
          <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-2.5">{error}</p>
        )}
        <button
          data-testid="button-signup"
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 mt-1"
        >
          {loading ? "Creating account…" : "Get Started Free"}
        </button>
      </form>
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
      <button onClick={onBack} className="flex items-center justify-center gap-1.5 text-white/30 hover:text-white/60 text-xs mt-4 mx-auto transition-colors">
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to home
      </button>
    </AuthCard>
  );
}

/* ─── Landing hero (main page) ───────────────────────────────────────── */
export function LandingPage() {
  const [view, setView] = useState<View>("landing");

  if (view === "login")  return <LoginPage  onBack={() => setView("landing")} onGoSignup={() => setView("signup")} />;
  if (view === "signup") return <SignupPage onBack={() => setView("landing")} onGoLogin={() => setView("login")} />;

  return (
    <div className="h-screen overflow-hidden flex flex-col dark relative">
      <Backdrop />

      <div className="relative z-10 flex flex-col h-full">

        {/* ── Navbar ── */}
        <header className="flex items-center justify-between px-8 md:px-14 py-5 flex-shrink-0">
          {/* Left: logo + wordmark */}
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="FANTA11" className="w-9 h-9 object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.7)]" />
            <span
              className="font-black text-white text-lg uppercase tracking-[0.18em]"
              style={{ textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" }}
            >
              FANTA11
            </span>
          </div>
          {/* Right: Sign In */}
          <button
            data-testid="button-nav-login"
            onClick={() => setView("login")}
            className="px-5 py-2 rounded-xl border border-white/25 bg-white/8 hover:bg-white/15 text-white text-sm font-semibold transition-all"
          >
            Sign In
          </button>
        </header>

        {/* ── Hero ── */}
        <main className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-5">
          {/* Slogan */}
          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-black leading-tight tracking-tight max-w-4xl"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #bfdbfe 55%, #60a5fa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "none",
            }}
          >
            Build Your Dream Team.<br />Dominate Every Gameweek.
          </h1>

          {/* Sub-heading */}
          <p className="text-base md:text-lg text-white/60 max-w-lg leading-relaxed">
            The ultimate fantasy soccer platform. Pick your squad, outsmart the competition, and rise to the top.
          </p>

          {/* CTA buttons — real HTML, perfectly aligned */}
          <div className="flex items-center gap-4 mt-2">
            <button
              data-testid="button-get-started"
              onClick={() => setView("signup")}
              className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-base transition-all shadow-xl shadow-blue-600/40 hover:scale-105 active:scale-95"
            >
              Get Started Free
            </button>
            <button
              data-testid="button-login"
              onClick={() => setView("login")}
              className="px-8 py-3.5 rounded-2xl border border-white/25 bg-white/8 hover:bg-white/15 text-white font-bold text-base transition-all hover:scale-105 active:scale-95"
            >
              Sign In
            </button>
          </div>
        </main>

        {/* ── Stats bar ── */}
        <footer className="flex-shrink-0 flex items-center justify-center gap-12 pb-7 pt-4">
          {[
            { icon: "🏆", value: "5",    label: "Leagues" },
            { icon: "📅", value: "38",   label: "Gameweeks" },
            { icon: "⚽", value: "500+", label: "Players" },
          ].map(({ icon, value, label }, i, arr) => (
            <div key={label} className="flex items-center gap-12">
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none" style={{ filter: "sepia(1) saturate(4) hue-rotate(5deg)" }}>
                  {icon}
                </span>
                <div className="text-left">
                  <div className="text-2xl font-black text-white leading-none">{value}</div>
                  <div
                    className="text-[11px] font-bold uppercase tracking-widest mt-0.5"
                    style={{ color: "#d4a843" }}
                  >
                    {label}
                  </div>
                </div>
              </div>
              {i < arr.length - 1 && <div className="w-px h-10 bg-white/15" />}
            </div>
          ))}
        </footer>

      </div>
    </div>
  );
}
