"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ReactNode,
  SVGProps,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import { LanguageDropdown } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/lib/auth/auth-provider";
import { useGuestCredits } from "@/lib/credits/guest-credits-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { trackProductEvent } from "@/lib/product/analytics";
import {
  clearCloudSyncIssue,
  getGuestWorkspaceSummary,
  importGuestWorkspaceToAccount,
  readCloudSyncIssue,
  subscribeToCloudSyncIssues,
  type CloudSyncIssue,
  type GuestWorkspaceSummary
} from "@/lib/storage/cloud-sync";
import { cn, formatTemplate } from "@/lib/utils";

type NavLabelKey =
  | "dashboard"
  | "feedback"
  | "jobList"
  | "profile"
  | "redeemCode";

type IconName =
  | "chart"
  | "chevronLeft"
  | "chevronRight"
  | "close"
  | "document"
  | "feedback"
  | "gift"
  | "home"
  | "key"
  | "menu"
  | "plus"
  | "spark"
  | "user";

type NavItem = {
  href: string;
  icon: IconName;
  label?: {
    en: string;
    zh: string;
  };
  labelKey?: NavLabelKey;
};

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: "/workspace", icon: "home", labelKey: "jobList" },
  { href: "/add", icon: "plus", label: { en: "Import Inbox", zh: "导入收件箱" } },
  { href: "/resume-hub", icon: "spark", label: { en: "Resume Hub", zh: "简历中心" } },
  { href: "/follow-up", icon: "document", label: { en: "Follow Up", zh: "待跟进" } }
];

const ACCOUNT_LINKS: NavItem[] = [
  { href: "/dashboard", icon: "chart", label: { en: "Insights", zh: "洞察" } },
  { href: "/redeem", icon: "gift", labelKey: "redeemCode" },
  { href: "/feedback", icon: "feedback", labelKey: "feedback" }
];

