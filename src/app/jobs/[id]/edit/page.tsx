"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AppCard } from "@/components/ui/app-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form-controls";
import { StatusSelect } from "@/components/jobs/status-select";
import { useAuth } from "@/lib/auth/auth-provider";
import { getCompanyLogoMetadata } from "@/lib/company-logo";
import { useLanguage } from "@/lib/i18n/language-provider";
import {
  deleteCloudJob,
  hydrateJobsFromCloud,
  upsertCloudJob
} from "@/lib/storage/cloud-sync";
import {
  deleteStoredJob,
  updateStoredJob
} from "@/lib/storage/jobs";
import { createStorageScope } from "@/lib/storage/scope";
import {
  ACTION_STAGES,
  ActionStage,
  ApplicationStatus,
  JobRecord,
  WORK_MODES,
  WorkMode
} from "@/types/job";

type EditFormState = {
  company: string;
  job_title_original: string;
  job_title_zh: string;
  job_title_en: string;
  location: string;
  work_mode: WorkMode;
  job_type_en: string;
  job_type_zh: string;
  application_status: ApplicationStatus;
  application_deadline: string;
  application_channel: string;
  contact_person: string;
  interview_date: string;
  follow_up_date: string;
  action_stage: ActionStage;
  next_step_note: string;
  source_url: string;
  notes: string;
  follow_up_notes: string;
  status_note: string;
};

const EMPTY_FORM: EditFormState = {
  company: "",
  job_title_original: "",
  job_title_zh: "",
  job_title_en: "",
  location: "",
  work_mode: "Not specified",
  job_type_en: "",
  job_type_zh: "",
  application_status: "Not Applied",
  application_deadline: "",
  application_channel: "",
  contact_person: "",
  interview_date: "",
  follow_up_date: "",
  action_stage: "needs_review",
  next_step_note: "",
  source_url: "",
  notes: "",
  follow_up_notes: "",
  status_note: ""
};

