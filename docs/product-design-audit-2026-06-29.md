# Pathwise Product Design Audit

Date: 2026-06-29
Target: https://ai-bilingual-job-tracker.vercel.app
Mode: Combined UX, UI, interaction, and accessibility review

## Scope

1. Landing page
2. Workspace and job analysis form
3. AI job report
4. Dashboard / Insights
5. Feedback page
6. Mobile Workspace

## Step Health

1. Landing page: Healthy. Clear value proposition, strong hero, obvious primary CTA.
2. Workspace: Healthy but dense. The core form is visible, but the right-side insight panel competes with the primary job analysis action.
3. Job report: Functional but under-explained. Report has rich content, but the first visible summary can show an empty fallback, which lowers trust.
4. Dashboard: Healthy. Metrics and action center are scannable, though chart depth and action affordances could be stronger below the fold.
5. Feedback: Healthy form structure, but the page is visually less polished and feels more internal/research-oriented than product-native.
6. Mobile Workspace: Usable. No visible horizontal overflow; the primary flow is accessible, but the form takes a lot of vertical space before the submit action.

## Strengths

- Strong visual consistency across the app shell, cards, typography, soft borders, and low-noise palette.
- The product surface feels appropriately utilitarian for a job-tracking workspace, not like a generic marketing site.
- Landing page communicates the core promise quickly: paste JD, understand fit, decide next action.
- The sidebar/navigation model is stable and easy to learn.
- Workspace, dashboard, and report pages share a coherent information architecture.
- The analysis loading state is unusually good: it explains what is happening and reduces anxiety during a long AI request.
- Mobile Workspace reflows without horizontal overflow.

## UX Risks

1. The main product journey has two competing entry models: landing CTA and Workspace inline form. This is okay, but the app does not strongly teach the recommended first-time path: profile setup versus JD analysis first.
2. The Workspace first viewport has multiple attention targets: analysis form, latest analysis, recommended action, credits, account, nav. The primary next action is visible, but not maximally dominant.
3. Job report trust is weakened when the top summary area says "No AI summary is available yet" even though the rest of the report has useful AI output.
4. Dashboard metrics are clear, but the "what should I do now?" relationship between dashboard cards and concrete next actions could be more direct.
5. Feedback page copy feels like internal validation language ("validation MVP") rather than user-facing product language.
6. Some user-facing English is mixed with product/team vocabulary: "AI workspace", "validation MVP", "Pulled from your real analysis history." These are understandable, but not always the user's mental model.

## UI Risks

1. Card radius and softness are pleasant, but many cards have similar visual weight. Important panels and secondary panels sometimes feel equally important.
2. Accent colors are split between classic blue and app purple. This is workable, but the system could benefit from a clearer rule: blue for links/data, purple for AI/actions, semantic colors for status.
3. On the report page, the score, recommendation chips, summary, and overview panel all compete for "primary insight" status.
4. Mobile form spacing is comfortable but long. The submit button can fall below the first mobile viewport, which slows the primary task.
5. The Feedback screen has less visual hierarchy than core product pages, making it feel less integrated.

## Interaction Risks

1. The sample JD control is useful, but it is styled as a small text link. For a demo-first product, it could be a more discoverable secondary action.
2. The disabled Start Analysis state depends on text length, but the user may not immediately understand why the button is disabled without looking below the textarea.
3. The generated report has many tabs. This is powerful, but users may not know which tab to read first after analysis.
4. Account, credits, guest mode, and cloud sync are present in the shell, but the relationship between local-first data and account persistence is not fully explained in the UI.
5. The feedback form has many fields visible at once, which may reduce completion rate.

## Accessibility Risks

- Screenshot review cannot prove full keyboard or screen reader support.
- Focus-visible styling exists globally and is a positive sign.
- Some small text and pale secondary text may be low-contrast in practice, especially helper text and metadata.
- Mobile tap targets mostly appear large enough, but small inline actions like "Use sample JD" deserve verification.
- The app uses many icon-only or icon-heavy controls; accessible names should be verified across sidebar, menu, refresh, language, and account controls.
- Error recovery needs more focused testing: short JD, exhausted credits, AI provider failure, network failure, and feedback validation.

## Recommendations

### P0 / High Impact

1. Fix or improve the report summary fallback. If `ai_summary_en` is missing, generate a local fallback from recommendation + next action + top strengths/gaps instead of showing "No AI summary is available yet."
2. Make the first-time path clearer: "Paste JD first" vs "Set up profile first." A compact onboarding strip in Workspace could explain how profile quality affects score quality.
3. Strengthen the Workspace primary action hierarchy. Keep the form as the main star; make latest analysis and recommended action visibly secondary.
4. Improve disabled Start Analysis feedback. Show a direct inline message near the button such as "Paste at least 80 characters to start."

### P1 / Strong Polish

5. Convert "Use sample JD" into a stronger secondary button or chip, especially in demo/guest mode.
6. Add a post-analysis reading path on the report page: top summary, why this score, what to fix, next action. The tabs can remain, but the first screen should guide the scan.
7. Rename internal-sounding copy. Examples: "validation MVP" -> "Help improve Pathwise"; "AI workspace" -> "AI analysis"; "Pulled from your real analysis history" -> "Based on your latest saved analysis."
8. Make Dashboard cards more action-linked. Each metric should lead to a filtered list or a concrete next action.
9. Improve mobile analysis form by making the action footer sticky or bringing the submit button closer once the JD becomes valid.

### P2 / Accessibility And System Quality

10. Run keyboard-only QA across sidebar, form, report tabs, status select, language menu, account menu, and feedback form.
11. Audit contrast for helper text, placeholder text, pale metadata, and disabled states.
12. Add stable test IDs for critical flow controls to make browser QA less brittle.
13. Reduce duplicate or overlapping UI vocabulary between legacy warm-neutral tokens and newer app tokens.

## Evidence Files

- 01-landing.png
- 02-workspace.png
- 03-job-report.png
- 04-dashboard.png
- 05-feedback.png
- 06-workspace-mobile.png
