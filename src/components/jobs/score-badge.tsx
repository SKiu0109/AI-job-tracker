import { cn } from "@/lib/utils";

export function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "border-emerald-200 bg-emerald-50 text-success"
      : score >= 60
        ? "border-amber-200 bg-amber-50 text-warn"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <span
      className={cn(
        "inline-flex min-w-14 justify-center rounded-full border px-2.5 py-1 text-xs font-bold shadow-soft",
        tone
      )}
    >
      {score}
    </span>
  );
}
