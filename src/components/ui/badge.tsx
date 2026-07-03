import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "pill" | "success" | "warning" | "danger" | "info" | "neutral";

type BadgeProps = {
  children: ReactNode;
  className?: string;
  variant?: BadgeVariant;
  /** Show a colored dot before the text (Linear-style status indicator) */
  dot?: boolean;
};

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "border-app-border-soft bg-app-surface text-app-text-secondary",
  pill:
    "border-app-border bg-app-surface-hover text-app-text-secondary",
  success:
    "border-score-high-border bg-score-high-bg text-score-high",
  warning:
    "border-score-mid-border bg-score-mid-bg text-score-mid",
  danger:
    "border-score-low-border bg-score-low-bg text-score-low",
  info:
    "border-blue-200 bg-blue-50 text-blue-700",
  neutral:
    "border-app-border-soft bg-app-surface-muted text-app-text-tertiary",
};

export function Badge({
  children,
  className,
  variant = "default",
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5",
        variantClasses[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            variant === "success" && "bg-score-high",
            variant === "warning" && "bg-score-mid",
            variant === "danger" && "bg-score-low",
            variant === "info" && "bg-blue-600",
            variant === "neutral" && "bg-app-text-tertiary",
            (variant === "default" || variant === "pill") && "bg-app-text-secondary"
          )}
        />
      )}
      {children}
    </span>
  );
}
