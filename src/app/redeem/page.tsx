"use client";

import { useState } from "react";
import Link from "next/link";
import { AppCard } from "@/components/ui/app-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { useAuth } from "@/lib/auth/auth-provider";
import { useGuestCredits } from "@/lib/credits/guest-credits-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { RedeemResult } from "@/types/redemption";

export default function RedeemPage() {
  const { accountStatus, session } = useAuth();
  const { refreshCredits } = useGuestCredits();
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRedeem = accountStatus.isAuthenticated && !accountStatus.isAdmin;

  const handleRedeem = async () => {
    if (!session?.access_token) {
      setError(t.redeemLoginRequired);
      return;
    }

    const trimmed = code.trim();
    if (!trimmed) {
      setError(t.redeemEnterCodeRequired);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ code: trimmed })
      });

      const data = (await res.json()) as {
        success: boolean;
        creditAmount?: number;
        newRemaining?: number;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.error ?? t.redeemFailed);
        return;
      }

      setResult({
        success: true,
        codeId: null,
        creditAmount: data.creditAmount ?? 0,
        newRemaining: data.newRemaining ?? 0,
        errorMessage: null
      });

      // Refresh credits in the provider
      await refreshCredits();
    } catch {
      setError(t.redeemNetworkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-stagger mx-auto max-w-xl space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-app-text-primary">{t.redeemTitle}</h1>
        <p className="mt-1 text-[14px] leading-6 text-app-text-secondary">{t.redeemSubtitle}</p>
      </div>

      {/* Error */}
      {error ? (
        <div className="app-sheet-enter rounded-lg border border-red-100/80 bg-red-50/45 px-4 py-3 text-[13px] font-medium text-score-low shadow-app-card">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 font-semibold underline"
          >
            {t.adminCodesDismiss}
          </button>
        </div>
      ) : null}

      {/* Success */}
      {result?.success ? (
        <AppCard className="app-sheet-enter p-5 sm:p-6" variant="elevated">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50/55 text-green-600 shadow-app-card ring-1 ring-green-100/80">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 10l3.5 3.5L15 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="text-[16px] font-semibold text-green-800">
              {t.redeemSuccess}
            </h2>
          </div>
          <p className="mt-2 text-[14px] text-green-700">
            {t.redeemReceived.replace("{count}", String(result.creditAmount))}
          </p>
          <p className="mt-1 text-[13px] text-green-600">
            {t.redeemAvailable} {result.newRemaining}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/add"
              className="inline-flex min-h-10 items-center justify-center rounded-app border border-green-600 bg-green-600 px-4 py-2 text-[13px] font-semibold text-white shadow-app-card transition duration-300 ease-[var(--app-motion-standard)] hover:-translate-y-px hover:border-green-700 hover:bg-green-700 active:translate-y-0 active:scale-[0.99]"
            >
              {t.redeemStartAnalysis}
            </Link>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setCode("");
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-app border border-app-border-soft bg-app-surface px-4 py-2 text-[13px] font-semibold text-app-text-primary shadow-app-card transition duration-300 ease-[var(--app-motion-standard)] hover:-translate-y-px hover:bg-app-surface-hover active:translate-y-0 active:scale-[0.99]"
            >
              {t.redeemAnother}
            </button>
          </div>
        </AppCard>
      ) : null}

      {/* Redeem form */}
      {!result?.success ? (
        <AppCard className="p-5 sm:p-6" variant="elevated">
          {!canRedeem ? (
            <div className="py-4 text-center">
              {accountStatus.isAdmin ? (
                <div className="space-y-3">
                  <p className="text-[14px] text-app-text-secondary">
                    {t.redeemAdminNoNeed}
                  </p>
                  <Link
                    href="/admin/codes"
                    className="inline-flex min-h-10 items-center justify-center rounded-app border border-app-accent bg-app-accent px-4 py-2 text-[13px] font-semibold text-white transition duration-300 ease-[var(--app-motion-standard)] hover:-translate-y-px hover:border-app-accent-hover hover:bg-app-accent-hover active:translate-y-0 active:scale-[0.99]"
                  >
                    {t.redeemGoToAdmin}
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[14px] text-app-text-secondary">
                    {t.redeemLoginFirst}
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex min-h-10 items-center justify-center rounded-app border border-app-accent bg-app-accent px-4 py-2 text-[13px] font-semibold text-white transition duration-300 ease-[var(--app-motion-standard)] hover:-translate-y-px hover:border-app-accent-hover hover:bg-app-accent-hover active:translate-y-0 active:scale-[0.99]"
                  >
                    {t.signIn}
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <label className="mb-2 block text-[14px] font-semibold text-app-text-primary">
                {t.redeemEnterCode}
              </label>
              <Input
                placeholder="JOBTRACK-XXXX-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleRedeem();
                }}
                className="font-mono text-[14px] tracking-wide"
                autoFocus
              />
              <p className="mt-2 rounded-app border border-app-border-soft bg-app-surface px-3 py-2 text-[12px] text-app-text-secondary">
                {t.redeemCaseHint}
              </p>

              <div className="mt-4">
                <Button
                  onClick={() => void handleRedeem()}
                  disabled={loading || !code.trim()}
                  className="w-full"
                >
                  {loading ? t.redeeming : t.redeemBtn}
                </Button>
              </div>
            </>
          )}
        </AppCard>
      ) : null}

      {/* Help section */}
      <AppCard className="app-hover-lift p-5" variant="muted">
        <h3 className="text-[14px] font-semibold text-app-text-primary">
          {t.redeemAbout}
        </h3>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-6 text-app-text-secondary">
          <li>{t.redeemAbout1}</li>
          <li>{t.redeemAbout2}</li>
          <li>{t.redeemAbout3}</li>
          <li>{t.redeemAbout4}</li>
          <li>{t.redeemAbout5}</li>
        </ul>
      </AppCard>
    </div>
  );
}
