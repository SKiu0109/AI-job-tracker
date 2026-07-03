import { cn } from "@/lib/utils";

type RecommendationTone = "green" | "blue" | "amber" | "red";

function resolveRecommendationTone(recommendation: string): RecommendationTone {
  if (recommendation.includes("Strongly") || recommendation.includes("强烈")) return "green";
  if (recommendation.includes("Worth") || recommendation.includes("值得")) return "blue";
  if (recommendation.includes("Low") || recommendation.includes("低")) return "amber";
  return "red";
}

const TONE_CLASSES: Record<RecommendationTone, string> = {
  green: "border-app-success-border bg-app-success-soft text-app-success",
  blue: "border-app-info-border bg-app-info-soft text-app-info",
  amber: "border-app-warning-border bg-app-warning-soft text-app-warning",
  red: "border-app-danger-border bg-app-danger-soft text-app-danger",
};

export function ScoreBadge({
  score,
  recommendation
}: {
  score: number;
  recommendation?: string;
}) {
  const tone = recommendation
    ? TONE_CLASSES[resolveRecommendationTone(recommendation)]
    : score >= 80
      ? TONE_CLASSES.green
      : score >= 60
        ? TONE_CLASSES.amber
        : TONE_CLASSES.red;

  return (
    <span
      className={cn(
        "inline-flex min-w-14 justify-center rounded-app border px-2.5 py-1 text-xs font-bold",
        tone
      )}
    >
      {score}
    </span>
  );
}
