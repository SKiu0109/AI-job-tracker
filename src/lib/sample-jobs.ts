import {
  JobRecord,
  MatchScoreBreakdown,
  MissingSkillDetail,
  RecommendedNextAction
} from "@/types/job";

const now = new Date().toISOString();

export const SAMPLE_JOBS: JobRecord[] = [
  createSampleJob({
    id: "sample-data-analyst",
    company: "FinSight Analytics",
    title: "Junior Data Analyst",
    titleZh: "初级数据分析师",
    location: "Sydney, Australia",
    jobTypeEn: "Full-time",
    jobTypeZh: "全职",
    score: 91,
    status: "Applied",
    deadline: "2026-07-15",
    recommendation: "Strongly apply",
    nextAction: "Apply now",
    skills: ["SQL", "Python", "Excel", "Dashboarding", "Statistics"],
    tools: ["Power BI", "Tableau", "Looker Studio"],
    gaps: ["Limited direct Australian internship experience"],
    gapsZh: ["澳大利亚本地实习经验相对有限"],
    missingSkills: ["dbt", "A/B testing"],
    missingSkillsZh: ["dbt", "A/B 测试"],
    roleType: "Data Analyst",
    roleTypeZh: "数据分析",
    region: "Australia",
    regionZh: "澳大利亚"
  }),
  createSampleJob({
    id: "sample-risk-analyst",
    company: "Harbour Bank",
    title: "Risk Strategy Analyst Intern",
    titleZh: "风险策略分析实习生",
    location: "Singapore",
    jobTypeEn: "Internship",
    jobTypeZh: "实习",
    score: 84,
    status: "Interview",
    deadline: "2026-07-03",
    recommendation: "Worth trying",
    nextAction: "Tailor resume first",
    skills: ["SQL", "Python", "Credit risk", "Quantitative research"],
    tools: ["Excel", "Python", "SQL"],
    gaps: ["Need stronger examples of financial risk modelling"],
    gapsZh: ["需要补充更有说服力的金融风险建模案例"],
    missingSkills: ["SAS", "Scorecard modelling"],
    missingSkillsZh: ["SAS", "评分卡建模"],
    roleType: "Risk Strategy",
    roleTypeZh: "风险策略",
    region: "Singapore",
    regionZh: "新加坡"
  }),
  createSampleJob({
    id: "sample-product-ops",
    company: "BrightCart",
    title: "Product Operations Associate",
    titleZh: "产品运营专员",
    location: "Shanghai, China",
    jobTypeEn: "Full-time",
    jobTypeZh: "全职",
    score: 76,
    status: "Not Applied",
    deadline: "",
    recommendation: "Worth trying",
    nextAction: "Save for later",
    skills: ["Product analytics", "SQL", "User research", "Reporting"],
    tools: ["Excel", "SQL", "Figma"],
    gaps: ["Less direct product operations experience"],
    gapsZh: ["直接产品运营经验相对不足"],
    missingSkills: ["Experiment design", "CRM operations"],
    missingSkillsZh: ["实验设计", "CRM 运营"],
    roleType: "Product Operations",
    roleTypeZh: "产品运营",
    region: "China",
    regionZh: "中国"
  }),
  createSampleJob({
    id: "sample-business-analyst",
    company: "MarketBridge Advisory",
    title: "Business Analyst",
    titleZh: "商业分析师",
    location: "Melbourne, Australia",
    jobTypeEn: "Full-time",
    jobTypeZh: "全职",
    score: 88,
    status: "Applied",
    deadline: "2026-07-22",
    recommendation: "Strongly apply",
    nextAction: "Apply now",
    skills: ["Business analysis", "Excel", "SQL", "Stakeholder communication"],
    tools: ["Excel", "Power BI", "SQL"],
    gaps: ["Need stronger consulting-style case examples"],
    gapsZh: ["需要补充更咨询化的案例表达"],
    missingSkills: ["Process mapping", "Requirements documentation"],
    missingSkillsZh: ["流程梳理", "需求文档"],
    roleType: "Business Analyst",
    roleTypeZh: "商业分析",
    region: "Australia",
    regionZh: "澳大利亚"
  }),
  createSampleJob({
    id: "sample-consulting-analyst",
    company: "NorthStar Consulting",
    title: "Consulting Analyst Intern",
    titleZh: "咨询分析实习生",
    location: "Singapore",
    jobTypeEn: "Internship",
    jobTypeZh: "实习",
    score: 81,
    status: "Not Applied",
    deadline: "2026-07-09",
    recommendation: "Worth trying",
    nextAction: "Tailor resume first",
    skills: ["Market research", "Excel", "Presentation", "Problem solving"],
    tools: ["Excel", "PowerPoint", "Tableau"],
    gaps: ["Need more structured consulting project evidence"],
    gapsZh: ["需要更结构化的咨询项目证据"],
    missingSkills: ["Case interview framing", "Market sizing"],
    missingSkillsZh: ["案例面试框架", "市场规模测算"],
    roleType: "Consulting Analyst",
    roleTypeZh: "咨询分析",
    region: "Singapore",
    regionZh: "新加坡"
  }),
  createSampleJob({
    id: "sample-fintech-ops",
    company: "PayLink FinTech",
    title: "FinTech Operations Analyst",
    titleZh: "金融科技运营分析师",
    location: "Shenzhen, China",
    jobTypeEn: "Full-time",
    jobTypeZh: "全职",
    score: 69,
    status: "Not Applied",
    deadline: "2026-08-01",
    recommendation: "Low priority",
    nextAction: "Improve skills before applying",
    skills: ["Operations analysis", "SQL", "Payment products", "Reporting"],
    tools: ["Excel", "SQL", "Looker Studio"],
    gaps: ["Limited direct payments operations experience"],
    gapsZh: ["支付运营直接经验相对有限"],
    missingSkills: ["Payment reconciliation", "Fraud operations"],
    missingSkillsZh: ["支付对账", "反欺诈运营"],
    roleType: "FinTech Operations",
    roleTypeZh: "金融科技运营",
    region: "China",
    regionZh: "中国"
  })
];

