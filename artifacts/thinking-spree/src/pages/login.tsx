import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { loginRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import logoPath from "@assets/thinkingspree_logo_1778683092464.jpg";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await loginRequest(email, password);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setLocation("/dashboard");
    } catch (err: unknown) {
      toast({
        title: "Login failed",
        description: err instanceof Error ? err.message : "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center px-4">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-card border border-card-border rounded-xl shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={logoPath} alt="Thinking Spree" className="h-10 w-auto" />
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Consultant Portal</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Sign in with your Thinking Spree work email</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@thinkingspree.com"
                  required
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  data-testid="input-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-10 py-2.5 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              data-testid="button-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Access restricted to @thinkingspree.com accounts
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Don't have an account? <Link href="/signup" className="text-primary hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
