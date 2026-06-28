"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { LanguageDropdown } from "@/components/layout/language-toggle";
import { useLanguage } from "@/lib/i18n/language-provider";
import { trackProductEvent } from "@/lib/product/analytics";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
import { saveJobs } from "@/lib/storage/jobs";
import { FLOAT_ANIMATION_DELAY_MS } from "@/lib/constants";

type PreviewJob = {
  id: string;
  company: string;
  title: string;
  titleZh: string;
  score: number;
  status: string;
  action: string;
  reason: string;
};
type EvidenceChip = { label: string; type: "match" | "risk" | "focus" };
type PreviewJobRich = PreviewJob & { evidence: EvidenceChip[]; riskLabel: string };

const previewEvidence: Record<string, { evidence: EvidenceChip[]; riskLabel: string }> = {
  "sample-data-analyst": {
    evidence: [{ label: "SQL", type: "match" }, { label: "Python", type: "match" }, { label: "Dashboarding", type: "match" }],
    riskLabel: "No sponsorship info"
  },
  "sample-risk-analyst": {
    evidence: [{ label: "SQL", type: "match" }, { label: "Credit risk", type: "match" }, { label: "SAS", type: "risk" }],
    riskLabel: "SAS gap"
  },
  "sample-product-ops": {
    evidence: [{ label: "SQL", type: "match" }, { label: "Exp. design", type: "risk" }, { label: "CRM ops", type: "risk" }],
    riskLabel: "Ops experience gap"
  },
  "sample-business-analyst": {
    evidence: [{ label: "BA", type: "match" }, { label: "SQL", type: "match" }, { label: "Stakeholder", type: "match" }],
    riskLabel: "Consulting depth"
  },
  "sample-consulting-analyst": {
    evidence: [{ label: "Research", type: "match" }, { label: "Case framing", type: "risk" }, { label: "Market sizing", type: "risk" }],
    riskLabel: "Case experience gap"
  }
};

const previewData: Record<string, { actionEn: string; actionZh: string; reasonEn: string; reasonZh: string }> = {
  "sample-data-analyst": {
    actionEn: "Apply with tailored resume", actionZh: "用定制简历立即申请",
    reasonEn: "Strong match — SQL, Python, dashboarding. Clear Australian market fit.",
    reasonZh: "SQL、Python、数据看板技能高度匹配，澳洲市场明确。"
  },
  "sample-risk-analyst": {
    actionEn: "Strengthen finance keywords", actionZh: "强化金融风控关键词",
    reasonEn: "Analytics stack matches. Needs stronger credit risk evidence.",
    reasonZh: "分析工具链匹配，需补强信用风险证据。"
  },
  "sample-product-ops": {
    actionEn: "Save as lower priority", actionZh: "低优先级保存",
    reasonEn: "Product analytics transferable but direct ops gap noticeable.",
    reasonZh: "产品分析可迁移，运营经验缺口明显。"
  },
  "sample-business-analyst": {
    actionEn: "Apply with tailored resume", actionZh: "用定制简历申请",
    reasonEn: "Excellent fit — BA, SQL, stakeholder skills align tightly.",
    reasonZh: "匹配度优秀，商业分析与干系人能力高度契合。"
  },
  "sample-consulting-analyst": {
    actionEn: "Prepare case examples", actionZh: "准备案例素材",
    reasonEn: "Research skills match. Structured case evidence would strengthen.",
    reasonZh: "研究能力匹配，补强案例素材可提升竞争力。"
  }
};

/* ── prefers-reduced-motion ── */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const handler = () => onStoreChange();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
    },
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

/* ── Scroll reveal (once-only, respects reduced motion) ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduceMotion]);
  return { ref, visible: visible || reduceMotion, reduceMotion };
}

function FadeSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { ref, visible, reduceMotion } = useReveal();
  return (
    <div
      ref={ref}
      className={`${reduceMotion ? "" : "transition-all duration-700 ease-out"} ${visible ? "opacity-100 translate-y-0" : reduceMotion ? "" : "opacity-0 translate-y-8"} ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Animated score bar (once on viewport entry, respects reduced motion) ── */
