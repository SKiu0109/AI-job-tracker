"use client";

import { APPLICATION_STATUSES, ApplicationStatus } from "@/types/job";
import { AppCard } from "@/components/ui/app-card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

type DeadlineFilter = "all" | "overdue" | "next7" | "next30" | "none";
type MatchFilter = "all" | "high" | "medium" | "low";
type SortMode =
  | "score-desc"
  | "score-asc"
  | "deadline-asc"
  | "deadline-desc"
  | "created-desc"
  | "created-asc";

function ToggleFilter({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-app border px-3 py-2 text-[13px] font-medium shadow-app-card transition-colors hover:bg-app-surface-hover",
        checked
          ? "border-app-info-border bg-app-info-soft text-app-info"
          : "border-app-border-soft bg-app-surface-solid text-app-text-primary"
      )}
    >
      <input
        checked={checked}
        className="app-checkbox h-4 w-4 rounded border border-app-border-soft"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

export function TrackerToolbar({
  batchStatus,
  deadlineApproachingOnly,
  deadlineFilter,
  highMatchOnly,
  jobTypeFilter,
  jobTypes,
  matchFilter,
  needsActionOnly,
  onBatchDelete,
  onBatchStatusChange,
  onBatchStatusUpdate,
  onDeadlineApproachingOnlyChange,
  onDeadlineFilterChange,
  onHighMatchOnlyChange,
  onJobTypeFilterChange,
  onMatchFilterChange,
  onNeedsActionOnlyChange,
  onResetFilters,
  onSearchChange,
  onShowAdvancedFiltersChange,
  onSortModeChange,
  onStatusFilterChange,
  search,
  selectedCount,
  showAdvancedFilters,
  sortMode,
  statusFilter,
  statuses,
  t
}: {
  batchStatus: ApplicationStatus;
  deadlineApproachingOnly: boolean;
  deadlineFilter: DeadlineFilter;
  highMatchOnly: boolean;
  jobTypeFilter: string;
  jobTypes: string[];
  matchFilter: MatchFilter;
  needsActionOnly: boolean;
  onBatchDelete: () => void;
  onBatchStatusChange: (status: ApplicationStatus) => void;
  onBatchStatusUpdate: () => void;
  onDeadlineApproachingOnlyChange: (value: boolean) => void;
  onDeadlineFilterChange: (filter: DeadlineFilter) => void;
  onHighMatchOnlyChange: (value: boolean) => void;
  onJobTypeFilterChange: (value: string) => void;
  onMatchFilterChange: (filter: MatchFilter) => void;
  onNeedsActionOnlyChange: (value: boolean) => void;
  onResetFilters: () => void;
  onSearchChange: (value: string) => void;
  onShowAdvancedFiltersChange: (value: boolean) => void;
  onSortModeChange: (mode: SortMode) => void;
  onStatusFilterChange: (status: ApplicationStatus | "all") => void;
  search: string;
  selectedCount: number;
  showAdvancedFilters: boolean;
  sortMode: SortMode;
  statusFilter: ApplicationStatus | "all";
  statuses: Record<ApplicationStatus, string>;
  t: Record<string, string>;
}) {
  const activeFilterCount = [
    statusFilter !== "all",
    matchFilter !== "all",
    deadlineFilter !== "all",
    jobTypeFilter !== "all",
    highMatchOnly,
    needsActionOnly,
    deadlineApproachingOnly
  ].filter(Boolean).length;

  return (
    <AppCard className="p-4 sm:p-5" variant="muted">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 space-y-1.5">
          <span className="text-xs font-medium text-app-text-secondary">
            {t.search}
          </span>
          <Input
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t.searchPlaceholder}
            value={search}
          />
        </label>

        <label className="w-48 space-y-1.5">
          <span className="text-xs font-medium text-app-text-secondary">
            {t.dateAdded}
          </span>
          <Select
            className="w-full"
            onChange={(event) => onSortModeChange(event.target.value as SortMode)}
            value={sortMode}
          >
            <option value="score-desc">{t.scoreHighToLow}</option>
            <option value="score-asc">{t.scoreLowToHigh}</option>
            <option value="deadline-asc">{t.deadlineSoonest}</option>
            <option value="deadline-desc">{t.deadlineLatest}</option>
            <option value="created-desc">{t.createdNewest}</option>
            <option value="created-asc">{t.createdOldest}</option>
          </Select>
        </label>

        <Button
          aria-expanded={showAdvancedFilters}
          onClick={() => onShowAdvancedFiltersChange(!showAdvancedFilters)}
          variant="secondary"
        >
          {t.moreFilters}
          {activeFilterCount > 0 ? (
            <span className="ml-2 rounded-full bg-app-accent px-2 py-0.5 text-[11px] font-semibold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </div>

      {showAdvancedFilters ? (
        <div className="mt-4 rounded-lg border border-app-border-soft bg-app-surface px-3 py-3 shadow-app-card">
          <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-app-text-secondary">
                {t.status}
              </span>
              <Select
                className="w-full"
                onChange={(event) =>
                  onStatusFilterChange(event.target.value as ApplicationStatus | "all")
                }
                value={statusFilter}
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
              <span className="text-xs font-medium text-app-text-secondary">
                {t.matchFilter}
              </span>
              <Select
                className="w-full"
                onChange={(event) =>
                  onMatchFilterChange(event.target.value as MatchFilter)
                }
                value={matchFilter}
              >
                <option value="all">{t.allMatches}</option>
                <option value="high">{t.highMatch}</option>
                <option value="medium">{t.mediumMatch}</option>
                <option value="low">{t.lowMatch}</option>
              </Select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-app-text-secondary">
                {t.deadlineFilter}
              </span>
              <Select
                className="w-full"
                onChange={(event) =>
                  onDeadlineFilterChange(event.target.value as DeadlineFilter)
                }
                value={deadlineFilter}
              >
                <option value="all">{t.allDeadlines}</option>
                <option value="overdue">{t.overdue}</option>
                <option value="next7">{t.dueNext7}</option>
                <option value="next30">{t.dueNext30}</option>
                <option value="none">{t.noDeadline}</option>
              </Select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-app-text-secondary">
                {t.jobType}
              </span>
              <Select
                className="w-full"
                onChange={(event) => onJobTypeFilterChange(event.target.value)}
                value={jobTypeFilter}
              >
                <option value="all">{t.allJobTypes}</option>
                {jobTypes.map((jobType) => (
                  <option key={jobType} value={jobType}>
                    {jobType}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ToggleFilter
              checked={highMatchOnly}
              label={t.highMatchOnly}
              onChange={onHighMatchOnlyChange}
            />
            <ToggleFilter
              checked={needsActionOnly}
              label={t.needsActionOnly}
              onChange={onNeedsActionOnlyChange}
            />
            <ToggleFilter
              checked={deadlineApproachingOnly}
              label={t.deadlineApproachingOnly}
              onChange={onDeadlineApproachingOnlyChange}
            />

            <Button onClick={onResetFilters} variant="ghost">
              {t.resetFilters}
            </Button>
          </div>
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div className="batch-bar-enter mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-app-border-soft bg-app-surface px-3 py-2 shadow-app-card backdrop-blur-xl">
          <span className="text-[12px] font-semibold text-app-accent">
            {selectedCount} {t.selectedJobs.toLowerCase()}
          </span>
          <Select
            aria-label={t.batchStatus}
            className="w-32"
            onChange={(event) =>
              onBatchStatusChange(event.target.value as ApplicationStatus)
            }
            value={batchStatus}
          >
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statuses[status]}
              </option>
            ))}
          </Select>
          <Button onClick={onBatchStatusUpdate} variant="secondary">
            {t.applyBatchStatus}
          </Button>
          <Button onClick={onBatchDelete} variant="secondary">
            {t.batchDelete}
          </Button>
        </div>
      ) : null}
    </AppCard>
  );
}
