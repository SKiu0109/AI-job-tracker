"use client";

import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useState
} from "react";
import { cn } from "@/lib/utils";

type SpotlightPosition = {
  x: number;
  y: number;
};

type AppSpotlightCardOwnProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  spotlightClassName?: string;
  spotlightColor?: string;
};

type AppSpotlightCardProps<T extends ElementType> =
  AppSpotlightCardOwnProps<T> &
    Omit<ComponentPropsWithoutRef<T>, keyof AppSpotlightCardOwnProps<T>>;

export function AppSpotlightCard<T extends ElementType = "div">({
  as,
  children,
  className,
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
  spotlightClassName,
  spotlightColor = "var(--app-accent-soft)",
  ...props
}: AppSpotlightCardProps<T>) {
  const Component = as ?? "div";
  const [position, setPosition] = useState<SpotlightPosition>({
    x: 0,
    y: 0
  });
  const [visible, setVisible] = useState(false);

  const handleMouseMove = (event: ReactMouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
    onMouseMove?.(event as never);
  };

  const handleMouseEnter = (event: ReactMouseEvent<HTMLElement>) => {
    setVisible(true);
    onMouseEnter?.(event as never);
  };

  const handleMouseLeave = (event: ReactMouseEvent<HTMLElement>) => {
    setVisible(false);
    onMouseLeave?.(event as never);
  };

  return (
    <Component
      className={cn("relative overflow-hidden", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-500 ease-[var(--app-motion-standard)]",
          visible && "opacity-100",
          spotlightClassName
        )}
        style={{
          background: `radial-gradient(220px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 72%)`
        }}
      />
      <span className="relative z-[1] contents">{children}</span>
    </Component>
  );
}
