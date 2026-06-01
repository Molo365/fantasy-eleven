import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import logoSrc from "../assets/logo.png";

type View = "landing" | "login" | "signup";

function LoginForm({ onBack }: { onBack: () => void }) {
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
    <div className="w-full max-w-md mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-blue-400/70 hover:text-blue-300 text-sm mb-8 transition-colors">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>
      <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Welcome back</h2>
      <p className="text-blue-300/60 mb-8">Sign in to your FANTA11 account</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-blue-200/70 mb-1.5">Email</label>
          <input
            data-testid="input-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl bg-white/6 border border-white/12 text-white placeholder-blue-300/30 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-200/70 mb-1.5">Password</label>
          <input
            data-testid="input-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl bg-white/6 border border-white/12 text-white placeholder-blue-300/30 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">{error}</p>
        )}
        <button
          data-testid="button-login"
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

function SignupForm({ onBack }: { onBack: () => void }) {
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

  return (
    <div className="w-full max-w-md mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-blue-400/70 hover:text-blue-300 text-sm mb-8 transition-colors">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>
      <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Create account</h2>
      <p className="text-blue-300/60 mb-8">Join thousands of managers on FANTA11</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: "Full Name", field: "displayName" as const, type: "text", placeholder: "Pep Guardiola", testid: "input-display-name" },
          { label: "Username", field: "username" as const, type: "text", placeholder: "pepguardiola", testid: "input-username" },
          { label: "Email", field: "email" as const, type: "email", placeholder: "you@example.com", testid: "input-email" },
          { label: "Password", field: "password" as const, type: "password", placeholder: "At least 6 characters", testid: "input-password" },
        ].map(({ label, field, type, placeholder, testid }) => (
          <div key={field}>
            <label className="block text-sm font-medium text-blue-200/70 mb-1.5">{label}</label>
            <input
              data-testid={testid}
              type={type}
              value={form[field]}
              onChange={set(field)}
              required
              placeholder={placeholder}
              className="w-full px-4 py-3 rounded-xl bg-white/6 border border-white/12 text-white placeholder-blue-300/30 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        ))}
        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">{error}</p>
        )}
        <button
          data-testid="button-signup"
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}

function HeroContent({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const stats = [
    { value: "2.4M+", label: "Active Managers" },
    { value: "38", label: "Gameweeks" },
    { value: "500+", label: "Players" },
  ];

  return (
    <div className="flex flex-col items-center text-center max-w-3xl mx-auto px-6">
      {/* Logo */}
      <div
        className="relative mb-8"
        style={{ filter: "drop-shadow(0 0 60px rgba(59,130,246,0.7))" }}
      >
        <img src={logoSrc} alt="FANTA11" style={{ width: "360px", height: "360px" }} className="object-contain" />
      </div>

      {/* Headline */}
      <h1
        className="text-5xl md:text-6xl lg:text-7xl font-black leading-none tracking-tight mb-6"
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #93c5fd 50%, #3b82f6 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Build Your Dream Team.<br />Dominate Every Gameweek.
      </h1>

      {/* Sub-heading */}
      <p className="text-lg md:text-xl text-blue-200/60 max-w-xl leading-relaxed mb-10">
        The ultimate fantasy soccer platform. Pick your squad, outsmart the competition, and rise to the top of every league.
      </p>

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-4 mb-14">
        <button
          data-testid="button-get-started"
          onClick={onSignup}
          className="px-10 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-all shadow-2xl shadow-blue-600/40 hover:shadow-blue-500/50 hover:scale-105 active:scale-95"
        >
          Get Started Free
        </button>
        <button
          data-testid="button-login"
          onClick={onLogin}
          className="px-10 py-4 rounded-2xl border border-white/20 hover:border-blue-400/50 bg-white/5 hover:bg-white/10 text-white font-bold text-lg transition-all hover:scale-105 active:scale-95"
        >
          Sign In
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-8 sm:gap-14">
        {stats.map(({ value, label }) => (
          <div key={label} className="text-center">
            <div className="text-2xl sm:text-3xl font-black text-white">{value}</div>
            <div className="text-xs text-blue-300/50 font-medium uppercase tracking-wider mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingPage() {
  const [view, setView] = useState<View>("landing");

  return (
    <div
      className="min-h-screen flex flex-col dark"
      style={{
        background: "radial-gradient(ellipse 100% 80% at 50% -10%, rgba(29,78,216,0.3) 0%, transparent 70%), linear-gradient(180deg, #030712 0%, #060f24 40%, #030712 100%)",
      }}
    >
      {/* Top nav bar */}
      <header className="flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="FANTA11" className="w-9 h-9 object-contain" />
          <span className="font-black text-white tracking-[0.15em] text-lg uppercase">FANTA11</span>
        </div>
        {view === "landing" && (
          <button
            data-testid="button-nav-login"
            onClick={() => setView("login")}
            className="text-sm font-semibold text-blue-300/70 hover:text-white transition-colors"
          >
            Sign In
          </button>
        )}
      </header>

      {/* Pitch lines decorative background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute inset-0" style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(59,130,246,0.03) 80px),
            repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(59,130,246,0.03) 80px)
          `
        }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border border-blue-500/6" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-blue-500/8" />
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center relative z-10 py-12">
        {view === "landing" && (
          <HeroContent onLogin={() => setView("login")} onSignup={() => setView("signup")} />
        )}
        {view === "login" && <LoginForm onBack={() => setView("landing")} />}
        {view === "signup" && <SignupForm onBack={() => setView("landing")} />}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-blue-300/30 text-xs relative z-10">
        FANTA11 &copy; {new Date().getFullYear()} — Fantasy Soccer Platform
      </footer>
    </div>
  );
}