const DEMO_ENTRY_KEY = "from_demo_entry";
const SIDEBAR_COLLAPSED_KEY = "pathwise.sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { language, t } = useLanguage();
  const { accountStatus, session, signOut, user } = useAuth();
  const { status } = useGuestCredits();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
  );
  const [guestSummary, setGuestSummary] =
    useState<GuestWorkspaceSummary | null>(null);
  const [guestImportHidden, setGuestImportHidden] = useState(true);
  const [guestImporting, setGuestImporting] = useState(false);
  const [cloudSyncIssue, setCloudSyncIssue] =
    useState<CloudSyncIssue | null>(null);
  const trackedCloudIssueRef = useRef("");
  const [showDemoBannerFlag] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(DEMO_ENTRY_KEY) === "1"
  );
  const showDemoBanner = showDemoBannerFlag && !accountStatus.isAuthenticated;

  useEffect(() => {
    if (accountStatus.isAuthenticated && typeof window !== "undefined") {
      window.localStorage.removeItem(DEMO_ENTRY_KEY);
    }
  }, [accountStatus.isAuthenticated]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSidebarOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!accountStatus.isAuthenticated || !session?.user.id) {
        setGuestSummary(null);
        setGuestImportHidden(true);
        return;
      }

      const dismissed =
        window.localStorage.getItem(getGuestImportDismissedKey(session.user.id)) ===
        "1";
      const summary = getGuestWorkspaceSummary();
      setGuestSummary(summary.totalItems > 0 ? summary : null);
      setGuestImportHidden(dismissed || summary.totalItems === 0);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [accountStatus.isAuthenticated, session?.user.id]);

  useEffect(() => {
    const loadIssue = () => setCloudSyncIssue(readCloudSyncIssue());

    loadIssue();
    return subscribeToCloudSyncIssues(loadIssue);
  }, []);

  useEffect(() => {
    if (
      !cloudSyncIssue ||
      !accountStatus.isAuthenticated ||
      trackedCloudIssueRef.current === cloudSyncIssue.occurredAt
    ) {
      return;
    }

    trackedCloudIssueRef.current = cloudSyncIssue.occurredAt;
    trackProductEvent("cloud_sync_failed_visible", {
      message: cloudSyncIssue.message.slice(0, 180)
    });
  }, [accountStatus.isAuthenticated, cloudSyncIssue]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((collapsed) => {
      const nextValue = !collapsed;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          SIDEBAR_COLLAPSED_KEY,
          nextValue ? "1" : "0"
        );
      }

      return nextValue;
    });
  }, []);

  const handleDismissGuestImport = () => {
    if (session?.user.id) {
      window.localStorage.setItem(getGuestImportDismissedKey(session.user.id), "1");
    }
    setGuestImportHidden(true);
  };

  const handleImportGuestWorkspace = async () => {
    if (!session) {
      return;
    }

    setGuestImporting(true);

    try {
      const summary = await importGuestWorkspaceToAccount(session);
      window.localStorage.setItem(
        getGuestImportDismissedKey(session.user.id),
        "1"
      );
      setGuestSummary(null);
      setGuestImportHidden(true);
      trackProductEvent("guest_data_imported_to_account", {
        drafts: summary.draftCount,
        jobs: summary.jobCount,
        profileFields: summary.profileFieldCount
      });
    } finally {
      setGuestImporting(false);
    }
  };

  const accountLabel = accountStatus.isAdmin
    ? t.adminAccount
    : accountStatus.isAuthenticated
      ? t.freeAccount
      : t.guestAccount;

  const accountDisplay = user?.email ?? accountLabel;

  const creditsLabel = accountStatus.credits.adminBypass
    ? t.adminCreditsLabel
    : status
      ? formatTemplate(t.creditsRemaining, {
          remaining: status.credits.remaining,
          limit: status.credits.limit
        })
      : "";

  const collapseSidebarLabel =
    language === "zh" ? "收起侧边栏" : "Collapse sidebar";
  const expandSidebarLabel =
    language === "zh" ? "展开侧边栏" : "Expand sidebar";
  const sidebarToggleLabel = sidebarCollapsed
    ? expandSidebarLabel
    : collapseSidebarLabel;

  const isLoginPage = pathname === "/login";
  const isLanding = pathname === "/";

  const sidebarContent = (
    <>
      <div className={cn("px-4 pb-3 pt-4", sidebarCollapsed && "md:px-3")}>
        <div
          className={cn(
            "flex items-center justify-between gap-3",
            sidebarCollapsed && "md:flex-col md:justify-start md:gap-2"
          )}
        >
          <Link
            href="/"
            onClick={closeSidebar}
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-lg px-1 py-1 transition-opacity hover:opacity-85",
              sidebarCollapsed && "md:justify-center md:px-0"
            )}
            title={sidebarCollapsed ? t.appName : undefined}
          >
            <BrandMark />
            <span className={cn("min-w-0", sidebarCollapsed && "md:sr-only")}>
              <span className="block truncate text-[16px] font-semibold tracking-tight text-app-text-primary">
                {t.appName}
              </span>
              <span className="mt-0.5 block truncate text-[12px] leading-tight text-app-text-secondary">
                {t.subtitle}
              </span>
            </span>
          </Link>

          <button
            aria-label={sidebarToggleLabel}
            aria-pressed={sidebarCollapsed}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-text-tertiary transition-colors hover:bg-app-surface-hover hover:text-app-text-primary focus-visible:outline-none focus-visible:shadow-app-focus md:flex"
            onClick={toggleSidebarCollapsed}
            title={sidebarToggleLabel}
            type="button"
          >
            <ShellIcon name={sidebarCollapsed ? "chevronRight" : "chevronLeft"} />
          </button>

          <button
            aria-label="Close menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-app-text-tertiary transition-colors hover:bg-app-surface-hover hover:text-app-text-primary md:hidden"
            onClick={closeSidebar}
            type="button"
          >
            <ShellIcon name="close" />
          </button>
        </div>
      </div>

      <nav
        aria-label={t.appName}
        className={cn("flex-1 space-y-1 px-3 py-2", sidebarCollapsed && "md:px-2")}
      >
        {PRIMARY_NAV_ITEMS.map((item) => {
          const isActive = isNavActive(pathname, item.href);
          const isFeedback = item.href === "/feedback";
          const label = getNavLabel(item, t, language);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group group/nav relative flex items-center rounded-lg text-[13px] font-medium transition-[background-color,box-shadow,color,transform] duration-300 ease-[var(--app-motion-standard)] focus-visible:outline-none focus-visible:shadow-app-focus",
                sidebarCollapsed
                  ? "md:justify-center md:px-2 md:py-2.5"
                  : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-app-surface text-app-accent shadow-app-card"
                  : "text-app-text-secondary hover:bg-app-surface-hover hover:text-app-text-primary"
              )}
              href={item.href}
              key={item.href}
              onClick={() => {
                if (isFeedback) {
                  trackProductEvent("feedback_opened");
                }
                closeSidebar();
              }}
              title={sidebarCollapsed ? label : undefined}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition duration-200",
                  isActive
                    ? "bg-app-surface text-app-accent shadow-app-card"
                    : "text-app-text-tertiary group-hover:bg-app-surface-hover group-hover:text-app-accent"
                )}
              >
                <ShellIcon name={item.icon} />
              </span>
              <span className={cn("truncate", sidebarCollapsed && "md:sr-only")}>
                {label}
              </span>
              {sidebarCollapsed ? (
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-sm border border-app-border-soft bg-app-surface-solid px-2.5 py-1.5 text-[12px] font-semibold text-app-text-primary opacity-0 shadow-app-card transition-opacity duration-150 group-hover/nav:opacity-100 group-focus-visible/nav:opacity-100 md:block">
                  {label}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          "mt-auto border-t border-app-border-soft px-4 py-3",
          sidebarCollapsed && "md:px-3"
        )}
        title={sidebarCollapsed ? accountDisplay : undefined}
      >
        <div
          className={cn(
            "flex items-center gap-3",
            sidebarCollapsed && "md:justify-center"
          )}
        >
          <AccountAvatar label={accountDisplay} size="sm" />
          <div className={cn("min-w-0 flex-1", sidebarCollapsed && "md:sr-only")}>
            <p className="truncate text-[13px] font-semibold text-app-text-primary">
              {accountDisplay}
            </p>
            <p className="mt-0.5 text-[11px] text-app-text-tertiary">
              {accountLabel}
            </p>
          </div>
        </div>
        {creditsLabel ? (
          <p className={cn(
            "mt-2 rounded-full border border-app-border-soft bg-app-surface px-2.5 py-1 text-[11px] font-semibold text-app-accent shadow-app-card",
            sidebarCollapsed && "md:hidden"
          )}>
            {creditsLabel}
          </p>
        ) : null}
      </div>
    </>
  );

  if (isLanding || isLoginPage) {
    return <div className="min-h-screen bg-app-bg">{children}</div>;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-app-bg text-app-text-primary">
      <div
        aria-hidden="true"
        className="app-ambient-bg pointer-events-none fixed inset-0 -z-10"
      />
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-30 bg-slate-950/28 backdrop-blur-sm transition-opacity duration-300 ease-[var(--app-motion-standard)] md:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeSidebar}
      />

      <aside
        className={cn(
          "fixed inset-y-3 left-3 z-40 flex w-[280px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-app-border-soft bg-app-chrome shadow-app-floating backdrop-blur-2xl",
          "transition-[background-color,box-shadow,transform,width] duration-300 ease-[var(--app-motion-standard)]",
          !sidebarOpen && "-translate-x-[calc(100%+1rem)]",
          "md:inset-y-4 md:left-4 md:max-w-none md:translate-x-0",
          sidebarCollapsed
            ? "md:w-20 md:overflow-visible md:shadow-app-card"
            : "md:w-64 md:shadow-app-panel"
        )}
      >
        {sidebarContent}
      </aside>

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ease-[var(--app-motion-standard)]",
          sidebarCollapsed ? "md:pl-[112px]" : "md:pl-[288px]"
        )}
      >
        <header className="sticky top-0 z-20 hidden border-b border-app-border-soft bg-app-chrome px-6 py-3 shadow-app-card backdrop-blur-2xl md:block">
          <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4">
            <Link
              className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:text-app-text-primary focus-visible:outline-none focus-visible:shadow-app-focus"
              href="/workspace"
            >
              <BrandMark size="sm" />
              <span className="truncate text-[13px] font-semibold uppercase tracking-wide text-app-text-tertiary">
                {t.appName}
              </span>
            </Link>

            <div className="flex items-center gap-2">
              {creditsLabel ? (
                <div className="hidden items-center gap-2 rounded-full border border-app-border-soft bg-app-surface px-3 py-2 text-[12px] font-semibold text-app-text-secondary shadow-app-card backdrop-blur-xl lg:flex">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-app-surface text-app-accent shadow-app-card">
                    <ShellIcon name="spark" className="h-3.5 w-3.5" />
                  </span>
                  {creditsLabel}
                </div>
              ) : null}

              <LanguageDropdown />
              <ThemeToggle />

              <AccountMenu
                accountDisplay={accountDisplay}
                accountHint={user?.email ?? t.guestAccountHint}
                accountLabel={accountLabel}
                isAdmin={accountStatus.isAdmin}
                isAuthenticated={accountStatus.isAuthenticated}
                language={language}
                signOut={signOut}
                t={t}
                creditsLabel={creditsLabel}
              />
            </div>
          </div>
        </header>

        <div className="sticky top-0 z-20 flex min-w-0 items-center gap-3 border-b border-app-border-soft bg-app-chrome px-4 py-3 shadow-app-card backdrop-blur-2xl md:hidden">
          <button
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-app-border-soft bg-app-surface text-app-text-secondary shadow-app-card backdrop-blur-xl transition-colors hover:bg-app-surface-hover hover:text-app-text-primary"
            onClick={() => setSidebarOpen((open) => !open)}
            type="button"
          >
            <ShellIcon name={sidebarOpen ? "close" : "menu"} />
          </button>

          <Link
            className="flex min-w-0 flex-1 items-center gap-2.5"
            href="/"
          >
            <BrandMark size="sm" />
            <span className="truncate text-[15px] font-semibold tracking-tight text-app-text-primary">
              {t.appName}
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <LanguageDropdown />
            <ThemeToggle />

            <AccountMenu
              accountDisplay={accountDisplay}
              accountHint={user?.email ?? t.guestAccountHint}
              accountLabel={accountLabel}
              compact
              isAdmin={accountStatus.isAdmin}
              isAuthenticated={accountStatus.isAuthenticated}
              language={language}
              signOut={signOut}
              t={t}
              creditsLabel={creditsLabel}
            />
          </div>
        </div>

        {showDemoBanner && status?.demoMode ? (
          <div className="border-b border-app-border-soft bg-app-surface backdrop-blur-xl">
            <div className="mx-auto max-w-[1120px] px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-app-accent" />
                <div className="max-w-3xl min-w-0">
                  <p className="text-[13px] font-semibold text-app-text-primary">
                    {t.demoModeLabel}
                  </p>
                  <p className="text-[13px] leading-6 text-app-text-secondary">
                    {t.demoModeMessage}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {guestSummary && !guestImportHidden ? (
          <GuestImportBanner
            importing={guestImporting}
            language={language}
            onDismiss={handleDismissGuestImport}
            onImport={() => void handleImportGuestWorkspace()}
            summary={guestSummary}
          />
        ) : null}

        {cloudSyncIssue && accountStatus.isAuthenticated ? (
          <CloudSyncIssueBanner
            issue={cloudSyncIssue}
            language={language}
            onDismiss={clearCloudSyncIssue}
          />
        ) : null}

        <main
          className="app-page-enter mx-auto w-full min-w-0 max-w-[1120px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
          key={pathname}
        >
          {children}
        </main>

        <footer className="border-t border-app-border-soft bg-app-chrome backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-app-accent-soft text-app-accent shadow-app-card">
                <ShellIcon name="spark" className="h-3.5 w-3.5" />
              </span>
              <span className="text-[12px] text-app-text-tertiary">
                {t.appName} · {t.subtitle}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[12px] text-app-text-tertiary">
              <Link
                className="transition-colors hover:text-app-text-secondary"
                href="/feedback"
              >
                {getNavLabel({ href: "/feedback", icon: "feedback", labelKey: "feedback" }, t, language)}
              </Link>
              <span aria-hidden="true" className="hidden text-app-border-soft sm:inline">
                ·
              </span>
              <span className="hidden sm:inline">
                {language === "zh" ? "© 2025 Offerwise" : "© 2025 Offerwise"}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function isNavActive(pathname: string | null, href: string) {
  if (!pathname) {
    return false;
  }

  if (href === "/workspace") {
    return pathname === href || pathname.startsWith("/jobs");
  }

  return pathname === href;
}

function BrandMark({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-app-accent-soft text-app-accent shadow-app-card",
        size === "sm" ? "h-8 w-8" : "h-10 w-10"
      )}
    >
      <ShellIcon name="spark" className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </span>
  );
}

