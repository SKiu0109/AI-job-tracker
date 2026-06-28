"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { LanguageDropdown } from "@/components/layout/language-toggle";
import { useAuth } from "@/lib/auth/auth-provider";
import { useGuestCredits } from "@/lib/credits/guest-credits-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { formatTemplate } from "@/lib/utils";
import { trackProductEvent } from "@/lib/product/analytics";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/workspace", labelKey: "jobList" as const },
  { href: "/dashboard", labelKey: "dashboard" as const },
  { href: "/profile", labelKey: "profile" as const },
  { href: "/redeem", labelKey: "redeemCode" as const },
  { href: "/feedback", labelKey: "feedback" as const }
];

const DEMO_ENTRY_KEY = "from_demo_entry";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { accountStatus, signOut, user } = useAuth();
  const { status } = useGuestCredits();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDemoBannerFlag] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(DEMO_ENTRY_KEY) === "1"
  );
  const showDemoBanner = showDemoBannerFlag && !accountStatus.isAuthenticated;

  // Clear demo banner flag when user signs in
  useEffect(() => {
    if (accountStatus.isAuthenticated && typeof window !== "undefined") {
      window.localStorage.removeItem(DEMO_ENTRY_KEY);
    }
  }, [accountStatus.isAuthenticated]);

  // Close sidebar on route change
  useEffect(() => {
    const timer = window.setTimeout(() => setSidebarOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

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

  const isAddPage = pathname === "/add";
  const isLoginPage = pathname === "/login";
  const isLanding = pathname === "/";

  // Sidebar content — shared between desktop and mobile drawer
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 pt-5 pb-2">
        <Link
          href="/"
          onClick={closeSidebar}
          className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white shadow-sm">
            P
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

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const isFeedback = item.href === "/feedback";

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (isFeedback) trackProductEvent("feedback_opened");
                closeSidebar();
              }}
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

      {/* CTA: Add Job */}
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

      {/* Account footer */}
      <div className="border-t border-black/[0.06] px-4 py-4">
        {/* Credits badge */}
        {creditsLabel ? (
          <div className="mb-3 rounded-lg bg-hover px-3 py-2 text-[12px] font-medium leading-tight text-secondary">
            {creditsLabel}
          </div>
        ) : null}

        {/* Account row */}
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 marker:hidden">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
              {getAccountInitial(accountLabel)}
            </span>
            <span className="flex-1 truncate text-[13px] font-medium text-primary">
              {accountLabel}
            </span>
            <svg
              className="h-3.5 w-3.5 text-secondary transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              viewBox="0 0 12 12"
            >
              <path d="M3 5l3 3 3-3" />
            </svg>
          </summary>

          {/* Dropdown */}
          <div className="mt-3 rounded-lg border border-black/[0.06] bg-bg-tertiary p-3 shadow-panel">
            {user?.email ? (
              <p className="truncate text-[12px] text-secondary">
                {user.email}
              </p>
            ) : (
              <p className="text-[12px] leading-5 text-secondary">
                {t.guestAccountHint}
              </p>
            )}

            {/* Auth action */}
            <div className="mt-3 space-y-2">
              {/* Admin shortcuts */}
              {accountStatus.isAdmin ? (
                <Link
                  href="/admin/codes"
                  onClick={closeSidebar}
                  className="block w-full rounded-lg bg-hover px-3 py-2 text-center text-[12px] font-medium text-accent transition-colors hover:bg-accent-subtle"
                >
                  {t.adminCodes}
                </Link>
              ) : null}

              {accountStatus.isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="w-full rounded-lg bg-hover px-3 py-2 text-[12px] font-medium text-secondary transition-colors hover:bg-hover hover:text-primary"
                >
                  {t.signOut}
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={closeSidebar}
                  className="block w-full rounded-lg bg-accent px-3 py-2 text-center text-[12px] font-medium text-white transition-colors hover:bg-accent-hover"
                >
                  {t.signIn}
                </Link>
              )}
            </div>
          </div>
        </details>
      </div>
    </>
  );

  // Landing and login pages render full-width without sidebar
  if (isLanding || isLoginPage) {
    return <div className="min-h-screen bg-bg-primary">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-bg-primary">
      {/* ─── Mobile overlay backdrop ─── */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* ─── Sidebar — fixed left, glass morphism ─── */}
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

      {/* ─── Main content area ─── */}
      <div className="flex flex-1 flex-col pl-0 md:pl-60">
        {/* ─── Mobile top bar (visible below md) ─── */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-black/[0.06] bg-white/80 px-4 py-3 backdrop-blur-2xl md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-hover hover:text-primary"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d={sidebarOpen
                ? "M4.5 4.5l9 9M13.5 4.5l-9 9"
                : "M2.25 3.75h13.5M2.25 9h13.5M2.25 14.25h13.5"
              } />
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

          {/* Language toggle — top-right on mobile bar */}
          <LanguageDropdown />
        </div>

        {/* ─── Desktop language toggle — fixed top-right pill ─── */}
        <div className="pointer-events-none fixed top-0 right-0 z-30 hidden md:block">
          <div className="pointer-events-auto px-4 py-3">
            <LanguageDropdown />
          </div>
        </div>

        {/* Demo banner — only when entered via "体验实例" */}
        {showDemoBanner && status?.demoMode ? (
          <div className="border-b border-score-mid-border bg-score-mid-bg">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3">
              <p className="text-[13px] font-semibold text-score-mid">
                {t.demoModeLabel}
              </p>
              <p className="text-[13px] leading-6 text-score-mid">
                {t.demoModeMessage}
              </p>
            </div>
          </div>
        ) : null}

        {/* Content */}
        <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function getAccountInitial(label: string) {
  return label.trim().slice(0, 1) || "A";
}
