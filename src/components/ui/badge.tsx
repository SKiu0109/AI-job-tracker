import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-app border bg-tertiary px-2.5 py-1 text-xs font-semibold text-secondary",
        className
      )}
    >
      {children}
    </span>
  );
}
