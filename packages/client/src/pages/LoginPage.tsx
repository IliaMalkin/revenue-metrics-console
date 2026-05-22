import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";
import { Zap, ArrowRight, Loader2 } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@demo.com", password: "demo123", color: "indigo" },
  { label: "Manager", email: "manager@demo.com", password: "demo123", color: "violet" },
  { label: "Viewer", email: "viewer@demo.com", password: "demo123", color: "slate" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo(demoEmail: string, demoPassword: string) {
    setError("");
    setLoading(true);
    try {
      await login(demoEmail, demoPassword);
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center bottom, rgba(139,92,246,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-4">
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-60"
              style={{ background: "rgba(99,102,241,0.5)" }}
            />
            <div className="relative w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg">
              <Zap size={26} className="text-white" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Revenue Metrics</h1>
          <p className="text-sm text-slate-500 mt-1">Internal analytics console</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-white/[0.08] p-8"
          style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)" }}
        >
          <h2 className="text-lg font-semibold text-white mb-6">Sign in to your workspace</h2>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.05] text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.05] text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-slate-600">try demo</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            <div className="flex gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.label}
                  onClick={() => handleDemo(acc.email, acc.password)}
                  disabled={loading}
                  className="flex-1 py-2 text-xs font-medium rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] hover:border-indigo-500/30 transition-all disabled:opacity-50"
                >
                  {acc.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-600 text-center mt-2.5">
              password: <span className="font-mono text-slate-500">demo123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
