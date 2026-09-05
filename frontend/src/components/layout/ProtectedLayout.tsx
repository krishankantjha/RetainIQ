import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";

import AppLayout from "@/components/layout/AppLayout";
import { clearSession, isAuthenticated } from "@/lib/api";
import { getStoredTheme, type ThemeMode } from "@/lib/theme";

export default function ProtectedLayout() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

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
