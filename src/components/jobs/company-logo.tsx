"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type CompanyLogoProps = {
  company: string;
  logoUrl?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-9 w-9 rounded-app text-[11px]",
  md: "h-11 w-11 rounded-app text-xs",
  lg: "h-14 w-14 rounded-lg text-sm"
};

const stripeClasses = {
  sm: "bottom-1.5 left-2 right-2 h-0.5",
  md: "bottom-2 left-2.5 right-2.5 h-0.5",
  lg: "bottom-3 left-3 right-3 h-1"
};

const imagePaddingClasses = {
  sm: "p-1",
  md: "p-1.5",
  lg: "p-2"
};

const imageSizes = {
  sm: 36,
  md: 44,
  lg: 56
};

const knownLogos = [
  {
    match: "finsight",
    mark: "FS",
    className: "border-teal-800 bg-teal-900 text-white"
  },
  {
    match: "harbour",
    mark: "HB",
    className: "border-sky-800 bg-sky-700 text-white"
  },
  {
    match: "brightcart",
    mark: "BC",
    className: "border-emerald-700 bg-emerald-600 text-white"
  },
  {
    match: "marketbridge",
    mark: "MB",
    className: "border-indigo-800 bg-indigo-700 text-white"
  },
  {
    match: "northstar",
    mark: "NS",
    className: "border-slate-800 bg-slate-900 text-white"
  },
  {
    match: "paylink",
    mark: "PL",
    className: "border-cyan-800 bg-cyan-700 text-white"
  }
];

const fallbackPalettes = [
  "border-slate-800 bg-slate-900 text-white",
  "border-cyan-800 bg-cyan-700 text-white",
  "border-violet-800 bg-violet-700 text-white",
  "border-rose-800 bg-rose-700 text-white",
  "border-amber-700 bg-amber-500 text-white"
];

export function CompanyLogo({
  company,
  logoUrl,
  size = "md",
  className
}: CompanyLogoProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState("");
  const profile = getCompanyLogoProfile(company);
  const resolvedLogoUrl = logoUrl?.trim() ?? "";
  const shouldShowImage =
    resolvedLogoUrl.length > 0 && failedLogoUrl !== resolvedLogoUrl;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border font-bold tracking-normal",
        sizeClasses[size],
        shouldShowImage
          ? "border-app-border-soft bg-app-surface text-app-text-primary"
          : profile.className,
        className
      )}
    >
      {shouldShowImage ? (
        <Image
          alt=""
          className={cn("h-full w-full object-contain", imagePaddingClasses[size])}
          height={imageSizes[size]}
          onError={() => setFailedLogoUrl(resolvedLogoUrl)}
          src={resolvedLogoUrl}
          width={imageSizes[size]}
        />
      ) : (
        <>
          <span className="relative z-10">{profile.mark}</span>
          <span
            className={cn(
              "absolute rounded-full bg-app-surface",
              stripeClasses[size]
            )}
          />
        </>
      )}
    </span>
  );
}

function getCompanyLogoProfile(company: string) {
  const normalized = company.toLowerCase();
  const known = knownLogos.find((logo) => normalized.includes(logo.match));

  if (known) {
    return known;
  }

  return {
    mark: getInitials(company),
    className: fallbackPalettes[getHashIndex(company, fallbackPalettes.length)]
  };
}

function getInitials(company: string) {
  const words = company
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "AI";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getHashIndex(value: string, modulo: number) {
  const hash = value.split("").reduce((total, char) => {
    return total + char.charCodeAt(0);
  }, 0);

  return hash % modulo;
}
