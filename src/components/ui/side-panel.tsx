import { HTMLAttributes, ReactNode } from "react";
import { AppCard } from "@/components/ui/app-card";
import { cn } from "@/lib/utils";

type SidePanelProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  actions?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  sticky?: boolean;
  title?: ReactNode;
};

export function SidePanel({
  actions,
  children,
  className,
  description,
  sticky = false,
  title,
  ...props
}: SidePanelProps) {
  return (
    <AppCard
      as="aside"
      className={cn(
        "app-sheet-enter p-5",
        sticky && "lg:sticky lg:top-24 lg:self-start",
        className
      )}
      {...props}
    >
      {title || description || actions ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-[15px] font-semibold text-app-text-primary">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-[13px] leading-5 text-app-text-secondary">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </AppCard>
  );
}
