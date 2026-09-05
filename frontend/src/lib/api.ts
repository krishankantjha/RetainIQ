function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured !== undefined && configured !== "") {
    return configured;
  }
  if (import.meta.env.DEV) {
    return "";
  }
  throw new Error(
    "VITE_API_BASE_URL is required for production builds. Set it in your hosting provider environment.",
  );
}

const API_BASE = resolveApiBase();

/** Default local admin credentials for one-click guest / demo access */
const GUEST_USERNAME = import.meta.env.VITE_GUEST_USERNAME ?? "admin";
const GUEST_PASSWORD = import.meta.env.VITE_GUEST_PASSWORD ?? "password";

const TOKEN_KEY = "retainiq_jwt";
const USER_KEY = "retainiq_username";
const FULL_NAME_KEY = "retainiq_full_name";
const REMEMBER_USERNAME_KEY = "retainiq_remember_username";
const REMEMBER_EMAIL_KEY = "retainiq_remember_email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export interface RiskDistribution {
  high: number;
  medium: number;
  low: number;
}

export interface Overview {
  total_customers: number;
  average_churn_probability: number;
  total_value_at_risk: number;
  risk_distribution: RiskDistribution;
  risk_bands?: {
    decision_threshold: number;
    elevated_min: number;
    actionable_high: number;
  };
}

export interface SavePlayStat {
  campaign: string;
  recommendation_count: number;
  average_estimated_impact: number;
}

export interface CohortRow {
  customer_id: string;
  gender: string;
  tenure: number;
  contract: string;
  internet_service: string;
  monthly_charges: number;
  total_charges: number;
  churn: string | null;
  churn_probability: number;
  is_high_risk: boolean;
  cluster: number | null;
  cohort_persona: string | null;
  predicted_at: string | null;
}

export type CohortSortField = "customer_id" | "churn_probability" | "tenure" | "monthly_charges";
export type CohortSortDirection = "asc" | "desc";

export interface CohortFilters {
  high_risk?: boolean;
  contract?: string;
  cluster?: number;
  campaign?: string;
  tenure_bin?: string;
  min_churn?: number;
  max_churn?: number;
  sort_by?: CohortSortField;
  sort_dir?: CohortSortDirection;
}

export interface CohortDataResponse {
  items: CohortRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  filters?: CohortFilters;
}

export interface PersonaSummary {
  cluster_id: number | null;
  persona: string;
  subscriber_count: number;
  average_churn_probability: number;
  high_risk_count: number;
}

export interface PersonasResponse {
  personas: PersonaSummary[];
  total_subscribers: number;
}

export interface DiagnosticsMetadata {
  success?: boolean;
  drift_detected?: boolean;
  model_version?: string;
  diagnostics_version?: string;
  artifact_timestamp?: string;
  evaluation_timestamp?: string;
  decision_threshold?: number;
  model_sha256?: string;
  actual_model_sha256?: string;
  holdout_metrics?: Record<string, number>;
  message?: string;
}

export interface DriftFeatureDetail {
  ks_statistic?: number;
  chi2_statistic?: number;
  p_value?: number;
  psi?: number;
  drifted?: boolean;
  method?: string;
}

export interface ModelHealth {
  status?: string;
  message?: string;
  model_name?: string;
  model_version?: string;
  last_trained?: string;
  drift_detected?: boolean;
  drift_ratio?: number;
  metrics?: Record<string, number>;
  drift_details?: Record<string, DriftFeatureDetail>;
}

export interface UploadAccepted {
  upload_id: number;
  filename: string;
  status: string;
  decision_threshold?: number | null;
  message: string;
}

export interface UploadStatus {
  upload_id: number;
  filename: string;
  status: string;
  row_count: number;
  decision_threshold?: number | null;
  error_message: string | null;
  uploaded_at: string | null;
}

export interface UploadRecord {
  upload_id: number;
  filename: string;
  status: string;
  row_count: number;
  decision_threshold?: number | null;
  error_message: string | null;
  uploaded_at: string | null;
}

export interface RiskTrendPoint {
  date: string;
  subscriber_count: number;
  avg_churn_probability: number;
  high_risk_count: number;
}

export interface RiskTrendResponse {
  points: RiskTrendPoint[];
}

export interface GlobalDriver {
  feature: string;
  mean_shap: number;
  mean_abs_shap: number;
  occurrence_count: number;
}

export interface GlobalDriversResponse {
  drivers: GlobalDriver[];
  subscriber_count: number;
}

