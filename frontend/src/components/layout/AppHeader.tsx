import { Bell, FileText, LogOut, Moon, Settings, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import GlobalSearch from "@/components/layout/GlobalSearch";
import { fetchModelHealth, type ModelHealth } from "@/lib/api";
import { displayNameFromProfile, greetingForHour, greetingName, userContactEmail, userInitial } from "@/lib/format";
import { toggleTheme, type ThemeMode } from "@/lib/theme";

type AppHeaderProps = {
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  onLogout: () => void;
  username: string;
  fullName: string | null;
  subtitle: string;
};

export default function AppHeader({
  theme,
  onThemeChange,
  onLogout,
  username,
  fullName,
  subtitle,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const displayName = displayNameFromProfile(username, fullName);
  const firstName = greetingName(username, fullName);
  const initial = userInitial(username, fullName);
  const email = userContactEmail(username);

  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [health, setHealth] = useState<ModelHealth | null>(null);
  const [greeting, setGreeting] = useState(() => greetingForHour());

  useEffect(() => {
    const refreshGreeting = () => setGreeting(greetingForHour());
    refreshGreeting();
    const intervalId = window.setInterval(refreshGreeting, 60_000);
    window.addEventListener("focus", refreshGreeting);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshGreeting);
    };
  }, []);

  useEffect(() => {
    fetchModelHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setUserOpen(false);
        setNotifOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const hasAlerts =
    health?.status === "Degraded" ||
    health?.status === "Warning" ||
    health?.drift_detected === true;

  const onViewReports = () => {
    navigate("/reports");
  };

  const showReportsShortcut = pathname !== "/reports";

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur-xl shadow-[0_1px_0_0_color-mix(in_oklab,var(--border)_65%,transparent)]">
      {/* Utility bar */}
      <div className="flex items-center gap-3 border-b border-border/60 bg-surface-low/30 px-4 py-2.5 sm:px-6">
        <div className="mx-auto w-full max-w-2xl flex-1">
          <GlobalSearch inputRef={searchRef} />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onThemeChange(toggleTheme())}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-surface-low/70 text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-surface-low/70 text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {hasAlerts && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border/80 bg-surface-low p-3 shadow-xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Alerts
                </p>
                {hasAlerts ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm font-medium">
                      Model health: {health?.status ?? "Attention needed"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {health?.message ?? "Review model diagnostics for cohort-vs-training details."}
                    </p>
                    <Link
                      to="/diagnostics"
                      className="text-xs font-medium text-primary-soft hover:underline"
                      onClick={() => setNotifOpen(false)}
                    >
                      Open diagnostics →
                    </Link>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No active alerts.</p>
                )}
              </div>
            )}
          </div>

          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-xs font-semibold text-primary-foreground ring-2 ring-primary/25"
              aria-label="Account menu"
            >
              {initial}
            </button>

            {userOpen && (
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border/80 bg-surface-low p-2 shadow-xl">
                <div className="border-b border-border/60 px-2 pb-2">
                  <p className="text-sm font-semibold">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUserOpen(false);
                    navigate("/settings");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-surface-high/60 hover:text-foreground"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserOpen(false);
                    onLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-surface-high/60 hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Context bar */}
      <div className="px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {greeting}, {firstName}{" "}
              <span aria-hidden className="inline-block">👋</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <p className="hidden max-w-xs text-right text-xs italic text-muted-foreground xl:block">
            Data gives you the opportunity to be proactive instead of reactive.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-surface-low/60 px-3 py-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Last upload snapshot</span>
            <span aria-hidden>·</span>
            <span>{today}</span>
          </div>

          {showReportsShortcut && (
            <button
              type="button"
              onClick={onViewReports}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition-opacity hover:opacity-95"
            >
              <FileText className="h-4 w-4" />
              View reports
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
