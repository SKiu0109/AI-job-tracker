"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroAnalyzeInput } from "@/components/jobs/hero-analyze-input";
import { AppCard } from "@/components/ui/app-card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form-controls";
import { PageHeader, PageHeaderMetric } from "@/components/ui/page-header";
import { MIN_JD_TEXT_LENGTH } from "@/lib/credits/constants";
import { useAuth } from "@/lib/auth/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { SAMPLE_JD, SAMPLE_SOURCE_URL } from "@/lib/sample-jd";
import { GUEST_WORKSPACE_IMPORTED_EVENT } from "@/lib/storage/cloud-sync";
import {
  archiveImportDraft,
  deleteImportDraft,
  loadImportDrafts,
  saveImportDraft,
  type ImportDraft
} from "@/lib/storage/import-inbox";
import { createStorageScope } from "@/lib/storage/scope";
import { cn } from "@/lib/utils";
import { formatOptionalDate } from "@/lib/jobs/job-detail-utils";

type ImportInboxPageProps = {
  initialRawJd?: string;
  initialSourceUrl?: string;
  samplePrefilled?: boolean;
};

type InboxFilter = "active" | "archived";

type AnalyzerSeed = {
  draftId: string;
  id: string;
  rawJd: string;
  sourceUrl: string;
  title: string;
};

