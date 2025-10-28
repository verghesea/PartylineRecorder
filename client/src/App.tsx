import { Switch, Route, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import RecordingsPage from "@/pages/recordings";
import LoginPage from "@/pages/login";
import { useEffect } from "react";

interface AuthStatus {
  authenticated: boolean;
  passwordRequired: boolean;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: authStatus, isLoading } = useQuery<AuthStatus>({
    queryKey: ["/api/auth-status"],
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!isLoading && authStatus?.passwordRequired && !authStatus?.authenticated) {
      setLocation("/login");
    }
  }, [authStatus, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (authStatus?.passwordRequired && !authStatus?.authenticated) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <AuthGuard>
          <RecordingsPage />
        </AuthGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
