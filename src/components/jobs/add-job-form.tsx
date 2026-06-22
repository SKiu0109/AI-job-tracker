"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form-controls";
import { useLanguage } from "@/lib/i18n/language-provider";
import { SAMPLE_JD, SAMPLE_SOURCE_URL } from "@/lib/sample-jd";
import { formatCandidateProfile } from "@/lib/candidate-profile";
import {
  createAnalysisCacheKey,
  createInitialStatusHistory,
  readCachedAnalysis,
  saveJob,
  writeCachedAnalysis
} from "@/lib/storage/jobs";
import { loadCandidateProfile } from "@/lib/storage/candidate-profile";
import { JobAnalysis, JobRecord } from "@/types/job";

type AnalyzeResponse = {
  analysis?: JobAnalysis;
  error?: string;
  code?: "missing_api_key" | "analysis_failed";
};

export function AddJobForm({
  initialRawJd = "",
  initialSourceUrl = "",
  samplePrefilled = false
}: {
  initialRawJd?: string;
  initialSourceUrl?: string;
  samplePrefilled?: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [deadline, setDeadline] = useState("");
  const [applicationChannel, setApplicationChannel] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [rawJd, setRawJd] = useState(initialRawJd);
  const [notes, setNotes] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(samplePrefilled ? t.sampleLoaded : "");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fillSampleJd = () => {
    setRawJd(SAMPLE_JD);
    setSourceUrl((currentValue) => currentValue || SAMPLE_SOURCE_URL);
    setError("");
    setInfo(t.sampleLoaded);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setInfo("");

    if (!rawJd.trim()) {
      setError(t.rawJdRequired);
      return;
    }

    const candidateProfileText = formatCandidateProfile(loadCandidateProfile());
    const cacheKey = createAnalysisCacheKey(rawJd, candidateProfileText);
    const cachedAnalysis = readCachedAnalysis(cacheKey);

    if (cachedAnalysis) {
      setInfo(t.analysisCached);
      const job = createJobRecord({
        analysis: cachedAnalysis,
        sourceUrl,
        rawJd,
        notes,
        deadline,
        applicationChannel,
        contactPerson,
        interviewDate,
        followUpNotes
      });
      saveJob(job);
      router.push(`/jobs/${job.id}`);
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/analyze-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source_url: sourceUrl.trim() || undefined,
          raw_jd: rawJd,
          candidate_profile: candidateProfileText
        })
      });

      const payload = (await response.json().catch(() => ({}))) as AnalyzeResponse;

      if (!response.ok || !payload.analysis) {
        if (payload.code === "missing_api_key") {
          throw new Error(t.missingApiKey);
        }

        throw new Error(payload.error || t.analysisFailed);
      }

      writeCachedAnalysis(cacheKey, payload.analysis);
      const job = createJobRecord({
        analysis: payload.analysis,
        sourceUrl,
        rawJd,
        notes,
        deadline,
        applicationChannel,
        contactPerson,
        interviewDate,
        followUpNotes
      });
      saveJob(job);
      router.push(`/jobs/${job.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t.analysisFailed
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{t.addJob}</h1>
        <p className="mt-1 text-sm text-muted">{t.defaultProfileHint}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-md border border-line bg-white p-4 shadow-soft sm:p-5"
      >
        <div className="space-y-2">
          <Label htmlFor="source-url">{t.sourceUrl}</Label>
          <Input
            id="source-url"
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder={t.sourceUrlPlaceholder}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="deadline">{t.deadline}</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interview-date">{t.interviewDate}</Label>
            <Input
              id="interview-date"
              type="datetime-local"
              value={interviewDate}
              onChange={(event) => setInterviewDate(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="application-channel">{t.applicationChannel}</Label>
            <Input
              id="application-channel"
              value={applicationChannel}
              onChange={(event) => setApplicationChannel(event.target.value)}
              placeholder={t.applicationChannelPlaceholder}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-person">{t.contactPerson}</Label>
            <Input
              id="contact-person"
              value={contactPerson}
              onChange={(event) => setContactPerson(event.target.value)}
              placeholder={t.contactPersonPlaceholder}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="raw-jd">{t.rawJd}</Label>
            <a
              href="/add?sample=1"
              onClick={(event) => {
                event.preventDefault();
                fillSampleJd();
              }}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper sm:min-h-9 sm:w-auto sm:px-3 sm:py-1.5"
            >
              {t.useSampleJd}
            </a>
          </div>
          <Textarea
            id="raw-jd"
            value={rawJd}
            onChange={(event) => setRawJd(event.target.value)}
            placeholder={t.rawJdPlaceholder}
            rows={14}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="follow-up-notes">{t.followUpNotes}</Label>
          <Textarea
            id="follow-up-notes"
            value={followUpNotes}
            onChange={(event) => setFollowUpNotes(event.target.value)}
            placeholder={t.followUpNotesPlaceholder}
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">{t.notes}</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t.notesPlaceholder}
            rows={4}
          />
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-danger">
            {error}
          </div>
        ) : null}

        {info ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {info}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button type="submit" disabled={isAnalyzing} className="w-full sm:w-auto">
            {isAnalyzing ? t.analyzing : t.analyzeAndSaveJob}
          </Button>
        </div>
      </form>
    </div>
  );
}

function createJobRecord({
  analysis,
  sourceUrl,
  rawJd,
  notes,
  deadline,
  applicationChannel,
  contactPerson,
  interviewDate,
  followUpNotes
}: {
  analysis: JobAnalysis;
  sourceUrl: string;
  rawJd: string;
  notes: string;
  deadline: string;
  applicationChannel: string;
  contactPerson: string;
  interviewDate: string;
  followUpNotes: string;
}): JobRecord {
  const now = new Date().toISOString();

  return {
    ...analysis,
    id: createId(),
    application_status: "Not Applied",
    application_deadline: deadline,
    application_channel: applicationChannel.trim(),
    contact_person: contactPerson.trim(),
    interview_date: interviewDate,
    follow_up_notes: followUpNotes.trim(),
    status_history: createInitialStatusHistory(now),
    source_url: sourceUrl.trim(),
    raw_jd: rawJd,
    notes: notes.trim(),
    created_at: now,
    updated_at: now
  };
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
