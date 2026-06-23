"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useGuestCredits } from "@/lib/credits/guest-credits-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { trackProductEvent } from "@/lib/product/analytics";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { status } = useGuestCredits();
  const creditsLabel = status
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
              <span className="hidden h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-muted text-xs font-semibold text-muted shadow-soft sm:inline-flex">
                AI
              </span>
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

function formatTemplate(
  template: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template
  );
}