export function ImportInboxPage({
  initialRawJd = "",
  initialSourceUrl = "",
  samplePrefilled = false
}: ImportInboxPageProps) {
  const { session } = useAuth();
  const { language, t } = useLanguage();
  const storageScope = useMemo(
    () => createStorageScope(session?.user.id),
    [session?.user.id]
  );
  const copy = getImportInboxCopy(language);
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [filter, setFilter] = useState<InboxFilter>("active");
  const [draftTitle, setDraftTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [rawJd, setRawJd] = useState(initialRawJd);
  const [message, setMessage] = useState(samplePrefilled ? t.sampleLoaded : "");
  const [analyzerSeed, setAnalyzerSeed] = useState<AnalyzerSeed>({
    draftId: "",
    id: samplePrefilled ? "sample" : "blank",
    rawJd: initialRawJd,
    sourceUrl: initialSourceUrl,
    title: samplePrefilled ? copy.sampleTitle : ""
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDrafts(loadImportDrafts(storageScope));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [storageScope]);

  useEffect(() => {
    const reloadImportedDrafts = () => setDrafts(loadImportDrafts(storageScope));

    window.addEventListener(
      GUEST_WORKSPACE_IMPORTED_EVENT,
      reloadImportedDrafts
    );

    return () =>
      window.removeEventListener(
        GUEST_WORKSPACE_IMPORTED_EVENT,
        reloadImportedDrafts
      );
  }, [storageScope]);

  const visibleDrafts = useMemo(
    () => drafts.filter((draft) => draft.status === filter),
    [drafts, filter]
  );
  const activeCount = drafts.filter((draft) => draft.status === "active").length;
  const archivedCount = drafts.filter((draft) => draft.status === "archived").length;
  const canSave = rawJd.trim().length >= MIN_JD_TEXT_LENGTH;
  const hasAnalyzerSelection = Boolean(
    analyzerSeed.rawJd.trim() || analyzerSeed.sourceUrl.trim()
  );

  const reloadDrafts = () => setDrafts(loadImportDrafts(storageScope));
  const scrollToAnalyzer = () => {
    window.setTimeout(() => {
      document.getElementById("import-analyzer")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 0);
  };

  const selectDraftForAnalysis = (draft: ImportDraft) => {
    setAnalyzerSeed({
      draftId: draft.id,
      id: `${draft.id}-${draft.updated_at}`,
      rawJd: draft.raw_jd,
      sourceUrl: draft.source_url,
      title: draft.title
    });
    scrollToAnalyzer();
  };

  const handleUseSample = () => {
    setRawJd(SAMPLE_JD);
    setSourceUrl((current) => current || SAMPLE_SOURCE_URL);
    setDraftTitle(copy.sampleTitle);
    setMessage(t.sampleLoaded);
  };

  const handleSaveDraft = () => {
    if (!canSave) {
      setMessage(copy.tooShort);
      return;
    }

    const draft = saveImportDraft(
      {
        raw_jd: rawJd,
        source_url: sourceUrl,
        title: draftTitle
      },
      storageScope
    );
    reloadDrafts();
    setDraftTitle("");
    setSourceUrl("");
    setRawJd("");
    selectDraftForAnalysis(draft);
    setMessage(copy.savedAndReady(draft.title));
  };

  const handleLoadDraft = (draft: ImportDraft) => {
    selectDraftForAnalysis(draft);
    setMessage(copy.loaded(draft.title));
  };

  const handleAnalyzerJobSaved = () => {
    if (!analyzerSeed.draftId) {
      return;
    }

    trackImportDraftAnalyzed(analyzerSeed);

    const archivedDraft = archiveImportDraft(analyzerSeed.draftId, storageScope);
    if (archivedDraft) {
      reloadDrafts();
      setMessage(copy.analyzedAndArchived(archivedDraft.title));
    }
  };

  const handleArchiveDraft = (draft: ImportDraft) => {
    archiveImportDraft(draft.id, storageScope);
    reloadDrafts();
    setMessage(copy.archived(draft.title));
  };

  const handleDeleteDraft = (draft: ImportDraft) => {
    deleteImportDraft(draft.id, storageScope);
    reloadDrafts();
    setMessage(copy.deleted(draft.title));
  };

  return (
    <div className="app-stagger space-y-6 pb-8">
      <PageHeader
        metadata={
          <>
            <PageHeaderMetric tone="info">
              {activeCount} {copy.activeDrafts}
            </PageHeaderMetric>
            <PageHeaderMetric>
              {archivedCount} {copy.archivedDrafts}
            </PageHeaderMetric>
          </>
        }
        subtitle={copy.subtitle}
        title={copy.title}
      />

      {message ? (
        <div className="app-sheet-enter rounded-lg border border-app-border-soft bg-app-surface px-4 py-3 text-[13px] font-medium text-score-high shadow-app-card backdrop-blur-xl">
          {message}
        </div>
      ) : null}

      <ImportFlowSteps steps={copy.flowSteps} />

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <AppCard className="h-fit min-w-0 p-5 sm:p-6" variant="elevated">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-app-text-primary">
              {copy.captureTitle}
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-app-text-secondary">
              {copy.captureSubtitle}
            </p>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <Label htmlFor="import-title">{copy.draftTitle}</Label>
              <Input
                id="import-title"
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder={copy.draftTitlePlaceholder}
                value={draftTitle}
              />
            </label>
            <label className="block space-y-2">
              <Label htmlFor="import-source">{copy.sourceUrl}</Label>
              <Input
                id="import-source"
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://company.com/job-posting"
                type="url"
                value={sourceUrl}
              />
            </label>
            <label className="block space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="import-raw-jd">{copy.rawJd}</Label>
                <button
                  className="text-[12px] font-semibold text-app-accent hover:text-app-accent-hover"
                  onClick={handleUseSample}
                  type="button"
                >
                  {copy.useSample}
                </button>
              </div>
              <Textarea
                className="min-h-[240px]"
                id="import-raw-jd"
                onChange={(event) => setRawJd(event.target.value)}
                placeholder={copy.rawJdPlaceholder}
                value={rawJd}
              />
            </label>
            <div className="flex flex-col gap-3 border-t border-app-border-soft pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className={cn(
                "text-[12px] leading-5",
                canSave ? "text-score-high" : "text-app-text-secondary"
              )}>
                {canSave
                  ? copy.readyToSave
                  : copy.charactersNeeded(Math.max(MIN_JD_TEXT_LENGTH - rawJd.trim().length, 0))}
              </p>
              <Button disabled={!canSave} onClick={handleSaveDraft}>
                {copy.saveDraft}
              </Button>
            </div>
          </div>
        </AppCard>

        <AppCard className="h-fit min-w-0 p-5 sm:p-6" variant="elevated">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight text-app-text-primary">
                {copy.inboxTitle}
              </h2>
              <p className="mt-1 text-[13px] leading-6 text-app-text-secondary">
                {copy.inboxSubtitle}
              </p>
            </div>
            <div className="flex rounded-lg border border-app-border-soft bg-app-surface p-1 shadow-app-card backdrop-blur-xl">
              {(["active", "archived"] as InboxFilter[]).map((item) => (
                <button
                  className={cn(
                    "rounded-app px-3 py-1.5 text-[12px] font-semibold transition duration-300 ease-[var(--app-motion-standard)] active:scale-[0.98]",
                    filter === item
                      ? "bg-app-surface text-app-accent shadow-app-card"
                      : "text-app-text-secondary hover:text-app-text-primary"
                  )}
                  key={item}
                  onClick={() => setFilter(item)}
                  type="button"
                >
                  {copy.filters[item]}
                </button>
              ))}
            </div>
          </div>
          <div className="app-stagger mt-5 space-y-3">
            {visibleDrafts.length ? (
              visibleDrafts.map((draft) => (
                <ImportDraftCard
                  copy={copy}
                  draft={draft}
                  key={draft.id}
                  onArchive={handleArchiveDraft}
                  onDelete={handleDeleteDraft}
                  onLoad={handleLoadDraft}
                />
              ))
            ) : (
              <div className="rounded-lg border border-app-border-soft bg-app-surface px-5 py-8 text-center shadow-app-card backdrop-blur-xl">
                <h3 className="text-[14px] font-semibold text-app-text-primary">
                  {copy.emptyTitle}
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-[13px] leading-5 text-app-text-secondary">
                  {filter === "active" ? copy.emptyActive : copy.emptyArchived}
                </p>
              </div>
            )}
          </div>
        </AppCard>
      </section>

      <section className="scroll-mt-24 space-y-4" id="import-analyzer">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-app-text-primary">
            {copy.analyzerTitle}
          </h2>
          <p className="mt-1 text-[13px] text-app-text-secondary">
            {copy.analyzerSubtitle}
          </p>
        </div>
        {hasAnalyzerSelection ? (
          <>
            <AppCard className="p-4" variant="muted">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-app-accent">
                    {copy.selectedDraft}
                  </p>
                  <h3 className="mt-1 truncate text-[15px] font-semibold text-app-text-primary">
                    {analyzerSeed.title || copy.untitledDraft}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-app-text-secondary">
                    {analyzerSeed.rawJd || analyzerSeed.sourceUrl}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-app-surface px-3 py-1.5 text-[12px] font-semibold text-app-text-tertiary shadow-app-card">
                  {analyzerSeed.draftId ? copy.autoArchiveAfterAnalysis : copy.directAnalysis}
                </span>
              </div>
            </AppCard>
            <HeroAnalyzeInput
              analyticsSource="import_inbox_analyzer"
              initialRawJd={analyzerSeed.rawJd}
              initialSourceUrl={analyzerSeed.sourceUrl}
              key={analyzerSeed.id}
              onJobSaved={handleAnalyzerJobSaved}
              samplePrefilled={samplePrefilled && analyzerSeed.id === "sample"}
              showHeader={false}
              variant="compact"
            />
          </>
        ) : (
          <AppCard className="px-6 py-12 text-center" variant="elevated">
            <h3 className="text-[16px] font-semibold text-app-text-primary">
              {copy.noSelectionTitle}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-app-text-secondary">
              {copy.noSelectionBody}
            </p>
          </AppCard>
        )}
      </section>
    </div>
  );
}

function ImportFlowSteps({
  steps
}: {
  steps: Array<{ body: string; title: string }>;
}) {
  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-3">
      {steps.map((step, index) => (
        <div
          className="min-w-0 rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card backdrop-blur-xl"
          key={step.title}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-app-accent-soft text-[12px] font-semibold text-app-accent">
            {index + 1}
          </span>
          <h2 className="mt-3 break-words text-[14px] font-semibold text-app-text-primary">
            {step.title}
          </h2>
          <p className="mt-1 break-words text-[12px] leading-5 text-app-text-secondary">
            {step.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function trackImportDraftAnalyzed(seed: AnalyzerSeed) {
  if (!seed.draftId) {
    return;
  }

  void import("@/lib/product/analytics").then(({ trackProductEvent }) => {
    trackProductEvent("import_draft_analyzed", {
      draftId: seed.draftId,
      hasSourceUrl: Boolean(seed.sourceUrl.trim()),
      jdLength: seed.rawJd.trim().length
    });
  });
}

function ImportDraftCard({
  copy,
  draft,
  onArchive,
  onDelete,
  onLoad
}: {
  copy: ReturnType<typeof getImportInboxCopy>;
  draft: ImportDraft;
  onArchive: (draft: ImportDraft) => void;
  onDelete: (draft: ImportDraft) => void;
  onLoad: (draft: ImportDraft) => void;
}) {
  return (
    <article className="app-hover-lift relative overflow-hidden rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card backdrop-blur-xl transition duration-300 ease-[var(--app-motion-standard)] hover:border-app-border hover:bg-app-surface-hover">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                draft.status === "active"
                  ? "bg-app-info shadow-app-focus"
                  : "bg-app-text-tertiary"
              )}
            />
            <h3 className="line-clamp-1 text-[14px] font-semibold text-app-text-primary">
              {draft.title}
            </h3>
            <span className="rounded-full bg-app-surface px-2.5 py-1 text-[11px] font-semibold text-app-text-tertiary shadow-app-card">
              {copy.statusLabels[draft.status]}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-app-text-secondary">
            {copy.updatedAt(formatOptionalDate(draft.updated_at, "en-AU", draft.updated_at))}
          </p>
          <p className="mt-3 line-clamp-3 rounded-app border border-app-border-soft bg-app-surface px-3 py-2 text-[13px] leading-5 text-app-text-secondary shadow-app-card">
            {draft.raw_jd}
          </p>
          {draft.source_url ? (
            <a
              className="mt-2 block truncate text-[12px] font-medium text-app-accent hover:text-app-accent-hover"
              href={draft.source_url}
              rel="noreferrer"
              target="_blank"
            >
              {draft.source_url}
            </a>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 border-t border-app-border-soft pt-3 sm:max-w-[170px] sm:border-t-0 sm:pt-0 sm:justify-end">
          <div className="flex flex-col gap-1">
            <Button
              className="min-h-9 px-3 text-[12px]"
              onClick={() => onLoad(draft)}
            >
              {copy.loadIntoAnalyzer}
            </Button>
            {draft.status === "active" ? (
              <span className="text-[11px] leading-4 text-app-text-tertiary">
                {copy.loadNote}
              </span>
            ) : null}
          </div>
          {draft.status === "active" ? (
            <Button
              className="min-h-9 px-3 text-[12px]"
              onClick={() => onArchive(draft)}
              variant="secondary"
            >
              {copy.archive}
            </Button>
          ) : null}
          <Button
            className="min-h-9 px-3 text-[12px]"
            onClick={() => onDelete(draft)}
            variant="ghost"
          >
            {copy.delete}
          </Button>
        </div>
      </div>
    </article>
  );
}



function getImportInboxCopy(language: "en" | "zh") {
  if (language === "zh") {
    return {
      activeDrafts: "待分析",
      autoArchiveAfterAnalysis: "生成职位后自动归档",
      analyzerSubtitle: "保存或载入一个草稿后，在这里确认内容并运行 AI 分析。",
      analyzerTitle: "分析选中草稿",
      analyzedAndArchived: (title: string) => `已完成分析并自动归档：${title}`,
      archive: "归档",
      archived: (title: string) => `已归档：${title}`,
      archivedDrafts: "已归档",
      captureSubtitle: "先保存机会，不必马上分析。适合从招聘网站、邮件或聊天里快速收集 JD。",
      captureTitle: "捕获一个机会",
      charactersNeeded: (count: number) => `还需要 ${count} 个字符才能保存草稿。`,
      deleted: (title: string) => `已删除：${title}`,
      delete: "删除",
      directAnalysis: "直接分析",
      draftTitle: "草稿标题",
      draftTitlePlaceholder: "例如：NorthStar Consulting Analyst",
      emptyActive: "粘贴一段 JD 并保存后，会出现在这里。",
      emptyArchived: "归档后的机会会保留在这里，方便稍后恢复参考。",
      emptyTitle: "暂无草稿",
      filters: {
        active: "待分析",
        archived: "已归档"
      },
      flowSteps: [
        {
          body: "先把 JD 存成草稿，避免还没判断优先级就消耗分析额度。",
          title: "保存草稿"
        },
        {
          body: "从收件箱载入一个草稿，再确认内容和来源链接。",
          title: "选择分析"
        },
        {
          body: "生成职位后自动归档草稿，并进入职位详情做决策。",
          title: "归档并决策"
        }
      ],
      inboxSubtitle: "把还没分析的 JD 放在这里，再决定哪些值得投入。",
      inboxTitle: "待分析草稿",
      loadIntoAnalyzer: "载入分析",
      loaded: (title: string) => `已载入分析器：${title}`,
      loadNote: "成功生成 job 后会自动归档。",
      rawJd: "职位描述",
      rawJdPlaceholder: "粘贴完整 JD，包括职责、要求、地点、工作模式和申请说明。",
      readyToSave: "JD 草稿已可保存。",
      sampleTitle: "示例 JD 草稿",
      saveDraft: "保存到收件箱",
      saved: (title: string) => `已保存到收件箱：${title}`,
      savedAndReady: (title: string) => `已保存到收件箱，并准备分析：${title}`,
      selectedDraft: "已选草稿",
      sourceUrl: "来源链接",
      statusLabels: {
        active: "待分析",
        archived: "已归档"
      },
      subtitle: "先收集机会，再决定分析、改简历、投递和跟进。",
      title: "导入收件箱",
      tooShort: "JD 太短，先补充更多职位信息。",
      noSelectionBody: "先在上方保存一个 JD 草稿，或从 Inbox 载入已有草稿。分析器会在这里展开，避免一进页面就出现两个 JD 输入区。",
      noSelectionTitle: "先选择一个草稿再分析",
      untitledDraft: "未命名草稿",
      updatedAt: (date: string) => `更新于 ${date}`,
      useSample: "使用示例"
    };
  }

  return {
    activeDrafts: "to analyze",
    autoArchiveAfterAnalysis: "Auto-archive after job creation",
    analyzerSubtitle: "Load a draft from the inbox or paste a fresh JD into the existing AI analyzer.",
    analyzerTitle: "Analyze selected JD",
    analyzedAndArchived: (title: string) => `Analyzed and auto-archived: ${title}`,
    archive: "Archive",
    archived: (title: string) => `Archived: ${title}`,
    archivedDrafts: "archived",
    captureSubtitle: "Save opportunities before you analyze them. Useful for collecting JDs from job boards, email, or chat.",
    captureTitle: "Capture an opportunity",
    charactersNeeded: (count: number) => `${count} more characters needed to save a draft.`,
    deleted: (title: string) => `Deleted: ${title}`,
    delete: "Delete",
    directAnalysis: "Direct analysis",
    draftTitle: "Draft title",
    draftTitlePlaceholder: "Example: NorthStar Consulting Analyst",
    emptyActive: "Paste and save a JD draft, then it will appear here.",
    emptyArchived: "Archived opportunities stay here for later reference.",
    emptyTitle: "No drafts yet",
    filters: {
      active: "To analyze",
      archived: "Archived"
    },
    flowSteps: [
      {
        body: "Save the JD first so you can triage before spending analysis credits.",
        title: "Save a draft"
      },
      {
        body: "Load one draft from the inbox, then confirm the text and source URL.",
        title: "Choose analysis"
      },
      {
        body: "After job creation, the draft archives and the decision page opens.",
        title: "Archive and decide"
      }
    ],
    inboxSubtitle: "Keep unanalyzed JDs here before deciding what deserves time.",
    inboxTitle: "Import Inbox",
    loadIntoAnalyzer: "Load to analyze",
    loaded: (title: string) => `Loaded into analyzer: ${title}`,
    loadNote: "Auto-archives after a job is created.",
    rawJd: "Job description",
    rawJdPlaceholder: "Paste the full JD with responsibilities, requirements, location, work mode, and application notes.",
    readyToSave: "JD draft is ready to save.",
    sampleTitle: "Sample JD draft",
    saveDraft: "Save to Inbox",
    saved: (title: string) => `Saved to Inbox: ${title}`,
    savedAndReady: (title: string) => `Saved to Inbox and ready to analyze: ${title}`,
    selectedDraft: "Selected draft",
    sourceUrl: "Source URL",
    statusLabels: {
      active: "To analyze",
      archived: "Archived"
    },
    subtitle: "Collect opportunities first, then decide what to analyze, tailor, apply to, and follow up on.",
    title: "Import Inbox",
    tooShort: "JD is too short. Add more role detail first.",
    noSelectionBody: "Save a JD draft above, or load an existing draft from the inbox. The analyzer opens here only after a draft is selected, so the page does not start with duplicate JD inputs.",
    noSelectionTitle: "Select a draft before analysis",
    untitledDraft: "Untitled draft",
    updatedAt: (date: string) => `Updated ${date}`,
    useSample: "Use sample"
  };
}