function AnimatedScoreBar({ score }: { score: number }) {
  const { ref, visible, reduceMotion } = useReveal();
  const color = score >= 85 ? "bg-green-500" : score >= 70 ? "bg-amber-400" : "bg-red-400";
  const targetWidth = reduceMotion ? `${score}%` : visible ? `${score}%` : "0%";
  return (
    <div ref={ref} className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className={`h-full rounded-full ${color} ${reduceMotion ? "" : "transition-all duration-1000 ease-out"}`}
          style={{ width: targetWidth }}
        />
      </div>
      <span className="text-[11px] font-semibold text-primary">{score}%</span>
    </div>
  );
}

function EvidenceChip({ label, type }: { label: string; type: "match" | "risk" | "focus" }) {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-medium";
  if (type === "match") return <span className={`${base} border border-green-200 bg-green-50 text-green-700`}>{label}</span>;
  if (type === "risk") return <span className={`${base} border border-red-100 bg-red-50/60 text-red-600`}>{label}</span>;
  return <span className={`${base} border border-accent/15 bg-accent-subtle/40 text-accent`}>{label}</span>;
}

export default function LandingPage() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const reduceMotion = usePrefersReducedMotion();
  const hoverLift = reduceMotion ? "" : "hover:-translate-y-1 hover:shadow-md hover:shadow-black/[0.03]";
  const btnLift = reduceMotion ? "" : "hover:-translate-y-0.5 hover:shadow-md";
  const previewJobs: PreviewJobRich[] = SAMPLE_JOBS.slice(0, 4).map((job) => {
    const p = previewData[job.id] ?? { actionEn: job.recommended_next_action.action, actionZh: job.recommended_next_action.action, reasonEn: "", reasonZh: "" };
    const ev = previewEvidence[job.id] ?? { evidence: [], riskLabel: "" };
    return {
      id: job.id, company: job.company, title: job.job_title_original, titleZh: job.job_title_zh,
      score: job.match_score, status: job.application_status,
      action: language === "zh" ? p.actionZh : p.actionEn,
      reason: language === "zh" ? p.reasonZh : p.reasonEn,
      evidence: ev.evidence, riskLabel: ev.riskLabel
    };
  });

  const handleTryDemo = () => {
    saveJobs(SAMPLE_JOBS);
    trackProductEvent("demo_sample_loaded", { jobCount: SAMPLE_JOBS.length, source: "landing" });
    if (typeof window !== "undefined") window.localStorage.setItem("from_demo_entry", "1");
    router.push("/workspace");
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ─── Nav ─── */}
      <nav className="sticky top-0 z-50 border-b border-black/[0.05] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">P</span>
              <span className="text-[15px] font-semibold text-primary">Pathwise</span>
            </div>
            <a href="/workspace" className="hidden text-[14px] font-medium text-secondary transition-colors hover:text-primary sm:inline-block">{t.jobList}</a>
          </div>
          <div className="flex items-center gap-4"><LanguageDropdown /></div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden" style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,113,227,0.05) 0%, transparent 70%), #FAFAFA" }}>
        <div className="mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pt-28 lg:pt-36">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <FadeSection>
              <h1 className="text-4xl font-semibold tracking-tight text-primary sm:text-5xl lg:text-[52px] lg:leading-[1.06]">{t.landingHeroTitle}</h1>
              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-secondary">{t.landingHeroSubtitle}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button onClick={handleTryDemo} className={`min-h-12 px-7 text-[15px] font-medium transition-all duration-300 ${btnLift}`}>{t.landingTryDemo}</Button>
                <ButtonLink href="#preview" variant="secondary" className={`min-h-12 px-7 text-[15px] font-medium transition-all duration-300 ${btnLift}`}>{t.landingViewSample}</ButtonLink>
              </div>
              <p className="mt-5 text-[13px] text-secondary/45">{t.landingTrustMicrocopy}</p>
            </FadeSection>
            <MockupPanel />
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="border-t border-black/[0.04] bg-white py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <FadeSection className="text-center">
            <h2 className="text-[28px] font-semibold tracking-tight text-primary">{t.landingHowTitle}</h2>
            <p className="mt-3 text-[15px] text-secondary">{t.landingHowSubtitle}</p>
          </FadeSection>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {[
              { i: 1, title: t.landingHowStep1Title, body: t.landingHowStep1Body, preview: <StepPasteJD /> },
              { i: 2, title: t.landingHowStep2Title, body: t.landingHowStep2Body, preview: <StepAnalysis /> },
              { i: 3, title: t.landingHowStep3Title, body: t.landingHowStep3Body, preview: <StepDecision /> }
            ].map((step, idx) => (
              <FadeSection key={step.i} className="relative flex flex-col items-center text-center">
                {/* Connector arrow on desktop */}
                {idx < 2 ? (
                  <div className="absolute right-0 top-14 hidden -translate-y-1/2 translate-x-3 sm:block">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-black/[0.10]">
                      <path d="M3 14h18M17 10l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                ) : null}
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-subtle text-[14px] font-medium text-accent">{step.i}</span>
                <h3 className="mt-4 text-[16px] font-semibold text-primary">{step.title}</h3>
                <p className="mt-1.5 max-w-[240px] text-[13px] leading-relaxed text-secondary">{step.body}</p>
                <div className="mt-5 w-full max-w-[220px]">{step.preview}</div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Bilingual ─── */}
      <section className="border-t border-black/[0.04] py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-start">
            <FadeSection>
              <h2 className="text-[28px] font-semibold tracking-tight text-primary">{t.landingBilingualTitle}</h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-secondary">{t.landingBilingualBody}</p>
            </FadeSection>
            <FadeSection>
              <div className="rounded-2xl border border-black/[0.05] bg-white p-5 shadow-sm">
                <div className="rounded-xl border border-accent/[0.06] bg-[#F7F9FC] p-4">
                  <p className="text-[11px] font-medium text-accent/60 tracking-wide uppercase">English JD</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-primary">{t.landingBilingualExampleEn}</p>
                </div>
                <div className="flex justify-center py-2">
                  <svg width="24" height="32" viewBox="0 0 24 32" fill="none" className="text-accent/15">
                    <path d="M12 0v24M3 22l9 10 9-10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="rounded-xl border border-black/[0.04] bg-[#FAFAFA] p-4">
                  <p className="text-[11px] font-medium text-secondary/50 tracking-wide uppercase">Chinese Analysis</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-primary">{t.landingBilingualExampleZh}</p>
                </div>
              </div>
            </FadeSection>
          </div>
        </div>
      </section>

      {/* ─── Decision system + Preview ─── */}
      <section id="preview" className="border-t border-black/[0.04] bg-white py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <FadeSection className="text-center">
            <h2 className="text-[28px] font-semibold tracking-tight text-primary">{t.landingDecisionTitle}</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-secondary">{t.landingDecisionBody}</p>
          </FadeSection>
          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {[
              { title: t.landingDecisionFit, body: t.landingDecisionFitBody, icon: <ChartIcon /> },
              { title: t.landingDecisionAction, body: t.landingDecisionActionBody, icon: <PrioritizeIcon /> },
              { title: t.landingDecisionPortfolio, body: t.landingDecisionPortfolioBody, icon: <PortfolioIcon /> }
            ].map((card) => (
              <FadeSection key={card.title}>
                <div className={`group rounded-xl border border-black/[0.04] bg-white p-6 shadow-sm shadow-black/[0.01] transition-all duration-300 ${hoverLift} hover:border-black/[0.08]`}>
                  <div className="mb-4 text-accent/40 transition-colors group-hover:text-accent/60">{card.icon}</div>
                  <h3 className="text-[16px] font-semibold text-primary">{card.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-secondary">{card.body}</p>
                </div>
              </FadeSection>
            ))}
          </div>

          {/* Workspace preview */}
          <FadeSection className="mt-14">
            <div className="overflow-hidden rounded-xl border border-black/[0.05] bg-white shadow-md shadow-black/[0.02]">
              <div className="flex items-center gap-2 border-b border-black/[0.04] px-5 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28CA41]" />
                <span className="ml-3 text-[12px] font-medium text-secondary/60">Workspace</span>
              </div>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.03] px-5 py-2.5">
                <span className="rounded-full border border-accent/15 bg-accent-subtle/40 px-2.5 py-1 text-[11px] font-medium text-accent">{t.landingFilterHighMatch}</span>
                <span className="rounded-full border border-black/[0.05] bg-[#FAFAFA] px-2.5 py-1 text-[11px] text-secondary/60">{t.landingFilterNeedsTailoring}</span>
                <span className="rounded-full border border-black/[0.05] bg-[#FAFAFA] px-2.5 py-1 text-[11px] text-secondary/60">{t.landingFilterSponsorshipRisk}</span>
                <span className="ml-auto rounded-full border border-black/[0.05] bg-[#FAFAFA] px-2.5 py-1 text-[11px] text-secondary/50">{t.landingExportCsv}</span>
              </div>
              {/* Job rows */}
              {previewJobs.map((job) => (
                <div key={job.id} className="group border-b border-black/[0.02] px-5 py-3.5 last:border-0 transition-colors hover:bg-[#FAFAFA]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <CompanyLogo company={job.company} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-primary">{language === "zh" ? job.titleZh : job.title}</p>
                        <p className="truncate text-[12px] text-secondary">{job.company}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden flex-wrap gap-1 sm:flex">{job.evidence.map((e) => <EvidenceChip key={e.label} label={e.label} type={e.type} />)}</div>
                      <AnimatedScoreBar score={job.score} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[12px]">
                    {job.riskLabel ? (
                      <span className="rounded-full border border-red-100 bg-red-50/50 px-2 py-0.5 text-[11px] text-red-600/80">{job.riskLabel}</span>
                    ) : null}
                    <span className="text-secondary/50">&rarr;</span>
                    <span className="font-medium text-accent">{job.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ─── Trust ─── */}
      <section className="border-t border-black/[0.04] py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <FadeSection className="text-center">
            <h2 className="text-[28px] font-semibold tracking-tight text-primary">{t.landingSafeTitle}</h2>
          </FadeSection>
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: t.landingSafeLocal, body: t.landingSafeLocalBody, icon: <UserIcon /> },
              { title: t.landingSafeCredits, body: t.landingSafeCreditsBody, icon: <LockIcon /> },
              { title: t.landingSafeExplain, body: t.landingSafeExplainBody, icon: <MagnifyIcon /> },
              { title: t.landingSafeExport, body: t.landingSafeExportBody, icon: <DownloadIcon /> }
            ].map((card) => (
              <FadeSection key={card.title}>
                <div className={`group rounded-xl border border-black/[0.04] bg-white p-6 shadow-sm shadow-black/[0.01] transition-all duration-300 ${hoverLift} hover:border-black/[0.08]`}>
                  <div className="mb-5 text-accent/30 transition-colors group-hover:text-accent/50">{card.icon}</div>
                  <h3 className="text-[16px] font-semibold text-primary">{card.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-secondary">{card.body}</p>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="border-t border-black/[0.04] bg-white py-24 lg:py-32">
        <FadeSection className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-[28px] font-semibold tracking-tight text-primary">{t.landingDemoTitle}</h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-secondary">{t.landingDemoBody}</p>
          <div className="mt-8">
            <Button onClick={handleTryDemo} className={`min-h-12 px-8 text-[15px] font-medium transition-all duration-300 ${btnLift}`}>{t.landingLaunchDemo}</Button>
          </div>
          <p className="mt-4 text-[13px] text-secondary/35">{t.landingDemoNote}</p>
        </FadeSection>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-black/[0.04] py-10">
        <div className="mx-auto max-w-7xl px-6 text-center text-[12px] text-secondary/30">
          Pathwise &middot; {language === "zh" ? "双语求职决策工作台" : "Bilingual job application decision workspace"}
        </div>
      </footer>
    </div>
  );
}

/* ── Hero mockup: entrance once + continuous subtle float (respects reduced motion) ── */
function MockupPanel() {
  const { ref, visible, reduceMotion } = useReveal();
  const [floatReady, setFloatReady] = useState(false);

  // Delay float start so entrance animation finishes first
  useEffect(() => {
    if (visible && !reduceMotion) {
      const t = setTimeout(() => setFloatReady(true), FLOAT_ANIMATION_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [visible, reduceMotion]);

  return (
    <div
      ref={ref}
      className={reduceMotion ? "" : "transition-all duration-800 ease-out"}
      style={{
        opacity: reduceMotion ? 1 : visible ? 1 : 0,
        transform: reduceMotion
          ? "none"
          : visible
            ? floatReady
              ? undefined  // let CSS animation control transform
              : "translateY(0) scale(1)"  // entrance end state
            : "translateY(28px) scale(0.98)"  // entrance start state
      }}
    >
      {!reduceMotion ? <style>{`@keyframes mockup-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }`}</style> : null}
      <div style={!reduceMotion && floatReady ? { animation: "mockup-float 6s ease-in-out infinite" } : undefined}>
        <AnalysisMockup />
      </div>
    </div>
  );
}

/* ── Step previews ── */
function StepPasteJD() {
  return (
    <div className="rounded-lg border border-black/[0.05] bg-[#FAFAFA] p-3 text-left shadow-sm">
      <div className="h-1.5 w-16 rounded-full bg-accent-subtle mb-2.5" />
      <div className="space-y-1.5">
        <div className="h-2 w-full rounded bg-black/[0.05]" />
        <div className="h-2 w-5/6 rounded bg-black/[0.05]" />
        <div className="h-2 w-4/6 rounded bg-black/[0.05]" />
        <div className="h-2 w-3/6 rounded bg-black/[0.05]" />
      </div>
    </div>
  );
}

function StepAnalysis() {
  return (
    <div className="rounded-lg border border-black/[0.05] bg-white p-3 text-left shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-accent/60">Match</span>
        <span className="text-[10px] font-bold text-green-600">91%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-black/[0.04] mb-2.5">
        <div className="h-full w-[91%] rounded-full bg-green-500" />
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="rounded px-1.5 py-0.5 text-[9px] bg-green-50 text-green-700 border border-green-100">SQL</span>
        <span className="rounded px-1.5 py-0.5 text-[9px] bg-green-50 text-green-700 border border-green-100">Python</span>
        <span className="rounded px-1.5 py-0.5 text-[9px] bg-red-50/60 text-red-600 border border-red-100">SAS</span>
      </div>
    </div>
  );
}

function StepDecision() {
  return (
    <div className="rounded-lg border border-accent/[0.08] bg-[#F7F9FC] p-3 text-left shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-secondary/60">Next action</span>
        <span className="text-[11px] font-semibold text-accent">Apply with tailored resume</span>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-secondary/50">Strong SQL and Python match. Highlight dashboarding and business impact.</p>
    </div>
  );
}

/* ── Analysis mockup ── */
function AnalysisMockup() {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white shadow-xl shadow-black/[0.03]">
      <div className="flex items-center gap-2 border-b border-black/[0.04] px-5 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28CA41]" />
        <span className="ml-3 text-[11px] font-medium text-secondary/40">Analysis — Junior Data Analyst</span>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CompanyLogo company="FinSight Analytics" size="md" />
            <div>
              <p className="text-[15px] font-semibold text-primary">Junior Data Analyst</p>
              <p className="text-[13px] text-secondary">FinSight Analytics</p>
            </div>
          </div>
          <ScoreBadge score={91} />
        </div>
        <div className="mt-4 space-y-2.5">
          <div className="rounded-lg border border-black/[0.04] bg-[#FAFAFA] px-3.5 py-2.5">
            <p className="text-[11px] font-medium text-secondary/60">Matched evidence</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {["SQL", "Python", "Dashboarding", "Stakeholder reports"].map((s) => (
                <span key={s} className="rounded-full border border-green-200 bg-green-50/70 px-2 py-0.5 text-[11px] font-medium text-green-700">{s}</span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50/30 px-3.5 py-2.5">
            <p className="text-[11px] font-medium text-secondary/60">Risk</p>
            <p className="mt-1 text-[12px] text-red-700/80">Sponsorship not mentioned</p>
          </div>
          <div className="rounded-lg border border-accent/[0.08] bg-[#F5F8FC] px-3.5 py-2.5">
            <p className="text-[11px] font-medium text-secondary/60">Resume focus</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {["dashboarding", "reporting automation", "business impact"].map((s) => (
                <span key={s} className="rounded-full border border-accent/15 bg-accent-subtle/40 px-2 py-0.5 text-[11px] font-medium text-accent">{s}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-black/[0.04] bg-[#FAFAFA] px-3.5 py-2.5">
            <p className="text-[11px] font-medium text-secondary/60">Next action</p>
            <span className="text-[12px] font-medium text-accent">Apply with tailored resume</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Icons ── */
function ChartIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16M6 16v-3m4 3v-6m4 6V8m4 8v-4"/></svg>;
}
function PrioritizeIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 5v8l-8 5-8-5V8l8-5z"/><path d="M12 8v8M9 11l3-3 3 3"/></svg>;
}
function PortfolioIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>;
}
function LockIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
}
function MagnifyIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>;
}
function DownloadIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>;
}
function UserIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
