#!/usr/bin/env python3
"""Update jobs/[id]/page.tsx: replace inline code with imports."""

SOURCE = "src/app/jobs/[id]/page.tsx"

with open(SOURCE, "r") as f:
    content = f.read()

# Add new imports after the existing import block (after line 47)
import_insertion = """
import { OverviewTab } from "@/components/jobs/tabs/overview-tab";
import { SkillsTab } from "@/components/jobs/tabs/skills-tab";
import { InterviewTab } from "@/components/jobs/tabs/interview-tab";
import { ActionsTab } from "@/components/jobs/tabs/actions-tab";
import { TrackingTab } from "@/components/jobs/tabs/tracking-tab";
import DecisionBriefSection from "@/components/jobs/decision-brief-section";
import { SoftChip, EmptyReportState } from "@/components/jobs/ui/report-components";
import { getDetailCopy } from "@/lib/jobs/job-detail-copy";
import type { DetailCopy } from "@/lib/jobs/job-detail-copy";
import {
  getVerdict,
  getJobTitle,
  safeText,
  formatWorkMode,
  formatOptionalDate,
  getSimilarJobs,
  getCoveragePercent,
} from "@/lib/jobs/job-detail-utils";
"""

# Insert after "} from "@/types/job";" (end of last existing import)
old_import_end = '} from "@/types/job";\n'
content = content.replace(old_import_end, old_import_end + import_insertion)

# Remove old type Copy (use DetailCopy from import instead)
content = content.replace('\ntype Copy = ReturnType<typeof getDetailCopy>;\n', '\n')

# Remove the old inline definitions we extracted:
# 1. OverviewTab + OverviewDecisionBoard (lines 464-612)
# 2. SkillsTab through SkillSignalColumn (614-939)
# 3. InterviewTab + InterviewPrepBoard (1288-1392)
# 4. ActionsTab + ActionCommandCenter + ActionPlanCard (1394-1553)
# 5. TrackingTab + ApplicationProgressPanel (1555-1703)
# 6. SectionHeading + InsightStat + SignalBrief (1705-1785)
# 7. DecisionBriefSection (1787-1952)
# 8. ReportSignalPill through ReportIcon (3474-3700)
# 9. getDetailCopy (3924-4112)
# 10. getResumeDraftCopy (3272-3472)
# 11. localizedText through localizeKeyword (3718-3818)
# 12. getSimilarJobs (3701-3716)
# 13. getDimensionLabel (3820-3831)
# 14. getVerdict (3833-3856)
# 15. getScoreTone (3858-3862)
# 16. getCoveragePercent (3864-3867)
# 17. formatOptionalDate (3869-3878)
# 18. formatDateTime (3880-3891)
# 19. formatWorkMode (3893-3902)
# 20. safeText (3904-3907)
# 21. isUsefulValue (3909-3916)
# 22. getJobTitle (3918-3922)
# 23. getActionPlanCards (3084-3122)
# 24. getInterviewPrepItems (3124-3164)
# 25. getApplicationMilestones (3166-3206)
# 26. getSkillFitInsights (2933-2947)
# 27. sortMissingSkillDetails + getPriorityRank (3035-3049)

# But we need to keep ResumeTab and its helpers!
# ResumeTab uses internal helpers that aren't extracted.

# Strategy: Only remove what was extracted into separate files.
# Keep everything else intact.

# Sections to REMOVE (and the blank lines before them):
sections_to_remove = [
    # OverviewTab + OverviewDecisionBoard
    (464, 612),
    # SkillsTab through SkillSignalColumn
    (614, 939),
    # InterviewTab + InterviewPrepBoard
    (1288, 1392),
    # ActionsTab + ActionCommandCenter + ActionPlanCard
    (1394, 1553),
    # TrackingTab + ApplicationProgressPanel
    (1555, 1703),
    # SectionHeading + InsightStat + SignalBrief
    (1705, 1785),
    # DecisionBriefSection
    (1787, 1952),
    # ReportSignalPill through ReportIcon
    (3474, 3700),
    # getDetailCopy
    (3924, 4112),
    # getResumeDraftCopy
    (3272, 3472),
    # localizedText through localizeKeyword (includes displayTranslationsZh, keywordTranslationsZh)
    (3718, 3818),
    # getSimilarJobs
    (3701, 3716),
    # getDimensionLabel
    (3820, 3831),
    # getVerdict
    (3833, 3856),
    # getScoreTone
    (3858, 3862),
    # getCoveragePercent
    (3864, 3867),
    # formatOptionalDate
    (3869, 3878),
    # formatDateTime
    (3880, 3891),
    # formatWorkMode
    (3893, 3902),
    # safeText
    (3904, 3907),
    # isUsefulValue
    (3909, 3916),
    # getJobTitle
    (3918, 3922),
    # getActionPlanCards
    (3084, 3122),
    # getInterviewPrepItems
    (3124, 3164),
    # getApplicationMilestones
    (3166, 3206),
    # getSkillFitInsights
    (2933, 2947),
    # sortMissingSkillDetails + getPriorityRank
    (3035, 3049),
    # InsightTone type (moved to detail-widgets)
    (1726, 1726),
    # ReportIconName type (moved to report-components)
    (3626, 3631),
]

# Split content into lines
lines = content.splitlines(keepends=True)
line_count = len(lines)

# Mark lines to keep (True = keep)
keep = [True] * line_count

for start, end in sections_to_remove:
    # Convert from 1-indexed (file line numbers) to 0-indexed
    for i in range(start - 1, min(end, line_count)):
        keep[i] = False

# Build new content
new_lines = [line for i, line in enumerate(lines) if keep[i]]

# Write back
with open(SOURCE, "w") as f:
    for line in new_lines:
        f.write(line)

print(f"Updated {SOURCE}")
print(f"  Before: {line_count} lines")
print(f"  After:  {len(new_lines)} lines")
print(f"  Removed: {line_count - len(new_lines)} lines")
