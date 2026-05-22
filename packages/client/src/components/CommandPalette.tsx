import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";
import type { LucideProps } from "lucide-react";
import {
  LayoutDashboard, TrendingUp, Users, FileBarChart,
  Settings, UserCog, Moon, LogOut, Search,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string;
  group?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const icon = (I: React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>) => (
    <I size={15} strokeWidth={1.8} />
  );

  function toggleDarkMode() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  const commands: Command[] = [
    { id: "overview",    label: "Overview",          description: "Main dashboard",          icon: icon(LayoutDashboard), group: "Navigate", keywords: "home main",              action: () => navigate({ to: "/dashboard" }) },
    { id: "revenue",     label: "Revenue",            description: "Revenue analytics",       icon: icon(TrendingUp),      group: "Navigate", keywords: "mrr money earnings",     action: () => navigate({ to: "/dashboard/revenue" }) },
    { id: "users",       label: "Users",              description: "User analytics & geo",    icon: icon(Users),           group: "Navigate", keywords: "customers geography",     action: () => navigate({ to: "/dashboard/users" }) },
    { id: "reports",     label: "Reports",            description: "Build & save reports",    icon: icon(FileBarChart),    group: "Navigate", keywords: "export csv pdf",         action: () => navigate({ to: "/dashboard/reports" }) },
    { id: "settings",    label: "Settings",           description: "Profile & preferences",   icon: icon(Settings),        group: "Navigate", keywords: "profile account",        action: () => navigate({ to: "/dashboard/settings" }) },
    { id: "admin-users", label: "Admin: Users",       description: "Manage users & roles",    icon: icon(UserCog),         group: "Admin",    keywords: "admin manage deactivate", action: () => navigate({ to: "/admin/users" }) },
    { id: "darkmode",    label: "Toggle Dark Mode",   description: "Switch light / dark",     icon: icon(Moon),            group: "Actions",  keywords: "theme light dark",       action: toggleDarkMode },
    { id: "logout",      label: "Logout",             description: "Sign out of Revenue Metrics", icon: icon(LogOut),       group: "Actions",  keywords: "sign out exit",          action: () => { logout(); navigate({ to: "/login" }); } },
  ];

  const filtered = query
    ? commands.filter((c) =>
        `${c.label} ${c.description} ${c.keywords}`.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Group filtered results
  const groups = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    const g = cmd.group ?? "Other";
    (acc[g] ??= []).push(cmd);
    return acc;
  }, {});

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const execute = useCallback((cmd: Command) => { cmd.action(); onClose(); }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && filtered[selected]) execute(filtered[selected]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selected, execute, onClose]);

  if (!open) return null;

  let globalIdx = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 fade-in" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg glass rounded-2xl shadow-2xl overflow-hidden slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 dark:border-white/5">
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands…"
            className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none text-sm"
          />
          <kbd className="hidden sm:block px-2 py-0.5 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700/60 rounded font-mono border border-slate-200 dark:border-slate-600">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">No results for "{query}"</p>
          ) : (
            Object.entries(groups).map(([groupName, cmds]) => (
              <div key={groupName}>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {groupName}
                </p>
                {cmds.map((cmd) => {
                  const idx = globalIdx++;
                  const isSelected = idx === selected;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => execute(cmd)}
                      onMouseEnter={() => setSelected(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-indigo-500/10 dark:bg-indigo-500/15"
                          : "hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className={`flex-shrink-0 ${isSelected ? "text-indigo-500" : "text-slate-400"}`}>
                        {cmd.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-200"}`}>
                          {cmd.label}
                        </p>
                        {cmd.description && (
                          <p className="text-xs text-slate-400 truncate">{cmd.description}</p>
                        )}
                      </div>
                      {isSelected && (
                        <kbd className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-600">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/10 dark:border-white/5 flex gap-4 text-[11px] text-slate-400">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>ESC close</span>
        </div>
      </div>
    </div>
  );
}
