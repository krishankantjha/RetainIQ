import { KeyRound, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  applyDisplayName,
  changePassword,
  clearSession,
  fetchCurrentUser,
  getFullName,
  getUsername,
  saveUserProfile,
} from "@/lib/api";
import { displayNameFromProfile, userContactEmail } from "@/lib/format";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    const localName = getFullName();

    if (localName) {
      setDisplayName(localName);
      applyDisplayName(localName);
    }

    fetchCurrentUser()
      .then((profile) => {
        if (cancelled) return;
        setEmail(profile.username);
        const name = profile.full_name?.trim() || localName || "";
        setDisplayName(name);
        if (name) applyDisplayName(name);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load profile";
        if (message === "Session expired") {
          navigate("/", { replace: true });
          return;
        }
        if (!localName) {
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    setWarning(null);

    try {
      const result = await saveUserProfile(displayName);
      setDisplayName(result.fullName);
      if (result.synced) {
        setSuccess("Profile updated");
      } else {
        setWarning(result.warning ?? "Name saved on this device.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess("Password updated. Sign in again with your new password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.setTimeout(() => {
        clearSession();
        navigate("/", { replace: true });
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const username = getUsername() ?? email;
  const storedFullName = getFullName();
  const resolvedDisplayName = displayNameFromProfile(username, storedFullName ?? displayName);
  const isAdmin = email === "admin" || username === "admin";

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and account preferences.
        </p>
      </div>

      <form onSubmit={handleSave} className="dash-card space-y-5 p-5">
        <div>
          <h3 className="text-base font-semibold">Profile</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {resolvedDisplayName} ({userContactEmail(email)})
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-muted-foreground">Email</span>
          <input
            type="email"
            value={email}
            disabled
            className="mt-1 w-full cursor-not-allowed rounded-lg border border-border bg-surface-high/40 px-3 py-2 text-muted-foreground"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Email is your login identifier and cannot be changed here.
          </span>
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your full name"
            minLength={2}
            maxLength={100}
            required
            className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={saving || displayName.trim().length < 2}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>

        {success && (
          <p className="text-sm text-risk-low">{success}</p>
        )}
        {warning && (
          <p className="text-sm text-amber-400">{warning}</p>
        )}
        {error && !passwordSuccess && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </form>

      <form onSubmit={handlePasswordChange} className="dash-card space-y-5 p-5">
        <div>
          <h3 className="text-base font-semibold">Password</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "The built-in admin account password is managed via server configuration."
              : "Update your password while signed in."}
          </p>
        </div>

        {!isAdmin && (
          <>
            <label className="block text-sm">
              <span className="text-muted-foreground">Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
              />
            </label>

            <label className="block text-sm">
              <span className="text-muted-foreground">New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
              />
            </label>

            <label className="block text-sm">
              <span className="text-muted-foreground">Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
              />
            </label>

            <button
              type="submit"
              disabled={changingPassword || newPassword.length < 6}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-low disabled:opacity-60"
            >
              {changingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Change password
            </button>
          </>
        )}
      </form>

      <div className="dash-card p-5">
        <h3 className="text-base font-semibold">Appearance</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Theme (light / dark) is controlled from the sun/moon toggle in the header.
        </p>
      </div>

      {error && !success && !warning && !passwordSuccess && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {passwordSuccess && (
        <p className="rounded-lg border border-risk-low/40 bg-risk-low/10 px-4 py-3 text-sm text-risk-low">
          {passwordSuccess}
        </p>
      )}
    </div>
  );
}
