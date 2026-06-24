"use client";

import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { useLanguage } from "@/lib/i18n/language-provider";
import { trackProductEvent } from "@/lib/product/analytics";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
import { saveJobs } from "@/lib/storage/jobs";

export default function LandingPage() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const previewJobs = SAMPLE_JOBS.slice(0, 4);

  const handleTryDemo = () => {
    saveJobs(SAMPLE_JOBS);
    trackProductEvent("demo_sample_loaded", {
      jobCount: SAMPLE_JOBS.length,
      source: "landing"
    });
    router.push("/workspace");
  };

  return (
    <div className="space-y-14 pb-10">
      <section className="grid min-h-[calc(100vh-170px)] items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(520px,1.08fr)]">
        <div className="max-w-2xl">
          <h1 className="text-5xl font-semibold tracking-normal text-ink sm:text-6xl lg:text-7xl">
            {t.landingTitle}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
            {t.landingSubtitle}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleTryDemo} className="w-full sm:w-auto">
              {t.tryDemo}
            </Button>
            <ButtonLink href="/workspace" variant="secondary">
              {t.openWorkspace}
            </ButtonLink>
          </div>
          <div className="mt-8 grid gap-3 text-sm font-semibold text-muted sm:grid-cols-3">
            <TrustPoint value={t.landingTrustLocal} />
            <TrustPoint value={t.landingTrustBilingual} />
            <TrustPoint value={t.landingTrustControlled} />
          </div>
        </div>

        <ProductPreview
          jobs={previewJobs}
          language={language}
          labels={{
            tracker: t.jobList,
            dashboard: t.dashboard,
            roleCompany: t.roleCompany,
            status: t.status,
            matchScore: t.matchScore,
            nextAction: t.nextAction,
            applications: t.applications,
            averageMatchScore: t.averageMatchScore,
            interviews: t.interviewCount,
            offers: t.offers
          }}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <h2 className="text-3xl font-semibold tracking-normal text-ink">
            {t.landingWhyTitle}
          </h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted">
            {t.landingWhyBody}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ValueBlock title={t.landingValueFit} body={t.landingValueFitBody} />
          <ValueBlock
            title={t.landingValueAction}
            body={t.landingValueActionBody}
          />
          <ValueBlock
            title={t.landingValuePortfolio}
            body={t.landingValuePortfolioBody}
          />
        </div>
      </section>

      <section className="grid gap-5 rounded-panel border border-line bg-white p-5 shadow-panel lg:grid-cols-[1fr_1fr] lg:p-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-normal text-ink">
            {t.landingDemoTitle}
          </h2>
          <p className="mt-3 text-base leading-7 text-muted">
            {t.landingDemoBody}
          </p>
          <Button onClick={handleTryDemo} className="mt-6">
            {t.tryDemo}
          </Button>
        </div>
        <ol className="grid gap-3">
          {[t.landingDemoStep1, t.landingDemoStep2, t.landingDemoStep3].map(
            (step, index) => (
              <li
                key={step}
                className="grid grid-cols-[36px_1fr] items-start gap-3 rounded-panel border border-line bg-surface-muted p-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-app bg-accent text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-sm font-medium leading-6 text-ink">
                  {step}
                </span>
              </li>
            )
          )}
        </ol>
      </section>
    </div>
  );
}

function TrustPoint({ value }: { value: string }) {
  return (
    <div className="rounded-app border border-line bg-white px-3 py-2 shadow-soft">
      {value}
    </div>
  );
}

function ValueBlock({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-panel border border-line bg-white p-4 shadow-soft">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </article>
  );
}

function ProductPreview({
  jobs,
  language,
  labels
}: {
  jobs: typeof SAMPLE_JOBS;
  language: "en" | "zh";
  labels: {
    tracker: string;
    dashboard: string;
    roleCompany: string;
    status: string;
    matchScore: string;
    nextAction: string;
    applications: string;
    averageMatchScore: string;
    interviews: string;
    offers: string;
  };
}) {
  return (
    <div className="rounded-panel border border-line bg-white shadow-panel">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">{labels.tracker}</h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-accent">
            {labels.dashboard}
          </span>
        </div>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_210px]">
        <div className="overflow-hidden">
          <div className="hidden grid-cols-[1.4fr_0.7fr_0.7fr_1fr] border-b border-line bg-surface-muted px-4 py-2 text-xs font-semibold text-muted sm:grid">
            <span>{labels.roleCompany}</span>
            <span>{labels.status}</span>
            <span>{labels.matchScore}</span>
            <span>{labels.nextAction}</span>
          </div>
          <div>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="grid gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[1.4fr_0.7fr_0.7fr_1fr] sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CompanyLogo company={job.company} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {language === "zh" ? job.job_title_zh : job.job_title_original}
                    </p>
                    <p className="truncate text-xs text-muted">{job.company}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-muted">
                  {job.application_status}
                </span>
                <ScoreBadge score={job.match_score} />
                <span className="line-clamp-2 text-xs font-medium text-muted">
                  {job.recommended_next_action.action}
                </span>
              </div>
            ))}
          </div>
        </div>
        <aside className="grid grid-cols-2 gap-3 border-t border-line bg-surface-muted p-4 lg:border-l lg:border-t-0">
          <PreviewMetric label={labels.applications} value={SAMPLE_JOBS.length} />
          <PreviewMetric label={labels.averageMatchScore} value="78%" />
          <PreviewMetric label={labels.interviews} value="1" />
          <PreviewMetric label={labels.offers} value="0" />
        </aside>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-panel border border-line bg-white p-3 shadow-soft">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
