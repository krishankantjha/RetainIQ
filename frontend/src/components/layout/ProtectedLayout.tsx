import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import AppLayout from "@/components/layout/AppLayout";
import { AUTH_SESSION_EXPIRED_EVENT, clearSession, isAuthenticated } from "@/lib/api";
import { getStoredTheme, type ThemeMode } from "@/lib/theme";

export default function ProtectedLayout() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    const onSessionExpired = () => navigate("/", { replace: true });
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [navigate]);

  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const logout = () => {
    clearSession();
    navigate("/", { replace: true });
  };

  return (
    <AppLayout theme={theme} onThemeChange={setTheme} onLogout={logout}>
      <Outlet />
    </AppLayout>
  );
}
