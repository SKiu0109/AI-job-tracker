"use client";

import { type MouseEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import { Language } from "@/lib/i18n/dictionary";

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const nextPath = `${pathname}${search ? `?${search}` : ""}`;
  const languageHref = (nextLanguage: Language) =>
    `/api/language?language=${nextLanguage}&next=${encodeURIComponent(nextPath)}`;
  const handleLanguageClick = (
    event: MouseEvent<HTMLAnchorElement>,
    nextLanguage: Language
  ) => {
    event.preventDefault();
    setLanguage(nextLanguage);
  };

  return (
    <div className="inline-flex rounded-md border border-line bg-white p-1">
      <a
        href={languageHref("en")}
        onClick={(event) => handleLanguageClick(event, "en")}
        className={cn(
          "rounded px-3 py-1.5 text-sm font-medium transition",
          language === "en"
            ? "bg-accent text-white"
            : "text-muted hover:bg-paper hover:text-ink"
        )}
      >
        {t.englishShort}
      </a>
      <a
        href={languageHref("zh")}
        onClick={(event) => handleLanguageClick(event, "zh")}
        className={cn(
          "rounded px-3 py-1.5 text-sm font-medium transition",
          language === "zh"
            ? "bg-accent text-white"
            : "text-muted hover:bg-paper hover:text-ink"
        )}
      >
        {t.chineseShort}
      </a>
    </div>
  );
}
