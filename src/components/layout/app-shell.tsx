"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ButtonLink } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white/88 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/" className="min-w-0">
            <p className="text-xl font-semibold tracking-normal text-ink">
              {t.appName}
            </p>
            <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex rounded-md border border-line bg-paper p-1">
              <Link
                href="/"
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition",
                  pathname === "/"
                    ? "bg-white text-ink shadow-soft"
                    : "text-muted hover:text-ink"
                )}
              >
                {t.jobList}
              </Link>
              <Link
                href="/add"
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition",
                  pathname === "/add"
                    ? "bg-white text-ink shadow-soft"
                    : "text-muted hover:text-ink"
                )}
              >
                {t.addJob}
              </Link>
            </nav>
            <LanguageToggle />
            <ButtonLink href="/add">{t.addJob}</ButtonLink>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
