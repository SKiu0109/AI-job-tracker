import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { GuestCreditsProvider } from "@/lib/credits/guest-credits-provider";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { LANGUAGE_COOKIE_KEY } from "@/lib/i18n/constants";
import { Language } from "@/lib/i18n/dictionary";

export const metadata: Metadata = {
  title: "Offerwise",
  description:
    "Offerwise is a multilingual job search workspace for tracking roles, decisions, resumes, and follow-ups.",
  applicationName: "Offerwise",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Offerwise",
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
  themeColor: "#F7F6F4"
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
    <html lang={initialLanguage === "zh" ? "zh-CN" : "en"} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('app-theme');
                  var resolved = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  if (resolved === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <LanguageProvider initialLanguage={initialLanguage}>
            <AuthProvider>
              <GuestCreditsProvider>
                <ToastProvider>
                  <AppShell>{children}</AppShell>
                </ToastProvider>
              </GuestCreditsProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
