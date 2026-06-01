import { Link, useLocation } from "wouter";
import { 
  Trophy, 
  Users, 
  CalendarDays, 
  LayoutDashboard,
  ShieldHalf,
  Activity
} from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/squad", label: "Squad Builder", icon: ShieldHalf },
    { href: "/players", label: "Player Pool", icon: Users },
    { href: "/leagues", label: "Leagues", icon: Trophy },
    { href: "/fixtures", label: "Fixtures", icon: CalendarDays },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row dark">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
            F11
          </div>
          <span className="font-bold text-xl tracking-tight uppercase">FANTA11</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden border-b border-border bg-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
            F11
          </div>
          <span className="font-bold tracking-tight uppercase">FANTA11</span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {navItems.map((item) => (
             <Link key={item.href} href={item.href} className={`text-xs whitespace-nowrap px-3 py-1.5 rounded-full ${location === item.href ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
               {item.label}
             </Link>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        <div className="max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