function createSampleJob(input: {
  id: string;
  company: string;
  title: string;
  titleZh: string;
  location: string;
  jobTypeEn: string;
  jobTypeZh: string;
  score: number;
  status: JobRecord["application_status"];
  deadline: string;
  recommendation: JobRecord["application_recommendation"];
  nextAction: RecommendedNextAction["action"];
  skills: string[];
  tools: string[];
  gaps: string[];
  gapsZh: string[];
  missingSkills: string[];
  missingSkillsZh: string[];
  roleType: string;
  roleTypeZh: string;
  region: string;
  regionZh: string;
}): JobRecord {
  const createdAt = now;

  return {
    id: input.id,
    company: input.company,
    job_title_original: input.title,
    job_title_zh: input.titleZh,
    location: input.location,
    work_mode: "Hybrid",
    job_type_en: input.jobTypeEn,
    job_type_zh: input.jobTypeZh,
    education_requirement_en:
      "Bachelor's degree in statistics, analytics, finance, economics, computer science, or a related field.",
    education_requirement_zh:
      "统计、商业分析、金融、经济、计算机科学或相关领域的学士学位。",
    experience_requirement_en:
      "0-2 years of internship or work experience in analytics, consulting, financial services, or operations.",
    experience_requirement_zh:
      "0-2 年数据分析、咨询、金融服务或运营相关实习 / 工作经验。",
    skills: input.skills,
    tools: input.tools,
    responsibilities_en: [
      "Analyze business data and turn findings into practical recommendations.",
      "Build reports and dashboards for stakeholders.",
      "Communicate insights clearly across business and technical teams."
    ],
    responsibilities_zh: [
      "分析业务数据，并将发现转化为可执行建议。",
      "为业务团队搭建报告和仪表盘。",
      "向业务和技术团队清晰沟通分析洞察。"
    ],
    requirements_en: [
      "Strong analytical thinking and spreadsheet skills.",
      "Working knowledge of SQL or Python.",
      "Clear written and verbal communication."
    ],
    requirements_zh: [
      "具备较强分析思维和表格处理能力。",
      "掌握 SQL 或 Python 基础。",
      "具备清晰的书面和口头沟通能力。"
    ],
    nice_to_have_en: ["Dashboard experience", "FinTech or consulting exposure"],
    nice_to_have_zh: ["仪表盘经验", "金融科技或咨询相关经历"],
    match_score: input.score,
    match_score_breakdown: createBreakdown(input.score, input.region, input.regionZh),
    key_strengths_en: [
      "Strong fit with statistics and business analytics background.",
      "Relevant SQL, Python, Excel, and report writing experience."
    ],
    key_strengths_zh: [
      "与统计和商业分析背景高度匹配。",
      "SQL、Python、Excel 和报告写作经验相关度较高。"
    ],
    main_gaps_en: input.gaps,
    main_gaps_zh: input.gapsZh.map((gap) => `需要补强：${gap}`),
    application_recommendation: input.recommendation,
    recommended_next_action: {
      action: input.nextAction,
      reason_en:
        input.nextAction === "Apply now"
          ? "The score is high and the role matches the candidate profile strongly."
          : "The role is promising, but resume positioning should be improved before applying.",
      reason_zh:
        input.nextAction === "Apply now"
          ? "匹配度高，并且岗位与候选人画像高度一致。"
          : "岗位值得尝试，但建议先优化简历表达。",
      urgency: input.score >= 85 ? "High" : "Medium",
      suggested_deadline: input.score >= 85 ? "Within 3 days" : "This week",
      resume_focus_points: [
        "SQL",
        "dashboarding",
        "customer analysis",
        "consulting research"
      ]
    },
    red_flags_en: input.score >= 85 ? [] : input.gaps,
    red_flags_zh:
      input.score >= 85 ? [] : input.gapsZh.map((gap) => `潜在风险：${gap}`),
    positive_signals_en: [
      "JD mentions analytics, reporting, and stakeholder communication.",
      `Location aligns with target region: ${input.region}.`
    ],
    positive_signals_zh: [
      "JD 提到分析、报告和业务沟通。",
      `地点符合目标地区：${input.regionZh}。`
    ],
    assumptions_en: [
      "Assumes the candidate can provide project examples for SQL and dashboard work."
    ],
    assumptions_zh: [
      "假设候选人可以提供 SQL 和仪表盘项目案例。"
    ],
    missing_information_en: [
      "The JD does not clearly state visa sponsorship or work-rights support."
    ],
    missing_information_zh: [
      "JD 未清楚说明签证支持或工作权利要求。"
    ],
    resume_tailoring_advice_en: [
      `Frame projects around ${input.roleType} outcomes and measurable business impact.`,
      "Move SQL, Python, Excel, and dashboard keywords into the top half of the resume."
    ],
    resume_tailoring_advice_zh: [
      `围绕${input.roleTypeZh}结果和可量化业务影响改写项目经历。`,
      "把 SQL、Python、Excel 和仪表盘关键词放到简历前半部分。"
    ],
    skills_to_improve_en: input.missingSkills,
    skills_to_improve_zh: input.missingSkillsZh.map((skill) => `补充学习${skill}`),
    matched_skills: input.skills.slice(0, 4),
    missing_skills: input.missingSkills,
    missing_skill_details: createMissingSkillDetails(input.missingSkills),
    important_tools: input.tools,
    suggested_learning_actions_en: [
      "Build one short portfolio project matching this job type.",
      "Prepare one STAR story for stakeholder communication and ambiguity."
    ],
    suggested_learning_actions_zh: [
      "补一个与该岗位类型匹配的小型作品集项目。",
      "准备一个体现跨团队沟通和处理模糊问题的 STAR 案例。"
    ],
    ai_summary_en: `${input.title} at ${input.company} is a strong early-career fit for a business analytics and FinTech-oriented candidate.`,
    ai_summary_zh: `${input.company} 的${input.titleZh}适合商业分析与金融科技方向的早期职业候选人。`,
    resume_keywords: [
      ...input.skills,
      ...input.tools,
      input.roleType,
      "Stakeholder communication",
      "Business insights"
    ],
    application_status: input.status,
    application_deadline: input.deadline,
    application_channel: "Company website",
    contact_person: "",
    interview_date: input.status === "Interview" ? "2026-07-01T10:00" : "",
    follow_up_notes:
      input.status === "Interview"
        ? "Prepare analytics project walkthrough and role motivation."
        : "",
    status_history: [
      {
        id: `${input.id}-status`,
        status: input.status,
        created_at: createdAt,
        note: input.status === "Interview" ? "Recruiter screen scheduled." : ""
      },
      {
        id: `${input.id}-added`,
        status: "Job added",
        created_at: createdAt,
        note: "Sample job for portfolio demo mode."
      }
    ],
    source_url: "https://example.com/sample-job",
    raw_jd: `Sample JD for ${input.title} at ${input.company}. This demo record is designed for local portfolio review without calling the AI API.`,
    notes: "Sample record. Replace with your own notes when applying.",
    created_at: createdAt,
    updated_at: createdAt
  };
}

