import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { Dashboard } from "@/pages/dashboard";
import { SquadBuilder } from "@/pages/squad-builder";
import { Players } from "@/pages/players";
import { Leagues } from "@/pages/leagues";
import { Fixtures } from "@/pages/fixtures";
import { LandingPage } from "@/pages/landing";
import { AuthProvider, useAuth } from "@/contexts/auth";

const queryClient = new QueryClient();

function AppRoutes() {
  const { authState } = useAuth();

  if (authState.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center dark" style={{ background: "#030712" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-blue-300/50 text-sm font-medium tracking-wider uppercase">Loading</p>
        </div>
      </div>
    );
  }

  if (authState.status === "unauthenticated") {
    return <LandingPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/squad" component={SquadBuilder} />
        <Route path="/players" component={Players} />
        <Route path="/leagues" component={Leagues} />
        <Route path="/fixtures" component={Fixtures} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
