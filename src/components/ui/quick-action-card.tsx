"use client";

import Link from "next/link";
import { MouseEventHandler, ReactNode } from "react";
import { AppCard } from "@/components/ui/app-card";
import { AppSpotlightCard } from "@/components/ui/app-spotlight-card";
import { cn } from "@/lib/utils";

type QuickActionCardProps = {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  href?: string;
  icon?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  title: ReactNode;
};

const contentClasses =
  "group flex h-full w-full items-start gap-4 rounded-lg p-4 text-left transition-[background-color,transform] duration-300 ease-[var(--app-motion-standard)] focus-visible:outline-none focus-visible:shadow-app-focus";

export function QuickActionCard({
  action,
  children,
  className,
  description,
  href,
  icon,
  onClick,
  title
}: QuickActionCardProps) {
  const content = (
    <>
      {icon ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-app-accent-soft text-app-accent transition-colors duration-300 ease-[var(--app-motion-standard)] group-hover:bg-app-accent group-hover:text-white">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-app-text-primary">
          {title}
        </span>
        {description ? (
          <span className="mt-1 block text-[13px] leading-5 text-app-text-secondary">
            {description}
          </span>
        ) : null}
        {children ? <span className="mt-3 block">{children}</span> : null}
      </span>
      {action ? (
        <span className="shrink-0 text-[13px] font-medium text-app-accent">
          {action}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <AppCard className={className} variant="interactive">
        <AppSpotlightCard as={Link} className={contentClasses} href={href}>
          {content}
        </AppSpotlightCard>
      </AppCard>
    );
  }

  if (onClick) {
    return (
      <AppCard className={className} variant="interactive">
        <AppSpotlightCard
          as="button"
          className={contentClasses}
          onClick={onClick}
          type="button"
        >
          {content}
        </AppSpotlightCard>
      </AppCard>
    );
  }

  return (
    <AppCard className={cn("p-4", className)}>
      <div className="group flex items-start gap-4">{content}</div>
    </AppCard>
  );
}
