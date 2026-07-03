"use client";

import { cn } from "@/lib/utils";
import { getInsightToneClass } from "@/lib/jobs/job-detail-utils";

function SectionHeading({
  subtitle,
  title
}: {
  subtitle?: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="text-[16px] font-semibold text-app-text-primary">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-[13px] leading-5 text-app-text-secondary">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export type InsightTone = "danger" | "neutral" | "success" | "warning";

function InsightStat({
  label,
  tone = "neutral",
  value
}: {
  label: string;
  tone?: InsightTone;
  value: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border px-3 py-2 shadow-app-card",
        getInsightToneClass(tone)
      )}
    >
      <p className="text-[11px] font-semibold leading-4 text-app-text-tertiary">
        {label}
      </p>
      <p className="mt-1 line-clamp-2 break-words text-[14px] font-semibold leading-5 text-app-text-primary">
        {value}
      </p>
    </div>
  );
}

function SignalBrief({
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
        "rounded-lg border px-3 py-3 shadow-app-card",
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
      <p className="mt-1 text-[13px] leading-5 text-app-text-primary">
        {value}
      </p>
    </div>
  );
}

export { InsightStat, SectionHeading, SignalBrief };
