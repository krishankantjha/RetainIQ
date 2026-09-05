import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";
import { getFullName, getUsername, hydrateUserProfile } from "@/lib/api";
import type { ThemeMode } from "@/lib/theme";

const NAV_MOBILE = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/reports", label: "Reports" },
  { to: "/at-risk", label: "At risk" },
  { to: "/analytics", label: "Trends" },
  { to: "/diagnostics", label: "Diagnostics" },
  { to: "/what-if", label: "What-if" },
  { to: "/upload", label: "Upload" },
] as const;

const SUBTITLES: Record<string, string> = {
  "/dashboard": "Overview of your last scored upload.",
  "/reports": "Executive snapshot of your uploaded subscriber portfolio.",
  "/analytics": "Trends and segmentation from your scored upload.",
  "/diagnostics": "Model health, holdout metrics, and cohort-vs-training checks.",
  "/at-risk": "Subscribers flagged at or above the decision threshold.",
  "/save-plays": "SHAP-based save play suggestions across your scored upload.",
  "/what-if": "Counterfactual churn simulations for individual subscribers.",
  "/upload": "Upload an IBM Telco-format subscriber CSV or score one account.",
  "/score": "Score a single subscriber without uploading a subscriber CSV.",
  "/explorer": "Browse and filter all scored subscribers.",
  "/settings": "Profile and account preferences.",
};

type AppLayoutProps = {
  children: ReactNode;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  onLogout: () => void;
  subtitle?: string;
};

export default function AppLayout({
  children,
  theme,
  onThemeChange,
  onLogout,
  subtitle,
}: AppLayoutProps) {
  const username = getUsername() ?? "";
  const [fullName, setFullName] = useState<string | null>(() => getFullName());
  const { pathname } = useLocation();

  useEffect(() => {
    const localName = getFullName();
    if (localName) {
      setFullName(localName);
    }

    const refreshProfile = () => {
      void hydrateUserProfile()
        .then((name) => {
          if (name) setFullName(name);
        })
        .catch(() => undefined);
    };

    refreshProfile();

    const onProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ fullName?: string | null }>).detail;
      setFullName(detail?.fullName ?? getFullName());
    };

    const onFocus = () => refreshProfile();

    window.addEventListener("retainiq:profile-updated", onProfileUpdated);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("retainiq:profile-updated", onProfileUpdated);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const resolvedSubtitle =
    subtitle ??
    (pathname.startsWith("/subscribers/")
      ? "Subscriber churn drivers, save plays, and simulations."
      : SUBTITLES[pathname] ?? "Telecom churn intelligence.");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar username={username} fullName={fullName} onLogout={onLogout} />

      <div className="flex min-h-screen flex-col bg-[color-mix(in_oklab,var(--surface-low)_35%,var(--background))] lg:pl-[15.5rem]">
        <AppHeader
          theme={theme}
          onThemeChange={onThemeChange}
          onLogout={onLogout}
          username={username}
          fullName={fullName}
          subtitle={resolvedSubtitle}
        />

        <nav className="flex gap-1.5 overflow-x-auto border-b border-border/50 px-4 py-2 lg:hidden">
          {NAV_MOBILE.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  isActive
                    ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                    : "text-muted-foreground"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
