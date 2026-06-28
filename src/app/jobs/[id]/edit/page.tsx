"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form-controls";
import { StatusSelect } from "@/components/jobs/status-select";
import { useLanguage } from "@/lib/i18n/language-provider";
import {
  deleteStoredJob,
  loadJobs,
  updateStoredJob
} from "@/lib/storage/jobs";
import { ApplicationStatus, JobRecord, WORK_MODES, WorkMode } from "@/types/job";

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
  source_url: "",
  notes: "",
  follow_up_notes: "",
  status_note: ""
};

export default function EditJobPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { language, t } = useLanguage();
  const [job, setJob] = useState<JobRecord | null>(null);
  const [form, setForm] = useState<EditFormState>(EMPTY_FORM);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const jobs = loadJobs();
      const storedJob = jobs.find((item) => item.id === params.id) ?? null;
      setJob(storedJob);
      setForm(storedJob ? createFormState(storedJob) : EMPTY_FORM);
      setIsLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [params.id]);

  const updateField = <Key extends keyof EditFormState>(
    key: Key,
    value: EditFormState[Key]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
        source_url: form.source_url,
        notes: form.notes,
        follow_up_notes: form.follow_up_notes
      },
      form.status_note
    );

    if (updatedJob) {
      router.push(`/jobs/${updatedJob.id}`);
    }
  };

  const handleDelete = () => {
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }

    deleteStoredJob(params.id);
    router.push("/workspace");
  };

  if (!isLoaded) {
    return (
      <div className="rounded-panel border border bg-tertiary p-6 ">
        {t.analyzing}
      </div>
    );
  }

  if (!job) {
    return (
      <div className="rounded-panel border border bg-tertiary p-8 text-center ">
        <h1 className="text-xl font-semibold text-primary">{t.notFound}</h1>
        <p className="mt-2 text-sm text-secondary">{t.notFoundBody}</p>
        <ButtonLink href="/workspace" className="mt-5">
          {t.backToList}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href={`/jobs/${params.id}`}
        className="text-sm font-semibold text-accent hover:underline"
      >
        {t.backToDetail}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t.editJob}</h1>
          <p className="mt-1 text-sm text-secondary">
            {language === "zh" ? job.job_title_zh : job.job_title_en || job.job_title_original}
          </p>
        </div>
        <Button variant="secondary" onClick={handleDelete}>
          {t.deleteJob}
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-panel border border bg-tertiary p-4  sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="grid gap-4 sm:grid-cols-3">
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

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t.jobType}>
            <Input
              value={form.job_type_en}
              onChange={(event) => updateField("job_type_en", event.target.value)}
            />
          </Field>
          <Field label={t.chineseJobTitle}>
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

        <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="grid gap-4 sm:grid-cols-2">
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

function createFormState(job: JobRecord): EditFormState {
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
    application_channel: job.application_channel || "",
    contact_person: job.contact_person || "",
    interview_date: job.interview_date || "",
    source_url: job.source_url,
    notes: job.notes,
    follow_up_notes: job.follow_up_notes || "",
    status_note: ""
  };
}
