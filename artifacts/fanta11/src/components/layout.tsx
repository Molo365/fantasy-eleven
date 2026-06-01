import { Link, useLocation } from "wouter";
import {
  Trophy,
  Users,
  CalendarDays,
  LayoutDashboard,
  ShieldHalf,
  Menu,
  X,
  LogOut,
  User,
} from "lucide-react";
import { useState } from "react";
import logoSrc from "../assets/logo.png";
import { useAuth } from "@/contexts/auth";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/squad", label: "Squad Builder", icon: ShieldHalf },
  { href: "/players", label: "Player Pool", icon: Users },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/fixtures", label: "Fixtures", icon: CalendarDays },
];

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof LayoutDashboard; active: boolean }) {
  return (
    <Link
      href={href}
      data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150
        ${active
          ? "bg-primary text-white shadow-lg shadow-primary/30"
          : "text-blue-200/70 hover:text-white hover:bg-white/8"
        }
      `}
    >
      <Icon size={18} className={active ? "text-white" : "text-blue-300/60"} />
      {label}
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { authState, logout } = useAuth();
  const user = authState.status === "authenticated" ? authState.user : null;

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="min-h-screen bg-background text-foreground flex dark">

      {/* ── Desktop Sidebar ── */}
      <aside
        style={{ background: "linear-gradient(180deg, #0e1f3d 0%, #162848 60%, #1a2f57 100%)" }}
        className="hidden md:flex w-72 flex-col border-r border-white/8 fixed inset-y-0 left-0 z-40"
      >
        {/* Logo block */}
        <div className="flex flex-col items-center pt-8 pb-6 px-6 border-b border-white/8">
          <div
            className="relative p-3 rounded-2xl mb-3"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)" }}
          >
            <img
              src={logoSrc}
              alt="FANTA11"
              className="w-28 h-28 object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]"
            />
          </div>
          <div className="text-center">
            <span
              className="block text-xl font-black tracking-widest uppercase"
              style={{
                color: "#fff",
                letterSpacing: "0.2em",
                textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 30px rgba(59,130,246,0.8)",
              }}
            >
              FANTA11
            </span>
            <span className="block text-xs text-blue-400/60 font-medium tracking-wider uppercase mt-0.5">
              Fantasy Soccer
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <p className="text-xs font-semibold text-blue-400/40 uppercase tracking-widest px-4 mb-3">
            Menu
          </p>
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </nav>

        {/* Bottom: GW status + user */}
        <div className="px-4 py-4 border-t border-white/8 space-y-3">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs text-blue-300/70 font-medium">Gameweek 3 — Active</span>
          </div>
          {user && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 border border-white/8">
              <div className="w-7 h-7 rounded-full bg-blue-600/40 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <User size={13} className="text-blue-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user.displayName}</p>
                <p className="text-[10px] text-blue-300/50 truncate">@{user.username}</p>
              </div>
              <button
                data-testid="button-logout"
                onClick={logout}
                title="Sign out"
                className="p-1.5 rounded-md text-blue-300/40 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
              >
                <LogOut size={13} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <header
        style={{ background: "linear-gradient(90deg, #0e1f3d 0%, #1a2f57 100%)" }}
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 border-b border-white/10 h-16"
      >
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="FANTA11" className="h-10 w-10 object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          <span
            className="font-black text-white tracking-[0.15em] text-base uppercase"
            style={{ textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" }}
          >FANTA11</span>
        </div>
        <button
          data-testid="mobile-menu-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-blue-200/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* ── Mobile Drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            style={{ background: "linear-gradient(180deg, #0e1f3d 0%, #162848 100%)" }}
            className="relative w-72 flex flex-col border-r border-white/10 h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center pt-10 pb-6 px-6 border-b border-white/8">
              <img src={logoSrc} alt="FANTA11" className="w-24 h-24 object-contain drop-shadow-[0_0_16px_rgba(59,130,246,0.5)]" />
              <span
                className="mt-3 text-lg font-black tracking-widest uppercase text-white"
                style={{ textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" }}
              >FANTA11</span>
              <span className="text-xs text-blue-400/60 tracking-wider uppercase">Fantasy Soccer</span>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  active={isActive(item.href)}
                />
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 md:ml-72 flex flex-col min-h-screen">
        <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}
