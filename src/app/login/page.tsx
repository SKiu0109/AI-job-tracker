"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/ui/app-card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { getAuthRedirectUrl } from "@/lib/auth/auth-redirect-url";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase-client";
import { useAuth } from "@/lib/auth/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { formatTemplate } from "@/lib/utils";

type AuthMode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { configured, accountStatus, refreshAccountStatus } = useAuth();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = getSupabaseBrowserClient();
  const isSignUp = mode === "sign-up";
  const valueProps =
    language === "zh"
      ? [
          {
            body: "职位、草稿和候选人画像会保存到账号空间，换设备也能继续。",
            title: "云同步工作区"
          },
          {
            body: "登录后使用账号额度，兑换码和月度额度都会保留在账号里。",
            title: "保留分析额度"
          },
          {
            body: "先用访客模式试用也没关系，登录后可把访客数据导入账号。",
            title: "承接访客数据"
          }
        ]
      : [
          {
            body: "Roles, drafts, and your candidate profile stay with your account across devices.",
            title: "Cloud-sync workspace"
          },
          {
            body: "Signed-in credits, redeemed codes, and monthly limits stay attached to your account.",
            title: "Keep analysis credits"
          },
          {
            body: "Tried guest mode first? You can import guest work after signing in.",
            title: "Bring guest data"
          }
        ];

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (!supabase) { setError(t.authNotConfigured); return; }
    setIsSubmitting(true);
    try {
      const redirectTo = getAuthRedirectUrl("/login");
      const response = isSignUp
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (response.error) throw response.error;
      if (isSignUp && !response.data.session) {
        setMessage(t.authCheckEmail);
      } else {
        await refreshAccountStatus();
        router.push("/workspace");
      }
    } catch (authError) {
      setError(
        getAuthErrorMessage(
          authError,
          language,
          isSignUp ? "sign-up" : "sign-in",
          t.authFailed
        )
      );
    } finally { setIsSubmitting(false); }
  };

  const handleGoogleLogin = async () => {
    setError(""); setMessage("");
    if (!supabase) { setError(t.authNotConfigured); return; }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google", options: { redirectTo: getAuthRedirectUrl("/login") }
    });
    if (oauthError) {
      setError(getAuthErrorMessage(oauthError, language, "oauth", t.authFailed));
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 pb-8">
      <div className="app-stagger w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-app-accent text-base font-bold text-white shadow-app-panel">
            AI
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-app-text-primary">{t.authTitle}</h1>
          <p className="mt-2 text-sm leading-6 text-app-text-secondary">{t.authIntro}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {valueProps.map((item) => (
            <div
              className="rounded-lg border border-app-border-soft bg-app-surface p-4 text-left shadow-app-card backdrop-blur-xl"
              key={item.title}
            >
              <p className="text-[13px] font-semibold text-app-text-primary">
                {item.title}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-app-text-secondary">
                {item.body}
              </p>
            </div>
          ))}
        </div>

        {/* Card */}
        <AppCard className="mx-auto w-full max-w-md p-5 sm:p-6" variant="elevated">
          {!configured ? (
            <div className="app-sheet-enter mb-5 rounded-lg border border-app-border-soft bg-app-surface px-4 py-3 text-sm font-medium leading-6 text-score-mid shadow-app-card backdrop-blur-xl">
              {t.authNotConfigured}
            </div>
          ) : null}

          {accountStatus.isAuthenticated ? (
            <div className="app-sheet-enter mb-5 rounded-lg border border-app-border-soft bg-app-surface px-4 py-3 text-sm font-medium leading-6 text-score-high shadow-app-card backdrop-blur-xl">
              {formatTemplate(t.authSignedInAs, { email: accountStatus.user?.email ?? "", accountType: accountStatus.accountType })}
            </div>
          ) : null}

          {/* Sign in / Sign up toggle */}
          <div className="mb-5 grid grid-cols-2 rounded-lg border border-app-border-soft bg-app-surface p-1 shadow-app-card backdrop-blur-xl">
            <button type="button" onClick={() => setMode("sign-in")}
              className={mode === "sign-in" ? "rounded-app bg-app-surface px-3 py-2 text-sm font-semibold text-app-accent shadow-app-card transition duration-300 ease-[var(--app-motion-standard)] active:scale-[0.98]" : "rounded-app px-3 py-2 text-sm font-semibold text-app-text-secondary transition duration-300 ease-[var(--app-motion-standard)] hover:bg-app-surface-hover hover:text-app-text-primary active:scale-[0.98]"}>
              {t.signIn}
            </button>
            <button type="button" onClick={() => setMode("sign-up")}
              className={mode === "sign-up" ? "rounded-app bg-app-surface px-3 py-2 text-sm font-semibold text-app-accent shadow-app-card transition duration-300 ease-[var(--app-motion-standard)] active:scale-[0.98]" : "rounded-app px-3 py-2 text-sm font-semibold text-app-text-secondary transition duration-300 ease-[var(--app-motion-standard)] hover:bg-app-surface-hover hover:text-app-text-primary active:scale-[0.98]"}>
              {t.signUp}
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="app-stagger space-y-4">
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
              <p className="app-sheet-enter rounded-lg border border-app-border-soft bg-app-surface px-3 py-2 text-sm font-medium text-score-high shadow-app-card backdrop-blur-xl">{message}</p>
            ) : null}
            {error ? (
              <p className="app-sheet-enter rounded-lg border border-red-100/80 bg-red-50/45 px-3 py-2 text-sm font-medium text-score-low shadow-app-card">{error}</p>
            ) : null}

            <Button type="submit" disabled={!configured || isSubmitting} className="w-full">
              {isSubmitting ? t.authSubmitting : isSignUp ? t.signUp : t.signIn}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-app-surface" />
            <span className="text-xs text-app-text-tertiary">{language === "zh" ? "或" : "or"}</span>
            <span className="h-px flex-1 bg-app-surface" />
          </div>

          <Button type="button" variant="secondary" onClick={handleGoogleLogin} disabled={!configured} className="w-full">
            {t.continueWithGoogle}
          </Button>
        </AppCard>
      </div>
    </div>
  );
}

function getAuthErrorMessage(
  error: unknown,
  language: "en" | "zh",
  mode: AuthMode | "oauth",
  fallback: string
) {
  const rawMessage = error instanceof Error ? error.message : "";
  const message = rawMessage.toLowerCase();
  const status = typeof error === "object" && error && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 0;

  if (status === 429 || message.includes("rate limit")) {
    return language === "zh"
      ? "注册邮件发送过于频繁，请稍后再试，或使用 Google 继续。"
      : "Confirmation emails are being sent too frequently. Try again later, or continue with Google.";
  }

  if (message.includes("provider is not enabled")) {
    return language === "zh"
      ? "Google 登录暂未开启，请先使用邮箱登录或注册。"
      : "Google sign-in is not enabled yet. Use email sign-in for now.";
  }

  if (message.includes("invalid login credentials")) {
    return language === "zh"
      ? "邮箱或密码不正确，请检查后重试。"
      : "The email or password is incorrect. Please check and try again.";
  }

  if (mode === "sign-up" && message.includes("already registered")) {
    return language === "zh"
      ? "这个邮箱可能已经注册过，请切换到登录。"
      : "This email may already be registered. Switch to sign in.";
  }

  return rawMessage || fallback;
}
