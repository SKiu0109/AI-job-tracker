"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase-client";
import { useAuth } from "@/lib/auth/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";

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
    setError("");
    setMessage("");

    if (!supabase) {
      setError(t.authNotConfigured);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = isSignUp
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/login`
            }
          })
        : await supabase.auth.signInWithPassword({ email, password });

      if (response.error) {
        throw response.error;
      }

      if (isSignUp && !response.data.session) {
        setMessage(t.authCheckEmail);
      } else {
        await refreshAccountStatus();
        router.push("/workspace");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : t.authFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setMessage("");

    if (!supabase) {
      setError(t.authNotConfigured);
      return;
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`
      }
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-panel border border-line bg-white p-5 shadow-panel sm:p-6">
        <p className="text-sm font-semibold text-accent">{t.authEyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">
          {t.authTitle}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">{t.authIntro}</p>
      </section>

      <section className="rounded-panel border border-line bg-white p-5 shadow-panel sm:p-6">
        {!configured ? (
          <div className="rounded-app border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            {t.authNotConfigured}
          </div>
        ) : null}

        {accountStatus.isAuthenticated ? (
          <div className="mb-5 rounded-app border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
            {formatTemplate(t.authSignedInAs, {
              email: accountStatus.user?.email ?? "",
              accountType: accountStatus.accountType
            })}
          </div>
        ) : null}

        <div className="mb-5 grid grid-cols-2 rounded-app border border-line bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => setMode("sign-in")}
            className={
              mode === "sign-in"
                ? "rounded-md bg-white px-3 py-2 text-sm font-semibold text-ink shadow-soft"
                : "rounded-md px-3 py-2 text-sm font-semibold text-muted"
            }
          >
            {t.signIn}
          </button>
          <button
            type="button"
            onClick={() => setMode("sign-up")}
            className={
              mode === "sign-up"
                ? "rounded-md bg-white px-3 py-2 text-sm font-semibold text-ink shadow-soft"
                : "rounded-md px-3 py-2 text-sm font-semibold text-muted"
            }
          >
            {t.signUp}
          </button>
        </div>

        <form onSubmit={handleEmailAuth} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="auth-email">{t.email}</Label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              required
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t.emailPlaceholder}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="auth-password">{t.password}</Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              minLength={6}
              required
              autoComplete={isSignUp ? "new-password" : "current-password"}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t.passwordPlaceholder}
            />
          </div>

          {message ? (
            <p className="rounded-app border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-app border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={!configured || isSubmitting}>
            {isSubmitting ? t.authSubmitting : isSignUp ? t.signUp : t.signIn}
          </Button>
        </form>

        <div className="my-5 h-px bg-line" />

        <Button
          type="button"
          variant="secondary"
          onClick={handleGoogleLogin}
          disabled={!configured}
          className="w-full"
        >
          {t.continueWithGoogle}
        </Button>
      </section>
    </div>
  );
}

function formatTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template
  );
}
