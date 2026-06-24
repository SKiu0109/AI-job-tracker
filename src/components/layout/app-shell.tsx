"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useAuth } from "@/lib/auth/auth-provider";
import { useGuestCredits } from "@/lib/credits/guest-credits-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { trackProductEvent } from "@/lib/product/analytics";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { accountStatus, signOut, user } = useAuth();
  const { status } = useGuestCredits();
  const accountLabel = accountStatus.isAdmin
    ? t.adminAccount
    : accountStatus.isAuthenticated
      ? t.freeAccount
      : t.guestAccount;
  const creditsLabel = accountStatus.credits.adminBypass
    ? t.adminCreditsLabel
    : status
    ? formatTemplate(t.creditsRemaining, {
        remaining: status.credits.remaining,
        limit: status.credits.limit
      })
    : "";

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-white/82 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:px-8">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-3 rounded-app focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-app border border-accent-strong bg-accent text-sm font-bold text-white shadow-soft transition duration-200 group-hover:bg-accent-strong">
              AI
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold tracking-normal text-ink sm:text-lg">
                {t.appName}
              </span>
              <span className="mt-0.5 block truncate text-xs font-medium text-muted sm:text-sm">
                {t.subtitle}
              </span>
            </span>
          </Link>

          <nav className="grid w-full grid-cols-4 rounded-app border border-line bg-surface-muted p-1 shadow-soft sm:flex sm:w-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
              <Link
                href="/"
                className={cn(
                  "relative rounded-md px-3 py-2 text-center text-sm font-semibold transition duration-200 sm:py-1.5 lg:rounded-none lg:px-4 lg:after:absolute lg:after:inset-x-4 lg:after:-bottom-3 lg:after:h-0.5 lg:after:rounded-full lg:after:transition",
                  pathname === "/"
                    ? "bg-white text-ink shadow-soft lg:bg-transparent lg:shadow-none lg:after:bg-accent"
                    : "text-muted hover:bg-white/70 hover:text-ink lg:hover:bg-transparent lg:after:bg-transparent"
                )}
              >
                {t.jobList}
              </Link>
              <Link
                href="/dashboard"
                className={cn(
                  "relative rounded-md px-3 py-2 text-center text-sm font-semibold transition duration-200 sm:py-1.5 lg:rounded-none lg:px-4 lg:after:absolute lg:after:inset-x-4 lg:after:-bottom-3 lg:after:h-0.5 lg:after:rounded-full lg:after:transition",
                  pathname === "/dashboard"
                    ? "bg-white text-ink shadow-soft lg:bg-transparent lg:shadow-none lg:after:bg-accent"
                    : "text-muted hover:bg-white/70 hover:text-ink lg:hover:bg-transparent lg:after:bg-transparent"
                )}
              >
                {t.dashboard}
              </Link>
              <Link
                href="/profile"
                className={cn(
                  "relative rounded-md px-3 py-2 text-center text-sm font-semibold transition duration-200 sm:py-1.5 lg:rounded-none lg:px-4 lg:after:absolute lg:after:inset-x-4 lg:after:-bottom-3 lg:after:h-0.5 lg:after:rounded-full lg:after:transition",
                  pathname === "/profile"
                    ? "bg-white text-ink shadow-soft lg:bg-transparent lg:shadow-none lg:after:bg-accent"
                    : "text-muted hover:bg-white/70 hover:text-ink lg:hover:bg-transparent lg:after:bg-transparent"
                )}
              >
                {t.profile}
              </Link>
              <Link
                href="/feedback"
                onClick={() => trackProductEvent("feedback_opened")}
                className={cn(
                  "relative rounded-md px-3 py-2 text-center text-sm font-semibold transition duration-200 sm:py-1.5 lg:rounded-none lg:px-4 lg:after:absolute lg:after:inset-x-4 lg:after:-bottom-3 lg:after:h-0.5 lg:after:rounded-full lg:after:transition",
                  pathname === "/feedback"
                    ? "bg-white text-ink shadow-soft lg:bg-transparent lg:shadow-none lg:after:bg-accent"
                    : "text-muted hover:bg-white/70 hover:text-ink lg:hover:bg-transparent lg:after:bg-transparent"
                )}
              >
                {t.feedback}
              </Link>
            </nav>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Link
                href="/add"
                className={cn(
                  "inline-flex min-h-9 items-center justify-center rounded-app border px-3.5 py-1.5 text-sm font-semibold shadow-soft transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  pathname === "/add"
                    ? "border-accent-strong bg-accent-strong text-white"
                    : "border-accent bg-accent text-white hover:border-accent-strong hover:bg-accent-strong"
                )}
              >
                {t.analyzeJd}
              </Link>
              <LanguageToggle />
              {creditsLabel ? (
                <span className="inline-flex min-h-9 items-center rounded-app border border-line bg-white px-3 text-xs font-semibold text-muted shadow-soft sm:text-sm">
                  {creditsLabel}
                </span>
              ) : null}
              <details className="group relative">
                <summary
                  className={cn(
                    "flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-app border px-3 py-1.5 text-xs font-semibold shadow-soft transition marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-sm",
                    pathname === "/login"
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-white text-ink hover:border-line-strong hover:bg-surface-muted"
                  )}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold uppercase text-white">
                    {getAccountInitial(accountLabel)}
                  </span>
                  <span>{accountLabel}</span>
                  <span
                    className="text-muted transition group-open:rotate-180"
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </summary>
                <div className="absolute right-0 top-11 z-40 w-64 rounded-panel border border-line bg-white p-3 shadow-panel">
                  <div className="border-b border-line pb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {t.accountMenu}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {accountLabel}
                    </p>
                    {user?.email ? (
                      <p className="mt-1 truncate text-xs text-muted">
                        {user.email}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {t.guestAccountHint}
                      </p>
                    )}
                  </div>
                  {creditsLabel ? (
                    <p className="mt-3 rounded-app border border-line bg-surface-muted px-3 py-2 text-xs font-semibold text-muted">
                      {creditsLabel}
                    </p>
                  ) : null}
                  <div className="mt-3">
                    {accountStatus.isAuthenticated ? (
                      <button
                        type="button"
                        onClick={() => void signOut()}
                        className="flex min-h-10 w-full items-center justify-center rounded-app border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:border-line-strong hover:bg-surface-muted"
                      >
                        {t.signOut}
                      </button>
                    ) : (
                      <Link
                        href="/login"
                        className="flex min-h-10 w-full items-center justify-center rounded-app border border-accent bg-accent px-3 text-sm font-semibold text-white transition hover:border-accent-strong hover:bg-accent-strong"
                      >
                        {t.signIn}
                      </Link>
                    )}
                  </div>
                </div>
              </details>
            </div>
        </div>
      </header>

      {status?.demoMode ? (
        <section className="border-b border-amber-200 bg-amber-50/88">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 text-sm sm:px-6 lg:px-8">
            <p className="font-semibold text-amber-900">{t.demoModeLabel}</p>
            <p className="leading-6 text-amber-900">{t.demoModeMessage}</p>
          </div>
        </section>
      ) : null}

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

function getAccountInitial(label: string) {
  return label.trim().slice(0, 1) || "A";
}

function formatTemplate(
  template: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template
  );
}
