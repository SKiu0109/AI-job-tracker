import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ProgressBarTone = "accent" | "danger" | "neutral" | "success" | "warning";
export type ProgressBarSize = "sm" | "md" | "lg";

type ProgressBarProps = HTMLAttributes<HTMLDivElement> & {
  label?: ReactNode;
  max?: number;
  showValue?: boolean;
  size?: ProgressBarSize;
  tone?: ProgressBarTone;
  value: number;
};

const fillClasses: Record<ProgressBarTone, string> = {
  accent: "bg-app-accent",
  danger: "bg-app-danger",
  neutral: "bg-app-text-tertiary",
  success: "bg-app-success",
  warning: "bg-app-warning"
};

const sizeClasses: Record<ProgressBarSize, string> = {
  sm: "h-1",
  md: "h-1.5",
  lg: "h-2"
};

export function ProgressBar({
  className,
  label,
  max = 100,
  showValue = false,
  size = "md",
  tone = "accent",
  value,
  ...props
}: ProgressBarProps) {
  const percent = getPercentage(value, max);
  const roundedPercent = Math.round(percent);

  return (
    <div className={cn("w-full", className)} {...props}>
      {label || showValue ? (
        <div className="mb-2 flex items-center justify-between gap-3 text-[12px]">
          {label ? (
            <span className="font-medium text-app-text-primary">{label}</span>
          ) : (
            <span aria-hidden="true" />
          )}
          {showValue ? (
            <span className="tabular-nums text-app-text-secondary">
              {roundedPercent}%
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={roundedPercent}
        className={cn(
          "overflow-hidden rounded-full bg-app-border-soft",
          sizeClasses[size]
        )}
        role="progressbar"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            fillClasses[tone]
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function getPercentage(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (value / max) * 100));
}
