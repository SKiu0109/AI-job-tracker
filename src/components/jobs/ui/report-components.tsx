import React, { SVGProps } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-provider";
import { AppCard } from "@/components/ui/app-card";
import { isUsefulValue } from "@/lib/jobs/job-detail-utils";

export type ReportIconName =
  | "briefcase"
  | "chat"
  | "resume"
  | "spark"
  | "target";

export function ReportIcon({
  className,
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: ReportIconName }) {
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

  if (name === "briefcase") {
    return (
      <svg {...baseProps}>
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
        <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
        <path d="M4 11.5h16" />
      </svg>
    );
  }

  if (name === "chat") {
    return (
      <svg {...baseProps}>
        <path d="M5 18.5V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H9l-4 3.5Z" />
        <path d="M8.5 8.5h7" />
        <path d="M8.5 11.5H13" />
      </svg>
    );
  }

  if (name === "resume") {
    return (
      <svg {...baseProps}>
        <path d="M7 3.5h7l3 3V20.5H7z" />
        <path d="M14 3.5V7h3" />
        <path d="M9.5 11h5" />
        <path d="M9.5 14h5" />
        <path d="M9.5 17h3" />
      </svg>
    );
  }

  if (name === "target") {
    return (
      <svg {...baseProps}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3" />
        <path d="M12 19v3" />
        <path d="M2 12h3" />
        <path d="M19 12h3" />
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

export function ReportSignalPill({
  label,
  tone,
  value
}: {
  label: string;
  tone: "success" | "warning";
  value: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3.5 py-3 shadow-app-card backdrop-blur-xl",
        tone === "success"
          ? "border-app-success-border bg-app-success-soft"
          : "border-app-warning-border bg-app-warning-soft"
      )}
    >
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wide",
          tone === "success" ? "text-app-success" : "text-app-warning"
        )}
      >
        {label}
      </p>
      <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-app-text-primary">
        {value}
      </p>
    </div>
  );
}

export function ReportListCard({
  icon,
  title,
  values
}: {
  icon?: ReportIconName;
  title: string;
  values: string[];
}) {
  const { t } = useLanguage();
  return (
    <AppCard className="p-5 sm:p-6">
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-surface text-app-accent shadow-app-card">
            <ReportIcon name={icon} />
          </span>
        ) : null}
        <h2 className="text-[16px] font-semibold text-app-text-primary">
          {title}
        </h2>
      </div>
      {values.length ? (
        <ul className="mt-4 space-y-2 text-[13px] leading-6 text-app-text-primary">
          {values.map((value, index) => (
            <li
              className="rounded-app border border-app-border-soft bg-app-surface px-3 py-2 shadow-app-card"
              key={`${value}-${index}`}
            >
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-app-text-secondary">{t.notSpecified}</p>
      )}
    </AppCard>
  );
}

export function TextCard({ title, value }: { title: string; value: string }) {
  const { t } = useLanguage();
  return (
    <AppCard className="p-5 sm:p-6">
      <h2 className="text-[16px] font-semibold text-app-text-primary">
        {title}
      </h2>
      <p className="mt-4 whitespace-pre-wrap text-[14px] leading-7 text-app-text-secondary">
        {isUsefulValue(value) ? value : t.notSpecified}
      </p>
    </AppCard>
  );
}

export function SoftChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-app-border-soft bg-app-surface px-3 py-1 text-[12px] font-medium text-app-text-secondary shadow-app-card backdrop-blur-xl">
      {children}
    </span>
  );
}

export function PanelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-app-border-soft pb-3 last:border-b-0 last:pb-0">
      <dt className="text-[12px] font-medium text-app-text-secondary">{label}</dt>
      <dd className="max-w-[180px] text-right text-[12px] font-semibold text-app-text-primary">
        {value}
      </dd>
    </div>
  );
}

export function PanelBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border-soft bg-app-surface px-3 py-2 shadow-app-card backdrop-blur-xl">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-app-text-secondary">
        {label}
      </dt>
      <dd className="mt-1 break-words text-[13px] font-medium text-app-text-primary">
        {value}
      </dd>
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-app-text-secondary">{label}</dt>
      <dd className="mt-0.5 text-app-text-primary">{value}</dd>
    </div>
  );
}

export function EmptyReportState({
  body,
  icon,
  title
}: {
  body: string;
  icon: ReportIconName;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-app-border-soft bg-app-surface px-5 py-8 text-center shadow-app-card backdrop-blur-xl">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-app-surface text-app-text-tertiary shadow-app-card">
        <ReportIcon name={icon} />
      </span>
      <h3 className="mt-4 text-[14px] font-semibold text-app-text-primary">
        {title}
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-[13px] leading-5 text-app-text-secondary">
        {body}
      </p>
    </div>
  );
}
