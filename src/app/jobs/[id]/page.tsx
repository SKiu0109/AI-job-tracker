"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DetailSection } from "@/components/jobs/detail-section";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { StatusSelect } from "@/components/jobs/status-select";
import { useLanguage } from "@/lib/i18n/language-provider";
import { formatDate } from "@/lib/utils";
import { getStoredJob, updateStoredJobStatus } from "@/lib/storage/jobs";
import { ApplicationStatus, JobRecord } from "@/types/job";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const { language, t } = useLanguage();
  const [job, setJob] = useState<JobRecord | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setJob(getStoredJob(params.id) ?? null);
      setIsLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [params.id]);

  const handleStatusChange = (status: ApplicationStatus) => {
    const updatedJob = updateStoredJobStatus(params.id, status);
    if (updatedJob) {
      setJob(updatedJob);
    }
  };

  if (!isLoaded) {
    return <div className="rounded-md border border-line bg-white p-6">{t.analyzing}</div>;
  }

  if (!job) {
    return (
      <div className="rounded-md border border-line bg-white p-8 text-center shadow-soft">
        <h1 className="text-xl font-semibold text-ink">{t.notFound}</h1>
        <p className="mt-2 text-sm text-muted">{t.notFoundBody}</p>
        <ButtonLink href="/" className="mt-5">
          {t.backToList}
        </ButtonLink>
      </div>
    );
  }

  const locale = language === "zh" ? "zh-CN" : "en-AU";

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm font-semibold text-accent hover:underline">
        {t.backToList}
      </Link>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">{job.company}</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">
              {job.job_title_original}
            </h1>
            <p className="mt-2 text-base text-muted">{job.job_title_zh}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ScoreBadge score={job.match_score} />
            <StatusSelect
              value={job.application_status}
              onChange={handleStatusChange}
            />
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetaItem label={t.location} value={job.location} />
          <MetaItem label={t.workMode} value={job.work_mode} />
          <MetaItem
            label={t.jobType}
            value={`${job.job_type_en} / ${job.job_type_zh}`}
          />
          <MetaItem
            label={t.createdDate}
            value={formatDate(job.created_at, locale)}
          />
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title={t.summary}>
          <BilingualText en={job.ai_summary_en} zh={job.ai_summary_zh} />
        </DetailSection>

        <DetailSection title={t.education}>
          <BilingualText
            en={job.education_requirement_en}
            zh={job.education_requirement_zh}
          />
        </DetailSection>

        <DetailSection title={t.experience}>
          <BilingualText
            en={job.experience_requirement_en}
            zh={job.experience_requirement_zh}
          />
        </DetailSection>

        <DetailSection title={t.resumeKeywords}>
          <TagList values={job.resume_keywords} />
        </DetailSection>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title={t.responsibilities}>
          <BilingualList en={job.responsibilities_en} zh={job.responsibilities_zh} />
        </DetailSection>

        <DetailSection title={t.requirements}>
          <BilingualList en={job.requirements_en} zh={job.requirements_zh} />
        </DetailSection>

        <DetailSection title={t.niceToHave}>
          <BilingualList en={job.nice_to_have_en} zh={job.nice_to_have_zh} />
        </DetailSection>

        <DetailSection title={`${t.skills} / ${t.tools}`}>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-muted">{t.skills}</h3>
              <TagList values={job.skills} className="mt-2" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted">{t.tools}</h3>
              <TagList values={job.tools} className="mt-2" />
            </div>
          </div>
        </DetailSection>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title={t.sourceUrl}>
          {job.source_url ? (
            <a
              href={job.source_url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm font-semibold text-accent hover:underline"
            >
              {job.source_url}
            </a>
          ) : (
            <p className="text-sm text-muted">Not provided</p>
          )}
        </DetailSection>

        <DetailSection title={t.notes}>
          <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
            {job.notes || "Not provided"}
          </p>
        </DetailSection>
      </div>

      <DetailSection title={t.rawJdText}>
        <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-line bg-paper p-4 text-sm leading-6 text-ink">
          {job.raw_jd}
        </pre>
      </DetailSection>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-paper px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function BilingualText({ en, zh }: { en: string; zh: string }) {
  const { t } = useLanguage();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold text-muted">{t.english}</h3>
        <p className="mt-2 text-sm leading-6 text-ink">{en}</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-muted">{t.chinese}</h3>
        <p className="mt-2 text-sm leading-6 text-ink">{zh}</p>
      </div>
    </div>
  );
}

function BilingualList({ en, zh }: { en: string[]; zh: string[] }) {
  const { t } = useLanguage();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ListBlock title={t.english} values={en} />
      <ListBlock title={t.chinese} values={zh} />
    </div>
  );
}

function ListBlock({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted">{title}</h3>
      {values.length ? (
        <ul className="mt-2 space-y-2 text-sm leading-6 text-ink">
          {values.map((value) => (
            <li key={value} className="rounded-md bg-paper px-3 py-2">
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Not specified</p>
      )}
    </div>
  );
}

function TagList({
  values,
  className
}: {
  values: string[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {values.length ? (
        values.map((value) => <Badge key={value}>{value}</Badge>)
      ) : (
        <p className="text-sm text-muted">Not specified</p>
      )}
    </div>
  );
}
