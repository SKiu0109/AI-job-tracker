"use client";

import { ChangeEvent, useCallback, useState } from "react";
import type { CreditBalance } from "@/types/credits";
import type { CandidateProfile, ResumeProfileAnalysis } from "@/types/job";

type ResumeAnalysisResponse = {
  analysis?: ResumeProfileAnalysis;
  credits?: CreditBalance;
  error?: string;
  extracted_text_preview?: string;
  file_name?: string;
  was_truncated?: boolean;
};

type UseResumeAnalyzerOptions = {
  accessToken?: string;
  currentProfile: CandidateProfile | null;
  language: "en" | "zh";
  messages: {
    analysisFailed: string;
    fileRequired: string;
  };
  onAnalysisReady?: (analysis: ResumeProfileAnalysis) => void;
  onCreditsUpdated?: (credits: CreditBalance) => void;
};

export function useResumeAnalyzer({
  accessToken,
  currentProfile,
  language,
  messages,
  onAnalysisReady,
  onCreditsUpdated
}: UseResumeAnalyzerOptions) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState<ResumeProfileAnalysis | null>(null);
  const [preview, setPreview] = useState("");
  const [wasTruncated, setWasTruncated] = useState(false);
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedAt, setAnalyzedAt] = useState("");

  const resetAnalysis = useCallback(() => {
    setAnalysis(null);
    setPreview("");
    setWasTruncated(false);
    setError("");
    setAnalyzedAt("");
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0] || null;
      setFile(nextFile);
      setFileName(nextFile?.name || "");
      resetAnalysis();
    },
    [resetAnalysis]
  );

  const analyzeResume = useCallback(async () => {
    if (!currentProfile || !file) {
      setError(messages.fileRequired);
      return null;
    }

    setIsAnalyzing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("current_profile", JSON.stringify(currentProfile));
      formData.append("language", language);

      const response = await fetch("/api/analyze-resume", {
        body: formData,
        headers: accessToken
          ? { authorization: `Bearer ${accessToken}` }
          : undefined,
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as ResumeAnalysisResponse;

      if (payload.credits) {
        onCreditsUpdated?.(payload.credits);
      }

      if (!response.ok || !payload.analysis) {
        throw new Error(payload.error || messages.analysisFailed);
      }

      setAnalysis(payload.analysis);
      setPreview(payload.extracted_text_preview || "");
      setFileName(payload.file_name || file.name);
      setWasTruncated(Boolean(payload.was_truncated));
      setAnalyzedAt(new Date().toISOString());
      onAnalysisReady?.(payload.analysis);

      return payload.analysis;
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : messages.analysisFailed
      );
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [accessToken, currentProfile, file, language, messages, onAnalysisReady, onCreditsUpdated]);

  return {
    analysis,
    analyzeResume,
    analyzedAt,
    error,
    file,
    fileName,
    handleFileChange,
    isAnalyzing,
    preview,
    resetAnalysis,
    setError,
    wasTruncated
  };
}
