import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Lock } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include", // Important: Include cookies for session
      });

      if (!response.ok) {
        throw new Error("Invalid password");
      }

      // Refetch auth status to ensure AuthGuard has updated data before redirecting
      await queryClient.refetchQueries({ queryKey: ["/api/auth-status"] });

      toast({
        title: "Access granted",
        description: "Welcome to Partyline Recorder",
      });

      setLocation("/");
    } catch (error) {
      toast({
        title: "Access denied",
        description: "Invalid password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center space-y-6">
          <div className="flex items-center gap-3">
            <Phone className="h-8 w-8 text-primary" data-testid="icon-logo" />
            <h1 className="text-2xl font-semibold" data-testid="text-app-title">
              Partyline Recorder
            </h1>
          </div>

          <div className="w-full space-y-2 text-center">
            <h2 className="text-lg font-medium" data-testid="text-login-title">
              Dashboard Access
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="text-login-description">
              Enter the password to view recordings
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" data-testid="icon-password" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                autoFocus
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Verifying..." : "Access Dashboard"}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