export interface SegmentMatrix {
  contracts: string[];
  tenure_bins: string[];
  matrix: (number | null)[][];
  counts: number[][];
  cells: Array<{
    contract: string;
    tenure_bin: string;
    avg_churn_probability: number;
    count: number;
  }>;
}

export interface ShapDriver {
  feature: string;
  shap_value: number;
}

export interface SavePlay {
  campaign: string;
  action: string;
  estimated_impact: number;
}

export interface SimulationDetail {
  intervention: string;
  original_risk: number;
  simulated_risk: number;
  risk_reduction: number;
}

export interface CustomerExplain {
  customer_id: string;
  gender: string;
  tenure: number;
  monthly_charges: number;
  total_charges: number;
  churn_probability: number;
  is_high_risk: boolean;
  top_drivers: ShapDriver[];
  save_plays: SavePlay[];
  cluster: number | null;
  cohort_persona: string | null;
  simulations?: SimulationDetail[] | null;
  customer_features?: Record<string, unknown> | null;
  predicted_at: string;
}

function parseErrorDetail(data: Record<string, unknown>): string {
  const detail = data.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === "object" && d && "msg" in d ? String(d.msg) : ""))
      .filter(Boolean)
      .join(", ");
  }
  return "Request failed";
}

const NETWORK_ERROR =
  "Cannot reach the API. Start the backend in another terminal: cd backend; uvicorn app.main:app --reload";

export const AUTH_SESSION_EXPIRED_EVENT = "retainiq:session-expired";

function notifySessionExpired(): never {
  clearSession();
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
  throw new Error("Session expired");
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error(NETWORK_ERROR);
  }
}

function getTokenStorage(remember: boolean): Storage {
  return remember ? localStorage : sessionStorage;
}

function resolveAuthStorage(): Storage {
  if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage;
  return localStorage;
}

function isRememberedSession(): boolean {
  return resolveAuthStorage() === localStorage;
}

export function getRememberedEmail(): string {
  return (
    localStorage.getItem(REMEMBER_EMAIL_KEY) ??
    localStorage.getItem(REMEMBER_USERNAME_KEY) ??
    ""
  );
}

export function setRememberedEmail(email: string): void {
  localStorage.setItem(REMEMBER_EMAIL_KEY, email);
  localStorage.removeItem(REMEMBER_USERNAME_KEY);
}

export function clearRememberedEmail(): void {
  localStorage.removeItem(REMEMBER_EMAIL_KEY);
  localStorage.removeItem(REMEMBER_USERNAME_KEY);
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
}

export function getUsername(): string | null {
  return sessionStorage.getItem(USER_KEY) ?? localStorage.getItem(USER_KEY);
}

export function getFullName(): string | null {
  return resolveAuthStorage().getItem(FULL_NAME_KEY);
}

function setFullName(fullName: string | null, remember: boolean): void {
  const storage = getTokenStorage(remember);
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(FULL_NAME_KEY);
  if (fullName?.trim()) {
    storage.setItem(FULL_NAME_KEY, fullName.trim());
  } else {
    storage.removeItem(FULL_NAME_KEY);
  }
}

export interface UserProfile {
  username: string;
  full_name: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
  full_name: string | null;
}

export type ProfileSaveResult = {
  synced: boolean;
  fullName: string;
  warning?: string;
};

export interface RegisteredUser {
  id: number;
  username: string;
  full_name: string | null;
  created_at: string;
}

export function setSession(
  token: string,
  username: string,
  remember: boolean,
  fullName?: string | null,
): void {
  const storage = getTokenStorage(remember);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(FULL_NAME_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(FULL_NAME_KEY);

  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, username);
  setFullName(fullName ?? null, remember);

  if (remember) {
    setRememberedEmail(username);
  } else {
    clearRememberedEmail();
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(FULL_NAME_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(FULL_NAME_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const response = await apiFetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    notifySessionExpired();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(data as Record<string, unknown>) || "Request failed");
  }
  return data as T;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  return authFetch<UserProfile>("/api/v1/auth/me");
}

export async function updateUserProfile(fullName: string): Promise<UserProfile> {
  const profile = await authFetch<UserProfile>("/api/v1/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: fullName.trim() }),
  });
  setFullName(profile.full_name, isRememberedSession());
  return profile;
}

