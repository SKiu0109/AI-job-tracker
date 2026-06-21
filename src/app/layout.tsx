import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import { LANGUAGE_COOKIE_KEY } from "@/lib/i18n/constants";
import { Language } from "@/lib/i18n/dictionary";

export const metadata: Metadata = {
  title: "AI Job Tracker",
  description:
    "AI-powered bilingual job application tracker for Chinese-speaking international students."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const savedLanguage = cookieStore.get(LANGUAGE_COOKIE_KEY)?.value;
  const initialLanguage: Language = savedLanguage === "zh" ? "zh" : "en";

  return (
    <html lang={initialLanguage === "zh" ? "zh-CN" : "en"}>
      <body>
        <LanguageProvider initialLanguage={initialLanguage}>
          <AppShell>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
