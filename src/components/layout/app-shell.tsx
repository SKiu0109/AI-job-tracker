"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { LanguageDropdown } from "@/components/layout/language-toggle";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/workspace", labelKey: "jobList" as const },
  { href: "/dashboard", labelKey: "dashboard" as const },
  { href: "/profile", labelKey: "profile" as const }
];

const DEMO_ENTRY_KEY = "from_demo_entry";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDemoBanner] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(DEMO_ENTRY_KEY) === "1"
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSidebarOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const isAddPage = pathname === "/add";
  const isLanding = pathname === "/";

  const sidebarContent = (
    <>
      <div className="px-5 pt-5 pb-2">
        <Link
          href="/"
          onClick={closeSidebar}
          className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white shadow-sm">
            AI
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold leading-tight text-primary">
              {t.appName}
            </span>
            <span className="mt-0.5 block truncate text-[12px] leading-tight text-secondary">
              {t.subtitle}
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeSidebar}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-accent-subtle text-accent"
                  : "text-secondary hover:bg-hover hover:text-primary"
              )}
            >
              {t[item.labelKey]}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-black/[0.06] px-4 py-4">
        <Link
          href="/add"
          onClick={closeSidebar}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-colors",
            isAddPage
              ? "bg-accent-strong text-white"
              : "bg-accent text-white shadow-sm hover:bg-accent-hover"
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M7 1v12M1 7h12" />
          </svg>
          {t.newAnalysis}
        </Link>
      </div>
    </>
  );

  if (isLanding) {
    return <div className="min-h-screen bg-bg-primary">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-black/[0.06] bg-white/72 backdrop-blur-2xl md:shadow-[2px_0_12px_rgba(0,0,0,0.04)]",
          "transition-transform duration-300 ease-out",
          !sidebarOpen && "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>

      <div className="flex flex-1 flex-col pl-0 md:pl-60">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-black/[0.06] bg-white/80 px-4 py-3 backdrop-blur-2xl md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen((value) => !value)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-hover hover:text-primary"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path
                d={
                  sidebarOpen
                    ? "M4.5 4.5l9 9M13.5 4.5l-9 9"
                    : "M2.25 3.75h13.5M2.25 9h13.5M2.25 14.25h13.5"
                }
              />
            </svg>
          </button>

          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
              AI
            </span>
            <span className="truncate text-[15px] font-semibold text-primary">
              {t.appName}
            </span>
          </Link>

          <LanguageDropdown />
        </div>

        <div className="pointer-events-none fixed top-0 right-0 z-30 hidden md:block">
          <div className="pointer-events-auto px-4 py-3">
            <LanguageDropdown />
          </div>
        </div>

        {showDemoBanner ? (
          <div className="border-b border-score-mid-border bg-score-mid-bg">
            <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
              <p className="text-[13px] font-semibold text-score-mid">
                {t.demoModeLabel}
              </p>
              <p className="text-[13px] leading-6 text-score-mid">
                {t.demoModeMessage}
              </p>
            </div>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
