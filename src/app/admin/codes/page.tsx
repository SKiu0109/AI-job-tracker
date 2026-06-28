"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { useAuth } from "@/lib/auth/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import type {
  AdminCodeListResponse,
  GenerateCodesResult,
  RedemptionCode
} from "@/types/redemption";

// ── UI helpers ──

function CopyButton({ text, copyLabel, copiedLabel }: { text: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="ml-2 rounded px-2 py-0.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent-subtle"
    >
      {copied ? copiedLabel : copyLabel}
    </button>
  );
}

function CopyAllButton({ codes, copyAllLabel, copiedAllLabel }: { codes: RedemptionCode[]; copyAllLabel: string; copiedAllLabel: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(
          codes.map((c) => c.code).join("\n")
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-accent-hover"
    >
      {copied
        ? copiedAllLabel.replace("{count}", String(codes.length))
        : copyAllLabel.replace("{count}", String(codes.length))}
    </button>
  );
}

function StatusBadge({ code, labels }: { code: RedemptionCode; labels: { disabled: string; expired: string; depleted: string; active: string } }) {
  const now = new Date();
  if (!code.isActive) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium bg-red-50 text-red-700">
        {labels.disabled}
      </span>
    );
  }
  if (code.expiresAt && new Date(code.expiresAt) <= now) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700">
        {labels.expired}
      </span>
    );
  }
  if (code.usedCount >= code.maxUses) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600">
        {labels.depleted}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium bg-green-50 text-green-700">
      {labels.active}
    </span>
  );
}

// ── Page ──

