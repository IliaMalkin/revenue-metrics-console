import { Link, useRouterState } from "@tanstack/react-router";
import { usePermission, useAuthStore } from "@/stores/authStore";
import {
  LayoutDashboard, TrendingUp, Users, FileBarChart,
  Settings, ShieldCheck, UserCog, LogOut, Zap,
} from "lucide-react";

const navItems = [
  { label: "Overview",  href: "/dashboard",          icon: LayoutDashboard },
  { label: "Revenue",   href: "/dashboard/revenue",  icon: TrendingUp },
  { label: "Users",     href: "/dashboard/users",    icon: Users },
  { label: "Reports",   href: "/dashboard/reports",  icon: FileBarChart },
  { label: "Settings",  href: "/dashboard/settings", icon: Settings },
];

const adminItems = [
  { label: "Users",  href: "/admin/users", icon: UserCog },
  { label: "Roles",  href: "/admin/roles", icon: ShieldCheck },
];

export function Sidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const canViewAdmin = usePermission("users:read");
  const { user, logout } = useAuthStore();

  function isActive(href: string) {
    return href === "/dashboard"
      ? currentPath === "/dashboard"
      : currentPath.startsWith(href);
  }

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-full bg-[#0d1117] border-r border-white/[0.06]">
      {/* Logo */}
      <div className="px-5 h-16 flex items-center gap-2 border-b border-white/[0.06]">
        <Zap size={15} className="text-slate-300" strokeWidth={2} />
        <span className="text-[15px] font-semibold text-white tracking-tight">Revenue Metrics</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="px-3 mb-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          Workspace
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`nav-item ${active ? "active" : ""}`}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {canViewAdmin && (
          <>
            <p className="px-3 pt-5 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
              Admin
            </p>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`nav-item ${active ? "active" : ""}`}
                >
                  <Icon size={16} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg group">
          <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-slate-300">
              {user?.fullName?.charAt(0).toUpperCase() ?? "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate leading-none mb-0.5">
              {user?.fullName ?? "User"}
            </p>
            <p className="text-xs text-slate-500 capitalize truncate">{user?.role.name}</p>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
