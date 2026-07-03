import { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BreadcrumbItem = {
  href?: string;
  label: string;
};

type PageHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  children?: ReactNode;
  eyebrow?: ReactNode;
  metadata?: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
};

type PageHeaderMetricTone = "neutral" | "success" | "warning" | "danger" | "info";

export function PageHeader({
  actions,
  breadcrumbs,
  children,
  className,
  eyebrow,
  metadata,
  subtitle,
  title,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "app-page-enter flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-[12px] text-app-text-tertiary">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                {index > 0 ? (
                  <svg
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                ) : null}
                {crumb.href ? (
                  <Link
                    className="font-medium transition-colors hover:text-app-text-secondary"
                    href={crumb.href}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-medium text-app-text-secondary">
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow ? (
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-app-accent">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="break-words text-[24px] font-semibold leading-tight tracking-tight text-app-text-primary sm:text-[28px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-[72ch] break-words text-[13px] leading-6 text-app-text-secondary sm:text-[14px]">
            {subtitle}
          </p>
        ) : null}
        {metadata ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-app-text-tertiary">
            {metadata}
          </div>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function PageHeaderMetric({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: PageHeaderMetricTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-3 text-[12px] font-semibold leading-none shadow-app-card backdrop-blur-xl",
        tone === "neutral" &&
          "border-app-border-soft bg-app-surface text-app-text-secondary",
        tone === "success" &&
          "border-app-success-border bg-app-success-soft text-app-success",
        tone === "warning" &&
          "border-app-warning-border bg-app-warning-soft text-app-warning",
        tone === "danger" &&
          "border-app-danger-border bg-app-danger-soft text-app-danger",
        tone === "info" &&
          "border-app-info-border bg-app-info-soft text-app-info"
      )}
    >
      {children}
    </span>
  );
}