export function applyDisplayName(fullName: string): void {
  const trimmed = fullName.trim();
  if (!trimmed) return;
  syncStoredProfile(trimmed);
  window.dispatchEvent(
    new CustomEvent("retainiq:profile-updated", {
      detail: { fullName: trimmed },
    }),
  );
}

export async function saveUserProfile(fullName: string): Promise<ProfileSaveResult> {
  const trimmed = fullName.trim();
  applyDisplayName(trimmed);

  try {
    const profile = await updateUserProfile(trimmed);
    const resolved = profile.full_name?.trim() || trimmed;
    applyDisplayName(resolved);
    return { synced: true, fullName: resolved };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync profile";
    const warning = message.includes("Cannot reach the API")
      ? "Name updated on this device. It will sync to your account when the API is available."
      : `Name updated on this device. Server sync failed: ${message}`;
    return { synced: false, fullName: trimmed, warning };
  }
}

async function syncUserProfile(): Promise<string | null> {
  const local = getFullName();
  try {
    const profile = await fetchCurrentUser();
    if (profile.full_name?.trim()) {
      setFullName(profile.full_name, isRememberedSession());
      return profile.full_name;
    }
  } catch {
    // Keep the locally stored display name when the API is unreachable.
  }
  return local;
}

export async function hydrateUserProfile(): Promise<string | null> {
  if (!getToken()) return null;
  return syncUserProfile();
}

export function syncStoredProfile(fullName: string | null): void {
  if (!getToken()) return;
  setFullName(fullName, isRememberedSession());
}

export async function login(
  email: string,
  password: string,
  remember: boolean,
): Promise<void> {
  const normalized = normalizeEmail(email);
  const body = new URLSearchParams({ username: normalized, password });
  const response = await apiFetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await response.json().catch(() => ({}))) as Partial<LoginResponse>;
  if (!response.ok) {
    throw new Error(parseErrorDetail(data) || "Invalid email or password");
  }

  const token = data.access_token;
  if (!token) {
    throw new Error("Invalid login response");
  }

  const loginUsername = data.username?.trim() || normalized;
  setSession(token, loginUsername, remember, data.full_name ?? null);
  if (data.full_name?.trim()) {
    applyDisplayName(data.full_name);
  }
}

export async function guestLogin(): Promise<void> {
  await login(GUEST_USERNAME, GUEST_PASSWORD, false);
}

export async function register(
  email: string,
  fullName: string,
  password: string,
  securityQuestion: string,
  securityAnswer: string,
): Promise<RegisteredUser> {
  const normalized = normalizeEmail(email);
  const response = await apiFetch("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: normalized,
      full_name: fullName.trim(),
      password,
      security_question: securityQuestion,
      security_answer: securityAnswer,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(data) || "Registration failed");
  }
  return data as RegisteredUser;
}

export async function getSecurityQuestion(username: string): Promise<string> {
  const response = await apiFetch(
    `/api/v1/auth/security-question/${encodeURIComponent(username.trim())}`,
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(data) || "Unable to retrieve security question");
  }
  return String(data.security_question ?? "");
}

export async function resetPassword(
  username: string,
  securityAnswer: string,
  newPassword: string,
): Promise<void> {
  const response = await apiFetch("/api/v1/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: username.trim(),
      security_answer: securityAnswer,
      new_password: newPassword,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(data) || "Failed to reset password");
  }
}

export async function fetchOverview(): Promise<Overview> {
  return authFetch<Overview>("/api/v1/analytics/overview");
}

export async function fetchSavePlays(): Promise<SavePlayStat[]> {
  return authFetch<SavePlayStat[]>("/api/v1/analytics/save-plays");
}

function appendCohortFilters(params: URLSearchParams, filters?: CohortFilters): void {
  if (!filters) return;
  if (filters.high_risk) params.set("high_risk", "true");
  if (filters.contract) params.set("contract", filters.contract);
  if (filters.cluster !== undefined) params.set("cluster", String(filters.cluster));
  if (filters.campaign) params.set("campaign", filters.campaign);
  if (filters.tenure_bin) params.set("tenure_bin", filters.tenure_bin);
  if (filters.min_churn !== undefined) params.set("min_churn", String(filters.min_churn));
  if (filters.max_churn !== undefined) params.set("max_churn", String(filters.max_churn));
  if (filters.sort_by) params.set("sort_by", filters.sort_by);
  if (filters.sort_dir) params.set("sort_dir", filters.sort_dir);
}

