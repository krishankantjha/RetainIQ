import {
  Activity,
  ArrowRight,
  BarChart3,
  ChevronDown,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldAlert,
  Sparkles,
  Table2,
  Upload,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import LogoWordmark from "@/components/LogoWordmark";
import { displayNameFromProfile, userContactEmail, userInitial } from "@/lib/format";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/at-risk", label: "At-risk subscribers", icon: ShieldAlert },
  { to: "/analytics", label: "Trends", icon: BarChart3 },
  { to: "/diagnostics", label: "Model diagnostics", icon: Activity },
  { to: "/save-plays", label: "Interventions", icon: Sparkles },
  { to: "/what-if", label: "What-if lab", icon: FlaskConical },
  { to: "/explorer", label: "Data explorer", icon: Table2 },
  { to: "/upload", label: "Upload data", icon: Upload },
] as const;

type AppSidebarProps = {
  username: string;
  fullName: string | null;
  onLogout: () => void;
};

function navClassName(isActive: boolean) {
  return [
    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all",
    isActive
      ? "bg-gradient-to-r from-primary/22 via-primary/12 to-transparent text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_30%,transparent)]"
      : "text-muted-foreground hover:bg-surface-high/45 hover:text-foreground",
  ].join(" ");
}

export default function AppSidebar({ username, fullName, onLogout }: AppSidebarProps) {
  const navigate = useNavigate();
  const displayName = displayNameFromProfile(username, fullName);
  const initial = userInitial(username, fullName);
  const email = userContactEmail(username);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[15.5rem] flex-col border-r border-border/60 bg-[color-mix(in_oklab,var(--surface-low)_88%,var(--background))] backdrop-blur-xl lg:flex"
    >
      <Link to="/dashboard" className="flex shrink-0 items-center px-4 py-4">
        <LogoWordmark size="sidebar" />
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => navClassName(isActive)}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_12px_var(--primary)]"
                    aria-hidden
                  />
                )}
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2.25 : 2} />
                <span className="truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto shrink-0 space-y-4 px-3 pb-5 pt-3">
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/10 via-surface-high/30 to-transparent p-3">
          <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary-soft">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <p className="text-[13px] font-medium leading-snug">Turn data into brighter futures.</p>
          <Link
            to="/upload"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-soft hover:underline"
          >
            Learn more
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-surface-high/35 px-2.5 py-2 text-left transition-colors hover:border-primary/30"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/70 to-primary text-xs font-bold text-primary-foreground"
              aria-hidden
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{email}</p>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {menuOpen && (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-xl border border-border/80 bg-surface-low p-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/settings");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-surface-high/60 hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-surface-high/60 hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
