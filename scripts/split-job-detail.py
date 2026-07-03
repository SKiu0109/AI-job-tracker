#!/usr/bin/env python3
"""Extract components from jobs/[id]/page.tsx into separate files."""

SOURCE = "src/app/jobs/[id]/page.tsx"

with open(SOURCE, "r") as f:
    lines = f.readlines()

def write_file(path, imports, code_lines, replacements):
    """Write a component file with imports and extracted code."""
    code = "".join(code_lines)
    for old, new in replacements:
        code = code.replace(old, new)
    with open(path, "w") as f:
        f.write(imports)
        f.write(code)
    print(f"  Created {path}")

# 1. overview-tab.tsx
write_file(
    "src/components/jobs/tabs/overview-tab.tsx",
    '''"use client";

import { AppCard } from "@/components/ui/app-card";
import { JobRecord } from "@/types/job";
import { DetailCopy } from "@/lib/jobs/job-detail-copy";
import {
  localizedArray,
  localizedText,
  localizeDisplayValue,
  formatOptionalDate,
  getReportSummary,
  getFirstUseful,
  getScoreTone,
  getActionStageToneName,
  getActionStageLabel,
} from "@/lib/jobs/job-detail-utils";
import { SectionHeading, InsightStat, SignalBrief } from "@/components/jobs/ui/detail-widgets";
import { ReportListCard, TextCard } from "@/components/jobs/ui/report-components";

''',
    lines[463:612],
    [
        ("function OverviewTab(", "export function OverviewTab("),
        ("function OverviewDecisionBoard(", "export function OverviewDecisionBoard("),
    ]
)

# 2. skills-tab.tsx
skills_code = lines[613:939] + lines[2932:2947] + lines[3034:3049]
write_file(
    "src/components/jobs/tabs/skills-tab.tsx",
    '''"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-provider";
import { AppCard } from "@/components/ui/app-card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { JobRecord, MATCH_SCORE_DIMENSIONS, PriorityLevel } from "@/types/job";
import { DetailCopy } from "@/lib/jobs/job-detail-copy";
import {
  localizedText,
  localizeDisplayValue,
  localizeEvidenceText,
  localizeKeyword,
  isUsefulValue,
  getScoreTone,
  getDimensionLabel,
  getCoveragePercent,
  uniqueStrings,
} from "@/lib/jobs/job-detail-utils";
import { SectionHeading } from "@/components/jobs/ui/detail-widgets";
import { DetailRow, EmptyReportState } from "@/components/jobs/ui/report-components";

export type SkillFitInsights = ReturnType<typeof getSkillFitInsights>;

''',
    skills_code,
    [
        ("function SkillsTab(", "export function SkillsTab("),
        ("function SkillCoachPanel(", "export function SkillCoachPanel("),
        ("function SkillMiniMetric(", "export function SkillMiniMetric("),
        ("function SkillSignalBoard(", "export function SkillSignalBoard("),
        ("function SkillSignalColumn(", "export function SkillSignalColumn("),
        ("function getSkillFitInsights(", "export function getSkillFitInsights("),
        ("function sortMissingSkillDetails(", "function sortMissingSkillDetails("),
        ("function getPriorityRank(", "function getPriorityRank("),
    ]
)

# 3. interview-tab.tsx
write_file(
    "src/components/jobs/tabs/interview-tab.tsx",
    '''"use client";

import { cn } from "@/lib/utils";
import { AppCard } from "@/components/ui/app-card";
import { JobRecord } from "@/types/job";
import { DetailCopy } from "@/lib/jobs/job-detail-copy";
import {
  getFirstUseful,
  getReportSummary,
  localizedArray,
} from "@/lib/jobs/job-detail-utils";
import { SectionHeading } from "@/components/jobs/ui/detail-widgets";
import { ReportListCard, TextCard } from "@/components/jobs/ui/report-components";

''',
    lines[1287:1392] + lines[3123:3164],
    [
        ("function InterviewTab(", "export function InterviewTab("),
        ("function InterviewPrepBoard(", "export function InterviewPrepBoard("),
    ]
)

# 4. actions-tab.tsx
write_file(
    "src/components/jobs/tabs/actions-tab.tsx",
    '''"use client";

import { cn } from "@/lib/utils";
import { AppCard } from "@/components/ui/app-card";
import { Badge } from "@/components/ui/badge";
import { JobRecord, PriorityLevel } from "@/types/job";
import { UserFacingNextStep } from "@/lib/jobs/user-facing-next-step";
import { DetailCopy } from "@/lib/jobs/job-detail-copy";
import {
  localizeDisplayValue,
  getReportSummary,
  getActionStageTone,
  getActionStageLabel,
  localizedArray,
} from "@/lib/jobs/job-detail-utils";
import { SectionHeading } from "@/components/jobs/ui/detail-widgets";
import { ReportListCard, PanelBox } from "@/components/jobs/ui/report-components";

''',
    lines[1393:1553] + lines[3083:3122],
    [
        ("function ActionsTab(", "export function ActionsTab("),
        ("function ActionCommandCenter(", "export function ActionCommandCenter("),
        ("function ActionPlanCard(", "export function ActionPlanCard("),
        ("function getActionPlanCards(", "export function getActionPlanCards("),
    ]
)

# 5. tracking-tab.tsx
write_file(
    "src/components/jobs/tabs/tracking-tab.tsx",
    '''"use client";

import { cn } from "@/lib/utils";
import { AppCard } from "@/components/ui/app-card";
import { JobRecord } from "@/types/job";
import { localizeDisplayValue, formatDateTime } from "@/lib/jobs/job-detail-utils";
import { SectionHeading, InsightStat } from "@/components/jobs/ui/detail-widgets";
import { TextCard, PanelBox } from "@/components/jobs/ui/report-components";

''',
    lines[1554:1703] + lines[3165:3206],
    [
        ("function TrackingTab(", "export function TrackingTab("),
        ("function ApplicationProgressPanel(", "export function ApplicationProgressPanel("),
    ]
)

# 6. decision-brief-section.tsx
write_file(
    "src/components/jobs/decision-brief-section.tsx",
    '''"use client";

import { cn } from "@/lib/utils";
import { AppCard } from "@/components/ui/app-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircularScore } from "@/components/ui/circular-score";
import { JobRecord, PriorityLevel } from "@/types/job";
import { UserFacingNextStep } from "@/lib/jobs/user-facing-next-step";
import { DetailCopy } from "@/lib/jobs/job-detail-copy";
import {
  localizedArray,
  localizeDisplayValue,
  localizeKeyword,
  formatOptionalDate,
  formatWorkMode,
  getReportSummary,
  getFirstUseful,
  getScoreTone,
  getVerdict,
} from "@/lib/jobs/job-detail-utils";
import { PanelRow, ReportSignalPill } from "@/components/jobs/ui/report-components";

''',
    lines[1786:1952],
    [
        ("function DecisionBriefSection(", "export default function DecisionBriefSection("),
    ]
)

print("All 8 files created successfully!")
