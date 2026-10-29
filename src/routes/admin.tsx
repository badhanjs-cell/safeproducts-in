import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ShieldCheck, Loader2, KeyRound, Mail, ArrowLeft, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal — SafeProducts" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLayout,
});

function initialRecoveryMode() {
  if (typeof window === "undefined") return false;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return search.get("recovery") === "1" || hash.get("type") === "recovery";
}

function AdminLayout() {
  const auth = useAdminAuth();
  const [recoveryMode, setRecoveryMode] = useState(initialRecoveryMode);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (recoveryMode) {
    return (
      <ResetPasswordScreen
        onComplete={() => {
          setRecoveryMode(false);
          if (typeof window !== "undefined") {
            window.history.replaceState({}, "", "/admin");
          }
        }}
      />
    );
  }

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
      </div>
    );
  }

  if (!auth.userId || !auth.isAdmin) {
    return <LoginScreen denied={!!auth.userId && !auth.isAdmin} />;
  }

  return (
    <AdminShell email={auth.email}>
      <Outlet />
    </AdminShell>
  );
}

function PasswordInput({
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  minLength,
}: {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
}) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-divider bg-background px-3 py-2 pr-10 text-sm text-heading focus:border-brand-blue focus:outline-none"
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-body transition hover:text-heading focus:outline-none"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function LoginScreen({ denied }: { denied: boolean }) {
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(denied ? "This account does not have admin access." : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Enter the email address associated with the admin account.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    const redirectTo = `${window.location.origin}/admin?recovery=1`;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNotice("If that email belongs to an account, a password-reset link has been sent. Open the link on this device to set a new password.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-divider bg-card p-6 shadow-lg">
        <div className="mb-5 flex items-center gap-2">
          {mode === "signin" ? <ShieldCheck className="h-5 w-5 text-brand-blue" /> : <Mail className="h-5 w-5 text-brand-blue" />}
          <h1 className="text-lg font-bold text-heading">{mode === "signin" ? "Admin Sign In" : "Reset Admin Password"}</h1>
        </div>

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-body">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-heading focus:border-brand-blue focus:outline-none"
                placeholder="Admin email address"
                autoComplete="email"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label className="block text-xs font-medium text-body">Password</label>
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(null); setNotice(null); }}
                  className="text-xs font-semibold text-brand-blue hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <PasswordInput
                value={password}
                onChange={setPassword}
                visible={passwordVisible}
                onToggle={() => setPasswordVisible((v) => !v)}
                autoComplete="current-password"
              />
            </div>
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
            {notice && <p className="rounded-md border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-300">{notice}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand-blue py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgot} className="space-y-3">
            <p className="text-xs leading-relaxed text-body">
              Enter the email address used for the administrator account. Supabase will send a one-time recovery link.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-body">Admin email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-heading focus:border-brand-blue focus:outline-none"
                placeholder="Admin email address"
                autoComplete="email"
              />
            </div>
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
            {notice && <p className="rounded-md border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-300">{notice}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand-blue py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); setNotice(null); }}
              className="flex w-full items-center justify-center gap-1 text-xs font-semibold text-body hover:text-heading"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </button>
          </form>
        )}

        <p className="mt-4 text-[11px] text-body">Authorised personnel only. Resetting a password does not grant admin access; the existing admin role is still required.</p>
      </div>
    </div>
  );
}

function ResetPasswordScreen({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters for the new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-divider bg-card p-6 shadow-lg">
        <div className="mb-5 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-brand-blue" />
          <h1 className="text-lg font-bold text-heading">Set New Password</h1>
        </div>

        {success ? (
          <div className="space-y-4">
            <p className="rounded-md border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-300">
              Password updated successfully. Your existing administrator role has been preserved.
            </p>
            <button
              type="button"
              onClick={onComplete}
              className="w-full rounded-md bg-brand-blue py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              Continue to Admin Portal
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-3">
            <p className="text-xs leading-relaxed text-body">Choose a new password for this authenticated recovery session.</p>
            <div>
              <label className="mb-1 block text-xs font-medium text-body">New password</label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                visible={passwordVisible}
                onToggle={() => setPasswordVisible((v) => !v)}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-body">Confirm new password</label>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                visible={confirmPasswordVisible}
                onToggle={() => setConfirmPasswordVisible((v) => !v)}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand-blue py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
