"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase-client";
import { useAuth } from "@/lib/auth/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { formatTemplate } from "@/lib/utils";

type AuthMode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { configured, accountStatus, refreshAccountStatus } = useAuth();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = getSupabaseBrowserClient();
  const isSignUp = mode === "sign-up";

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (!supabase) { setError(t.authNotConfigured); return; }
    setIsSubmitting(true);
    try {
      const response = isSignUp
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/login` } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (response.error) throw response.error;
      if (isSignUp && !response.data.session) {
        setMessage(t.authCheckEmail);
      } else {
        await refreshAccountStatus();
        router.push("/workspace");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : t.authFailed);
    } finally { setIsSubmitting(false); }
  };

  const handleGoogleLogin = async () => {
    setError(""); setMessage("");
    if (!supabase) { setError(t.authNotConfigured); return; }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google", options: { redirectTo: `${window.location.origin}/login` }
    });
    if (oauthError) setError(oauthError.message);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-base font-bold text-white shadow-sm">
            AI
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">{t.authTitle}</h1>
          <p className="mt-2 text-sm text-secondary">{t.authIntro}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-tertiary p-6 shadow-md">
          {!configured ? (
            <div className="mb-5 rounded-lg border border-score-mid-border bg-score-mid-bg px-4 py-3 text-sm leading-6 text-score-mid">
              {t.authNotConfigured}
            </div>
          ) : null}

          {accountStatus.isAuthenticated ? (
            <div className="mb-5 rounded-lg border border-score-high-border bg-score-high-bg px-4 py-3 text-sm leading-6 text-score-high">
              {formatTemplate(t.authSignedInAs, { email: accountStatus.user?.email ?? "", accountType: accountStatus.accountType })}
            </div>
          ) : null}

          {/* Sign in / Sign up toggle */}
          <div className="mb-5 grid grid-cols-2 rounded-lg border bg-hover p-1">
            <button type="button" onClick={() => setMode("sign-in")}
              className={mode === "sign-in" ? "rounded-md bg-tertiary px-3 py-2 text-sm font-semibold text-primary shadow-sm" : "rounded-md px-3 py-2 text-sm font-semibold text-secondary transition-colors hover:text-primary"}>
              {t.signIn}
            </button>
            <button type="button" onClick={() => setMode("sign-up")}
              className={mode === "sign-up" ? "rounded-md bg-tertiary px-3 py-2 text-sm font-semibold text-primary shadow-sm" : "rounded-md px-3 py-2 text-sm font-semibold text-secondary transition-colors hover:text-primary"}>
              {t.signUp}
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email">{t.email}</Label>
              <Input id="auth-email" type="email" value={email} required autoComplete="email"
                onChange={(event) => setEmail(event.target.value)} placeholder={t.emailPlaceholder} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">{t.password}</Label>
              <Input id="auth-password" type="password" value={password} minLength={6} required
                autoComplete={isSignUp ? "new-password" : "current-password"}
                onChange={(event) => setPassword(event.target.value)} placeholder={t.passwordPlaceholder} />
            </div>

            {message ? (
              <p className="rounded-lg border border-score-high-border bg-score-high-bg px-3 py-2 text-sm font-medium text-score-high">{message}</p>
            ) : null}
            {error ? (
              <p className="rounded-lg border border-score-low-border bg-score-low-bg px-3 py-2 text-sm font-medium text-score-low">{error}</p>
            ) : null}

            <Button type="submit" disabled={!configured || isSubmitting} className="w-full">
              {isSubmitting ? t.authSubmitting : isSignUp ? t.signUp : t.signIn}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-secondary">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="secondary" onClick={handleGoogleLogin} disabled={!configured} className="w-full">
            {t.continueWithGoogle}
          </Button>
        </div>
      </div>
    </div>
  );
}