export default function EditJobPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { language, t } = useLanguage();
  const storageScope = createStorageScope(session?.user.id);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [form, setForm] = useState<EditFormState>(EMPTY_FORM);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      hydrateJobsFromCloud(session)
        .then((jobs) => {
          const storedJob = jobs.find((item) => item.id === params.id) ?? null;
          setJob(storedJob);
          setForm(storedJob ? createFormState(storedJob, language) : EMPTY_FORM);
        })
        .finally(() => setIsLoaded(true));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [language, params.id, session]);

  const updateField = <Key extends keyof EditFormState>(
    key: Key,
    value: EditFormState[Key]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const logoMetadata = getCompanyLogoMetadata(form.source_url);

    const updatedJob = updateStoredJob(
      params.id,
      {
        company: form.company,
        job_title_original: form.job_title_original,
        job_title_zh: form.job_title_zh,
        job_title_en: form.job_title_en,
        location: form.location,
        work_mode: form.work_mode,
        job_type_en: form.job_type_en,
        job_type_zh: form.job_type_zh,
        application_status: form.application_status,
        application_deadline: form.application_deadline,
        application_channel: form.application_channel,
        contact_person: form.contact_person,
        interview_date: form.interview_date,
        follow_up_date: form.follow_up_date,
        action_stage: form.action_stage,
        next_step_note: form.next_step_note,
        company_domain: logoMetadata.company_domain,
        company_logo_url: logoMetadata.company_logo_url,
        source_url: form.source_url,
        notes: form.notes,
        follow_up_notes: form.follow_up_notes
      },
      form.status_note,
      storageScope
    );

    if (updatedJob) {
      void upsertCloudJob(session, updatedJob);
      router.push(`/jobs/${updatedJob.id}`);
    }
  };

  const handleDelete = () => {
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }

    deleteStoredJob(params.id, storageScope);
    void deleteCloudJob(session, params.id);
    router.push("/workspace");
  };

  if (!isLoaded) {
    return (
      <AppCard className="p-6" variant="elevated">
        {t.analyzing}
      </AppCard>
    );
  }

  if (!job) {
    return (
      <AppCard className="p-8 text-center" variant="elevated">
        <h1 className="text-xl font-semibold text-app-text-primary">{t.notFound}</h1>
        <p className="mt-2 text-sm text-app-text-secondary">{t.notFoundBody}</p>
        <ButtonLink href="/workspace" className="mt-5">
          {t.backToList}
        </ButtonLink>
      </AppCard>
    );
  }

  return (
    <div className="app-stagger mx-auto max-w-4xl space-y-5">
      <Link
        href={`/jobs/${params.id}`}
        className="text-sm font-semibold text-app-accent transition-colors hover:text-app-accent-hover"
      >
        {t.backToDetail}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-app-text-primary">{t.editJob}</h1>
          <p className="mt-1 text-sm text-app-text-secondary">
            {language === "zh" ? job.job_title_zh : job.job_title_en || job.job_title_original}
          </p>
        </div>
        <Button className="text-red-600 hover:text-red-700" variant="secondary" onClick={handleDelete}>
          {t.deleteJob}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="app-stagger space-y-4">
        <AppCard className="space-y-5 p-4 sm:p-5" variant="elevated">
          <FormSectionTitle
            title={language === "zh" ? "申请进度" : "Application progress"}
            subtitle={language === "zh" ? "状态、日期和下一步动作。" : "Status, dates, and the next action."}
          />
          <div className="app-stagger grid gap-4 sm:grid-cols-2">
            <Field label={t.status}>
              <StatusSelect
                value={form.application_status}
                onChange={(status) => updateField("application_status", status)}
              />
            </Field>
            <Field label={t.statusChangeNote}>
              <Input
                value={form.status_note}
                onChange={(event) => updateField("status_note", event.target.value)}
                placeholder={t.statusChangeNotePlaceholder}
              />
            </Field>
          </div>

          <div className="app-stagger grid gap-4 sm:grid-cols-2">
            <Field label={t.deadline}>
              <Input
                type="date"
                value={form.application_deadline}
                onChange={(event) =>
                  updateField("application_deadline", event.target.value)
                }
              />
            </Field>
            <Field label={t.interviewDate}>
              <Input
                type="datetime-local"
                value={form.interview_date}
                onChange={(event) =>
                  updateField("interview_date", event.target.value)
                }
              />
            </Field>
          </div>

          <div className="app-stagger grid gap-4 sm:grid-cols-3">
            <Field label={language === "zh" ? "行动阶段" : "Action Stage"}>
              <Select
                value={form.action_stage}
                onChange={(event) =>
                  updateField("action_stage", event.target.value as ActionStage)
                }
                className="w-full"
              >
                {ACTION_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {getActionStageLabel(stage, language)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={language === "zh" ? "跟进日期" : "Follow-up Date"}>
              <Input
                type="date"
                value={form.follow_up_date}
                onChange={(event) =>
                  updateField("follow_up_date", event.target.value)
                }
              />
            </Field>
            <Field label={language === "zh" ? "下一步备注" : "Next Step"}>
              <Input
                value={form.next_step_note}
                onChange={(event) =>
                  updateField("next_step_note", event.target.value)
                }
                placeholder={
                  language === "zh"
                    ? "例如：今天补 2 条简历 bullet"
                    : "Example: add 2 tailored resume bullets today"
                }
              />
            </Field>
          </div>
        </AppCard>

        <AppCard className="space-y-5 p-4 sm:p-5" variant="elevated">
          <FormSectionTitle
            title={language === "zh" ? "跟进资料" : "Tracking details"}
            subtitle={language === "zh" ? "渠道、联系人和你的备注。" : "Source, contact, and private notes."}
          />
          <div className="app-stagger grid gap-4 sm:grid-cols-2">
            <Field label={t.applicationChannel}>
              <Input
                value={form.application_channel}
                onChange={(event) =>
                  updateField("application_channel", event.target.value)
                }
                placeholder={t.applicationChannelPlaceholder}
              />
            </Field>
            <Field label={t.contactPerson}>
              <Input
                value={form.contact_person}
                onChange={(event) => updateField("contact_person", event.target.value)}
                placeholder={t.contactPersonPlaceholder}
              />
            </Field>
          </div>

          <Field label={t.sourceUrl}>
            <Input
              type="url"
              value={form.source_url}
              onChange={(event) => updateField("source_url", event.target.value)}
              placeholder={t.sourceUrlPlaceholder}
            />
          </Field>

          <Field label={t.notes}>
            <Textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder={t.notesPlaceholder}
              rows={4}
            />
          </Field>

          <Field label={t.followUpNotes}>
            <Textarea
              value={form.follow_up_notes}
              onChange={(event) => updateField("follow_up_notes", event.target.value)}
              placeholder={t.followUpNotesPlaceholder}
              rows={4}
            />
          </Field>
        </AppCard>

        <AppCard className="overflow-hidden" variant="elevated">
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 transition duration-300 ease-[var(--app-motion-standard)] hover:bg-app-surface-hover sm:px-5 [&::-webkit-details-marker]:hidden">
              <FormSectionTitle
                title={language === "zh" ? "职位信息（高级）" : "Role details (advanced)"}
                subtitle={language === "zh" ? "公司、标题、岗位类型和工作方式。" : "Company, title, job type, and work mode."}
              />
              <span className="shrink-0 rounded-full bg-app-surface px-3 py-1 text-[12px] font-semibold text-app-text-secondary shadow-app-card">
                {language === "zh" ? "展开" : "Expand"}
              </span>
            </summary>

            <div className="space-y-5 border-t border-app-border-soft bg-app-surface-subtle p-4 sm:p-5">
              <div className="app-stagger grid gap-4 sm:grid-cols-2">
                <Field label={t.company}>
                  <Input
                    value={form.company}
                    onChange={(event) => updateField("company", event.target.value)}
                  />
                </Field>
                <Field label={t.location}>
                  <Input
                    value={form.location}
                    onChange={(event) => updateField("location", event.target.value)}
                  />
                </Field>
              </div>

              <div className="app-stagger grid gap-4 sm:grid-cols-3">
                <Field label={t.originalJobTitle}>
                  <Input
                    value={form.job_title_original}
                    onChange={(event) =>
                      updateField("job_title_original", event.target.value)
                    }
                  />
                </Field>
                <Field label={t.chineseJobTitle}>
                  <Input
                    value={form.job_title_zh}
                    onChange={(event) => updateField("job_title_zh", event.target.value)}
                  />
                </Field>
                <Field label={t.englishJobTitle}>
                  <Input
                    value={form.job_title_en}
                    onChange={(event) => updateField("job_title_en", event.target.value)}
                  />
                </Field>
              </div>

              <div className="app-stagger grid gap-4 sm:grid-cols-3">
                <Field label={t.jobType}>
                  <Input
                    value={form.job_type_en}
                    onChange={(event) => updateField("job_type_en", event.target.value)}
                  />
                </Field>
                <Field label={language === "zh" ? "中文岗位类型" : "Chinese job type"}>
                  <Input
                    value={form.job_type_zh}
                    onChange={(event) => updateField("job_type_zh", event.target.value)}
                  />
                </Field>
                <Field label={t.workMode}>
                  <Select
                    value={form.work_mode}
                    onChange={(event) =>
                      updateField("work_mode", event.target.value as WorkMode)
                    }
                    className="w-full"
                  >
                    {WORK_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          </details>
        </AppCard>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <ButtonLink href={`/jobs/${params.id}`} variant="secondary">
            {t.cancel}
          </ButtonLink>
          <Button type="submit">{t.saveChanges}</Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function FormSectionTitle({
  subtitle,
  title
}: {
  subtitle: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-app-text-primary">{title}</h2>
      <p className="mt-1 text-[13px] leading-5 text-app-text-secondary">{subtitle}</p>
    </div>
  );
}

function createFormState(
  job: JobRecord,
  language: "en" | "zh"
): EditFormState {
  return {
    company: job.company,
    job_title_original: job.job_title_original,
    job_title_zh: job.job_title_zh,
    job_title_en: job.job_title_en || "",
    location: job.location,
    work_mode: job.work_mode,
    job_type_en: job.job_type_en,
    job_type_zh: job.job_type_zh,
    application_status: job.application_status,
    application_deadline: job.application_deadline || "",
    application_channel: localizeDefaultChannel(job.application_channel || "", language),
    contact_person: job.contact_person || "",
    interview_date: job.interview_date || "",
    follow_up_date: job.follow_up_date || "",
    action_stage: job.action_stage,
    next_step_note: localizeDefaultNextStepNote(
      job.next_step_note || "",
      job.action_stage,
      language
    ),
    source_url: job.source_url,
    notes: localizeSampleNote(job.notes, language),
    follow_up_notes: job.follow_up_notes || "",
    status_note: ""
  };
}

function localizeDefaultNextStepNote(
  note: string,
  stage: ActionStage,
  language: "en" | "zh"
) {
  const trimmedNote = note.trim();
  if (language !== "zh" || !trimmedNote || containsCjk(trimmedNote)) {
    return note;
  }

  const defaultNotes: Record<ActionStage, { en: string[]; zh: string }> = {
    follow_up: {
      en: ["Send a concise follow-up or prepare the interview note."],
      zh: "检查当前状态，决定是否需要发跟进信息。"
    },
    needs_review: {
      en: ["Review fit evidence and decide whether this role deserves time."],
      zh: "判断这个机会是否值得投入时间。"
    },
    parked: {
      en: [
        "Keep as lower priority unless the fit changes.",
        "Keep as lower priority unless the fit or timeline changes."
      ],
      zh: "低优先级保存，除非匹配度或时间线变化。"
    },
    ready_to_apply: {
      en: ["Review final resume keywords and submit today."],
      zh: "确认简历关键词并完成投递。"
    },
    tailor_resume: {
      en: ["Draft a targeted summary and 2-3 role-specific bullets."],
      zh: "先完成定制摘要和 2-3 条岗位相关 bullet。"
    }
  };

  return defaultNotes[stage].en.includes(trimmedNote)
    ? defaultNotes[stage].zh
    : note;
}

function localizeSampleNote(note: string, language: "en" | "zh") {
  if (language !== "zh") return note;
  if (note.trim() === "Sample record. Replace with your own notes when applying.") {
    return "示例记录。投递前可替换为自己的备注。";
  }
  return note;
}

function localizeDefaultChannel(channel: string, language: "en" | "zh") {
  if (language !== "zh") return channel;

  const channels: Record<string, string> = {
    "Company website": "公司官网",
    Referral: "内推"
  };

  return channels[channel.trim()] ?? channel;
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function getActionStageLabel(stage: ActionStage, language: "en" | "zh") {
  const labels: Record<ActionStage, { en: string; zh: string }> = {
    needs_review: { en: "Needs Review", zh: "待判断" },
    tailor_resume: { en: "Tailor Resume", zh: "改简历" },
    ready_to_apply: { en: "Ready to Apply", zh: "可投递" },
    follow_up: { en: "Follow Up", zh: "待跟进" },
    parked: { en: "Parked", zh: "暂缓" }
  };

  return labels[stage][language];
}
