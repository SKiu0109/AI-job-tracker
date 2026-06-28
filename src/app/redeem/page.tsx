"use client";

import { useState } from "react";
import Link from "next/link";
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
    <div className="mx-auto max-w-lg space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-primary">{t.redeemTitle}</h1>
        <p className="mt-1 text-[14px] text-secondary">{t.redeemSubtitle}</p>
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 font-medium underline"
          >
            {t.adminCodesDismiss}
          </button>
        </div>
      ) : null}

      {/* Success */}
      {result?.success ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <div className="flex items-center gap-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-green-600"
            >
              <path
                d="M5 10l3.5 3.5L15 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
          <div className="mt-4 flex gap-3">
            <Link
              href="/workspace"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-green-700"
            >
              {t.redeemStartAnalysis}
            </Link>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setCode("");
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-green-300 bg-white px-4 py-2 text-[13px] font-semibold text-green-700 transition-colors hover:bg-green-100"
            >
              {t.redeemAnother}
            </button>
          </div>
        </div>
      ) : null}

      {/* Redeem form */}
      {!result?.success ? (
        <div className="rounded-xl border border-black/[0.06] bg-white p-6">
          {!canRedeem ? (
            <div className="text-center py-4">
              {accountStatus.isAdmin ? (
                <div className="space-y-3">
                  <p className="text-[14px] text-secondary">
                    {t.redeemAdminNoNeed}
                  </p>
                  <Link
                    href="/admin/codes"
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover"
                  >
                    {t.redeemGoToAdmin}
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[14px] text-secondary">
                    {t.redeemLoginFirst}
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover"
                  >
                    {t.signIn}
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <label className="block text-[14px] font-medium text-primary mb-2">
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
              <p className="mt-2 text-[12px] text-secondary">
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
        </div>
      ) : null}

      {/* Help section */}
      <div className="rounded-xl border border-black/[0.06] bg-hover p-5">
        <h3 className="text-[14px] font-semibold text-primary">
          {t.redeemAbout}
        </h3>
        <ul className="mt-2 space-y-1.5 text-[13px] text-secondary">
          <li>{t.redeemAbout1}</li>
          <li>{t.redeemAbout2}</li>
          <li>{t.redeemAbout3}</li>
          <li>{t.redeemAbout4}</li>
          <li>{t.redeemAbout5}</li>
        </ul>
      </div>
    </div>
  );
}
