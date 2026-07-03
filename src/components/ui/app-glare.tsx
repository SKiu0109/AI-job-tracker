"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AppGlareProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
};

export function AppGlare({
  children,
  className,
  contentClassName,
  disabled = false
}: AppGlareProps) {
  return (
    <span
      className={cn(
        "group/app-glare relative inline-block overflow-hidden rounded-app",
        className
      )}
    >
      {!disabled ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[2] -translate-x-[140%] bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.64)_48%,transparent_62%)] opacity-0 transition-[transform,opacity] duration-700 ease-[var(--app-motion-standard)] group-hover/app-glare:translate-x-[140%] group-hover/app-glare:opacity-100"
        />
      ) : null}
      <span className={cn("relative z-[1] block", contentClassName)}>
        {children}
      </span>
    </span>
  );
}
