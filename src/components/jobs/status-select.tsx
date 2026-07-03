"use client";

import { Select } from "@/components/ui/form-controls";
import { useLanguage } from "@/lib/i18n/language-provider";
import { APPLICATION_STATUSES, ApplicationStatus } from "@/types/job";

export function StatusSelect({
  value,
  onChange,
  compact = false
}: {
  value: ApplicationStatus;
  onChange: (value: ApplicationStatus) => void;
  compact?: boolean;
}) {
  const { language, statuses } = useLanguage();

  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value as ApplicationStatus)}
      className={compact ? "min-h-9 w-36 py-1 text-xs" : "w-full max-w-xs"}
      aria-label={language === "zh" ? "申请状态" : "Application status"}
    >
      {APPLICATION_STATUSES.map((status) => (
        <option key={status} value={status}>
          {statuses[status]}
        </option>
      ))}
    </Select>
  );
}
