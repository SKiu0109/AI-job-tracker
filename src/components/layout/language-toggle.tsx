"use client";

import { useState, useRef, useEffect, type MouseEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/i18n/dictionary";

/** Add new languages here — dropdown renders automatically. */
const LANGUAGE_OPTIONS: {
  code: Language;
  nativeName: string;
}[] = [
  { code: "en", nativeName: "English" },
  { code: "zh", nativeName: "中文" },
];

export function LanguageDropdown() {
  const { language, setLanguage } = useLanguage();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const nextPath = `${pathname}${search ? `?${search}` : ""}`;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const languageHref = (nextLanguage: Language) =>
    `/api/language?language=${nextLanguage}&next=${encodeURIComponent(nextPath)}`;

  const currentOption =
    LANGUAGE_OPTIONS.find((o) => o.code === language) ?? LANGUAGE_OPTIONS[0];

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [open]);

  const handleSelect = (
    event: MouseEvent<HTMLAnchorElement>,
    lang: Language,
  ) => {
    event.preventDefault();
    setLanguage(lang);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg text-[12px] font-medium text-secondary transition-colors",
          "bg-tertiary",
          "hover:bg-hover hover:text-primary",
          open && "bg-hover text-primary",
          "px-2.5 py-1.5",
        )}
      >
        {/* globe icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>{currentOption.nativeName}</span>
        <svg
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          viewBox="0 0 12 12"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 min-w-[150px] rounded-lg border bg-tertiary p-1 shadow-panel">
          {LANGUAGE_OPTIONS.map((opt) => (
            <a
              key={opt.code}
              href={languageHref(opt.code)}
              onClick={(e) => handleSelect(e, opt.code)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                language === opt.code
                  ? "bg-accent-subtle text-accent"
                  : "text-secondary hover:bg-hover hover:text-primary",
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-secondary bg-hover">
                {opt.code.toUpperCase()}
              </span>
              <span className="flex-1">{opt.nativeName}</span>
              {language === opt.code && (
                <svg
                  className="h-4 w-4 text-accent"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 12 12"
                >
                  <path d="M1 6l3 3 7-7" />
                </svg>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Kept as a thin wrapper for backward compatibility — prefer `LanguageDropdown`. */
export function LanguageToggle() {
  return <LanguageDropdown />;
}