export default function AdminCodesPage() {
  const router = useRouter();
  const { accountStatus, session, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<AdminCodeListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate form
  const [count, setCount] = useState(5);
  const [creditAmount, setCreditAmount] = useState(20);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GenerateCodesResult | null>(null);
  const accessToken = session?.access_token;

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && !accountStatus.isAdmin) {
      router.replace("/workspace");
    }
  }, [authLoading, accountStatus, router]);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/codes", {
        headers: { authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? t.adminCodesLoadFailed);
      }
      setData((await res.json()) as AdminCodeListResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.adminCodesLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [accessToken, t.adminCodesLoadFailed]);

  useEffect(() => {
    if (accountStatus.isAdmin) {
      const timer = window.setTimeout(() => void fetchData(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [accountStatus.isAdmin, fetchData]);

  const handleGenerate = async () => {
    if (!accessToken) return;
    setGenerating(true);
    setGenerated(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          count,
          creditAmount,
          maxUses,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          note: note || null
        })
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? t.adminCodesGenerateFailed);
      }

      const result = (await res.json()) as GenerateCodesResult;
      setGenerated(result);
      // Refresh list
      void fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.adminCodesGenerateFailed);
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleActive = async (code: RedemptionCode) => {
    if (!accessToken) return;

    try {
      const res = await fetch(`/api/admin/codes/${code.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ isActive: !code.isActive })
      });

      if (!res.ok) throw new Error(t.adminCodesOpFailed);
      void fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.adminCodesOpFailed);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary">{t.adminCodesLoading}</p>
      </div>
    );
  }

  if (!accountStatus.isAdmin) {
    return null; // useEffect will redirect
  }

  const stats = data?.stats;
  const codes = data?.codes ?? [];
  const statusLabels = {
    disabled: t.adminCodesStatusDisabled,
    expired: t.adminCodesStatusExpired,
    depleted: t.adminCodesStatusDepleted,
    active: t.adminCodesStatusActive
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-primary">
          {t.adminCodesTitle}
        </h1>
        <p className="mt-1 text-[14px] text-secondary">
          {t.adminCodesSubtitle}
        </p>
      </div>

      {/* Error toast */}
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

      {/* Stats */}
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label={t.adminCodesTotal} value={stats.total} />
          <StatCard label={t.adminCodesActive} value={stats.active} color="green" />
          <StatCard label={t.adminCodesExpired} value={stats.expired} color="amber" />
          <StatCard label={t.adminCodesDepleted} value={stats.depleted} color="gray" />
          <StatCard label={t.adminCodesRedeemed} value={stats.totalRedeemed} color="accent" />
        </div>
      ) : null}

      {/* Generate form */}
      <div className="rounded-xl border border-black/[0.06] bg-white p-6">
        <h2 className="text-[16px] font-semibold text-primary">
          {t.adminCodesGenerateTitle}
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-[13px] font-medium text-primary mb-1.5">
              {t.adminCodesCount}
            </label>
            <Input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-primary mb-1.5">
              {t.adminCodesCreditAmount}
            </label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={creditAmount}
              onChange={(e) => setCreditAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-primary mb-1.5">
              {t.adminCodesMaxUses}
            </label>
            <Select
              value={String(maxUses)}
              onChange={(e) => setMaxUses(Number(e.target.value))}
            >
              <option value="1">1 {t.adminCodesSingleUse.toLowerCase()}</option>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="1000">1000</option>
            </Select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-primary mb-1.5">
              {t.adminCodesExpiry}
            </label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-[13px] font-medium text-primary mb-1.5">
              {t.adminCodesNote}
            </label>
            <Input
              placeholder={t.adminCodesNotePlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={() => void handleGenerate()}
            disabled={generating || count < 1}
          >
            {generating ? t.adminCodesGenerating : t.adminCodesGenerateBtn}
          </Button>
          <span className="text-[12px] text-secondary">
            {t.adminCodesEstimated.replace("{count}", String(count * creditAmount * maxUses))}
          </span>
        </div>
      </div>

      {/* Generated codes */}
      {generated ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-green-800">
              {t.adminCodesGenerated.replace("{count}", String(generated.totalGenerated))}
            </h2>
            <CopyAllButton
              codes={generated.codes}
              copyAllLabel={t.adminCodesCopyAll}
              copiedAllLabel={t.adminCodesCopiedAll}
            />
          </div>
          <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-green-200 bg-white">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-green-100 text-left">
                  <th className="px-3 py-2 font-medium text-secondary">{t.adminCodesHeaderCode}</th>
                  <th className="px-3 py-2 font-medium text-secondary">{t.adminCodesHeaderCredits}</th>
                  <th className="px-3 py-2 font-medium text-secondary">{t.adminCodesHeaderUses}</th>
                  <th className="px-3 py-2 font-medium text-secondary">{t.adminCodesHeaderAction}</th>
                </tr>
              </thead>
              <tbody>
                {generated.codes.map((code) => (
                  <tr
                    key={code.id}
                    className="border-b border-green-50 last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-[12px]">
                      {code.code}
                    </td>
                    <td className="px-3 py-2">{code.creditAmount}</td>
                    <td className="px-3 py-2">
                      {code.maxUses === 1 ? t.adminCodesSingleUse : code.maxUses}
                    </td>
                    <td className="px-3 py-2">
                      <CopyButton text={code.code} copyLabel={t.adminCodesCopy} copiedLabel={t.adminCodesCopied} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Code list */}
      <div className="rounded-xl border border-black/[0.06] bg-white">
        <div className="border-b border-black/[0.04] px-6 py-4">
          <h2 className="text-[16px] font-semibold text-primary">
            {t.adminCodesExisting}
          </h2>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center text-[13px] text-secondary">
            {t.adminCodesLoading}
          </div>
        ) : codes.length === 0 ? (
          <div className="px-6 py-8 text-center text-[13px] text-secondary">
            {t.adminCodesEmpty}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-black/[0.04] text-left">
                  <th className="px-4 py-3 font-medium text-secondary">{t.adminCodesHeaderCode}</th>
                  <th className="px-4 py-3 font-medium text-secondary">{t.adminCodesHeaderCredits}</th>
                  <th className="px-4 py-3 font-medium text-secondary">{t.adminCodesHeaderUses}</th>
                  <th className="px-4 py-3 font-medium text-secondary">{t.adminCodesHeaderStatus}</th>
                  <th className="px-4 py-3 font-medium text-secondary">{t.adminCodesHeaderExpiry}</th>
                  <th className="px-4 py-3 font-medium text-secondary">{t.adminCodesHeaderNote}</th>
                  <th className="px-4 py-3 font-medium text-secondary">{t.adminCodesHeaderAction}</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr
                    key={code.id}
                    className="border-b border-black/[0.02] last:border-0 hover:bg-hover"
                  >
                    <td className="px-4 py-2.5 font-mono text-[12px]">
                      {code.code}
                      <CopyButton text={code.code} copyLabel={t.adminCodesCopy} copiedLabel={t.adminCodesCopied} />
                    </td>
                    <td className="px-4 py-2.5">{code.creditAmount}</td>
                    <td className="px-4 py-2.5">
                      {code.usedCount}/{code.maxUses}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge code={code} labels={statusLabels} />
                    </td>
                    <td className="px-4 py-2.5 text-secondary">
                      {code.expiresAt
                        ? new Date(code.expiresAt).toLocaleDateString()
                        : t.adminCodesNeverExpires}
                    </td>
                    <td className="px-4 py-2.5 max-w-[160px] truncate text-secondary">
                      {code.note || "-"}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(code)}
                        className="rounded px-2 py-1 text-[12px] font-medium transition-colors hover:bg-accent-subtle text-accent"
                      >
                        {code.isActive ? t.adminCodesDeactivate : t.adminCodesActivate}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "gray"
}: {
  label: string;
  value: number;
  color?: "gray" | "green" | "amber" | "accent";
}) {
  const colorMap = {
    gray: "bg-gray-50 text-gray-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    accent: "bg-accent-subtle text-accent"
  };

  return (
    <div className={`rounded-xl px-4 py-3 ${colorMap[color]}`}>
      <p className="text-[11px] font-medium opacity-70">{label}</p>
      <p className="mt-0.5 text-[22px] font-semibold">{value}</p>
    </div>
  );
}
