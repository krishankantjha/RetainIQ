import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedLayout from "@/components/layout/ProtectedLayout";
import { isAuthenticated } from "@/lib/api";
import AtRiskPage from "@/pages/AtRiskPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import DashboardPage from "@/pages/DashboardPage";
import ExplorerPage from "@/pages/ExplorerPage";
import LoginPage from "@/pages/LoginPage";
import SavePlaysPage from "@/pages/SavePlaysPage";
import SubscriberDetailPage from "@/pages/SubscriberDetailPage";
import ScoreCustomerPage from "@/pages/ScoreCustomerPage";
import DiagnosticsPage from "@/pages/DiagnosticsPage";
import ExecutiveReportsPage from "@/pages/ExecutiveReportsPage";
import SettingsPage from "@/pages/SettingsPage";
import UploadPage from "@/pages/UploadPage";
import WhatIfPage from "@/pages/WhatIfPage";

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={isAuthenticated() ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/diagnostics" element={<DiagnosticsPage />} />
        <Route path="/reports" element={<ExecutiveReportsPage />} />
        <Route path="/at-risk" element={<AtRiskPage />} />
        <Route path="/save-plays" element={<SavePlaysPage />} />
        <Route path="/what-if" element={<WhatIfPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/score" element={<ScoreCustomerPage />} />
        <Route path="/explorer" element={<ExplorerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/subscribers/:customerId" element={<SubscriberDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
