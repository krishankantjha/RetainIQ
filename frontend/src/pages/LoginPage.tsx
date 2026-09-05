import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Sparkles,
  UsersRound,
  SlidersHorizontal,
  User,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Moon,
  Sun,
  ArrowLeft,
} from "lucide-react";

import backgroundImg from "@/assets/background.png";
import backgroundWebp from "@/assets/background.webp";
import backgroundWebp2x from "@/assets/background@2x.webp";
import LogoWordmark from "@/components/LogoWordmark";
import AuthSelect from "@/components/AuthSelect";
import {
  getRememberedEmail,
  getSecurityQuestion,
  guestLogin,
  isValidEmail,
  login,
  normalizeEmail,
  register,
  resetPassword,
} from "@/lib/api";
import { LOGIN_STATS } from "@/lib/loginMarketing";
import { applyTheme, getStoredTheme, type ThemeMode } from "@/lib/theme";

const features = [
  {
    icon: LineChart,
    title: "Subscriber risk scoring",
    description: "Batch churn scores with calibrated probabilities after upload",
  },
  {
    icon: Sparkles,
    title: "SHAP explanations",
    description: "Top positive and negative drivers behind each account's score",
  },
  {
    icon: UsersRound,
    title: "Save plays",
    description: "Rule-based ideas from model drivers — not executed campaigns",
  },
  {
    icon: SlidersHorizontal,
    title: "Counterfactual scenarios",
    description: "What-if checks for alternate contract or service choices",
  },
];

const securityQuestions = [
  "What is your favorite color?",
  "What city were you born in?",
  "What is your favorite pet's name?",
  "What was your first car?",
];

