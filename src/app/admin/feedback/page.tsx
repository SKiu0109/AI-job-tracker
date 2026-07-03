"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/ui/app-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type {
  AdminFeedbackItem,
  AdminFeedbackListResponse
} from "@/types/product-validation";

type AdminFeedbackCopy = ReturnType<typeof getAdminFeedbackCopy>;

export default function AdminFeedbackPage() {
  const router = useRouter();
  const { accountStatus, session, isLoading: authLoading } = useAuth();
  const { language } = useLanguage();
  const copy = getAdminFeedbackCopy(language);
  const [data, setData] = useState<AdminFeedbackListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const accessToken = session?.access_token;

  useEffect(() => {
    if (!authLoading && !accountStatus.isAdmin) {
      router.replace("/workspace");
    }
  }, [accountStatus.isAdmin, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/feedback", {
        headers: { authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? copy.loadFailed);
      }

      setData((await response.json()) as AdminFeedbackListResponse);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : copy.loadFailed
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, copy.loadFailed]);

  useEffect(() => {
    if (accountStatus.isAdmin) {
      const timer = window.setTimeout(() => void fetchData(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [accountStatus.isAdmin, fetchData]);

  if (authLoading) {
    return <AdminFeedbackLoading label={copy.loading} />;
  }

  if (!accountStatus.isAdmin) {
    return null;
  }

  const feedback = data?.feedback ?? [];

  return (
    <div className="app-stagger space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-text-tertiary">
            {copy.eyebrow}
          </p>
          <h1 className="text-[24px] font-semibold tracking-tight text-app-text-primary">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-app-text-secondary">
            {copy.subtitle}
          </p>
        </div>
        <Button
          className="min-w-24"
          disabled={loading}
          onClick={() => void fetchData()}
          variant="secondary"
        >
          {copy.refresh}
        </Button>
      </div>

      {error ? (
        <div className="app-sheet-enter rounded-lg border border-red-100/80 bg-red-50/45 px-4 py-3 text-sm font-medium text-score-low shadow-app-card">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 font-medium underline"
          >
            {copy.dismiss}
          </button>
        </div>
      ) : null}

      {data ? <FeedbackStats copy={copy} data={data} /> : null}

      <AppCard className="overflow-hidden" variant="elevated">
        <div className="border-b border-app-border-soft px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-app-text-primary">
            {copy.listTitle}
          </h2>
          <p className="mt-1 text-xs leading-5 text-app-text-secondary">
            {copy.listSubtitle}
          </p>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-app-text-secondary">
            {copy.loading}
          </div>
        ) : feedback.length ? (
          <div className="divide-y divide-app-border-soft">
            {feedback.map((item) => (
              <FeedbackItemCard
                copy={copy}
                item={item}
                key={item.id}
                language={language}
              />
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center text-sm text-app-text-secondary">
            {copy.empty}
          </div>
        )}
      </AppCard>
    </div>
  );
}

function AdminFeedbackLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-app-text-secondary">{label}</p>
    </div>
  );
}

function FeedbackStats({
  copy,
  data
}: {
  copy: AdminFeedbackCopy;
  data: AdminFeedbackListResponse;
}) {
  return (
    <div className="app-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label={copy.total} value={data.stats.total} />
      <StatCard
        color="green"
        label={copy.averageRating}
        value={data.stats.averageRating ?? "-"}
      />
      <StatCard color="accent" label={copy.withEmail} value={data.stats.withEmail} />
      <StatCard color="amber" label={copy.zhCount} value={data.stats.zhCount} />
    </div>
  );
}

function StatCard({
  color = "gray",
  label,
  value
}: {
  color?: "gray" | "green" | "amber" | "accent";
  label: string;
  value: number | string;
}) {
  const colorMap = {
    accent: "bg-app-surface text-app-accent",
    amber: "bg-amber-50/55 text-amber-700",
    gray: "bg-app-surface text-gray-700",
    green: "bg-green-50/55 text-green-700"
  };

  return (
    <AppCard
      className={cn("app-hover-lift px-4 py-3", colorMap[color])}
      variant="muted"
    >
      <p className="text-[11px] font-medium opacity-70">{label}</p>
      <p className="mt-0.5 text-[22px] font-semibold">{value}</p>
    </AppCard>
  );
}

function FeedbackItemCard({
  copy,
  item,
  language
}: {
  copy: AdminFeedbackCopy;
  item: AdminFeedbackItem;
  language: "en" | "zh";
}) {
  return (
    <article className="space-y-4 px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-app-text-tertiary">
            <span>{formatDate(item.createdAt, language)}</span>
            <span className="h-1 w-1 rounded-full bg-app-border" />
            <span>{item.path}</span>
          </div>
          <h3 className="mt-2 text-base font-semibold leading-6 text-app-text-primary">
            {item.goal}
          </h3>
        </div>
        <CopyFeedbackButton copy={copy} text={item.feedback} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetaPill
          label={copy.rating}
          value={item.rating ? `${item.rating}/5` : copy.notProvided}
        />
        <MetaPill
          label={copy.language}
          value={item.language === "zh" ? copy.chinese : copy.english}
        />
        <MetaPill label={copy.email} value={item.email ?? copy.notProvided} />
        <MetaPill
          label={copy.role}
          value={item.role.trim() || copy.notProvided}
        />
      </div>

      <div className="rounded-lg border border-app-border-soft bg-app-surface-muted p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-app-text-tertiary">
            {copy.internalBrief}
          </p>
        </div>
        <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-app-text-secondary">
          {item.feedback}
        </pre>
      </div>
    </article>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border-soft bg-app-surface px-3 py-2 shadow-app-card">
      <p className="text-[11px] font-semibold text-app-text-tertiary">{label}</p>
      <p className="mt-1 truncate text-[13px] font-medium text-app-text-primary">
        {value}
      </p>
    </div>
  );
}

function CopyFeedbackButton({
  copy,
  text
}: {
  copy: AdminFeedbackCopy;
  text: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      className="shrink-0"
      onClick={() => void handleCopy()}
      variant="secondary"
    >
      {copied ? copy.copied : copy.copy}
    </Button>
  );
}

function formatDate(value: string, language: "en" | "zh") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-AU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getAdminFeedbackCopy(language: "en" | "zh") {
  if (language === "zh") {
    return {
      averageRating: "平均评分",
      chinese: "中文",
      copied: "已复制",
      copy: "复制摘要",
      dismiss: "关闭",
      email: "邮箱",
      empty: "暂无反馈",
      english: "英文",
      eyebrow: "管理员后台",
      internalBrief: "内部优化摘要",
      language: "语言",
      listSubtitle: "这里展示服务端生成的结构化摘要，不出现在用户反馈页。",
      listTitle: "反馈列表",
      loadFailed: "反馈加载失败",
      loading: "加载中...",
      notProvided: "未提供",
      rating: "评分",
      refresh: "刷新",
      role: "用户背景",
      subtitle: "集中查看用户反馈和服务端生成的优化摘要，方便后续统一整理与迭代。",
      title: "反馈后台",
      total: "总反馈",
      withEmail: "留邮箱",
      zhCount: "中文反馈"
    };
  }

  return {
    averageRating: "Avg rating",
    chinese: "Chinese",
    copied: "Copied",
    copy: "Copy brief",
    dismiss: "Dismiss",
    email: "Email",
    empty: "No feedback yet",
    english: "English",
    eyebrow: "Admin",
    internalBrief: "Internal optimization brief",
    language: "Language",
    listSubtitle: "These server-generated briefs are not shown on the public feedback page.",
    listTitle: "Feedback list",
    loadFailed: "Failed to load feedback",
    loading: "Loading...",
    notProvided: "Not provided",
    rating: "Rating",
    refresh: "Refresh",
    role: "User background",
    subtitle: "Review submitted feedback and the internal brief used for follow-up product work.",
    title: "Feedback Admin",
    total: "Total",
    withEmail: "With email",
    zhCount: "Chinese"
  };
}