function createBreakdown(
  score: number,
  region: string,
  regionZh: string
): MatchScoreBreakdown {
  return {
    education_fit: dimension(
      score,
      "Education background fits the role.",
      "学历背景与岗位匹配。",
      "JD asks for statistics, analytics, finance, economics, or related fields.",
      "No major education gap.",
      "暂无明显学历差距。"
    ),
    technical_skills_fit: dimension(
      score - 4,
      "Core analytics tools are mostly covered.",
      "核心分析工具基本覆盖。",
      "JD mentions SQL, Python, Excel, dashboards, or reporting.",
      "Could strengthen one or two advanced tools.",
      "可以补强一到两个进阶工具。"
    ),
    business_communication_fit: dimension(
      score - 2,
      "Consulting and reporting experience supports stakeholder work.",
      "咨询和报告经验有助于支持业务沟通。",
      "JD expects communication with business stakeholders.",
      "Need concise stories showing stakeholder influence.",
      "需要准备体现业务影响力的简洁案例。"
    ),
    experience_fit: dimension(
      score - 8,
      "Role is suitable for an early-career candidate.",
      "岗位适合早期职业候选人。",
      "JD uses junior, internship, associate, or 0-2 years language.",
      "Direct local experience may still be limited.",
      "本地直接经验可能仍然有限。"
    ),
    career_direction_fit: dimension(
      score,
      "Role aligns with analytics, consulting, risk, product, or FinTech direction.",
      "岗位方向与分析、咨询、风险、产品或金融科技匹配。",
      "JD responsibilities map to analytics and business decision support.",
      "No major direction mismatch.",
      "暂无明显职业方向错配。"
    ),
    location_fit: dimension(
      score - 5,
      `Location is relevant to ${region}.`,
      `地点符合${regionZh}求职方向。`,
      `JD location is ${region}.`,
      "Work rights or sponsorship details are not fully stated.",
      "工作权利或签证支持信息不够明确。"
    )
  };
}

function dimension(
  score: number,
  explanationEn: string,
  explanationZh: string,
  evidence: string,
  gapEn: string,
  gapZh: string
) {
  return {
    score: Math.max(0, Math.min(100, score)),
    explanation_en: explanationEn,
    explanation_zh: explanationZh,
    evidence_from_jd: evidence,
    candidate_gap_en: gapEn,
    candidate_gap_zh: gapZh,
    confidence: "High" as const
  };
}

function createMissingSkillDetails(skills: string[]): MissingSkillDetail[] {
  return skills.map((skill, index) => ({
    skill,
    priority: index === 0 ? "High" : "Medium",
    why_it_matters_en:
      "This skill appears in similar roles and may strengthen the resume match.",
    why_it_matters_zh:
      "该技能在类似岗位中较常见，可以提升简历匹配度。",
    impact_on_match_score: index === 0 ? "Medium impact" : "Low to medium impact",
    suggested_resource_type: index === 0 ? "portfolio project" : "practice task"
  }));
}
