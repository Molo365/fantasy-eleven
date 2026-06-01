import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import logoSrc from "../assets/logo.png";
import heroBg from "../assets/hero-bg.jpg";

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
            className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-blue-300/30 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
            className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-blue-300/30 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
              className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-blue-300/30 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
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

export function LandingPage() {
  const [view, setView] = useState<View>("landing");

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

        {/* Navbar — replaces the one baked into the image */}
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
              className="text-sm font-semibold text-white/80 hover:text-white transition-colors"
            >
              Sign In
            </button>
          )}
        </header>

        {/* Form overlay — shown when login/signup is active */}
        {view !== "landing" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-black/60 backdrop-blur-md rounded-2xl p-8 border border-white/10 w-full max-w-sm mx-6">
              {view === "login" && <LoginForm onBack={() => setView("landing")} />}
              {view === "signup" && <SignupForm onBack={() => setView("landing")} />}
            </div>
          </div>
        )}

        {/* Stats bar — pinned to the bottom via mt-auto */}
        {view === "landing" && (
          <div className="mt-auto flex-shrink-0 flex items-center justify-center gap-10 pb-6 pt-3">
            {[
              { icon: "🏆", value: "5", label: "Leagues" },
              { icon: "📅", value: "38", label: "Gameweeks" },
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
        )}

        {/* Invisible clickable zones over the image buttons (landing view only) */}
        {view === "landing" && (
          <div className="absolute inset-0 top-14 bottom-20">
            {/* "Get Started Free" button zone */}
            <button
              data-testid="button-get-started"
              onClick={() => setView("signup")}
              aria-label="Get Started Free"
              className="absolute cursor-pointer rounded-full opacity-0 hover:opacity-20 hover:bg-blue-400 transition-opacity"
              style={{ left: "36%", top: "78%", width: "14%", height: "10%" }}
            />
            {/* "Sign In" button zone */}
            <button
              data-testid="button-login"
              onClick={() => setView("login")}
              aria-label="Sign In"
              className="absolute cursor-pointer rounded-full opacity-0 hover:opacity-20 hover:bg-white transition-opacity"
              style={{ left: "51%", top: "78%", width: "11%", height: "10%" }}
            />
          </div>
        )}

      </div>
    </div>
  );
}
