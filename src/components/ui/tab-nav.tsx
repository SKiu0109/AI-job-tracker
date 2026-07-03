"use client";

import { HTMLAttributes, KeyboardEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type TabNavItem = {
  badge?: ReactNode;
  disabled?: boolean;
  key: string;
  label: ReactNode;
};

type TabNavProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  activeKey: string;
  ariaLabel?: string;
  onChange: (key: string) => void;
  tabs: TabNavItem[];
};

export function TabNav({
  activeKey,
  ariaLabel = "Tabs",
  className,
  onChange,
  tabs,
  ...props
}: TabNavProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ width: number; x: number }>({ width: 0, x: 0 });
  const [isInitial, setIsInitial] = useState(true);
  const enabledTabs = tabs.filter((tab) => !tab.disabled);

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeButton = container.querySelector<HTMLButtonElement>(
      `[role="tab"][aria-selected="true"]`
    );
    if (!activeButton) return;

    setIndicatorStyle({
      width: activeButton.offsetWidth,
      x: activeButton.offsetLeft,
    });

    if (isInitial) {
      // Skip first frame transition for initial paint
      requestAnimationFrame(() => setIsInitial(false));
    }
  }, [isInitial]);

  useEffect(() => {
    updateIndicator();
  }, [activeKey, tabs, updateIndicator]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => updateIndicator());
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateIndicator]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    const currentIndex = enabledTabs.findIndex((tab) => tab.key === activeKey);
    if (currentIndex === -1) {
      return;
    }

    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex =
      (currentIndex + offset + enabledTabs.length) % enabledTabs.length;
    onChange(enabledTabs[nextIndex].key);
  };

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-app-surface p-1 shadow-app-card transition-[background-color,box-shadow] duration-300 ease-[var(--app-motion-standard)]",
        className
      )}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="tablist"
      {...props}
    >
      {/* Sliding active indicator */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1 z-0 rounded-sm bg-app-surface-solid shadow-app-card transition-[background-color,box-shadow] duration-300 ease-[var(--app-motion-standard)]",
          !isInitial && "transition-[transform,width] duration-300 ease-[var(--app-motion-snappy)]"
        )}
        style={{
          height: "calc(100% - 8px)",
          left: 0,
          transform: `translateX(${indicatorStyle.x}px)`,
          width: `${indicatorStyle.width}px`,
        }}
      />

      {tabs.map((tab) => {
        const active = tab.key === activeKey;

        return (
          <button
            aria-selected={active}
            className={cn(
              "relative z-10 inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-sm px-3.5 py-2 text-[13px] font-medium transition-colors duration-300 ease-[var(--app-motion-standard)] focus-visible:outline-none focus-visible:shadow-app-focus active:scale-[0.98]",
              active
                ? "text-app-text-primary"
                : "text-app-text-secondary hover:text-app-text-primary",
              tab.disabled && "cursor-not-allowed opacity-50"
            )}
            disabled={tab.disabled}
            key={tab.key}
            onClick={() => onChange(tab.key)}
            role="tab"
            type="button"
          >
            <span>{tab.label}</span>
            {tab.badge ? (
              <span className="rounded-full bg-app-accent-soft px-2 py-0.5 text-[11px] font-semibold text-app-accent transition duration-300 ease-[var(--app-motion-standard)]">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
