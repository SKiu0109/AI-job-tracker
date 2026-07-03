"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

export interface StarRatingProps {
  ariaLabel?: string;
  labels?: string[];
  className?: string;
  onChange: (value: number) => void;
  value: number;
}

export function StarRating({
  ariaLabel = "Rating",
  labels,
  className,
  onChange,
  value
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      if (e.key === "ArrowLeft" && idx > 0) {
        e.preventDefault();
        (e.currentTarget.previousElementSibling as HTMLElement)?.focus();
      } else if (e.key === "ArrowRight" && idx < 4) {
        e.preventDefault();
        (e.currentTarget.nextElementSibling as HTMLElement)?.focus();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onChange(idx + 1);
      }
    },
    [onChange]
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        className="inline-flex items-center gap-0.5"
        onMouseLeave={() => setHovered(null)}
        role="radiogroup"
        aria-label={ariaLabel}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = i <= active;
          const isHovered = hovered === i;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === i}
              aria-label={labels?.[i - 1] ?? `${i}/5`}
              tabIndex={value === i ? 0 : -1}
              onClick={() => onChange(i)}
              onMouseEnter={() => setHovered(i)}
              onKeyDown={(e) => handleKeyDown(e, i - 1)}
              className={cn(
                "relative rounded p-0.5 transition-all duration-300 ease-[var(--app-motion-standard)] focus:outline-none active:scale-95",
                isHovered && "scale-110",
                "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              )}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill={filled ? "var(--app-warning)" : "none"}
                stroke={filled ? "var(--app-warning)" : "var(--app-text-tertiary)"}
                strokeWidth="1.5"
                className="transition-colors duration-300 ease-[var(--app-motion-standard)]"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          );
        })}
      </div>
      {labels && active >= 1 && active <= 5 && (
        <p
          className={cn(
            "text-xs font-medium transition-colors duration-200",
            active <= 2
              ? "text-app-text-tertiary"
              : active === 3
                ? "text-app-warning"
                : "text-app-accent"
          )}
        >
          {labels[active - 1]}
        </p>
      )}
    </div>
  );
}
