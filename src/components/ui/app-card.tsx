import { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AppCardVariant = "default" | "elevated" | "interactive" | "muted";

type AppCardElement = "article" | "aside" | "div" | "section";

type AppCardProps = HTMLAttributes<HTMLElement> & {
  as?: AppCardElement;
  children?: ReactNode;
  variant?: AppCardVariant;
};

const variantClasses: Record<AppCardVariant, string> = {
  default: "border border-app-border-soft bg-app-surface shadow-app-card",
  elevated: "border border-app-border bg-app-surface-raised shadow-app-panel",
  interactive:
    "border border-app-border-soft bg-app-surface shadow-app-card transition-[background-color,border-color,box-shadow,transform] duration-300 ease-[var(--app-motion-standard)] hover:-translate-y-px hover:border-app-border hover:bg-app-surface-hover hover:shadow-app-card active:translate-y-0 active:scale-[0.997]",
  muted: "border border-app-border-soft bg-app-surface-muted shadow-app-card",
};

export function AppCard({
  as = "div",
  children,
  className,
  variant = "default",
  ...props
}: AppCardProps) {
  const Component = as as ElementType;

  return (
    <Component
      className={cn(
        "rounded-lg text-app-text-primary backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 ease-[var(--app-motion-standard)]",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
