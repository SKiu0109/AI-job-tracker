"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form-controls";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { StatusSelect } from "@/components/jobs/status-select";
import { useLanguage } from "@/lib/i18n/language-provider";
import { formatDate } from "@/lib/utils";
import { loadJobs, updateStoredJobStatus } from "@/lib/storage/jobs";
import {
  APPLICATION_STATUSES,
  ApplicationStatus,
  JobRecord
} from "@/types/job";

type ScoreSort = "desc" | "asc";

export default function JobListPage() {
  const router = useRouter();
  const { language, t, statuses } = useLanguage();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">(
    "all"
  );
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [scoreSort, setScoreSort] = useState<ScoreSort>("desc");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setJobs(loadJobs());
      setIsLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const jobTypes = useMemo(() => {
    return Array.from(
      new Set(jobs.map((job) => job.job_type_en).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return jobs
      .filter((job) => {
        const matchesSearch =
          !query ||
          job.company.toLowerCase().includes(query) ||
          job.job_title_original.toLowerCase().includes(query);
        const matchesStatus =
          statusFilter === "all" || job.application_status === statusFilter;
        const matchesJobType =
          jobTypeFilter === "all" || job.job_type_en === jobTypeFilter;

        return matchesSearch && matchesStatus && matchesJobType;
      })
      .sort((a, b) =>
        scoreSort === "desc"
          ? b.match_score - a.match_score
          : a.match_score - b.match_score
      );
  }, [jobTypeFilter, jobs, scoreSort, search, statusFilter]);

  const handleStatusChange = (jobId: string, status: ApplicationStatus) => {
    updateStoredJobStatus(jobId, status);
    setJobs(loadJobs());
  };

  const locale = language === "zh" ? "zh-CN" : "en-AU";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{t.jobList}</h1>
          <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
        </div>
        <ButtonLink href="/add">{t.emptyAction}</ButtonLink>
      </div>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_180px]">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-ink">{t.search}</span>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.searchPlaceholder}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-ink">{t.status}</span>
            <Select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ApplicationStatus | "all")
              }
              className="w-full"
            >
              <option value="all">{t.allStatuses}</option>
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statuses[status]}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-ink">{t.jobType}</span>
            <Select
              value={jobTypeFilter}
              onChange={(event) => setJobTypeFilter(event.target.value)}
              className="w-full"
            >
              <option value="all">{t.allJobTypes}</option>
              {jobTypes.map((jobType) => (
                <option key={jobType} value={jobType}>
                  {jobType}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-ink">
              {t.sortByScore}
            </span>
            <Select
              value={scoreSort}
              onChange={(event) => setScoreSort(event.target.value as ScoreSort)}
              className="w-full"
            >
              <option value="desc">{t.highToLow}</option>
              <option value="asc">{t.lowToHigh}</option>
            </Select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
        {!isLoaded ? (
          <div className="p-8 text-sm text-muted">{t.analyzing}</div>
        ) : jobs.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <h2 className="text-xl font-semibold text-ink">{t.emptyTitle}</h2>
            <p className="mt-2 max-w-md text-sm text-muted">{t.emptyBody}</p>
            <ButtonLink href="/add" className="mt-5">
              {t.emptyAction}
            </ButtonLink>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
              <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t.company}</th>
                  <th className="px-4 py-3 font-semibold">{t.jobTitle}</th>
                  <th className="px-4 py-3 font-semibold">{t.location}</th>
                  <th className="px-4 py-3 font-semibold">{t.jobType}</th>
                  <th className="px-4 py-3 font-semibold">{t.workMode}</th>
                  <th className="px-4 py-3 font-semibold">{t.matchScore}</th>
                  <th className="px-4 py-3 font-semibold">{t.status}</th>
                  <th className="px-4 py-3 font-semibold">{t.keySkills}</th>
                  <th className="px-4 py-3 font-semibold">{t.createdDate}</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-muted">
                      {t.noMatches}
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      className="cursor-pointer border-b border-line transition last:border-b-0 hover:bg-paper"
                    >
                      <td className="max-w-44 px-4 py-3 font-medium text-ink">
                        <span className="line-clamp-2">{job.company}</span>
                      </td>
                      <td className="max-w-64 px-4 py-3 text-ink">
                        <span className="line-clamp-2">
                          {job.job_title_original}
                        </span>
                      </td>
                      <td className="max-w-44 px-4 py-3 text-muted">
                        <span className="line-clamp-2">{job.location}</span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {language === "zh" ? job.job_type_zh : job.job_type_en}
                      </td>
                      <td className="px-4 py-3 text-muted">{job.work_mode}</td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={job.match_score} />
                      </td>
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <StatusSelect
                          value={job.application_status}
                          onChange={(status) => handleStatusChange(job.id, status)}
                          compact
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-64 flex-wrap gap-1.5">
                          {job.skills.slice(0, 3).map((skill) => (
                            <Badge key={skill}>{skill}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {formatDate(job.created_at, locale)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
