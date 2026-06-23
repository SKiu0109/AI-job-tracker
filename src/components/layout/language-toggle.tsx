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
    <div className="inline-flex rounded-app border border-line bg-surface-muted p-1 shadow-soft">
      <a
        href={languageHref("en")}
        onClick={(event) => handleLanguageClick(event, "en")}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          language === "en"
            ? "bg-accent text-white"
            : "text-muted hover:bg-white hover:text-ink"
        )}
      >
        {t.englishShort}
      </a>
      <a
        href={languageHref("zh")}
        onClick={(event) => handleLanguageClick(event, "zh")}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          language === "zh"
            ? "bg-accent text-white"
            : "text-muted hover:bg-white hover:text-ink"
        )}
      >
        {t.chineseShort}
      </a>
    </div>
  );
}
