import { HTMLAttributes, ReactNode } from "react";
import { AppCard } from "@/components/ui/app-card";
import { cn } from "@/lib/utils";

export type MetricCardTone = "accent" | "danger" | "neutral" | "success" | "warning";

type MetricCardProps = HTMLAttributes<HTMLDivElement> & {
  helper?: ReactNode;
  icon?: ReactNode;
  label: ReactNode;
  tone?: MetricCardTone;
  trend?: ReactNode;
  value: ReactNode;
};

const iconToneClasses: Record<MetricCardTone, string> = {
  accent: "bg-app-accent-soft text-app-accent",
  danger: "bg-score-low-bg text-score-low",
  neutral: "bg-app-surface-muted text-app-text-secondary",
  success: "bg-score-high-bg text-score-high",
  warning: "bg-score-mid-bg text-score-mid"
};

export function MetricCard({
  children,
  className,
  helper,
  icon,
  label,
  tone = "neutral",
  trend,
  value,
  ...props
}: MetricCardProps) {
  return (
    <AppCard className={cn("app-hover-lift p-5 hover:bg-app-surface-hover hover:shadow-app-card", className)} {...props}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-app-text-tertiary">
            {label}
          </p>
          <div className="mt-2 text-[28px] font-semibold text-app-text-primary">
            {value}
          </div>
        </div>
        {icon ? (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-transform duration-300 ease-[var(--app-motion-standard)]",
              iconToneClasses[tone]
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
      {helper || trend ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
          {trend ? (
            <span className={cn("font-medium", getTrendTone(tone))}>
              {trend}
            </span>
          ) : null}
          {helper ? (
            <span className="text-app-text-tertiary">{helper}</span>
          ) : null}
        </div>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </AppCard>
  );
}

function getTrendTone(tone: MetricCardTone) {
  if (tone === "success") return "text-score-high";
  if (tone === "warning") return "text-score-mid";
  if (tone === "danger") return "text-score-low";
  if (tone === "accent") return "text-app-accent";
  return "text-app-text-secondary";
}