type AuthMode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [forgotEmail, setForgotEmail] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState<string | null>(null);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupQuestion, setSignupQuestion] = useState(securityQuestions[0]);
  const [signupAnswer, setSignupAnswer] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  useEffect(() => {
    const saved = getRememberedEmail();
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    applyTheme(mode);
    setTheme(mode);
  };

  const onSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password, rememberMe);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onGuestLogin = async () => {
    setError(null);
    setSuccess(null);
    setGuestLoading(true);
    try {
      await guestLogin();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open demo dashboard");
    } finally {
      setGuestLoading(false);
    }
  };

  const onSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!signupFullName.trim() || !signupEmail.trim() || !signupPassword || !signupAnswer.trim()) {
      setError("All fields are required.");
      return;
    }
    if (signupFullName.trim().length < 2) {
      setError("Full name must be at least 2 characters.");
      return;
    }
    if (!isValidEmail(signupEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const normalized = normalizeEmail(signupEmail);
      await register(
        normalized,
        signupFullName.trim(),
        signupPassword,
        signupQuestion,
        signupAnswer.trim(),
      );
      await login(normalized, signupPassword, true);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const switchAuthMode = (next: "signin" | "signup") => {
    setMode(next);
    setError(null);
    setSuccess(null);
  };

  const onForgotContinue = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!forgotEmail.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (!isValidEmail(forgotEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (!securityQuestion) {
      setLoading(true);
      try {
        const question = await getSecurityQuestion(normalizeEmail(forgotEmail));
        setSecurityQuestion(question);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lookup failed");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!securityAnswer.trim() || !newPassword) {
      setError("Security answer and new password are required.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(normalizeEmail(forgotEmail), securityAnswer.trim(), newPassword);
      setSuccess("Password updated. Sign in with your new password.");
      setMode("signin");
      setEmail(forgotEmail.trim());
      setPassword("");
      setForgotEmail("");
      setSecurityQuestion(null);
      setSecurityAnswer("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  const openForgot = () => {
    setMode("forgot");
    setError(null);
    setSuccess(null);
    setForgotEmail(email);
    setSecurityQuestion(null);
    setSecurityAnswer("");
    setNewPassword("");
  };

  const backToSignIn = () => {
    setMode("signin");
    setError(null);
    setSecurityQuestion(null);
    setSecurityAnswer("");
    setNewPassword("");
  };

  const headerControls = (
    <>
      <span className="hidden h-9 items-center rounded-full border border-border/70 bg-surface-low/70 px-3 text-[11px] font-medium leading-none tracking-wide text-muted-foreground sm:inline-flex sm:text-xs">
        IBM Telco churn schema
      </span>
      <div
        className="flex h-9 items-center rounded-full border border-border/70 bg-surface-low/70 p-0.5"
        role="group"
        aria-label="Color theme"
      >
        <button
          type="button"
          onClick={() => setThemeMode("light")}
          aria-pressed={theme === "light"}
          aria-label="Light mode"
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            theme === "light"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sun className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setThemeMode("dark")}
          aria-pressed={theme === "dark"}
          aria-label="Dark mode"
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            theme === "dark"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Moon className="h-4 w-4" />
        </button>
      </div>
    </>
  );

  return (
    <main className="relative isolate flex min-h-screen w-full flex-col overflow-x-hidden bg-background">
      <picture className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 w-full">
        <source
          srcSet={`${backgroundWebp} 1x, ${backgroundWebp2x} 2x`}
          type="image/webp"
        />
        <img
          src={backgroundImg}
          alt=""
          aria-hidden="true"
          className="block w-full h-auto opacity-90 [mask-image:linear-gradient(to_top,rgba(0,0,0,1)_0%,rgba(0,0,0,0.92)_28%,rgba(0,0,0,0.55)_54%,transparent_82%)]"
        />
      </picture>
      <div className="login-wave-vignette" aria-hidden="true" />

      <div className="relative z-10 grid border-b border-border/50 lg:grid-cols-[53%_47%]">
        <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10 lg:justify-start lg:px-14 lg:py-6">
          <LogoWordmark size="header" />
          <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:hidden">
            {headerControls}
          </div>
        </header>

        <div className="hidden items-center justify-center px-6 py-5 sm:px-10 lg:flex lg:px-14 lg:py-6">
          <div className="flex w-full max-w-[520px] items-center justify-end gap-2 sm:gap-3">
            {headerControls}
          </div>
        </div>
      </div>

      <div className="relative z-10 grid flex-1 lg:grid-cols-[53%_47%]">
      <section className="flex flex-col justify-between overflow-x-hidden px-6 pb-16 pt-8 sm:px-10 sm:pb-16 lg:px-14 lg:pb-16">
        <div className="mt-8 max-w-xl lg:mt-6">
          <p className="text-[11px] font-medium tracking-[0.28em] text-muted-foreground">
            TELECOM SUBSCRIBER ANALYTICS
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            Score churn risk.
            <br />
            <span className="text-gradient-accent">Explain what drives it.</span>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-muted-foreground">
            An ML-backed stack for IBM Telco-format subscribers — upload CSV data,
            run calibrated scoring, and surface SHAP drivers, save plays, and what-if scenarios
            through the RetainIQ API.
          </p>

          <ul className="mt-10 space-y-5">
            {features.map(({ icon: Icon, title, description }) => (
              <li key={title} className="group flex items-center gap-4">
                <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl bg-tile-gradient text-primary-soft ring-1 ring-primary/30 transition-all duration-300 group-hover:ring-primary/60 group-hover:shadow-glow">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={1.9} />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 border-t border-border/70 pt-7 pb-6">
          <dl className="flex flex-wrap gap-y-4">
            {LOGIN_STATS.map(({ value, label }, index) => (
              <div
                key={label}
                className={`min-w-[9.5rem] flex-1 ${
                  index > 0 ? "border-border sm:border-l sm:pl-8" : ""
                }`}
              >
                <dt className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {value}
                </dt>
                <dd className="mt-1 text-sm text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="relative flex flex-col px-6 pb-10 pt-8 sm:px-10 lg:px-14">
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="login-auth-card relative z-10 w-full max-w-[520px] rounded-2xl p-8 shadow-card sm:p-10">
            {mode === "forgot" ? (
              <>
                <button
                  type="button"
                  onClick={backToSignIn}
                  className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </button>
                <div className="text-center">
                  <h2 className="text-[26px] font-semibold tracking-tight">Reset password</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Verify your security answer to set a new password
                  </p>
                </div>

                <form className="mt-7 space-y-5" onSubmit={onForgotContinue}>
                  {error && (
                    <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-red-300">
                      {error}
                    </p>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="forgot-email" className="text-[13px] font-medium">Email</label>
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        setSecurityQuestion(null);
                      }}
                      disabled={Boolean(securityQuestion)}
                      placeholder="Enter your email"
                      className="auth-input px-3 disabled:opacity-60"
                    />
                  </div>

                  {securityQuestion && (
                    <>
                      <p className="rounded-lg border border-border bg-surface-high/40 px-3 py-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Security question:</span>{" "}
                        {securityQuestion}
                      </p>
                      <div className="space-y-2">
                        <label htmlFor="security-answer" className="text-[13px] font-medium">
                          Security answer
                        </label>
                        <input
                          id="security-answer"
                          type="text"
                          value={securityAnswer}
                          onChange={(e) => setSecurityAnswer(e.target.value)}
                          placeholder="Your answer"
                          className="auth-input px-3"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="new-password" className="text-[13px] font-medium">
                          New password
                        </label>
                        <input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="auth-input px-3"
                        />
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-12 w-full items-center justify-center gap-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary/90 disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        Please wait <Loader2 className="h-4 w-4 animate-spin" />
                      </>
                    ) : securityQuestion ? (
                      "Reset password"
                    ) : (
                      "Continue"
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="text-center">
                  <h2 className="text-[26px] font-semibold tracking-tight">
                    {mode === "signin" ? "Welcome back" : "Create an account"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {mode === "signin"
                      ? "Sign in to view your subscriber portfolio"
                      : "Create an account when registration is enabled on this server"}
                  </p>
                </div>

                <div className="auth-tab-bar mt-7 flex h-12 w-full gap-1 p-1">
                  <button
                    type="button"
                    onClick={() => switchAuthMode("signin")}
                    className={`pill-tab ${mode === "signin" ? "pill-tab-active" : ""}`}
                    aria-current={mode === "signin" ? "page" : undefined}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => switchAuthMode("signup")}
                    className={`pill-tab ${mode === "signup" ? "pill-tab-active" : ""}`}
                    aria-current={mode === "signup" ? "page" : undefined}
                  >
                    Sign Up
                  </button>
                </div>

                {success && (
                  <p className="mt-5 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
                    {success}
                  </p>
                )}

                {mode === "signin" ? (
                  <form className="mt-5 space-y-5" onSubmit={onSignIn}>
                    {error && (
                      <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-red-300">
                        {error}
                      </p>
                    )}

                    <div className="space-y-2">
                      <label htmlFor="email" className="text-[13px] font-medium">Email</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-primary-soft/80" />
                        <input
                          id="email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          className="auth-input pl-11 pr-3"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="password" className="text-[13px] font-medium">Password</label>
                        <button
                          type="button"
                          onClick={openForgot}
                          className="text-[13px] font-medium text-primary-soft hover:text-foreground hover:underline underline-offset-4"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-primary-soft/80" />
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="auth-input px-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      Remember email on this device
                    </label>

                    <button
                      type="submit"
                      disabled={loading || guestLoading}
                      className="flex h-12 w-full items-center justify-center gap-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary/90 disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          Signing in <Loader2 className="h-4 w-4 animate-spin" />
                        </>
                      ) : (
                        <>
                          Sign In <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>

                    {import.meta.env.DEV && (
                      <button
                        type="button"
                        onClick={onGuestLogin}
                        disabled={loading || guestLoading}
                        className="flex h-12 w-full items-center justify-center gap-1 rounded-lg border border-primary/40 bg-primary/5 text-sm font-semibold text-primary-soft transition-all hover:border-primary/60 hover:bg-primary/10 disabled:opacity-60"
                      >
                        {guestLoading ? (
                          <>
                            Continuing as guest <Loader2 className="h-4 w-4 animate-spin" />
                          </>
                        ) : (
                          "Continue as guest"
                        )}
                      </button>
                    )}
                  </form>
                ) : (
                  <form className="mt-5 space-y-5" onSubmit={onSignUp}>
                    {error && (
                      <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-red-300">
                        {error}
                      </p>
                    )}

                    <div className="space-y-2">
                      <label htmlFor="signup-full-name" className="text-[13px] font-medium">Full name</label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-primary-soft/80" />
                        <input
                          id="signup-full-name"
                          type="text"
                          autoComplete="name"
                          value={signupFullName}
                          onChange={(e) => setSignupFullName(e.target.value)}
                          placeholder="Enter your full name"
                          className="auth-input pl-11 pr-3"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="signup-email" className="text-[13px] font-medium">Email</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-primary-soft/80" />
                        <input
                          id="signup-email"
                          type="email"
                          autoComplete="email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder="Enter your email"
                          className="auth-input pl-11 pr-3"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="signup-password" className="text-[13px] font-medium">Password</label>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-primary-soft/80" />
                        <input
                          id="signup-password"
                          type={showSignupPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="auth-input px-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword((v) => !v)}
                          aria-label={showSignupPassword ? "Hide password" : "Show password"}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
                        >
                          {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="signup-question" className="text-[13px] font-medium">
                        Security question
                      </label>
                      <AuthSelect
                        id="signup-question"
                        value={signupQuestion}
                        onChange={setSignupQuestion}
                        options={securityQuestions}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="signup-answer" className="text-[13px] font-medium">
                        Security answer
                      </label>
                      <input
                        id="signup-answer"
                        type="text"
                        value={signupAnswer}
                        onChange={(e) => setSignupAnswer(e.target.value)}
                        placeholder="Used for password recovery"
                        className="auth-input px-3"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex h-12 w-full items-center justify-center gap-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary/90 disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          Creating account <Loader2 className="h-4 w-4 animate-spin" />
                        </>
                      ) : (
                        <>
                          Create account <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>

                    <p className="text-center text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchAuthMode("signin")}
                        className="font-medium text-primary-soft hover:text-foreground hover:underline underline-offset-4"
                      >
                        Sign in
                      </button>
                    </p>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </section>
      </div>

      <footer className="relative z-10 border-t border-border/50 px-6 py-6 sm:px-10 lg:px-14">
        <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3 sm:items-center">
          <span>© 2026 RetainIQ. All rights reserved.</span>
          <span className="hidden sm:block" aria-hidden="true" />
          <span className="text-center italic sm:text-right">
            Better subscribers. Brighter networks.
          </span>
        </div>
      </footer>
    </main>
  );
}
