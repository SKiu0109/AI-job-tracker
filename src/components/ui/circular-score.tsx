import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CircularScoreTone = "accent" | "danger" | "neutral" | "success" | "warning";

type CircularScoreProps = HTMLAttributes<HTMLDivElement> & {
  label?: ReactNode;
  max?: number;
  showMax?: boolean;
  size?: number;
  strokeWidth?: number;
  tone?: CircularScoreTone;
  value: number;
};

const strokeClasses: Record<CircularScoreTone, string> = {
  accent: "stroke-app-accent",
  danger: "stroke-score-low",
  neutral: "stroke-app-text-tertiary",
  success: "stroke-score-high",
  warning: "stroke-score-mid"
};

export function CircularScore({
  className,
  label,
  max = 100,
  showMax = false,
  size = 88,
  strokeWidth = 8,
  tone = "accent",
  value,
  ...props
}: CircularScoreProps) {
  const percent = getPercentage(value, max);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;
  const displayValue = Math.round(Math.min(max, Math.max(0, value)));

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center text-app-text-primary",
        className
      )}
      style={{ height: size, width: size }}
      {...props}
    >
      <svg
        aria-hidden="true"
        className="-rotate-90"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <circle
          className="stroke-app-border-soft"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className={cn(
            "transition-[stroke-dashoffset] duration-500 ease-out",
            strokeClasses[tone]
          )}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[22px] font-semibold leading-none tracking-tight tabular-nums">
          {displayValue}
        </span>
        {showMax ? (
          <span className="mt-0.5 text-[11px] font-medium leading-none text-app-text-tertiary">
            /{max}
          </span>
        ) : null}
        {label ? (
          <span className="mt-1 text-[10px] font-medium leading-none text-app-text-secondary">
            {label}
          </span>
        ) : null}
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