function AccountMenu({
  accountDisplay,
  accountHint,
  accountLabel,
  compact = false,
  creditsLabel,
  isAdmin,
  isAuthenticated,
  language,
  signOut,
  t
}: {
  accountDisplay: string;
  accountHint: string;
  accountLabel: string;
  compact?: boolean;
  creditsLabel?: string;
  isAdmin: boolean;
  isAuthenticated: boolean;
  language: "en" | "zh";
  signOut: () => Promise<void>;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.accountMenu}
        className={cn(
          "flex items-center gap-2 rounded-full border border-app-border-soft bg-app-surface py-1.5 pl-1.5 text-[12px] font-semibold text-app-text-secondary shadow-app-card transition-colors hover:bg-app-surface-hover hover:text-app-text-primary",
          compact ? "pr-1.5" : "pr-3"
        )}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <AccountAvatar label={accountDisplay} size="sm" />
        <span className={cn("max-w-[150px] truncate", compact ? "sr-only" : "hidden lg:block")}>
          {accountDisplay}
        </span>
        <svg
          aria-hidden="true"
          className={cn(
            "hidden h-3.5 w-3.5 shrink-0 text-app-text-tertiary transition-transform lg:block",
            open && "rotate-180",
            compact && "lg:hidden"
          )}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 12 12"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {open ? (
        <div
          className="app-sheet-enter absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 overflow-hidden rounded-xl border border-app-border-soft bg-app-surface p-3 text-left shadow-app-floating"
          role="menu"
        >
          <div className="border-b border-app-border-soft px-2 pb-3">
            <p className="truncate text-[13px] font-semibold text-app-text-primary">
              {accountLabel}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-app-text-tertiary">
              {accountHint}
            </p>
            {creditsLabel ? (
              <p className="mt-2 inline-flex rounded-full border border-app-border-soft bg-app-surface px-2.5 py-1 text-[11px] font-semibold text-app-accent shadow-app-card">
                {creditsLabel}
              </p>
            ) : null}
          </div>

          <div className="mt-2 space-y-1">
            {ACCOUNT_LINKS.map((item) => {
              const isFeedback = item.href === "/feedback";

              return (
                <Link
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-app-text-secondary transition-colors hover:bg-app-surface-hover hover:text-app-text-primary"
                  href={item.href}
                  key={item.href}
                  onClick={() => {
                    if (isFeedback) {
                      trackProductEvent("feedback_opened");
                    }
                    closeMenu();
                  }}
                  role="menuitem"
                >
                  <ShellIcon className="h-3.5 w-3.5" name={item.icon} />
                  {getNavLabel(item, t, language)}
                </Link>
              );
            })}

            {isAdmin ? (
              <>
                <Link
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-app-accent transition-colors hover:bg-app-accent-soft"
                  href="/admin/codes"
                  onClick={closeMenu}
                  role="menuitem"
                >
                  <ShellIcon className="h-3.5 w-3.5" name="key" />
                  {t.adminCodes}
                </Link>
                <Link
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-app-accent transition-colors hover:bg-app-accent-soft"
                  href="/admin/feedback"
                  onClick={closeMenu}
                  role="menuitem"
                >
                  <ShellIcon className="h-3.5 w-3.5" name="feedback" />
                  {language === "zh" ? "反馈后台" : "Feedback Admin"}
                </Link>
              </>
            ) : null}
          </div>

          <div className="mt-2 border-t border-app-border-soft pt-2">
            {isAuthenticated ? (
              <button
                className="w-full rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-app-text-secondary transition-colors hover:bg-app-surface-hover hover:text-app-text-primary"
                onClick={() => {
                  closeMenu();
                  void signOut();
                }}
                role="menuitem"
                type="button"
              >
                {t.signOut}
              </button>
            ) : (
              <Link
                className="block w-full rounded-lg bg-app-accent px-3 py-2 text-center text-[12px] font-semibold text-white transition-colors hover:bg-app-accent-hover"
                href="/login"
                onClick={closeMenu}
                role="menuitem"
              >
                {t.signIn}
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GuestImportBanner({
  importing,
  language,
  onDismiss,
  onImport,
  summary
}: {
  importing: boolean;
  language: "en" | "zh";
  onDismiss: () => void;
  onImport: () => void;
  summary: GuestWorkspaceSummary;
}) {
  const copy =
    language === "zh"
      ? {
          body: `发现访客工作区里有 ${summary.jobCount} 个职位、${summary.draftCount} 个草稿和 ${summary.profileFieldCount} 个画像字段。导入后会合并到当前账号并参与云同步。`,
          dismiss: "暂不导入",
          import: importing ? "导入中..." : "导入到账号",
          title: "把访客数据带进账号"
        }
      : {
          body: `We found ${summary.jobCount} saved roles, ${summary.draftCount} drafts, and ${summary.profileFieldCount} profile fields in guest mode. Import them into this account so they can sync.`,
          dismiss: "Not now",
          import: importing ? "Importing..." : "Import to account",
          title: "Bring guest work into your account"
        };

  return (
    <div className="border-b border-app-border-soft bg-app-surface backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="text-[13px] font-semibold text-app-text-primary">
            {copy.title}
          </p>
          <p className="mt-0.5 text-[13px] leading-6 text-app-text-secondary">
            {copy.body}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            className="rounded-app border border-app-border-soft bg-app-surface px-3 py-2 text-[12px] font-semibold text-app-text-secondary shadow-app-card transition-colors hover:bg-app-surface-hover hover:text-app-text-primary"
            onClick={onDismiss}
            type="button"
          >
            {copy.dismiss}
          </button>
          <button
            className="rounded-app border border-app-accent bg-app-accent px-3 py-2 text-[12px] font-semibold text-white shadow-app-card transition-colors hover:border-app-accent-hover hover:bg-app-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            disabled={importing}
            onClick={onImport}
            type="button"
          >
            {copy.import}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloudSyncIssueBanner({
  issue,
  language,
  onDismiss
}: {
  issue: CloudSyncIssue;
  language: "en" | "zh";
  onDismiss: () => void;
}) {
  const copy =
    language === "zh"
      ? {
          dismiss: "知道了",
          prefix: "云同步暂时没有完成。本地数据已保留，稍后会继续尝试。",
          title: "同步提醒"
        }
      : {
          dismiss: "Got it",
          prefix:
            "Cloud sync did not finish. Your local data is still saved and Offerwise will keep trying.",
          title: "Sync notice"
        };

  return (
    <div className="border-b border-amber-100/80 bg-amber-50/55 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="text-[13px] font-semibold text-amber-800">
            {copy.title}
          </p>
          <p className="mt-0.5 text-[13px] leading-6 text-amber-800/80">
            {copy.prefix}
            {issue.message ? ` ${issue.message}` : ""}
          </p>
        </div>
        <button
          className="shrink-0 rounded-app border border-amber-200/80 bg-app-surface px-3 py-2 text-[12px] font-semibold text-amber-800 shadow-app-card transition-colors hover:bg-app-surface-hover"
          onClick={onDismiss}
          type="button"
        >
          {copy.dismiss}
        </button>
      </div>
    </div>
  );
}

function getGuestImportDismissedKey(userId: string) {
  return `ai-bilingual-job-tracker.guest-import-dismissed.${encodeURIComponent(userId)}`;
}

function AccountAvatar({
  label,
  size = "md"
}: {
  label: string;
  size?: "md" | "sm";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-app-text-primary font-semibold uppercase text-white shadow-app-card",
        size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-[12px]"
      )}
    >
      {getAccountInitial(label)}
    </span>
  );
}

function ShellIcon({
  className,
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  const baseProps: SVGProps<SVGSVGElement> = {
    className: cn("h-4 w-4", className),
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    ...props
  };

  if (name === "home") {
    return (
      <svg {...baseProps}>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6.5 9.5V20h11V9.5" />
        <path d="M10 20v-5h4v5" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg {...baseProps}>
        <path d="M4 19h16" />
        <path d="M7 16v-4" />
        <path d="M12 16V7" />
        <path d="M17 16v-6" />
      </svg>
    );
  }

  if (name === "user") {
    return (
      <svg {...baseProps}>
        <path d="M20 20a8 8 0 0 0-16 0" />
        <circle cx="12" cy="8" r="4" />
      </svg>
    );
  }

  if (name === "document") {
    return (
      <svg {...baseProps}>
        <path d="M7 3.5h6l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20v-16.5Z" />
        <path d="M13 3.5V8h4" />
        <path d="M9.5 12h5" />
        <path d="M9.5 15h5" />
        <path d="M9.5 18h3" />
      </svg>
    );
  }

  if (name === "gift") {
    return (
      <svg {...baseProps}>
        <path d="M4 10h16v10H4z" />
        <path d="M12 10v10" />
        <path d="M4 14h16" />
        <path d="M9 10c-2.2 0-3.5-1.1-3.5-2.4C5.5 6.7 6.2 6 7.1 6 9 6 10 8 12 10" />
        <path d="M15 10c2.2 0 3.5-1.1 3.5-2.4 0-.9-.7-1.6-1.6-1.6C15 6 14 8 12 10" />
      </svg>
    );
  }

  if (name === "feedback") {
    return (
      <svg {...baseProps}>
        <path d="M5 18.5V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H9l-4 3.5Z" />
        <path d="M8.5 8.5h7" />
        <path d="M8.5 11.5H13" />
      </svg>
    );
  }

  if (name === "plus") {
    return (
      <svg {...baseProps}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }

  if (name === "menu") {
    return (
      <svg {...baseProps}>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </svg>
    );
  }

  if (name === "chevronLeft") {
    return (
      <svg {...baseProps}>
        <path d="m15 18-6-6 6-6" />
      </svg>
    );
  }

  if (name === "chevronRight") {
    return (
      <svg {...baseProps}>
        <path d="m9 18 6-6-6-6" />
      </svg>
    );
  }

  if (name === "close") {
    return (
      <svg {...baseProps}>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </svg>
    );
  }

  if (name === "key") {
    return (
      <svg {...baseProps}>
        <circle cx="8" cy="15" r="3" />
        <path d="M10.2 12.8 20 3" />
        <path d="m15 8 2 2" />
        <path d="m17 6 2 2" />
      </svg>
    );
  }

  return (
    <svg {...baseProps}>
      <path d="M12 3.5 13.7 9 19 10.7 13.7 12.4 12 18l-1.7-5.6L5 10.7 10.3 9 12 3.5Z" />
      <path d="M18.5 15.5 19 17l1.5.5L19 18l-.5 1.5L18 18l-1.5-.5L18 17l.5-1.5Z" />
    </svg>
  );
}

function getNavLabel(
  item: NavItem,
  t: ReturnType<typeof useLanguage>["t"],
  language: "en" | "zh"
) {
  if (item.label) {
    return item.label[language];
  }

  return t[item.labelKey ?? "jobList"];
}

function getAccountInitial(label: string) {
  return label.trim().slice(0, 1) || "A";
}
