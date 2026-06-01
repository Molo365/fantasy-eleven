import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import logoSrc from "../assets/logo.png";
import stadiumSrc from "../assets/stadium.jpg";

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
    <div className="w-full max-w-sm mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-blue-400/70 hover:text-blue-300 text-sm mb-5 transition-colors">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>
      <h2 className="text-2xl font-black text-white mb-1 tracking-tight">Welcome back</h2>
      <p className="text-blue-300/60 text-sm mb-5">Sign in to your FANTA11 account</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-blue-200/70 mb-1">Email</label>
          <input
            data-testid="input-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full px-3 py-2.5 rounded-xl bg-white/6 border border-white/12 text-white text-sm placeholder-blue-300/30 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-blue-200/70 mb-1">Password</label>
          <input
            data-testid="input-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full px-3 py-2.5 rounded-xl bg-white/6 border border-white/12 text-white text-sm placeholder-blue-300/30 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        {error && (
          <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}
        <button
          data-testid="button-login"
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
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
    <div className="w-full max-w-sm mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-blue-400/70 hover:text-blue-300 text-sm mb-5 transition-colors">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>
      <h2 className="text-2xl font-black text-white mb-1 tracking-tight">Create account</h2>
      <p className="text-blue-300/60 text-sm mb-5">Join thousands of managers on FANTA11</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        {[
          { label: "Full Name", field: "displayName" as const, type: "text", placeholder: "Pep Guardiola", testid: "input-display-name" },
          { label: "Username", field: "username" as const, type: "text", placeholder: "pepguardiola", testid: "input-username" },
          { label: "Email", field: "email" as const, type: "email", placeholder: "you@example.com", testid: "input-email" },
          { label: "Password", field: "password" as const, type: "password", placeholder: "At least 6 characters", testid: "input-password" },
        ].map(({ label, field, type, placeholder, testid }) => (
          <div key={field}>
            <label className="block text-xs font-medium text-blue-200/70 mb-1">{label}</label>
            <input
              data-testid={testid}
              type={type}
              value={form[field]}
              onChange={set(field)}
              required
              placeholder={placeholder}
              className="w-full px-3 py-2.5 rounded-xl bg-white/6 border border-white/12 text-white text-sm placeholder-blue-300/30 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        ))}
        {error && (
          <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}
        <button
          data-testid="button-signup"
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}

function HeroContent({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const stats = [
    { value: "5", label: "Leagues" },
    { value: "38", label: "Gameweeks" },
    { value: "500+", label: "Players" },
  ];

  return (
    <div className="flex flex-col items-center text-center max-w-2xl mx-auto px-6">
      {/* Logo */}
      <div style={{ filter: "drop-shadow(0 0 40px rgba(59,130,246,0.7))" }} className="mb-4">
        <img src={logoSrc} alt="FANTA11" style={{ width: "220px", height: "220px" }} className="object-contain" />
      </div>

      {/* Headline */}
      <h1
        className="text-4xl md:text-5xl font-black leading-tight tracking-tight mb-3"
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #93c5fd 50%, #3b82f6 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Build Your Dream Team.<br />Dominate Every Gameweek.
      </h1>

      {/* Sub-heading */}
      <p className="text-base text-blue-200/60 max-w-lg leading-relaxed mb-7">
        The ultimate fantasy soccer platform. Pick your squad, outsmart the competition, and rise to the top.
      </p>

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <button
          data-testid="button-get-started"
          onClick={onSignup}
          className="px-8 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition-all shadow-xl shadow-blue-600/40 hover:scale-105 active:scale-95"
        >
          Get Started Free
        </button>
        <button
          data-testid="button-login"
          onClick={onLogin}
          className="px-8 py-3 rounded-2xl border border-white/20 hover:border-blue-400/50 bg-white/5 hover:bg-white/10 text-white font-bold text-base transition-all hover:scale-105 active:scale-95"
        >
          Sign In
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-10">
        {stats.map(({ value, label }, i) => (
          <div key={label} className="flex items-center gap-10">
            <div className="text-center">
              <div className="text-xl font-black text-white">{value}</div>
              <div className="text-[11px] text-blue-300/50 font-medium uppercase tracking-wider">{label}</div>
            </div>
            {i < stats.length - 1 && <div className="w-px h-8 bg-white/10" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingPage() {
  const [view, setView] = useState<View>("landing");

  return (
    <div className="h-screen overflow-hidden flex flex-col dark relative" style={{ background: "#0a1628" }}>
      {/* Stadium backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${stadiumSrc})` }}
      />
      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(10,22,40,0.85) 0%, rgba(14,31,61,0.72) 50%, rgba(10,22,40,0.95) 100%)",
        }}
      />

      {/* All content above backdrop */}
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

        {/* Main content — centred in remaining space */}
        <main className="flex-1 flex items-center justify-center">
          {view === "landing" && (
            <HeroContent onLogin={() => setView("login")} onSignup={() => setView("signup")} />
          )}
          {view === "login" && <LoginForm onBack={() => setView("landing")} />}
          {view === "signup" && <SignupForm onBack={() => setView("landing")} />}
        </main>

        {/* Footer */}
        <footer className="text-center py-3 text-blue-300/25 text-xs flex-shrink-0">
          FANTA11 &copy; {new Date().getFullYear()} — Fantasy Soccer Platform
        </footer>
      </div>
    </div>
  );
}
