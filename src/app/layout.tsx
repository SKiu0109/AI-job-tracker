import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { GuestCreditsProvider } from "@/lib/credits/guest-credits-provider";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import { LANGUAGE_COOKIE_KEY } from "@/lib/i18n/constants";
import { Language } from "@/lib/i18n/dictionary";

export const metadata: Metadata = {
  title: "AI Job Tracker",
  description:
    "AI-powered bilingual job application tracker for Chinese-speaking international students.",
  applicationName: "AI Job Tracker",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AI Job Tracker",
    statusBarStyle: "default"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg", type: "image/svg+xml" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#0f766e"
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
          <AuthProvider>
            <GuestCreditsProvider>
              <AppShell>{children}</AppShell>
            </GuestCreditsProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
