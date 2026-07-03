"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  confidenceLabels,
  dictionary,
  Language,
  nextActionLabels,
  priorityLabels,
  recommendationLabels,
  statusLabels,
  timelineStatusLabels
} from "@/lib/i18n/dictionary";
import { LANGUAGE_COOKIE_KEY } from "@/lib/i18n/constants";
import { LANGUAGE_COOKIE_MAX_AGE } from "@/lib/constants";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (typeof dictionary)[Language];
  statuses: (typeof statusLabels)[Language];
  timelineStatuses: (typeof timelineStatusLabels)[Language];
  recommendations: (typeof recommendationLabels)[Language];
  nextActions: (typeof nextActionLabels)[Language];
  priorities: (typeof priorityLabels)[Language];
  confidences: (typeof confidenceLabels)[Language];
};

const STORAGE_KEY = "ai-bilingual-job-tracker.language";

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLanguage = "en"
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en";
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${nextLanguage}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`;
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: dictionary[language],
      statuses: statusLabels[language],
      timelineStatuses: timelineStatusLabels[language],
      recommendations: recommendationLabels[language],
      nextActions: nextActionLabels[language],
      priorities: priorityLabels[language],
      confidences: confidenceLabels[language]
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }

  return context;
}