export async function fetchCohortData(
  page = 1,
  pageSize = 500,
  filters?: CohortFilters,
): Promise<CohortDataResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  appendCohortFilters(params, filters);
  return authFetch<CohortDataResponse>(`/api/v1/analytics/cohort-data?${params.toString()}`);
}

export async function fetchAllCohortData(
  pageSize = 1000,
  filters?: CohortFilters,
): Promise<CohortRow[]> {
  const first = await fetchCohortData(1, pageSize, filters);
  if (first.total_pages <= 1) return first.items;

  const pages = await Promise.all(
    Array.from({ length: first.total_pages - 1 }, (_, i) =>
      fetchCohortData(i + 2, pageSize, filters),
    ),
  );
  return [first.items, ...pages.map((p) => p.items)].flat();
}

export async function fetchPersonas(): Promise<PersonasResponse> {
  return authFetch<PersonasResponse>("/api/v1/analytics/personas");
}

export async function fetchDiagnostics(): Promise<DiagnosticsMetadata> {
  return authFetch<DiagnosticsMetadata>("/api/v1/analytics/diagnostics-metadata");
}

export interface DiagnosticPlot {
  id: string;
  title: string;
  filename: string;
  available: boolean;
}

export async function fetchDiagnosticPlots(): Promise<DiagnosticPlot[]> {
  return authFetch<DiagnosticPlot[]>("/api/v1/analytics/diagnostics-plots");
}

export async function fetchDiagnosticPlotBlobUrl(plotId: string): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const response = await apiFetch(`/api/v1/analytics/diagnostics-plots/${encodeURIComponent(plotId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    notifySessionExpired();
  }

  if (!response.ok) {
    throw new Error("Failed to load diagnostic plot");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await authFetch<{ success: boolean; message: string }>("/api/v1/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export async function fetchModelHealth(): Promise<ModelHealth> {
  return authFetch<ModelHealth>("/api/v1/analytics/model-health");
}

export async function uploadCsv(file: File, threshold?: number): Promise<UploadAccepted> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const params = new URLSearchParams();
  if (threshold !== undefined) params.set("threshold", String(threshold));

  const form = new FormData();
  form.append("file", file);

  const query = params.toString();
  const response = await apiFetch(`/api/v1/upload${query ? `?${query}` : ""}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (response.status === 401) {
    notifySessionExpired();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(data as Record<string, unknown>) || "Upload failed");
  }
  return data as UploadAccepted;
}

export async function fetchUploadStatus(uploadId: number): Promise<UploadStatus> {
  return authFetch<UploadStatus>(`/api/v1/uploads/${uploadId}/status`);
}

export async function fetchUploadHistory(limit = 20): Promise<UploadRecord[]> {
  return authFetch<UploadRecord[]>(`/api/v1/uploads?limit=${limit}`);
}

export async function fetchRiskTrend(): Promise<RiskTrendResponse> {
  return authFetch<RiskTrendResponse>("/api/v1/analytics/risk-trend");
}

export async function fetchGlobalDrivers(topN = 15): Promise<GlobalDriversResponse> {
  return authFetch<GlobalDriversResponse>(`/api/v1/analytics/global-drivers?top_n=${topN}`);
}

export async function fetchSegmentMatrix(): Promise<SegmentMatrix> {
  return authFetch<SegmentMatrix>("/api/v1/analytics/segment-matrix");
}

export async function searchCustomers(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  return authFetch<string[]>(`/api/v1/customers/search?q=${encodeURIComponent(query.trim())}`);
}

export async function fetchCustomerExplain(customerId: string): Promise<CustomerExplain> {
  return authFetch<CustomerExplain>(
    `/api/v1/customers/${encodeURIComponent(customerId)}/explain`,
  );
}

export async function simulateChurn(
  payload: Record<string, unknown>,
): Promise<number> {
  const data = await authFetch<{ simulated_probability: number }>(
    "/api/v1/predict/simulate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return data.simulated_probability;
}

export async function scoreCustomer(
  payload: Record<string, unknown>,
  options?: { threshold?: number; replaceExisting?: boolean },
): Promise<CustomerExplain> {
  const params = new URLSearchParams();
  if (options?.threshold !== undefined) {
    params.set("threshold", String(options.threshold));
  }
  if (options?.replaceExisting === false) {
    params.set("replace_existing", "false");
  }
  const query = params.toString();
  return authFetch<CustomerExplain>(
    `/api/v1/predict/score${query ? `?${query}` : ""}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}
