const LOGO_SIZE = 128;

const JOB_BOARD_HOST_PARTS = [
  "adzuna.",
  "angel.co",
  "careerone.",
  "example.com",
  "glassdoor.",
  "greenhouse.io",
  "indeed.",
  "jobstreet.",
  "lever.co",
  "linkedin.",
  "myworkdayjobs.com",
  "seek.",
  "smartrecruiters.",
  "wellfound.com",
  "workable.com"
];

export type CompanyLogoMetadata = {
  company_domain?: string;
  company_logo_url?: string;
};

export function getCompanyLogoMetadata(sourceUrl: string): CompanyLogoMetadata {
  const domain = getCompanyDomainFromSourceUrl(sourceUrl);

  if (!domain) {
    return {};
  }

  return {
    company_domain: domain,
    company_logo_url: createCompanyLogoUrl(domain)
  };
}

export function getCompanyDomainFromSourceUrl(sourceUrl: string) {
  const normalizedUrl = sourceUrl.trim();

  if (!normalizedUrl) {
    return "";
  }

  try {
    const url = new URL(normalizedUrl);
    const host = normalizeHost(url.hostname);

    if (!host || isJobBoardHost(host)) {
      return "";
    }

    return host;
  } catch {
    return "";
  }
}

function createCompanyLogoUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${LOGO_SIZE}`;
}

function normalizeHost(hostname: string) {
  return hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^careers\./, "")
    .replace(/^jobs\./, "");
}

function isJobBoardHost(host: string) {
  return JOB_BOARD_HOST_PARTS.some((part) => host.includes(part));
}
